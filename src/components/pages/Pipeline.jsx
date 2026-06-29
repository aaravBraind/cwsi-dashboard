import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState, NotAvailablePanel } from '../States'
import { usePipeline, useOpportunityStage } from '../../hooks/useDashboardData'
import { useFilters } from '../../filters/FilterContext'
import { gbp, num, pct } from '../../data/format'
import { I } from '../icons'

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
        <Cell label="Influenced Pipeline" val={gbp(funnel.pipeline)} meta="scoped" />
        <Cell label="Total Leads" val={num(funnel.leads)} meta="scoped" />
        <Cell label="MQLs → SQLs" val={`${num(funnel.mql)} → ${num(funnel.sql)}`} meta={pct(funnel.sql, funnel.mql)} />
        <Cell label="Closed-Won Value" val={gbp(funnel.closedWon)} meta="scoped" />
      </div>

      {/* Funnel */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Lead → MQL → SQL → Pipeline → Closed-Won</div>
            <div className="panel-sub">Per-stage opportunity counts are in the Pipeline Stage Distribution below</div>
          </div>
          <span className="chip blue">scoped</span>
        </div>
        <div className="panel-body">
          <div className="h-funnel">
            <Stage name="Leads" val={num(funnel.leads)} extra="all sources" />
            <Stage name="MQLs" val={num(funnel.mql)} extra={`${pct(funnel.mql, funnel.leads)} of leads`} />
            <Stage name="SQLs" val={num(funnel.sql)} extra={`${pct(funnel.sql, funnel.mql)} of MQL`} />
            <Stage name="Pipeline £" val={gbp(funnel.pipeline)} extra="value" />
            <Stage name="Closed-Won" val={gbp(funnel.closedWon)} extra="value" />
          </div>
          {quarterScoped && (
            <div className="callout amber" style={{ marginTop: 12 }}>
              <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
              <div className="callout-body">
                <strong>Quarterly funnel = "reached-or-beyond", scope-dated.</strong> Stages are dated by
                different Salesforce events — leads/MQLs by lead date, SQLs/pipeline/closed-won by
                opportunity created/close date — so a deal can land in a different quarter at each stage.
                Within a single quarter these counts show how many records reached <em>at least</em> that
                stage (Leads ≥ MQLs ≥ SQLs by construction), not same-cohort flow. View <strong>YTD</strong> for
                a true end-to-end funnel where the stages reconcile.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline stage distribution — open-pipeline snapshot (B7-adjacent, 20 Jun) */}
      <StageDistribution />

      {/* Pipeline by Source / Channel */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Pipeline by Source — full breakdown</div>
            <div className="panel-sub">Leads, MQLs, SQLs, pipeline &amp; closed-won by channel · scoped</div>
          </div>
          <span className="chip blue">Salesforce</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Source / Channel</th>
                <th className="r">Leads</th>
                <th className="r">MQLs</th>
                <th className="r">SQLs</th>
                <th className="r">Pipeline £</th>
                <th className="r">Closed-Won £</th>
                <th className="r">CPL</th>
              </tr>
            </thead>
            <tbody>
              {bySource.map((s) => (
                <tr key={s.channel}>
                  <td>{s.channel}</td>
                  <td className="r mono">{num(s.leads)}</td>
                  <td className="r mono">{num(s.mql)}</td>
                  <td className="r mono">{num(s.sql)}</td>
                  <td className="r mono">{gbp(s.pipeline)}</td>
                  <td className="r mono">{gbp(s.closedWon)}</td>
                  <td className="r mono mono-d">n/a</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td className="r mono">{num(funnel.leads)}</td>
                <td className="r mono">{num(funnel.mql)}</td>
                <td className="r mono">{num(funnel.sql)}</td>
                <td className="r mono">{gbp(funnel.pipeline)}</td>
                <td className="r mono">{gbp(funnel.closedWon)}</td>
                <td className="r mono mono-d">n/a</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="callout amber" style={{ marginTop: 18, marginBottom: 0 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div className="callout-body">
          <strong>CPL shows "n/a"</strong> because cost per lead needs per-channel spend, and only LinkedIn
          delivery spend is available so far. The other channels' spend is pending (Margot's merged
          spend sheet) — once that spend is added to the data, CPL populates per source automatically.
        </div>
      </div>
    </>
  )
}

// Open-pipeline stage distribution. Region-scoped snapshot (not quarter-sliced), so
// it has its own hook + loading/empty handling, independent of the funnel above.
function StageDistribution() {
  const q = useOpportunityStage()
  if (q.isLoading) return null
  if (q.isError || !q.data?.hasData) {
    return (
      <NotAvailablePanel
        title="Pipeline Stage Distribution"
        what="Open-pipeline stage counts"
        why="No open-opportunity snapshot yet — re-import & run the SF workflow (the SF: Get Open Opps branch)."
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
            Open opportunities by stage · count &amp; value{snapshotDate ? ` · snapshot ${snapshotDate}` : ''}
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
              <div className="bar-val">{gbp(s.value)}</div>
              <div className="bar-pct">{num(s.count)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const Stage = ({ name, val, extra }) => (
  <div className="h-funnel-stage">
    <div className="stage-name">{name}</div>
    <div className="stage-val">{val}</div>
    <div className="stage-extra">{extra}</div>
  </div>
)
const Cell = ({ label, val, meta }) => (
  <div className="gap-cell">
    <div className="gap-label">{label}</div>
    <div className="gap-val">{val}</div>
    <div className="gap-meta">{meta}</div>
  </div>
)
