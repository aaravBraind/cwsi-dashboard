import { useState } from 'react'
import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState, NotAvailable } from '../States'
import { useChannel, useCampaigns, useLinkedInSnapshot, useEmailEngagement, useCampaignOverrides } from '../../hooks/useDashboardData'
import { gbp, eur, num, pct, isNA } from '../../data/format'
import Explain from '../Explain'
import EditableName from '../EditableName'
import CurrentVsOngoing from '../CurrentVsOngoing'

const rateStr = (v) => (isNA(v) || v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`)

// One component drives all six channel pages. `channel` is {id,name,page}.
// LinkedIn Paid (id 2) additionally renders a GBP delivery SNAPSHOT.
// Email (id 5) additionally renders a Pardot engagement SNAPSHOT.
export default function Channel({ channel }) {
  // Campaign selection is page-local (not global) — the picker only exists here,
  // and a channel-specific campaign_key must not scope other pages. Resets to
  // 'all' automatically because App.jsx remounts Channel per page (key={ch.page}).
  const [campaign, setCampaign] = useState('all')
  const q = useChannel(channel.name, campaign)
  const campaignsQ = useCampaigns(channel.id)
  const isLinkedIn = channel.id === 2
  const isEmail = channel.id === 5
  const overrides = useCampaignOverrides().data || {}

  const title = channel.name

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{title}</div>
          <div className="page-sub">
            {isLinkedIn
              ? 'LinkedIn delivery snapshot (GBP) + Salesforce-attributed funnel · FY2026'
              : isEmail
                ? 'Email engagement snapshot + Salesforce-attributed funnel · FY2026'
                : 'Channel totals + per-campaign drill-down · live from Salesforce · FY2026'}
          </div>
        </div>
        <QuarterPills />
      </div>

      {/* Campaign picker — current attributes from v_campaign_current */}
      <div className="filters">
        <div className="filter" style={{ minWidth: 300 }}>
          <span className="label">Campaign</span>
          <select value={campaign} onChange={(e) => setCampaign(e.target.value)}>
            <option value="all">All campaigns (aggregate)</option>
            {(campaignsQ.data || []).map((c) => (
              <option key={c.campaign_key} value={c.campaign_key}>
                {overrides[c.campaign_key]?.display_name || c.campaign_name || c.campaign_key}
              </option>
            ))}
          </select>
        </div>
        {!isLinkedIn && !isEmail && (
          <NotAvailable what="Spend / CTR / CPL" why="spend & impressions are 0; clicks not tracked" />
        )}
      </div>

      {/* LinkedIn GBP delivery snapshot (cumulative, single as-of date) */}
      {isLinkedIn && <LinkedInSnapshot />}

      {/* Email Pardot engagement snapshot (cumulative, single as-of date) */}
      {isEmail && <EmailEngagementSnapshot />}

      {/* Funnel volumes & pipeline (Salesforce-attributed, scoped by filters) */}
      {q.isLoading && <Loading />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && (
        <EmptyState message={`No ${title} data for this region / quarter yet — nothing to show.`} />
      )}
      {q.data && q.data.hasData && <Body data={q.data} isLinkedIn={isLinkedIn} isEmail={isEmail} />}

      {/* Current-quarter activity vs ongoing impact of earlier campaigns — same split as
          Pipeline/Events, scoped to THIS channel (G5: apply consistently across pages). */}
      {q.data && q.data.hasData && <CurrentVsOngoing channel={channel.name} />}
    </>
  )
}

// ---- LinkedIn delivery snapshot (GBP, cumulative-to-date) -----------------
function LinkedInSnapshot() {
  const [includePrior, setIncludePrior] = useState(false) // LI2 — show prior-year campaigns for context
  const s = useLinkedInSnapshot(includePrior)
  const ov = useCampaignOverrides().data || {} // hook before any early return (Rules of Hooks)
  if (s.isLoading) return <Loading label="Loading LinkedIn snapshot…" />
  if (s.isError) return <ErrorState error={s.error} />
  if (!s.data || !s.data.hasData)
    return <EmptyState message="No LinkedIn delivery snapshot for this region yet." />

  const { totals, campaigns, priorCampaigns = [], efficiency: eff } = s.data
  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : null
  // Per-€ metrics need 2 dp (eur() rounds to whole €, which would show CPC as "€3").
  const money2 = (v) => (isNA(v) || v == null ? 'n/a' : `€${Number(v).toFixed(2)}`)
  const roiStr = (v) => (isNA(v) || v == null ? 'n/a' : `${Number(v).toFixed(1)}×`)

  return (
    <>
      <div className="callout amber" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div className="callout-body">
          <strong>From the LinkedIn Ads export</strong> (report period 1 Jan – 9 Jul 2026), grouped into the{' '}
          <strong>three 2026 campaigns</strong> CWSI reports on (Protect Data · Microsoft E7 · Data That Moves —
          the Protect Data group includes its boost post). <strong>Budgets are the campaign budgets in EUR</strong>;
          spend is converted from GBP to EUR (fixed rate) and is separate from the EUR marketing budget. Use the
          toggle below to include prior-year LinkedIn campaigns for context. The quarter filter doesn't change this
          snapshot; the region filter does.
        </div>
      </div>

      {/* LI2 — prior-year campaigns available for context (default: 2026 only) */}
      <div className="filters" style={{ marginBottom: 14 }}>
        <label className="filter" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={includePrior} onChange={(e) => setIncludePrior(e.target.checked)} />
          <span className="label" style={{ marginLeft: 6 }}>Include prior-year campaigns (context)</span>
        </label>
      </div>

      <div className="kpis cols-4">
        <Kpi label="Budget Set (EUR)" val={isNA(totals.budget) ? 'n/a' : eur(totals.budget)} explainId="linkedinBudget" />
        <Kpi
          label="Budget Spent (EUR)"
          val={eur(totals.spend)}
          sub={isNA(totals.budget) ? undefined : `${pct(totals.spend, totals.budget)} of budget set`}
          explainId="linkedinSpend"
        />
        <Kpi label="Impressions" val={num(totals.impressions)} />
        <Kpi label="Clicks · CTR" val={`${num(totals.clicks)} · ${ctr == null ? 'n/a' : `${(ctr * 100).toFixed(2)}%`}`} />
      </div>

      {/* Efficiency — all live now that LinkedIn spend + SF-attributed pipeline/revenue
          are populated. CTR/CPC/CPM unambiguous; CPL on LinkedIn FORM leads; ROI on
          influenced pipeline (headline) with won revenue secondary. LinkedIn only —
          blended CPL/ROI across channels still needs per-channel spend mapping. */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">LinkedIn Efficiency — snapshot</div>
            <div className="panel-sub">
              CPC / CPM / CTR · CPL on form leads · ROI = SF-attributed pipeline (EUR) ÷ spend (EUR), lifetime, LinkedIn only
            </div>
          </div>
          <span className="chip blue">live</span>
        </div>
        <div className="panel-body">
          <div className="kpis cols-4" style={{ marginBottom: 0 }}>
            <Kpi label="CPC · cost per click" val={money2(eff?.cpc)} />
            <Kpi label="CPM · per 1,000 impr." val={money2(eff?.cpm)} />
            <Kpi label="CPL · per SF-linked lead" val={isNA(eff?.cplForm) ? 'n/a' : money2(eff?.cplForm)} />
            <Kpi label="CTR · click-through" val={isNA(eff?.ctr) ? 'n/a' : `${(eff.ctr * 100).toFixed(2)}%`} />
          </div>
          <div className="kpis cols-3" style={{ marginTop: 14, marginBottom: 0 }}>
            <RoiKpi
              label="ROI · influenced pipeline"
              explainId="linkedinRoi"
              val={roiStr(eff?.roiPipeline)}
              sub={isNA(eff?.pipeline) ? 'attribution pending' : `${eur(eff.pipeline)} pipeline ÷ ${eur(totals.spend)} spend`}
            />
            <RoiKpi
              label="ROI · won revenue"
              val={roiStr(eff?.roiRevenue)}
              sub={isNA(eff?.closedWon) ? 'attribution pending' : `${eur(eff.closedWon)} closed-won ÷ ${eur(totals.spend)} spend`}
            />
            <RoiKpi
              label="CPL basis"
              val={`${num(totals.leads)} SF-linked lead${totals.leads === 1 ? '' : 's'}`}
              sub="leads on each ad's linked Salesforce campaign (the LinkedIn form-lead feed isn't populated)"
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">LinkedIn Campaign Delivery — 2026</div>
            <div className="panel-sub">The 2026 campaigns from the LinkedIn Ads export · budget &amp; spend in EUR (converted from GBP) · CTR &amp; CPL derived · Leads from each ad's linked Salesforce campaign</div>
          </div>
          <span className="chip blue">{campaigns.length} campaigns</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Region</th>
                <th className="r">Budget (EUR)</th>
                <th className="r">Spend (EUR)</th>
                <th className="r">Used</th>
                <th className="r">Impr.</th>
                <th className="r">Clicks</th>
                <th className="r">CTR</th>
                <th className="r">Leads</th>
                <th className="r">CPL (EUR)</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.campaignKey}>
                  <td><EditableName campaignKey={c.campaignKey} value={ov[c.campaignKey]?.display_name} original={c.campaignName} /></td>
                  <td><EditableName campaignKey={c.campaignKey} field="display_region" value={ov[c.campaignKey]?.display_region} original={c.regionCode} /></td>
                  <td className="r mono">{isNA(c.budget) ? 'n/a' : eur(c.budget)}</td>
                  <td className="r mono">{eur(c.spend)}</td>
                  <td className="r mono mono-d">{isNA(c.budgetUsedPct) ? 'n/a' : `${(c.budgetUsedPct * 100).toFixed(0)}%`}</td>
                  <td className="r mono">{num(c.impressions)}</td>
                  <td className="r mono">{num(c.clicks)}</td>
                  <td className="r mono">{isNA(c.ctr) ? 'n/a' : `${(c.ctr * 100).toFixed(2)}%`}</td>
                  <td className="r mono">{num(c.leads)}</td>
                  <td className="r mono mono-d">{isNA(c.cpl) ? 'n/a' : money2(c.cpl)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={2}>Total · {campaigns.length} campaigns</td>
                <td className="r mono">{isNA(totals.budget) ? 'n/a' : eur(totals.budget)}</td>
                <td className="r mono">{eur(totals.spend)}</td>
                <td className="r mono mono-d">{isNA(totals.budget) || totals.budget === 0 ? 'n/a' : `${((totals.spend / totals.budget) * 100).toFixed(0)}%`}</td>
                <td className="r mono">{num(totals.impressions)}</td>
                <td className="r mono">{num(totals.clicks)}</td>
                <td className="r mono">{ctr == null ? 'n/a' : `${(ctr * 100).toFixed(2)}%`}</td>
                <td className="r mono">{num(totals.leads)}</td>
                <td className="r mono mono-d">{totals.leads > 0 ? money2(totals.spend / totals.leads) : 'n/a'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* LI2 — prior-year LinkedIn campaigns (context only; not in the 2026 totals above) */}
      {includePrior && priorCampaigns.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <div className="left">
              <div className="panel-title">Prior-year LinkedIn campaigns — context</div>
              <div className="panel-sub">Older campaigns from the delivery snapshot · spend in EUR · not part of the 2026 totals above</div>
            </div>
            <span className="chip neu">{priorCampaigns.length} campaigns</span>
          </div>
          <div className="panel-body no-pad">
            <table className="tbl">
              <thead>
                <tr><th>Campaign</th><th>Region</th><th className="r">Spend (EUR)</th><th className="r">Impr.</th><th className="r">Clicks</th></tr>
              </thead>
              <tbody>
                {priorCampaigns.map((c) => (
                  <tr key={c.campaignKey}>
                    <td>{c.campaignName}</td>
                    <td>{c.regionCode}</td>
                    <td className="r mono">{eur(c.spend)}</td>
                    <td className="r mono">{num(c.impressions)}</td>
                    <td className="r mono">{num(c.clicks)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

function Body({ data, isLinkedIn, isEmail }) {
  const { totals, campaigns } = data
  const ov = useCampaignOverrides().data || {}
  // L4 (Margot 14.07): leave the per-campaign commercial-outcomes (ROI) table blank on LinkedIn.
  // The Salesforce campaigns that map to the LinkedIn Paid channel aren't the paid-ad campaigns, so
  // attributing pipeline/revenue to individual LinkedIn ads is misleading. The reliable channel-level
  // figures (budget, spend, impressions, clicks, CTR, SF-linked leads, ROI) are in the snapshot above.
  if (isLinkedIn) {
    return (
      <>
        <div className="sec-divider"><span className="label">Commercial outcomes by campaign</span><div className="line" /></div>
        <div className="callout amber" style={{ marginBottom: 0 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
          <div className="callout-body">
            <strong>Left blank for now.</strong> We don't show a per-campaign ROI table here because the Salesforce
            campaigns mapped to the LinkedIn Paid channel aren't the paid advertising campaigns — so crediting pipeline
            or revenue to individual LinkedIn ads would be misleading. The reliable LinkedIn figures —{' '}
            <strong>budget set, budget spent, impressions, clicks, CTR, Salesforce-linked leads and channel ROI</strong> —
            are in the delivery &amp; efficiency snapshot above.
          </div>
        </div>
      </>
    )
  }
  return (
    <>
      {(isLinkedIn || isEmail) && (
        <div className="sec-divider">
          <span className="label">{isLinkedIn ? 'Commercial outcomes by campaign (Salesforce)' : 'Salesforce-attributed funnel (daily)'}</span>
          <div className="line" />
        </div>
      )}
      {isLinkedIn ? (
        // LI7 — the Salesforce-attributed Leads/MQL/SQL funnel isn't reliable for LinkedIn
        // (campaign-member inflation), so LinkedIn shows commercial OUTCOMES only.
        <div className="kpis cols-3">
          <Kpi label="Created Opps · current view" val={isNA(totals.createdOpps) ? '—' : num(totals.createdOpps)} explainId="createdOpps" />
          <Kpi label="Influenced Pipeline · current view" val={eur(totals.pipeline)} explainId="pipeline" />
          <Kpi label="Closed-Won € · current view" val={eur(totals.closedWon)} explainId="closedWon" />
        </div>
      ) : (
        <div className="kpis cols-4">
          <Kpi label="MQLs · current view" val={num(totals.mql)} explainId="mql" />
          <Kpi label="SQLs · current view" val={num(totals.sql)} explainId="sql" />
          <Kpi label="Created Opps · current view" val={isNA(totals.createdOpps) ? '—' : num(totals.createdOpps)} explainId="createdOpps" />
          <Kpi label="Influenced Pipeline · current view" val={eur(totals.pipeline)} explainId="pipeline" />
        </div>
      )}

      <div className="callout amber" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div className="callout-body">
          <strong>A note on campaign names &amp; the year in them.</strong> Some Salesforce campaigns are
          named after the year they launched (e.g. <em>“2024 …”</em>, <em>“2023 …”</em>) but are long-running
          and still active. <strong>The year in the name is just a label, not the period of the data.</strong>{' '}
          Every figure in this table is the campaign’s <strong>real 2026 activity only</strong> (Q1–Q2 2026,
          the current reporting window) — any earlier-year activity for the same campaign is excluded by the
          2026 scope. So a campaign named “2024 …” can correctly show 2026 numbers here.
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">{isLinkedIn ? 'Commercial Outcomes by Campaign (Salesforce)' : 'Campaign Performance'}</div>
            <div className="panel-sub">
              {isLinkedIn
                ? 'Created Opps / pipeline / closed-won per campaign · the Leads/MQL/SQL funnel is omitted (not reliable for LinkedIn) · spend lives in the snapshot above'
                : 'Per-campaign drill-down · campaign names from Salesforce'}
            </div>
          </div>
          <span className="chip blue">{campaigns.length} campaigns</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Region</th>
                {!isLinkedIn && !isEmail && <th className="r">Spend</th>}
                {!isLinkedIn && !isEmail && <th className="r">Impr.</th>}
                {!isLinkedIn && <th className="r">MQLs <Explain id="mql" /></th>}
                {!isLinkedIn && <th className="r">SQLs <Explain id="sql" /></th>}
                <th className="r">Created Opps <Explain id="createdOpps" /></th>
                <th className="r">Open Pipeline € <Explain id="pipeline" /></th>
                <th className="r">Closed-Won € <Explain id="closedWon" /></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.campaignKey || c.campaignName}>
                  <td><EditableName campaignKey={c.campaignKey} value={ov[c.campaignKey]?.display_name} original={c.campaignName} /></td>
                  <td><EditableName campaignKey={c.campaignKey} field="display_region" value={ov[c.campaignKey]?.display_region} original={c.regionCode} /></td>
                  {!isLinkedIn && !isEmail && <td className="r mono mono-d">{isNA(c.spend) ? 'n/a' : gbp(c.spend)}</td>}
                  {!isLinkedIn && !isEmail && <td className="r mono mono-d">{isNA(c.impressions) ? 'n/a' : num(c.impressions)}</td>}
                  {!isLinkedIn && <td className="r mono">{num(c.mql)}</td>}
                  {!isLinkedIn && <td className="r mono">{num(c.sql)}</td>}
                  <td className="r mono">{num(c.createdOpps)}</td>
                  <td className="r mono">{eur(c.pipeline)}</td>
                  <td className="r mono">{eur(c.closedWon)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total · {campaigns.length} campaigns</td>
                <td />
                {!isLinkedIn && !isEmail && <td className="r mono mono-d">n/a</td>}
                {!isLinkedIn && !isEmail && <td className="r mono mono-d">n/a</td>}
                {!isLinkedIn && <td className="r mono">{num(totals.mql)}</td>}
                {!isLinkedIn && <td className="r mono">{num(totals.sql)}</td>}
                <td className="r mono">{isNA(totals.createdOpps) ? '—' : num(totals.createdOpps)}</td>
                <td className="r mono">{eur(campaigns.reduce((a, c) => a + (Number(c.pipeline) || 0), 0))}</td>
                <td className="r mono">{eur(totals.closedWon)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {isLinkedIn && (
        <div className="callout" style={{ marginBottom: 0 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="callout-body">
            <strong>Why no Leads / MQL / SQL funnel here?</strong> On LinkedIn those Salesforce-attributed counts
            came from campaign membership and read unrealistically high, so — per your feedback — we've removed the
            attributed funnel and show only the commercial outcomes we can stand behind: <strong>Created
            Opportunities, pipeline and closed-won</strong>. Delivery metrics (spend / impressions / clicks / CTR /
            CPC / CPM / ROI) are in the snapshot above.
          </div>
        </div>
      )}

      {!isLinkedIn && !isEmail && (
        <div className="callout" style={{ marginBottom: 0 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="callout-body">
            Conversion / CTR / CPL panels render once <strong>spend, impressions and clicks</strong>{' '}
            are available for this channel. Funnel volumes &amp; pipeline above are live.
          </div>
        </div>
      )}

      {isEmail && (
        <div className="callout" style={{ marginBottom: 0 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="callout-body">
            Email mainly drives <strong>top-of-funnel leads</strong>, so pipeline and closed-won attributed
            <em> directly</em> to email is small — and can read <strong>€0</strong> in a single quarter (a real
            zero, not missing data; those leads usually convert under other channels or later). Switch to{' '}
            <strong>YTD</strong> for the fuller picture.
          </div>
        </div>
      )}
    </>
  )
}

// ---- Email Pardot engagement snapshot (cumulative-to-date) ----------------
function EmailEngagementSnapshot() {
  const s = useEmailEngagement()
  if (s.isLoading) return <Loading label="Loading email engagement…" />
  if (s.isError) return <ErrorState error={s.error} />
  if (!s.data || !s.data.hasData)
    return (
      <EmptyState message="No 2026 email-send data in Salesforce for this scope. Email send counts are only recorded on older (pre-2026) campaigns, which are excluded from this 2026 view; no 2026 email campaign has a send count recorded." />
    )

  const { totals, campaigns, snapshotDate } = s.data

  return (
    <>
      <div className="callout amber" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div className="callout-body">
          <strong>Emails sent</strong> — cumulative snapshot from Salesforce (campaign send count,
          as of <strong>{snapshotDate}</strong>), <strong>not a day-by-day trend</strong>. Region is parsed from the
          campaign name (best-effort); the quarter filter doesn't change this snapshot; the region filter does.{' '}
          <strong>Open rate, CTR, delivered and unsubscribe are not available</strong> — our current email setup
          doesn't report opens/clicks/unsubscribes, so those show <strong>n/a</strong>.
        </div>
      </div>

      <div className="kpis cols-4">
        <Kpi label="Emails sent · snapshot" val={num(totals.sent)} />
        <Kpi label="Delivered · snapshot" val={`${num(totals.delivered)} · ${rateStr(totals.deliveryRate)}`} />
        <Kpi label="Open rate · snapshot" val={rateStr(totals.openRate)} />
        <Kpi label="Click rate (CTR) · snapshot" val={rateStr(totals.ctr)} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Email Campaign Engagement — snapshot</div>
            <div className="panel-sub">Per-campaign emails sent · open-rate / CTR / delivered n/a (not available from the current email setup)</div>
          </div>
          <span className="chip blue">{campaigns.length} campaigns</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Region</th>
                <th className="r">Sent</th>
                <th className="r">Delivered</th>
                <th className="r">Opens</th>
                <th className="r">Open rate</th>
                <th className="r">Clicks</th>
                <th className="r">CTR</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.campaignKey}>
                  <td>{c.campaignName}</td>
                  <td>{c.regionCode}</td>
                  <td className="r mono">{num(c.sent)}</td>
                  <td className="r mono">{num(c.delivered)}</td>
                  <td className="r mono">{num(c.opens)}</td>
                  <td className="r mono">{rateStr(c.openRate)}</td>
                  <td className="r mono">{num(c.clicks)}</td>
                  <td className="r mono mono-d">{rateStr(c.ctr)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={2}>Total · {campaigns.length} campaigns</td>
                <td className="r mono">{num(totals.sent)}</td>
                <td className="r mono">{num(totals.delivered)}</td>
                <td className="r mono">{num(totals.opens)}</td>
                <td className="r mono">{rateStr(totals.openRate)}</td>
                <td className="r mono">{num(totals.clicks)}</td>
                <td className="r mono mono-d">{rateStr(totals.ctr)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

const Kpi = ({ label, val, explainId }) => (
  <div className="kpi">
    <div className="kpi-label">{label}{explainId && <Explain id={explainId} />}</div>
    <div className="kpi-val">{val}</div>
  </div>
)

const RoiKpi = ({ label, val, sub, explainId }) => (
  <div className="kpi">
    <div className="kpi-label">{label}{explainId && <Explain id={explainId} />}</div>
    <div className="kpi-val">{val}</div>
    <div className="kpi-sub"><span className="kpi-target">{sub}</span></div>
  </div>
)
