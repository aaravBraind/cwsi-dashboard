import { useState } from 'react'
import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import {
  useKpiTracker,
  useWebTraffic,
  useEventTypeFunnel,
  useEvents,
  useKpiTargets,
  useUpdateKpiTarget,
} from '../../hooks/useDashboardData'
import { useFilters } from '../../filters/FilterContext'
import { eur, num } from '../../data/format'
import { buildKpiRegisterRows, periodOf, scopeLabel, achievement } from '../../data/kpiRegister'
import { I } from '../icons'
import Explain from '../Explain'

// Register row key → methodology-registry id (client "how we got this" eye-button).
const REGISTER_EXPLAIN = {
  totalLeads: 'leads', totalMqls: 'mql', totalSqls: 'sql',
  closedWonCount: 'closedWon', closedWonValue: 'closedWon',
  influencedPipeline: 'pipeline', influencedMargin: 'margin',
  retainedContracts: 'retention',
  leadToMql: 'conversion', mqlToSql: 'conversion', sqlToWon: 'conversion',
  visitorToMql: 'conversion', mqlToSqlEvents: 'conversion',
  totalOrganicTraffic: 'organicTraffic', attendanceRate: 'webinarAttendance',
}

// The KPI register, in the agreed category order. `live` rows are computed from
// v_fact_enriched (funnel) + GA4 + GoToWebinar; every other KPI depends on a
// measure not in the store yet and renders an explicit n/a (never a fabricated
// number).
// 22 Jun: TARGETS moved to the editable `kpi_targets` DB table (seeded from the
// thresholds.js placeholders). The Target column is inline-editable per active
// quarter; on save the %-of-target + status light recompute. Actuals stay live;
// only the target side is a (provisional) placeholder until the client edits it.

const rate = (x) => `${(Number(x) * 100).toFixed(1)}%`

// Format a target value by its declared unit.
function fmtByUnit(unit, t) {
  if (t == null) return null
  if (unit === 'gbp') return eur(t)
  if (unit === 'rate') return rate(t)
  if (unit === 'x') return `${Number(t).toFixed(1)}×`
  return num(t)
}

export default function KpiTracker() {
  const q = useKpiTracker()
  const web = useWebTraffic()
  const events = useEventTypeFunnel()
  const att = useEvents() // GoToWebinar attendance — webinar actual is real
  const targetsQ = useKpiTargets()
  const { filters } = useFilters()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">KPI <span className="accent">Tracker</span></div>
          <div className="page-sub">Quarterly KPIs · live actuals where available · targets editable &amp; provisional · FY2026</div>
        </div>
        <QuarterPills />
      </div>

      {/* Marketing Budget moved to its own page (Budget.jsx) per Margot, Jul 2026. */}
      {q.isLoading && <Loading />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && <EmptyState />}
      {q.data && q.data.hasData && (
        <Register
          f={q.data.funnel}
          web={web.data?.totals}
          events={events.data}
          attendance={att.data?.hasData ? att.data.totals : null}
          retention={q.data.retention}
          quarter={filters.quarter}
          targets={targetsQ.data || {}}
        />
      )}
    </>
  )
}

// Inline-editable target cell. Reads/writes the active-quarter column of the
// kpi_targets row. Click → input (rates entered as %, money as a plain number);
// Enter/blur saves, Esc cancels. KPIs with no placeholder row show "—".
function TargetCell({ kpiKey, row, period, scope }) {
  const upd = useUpdateKpiTarget()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (!kpiKey || !row) return <span className="tgt-none">—</span>

  const unit = row.unit
  const t = row[period]

  const begin = () => {
    setDraft(t == null ? '' : unit === 'rate' ? String(+(Number(t) * 100).toFixed(2)) : String(t))
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    const raw = draft.trim().replace(/[,£€×%\s]/g, '')
    let value = raw === '' ? null : Number(raw)
    if (raw !== '' && Number.isNaN(value)) return // ignore garbage, keep old
    if (value != null && unit === 'rate') value = value / 100
    const same = (t == null && value == null) || (t != null && value != null && Math.abs(Number(t) - value) < 1e-9)
    if (!same) upd.mutate({ kpiKey, period, value })
  }

  if (editing)
    return (
      <span className="tgt-edit">
        {unit === 'gbp' && <span className="aff">€</span>}
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
        {unit === 'rate' && <span className="aff">%</span>}
        {unit === 'x' && <span className="aff">×</span>}
      </span>
    )

  const empty = t == null
  return (
    <button
      type="button"
      onClick={begin}
      className={`tgt-btn${empty ? ' empty' : ''}${upd.isPending ? ' saving' : ''}`}
      title="Edit target — provisional placeholder, saved automatically"
    >
      <span>{empty ? 'Set target' : fmtByUnit(unit, t)}</span>
      <svg className="icon tgt-pen" viewBox="0 0 24 24">{I.pencil}</svg>
    </button>
  )
}

function Register({ f, web, events, attendance, retention, quarter, targets }) {
  const rows = buildKpiRegisterRows({ funnel: f, retention, web, events, attendance })

  const liveCount = rows.filter((r) => r.t === 'live').length
  const kpiCount = rows.filter((r) => r.t !== 'cat').length
  const scope = scopeLabel(quarter)
  const period = periodOf(quarter)

  // Status pill (dot + %-of-target) for a row.
  const statusCell = (r) => {
    const row = targets[r.key]
    const a = r.t === 'live' && r.key ? achievement(row, period, r.num) : null
    const cls = a == null ? 'neu' : a >= 0.95 ? 'green' : a >= 0.8 ? 'amber' : 'red'
    return (
      <span className={`tl ${cls}`}>
        <span className="tl-dot" />{a == null ? '—' : `${(a * 100).toFixed(0)}%`}
      </span>
    )
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Full KPI Register · FY2026</div>
          <div className="panel-sub">{liveCount} of {kpiCount} live (Salesforce + GA4) · n/a = data not available yet · targets editable &amp; provisional</div>
        </div>
        <span className="chip blue">{scope} scope</span>
      </div>
      <div className="kpi-banner">
        <svg className="icon b-icn" viewBox="0 0 24 24">{I.pencil}</svg>
        <div>
          <strong>Targets are provisional &amp; editable.</strong> Actuals are live from the source data; each
          <strong> Target</strong> is a placeholder — click it to set the real number (it saves automatically,
          and %-of-target + status recompute). Edits apply to the <strong>active quarter</strong> ({scope}); switch the
          quarter pills to set the others.
        </div>
      </div>
      <div className="panel-body no-pad">
        <div className="tbl-scroll">
          <table className="kpi-reg">
            <thead>
              <tr>
                <th>Metric</th>
                <th className="r">Actual · {scope}</th>
                <th className="r">Target · {scope}</th>
                <th className="c">vs Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                if (r.t === 'cat')
                  return <tr className="cat" key={i}><td colSpan={4}>{r.label}</td></tr>
                return (
                  <tr className="kpi-row" key={i}>
                    <td>
                      <div className="metric-name">{r.label}{REGISTER_EXPLAIN[r.key] && <Explain id={REGISTER_EXPLAIN[r.key]} align="left" />}</div>
                      {r.ctx && <div className="metric-ctx">{r.ctx}</div>}
                    </td>
                    <td className="r">
                      <span className={`metric-actual${r.t === 'na' ? ' na' : ''}`}>
                        {r.t === 'na' ? 'not available yet' : r.val}
                      </span>
                    </td>
                    <td className="r"><TargetCell kpiKey={r.key} row={targets[r.key]} period={period} scope={scope} /></td>
                    <td className="c">{statusCell(r)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
