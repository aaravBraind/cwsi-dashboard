import { useState } from 'react'
import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useCampaignThemes, useCampaignOverrides, useUpdateCampaignOverride } from '../../hooks/useDashboardData'
import { num, eur } from '../../data/format'
import { THEME_ORDER, themeMeta } from '../../data/themes'
import Explain from '../Explain'
import EditableName from '../EditableName'

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
          There are <strong>two quarterly campaigns</strong>: everything in <strong>Q1</strong> rolls up under{' '}
          <strong>“Data Is an Asset, Not a Liability”</strong> and everything in <strong>Q2</strong> under{' '}
          <strong>“Innovation Without Risk”</strong>. Each is an overarching campaign, rolled up from all its
          activities — expand a card to see the individual touchpoints within it. A campaign is placed in its quarter
          from its own date (not from when its leads or deals happen to fall), so activities no longer cross between
          quarters. Anything not tied to a 2026 quarter sits under “Other activities”. Campaign names are editable
          (click the pencil). <Explain id="campaignTheme" />
        </div>
      </div>

      <div className="callout" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          <strong>The "Theme" dropdown on each activity.</strong> Every activity is placed in a quarter
          <strong> automatically, from its own campaign date</strong> — so it can occasionally be off (for example a
          campaign whose Salesforce name has no date). Use the <strong>Theme</strong> dropdown on any activity row to
          move it to <strong>Q1</strong> (Data Is an Asset), <strong>Q2</strong> (Innovation Without Risk) or{' '}
          <strong>Other</strong>; leave it on <strong>"Auto"</strong> to keep the automatic choice. Your change saves
          instantly and sticks through every data refresh.
        </div>
      </div>

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
  const upd = useUpdateCampaignOverride()
  const t = theme.totals

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
        <div className="kpis cols-3">
          <Kpi label="MQLs" val={num(t.mql)} explainId="mql" />
          <Kpi label="SQLs" val={num(t.sql)} explainId="sql" />
          <Kpi label="Open Pipeline €" val={eur(t.pipeline)} sub={`${eur(t.closedWon)} closed-won`} explainId="pipeline" />
        </div>
      </div>

      {/* Individual activities within the theme */}
      {open && (
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Region</th>
                <th>Type</th>
                <th className="r">MQL<Explain id="mql" /></th>
                <th className="r">SQL<Explain id="sql" /></th>
                <th className="r">Open Pipeline €<Explain id="pipeline" /></th>
                <th className="r">Closed-Won €<Explain id="closedWon" /></th>
                <th>Theme</th>
              </tr>
            </thead>
            <tbody>
              {theme.campaigns.map((c) => (
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
                  <td className="r">{eur(c.pipeline)}</td>
                  <td className="r">{eur(c.closedWon)}</td>
                  <td>
                    <select
                      className="theme-select"
                      value={c.themeOverridden ? c.theme.key : ''}
                      title={c.themeOverridden ? `Pinned to ${c.theme.label} (Salesforce name suggests ${c.autoTheme.label})` : `Auto-classified as ${c.autoTheme.label} — pick to override`}
                      onChange={(e) => upd.mutate({ campaignKey: c.campaignKey, field: 'theme', value: e.target.value })}
                    >
                      <option value="">Auto · {c.autoTheme.label}</option>
                      {THEME_ORDER.map((k) => {
                        const m = themeMeta(k)
                        return <option key={k} value={k}>{m.label}</option>
                      })}
                    </select>
                  </td>
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
            as responders — so the funnel reads 0 while the pipeline/revenue is real (e.g. Samenwerkingsdag Zorg: 0 leads, but
            3 opportunities → €96k pipeline + €46k won).
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
