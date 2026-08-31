import { supabase } from '../lib/supabaseClient'
import { themeForCampaign, THEME_ORDER, themeMeta } from './themes'
import { CURATED_CAMPAIGNS, CURATED_KEY_SET, EMAIL_FAMILIES, EMAIL_FAMILY_FACT_KEYS, emailFamilyOf, emailFamiliesFor } from './pinnedCampaigns'
import { isSalesGenerated } from './attribution'
import {
  GSC_PRIMARY_SITE,
  REPORTING_YEAR,
  HISTORY_START_YEAR,
  REPORTING_END_ISO,
  PILLAR_UNMAPPED,
  NA,
  isNA,
  quarterLabel,
  PILLARS,
  REGION_ORDER,
} from './constants'

// CURRENCY: v_fact_enriched.spend (LinkedIn rows) is GBP; v_marketing_spend.amount
// is EUR. These are never summed together — each surface labels its currency.
// LinkedIn rows are a cumulative LIFETIME snapshot (single activity_date), NOT a
// daily series — treated as current totals, never plotted as a trend.

// Only columns the view actually exposes. NOTE: `clicks` is intentionally
// absent — it lives on base fact_channel_daily, not on v_fact_enriched, so we
// never request it (see MAPPING.md).
const FACT_COLS =
  'fact_id,campaign_key,campaign_name,region_code,region_name,channel_name,campaign_type,pillar_name,activity_date,campaign_start_date,year,quarter,source,spend,impressions,leads,mql_count,sql_count,opp_count,created_opp_count,created_opp_value,pipeline_value,closed_won_value,closed_won_count,margin_value,pipeline_margin_value,pipeline_margin_known_count,pipeline_margin_pending_count'

// Translate the shared filter object into PostgREST predicates. Every active
// filter is applied here, so every figure derived from fetchFacts re-scopes.
// Today (YYYY-MM-DD, browser runtime).
const todayIso = () => new Date().toISOString().slice(0, 10)

// Upper bound for every "to date" read. The reporting window runs Q1–Q3 2026,
// so we cap at the EARLIER of today and REPORTING_END_ISO (Q3 2026 close).
// While Q3 is in progress that means "today" — so Q4 returns empty and YTD
// stops at today (never leaks Q4 rows).
// If REPORTING_END_ISO is set null later, this falls back to plain "today".
const toDateCapIso = () => {
  const today = todayIso()
  return REPORTING_END_ISO && REPORTING_END_ISO < today ? REPORTING_END_ISO : today
}

// The [from, to] date window for a quarter pill, capped at the to-date cap. 'ytd' (or no
// quarter) spans the reporting year. Returns ISO date strings.
export function quarterWindow(quarter) {
  const y = REPORTING_YEAR
  const win = { q1: ['-01-01', '-03-31'], q2: ['-04-01', '-06-30'], q3: ['-07-01', '-09-30'], q4: ['-10-01', '-12-31'] }
  const [from, toRaw] = quarter && quarter !== 'ytd' && win[quarter]
    ? win[quarter].map((sfx) => `${y}${sfx}`)
    : [`${y}-01-01`, `${y}-12-31`]
  const cap = toDateCapIso()
  return [from, toRaw < cap ? toRaw : cap]
}


// QUARTER SCOPE:
//   q1..q4 → that quarter of REPORTING_YEAR (2026).
//   ytd    → HISTORY_START_YEAR (2026) → now; all earlier years excluded.
// FUTURE-DATE CAP: every figure is "to date" — rows dated after today are excluded.
// A quarter that hasn't started yet (Q3/Q4) therefore returns nothing, and YTD stops
// at today. This removes phantom funnel rows from SF closed-LOST opps that carry a
// stale FUTURE CloseDate (they leak sql_count into future quarters with £0 pipeline /
// 0 won; the monotonic floor then lifts Leads/MQL to match). Real figures are
// untouched: open pipeline is dated by CreatedDate (past) and won deals can't close
// in the future, so only those future-dated artifacts drop out.
function applyFilters(q, f = {}) {
  if (f.quarter && f.quarter !== 'ytd') {
    q = q.eq('year', REPORTING_YEAR).eq('quarter', Number(String(f.quarter).replace('q', '')))
  } else {
    q = q.gte('year', HISTORY_START_YEAR) // ytd: 2026 onward
  }
  q = q.lte('activity_date', toDateCapIso()) // to-date cap, capped at Q2 2026 close (see note above)
  if (f.region && f.region !== 'all') q = q.eq('region_code', f.region)
  if (f.channel) q = q.eq('channel_name', f.channel)
  if (f.campaign && f.campaign !== 'all') q = q.eq('campaign_key', f.campaign)
  if (f.pillar) {
    if (f.pillar === PILLAR_UNMAPPED) q = q.is('pillar_name', null)
    else q = q.eq('pillar_name', f.pillar)
  }
  return q
}

// PostgREST caps each response at the project's `max-rows` (default 1000), which
// `.limit()` cannot exceed. Once a scoped result tops 1000 rows a single fetch
// would silently return only the first page and undercount every figure. So any
// read that can exceed 1000 rows goes through fetchAll(), which pages with
// .range() and concatenates — guaranteeing the full result regardless of the cap.
//
// buildQuery: () => a fresh, filtered query builder (table + select + predicates).
// orderBy: array of column names giving a STABLE total order (unique grain), so
//   page boundaries never skip or duplicate rows. Must be a unique key per view.
const PAGE = 1000
async function fetchAll(buildQuery, orderBy) {
  const all = []
  for (let from = 0; ; from += PAGE) {
    let q = buildQuery()
    for (const col of orderBy) q = q.order(col, { ascending: true })
    q = q.range(from, from + PAGE - 1)
    const { data, error } = await q
    if (error) throw error
    all.push(...(data || []))
    if (!data || data.length < PAGE) break // last (short) page reached
  }
  return all
}

// ---- Region overrides are AUTHORITATIVE for filtering (20 Aug) ------------
// Margot: "if I update the region for a specific campaign, will the regional overviews
// update automatically to reflect this change?" Until now the answer was no — the editable
// region was render-only, while every regional figure filtered on the region derived from
// the deal's Salesforce account. Now an override decides where its campaign is counted, and
// it can name SEVERAL regions (BeNeLux = BeLux+NL, or all three for a group-wide activity).
let _ovRegionCache = null
let _ovRegionAt = 0
async function overrideRegionMap() {
  if (_ovRegionCache && Date.now() - _ovRegionAt < 60_000) return _ovRegionCache
  const { data, error } = await supabase.from('campaign_overrides').select('campaign_key,regions,display_region')
  if (error) throw error
  const m = new Map()
  for (const r of data || []) {
    const regs = Array.isArray(r.regions) && r.regions.length
      ? r.regions
      : r.display_region && ['UKI', 'BeLux', 'NL'].includes(r.display_region) ? [r.display_region] : null
    if (regs) m.set(r.campaign_key, regs)
  }
  _ovRegionCache = m
  _ovRegionAt = Date.now()
  return m
}
export function invalidateOverrideRegionCache() { _ovRegionCache = null }

// fact_id is the unique PK exposed by the view → stable paging key.
async function fetchFacts(f) {
  const region = f.region && f.region !== 'all' ? f.region : null
  if (!region) {
    return fetchAll(() => applyFilters(supabase.from('v_fact_enriched').select(FACT_COLS), f), ['fact_id'])
  }
  const ovMap = await overrideRegionMap()
  // Campaigns explicitly placed INTO this region must be pulled in even though their deals'
  // accounts sit elsewhere; campaigns placed elsewhere are dropped below.
  const into = [...ovMap.entries()].filter(([, rs]) => rs.includes(region)).map(([k]) => k)
  const rows = await fetchAll(() => {
    const q = applyFilters(supabase.from('v_fact_enriched').select(FACT_COLS), { ...f, region: null })
    return into.length
      ? q.or(`region_code.eq.${region},campaign_key.in.(${into.join(',')})`)
      : q.eq('region_code', region)
  }, ['fact_id'])
  return rows.filter((r) => {
    const ov = ovMap.get(r.campaign_key)
    return ov ? ov.includes(region) : r.region_code === region
  })
}

const sum = (rows, k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)

// spend & impressions are 0 across all seed rows; surface as NA rather than a
// misleading real-looking 0. If real spend lands later this flips automatically.
const naIfAllZero = (rows, k) => (sum(rows, k) > 0 ? sum(rows, k) : NA)

// LinkedIn delivery spend is stored in GBP (separate manual feed with no per-row currency).
// Margot (G2) wants every monetary value shown in EUR, so we convert LinkedIn spend for
// display at a fixed GBP→EUR rate. Static rate — wire to a live/SF rate if precise spend
// reconciliation is needed (LI5). SF opportunity money is already EUR at ingest.
const GBP_TO_EUR = 1.17
const gbpToEur = (v) => (isNA(v) ? v : Number(v) * GBP_TO_EUR)

function funnelOf(rows) {
  // Raw per-stage sums. Each is a REAL actual, but the stages are dated by
  // different events (leads/MQL by lead date; SQL/Opp/Won by opportunity/close
  // date), so under a region/quarter scope they land in different buckets and
  // the funnel can invert (e.g. NL MQL 39 < SQL 56; Q3 leads 0 / SQL 27).
  const leadsRaw = sum(rows, 'leads')
  const mqlRaw = sum(rows, 'mql_count')
  const sqlRaw = sum(rows, 'sql_count')
  const oppRaw = sum(rows, 'opp_count')
  const wonRaw = sum(rows, 'closed_won_count')
  // Created Opportunities (X3): ALL opps created in the period (marketing-attributed),
  // regardless of qualification. NOT part of the monotonic floor — it's a parallel count
  // that can exceed SQL (which is qualified only). 0 until the re-ingest populates it → NA.
  const createdRaw = sum(rows, 'created_opp_count')

  // "Reached this stage OR BEYOND" floor: anyone who reached a deeper stage must
  // have passed through the shallower ones, so each stage is at least as large
  // as the next. Applied bottom-up on the SCOPED TOTALS (not per-row, which would
  // double-count), this guarantees Leads ≥ MQL ≥ SQL ≥ Opp ≥ Won by construction
  // at every region + quarter, including in-progress quarters. Actuals stay real:
  // we never mutate the warehouse counts, only present the monotonic floor.
  const won = wonRaw
  const opp = Math.max(oppRaw, won)
  const sql = Math.max(sqlRaw, opp)
  const leads = Math.max(leadsRaw, mqlRaw, sql)
  // MQL = Leads by definition (Margot, 9 Jul call — the lead/MQL distinction was dropped).
  // Forcing equality here also absorbs the small asymmetry from non-Salesforce feeds (e.g.
  // the LinkedIn lead-gen feed writes `leads` without `mql_count`), so the funnel reads
  // Leads = MQL exactly on every page.
  const mql = leads

  // Influenced margin coverage: margin is gross profit (EUR) — Gross_Profit_Value__c,
  // else Amount × Gross_Profit_Margin__c; a deal with neither reads NULL in
  // v_fact_enriched (never full revenue), so it drops out of the margin sum. Surface
  // how many won deals still lack gross profit so the UI can caveat "covers X of Y
  // deals" rather than silently reporting margin over a sliver of deals.
  const wonValueRows = rows.filter((r) => Number(r.closed_won_value) > 0)
  const dealsOf = (rs) => rs.reduce((a, r) => a + (Number(r.closed_won_count) || 1), 0)
  const marginPendingDeals = dealsOf(wonValueRows.filter((r) => r.margin_value == null))
  const marginKnownDeals = dealsOf(wonValueRows.filter((r) => r.margin_value != null))

  // Influenced Pipeline on the GROSS-PROFIT basis (Margot, 11 Aug — supersedes the 6 Aug
  // revenue lock): gross profit over open qualified opps (pipeline_margin_value, ingested
  // per-opp from Salesforce Gross Profit) plus gross profit over won deals (margin_value).
  // The revenue figure stays available as `pipeline` for the secondary label.
  const openGpKnown = sum(rows, 'pipeline_margin_known_count')
  const openGpPending = sum(rows, 'pipeline_margin_pending_count')
  const openGp = sum(rows.filter((r) => r.pipeline_margin_value != null), 'pipeline_margin_value')
  const wonGp = sum(rows.filter((r) => r.margin_value != null), 'margin_value')

  return {
    leads,
    mql,
    sql,
    // Qualified opps that are open or won (a SUBSET of sql). NA (not 0) only when
    // there is genuinely no opp/won signal in scope; if any deal is won we know
    // at least that many reached opp, so the floor applies.
    opp: oppRaw > 0 || won > 0 ? opp : NA,
    // Created Opportunities — all opps created in period; NA until re-ingest populates it.
    createdOpps: createdRaw > 0 ? createdRaw : NA,
    // Value of opps CREATED in the period (PR6: "are you using only opps created in 2026?").
    // Unlike Influenced Pipeline (open + won, dated by activity/close), this is strictly the
    // pipeline GENERATED by opps created this period — the true "generated this quarter" figure.
    createdOppsValue: (() => { const v = sum(rows, 'created_opp_value'); return v > 0 ? v : NA })(),
    // Gross-profit counterpart of New Pipeline Created (20 Aug: "please use gross margin
    // for these figures"). Available since the 24 Aug re-ingest.
    createdOppsMargin: (() => { const v = sum(rows, 'created_opp_margin_value'); return v > 0 ? v : NA })(),
    // Influenced / generated pipeline = open qualified pipeline + closed-won (deals that
    // closed WERE influenced). Including won guarantees Closed Won is always a SUBSET of the
    // pipeline shown — fixes Margot's "Closed Won > Pipeline" / "Pipeline empty" (OV6, 9 Jul).
    pipeline: sum(rows, 'pipeline_value') + sum(rows, 'closed_won_value'),
    // Influenced Pipeline (gross profit) — the PRIMARY basis since 11 Aug. NA (never 0, never
    // revenue) while open pipeline exists but no open opp's gross profit has been ingested yet
    // (pre-refresh, or genuinely blank in Salesforce — the pending count tells the UI which).
    marginPipeline: (() => {
      const openPipe = sum(rows, 'pipeline_value')
      if (openPipe > 0 && openGpKnown === 0) return NA
      const v = openGp + wonGp
      return v > 0 ? v : NA
    })(),
    // Coverage for the caveat line: opps whose gross profit is known vs still blank in SF
    // (open opps counted per-opp at ingest; won deals via the margin_value row coverage).
    marginPipelineKnownOpps: openGpKnown + marginKnownDeals,
    marginPipelinePendingOpps: openGpPending + marginPendingDeals,
    closedWon: sum(rows, 'closed_won_value'),
    // Count of won deals (terminal funnel stage). NA (not 0) until the SF
    // workflow re-runs to populate closed_won_count.
    closedWonCount: wonRaw > 0 ? won : NA,
    margin: naIfAllZero(rows, 'margin_value'), // influenced margin = gross profit EUR (GP value, else Amount × GP margin; blank → NULL, excluded)
    marginPendingDeals, // won deals with no gross profit yet (margin not counted)
    marginKnownDeals, // won deals whose margin is counted
    // SALES-GENERATED SPLIT (Paul: "I'd see outreach as more sales-generated leads … we
    // should exclude that"). Always computed, never deducted here — the headline figures
    // above still include everything, and the UI shows this alongside them with a toggle,
    // so nothing disappears silently before CWSI confirms the classification. Keyed on
    // campaign TYPE, not name (Robin's warning) — see data/attribution.js.
    salesGenerated: (() => {
      const sg = rows.filter(isSalesGenerated)
      if (!sg.length) return null
      return {
        pipeline: sum(sg, 'pipeline_value') + sum(sg, 'closed_won_value'),
        // gross-profit basis of the same slice, so the exclude-toggle can adjust the GP headline
        marginPipeline:
          sum(sg.filter((r) => r.pipeline_margin_value != null), 'pipeline_margin_value') +
          sum(sg.filter((r) => r.margin_value != null), 'margin_value'),
        closedWon: sum(sg, 'closed_won_value'),
        margin: sum(sg.filter((r) => r.margin_value != null), 'margin_value'),
        createdOpps: sum(sg, 'created_opp_count'),
        campaigns: [...new Set(sg.map((r) => r.campaign_key).filter(Boolean))],
        campaignNames: [...new Set(sg.map((r) => r.campaign_name).filter(Boolean))],
      }
    })(),
    spend: naIfAllZero(rows, 'spend'),
    impressions: naIfAllZero(rows, 'impressions'),
  }
}

// key may be a column name (string) or a per-row derivation function — the latter
// lets callers group on a computed value (e.g. the split display channel below).
function groupBy(rows, key) {
  const keyFn = typeof key === 'function' ? key : (r) => r[key] ?? null
  const m = new Map()
  for (const r of rows) {
    const k = keyFn(r)
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  return m
}

// Most-common region among a campaign's fact rows — a single representative region for
// the per-campaign editable Region field (G4: Region editable everywhere). A campaign can
// span regions; we surface the modal region as the default, which the user can override
// (campaign_overrides.display_region) on any page the campaign appears.
function dominantRegion(rs) {
  const counts = {}
  for (const r of rs) { const k = r.region_code || 'UNASSIGNED'; counts[k] = (counts[k] || 0) + 1 }
  let best = 'UNASSIGNED', n = -1
  for (const k of Object.keys(counts)) if (counts[k] > n) { n = counts[k]; best = k }
  return best
}

// Did this campaign actually contribute anything in the selected period?
//
// Client ask (Margot 14.07, raised for BOTH events and email): campaigns from
// earlier years "still appear" in the per-campaign tables. They appear because they
// have activity ROWS dated in the period while every metric on them is zero — so
// quarter filtering alone can't remove them. A campaign dated 2024/2025 that still
// has GENUINE 2026 activity (an opp that reached SQL or won this year) is kept; only
// pure-zero clutter is dropped. `closedWon >= 1` rather than `> 0` clears rounding
// noise like €0.86.
//
// Shared deliberately: this predicate was originally inlined in the events list only,
// which is exactly why the same fix never reached the email list (M3). Both callers
// now use this one so they cannot drift again. Accepts either `pipeline` (events,
// channel) or `oppValue` (email) as the pipeline field, since the two lists shape
// their rows for different tables.
const contributedInPeriod = (c) =>
  c.mql > 0 || c.sql > 0 || c.createdOpps > 0 || (c.pipeline ?? c.oppValue ?? 0) > 0 || c.closedWon >= 1

// ─────────────────────────────────────────────────────────────────────────────
// CAMPAIGN-LEVEL ROWS — why they are computed over the WHOLE year, not the pill.
//
// A campaign is ONE thing, but its results are dated by the DEAL: an open
// opportunity by its created date, a won one by its close date (see
// METRIC_DEFINITIONS.md). So quarter-filtering a campaign's rows splits a single
// campaign's opportunities across the pills and makes every campaign look smaller
// than it does in Salesforce.
//
// That is exactly the reported under-count. The 22.04.2026 UK "Protect Data, Power
// AI" event holds 10 opportunities worth €143k in Salesforce; one of them (€64,655,
// 45% of the campaign's qualified pipeline) was created on 13 Jan, so with the Q2
// pill selected the events list showed €50,232 instead of €114,887. Across 2026, 9
// campaigns are split across quarters and €113,450 of €546,388 (21%) of open
// pipeline was invisible whenever a single quarter was selected.
//
// So each row carries BOTH bases and nothing is silently redefined:
//   • the row's own fields  → the campaign's whole-2026 contribution (what the
//     per-campaign tables show, so they tie to the campaign in Salesforce);
//   • row.period            → the same shape scoped to the selected quarter (what the
//     page's KPI tiles keep using, so "current view" still means current view).
// WHICH campaigns are listed is still driven by the selected period — a campaign must
// have contributed something in that period to appear (the M3 rule, see
// contributedInPeriod) — so the quarter pill keeps working as a filter.
//
// periodRows — rows inside the selected quarter/region (selection + M3 rule + tiles)
// yearRows   — the same read with quarter: 'ytd' (the displayed campaign figures)
// shape      — (campaignKey, rows) => the row object for the table
// ─────────────────────────────────────────────────────────────────────────────
function campaignRows(periodRows, yearRows, shape) {
  const period = new Map(
    [...groupBy(periodRows, 'campaign_key')].map(([key, rs]) => [key, shape(key, rs)]),
  )
  const byKey = new Map([...groupBy(yearRows, 'campaign_key')].map(([key, rs]) => [key, rs]))
  return [...period]
    .filter(([, p]) => contributedInPeriod(p))
    // A campaign in the period is always in the year read too (ytd is the wider window),
    // but fall back to its period rows rather than dropping it if that ever changes.
    .map(([key, p]) => ({ ...shape(key, byKey.get(key) || []), period: p }))
}

// Presentation channel (Margot X8 / OV6 / BP5): Salesforce collapses all event
// campaign types into ONE channel ("Events & Webinars"), but the client wants
// Webinars and in-person Events reported as two distinct channels. We split at
// the read layer using campaign_type (already on v_fact_enriched) — no re-ingest,
// dim_channel stays a single row so the channel FILTER/selector and the dedicated
// Events page (which fetches channel='Events & Webinars' and splits internally)
// are untouched. Every OTHER channel passes through unchanged.
const EVENTS_CHANNEL = 'Events & Webinars'
const SEO_CHANNEL = 'Organic SEO'
function displayChannel(row) {
  // Split "Events & Webinars" into Webinars vs In-person Events.
  if (row.channel_name === EVENTS_CHANNEL) {
    return row.campaign_type === 'Webinar' ? 'Webinars' : 'In-person Events'
  }
  // Peel whitepaper-download campaigns ("Content/White Paper") out of "Organic SEO"
  // into their own "Whitepapers" channel — they're reported on the Email page, not
  // organic search, so they shouldn't inflate SEO in the channel breakdowns either.
  // Mirrors the Events/Webinars split: read-layer via campaign_type, no re-ingest.
  if (row.channel_name === SEO_CHANNEL && row.campaign_type === 'Content/White Paper') {
    return 'Whitepapers'
  }
  // W6 (11 Aug): a row with no channel at all coalesces into "Other / Unmapped" —
  // previously it grouped under a blank/null bucket on Overview + Pipeline while the
  // Board coalesced it, so the three surfaces disagreed.
  return row.channel_name || 'Other / Unmapped'
}

// Margot (20 Aug): "If the campaigns cannot be mapped to a specific marketing channel, they
// should not be included in the overview. Could you please provide a breakdown of the
// campaigns these numbers relate to? That will allow me to determine whether they are
// marketing-driven and should be included."
//
// So the Overview EXCLUDES the unmapped bucket, and names exactly what it dropped instead of
// silently shrinking. The bucket is small and knowable: in 2026 it is four Salesforce
// campaigns, two of which are plainly not campaigns at all (a connector and a list import).
// Every other page still shows the bucket, so nothing is hidden — only the headline changes.
export const UNMAPPED_CHANNEL = 'Other / Unmapped'
export const isUnmappedRow = (row) => displayChannel(row) === UNMAPPED_CHANNEL

// The campaign-level breakdown behind the excluded bucket, for the on-screen list.
export function unmappedBreakdown(rows) {
  const un = rows.filter(isUnmappedRow)
  const byCampaign = [...groupBy(un, 'campaign_key')]
    .map(([key, rs]) => ({
      campaignKey: key,
      campaignName: rs[0]?.campaign_name || key || 'Unattributed',
      campaignType: rs[0]?.campaign_type || null,
      mql: sum(rs, 'mql_count'),
      pipeline: sum(rs, 'pipeline_value'),
      closedWon: sum(rs, 'closed_won_value'),
    }))
    .filter((c) => c.mql || c.pipeline || c.closedWon)
    .sort((a, b) => b.closedWon - a.closedWon || b.pipeline - a.pipeline)
  return {
    campaigns: byCampaign,
    pipeline: sum(un, 'pipeline_value'),
    closedWon: sum(un, 'closed_won_value'),
    count: byCampaign.length,
  }
}

// ---- Surface query functions (each returns view-ready, aggregated data) ----

// Retention / Retained Contracts (B3, 19 Jun). Renewals (Opportunity.Type=
// 'Renewal') are account-based, NOT campaign-attributed, so they live in their
// own fact (v_retention), never fact_channel_daily. "Retained" = WON renewals in
// the scoped period; expansion = won Upsell + Cross-Sell (reported separately).
// Region + quarter scope it (v_retention exposes region_code/year/quarter).
export async function getRetention(filters = {}) {
  const rows = await fetchAll(() => {
    let q = supabase
      .from('v_retention')
      .select('fact_id,region_code,year,quarter,opp_type,won_count,won_value,open_count,open_value')
    if (filters.quarter && filters.quarter !== 'ytd') {
      q = q.eq('year', REPORTING_YEAR).eq('quarter', Number(String(filters.quarter).replace('q', '')))
    } else {
      // ytd = REPORTING_YEAR (2026) ONLY — not "2026 onward". Renewals carry future
      // CloseDates (2027/2028), so an open-ended gte leaked future-dated won renewals
      // into the 2026 figure. Bound to the single reporting year (client: 2026-only).
      q = q.eq('year', REPORTING_YEAR)
    }
    q = q.lte('activity_date', toDateCapIso()) // to-date cap (Q2 2026 close) — drop future/Q3+ renewals
    if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
    return q
  }, ['fact_id'])

  const renewal = rows.filter((r) => r.opp_type === 'Renewal')
  const expansion = rows.filter((r) => r.opp_type === 'Upsell' || r.opp_type === 'Cross-Sell')
  return {
    retainedCount: sum(renewal, 'won_count'),
    retainedValue: sum(renewal, 'won_value'),
    openCount: sum(renewal, 'open_count'),
    openValue: sum(renewal, 'open_value'),
    expansionCount: sum(expansion, 'won_count'),
    expansionValue: sum(expansion, 'won_value'),
    hasData: rows.length > 0,
  }
}

// Total sales meetings (B7, 20 Jun). SF Event (Type='Meeting') deduped to one row
// per (Subject, day, Who, What) in ingestion, account/opp/lead region-attributed,
// into its own fact (v_meetings) — never campaign-attributed, mirroring v_retention.
// This is ALL sales meetings (Event has no Outreach-source field — Probe C). It is
// NOT Paul's "100 meetings" target: per the 24 Apr call that target is Outreach-
// SEQUENCE-generated additional meetings, sourced from Outreach.io /meetings on the
// Outreach page — never scored against this all-meetings count. Accessor kept for a
// future target-free "total sales meetings" view; not wired to Overview (reverted
// 20 Jun). Region + quarter scope it like retention.
export async function getMeetings(filters = {}) {
  const rows = await fetchAll(() => {
    let q = supabase
      .from('v_meetings')
      .select('fact_id,region_code,year,quarter,activity_date,meeting_count')
    if (filters.quarter && filters.quarter !== 'ytd') {
      q = q.eq('year', REPORTING_YEAR).eq('quarter', Number(String(filters.quarter).replace('q', '')))
    } else {
      q = q.gte('year', HISTORY_START_YEAR) // ytd: 2026 onward (matches applyFilters)
    }
    q = q.lte('activity_date', toDateCapIso()) // to-date cap (Q2 2026 close) — no Q3+ meetings
    if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
    return q
  }, ['fact_id'])

  return {
    meetingsBooked: sum(rows, 'meeting_count'),
    hasData: rows.length > 0,
  }
}

export async function getOverview(filters) {
  // Retained Contracts + Expansion removed from the UI (Margot, 9 Jul call — too hard to
  // attribute to marketing for now), so Overview no longer fetches retention.
  const allRows = await fetchFacts(filters)
  // Unmapped campaigns are OUT of the Overview (20 Aug) — and listed, not just dropped.
  const unmapped = unmappedBreakdown(allRows)
  const rows = allRows.filter((r) => !isUnmappedRow(r))
  const funnel = funnelOf(rows)
  const byChannel = [...groupBy(rows, displayChannel)]
    .map(([channel, rs]) => ({
      channel,
      // Generated pipeline = open + closed-won so Closed Won is always a subset (OV6).
      pipeline: sum(rs, 'pipeline_value') + sum(rs, 'closed_won_value'),
      closedWon: sum(rs, 'closed_won_value'),
      // Gross-profit counterpart. "Closed-Won" means gross profit on Campaigns, Events, Email,
      // SEO and the per-channel pages, so it has to mean gross profit here too — the client
      // asked for one basis across the dashboard, and the same label meaning two different
      // things between pages is the exact confusion she flagged.
      margin: sum(rs, 'margin_value'),
      // Spend is GBP and currently only present on LinkedIn rows (snapshot).
      spend: naIfAllZero(rs, 'spend'),
      spendCurrency: 'GBP',
    }))
    .sort((a, b) => b.pipeline - a.pipeline)
  return { funnel, byChannel, unmapped, hasData: rows.length > 0, rowCount: rows.length }
}

export async function getKpiTracker(filters) {
  const [rows, retention] = await Promise.all([fetchFacts(filters), getRetention(filters)])
  return {
    funnel: funnelOf(rows),
    retention, // Retained contracts (won renewals) + Expansion split — v_retention
    hasData: rows.length > 0,
    rowCount: rows.length,
  }
}

// Prior in-scope quarter for QoQ trend. Reporting is 2026-only (HISTORY_START_YEAR),
// so Q1 has no in-scope predecessor and YTD is not a single quarter → both return
// null (QoQ is simply omitted there, never faked against an out-of-scope quarter).
function priorQuarter(quarter) {
  return { q2: 'q1', q3: 'q2', q4: 'q3' }[quarter] || null
}

// ---- Board Pack rich data set (T-7, enriched) ------------------------------
// One scoped fetch feeds the funnel + channel contribution + regional split; a
// second scoped fetch (prior quarter) feeds QoQ trend; retention + open-pipeline
// stage distribution come from their own views. Everything is computed with the
// SAME helpers (funnelOf/sum/groupBy) the rest of the dashboard uses, so the board
// pack can never disagree with a channel/pipeline page. boardPack.js shapes this
// raw set into the metric/lever/trace structure; this layer only aggregates.
export async function getBoardPackData(filters = {}) {
  const prevQ = priorQuarter(filters.quarter)
  // Retention (retained contracts + expansion) removed from the board pack per Margot
  // (9 Jul call) — so it is no longer fetched or traced here.
  const [rows, prevRows, stage] = await Promise.all([
    fetchFacts(filters),
    prevQ ? fetchFacts({ ...filters, quarter: prevQ }) : Promise.resolve(null),
    getOpportunityStage(filters),
  ])

  const funnel = funnelOf(rows)
  const prevFunnel = prevRows ? funnelOf(prevRows) : null

  // Channel contribution — who drove the pipeline. Dropped if a channel has no
  // signal in scope (keeps the board pack to channels that actually contributed).
  const byChannel = [...groupBy(rows, displayChannel)]
    .map(([channel, rs]) => ({
      channel: channel ?? 'Unattributed',
      leads: sum(rs, 'leads'),
      mql: sum(rs, 'mql_count'),
      sql: sum(rs, 'sql_count'),
      // Generated pipeline = open + closed-won so Closed Won is always a subset (OV6).
      pipeline: sum(rs, 'pipeline_value') + sum(rs, 'closed_won_value'),
      closedWon: sum(rs, 'closed_won_value'),
    }))
    .filter((c) => c.pipeline > 0 || c.mql > 0 || c.closedWon > 0)
    .sort((a, b) => b.pipeline - a.pipeline)

  // Regional split — only meaningful when scope is All Regions; the board pack
  // shows it conditionally on that. Ordered by pipeline contribution.
  const byRegion = [...groupBy(rows, 'region_code')]
    .map(([code, rs]) => ({
      regionCode: code ?? 'UNASSIGNED',
      region: rs[0]?.region_name ?? code ?? 'Unassigned',
      mql: sum(rs, 'mql_count'),
      sql: sum(rs, 'sql_count'),
      createdOpps: sum(rs, 'created_opp_count'),
      // Generated pipeline = open + closed-won so Closed Won is always a subset (OV6).
      pipeline: sum(rs, 'pipeline_value') + sum(rs, 'closed_won_value'),
      closedWon: sum(rs, 'closed_won_value'),
    }))
    .filter((r) => r.pipeline > 0 || r.mql > 0 || r.closedWon > 0)
    .sort((a, b) => b.pipeline - a.pipeline)

  return {
    funnel,
    prevFunnel,
    prevQuarter: prevQ,
    byChannel,
    byRegion,
    stage, // { stages, snapshotDate, hasData } — open-pipeline snapshot (region-scoped)
    hasData: rows.length > 0,
    rowCount: rows.length,
  }
}

// ---- KPI target register (editable; KPI Tracker only) ---------------------
// PROVISIONAL placeholder targets live in the `kpi_targets` table (seeded from
// thresholds.js KPI_QUARTERLY_TARGETS). The KPI Tracker reads them here and edits
// write straight back, so the client owns their targets without a code change.
// ACTUALS are never stored here — only targets. RLS: authenticated read+write.
export async function getKpiTargets() {
  const { data, error } = await supabase.from('kpi_targets').select('*')
  if (error) throw error
  const byKey = {}
  for (const r of data || []) byKey[r.kpi_key] = r
  return byKey
}

// Update one period's target for a KPI. period ∈ 'q1'|'q2'|'q3'|'q4'|'fy';
// value is a number or null (clears it). Returns the updated row.
export async function updateKpiTarget(kpiKey, period, value) {
  if (!['q1', 'q2', 'q3', 'q4', 'fy'].includes(period)) throw new Error(`bad period: ${period}`)
  const v = value == null || value === '' || Number.isNaN(Number(value)) ? null : Number(value)
  const { data, error } = await supabase
    .from('kpi_targets')
    .update({ [period]: v })
    .eq('kpi_key', kpiKey)
    .select()
    .single()
  if (error) throw error
  return data
}

// ---- Editable campaign overrides (B4 / CC-4) ------------------------------
// Friendly display names + regions for campaigns, keyed by campaign_key (the SF
// campaign Id). Dashboard-side only — Salesforce stays canonical. Lives in its
// own table, so renames PERSIST across every re-ingest (ingestion never touches
// it). RLS: authenticated read+write. Returns a map keyed by campaign_key.
export async function getCampaignOverrides() {
  const { data, error } = await supabase.from('campaign_overrides').select('*')
  if (error) throw error
  const byKey = {}
  for (const r of data || []) byKey[r.campaign_key] = r
  return byKey
}

// Upsert one field of a campaign override. field ∈ 'display_name'|'display_region'|
// 'hidden'. Empty string clears the label (→ null, falls back to the SF value).
// Partial upsert: only the given column changes; others are preserved.
export async function upsertCampaignOverride(campaignKey, field, value) {
  if (!['display_name', 'display_region', 'regions', 'campaign_type', 'hidden', 'theme'].includes(field)) throw new Error(`bad field: ${field}`)
  if (field === 'regions') invalidateOverrideRegionCache()
  if (field === 'display_region') invalidateOverrideRegionCache()
  if (!campaignKey) throw new Error('campaignKey required')
  // `regions` is a text[] — keep it an array (or null to clear); everything else is text.
  const v = field === 'hidden'
    ? !!value
    : field === 'regions'
      ? (Array.isArray(value) && value.length ? value : null)
      : value == null || String(value).trim() === '' ? null : String(value).trim()
  const { data, error } = await supabase
    .from('campaign_overrides')
    .upsert({ campaign_key: campaignKey, [field]: v, updated_at: new Date().toISOString() }, { onConflict: 'campaign_key' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getPipeline(filters) {
  const rows = await fetchFacts(filters)
  const bySource = [...groupBy(rows, displayChannel)]
    .map(([channel, rs]) => ({
      channel,
      leads: sum(rs, 'leads'),
      mql: sum(rs, 'mql_count'),
      sql: sum(rs, 'sql_count'),
      createdOpps: sum(rs, 'created_opp_count'),
      // Generated pipeline = open + closed-won so Closed Won is always a subset (OV6).
      pipeline: sum(rs, 'pipeline_value') + sum(rs, 'closed_won_value'),
      // Gross-profit basis of the same figure (11 Aug: the primary display basis).
      // Null-aware sums; NA when open pipeline exists but no open-opp GP is ingested yet.
      marginPipeline: (() => {
        const known = sum(rs, 'pipeline_margin_known_count')
        if (sum(rs, 'pipeline_value') > 0 && known === 0) return NA
        const v =
          sum(rs.filter((r) => r.pipeline_margin_value != null), 'pipeline_margin_value') +
          sum(rs.filter((r) => r.margin_value != null), 'margin_value')
        return v > 0 ? v : NA
      })(),
      closedWon: sum(rs, 'closed_won_value'),
      // Gross profit on won deals — the displayed basis for "Closed-Won" everywhere else, so
      // Pipeline by Source has to match or the same column header means two different things.
      margin: sum(rs, 'margin_value'),
    }))
    .sort((a, b) => b.pipeline - a.pipeline)
  return { funnel: funnelOf(rows), bySource, hasData: rows.length > 0, rowCount: rows.length }
}

// Sales-cycle view (G5, call 24:00–28:00 — Margot + Claire). Per-opportunity durations
// from fact_opportunity: how long deals take (created → close) by OUTCOME (won / lost /
// still-open) and by SOURCE (channel), so we can show the sales cycle AND compare won vs
// lost by source (referral / existing client vs Braind-sourced). Phase 1 = created→close;
// MQL→opp timing is a Phase-2 follow-up (needs the contact-response join).
//   • closed deals: scoped by CLOSE date in the window → captures long cycles (a deal created
//     in 2025 that closed this period still counts), cycle = close − created.
//   • open deals:   scoped by CREATED date in the window → currently-open pipeline generated now.
export async function getSalesCycle(filters = {}) {
  const rows = await fetchAll(() => {
    let q = supabase
      .from('v_opportunity_cycle')
      .select('opp_id,channel_name,campaign_type,region_code,created_date,close_date,is_won,is_closed,amount_eur,mql_date')
    if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
    return q
  }, ['opp_id'])

  const y = REPORTING_YEAR
  const qn = filters.quarter && filters.quarter !== 'ytd' ? Number(String(filters.quarter).replace('q', '')) : null
  const wStart = qn ? `${y}-${String((qn - 1) * 3 + 1).padStart(2, '0')}-01` : `${HISTORY_START_YEAR}-01-01`
  const wEnd = qn ? ['03-31', '06-30', '09-30', '12-31'][qn - 1] && `${y}-${['03-31', '06-30', '09-30', '12-31'][qn - 1]}` : `${y}-12-31`
  const cap = toDateCapIso()
  const inWin = (dt) => !!dt && dt >= wStart && dt <= wEnd && dt <= cap
  const DAY = 86400000
  const cycleDays = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / DAY) : null)
  const median = (arr) => {
    if (!arr.length) return NA
    const s = [...arr].sort((x, z) => x - z)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
  }
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : NA)

  // Classify each opp into an outcome bucket within the window (or skip). Each row also
  // carries mql→opp (MQL date → opp created) and mql→close durations for Phase 2 timing.
  const scoped = []
  for (const r of rows) {
    const amount = Number(r.amount_eur) || 0
    const mqlToOpp = cycleDays(r.mql_date, r.created_date)
    const mqlToClose = cycleDays(r.mql_date, r.close_date)
    if (r.is_closed && inWin(r.close_date)) {
      scoped.push({ ...r, outcome: r.is_won ? 'won' : 'lost', amount, cyc: cycleDays(r.created_date, r.close_date), mqlToOpp, mqlToClose })
    } else if (!r.is_closed && inWin(r.created_date)) {
      scoped.push({ ...r, outcome: 'open', amount, cyc: null, mqlToOpp, mqlToClose: null })
    }
  }

  const bucket = (rs) => {
    const cs = rs.map((r) => r.cyc).filter((v) => v != null && v >= 0)
    const mo = rs.map((r) => r.mqlToOpp).filter((v) => v != null && v >= 0)
    const mc = rs.map((r) => r.mqlToClose).filter((v) => v != null && v >= 0)
    return {
      count: rs.length,
      value: rs.reduce((a, r) => a + r.amount, 0),
      avgDays: avg(cs), medianDays: median(cs), // created → close
      avgMqlToOpp: avg(mo), medianMqlToOpp: median(mo), // MQL → opportunity created
      avgMqlToClose: avg(mc), // MQL → close (full journey)
      mqlKnown: mo.length, // how many opps we could time from MQL
    }
  }
  const overall = {
    won: bucket(scoped.filter((r) => r.outcome === 'won')),
    lost: bucket(scoped.filter((r) => r.outcome === 'lost')),
    open: bucket(scoped.filter((r) => r.outcome === 'open')),
  }

  const bySource = [...groupBy(scoped, displayChannel)]
    .map(([channel, rs]) => ({
      channel,
      won: bucket(rs.filter((r) => r.outcome === 'won')),
      lost: bucket(rs.filter((r) => r.outcome === 'lost')),
      open: bucket(rs.filter((r) => r.outcome === 'open')),
    }))
    .filter((c) => c.won.count || c.lost.count || c.open.count)
    .sort((a, b) => (b.won.value + b.open.value) - (a.won.value + a.open.value))

  return { overall, bySource, hasData: scoped.length > 0, rowCount: scoped.length }
}

// Activity run this period vs ongoing impact of earlier activity (X6, Margot).
//   • current — the opportunity was CREATED inside the selected period
//   • prior   — created earlier, and is only generating pipeline/revenue now
// Region + quarter scoped like everything else.
export async function getCurrentVsOngoing(filters = {}) {
  const y = REPORTING_YEAR
  const qStart = { q1: `${y}-01-01`, q2: `${y}-04-01`, q3: `${y}-07-01`, q4: `${y}-10-01` }
  const periodStart =
    filters.quarter && filters.quarter !== 'ytd' ? qStart[filters.quarter] : `${HISTORY_START_YEAR}-01-01`
  const qEnd = { q1: `${y}-03-31`, q2: `${y}-06-30`, q3: `${y}-09-30`, q4: `${y}-12-31` }
  const cap = toDateCapIso()
  const periodEnd =
    filters.quarter && filters.quarter !== 'ytd' ? (qEnd[filters.quarter] < cap ? qEnd[filters.quarter] : cap) : cap

  // MONEY is bucketed by the OPPORTUNITY'S CREATION DATE (Margot, 20 Aug: "Shouldn't we use
  // the opportunity's creation date to determine whether it falls under direct or ongoing
  // impact? Adding a third 'unassigned' bucket seems to be making things unnecessarily
  // complicated."). That replaces the campaign-start-date basis and, with it, the Undated
  // bucket: every opportunity has a creation date, so nothing can fall outside the split.
  let oppQ = supabase
    .from('fact_opportunity')
    .select('opp_id,opp_name,account_name,campaign_name,stage_name,campaign_key,channel_name,campaign_type,region_code,created_date,close_date,is_won,is_closed,amount_eur,margin_eur')
    .gte('created_date', `${HISTORY_START_YEAR}-01-01`)
  if (filters.region && filters.region !== 'all') oppQ = oppQ.eq('region_code', filters.region)
  const [opps, factRows, overrides] = await Promise.all([
    fetchAll(() => oppQ, ['opp_id']),
    // Leads/MQLs have no opportunity to date them by, so they keep the activity-date basis.
    fetchFacts(filters),
    // Renamed campaigns must read the same here as on the Campaigns page.
    getCampaignOverrides(),
  ])

  // Page-level scoping: a channel page or a pinned campaign list narrows the opportunity set
  // the same way it narrows the facts.
  const keySet = filters.keys && filters.keys.length ? new Set(filters.keys) : null
  const scopedOpps = opps.filter((o) => {
    if (keySet && !keySet.has(o.campaign_key)) return false
    if (filters.channel && displayChannel(o) !== filters.channel) return false
    return true
  })

  const inWin = (d) => !!d && d >= periodStart && d <= periodEnd
  // Both bases are accumulated: gross profit is what the panel SHOWS (the client asked for the
  // figures here to be gross margin and for that basis to be consistent dashboard-wide), and
  // revenue is kept as the labelled secondary line. margin_eur is NULL where Salesforce holds no
  // Gross Profit, and such a deal is excluded from the margin sum rather than counted at full
  // value — the same rule used for Influenced Pipeline.
  const blank = () => ({ pipeline: 0, closedWon: 0, pipelineGp: 0, closedWonGp: 0, wonCount: 0, oppCount: 0, campaigns: new Set(), deals: [] })
  const cur = blank()
  const prior = blank()

  for (const o of scopedOpps) {
    const amount = Number(o.amount_eur) || 0
    const gp = o.margin_eur == null ? null : Number(o.margin_eur) || 0
    // Does this deal belong in the window at all? Won deals count when they CLOSE in it;
    // open deals count while they sit in pipeline, i.e. created on or before the window end.
    const won = o.is_won && inWin(o.close_date)
    const open = !o.is_closed && o.created_date <= periodEnd
    if (!won && !open) continue
    // …and which bucket: created inside the window = run this period, earlier = ongoing.
    const b = o.created_date >= periodStart ? cur : prior
    b.oppCount += 1
    if (o.campaign_key) b.campaigns.add(o.campaign_key)
    if (won) { b.closedWon += amount; if (gp != null) b.closedWonGp += gp; b.wonCount += 1 }
    if (open) { b.pipeline += amount; if (gp != null) b.pipelineGp += gp }
    // Margot, 31 Aug: “the very detailed breakdown is indeed what I'm looking for — the
    // campaigns, including value, to get to the number.” Each deal records the exact amount
    // it contributed to each headline figure, accumulated in THIS loop rather than recomputed
    // elsewhere, so the drill-down can never disagree with the number above it. A deal counts
    // toward at most one of won/open (a deal is either closed or still open), and a deal with
    // no Gross Profit in Salesforce contributes its revenue but not its gross profit — the
    // single most likely reason a hand-tallied total differs, so it is flagged per row.
    b.deals.push({
      oppId: o.opp_id,
      name: o.opp_name || o.opp_id,
      account: o.account_name || '—',
      campaignKey: o.campaign_key || null,
      campaign: overrides[o.campaign_key]?.display_name || o.campaign_name || o.campaign_key || 'No campaign in Salesforce',
      channel: displayChannel(o),
      stage: o.stage_name || '—',
      status: o.is_won ? 'Won' : o.is_closed ? 'Lost' : 'Open',
      created: o.created_date,
      closed: o.close_date,
      countsWon: won,
      countsOpen: open,
      wonGp: won && gp != null ? gp : 0,
      openGp: open && gp != null ? gp : 0,
      wonRevenue: won ? amount : 0,
      openRevenue: open ? amount : 0,
      noGrossProfit: gp == null,
    })
  }

  // Per-campaign roll-up of one bucket's deals, ordered by what each campaign contributed.
  // The campaign subtotals add to the bucket's headline figure by construction: every deal
  // sits in exactly one campaign group and its recorded contribution is the one summed above.
  const byCampaign = (b) =>
    [...groupBy(b.deals, 'campaignKey')]
      .map(([campaignKey, ds]) => ({
        campaignKey,
        campaign: ds[0].campaign,
        channel: ds[0].channel,
        dealCount: ds.length,
        closedWon: ds.reduce((a, d) => a + d.wonGp, 0),
        pipeline: ds.reduce((a, d) => a + d.openGp, 0),
        closedWonRevenue: ds.reduce((a, d) => a + d.wonRevenue, 0),
        pipelineRevenue: ds.reduce((a, d) => a + d.openRevenue, 0),
        wonCount: ds.filter((d) => d.countsWon).length,
        deals: ds.slice().sort((x, y) => y.wonGp + y.openGp - (x.wonGp + x.openGp)),
      }))
      .sort((x, y) => y.closedWon + y.pipeline - (x.closedWon + x.pipeline))

  // Leads stay on the activity-date basis and are reported for the window as a whole,
  // scoped the same way as the opportunities above.
  const leadRows = factRows.filter((r) => {
    if (keySet && !keySet.has(r.campaign_key)) return false
    if (filters.channel && displayChannel(r) !== filters.channel) return false
    return true
  })
  const leads = leadRows.reduce((a, r) => a + (Number(r.leads) || 0), 0)

  const shape = (b) => ({
    // Gross profit is the displayed basis; the revenue equivalents stay available as the
    // labelled secondary figures.
    pipeline: b.pipelineGp,
    closedWon: b.closedWonGp,
    pipelineRevenue: b.pipeline,
    closedWonRevenue: b.closedWon,
    wonCount: b.wonCount,
    oppCount: b.oppCount,
    campaigns: b.campaigns.size,
  })
  return {
    periodStart,
    periodEnd,
    leads,
    current: shape(cur),
    prior: shape(prior),
    incrementalRevenue: prior.closedWon, // revenue earlier-created deals generated IN this period
    incrementalPipeline: prior.pipeline,
    hasData: scopedOpps.length > 0,
    // The auditable detail behind each headline figure: campaign → deal → the amount that
    // deal contributed. Built from the same accumulator loop, so it reconciles exactly.
    detail: { current: byCampaign(cur), prior: byCampaign(prior) },
    // Under the YTD pill the period starts at the first day the store holds data, so no
    // opportunity can have been created BEFORE it — the ongoing-impact bucket is then empty
    // by construction rather than because nothing is landing. The panel says so explicitly
    // instead of showing a bare zero.
    priorEmptyByScope: periodStart <= `${HISTORY_START_YEAR}-01-01`,
  }
}

// ---- Deal-level evidence (20 Aug) ---------------------------------------
// Margot asked for a breakdown FOUR separate times — the unmapped campaigns, the deals with
// no source, the unassigned-region deals, and the campaigns whose closed-won she disputes
// ("These opportunities are showing in the campaign, that's why I could verify the numbers.
// You need to look at the campaign the opportunity is assigned to."). All four are the same
// need: see the actual deals behind a number and tick them off against Salesforce.
//
// The dashboard already attributes exactly the way she describes — the ingestion reads
// `FROM Opportunity WHERE CampaignId != null`, i.e. Primary Campaign Source. What was
// missing was the evidence: until the 24 Aug re-ingest the store held only the 18-char id.
export async function getCampaignOpportunities(campaignKeys = []) {
  const keys = (campaignKeys || []).filter(Boolean)
  if (!keys.length) return { opps: [], hasData: false }
  const rows = await fetchAll(() => supabase
    .from('fact_opportunity')
    .select('opp_id,opp_name,account_name,campaign_name,campaign_key,stage_name,is_won,is_closed,amount_eur,margin_eur,created_date,close_date')
    .in('campaign_key', keys)
    .gte('created_date', `${HISTORY_START_YEAR}-01-01`), ['opp_id'])
  const opps = rows
    .map((r) => ({
      oppId: r.opp_id,
      name: r.opp_name || r.opp_id,
      account: r.account_name || '—',
      campaign: r.campaign_name || r.campaign_key,
      stage: r.stage_name || '—',
      status: r.is_won ? 'Won' : r.is_closed ? 'Lost' : 'Open',
      amount: Number(r.amount_eur) || 0,
      margin: r.margin_eur == null ? null : Number(r.margin_eur),
      created: r.created_date,
      closed: r.close_date,
    }))
    .sort((a, b) => (a.status === b.status ? b.amount - a.amount : a.status === 'Won' ? -1 : b.status === 'Won' ? 1 : 0))
  // Totals on the SAME BASIS as the tables this drill-down sits under (Campaigns, Events):
  // GROSS PROFIT, counting won and still-open deals only.
  //
  // 31 Aug: they previously summed `amount` (revenue) for the won/open summary and every row —
  // closed-LOST included — for the column totals. So a client opening the drill-down to check a
  // €416,460 closed-won figure was shown €438,519 (revenue), €2,311,184 (all deals at revenue)
  // and €2,154,728 (all deals at gross profit): four numbers, none of them the one above it,
  // with €307,864 of lost-deal gross profit silently folded in. Exactly the "I keep getting
  // different numbers than you guys" this drill-down exists to prevent.
  //
  // Lost deals stay VISIBLE in the rows — they are part of the campaign's story — but are
  // totalled on their own line and excluded from the reconciling figures. A deal with no Gross
  // Profit in Salesforce is left out of the gross-profit sums rather than counted at full
  // value, matching Influenced Pipeline and the rest of the dashboard.
  const gpOf = (o) => (o.margin == null ? 0 : o.margin)
  const wonOpps = opps.filter((o) => o.status === 'Won')
  const openOpps = opps.filter((o) => o.status === 'Open')
  const lostOpps = opps.filter((o) => o.status === 'Lost')
  const sum = (rows, f) => rows.reduce((a, o) => a + f(o), 0)
  return {
    opps,
    hasData: opps.length > 0,
    // The two figures that must tie to the tables above.
    won: sum(wonOpps, gpOf),
    open: sum(openOpps, gpOf),
    // Column totals, over the counted (won + open) deals only.
    countedCount: wonOpps.length + openOpps.length,
    countedRevenue: sum(wonOpps, (o) => o.amount) + sum(openOpps, (o) => o.amount),
    countedGp: sum(wonOpps, gpOf) + sum(openOpps, gpOf),
    // Revenue equivalents, kept as the labelled secondary basis.
    wonRevenue: sum(wonOpps, (o) => o.amount),
    openRevenue: sum(openOpps, (o) => o.amount),
    // Listed but deliberately not counted anywhere on the page.
    lostCount: lostOpps.length,
    lostGp: sum(lostOpps, gpOf),
    lostRevenue: sum(lostOpps, (o) => o.amount),
    // Deals Salesforce holds no Gross Profit for, hence absent from the gross-profit sums.
    noGpCount: opps.filter((o) => o.status !== 'Lost' && o.margin == null).length,
  }
}

// W10 — the UNASSIGNED-region opportunity list ("which deals couldn't we place?").
// Margot asked to review the regional roll-up; the honest answer is the deal-level list:
// each row is a marketing-attributed opportunity whose Account has neither a Region nor a
// billing country in Salesforce. Salesforce IDs are shown so each can be looked up directly.
export async function getUnassignedOpps() {
  const rows = await fetchAll(() => supabase
    .from('v_opportunity_cycle')
    .select('opp_id,opp_name,account_name,campaign_name,channel_name,created_date,close_date,is_won,is_closed,amount_eur')
    .eq('region_code', 'UNASSIGNED')
    .gte('created_date', `${HISTORY_START_YEAR}-01-01`), ['opp_id'])
  return {
    opps: rows
      .map((r) => ({
        oppId: r.opp_id,
        // Names arrive with the 24 Aug Salesforce re-ingest; null until it has run.
        oppName: r.opp_name || null,
        accountName: r.account_name || null,
        campaignName: r.campaign_name || null,
        channel: r.channel_name || 'Other / Unmapped',
        created: r.created_date,
        amount: Number(r.amount_eur) || 0,
        status: r.is_won ? 'Won' : r.is_closed ? 'Lost' : 'Open',
      }))
      .sort((a, b) => b.amount - a.amount),
    hasData: rows.length > 0,
  }
}

// Pipeline stage distribution (B, 20 Jun, Option 1). Open-pipeline snapshot: count
// + £ of OPEN opps by StageName × region, latest snapshot only (read via
// v_opportunity_stage_current). Region-scoped only — it's a current-state snapshot,
// not a quarter slice (mirrors the LinkedIn/email snapshots). Stages ordered by the
// stage probability (5 → 20 → 50 → 70 → 90), so the ladder reads in order.
export async function getOpportunityStage(filters = {}) {
  const rows = await fetchAll(() => {
    let q = supabase
      .from('v_opportunity_stage_current')
      .select('fact_id,region_code,snapshot_date,stage_name,probability,opp_count,opp_value')
    if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
    return q
  }, ['fact_id'])

  // Collapse region splits into one row per stage (so region='all' sums the regions).
  const stages = [...groupBy(rows, 'stage_name')]
    .map(([stage, rs]) => ({
      stage,
      probability: rs[0]?.probability ?? null,
      count: sum(rs, 'opp_count'),
      value: sum(rs, 'opp_value'),
    }))
    .sort((a, b) => (a.probability ?? 0) - (b.probability ?? 0))

  const snapshotDate = rows.reduce((mx, r) => (r.snapshot_date > mx ? r.snapshot_date : mx), null)
  return { stages, snapshotDate, hasData: rows.length > 0 }
}

// Channel page: totals for one channel_name + per-campaign drill-down.
// excludeTypes: optional read-layer exclusion by campaign_type — the SEO page passes
// ['Content/White Paper'] so whitepaper-download campaigns (reported on the Email
// page) don't also inflate Organic SEO's leads/MQL.
export async function getChannel(channelName, filters, excludeTypes = null) {
  let rows = await fetchFacts({ ...filters, channel: channelName })
  if (excludeTypes && excludeTypes.length) rows = rows.filter((r) => !excludeTypes.includes(r.campaign_type))
  const campaigns = [...groupBy(rows, 'campaign_key')]
    .map(([key, rs]) => {
      // MQL = campaign responders, floored ≥ SQL — matches funnelOf so the funnel now
      // starts at MQL with the same figure everywhere (the "Leads" stage was removed).
      const won = sum(rs, 'closed_won_count')
      const sql = Math.max(sum(rs, 'sql_count'), won)
      const mql = Math.max(sum(rs, 'leads'), sum(rs, 'mql_count'), sql)
      return {
        campaignKey: key,
        campaignName: rs[0]?.campaign_name ?? key ?? 'Unattributed',
        regionCode: dominantRegion(rs),
        mql,
        sql,
        createdOpps: sum(rs, 'created_opp_count'),
        pipeline: sum(rs, 'pipeline_value'),
        closedWon: sum(rs, 'closed_won_value'),
        // Gross-profit counterparts, so the per-campaign table can sit on the same basis
        // as the tiles above it (Margot, 20 Aug: gross margin everywhere).
        marginPipeline: sum(rs, 'pipeline_margin_value'),
        margin: sum(rs, 'margin_value'),
        spend: naIfAllZero(rs, 'spend'),
        impressions: naIfAllZero(rs, 'impressions'),
      }
    })
    .sort((a, b) => b.pipeline - a.pipeline)
  return {
    totals: funnelOf(rows),
    campaigns,
    hasData: rows.length > 0,
    rowCount: rows.length,
  }
}

// Website Leads funnel (SEO8, Margot 9 Jul): website MQL/SQL come specifically from the
// **2026 Website Leads** Salesforce campaign (she confirmed "use the 2026 Website Leads
// campaign as the source") — not the whole Organic SEO channel (which mixed in other
// inbound-web campaigns and inflated the "1,720 leads / 72 MQL" she flagged), and not the
// prior-year Website-Leads lists. Matched by campaign name starting "2026 … website lead".
export async function getWebsiteLeads(filters = {}) {
  const scoped = { region: filters.region, quarter: filters.quarter }
  const rows = await fetchAll(
    () => applyFilters(supabase.from('v_fact_enriched').select(FACT_COLS), scoped).ilike('campaign_name', '2026%website lead%'),
    ['fact_id'],
  )
  const campaigns = [...new Set(rows.map((r) => r.campaign_name).filter(Boolean))]
  return { funnel: funnelOf(rows), campaigns, hasData: rows.length > 0, rowCount: rows.length }
}

// Email page (W5, Margot 11 Aug): "Only the following campaigns should be included" —
// the page is pinned to EXACTLY her 4 campaign families (pinnedCampaigns.js), replacing
// the earlier campaign_type scope. Each row aggregates a whole family (several SF
// campaigns can be one client-facing campaign). Rows render even at zero — the list is
// hers, not activity-driven. "Audience" = individuals the family's emails were DELIVERED
// to (email-platform feed, summed across the family's sends; deliveries, so a person on
// several sends counts each time) — replaces the old campaign-level audience_size, which
// was the enrolment list, not receipt.
export async function getEmailReport(filters = {}) {
  // region + quarter only — never the global channel/campaign/pillar (these campaigns
  // span the SEO + Email channels; the scoping is the pinned key list below).
  const scoped = { region: filters.region, quarter: filters.quarter }
  const emailRows = (f) =>
    fetchAll(
      () => applyFilters(
        supabase.from('v_fact_enriched').select(FACT_COLS),
        f,
      ).in('campaign_key', EMAIL_FAMILY_FACT_KEYS),
      ['fact_id'],
    )
  // Period rows drive the funnel totals; the year rows give each family its whole-2026
  // figures, so an opportunity created in an earlier quarter is not dropped (M3 rule).
  const [rows, yearRows, aeLatest] = await Promise.all([
    emailRows(scoped),
    emailRows({ ...scoped, quarter: 'ytd' }),
    // Latest email-platform snapshot for the Audience column (lifetime counters — read
    // one snapshot only; family matching includes the name-pattern rules that undo the
    // platform's contaminated campaign buckets).
    supabase
      .from('v_ae_email')
      .select('ae_email_id,campaign_key,email_name,delivered,is_operational,snapshot_date')
      .order('snapshot_date', { ascending: false })
      .limit(400)
      .then(({ data, error }) => {
        if (error) throw error
        const asOf = data?.[0]?.snapshot_date
        return (data || []).filter((r) => r.snapshot_date === asOf && r.is_operational !== true)
      }),
  ])

  const campaigns = emailFamiliesFor(filters.quarter).map((f) => {
    const rs = yearRows.filter((r) => f.factKeys.includes(r.campaign_key))
    const won = sum(rs, 'closed_won_count')
    const sql = Math.max(sum(rs, 'sql_count'), won)
    const mql = Math.max(sum(rs, 'leads'), sum(rs, 'mql_count'), sql) // MQL = campaign members (see getChannel)
    const famEmails = aeLatest.filter((r) => f.matchesEmail(r))
    const delivered = famEmails.reduce((a, r) => a + (Number(r.delivered) || 0), 0)
    return {
      campaignKey: f.factKeys[0], // primary key — name/region overrides attach here
      familyId: f.id,
      campaignName: f.label,
      regionCode: dominantRegion(rs) || 'All',
      kind: f.kind,
      mql,
      sql,
      createdOpps: sum(rs, 'created_opp_count'),
      oppCount: sum(rs, 'opp_count'), // qualified opps (open or won) — Paul's "marry it up" column
      audience: delivered > 0 ? delivered : NA, // deliveries across the family's sends
      audienceEmails: famEmails.length,
      oppValue: sum(rs, 'pipeline_value'),
      closedWon: sum(rs, 'closed_won_value'),
      // Gross-profit basis (Margot, 20 Aug) — what the page's money columns now show.
      oppValueMargin: sum(rs, 'pipeline_margin_value'),
      margin: sum(rs, 'margin_value'),
    }
  }).sort((a, b) => b.mql - a.mql)
  return {
    totals: funnelOf(rows),
    campaigns,
    // The list is fixed at her 4 families, so the page renders even when a region filter
    // empties the funnel rows — zeros are information here, not absence.
    hasData: true,
    matchedCount: campaigns.length,
  }
}

// ---- Email engagement — real opens / clicks / unsubscribes -----------------
// v_ae_email: one row per marketing email per DAILY SNAPSHOT, fed from the email
// marketing platform behind Salesforce (fact_ae_email; the counters are lifetime
// totals, so each ingestion run writes a complete fresh snapshot). Reads the
// LATEST snapshot only — summing across snapshots would double-count.
//
// QUARTER scope = the email's SEND date, under the same 2026 window rules as
// every other read (q1/q2/q3 → that quarter; ytd → Jan 1 to the to-date cap;
// quarters beyond REPORTING_END_ISO therefore stay empty). Engagement keeps
// accruing after the send — an email sent in March gains opens in June — which is
// exactly why the send date picks the bucket and the counters are "to date".
//
// REGION is intentionally NOT applied: engagement is recorded per email, and one
// send typically covers several regions' prospect lists at once, so a region split
// would be invented, not measured. The page labels the section all-regions.
//
// Rate bases: open / unsubscribe / delivery mirror the email platform's own
// reporting exactly (verified to 2dp against its UI). CTR alone diverges on
// purpose — see the note inside rollup().
const rateNum = (v) => (v == null ? NA : Number(v)) // numeric cols arrive as strings

export async function getAeEmailEngagement(filters = {}) {
  const { data: latestRows, error: e1 } = await supabase
    .from('v_ae_email')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)
  if (e1) throw e1
  const asOf = latestRows?.[0]?.snapshot_date
  if (!asOf) return { hasData: false, hasFeed: false, asOf: null, totals: null, emails: [], campaigns: [] }

  const rows = await fetchAll(
    () => supabase.from('v_ae_email').select('*').eq('snapshot_date', asOf),
    ['ae_email_id'],
  )

  // The quarter pill selects CAMPAIGNS, not send dates (Margot, 20 Aug). This matters: the
  // Data That Moves whitepaper is a Q1 campaign whose emails all went out from 2 Apr, so a
  // send-date filter emptied the Q1 engagement view entirely — the bug she reported. The
  // date test now only caps the reporting window and excludes pre-2026 sends.
  const cap = toDateCapIso()
  const inWindow = (r) => {
    const d = String(r.sent_at || '').slice(0, 10)
    return !!d && d <= cap && d >= `${HISTORY_START_YEAR}-01-01`
  }
  const quarterFamilyIds = new Set(emailFamiliesFor(filters.quarter).map((f) => f.id))

  // REGION (Margot, 20 Aug): "I don't think the regional metrics are displaying correctly.
  // The audience metrics don't seem to adjust by region ... Since emails are sent on a
  // regional basis, it should be possible to accurately reflect this split."
  //
  // She's right that sends are regional, and the platform feed carries no region at all
  // (region_code is NULL on every row). But the send NAMES encode it — "… UK/IRE: …",
  // "… BE: …", "… - NL: …", "… Lux: …" — so the split is recoverable from the name.
  // A send with no region token is a single combined list: it is NOT assigned to a region,
  // and is reported separately rather than silently attributed to whichever tab is open.
  const regionOfEmail = (name) => {
    const n = ` ${String(name || '')} `
    if (/(uk\/ire|uk&i|\buki\b|\buk\b|ireland|\birl\b)/i.test(n)) return 'UKI'
    if (/(\bbe\b|belgium|belux|\blux\b|luxembourg)/i.test(n)) return 'BeLux'
    if (/(\bnl\b|netherlands)/i.test(n)) return 'NL'
    return null
  }
  // W5 (Margot, 11 Aug): the Email page covers ONLY her 4 campaign families. Family
  // matching is per-EMAIL (key + name pattern), because the platform's campaign buckets
  // are contaminated — the "Q1 Data is an Asset" bucket held the WHITEPAPER's emails and
  // webinar promos together; the name rules split them (pinnedCampaigns.js). Operational
  // sends are excluded.
  const quarterRows = rows
    .filter(inWindow)
    .filter((r) => r.is_operational !== true)
    .map((r) => ({ ...r, family: emailFamilyOf(r), sendRegion: regionOfEmail(r.email_name) }))
    .filter((r) => r.family && quarterFamilyIds.has(r.family.id))
  const scoped = !filters.region || filters.region === 'all'
    ? quarterRows
    : quarterRows.filter((r) => r.sendRegion === filters.region)

  const sumF = (rs, k) => rs.reduce((a, r) => a + (Number(r[k]) || 0), 0)
  const rollup = (rs) => {
    const sent = sumF(rs, 'sent')
    const delivered = sumF(rs, 'delivered')
    return {
      emails: rs.length,
      sent,
      delivered,
      uniqueOpens: sumF(rs, 'unique_opens'),
      totalClicks: sumF(rs, 'total_clicks'),
      uniqueClicks: sumF(rs, 'unique_clicks'),
      optOuts: sumF(rs, 'opt_outs'),
      hardBounces: sumF(rs, 'hard_bounces'),
      deliveryRate: sent ? delivered / sent : NA,
      openRate: delivered ? sumF(rs, 'unique_opens') / delivered : NA,
      // CTR is the PER-PERSON basis (unique clicks ÷ delivered) — deliberately NOT the
      // platform's headline total-clicks basis, which computes to ~29% on this account
      // because corporate security scanners auto-click every link. Same call as the
      // Outreach reply-rate: the per-person figure is the honest one; total clicks stay
      // visible alongside so nothing is hidden.
      ctr: delivered ? sumF(rs, 'unique_clicks') / delivered : NA,
      unsubRate: delivered ? sumF(rs, 'opt_outs') / delivered : NA,
    }
  }

  const emails = scoped
    .map((r) => ({
      id: r.ae_email_id,
      name: r.email_name,
      campaignKey: r.campaign_key,
      campaignName: r.family.label, // the client-facing family, not the raw platform bucket
      sentDate: String(r.sent_at || '').slice(0, 10),
      sent: Number(r.sent) || 0,
      delivered: Number(r.delivered) || 0,
      uniqueOpens: Number(r.unique_opens) || 0,
      uniqueClicks: Number(r.unique_clicks) || 0,
      optOuts: Number(r.opt_outs) || 0,
      openRate: rateNum(r.open_rate),
      ctr: rateNum(r.unique_ctr), // per-person basis — see rollup() note
    }))
    .sort((a, b) => b.sent - a.sent)

  // Aggregated per-FAMILY view — the campaign-level aggregation Margot asked to read
  // first ("I want to see the average performance across all emails associated with the
  // Apple for Enterprise Tech Deep Dive Whitepaper"). Ordered as pinned.
  const byFamily = new Map()
  for (const r of scoped) {
    if (!byFamily.has(r.family.id)) byFamily.set(r.family.id, [])
    byFamily.get(r.family.id).push(r)
  }
  const campaigns = emailFamiliesFor(filters.quarter)
    .filter((f) => byFamily.has(f.id))
    .map((f) => ({
      campaignKey: f.id,
      campaignName: f.label,
      kind: f.kind,
      ...rollup(byFamily.get(f.id)),
    }))

  // Sends on a single combined list carry no region token. They are reported separately
  // rather than attributed to whichever regional tab happens to be open.
  const unsegmented = quarterRows.filter((r) => !r.sendRegion)
  return {
    hasFeed: true,             // the feed exists (rows in some window)
    hasData: scoped.length > 0, // …and this quarter/region has sends
    asOf,
    regionScoped: !!filters.region && filters.region !== 'all',
    unsegmented: { emails: unsegmented.length, delivered: unsegmented.reduce((a, r) => a + (Number(r.delivered) || 0), 0) },
    totals: rollup(scoped),
    emails,
    campaigns,
  }
}

// Current-state campaign attributes (SCD2 resolved) — used to populate the
// campaign picker. Reads v_campaign_current per the rules.
export async function getCampaignsForChannel(channelId) {
  return fetchAll(() => {
    let q = supabase
      .from('v_campaign_current')
      .select('campaign_key,campaign_name,channel_id,spend_rate,is_current')
      .eq('is_current', true)
    if (channelId) q = q.eq('channel_id', channelId)
    return q
  }, ['campaign_key']) // unique among is_current rows
}

// ---- LinkedIn delivery SNAPSHOT (GBP) ------------------------------------
// The LinkedIn lifetime report lands as cumulative-to-date rows on a single
// activity_date. We surface CURRENT TOTALS (spend/impr/clicks/leads), NOT a
// daily trend. Region scopes it; the QUARTER filter is intentionally ignored
// (a cumulative snapshot is not a quarter slice) — the as-of date is shown.
export async function getLinkedInSnapshot(filters = {}) {
  // LI4 / LI5: the LinkedIn snapshot reads Margot's authoritative 3-campaign table
  // (linkedin_campaign_2026) — her EUR budgets + updated spend from the LinkedIn Ads exports
  // (Protect Data = event + boost; Data That Moves = NL + Benelux; E7 = Ireland). Budgets are
  // stored in EUR (no conversion); spend is GBP → converted to EUR for display (G2).
  //
  // W11 (11 Aug): the table now carries each campaign's QUARTER (every 2026 campaign ran in
  // Q2), and the snapshot honours the quarter pill — a quarter with no LinkedIn campaigns
  // returns outOfQuarter so the page shows an explicit "none ran in this quarter" state
  // instead of repeating the same lifetime figures under every pill.
  const rows = await fetchAll(() => {
    let q = supabase
      .from('linkedin_campaign_2026')
      .select('campaign_key,campaign_name,region_code,regions,budget_eur,spend_gbp,impressions,clicks,leads,quarter')
    // A campaign can target several markets (BeNeLux = BeLux + NL), so the region test is
    // "does this campaign's target set contain the selected region", not equality.
    if (filters.region && filters.region !== 'all') q = q.contains('regions', [filters.region])
    if (filters.quarter && filters.quarter !== 'ytd') q = q.eq('quarter', filters.quarter)
    return q
  }, ['campaign_key'])
  if (filters.quarter && filters.quarter !== 'ytd' && rows.length === 0) {
    return { hasData: false, outOfQuarter: true, campaigns: [], totals: null, efficiency: null }
  }

  // L2 (Margot 14.07): the LinkedIn ad-platform lead-gen FORM feed isn't populated (reads 0 for
  // every campaign), but these ads are linked to Salesforce campaigns that DO record leads — e.g.
  // the BeNeLux "Data That Moves" LinkedIn ad has 1 lead in SF. So we source each campaign's lead
  // count from its directly-linked LinkedIn-ad SF campaign (NOT the broad event campaign, which
  // would over-credit LinkedIn with event registrants).
  const LI_SF_LEAD_SOURCE = {
    LI2026_DATA_MOVES: '701Tm00000ZUJUEIA5', // 07.05.2026 - BeNeLux - LinkedIn Ads - Data That Moves (SF)
    LI2026_PROTECT_DATA: 'LI_914802433', // "Protect Data" LinkedIn ad (SF)
    // LI2026_E7: no dedicated LinkedIn-ad SF campaign (its leads sit on the event campaign) → stays 0
  }
  const sfLeadKeys = [...new Set(Object.values(LI_SF_LEAD_SOURCE).filter(Boolean))]
  const sfLeadsByKey = {}
  if (sfLeadKeys.length) {
    try {
      const lr = await fetchAll(() => supabase
        .from('v_fact_enriched')
        .select('fact_id,campaign_key,leads')
        .in('campaign_key', sfLeadKeys)
        .gte('year', HISTORY_START_YEAR)
        .lte('activity_date', toDateCapIso()), ['fact_id'])
      for (const r of lr) sfLeadsByKey[r.campaign_key] = (sfLeadsByKey[r.campaign_key] || 0) + (Number(r.leads) || 0)
    } catch { /* SF-linked leads best-effort; falls back to 0 */ }
  }
  const sfLeadsFor = (liKey) => sfLeadsByKey[LI_SF_LEAD_SOURCE[liKey]] || 0

  const snapshotDate = null // figures come from the LinkedIn Ads export (report period Jan 1 – Jul 9 2026)
  const totalBudgetEur = rows.reduce((a, r) => a + (r.budget_eur == null ? 0 : Number(r.budget_eur)), 0)
  const totals = {
    spend: gbpToEur(sum(rows, 'spend_gbp')), // GBP export → EUR for display (G2)
    budget: totalBudgetEur > 0 ? totalBudgetEur : NA, // total campaign budget (LI4) — already EUR
    impressions: sum(rows, 'impressions'),
    clicks: sum(rows, 'clicks'),
    leads: rows.reduce((a, r) => a + sfLeadsFor(r.campaign_key), 0), // L2: leads from the linked SF campaign
  }

  // LI2 (Margot's revised note): keep PRIOR-YEAR LinkedIn campaigns AVAILABLE so current-year
  // ROI has context. Default view = the 3 2026 campaigns above; when includePrior is set, we
  // also surface the older campaigns from the warehouse snapshot (fact_channel_daily, source
  // 'linkedin') that aren't part of the 2026 set — as context only, not summed into 2026 totals.
  let priorCampaigns = []
  if (filters.includePrior) {
    try {
      const currentKeys = new Set(['LI_914802433', 'LI_914800823', 'LI_1069006353', 'LI_947406346', 'LI_948902076'])
      const nameMap = new Map()
      try { for (const c of await getCampaignsForChannel(2)) nameMap.set(c.campaign_key, c.campaign_name) } catch { /* names best-effort */ }
      const prior = await fetchAll(() => {
        let q = supabase
          .from('v_fact_enriched')
          .select('campaign_key,campaign_name,region_code,activity_date,spend,impressions,clicks,leads')
          .eq('source', 'linkedin')
        if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
        return q
      }, ['fact_id'])
      priorCampaigns = prior
        .filter((r) => !currentKeys.has(r.campaign_key))
        .map((r) => ({
          campaignKey: r.campaign_key,
          campaignName: r.campaign_name || nameMap.get(r.campaign_key) || r.campaign_key,
          regionCode: r.region_code,
          spend: gbpToEur(Number(r.spend) || 0),
          impressions: Number(r.impressions) || 0,
          clicks: Number(r.clicks) || 0,
        }))
        .sort((a, b) => b.spend - a.spend)
    } catch { /* prior-year context is best-effort */ }
  }

  // SF-attributed pipeline + revenue for the LinkedIn Paid CHANNEL (region-scoped).
  // The delivery rows carry £0 pipeline; the attributed value sits on the channel's
  // SF campaign rows. Best-effort: ROI is omitted (NA) if this read fails.
  // 2026 SCOPE (1 Jul): this was previously UNSCOPED by year ("lifetime, to match
  // the lifetime spend snapshot"), which pulled attributed pipeline/revenue back to
  // 2021 and inflated ROI (all-time £170.6k pipeline / £268.2k won vs 2026 £31.0k /
  // £32.1k). Now bounded to the 2026 reporting window (year >= 2026, capped at Q2
  // close) like every other funnel figure. The quarter pill is still not applied —
  // this pairs with the cumulative delivery snapshot, so it's the full-2026 total.
  let attributed = { pipeline: NA, closedWon: NA }
  try {
    const chRows = await fetchAll(() => {
      let q = supabase
        .from('v_fact_enriched')
        .select('fact_id,region_code,pipeline_value,closed_won_value')
        .eq('channel_name', 'LinkedIn Paid')
        .gte('year', HISTORY_START_YEAR)
        .lte('activity_date', toDateCapIso())
      if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
      return q
    }, ['fact_id'])
    attributed = { pipeline: sum(chRows, 'pipeline_value'), closedWon: sum(chRows, 'closed_won_value') }
  } catch {
    /* attribution best-effort — leave ROI as NA rather than fabricate */
  }

  // Efficiency metrics — all real now that LinkedIn spend/impressions/clicks +
  // SF-attributed pipeline/revenue are live. CTR/CPC/CPM are unambiguous; CPL uses
  // LinkedIn FORM leads (the native conversions), NOT the broad SF-attributed lead
  // count; ROI is shown on influenced pipeline (headline) and won revenue (secondary).
  const { spend, impressions, clicks, leads } = totals // spend already EUR (converted above)
  const efficiency = {
    ctr: impressions > 0 ? clicks / impressions : NA, // click-through rate
    cpc: clicks > 0 ? spend / clicks : NA, // cost per click (EUR)
    cpm: impressions > 0 ? (spend / impressions) * 1000 : NA, // cost per 1,000 impressions (EUR)
    cplForm: leads > 0 ? spend / leads : NA, // cost per LinkedIn form lead (EUR)
    pipeline: attributed.pipeline,
    closedWon: attributed.closedWon,
    roiPipeline: spend > 0 && !isNA(attributed.pipeline) ? attributed.pipeline / spend : NA,
    roiRevenue: spend > 0 && !isNA(attributed.closedWon) ? attributed.closedWon / spend : NA,
  }
  const campaigns = rows
    .map((r) => {
      const clicks = Number(r.clicks) || 0
      const impr = Number(r.impressions) || 0
      const spend = gbpToEur(Number(r.spend_gbp) || 0) // GBP export → EUR for display (G2)
      const budget = r.budget_eur == null ? NA : Number(r.budget_eur) // LI4 — budget stored in EUR
      const leads = sfLeadsFor(r.campaign_key) // L2 — leads from the linked SF campaign (feed form-leads are empty)
      return {
        campaignKey: r.campaign_key,
        campaignName: r.campaign_name || r.campaign_key,
        regionCode: r.region_code,
        spend,
        budget,
        budgetUsedPct: !isNA(budget) && budget > 0 ? spend / budget : NA, // spend vs budget (LI4)
        impressions: impr,
        clicks,
        leads,
        ctr: impr > 0 ? clicks / impr : NA, // click-through rate
        cpl: leads > 0 ? spend / leads : NA, // EUR cost per lead
      }
    })
    .sort((a, b) => b.spend - a.spend)

  return {
    currency: 'EUR', // LinkedIn spend converted from GBP; budgets already EUR (G2/LI4)
    snapshotDate,
    totals,
    efficiency,
    campaigns,
    priorCampaigns, // LI2 — prior-year campaigns (context only; populated when includePrior)
    hasData: rows.length > 0,
    rowCount: rows.length,
  }
}

// ---- Email engagement SNAPSHOT (B2, 19 Jun) ------------------------------
// Pardot/Account-Engagement rollups on Campaign (sent/delivered/opens/clicks)
// are LIFETIME per-campaign totals — a snapshot like LinkedIn delivery, NOT a
// daily series. Region scopes it (parsed from the campaign name at ingest); the
// QUARTER filter is intentionally ignored (a lifetime snapshot isn't a quarter
// slice) — the as-of date is shown. Path A (20 Jun): only emails_sent comes from
// Salesforce (Campaign.NumberSent); delivered/opens/clicks/CTR are NOT in this org
// (no Account Engagement objects) → returned as NA. Unsubscribe likewise not shown.
export async function getEmailEngagement(filters = {}) {
  const allRows = await fetchAll(() => {
    let q = supabase
      .from('v_email_engagement')
      .select('campaign_key,campaign_name,region_code,snapshot_date,emails_sent,emails_delivered,email_opens,email_clicks')
    if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
    return q
  }, ['campaign_key']) // unique PK

  // 2026 SCOPE: fact_email_engagement stores a LIFETIME NumberSent with no
  // activity-year, so a legacy campaign (e.g. a 2021/2022 send) would otherwise
  // surface here regardless of the reporting window. Restrict to campaigns that
  // actually had Email-channel activity inside the window (v_fact_enriched,
  // year >= 2026, capped at the to-date cap) — a campaign is "in scope" if it appears
  // there. NOT region-filtered (a campaign is a 2026 campaign globally); the
  // region filter still applies to the engagement rows above.
  const active = await fetchAll(() =>
    supabase
      .from('v_fact_enriched')
      .select('fact_id,campaign_key')
      .eq('channel_name', 'Email')
      .gte('year', HISTORY_START_YEAR)
      .lte('activity_date', toDateCapIso()),
    ['fact_id'],
  )
  const inScope = new Set(active.map((r) => r.campaign_key))
  const rows = allRows.filter((r) => inScope.has(r.campaign_key))

  const snapshotDate = rows.reduce((mx, r) => (r.snapshot_date > mx ? r.snapshot_date : mx), null)

  // A metric is "available" only if at least one row carries a non-null value.
  // In this org delivered/opens/clicks are always NULL (no Account Engagement /
  // pi__ objects, no ListEmail — checked 20 Jun), so they surface as NA — never a
  // misleading 0 / 0%. emails_sent is always present.
  const has = (field) => rows.some((r) => r[field] != null)
  const hasDelivered = has('emails_delivered')
  const hasOpens = has('email_opens')
  const hasClicks = has('email_clicks')

  const rate = (n, d) => (isNA(n) || !(d > 0) ? NA : n / d)

  const campaigns = rows
    .map((r) => {
      const sent = Number(r.emails_sent) || 0
      const delivered = r.emails_delivered == null ? NA : Number(r.emails_delivered)
      const opens = r.email_opens == null ? NA : Number(r.email_opens)
      const clicks = r.email_clicks == null ? NA : Number(r.email_clicks)
      const base = !isNA(delivered) && delivered > 0 ? delivered : sent // open/CTR denominator
      return {
        campaignKey: r.campaign_key,
        campaignName: r.campaign_name || r.campaign_key,
        regionCode: r.region_code,
        sent, delivered, opens, clicks,
        openRate: rate(opens, base),
        ctr: rate(clicks, base),
      }
    })
    .sort((a, b) => b.sent - a.sent)

  const totals = {
    sent: sum(rows, 'emails_sent'),
    delivered: hasDelivered ? sum(rows, 'emails_delivered') : NA,
    opens: hasOpens ? sum(rows, 'email_opens') : NA,
    clicks: hasClicks ? sum(rows, 'email_clicks') : NA,
  }
  const base = hasDelivered && totals.delivered > 0 ? totals.delivered : totals.sent
  return {
    snapshotDate,
    totals: {
      ...totals,
      openRate: rate(totals.opens, base),
      ctr: rate(totals.clicks, base),
      deliveryRate: hasDelivered ? rate(totals.delivered, totals.sent) : NA,
    },
    campaigns,
    hasData: rows.length > 0,
    rowCount: rows.length,
  }
}

// ---- Events / webinars ---------------------------------------------------
// Webinar registrations + attendance from GoToWebinar (fact_event_daily, matched
// to the SF webinar campaign → v_event_daily). Real per-webinar registrants /
// attendees / attendance_rate; region + quarter scope it (events have a date, so
// quarter applies — unlike the lifetime snapshots). Dry-runs were excluded at
// ingest. Owned/earned (in-person) events + per-event MQL/SQL/pipeline are NOT
// tracked (no SF event-type / in-person field) → never fabricated.
export async function getEvents(filters = {}) {
  const rows = await fetchAll(() => {
    let q = supabase
      .from('v_event_daily')
      .select('event_key,event_name,activity_date,region_code,year,quarter,campaign_key,registrants,attendees')
    if (filters.quarter && filters.quarter !== 'ytd') {
      q = q.eq('year', REPORTING_YEAR).eq('quarter', Number(String(filters.quarter).replace('q', '')))
    } else {
      q = q.gte('year', HISTORY_START_YEAR)
    }
    q = q.lte('activity_date', toDateCapIso()) // to-date cap (Q2 2026 close) — no Q3+ webinars
    if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
    return q
  }, ['event_key'])

  const rate = (att, reg) => (reg > 0 ? att / reg : NA)
  const webinars = rows
    .map((r) => {
      const registrants = Number(r.registrants) || 0
      const attendees = Number(r.attendees) || 0
      return {
        eventKey: r.event_key,
        eventName: r.event_name || r.event_key,
        activityDate: r.activity_date,
        regionCode: r.region_code,
        campaignKey: r.campaign_key,
        registrants,
        attendees,
        attendanceRate: rate(attendees, registrants),
      }
    })
    .sort((a, b) => (a.activityDate < b.activityDate ? 1 : -1))

  const registrants = sum(rows, 'registrants')
  const attendees = sum(rows, 'attendees')
  return {
    webinars,
    totals: {
      webinars: webinars.length,
      registrants,
      attendees,
      attendanceRate: rate(attendees, registrants),
    },
    hasData: rows.length > 0,
  }
}

// MQL rate by event type (Level A/B, 20 Jun). Splits the Events & Webinars channel
// by SF Campaign.Type (Webinar / Event / Seminar) — needs campaign_type on
// v_fact_enriched (Level B + an SF re-run to populate; rows with no type bucket as
// 'Untyped' until then). MQL rate = MQLs ÷ leads per type. Owned-vs-earned isn't
// separable (no SF field) — Event/Seminar are the in-person types.
export async function getEventTypeFunnel(filters = {}) {
  const rows = await fetchAll(
    () => applyFilters(
      supabase.from('v_fact_enriched').select('fact_id,campaign_type,leads,mql_count,sql_count,pipeline_value'),
      { ...filters, channel: 'Events & Webinars' },
    ),
    ['fact_id'],
  )
  const LABEL = { Webinar: 'Webinars', Event: 'In-person events', 'Seminar / Conference': 'Seminars / Conferences' }
  const byType = [...groupBy(rows, 'campaign_type')]
    .map(([type, rs]) => {
      const leads = sum(rs, 'leads')
      const mql = sum(rs, 'mql_count')
      return {
        type: type || 'Untyped',
        label: LABEL[type] || type || 'Untyped (re-run SF workflow)',
        leads,
        mql,
        sql: sum(rs, 'sql_count'),
        pipeline: sum(rs, 'pipeline_value'),
        mqlRate: leads > 0 ? mql / leads : NA,
      }
    })
    .sort((a, b) => b.leads - a.leads)
  return { byType, hasData: rows.length > 0 }
}

// Event-campaign detail — per-campaign SF funnel for the Events & Webinars channel,
// carrying campaign_type so the Events page can FILTER by type (Webinar / Event /
// Seminar) and show the earlier per-campaign drill-down. Also rolls up by type for
// the MQL-rate bars. Region + quarter scoped. campaign_type is null until the SF
// re-run (Level B) → those rows bucket as 'Untyped'.
export async function getEventsDetail(filters = {}) {
  const sel =
    'fact_id,campaign_key,campaign_name,campaign_type,campaign_start_date,leads,mql_count,sql_count,opp_count,created_opp_count,pipeline_value,closed_won_value,closed_won_count'
  const scoped = { ...filters, channel: 'Events & Webinars' }
  // ATTRIBUTION WINDOW FIX: a campaign's row shows its WHOLE-2026 contribution, not
  // just the slice that fell inside the selected quarter. See campaignRows().
  const [rows, yearRows] = await Promise.all([
    fetchAll(() => applyFilters(supabase.from('v_fact_enriched').select(sel), scoped), ['fact_id']),
    fetchAll(() => applyFilters(supabase.from('v_fact_enriched').select(sel), { ...scoped, quarter: 'ytd' }), ['fact_id']),
  ])

  const campaigns = campaignRows(rows, yearRows, (key, rs) => {
    // MQL = event registrants / campaign responders (Margot 14.07: "all registered
    // attendees count as MQLs"), floored ≥ SQL — consistent with funnelOf.
    const won = sum(rs, 'closed_won_count')
    const sql = Math.max(sum(rs, 'sql_count'), won)
    const mql = Math.max(sum(rs, 'leads'), sum(rs, 'mql_count'), sql)
    return {
      campaignKey: key,
      campaignName: rs[0]?.campaign_name || key || 'Unattributed',
      campaignType: rs[0]?.campaign_type || null,
      startDate: rs.find((r) => r.campaign_start_date)?.campaign_start_date || null,
      regionCode: dominantRegion(rs),
      mql,
      sql,
      createdOpps: sum(rs, 'created_opp_count'),
      oppCount: sum(rs, 'opp_count'), // qualified opps (open or won) — Paul's "marry it up" column
      pipelineCreated: sum(rs, 'created_opp_value'), // total pipeline created (new business raised)
      pipelineCreatedMargin: sum(rs, 'created_opp_margin_value'), // …on the gross-profit basis
      pipeline: sum(rs, 'pipeline_value'),
      marginPipeline: sum(rs, 'pipeline_margin_value'), // gross-profit basis
      closedWon: sum(rs, 'closed_won_value'),
      margin: sum(rs, 'margin_value'), // gross profit on won deals
    }
  }).sort((a, b) => b.pipeline - a.pipeline)

  // W7 ("Henley Regatta appears to be missing"): an event that HAPPENED but has no
  // responder/opportunity rows yet is still an event we ran — list it at zeros instead
  // of hiding it. Dated event campaigns inside the selected window (capped at today, so
  // future scheduled events don't count as hosted) are appended when absent. Skipped
  // under a region filter — a zero-activity event has no region facts to attribute.
  if (!filters.region || filters.region === 'all') {
    const y = REPORTING_YEAR
    const qWin = { q1: ['-01-01', '-03-31'], q2: ['-04-01', '-06-30'], q3: ['-07-01', '-09-30'], q4: ['-10-01', '-12-31'] }
    const [wFrom, wToRaw] =
      filters.quarter && filters.quarter !== 'ytd'
        ? qWin[filters.quarter].map((s) => `${y}${s}`)
        : [`${y}-01-01`, `${y}-12-31`]
    const cap = toDateCapIso()
    const wTo = wToRaw < cap ? wToRaw : cap
    const dated = await fetchAll(
      () => supabase
        .from('v_campaign_current')
        .select('campaign_key,campaign_name,campaign_type,start_date')
        .in('campaign_type', ['Webinar', 'OwnedEvent', 'EarnedEvent', 'Event', 'Seminar / Conference'])
        .gte('start_date', wFrom)
        .lte('start_date', wTo),
      ['campaign_key'],
    )
    const seen = new Set(campaigns.map((c) => c.campaignKey))
    const zeros = { mql: 0, sql: 0, createdOpps: 0, oppCount: 0, pipeline: 0, closedWon: 0, pipelineCreated: 0, pipelineCreatedMargin: 0, marginPipeline: 0, margin: 0, wonCount: 0 }
    for (const d of dated) {
      if (seen.has(d.campaign_key)) continue
      campaigns.push({
        campaignKey: d.campaign_key,
        campaignName: d.campaign_name,
        campaignType: d.campaign_type,
        startDate: d.start_date,
        regionCode: '—',
        ...zeros,
        noActivity: true, // ran, but nothing recorded against it in Salesforce yet
        period: { ...zeros },
      })
    }
  }

  const types = [...new Set(rows.map((r) => r.campaign_type).filter(Boolean))].sort()

  const byType = [...groupBy(rows, 'campaign_type')]
    .map(([type, rs]) => {
      const leads = sum(rs, 'leads')
      const mql = sum(rs, 'mql_count')
      return { type: type || 'Untyped', leads, mql, mqlRate: leads > 0 ? mql / leads : NA }
    })
    .sort((a, b) => b.leads - a.leads)

  return { campaigns, types, byType, hasData: rows.length > 0 }
}

// In-person event registrations + attendance by region (EV1/EV2/EV3). Reads
// fact_event_attendance, fed from the marketing email platform's attendee /
// non-attendee segmentation lists ("REGION - Attendees|Non-Attendees - Event") by
// workflows/pardot_event_attendance_ingestion.json — the lists turned out to live
// there, not in Outreach, so no client export is needed (10 Aug). Webinar lists are
// excluded at ingest (GoToWebinar owns webinar attendance; EventsSummary ADDS this
// table on top, so including them would double-count). The Events page shows an
// honest "pending" state until the feed's first run.
export async function getEventAttendance(filters = {}) {
  const rows = await fetchAll(() => {
    let q = supabase.from('fact_event_attendance').select('event_name,region_code,registered,attended')
    if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
    return q
  }, ['event_name', 'region_code'])
  const byEvent = [...groupBy(rows, 'event_name')]
    .map(([event, rs]) => {
      const registered = sum(rs, 'registered')
      const attended = sum(rs, 'attended')
      return {
        event,
        registered,
        attended,
        attendanceRate: registered > 0 ? attended / registered : NA,
        byRegion: rs.map((r) => ({ region: r.region_code, registered: Number(r.registered) || 0, attended: Number(r.attended) || 0 })),
      }
    })
    .sort((a, b) => b.registered - a.registered)
  const registered = sum(rows, 'registered')
  const attended = sum(rows, 'attended')
  return {
    byEvent,
    totals: { registered, attended, attendanceRate: registered > 0 ? attended / registered : NA },
    hasData: rows.length > 0,
  }
}

// Campaign-level THEME rollup (Margot, Jul 2026 — X4 / G3). Groups every marketing
// campaign into its overarching quarterly theme (see themes.js — a rule that covers
// the whole book, not just the campaigns Margot named) and returns per-theme rollups
// with the child activities beneath. Region + quarter scoped like the rest of the app
// (selecting a quarter naturally hides the other quarter's themes). Metrics are the
// SF-attributed funnel we already hold; Created Opportunities as a distinct metric
// arrives with the funnel-definition work (X3).
export async function getCampaignThemes(filters = {}) {
  // A campaign belongs to ONE quarter (themes.js), so we classify by the campaign
  // itself and filter campaigns by THAT quarter — not by scattering a campaign's
  // activity-dated rows across quarters (which put Q1 campaigns under Q2 and vice
  // versa). So we always fetch BOTH quarters (region-scoped, to-date capped) for each
  // campaign's whole-period picture, then keep only the campaigns whose own quarter
  // matches the selected pill. YTD shows every quarter + Other.
  const selQuarter =
    filters.quarter && filters.quarter !== 'ytd' ? `Q${String(filters.quarter).replace('q', '')}` : null
  const [rows, overrides] = await Promise.all([
    fetchAll(
      () => applyFilters(
        supabase
          .from('v_fact_enriched')
          .select('fact_id,campaign_key,campaign_name,campaign_type,channel_name,region_code,campaign_start_date,mql_count,sql_count,leads,opp_count,created_opp_count,pipeline_value,closed_won_value,closed_won_count'),
        { ...filters, quarter: 'ytd' },
      ),
      ['fact_id'],
    ),
    getCampaignOverrides(), // map by campaign_key → { theme, display_name, ... }
  ])

  // Collapse to one row per campaign, tagged with its quarter umbrella. A manual
  // override (campaign_overrides.theme = 'q1'|'q2'|'other') wins over the auto rule; we
  // keep the auto theme too so the UI can show "Auto · <theme>" and offer a revert.
  // MQL is the canonical floored figure (= campaign responders, ≥ SQL) — matches
  // funnelOf so "start at MQL" reads the same number everywhere (Leads stage removed).
  const campaigns = [...groupBy(rows, 'campaign_key')].map(([key, rs]) => {
    const name = rs[0]?.campaign_name || key || 'Unattributed'
    const startDate = rs.find((r) => r.campaign_start_date)?.campaign_start_date || null
    const autoTheme = themeForCampaign(name, key, startDate)
    const pinned = overrides[key]?.theme || null
    const theme = pinned ? themeMeta(pinned) : autoTheme
    const won = sum(rs, 'closed_won_count')
    const sql = Math.max(sum(rs, 'sql_count'), won)
    const mql = Math.max(sum(rs, 'leads'), sum(rs, 'mql_count'), sql)
    return {
      campaignKey: key,
      campaignName: name,
      campaignType: rs[0]?.campaign_type || null,
      channel: rs[0]?.channel_name || null,
      regionCode: dominantRegion(rs),
      mql,
      sql,
      createdOpps: sum(rs, 'created_opp_count'),
      oppCount: sum(rs, 'opp_count'), // qualified opps (open or won) — Paul's "marry it up" column
      pipelineCreated: sum(rs, 'created_opp_value'), // total pipeline created (new business raised)
      pipelineCreatedMargin: sum(rs, 'created_opp_margin_value'), // …on the gross-profit basis
      pipeline: sum(rs, 'pipeline_value'),
      marginPipeline: sum(rs, 'pipeline_margin_value'), // gross-profit basis
      closedWon: sum(rs, 'closed_won_value'),
      margin: sum(rs, 'margin_value'), // gross profit on won deals
      wonCount: won,
      theme,
      autoTheme,
      themeOverridden: !!pinned,
    }
  })

  // W5 (Margot, 11 Aug): Q1 and Q2 list EXACTLY her 11 curated campaigns — one row per
  // client-facing campaign, aggregated over its Salesforce keys (pinnedCampaigns.js).
  // Everything not curated rolls into "Other activities" (kept so totals still reconcile
  // to the Overview), except Q3-dated activity, which lists automatically (her list
  // predates the Q3 window). A curated row renders even at all-zeros — the list is hers,
  // not activity-driven.
  const byKey = new Map(campaigns.map((c) => [c.campaignKey, c]))
  const curatedRows = CURATED_CAMPAIGNS.map((cc) => {
    const members = cc.keys.map((k) => byKey.get(k)).filter(Boolean)
    const sumk = (k) => members.reduce((a, m) => a + (Number(m[k]) || 0), 0)
    const theme = themeMeta(cc.quarter === 'Q1' ? 'q1' : 'q2')
    const regions = [...new Set(members.map((m) => m.regionCode).filter(Boolean))]
    return {
      campaignKey: cc.keys[0], // primary key — name/region overrides attach here
      campaignName: cc.label,
      campaignType: members[0]?.campaignType || null,
      channel: members[0]?.channel || null,
      regionCode: regions.length > 1 ? 'Multiple' : regions[0] || '—',
      mql: sumk('mql'),
      sql: sumk('sql'),
      createdOpps: sumk('createdOpps'),
      oppCount: sumk('oppCount'),
      pipelineCreated: sumk('pipelineCreated'),
      pipelineCreatedMargin: sumk('pipelineCreatedMargin'),
      pipeline: sumk('pipeline'),
      marginPipeline: sumk('marginPipeline'),
      closedWon: sumk('closedWon'),
      margin: sumk('margin'),
      wonCount: sumk('wonCount'),
      theme,
      autoTheme: theme,
      themeOverridden: false,
      curated: true,
      memberKeys: cc.keys,
    }
  })
  const rest = campaigns
    .filter((c) => !CURATED_KEY_SET.has(c.campaignKey))
    .map((c) => (c.theme.quarter === 'Q3' ? c : { ...c, theme: themeMeta('other') }))
  const allRows2 = [...curatedRows, ...rest]

  // Keep only campaigns whose own quarter matches the selected pill (crossover fix).
  const visible = selQuarter ? allRows2.filter((c) => c.theme.quarter === selQuarter) : allRows2

  // Group by theme, roll up totals, emit in THEME_ORDER (Other last).
  const byTheme = new Map()
  for (const c of visible) {
    if (!byTheme.has(c.theme.key)) byTheme.set(c.theme.key, [])
    byTheme.get(c.theme.key).push(c)
  }

  const themes = THEME_ORDER.filter((k) => byTheme.has(k)).map((k) => {
    const cs = byTheme
      .get(k)
      .sort((a, b) => b.pipeline - a.pipeline || b.closedWon - a.closedWon || b.mql - a.mql)
    const totals = cs.reduce(
      (a, c) => ({
        mql: a.mql + c.mql,
        sql: a.sql + c.sql,
        createdOpps: a.createdOpps + c.createdOpps,
        oppCount: a.oppCount + c.oppCount,
        pipelineCreated: a.pipelineCreated + (c.pipelineCreated || 0),
        pipelineCreatedMargin: a.pipelineCreatedMargin + (c.pipelineCreatedMargin || 0),
        pipeline: a.pipeline + c.pipeline,
        marginPipeline: a.marginPipeline + (c.marginPipeline || 0),
        closedWon: a.closedWon + c.closedWon,
        margin: a.margin + (c.margin || 0),
        wonCount: a.wonCount + c.wonCount,
      }),
      { mql: 0, sql: 0, createdOpps: 0, oppCount: 0, pipelineCreated: 0, pipelineCreatedMargin: 0, pipeline: 0, marginPipeline: 0, closedWon: 0, margin: 0, wonCount: 0 },
    )
    return { ...themeMeta(k), campaigns: cs, totals, activityCount: cs.length }
  })

  return { themes, hasData: visible.length > 0 }
}

// ---- Outreach.io engagement SNAPSHOT -------------------------------------
// Reads v_outreach_sequence_current (latest snapshot only — counters are
// lifetime-to-date, NOT a daily series). Region + pillar scope it. meetings come
// from Outreach.io's own meetings-booked counter (currently 0 in the feed →
// pending the Outreach meetings sync, NOT a Salesforce thing); SQL / pipeline are
// Salesforce outcomes pending the Outreach↔SF attribution link → pending, never
// fabricated. Rates are computed here, never stored.
// OR7/OR8 — the three marketing workstreams Margot set up, parsed from the CWSI naming
// convention (her feedback confirms the set + labels). By elimination the data has exactly
// three systematic families and she named exactly three workstreams:
//   "CWSI Secure <pillar> Outbound …"  → Historic Data Reactivation   (her "Workstream 3")
//   "CWSI - SoPro <region> <product> …" → Outbound Prospecting · SoPro
//   "CWSI - Microsoft <region> <product> …" → Outbound Prospecting · Microsoft TUM
// Anything else (events, webinar/campaign follow-ups, single-account sales sequences) → "Other".
export const OUTREACH_WORKSTREAM_ORDER = [
  'Historic Data Reactivation',
  'Outbound Prospecting · SoPro',
  'Outbound Prospecting · Microsoft TUM',
  'Other sequences',
]
export function outreachWorkstream(name) {
  const n = String(name || '').toLowerCase()
  if (/^cwsi secure .*outbound/.test(n)) return 'Historic Data Reactivation'
  if (/^cwsi - sopro/.test(n)) return 'Outbound Prospecting · SoPro'
  if (/^cwsi - microsoft/.test(n)) return 'Outbound Prospecting · Microsoft TUM'
  return 'Other sequences'
}

// OR4 — Margot: "this view should ONLY include the marketing sequences we set up together:
// Workstream 3, Microsoft TUM, and SoPro. The sales sequences should be excluded." So a
// marketing sequence is exactly one of the three workstreams above; everything else (events,
// campaigns, one-off account/sales sequences) is excluded from the marketing-only view.
export function isMarketingSequence(name) { return outreachWorkstream(name) !== 'Other sequences' }
// The rep (seller) a systematic sequence belongs to — the FINAL " - ..." segment of
// "CWSI - {SoPro|Microsoft} {REGION} {Product} - {Rep}". null for sequences with no rep
// segment (e.g. the Historic Data Reactivation family). W3: the seller table needs this
// segment retained, while the product/cluster tables keep stripping it (client-facing
// tables shouldn't leak rep names into product labels — see outreachProduct below).
export function outreachRep(name) {
  const n = String(name || '').trim()
  const m = n.match(/^CWSI - (?:SoPro|Microsoft)\s+(?:UK&I|UK & I|BeLux|NL)\s+(.+)$/i)
  if (!m) return null
  const cut = m[1].lastIndexOf(' - ')
  return cut === -1 ? null : m[1].slice(cut + 3).replace(/\s+/g, ' ').trim()
}

// The product/flow promoted within a workstream (e.g. "M365 Review", "Copilot Accelerator",
// "Secure Data"). null for campaign/event sequences (shown by their own name instead).
export function outreachProduct(name) {
  const n = String(name || '').trim()
  // Systematic sequences: "CWSI - {SoPro|Microsoft} {REGION} {Product} - {Rep}". The rep is the
  // FINAL " - ..." segment; rep names can contain hyphens (e.g. "Barry-John"), so we strip from
  // the LAST " - " onward rather than assuming the rep has no hyphen (OR4: the old pattern kept
  // "Copilot Readiness - Barry" for Barry-John, so the product showed twice and the rep leaked in).
  let m = n.match(/^CWSI - (?:SoPro|Microsoft)\s+(?:UK&I|UK & I|BeLux|NL)\s+(.+)$/i)
  if (m) {
    let rest = m[1]
    const cut = rest.lastIndexOf(' - ')
    if (cut !== -1) rest = rest.slice(0, cut)
    return rest.replace(/\s+/g, ' ').trim()
  }
  m = n.match(/^CWSI Secure\s+(AI|Data|Endpoints|Identity|Operations)\s+Outbound/i)
  if (m) return 'Secure ' + m[1]
  return null
}

export async function getOutreach(filters = {}) {
  const allRows = await fetchAll(() => {
    let q = supabase
      .from('v_outreach_sequence_current')
      .select('sequence_id,activity_date,region_code,pillar_name,sequence_name,prospects,opens,clicks,replies,meetings,enabled')
    if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
    if (filters.pillar) {
      if (filters.pillar === PILLAR_UNMAPPED) q = q.is('pillar_name', null)
      else q = q.eq('pillar_name', filters.pillar)
    }
    return q
  }, ['sequence_id']) // unique per current snapshot

  // OR4: default to marketing sequences only (the 3 workstreams; toggle-able from the page).
  const marketingOnly = filters.marketingOnly !== false
  const marketingCount = allRows.filter((r) => isMarketingSequence(r.sequence_name)).length
  let rows = marketingOnly ? allRows.filter((r) => isMarketingSequence(r.sequence_name)) : allRows
  // OR2: "Type of Outreach" filter — narrow to one workstream when selected.
  if (filters.workstream) rows = rows.filter((r) => outreachWorkstream(r.sequence_name) === filters.workstream)

  // Sequences CREATED vs USED vs LIVE (client, 20 Aug: "Active Sequences should mean
  // sequences actually set live — currently contradicted by Prospects in Cadence = 0").
  // outreach_sequence.schedule_count is 0 on all 121 rows, so "enabled" was never a usage
  // signal; usage has to come from the prospect-level state rows. Verified 24 Aug:
  // 121 created, 78 ever used, 43 with prospects currently in cadence.
  const usageRows = await fetchAll(() => supabase.from('v_outreach_sequence_usage').select('*'), ['sequence_id'])
  const usageScoped = usageRows
    .filter((u) => isMarketingSequence(u.sequence_name))
    .filter((u) => !filters.region || filters.region === 'all' || u.region_code === filters.region)
    .filter((u) => !filters.workstream || outreachWorkstream(u.sequence_name) === filters.workstream)
  const sequenceUsage = {
    created: usageScoped.length,
    everUsed: usageScoped.filter((u) => u.ever_used).length,
    liveNow: usageScoped.filter((u) => u.live_now).length,
    neverUsed: usageScoped.filter((u) => !u.ever_used).length,
    activeProspects: usageScoped.reduce((a, u) => a + (Number(u.active_prospects) || 0), 0),
  }

  const snapshotDate = rows.reduce((mx, r) => (r.activity_date > mx ? r.activity_date : mx), null)
  const prospects = sum(rows, 'prospects')
  const kpis = {
    activeSequences: rows.filter((r) => r.enabled).length,
    totalSequences: rows.length,
    prospects,
    opens: sum(rows, 'opens'),
    clicks: sum(rows, 'clicks'),
    replies: sum(rows, 'replies'),
    openRate: prospects ? sum(rows, 'opens') / prospects : NA,
    clickRate: prospects ? sum(rows, 'clicks') / prospects : NA,
    replyRate: prospects ? sum(rows, 'replies') / prospects : NA,
    meetings: NA, // pending Outreach meetings feed (Outreach.io meetings counter reads 0 — not yet syncing)
  }

  // ── The SECOND reply-rate basis, so "8.8% looks low" can be answered on the card.
  //
  // The headline rate above is PER PERSON: replies ÷ prospects in cadence. Outreach.io's own
  // reporting is usually read PER EMAIL: replies ÷ emails delivered. The same programme reads
  // very differently on the two (people ≈ 9%, emails ≈ 1%) because a multi-step cadence sends
  // several emails to each prospect — neither is wrong, they answer different questions. We
  // show both rather than let the client compare our number to a differently-based one in
  // Outreach.io and conclude the dashboard is broken.
  //
  // Scoped to the SAME sequences as the rows above (marketing workstreams / workstream filter),
  // which the standalone step read does not do.
  const seqIds = rows.map((r) => r.sequence_id).filter(Boolean)
  let emailBasis = null
  const emailBySeq = new Map() // sequence_id → {delivered, opens, replies} (email steps only)
  if (seqIds.length) {
    const stepRows = await fetchAll(
      () => supabase
        .from('v_outreach_step_current')
        .select('id,sequence_id,step_type,delivered,opens,clicks,replies,bounces,opt_outs')
        .in('sequence_id', seqIds),
      ['id'],
    )
    const emailRows = stepRows.filter((r) => isEmailStep(r.step_type))
    const delivered = sum(emailRows, 'delivered')
    emailBasis = {
      delivered,
      opens: sum(emailRows, 'opens'),
      clicks: sum(emailRows, 'clicks'),
      replies: sum(emailRows, 'replies'),
      bounces: sum(emailRows, 'bounces'),
      optOuts: sum(emailRows, 'opt_outs'),
      // W3: the per-email basis is the PRIMARY rate on the page — it cannot exceed 100%
      // people-wise, though opens are pixel EVENTS so the open rate is display-capped at 100%.
      openRate: delivered ? Math.min(sum(emailRows, 'opens') / delivered, 1) : NA,
      clickRate: delivered ? Math.min(sum(emailRows, 'clicks') / delivered, 1) : NA,
      replyRate: delivered ? sum(emailRows, 'replies') / delivered : NA,
      unsubRate: delivered ? sum(emailRows, 'opt_outs') / delivered : NA,
    }
    // Per-sequence email stats so product/cluster and seller rows can show per-email rates
    // (the per-person open rate on those rows is what produced the >100% readings).
    for (const r of emailRows) {
      if (!r.sequence_id) continue
      if (!emailBySeq.has(r.sequence_id)) emailBySeq.set(r.sequence_id, { delivered: 0, opens: 0, replies: 0 })
      const x = emailBySeq.get(r.sequence_id)
      x.delivered += r.delivered || 0; x.opens += r.opens || 0; x.replies += r.replies || 0
    }
  }

  // Pillar coverage — how much of the snapshot has no practice area mapped.
  // null pillar is bucketed as "Others" and its magnitude is surfaced.
  const nullPillarRows = rows.filter((r) => r.pillar_name == null)
  const pillarCoverage = {
    othersSequences: nullPillarRows.length,
    othersProspects: sum(nullPillarRows, 'prospects'),
    mappedSequences: rows.length - nullPillarRows.length,
    totalSequences: rows.length,
  }

  // Region × Practice-Area grid. Nulls are first-class: null pillar -> "Others",
  // region UNASSIGNED kept as its own group. Ordered, never broken by nulls.
  const pillarOrder = [...PILLARS, 'Others']
  const byRegion = groupBy(rows, 'region_code')
  const groups = REGION_ORDER.filter((rc) => byRegion.has(rc)).map((region) => {
    const rs = byRegion.get(region)
    const byPillar = new Map()
    for (const r of rs) {
      const key = r.pillar_name ?? 'Others'
      if (!byPillar.has(key)) byPillar.set(key, [])
      byPillar.get(key).push(r)
    }
    const pillarRows = pillarOrder
      .filter((p) => byPillar.has(p))
      .map((pillar) => {
        const prs = byPillar.get(pillar)
        return {
          pillar,
          sequences: prs.length,
          prospects: sum(prs, 'prospects'),
          opens: sum(prs, 'opens'),
          clicks: sum(prs, 'clicks'),
          replies: sum(prs, 'replies'),
        }
      })
    return {
      region,
      rows: pillarRows,
      subtotal: {
        sequences: rs.length,
        prospects: sum(rs, 'prospects'),
        opens: sum(rs, 'opens'),
        clicks: sum(rs, 'clicks'),
        replies: sum(rs, 'replies'),
      },
    }
  })

  // OR7/OR8 — group by workstream (with product + region per sequence). Provisional labels.
  const byWs = groupBy(rows, (r) => outreachWorkstream(r.sequence_name))
  const workstreams = OUTREACH_WORKSTREAM_ORDER.filter((w) => byWs.has(w)).map((ws) => {
    const rs = byWs.get(ws)
    // aggregate by (product/flow × region) — collapses the same product across reps
    const agg = new Map()
    for (const r of rs) {
      const product = outreachProduct(r.sequence_name)
      const label = product || r.sequence_name // "Other" sequences show their own name
      const key = label + '|' + (r.region_code || '')
      if (!agg.has(key)) agg.set(key, { label, region: r.region_code, prospects: 0, opens: 0, clicks: 0, replies: 0, sequences: 0, delivered: 0, emailOpens: 0, emailReplies: 0, sequenceNames: [] })
      const x = agg.get(key)
      x.prospects += r.prospects || 0; x.opens += r.opens || 0; x.clicks += r.clicks || 0; x.replies += r.replies || 0; x.sequences += 1
      x.sequenceNames.push(r.sequence_name) // retained so attribution (meetings/opps per sequence) can be merged onto this row
      const em = emailBySeq.get(r.sequence_id)
      if (em) { x.delivered += em.delivered; x.emailOpens += em.opens; x.emailReplies += em.replies }
    }
    return {
      workstream: ws,
      subtotal: {
        sequences: rs.length, prospects: sum(rs, 'prospects'),
        opens: sum(rs, 'opens'), clicks: sum(rs, 'clicks'), replies: sum(rs, 'replies'),
      },
      // show only product×region rows that actually contacted prospects (drops empty flows)
      rows: [...agg.values()].filter((r) => r.prospects > 0).sort((a, b) => b.prospects - a.prospects),
    }
  }).filter((g) => g.rows.length > 0) // drop a workstream entirely if it has no active flows in scope

  // SELLER performance — read from v_outreach_seller (24 Aug rebuild).
  //
  // Was: the rep parsed out of the sequence NAME via outreachRep(). That gave first names
  // only ("Barry" for Barry-John), invented a seller per name variant, and could never show
  // anyone whose sequences carry no rep segment — which is why the client's "Steve and Hugh
  // are missing" had no fix on the old basis.
  //
  // Now: the seller is the owner of the MAILBOX the emails are sent from, resolved in the
  // view. mailbox_id is populated on 100% of state rows and every mailbox in use resolves,
  // and the SAME key drives assignment and sending — so the per-seller rows now sum exactly
  // to the page totals (verified 24 Aug: 10,420 assigned, 2,033 delivered, 15 repliers).
  // Sellers holding two mailboxes (a cwsi.co.uk -> cwsisecurity.eu migration) are grouped by
  // person, not mailbox, so nobody is listed twice.
  const sellerRows = await fetchAll(() => {
    let q = supabase.from(filters.region && filters.region !== 'all' ? 'v_outreach_seller_region' : 'v_outreach_seller')
      .select('*')
    // region_code is normalised to the warehouse vocabulary (UKI/BeLux/NL) inside the view.
    if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
    return q
  }, ['seller'])
  const sellers = sellerRows
    .map((r) => ({
      seller: r.seller,
      sequences: Number(r.sequences) || 0,
      prospects: Number(r.assigned) || 0,
      active: Number(r.active) || 0,
      emailed: Number(r.prospects_emailed) || 0,
      delivered: Number(r.delivered) || 0,
      peopleOpened: Number(r.people_opened) || 0,
      peopleReplied: Number(r.people_replied) || 0,
      // Rates come from the view, computed on PEOPLE EMAILED — not on prospects assigned.
      // BeNeLux has thousands assigned and nothing sent, so dividing by assigned would drag
      // every rate to near-zero and read as a data error rather than as "not started".
      openRatePct: r.open_rate_pct == null ? null : Number(r.open_rate_pct),
      replyRatePct: r.reply_rate_pct == null ? null : Number(r.reply_rate_pct),
      // The page merges Salesforce meetings/opportunities onto sellers BY SEQUENCE NAME, so
      // the rollup carries them; without this those three columns render as dashes.
      sequenceNames: r.sequence_names || [],
    }))
    .sort((a, b) => b.delivered - a.delivered || b.prospects - a.prospects)

  return {
    snapshotDate,
    kpis,
    emailBasis, // replies/opens per EMAIL DELIVERED — the basis Outreach.io's own reports use
    sellers, // per-seller engagement, keyed on the mailbox owner (v_outreach_seller)
    sequenceUsage, // created vs ever-used vs live-now — replaces the meaningless "enabled" count
    funnel: { prospects, opens: kpis.opens, clicks: kpis.clicks, replies: kpis.replies },
    groups,
    workstreams,
    pillarCoverage,
    marketingOnly,
    seqCounts: { marketing: marketingCount, total: allRows.length }, // OR4: shown vs all
    hasData: rows.length > 0,
    rowCount: rows.length,
  }
}

// ---- Outreach → SF meeting attribution (CC-6, Paul's method) -----------------
// A meeting is attributed to a marketing Outreach sequence when the meeting's SF
// contact email matches a prospect email that is a member of that sequence
// (v_outreach_attributed_meetings joins fact_meeting.contact_email = prospect email).
// The join is EMAIL-based, so coverage is partial (a contact may use different
// emails in Outreach vs Salesforce) — we surface matched-vs-total honestly.
//
// Sequences fall into three tiers (Margot OR4 is the open question of which "count"):
//   • Outbound prospecting — the cold workstreams (SoPro / Microsoft TUM / Secure X
//     Outbound). This is Paul's "outbound-generated" 100-meetings definition.
//   • Events & campaigns   — event/webinar follow-ups, named-account campaigns.
//   • Broadcast/newsletter — monthly updates + manual follow-ups that ~every contact
//     is on; a match here is correlation, not causation (over-attributes).
// A single meeting can match MANY sequences, so per-sequence counts overlap and do
// NOT sum to the tier totals — every tier count is DISTINCT meetings.
const OUTREACH_OUTBOUND_RE = /^cwsi - sopro|^cwsi - microsoft|^cwsi secure .*outbound/i
const OUTREACH_BROADCAST_RE = /monthly update|^cw monthly|^follow-up manual/i
export function outreachSeqCategory(name) {
  const n = name || ''
  if (OUTREACH_OUTBOUND_RE.test(n)) return 'Outbound prospecting'
  if (OUTREACH_BROADCAST_RE.test(n)) return 'Broadcast / newsletter'
  return 'Events & campaigns'
}

// R2 — separate genuinely MARKETING sequences from SALES-OWNED ones. Margot: the Outreach
// view should show only the marketing sequences the team set up, not sales' one-off
// named-account / renewal / rep sequences. There's no owner column, so we classify by
// CWSI's naming convention into three classes:
//   • 'workstream'      — the 3 systematic marketing workstreams (SoPro / Microsoft TUM /
//                         Secure X Outbound) = isMarketingSequence.
//   • 'event-campaign'  — marketing-run demand gen: event / webinar / campaign / workshop /
//                         monthly-update / (non-)attendee follow-ups.
//   • 'sales-owned'     — everything else: single-company account names ("AJ Bell",
//                         "Hilton Foods"), renewals/expansion, rep skim/funding reach-outs.
// Ambiguity is resolved CONSERVATIVELY toward 'sales-owned' (R2's intent is to strip sales
// noise); the definitive marketing list is Margot's to confirm, so this is a naming heuristic.
const OUTREACH_EVENT_CAMPAIGN_RE = /\b(event|webinar|invite|attend|attended|follow[\s-]?up|campaign|workshop|roundtable|monthly update|non[\s-]?attend|becoming frontier)\b/i
export function outreachSeqClass(name) {
  if (isMarketingSequence(name)) return 'workstream'
  if (OUTREACH_EVENT_CAMPAIGN_RE.test(String(name || ''))) return 'event-campaign'
  return 'sales-owned'
}
export const isSalesOwnedSequence = (name) => outreachSeqClass(name) === 'sales-owned'

export async function getOutreachAttributedMeetings(filters = {}) {
  // dateCol differs: meetings by activity_date, opps by created_date (Created Opps dating).
  const scope = (q, dateCol) => {
    if (filters.quarter && filters.quarter !== 'ytd') {
      q = q.eq('year', REPORTING_YEAR).eq('quarter', Number(String(filters.quarter).replace('q', '')))
    } else {
      q = q.eq('year', REPORTING_YEAR)
    }
    q = q.lte(dateCol, toDateCapIso()) // to-date cap (Q2 2026 close)
    if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
    return q
  }
  // MEETINGS: one shared definition with the all-time programme report.
  //
  // COUNT MEETINGS, NOT ATTENDEES. Salesforce writes one Event row per attendee, each with its
  // own Id, so meeting_id is NOT a meeting: three rows for the same Medisec presentation on
  // 23 Jun are one meeting. `meeting_key` (normalised subject + date) is the counting unit —
  // the same key the report uses. Counting meeting_id here reported 6 where the report said 16.
  //
  // The rule adds the client's date condition (20 Aug) on top of the report's basis: the person
  // must have been emailed AND the meeting must not predate the outreach. The report reports
  // influence and says so; this reports attribution. Both figures are surfaced.
  const [attr, meetings, opps, ruleAudit] = await Promise.all([
    fetchAll(() => scope(supabase
      .from('v_outreach_meetings_v2')
      .select('meeting_key,meeting_id,region_code,year,quarter,activity_date,sequence_id,sequence_name,person_replied'), 'activity_date'), ['meeting_key', 'sequence_id']),
    fetchAll(() => scope(supabase
      .from('v_meeting')
      .select('meeting_id,region_code,year,quarter,activity_date,contact_email'), 'activity_date'), ['meeting_id']),
    fetchAll(() => scope(supabase
      .from('v_outreach_attributed_opps')
      .select('opp_id,sequence_id,sequence_name,region_code,year,quarter,created_date,is_won,is_closed,stage_name,amount_eur'), 'created_date'), ['opp_id', 'sequence_id']),
    // Quarter- and region-scoped, so the callout explaining the figure can never disagree with
    // the figure itself. Read from an all-time view, the card said 2 under Q2 while the sentence
    // beneath it still said 3.
    supabase.rpc('get_outreach_meetings_rule', {
      p_quarter: filters.quarter && filters.quarter !== 'ytd' ? Number(String(filters.quarter).replace('q', '')) : null,
      p_year: REPORTING_YEAR,
      p_region: filters.region && filters.region !== 'all' ? filters.region : null,
    }).then((r) => (Array.isArray(r.data) ? r.data[0] : r.data) || null),
  ])

  // Margot (20 Jul): the Outreach view is ONLY the 3 marketing workstreams (Historic Data
  // Reactivation / SoPro / Microsoft TUM = isMarketingSequence). Everything else — events,
  // campaigns, sales one-offs — is excluded from every tier + the per-sequence table. A meeting
  // still counts if ANY workstream sequence claims it (only excluded when none of its
  // attributions is a workstream sequence).
  const marketingOnly = filters.marketingOnly !== false
  const nonWorkstreamMeetingIds = new Set() // meetings whose matches are all non-workstream (for the note)
  const outbound = new Set(), exclBroadcast = new Set(), any = new Set()
  const perSeq = new Map()
  for (const r of attr) {
    if (marketingOnly && !isMarketingSequence(r.sequence_name)) {
      nonWorkstreamMeetingIds.add(r.meeting_key)
      continue
    }
    const cat = outreachSeqCategory(r.sequence_name)
    // Sets hold meeting_key, so a meeting with three attendees counts ONCE.
    any.add(r.meeting_key)
    if (cat !== 'Broadcast / newsletter') exclBroadcast.add(r.meeting_key)
    if (cat === 'Outbound prospecting') outbound.add(r.meeting_key)
    const key = r.sequence_name || '(unnamed sequence)'
    if (!perSeq.has(key)) perSeq.set(key, { sequence: key, category: cat, region: r.region_code, ids: new Set() })
    perSeq.get(key).ids.add(r.meeting_key)
  }
  // ---- Opportunities (OR9): distinct opps per tier + per sequence; pipeline = open &
  //      qualified, won = IsWon. Per-opp value counted once (an opp can span sequences). ----
  const UNQ = 'Unqualified opp'
  const oppVal = new Map()             // opp_id -> { pipeline, won }
  const oppOut = new Set(), oppExcl = new Set(), oppAny = new Set()
  const perSeqOpp = new Map()          // seqName -> { region, opps:Set, pipeline, won }
  for (const o of opps) {
    if (marketingOnly && !isMarketingSequence(o.sequence_name)) continue // 3 workstreams only (Margot 20 Jul)
    const amt = Number(o.amount_eur) || 0
    const pipe = (!o.is_closed && o.stage_name !== UNQ) ? amt : 0
    const won = o.is_won ? amt : 0
    if (!oppVal.has(o.opp_id)) oppVal.set(o.opp_id, { pipeline: pipe, won })
    const cat = outreachSeqCategory(o.sequence_name)
    oppAny.add(o.opp_id)
    if (cat !== 'Broadcast / newsletter') oppExcl.add(o.opp_id)
    if (cat === 'Outbound prospecting') oppOut.add(o.opp_id)
    const key = o.sequence_name || '(unnamed sequence)'
    if (!perSeqOpp.has(key)) perSeqOpp.set(key, { region: o.region_code, opps: new Set(), pipeline: 0, won: 0 })
    const ps = perSeqOpp.get(key)
    if (!ps.opps.has(o.opp_id)) { ps.opps.add(o.opp_id); ps.pipeline += pipe; ps.won += won }
  }
  const sumTier = (set) => {
    let p = 0, w = 0
    for (const id of set) { const v = oppVal.get(id); p += v.pipeline; w += v.won }
    return { createdOpps: set.size, pipeline: p, won: w }
  }

  // ---- Merge meetings ∪ opps into one per-sequence row set ----
  const names = new Set([...perSeq.keys(), ...perSeqOpp.keys()])
  const bySequence = [...names].map((name) => {
    const m = perSeq.get(name)
    const o = perSeqOpp.get(name)
    return {
      sequence: name,
      category: m?.category || outreachSeqCategory(name),
      region: m?.region || o?.region || null,
      meetings: m ? m.ids.size : 0,
      createdOpps: o ? o.opps.size : 0,
      oppValue: o ? o.pipeline : 0,
      closedWon: o ? o.won : 0,
    }
  }).sort((a, b) => (b.meetings - a.meetings) || (b.createdOpps - a.createdOpps))

  const totalMeetings = new Set(meetings.map((m) => m.meeting_id)).size
  const withEmail = new Set(meetings.filter((m) => m.contact_email).map((m) => m.meeting_id)).size

  return {
    // DISTINCT meetings per tier (nested: outbound ⊆ exclBroadcast ⊆ any)
    tiers: { outbound: outbound.size, exclBroadcast: exclBroadcast.size, any: any.size },
    // DISTINCT opps per tier + pipeline/won (OR9)
    oppTiers: { outbound: sumTier(oppOut), exclBroadcast: sumTier(oppExcl), any: sumTier(oppAny) },
    bySequence,
    // Coverage for the honesty note: how many meetings we could even attempt to match.
    // excluded = meetings dropped because none of their matches was one of the 3 marketing
    // workstreams (events / campaigns / sales one-offs); marketingOnly reflects the filter.
    coverage: { attributed: any.size, withEmail, totalMeetings, excluded: [...nonWorkstreamMeetingIds].filter((id) => !any.has(id)).length, marketingOnly },
    // The attribution rule's own working, so the page can explain a figure that is far smaller
    // than the one previously shown instead of just presenting the smaller number.
    rule: ruleAudit
      ? {
          candidates: Number(ruleAudit.candidates) || 0,
          rejectedNeverEmailed: Number(ruleAudit.rejected_never_emailed) || 0,
          rejectedBeforeOutreach: Number(ruleAudit.rejected_before_outreach) || 0,
          attributed: Number(ruleAudit.attributed) || 0,
          withReply: Number(ruleAudit.attributed_with_reply) || 0,
          // The all-time report's basis (emailed, no date test) — shown alongside so the
          // dashboard reconciles with the report rather than appearing to contradict it.
          influenced: Number(ruleAudit.influenced_report_basis) || 0,
        }
      : null,
    hasData: attr.length > 0 || totalMeetings > 0 || opps.length > 0,
  }
}

// Step-type → the exact label Outreach uses inside its displayName
// ("Step #N (<label>)"), so the dashboard reads identically to Outreach.
const STEP_TYPE_LABELS = {
  auto_email: 'Auto Email',
  manual_email: 'Manual Email',
  call: 'Phone Call',
  linkedin_send_connection_request: 'LinkedIn: Send Connection Request',
  linkedin_send_message: 'LinkedIn: Send Message',
  linkedin_view_profile: 'LinkedIn: View Profile',
  linkedin_interact_with_post: 'LinkedIn: Interact With Post',
  linkedin_other: 'LinkedIn: Other',
  task: 'Generic Task',
}
function humanizeStepType(t) {
  if (STEP_TYPE_LABELS[t]) return STEP_TYPE_LABELS[t]
  // fallback for any new/unmapped type
  return (t || '')
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}
const isEmailStep = (t) => /email/.test(t || '')

// ---- Outreach per-step engagement SNAPSHOT -------------------------------
// Reads v_outreach_step_current (latest snapshot) for ALL step types and returns
// ONE row PER STEP TYPE — every type (email, call, LinkedIn, task) once, with the
// engagement metric that applies to it:
//   email → reached = delivered, open% / reply%
//   call  → reached = dials (completed + no-answer), connect% = completed/dials
//   linkedin / task → manual touchpoints, no engagement metrics at source (—)
// Aggregated across ALL cadence positions (step_order collapsed) so a type isn't
// repeated at every step number. Region + pillar scope it.
export async function getOutreachSteps(filters = {}) {
  const rows = await fetchAll(() => {
    let q = supabase
      .from('v_outreach_step_current')
      .select('region_code,pillar_name,step_order,step_type,delivered,opens,clicks,replies,calls_completed,calls_no_answer')
    if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
    if (filters.pillar) {
      if (filters.pillar === PILLAR_UNMAPPED) q = q.is('pillar_name', null)
      else q = q.eq('pillar_name', filters.pillar)
    }
    return q
  }, ['id']) // unique PK (1,150 rows — was truncated at 1000 before)

  // One entry per step TYPE — aggregate across ALL cadence positions so a type
  // (e.g. "Auto Email") appears ONCE, not repeated at every step number.
  const groups = new Map()
  for (const r of rows) {
    const key = r.step_type
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  const allSteps = [...groups.values()]
    .map((rs) => {
      const type = rs[0].step_type
      const email = isEmailStep(type)
      const isCall = type === 'call'
      const delivered = sum(rs, 'delivered')
      const opens = sum(rs, 'opens')
      const replies = sum(rs, 'replies')
      const completed = sum(rs, 'calls_completed')
      const noAnswer = sum(rs, 'calls_no_answer')
      const dials = completed + noAnswer
      return {
        type,
        label: humanizeStepType(type),
        email,
        isCall,
        count: rs.length, // # of cadence-step slots of this type across all sequences
        reached: email ? delivered : isCall ? dials : NA,
        openRate: email && delivered ? opens / delivered : NA,
        replyRate: email && delivered ? replies / delivered : NA,
        connectRate: isCall && dials ? completed / dials : NA,
      }
    })
    // engagement types first (by volume reached), manual touchpoints after
    .sort((a, b) => {
      const ar = isNA(a.reached) ? -1 : a.reached
      const br = isNA(b.reached) ? -1 : b.reached
      return br - ar || b.count - a.count || a.type.localeCompare(b.type)
    })

  return { allSteps, hasData: rows.length > 0 }
}

// ---- Organic SEO: GA4 web traffic + Search Console -----------------------
// GA4 lands in fact_web_daily (sessions/engaged/key_events) and Search Console
// in fact_seo_daily (region-coded clicks/impressions/position) + fact_seo_page_daily
// (per-page, no region). Read through v_web_daily / v_seo_daily / v_seo_pages,
// which already exclude dev/preview/proxy hostnames and expose year/quarter +
// region_code so the shared region/quarter filters re-scope every figure.

// Apply region_code + quarter to a v_web_daily / v_seo_daily query (both views
// share the same year/quarter/region_code shape).
function applyWebFilters(q, f = {}) {
  if (f.quarter && f.quarter !== 'ytd') {
    q = q.eq('year', REPORTING_YEAR).eq('quarter', Number(String(f.quarter).replace('q', '')))
  } else {
    q = q.gte('year', HISTORY_START_YEAR)
  }
  q = q.lte('activity_date', toDateCapIso()) // to-date cap — GA4/SEO stop at the reporting window end
  if (f.region && f.region !== 'all') q = q.eq('region_code', f.region)
  return q
}

// GA4 web traffic — sessions / engaged sessions / engagement rate, scoped by
// region + quarter. key_events is 0 across every row today (GA4 conversions not
// confirmed) → surfaced as NA ("pending"), never a misleading 0.
export async function getWebTraffic(filters = {}) {
  const rows = await fetchAll(
    () => applyWebFilters(
      supabase
        .from('v_web_daily')
        .select('activity_date,region_code,region_name,hostname,channel_group,sessions,engaged_sessions,key_events,users,session_duration_total,page_views')
        // SEO3 (Margot, Jul 2026): report only the cwsisecurity.com domain family
        // (apex + www + insights.cwsisecurity.com). The view already strips
        // dev/preview/proxy hosts; this narrows to the two client-named domains.
        .ilike('hostname', '%cwsisecurity.com'),
      filters,
    ),
    ['activity_date', 'region_code', 'hostname', 'channel_group'], // grain key (date × region × hostname × channel)
  )

  const sessions = sum(rows, 'sessions')
  const engaged = sum(rows, 'engaged_sessions')
  // SEO2 (Margot): the preferred web metrics — Users, Avg Session Duration, Bounce Rate.
  //   • bounce rate = 1 − engaged/sessions (derivable from what we already store).
  //   • users + session-duration total come from the GA4 re-ingest (0 until then → NA).
  //   • avg session duration = Σ(duration total) ÷ Σ(sessions), in seconds.
  const usersTotal = sum(rows, 'users')
  const durationTotal = sum(rows, 'session_duration_total')
  const socialRows = rows.filter((r) => r.channel_group === 'Organic Social')
  const totals = {
    sessions,
    engaged,
    engagementRate: sessions ? engaged / sessions : NA,
    users: usersTotal > 0 ? usersTotal : NA,
    avgSessionDuration: durationTotal > 0 && sessions ? durationTotal / sessions : NA, // seconds
    bounceRate: sessions ? 1 - engaged / sessions : NA,
    keyEvents: naIfAllZero(rows, 'key_events'), // pending: GA4 conversions not confirmed
    // W8 (11 Aug): page views — the traffic figure Margot prefers over search impressions.
    // NULL until the GA4 ingestion re-runs with screenPageViews → NA, never a fake 0.
    pageViews: naIfAllZero(rows, 'page_views'),
    socialSessions: socialRows.length ? sum(socialRows, 'sessions') : NA,
  }

  const byHostname = [...groupBy(rows, 'hostname')]
    .map(([hostname, rs]) => {
      const s = sum(rs, 'sessions')
      const eng = sum(rs, 'engaged_sessions')
      const dur = sum(rs, 'session_duration_total')
      const u = sum(rs, 'users')
      const pv = sum(rs, 'page_views')
      return {
        hostname,
        sessions: s,
        engaged: eng,
        users: u > 0 ? u : NA,
        pageViews: pv > 0 ? pv : NA,
        avgSessionDuration: dur > 0 && s ? dur / s : NA,
        bounceRate: s ? 1 - eng / s : NA,
      }
    })
    .sort((a, b) => b.sessions - a.sessions)

  const byRegion = [...groupBy(rows, 'region_code')]
    .map(([region, rs]) => ({
      region,
      sessions: sum(rs, 'sessions'),
      engaged: sum(rs, 'engaged_sessions'),
    }))
    .sort((a, b) => b.sessions - a.sessions)

  const dateRange = rows.reduce(
    (acc, r) => ({
      min: !acc.min || r.activity_date < acc.min ? r.activity_date : acc.min,
      max: !acc.max || r.activity_date > acc.max ? r.activity_date : acc.max,
    }),
    { min: null, max: null },
  )

  return { totals, byHostname, byRegion, dateRange, hasData: rows.length > 0, rowCount: rows.length }
}

// Search Console — region-scoped clicks/impressions/CTR/avg position (daily
// aggregate) plus the top organic landing pages (page grain has no region, so
// the pages table is quarter-scoped only — flagged in the UI).
export async function getSeo(filters = {}) {
  // Daily: region + quarter scoped, paginated (grain = activity_date × region).
  // Scoped to the DOMAIN property, which already includes insights.cwsisecurity.com —
  // adding the insights property's rows on top would count that site twice.
  const dailyP = fetchAll(
    () => applyWebFilters(
      supabase.from('v_seo_daily').select('activity_date,region_code,clicks,impressions,ctr,avg_position'),
      filters,
    ).eq('site_url', GSC_PRIMARY_SITE),
    ['activity_date', 'region_code'],
  )

  // Pages: v_seo_pages is ~110k rows (per-page per-day). Aggregate the top-15
  // server-side via RPC — never pull raw rows (the 1000-row cap silently
  // truncated them before, giving an arbitrary, wrong "top pages"). Page grain
  // has no region, so it's quarter/year-scoped only (flagged in the UI).
  const qn = filters.quarter && filters.quarter !== 'ytd'
    ? Number(String(filters.quarter).replace('q', ''))
    : null
  const pagesP = supabase.rpc('get_seo_top_pages', {
    p_quarter: qn,
    p_year: REPORTING_YEAR,
    p_history_start: HISTORY_START_YEAR,
    p_limit: 10, // SEO7/SEO8 (Margot, Jul 2026): top 10 only
  })
  // Top keywords/queries — same server-side top-N RPC over fact_seo_query_daily
  // (~1M rows). Query grain has no region, so quarter/year-scoped only. Scoped to
  // HISTORY_START_YEAR (2026) so any pre-2026 rows in the table are excluded.
  const queriesP = supabase.rpc('get_seo_top_queries', {
    p_quarter: qn,
    p_year: REPORTING_YEAR,
    p_history_start: HISTORY_START_YEAR,
    p_limit: 10, // SEO8 (Margot, Jul 2026): top 10 keywords only
  })

  const [daily, { data: pData, error: pErr }, { data: qData, error: qErr }] = await Promise.all([
    dailyP,
    pagesP,
    queriesP,
  ])
  if (pErr) throw pErr
  if (qErr) throw qErr

  const clicks = sum(daily, 'clicks')
  const impressions = sum(daily, 'impressions')
  // avg position weighted by impressions (an unweighted mean over-counts low-traffic days).
  const weightedPos = sum(daily.map((r) => ({ p: Number(r.avg_position) * Number(r.impressions) })), 'p')
  const totals = {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : NA,
    avgPosition: impressions ? weightedPos / impressions : NA,
  }

  // RPC returns pre-aggregated top pages; null ctr/avg_position (0 impressions) -> NA.
  // page_views comes from the website-analytics page feed, joined to Search Console on a
  // normalised path (GSC reports full URLs, analytics reports paths). NULL — not 0 — where a
  // page ranked but was never clicked: no visit, so no page view. Kept as null so the table
  // can say "not visited from search" rather than showing a measured-looking zero.
  const topPages = (pData || []).map((p) => ({
    page: p.page,
    clicks: Number(p.clicks),
    impressions: Number(p.impressions),
    pageViews: p.page_views == null ? null : Number(p.page_views),
    ctr: p.ctr == null ? NA : Number(p.ctr),
    avgPosition: p.avg_position == null ? NA : Number(p.avg_position),
  }))

  // Top keywords (same shape, keyed by query).
  const topQueries = (qData || []).map((q) => ({
    query: q.query,
    clicks: Number(q.clicks),
    impressions: Number(q.impressions),
    ctr: q.ctr == null ? NA : Number(q.ctr),
    avgPosition: q.avg_position == null ? NA : Number(q.avg_position),
  }))

  return {
    totals,
    topPages,
    topQueries,
    hasData: daily.length > 0 || topPages.length > 0 || topQueries.length > 0,
    dayCount: daily.length,
  }
}

// ---- Marketing budget / spend (EUR, finance-grained) ---------------------
// Reads v_marketing_spend (one row per spend line item — NOT campaign-grained).
// Net spend = SUM(amount): negative correction rows ARE included and never
// filtered out, but are NOT counted as spend events. Currency is EUR only.
export async function getMarketingSpend(filters = {}) {
  // One unfiltered fetch (the tracker is small), scoped in JS — because the page needs BOTH
  // the scoped view (current region/quarter) and the FULL-YEAR totals: the annual budget and
  // MDF utilisation must not shrink when a quarter pill is active (W4, 11 Aug).
  const allRows = await fetchAll(() => supabase
    .from('v_marketing_spend')
    .select('spend_id,amount,currency,region_code,quarter,budget_line,primary_audience,status'),
  ['spend_id']) // unique PK
  const regionRows = filters.region && filters.region !== 'all'
    ? allRows.filter((r) => r.region_code === filters.region)
    : allRows
  const ql = quarterLabel(filters.quarter)
  const rows = ql ? regionRows.filter((r) => r.quarter === ql) : regionRows
  // Full-year, all-regions actuals — the denominators' counterpart for the annual budget.
  const fy = {
    netActual: sum(allRows, 'amount'),
    mdfSpend: sum(allRows.filter((r) => r.budget_line === 'MDF'), 'amount'),
  }

  // Margot (20 Aug): "make it clear that some budget has been spent across the group rather
  // than attributed to a specific region. Alongside the regional spend, also highlight the
  // amount spent across all regions, so it's clear that total spend may be higher than the
  // individual regional figures suggest."
  //
  // The tracker records group-level lines with market 'ALL', which land on region UNASSIGNED
  // — that is the great majority of spend (agency, PR, tools, translation), so a regional
  // view on its own badly understates what was spent on that region's behalf.
  const quarterOnly = ql ? allRows.filter((r) => r.quarter === ql) : allRows
  const groupRows = quarterOnly.filter((r) => !r.region_code || r.region_code === 'UNASSIGNED')
  const group = {
    net: sum(groupRows, 'amount'),
    lines: groupRows.length,
    byBudgetLine: [...groupBy(groupRows, 'budget_line')]
      .map(([bucket, rs]) => ({ bucket: bucket ?? '(none)', net: sum(rs, 'amount') }))
      .sort((a, b) => b.net - a.net),
  }
  // MDF is tracked per region, so a regional view CAN show its own MDF spend honestly.
  const regionMdf = sum(rows.filter((r) => r.budget_line === 'MDF'), 'amount')

  // Margot (20 Aug): "If there has been no spend against a particular budget line in a
  // region, please leave the value empty rather than removing the budget line entirely."
  // The full line list comes from the whole tracker, not the filtered slice.
  const allBudgetLines = [...new Set(allRows.map((r) => r.budget_line).filter(Boolean))].sort()

  const currencies = [...new Set(rows.map((r) => r.currency))]
  const positives = rows.filter((r) => Number(r.amount) > 0)
  const negatives = rows.filter((r) => Number(r.amount) < 0)

  const agg = (key) =>
    [...groupBy(rows, key)]
      .map(([bucket, rs]) => ({ bucket: bucket ?? '(none)', net: sum(rs, 'amount'), lines: rs.length }))
      .sort((a, b) => b.net - a.net)

  return {
    currency: currencies.length === 1 ? currencies[0] : 'EUR',
    mixedCurrency: currencies.length > 1, // guard: should always be EUR
    netActual: sum(rows, 'amount'), // net of correction rows
    lineCount: rows.length,
    spendEventCount: positives.length, // negatives are corrections, not events
    negCount: negatives.length,
    negSum: sum(negatives, 'amount'),
    byBudgetLine: agg('budget_line'),
    byRegion: agg('region_code'),
    byAudience: agg('primary_audience'),
    fy, // full-year, all-regions: { netActual, mdfSpend } — for annual budget/MDF utilisation
    group, // spend booked across the whole group (market 'ALL'), not attributable to a region
    allBudgetLines, // every budget line in the tracker — lines with no spend here render empty
    regionMdf, // MDF spend within the current scope
    hasData: rows.length > 0,
  }
}

// ---- Data freshness ("when was this last refreshed?") ---------------------
// One row per source feed, from v_data_freshness. Two different dates, kept
// distinct because they answer different questions:
//   • lastRefreshed  — when our ingestion last wrote to that table
//   • latestActivity — the most recent date the DATA ITSELF covers
// A feed can be refreshed today and still only carry data to last week, so
// showing only one of the two would mislead. Reads as a plain snapshot — no
// region/quarter scoping, because freshness is a property of the pipeline.
export async function getDataFreshness() {
  const { data, error } = await supabase
    .from('v_data_freshness')
    .select('source,sort_order,last_refreshed,latest_activity,rows')
    .order('sort_order', { ascending: true })
  if (error) throw error
  const sources = (data || []).map((r) => ({
    source: r.source,
    lastRefreshed: r.last_refreshed,
    latestActivity: r.latest_activity,
    rows: Number(r.rows) || 0,
  }))
  const newest = sources.reduce(
    (mx, s) => (s.lastRefreshed && (!mx || s.lastRefreshed > mx) ? s.lastRefreshed : mx),
    null,
  )
  return { sources, lastRefreshed: newest, hasData: sources.length > 0 }
}

// ---- Outreach run-this-period vs ongoing impact ---------------------------
// Client (20 Aug): "Also not showing for Outreach." It was genuinely impossible before the
// 24 Aug rebuild — every earlier Outreach feed held lifetime per-sequence counters stamped
// with the run date, so there was no dated activity to split. Prospect-level state rows carry
// each person's own dates, so the split is now real.
//
// Basis: FIRST TOUCH (when the person was first worked), matching the opportunity-creation-date
// decision taken for the rest of the dashboard. Engagement only — the commercial side of
// Outreach rests on 2 campaign-linked opportunities, which is far too few to split honestly,
// and the panel says so rather than dividing EUR 9,500 into two buckets.
export async function getOutreachRunVsOngoing(filters = {}) {
  let q = supabase.from('v_outreach_run_vs_ongoing').select('*')
  if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
  const rows = await fetchAll(() => q, ['first_touch_at', 'region_code', 'programme'])
  const [from, to] = quarterWindow(filters.quarter)
  const inWindow = (d) => (!from || d >= from) && (!to || d <= to)
  const acc = (rs) => rs.reduce(
    (a, r) => ({
      prospects: a.prospects + (Number(r.prospects) || 0),
      emailed: a.emailed + (Number(r.prospects_emailed) || 0),
      delivered: a.delivered + (Number(r.delivered) || 0),
      replied: a.replied + (Number(r.people_replied) || 0),
    }),
    { prospects: 0, emailed: 0, delivered: 0, replied: 0 },
  )
  const run = acc(rows.filter((r) => inWindow(r.first_touch_at)))
  const ongoing = acc(rows.filter((r) => !inWindow(r.first_touch_at)))
  return { run, ongoing, total: acc(rows), hasData: rows.length > 0 }
}

// ---- LinkedIn company-page analytics (KPI: engagement rate + follower growth) ----
// Source: the LinkedIn Page Analytics exports, loaded 24 Aug 2026. CWSI runs THREE regional
// pages (CWSI / CWSI BeLux / CWSI NL), so — contrary to our earlier assumption that a company
// page is global — these two KPI rows ARE region-splittable.
//
// Engagement rate is computed from the components over the window,
// (reactions + comments + reposts + clicks) / impressions, NOT by averaging LinkedIn's stored
// daily rates: a rate is not additive, so averaging days weights a quiet day the same as a busy
// one. Follower growth is the sum of NEW followers in the window (the export reports new per
// day, not a running total).
export async function getLinkedInPage(filters = {}) {
  const [from, to] = quarterWindow(filters.quarter)
  let q = supabase
    .from('v_linkedin_page')
    .select('region_code,activity_date,followers_new_total,impressions_total,engagements_total,page_views_total,unique_visitors_total')
    .gte('activity_date', from)
    .lte('activity_date', to)
  if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
  const rows = await fetchAll(() => q, ['region_code', 'activity_date'])
  const t = rows.reduce(
    (a, r) => ({
      followersNew: a.followersNew + (Number(r.followers_new_total) || 0),
      impressions: a.impressions + (Number(r.impressions_total) || 0),
      engagements: a.engagements + (Number(r.engagements_total) || 0),
      pageViews: a.pageViews + (Number(r.page_views_total) || 0),
      visitors: a.visitors + (Number(r.unique_visitors_total) || 0),
    }),
    { followersNew: 0, impressions: 0, engagements: 0, pageViews: 0, visitors: 0 },
  )
  return {
    ...t,
    engagementRate: t.impressions > 0 ? t.engagements / t.impressions : NA,
    hasData: rows.length > 0,
    // Which pages are in scope, so the KPI row can name them rather than implying one global page.
    regions: [...new Set(rows.map((r) => r.region_code))].sort(),
  }
}
