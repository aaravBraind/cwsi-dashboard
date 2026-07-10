import { useSalesCycle } from '../hooks/useDashboardData'
import { eur, num, isNA } from '../data/format'
import Explain from './Explain'

// Sales-cycle view (G5, Margot + Claire call). How long opportunities take from creation to
// close, by OUTCOME (won / lost / still-open) and by SOURCE (channel) — with the won-vs-lost
// source comparison Claire asked for. Phase 1 = created→close; MQL→opp timing is a follow-up.
const days = (v) => (isNA(v) || v == null ? '—' : `~${num(v)} days`)

export default function SalesCycle() {
  const q = useSalesCycle()
  if (!q.data || !q.data.hasData) return null
  const { overall, bySource } = q.data
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Sales Cycle — how long deals take <Explain id="salesCycle" /></div>
          <div className="panel-sub">Opportunity creation → close, by outcome &amp; source · current view</div>
        </div>
        <span className="chip blue">created → close</span>
      </div>
      <div className="panel-body">
        <div className="kpis cols-3">
          <div className="kpi">
            <div className="kpi-label">Won — avg cycle (created → close)</div>
            <div className="kpi-val">{days(overall.won.avgDays)}</div>
            <div className="kpi-sub"><span className="kpi-target">{num(overall.won.count)} won · {eur(overall.won.value)} · median {isNA(overall.won.medianDays) ? '—' : `${num(overall.won.medianDays)}d`}</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Lost — avg cycle (created → close)</div>
            <div className="kpi-val">{days(overall.lost.avgDays)}</div>
            <div className="kpi-sub"><span className="kpi-target">{num(overall.lost.count)} lost · {eur(overall.lost.value)} · median {isNA(overall.lost.medianDays) ? '—' : `${num(overall.lost.medianDays)}d`}</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Won — MQL → opportunity</div>
            <div className="kpi-val">{days(overall.won.avgMqlToOpp)}</div>
            <div className="kpi-sub"><span className="kpi-target">then {days(overall.won.avgMqlToClose)} MQL → won · timed on {num(overall.won.mqlKnown)}/{num(overall.won.count)} won</span></div>
          </div>
        </div>

        <table className="tbl" style={{ marginTop: 6 }}>
          <thead>
            <tr>
              <th>Source</th>
              <th className="r">Won (n)</th>
              <th className="r">Won cycle</th>
              <th className="r">Lost (n)</th>
              <th className="r">Lost cycle</th>
              <th className="r">Open (n)</th>
              <th className="r">Open €</th>
            </tr>
          </thead>
          <tbody>
            {bySource.map((s) => (
              <tr key={s.channel}>
                <td>{s.channel}</td>
                <td className="r mono">{num(s.won.count)}</td>
                <td className="r mono">{days(s.won.avgDays)}</td>
                <td className="r mono">{num(s.lost.count)}</td>
                <td className="r mono">{days(s.lost.avgDays)}</td>
                <td className="r mono">{num(s.open.count)}</td>
                <td className="r mono">{eur(s.open.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="callout" style={{ marginTop: 4 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
          <div className="callout-body">
            Cycle = days from an opportunity being <strong>created</strong> to it being <strong>closed</strong>.
            Closed deals are scoped by close date (so long-running deals that closed this period are included);
            open deals are those created this period. Comparing <strong>won vs lost</strong> per source shows where
            deals convert faster. <strong>MQL → opportunity</strong> is the time from a contact's first campaign
            response to the opportunity being created (then MQL → won is the full journey) — timed only for opps whose
            contacts we can match to a campaign response, so it covers a subset of deals.
          </div>
        </div>
      </div>
    </div>
  )
}
