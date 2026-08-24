import { useCurrentVsOngoing } from '../hooks/useDashboardData'
import { eur, num } from '../data/format'
import Explain from './Explain'

// "Activity run this period vs ongoing impact" — the split Margot has asked for since X6.
//
// 20 Aug: the basis moved to the OPPORTUNITY'S CREATION DATE ("Shouldn't we use the
// opportunity's creation date to determine whether it falls under direct or ongoing
// impact?"). The old campaign-start-date basis needed a third "Undated" bucket for
// campaigns Salesforce held no start date for — she rejected it twice as unnecessary
// complexity, and on this basis it cannot exist: every opportunity has a creation date.
export default function CurrentVsOngoing({ channel = null, keys = null, label = 'campaign' }) {
  const q = useCurrentVsOngoing(channel, keys)
  if (!q.data || !q.data.hasData) return null
  const { current, prior } = q.data
  const totalWon = current.closedWon + prior.closedWon
  const totalPipe = current.pipeline + prior.pipeline
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Activity Run This Period vs Ongoing Impact <span style={{ opacity: 0.6, fontWeight: 400 }}>· gross profit</span> <Explain id="currentVsOngoing" /></div>
        </div>
      </div>
      <div className="panel-body">
        <div className="kpis cols-2">
          <div className="kpi">
            <div className="kpi-label">Run this period <Explain id="currentVsOngoing" /></div>
            <div className="kpi-val">{eur(current.closedWon)}</div>
            <div className="kpi-sub">
              <span className="kpi-target">closed-won · {eur(current.pipeline)} open pipeline · {num(current.oppCount)} opportunities</span>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Ongoing impact — earlier activity, still generating <Explain id="currentVsOngoing" /></div>
            <div className="kpi-val">{eur(prior.closedWon)}</div>
            <div className="kpi-sub">
              <span className="kpi-target">closed-won · {eur(prior.pipeline)} open pipeline · {num(prior.oppCount)} opportunities</span>
            </div>
          </div>
        </div>

        <p className="panel-note" style={{ padding: '2px 4px 8px', fontSize: 12, opacity: 0.75 }}>
          Split by the <strong>opportunity's creation date</strong>: a deal created inside the selected period counts as
          run this period, one created earlier counts as ongoing impact. The two always add up —{' '}
          <strong>{eur(totalWon)}</strong> closed-won and <strong>{eur(totalPipe)}</strong> open pipeline, the same
          totals shown at the top of this page. MQLs are dated by their own activity, so they are not split here.
        </p>
      </div>
    </div>
  )
}
