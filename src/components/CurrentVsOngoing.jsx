import { useCurrentVsOngoing } from '../hooks/useDashboardData'
import { eur, num, isNA } from '../data/format'
import Explain from './Explain'

// X6 / EV5 — "current-quarter activity vs ongoing impact of earlier activities" split.
// Splits the period's pipeline/revenue by when the campaign started and contrasts each
// bucket's sales-cycle — showing marketing's long tail. Shared across Overview, Pipeline,
// Campaigns, SEO, Email (via `keys`) and per-channel pages (via `channel`).
//
// W6 (11 Aug): the arithmetic is now shown, not implied — an explicit "Undated" tile
// renders whenever undated activity exists, and a total line states the identity
// Run this period + Ongoing impact (+ Undated) = the view's total. Margot's "how can
// Closed Won and Ongoing Impact not match when Run Activities is zero" was exactly the
// undated bucket being silently absent from this panel.
export default function CurrentVsOngoing({ channel = null, keys = null, label = 'campaign' }) {
  const q = useCurrentVsOngoing(channel, keys)
  if (!q.data || !q.data.hasData) return null
  const { current, prior, undated, incrementalRevenue } = q.data
  const cyc = (b) => (b.wonCount > 0 && !isNA(b.avgCycleDays) ? `~${num(b.avgCycleDays)} days to close` : 'no deals closed yet')
  const currentZero = current.closedWon === 0
  const hasUndated = undated.closedWon > 0 || undated.pipeline > 0 || undated.leads > 0
  const totalWon = current.closedWon + prior.closedWon + undated.closedWon
  const totalPipe = current.pipeline + prior.pipeline + undated.pipeline
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Activity Run This Period vs Ongoing Impact <Explain id="currentVsOngoing" /></div>
          <div className="panel-sub">Pipeline &amp; revenue split by when the {label} started · current view</div>
        </div>
        <span className="chip blue">current view</span>
      </div>
      <div className="panel-body">
        <div className={`kpis ${hasUndated ? 'cols-3' : 'cols-2'}`}>
          <div className="kpi">
            <div className="kpi-label">Run this period → results to date <Explain id="currentVsOngoing" /></div>
            <div className="kpi-val">{eur(current.closedWon)}</div>
            <div className="kpi-sub"><span className="kpi-target">closed-won · {eur(current.pipeline)} pipeline · {num(current.campaigns)} {label}s · {cyc(current)}</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Ongoing impact — earlier {label}s, still generating <Explain id="currentVsOngoing" /></div>
            <div className="kpi-val">{eur(prior.closedWon)}</div>
            <div className="kpi-sub"><span className="kpi-target">closed-won · {eur(prior.pipeline)} pipeline · {num(prior.campaigns)} {label}s · {cyc(prior)}</span></div>
          </div>
          {hasUndated && (
            <div className="kpi">
              <div className="kpi-label">Undated — no start date recorded</div>
              <div className="kpi-val">{eur(undated.closedWon)}</div>
              <div className="kpi-sub"><span className="kpi-target">closed-won · {eur(undated.pipeline)} pipeline · {num(undated.campaigns)} {label}s (mostly system/list entries in Salesforce)</span></div>
            </div>
          )}
        </div>

        {/* The identity, stated: the three buckets are a complete partition of the view. */}
        <p className="panel-note" style={{ padding: '2px 4px 8px', fontSize: 12, opacity: 0.75 }}>
          <strong>These buckets always add up:</strong> run this period + ongoing impact{hasUndated ? ' + undated' : ''} ={' '}
          <strong>{eur(totalWon)}</strong> closed-won and <strong>{eur(totalPipe)}</strong> open pipeline — the same
          totals shown at the top of this page. The split is relative to the selected period, so under{' '}
          <strong>YTD</strong> a Q1 {label} counts as "run this period", while under the <strong>Q2</strong> pill the
          same {label} counts as ongoing impact — the quarterly totals still sum to the YTD totals.
        </p>

        <div className="callout" style={{ marginTop: 4 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
          <div className="callout-body">
            {currentZero && current.pipeline > 0 && (
              <><strong>The €0 is a genuine zero, not missing data.</strong> {label === 'event' ? 'Events' : 'Campaigns'} started this period have already generated <strong>{eur(current.pipeline)}</strong> of pipeline but haven’t closed a deal yet — expected, because deals take time to mature and the revenue lands in later quarters. That lag is exactly what this view exists to show.{' '}</>
            )}
            <strong>{eur(incrementalRevenue)}</strong> of this period’s closed-won came from {label}s that started in an{' '}
            <strong>earlier</strong> quarter — marketing’s long tail{prior.wonCount > 0 && !isNA(prior.avgCycleDays) ? <>, taking <strong>~{num(prior.avgCycleDays)} days</strong> on average from {label} start to a closed deal</> : null}
            {current.wonCount > 0 && !isNA(current.avgCycleDays) ? <> (this period's own {label}s that already closed took ~{num(current.avgCycleDays)} days)</> : null}.
          </div>
        </div>
      </div>
    </div>
  )
}
