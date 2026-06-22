import QuarterPills from '../QuarterPills'
import { LoadingSkeleton, Loading, ErrorState, EmptyState, NotAvailablePanel, NotAvailable } from '../States'
import { useOverview, useEvents } from '../../hooks/useDashboardData'
import { useFilters } from '../../filters/FilterContext'
import { gbp, num, pct, ratio, isNA } from '../../data/format'
import { targetFor, kpiLight, pctOfTarget } from '../../data/thresholds'
import { I } from '../icons'
import MarketingBudget from '../MarketingBudget'

// Status lights + %-of-target follow the ACTIVE quarter pill (Q1..Q4 → that
// quarter's placeholder target; YTD → the FY target), mirroring the KPI Tracker
// via the same helpers. Targets are PROVISIONAL placeholders (client kpi_targets
// register pending) and flagged as such; actuals are live/real.
const scopeLabel = (q) => (!q || q === 'ytd' ? 'FY' : String(q).toUpperCase())
// "% of <scope>" for a KPI vs its quarter-scoped placeholder target.
const pctOf = (v, key, q) => {
  const f = pctOfTarget(v, key, q)
  return f == null ? 'n/a' : `${(f * 100).toFixed(0)}% of ${scopeLabel(q)}`
}
// "<scope> tgt: <value> · provisional" for the tile sub-line.
const tgtSub = (key, q, fmt) => {
  const t = targetFor(key, q)
  return t == null ? 'target pending (provisional)' : `${scopeLabel(q)} tgt: ${fmt(t)} · provisional`
}

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
  const { funnel, byChannel, retention = {} } = data
  const { filters } = useFilters()
  const qtr = filters.quarter // 'q1'..'q4' | 'ytd' — targets resolve to this scope
  const maxPipe = Math.max(1, ...byChannel.map((c) => c.pipeline))
  // Webinar attendance (real, scoped) — drives the Events panel + the health row.
  const ev = useEvents()
  const evt = ev.data?.hasData ? ev.data.totals : null
  // Rate actuals (fractions) for status vs rate targets.
  const mqlToSqlV = funnel.mql ? funnel.sql / funnel.mql : null
  const attendanceV = evt && evt.registrants ? evt.attendees / evt.registrants : null

  return (
    <>
      {/* 1. Top-line summary — target + light follow the active quarter pill */}
      <div className="kpis cols-3">
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.pound}</svg></div>
            <span className={`tl ${kpiLight(funnel.pipeline, 'influencedPipeline', qtr)}`}>
              <span className="tl-dot" />{pctOf(funnel.pipeline, 'influencedPipeline', qtr)}
            </span>
          </div>
          <div className="kpi-label">Influenced Pipeline · scoped</div>
          <div className="kpi-val">{gbp(funnel.pipeline)}</div>
          <div className="kpi-sub">
            <span className="kpi-target">{tgtSub('influencedPipeline', qtr, gbp)}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn green"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.trend}</svg></div>
            <span className={`tl ${kpiLight(funnel.closedWon, 'influencedMargin', qtr)}`}>
              <span className="tl-dot" />{pctOf(funnel.closedWon, 'influencedMargin', qtr)}
            </span>
          </div>
          <div className="kpi-label">Closed-Won Value · scoped</div>
          <div className="kpi-val">{gbp(funnel.closedWon)}</div>
          <div className="kpi-sub">
            <span className="kpi-target">{tgtSub('influencedMargin', qtr, gbp)}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn amber"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.users}</svg></div>
            <span className={`tl ${retention.hasData ? kpiLight(retention.retainedCount, 'retainedContracts', qtr) : 'neu'}`}>
              <span className="tl-dot" />{retention.hasData ? pctOf(retention.retainedCount, 'retainedContracts', qtr) : 'n/a'}
            </span>
          </div>
          <div className="kpi-label">Retained Contracts · scoped</div>
          <div className="kpi-val">{retention.hasData ? num(retention.retainedCount) : '—'}</div>
          <div className="kpi-sub">
            {retention.hasData ? (
              <>
                <span className="kpi-target">{gbp(retention.retainedValue)} won · {num(retention.openCount)} open</span>
                {retention.expansionCount > 0 && (
                  <span className="kpi-target" style={{ display: 'block' }}>
                    + Expansion {num(retention.expansionCount)} ({gbp(retention.expansionValue)}) · Upsell / Cross-Sell
                  </span>
                )}
                <span className="kpi-target" style={{ display: 'block', opacity: 0.65 }}>
                  {tgtSub('retainedContracts', qtr, num)} · whole-book scale; scope (Paul) pending
                </span>
              </>
            ) : (
              <NotAvailable what="Retained contracts" why="No won-renewal opportunities in this scope" />
            )}
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

      {/* 4. Webinar attendance (real, GTW → fact_event_daily) + quarter health */}
      <div className="cols-2-3">
        <WebinarAttendance ev={ev} />
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="panel-head">
            <div className="left">
              <div className="panel-title">Quarter Health</div>
              <div className="panel-sub">Status vs the active-quarter target · provisional placeholders (client-gated)</div>
            </div>
          </div>
          <div className="panel-body">
            <div className="def-grid" style={{ gridTemplateColumns: '1fr', gap: 0 }}>
              <HealthRow label="Influenced pipeline" cls={kpiLight(funnel.pipeline, 'influencedPipeline', qtr)} val={pctOf(funnel.pipeline, 'influencedPipeline', qtr)} />
              <HealthRow label="Closed-won value" cls={kpiLight(funnel.closedWon, 'influencedMargin', qtr)} val={gbp(funnel.closedWon)} />
              <HealthRow label="Lead → MQL rate" cls="neu" val={pct(funnel.mql, funnel.leads)} />
              <HealthRow label="MQL → SQL rate" cls={kpiLight(mqlToSqlV, 'mqlToSql', qtr)} val={pct(funnel.sql, funnel.mql)} />
              <HealthRow label="CPL average" cls="neu" val="n/a" />
              <HealthRow label="Event attendance" cls={evt ? kpiLight(attendanceV, 'attendanceRate', qtr) : 'neu'} val={evt ? pct(evt.attendees, evt.registrants, 0) : 'n/a'} />
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

// Webinar attendance — real GTW data (fact_event_daily), styled like the mockup's
// Events Mix panel (seg-bar + legend + per-item bar-list). Owned/earned events +
// per-type pipeline aren't tracked, so this shows webinar registration→attendance
// only, and links out to the Events page for the per-webinar detail + SF funnel.
function WebinarAttendance({ ev }) {
  if (ev.isLoading)
    return <div className="panel" style={{ marginBottom: 0 }}><div className="panel-body"><Loading label="Loading webinar attendance…" /></div></div>
  if (ev.isError || !ev.data?.hasData)
    return (
      <NotAvailablePanel
        title="Webinar Attendance"
        what="Webinar registrations & attendance"
        why="No webinar attendance for this region / quarter yet — run the GoToWebinar ingestion."
      />
    )
  const { totals, webinars } = ev.data
  const noShow = Math.max(0, totals.registrants - totals.attendees)
  const attPct = pct(totals.attendees, totals.registrants, 0)
  const maxRate = Math.max(0.01, ...webinars.map((w) => (isNA(w.attendanceRate) ? 0 : w.attendanceRate)))
  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Webinar Attendance</div>
          <div className="panel-sub">Registrations → attendance · GoToWebinar · scoped</div>
        </div>
        <span className="chip blue">{totals.webinars} webinars</span>
      </div>
      <div className="panel-body">
        <div className="seg-bar">
          <div className="web" style={{ flex: Math.max(1, totals.attendees) }}>{attPct}</div>
          <div className="own" style={{ flex: Math.max(1, noShow) }}>{noShow ? 'no-show' : ''}</div>
        </div>
        <div className="seg-legend">
          <div className="leg"><span className="dot" style={{ background: 'var(--cwsi-blue)' }} />Attended · {num(totals.attendees)}</div>
          <div className="leg"><span className="dot" style={{ background: '#5fa1ff' }} />Registered · {num(totals.registrants)}</div>
        </div>
        <div className="bar-list" style={{ marginTop: 18 }}>
          {webinars.map((w) => (
            <div className="bar-row" key={w.eventKey}>
              <div className="bar-label" title={w.eventName}>{w.eventName}</div>
              <div className="bar-track">
                <div className="bar-fill bf-blue" style={{ width: `${(isNA(w.attendanceRate) ? 0 : w.attendanceRate / maxRate) * 100}%` }} />
              </div>
              <div className="bar-val">{isNA(w.attendanceRate) ? 'n/a' : `${(w.attendanceRate * 100).toFixed(0)}%`}</div>
            </div>
          ))}
        </div>
        <div className="callout" style={{ marginTop: 16, marginBottom: 0 }}>
          <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
          <div className="callout-body">
            Webinars only (GoToWebinar, campaign-linked). Owned / earned in-person events and
            per-event pipeline aren’t tracked yet — see the <strong>Events</strong> page for per-webinar detail + the SF funnel.
          </div>
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

const HealthRow = ({ label, cls, val }) => (
  <div className="def-row">
    <span className="def-key">{label}</span>
    <span className={`tl ${cls}`}><span className="tl-dot" />{val}</span>
  </div>
)
