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

import { gbp, num, pct, isNA } from './format'

const has = (x) => x != null && !isNA(x)

export function buildKpiRegisterRows({ funnel, retention, web, events, attendance } = {}) {
  const f = funnel || {}
  const w = web || {}
  const ret = retention || {}

  const convCtx = has(w.keyEvents) && w.sessions ? `${pct(w.keyEvents, w.sessions)} of sessions` : 'GA4 conversions'
  const retCtx = ret.expansionCount > 0
    ? `${gbp(ret.retainedValue)} won · Renewal only · +Exp ${num(ret.expansionCount)} (${gbp(ret.expansionValue)})`
    : `${gbp(ret.retainedValue)} won · Renewal only`

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
    { t: 'cat', label: 'Overall Commercial Outcomes' },
    has(f.closedWonCount)
      ? { t: 'live', label: 'Closed-won opportunities', val: num(f.closedWonCount), ctx: 'won deals', key: 'closedWonCount', num: f.closedWonCount }
      : { t: 'na', label: 'Closed-won opportunities', ctx: 'closed-won count pending SF re-run', key: 'closedWonCount' },
    { t: 'live', label: 'Influenced pipeline', val: gbp(f.pipeline), ctx: 'open qualified opp value', key: 'influencedPipeline', num: f.pipeline },
    { t: 'live', label: 'Closed-won value', val: gbp(f.closedWon), ctx: 'won Amount', key: 'closedWonValue', num: f.closedWon },
    has(f.margin)
      ? { t: 'live', label: 'Influenced margin', val: gbp(f.margin), ctx: 'Amount − vendor cost', key: 'influencedMargin', num: f.margin }
      : { t: 'na', label: 'Influenced margin', ctx: 'margin pending SF re-run', key: 'influencedMargin' },
    ret.hasData
      ? { t: 'live', label: 'Retained contracts', val: num(ret.retainedCount), ctx: retCtx, key: 'retainedContracts', num: ret.retainedCount }
      : { t: 'na', label: 'Retained contracts', ctx: 'won renewals (v_retention) — none in scope', key: 'retainedContracts' },
    { t: 'na', label: 'Cost per lead (blended)', ctx: 'per-channel spend pending (Margot merged sheet)', key: 'costPerLead' },
    { t: 'na', label: 'Return on spend (blended)', ctx: 'mixed currency; per-channel spend pending', key: 'returnOnSpend' },

    { t: 'cat', label: 'Paid & Digital Acquisition' },
    { t: 'na', label: 'Impressions (non-LinkedIn)', ctx: 'LinkedIn impressions live on LinkedIn page', key: 'impressions' },
    { t: 'na', label: 'Cost per click (CPC)', ctx: 'LinkedIn CTR/clicks on LinkedIn page (GBP)', key: 'cpc' },
    { t: 'na', label: 'Cost per thousand (CPM)', ctx: 'LinkedIn-only; on LinkedIn page', key: 'cpm' },
    has(w.keyEvents)
      ? { t: 'live', label: 'Conversions from organic (GA4)', val: num(w.keyEvents), ctx: convCtx, key: 'conversionsFromOrganic', num: w.keyEvents }
      : { t: 'na', label: 'Conversions from organic', ctx: 'GA4 key events', key: 'conversionsFromOrganic' },
    visitorToMqlV != null
      ? { t: 'live', label: 'Visitor → MQL conversion', val: pct(w.keyEvents, w.sessions, 2), ctx: 'GA4 conv ÷ sessions', key: 'visitorToMql', num: visitorToMqlV }
      : { t: 'na', label: 'Visitor → MQL conversion', ctx: 'GA4 key events ÷ sessions', key: 'visitorToMql' },
    { t: 'live', label: 'Lead → MQL conversion', val: pct(f.mql, f.leads), ctx: 'derived', key: 'leadToMql', num: leadToMqlV },
    { t: 'live', label: 'MQL → SQL conversion', val: pct(f.sql, f.mql), ctx: 'derived', key: 'mqlToSql', num: mqlToSqlV },
    has(f.closedWonCount)
      ? { t: 'live', label: 'SQL → Closed/Won', val: pct(f.closedWonCount, f.sql), ctx: 'derived', key: 'sqlToWon', num: sqlToWonV }
      : { t: 'na', label: 'SQL → Closed/Won', ctx: 'closed-count pending SF re-run', key: 'sqlToWon' },

    { t: 'cat', label: 'Pipeline Volumes' },
    { t: 'live', label: 'Total leads', val: num(f.leads), ctx: 'scoped', key: 'totalLeads', num: f.leads },
    { t: 'live', label: 'Total MQLs', val: num(f.mql), ctx: 'scoped', key: 'totalMqls', num: f.mql },
    { t: 'live', label: 'Total SQLs', val: num(f.sql), ctx: 'scoped', key: 'totalSqls', num: f.sql },
    has(f.opp)
      ? { t: 'live', label: 'Opportunities (open + won)', val: num(f.opp), ctx: 'qualified subset of SQL', key: 'opportunities', num: f.opp }
      : { t: 'na', label: 'Opportunities (open + won)', ctx: 'opp-count pending SF re-run', key: 'opportunities' },

    { t: 'cat', label: 'Email Performance' },
    { t: 'na', label: 'Click-through rate', ctx: 'Pardot engagement — not in Salesforce SOQL', key: 'emailCtr' },
    { t: 'na', label: 'Unsubscribe rate', ctx: 'Pardot engagement — not in Salesforce SOQL', key: 'unsubscribeRate' },
    { t: 'na', label: 'Conversions from email', ctx: 'email engagement pending (Pardot)', key: 'conversionsFromEmail' },

    { t: 'cat', label: 'Website Performance' },
    has(w.sessions) && Number(w.sessions) > 0
      ? { t: 'live', label: 'Total organic traffic (sessions)', val: num(w.sessions), ctx: 'GA4', key: 'totalOrganicTraffic', num: w.sessions }
      : { t: 'na', label: 'Total organic traffic', ctx: 'GA4 sessions', key: 'totalOrganicTraffic' },
    has(w.socialSessions)
      ? { t: 'live', label: 'Traffic from organic social (sessions)', val: num(w.socialSessions), ctx: 'GA4 channel = Organic Social', key: 'socialSessions', num: w.socialSessions }
      : { t: 'na', label: 'Traffic from organic social', ctx: 'GA4 Organic Social channel', key: 'socialSessions' },

    { t: 'cat', label: 'Events Performance' },
    evLeads > 0
      ? { t: 'live', label: 'Registrations (leads)', val: num(evLeads), ctx: 'SF CampaignMembers · event campaigns', key: 'registrations', num: evLeads }
      : { t: 'na', label: 'Registrations (leads)', ctx: 'event-campaign members (pending SF re-run)', key: 'registrations' },
    attendanceV != null
      ? { t: 'live', label: 'Attendance rate (webinar)', val: pct(attendance.attendees, attendance.registrants), ctx: 'GoToWebinar · webinar only; in-person pending SF field', key: 'attendanceRate', num: attendanceV }
      : { t: 'na', label: 'Attendance rate', ctx: 'GoToWebinar attendance match pending', key: 'attendanceRate' },
    eventsMqlSqlV != null
      ? { t: 'live', label: 'MQL → SQL conversion (events)', val: pct(evSql, evMql), ctx: 'event-campaign funnel', key: 'mqlToSqlEvents', num: eventsMqlSqlV }
      : { t: 'na', label: 'MQL → SQL conversion (events)', ctx: 'event-campaign funnel (pending SF re-run)', key: 'mqlToSqlEvents' },
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
  if (unit === 'gbp') return gbp(t)
  if (unit === 'rate') return `${(Number(t) * 100).toFixed(1)}%`
  if (unit === 'x') return `${Number(t).toFixed(1)}×`
  return num(t)
}
