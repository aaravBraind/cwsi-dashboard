import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useWebTraffic, useSeo, useChannel, useWebsiteLeads } from '../../hooks/useDashboardData'
import { num, eur, isNA } from '../../data/format'
import Explain from '../Explain'
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
          <strong>One lead funnel, one traffic view.</strong> The <strong>funnel below</strong> is the
          authoritative organic lead-to-revenue funnel, sourced from the Salesforce <strong>Website Leads</strong>{' '}
          campaigns (MQLs → SQLs → opportunities → pipeline → won). <strong>GA4 traffic</strong> (sessions, page
          views, users) and <strong>Search Console</strong> (clicks, search impressions, position) are shown below it
          as website <em>traffic &amp; search</em> signals. Region &amp; quarter scope every figure.
          <br /><strong>Which domains are covered:</strong> GA4 traffic covers <strong>both sites</strong> —
          cwsisecurity.com (the main site) and insights.cwsisecurity.com (the campaign site) — for{' '}
          <strong>all quarters</strong>, split per property in the table below. <strong>Search Console</strong> data
          currently exists only for the main cwsisecurity.com property — that's why its figures look bigger than the
          campaign site alone. A separate Search Console property for insights.cwsisecurity.com{' '}
          <strong>doesn't exist yet and has to be created on the Google/DNS side</strong>; once it's verified, its
          search data starts collecting from that day (Google doesn't backfill).
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

      {/* Whole Organic SEO channel — renamed per Margot ("if this represents older
          opportunities that are only converting now, please make this clearer"). */}
      <div className="sec-divider" style={{ marginTop: 22 }}><span className="label">Whole organic channel — incl. older campaigns still converting</span><div className="line" /></div>
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
      {/* W8: measured zeros render as 0 / €0 on this page (Margot's ask), never a dash. */}
      <div className="kpis cols-4">
        <Kpi label="MQLs · current view" val={zn(f.mql)} explainId="mql" />
        <Kpi label="SQLs · current view" val={zn(f.sql)} explainId="sql" />
        <Kpi label="Qualified Opportunities · current view" val={zn(f.opp)} explainId="opportunities" />
        <Kpi label="Created Opps · current view" val={zn(f.createdOpps)} explainId="createdOpps" />
      </div>
      <div className="kpis cols-3" style={{ marginTop: 12 }}>
        <Kpi label="New Pipeline Created · current view" val={ze(f.createdOppsValue)} explainId="createdOppsValue" />
        <Kpi label="Influenced Pipeline (gross profit) · current view" val={ze(f.marginPipeline)} explainId="pipeline" />
        <Kpi label="Closed-Won · current view" val={eur(f.closedWon)} explainId="closedWon" />
      </div>
      <p className="panel-note" style={{ padding: '2px 4px 0', fontSize: 12, opacity: 0.7 }}>
        From the <strong>Website Leads</strong> Salesforce campaigns{q.data.campaigns.length ? ` (${q.data.campaigns.length}: ${q.data.campaigns.join(', ')})` : ''} — the accurate website source, not the whole Organic SEO channel.
        <strong> New Pipeline Created</strong> = revenue value of opportunities created this period; <strong>Influenced Pipeline</strong> = gross profit on open + won opportunities ({isNA(f.marginPipeline) ? 'open-deal gross profit arrives at the next data refresh' : `${eur(f.pipeline)} on the revenue basis`}).
      </p>
    </>
  )
}

function WebBody({ data }) {
  const { totals, byHostname, byRegion, dateRange } = data
  return (
    <>
      {/* SEO2 + W8 (Margot): the preferred website metrics — Page Views join Sessions,
          Users, Avg Session Duration and Bounce Rate ("I'd prefer to see page views here"). */}
      <div className="kpis cols-5">
        <Kpi label="Page views · current view" val={isNA(totals.pageViews) ? '—' : num(totals.pageViews)} sub={isNA(totals.pageViews) ? 'after next GA4 refresh' : 'the traffic figure, not search impressions'} explainId="organicTraffic" />
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
            <div className="panel-sub">By clicks · Search Console (cwsisecurity.com property) · current quarter (not split by region) · “search impressions” = times a result appeared in Google search, not page views</div>
          </div>
          <span className="chip blue">top {topPages.length}</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr><th>Page</th><th className="r">Clicks</th><th className="r">Search impr.</th><th className="r">CTR</th><th className="r">Avg. pos.</th></tr>
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
                <tr><th>Keyword</th><th className="r">Clicks</th><th className="r">Search impr.</th><th className="r">CTR</th><th className="r">Avg. pos.</th></tr>
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
      <div className="kpis cols-3">
        <Kpi label="MQLs · current view" val={zn(t.mql)} explainId="mql" />
        <Kpi label="SQLs · current view" val={zn(t.sql)} explainId="sql" />
        <Kpi label="Created Opps · current view" val={zn(t.createdOpps)} explainId="createdOpps" />
      </div>
      <div className="kpis cols-3">
        <Kpi label="Qualified Opportunities · current view" val={zn(t.opp)} explainId="opportunities" />
        <Kpi label="Influenced Pipeline (gross profit) · current view" val={ze(t.marginPipeline)} explainId="pipeline" />
        {/* W8 — the channel's closed-won now renders HERE too, so the Overview, the Board
            and this page can never disagree ("the overview shows some closed/won revenue,
            but nothing is showing here"). */}
        <Kpi label="Closed-Won · current view" val={eur(t.closedWon)} explainId="closedWon" />
      </div>
      <p className="panel-note" style={{ padding: '2px 4px 0', fontSize: 12, opacity: 0.7 }}>
        <strong>What this section is:</strong> the <strong>whole Organic SEO channel</strong> — every Salesforce
        opportunity attributed to organic search, <strong>including older campaigns whose deals are only converting
        now</strong> (that ongoing impact is exactly what the split below shows). It's a broader superset of the
        authoritative <strong>Website Leads</strong> funnel at the top, so the two lead counts differ by design. This
        section's Closed-Won is the figure the Overview and Board show for the Organic SEO channel.
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
