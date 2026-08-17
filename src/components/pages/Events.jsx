import { useMemo } from 'react'
import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useEvents, useEventsDetail, useCampaignOverrides, useEventAttendance } from '../../hooks/useDashboardData'
import { useFilters } from '../../filters/FilterContext'
import { num, eur, isNA } from '../../data/format'
import { REPORTING_YEAR } from '../../data/constants'
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

// Owned vs Earned (EV4). Owned events come straight from Salesforce — Campaign.Type =
// 'OwnedEvent'. There is no 'EarnedEvent' type; earned events (conferences CWSI attends
// rather than hosts) are tagged by NAME: Cybersec Europe (the conference, not CWSI's own
// "Cybersec Dinner" events) and the Henley Regatta hospitality.
const EARNED_RE = /cybersec\s*europe|henley\s*regatta/i
const eventClass = (name) => (EARNED_RE.test(String(name || '')) ? 'Earned' : 'Owned')

// W7 (Margot, 11 Aug): these four events are EXCLUDED from the main overview — they are
// prior-year / partner events, not part of the 2026 programme. Any revenue or pipeline
// they still generate stays counted in the "ongoing impact" bucket of the run-vs-ongoing
// panel at the bottom (which reads the warehouse directly, not this page's lists).
const EXCLUDED_EVENTS_RE = /zorgeloos aan de slag|sentinelone f1|mission impossible|blaud - eoy event/i
const isExcludedEvent = (c) => EXCLUDED_EVENTS_RE.test(String(c.campaignName || ''))

// First day of the selected window — used to split events into "run this period"
// (started inside the window) vs "ongoing impact" (started earlier).
const periodStartOf = (quarter) =>
  quarter && quarter !== 'ytd'
    ? { q1: `${REPORTING_YEAR}-01-01`, q2: `${REPORTING_YEAR}-04-01`, q3: `${REPORTING_YEAR}-07-01`, q4: `${REPORTING_YEAR}-10-01` }[quarter]
    : `${REPORTING_YEAR}-01-01`

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

// Events — W7 order (Margot, 11 Aug): Owned-vs-Earned FIRST, then the combined programme
// summary, then Webinars (MQL funnel above the per-webinar table), then In-person split
// into run-this-period vs ongoing-impact sub-tables, then the run-vs-ongoing money panel.
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
          MQLs → SQLs → Created Opps → Qualified Opportunities → pipeline &amp; closed-won — all Salesforce
          campaign-attributed, so the two sections read consistently. Webinars add GoToWebinar attendance
          (registrants / attendees); in-person attendance comes from the attendee lists in your marketing email
          platform. Region &amp; quarter scope every figure.
          <br /><strong>How MQL &amp; SQL are defined for events:</strong> <strong>MQL = every registered attendee</strong>{' '}
          (the Salesforce campaign members for the event); <strong>SQL = the registrants who progressed to a qualified
          opportunity</strong> (any opportunity stage except “Unqualified opp”).
          <br /><strong>Excluded from this page</strong> (per your list): Zorgeloos aan de slag met AI, the SentinelOne
          F1 event, Mission Impossible and the EOY Event 2024 — prior-year / partner events. Anything they still
          generate is counted in the <strong>ongoing impact</strong> figures at the bottom, not hidden.
        </div>
      </div>

      {/* ---- Owned vs Earned — moved to the TOP (Margot, 11 Aug) ---- */}
      <OwnedEarnedSummary det={det} />

      {/* ---- Both event types combined, above the type breakdown (EV1) ---- */}
      <EventsSummary ev={ev} det={det} />

      {/* ---- Webinars ---- */}
      <div className="sec-divider"><span className="label">Webinars</span><div className="line" /></div>
      <Webinars ev={ev} det={det} />

      {/* ---- In-person events ---- */}
      <div className="sec-divider" style={{ marginTop: 22 }}><span className="label">In-person events</span><div className="line" /></div>
      <InPerson det={det} />

      {/* ---- Current-quarter events vs ongoing impact of past events (EV5) ----
          Reads the warehouse directly, so the four excluded events' remaining
          revenue/pipeline is still counted here — in the ongoing-impact bucket. */}
      <div className="sec-divider" style={{ marginTop: 22 }}><span className="label">Run this period vs ongoing impact</span><div className="line" /></div>
      <CurrentVsOngoing channel="Events & Webinars" label="event" />
    </>
  )
}

// EV4 / W7 — Owned vs Earned, at the top. Webinars and the four excluded events are NOT
// counted (the old version counted webinars as owned events, which is most of why the page
// claimed 23 "hosted" events). "Hosted" = started inside the selected window; earlier
// events still contributing are stated separately, not blended into the hosted count.
function OwnedEarnedSummary({ det }) {
  const { filters } = useFilters()
  if (!det.data || !det.data.hasData) return null
  const periodStart = periodStartOf(filters.quarter)
  const all = (det.data.campaigns || []).filter((c) => c.campaignType !== 'Webinar' && !isExcludedEvent(c))
  const grp = (cls) => {
    const rs = all.filter((c) => eventClass(c.campaignName) === cls)
    const hosted = rs.filter((c) => c.startDate && c.startDate >= periodStart)
    const earlier = rs.filter((c) => !c.startDate || c.startDate < periodStart)
    return {
      hosted: hosted.length,
      earlier: earlier.length,
      pipeline: rs.reduce((a, c) => a + (Number(c.pipeline) || 0), 0),
      won: rs.reduce((a, c) => a + (Number(c.closedWon) || 0), 0),
      names: hosted.map((c) => c.campaignName),
    }
  }
  const owned = grp('Owned')
  const earned = grp('Earned')
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Owned vs Earned Events</div>
          <div className="panel-sub">CWSI-hosted vs participated · in-person events only (webinars are counted in their own section) · current view</div>
        </div>
      </div>
      <div className="panel-body">
        <div className="kpis cols-2">
          <div className="kpi">
            <div className="kpi-label">Owned events held this period <span className="chip neu">CWSI-hosted</span></div>
            <div className="kpi-val">{num(owned.hosted)}</div>
            <div className="kpi-sub"><span className="kpi-target">{owned.earlier > 0 ? `+ ${num(owned.earlier)} earlier event${owned.earlier === 1 ? '' : 's'} still contributing · ` : ''}{eur(owned.pipeline)} pipeline · {eur(owned.won)} closed-won across all</span></div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Earned events <span className="chip amber">Participated</span></div>
            <div className="kpi-val">{num(earned.hosted)}</div>
            <div className="kpi-sub"><span className="kpi-target">{earned.names.length ? earned.names.join(', ') : earned.earlier > 0 ? `${num(earned.earlier)} earlier still contributing` : '—'} · {eur(earned.pipeline)} pipeline · {eur(earned.won)} won</span></div>
          </div>
        </div>
        <div className="callout" style={{ marginTop: 4 }}>
          <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
          <div className="callout-body">
            <strong>How the count works.</strong> “Held this period” counts in-person events whose own date falls in the
            selected window — webinars are not in this count (they have their own section), and neither are the four
            excluded prior-year events. Earlier events whose deals are still progressing are stated separately, so the
            hosted count matches the events actually run. <strong>Owned</strong> events come from the Salesforce Campaign
            Type “OwnedEvent”; the <strong>Earned</strong> events (conferences CWSI takes part in rather than hosts —
            Cybersec Europe, the Henley Regatta) are tagged by name.
          </div>
        </div>
      </div>
    </div>
  )
}

// EV1 — one combined read of the whole event programme (excluded events filtered out).
function EventsSummary({ ev, det }) {
  const att = useEventAttendance()
  if (!det.data || !det.data.hasData) return null

  const all = (det.data.campaigns || []).filter((c) => !isExcludedEvent(c))
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
              ? 'Attendees combine GoToWebinar (webinars) with the attendee lists kept in your marketing email platform (in-person).'
              : <><strong>Attendees is webinars only for now</strong> — in-person attendance lives in the attendee lists kept in your marketing email platform; we've confirmed we can read those directly, and the figure completes once that feed loads.</>}{' '}
            The sections below break the same programme down by type. These figures match the per-event rows on the{' '}
            <strong>Campaigns</strong> page — both read the same campaign-attributed Salesforce data.
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Webinars: full metric set ABOVE the per-webinar table (Margot: "move the MQL
// section above Webinar Performance" + "same metrics for webinars as for other events") ----
function Webinars({ ev, det }) {
  const webinarCampaigns = ((det.data?.campaigns || []).filter((c) => c.campaignType === 'Webinar' && !isExcludedEvent(c)))
  const t = sumFunnel(webinarCampaigns)
  return (
    <>
      {ev.isLoading && <Loading label="Loading webinar attendance…" />}
      {ev.isError && <ErrorState error={ev.error} />}
      {ev.data && !ev.data.hasData && <EmptyState message="No webinar attendance for this region / quarter yet." />}

      {/* Attendance headline tiles (GoToWebinar) */}
      {ev.data && ev.data.hasData && (
        <div className="kpis cols-4">
          <Kpi label="Registrations · current view" val={num(ev.data.totals.registrants)} />
          <Kpi label="Attendees · current view" val={num(ev.data.totals.attendees)} />
          <Kpi label="Attendance rate" val={ratePct(ev.data.totals.attendanceRate)} sub="attendees ÷ registrants" explainId="webinarAttendance" />
          <Kpi label="Webinars · current view" val={num(ev.data.totals.webinars)} />
        </div>
      )}

      {/* Salesforce-attributed funnel — the full shared metric set, above the table */}
      {det.data?.hasData && (
        <>
          <div className="kpis cols-3" style={{ marginTop: 4 }}>
            <Kpi label="MQLs (registrants) · current view" val={num(t.mql)} explainId="mql" />
            <Kpi label="SQLs · current view" val={num(t.sql)} explainId="sql" />
            <Kpi label="Created Opps · current view" val={num(t.createdOpps)} explainId="createdOpps" />
          </div>
          <div className="kpis cols-3">
            <Kpi label="Qualified Opportunities · current view" val={num(t.oppCount)} explainId="opportunities" />
            <Kpi label="Open Pipeline € · current view" val={eur(t.pipeline)} explainId="pipeline" />
            <Kpi label="Closed-Won € · current view" val={eur(t.won)} explainId="closedWon" />
          </div>
        </>
      )}

      {/* Per-webinar table (GoToWebinar) — after the metric tiles */}
      {ev.data && ev.data.hasData && <WebinarTable data={ev.data} />}
    </>
  )
}

function WebinarTable({ data }) {
  const { totals, webinars } = data
  return (
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
  )
}

// ---- In-person events: full metric set + run-this-period vs ongoing sub-tables ----
function InPerson({ det }) {
  const ov = useCampaignOverrides().data || {} // hook before any early return
  const att = useEventAttendance()
  const { filters } = useFilters()
  const periodStart = periodStartOf(filters.quarter)
  // In-person = every event campaign that isn't a Webinar, minus the excluded four.
  const campaigns = useMemo(
    () => (det.data?.hasData ? det.data.campaigns.filter((c) => c.campaignType !== 'Webinar' && !isExcludedEvent(c)) : []),
    [det.data],
  )
  const excludedCs = useMemo(
    () => (det.data?.hasData ? det.data.campaigns.filter((c) => c.campaignType !== 'Webinar' && isExcludedEvent(c)) : []),
    [det.data],
  )
  // W7: split by the event's own date — run this period vs earlier events still contributing.
  const runNow = useMemo(() => campaigns.filter((c) => c.startDate && c.startDate >= periodStart), [campaigns, periodStart])
  const ongoing = useMemo(() => campaigns.filter((c) => !c.startDate || c.startDate < periodStart), [campaigns, periodStart])

  if (det.isLoading) return <Loading label="Loading event funnel…" />
  if (det.isError) return <ErrorState error={det.error} />
  if (!det.data || !det.data.hasData)
    return <EmptyState message="No Salesforce-attributed event campaigns for this region / quarter yet." />

  const t = sumFunnel(campaigns) // selected period — the KPI tiles
  const hasAtt = !!(att.data && att.data.hasData)
  const attRate = hasAtt ? att.data.totals.attendanceRate : null
  const exYear = sumYear(excludedCs)

  if (campaigns.length === 0)
    return <EmptyState message="No in-person event campaigns for this region / quarter yet." />

  return (
    <>
      {/* The same shared metric set as webinars (Margot: metric parity) */}
      <div className="kpis cols-4">
        <Kpi label="MQLs (registrants) · current view" val={num(t.mql)} explainId="mql" />
        <Kpi label="SQLs · current view" val={num(t.sql)} explainId="sql" />
        <Kpi label="Created Opps · current view" val={num(t.createdOpps)} explainId="createdOpps" />
        <Kpi
          label="Attendance rate"
          val={hasAtt && !isNA(attRate) ? ratePct(attRate) : '—'}
          sub={hasAtt ? 'from the attendee lists (events with lists only)' : 'pending attendee lists for the remaining events'}
          explainId="webinarAttendance"
        />
      </div>
      <div className="kpis cols-3">
        <Kpi label="Qualified Opportunities · current view" val={num(t.oppCount)} explainId="opportunities" />
        <Kpi label="Open Pipeline € · current view" val={eur(t.pipeline)} explainId="pipeline" />
        <Kpi label="Closed-Won € · current view" val={eur(t.won)} explainId="closedWon" />
      </div>

      {excludedCs.length > 0 && (
        <div className="callout" style={{ marginBottom: 14 }}>
          <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
          <div className="callout-body">
            <strong>Excluded events (per your list):</strong>{' '}
            {excludedCs.map((c) => c.campaignName).join(' · ')} — removed from these figures and tables.
            {(exYear.won > 0 || exYear.pipeline > 0) && (
              <> They are still generating <strong>{eur(exYear.pipeline)}</strong> pipeline and <strong>{eur(exYear.won)}</strong> closed-won in 2026 — counted in the <strong>ongoing impact</strong> panel at the bottom of this page, not hidden.</>
            )}
          </div>
        </div>
      )}

      {/* Run this period — events whose own date falls in the selected window */}
      <EventTable
        title="Events Run This Period"
        sub="Events whose own date falls in the selected window · each row is the campaign's full-2026 contribution"
        campaigns={runNow}
        ov={ov}
        emptyMsg="No in-person events were held in this window."
      />

      {/* Ongoing impact — earlier events still contributing */}
      <EventTable
        title="Ongoing Impact — Earlier Events Still Contributing"
        sub="Events held before the selected window whose registrants and deals are still progressing · same metrics"
        campaigns={ongoing}
        ov={ov}
        emptyMsg="No earlier events are contributing in this window."
      />

      {/* In-person registrations + attendance by region (EV1/EV2/EV3) */}
      <AttendanceByRegion />
    </>
  )
}

// One in-person events table — shared by the run-this-period and ongoing-impact splits
// so both measure the identical metric set (Margot: "measure the same metrics").
function EventTable({ title, sub, campaigns, ov, emptyMsg }) {
  const { rows: sortedCampaigns, sortProps } = useSortable(campaigns, 'pipeline')
  const ty = sumYear(campaigns)
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">{title}</div>
          <div className="panel-sub">{sub}</div>
        </div>
        <span className="chip blue">{campaigns.length} event{campaigns.length === 1 ? '' : 's'}</span>
      </div>
      {campaigns.length === 0 ? (
        <div className="panel-body"><p className="panel-note" style={{ margin: 0 }}>{emptyMsg}</p></div>
      ) : (
        <>
          <div className="panel-body" style={{ paddingBottom: 0 }}>
            <p className="panel-note" style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>
              Each row is the campaign's <strong>full 2026 contribution</strong> — the same basis as the Campaigns page,
              so the two pages tie per event. An opportunity created in an earlier quarter still counts towards the
              event that generated it. <strong>Opps</strong> = every opportunity created off this campaign;{' '}
              <strong>Qualified</strong> = those at a genuine stage and still open or won. <Explain id="campaignWindow" />
            </p>
          </div>
          <div className="panel-body no-pad">
            <table className="tbl">
              <thead>
                <tr>
                  <SortTh {...sortProps('campaignName', 'text')}>Event</SortTh>
                  <SortTh {...sortProps('startDate', 'text')}>Date</SortTh>
                  <SortTh {...sortProps('regionCode', 'text')}>Region</SortTh>
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
                  <tr key={c.campaignKey} style={c.noActivity ? { opacity: 0.7 } : undefined}>
                    <td>
                      <EditableName campaignKey={c.campaignKey} value={ov[c.campaignKey]?.display_name} original={c.campaignName} />
                      {c.noActivity && <span className="chip neu" style={{ marginLeft: 6 }}>no activity recorded yet</span>}
                    </td>
                    <td className="mono mono-d">{c.startDate || '—'}</td>
                    <td><EditableName campaignKey={c.campaignKey} field="display_region" value={ov[c.campaignKey]?.display_region} original={c.regionCode} /></td>
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
                  <td colSpan={4}>Total · {campaigns.length} event{campaigns.length === 1 ? '' : 's'}</td>
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
        </>
      )}
    </div>
  )
}

// EV1/EV2/EV3 — in-person registrations + attendance by region, from Margot's attendee /
// non-attendee lists. Shows the data once seeded; until then an honest notice.
function AttendanceByRegion() {
  const q = useEventAttendance()
  const has = q.data && q.data.hasData
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Registrations &amp; Attendance by Region</div>
          <div className="panel-sub">In-person events · from the attendee / non-attendee lists</div>
        </div>
        {has && <span className="chip blue">{q.data.byEvent.length} events</span>}
      </div>
      <div className="panel-body">
        <div className="callout amber" style={{ marginBottom: has ? 14 : 0 }}>
          <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
          <div className="callout-body">
            <strong>Source: the attendee lists.</strong> In-person registrations &amp; attendance come from the
            attendee / non-attendee lists kept per event.{' '}
            {has
              ? 'The figures below are from the latest load.'
              : 'This view populates once the lists are loaded — send them over and we’ll seed it.'}{' '}
            Webinar attendance (above) comes from GoToWebinar. <strong>Registration rate</strong> (registrations ÷
            invited) additionally needs the invite lists — currently missing for Cybersec Europe, the Microsoft AI
            Tours and the Henley Regatta, so it shows only for events whose lists exist.
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
