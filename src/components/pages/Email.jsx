import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useEmailReport, useCampaignOverrides } from '../../hooks/useDashboardData'
import { eur, num, isNA } from '../../data/format'
import Explain from '../Explain'
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
          <strong>commercial funnel</strong> (leads through to revenue) attributed to those campaigns in Salesforce.
          Region &amp; quarter scope every figure.
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

function Body({ data, ov }) {
  const { totals, campaigns, matchedCount } = data
  return (
    <>
      {/* Commercial funnel — Margot's requested order (same style as Overview) */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Commercial Funnel</div>
            <div className="panel-sub">Leads → MQLs → SQLs → Created Opps → Opportunity Value → Closed-Won · across the {matchedCount} whitepaper &amp; workflow campaigns · current view</div>
          </div>
          <span className="chip blue">{matchedCount} campaigns</span>
        </div>
        <div className="panel-body">
          <div className="h-funnel">
            <Stage name="Leads" val={num(totals.leads)} extra="campaign members" />
            <Stage name="MQLs" val={num(totals.mql)} extra="marketing-qualified" />
            <Stage name="SQLs" val={num(totals.sql)} extra="sales-qualified" />
            <Stage name="Created Opps" val={opps(totals.createdOpps)} extra="opps created" />
            <Stage name="Opportunity Value" val={eur(totals.pipeline)} extra="open qualified pipeline" />
            <Stage name="Closed-Won" val={eur(totals.closedWon)} extra="won revenue" />
          </div>
        </div>
      </div>

      {/* Per-campaign breakdown */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Campaign Performance</div>
            <div className="panel-sub">Each whitepaper / workflow campaign · commercial funnel · names editable (click the pencil)</div>
          </div>
          <span className="chip blue">{matchedCount} campaign{matchedCount === 1 ? '' : 's'}</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Type</th>
                <th className="r">Leads <Explain id="leads" /></th>
                <th className="r">MQLs <Explain id="mql" /></th>
                <th className="r">SQLs <Explain id="sql" /></th>
                <th className="r">Created Opps <Explain id="createdOpps" /></th>
                <th className="r">Opp Value <Explain id="pipeline" /></th>
                <th className="r">Closed-Won <Explain id="closedWon" /></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.campaignKey}>
                  <td><EditableName campaignKey={c.campaignKey} value={ov[c.campaignKey]?.display_name} original={c.campaignName} /></td>
                  <td><span className={`chip ${c.kind === 'Whitepaper' ? 'blue' : 'neu'}`}>{c.kind}</span></td>
                  <td className="r mono">{num(c.leads)}</td>
                  <td className="r mono">{num(c.mql)}</td>
                  <td className="r mono">{num(c.sql)}</td>
                  <td className="r mono">{c.createdOpps ? num(c.createdOpps) : '—'}</td>
                  <td className="r mono">{c.oppValue ? eur(c.oppValue) : '—'}</td>
                  <td className="r mono">{c.closedWon ? eur(c.closedWon) : '—'}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total · {matchedCount} campaigns</td>
                <td />
                <td className="r mono">{num(totals.leads)}</td>
                <td className="r mono">{num(totals.mql)}</td>
                <td className="r mono">{num(totals.sql)}</td>
                <td className="r mono">{opps(totals.createdOpps)}</td>
                <td className="r mono">{eur(totals.pipeline)}</td>
                <td className="r mono">{eur(totals.closedWon)}</td>
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
