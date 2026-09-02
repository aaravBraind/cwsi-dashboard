import { useState } from 'react'
import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import {
  useKpiTracker,
  useWebTraffic,
  useEventTypeFunnel,
  useEvents,
  useEventAttendance,
  useKpiTargets,
  useUpdateKpiTarget,
  useOutreach,
  useOutreachAttributedMeetings,
  useLinkedInSnapshot,
  useAeEmailEngagement,
  useEmailReport,
  useChannel,
  useLinkedInPage,
  useKpiManual,
  useUpdateKpiManual,
  useOrganicTrafficGrowth,
} from '../../hooks/useDashboardData'
import { useFilters } from '../../filters/FilterContext'
import { eur, num } from '../../data/format'
import { buildKpiRegisterRows, periodOf, scopeLabel, achievement } from '../../data/kpiRegister'
import { I } from '../icons'
import Explain from '../Explain'

// Register row key → methodology-registry id (client "how we got this" eye-button).
const REGISTER_EXPLAIN = {
  totalLeads: 'leads', totalMqls: 'mql', totalSqls: 'sql',
  createdOpportunities: 'createdOpps',
  closedWonCount: 'closedWon', closedWonValue: 'closedWon',
  influencedPipeline: 'pipeline', influencedMargin: 'margin',
  leadToMql: 'conversion', mqlToSql: 'conversion', sqlToWon: 'conversion',
  visitorToMql: 'conversion', mqlToSqlEvents: 'conversion',
  totalOrganicTraffic: 'organicTraffic', attendanceRate: 'webinarAttendance',
  outreachProspects: 'outreachProspects', outreachOpenRate: 'outreachOpenRate',
  outreachReplyRate: 'outreachReplyRate', outreachMeetings: 'outreachMeetings',
  outreachCreatedOpps: 'outreachOpps', outreachClosedWon: 'outreachOpps',
  outreachPipeline: 'outreachOpps',
  // W9 — the newly-wired rows
  impressions: 'linkedinSpend', cpc: 'linkedinSpend', cpm: 'linkedinSpend',
  costPerLead: 'linkedinRoi', returnOnSpend: 'linkedinRoi',
  overallConversion: 'conversion', totalConversions: 'organicTraffic',
  emailOpenRate: 'aeOpenRate', emailCtr: 'aeCtr', unsubscribeRate: 'aeUnsubRate',
  // Post-QA review (17 Aug) — the per-section funnel rows
  clicks: 'linkedinSpend', paidCtr: 'linkedinSpend',
  organicTrafficGrowth: 'organicTraffic',
  emailMqlToSql: 'conversion', emailSqlToWon: 'conversion', emailClosedOpps: 'closedWon',
  emailInfluencedPipeline: 'pipeline', emailInfluencedMargin: 'margin',
  webTotalLeads: 'mql', webMqlToSql: 'conversion', webSqlToWon: 'conversion',
  webClosedOpps: 'closedWon', webInfluencedPipeline: 'pipeline', webInfluencedMargin: 'margin',
  eventsSqlToWon: 'conversion', eventsClosedOpps: 'closedWon',
  eventsInfluencedPipeline: 'pipeline', eventsInfluencedMargin: 'margin',
  outreachCtr: 'outreachOpenRate', outreachUnsubRate: 'outreachOpenRate',
  outreachMqls: 'outreachMeetings',
}

// The KPI register, in the agreed category order. `live` rows are computed from
// v_fact_enriched (funnel) + GA4 + GoToWebinar; every other KPI depends on a
// measure not in the store yet and renders an explicit n/a (never a fabricated
// number).
// 22 Jun: TARGETS moved to the editable `kpi_targets` DB table (seeded from the
// thresholds.js placeholders). The Target column is inline-editable per active
// quarter; on save the %-of-target + status light recompute.
//
// 1 Sep 2026: CWSI's fractional CMO supplied the FY26 quarterly reforecast, so 29 KPIs
// now carry CLIENT targets rather than our placeholders (docs/kpi/). Provenance is a
// column on the row (`source`), not a guess: a client target reads plainly, a remaining
// placeholder is marked as such, and the reforecast rationale is on the cell as a
// tooltip so a changed benchmark can be explained without leaving the page.

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
  const outreach = useOutreach() // K1: prospects/open/reply (lifetime snapshot)
  const outreachMtg = useOutreachAttributedMeetings() // K1: meetings/opps (current view)
  const linkedin = useLinkedInSnapshot() // W9: paid-media rows (impressions/CPC/CPM/CPL/return on spend)
  // LinkedIn company-PAGE analytics (organic social) — separate feed from LinkedIn Ads above.
  const linkedinPage = useLinkedInPage().data
  const aeEmail = useAeEmailEngagement() // W9: email open/CTR/unsub — the four named campaigns
  const eventAtt = useEventAttendance() // W9: in-person attendee lists, combined with GoToWebinar
  // Post-QA review (17 Aug): channel-scoped funnels for Margot's per-section metric lists —
  // the same scopes their pages use, so the register can never disagree with a page.
  const emailFunnel = useEmailReport() // the four named campaigns
  const webFunnel = useChannel('Organic SEO', 'all', ['Content/White Paper'])
  const eventsFunnel = useChannel('Events & Webinars')
  const targetsQ = useKpiTargets()
  // Reforecast additions (Sep 2026): the hand-entered KPIs, and organic traffic growth
  // measured against the prior quarter.
  const manualQ = useKpiManual()
  const organicGrowth = useOrganicTrafficGrowth()
  const { filters } = useFilters()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">KPI <span className="accent">Tracker</span></div>
          <div className="page-sub">Quarterly KPIs · live actuals where available · targets from the CWSI FY26 reforecast, editable · FY2026</div>
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
          outreach={outreach.data}
          outreachMeetings={outreachMtg.data}
          linkedin={linkedin.data}
          linkedinPage={linkedinPage}
          aeEmail={aeEmail.data}
          eventAttendance={eventAtt.data?.hasData ? eventAtt.data : null}
          emailFunnel={emailFunnel.data?.totals}
          webFunnel={webFunnel.data?.totals}
          eventsFunnel={eventsFunnel.data?.totals}
          quarter={filters.quarter}
          targets={targetsQ.data || {}}
          manual={manualQ.data || {}}
          organicGrowth={organicGrowth.data}
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
  // Where this number came from, and — for a reforecast target — why it was changed.
  const provisional = row.source !== 'client'
  const why = row.note
    ? `${row.note}\n\nClick to edit — saves automatically.`
    : provisional
      ? 'BrainD provisional placeholder — no client figure supplied yet. Click to edit; saves automatically.'
      : 'Client-supplied target. Click to edit — saves automatically.'
  return (
    <button
      type="button"
      onClick={begin}
      className={`tgt-btn${empty ? ' empty' : ''}${upd.isPending ? ' saving' : ''}`}
      title={why}
    >
      <span>{empty ? 'Set target' : fmtByUnit(unit, t)}</span>
      {!empty && provisional && (
        <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.6, fontWeight: 400 }} aria-label="provisional">prov.</span>
      )}
      <svg className="icon tgt-pen" viewBox="0 0 24 24">{I.pencil}</svg>
    </button>
  )
}

// The Actual cell for a manually-maintained KPI. Same click-to-edit interaction as the
// target cell, but it writes the ACTUAL — these six measures have no system of record, so
// a person is the source. Text measures (RAG, trend) take free text; the rest take a number.
function ManualCell({ kpiKey, kind, value, period }) {
  const upd = useUpdateKpiManual()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const begin = () => {
    setDraft(value == null ? '' : String(value).replace(/,/g, ''))
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    const raw = draft.trim()
    if ((value == null && raw === '') || raw === String(value ?? '')) return // unchanged
    upd.mutate({ kpiKey, period, field: 'value', kind, value: raw })
  }

  if (editing)
    return (
      <span className="tgt-edit">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder={kind === 'text' ? 'e.g. GREEN' : '0'}
        />
      </span>
    )

  const empty = value == null || value === ''
  return (
    <button
      type="button"
      onClick={begin}
      className={`tgt-btn${empty ? ' empty' : ''}${upd.isPending ? ' saving' : ''}`}
      title="No system records this measure — enter it by hand. Saves automatically."
    >
      <span>{empty ? 'Enter value' : value}</span>
      <svg className="icon tgt-pen" viewBox="0 0 24 24">{I.pencil}</svg>
    </button>
  )
}

function Register({ f, web, events, attendance, outreach, outreachMeetings, linkedin, linkedinPage, aeEmail, eventAttendance, emailFunnel, webFunnel, eventsFunnel, quarter, targets, manual, organicGrowth }) {
  const rows = buildKpiRegisterRows({
    funnel: f, web, events, attendance, outreach, outreachMeetings, linkedin, linkedinPage,
    aeEmail, eventAttendance, emailFunnel, webFunnel, eventsFunnel,
    manual, organicGrowth, period: periodOf(quarter),
  })

  const liveCount = rows.filter((r) => r.t === 'live').length
  const kpiCount = rows.filter((r) => r.t !== 'cat').length
  const scope = scopeLabel(quarter)
  const period = periodOf(quarter)
  // How many of the visible KPIs carry a client target for the active period, so the
  // page states its own provenance rather than claiming every target is provisional
  // (they no longer are) or that all are agreed (they are not).
  const manualCount = rows.filter((r) => r.t === 'manual').length
  const withTarget = rows.filter((r) => r.t !== 'cat' && targets[r.key]?.[period] != null)
  const clientCount = withTarget.filter((r) => targets[r.key].source === 'client').length
  const provisionalCount = withTarget.length - clientCount

  // Status pill (dot + %-of-target) for a row.
  const statusCell = (r) => {
    const row = targets[r.key]
    // A manual KPI carries its own target on the row (kpi_manual), so it is scored the
    // same way as a live one once someone has entered a figure. Text measures (RAG,
    // trend) have no ratio to compute and stay blank.
    const a =
      r.t === 'manual'
        ? r.kind === 'num' && r.num != null && r.target ? r.num / Number(r.target) : null
        : r.t === 'live' && r.key ? achievement(row, period, r.num) : null
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
          <div className="panel-sub">
            {liveCount} of {kpiCount} live (Salesforce + GA4)
            {manualCount > 0 && ` · ${manualCount} entered by hand`} · n/a = data not available yet ·{' '}
            {clientCount} agreed target{clientCount === 1 ? '' : 's'} this {scope === 'FY' ? 'year' : 'quarter'}
            {provisionalCount > 0 && `, ${provisionalCount} still provisional`}
          </div>
        </div>
        <span className="chip blue">{scope} scope</span>
      </div>
      <div className="kpi-banner">
        <svg className="icon b-icn" viewBox="0 0 24 24">{I.pencil}</svg>
        <div>
          <strong>Targets now come from the CWSI FY26 quarterly reforecast.</strong> Actuals are live from the
          source data. Hover any <strong>Target</strong> to see where it came from and, where a benchmark was
          changed, the reason given. Targets still marked <strong>prov.</strong> are ours, awaiting a client figure.
          Every target stays editable — click it to change the number (it saves automatically, %-of-target and status
          recompute, and the row is then marked as agreed). Edits apply to the <strong>active quarter</strong>{' '}
          ({scope}); switch the quarter pills to set the others.
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
                      {r.t === 'manual' ? (
                        <ManualCell kpiKey={r.key} kind={r.kind} value={r.val} period={period} />
                      ) : (
                        <span className={`metric-actual${r.t === 'na' ? ' na' : ''}`}>
                          {r.t === 'na' ? 'not available yet' : r.val}
                        </span>
                      )}
                    </td>
                    <td className="r">
                      {r.t === 'manual' ? (
                        <span className="metric-actual">
                          {r.target == null || r.target === ''
                            ? '—'
                            : r.kind === 'text'
                              ? String(r.target)
                              : fmtByUnit(r.key === 'mdfClaimRate' ? 'rate' : 'count', r.target)}
                        </span>
                      ) : (
                        <TargetCell kpiKey={r.key} row={targets[r.key]} period={period} scope={scope} />
                      )}
                    </td>
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
