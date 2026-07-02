import { useState } from 'react'
import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState, NotAvailablePanel } from '../States'
import { useEvents, useEventsDetail } from '../../hooks/useDashboardData'
import { num, gbp, isNA } from '../../data/format'

const ratePct = (r, d = 0) => (isNA(r) || r == null ? 'n/a' : `${(r * 100).toFixed(d)}%`)
const TYPE_LABEL = { Webinar: 'Webinars', Event: 'In-person events', 'Seminar / Conference': 'Seminars / Conferences' }
const typeLabel = (t) => TYPE_LABEL[t] || t || 'Untyped'
// Webinar attendance only applies when webinars are in view.
const showsWebinars = (type) => type === 'all' || type === 'Webinar'

// Events — webinar attendance (GoToWebinar → fact_event_daily) + the Salesforce
// campaign-attributed funnel for the Events & Webinars channel, sliceable by
// SF Campaign.Type (Webinar / Event / Seminar) via the Type filter. Webinar
// attendance is live; in-person attendance + owned/earned split aren't tracked
// (no SF field). campaign_type comes from the SF workflow (re-run to populate).
export default function Events() {
  const ev = useEvents()
  const det = useEventsDetail()
  const [type, setType] = useState('all')

  const types = det.data?.types ?? []

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Events <span className="accent">Performance</span></div>
          <div className="page-sub">
            Webinar attendance + Salesforce-attributed funnel · sliceable by event type · FY2026
          </div>
        </div>
        <QuarterPills />
      </div>

      <div className="callout" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          <strong>Attendance</strong> comes from GoToWebinar (webinars only, campaign-matched). The{' '}
          <strong>funnel &amp; per-campaign</strong> figures are Salesforce campaign-attributed (the Events &amp;
          Webinars channel), split by campaign type in Salesforce. In-person attendance + owned/earned split
          aren’t tracked (no Salesforce field for them yet). Region &amp; quarter scope everything; the Type filter scopes the funnel.
        </div>
      </div>

      {/* Type filter (driven by campaign_type) */}
      <div className="filters">
        <div className="filter">
          <span className="label">Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All event types</option>
            {types.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
          </select>
        </div>
        {det.data?.hasData && types.length === 0 && (
          <span className="info-pill">Types appear after the next Salesforce workflow run (campaign_type)</span>
        )}
      </div>

      {/* Webinar attendance (live) — shown when webinars are in view */}
      {showsWebinars(type) ? (
        <>
          {ev.isLoading && <Loading label="Loading webinar attendance…" />}
          {ev.isError && <ErrorState error={ev.error} />}
          {ev.data && !ev.data.hasData && <EmptyState message="No webinar attendance for this region / quarter yet." />}
          {ev.data && ev.data.hasData && <Attendance data={ev.data} />}
        </>
      ) : (
        <NotAvailablePanel
          title="Attendance — in-person"
          what="In-person event attendance"
          why="Only webinar (GoToWebinar) attendance is tracked. In-person events have no SF attendance field yet."
        />
      )}

      {/* Salesforce-attributed funnel + per-campaign drill-down (the earlier view), type-filtered */}
      <FunnelAndCampaigns det={det} type={type} />

      {/* MQL rate by event type (all types, for comparison) */}
      <MqlByType det={det} />

      {/* Owned / earned split not available */}
      <NotAvailablePanel
        title="Owned vs Earned event split"
        what="Owned (CWSI-run) vs Earned (sponsored/partner) split + per-event ROI / touchpoints"
        why="Salesforce has no owned-vs-earned field — we split by campaign type (Webinar / Event / Seminar) instead. Per-event ROI/touchpoints also need event spend + an attribution model."
      />
    </>
  )
}

// --- Webinar attendance (fact_event_daily) ---
function Attendance({ data }) {
  const { totals, webinars } = data
  return (
    <>
      <div className="kpis cols-4">
        <Kpi label="Registrations · scoped" val={num(totals.registrants)} />
        <Kpi label="Attendees · scoped" val={num(totals.attendees)} />
        <Kpi label="Attendance rate" val={ratePct(totals.attendanceRate)} sub="attendees ÷ registrants" />
        <Kpi label="Webinars · scoped" val={num(totals.webinars)} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Webinar Performance</div>
            <div className="panel-sub">Per webinar · registrants, attendees &amp; attendance rate · campaign-linked</div>
          </div>
          <span className="chip blue">{webinars.length} webinars</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Webinar</th><th>Date</th><th>Region</th>
                <th className="r">Registrants</th><th className="r">Attendees</th><th className="r">Att. rate</th>
                <th className="c">SF campaign</th>
              </tr>
            </thead>
            <tbody>
              {webinars.map((w) => (
                <tr key={w.eventKey}>
                  <td>{w.eventName}</td>
                  <td className="mono mono-d">{w.activityDate}</td>
                  <td>{w.regionCode === 'UNASSIGNED' ? 'Other' : w.regionCode}</td>
                  <td className="r mono">{num(w.registrants)}</td>
                  <td className="r mono">{num(w.attendees)}</td>
                  <td className="r mono">{ratePct(w.attendanceRate)}</td>
                  <td className="c">
                    {w.campaignKey
                      ? <span className="tl-bare g" title={`linked · ${w.campaignKey}`} />
                      : <span className="tl-bare a" title="no SF campaign matched" />}
                  </td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={3}>Total · {webinars.length} webinars</td>
                <td className="r mono">{num(totals.registrants)}</td>
                <td className="r mono">{num(totals.attendees)}</td>
                <td className="r mono">{ratePct(totals.attendanceRate)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// --- SF funnel + per-campaign drill-down (the earlier Events view), type-filtered ---
function FunnelAndCampaigns({ det, type }) {
  if (det.isLoading) return <Loading label="Loading event funnel…" />
  if (det.isError) return <ErrorState error={det.error} />
  if (!det.data || !det.data.hasData)
    return <EmptyState message="No Salesforce-attributed event campaigns for this region / quarter yet." />

  const all = det.data.campaigns
  const campaigns = type === 'all' ? all : all.filter((c) => c.campaignType === type)
  const t = campaigns.reduce(
    (a, c) => ({ leads: a.leads + c.leads, mql: a.mql + c.mql, sql: a.sql + c.sql, pipeline: a.pipeline + c.pipeline, won: a.won + c.closedWon }),
    { leads: 0, mql: 0, sql: 0, pipeline: 0, won: 0 },
  )
  const scope = type === 'all' ? 'all event types' : typeLabel(type)

  return (
    <>
      <div className="sec-divider" style={{ marginTop: 22 }}>
        <span className="label">Salesforce-attributed funnel · {scope}</span><div className="line" />
      </div>
      <div className="kpis cols-4">
        <Kpi label="Leads · scoped" val={num(t.leads)} />
        <Kpi label="MQLs · scoped" val={num(t.mql)} />
        <Kpi label="SQLs · scoped" val={num(t.sql)} />
        <Kpi label="Pipeline £ · scoped" val={gbp(t.pipeline)} sub={`${gbp(t.won)} closed-won`} />
      </div>

      <div className="callout amber" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div className="callout-body">
          <strong>A note on event names &amp; the year in them.</strong> Some Salesforce event campaigns are
          named after the date the event was held (e.g. <em>“25.09.2025 …”</em>, <em>“… Event 2024”</em>) but
          stay open as attendees keep progressing. <strong>The year in the name is just a label, not the period
          of the data.</strong> Every figure here is the campaign’s <strong>real 2026 activity only</strong>{' '}
          (Q1–Q2 2026) — e.g. an attendee from a 2024/2025 event whose opportunity reached SQL in 2026. Earlier-year
          activity for the same campaign is excluded by the 2026 scope, so an older-named event can correctly show
          2026 numbers here.
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Event Campaigns — per-campaign breakdown</div>
            <div className="panel-sub">Salesforce campaign-attributed · {scope}</div>
          </div>
          <span className="chip blue">{campaigns.length} campaigns</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Campaign</th><th>Type</th>
                <th className="r">Leads</th><th className="r">MQLs</th><th className="r">SQLs</th>
                <th className="r">Pipeline £</th><th className="r">Closed-Won £</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.campaignKey}>
                  <td title={c.campaignKey}>{c.campaignName}</td>
                  <td className="mono mono-d">{typeLabel(c.campaignType)}</td>
                  <td className="r mono">{num(c.leads)}</td>
                  <td className="r mono">{num(c.mql)}</td>
                  <td className="r mono">{num(c.sql)}</td>
                  <td className="r mono">{gbp(c.pipeline)}</td>
                  <td className="r mono mono-d">{gbp(c.closedWon)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={2}>Total · {campaigns.length} campaigns</td>
                <td className="r mono">{num(t.leads)}</td>
                <td className="r mono">{num(t.mql)}</td>
                <td className="r mono">{num(t.sql)}</td>
                <td className="r mono">{gbp(t.pipeline)}</td>
                <td className="r mono mono-d">{gbp(t.won)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// --- MQL rate by event type (all types, comparison) ---
function MqlByType({ det }) {
  if (!det.data?.hasData) return null
  const byType = det.data.byType
  const maxRate = Math.max(0.01, ...byType.map((t) => (isNA(t.mqlRate) ? 0 : t.mqlRate)))
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">MQL Rate by Event Type</div>
          <div className="panel-sub">Registrant → MQL conversion (MQLs ÷ leads) · by Salesforce campaign type</div>
        </div>
        <span className="chip blue">{byType.length} types</span>
      </div>
      <div className="panel-body">
        <div className="bar-list">
          {byType.map((t) => (
            <div className="bar-row" key={t.type}>
              <div className="bar-label" title={`${num(t.mql)} MQLs ÷ ${num(t.leads)} leads`}>
                {typeLabel(t.type === 'Untyped' ? null : t.type)} · {num(t.leads)} leads
              </div>
              <div className="bar-track">
                <div className="bar-fill bf-blue" style={{ width: `${(isNA(t.mqlRate) ? 0 : t.mqlRate / maxRate) * 100}%` }} />
              </div>
              <div className="bar-val">{ratePct(t.mqlRate, 1)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const Kpi = ({ label, val, sub }) => (
  <div className="kpi">
    <div className="kpi-label">{label}</div>
    <div className="kpi-val">{val}</div>
    {sub ? <div className="kpi-sub"><span className="kpi-target">{sub}</span></div> : null}
  </div>
)
