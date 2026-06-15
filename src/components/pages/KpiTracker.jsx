import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useKpiTracker } from '../../hooks/useDashboardData'
import { gbp, num, pct } from '../../data/format'
import { FY_TARGETS } from '../../data/thresholds'
import MarketingBudget from '../MarketingBudget'

// The KPI register, in the agreed category order. `live` rows are computed from
// v_fact_enriched; every other KPI depends on a measure not in the store yet
// and renders an explicit n/a (never a fabricated number).
export default function KpiTracker() {
  const q = useKpiTracker()

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
      {q.data && q.data.hasData && <Register f={q.data.funnel} />}
    </>
  )
}

function Register({ f }) {
  const rows = [
    ['cat', 'Overall Commercial Outcomes'],
    ['na', 'Closed opportunities', 'no opportunity-count measure'],
    ['live', 'Influenced pipeline', gbp(f.pipeline), `FY ${gbp(FY_TARGETS.influencedPipeline)}`],
    ['live', 'Closed-won value', gbp(f.closedWon), `FY ${gbp(FY_TARGETS.influencedMargin)}`],
    ['na', 'Cost per lead (blended)', 'spend is GBP (LinkedIn) vs EUR budget — see LinkedIn page'],
    ['na', 'Return on spend (blended)', 'mixed currency; not blended — see LinkedIn page'],
    ['cat', 'Paid & Digital Acquisition'],
    ['na', 'Impressions (non-LinkedIn)', 'LinkedIn impressions live on LinkedIn page'],
    ['na', 'Cost per click (CPC)', 'LinkedIn CTR/clicks live on LinkedIn page (GBP)'],
    ['na', 'Cost per thousand (CPM)', 'LinkedIn-only; on LinkedIn page'],
    ['na', 'Conversions from organic', 'no conversions measure'],
    ['live', 'Lead → MQL conversion', pct(f.mql, f.leads), 'derived'],
    ['live', 'MQL → SQL conversion', pct(f.sql, f.mql), 'derived'],
    ['na', 'SQL → Closed/Won', 'no opp/closed-count measure'],
    ['cat', 'Pipeline Volumes'],
    ['live', 'Total leads', num(f.leads), `FY ${num(FY_TARGETS.totalLeads)}`],
    ['live', 'Total MQLs', num(f.mql), `FY ${num(FY_TARGETS.mqls)}`],
    ['live', 'Total SQLs', num(f.sql), `FY ${num(FY_TARGETS.sqls)}`],
    ['cat', 'Email Performance'],
    ['na', 'Click-through rate', 'fact_web/email metrics empty'],
    ['na', 'Unsubscribe rate', 'not in schema'],
    ['na', 'Conversions from email', 'no conversions measure'],
    ['cat', 'Website Performance'],
    ['na', 'Total organic traffic', 'fact_web_daily empty'],
    ['cat', 'Events Performance'],
    ['na', 'Registrations (leads)', 'no event-registration measure'],
    ['na', 'Attendance rate', 'no attendance measure'],
    ['na', 'Cost per conversion', 'spend = 0'],
  ]

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Full KPI Register · FY2026</div>
          <div className="panel-sub">Live actuals from v_fact_enriched · n/a = measure not in store yet</div>
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
