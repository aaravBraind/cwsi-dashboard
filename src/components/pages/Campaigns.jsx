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
          Each <strong>theme</strong> is an overarching quarterly campaign, rolled up from all its activities;
          expand a theme to see the individual touchpoints within it. Campaigns are grouped by a naming rule that
          covers the whole book, so sibling activities are pulled in automatically — <strong>this grouping is a
          proposed mapping for you to confirm</strong>, and campaign names are editable (click the pencil).
          <Explain id="campaignTheme" />
          <br />
          <em>Coming next (with the next data refresh):</em> Created Opportunities per theme, and a split between
          activities run <strong>this quarter</strong> and pipeline that <strong>earlier</strong> activities are still generating.
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
        <div className="kpis cols-4">
          <Kpi label="Leads" val={num(t.leads)} explainId="leads" />
          <Kpi label="MQLs" val={num(t.mql)} explainId="mql" />
          <Kpi label="SQLs" val={num(t.sql)} explainId="sql" />
          <Kpi label="Pipeline €" val={eur(t.pipeline)} sub={`${eur(t.closedWon)} closed-won`} explainId="pipeline" />
        </div>
      </div>

      {/* Individual activities within the theme */}
      {open && (
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Activity</th>
                <th>Type</th>
                <th className="r">Leads<Explain id="leads" /></th>
                <th className="r">MQL<Explain id="mql" /></th>
                <th className="r">SQL<Explain id="sql" /></th>
                <th className="r">Pipeline €<Explain id="pipeline" /></th>
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
                  <td><span style={{ opacity: 0.6 }}>{c.campaignType || '—'}</span></td>
                  <td className="r">{num(c.leads)}</td>
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
