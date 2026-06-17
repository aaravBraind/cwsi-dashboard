import { supabase } from '../lib/supabaseClient'
import {
  REPORTING_YEAR,
  HISTORY_START_YEAR,
  PILLAR_UNMAPPED,
  NA,
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
  'fact_id,campaign_key,campaign_name,region_code,region_name,channel_name,pillar_name,activity_date,year,quarter,source,spend,impressions,leads,mql_count,sql_count,opp_count,pipeline_value,closed_won_value,closed_won_count,margin_value'

// Translate the shared filter object into PostgREST predicates. Every active
// filter is applied here, so every figure derived from fetchFacts re-scopes.
// QUARTER SCOPE:
//   q1..q4 → that quarter of REPORTING_YEAR (2026).
//   ytd    → HISTORY_START_YEAR (2024) → now; earlier years are excluded.
function applyFilters(q, f = {}) {
  if (f.quarter && f.quarter !== 'ytd') {
    q = q.eq('year', REPORTING_YEAR).eq('quarter', Number(String(f.quarter).replace('q', '')))
  } else {
    q = q.gte('year', HISTORY_START_YEAR) // ytd: 2024 onward
  }
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
  return {
    leads: sum(rows, 'leads'),
    mql: sum(rows, 'mql_count'),
    sql: sum(rows, 'sql_count'),
    // Qualified opps that are open or won (excludes unqualified + closed-lost) —
    // a SUBSET of sql, so the conventional funnel narrows: SQL ≥ Opp ≥ Won.
    // NA (not 0) until the SF workflow re-runs to populate opp_count.
    opp: naIfAllZero(rows, 'opp_count'),
    pipeline: sum(rows, 'pipeline_value'),
    closedWon: sum(rows, 'closed_won_value'),
    // Count of won deals (terminal funnel stage). NA (not 0) until the SF
    // workflow re-runs to populate closed_won_count.
    closedWonCount: naIfAllZero(rows, 'closed_won_count'),
    margin: naIfAllZero(rows, 'margin_value'), // influenced margin = won amount − vendor cost
    spend: naIfAllZero(rows, 'spend'),
    impressions: naIfAllZero(rows, 'impressions'),
  }
}

function groupBy(rows, key) {
  const m = new Map()
  for (const r of rows) {
    const k = r[key] ?? null
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  return m
}

// ---- Surface query functions (each returns view-ready, aggregated data) ----

export async function getOverview(filters) {
  const rows = await fetchFacts(filters)
  const funnel = funnelOf(rows)
  const byChannel = [...groupBy(rows, 'channel_name')]
    .map(([channel, rs]) => ({
      channel,
      pipeline: sum(rs, 'pipeline_value'),
      closedWon: sum(rs, 'closed_won_value'),
      // Spend is GBP and currently only present on LinkedIn rows (snapshot).
      spend: naIfAllZero(rs, 'spend'),
      spendCurrency: 'GBP',
    }))
    .sort((a, b) => b.pipeline - a.pipeline)
  return { funnel, byChannel, hasData: rows.length > 0, rowCount: rows.length }
}

export async function getKpiTracker(filters) {
  const rows = await fetchFacts(filters)
  return {
    funnel: funnelOf(rows),
    hasData: rows.length > 0,
    rowCount: rows.length,
  }
}

export async function getPipeline(filters) {
  const rows = await fetchFacts(filters)
  const bySource = [...groupBy(rows, 'channel_name')]
    .map(([channel, rs]) => ({
      channel,
      leads: sum(rs, 'leads'),
      mql: sum(rs, 'mql_count'),
      sql: sum(rs, 'sql_count'),
      pipeline: sum(rs, 'pipeline_value'),
      closedWon: sum(rs, 'closed_won_value'),
    }))
    .sort((a, b) => b.pipeline - a.pipeline)
  return { funnel: funnelOf(rows), bySource, hasData: rows.length > 0, rowCount: rows.length }
}

// Channel page: totals for one channel_name + per-campaign drill-down.
export async function getChannel(channelName, filters) {
  const rows = await fetchFacts({ ...filters, channel: channelName })
  const campaigns = [...groupBy(rows, 'campaign_key')]
    .map(([key, rs]) => ({
      campaignKey: key,
      campaignName: rs[0]?.campaign_name ?? key ?? 'Unattributed',
      leads: sum(rs, 'leads'),
      mql: sum(rs, 'mql_count'),
      sql: sum(rs, 'sql_count'),
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
    leads: sum(rows, 'leads'),
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
    campaigns,
    hasData: rows.length > 0,
    rowCount: rows.length,
  }
}

// ---- Outreach.io engagement SNAPSHOT -------------------------------------
// Reads v_outreach_sequence_current (latest snapshot only — counters are
// lifetime-to-date, NOT a daily series). Region + pillar scope it. meetings /
// SQL / pipeline come from Salesforce attribution (not wired) → pending, never
// fabricated. Rates are computed here, never stored.
export async function getOutreach(filters = {}) {
  const rows = await fetchAll(() => {
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
    meetings: NA, // pending Salesforce attribution (column is 0 / not real)
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

  return {
    snapshotDate,
    kpis,
    funnel: { prospects, opens: kpis.opens, clicks: kpis.clicks, replies: kpis.replies },
    groups,
    pillarCoverage,
    hasData: rows.length > 0,
    rowCount: rows.length,
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
// ONE unified, cadence-ordered list — every step (email, call, LinkedIn, task)
// in one view, each with the engagement metric that applies to its type:
//   email → reached = delivered, open% / reply%
//   call  → reached = dials (completed + no-answer), connect% = completed/dials
//   linkedin / task → manual touchpoints, no engagement metrics at source (—)
// Aggregated across all sequences at (step_order, step_type). Region + pillar scope it.
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

  // One entry per (step_order, step_type) — keeps every step type visible.
  const groups = new Map()
  for (const r of rows) {
    const key = `${r.step_order} ${r.step_type}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  const allSteps = [...groups.values()]
    .map((rs) => {
      const step = rs[0].step_order
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
        step,
        type,
        label: humanizeStepType(type),
        email,
        isCall,
        count: rs.length, // # sequences using this step type at this position
        reached: email ? delivered : isCall ? dials : NA,
        openRate: email && delivered ? opens / delivered : NA,
        replyRate: email && delivered ? replies / delivered : NA,
        connectRate: isCall && dials ? completed / dials : NA,
      }
    })
    // cadence order, then type within a step
    .sort((a, b) => a.step - b.step || a.type.localeCompare(b.type))

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
        .select('activity_date,region_code,region_name,hostname,sessions,engaged_sessions,key_events'),
      filters,
    ),
    ['activity_date', 'region_code', 'hostname'], // grain key (date × region × hostname)
  )

  const sessions = sum(rows, 'sessions')
  const engaged = sum(rows, 'engaged_sessions')
  const totals = {
    sessions,
    engaged,
    engagementRate: sessions ? engaged / sessions : NA,
    keyEvents: naIfAllZero(rows, 'key_events'), // pending: GA4 conversions not confirmed
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
    p_limit: 15,
  })

  const [daily, { data: pData, error: pErr }] = await Promise.all([dailyP, pagesP])
  if (pErr) throw pErr

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

  return { totals, topPages, hasData: daily.length > 0 || topPages.length > 0, dayCount: daily.length }
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
