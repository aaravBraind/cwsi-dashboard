import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState, NotAvailablePanel } from '../States'
import { usePipeline, useOpportunityStage } from '../../hooks/useDashboardData'
import CurrentVsOngoing from '../CurrentVsOngoing'
import { useFilters } from '../../filters/FilterContext'
import { eur, num, pct, isNA } from '../../data/format'
import { I } from '../icons'
import Explain from '../Explain'

export default function Pipeline() {
  const q = usePipeline()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Pipeline <span className="accent">Report</span></div>
          <div className="page-sub">Funnel + pipeline by source · live from Salesforce · FY2026</div>
        </div>
        <QuarterPills />
      </div>

      {q.isLoading && <Loading />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && <EmptyState />}
      {q.data && q.data.hasData && <Body data={q.data} />}
    </>
  )
}

function Body({ data }) {
  const { funnel, bySource } = data
  const { filters } = useFilters()
  const quarterScoped = filters.quarter && filters.quarter !== 'ytd'
  return (
    <>
      {/* Top strip */}
      <div className="gaps-strip" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <Cell label="Influenced Pipeline" val={eur(funnel.pipeline)} meta="current view" explainId="pipeline" />
        <Cell label="Total Leads" val={num(funnel.leads)} meta="current view" explainId="leads" />
        <Cell label="MQLs → SQLs" val={`${num(funnel.mql)} → ${num(funnel.sql)}`} meta={pct(funnel.sql, funnel.mql)} explainId="sql" />
        <Cell label="Closed-Won Value" val={eur(funnel.closedWon)} meta="current view" explainId="closedWon" />
      </div>

      {/* Lead Journey — natural funnel with stage conversion (mirrors Overview) */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Lead Journey</div>
            <div className="panel-sub">Leads → MQLs → SQLs → Created Opps → Pipeline → Closed-Won · with stage conversion · current view</div>
          </div>
          <span className="chip blue">current view</span>
        </div>
        <div className="panel-body">
          <div className="h-funnel">
            <Stage name="Leads" val={num(funnel.leads)} extra="all sources" explainId="leads" />
            <Stage name="MQLs" val={num(funnel.mql)} extra={`${pct(funnel.mql, funnel.leads)} of leads`} explainId="mql" />
            <Stage name="SQLs" val={num(funnel.sql)} extra={`${pct(funnel.sql, funnel.mql)} of MQL`} explainId="sql" />
            <Stage name="Created Opps" val={isNA(funnel.createdOpps) ? '—' : num(funnel.createdOpps)} extra={isNA(funnel.createdOpps) ? 'after next refresh' : 'all created'} explainId="createdOpps" />
            <Stage name="Pipeline €" val={eur(funnel.pipeline)} extra="value" explainId="pipeline" />
            <Stage name="Closed-Won" val={eur(funnel.closedWon)} extra="value" explainId="closedWon" />
          </div>
          <div className="h-funnel-conv">
            <span className="conv">▶ {pct(funnel.mql, funnel.leads)} Lead → MQL</span>
            <span className="conv">▶ {pct(funnel.sql, funnel.mql)} MQL → SQL</span>
            <span className="conv">▶ {pct(funnel.closedWon, funnel.pipeline)} Pipeline → Won</span>
          </div>
          {quarterScoped && (
            <div className="callout amber" style={{ marginTop: 12 }}>
              <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
              <div className="callout-body">
                <strong>How to read the quarterly funnel.</strong> Each stage is dated by a
                different Salesforce event — leads and MQLs by their lead date, SQLs, pipeline and
                closed-won by the opportunity's created/close date — so the same deal can fall in a
                different quarter at each stage. Within one quarter these counts show how many records
                reached <em>at least</em> that stage (so Leads ≥ MQLs ≥ SQLs), rather than following one
                group of deals end to end. Switch to <strong>YTD</strong> for a full end-to-end funnel
                where the stages line up.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current-quarter activity vs ongoing impact of prior-quarter activities (X6) */}
      <CurrentVsOngoing />

      {/* Pipeline stage distribution — open-pipeline snapshot (B7-adjacent, 20 Jun) */}
      <StageDistribution />

      {/* Pipeline by Source / Channel */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Pipeline by Source</div>
            <div className="panel-sub">Leads, MQLs, SQLs, pipeline &amp; closed-won by channel · current view</div>
          </div>
          <span className="chip blue">Salesforce</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Source / Channel</th>
                <th className="r">Leads <Explain id="leads" /></th>
                <th className="r">MQLs <Explain id="mql" /></th>
                <th className="r">SQLs <Explain id="sql" /></th>
                <th className="r">Created Opps <Explain id="createdOpps" /></th>
                <th className="r">Pipeline € <Explain id="pipeline" /></th>
                <th className="r">Closed-Won € <Explain id="closedWon" /></th>
              </tr>
            </thead>
            <tbody>
              {bySource.map((s) => (
                <tr key={s.channel}>
                  <td>{s.channel}</td>
                  <td className="r mono">{num(s.leads)}</td>
                  <td className="r mono">{num(s.mql)}</td>
                  <td className="r mono">{num(s.sql)}</td>
                  <td className="r mono">{num(s.createdOpps)}</td>
                  <td className="r mono">{eur(s.pipeline)}</td>
                  <td className="r mono">{eur(s.closedWon)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td className="r mono">{num(funnel.leads)}</td>
                <td className="r mono">{num(funnel.mql)}</td>
                <td className="r mono">{num(funnel.sql)}</td>
                <td className="r mono">{isNA(funnel.createdOpps) ? '—' : num(funnel.createdOpps)}</td>
                <td className="r mono">{eur(funnel.pipeline)}</td>
                <td className="r mono">{eur(funnel.closedWon)}</td>
              </tr>
            </tbody>
          </table>
          <div className="callout" style={{ margin: '4px 12px 12px' }}>
            <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
            <div className="callout-body">
              <strong>Outreach &amp; Paid Search sources:</strong> <strong>Paid Search</strong> has no campaigns in
              Salesforce for the period, so there's nothing to list here. <strong>Outreach</strong> is attributed by
              contact (not by campaign) and is reported on its own page — it isn't a campaign-attributed source in
              this table. Every row here is marketing-campaign-attributed (each opp carries a Campaign).
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function StageDistribution() {
  const q = useOpportunityStage()
  if (q.isLoading) return null
  if (q.isError || !q.data?.hasData) {
    return (
      <NotAvailablePanel
        title="Pipeline Stage Distribution"
        what="Open-pipeline stage counts"
        why="The open-opportunity breakdown isn't loaded yet — it arrives with the next data refresh."
      />
    )
  }
  const { stages, snapshotDate } = q.data
  const maxVal = Math.max(1, ...stages.map((s) => s.value))
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Pipeline Stage Distribution</div>
          <div className="panel-sub">
            Open opportunities (created 2026) by stage · count &amp; value{snapshotDate ? ` · snapshot ${snapshotDate}` : ''}
          </div>
        </div>
        <span className="chip blue">open pipeline</span>
      </div>
      <div className="panel-body">
        <div className="bar-list">
          {stages.map((s) => (
            <div className="bar-row" key={s.stage}>
              <div className="bar-label">
                {s.stage}{s.probability != null ? ` · ${num(s.probability)}%` : ''}
              </div>
              <div className="bar-track">
                <div className="bar-fill bf-blue" style={{ width: `${(s.value / maxVal) * 100}%` }} />
              </div>
              <div className="bar-val">{eur(s.value)}</div>
              <div className="bar-pct">{num(s.count)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const Stage = ({ name, val, extra, explainId }) => (
  <div className="h-funnel-stage">
    <div className="stage-name">{name}{explainId && <Explain id={explainId} align="left" />}</div>
    <div className="stage-val">{val}</div>
    <div className="stage-extra">{extra}</div>
  </div>
)
const Cell = ({ label, val, meta, explainId }) => (
  <div className="gap-cell">
    <div className="gap-label">{label}{explainId && <Explain id={explainId} align="left" />}</div>
    <div className="gap-val">{val}</div>
    <div className="gap-meta">{meta}</div>
  </div>
)
