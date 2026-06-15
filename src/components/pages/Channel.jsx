import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState, NotAvailable } from '../States'
import { useChannel, useCampaigns, useLinkedInSnapshot } from '../../hooks/useDashboardData'
import { useFilters } from '../../filters/FilterContext'
import { gbp, num, pct, isNA } from '../../data/format'

// One component drives all six channel pages. `channel` is {id,name,page}.
// LinkedIn Paid (id 2) additionally renders a GBP delivery SNAPSHOT.
export default function Channel({ channel }) {
  const q = useChannel(channel.name)
  const campaignsQ = useCampaigns(channel.id)
  const { filters, setCampaign } = useFilters()
  const isLinkedIn = channel.id === 2

  const title = channel.name

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{title}</div>
          <div className="page-sub">
            {isLinkedIn
              ? 'LinkedIn delivery snapshot (GBP) + Salesforce-attributed funnel · FY2026'
              : 'Channel totals + per-campaign drill-down · live from v_fact_enriched · FY2026'}
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
        {!isLinkedIn && (
          <NotAvailable what="Spend / CTR / CPL" why="spend & impressions are 0; clicks not in view" />
        )}
      </div>

      {/* LinkedIn GBP delivery snapshot (cumulative, single as-of date) */}
      {isLinkedIn && <LinkedInSnapshot />}

      {/* Funnel volumes & pipeline (Salesforce-attributed, scoped by filters) */}
      {q.isLoading && <Loading />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && (
        <EmptyState message={`No ${title} rows for this region / quarter yet — nothing to show.`} />
      )}
      {q.data && q.data.hasData && <Body data={q.data} isLinkedIn={isLinkedIn} />}
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

  const { totals, campaigns, snapshotDate } = s.data
  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : null

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

function Body({ data, isLinkedIn }) {
  const { totals, campaigns } = data
  return (
    <>
      {isLinkedIn && (
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
                : 'Per-campaign drill-down · names from v_campaign_current'}
            </div>
          </div>
          <span className="chip blue">{campaigns.length} campaigns</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Campaign</th>
                {!isLinkedIn && <th className="r">Spend</th>}
                {!isLinkedIn && <th className="r">Impr.</th>}
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
                  {!isLinkedIn && <td className="r mono mono-d">{isNA(c.spend) ? 'n/a' : gbp(c.spend)}</td>}
                  {!isLinkedIn && <td className="r mono mono-d">{isNA(c.impressions) ? 'n/a' : num(c.impressions)}</td>}
                  <td className="r mono">{num(c.leads)}</td>
                  <td className="r mono">{num(c.mql)}</td>
                  <td className="r mono">{num(c.sql)}</td>
                  <td className="r mono">{gbp(c.pipeline)}</td>
                  <td className="r mono">{gbp(c.closedWon)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total · {campaigns.length} campaigns</td>
                {!isLinkedIn && <td className="r mono mono-d">n/a</td>}
                {!isLinkedIn && <td className="r mono mono-d">n/a</td>}
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

      {!isLinkedIn && (
        <div className="callout" style={{ marginBottom: 0 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div className="callout-body">
            Conversion / CTR / CPL panels render once <strong>spend, impressions and clicks</strong>{' '}
            land in <code>v_fact_enriched</code> for this channel. Funnel volumes &amp; pipeline above are live.
          </div>
        </div>
      )}
    </>
  )
}

const Kpi = ({ label, val }) => (
  <div className="kpi">
    <div className="kpi-label">{label}</div>
    <div className="kpi-val">{val}</div>
  </div>
)
