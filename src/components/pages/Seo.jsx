import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useWebTraffic, useSeo, useChannel } from '../../hooks/useDashboardData'
import { num, gbp, isNA } from '../../data/format'

const ratePct = (r, d = 1) => (isNA(r) || r == null ? 'n/a' : `${(r * 100).toFixed(d)}%`)
const pos = (p) => (isNA(p) || p == null ? 'n/a' : Number(p).toFixed(1))
// Shorten a full URL to its path for the top-pages table.
const pagePath = (u) => {
  try {
    const { pathname } = new URL(u)
    return pathname === '/' ? '/ (home)' : pathname
  } catch {
    return u
  }
}

// Organic SEO — GA4 website traffic + Search Console search performance, plus
// the Salesforce-attributed funnel for the channel. Traffic & search are live;
// GA4 key events (conversions) are 0 everywhere → shown as "pending".
export default function Seo() {
  const web = useWebTraffic()
  const seo = useSeo()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Organic SEO</div>
          <div className="page-sub">
            GA4 website traffic + Search Console search performance · live · FY2026
          </div>
        </div>
        <QuarterPills />
      </div>

      <div className="callout" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          <strong>Sessions &amp; engagement</strong> come from GA4 (owned properties only — dev,
          staging, translate-proxy and form-preview hosts are excluded). <strong>Clicks,
          impressions, CTR and position</strong> come from Search Console. <strong>Key events</strong>{' '}
          (GA4 conversions) feed the <strong>Visitor → MQL</strong> tile. Region &amp; quarter scope every figure.
        </div>
      </div>

      {/* GA4 website traffic */}
      <div className="sec-divider"><span className="label">Website traffic · GA4</span><div className="line" /></div>
      {web.isLoading && <Loading label="Loading GA4 traffic…" />}
      {web.isError && <ErrorState error={web.error} />}
      {web.data && !web.data.hasData && <EmptyState message="No GA4 traffic for this region / quarter yet." />}
      {web.data && web.data.hasData && <WebBody data={web.data} />}

      {/* Search Console */}
      <div className="sec-divider" style={{ marginTop: 22 }}><span className="label">Search performance · Search Console</span><div className="line" /></div>
      {seo.isLoading && <Loading label="Loading Search Console…" />}
      {seo.isError && <ErrorState error={seo.error} />}
      {seo.data && !seo.data.hasData && <EmptyState message="No Search Console data for this region / quarter yet." />}
      {seo.data && seo.data.hasData && <SeoBody data={seo.data} />}

      {/* Salesforce-attributed funnel for the channel */}
      <div className="sec-divider" style={{ marginTop: 22 }}><span className="label">Salesforce-attributed funnel</span><div className="line" /></div>
      <FunnelBody />
    </>
  )
}

function WebBody({ data }) {
  const { totals, byHostname, byRegion, dateRange } = data
  return (
    <>
      <div className="kpis cols-4">
        <Kpi label="Sessions · scoped" val={num(totals.sessions)} sub={dateRange.min ? `${dateRange.min} → ${dateRange.max}` : ''} />
        <Kpi label="Engaged sessions" val={num(totals.engaged)} />
        <Kpi label="Engagement rate" val={ratePct(totals.engagementRate)} />
        <Kpi
          label="Visitor → MQL · GA4 conv."
          val={isNA(totals.keyEvents) ? '—' : num(totals.keyEvents)}
          sub={isNA(totals.keyEvents) || !totals.sessions ? '' : `${((totals.keyEvents / totals.sessions) * 100).toFixed(2)}% of sessions`}
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Traffic by Property</div>
            <div className="panel-sub">Owned hostnames · sessions &amp; engagement · region/quarter scoped</div>
          </div>
          <span className="chip blue">{byHostname.length} properties</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr><th>Property (hostname)</th><th className="r">Sessions</th><th className="r">Engaged</th><th className="r">Engagement %</th></tr>
            </thead>
            <tbody>
              {byHostname.map((h) => (
                <tr key={h.hostname}>
                  <td>{h.hostname}</td>
                  <td className="r mono">{num(h.sessions)}</td>
                  <td className="r mono">{num(h.engaged)}</td>
                  <td className="r mono">{h.sessions ? `${((h.engaged / h.sessions) * 100).toFixed(1)}%` : 'n/a'}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total · {byHostname.length} properties</td>
                <td className="r mono">{num(totals.sessions)}</td>
                <td className="r mono">{num(totals.engaged)}</td>
                <td className="r mono">{ratePct(totals.engagementRate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {byRegion.length > 1 && (
        <div className="info-pill" style={{ marginBottom: 18 }}>
          By region: {byRegion.map((r) => `${r.region === 'UNASSIGNED' ? 'Other' : r.region} ${num(r.sessions)}`).join(' · ')}
          {' '}— main-domain traffic GA4 can’t country-split lands in “Other”.
        </div>
      )}
    </>
  )
}

function SeoBody({ data }) {
  const { totals, topPages, topQueries = [] } = data
  return (
    <>
      <div className="kpis cols-4">
        <Kpi label="Clicks · scoped" val={num(totals.clicks)} />
        <Kpi label="Impressions · scoped" val={num(totals.impressions)} />
        <Kpi label="CTR" val={ratePct(totals.ctr, 2)} />
        <Kpi label="Avg. position" val={pos(totals.avgPosition)} sub="lower is better" />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Top Organic Pages</div>
            <div className="panel-sub">By clicks · Search Console · quarter-scoped (page grain has no region)</div>
          </div>
          <span className="chip blue">top {topPages.length}</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr><th>Page</th><th className="r">Clicks</th><th className="r">Impr.</th><th className="r">CTR</th><th className="r">Avg. pos.</th></tr>
            </thead>
            <tbody>
              {topPages.map((p) => (
                <tr key={p.page}>
                  <td title={p.page}>{pagePath(p.page)}</td>
                  <td className="r mono">{num(p.clicks)}</td>
                  <td className="r mono">{num(p.impressions)}</td>
                  <td className="r mono">{ratePct(p.ctr, 2)}</td>
                  <td className="r mono">{pos(p.avgPosition)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {topQueries.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <div className="left">
              <div className="panel-title">Top Keywords</div>
              <div className="panel-sub">By clicks · Search Console query data · quarter-scoped (query grain has no region)</div>
            </div>
            <span className="chip blue">top {topQueries.length}</span>
          </div>
          <div className="panel-body no-pad">
            <table className="tbl">
              <thead>
                <tr><th>Keyword</th><th className="r">Clicks</th><th className="r">Impr.</th><th className="r">CTR</th><th className="r">Avg. pos.</th></tr>
              </thead>
              <tbody>
                {topQueries.map((q) => (
                  <tr key={q.query}>
                    <td>{q.query}</td>
                    <td className="r mono">{num(q.clicks)}</td>
                    <td className="r mono">{num(q.impressions)}</td>
                    <td className="r mono">{ratePct(q.ctr, 2)}</td>
                    <td className="r mono">{pos(q.avgPosition)}</td>
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

// Salesforce-attributed funnel for the Organic SEO channel (leads/MQL/SQL/pipeline).
function FunnelBody() {
  const q = useChannel('Organic SEO')
  if (q.isLoading) return <Loading label="Loading funnel…" />
  if (q.isError) return <ErrorState error={q.error} />
  if (!q.data || !q.data.hasData)
    return <EmptyState message="No Salesforce-attributed Organic SEO rows for this region / quarter yet." />
  const t = q.data.totals
  return (
    <div className="kpis cols-4">
      <Kpi label="Leads · scoped" val={num(t.leads)} />
      <Kpi label="MQLs · scoped" val={num(t.mql)} />
      <Kpi label="SQLs · scoped" val={num(t.sql)} />
      <Kpi label="Pipeline £ · scoped" val={gbp(t.pipeline)} />
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
