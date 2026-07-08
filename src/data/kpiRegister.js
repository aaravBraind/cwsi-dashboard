// ---- Shared KPI register definition --------------------------------------
// The single source of truth for the KPI register rows, used by BOTH the KPI
// Tracker page (KpiTracker.jsx) and the Export layer (exporters.js) so the two
// can never drift. Pure: takes the already-fetched, already-scoped data and
// returns the row list. Actuals are real; only targets (resolved elsewhere from
// kpi_targets) are placeholder.
//
// Row shape: { t, label, ctx?, key?, num? }
//   t    'cat' | 'live' | 'na'
//   key  kpi_targets key → links the row to its editable target + status
//   num  numeric actual for the status comparison (rates as fractions)
//   val  display string for a live actual (n/a rows show "not available yet")

import { eur, num, pct, isNA } from './format'

const has = (x) => x != null && !isNA(x)

export function buildKpiRegisterRows({ funnel, retention, web, events, attendance } = {}) {
  const f = funnel || {}
  const w = web || {}
  const ret = retention || {}

  const convCtx = has(w.keyEvents) && w.sessions ? `${pct(w.keyEvents, w.sessions)} of sessions` : 'GA4 conversions'
  const retCtx = ret.expansionCount > 0
    ? `${eur(ret.retainedValue)} won · Renewal only · + Expansion ${num(ret.expansionCount)} (${eur(ret.expansionValue)})`
    : `${eur(ret.retainedValue)} won · Renewal only`

  const evTypes = events?.byType || []
  const evLeads = evTypes.reduce((s, t) => s + (Number(t.leads) || 0), 0)
  const evMql = evTypes.reduce((s, t) => s + (Number(t.mql) || 0), 0)
  const evSql = evTypes.reduce((s, t) => s + (Number(t.sql) || 0), 0)

  const leadToMqlV = has(f.mql) && f.leads ? f.mql / f.leads : null
  const visitorToMqlV = has(w.keyEvents) && Number(w.sessions) > 0 ? w.keyEvents / w.sessions : null
  const mqlToSqlV = has(f.sql) && f.mql ? f.sql / f.mql : null
  const sqlToWonV = has(f.closedWonCount) && f.sql ? f.closedWonCount / f.sql : null
  const eventsMqlSqlV = evMql > 0 ? evSql / evMql : null
  const attendanceV = attendance && attendance.registrants > 0 ? attendance.attendees / attendance.registrants : null

  return [
    // ── Overall marketing summary (KR1/KR2: merged Pipeline Volumes + Commercial
    //    Outcomes into ONE lead section; funnel order MQL→SQL→Created Opps→Closed→outcomes) ──
    { t: 'cat', label: 'Overall Marketing Summary' },
    { t: 'live', label: 'Total MQLs', val: num(f.mql), ctx: 'current view', key: 'totalMqls', num: f.mql },
    { t: 'live', label: 'Total SQLs', val: num(f.sql), ctx: 'current view', key: 'totalSqls', num: f.sql },
    has(f.createdOpps)
      ? { t: 'live', label: 'Created opportunities', val: num(f.createdOpps), ctx: 'all opps created in period (marketing-attributed, by created date)', key: 'createdOpportunities', num: f.createdOpps }
      : { t: 'na', label: 'Created opportunities', ctx: 'created-opp count arrives at the next data refresh', key: 'createdOpportunities' },
    has(f.closedWonCount)
      ? { t: 'live', label: 'Closed-won opportunities', val: num(f.closedWonCount), ctx: 'won deals', key: 'closedWonCount', num: f.closedWonCount }
      : { t: 'na', label: 'Closed-won opportunities', ctx: 'closed-won count arrives at the next data refresh', key: 'closedWonCount' },
    { t: 'live', label: 'Influenced pipeline', val: eur(f.pipeline), ctx: 'open qualified opp value', key: 'influencedPipeline', num: f.pipeline },
    { t: 'live', label: 'Closed-won value', val: eur(f.closedWon), ctx: 'won value', key: 'closedWonValue', num: f.closedWon },
    has(f.margin)
      ? {
          t: 'live', label: 'Influenced margin',
          val: eur(f.margin),
          ctx: f.marginPendingDeals > 0
            ? `gross profit (EUR) · ${num(f.marginKnownDeals)}/${num(f.marginKnownDeals + f.marginPendingDeals)} won deals have gross profit (rest pending in Salesforce)`
            : 'gross profit (EUR)',
          key: 'influencedMargin', num: f.margin,
        }
      : { t: 'na', label: 'Influenced margin', ctx: 'Gross Profit blank on all won deals in scope — pending in Salesforce (not shown as revenue)', key: 'influencedMargin' },
    ret.hasData
      ? { t: 'live', label: 'Retained contracts', val: num(ret.retainedCount), ctx: retCtx, key: 'retainedContracts', num: ret.retainedCount }
      : { t: 'na', label: 'Retained contracts', ctx: 'won renewals — none in scope', key: 'retainedContracts' },
    { t: 'na', label: 'Cost per lead (blended)', ctx: 'per-channel spend pending (the combined per-channel spend sheet)', key: 'costPerLead' },
    { t: 'na', label: 'Return on spend (blended)', ctx: 'mixed currency; per-channel spend pending', key: 'returnOnSpend' },

    // ── Paid & Digital Acquisition (the acquisition funnel; conversions shown once here) ──
    { t: 'cat', label: 'Paid & Digital Acquisition' },
    { t: 'na', label: 'Impressions (non-LinkedIn)', ctx: 'LinkedIn impressions live on LinkedIn page', key: 'impressions' },
    { t: 'na', label: 'Cost per click (CPC)', ctx: 'LinkedIn CTR/clicks on LinkedIn page (GBP)', key: 'cpc' },
    { t: 'na', label: 'Cost per thousand (CPM)', ctx: 'LinkedIn-only; on LinkedIn page', key: 'cpm' },
    { t: 'live', label: 'Lead → MQL conversion', val: pct(f.mql, f.leads), ctx: 'derived', key: 'leadToMql', num: leadToMqlV },
    { t: 'live', label: 'MQL → SQL conversion', val: pct(f.sql, f.mql), ctx: 'derived', key: 'mqlToSql', num: mqlToSqlV },
    has(f.closedWonCount)
      ? { t: 'live', label: 'SQL → Closed/Won', val: pct(f.closedWonCount, f.sql), ctx: 'derived', key: 'sqlToWon', num: sqlToWonV }
      : { t: 'na', label: 'SQL → Closed/Won', ctx: 'closed-count arrives at the next data refresh', key: 'sqlToWon' },

    // ── Organic Social (KR3 — distinct group) ──
    { t: 'cat', label: 'Organic Social' },
    { t: 'na', label: 'Engagement rate', ctx: 'no organic-social feed (reactions/comments/shares)', key: 'engagementRate' },
    has(w.socialSessions)
      ? { t: 'live', label: 'Traffic from organic social (sessions)', val: num(w.socialSessions), ctx: 'GA4 channel = Organic Social', key: 'socialSessions', num: w.socialSessions }
      : { t: 'na', label: 'Traffic from organic social', ctx: 'GA4 Organic Social channel', key: 'socialSessions' },
    { t: 'na', label: 'Follower growth', ctx: 'no organic-social follower feed', key: 'followerGrowth' },

    // ── Email Performance ──
    { t: 'cat', label: 'Email Performance' },
    { t: 'na', label: 'Open rate', ctx: 'from our email-marketing platform — not available from the current email setup', key: 'emailOpenRate' },
    { t: 'na', label: 'Click-through rate', ctx: 'from our email-marketing platform — not available from the current email setup', key: 'emailCtr' },
    { t: 'na', label: 'Unsubscribe rate', ctx: 'from our email-marketing platform — not available from the current email setup', key: 'unsubscribeRate' },
    { t: 'na', label: 'Reader → MQL', ctx: 'email engagement pending (our email-marketing platform)', key: 'readerToMql' },
    { t: 'na', label: 'Conversions from email', ctx: 'email engagement pending (our email-marketing platform)', key: 'conversionsFromEmail' },

    // ── Website Performance (GA4-sourced; visitor conversions shown here) ──
    { t: 'cat', label: 'Website Performance' },
    has(w.sessions) && Number(w.sessions) > 0
      ? { t: 'live', label: 'Total organic traffic (sessions)', val: num(w.sessions), ctx: 'GA4', key: 'totalOrganicTraffic', num: w.sessions }
      : { t: 'na', label: 'Total organic traffic', ctx: 'GA4 sessions', key: 'totalOrganicTraffic' },
    { t: 'live', label: 'Total leads', val: num(f.leads), ctx: 'campaign membership · all channels', key: 'totalLeads', num: f.leads },
    has(w.keyEvents)
      ? { t: 'live', label: 'Conversions from organic (GA4)', val: num(w.keyEvents), ctx: convCtx, key: 'conversionsFromOrganic', num: w.keyEvents }
      : { t: 'na', label: 'Conversions from organic', ctx: 'GA4 key events', key: 'conversionsFromOrganic' },
    visitorToMqlV != null
      ? { t: 'live', label: 'Visitor → MQL conversion', val: pct(w.keyEvents, w.sessions, 2), ctx: 'GA4 conv ÷ sessions', key: 'visitorToMql', num: visitorToMqlV }
      : { t: 'na', label: 'Visitor → MQL conversion', ctx: 'GA4 key events ÷ sessions', key: 'visitorToMql' },

    { t: 'cat', label: 'Events Performance' },
    evLeads > 0
      ? { t: 'live', label: 'Registrations (leads)', val: num(evLeads), ctx: 'campaign membership · event campaigns', key: 'registrations', num: evLeads }
      : { t: 'na', label: 'Registrations (leads)', ctx: 'event-campaign members (at the next data refresh)', key: 'registrations' },
    attendanceV != null
      ? { t: 'live', label: 'Attendance rate (webinar)', val: pct(attendance.attendees, attendance.registrants), ctx: 'GoToWebinar · webinar only; in-person attendance not yet available', key: 'attendanceRate', num: attendanceV }
      : { t: 'na', label: 'Attendance rate', ctx: 'GoToWebinar attendance match pending', key: 'attendanceRate' },
    eventsMqlSqlV != null
      ? { t: 'live', label: 'MQL → SQL conversion (events)', val: pct(evSql, evMql), ctx: 'event-campaign funnel', key: 'mqlToSqlEvents', num: eventsMqlSqlV }
      : { t: 'na', label: 'MQL → SQL conversion (events)', ctx: 'event-campaign funnel (at the next data refresh)', key: 'mqlToSqlEvents' },
    { t: 'na', label: 'Cost per conversion', ctx: 'event spend pending', key: 'costPerConversion' },
  ]
}

// Target helpers shared by the page + exporter (reading a kpi_targets row).
export const periodOf = (q) => (!q || q === 'ytd' ? 'fy' : q)
export const scopeLabel = (q) => (!q || q === 'ytd' ? 'FY' : String(q).toUpperCase())

// Achievement fraction vs the target at this period (1.0 = on target); inverts
// for lower-is-better ceilings. null when no target or no live actual.
export function achievement(row, period, value) {
  if (!row) return null
  const t = row[period]
  if (t == null || value == null || isNA(value) || !Number.isFinite(Number(value))) return null
  const v = Number(value)
  return row.lower_is_better ? (v === 0 ? null : Number(t) / v) : v / Number(t)
}

// Status-light class from the achievement fraction (green ≥95% / amber ≥80% / red).
export function lightOf(row, period, value) {
  const r = achievement(row, period, value)
  if (r == null) return 'neu'
  if (r >= 0.95) return 'green'
  if (r >= 0.8) return 'amber'
  return 'red'
}

// The raw target number at this period, or null.
export const targetAt = (row, period) => (row && row[period] != null ? Number(row[period]) : null)

// Format a target value by its kpi_targets unit ('gbp'|'rate'|'count'|'x').
export function fmtTarget(unit, t) {
  if (t == null) return null
  if (unit === 'gbp') return eur(t)
  if (unit === 'rate') return `${(Number(t) * 100).toFixed(1)}%`
  if (unit === 'x') return `${Number(t).toFixed(1)}×`
  return num(t)
}
