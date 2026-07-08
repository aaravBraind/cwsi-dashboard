import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState, NotAvailablePanel } from '../States'
import { useEvents, useEventsDetail, useCampaignOverrides } from '../../hooks/useDashboardData'
import { num, eur, isNA } from '../../data/format'
import Explain from '../Explain'
import EditableName from '../EditableName'
import CurrentVsOngoing from '../CurrentVsOngoing'

const ratePct = (r, d = 0) => (isNA(r) || r == null ? 'n/a' : `${(r * 100).toFixed(d)}%`)
const TYPE_LABEL = { Webinar: 'Webinars', Event: 'In-person events', 'Seminar / Conference': 'Seminars / Conferences' }
const typeLabel = (t) => TYPE_LABEL[t] || t || 'Untyped'

// Sum the SF-attributed funnel across a set of campaigns.
const sumFunnel = (cs) =>
  cs.reduce(
    (a, c) => ({ leads: a.leads + c.leads, mql: a.mql + c.mql, sql: a.sql + c.sql, createdOpps: a.createdOpps + (c.createdOpps || 0), pipeline: a.pipeline + c.pipeline, won: a.won + c.closedWon }),
    { leads: 0, mql: 0, sql: 0, createdOpps: 0, pipeline: 0, won: 0 },
  )

// Events — split into two sections the way the client reviews them:
//   • Webinars — GoToWebinar attendance (fact_event_daily) + the Salesforce
//     campaign-attributed funnel for Webinar campaigns.
//   • In-person events — the per-campaign Salesforce funnel for non-webinar
//     campaigns; in-person attendance isn't tracked (no SF field yet).
// Region & quarter scope everything. (Owned-vs-earned + per-event ROI need new SF
// fields; Created-Opps as a distinct metric lands with the funnel-definition work.)
export default function Events() {
  const ev = useEvents()
  const det = useEventsDetail()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Events <span className="accent">Performance</span></div>
          <div className="page-sub">Webinars + in-person events · Salesforce-attributed funnel · FY2026</div>
        </div>
        <QuarterPills />
      </div>

      <div className="callout" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          <strong>Webinar attendance</strong> comes from GoToWebinar (campaign-matched). The{' '}
          <strong>funnel &amp; per-campaign</strong> figures are Salesforce campaign-attributed, split by campaign
          type into <strong>Webinars</strong> and <strong>In-person events</strong>. In-person attendance and the
          owned/earned split aren’t tracked yet (no Salesforce field). Region &amp; quarter scope every figure.
        </div>
      </div>

      {/* ---- Webinars ---- */}
      <div className="sec-divider"><span className="label">Webinars</span><div className="line" /></div>
      <Webinars ev={ev} det={det} />

      {/* ---- In-person events ---- */}
      <div className="sec-divider" style={{ marginTop: 22 }}><span className="label">In-person events</span><div className="line" /></div>
      <InPerson det={det} />

      {/* ---- Current-quarter events vs ongoing impact of past events (EV5) ---- */}
      <div className="sec-divider" style={{ marginTop: 22 }}><span className="label">Current vs ongoing impact</span><div className="line" /></div>
      <CurrentVsOngoing channel="Events & Webinars" label="event" />

      {/* Owned / earned split not available */}
      <NotAvailablePanel
        title="Owned vs Earned event split"
        what="Owned (CWSI-run) vs Earned (sponsored/partner) split + per-event ROI / touchpoints"
        why="Salesforce has no owned-vs-earned field yet — it needs a new dropdown field or a naming convention. Per-event ROI/touchpoints also need event spend + an attribution model."
      />
    </>
  )
}

// ---- Webinars: GoToWebinar attendance + Salesforce Webinar-campaign funnel ----
function Webinars({ ev, det }) {
  const webinarCampaigns = (det.data?.campaigns || []).filter((c) => c.campaignType === 'Webinar')
  const t = sumFunnel(webinarCampaigns)
  return (
    <>
      {ev.isLoading && <Loading label="Loading webinar attendance…" />}
      {ev.isError && <ErrorState error={ev.error} />}
      {ev.data && !ev.data.hasData && <EmptyState message="No webinar attendance for this region / quarter yet." />}
      {ev.data && ev.data.hasData && <Attendance data={ev.data} />}

      {/* Salesforce-attributed funnel for Webinar campaigns */}
      {det.data?.hasData && (
        <div className="kpis cols-5" style={{ marginTop: 4 }}>
          <Kpi label="Leads · current view" val={num(t.leads)} explainId="leads" />
          <Kpi label="MQLs · current view" val={num(t.mql)} explainId="mql" />
          <Kpi label="SQLs · current view" val={num(t.sql)} explainId="sql" />
          <Kpi label="Created Opps · current view" val={num(t.createdOpps)} explainId="createdOpps" />
          <Kpi label="Pipeline € · current view" val={eur(t.pipeline)} sub={`${eur(t.won)} closed-won`} explainId="pipeline" />
        </div>
      )}
    </>
  )
}

// --- Webinar attendance (fact_event_daily) ---
function Attendance({ data }) {
  const { totals, webinars } = data
  return (
    <>
      <div className="kpis cols-4">
        <Kpi label="Registrations · current view" val={num(totals.registrants)} />
        <Kpi label="Attendees · current view" val={num(totals.attendees)} />
        <Kpi label="Attendance rate" val={ratePct(totals.attendanceRate)} sub="attendees ÷ registrants" explainId="webinarAttendance" />
        <Kpi label="Webinars · current view" val={num(totals.webinars)} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Webinar Performance</div>
            <div className="panel-sub">Per webinar · registrants, attendees &amp; attendance rate</div>
          </div>
          <span className="chip blue">{webinars.length} webinars</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Webinar</th><th>Date</th><th>Region</th>
                <th className="r">Registrants</th><th className="r">Attendees</th><th className="r">Att. rate</th>
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
                </tr>
              ))}
              <tr className="total">
                <td colSpan={3}>Total · {webinars.length} webinars</td>
                <td className="r mono">{num(totals.registrants)}</td>
                <td className="r mono">{num(totals.attendees)}</td>
                <td className="r mono">{ratePct(totals.attendanceRate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ---- In-person events: SF funnel for non-webinar campaigns + per-campaign table ----
function InPerson({ det }) {
  const ov = useCampaignOverrides().data || {} // hook before any early return
  if (det.isLoading) return <Loading label="Loading event funnel…" />
  if (det.isError) return <ErrorState error={det.error} />
  if (!det.data || !det.data.hasData)
    return <EmptyState message="No Salesforce-attributed event campaigns for this region / quarter yet." />

  // In-person = every event campaign that isn't a Webinar (Event / Seminar / untyped).
  const campaigns = det.data.campaigns.filter((c) => c.campaignType !== 'Webinar')
  const t = sumFunnel(campaigns)

  if (campaigns.length === 0)
    return <EmptyState message="No in-person event campaigns for this region / quarter yet." />

  return (
    <>
      <div className="kpis cols-5">
        <Kpi label="Leads · current view" val={num(t.leads)} explainId="leads" />
        <Kpi label="MQLs · current view" val={num(t.mql)} explainId="mql" />
        <Kpi label="SQLs · current view" val={num(t.sql)} explainId="sql" />
        <Kpi label="Created Opps · current view" val={num(t.createdOpps)} explainId="createdOpps" />
        <Kpi label="Pipeline € · current view" val={eur(t.pipeline)} sub={`${eur(t.won)} closed-won`} explainId="pipeline" />
      </div>

      <div className="callout amber" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div className="callout-body">
          <strong>A note on event names &amp; the year in them.</strong> Some Salesforce event campaigns are named
          after the date the event was held (e.g. <em>“25.09.2025 …”</em>, <em>“… Event 2024”</em>) but stay open as
          attendees keep progressing. <strong>The year in the name is just a label, not the period of the data.</strong>{' '}
          Every figure here is the campaign’s <strong>real 2026 activity only</strong> — e.g. an attendee from a
          2024/2025 event whose opportunity reached SQL in 2026. Earlier-year activity is excluded by the 2026 scope.
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Event Campaign Performance</div>
            <div className="panel-sub">In-person only (webinars are covered above) · Salesforce campaign-attributed</div>
          </div>
          <span className="chip blue">{campaigns.length} campaigns</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Campaign</th><th>Type</th>
                <th className="r">Leads <Explain id="leads" /></th><th className="r">MQLs <Explain id="mql" /></th><th className="r">SQLs <Explain id="sql" /></th>
                <th className="r">Pipeline € <Explain id="pipeline" /></th><th className="r">Closed-Won € <Explain id="closedWon" /></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.campaignKey}>
                  <td><EditableName campaignKey={c.campaignKey} value={ov[c.campaignKey]?.display_name} original={c.campaignName} /></td>
                  <td className="mono mono-d">{typeLabel(c.campaignType)}</td>
                  <td className="r mono">{num(c.leads)}</td>
                  <td className="r mono">{num(c.mql)}</td>
                  <td className="r mono">{num(c.sql)}</td>
                  <td className="r mono">{eur(c.pipeline)}</td>
                  <td className="r mono mono-d">{eur(c.closedWon)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={2}>Total · {campaigns.length} campaigns</td>
                <td className="r mono">{num(t.leads)}</td>
                <td className="r mono">{num(t.mql)}</td>
                <td className="r mono">{num(t.sql)}</td>
                <td className="r mono">{eur(t.pipeline)}</td>
                <td className="r mono mono-d">{eur(t.won)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* In-person attendance not tracked */}
      <NotAvailablePanel
        title="In-person attendance"
        what="In-person registrations / attendees (by region)"
        why="Only webinar (GoToWebinar) attendance is tracked. In-person events need attendee lists uploaded to Salesforce, or a new Salesforce field."
      />
    </>
  )
}

const Kpi = ({ label, val, sub, explainId }) => (
  <div className="kpi">
    <div className="kpi-label">{label}{explainId && <Explain id={explainId} />}</div>
    <div className="kpi-val">{val}</div>
    {sub ? <div className="kpi-sub"><span className="kpi-target">{sub}</span></div> : null}
  </div>
)
