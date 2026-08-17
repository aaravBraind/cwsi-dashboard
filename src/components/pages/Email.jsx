import { useState } from 'react'
import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useEmailReport, useCampaignOverrides, useAeEmailEngagement } from '../../hooks/useDashboardData'
import { eur, num, isNA, NA } from '../../data/format'
import Explain from '../Explain'
import { useSortable, SortTh } from '../SortableTable'
import EditableName from '../EditableName'
import CurrentVsOngoing from '../CurrentVsOngoing'
import { EMAIL_FAMILY_FACT_KEYS } from '../../data/pinnedCampaigns'

// Email page — two halves:
//   1. COMMERCIAL funnel for Margot's whitepaper-download + Salesforce-workflow
//      campaigns (getEmailReport — scoped by campaign_type/name, NOT Type='Email').
//   2. ENGAGEMENT (added Aug 2026) — real per-email opens/clicks/unsubscribes from
//      the marketing email platform (v_ae_email; getAeEmailEngagement). Broader
//      scope than the campaign list above: every marketing email sent in 2026,
//      including webinar invites — and not region-scoped (one send covers several
//      regions' lists). The long-standing "engagement is impossible in this org"
//      note is dead: that was true of Salesforce only, not the email platform.
export default function Email() {
  const q = useEmailReport()
  const ov = useCampaignOverrides().data || {}

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Email — Campaigns &amp; Engagement</div>
          <div className="page-sub">Whitepaper &amp; workflow campaigns · commercial funnel + per-email engagement · FY2026</div>
        </div>
        <QuarterPills />
      </div>

      <div className="callout" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          <strong>What's shown here: exactly the four campaigns you named</strong> — Data That Moves Your Business
          Forward Whitepaper, Whitepaper: Becoming Frontier: Leading the Next Phase of AI, Apple for Enterprise Tech
          Deep Dive Whitepaper, and the Microsoft E7 Offering Workflow — and nothing else. Each row aggregates the
          whole campaign (all its emails and Salesforce entries together). Figures are the{' '}
          <strong>commercial funnel</strong> (MQLs through to revenue), measured from <strong>Salesforce campaign
          members</strong>. For a whitepaper, the <strong>MQL</strong> count is its <strong>downloads</strong>.{' '}
          <strong>Audience</strong> = deliveries of the campaign's emails (from the email platform).
          <br /><em>One correction you spotted:</em> in the email platform, the whitepaper's own emails were filed
          under the <em>Q1 Data is an Asset webinar</em> bucket alongside the webinar promos. They're separated here
          by name, so whitepaper figures contain <strong>only whitepaper emails</strong> — no webinar promotions.
        </div>
      </div>

      {q.isLoading && <Loading label="Loading email campaigns…" />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && (
        <EmptyState message="No activity for these email campaigns in this region / quarter yet." />
      )}
      {q.data && q.data.hasData && <Body data={q.data} ov={ov} />}

      {/* Engagement renders independently of the commercial block: it has its own
          feed, its own (quarter-only) scope, and should not vanish when a region
          filter empties the campaign list above. */}
      <Engagement />
    </>
  )
}

// Percentage display for the 0–1 rate fields (numeric columns arrive as strings).
const ratePct = (v, digits = 1) =>
  isNA(v) || v == null ? '—' : `${(Number(v) * 100).toFixed(digits)}%`

function Engagement() {
  const q = useAeEmailEngagement()
  if (q.isLoading) return <Loading label="Loading email engagement…" />
  if (q.isError) return <ErrorState error={q.error} />
  const d = q.data
  if (!d || !d.hasFeed) return null // feed not populated yet — say nothing rather than promise
  return <EngagementBody d={d} />
}

function EngagementBody({ d }) {
  const { rows: sortedEmails, sortProps } = useSortable(d.emails, 'sent')
  const [showEmails, setShowEmails] = useState(false) // per-email drill-down collapsed by default (W5)
  const t = d.totals
  return (
    <>
      {/* Engagement summary — real opens/clicks/unsubs from the email platform */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Email Engagement <Explain id="emailEngagement" /></div>
            <div className="panel-sub">
              The named campaigns' emails sent in the selected period · all regions (a send covers several regions' lists) ·
              engagement counted to {d.asOf}
            </div>
          </div>
          <span className="chip blue">{num(t.emails)} emails</span>
        </div>
        <div className="panel-body">
          {!d.hasData ? (
            <p className="panel-note" style={{ margin: 0 }}>
              No marketing emails were sent in this period.
            </p>
          ) : (
            <div className="h-funnel">
              <Stage name="Sent" val={num(t.sent)} extra={`${num(t.emails)} emails`} />
              <Stage name="Delivered" val={num(t.delivered)} extra={`${ratePct(t.deliveryRate)} delivery rate`} />
              <Stage name="Open Rate" val={ratePct(t.openRate)} extra={`${num(t.uniqueOpens)} unique opens`} />
              <Stage name="Click-Through" val={ratePct(t.ctr)} extra={`${num(t.uniqueClicks)} people clicked`} />
              <Stage name="Unsubscribes" val={ratePct(t.unsubRate, 2)} extra={`${num(t.optOuts)} opt-outs`} />
            </div>
          )}
        </div>
      </div>

      {d.hasData && (
        <>
          {/* Aggregated per-campaign engagement — the campaign-level read Margot asked for
              ("I'm not interested in individual email performance. Please aggregate results
              at the campaign level.") */}
          <div className="panel">
            <div className="panel-head">
              <div className="left">
                <div className="panel-title">Engagement by Campaign</div>
                <div className="panel-sub">The named campaigns only, each aggregating all its emails · whitepaper campaigns exclude the webinar promos that shared their bucket in the email platform</div>
              </div>
              <span className="chip blue">{d.campaigns.length} campaigns</span>
            </div>
            <div className="panel-body no-pad">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th className="r">Emails</th>
                    <th className="r">Sent</th>
                    <th className="r">Delivered</th>
                    <th className="r">Open Rate <Explain id="aeOpenRate" /></th>
                    <th className="r">CTR <Explain id="aeCtr" /></th>
                    <th className="r">Unsubs <Explain id="aeUnsubRate" /></th>
                  </tr>
                </thead>
                <tbody>
                  {d.campaigns.map((c) => (
                    <tr key={c.campaignKey}>
                      <td>{c.campaignName}</td>
                      <td className="r mono">{num(c.emails)}</td>
                      <td className="r mono">{num(c.sent)}</td>
                      <td className="r mono">{num(c.delivered)}</td>
                      <td className="r mono">{ratePct(c.openRate)}</td>
                      <td className="r mono">{ratePct(c.ctr)}</td>
                      <td className="r mono">{num(c.optOuts)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Total · {d.campaigns.length} campaigns</td>
                    <td className="r mono">{num(t.emails)}</td>
                    <td className="r mono">{num(t.sent)}</td>
                    <td className="r mono">{num(t.delivered)}</td>
                    <td className="r mono">{ratePct(t.openRate)}</td>
                    <td className="r mono">{ratePct(t.ctr)}</td>
                    <td className="r mono">{num(t.optOuts)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-email breakdown — demoted to a collapsed drill-down (Margot: "I'm not
              interested in individual email performance"); it stays for auditing the
              campaign-level figures above. */}
          <div className="panel">
            <div className="panel-head" style={{ cursor: 'pointer' }} onClick={() => setShowEmails((s) => !s)}>
              <div className="left">
                <div className="panel-title">
                  <span style={{ display: 'inline-block', width: 14, opacity: 0.6 }}>{showEmails ? '▾' : '▸'}</span>
                  Individual Emails — drill-down
                </div>
                <div className="panel-sub">The sends behind the campaign figures above · collapsed by default · click to {showEmails ? 'hide' : 'expand'}</div>
              </div>
              <span className="chip blue">{sortedEmails.length} emails</span>
            </div>
            {showEmails && (
            <div className="panel-body no-pad">
              <table className="tbl">
                <thead>
                  <tr>
                    <SortTh {...sortProps('name', 'text')}>Email</SortTh>
                    <SortTh {...sortProps('campaignName', 'text')}>Campaign</SortTh>
                    <SortTh {...sortProps('sentDate', 'text')}>Sent</SortTh>
                    <SortTh {...sortProps('sent')} className="r">Recipients</SortTh>
                    <SortTh {...sortProps('delivered')} className="r">Delivered</SortTh>
                    <SortTh {...sortProps('uniqueOpens')} className="r">Opens</SortTh>
                    <SortTh {...sortProps('openRate')} className="r">Open Rate</SortTh>
                    <SortTh {...sortProps('uniqueClicks')} className="r">Clicks</SortTh>
                    <SortTh {...sortProps('ctr')} className="r">CTR</SortTh>
                    <SortTh {...sortProps('optOuts')} className="r">Unsubs</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {sortedEmails.map((e) => (
                    <tr key={e.id}>
                      <td>{e.name}</td>
                      <td>{e.campaignName}</td>
                      <td className="mono">{e.sentDate}</td>
                      <td className="r mono">{num(e.sent)}</td>
                      <td className="r mono">{num(e.delivered)}</td>
                      <td className="r mono">{num(e.uniqueOpens)}</td>
                      <td className="r mono">{ratePct(e.openRate)}</td>
                      <td className="r mono">{num(e.uniqueClicks)}</td>
                      <td className="r mono">{ratePct(e.ctr)}</td>
                      <td className="r mono">{num(e.optOuts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        </>
      )}
    </>
  )
}

const Stage = ({ name, val, extra }) => (
  <div className="h-funnel-stage">
    <div className="stage-name">{name}</div>
    <div className="stage-val">{val}</div>
    <div className="stage-extra">{extra}</div>
  </div>
)

const opps = (v) => (isNA(v) ? '—' : num(v))

// Funnel totals = sum of the per-campaign figures (so the funnel matches the filter and
// the panel always equals the table's Total row). MQL is the campaign-members figure.
// Those per-campaign figures are each campaign's FULL-2026 contribution — see
// campaignRows() in queries.js: dating an opportunity by the quarter it was created in
// used to drop it off its own campaign, which under-reported campaigns materially.
const sumTotals = (rows) => ({
  // Audience is campaign-level and NULL until the next Salesforce refresh, so the total is the
  // sum of the campaigns that HAVE it, and reads "—" while none of them do.
  audience: rows.some((c) => !isNA(c.audience))
    ? rows.reduce((a, c) => a + (isNA(c.audience) ? 0 : Number(c.audience) || 0), 0)
    : NA,
  mql: rows.reduce((a, c) => a + (Number(c.mql) || 0), 0),
  sql: rows.reduce((a, c) => a + (Number(c.sql) || 0), 0),
  createdOpps: rows.reduce((a, c) => a + (Number(c.createdOpps) || 0), 0),
  oppCount: rows.reduce((a, c) => a + (Number(c.oppCount) || 0), 0),
  pipeline: rows.reduce((a, c) => a + (Number(c.oppValue) || 0), 0),
  closedWon: rows.reduce((a, c) => a + (Number(c.closedWon) || 0), 0),
})

function Body({ data, ov }) {
  const { campaigns } = data
  // W5: the list is fixed at Margot's 4 campaigns — the old Whitepaper/Workflow filter
  // dropdown had nothing left to filter and was removed.
  const { rows: sortedCampaigns, sortProps } = useSortable(campaigns, 'mql')
  const t = sumTotals(campaigns)
  const matchedCount = campaigns.length
  return (
    <>
      {/* Commercial funnel — Margot's requested order (same style as Overview) */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Commercial Funnel</div>
            <div className="panel-sub">MQLs → SQLs → Created Opps → Opportunity Value → Closed-Won · across the {matchedCount} named campaigns · each campaign's full-2026 contribution</div>
          </div>
          <span className="chip blue">{matchedCount} campaigns</span>
        </div>
        <div className="panel-body">
          <div className="h-funnel">
            <Stage name="MQLs" val={num(t.mql)} extra="campaign members" />
            <Stage name="SQLs" val={num(t.sql)} extra="sales-qualified" />
            <Stage name="Created Opps" val={opps(t.createdOpps)} extra="opps created" />
            <Stage name="Opportunity Value" val={eur(t.pipeline)} extra="open qualified pipeline" />
            <Stage name="Closed-Won" val={eur(t.closedWon)} extra="won revenue" />
          </div>
        </div>
      </div>

      {/* W6 — run-this-period vs ongoing impact, scoped to the four named campaigns */}
      <CurrentVsOngoing keys={EMAIL_FAMILY_FACT_KEYS} />

      {/* Per-campaign breakdown */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Campaign Performance</div>
            <div className="panel-sub">The four named campaigns · full-2026 contribution each · names editable (click the pencil)</div>
          </div>
          <span className="chip blue">{matchedCount} campaign{matchedCount === 1 ? '' : 's'}</span>
        </div>
        {/* Attribution-window fix: each row is the campaign's whole-2026 contribution, so an
            opportunity created in an earlier quarter still counts towards the campaign that
            generated it. The quarter pill still chooses WHICH campaigns are listed. */}
        <div className="panel-body" style={{ paddingBottom: 0 }}>
          <p className="panel-note" style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>
            Each row is the campaign's <strong>full 2026 contribution</strong>, so it ties to the campaign in
            Salesforce — an opportunity created in an earlier quarter still counts towards the campaign that generated
            it. The quarter pill chooses <em>which</em> campaigns are listed. <strong>Created Opps</strong> = every
            opportunity created off the campaign; <strong>Qualified</strong> = those at a genuine stage and still open
            or won — what Opp Value is summed from. <Explain id="campaignWindow" />
          </p>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <SortTh {...sortProps('campaignName', 'text')}>Campaign</SortTh>
                <SortTh {...sortProps('regionCode', 'text')}>Region</SortTh>
                <SortTh {...sortProps('kind', 'text')}>Type</SortTh>
                <SortTh {...sortProps('audience')} className="r">Audience <Explain id="emailAudience" /></SortTh>
                <SortTh {...sortProps('mql')} className="r">MQLs <Explain id="mql" /></SortTh>
                <SortTh {...sortProps('sql')} className="r">SQLs <Explain id="sql" /></SortTh>
                <SortTh {...sortProps('createdOpps')} className="r">Created Opps <Explain id="createdOpps" /></SortTh>
                <SortTh {...sortProps('oppCount')} className="r">Qualified <Explain id="opportunities" /></SortTh>
                <SortTh {...sortProps('oppValue')} className="r">Opp Value <Explain id="pipeline" /></SortTh>
                <SortTh {...sortProps('closedWon')} className="r">Closed-Won <Explain id="closedWon" /></SortTh>
              </tr>
            </thead>
            <tbody>
              {sortedCampaigns.map((c) => (
                <tr key={c.campaignKey}>
                  <td><EditableName campaignKey={c.campaignKey} value={ov[c.campaignKey]?.display_name} original={c.campaignName} /></td>
                  <td><EditableName campaignKey={c.campaignKey} field="display_region" value={ov[c.campaignKey]?.display_region} original={c.regionCode} /></td>
                  <td><span className={`chip ${c.kind === 'Whitepaper' ? 'blue' : 'neu'}`}>{c.kind}</span></td>
                  <td className="r mono">{isNA(c.audience) ? '—' : num(c.audience)}</td>
                  <td className="r mono">{num(c.mql)}</td>
                  <td className="r mono">{num(c.sql)}</td>
                  <td className="r mono">{c.createdOpps ? num(c.createdOpps) : '—'}</td>
                  <td className="r mono">{c.oppCount ? num(c.oppCount) : '—'}</td>
                  <td className="r mono">{c.oppValue ? eur(c.oppValue) : '—'}</td>
                  <td className="r mono">{c.closedWon ? eur(c.closedWon) : '—'}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total · {matchedCount} campaigns</td>
                <td />
                <td />
                <td className="r mono">{isNA(t.audience) ? '—' : num(t.audience)}</td>
                <td className="r mono">{num(t.mql)}</td>
                <td className="r mono">{num(t.sql)}</td>
                <td className="r mono">{opps(t.createdOpps)}</td>
                <td className="r mono">{opps(t.oppCount)}</td>
                <td className="r mono">{eur(t.pipeline)}</td>
                <td className="r mono">{eur(t.closedWon)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </>
  )
}
