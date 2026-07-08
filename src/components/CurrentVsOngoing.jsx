import { useCurrentVsOngoing } from '../hooks/useDashboardData'
import { eur, num, isNA } from '../data/format'
import Explain from './Explain'

// X6 / EV5 — "current-quarter activity vs ongoing impact of earlier activities" split
// Margot asked for (proposed viz). Splits the period's pipeline/revenue by when the
// campaign started and contrasts each bucket's sales-cycle — showing marketing's long tail.
// Shared so it can render on Pipeline (all channels) AND per-channel (e.g. Events) via the
// optional `channel` prop. `label` tweaks the wording for a channel context.
export default function CurrentVsOngoing({ channel = null, label = 'campaign' }) {
  const q = useCurrentVsOngoing(channel)
  if (!q.data || !q.data.hasData) return null
  const { current, prior, undated, incrementalRevenue } = q.data
  const cyc = (b) => (b.wonCount > 0 && !isNA(b.avgCycleDays) ? `~${num(b.avgCycleDays)} days to close` : 'no deals closed yet')
  const currentZero = current.closedWon === 0
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Current-quarter Activity vs Ongoing Impact <Explain id="currentVsOngoing" /></div>
          <div className="panel-sub">Pipeline &amp; revenue split by when the {label} started · current view</div>
        </div>
        <span className="chip blue">proposed view</span>
      </div>
      <div className="panel-body">
        <div className="kpis cols-2">
          <div className="kpi">
            <div className="kpi-label">Activities run this period → results to date <Explain id="currentVsOngoing" /></div>
            <div className="kpi-val">{eur(current.closedWon)}</div>
            <div className="kpi-sub"><span className="kpi-target">closed-won · {eur(current.pipeline)} pipeline · {num(current.campaigns)} {label}s · {cyc(current)}</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Ongoing impact — earlier activities, still generating <Explain id="currentVsOngoing" /></div>
            <div className="kpi-val">{eur(prior.closedWon)}</div>
            <div className="kpi-sub"><span className="kpi-target">closed-won · {eur(prior.pipeline)} pipeline · {num(prior.campaigns)} {label}s · {cyc(prior)}</span></div>
          </div>
        </div>
        <div className="callout" style={{ marginTop: 4 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
          <div className="callout-body">
            {currentZero && current.pipeline > 0 && (
              <><strong>The €0 is a genuine zero, not missing data.</strong> {label === 'event' ? 'Events' : 'Campaigns'} started this period have already generated <strong>{eur(current.pipeline)}</strong> of pipeline but haven’t closed a deal yet — expected, because deals take time to mature and the revenue lands in later quarters. That lag is exactly what this view exists to show.{' '}</>
            )}
            <strong>{eur(incrementalRevenue)}</strong> of this period’s closed-won came from {label}s that started in an{' '}
            <strong>earlier</strong> quarter — marketing’s long tail{prior.wonCount > 0 && !isNA(prior.avgCycleDays) ? <>, taking <strong>~{num(prior.avgCycleDays)} days</strong> on average to close</> : null}.
            {undated.campaigns > 0 && (
              <> {num(undated.campaigns)} {label}{undated.campaigns === 1 ? '' : 's'} have no start date in Salesforce ({eur(undated.closedWon)} won) and aren’t classified.</>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
