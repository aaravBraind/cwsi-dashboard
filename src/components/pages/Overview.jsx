import QuarterPills from '../QuarterPills'
import { LoadingSkeleton, ErrorState, EmptyState, NotAvailablePanel, NotAvailable } from '../States'
import { useOverview } from '../../hooks/useDashboardData'
import { gbp, num, pct, ratio, isNA } from '../../data/format'
import { FY_TARGETS, light } from '../../data/thresholds'
import { I } from '../icons'
import MarketingBudget from '../MarketingBudget'

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
            Quarterly KPI view · FY2026 · Source: Salesforce (seed) · live from v_fact_enriched
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
  const { funnel, byChannel } = data
  const maxPipe = Math.max(1, ...byChannel.map((c) => c.pipeline))

  return (
    <>
      {/* 1. Top-line summary */}
      <div className="kpis cols-3">
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.pound}</svg></div>
            <span className={`tl ${light(funnel.pipeline, FY_TARGETS.influencedPipeline)}`}>
              <span className="tl-dot" />{pct(funnel.pipeline, FY_TARGETS.influencedPipeline, 0)} of FY
            </span>
          </div>
          <div className="kpi-label">Influenced Pipeline · scoped</div>
          <div className="kpi-val">{gbp(funnel.pipeline)}</div>
          <div className="kpi-sub">
            <span className="kpi-target">FY: {gbp(FY_TARGETS.influencedPipeline)}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn green"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.trend}</svg></div>
            <span className={`tl ${light(funnel.closedWon, FY_TARGETS.influencedMargin)}`}>
              <span className="tl-dot" />{pct(funnel.closedWon, FY_TARGETS.influencedMargin, 0)} of FY
            </span>
          </div>
          <div className="kpi-label">Closed-Won Value · scoped</div>
          <div className="kpi-val">{gbp(funnel.closedWon)}</div>
          <div className="kpi-sub">
            <span className="kpi-target">FY margin target: {gbp(FY_TARGETS.influencedMargin)}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn amber"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.users}</svg></div>
            <span className="tl neu"><span className="tl-dot" />n/a</span>
          </div>
          <div className="kpi-label">Retained Contracts · YTD</div>
          <div className="kpi-val">—</div>
          <div className="kpi-sub">
            <NotAvailable what="Retained contracts" why="No retained-contract measure in the schema" />
          </div>
        </div>
      </div>

      {/* 2. Lead Conversion Funnel */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Lead Conversion Funnel</div>
            <div className="panel-sub">Stage progression with conversion rates between each step</div>
          </div>
          <span className="chip blue">scoped</span>
        </div>
        <div className="panel-body">
          <div className="h-funnel">
            <Stage name="Leads" val={num(funnel.leads)} extra="all sources" />
            <Stage name="MQLs" val={num(funnel.mql)} extra={`${pct(funnel.mql, funnel.leads)} of leads`} />
            <Stage name="SQLs" val={num(funnel.sql)} extra={`${pct(funnel.sql, funnel.mql)} of MQL`} />
            <Stage name="Opportunities" val={isNA(funnel.opp) ? '—' : num(funnel.opp)} extra={isNA(funnel.opp) ? 'not available yet' : 'qualified · open or won'} />
            <Stage name="Closed Won" val={isNA(funnel.closedWonCount) ? '—' : num(funnel.closedWonCount)} extra={isNA(funnel.closedWonCount) ? 'not available yet' : 'won deals'} />
          </div>
          <div className="h-funnel-conv">
            <span className="conv">▶ {pct(funnel.mql, funnel.leads)} Lead → MQL</span>
            <span className="conv">▶ {pct(funnel.sql, funnel.mql)} MQL → SQL</span>
            <span className="conv">▶ {isNA(funnel.opp) ? 'SQL → Opp n/a' : `${pct(funnel.opp, funnel.sql)} SQL → Opp`}</span>
            <span className="conv">▶ {isNA(funnel.closedWonCount) || isNA(funnel.opp) ? 'Opp → Closed n/a' : `${pct(funnel.closedWonCount, funnel.opp)} Opp → Won`}</span>
          </div>
        </div>
      </div>

      {/* 3. Pipeline by Channel */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Pipeline by Channel — Performance vs Spend</div>
            <div className="panel-sub">Pipeline &amp; closed-won per channel · LinkedIn spend is a GBP snapshot; others pending</div>
          </div>
          <span className="chip blue">scoped</span>
        </div>
        <div className="panel-body">
          <div className="tribar">
            {byChannel.map((c) => (
              <div className="group" key={c.channel}>
                <div className="group-head">
                  <div className="group-name">{c.channel}</div>
                  <div className="group-roi">
                    {isNA(c.spend)
                      ? <>ROI n/a · Closed-won {gbp(c.closedWon)}</>
                      : <>Closed-won {gbp(c.closedWon)}</>}
                  </div>
                </div>
                <div className="stack">
                  <div className="bar-row">
                    <div className="bar-label">Pipeline generated</div>
                    <div className="bar-track"><div className="bar-fill bf-blue" style={{ width: `${(c.pipeline / maxPipe) * 100}%` }} /></div>
                    <div className="bar-val">{gbp(c.pipeline)}</div>
                  </div>
                  <div className="bar-row">
                    <div className="bar-label">Closed-won</div>
                    <div className="bar-track"><div className="bar-fill bf-green" style={{ width: `${ratio(c.closedWon, maxPipe) * 100}%` }} /></div>
                    <div className="bar-val">{gbp(c.closedWon)}</div>
                  </div>
                  <div className="bar-row">
                    <div className="bar-label">Spend {isNA(c.spend) ? '' : '(GBP)'}</div>
                    <div className="bar-track"><div className="bar-fill bf-neutral" style={{ width: isNA(c.spend) ? '0%' : `${(c.spend / maxPipe) * 100}%` }} /></div>
                    <div className="bar-val">{isNA(c.spend) ? 'n/a' : gbp(c.spend)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="callout" style={{ marginTop: 18, marginBottom: 0 }}>
            <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
            <div className="callout-body">
              <strong>Currency:</strong> per-channel spend here is <strong>GBP</strong> (LinkedIn delivery,
              a cumulative snapshot — see LinkedIn Paid). The <strong>EUR</strong> marketing budget below is
              converted to GBP at a per-day-pinned ECB rate (labelled on the panel) — EUR and GBP are
              converted before any comparison, never summed raw. Channels other than LinkedIn have no
              delivery spend yet, so their ROI/CPL show "not available yet".
            </div>
          </div>
        </div>
      </div>

      {/* Marketing budget — EUR, finance-grained, separate currency from channel spend */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Marketing Budget — Actual Spend</div>
            <div className="panel-sub">From the budget tracker (EUR) · shown in GBP at a pinned ECB rate · net of correction rows</div>
          </div>
          <span className="chip blue">GBP</span>
        </div>
        <div className="panel-body">
          <MarketingBudget compact />
        </div>
      </div>

      {/* 4. Events mix — depends on event-type dimension not in the view */}
      <div className="cols-2-3">
        <NotAvailablePanel
          title="Events Mix — Webinars / Owned / Earned"
          what="Event-type split"
          why="v_fact_enriched has no event-type dimension (webinar / owned / earned) yet."
        />
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <div className="left">
              <div className="panel-title">Quarter Health</div>
              <div className="panel-sub">Traffic-light thresholds are configurable (client-gated)</div>
            </div>
          </div>
          <div className="panel-body">
            <div className="def-grid" style={{ gridTemplateColumns: '1fr', gap: 0 }}>
              <HealthRow label="Influenced pipeline" cls={light(funnel.pipeline, FY_TARGETS.influencedPipeline)} val={pct(funnel.pipeline, FY_TARGETS.influencedPipeline, 0)} />
              <HealthRow label="Closed-won value" cls={light(funnel.closedWon, FY_TARGETS.influencedMargin)} val={gbp(funnel.closedWon)} />
              <HealthRow label="Lead → MQL rate" cls="neu" val={pct(funnel.mql, funnel.leads)} />
              <HealthRow label="MQL → SQL rate" cls="neu" val={pct(funnel.sql, funnel.mql)} />
              <HealthRow label="CPL average" cls="neu" val="n/a" />
              <HealthRow label="Event attendance" cls="neu" val="n/a" />
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Recommendations — AI synthesis layer */}
      <NotAvailablePanel
        title="Q3 Strategic Recommendations"
        what="AI-synthesised recommendations"
        why="This panel is produced by the AI layer (not yet wired); left intact so it can slot in."
      />
    </>
  )
}

const Stage = ({ name, val, extra }) => (
  <div className="h-funnel-stage">
    <div className="stage-name">{name}</div>
    <div className="stage-val">{val}</div>
    <div className="stage-extra">{extra}</div>
  </div>
)

const HealthRow = ({ label, cls, val }) => (
  <div className="def-row">
    <span className="def-key">{label}</span>
    <span className={`tl ${cls}`}><span className="tl-dot" />{val}</span>
  </div>
)
