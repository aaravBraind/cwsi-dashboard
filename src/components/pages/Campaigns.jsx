import { useState } from 'react'
import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useCampaignThemes, useCampaignOverrides } from '../../hooks/useDashboardData'
import { num, eur } from '../../data/format'
import Explain from '../Explain'
import { useSortable, SortTh } from '../SortableTable'
import EditableName from '../EditableName'
import CurrentVsOngoing from '../CurrentVsOngoing'

// Campaigns — the campaign-level / quarterly-theme view Margot asked for (X4/G3).
// Every campaign rolls up into its overarching THEME (themes.js), shown "as a whole"
// with the individual activities within it expandable beneath. Names are editable
// (reuses the campaign_overrides layer) and region/quarter scope the whole page.
//
// The metrics are the Salesforce-attributed funnel we already hold. Created
// Opportunities as a distinct metric + the "current-quarter vs ongoing impact" split
// arrive with the next re-ingest (campaign start dates + hierarchy) — see the callout.
export default function Campaigns() {
  const q = useCampaignThemes()
  const ov = useCampaignOverrides().data || {}

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Campaigns <span className="accent">by Theme</span></div>
          <div className="page-sub">Quarterly themes as a whole, with their activities · Salesforce-attributed · FY2026</div>
        </div>
        <QuarterPills />
      </div>

      <div className="callout" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          Each quarter has <strong>one overarching quarterly campaign</strong>: <strong>Q1</strong> is{' '}
          <strong>“Data Is an Asset, Not a Liability”</strong>, <strong>Q2</strong> is{' '}
          <strong>“Innovation Without Risk”</strong>, and <strong>Q3</strong> is the Q3 campaign (theme name to be
          confirmed — see the note below). <strong>Q1 and Q2 list exactly the campaigns you named</strong> (4 in Q1,
          7 in Q2) — one row per campaign, with every figure attributed only to that campaign's Salesforce
          activity (a campaign spanning several Salesforce entries, like the two Protect Data events or a webinar
          plus its on-demand version, is one row). Everything else sits under{' '}
          <strong>“Other activities”</strong>, kept so the page still adds up to the Overview totals. Campaign names
          are editable (click the pencil). <Explain id="campaignTheme" />
        </div>
      </div>

      <div className="callout" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          <strong>Q3 theme name pending.</strong> Q3 2026 reporting is now open, but the Q3 overarching campaign
          theme <strong>hasn’t been named yet</strong>. Until it is, all Q3 activities are grouped under a
          provisional <strong>“Q3 2026 Campaign (theme to be confirmed)”</strong> heading — the figures are real and
          final; only the heading will change once the Q3 theme is agreed.
        </div>
      </div>

      {/* The "Theme" dropdown column was removed (Margot, 11 Aug: "I'm not sure what value
          the Theme column adds. I'd remove it.") — Q1/Q2 placement is now fixed by her
          curated campaign list, so there is nothing left to override. */}

      {/* Locked definition: which date keys what. A campaign is placed by when it STARTED
          (name date, else Salesforce Start Date) — its end/close date is never used — while
          the money against it is dated by the DEAL (open = created date, won = close date).
          See docs/METRIC_DEFINITIONS.md. */}
      <div className="callout" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          <strong>Which date keys what.</strong> A campaign is placed in a quarter by when it{' '}
          <strong>started</strong> — the date in its name, otherwise its Salesforce Start Date. A campaign's{' '}
          <strong>end / close date is never used</strong>. The money against it is dated by the{' '}
          <strong>deal</strong> instead: an open opportunity counts in the quarter it was created, a won one in the
          quarter it closed. So a Q1 activity can still be showing revenue in Q2 — and in 2026 to date most of the
          revenue landing in a quarter comes from campaigns that started earlier. Rows are ordered by contribution,
          not by date. <Explain id="campaignDating" />
        </div>
      </div>

      {/* W6 — run-this-period vs ongoing impact across all campaigns */}
      <CurrentVsOngoing />

      {q.isLoading && <Loading label="Loading campaign themes…" />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && <EmptyState message="No campaigns for this region / quarter yet." />}
      {q.data && q.data.hasData && q.data.themes.map((t) => <ThemeCard key={t.key} theme={t} ov={ov} />)}
    </>
  )
}

// One overarching theme: the rolled-up "as a whole" figures, expandable to the
// individual activities within it.
function ThemeCard({ theme, ov }) {
  const [open, setOpen] = useState(theme.key !== 'other') // named themes open; Other collapsed
  const t = theme.totals
  // Robin: order by contribution, not recency — every column is sortable, defaulting to
  // biggest open pipeline first (the order the rows already arrived in).
  const { rows: activities, sortProps } = useSortable(theme.campaigns, 'pipeline')

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="panel-head" style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        <div className="left">
          <div className="panel-title">
            <span style={{ display: 'inline-block', width: 14, opacity: 0.6 }}>{open ? '▾' : '▸'}</span>
            {theme.quarter && <span className="chip blue" style={{ marginRight: 8 }}>{theme.quarter}</span>}
            {theme.label}
          </div>
          <div className="panel-sub">{theme.blurb}</div>
        </div>
        <span className="chip">{theme.activityCount} {theme.activityCount === 1 ? 'activity' : 'activities'}</span>
      </div>

      {/* Theme "as a whole" rollup */}
      <div className="panel-body">
        <div className="kpis cols-4">
          <Kpi label="MQLs" val={num(t.mql)} explainId="mql" />
          <Kpi label="SQLs" val={num(t.sql)} explainId="sql" />
          <Kpi label="Opportunities" val={num(t.createdOpps)} sub={`${num(t.oppCount)} qualified (open or won)`} explainId="createdOpps" />
          <Kpi label="Open Pipeline €" val={eur(t.pipeline)} sub={`${eur(t.closedWon)} closed-won`} explainId="pipeline" />
        </div>
      </div>

      {/* Individual activities within the theme */}
      {open && (
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <SortTh {...sortProps('campaignName', 'text')}>Activity</SortTh>
                <SortTh {...sortProps('regionCode', 'text')}>Region</SortTh>
                <SortTh {...sortProps('campaignType', 'text')}>Type</SortTh>
                <SortTh {...sortProps('mql')} className="r">MQL<Explain id="mql" /></SortTh>
                <SortTh {...sortProps('sql')} className="r">SQL<Explain id="sql" /></SortTh>
                <SortTh {...sortProps('createdOpps')} className="r">Opps<Explain id="createdOpps" /></SortTh>
                <SortTh {...sortProps('oppCount')} className="r">Qualified Opportunities<Explain id="opportunities" /></SortTh>
                <SortTh {...sortProps('pipeline')} className="r">Open Pipeline €<Explain id="pipeline" /></SortTh>
                <SortTh {...sortProps('closedWon')} className="r">Closed-Won €<Explain id="closedWon" /></SortTh>
              </tr>
            </thead>
            <tbody>
              {activities.map((c) => (
                <tr key={c.campaignKey}>
                  <td>
                    <EditableName
                      campaignKey={c.campaignKey}
                      value={ov[c.campaignKey]?.display_name}
                      original={c.campaignName}
                    />
                  </td>
                  <td>
                    <EditableName
                      campaignKey={c.campaignKey}
                      field="display_region"
                      value={ov[c.campaignKey]?.display_region}
                      original={c.regionCode}
                    />
                  </td>
                  <td><span style={{ opacity: 0.6 }}>{c.campaignType || '—'}</span></td>
                  <td className="r">{num(c.mql)}</td>
                  <td className="r">{num(c.sql)}</td>
                  <td className="r">{num(c.createdOpps)}</td>
                  <td className="r">{num(c.oppCount)}</td>
                  <td className="r">{eur(c.pipeline)}</td>
                  <td className="r">{eur(c.closedWon)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="panel-note" style={{ padding: '6px 4px 0', fontSize: 12, opacity: 0.7 }}>
            “Pipeline €” is opportunities still <strong>open</strong>; “Closed-Won €” is deals already won. A deal
            is only ever in one of the two — so an activity showing <strong>€0 pipeline next to a Closed-Won value</strong> just
            means its opportunities have already closed and been won (nothing left in progress).
            <br />
            <strong>0 Leads/MQL/SQL but pipeline or revenue?</strong> Leads/MQL/SQL count campaign <strong>responders</strong>
            (people logged as “responded” in Salesforce), while Pipeline &amp; Closed-Won count <strong>opportunities linked
            to the campaign</strong>. In-person events often have deals attributed to them without the attendees being recorded
            as responders — so the funnel reads 0 while the pipeline/revenue is real (Samenwerkingsdag Zorg is the standing
            example: no recorded responders, yet real opportunities and won revenue).
          </p>
        </div>
      )}
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
