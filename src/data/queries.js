import { supabase } from '../lib/supabaseClient'
import { themeForCampaign, THEME_ORDER, themeMeta } from './themes'
import {
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
  'fact_id,campaign_key,campaign_name,region_code,region_name,channel_name,campaign_type,pillar_name,activity_date,campaign_start_date,year,quarter,source,spend,impressions,leads,mql_count,sql_count,opp_count,created_opp_count,pipeline_value,closed_won_value,closed_won_count,margin_value'

// Translate the shared filter object into PostgREST predicates. Every active
// filter is applied here, so every figure derived from fetchFacts re-scopes.
// Today (YYYY-MM-DD, browser runtime).
const todayIso = () => new Date().toISOString().slice(0, 10)

// Upper bound for every "to date" read. The reporting window is fixed to H1 2026
// (client, 1 Jul 2026), so we cap at the EARLIER of today and REPORTING_END_ISO
// (Q2 2026 close). Because the window has closed, this is 2026-06-30 in practice
// — so Q3/Q4 return empty and YTD stops at end of Q2 (never leaks Q3+ rows).
// If REPORTING_END_ISO is set null later, this falls back to plain "today".
const toDateCapIso = () => {
  const today = todayIso()
  return REPORTING_END_ISO && REPORTING_END_ISO < today ? REPORTING_END_ISO : today
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

// fact_id is the unique PK exposed by the view → stable paging key.
function fetchFacts(f) {
  return fetchAll(() => applyFilters(supabase.from('v_fact_enriched').select(FACT_COLS), f), ['fact_id'])
}

const sum = (rows, k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)

// spend & impressions are 0 across all seed rows; surface as NA rather than a
// misleading real-looking 0. If real spend lands later this flips automatically.
const naIfAllZero = (rows, k) => (sum(rows, k) > 0 ? sum(rows, k) : NA)

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
  const mql = Math.max(mqlRaw, sql)
  const leads = Math.max(leadsRaw, mql)

  // Influenced margin coverage: margin is gross profit (EUR) — Gross_Profit_Value__c,
  // else Amount × Gross_Profit_Margin__c; a deal with neither reads NULL in
  // v_fact_enriched (never full revenue), so it drops out of the margin sum. Surface
  // how many won deals still lack gross profit so the UI can caveat "covers X of Y
  // deals" rather than silently reporting margin over a sliver of deals.
  const wonValueRows = rows.filter((r) => Number(r.closed_won_value) > 0)
  const dealsOf = (rs) => rs.reduce((a, r) => a + (Number(r.closed_won_count) || 1), 0)
  const marginPendingDeals = dealsOf(wonValueRows.filter((r) => r.margin_value == null))
  const marginKnownDeals = dealsOf(wonValueRows.filter((r) => r.margin_value != null))

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
    pipeline: sum(rows, 'pipeline_value'),
    closedWon: sum(rows, 'closed_won_value'),
    // Count of won deals (terminal funnel stage). NA (not 0) until the SF
    // workflow re-runs to populate closed_won_count.
    closedWonCount: wonRaw > 0 ? won : NA,
    margin: naIfAllZero(rows, 'margin_value'), // influenced margin = gross profit EUR (GP value, else Amount × GP margin; blank → NULL, excluded)
    marginPendingDeals, // won deals with no gross profit yet (margin not counted)
    marginKnownDeals, // won deals whose margin is counted
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

// Presentation channel (Margot X8 / OV6 / BP5): Salesforce collapses all event
// campaign types into ONE channel ("Events & Webinars"), but the client wants
// Webinars and in-person Events reported as two distinct channels. We split at
// the read layer using campaign_type (already on v_fact_enriched) — no re-ingest,
// dim_channel stays a single row so the channel FILTER/selector and the dedicated
// Events page (which fetches channel='Events & Webinars' and splits internally)
// are untouched. Every OTHER channel passes through unchanged.
const EVENTS_CHANNEL = 'Events & Webinars'
function displayChannel(row) {
  if (row.channel_name !== EVENTS_CHANNEL) return row.channel_name
  return row.campaign_type === 'Webinar' ? 'Webinars' : 'In-person Events'
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
  const [rows, retention] = await Promise.all([fetchFacts(filters), getRetention(filters)])
  const funnel = funnelOf(rows)
  const byChannel = [...groupBy(rows, displayChannel)]
    .map(([channel, rs]) => ({
      channel,
      pipeline: sum(rs, 'pipeline_value'),
      closedWon: sum(rs, 'closed_won_value'),
      // Spend is GBP and currently only present on LinkedIn rows (snapshot).
      spend: naIfAllZero(rs, 'spend'),
      spendCurrency: 'GBP',
    }))
    .sort((a, b) => b.pipeline - a.pipeline)
  return { funnel, byChannel, retention, hasData: rows.length > 0, rowCount: rows.length }
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
  const [rows, prevRows, retention, stage] = await Promise.all([
    fetchFacts(filters),
    prevQ ? fetchFacts({ ...filters, quarter: prevQ }) : Promise.resolve(null),
    getRetention(filters),
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
      pipeline: sum(rs, 'pipeline_value'),
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
      pipeline: sum(rs, 'pipeline_value'),
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
    retention,
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
  if (!['display_name', 'display_region', 'hidden', 'theme'].includes(field)) throw new Error(`bad field: ${field}`)
  if (!campaignKey) throw new Error('campaignKey required')
  const v = field === 'hidden'
    ? !!value
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
      pipeline: sum(rs, 'pipeline_value'),
      closedWon: sum(rs, 'closed_won_value'),
    }))
    .sort((a, b) => b.pipeline - a.pipeline)
  return { funnel: funnelOf(rows), bySource, hasData: rows.length > 0, rowCount: rows.length }
}

// Current-quarter activity vs ongoing impact of prior-quarter activities (X6, Margot).
// Buckets the period's marketing outcomes by WHEN the campaign STARTED (dim_campaign
// StartDate, exposed as campaign_start_date):
//   • current — campaign started within the selected period → activities we ran now + results to date
//   • prior   — campaign started before the period → pipeline/revenue older activities are STILL generating now
//   • undated — campaign has no StartDate in Salesforce (can't classify; surfaced honestly)
// Also derives an implied average sales-cycle = days from campaign start to a won deal's close
// (won rows are dated by CloseDate) — the "length of our sales cycle / long-term impact" story.
// Region + quarter scoped like everything else (facts already filtered to the period by activity_date).
export async function getCurrentVsOngoing(filters = {}) {
  const rows = await fetchFacts(filters)
  const y = REPORTING_YEAR
  const qStart = { q1: `${y}-01-01`, q2: `${y}-04-01`, q3: `${y}-07-01`, q4: `${y}-10-01` }
  const periodStart =
    filters.quarter && filters.quarter !== 'ytd' ? qStart[filters.quarter] : `${HISTORY_START_YEAR}-01-01`

  const blank = () => ({ leads: 0, pipeline: 0, closedWon: 0, wonCount: 0, campaigns: new Set(), cycleDays: 0, cycleWon: 0 })
  const cur = blank()
  const prior = blank()
  const undated = blank()
  const DAY = 86400000

  for (const r of rows) {
    const start = r.campaign_start_date // 'YYYY-MM-DD' | null
    const bucket = start == null ? undated : start >= periodStart ? cur : prior
    bucket.leads += Number(r.leads) || 0
    bucket.pipeline += Number(r.pipeline_value) || 0
    bucket.closedWon += Number(r.closed_won_value) || 0
    const won = Number(r.closed_won_count) || 0
    bucket.wonCount += won
    if (r.campaign_key) bucket.campaigns.add(r.campaign_key)
    // Sales cycle per bucket: campaign start → won close (won rows carry CloseDate in activity_date).
    if (won > 0 && start && r.activity_date) {
      const days = Math.round((new Date(r.activity_date) - new Date(start)) / DAY)
      if (days >= 0) {
        bucket.cycleDays += days * won
        bucket.cycleWon += won
      }
    }
  }

  const shape = (b) => ({
    leads: b.leads,
    pipeline: b.pipeline,
    closedWon: b.closedWon,
    wonCount: b.wonCount,
    campaigns: b.campaigns.size,
    avgCycleDays: b.cycleWon > 0 ? Math.round(b.cycleDays / b.cycleWon) : NA, // days from campaign start to won close
  })
  const totCycleDays = cur.cycleDays + prior.cycleDays
  const totCycleWon = cur.cycleWon + prior.cycleWon
  return {
    periodStart,
    current: shape(cur),
    prior: shape(prior),
    undated: shape(undated),
    avgSalesCycleDays: totCycleWon > 0 ? Math.round(totCycleDays / totCycleWon) : NA,
    incrementalRevenue: prior.closedWon, // revenue prior-period activities generated IN this period
    incrementalPipeline: prior.pipeline,
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
    .map(([key, rs]) => ({
      campaignKey: key,
      campaignName: rs[0]?.campaign_name ?? key ?? 'Unattributed',
      leads: sum(rs, 'leads'),
      mql: sum(rs, 'mql_count'),
      sql: sum(rs, 'sql_count'),
      createdOpps: sum(rs, 'created_opp_count'),
      pipeline: sum(rs, 'pipeline_value'),
      closedWon: sum(rs, 'closed_won_value'),
      spend: naIfAllZero(rs, 'spend'),
      impressions: naIfAllZero(rs, 'impressions'),
    }))
    .sort((a, b) => b.pipeline - a.pipeline)
  return {
    totals: funnelOf(rows),
    campaigns,
    hasData: rows.length > 0,
    rowCount: rows.length,
  }
}

// Email page (Margot, Jul 2026): the whitepaper-download + workflow campaigns she
// named, scoped by explicit campaign_key — NOT by channel/type. Three are stored in
// Salesforce as "Content / White Paper" (so they otherwise sit under Organic SEO) and
// one as "Email"; scoping by type showed the wrong set. All the fact data already
// exists in v_fact_enriched (no re-ingest needed) — we just read these keys. There are
// NO email-engagement metrics: this org has no send/open data (NumberSent = 0, no
// Account Engagement), so the page shows the COMMERCIAL funnel only. Editable list —
// add a key here if CWSI adds a campaign to the programme.
export const EMAIL_CAMPAIGN_KEYS = [
  '701Si00000V3LvjIAF', // Q1 2026 - Data That Moves Your Business Forward Whitepaper
  '701Tm00000cHsHgIAK', // 2026 - Apple for Enterprise Tech Deep Dive - Whitepaper
  '701Tm00000c9ygeIAA', // 2026 - Whitepaper - Becoming Frontier: Leading the Next Phase of AI
  '701Tm00000az9RSIAY', // 2026 - Microsoft E7 Offering Workflow
]

export async function getEmailReport(filters = {}) {
  // region + quarter only — never the global channel/campaign/pillar (these campaigns
  // span the SEO + Email channels; the scoping is by campaign_key below).
  const scoped = { region: filters.region, quarter: filters.quarter }
  const rows = await fetchAll(
    () => applyFilters(supabase.from('v_fact_enriched').select(FACT_COLS), scoped).in('campaign_key', EMAIL_CAMPAIGN_KEYS),
    ['fact_id'],
  )
  const campaigns = [...groupBy(rows, 'campaign_key')]
    .map(([key, rs]) => ({
      campaignKey: key,
      campaignName: rs[0]?.campaign_name ?? key,
      leads: sum(rs, 'leads'),
      mql: sum(rs, 'mql_count'),
      sql: sum(rs, 'sql_count'),
      createdOpps: sum(rs, 'created_opp_count'),
      oppValue: sum(rs, 'pipeline_value'),
      closedWon: sum(rs, 'closed_won_value'),
    }))
    .sort((a, b) => b.leads - a.leads)
  return {
    totals: funnelOf(rows),
    campaigns,
    hasData: rows.length > 0,
    targetCount: EMAIL_CAMPAIGN_KEYS.length,
    matchedCount: campaigns.length,
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
  const rows = await fetchAll(() => {
    let q = supabase
      .from('v_fact_enriched')
      .select('campaign_key,campaign_name,region_code,activity_date,spend,impressions,clicks,leads')
      .eq('source', 'linkedin')
    if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
    return q
  }, ['fact_id']) // unique PK

  // campaign_name is null through v_fact_enriched for LI_ keys; resolve names
  // from v_campaign_current (LinkedIn channel_id = 2).
  const nameMap = new Map()
  try {
    const names = await getCampaignsForChannel(2)
    for (const c of names) nameMap.set(c.campaign_key, c.campaign_name)
  } catch {
    /* names are best-effort; fall back to campaign_key */
  }

  const snapshotDate = rows.reduce((mx, r) => (r.activity_date > mx ? r.activity_date : mx), null)
  const totals = {
    spend: sum(rows, 'spend'),
    impressions: sum(rows, 'impressions'),
    clicks: sum(rows, 'clicks'),
    leads: sum(rows, 'leads'), // LinkedIn lead-gen FORM leads (delivery rows)
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
  const { spend, impressions, clicks, leads } = totals
  const efficiency = {
    ctr: impressions > 0 ? clicks / impressions : NA, // click-through rate
    cpc: clicks > 0 ? spend / clicks : NA, // cost per click (GBP)
    cpm: impressions > 0 ? (spend / impressions) * 1000 : NA, // cost per 1,000 impressions (GBP)
    cplForm: leads > 0 ? spend / leads : NA, // cost per LinkedIn form lead (GBP)
    pipeline: attributed.pipeline,
    closedWon: attributed.closedWon,
    roiPipeline: spend > 0 && !isNA(attributed.pipeline) ? attributed.pipeline / spend : NA,
    roiRevenue: spend > 0 && !isNA(attributed.closedWon) ? attributed.closedWon / spend : NA,
  }
  const campaigns = rows
    .map((r) => {
      const clicks = Number(r.clicks) || 0
      const impr = Number(r.impressions) || 0
      const spend = Number(r.spend) || 0
      const leads = Number(r.leads) || 0
      return {
        campaignKey: r.campaign_key,
        campaignName: r.campaign_name || nameMap.get(r.campaign_key) || r.campaign_key,
        regionCode: r.region_code,
        spend,
        impressions: impr,
        clicks,
        leads,
        ctr: impr > 0 ? clicks / impr : NA, // click-through rate
        cpl: leads > 0 ? spend / leads : NA, // GBP cost per lead
      }
    })
    .sort((a, b) => b.spend - a.spend)

  return {
    currency: 'GBP',
    snapshotDate,
    totals,
    efficiency,
    campaigns,
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
  // year >= 2026, capped at Q2 close) — a campaign is "in scope" if it appears
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
  const rows = await fetchAll(
    () => applyFilters(
      supabase
        .from('v_fact_enriched')
        .select('fact_id,campaign_key,campaign_name,campaign_type,leads,mql_count,sql_count,created_opp_count,pipeline_value,closed_won_value'),
      { ...filters, channel: 'Events & Webinars' },
    ),
    ['fact_id'],
  )

  const campaigns = [...groupBy(rows, 'campaign_key')]
    .map(([key, rs]) => ({
      campaignKey: key,
      campaignName: rs[0]?.campaign_name || key || 'Unattributed',
      campaignType: rs[0]?.campaign_type || null,
      leads: sum(rs, 'leads'),
      mql: sum(rs, 'mql_count'),
      sql: sum(rs, 'sql_count'),
      createdOpps: sum(rs, 'created_opp_count'),
      pipeline: sum(rs, 'pipeline_value'),
      closedWon: sum(rs, 'closed_won_value'),
    }))
    .sort((a, b) => b.pipeline - a.pipeline)

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

// Campaign-level THEME rollup (Margot, Jul 2026 — X4 / G3). Groups every marketing
// campaign into its overarching quarterly theme (see themes.js — a rule that covers
// the whole book, not just the campaigns Margot named) and returns per-theme rollups
// with the child activities beneath. Region + quarter scoped like the rest of the app
// (selecting a quarter naturally hides the other quarter's themes). Metrics are the
// SF-attributed funnel we already hold; Created Opportunities as a distinct metric
// arrives with the funnel-definition work (X3).
export async function getCampaignThemes(filters = {}) {
  const [rows, overrides] = await Promise.all([
    fetchAll(
      () => applyFilters(
        supabase
          .from('v_fact_enriched')
          .select('fact_id,campaign_key,campaign_name,campaign_type,channel_name,leads,mql_count,sql_count,pipeline_value,closed_won_value,closed_won_count'),
        filters,
      ),
      ['fact_id'],
    ),
    getCampaignOverrides(), // map by campaign_key → { theme, display_name, ... }
  ])

  // Collapse to one row per campaign, tagged with its theme. A manual override
  // (campaign_overrides.theme) wins over the name-based auto rule; we keep the auto
  // theme too so the UI can show "Auto · <name-rule theme>" and offer a revert.
  const campaigns = [...groupBy(rows, 'campaign_key')].map(([key, rs]) => {
    const name = rs[0]?.campaign_name || key || 'Unattributed'
    const autoTheme = themeForCampaign(name)
    const pinned = overrides[key]?.theme || null
    return {
      campaignKey: key,
      campaignName: name,
      campaignType: rs[0]?.campaign_type || null,
      channel: rs[0]?.channel_name || null,
      leads: sum(rs, 'leads'),
      mql: sum(rs, 'mql_count'),
      sql: sum(rs, 'sql_count'),
      pipeline: sum(rs, 'pipeline_value'),
      closedWon: sum(rs, 'closed_won_value'),
      wonCount: sum(rs, 'closed_won_count'),
      theme: pinned ? themeMeta(pinned) : autoTheme,
      autoTheme,
      themeOverridden: !!pinned,
    }
  })

  // Group campaigns by theme, roll up totals, emit in THEME_ORDER (Other last).
  const byTheme = new Map()
  for (const c of campaigns) {
    if (!byTheme.has(c.theme.key)) byTheme.set(c.theme.key, [])
    byTheme.get(c.theme.key).push(c)
  }

  const themes = THEME_ORDER.filter((k) => byTheme.has(k)).map((k) => {
    const cs = byTheme
      .get(k)
      .sort((a, b) => b.pipeline - a.pipeline || b.closedWon - a.closedWon || b.leads - a.leads)
    const totals = cs.reduce(
      (a, c) => ({
        leads: a.leads + c.leads,
        mql: a.mql + c.mql,
        sql: a.sql + c.sql,
        pipeline: a.pipeline + c.pipeline,
        closedWon: a.closedWon + c.closedWon,
        wonCount: a.wonCount + c.wonCount,
      }),
      { leads: 0, mql: 0, sql: 0, pipeline: 0, closedWon: 0, wonCount: 0 },
    )
    return { ...themeMeta(k), campaigns: cs, totals, activityCount: cs.length }
  })

  return { themes, hasData: campaigns.length > 0 }
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
// The product/flow promoted within a workstream (e.g. "M365 Review", "Copilot Accelerator",
// "Secure Data"). null for campaign/event sequences (shown by their own name instead).
export function outreachProduct(name) {
  const n = String(name || '')
  let m = n.match(/^CWSI - (?:SoPro|Microsoft)\s+(?:UK&I|UK & I|BeLux|NL)\s+(.+?)\s*-\s*[^-]*$/i)
  if (m) return m[1].replace(/\s+/g, ' ').trim()
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
      if (!agg.has(key)) agg.set(key, { label, region: r.region_code, prospects: 0, opens: 0, clicks: 0, replies: 0, sequences: 0 })
      const x = agg.get(key)
      x.prospects += r.prospects || 0; x.opens += r.opens || 0; x.clicks += r.clicks || 0; x.replies += r.replies || 0; x.sequences += 1
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

  return {
    snapshotDate,
    kpis,
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
  const [attr, meetings, opps] = await Promise.all([
    fetchAll(() => scope(supabase
      .from('v_outreach_attributed_meetings')
      .select('meeting_id,region_code,year,quarter,activity_date,sequence_id,sequence_name'), 'activity_date'), ['meeting_id', 'sequence_id']),
    fetchAll(() => scope(supabase
      .from('v_meeting')
      .select('meeting_id,region_code,year,quarter,activity_date,contact_email'), 'activity_date'), ['meeting_id']),
    fetchAll(() => scope(supabase
      .from('v_outreach_attributed_opps')
      .select('opp_id,sequence_id,sequence_name,region_code,year,quarter,created_date,is_won,is_closed,stage_name,amount_eur'), 'created_date'), ['opp_id', 'sequence_id']),
  ])

  const outbound = new Set(), exclBroadcast = new Set(), any = new Set()
  const perSeq = new Map()
  for (const r of attr) {
    const cat = outreachSeqCategory(r.sequence_name)
    any.add(r.meeting_id)
    if (cat !== 'Broadcast / newsletter') exclBroadcast.add(r.meeting_id)
    if (cat === 'Outbound prospecting') outbound.add(r.meeting_id)
    const key = r.sequence_name || '(unnamed sequence)'
    if (!perSeq.has(key)) perSeq.set(key, { sequence: key, category: cat, region: r.region_code, ids: new Set() })
    perSeq.get(key).ids.add(r.meeting_id)
  }
  // ---- Opportunities (OR9): distinct opps per tier + per sequence; pipeline = open &
  //      qualified, won = IsWon. Per-opp value counted once (an opp can span sequences). ----
  const UNQ = 'Unqualified opp'
  const oppVal = new Map()             // opp_id -> { pipeline, won }
  const oppOut = new Set(), oppExcl = new Set(), oppAny = new Set()
  const perSeqOpp = new Map()          // seqName -> { region, opps:Set, pipeline, won }
  for (const o of opps) {
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
    // Coverage for the honesty note: how many meetings we could even attempt to match
    coverage: { attributed: any.size, withEmail, totalMeetings },
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
  q = q.lte('activity_date', toDateCapIso()) // to-date cap (Q2 2026 close) — GA4/SEO stop at end of Q2
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
        .select('activity_date,region_code,region_name,hostname,channel_group,sessions,engaged_sessions,key_events')
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
  // Organic-social referred sessions: GA4 sessionDefaultChannelGroup = 'Organic Social'
  // (unpaid social only — excludes 'Paid Social'). Powers the mockup's
  // "Traffic to website (social sessions)" KPI. Available since the 22 Jun GA4 re-grain.
  const socialRows = rows.filter((r) => r.channel_group === 'Organic Social')
  const totals = {
    sessions,
    engaged,
    engagementRate: sessions ? engaged / sessions : NA,
    keyEvents: naIfAllZero(rows, 'key_events'), // pending: GA4 conversions not confirmed
    socialSessions: socialRows.length ? sum(socialRows, 'sessions') : NA,
  }

  const byHostname = [...groupBy(rows, 'hostname')]
    .map(([hostname, rs]) => ({
      hostname,
      sessions: sum(rs, 'sessions'),
      engaged: sum(rs, 'engaged_sessions'),
    }))
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
  const dailyP = fetchAll(
    () => applyWebFilters(
      supabase.from('v_seo_daily').select('activity_date,region_code,clicks,impressions,ctr,avg_position'),
      filters,
    ),
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
  const topPages = (pData || []).map((p) => ({
    page: p.page,
    clicks: Number(p.clicks),
    impressions: Number(p.impressions),
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
  const rows = await fetchAll(() => {
    let q = supabase
      .from('v_marketing_spend')
      .select('spend_id,amount,currency,region_code,quarter,budget_line,primary_audience,status')
    if (filters.region && filters.region !== 'all') q = q.eq('region_code', filters.region)
    const ql = quarterLabel(filters.quarter)
    if (ql) q = q.eq('quarter', ql)
    return q
  }, ['spend_id']) // unique PK

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
    hasData: rows.length > 0,
  }
}
