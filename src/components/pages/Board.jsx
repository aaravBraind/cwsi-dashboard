import { useEffect } from 'react'
import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useBoardPack, useGenerateBoardPack } from '../../hooks/useDashboardData'
import { useFilters } from '../../filters/FilterContext'
import { I } from '../icons'

// T-7 — AI Insights & Board Pack Generator (trace-to-data enforced).
// The app computes every figure (useBoardPack); the AI layer narrates only those
// figures; the trace-to-data validator blocks any number it can't match. Metrics
// render in the AGREED ORDER: MQLs → SQLs → MQL→SQL → closed opps → influenced
// pipeline → influenced margin → CPL.

const TL = { 'on-track': 'green', watch: 'amber', behind: 'red', pending: 'neu', 'no-target': 'neu' }

export default function Board() {
  const q = useBoardPack()
  const gen = useGenerateBoardPack()
  const { filters } = useFilters()

  // A generated narrative is pinned to the scope it was generated for. If the
  // user changes region/quarter, the figures change — drop the stale narrative
  // so it can't be read against the wrong numbers.
  useEffect(() => {
    if (gen.data || gen.isError) gen.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.region, filters.quarter])

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Board <span className="accent">Pack</span></div>
          <div className="page-sub">AI insights · trace-to-data enforced · agreed metric order · FY2026</div>
        </div>
        <QuarterPills />
      </div>

      {q.isLoading && <Loading />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && <EmptyState />}
      {q.data && q.data.hasData && <Body pack={q.data} gen={gen} />}
    </>
  )
}

function Body({ pack, gen }) {
  const { metrics, levers, meta } = pack
  return (
    <>
      {/* Targets are client-gated → flagged provisional everywhere they surface. */}
      <div className="callout amber" style={{ marginTop: 4 }}>
        <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
        <div className="callout-body">
          <strong>Targets are provisional.</strong> Actuals are live from the warehouse; the FY targets
          shown are placeholders (<code>docs/KPI_REGISTER.md</code>) until Paul + Claire deliver the
          formal register. The AI narrative cites these targets flagged as provisional and never invents a number.
        </div>
      </div>

      {/* 1. Top-line — agreed order */}
      <div className="kpis cols-4">
        {metrics.slice(0, 4).map((m) => <MetricCard key={m.key} m={m} />)}
      </div>
      <div className="kpis cols-3">
        {metrics.slice(4).map((m) => <MetricCard key={m.key} m={m} />)}
      </div>

      {/* 2. Gaps-to-close — app-computed, ranked by estimated pipeline impact */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Gaps to Close — ranked by estimated pipeline impact</div>
            <div className="panel-sub">Levers computed from current yields · {meta.regionLabel} · {meta.quarterLabel}</div>
          </div>
          <span className="chip blue">{levers.length} lever{levers.length === 1 ? '' : 's'}</span>
        </div>
        <div className="panel-body">
          {levers.length === 0 ? (
            <div className="callout" style={{ marginBottom: 0 }}>
              <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
              <div className="callout-body">No gap to close in this scope — every metric with a live actual is at or above its (provisional) target.</div>
            </div>
          ) : (
            <div className="bar-list">
              {levers.map((l, i) => <LeverRow key={l.id} l={l} max={levers[0].impactValue} rank={i + 1} />)}
            </div>
          )}
        </div>
      </div>

      {/* 3. AI narrative + recommendations */}
      <NarrativePanel pack={pack} gen={gen} />
    </>
  )
}

function MetricCard({ m }) {
  const tl = TL[m.status] || 'neu'
  const pending = m.status === 'pending'
  return (
    <div className="kpi">
      <div className="kpi-head">
        <div className={`kpi-icn${pending ? ' amber' : m.status === 'behind' ? '' : ''}`}>
          <svg className="icon icon-lg" viewBox="0 0 24 24">{I.target}</svg>
        </div>
        <span className={`tl ${tl}`}>
          <span className="tl-dot" />{pending ? 'pending' : m.pctOfTargetDisplay !== 'n/a' ? `${m.pctOfTargetDisplay} of FY` : 'no target'}
        </span>
      </div>
      <div className="kpi-label">{m.order} · {m.label}</div>
      <div className="kpi-val">{m.valueDisplay}</div>
      <div className="kpi-sub">
        <span className="kpi-target">{m.targetDisplay} <em style={{ opacity: 0.6 }}>· provisional</em></span>
        {m.note && <span className="kpi-target" style={{ display: 'block', opacity: 0.65 }}>{m.note}</span>}
      </div>
    </div>
  )
}

function LeverRow({ l, max, rank }) {
  const w = max > 0 ? Math.max(4, (l.impactValue / max) * 100) : 0
  return (
    <div className="bar-row">
      <div className="bar-label" title={l.title}><strong>{rank}.</strong> {l.title}</div>
      <div className="bar-track"><div className="bar-fill bf-blue" style={{ width: `${w}%` }} /></div>
      <div className="bar-val" title={l.basis}>{l.impactDisplay}</div>
    </div>
  )
}

function NarrativePanel({ pack, gen }) {
  const v = gen.data?.validation
  const blocked = gen.data && v && !v.ok
  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">AI Board Narrative</div>
          <div className="panel-sub">
            3-part: on track · behind &amp; addressable · H2 plan{gen.data?.model ? ` · ${gen.data.model}` : ''}
          </div>
        </div>
        <button
          className="btn primary"
          onClick={() => gen.mutate(pack)}
          disabled={gen.isPending}
        >
          {gen.isPending ? 'Generating…' : gen.data ? 'Regenerate' : 'Generate narrative'}
        </button>
      </div>
      <div className="panel-body">
        {gen.isIdle && !gen.data && (
          <div className="callout" style={{ marginBottom: 0 }}>
            <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.board}</svg></div>
            <div className="callout-body">
              Generate an AI-written board narrative + prioritised recommendations from the figures above.
              The app sends only the computed figure set to Claude; every number in the result is then
              checked against the warehouse and any untraceable figure blocks publish.
            </div>
          </div>
        )}

        {gen.isPending && <Loading label="Writing the board narrative…" />}
        {gen.isError && <ErrorState error={gen.error} />}

        {gen.data && (
          <>
            <ValidationBadge v={v} />
            <div className={blocked ? 'board-blocked' : ''} style={blocked ? { opacity: 0.55 } : undefined}>
              <NarrativeSection title="On Track" body={gen.data.narrative.onTrack} />
              <NarrativeSection title="Behind & Addressable" body={gen.data.narrative.behindAddressable} />
              <NarrativeSection title="H2 Plan" body={gen.data.narrative.h2Plan} />
              {gen.data.recommendations.length > 0 && (
                <>
                  <div className="panel-title" style={{ marginTop: 18, marginBottom: 8 }}>Prioritised Recommendations</div>
                  {gen.data.recommendations.map((r, i) => <Recommendation key={i} r={r} rank={i + 1} />)}
                </>
              )}
            </div>
            {blocked && <FlagLog flags={v.flags} />}
          </>
        )}
      </div>
    </div>
  )
}

function ValidationBadge({ v }) {
  if (!v) return null
  if (v.ok) {
    return (
      <div className="callout" style={{ marginTop: 0 }}>
        <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.target}</svg></div>
        <div className="callout-body">
          <strong style={{ color: 'var(--green, #1c8a4a)' }}>✓ Trace-to-data passed.</strong>{' '}
          All {v.claimCount} numeric claim{v.claimCount === 1 ? '' : 's'} across {v.checked} checked figure
          {v.checked === 1 ? '' : 's'} trace to a warehouse value. Safe to publish.
        </div>
      </div>
    )
  }
  return (
    <div className="callout amber" style={{ marginTop: 0 }}>
      <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
      <div className="callout-body">
        <strong>⚠ Publish blocked — {v.flags.length} untraceable figure{v.flags.length === 1 ? '' : 's'}.</strong>{' '}
        The narrative below is held for review: it contains numbers that don't match any warehouse value.
        Regenerate, or correct the flagged figures before publishing.
      </div>
    </div>
  )
}

function FlagLog({ flags }) {
  return (
    <div className="panel" style={{ marginTop: 16, marginBottom: 0 }}>
      <div className="panel-head">
        <div className="left"><div className="panel-title">Review flags — untraceable numbers</div></div>
        <span className="chip neu">{flags.length}</span>
      </div>
      <div className="panel-body">
        <div className="def-grid" style={{ gridTemplateColumns: '1fr', gap: 0 }}>
          {flags.map((f, i) => (
            <div className="def-row" key={i} style={{ alignItems: 'flex-start' }}>
              <span className="def-key"><code>{f.raw}</code> <em style={{ opacity: 0.6 }}>· {f.where}</em></span>
              <span className="tl red" style={{ maxWidth: '60%', textAlign: 'right' }}>“{f.context}”</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const NarrativeSection = ({ title, body }) =>
  body ? (
    <div style={{ marginBottom: 14 }}>
      <div className="panel-title" style={{ fontSize: 14, marginBottom: 4 }}>{title}</div>
      <p style={{ margin: 0, lineHeight: 1.55, color: 'var(--text-secondary, inherit)' }}>{body}</p>
    </div>
  ) : null

const Recommendation = ({ r, rank }) => (
  <div className="callout" style={{ marginBottom: 10 }}>
    <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.trend}</svg></div>
    <div className="callout-body">
      <strong>{rank}. {r.title}</strong>
      {r.estimatedImpact && <span className="chip blue" style={{ marginLeft: 8 }}>{r.estimatedImpact}</span>}
      {r.rationale && <div style={{ marginTop: 4, lineHeight: 1.5 }}>{r.rationale}</div>}
    </div>
  </div>
)
