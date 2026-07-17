import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useWebTraffic, useSeo, useChannel, useWebsiteLeads } from '../../hooks/useDashboardData'
import { num, eur, isNA } from '../../data/format'
import Explain from '../Explain'

const ratePct = (r, d = 1) => (isNA(r) || r == null ? 'n/a' : `${(r * 100).toFixed(d)}%`)
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
          <strong>One lead funnel, one traffic view.</strong> The <strong>funnel below</strong> is the
          authoritative organic lead-to-revenue funnel, sourced from the Salesforce <strong>Website Leads</strong>{' '}
          campaigns (MQLs → SQLs → opportunities → pipeline → won). <strong>GA4 traffic</strong> (sessions, users,
          key events) and <strong>Search Console</strong> (clicks, impressions, position) are shown below it as
          website <em>traffic &amp; search</em> signals — GA4 "key events" are on-site conversions, not the same
          thing as Salesforce leads, so they're reported as traffic, never as a competing lead number.
          Region &amp; quarter scope every figure.
        </div>
      </div>

      {/* G2/G4 — the single authoritative SF-sourced Organic Search funnel, moved to the TOP.
          "Website Leads" Salesforce campaigns (SEO9), not the whole Organic SEO channel. */}
      <div className="sec-divider"><span className="label">Organic Search funnel · Salesforce (Website Leads)</span><div className="line" /></div>
      <WebsiteLeadsBody />

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

      {/* Wider Salesforce-attributed funnel for the whole Organic SEO channel — context only,
          a broader superset of the authoritative Website Leads funnel above (G4). */}
      <div className="sec-divider" style={{ marginTop: 22 }}><span className="label">Wider Organic SEO channel · Salesforce (context)</span><div className="line" /></div>
      <FunnelBody />
    </>
  )
}

// SEO9 — website MQL/SQL from the "Website Leads" Salesforce campaigns specifically.
function WebsiteLeadsBody() {
  const q = useWebsiteLeads()
  if (q.isLoading) return <Loading label="Loading website leads…" />
  if (q.isError) return <ErrorState error={q.error} />
  if (!q.data || !q.data.hasData)
    return <EmptyState message="No Website Leads campaign data for this region / quarter yet." />
  const f = q.data.funnel
  return (
    <>
      {/* G3 — full funnel incl. Qualified Opportunities; New vs Influenced pipeline labelled per S3. */}
      <div className="kpis cols-4">
        <Kpi label="MQLs · current view" val={num(f.mql)} explainId="mql" />
        <Kpi label="SQLs · current view" val={num(f.sql)} explainId="sql" />
        <Kpi label="Qualified Opportunities · current view" val={isNA(f.opp) ? '—' : num(f.opp)} explainId="opportunities" />
        <Kpi label="Created Opps · current view" val={isNA(f.createdOpps) ? '—' : num(f.createdOpps)} explainId="createdOpps" />
      </div>
      <div className="kpis cols-3" style={{ marginTop: 12 }}>
        <Kpi label="New Pipeline Created · current view" val={isNA(f.createdOppsValue) ? '—' : eur(f.createdOppsValue)} explainId="createdOppsValue" />
        <Kpi label="Influenced Pipeline · current view" val={eur(f.pipeline)} explainId="pipeline" />
        <Kpi label="Closed-Won · current view" val={eur(f.closedWon)} explainId="closedWon" />
      </div>
      <p className="panel-note" style={{ padding: '2px 4px 0', fontSize: 12, opacity: 0.7 }}>
        From the <strong>Website Leads</strong> Salesforce campaigns{q.data.campaigns.length ? ` (${q.data.campaigns.length}: ${q.data.campaigns.join(', ')})` : ''} — the accurate website source, not the whole Organic SEO channel.
        <strong> New Pipeline Created</strong> = value of opportunities created this period; <strong>Influenced Pipeline</strong> = open + won opportunity value.
      </p>
    </>
  )
}

function WebBody({ data }) {
  const { totals, byHostname, byRegion, dateRange } = data
  return (
    <>
      {/* SEO2 (Margot): the preferred website metrics — Sessions, Users, Avg Session Duration, Bounce Rate. */}
      <div className="kpis cols-4">
        <Kpi label="Sessions · current view" val={num(totals.sessions)} sub={dateRange.min ? `${dateRange.min} → ${dateRange.max}` : ''} explainId="organicTraffic" />
        <Kpi label="Users" val={isNA(totals.users) ? '—' : num(totals.users)} sub={isNA(totals.users) ? 'after next GA4 refresh' : ''} explainId="organicTraffic" />
        <Kpi label="Avg session duration" val={dur(totals.avgSessionDuration)} sub={isNA(totals.avgSessionDuration) ? 'after next GA4 refresh' : ''} explainId="organicTraffic" />
        <Kpi label="Bounce rate" val={ratePct(totals.bounceRate)} explainId="organicTraffic" />
      </div>
      <div className="kpis cols-2" style={{ marginTop: 12 }}>
        <Kpi label="Engaged sessions" val={num(totals.engaged)} />
        {/* G4 — GA4 key events are on-site conversions (traffic signal), NOT Salesforce leads.
            Relabelled from "Visitor → MQL" so it never competes with the SF lead funnel above. */}
        <Kpi
          label="Key events (GA4 on-site conversions)"
          val={isNA(totals.keyEvents) ? '—' : num(totals.keyEvents)}
          sub={isNA(totals.keyEvents) || !totals.sessions ? 'a traffic signal, not a Salesforce lead' : `${((totals.keyEvents / totals.sessions) * 100).toFixed(2)}% of sessions · traffic signal, not a Salesforce lead`}
        />
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
              <tr><th>Property (hostname)</th><th className="r">Sessions</th><th className="r">Users</th><th className="r">Avg duration</th><th className="r">Bounce %</th></tr>
            </thead>
            <tbody>
              {byHostname.map((h) => (
                <tr key={h.hostname}>
                  <td>{h.hostname}</td>
                  <td className="r mono">{num(h.sessions)}</td>
                  <td className="r mono">{isNA(h.users) ? '—' : num(h.users)}</td>
                  <td className="r mono">{dur(h.avgSessionDuration)}</td>
                  <td className="r mono">{ratePct(h.bounceRate)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total · {byHostname.length} properties</td>
                <td className="r mono">{num(totals.sessions)}</td>
                <td className="r mono">{isNA(totals.users) ? '—' : num(totals.users)}</td>
                <td className="r mono">{dur(totals.avgSessionDuration)}</td>
                <td className="r mono">{ratePct(totals.bounceRate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {byRegion.length > 1 && (
        <div className="info-pill" style={{ marginBottom: 18 }}>
          By region: {byRegion.map((r) => `${r.region === 'UNASSIGNED' ? 'Other' : r.region} ${num(r.sessions)}`).join(' · ')}
          {' '}— main-domain traffic that GA4 can’t split by country is shown under “Other”.
        </div>
      )}
    </>
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
            <div className="panel-sub">By clicks · Search Console · current quarter (this data isn’t split by region)</div>
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
              <div className="panel-sub">By clicks · Search Console search terms · current quarter (this data isn’t split by region)</div>
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
      <div className="kpis cols-4">
        <Kpi label="MQLs · current view" val={num(t.mql)} explainId="mql" />
        <Kpi label="SQLs · current view" val={num(t.sql)} explainId="sql" />
        <Kpi label="Created Opps · current view" val={isNA(t.createdOpps) ? '—' : num(t.createdOpps)} explainId="createdOpps" />
        <Kpi label="Influenced Pipeline · current view" val={eur(t.pipeline)} explainId="pipeline" />
      </div>
      <p className="panel-note" style={{ padding: '2px 4px 0', fontSize: 12, opacity: 0.7 }}>
        <strong>Context only — the wider Organic SEO channel</strong> (every SF opportunity attributed to Organic SEO), a
        broader superset of the authoritative <strong>Website Leads</strong> funnel at the top; the two count different
        scopes, so their lead numbers differ by design. Whitepaper-download campaigns are reported on the{' '}
        <strong>Email</strong> page, so they're not counted here.
      </p>
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
