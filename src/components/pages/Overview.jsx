import QuarterPills from '../QuarterPills'
import { LoadingSkeleton, ErrorState, EmptyState, NotAvailablePanel, NotAvailable } from '../States'
import { useOverview, useKpiTargets } from '../../hooks/useDashboardData'
import { useFilters } from '../../filters/FilterContext'
import { eur, num, pct, ratio, isNA } from '../../data/format'
import { periodOf, scopeLabel, achievement, lightOf, targetAt, fmtTarget } from '../../data/kpiRegister'
import { I } from '../icons'
import Explain from '../Explain'
import MarketingBudget from '../MarketingBudget'

// Status lights + %-of-target follow the ACTIVE quarter pill (Q1..Q4 → that
// quarter's target; YTD → FY), reading the EDITABLE kpi_targets DB table — so a
// client target-edit on the KPI Tracker propagates here too. Targets are
// provisional until the client enters real numbers; actuals are live/real.

export default function Overview() {
  const q = useOverview()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">
            Marketing <span className="accent">Intelligence</span> Dashboard
          </div>
          <div className="page-sub">
            Quarterly KPI view · FY2026 · Source: Salesforce
          </div>
        </div>
        <QuarterPills />
      </div>

      {q.isLoading && <LoadingSkeleton />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && <EmptyState />}

      {q.data && q.data.hasData && (
        <Body data={q.data} />
      )}
    </>
  )
}

function Body({ data }) {
  const { funnel, byChannel, retention = {} } = data
  const { filters } = useFilters()
  const qtr = filters.quarter // 'q1'..'q4' | 'ytd' — targets resolve to this scope
  const maxPipe = Math.max(1, ...byChannel.map((c) => c.pipeline))

  // Editable targets from the kpi_targets DB table, resolved at the active quarter.
  const targets = useKpiTargets().data || {}
  const period = periodOf(qtr)
  const scope = scopeLabel(qtr)
  const lightFor = (v, key) => lightOf(targets[key], period, v)
  const pctOf = (v, key) => {
    const f = achievement(targets[key], period, v)
    return f == null ? 'n/a' : `${(f * 100).toFixed(0)}% of ${scope}`
  }
  const tgtSub = (key) => {
    const t = targetAt(targets[key], period)
    return t == null ? 'target pending (provisional)' : `${scope} tgt: ${fmtTarget(targets[key]?.unit, t)} · provisional`
  }

  return (
    <>
      {/* 0. Marketing budget — at the very top (OV9): budget & spend before the funnel */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Marketing Budget — Actual Spend</div>
            <div className="panel-sub">From the budget tracker (EUR) · net of corrections · total budget &amp; MDF split pending from CWSI</div>
          </div>
          <span className="chip blue">EUR</span>
        </div>
        <div className="panel-body">
          <MarketingBudget compact />
        </div>
      </div>

      {/* 1. Top-line summary — target + light follow the active quarter pill */}
      <div className="kpis cols-3">
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.euro}</svg></div>
            <span className={`tl ${lightFor(funnel.pipeline, 'influencedPipeline')}`}>
              <span className="tl-dot" />{pctOf(funnel.pipeline, 'influencedPipeline')}
            </span>
          </div>
          <div className="kpi-label">Influenced Pipeline · current view <Explain id="pipeline" /></div>
          <div className="kpi-val">{eur(funnel.pipeline)}</div>
          <div className="kpi-sub">
            <span className="kpi-target">{tgtSub('influencedPipeline')}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn green"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.trend}</svg></div>
            <span className={`tl ${isNA(funnel.margin) ? 'neu' : lightFor(funnel.margin, 'influencedMargin')}`}>
              <span className="tl-dot" />{isNA(funnel.margin) ? 'n/a' : pctOf(funnel.margin, 'influencedMargin')}
            </span>
          </div>
          <div className="kpi-label">Influenced Margin · current view <Explain id="margin" /></div>
          <div className="kpi-val">{isNA(funnel.margin) ? '—' : eur(funnel.margin)}</div>
          <div className="kpi-sub">
            {isNA(funnel.margin) ? (
              <NotAvailable
                what="Influenced margin"
                why={`gross profit pending${funnel.marginPendingDeals ? ` for ${num(funnel.marginPendingDeals)} won deal${funnel.marginPendingDeals === 1 ? '' : 's'}` : ''}`}
              />
            ) : (
              <>
                <span className="kpi-target">{tgtSub('influencedMargin')}</span>
                <span className="kpi-target" style={{ display: 'block', opacity: 0.65 }}>
                  of {eur(funnel.closedWon)} closed-won
                  {funnel.marginPendingDeals > 0 &&
                    ` · ${num(funnel.marginKnownDeals)} of ${num(funnel.marginKnownDeals + funnel.marginPendingDeals)} deals have gross profit · rest pending in Salesforce`}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn amber"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.users}</svg></div>
            <span className={`tl ${retention.hasData ? lightFor(retention.retainedCount, 'retainedContracts') : 'neu'}`}>
              <span className="tl-dot" />{retention.hasData ? pctOf(retention.retainedCount, 'retainedContracts') : 'n/a'}
            </span>
          </div>
          <div className="kpi-label">Retained Contracts · current view <Explain id="retention" /></div>
          <div className="kpi-val">{retention.hasData ? num(retention.retainedCount) : '—'}</div>
          <div className="kpi-sub">
            {retention.hasData ? (
              <>
                <span className="kpi-target">{eur(retention.retainedValue)} won · {num(retention.openCount)} open</span>
                {retention.expansionCount > 0 && (
                  <span className="kpi-target" style={{ display: 'block' }}>
                    + Expansion {num(retention.expansionCount)} ({eur(retention.expansionValue)}) · Upsell / Cross-Sell
                  </span>
                )}
                <span className="kpi-target" style={{ display: 'block', opacity: 0.65 }}>
                  {tgtSub('retainedContracts')} · whole-book scale; marketing-only scope pending
                </span>
              </>
            ) : (
              <NotAvailable what="Retained contracts" why="No won-renewal opportunities in this scope" />
            )}
          </div>
        </div>
      </div>

      {/* Why is Influenced Margin showing "—"? Explain the vendor-cost gap. */}
      {isNA(funnel.margin) && (
        <div className="callout amber" style={{ marginBottom: 18 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="callout-body">
            <strong>Influenced margin shows "—" because Gross Profit isn't filled in Salesforce.</strong>{' '}
            Margin = gross profit (Gross Profit Value, or Amount × Gross Profit Margin %).{' '}
            {funnel.marginPendingDeals
              ? `The ${num(funnel.marginPendingDeals)} won deal${funnel.marginPendingDeals === 1 ? '' : 's'} in this scope have no Gross Profit entered`
              : 'None of the won deals in this scope have Gross Profit entered'}
            {' '}yet, so margin can't be calculated. Fill Gross Profit on those Salesforce opportunities and the figure will populate automatically.
          </div>
        </div>
      )}

      {/* 2. Lead Conversion Funnel */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Lead Conversion Funnel</div>
            <div className="panel-sub">Stage progression with conversion rates between each step</div>
          </div>
          <span className="chip blue">current view</span>
        </div>
        <div className="panel-body">
          <div className="h-funnel">
            <Stage name="Leads" val={num(funnel.leads)} extra="all sources" explainId="leads" />
            <Stage name="MQLs" val={num(funnel.mql)} extra={`${pct(funnel.mql, funnel.leads)} of leads`} explainId="mql" />
            <Stage name="SQLs" val={num(funnel.sql)} extra={`${pct(funnel.sql, funnel.mql)} of MQL`} explainId="sql" />
            <Stage name="Created Opps" val={isNA(funnel.createdOpps) ? '—' : num(funnel.createdOpps)} extra={isNA(funnel.createdOpps) ? 'after next refresh' : 'all created'} explainId="createdOpps" />
            <Stage name="Opportunities" val={isNA(funnel.opp) ? '—' : num(funnel.opp)} extra={isNA(funnel.opp) ? 'not available yet' : 'qualified · open or won'} explainId="opportunities" />
            <Stage name="Closed Won" val={isNA(funnel.closedWonCount) ? '—' : num(funnel.closedWonCount)} extra={isNA(funnel.closedWonCount) ? 'not available yet' : 'won deals'} explainId="closedWon" />
          </div>
          <div className="h-funnel-conv">
            <span className="conv">▶ {pct(funnel.mql, funnel.leads)} Lead → MQL</span>
            <span className="conv">▶ {pct(funnel.sql, funnel.mql)} MQL → SQL</span>
            <span className="conv">▶ {isNA(funnel.opp) ? 'SQL → Opp n/a' : `${pct(funnel.opp, funnel.sql)} SQL → Opp`}</span>
            <span className="conv">▶ {isNA(funnel.closedWonCount) || isNA(funnel.opp) ? 'Opp → Closed n/a' : `${pct(funnel.closedWonCount, funnel.opp)} Opp → Won`}</span>
          </div>
        </div>
      </div>

      {/* 3. Pipeline vs Closed-Won by Channel */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Pipeline vs Closed-Won by Channel</div>
            <div className="panel-sub">Generated pipeline against the revenue it converted into · per channel · current view</div>
          </div>
          <span className="chip blue">current view</span>
        </div>
        <div className="panel-body">
          <div className="tribar">
            {byChannel.map((c) => (
              <div className="group" key={c.channel}>
                <div className="group-head">
                  <div className="group-name">{c.channel}</div>
                  <div className="group-roi">
                    {(c.pipeline + c.closedWon) > 0
                      ? <>{pct(c.closedWon, c.pipeline + c.closedWon, 0)} converted to won</>
                      : <>No pipeline yet</>}
                  </div>
                </div>
                <div className="stack">
                  <div className="bar-row">
                    <div className="bar-label">Open pipeline</div>
                    <div className="bar-track"><div className="bar-fill bf-blue" style={{ width: `${(c.pipeline / maxPipe) * 100}%` }} /></div>
                    <div className="bar-val">{eur(c.pipeline)}</div>
                  </div>
                  <div className="bar-row">
                    <div className="bar-label">Closed-won</div>
                    <div className="bar-track"><div className="bar-fill bf-green" style={{ width: `${ratio(c.closedWon, maxPipe) * 100}%` }} /></div>
                    <div className="bar-val">{eur(c.closedWon)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="callout" style={{ marginTop: 14 }}>
            <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
            <div className="callout-body">
              <strong>On Outreach &amp; Paid Search:</strong> <strong>Paid Search</strong> isn't shown because no
              paid-search campaigns ran in the period (nothing to report — not a data gap). <strong>Outreach</strong>{' '}
              is reported on its own page: its meetings and opportunities are attributed by contact (Paul's method),
              which is a different basis to the campaign-attributed channels shown here, so it isn't merged into this chart.
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Recommendations — AI synthesis layer */}
      <NotAvailablePanel
        title="Q3 Strategic Recommendations"
        what="AI-synthesised recommendations"
        why="AI-written recommendations — coming soon."
      />
    </>
  )
}

const Stage = ({ name, val, extra, explainId }) => (
  <div className="h-funnel-stage">
    <div className="stage-name">{name}{explainId && <Explain id={explainId} align="left" />}</div>
    <div className="stage-val">{val}</div>
    <div className="stage-extra">{extra}</div>
  </div>
)
