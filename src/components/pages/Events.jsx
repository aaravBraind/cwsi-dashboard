import { useMemo } from 'react'
import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useEvents, useEventsDetail, useCampaignOverrides, useEventAttendance } from '../../hooks/useDashboardData'
import { num, eur, isNA } from '../../data/format'
import Explain from '../Explain'
import { useSortable, SortTh } from '../SortableTable'
import EditableName from '../EditableName'
import CurrentVsOngoing from '../CurrentVsOngoing'
import { I } from '../icons'

const ratePct = (r, d = 0) => (isNA(r) || r == null ? 'n/a' : `${(r * 100).toFixed(d)}%`)
const TYPE_LABEL = {
  Webinar: 'Webinars',
  Event: 'In-person events',
  OwnedEvent: 'In-person events',
  EarnedEvent: 'In-person events',
  'Seminar / Conference': 'Seminars / Conferences',
}
const typeLabel = (t) => TYPE_LABEL[t] || t || 'Untyped'

// Owned vs Earned (EV4). Owned events now come straight from Salesforce — Campaign.Type =
// 'OwnedEvent'. There is no 'EarnedEvent' type; CWSI's single earned event this year is tagged by
// NAME (Cybersec Europe — the conference CWSI exhibits at, not its own "Cybersec Dinner" events,
// hence the precise match). Henley Regatta kept for future-proofing (no SF campaign for it yet).
// Precedence: an explicit earned name wins; everything else (incl. OwnedEvent, and the legacy
// 'Event' type still used in production) is Owned.
const EARNED_RE = /cybersec\s*europe|henley\s*regatta/i
const eventClass = (name) => (EARNED_RE.test(String(name || '')) ? 'Earned' : 'Owned')

// Sum the SF-attributed funnel across a set of campaigns. MQL = campaign members
// (event registrants / responders) — the funnel starts at MQL (no separate Leads stage).
//
// Reads each campaign's PERIOD figures (`c.period`), so every tile that says "current
// view" still means the selected quarter. The campaign TABLES read the row's own
// fields instead — the campaign's whole-2026 contribution, which is what ties to the
// campaign record in Salesforce (an opportunity created in an earlier quarter still
// belongs to the event that generated it). See campaignRows() in queries.js.
const sumFunnel = (cs) =>
  cs.reduce(
    (a, x) => {
      const c = x.period || x
      return { mql: a.mql + c.mql, sql: a.sql + c.sql, createdOpps: a.createdOpps + (c.createdOpps || 0), oppCount: a.oppCount + (c.oppCount || 0), pipeline: a.pipeline + c.pipeline, won: a.won + c.closedWon }
    },
    { mql: 0, sql: 0, createdOpps: 0, oppCount: 0, pipeline: 0, won: 0 },
  )

// Same, but on the campaigns' WHOLE-2026 figures — used for the campaign tables' total
// row so the footer adds up the columns above it.
const sumYear = (cs) =>
  cs.reduce(
    (a, c) => ({ mql: a.mql + c.mql, sql: a.sql + c.sql, createdOpps: a.createdOpps + (c.createdOpps || 0), oppCount: a.oppCount + (c.oppCount || 0), pipeline: a.pipeline + c.pipeline, won: a.won + c.closedWon }),
    { mql: 0, sql: 0, createdOpps: 0, oppCount: 0, pipeline: 0, won: 0 },
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
          <strong>Webinars</strong> and <strong>in-person events</strong> use the <strong>same metric set</strong> —
          MQLs → SQLs → Created Opps → pipeline &amp; closed-won — all Salesforce campaign-attributed, so the two
          sections read consistently. Webinars add GoToWebinar attendance (registrants / attendees) on top; in-person
          attendance comes from the Outreach attendee lists (shown once exported). Region &amp; quarter scope every figure.
          <br /><strong>How MQL &amp; SQL are defined for events:</strong> <strong>MQL = every registered attendee</strong>{' '}
          (the Salesforce campaign members for the event); <strong>SQL = the registrants who progressed to a qualified
          opportunity</strong> (any opportunity stage except “Unqualified opp”). <em>Note:</em> GoToWebinar’s raw
          registration tally is a sign-up count and can differ slightly from the Salesforce campaign-member MQL — they
          come from different systems.
        </div>
      </div>

      {/* ---- EV1: both event types combined, ABOVE the type breakdown ---- */}
      <EventsSummary ev={ev} det={det} />

      {/* ---- Webinars ---- */}
      <div className="sec-divider"><span className="label">Webinars</span><div className="line" /></div>
      <Webinars ev={ev} det={det} />

      {/* ---- In-person events ---- */}
      <div className="sec-divider" style={{ marginTop: 22 }}><span className="label">In-person events</span><div className="line" /></div>
      <InPerson det={det} />

      {/* ---- Current-quarter events vs ongoing impact of past events (EV5) ---- */}
      <div className="sec-divider" style={{ marginTop: 22 }}><span className="label">Current vs ongoing impact</span><div className="line" /></div>
      <CurrentVsOngoing channel="Events & Webinars" label="event" />

      {/* ---- Owned vs Earned split (EV4) ---- */}
      <div className="sec-divider" style={{ marginTop: 22 }}><span className="label">Owned vs Earned</span><div className="line" /></div>
      <OwnedEarnedSummary det={det} />
    </>
  )
}

// EV1 (Margot, Jul 2026) — "top summary = webinars + in-person hosted in-quarter
// (registrations, attendees, created opps, influenced pipeline, closed won) BEFORE the
// type breakdown". One combined read of the whole event programme, so the page opens with
// the answer to "how did events do?" instead of making the reader add two sections up.
//
// Bases differ per metric, and rather than blur them the tiles say so in their sub-labels:
//   • Registrations — webinars from GoToWebinar; in-person from Salesforce campaign members
//     (per V4, an event's members ARE its registrants). Two systems, so the split is shown.
//   • Attendees — webinars from GoToWebinar. In-person attendance only exists in the Outreach
//     attendee lists, so until those are exported this tile is webinar-only and SAYS so
//     rather than presenting a partial figure as the programme total.
//   • Created Opps / Influenced Pipeline / Closed-Won — Salesforce campaign-attributed for
//     both types, so these are true combined totals. Influenced = open + won (the S3 glossary).
function EventsSummary({ ev, det }) {
  const att = useEventAttendance()
  if (!det.data || !det.data.hasData) return null

  const all = det.data.campaigns || []
  const webinarCs = all.filter((c) => c.campaignType === 'Webinar')
  const inPersonCs = all.filter((c) => c.campaignType !== 'Webinar')
  const t = sumFunnel(all)
  const influenced = t.pipeline + t.won

  // Registrations
  const webReg = ev.data?.hasData ? ev.data.totals.registrants : 0
  const inPersonReg = sumFunnel(inPersonCs).mql
  // Attendees — in-person only once the attendee lists are loaded.
  const webAtt = ev.data?.hasData ? ev.data.totals.attendees : 0
  const hasInPersonAtt = !!(att.data && att.data.hasData)
  const inPersonAtt = hasInPersonAtt ? att.data.totals.attended : null

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Event Programme — Webinars + In-person</div>
          <div className="panel-sub">Both event types combined · Salesforce-attributed · current view</div>
        </div>
        <span className="chip blue">
          {webinarCs.length} webinar{webinarCs.length === 1 ? '' : 's'} · {inPersonCs.length} in-person
        </span>
      </div>
      <div className="panel-body">
        <div className="kpis cols-5" style={{ marginBottom: 4 }}>
          <Kpi
            label="Registrations · current view"
            val={num(webReg + inPersonReg)}
            sub={`${num(webReg)} webinar · ${num(inPersonReg)} in-person`}
            explainId="mql"
          />
          <Kpi
            label="Attendees · current view"
            val={num(hasInPersonAtt ? webAtt + inPersonAtt : webAtt)}
            sub={hasInPersonAtt ? `${num(webAtt)} webinar · ${num(inPersonAtt)} in-person` : 'webinars only · in-person pending attendee lists'}
            explainId="webinarAttendance"
          />
          <Kpi label="Created Opps · current view" val={num(t.createdOpps)} explainId="createdOpps" />
          <Kpi
            label="Influenced Pipeline (revenue) · current view"
            val={eur(influenced)}
            sub={`${eur(t.pipeline)} open · ${eur(t.won)} won`}
            explainId="pipeline"
          />
          <Kpi label="Closed-Won · current view" val={eur(t.won)} explainId="closedWon" />
        </div>
        <div className="callout">
          <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
          <div className="callout-body">
            <strong>How to read this.</strong> Created Opps, Influenced Pipeline and Closed-Won are true combined
            totals — both event types are Salesforce campaign-attributed on the same basis.{' '}
            <strong>Registrations</strong> combine two systems: GoToWebinar sign-ups for webinars and Salesforce
            campaign members for in-person events, so the split is shown beneath.{' '}
            {hasInPersonAtt
              ? 'Attendees combine GoToWebinar with the Outreach attendee lists.'
              : <><strong>Attendees is webinars only for now</strong> — in-person attendance lives in the Outreach attendee lists, which aren’t available through the API; the figure completes once those are exported.</>}{' '}
            The sections below break the same programme down by type.
          </div>
        </div>
      </div>
    </div>
  )
}

// EV4 — Owned vs Earned split. Owned = Salesforce Campaign.Type 'OwnedEvent'; the one earned event
// (Cybersec Europe) is tagged by name (no earned Type exists). See eventClass above.
function OwnedEarnedSummary({ det }) {
  if (!det.data || !det.data.hasData) return null
  const all = det.data.campaigns || []
  const grp = (cls) => {
    const rs = all.filter((c) => eventClass(c.campaignName) === cls)
    return {
      n: rs.length,
      pipeline: rs.reduce((a, c) => a + (Number(c.pipeline) || 0), 0),
      won: rs.reduce((a, c) => a + (Number(c.closedWon) || 0), 0),
      names: rs.map((c) => c.campaignName),
    }
  }
  const owned = grp('Owned')
  const earned = grp('Earned')
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Owned vs Earned Events</div>
          <div className="panel-sub">CWSI-hosted (Campaign Type “OwnedEvent”) vs participated (Cybersec Europe) · current view</div>
        </div>
      </div>
      <div className="panel-body">
        <div className="kpis cols-2">
          <div className="kpi">
            <div className="kpi-label">Owned events <span className="chip neu">CWSI-hosted</span></div>
            <div className="kpi-val">{num(owned.n)}</div>
            <div className="kpi-sub"><span className="kpi-target">{eur(owned.pipeline)} pipeline · {eur(owned.won)} closed-won</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Earned events <span className="chip amber">Participated</span></div>
            <div className="kpi-val">{num(earned.n)}</div>
            <div className="kpi-sub"><span className="kpi-target">{earned.names.length ? earned.names.join(', ') : '—'} · {eur(earned.pipeline)} pipeline · {eur(earned.won)} won</span></div>
          </div>
        </div>
        <div className="callout" style={{ marginTop: 4 }}>
          <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
          <div className="callout-body">
<strong>Owned</strong> events come from the Salesforce Campaign Type <strong>“OwnedEvent”</strong>. There's no
            separate earned type, so the single <strong>Earned</strong> event this year — <strong>Cybersec Europe</strong>
            (the conference CWSI exhibits at, not its own “Cybersec Dinner” events) — is tagged by name. <em>Henley Regatta
            has no Salesforce campaign yet, so it doesn't appear.</em>
          </div>
        </div>
      </div>
    </div>
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
        <div className="kpis cols-4" style={{ marginTop: 4 }}>
          <Kpi label="MQLs (registrants) · current view" val={num(t.mql)} explainId="mql" />
          <Kpi label="SQLs · current view" val={num(t.sql)} explainId="sql" />
          <Kpi label="Created Opps · current view" val={num(t.createdOpps)} explainId="createdOpps" />
          <Kpi label="Open Pipeline € · current view" val={eur(t.pipeline)} sub={`${eur(t.won)} closed-won`} explainId="pipeline" />
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
  // In-person = every event campaign that isn't a Webinar (Event / Seminar / untyped).
  // Computed (and memoised for a stable identity) ABOVE the early returns, because the
  // sort hook below must run on every render — React forbids a hook that only runs once
  // the data has loaded.
  const campaigns = useMemo(
    () => (det.data?.hasData ? det.data.campaigns.filter((c) => c.campaignType !== 'Webinar') : []),
    [det.data],
  )
  // Robin: sortable columns instead of a fixed order (defaults to biggest pipeline).
  const { rows: sortedCampaigns, sortProps } = useSortable(campaigns, 'pipeline')

  if (det.isLoading) return <Loading label="Loading event funnel…" />
  if (det.isError) return <ErrorState error={det.error} />
  if (!det.data || !det.data.hasData)
    return <EmptyState message="No Salesforce-attributed event campaigns for this region / quarter yet." />

  const t = sumFunnel(campaigns) // selected period — the KPI tiles
  const ty = sumYear(campaigns) // whole 2026 — the table footer

  if (campaigns.length === 0)
    return <EmptyState message="No in-person event campaigns for this region / quarter yet." />

  return (
    <>
      <div className="kpis cols-4">
        <Kpi label="MQLs · current view" val={num(t.mql)} explainId="mql" />
        <Kpi label="SQLs · current view" val={num(t.sql)} explainId="sql" />
        <Kpi label="Created Opps · current view" val={num(t.createdOpps)} explainId="createdOpps" />
        <Kpi label="Open Pipeline € · current view" val={eur(t.pipeline)} sub={`${eur(t.won)} closed-won`} explainId="pipeline" />
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

      <div className="callout amber" style={{ marginBottom: 14 }}>
        <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
        <div className="callout-body">
          <strong>Owned</strong> events come from the Salesforce Campaign Type <strong>“OwnedEvent”</strong>. There's no
          separate earned type in Salesforce, so the one <strong>Earned</strong> event this year — <strong>Cybersec
          Europe</strong> — is tagged by name (its own “Cybersec Dinner” events stay Owned). <strong>Note:</strong>{' '}
          “OwnedEvent” is a new Campaign Type — after the next Salesforce refresh those events are mapped to the Events
          channel; until production adopts it, events on the legacy <em>“Event”</em> type still report normally.
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Event Campaign Performance</div>
            <div className="panel-sub">In-person only (webinars are covered above) · Salesforce campaign-attributed · each campaign's full-2026 contribution</div>
          </div>
          <span className="chip blue">{campaigns.length} campaigns</span>
        </div>
        {/* Attribution-window fix: rows are the campaign's whole-2026 contribution, so an
            opportunity created in an earlier quarter still counts towards the event that
            generated it (that omission was under-reporting campaigns by up to ~45%). */}
        <div className="panel-body" style={{ paddingBottom: 0 }}>
          <p className="panel-note" style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>
            Each row is the campaign's <strong>full 2026 contribution</strong>, so it ties to the campaign in
            Salesforce: an opportunity created in an earlier quarter still counts towards the event that generated it.
            The quarter pill chooses <em>which</em> events are listed; the tiles above stay on the selected quarter, so
            the table total can be higher. <strong>Opps</strong> = every opportunity created off this campaign;{' '}
            <strong>Qualified</strong> = those at a genuine stage and still open or won — what Open Pipeline is summed
            from. <Explain id="campaignWindow" />
          </p>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <SortTh {...sortProps('campaignName', 'text')}>Campaign</SortTh>
                <SortTh {...sortProps('regionCode', 'text')}>Region</SortTh>
                <SortTh {...sortProps('campaignType', 'text')}>Type</SortTh>
                <th>Owned / Earned</th>
                <SortTh {...sortProps('mql')} className="r">MQLs <Explain id="mql" /></SortTh>
                <SortTh {...sortProps('sql')} className="r">SQLs <Explain id="sql" /></SortTh>
                <SortTh {...sortProps('createdOpps')} className="r">Opps <Explain id="createdOpps" /></SortTh>
                <SortTh {...sortProps('oppCount')} className="r">Qualified <Explain id="opportunities" /></SortTh>
                <SortTh {...sortProps('pipeline')} className="r">Open Pipeline € <Explain id="pipeline" /></SortTh>
                <SortTh {...sortProps('closedWon')} className="r">Closed-Won € <Explain id="closedWon" /></SortTh>
              </tr>
            </thead>
            <tbody>
              {sortedCampaigns.map((c) => (
                <tr key={c.campaignKey}>
                  <td><EditableName campaignKey={c.campaignKey} value={ov[c.campaignKey]?.display_name} original={c.campaignName} /></td>
                  <td><EditableName campaignKey={c.campaignKey} field="display_region" value={ov[c.campaignKey]?.display_region} original={c.regionCode} /></td>
                  <td className="mono mono-d">{typeLabel(c.campaignType)}</td>
                  <td><span className={`chip ${eventClass(c.campaignName) === 'Earned' ? 'amber' : 'neu'}`}>{eventClass(c.campaignName)}</span></td>
                  <td className="r mono">{num(c.mql)}</td>
                  <td className="r mono">{num(c.sql)}</td>
                  <td className="r mono">{num(c.createdOpps)}</td>
                  <td className="r mono">{num(c.oppCount)}</td>
                  <td className="r mono">{eur(c.pipeline)}</td>
                  <td className="r mono mono-d">{eur(c.closedWon)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={4}>Total · {campaigns.length} campaigns</td>
                <td className="r mono">{num(ty.mql)}</td>
                <td className="r mono">{num(ty.sql)}</td>
                <td className="r mono">{num(ty.createdOpps)}</td>
                <td className="r mono">{num(ty.oppCount)}</td>
                <td className="r mono">{eur(ty.pipeline)}</td>
                <td className="r mono mono-d">{eur(ty.won)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* In-person registrations + attendance by region (EV1/EV2/EV3) */}
      <AttendanceByRegion />
    </>
  )
}

// EV1/EV2/EV3 — in-person registrations + attendance by region, from Margot's Outreach
// attendee / non-attendee lists. Shows the data once seeded; until then an honest notice.
function AttendanceByRegion() {
  const q = useEventAttendance()
  const has = q.data && q.data.hasData
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Registrations &amp; Attendance by Region</div>
          <div className="panel-sub">In-person events · from the Outreach attendee / non-attendee lists</div>
        </div>
        {has && <span className="chip blue">{q.data.byEvent.length} events</span>}
      </div>
      <div className="panel-body">
        <div className="callout amber" style={{ marginBottom: has ? 14 : 0 }}>
          <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
          <div className="callout-body">
            <strong>Source: Outreach attendee lists.</strong> In-person registrations &amp; attendance come from the
            lists CWSI keeps in Outreach (Prospects → Prospect Lists), named{' '}
            <em>Region – Attendees / Non-Attendees – Event</em>. Those lists aren't available through the Outreach
            API, so we load them from an export.{' '}
            {has
              ? 'The figures below are from the latest export.'
              : 'This view populates once the lists are exported to us — send them over and we’ll seed it.'}{' '}
            Webinar attendance (above) comes from GoToWebinar.
          </div>
        </div>
        {has && (
          <table className="tbl">
            <thead>
              <tr><th>Event</th><th>Region</th><th className="r">Registered</th><th className="r">Attended</th><th className="r">Attendance</th></tr>
            </thead>
            <tbody>
              {q.data.byEvent.flatMap((e) =>
                e.byRegion.map((r) => (
                  <tr key={`${e.event}|${r.region}`}>
                    <td>{e.event}</td>
                    <td>{r.region}</td>
                    <td className="r mono">{num(r.registered)}</td>
                    <td className="r mono">{num(r.attended)}</td>
                    <td className="r mono mono-d">{r.registered > 0 ? `${((r.attended / r.registered) * 100).toFixed(0)}%` : 'n/a'}</td>
                  </tr>
                )),
              )}
              <tr className="total">
                <td colSpan={2}>Total</td>
                <td className="r mono">{num(q.data.totals.registered)}</td>
                <td className="r mono">{num(q.data.totals.attended)}</td>
                <td className="r mono mono-d">{isNA(q.data.totals.attendanceRate) ? 'n/a' : `${(q.data.totals.attendanceRate * 100).toFixed(0)}%`}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const Kpi = ({ label, val, sub, explainId }) => (
  <div className="kpi">
    <div className="kpi-label">{label}{explainId && <Explain id={explainId} />}</div>
    <div className="kpi-val">{val}</div>
    {sub ? <div className="kpi-sub"><span className="kpi-target">{sub}</span></div> : null}
  </div>
)
