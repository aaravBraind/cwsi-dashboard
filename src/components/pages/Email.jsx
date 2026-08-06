import { useState } from 'react'
import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useEmailReport, useCampaignOverrides } from '../../hooks/useDashboardData'
import { eur, num, isNA, NA } from '../../data/format'
import Explain from '../Explain'
import { useSortable, SortTh } from '../SortableTable'
import EditableName from '../EditableName'

// Email page — Margot's whitepaper-download + Salesforce-workflow campaigns
// (July 2026 feedback). Scoped to a named set of campaigns (getEmailReport /
// EMAIL_CAMPAIGN_KEYS), NOT to Salesforce Campaign.Type = Email — three of the four
// are stored as "Content / White Paper". Commercial funnel only: this org has no
// email-send / open / click data (no Account Engagement), so engagement KPIs and
// per-individual-email breakdowns aren't shown.
export default function Email() {
  const q = useEmailReport()
  const ov = useCampaignOverrides().data || {}

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Email — Whitepaper &amp; Workflow Campaigns</div>
          <div className="page-sub">Whitepaper downloads + Salesforce workflows · commercial funnel · FY2026</div>
        </div>
        <QuarterPills />
      </div>

      <div className="callout" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          <strong>What's shown here:</strong> your <strong>whitepaper-download campaigns</strong> and the
          <strong> Salesforce email workflows</strong> — including the four you named (Data That Moves, Apple for
          Enterprise Tech Deep Dive, Becoming Frontier, and the Microsoft E7 Offering Workflow). Figures are the{' '}
          <strong>commercial funnel</strong> (MQLs through to revenue), measured from <strong>Salesforce campaign
          members</strong>. For a whitepaper, the <strong>MQL</strong> count is its <strong>downloads</strong> — the
          people Salesforce records as having responded to the campaign. Region &amp; quarter scope every figure.
          <br /><em>Note:</em> this counts contacts logged as campaign members in Salesforce; if a landing-page tool
          shows more form-fills, those extra contacts aren't yet recorded against the Salesforce campaign.
        </div>
      </div>

      {q.isLoading && <Loading label="Loading email campaigns…" />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && (
        <EmptyState message="No activity for these email campaigns in this region / quarter yet." />
      )}
      {q.data && q.data.hasData && <Body data={q.data} ov={ov} />}
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
  const [kind, setKind] = useState('all') // EM1: filter Whitepaper vs Workflow
  const wpCount = campaigns.filter((c) => c.kind === 'Whitepaper').length
  const wfCount = campaigns.filter((c) => c.kind === 'Workflow').length
  const shown = kind === 'all' ? campaigns : campaigns.filter((c) => c.kind === kind)
  // Robin: sortable columns rather than a fixed order (defaults to most MQLs).
  const { rows: sortedCampaigns, sortProps } = useSortable(shown, 'mql')
  const t = sumTotals(shown)
  const matchedCount = shown.length
  return (
    <>
      {/* EM1 — filter by campaign type (whitepaper downloads vs email workflows) */}
      <div className="filters" style={{ marginBottom: 14 }}>
        <div className="filter">
          <span className="label">Campaign type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">All ({campaigns.length})</option>
            <option value="Whitepaper">Whitepaper downloads ({wpCount})</option>
            <option value="Workflow">Email workflows ({wfCount})</option>
          </select>
        </div>
      </div>

      {/* Commercial funnel — Margot's requested order (same style as Overview) */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Commercial Funnel</div>
            <div className="panel-sub">MQLs → SQLs → Created Opps → Opportunity Value → Closed-Won · across the {matchedCount} {kind === 'all' ? 'whitepaper & workflow' : kind === 'Whitepaper' ? 'whitepaper' : 'workflow'} campaign{matchedCount === 1 ? '' : 's'} · each campaign's full-2026 contribution</div>
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

      {/* Per-campaign breakdown */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Campaign Performance</div>
            <div className="panel-sub">Each whitepaper / workflow campaign · full-2026 contribution · names editable (click the pencil)</div>
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

      <div className="callout amber" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          <strong>Why no open / click-through / send figures?</strong> These campaigns promote a whitepaper or run a
          nurture workflow, but Salesforce holds no email-engagement data for them — send counts read zero and there
          are no opens, clicks or unsubscribes (no email-marketing platform is connected). So this page reports the{' '}
          <strong>commercial funnel</strong> — the leads, qualified leads and pipeline the campaigns generated — rather
          than per-email engagement. Connect an email platform and the per-email metrics can be added.
        </div>
      </div>
    </>
  )
}
