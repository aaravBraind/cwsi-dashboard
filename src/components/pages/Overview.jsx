import QuarterPills from '../QuarterPills'
import { LoadingSkeleton, ErrorState, EmptyState, NotAvailablePanel, NotAvailable } from '../States'
import { useState } from 'react'
import { useOverview, useKpiTargets, useOutreachAttributedMeetings } from '../../hooks/useDashboardData'
import { useFilters } from '../../filters/FilterContext'
import { eur, num, pct, ratio, isNA } from '../../data/format'
import { periodOf, scopeLabel, achievement, lightOf, targetAt, fmtTarget } from '../../data/kpiRegister'
import { I } from '../icons'
import Explain from '../Explain'
import MarketingBudget from '../MarketingBudget'
import CurrentVsOngoing from '../CurrentVsOngoing'
import { SALES_EXCLUDED_BY_DEFAULT, SALES_CAMPAIGN_LABELS } from '../../data/attribution'

// Status lights + %-of-target follow the ACTIVE quarter pill (Q1..Q4 → that
// quarter's target; YTD → FY), reading the EDITABLE kpi_targets DB table — so a
// client target-edit on the KPI Tracker propagates here too. Targets are
// provisional until the client enters real numbers; actuals are live/real.

export default function Overview() {
  const q = useOverview()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">
            Marketing <span className="accent">Intelligence</span> Dashboard
          </div>
          <div className="page-sub">
            Quarterly KPI view · FY2026 · Source: Salesforce
          </div>
        </div>
        <QuarterPills />
      </div>

      {q.isLoading && <LoadingSkeleton />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && <EmptyState />}

      {q.data && q.data.hasData && (
        <Body data={q.data} />
      )}
    </>
  )
}

function Body({ data }) {
  const { funnel: rawFunnel, byChannel, unmapped } = data
  // Sales/partner-generated campaigns (Paul: "I'd see outreach as more sales-generated
  // leads … we should exclude that"). The split is always computed; this toggle decides
  // whether the two headline money figures show marketing-only or everything. Default is
  // EVERYTHING — the numbers do not move until CWSI confirms the classification, and the
  // excluded amount is always visible either way. See data/attribution.js.
  const sg = rawFunnel.salesGenerated
  const [excludeSales, setExcludeSales] = useState(SALES_EXCLUDED_BY_DEFAULT)
  const applySplit = excludeSales && sg
  const funnel = applySplit
    ? {
        ...rawFunnel,
        pipeline: rawFunnel.pipeline - sg.pipeline,
        marginPipeline: isNA(rawFunnel.marginPipeline) ? rawFunnel.marginPipeline : rawFunnel.marginPipeline - sg.marginPipeline,
        closedWon: rawFunnel.closedWon - sg.closedWon,
        margin: isNA(rawFunnel.margin) ? rawFunnel.margin : rawFunnel.margin - sg.margin,
      }
    : rawFunnel
  const { filters } = useFilters()
  const qtr = filters.quarter // 'q1'..'q4' | 'ytd' — targets resolve to this scope
  const maxPipe = Math.max(1, ...byChannel.map((c) => c.pipeline))

  // Outreach shown as an INDICATIVE group (P4/OV6): meetings & opps are attributed by
  // contact (a sequenced contact is on the opp), not by campaign, so they can overlap
  // the campaign channels — excluded from the per-channel comparison and any totals,
  // matching the Pipeline & Board pattern. Bars stay scaled to the campaign channels
  // (maxPipe) and clamped, so the outlier-prone outreach pipeline can't rescale the
  // real bars; Closed-Won is the reliable read (pipeline € is contact-touch).
  const outbound = useOutreachAttributedMeetings().data?.oppTiers?.outbound
  const showOutreach = outbound && (outbound.createdOpps > 0 || outbound.won > 0)

  // Editable targets from the kpi_targets DB table, resolved at the active quarter.
  const targets = useKpiTargets().data || {}
  const period = periodOf(qtr)
  const scope = scopeLabel(qtr)
  const lightFor = (v, key) => lightOf(targets[key], period, v)
  const pctOf = (v, key) => {
    const f = achievement(targets[key], period, v)
    return f == null ? 'n/a' : `${(f * 100).toFixed(0)}% of ${scope}`
  }
  // Say whose target this is. Most are the client's since the CWSI FY26 reforecast
  // (Aug 2026); the rest are still ours and keep saying so.
  const tgtSub = (key) => {
    const t = targetAt(targets[key], period)
    if (t == null) return 'no target set yet'
    const agreed = targets[key]?.source === 'client'
    return `${scope} tgt: ${fmtTarget(targets[key]?.unit, t)}${agreed ? '' : ' · provisional'}`
  }

  return (
    <>
      {/* 0. Marketing budget — at the very top (OV9): budget & spend before the funnel */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Marketing Budget — Actual Spend</div>
            <div className="panel-sub">From the budget tracker (EUR) · annual budget €466,394.92 · of which MDF €86,394.92</div>
          </div>
          <span className="chip blue">EUR</span>
        </div>
        <div className="panel-body">
          <MarketingBudget compact />
        </div>
      </div>

      {/* 1. Top-line summary — target + light follow the active quarter pill */}
      <div className="kpis cols-2">
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.euro}</svg></div>
            <span className={`tl ${isNA(funnel.marginPipeline) ? 'neu' : lightFor(funnel.marginPipeline, 'influencedPipeline')}`}>
              <span className="tl-dot" />{isNA(funnel.marginPipeline) ? 'n/a' : pctOf(funnel.marginPipeline, 'influencedPipeline')}
            </span>
          </div>
          <div className="kpi-label">Influenced Pipeline (gross profit) <Explain id="pipeline" /></div>
          <div className="kpi-val">{isNA(funnel.marginPipeline) ? '—' : eur(funnel.marginPipeline)}</div>
          <div className="kpi-sub">
            {isNA(funnel.marginPipeline) ? (
              <NotAvailable
                what="Influenced pipeline (gross profit)"
                why="open-deal gross profit arrives at the next data refresh"
              />
            ) : (
              <>
                <span className="kpi-target">{tgtSub('influencedPipeline')}</span>
                <span className="kpi-target" style={{ display: 'block', opacity: 0.65 }}>
                  {eur(funnel.pipeline)} on the revenue basis (full deal value)
                  {funnel.marginPipelinePendingOpps > 0 &&
                    ` · gross profit known for ${num(funnel.marginPipelineKnownOpps)} of ${num(funnel.marginPipelineKnownOpps + funnel.marginPipelinePendingOpps)} deals · rest pending in Salesforce`}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn green"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.trend}</svg></div>
            <span className={`tl ${isNA(funnel.margin) ? 'neu' : lightFor(funnel.margin, 'influencedMargin')}`}>
              <span className="tl-dot" />{isNA(funnel.margin) ? 'n/a' : pctOf(funnel.margin, 'influencedMargin')}
            </span>
          </div>
          <div className="kpi-label">Influenced Margin (gross profit) <Explain id="margin" /></div>
          <div className="kpi-val">{isNA(funnel.margin) ? '—' : eur(funnel.margin)}</div>
          <div className="kpi-sub">
            {isNA(funnel.margin) ? (
              <NotAvailable
                what="Influenced margin"
                why={`gross profit pending${funnel.marginPendingDeals ? ` for ${num(funnel.marginPendingDeals)} won deal${funnel.marginPendingDeals === 1 ? '' : 's'}` : ''}`}
              />
            ) : (
              <>
                <span className="kpi-target">{tgtSub('influencedMargin')}</span>
                <span className="kpi-target" style={{ display: 'block', opacity: 0.65 }}>
                  of {isNA(funnel.margin) ? eur(0) : eur(funnel.margin)} closed-won (gross profit)
                  {funnel.marginPendingDeals > 0 &&
                    ` · ${num(funnel.marginKnownDeals)} of ${num(funnel.marginKnownDeals + funnel.marginPendingDeals)} deals have gross profit · rest pending in Salesforce`}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sales/partner-generated split — Paul asked for outreach-style, sales-generated
          activity to be kept out of marketing influence, and Robin warned the filter must
          key on campaign TYPE, not name. Salesforce has no sales type yet, so the current
          classification is a short evidenced list of individual campaigns (attribution.js).
          Shown as a separate row with a toggle, never deducted silently. */}
      {sg && (
        <div className="callout amber" style={{ marginBottom: 18 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
          <div className="callout-body">
            <strong>Sales-generated activity inside these figures.</strong>{' '}
            <strong>{eur(sg.pipeline)}</strong> of influenced pipeline and{' '}
            <strong>{eur(sg.closedWon)}</strong> of closed-won above{' '}
            {applySplit ? 'has been excluded' : 'comes'} from campaigns that look sales- or
            partner-generated rather than marketing-generated
            {sg.campaigns.length > 0 && (
              <> — {sg.campaigns.map((k) => SALES_CAMPAIGN_LABELS[k] || k).join(', ')}</>
            )}
            . Toggle it to see either view:
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              <input type="checkbox" checked={excludeSales} onChange={(e) => setExcludeSales(e.target.checked)} />
              <span>Exclude sales-generated campaigns</span>
            </label>
            <br />
            <span style={{ opacity: 0.75 }}>
              Pending with CWSI: Salesforce has no “sales” campaign type yet, so this is a short,
              individually-evidenced list rather than a rule. Once a type exists the filter keys off
              it — names are not used, because campaigns are also used to group contacts for
              sequences and would be misread.
            </span>
          </div>
        </div>
      )}

      <p className="panel-note" style={{ padding: '0 4px 14px', fontSize: 12, opacity: 0.75 }}>
        <strong>Influenced Pipeline and Influenced Margin are both gross profit</strong>, matching how CWSI tracks
        pipeline. <Explain id="margin" />
      </p>

      {/* 2. Lead Conversion Funnel */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Lead Conversion Funnel</div>
            </div>
        </div>
        <div className="panel-body">
          <div className="h-funnel">
            <Stage name="MQLs" val={num(funnel.mql)} explainId="mql" />
            <Stage name="SQLs" val={num(funnel.sql)} explainId="sql" />
            <Stage name="Created Opportunities" val={isNA(funnel.createdOpps) ? 0 : num(funnel.createdOpps)} explainId="createdOpps" />
            <Stage name="Qualified Opportunities" val={isNA(funnel.opp) ? 0 : num(funnel.opp)} explainId="opportunities" />
            <Stage name="Closed Won" val={isNA(funnel.closedWonCount) ? 0 : num(funnel.closedWonCount)} explainId="closedWon" />
          </div>
          <div className="h-funnel-conv">
            <span className="conv">▶ {pct(funnel.sql, funnel.mql)} MQL → SQL</span>
            <span className="conv">▶ {isNA(funnel.opp) ? 'SQL → Qualified n/a' : `${pct(funnel.opp, funnel.sql)} SQL → Qualified`}</span>
            <span className="conv">▶ {isNA(funnel.closedWonCount) || isNA(funnel.opp) ? 'Qualified → Won n/a' : `${pct(funnel.closedWonCount, funnel.opp)} Qualified → Won`}</span>
          </div>
        </div>
      </div>

      {/* 2b. Run-this-period vs ongoing impact (W6 — Margot's "apply the same logic here
          as well": the split already on Pipeline/Events/Board, now on the Overview too) */}
      <CurrentVsOngoing />

      {/* The campaigns deliberately left OUT of every figure above, named (20 Aug). */}
      {unmapped?.count > 0 && (
        <div className="callout" style={{ marginBottom: 18 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
          <div className="callout-body">
            <strong>Excluded from this page: {unmapped.count} campaign{unmapped.count === 1 ? '' : 's'} with no marketing channel.</strong>{' '}
            Salesforce holds no channel for these, so they are no longer counted in any figure above. Between them they
            carry <strong>{eur(unmapped.pipeline)}</strong> open pipeline and{' '}
            <strong>{eur(unmapped.closedWon)}</strong> closed-won. Tell us which of these are marketing-driven and
            we'll map them to a channel so they count again:
            <div className="tbl-scroll" style={{ marginTop: 8 }}>
              <table className="tbl">
                <thead>
                  <tr><th>Campaign</th><th>Salesforce type</th><th className="r">MQLs</th><th className="r">Pipeline</th><th className="r">Closed-Won</th></tr>
                </thead>
                <tbody>
                  {unmapped.campaigns.map((c) => (
                    <tr key={c.campaignKey}>
                      <td>{c.campaignName}</td>
                      <td>{c.campaignType || '—'}</td>
                      <td className="r mono">{num(c.mql)}</td>
                      <td className="r mono">{eur(c.pipeline)}</td>
                      <td className="r mono">{eur(c.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Pipeline vs Closed-Won by Channel */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Pipeline vs Closed-Won by Channel <Explain id="otherChannel" /></div>
            <div className="panel-sub">Influenced pipeline against the revenue it converted into, per channel</div>
          </div>
        </div>
        <div className="panel-body">
          <div className="tribar">
            {byChannel.map((c) => (
              <div className="group" key={c.channel}>
                <div className="group-head">
                  <div className="group-name">{c.channel}</div>
                </div>
                <div className="stack">
                  <div className="bar-row">
                    <div className="bar-label">Influenced pipeline</div>
                    <div className="bar-track"><div className="bar-fill bf-blue" style={{ width: `${(c.pipeline / maxPipe) * 100}%` }} /></div>
                    <div className="bar-val">{eur(c.pipeline)}</div>
                  </div>
                  <div className="bar-row">
                    <div className="bar-label">Closed-won</div>
                    <div className="bar-track"><div className="bar-fill bf-green" style={{ width: `${ratio(c.closedWon, maxPipe) * 100}%` }} /></div>
                    <div className="bar-val">{eur(c.margin)}</div>
                  </div>
                </div>
              </div>
            ))}
            {showOutreach && (
              <div className="group" key="outreach-indicative" style={{ opacity: 0.85 }}>
                <div className="group-head">
                  <div className="group-name">Outreach · outbound <span className="chip neu">contact-attributed</span></div>
                  <div className="group-roi">indicative · not in totals</div>
                </div>
                <div className="stack">
                  <div className="bar-row">
                    <div className="bar-label">Influenced pipeline</div>
                    <div className="bar-track"><div className="bar-fill bf-blue" style={{ width: `${Math.min(ratio(outbound.pipeline, maxPipe), 1) * 100}%` }} /></div>
                    <div className="bar-val">{eur(outbound.pipeline)}</div>
                  </div>
                  <div className="bar-row">
                    <div className="bar-label">Closed-won</div>
                    <div className="bar-track"><div className="bar-fill bf-green" style={{ width: `${Math.min(ratio(outbound.won, maxPipe), 1) * 100}%` }} /></div>
                    <div className="bar-val">{eur(outbound.won)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="callout" style={{ marginTop: 14 }}>
            <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
            <div className="callout-body">
              <strong>On Outreach &amp; Paid Search:</strong> <strong>Outreach</strong> is shown as an{' '}
              <strong>indicative row</strong> — its meetings and opportunities are attributed by <em>contact</em>{' '}
              (Paul's method), a different basis to the campaign-attributed channels, so it can overlap them and is{' '}
              <strong>excluded from the per-channel comparison and any totals</strong>. Read <strong>Closed-Won</strong>{' '}
              as the reliable figure — the pipeline € is contact-touch and can be dominated by a single large sales-led
              deal; the full breakdown is on the Outreach page. <strong>Paid Search</strong> isn't shown because no
              paid-search campaigns ran in the period (nothing to report — not a data gap).
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Recommendations — AI synthesis layer */}
      <NotAvailablePanel
        title="Q3 Strategic Recommendations"
        what="AI-synthesised recommendations"
        why="AI-written recommendations — coming soon."
      />
    </>
  )
}

const Stage = ({ name, val, extra, explainId }) => (
  <div className="h-funnel-stage">
    <div className="stage-name">{name}{explainId && <Explain id={explainId} align="left" />}</div>
    <div className="stage-val">{val}</div>
    {extra ? <div className="stage-extra">{extra}</div> : null}
  </div>
)
