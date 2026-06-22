import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useKpiTracker, useWebTraffic, useEventTypeFunnel } from '../../hooks/useDashboardData'
import { gbp, num, pct, isNA } from '../../data/format'
import { FY_TARGETS } from '../../data/thresholds'
import MarketingBudget from '../MarketingBudget'

// The KPI register, in the agreed category order. `live` rows are computed from
// v_fact_enriched (funnel) + GA4 web traffic; every other KPI depends on a
// measure not in the store yet and renders an explicit n/a (never a fabricated
// number). Refreshed 19 Jun: closed-won count, opportunities, influenced margin,
// organic traffic + organic conversions (GA4 key events) are now live.
// 21 Jun: added Visitor→MQL (GA4 conv ÷ sessions, same source as the SEO tile) and
// MQL→SQL (events) (event-campaign funnel rollup, same source as the Events page) —
// both computed from data already in the warehouse, just surfaced as register rows.
export default function KpiTracker() {
  const q = useKpiTracker()
  const web = useWebTraffic()
  const events = useEventTypeFunnel()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">KPI <span className="accent">Tracker</span></div>
          <div className="page-sub">Quarterly KPIs · live actuals where available · FY2026</div>
        </div>
        <QuarterPills />
      </div>

      {/* Budget vs actual + spend-by-category/region (EUR, fact_marketing_spend) */}
      <div className="sec-divider"><span className="label">Marketing Budget · EUR</span><div className="line" /></div>
      <MarketingBudget />

      <div className="sec-divider"><span className="label">KPI Register</span><div className="line" /></div>
      {q.isLoading && <Loading />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && <EmptyState />}
      {q.data && q.data.hasData && <Register f={q.data.funnel} web={web.data?.totals} events={events.data} retention={q.data.retention} />}
    </>
  )
}

function Register({ f, web, events, retention }) {
  const w = web || {}
  const has = (x) => x != null && !isNA(x) // a measure that has actually landed
  const convCtx = has(w.keyEvents) && w.sessions ? `${pct(w.keyEvents, w.sessions)} of sessions` : 'GA4 conversions'

  // Retained contracts: won renewals only (the honest headline); Expansion (won
  // Upsell + Cross-Sell) is folded into context, never blended into the count.
  const ret = retention || {}
  const retCtx = ret.expansionCount > 0
    ? `${gbp(ret.retainedValue)} won · Renewal only · +Exp ${num(ret.expansionCount)} (${gbp(ret.expansionValue)})`
    : `${gbp(ret.retainedValue)} won · Renewal only`

  // Events MQL→SQL: roll up the per-type event funnel (v_fact_enriched, Events &
  // Webinars channel) to the channel total. Same real data the Events page uses.
  const evTypes = events?.byType || []
  const evLeads = evTypes.reduce((s, t) => s + (Number(t.leads) || 0), 0)
  const evMql = evTypes.reduce((s, t) => s + (Number(t.mql) || 0), 0)
  const evSql = evTypes.reduce((s, t) => s + (Number(t.sql) || 0), 0)

  const rows = [
    ['cat', 'Overall Commercial Outcomes'],
    has(f.closedWonCount)
      ? ['live', 'Closed-won opportunities', num(f.closedWonCount), 'won deals']
      : ['na', 'Closed-won opportunities', 'closed-won count pending SF re-run'],
    ['live', 'Influenced pipeline', gbp(f.pipeline), `FY ${gbp(FY_TARGETS.influencedPipeline)}`],
    ['live', 'Closed-won value', gbp(f.closedWon), `FY ${gbp(FY_TARGETS.influencedMargin)}`],
    has(f.margin)
      ? ['live', 'Influenced margin', gbp(f.margin), 'Amount − vendor cost']
      : ['na', 'Influenced margin', 'margin pending SF re-run'],
    ret.hasData
      ? ['live', 'Retained contracts', num(ret.retainedCount), retCtx]
      : ['na', 'Retained contracts', 'won renewals (v_retention) — none in scope'],
    ['na', 'Cost per lead (blended)', 'per-channel spend pending (Margot merged sheet)'],
    ['na', 'Return on spend (blended)', 'mixed currency; per-channel spend pending'],

    ['cat', 'Paid & Digital Acquisition'],
    ['na', 'Impressions (non-LinkedIn)', 'LinkedIn impressions live on LinkedIn page'],
    ['na', 'Cost per click (CPC)', 'LinkedIn CTR/clicks on LinkedIn page (GBP)'],
    ['na', 'Cost per thousand (CPM)', 'LinkedIn-only; on LinkedIn page'],
    has(w.keyEvents)
      ? ['live', 'Conversions from organic (GA4)', num(w.keyEvents), convCtx]
      : ['na', 'Conversions from organic', 'GA4 key events'],
    has(w.keyEvents) && Number(w.sessions) > 0
      ? ['live', 'Visitor → MQL conversion', pct(w.keyEvents, w.sessions, 2), 'GA4 conv ÷ sessions']
      : ['na', 'Visitor → MQL conversion', 'GA4 key events ÷ sessions'],
    ['live', 'Lead → MQL conversion', pct(f.mql, f.leads), 'derived'],
    ['live', 'MQL → SQL conversion', pct(f.sql, f.mql), 'derived'],
    has(f.closedWonCount)
      ? ['live', 'SQL → Closed/Won', pct(f.closedWonCount, f.sql), 'derived']
      : ['na', 'SQL → Closed/Won', 'closed-count pending SF re-run'],

    ['cat', 'Pipeline Volumes'],
    ['live', 'Total leads', num(f.leads), `FY ${num(FY_TARGETS.totalLeads)}`],
    ['live', 'Total MQLs', num(f.mql), `FY ${num(FY_TARGETS.mqls)}`],
    ['live', 'Total SQLs', num(f.sql), `FY ${num(FY_TARGETS.sqls)}`],
    has(f.opp)
      ? ['live', 'Opportunities (open + won)', num(f.opp), 'qualified subset of SQL']
      : ['na', 'Opportunities (open + won)', 'opp-count pending SF re-run'],

    ['cat', 'Email Performance'],
    ['na', 'Click-through rate', 'Pardot engagement — not in Salesforce SOQL'],
    ['na', 'Unsubscribe rate', 'Pardot engagement — not in Salesforce SOQL'],
    ['na', 'Conversions from email', 'email engagement pending (Pardot)'],

    ['cat', 'Website Performance'],
    has(w.sessions) && Number(w.sessions) > 0
      ? ['live', 'Total organic traffic (sessions)', num(w.sessions), 'GA4']
      : ['na', 'Total organic traffic', 'GA4 sessions'],
    has(w.socialSessions)
      ? ['live', 'Traffic from organic social (sessions)', num(w.socialSessions), 'GA4 channel = Organic Social']
      : ['na', 'Traffic from organic social', 'GA4 Organic Social channel'],

    ['cat', 'Events Performance'],
    evLeads > 0
      ? ['live', 'Registrations (leads)', num(evLeads), 'SF CampaignMembers · event campaigns']
      : ['na', 'Registrations (leads)', 'event-campaign members (pending SF re-run)'],
    ['na', 'Attendance rate', 'GoToWebinar attendance match pending'],
    evMql > 0
      ? ['live', 'MQL → SQL conversion (events)', pct(evSql, evMql), 'event-campaign funnel']
      : ['na', 'MQL → SQL conversion (events)', 'event-campaign funnel (pending SF re-run)'],
    ['na', 'Cost per conversion', 'event spend pending'],
  ]

  const liveCount = rows.filter((r) => r[0] === 'live').length
  const kpiCount = rows.filter((r) => r[0] !== 'cat').length

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Full KPI Register · FY2026</div>
          <div className="panel-sub">{liveCount} of {kpiCount} live (Salesforce + GA4) · n/a = measure not sourced yet</div>
        </div>
        <span className="chip blue">scoped</span>
      </div>
      <div className="panel-body no-pad">
        <table className="tbl">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="r">Actual (scoped)</th>
              <th className="r">Context</th>
              <th className="c">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (row[0] === 'cat')
                return <tr className="cat" key={i}><td colSpan={4}>{row[1]}</td></tr>
              if (row[0] === 'na')
                return (
                  <tr key={i}>
                    <td>{row[1]}</td>
                    <td className="r mono mono-d">not available yet</td>
                    <td className="r mono mono-d">{row[2]}</td>
                    <td className="c"><span className="tl-bare" style={{ background: 'var(--neutral)' }} /></td>
                  </tr>
                )
              return (
                <tr key={i}>
                  <td>{row[1]}</td>
                  <td className="r mono">{row[2]}</td>
                  <td className="r mono mono-d">{row[3]}</td>
                  <td className="c"><span className="tl-bare g" /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
