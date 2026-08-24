import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useWebTraffic, useSeo, useChannel } from '../../hooks/useDashboardData'
import { num, eur, isNA } from '../../data/format'
import Explain from '../Explain'
import { useFilters } from '../../filters/FilterContext'
import CurrentVsOngoing from '../CurrentVsOngoing'

const ratePct = (r, d = 1) => (isNA(r) || r == null ? 'n/a' : `${(r * 100).toFixed(d)}%`)
// W8 (Margot): on this page a missing funnel figure is a MEASURED ZERO ("I know that no
// opportunities have been created — show a zero rather than a dash"), so counts render 0
// and money renders €0 instead of "—". Genuinely-unmeasured feeds (e.g. page views before
// the GA4 refresh) still say so in words rather than faking a number.
const zn = (v) => (isNA(v) || v == null ? '0' : num(v))
const ze = (v) => (isNA(v) || v == null ? eur(0) : eur(v))
const pos = (p) => (isNA(p) || p == null ? 'n/a' : Number(p).toFixed(1))
// Avg session duration (seconds) → "Xm Ys" / "Ys".
const dur = (s) => {
  if (isNA(s) || s == null) return '—'
  const t = Math.round(Number(s) || 0)
  const m = Math.floor(t / 60)
  return m > 0 ? `${m}m ${t % 60}s` : `${t}s`
}
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
          <strong>One lead funnel, one traffic view.</strong> The <strong>funnel below</strong> covers every
          Salesforce opportunity attributed to organic search — including older campaigns whose deals are only
          converting now — and is the same figure the Overview and Board report for this channel.{' '}
          <strong>GA4 traffic</strong> (sessions, page views, users) and <strong>Search Console</strong> (clicks,
          search impressions, position) are shown below it as website <em>traffic &amp; search</em> signals.
          Region &amp; quarter scope every figure.
          <br /><strong>Which domains are covered:</strong> GA4 traffic covers <strong>both sites</strong> —
          cwsisecurity.com (the main site) and insights.cwsisecurity.com (the campaign site) — for{' '}
          <strong>all quarters</strong>, split per property in the table below. <strong>Search Console</strong> figures come from the
          <strong> cwsisecurity.com domain property</strong>. A separate property for{' '}
          <strong>insights.cwsisecurity.com</strong> was added on 24 Aug so the campaign site can be reported on its
          own; it collects from that day forward (Google doesn't backfill). The two are reported separately, never
          added together, because a domain property is expected to already include its subdomains — we'll confirm
          that against the data once both have overlapping days.
        </div>
      </div>

      {/* ONE Salesforce funnel on this page (20 Aug) — the whole organic channel, which is
          the same figure the Overview and Board report for Organic SEO. */}
      <div className="sec-divider"><span className="label">Organic search results · Salesforce</span><div className="line" /></div>
      <FunnelBody />

      {/* GA4 website traffic */}
      <div className="sec-divider" style={{ marginTop: 22 }}><span className="label">Website traffic · GA4</span><div className="line" /></div>
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

    </>
  )
}

function WebBody({ data }) {
  const { totals, byHostname } = data
  return (
    <>
      {/* SEO2 + W8 (Margot): the preferred website metrics — Page Views join Sessions,
          Users, Avg Session Duration and Bounce Rate ("I'd prefer to see page views here"). */}
      <div className="kpis cols-5">
        <Kpi label="Page views" val={isNA(totals.pageViews) ? '—' : num(totals.pageViews)} sub={isNA(totals.pageViews) ? 'after next GA4 refresh' : ''} explainId="organicTraffic" />
        <Kpi label="Sessions" val={num(totals.sessions)} explainId="organicTraffic" />
        <Kpi label="Users" val={isNA(totals.users) ? '—' : num(totals.users)} sub={isNA(totals.users) ? 'after next GA4 refresh' : ''} explainId="organicTraffic" />
        <Kpi label="Avg session duration" val={dur(totals.avgSessionDuration)} sub={isNA(totals.avgSessionDuration) ? 'after next GA4 refresh' : ''} explainId="organicTraffic" />
        <Kpi label="Bounce rate" val={ratePct(totals.bounceRate)} explainId="organicTraffic" />
      </div>
      {/* The GA4 key-events / on-site conversion tile was removed on 20 Aug: conversion
          tracking is not configured on the sites, so the figure could not be trusted. */}
      <div className="kpis cols-2" style={{ marginTop: 12 }}>
        <Kpi label="Engaged sessions" val={num(totals.engaged)} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Traffic by Property</div>
            <div className="panel-sub">Our public sites · sessions · users · avg duration · bounce · region &amp; quarter</div>
          </div>
          <span className="chip blue">{byHostname.length} properties</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr><th>Property (hostname)</th><th className="r">Page views</th><th className="r">Sessions</th><th className="r">Users</th><th className="r">Avg duration</th><th className="r">Bounce %</th></tr>
            </thead>
            <tbody>
              {byHostname.map((h) => (
                <tr key={h.hostname}>
                  <td>{h.hostname}</td>
                  <td className="r mono">{isNA(h.pageViews) ? '—' : num(h.pageViews)}</td>
                  <td className="r mono">{num(h.sessions)}</td>
                  <td className="r mono">{isNA(h.users) ? '—' : num(h.users)}</td>
                  <td className="r mono">{dur(h.avgSessionDuration)}</td>
                  <td className="r mono">{ratePct(h.bounceRate)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total · {byHostname.length} properties</td>
                <td className="r mono">{isNA(totals.pageViews) ? '—' : num(totals.pageViews)}</td>
                <td className="r mono">{num(totals.sessions)}</td>
                <td className="r mono">{isNA(totals.users) ? '—' : num(totals.users)}</td>
                <td className="r mono">{dur(totals.avgSessionDuration)}</td>
                <td className="r mono">{ratePct(totals.bounceRate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </>
  )
}

function RegionNote() {
  const { filters } = useFilters()
  if (!filters.region || filters.region === 'all') return null
  return (
    <p className="panel-note" style={{ padding: '0 4px 10px', fontSize: 12, opacity: 0.75 }}>
      <strong>Not split by region.</strong> Search Console reports pages and keywords for the whole property, with
      no country breakdown at that level, so these two tables show the same rows under every regional tab. The
      traffic figures above <em>are</em> region-split.
    </p>
  )
}

function SeoBody({ data }) {
  // SEO6 (Margot, Jul 2026): the GA4-vs-GSC discrepancy confused the read, so the
  // Search Console section is trimmed to Top Performing Pages (+ top-10 keywords).
  // The summary clicks/impressions/CTR/position tiles are dropped here.
  const { topPages, topQueries = [] } = data
  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Top Organic Pages</div>
            <div className="panel-sub">Page views and visits from Google search · cwsisecurity.com property</div>
          </div>
          <span className="chip blue">top {topPages.length}</span>
        </div>
        <div className="panel-body no-pad">
          <RegionNote />
          <table className="tbl">
            <thead>
              <tr>
                <th>Page</th>
                <th className="r">Page views</th>
                <th className="r">Visits from search</th>
                <th className="r">Avg. pos.</th>
              </tr>
            </thead>
            <tbody>
              {topPages.map((p) => (
                <tr key={p.page}>
                  <td title={p.page}>{pagePath(p.page)}</td>
                  <td className="r mono">{p.pageViews == null ? '—' : num(p.pageViews)}</td>
                  <td className="r mono">{num(p.clicks)}</td>
                  <td className="r mono">{pos(p.avgPosition)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="panel-note" style={{ padding: '8px 4px 0', fontSize: 12, opacity: 0.7 }}>
            <strong>Page views</strong> are actual visits to the page from organic search;{' '}
            <strong>visits from search</strong> is Google's own click count. They differ slightly
            because the two systems count a visit at different moments. A dash means the page{' '}
            <strong>ranked in search but was never clicked</strong>, so there is no visit to
            measure — not a missing figure.
          </p>
        </div>
      </div>

      {topQueries.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <div className="left">
              <div className="panel-title">Top Keywords</div>
              <div className="panel-sub">Visits from Google search · search terms</div>
            </div>
            <span className="chip blue">top {topQueries.length}</span>
          </div>
          <div className="panel-body no-pad">
            <table className="tbl">
              <thead>
                <tr><th>Keyword</th><th className="r">Visits from search</th><th className="r">Avg. pos.</th></tr>
              </thead>
              <tbody>
                {topQueries.map((q) => (
                  <tr key={q.query}>
                    <td>{q.query}</td>
                    <td className="r mono">{num(q.clicks)}</td>
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
// Whitepaper-download campaigns (campaign_type "Content/White Paper") are excluded —
// they're reported on the Email page, and counting them here inflated the leads/MQL.
function FunnelBody() {
  const q = useChannel('Organic SEO', 'all', ['Content/White Paper'])
  if (q.isLoading) return <Loading label="Loading funnel…" />
  if (q.isError) return <ErrorState error={q.error} />
  if (!q.data || !q.data.hasData)
    return <EmptyState message="No Salesforce-attributed Organic SEO data for this region / quarter yet." />
  const t = q.data.totals
  return (
    <>
      <div className="kpis cols-3">
        <Kpi label="MQLs" val={zn(t.mql)} explainId="mql" />
        <Kpi label="SQLs" val={zn(t.sql)} explainId="sql" />
        <Kpi label="Created Opportunities" val={zn(t.createdOpps)} explainId="createdOpps" />
      </div>
      <div className="kpis cols-3">
        <Kpi label="Qualified Opportunities" val={zn(t.opp)} explainId="opportunities" />
        <Kpi label="Influenced Pipeline (gross profit)" val={ze(t.marginPipeline)} explainId="pipeline" />
        {/* W8 — the channel's closed-won now renders HERE too, so the Overview, the Board
            and this page can never disagree ("the overview shows some closed/won revenue,
            but nothing is showing here"). */}
        <Kpi label="Closed-Won (gross profit)" val={ze(t.margin)} explainId="margin" />
      </div>
      <p className="panel-note" style={{ padding: '2px 4px 0', fontSize: 12, opacity: 0.7 }}>
        Whitepaper-download campaigns are reported on the <strong>Email</strong> page, so they're not counted here.
      </p>

      {/* W6 — run-this-period vs ongoing impact for the SEO channel, with the sales-cycle
          comparison line ("show how long the average sales cycle can be", SEO feedback). */}
      <div style={{ marginTop: 14 }}>
        <CurrentVsOngoing channel="Organic SEO" />
      </div>
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
