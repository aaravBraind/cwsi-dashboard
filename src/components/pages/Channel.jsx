import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState, NotAvailable } from '../States'
import { useChannel, useCampaigns, useLinkedInSnapshot, useEmailEngagement } from '../../hooks/useDashboardData'
import { useFilters } from '../../filters/FilterContext'
import { gbp, num, pct, isNA } from '../../data/format'

const rateStr = (v) => (isNA(v) || v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`)

// One component drives all six channel pages. `channel` is {id,name,page}.
// LinkedIn Paid (id 2) additionally renders a GBP delivery SNAPSHOT.
// Email (id 5) additionally renders a Pardot engagement SNAPSHOT.
export default function Channel({ channel }) {
  const q = useChannel(channel.name)
  const campaignsQ = useCampaigns(channel.id)
  const { filters, setCampaign } = useFilters()
  const isLinkedIn = channel.id === 2
  const isEmail = channel.id === 5

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
                ? 'Email engagement snapshot (Pardot) + Salesforce-attributed funnel · FY2026'
                : 'Channel totals + per-campaign drill-down · live from Salesforce · FY2026'}
          </div>
        </div>
        <QuarterPills />
      </div>

      {/* Campaign picker — current attributes from v_campaign_current */}
      <div className="filters">
        <div className="filter" style={{ minWidth: 300 }}>
          <span className="label">Campaign</span>
          <select value={filters.campaign} onChange={(e) => setCampaign(e.target.value)}>
            <option value="all">All campaigns (aggregate)</option>
            {(campaignsQ.data || []).map((c) => (
              <option key={c.campaign_key} value={c.campaign_key}>
                {c.campaign_name || c.campaign_key}
              </option>
            ))}
          </select>
        </div>
        {!isLinkedIn && !isEmail && (
          <NotAvailable what="Spend / CTR / CPL" why="spend & impressions are 0; clicks not in view" />
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
        <EmptyState message={`No ${title} rows for this region / quarter yet — nothing to show.`} />
      )}
      {q.data && q.data.hasData && <Body data={q.data} isLinkedIn={isLinkedIn} isEmail={isEmail} />}
    </>
  )
}

// ---- LinkedIn delivery snapshot (GBP, cumulative-to-date) -----------------
function LinkedInSnapshot() {
  const s = useLinkedInSnapshot()
  if (s.isLoading) return <Loading label="Loading LinkedIn snapshot…" />
  if (s.isError) return <ErrorState error={s.error} />
  if (!s.data || !s.data.hasData)
    return <EmptyState message="No LinkedIn delivery snapshot for this region yet." />

  const { totals, campaigns, snapshotDate, efficiency: eff } = s.data
  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : null
  // Per-£ metrics need 2 dp (gbp() rounds to whole £, which would show CPC as "£3").
  const money2 = (v) => (isNA(v) || v == null ? 'n/a' : `£${Number(v).toFixed(2)}`)
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
          <strong>Cumulative lifetime snapshot</strong> from the LinkedIn report (as of{' '}
          <strong>{snapshotDate}</strong>) — current totals, <strong>not a daily series</strong>.
          Spend is <strong>GBP</strong> and is never added to the EUR marketing budget. Quarter
          filter does not slice this snapshot; region does.
        </div>
      </div>

      <div className="kpis cols-4">
        <Kpi label="Spend · snapshot (GBP)" val={gbp(totals.spend)} />
        <Kpi label="Impressions · snapshot" val={num(totals.impressions)} />
        <Kpi label="Clicks · snapshot" val={num(totals.clicks)} />
        <Kpi label="CTR · snapshot" val={ctr == null ? 'n/a' : `${(ctr * 100).toFixed(2)}%`} />
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
              CPC / CPM / CTR · CPL on form leads · ROI = SF-attributed pipeline ÷ spend (GBP, lifetime, LinkedIn only)
            </div>
          </div>
          <span className="chip blue">live</span>
        </div>
        <div className="panel-body">
          <div className="kpis cols-4" style={{ marginBottom: 0 }}>
            <Kpi label="CPC · cost per click" val={money2(eff?.cpc)} />
            <Kpi label="CPM · per 1,000 impr." val={money2(eff?.cpm)} />
            <Kpi label="CPL · per form lead" val={isNA(eff?.cplForm) ? 'n/a' : gbp(eff?.cplForm)} />
            <Kpi label="CTR · click-through" val={isNA(eff?.ctr) ? 'n/a' : `${(eff.ctr * 100).toFixed(2)}%`} />
          </div>
          <div className="kpis cols-3" style={{ marginTop: 14, marginBottom: 0 }}>
            <RoiKpi
              label="ROI · influenced pipeline"
              val={roiStr(eff?.roiPipeline)}
              sub={isNA(eff?.pipeline) ? 'attribution pending' : `${gbp(eff.pipeline)} pipeline ÷ ${gbp(totals.spend)} spend`}
            />
            <RoiKpi
              label="ROI · won revenue"
              val={roiStr(eff?.roiRevenue)}
              sub={isNA(eff?.closedWon) ? 'attribution pending' : `${gbp(eff.closedWon)} closed-won ÷ ${gbp(totals.spend)} spend`}
            />
            <RoiKpi
              label="CPL basis"
              val={`${num(totals.leads)} form leads`}
              sub="native LinkedIn conversions — not broad SF-attributed leads"
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">LinkedIn Campaign Delivery — snapshot</div>
            <div className="panel-sub">Per-campaign cumulative totals · spend in GBP · CTR &amp; CPL derived</div>
          </div>
          <span className="chip blue">{campaigns.length} campaigns</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Region</th>
                <th className="r">Spend (GBP)</th>
                <th className="r">Impr.</th>
                <th className="r">Clicks</th>
                <th className="r">CTR</th>
                <th className="r">Leads</th>
                <th className="r">CPL (GBP)</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.campaignKey}>
                  <td>{c.campaignName}</td>
                  <td>{c.regionCode}</td>
                  <td className="r mono">{gbp(c.spend)}</td>
                  <td className="r mono">{num(c.impressions)}</td>
                  <td className="r mono">{num(c.clicks)}</td>
                  <td className="r mono">{isNA(c.ctr) ? 'n/a' : `${(c.ctr * 100).toFixed(2)}%`}</td>
                  <td className="r mono">{num(c.leads)}</td>
                  <td className="r mono mono-d">{isNA(c.cpl) ? 'n/a' : gbp(c.cpl)}</td>
                </tr>
              ))}
              <tr className="total">
                <td colSpan={2}>Total · {campaigns.length} campaigns</td>
                <td className="r mono">{gbp(totals.spend)}</td>
                <td className="r mono">{num(totals.impressions)}</td>
                <td className="r mono">{num(totals.clicks)}</td>
                <td className="r mono">{ctr == null ? 'n/a' : `${(ctr * 100).toFixed(2)}%`}</td>
                <td className="r mono">{num(totals.leads)}</td>
                <td className="r mono mono-d">{totals.leads > 0 ? gbp(totals.spend / totals.leads) : 'n/a'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function Body({ data, isLinkedIn, isEmail }) {
  const { totals, campaigns } = data
  return (
    <>
      {(isLinkedIn || isEmail) && (
        <div className="sec-divider">
          <span className="label">Salesforce-attributed funnel (daily)</span>
          <div className="line" />
        </div>
      )}
      <div className="kpis cols-4">
        <Kpi label="Leads · scoped" val={num(totals.leads)} />
        <Kpi label="MQLs · scoped" val={num(totals.mql)} />
        <Kpi label="SQLs · scoped" val={num(totals.sql)} />
        <Kpi label="Pipeline £ · scoped" val={gbp(totals.pipeline)} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">{isLinkedIn ? 'Funnel by Campaign (Salesforce)' : 'Campaign Performance'}</div>
            <div className="panel-sub">
              {isLinkedIn
                ? 'Leads / MQL / SQL / pipeline attributed in Salesforce · spend lives in the snapshot above'
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
                {!isLinkedIn && !isEmail && <th className="r">Spend</th>}
                {!isLinkedIn && !isEmail && <th className="r">Impr.</th>}
                <th className="r">Leads</th>
                <th className="r">MQLs</th>
                <th className="r">SQLs</th>
                <th className="r">Pipeline £</th>
                <th className="r">Closed-Won £</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.campaignKey || c.campaignName}>
                  <td>{c.campaignName}</td>
                  {!isLinkedIn && !isEmail && <td className="r mono mono-d">{isNA(c.spend) ? 'n/a' : gbp(c.spend)}</td>}
                  {!isLinkedIn && !isEmail && <td className="r mono mono-d">{isNA(c.impressions) ? 'n/a' : num(c.impressions)}</td>}
                  <td className="r mono">{num(c.leads)}</td>
                  <td className="r mono">{num(c.mql)}</td>
                  <td className="r mono">{num(c.sql)}</td>
                  <td className="r mono">{gbp(c.pipeline)}</td>
                  <td className="r mono">{gbp(c.closedWon)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total · {campaigns.length} campaigns</td>
                {!isLinkedIn && !isEmail && <td className="r mono mono-d">n/a</td>}
                {!isLinkedIn && !isEmail && <td className="r mono mono-d">n/a</td>}
                <td className="r mono">{num(totals.leads)}</td>
                <td className="r mono">{num(totals.mql)}</td>
                <td className="r mono">{num(totals.sql)}</td>
                <td className="r mono">{gbp(totals.pipeline)}</td>
                <td className="r mono">{gbp(totals.closedWon)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

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
            <em> directly</em> to email is small — and can read <strong>£0</strong> in a single quarter (a real
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
      <EmptyState message="No email snapshot for this region yet — re-import & run the Salesforce workflow to populate emails-sent." />
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
          as of <strong>{snapshotDate}</strong>), <strong>not a daily series</strong>. Region is parsed from the
          campaign name (best-effort); quarter does not slice this snapshot, region does.{' '}
          <strong>Open rate, CTR, delivered and unsubscribe are not available</strong> — this Salesforce org
          has no Account Engagement (Pardot) objects, so those show <strong>n/a</strong>.
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
            <div className="panel-sub">Per-campaign emails sent · open-rate / CTR / delivered n/a (not in this SF org)</div>
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

const Kpi = ({ label, val }) => (
  <div className="kpi">
    <div className="kpi-label">{label}</div>
    <div className="kpi-val">{val}</div>
  </div>
)

const RoiKpi = ({ label, val, sub }) => (
  <div className="kpi">
    <div className="kpi-label">{label}</div>
    <div className="kpi-val">{val}</div>
    <div className="kpi-sub"><span className="kpi-target">{sub}</span></div>
  </div>
)
