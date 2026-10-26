import { useState, Fragment } from 'react'
import { Loading, ErrorState, EmptyState } from '../States'
import QuarterPills from '../QuarterPills'
import { useOutreach, useOutreachAttributedMeetings, useOutreachRunVsOngoing } from '../../hooks/useDashboardData'
import { num, eur, isNA } from '../../data/format'
import { outreachProduct } from '../../data/queries'
import Explain from '../Explain'

const ratePct = (r, d = 1) => (isNA(r) || r == null ? 'n/a' : `${(r * 100).toFixed(d)}%`)
// Region code → the label CWSI uses (their sequence names say "UK&I", the code is "UKI").
const REGION_LABEL = { UKI: 'UK&I', BeLux: 'BeLux', NL: 'NL', UNASSIGNED: 'Unassigned' }
const regionLabel = (rc) => REGION_LABEL[rc] || rc || 'Unassigned'

// Outreach.io — SDR sales-engagement channel. Matches the functional mockup
// layout. Engagement is live (lifetime snapshot); meetings are Outreach-sourced
// and render explicit "pending" (Outreach meetings feed reads 0 — never fabricated).
// SQL / pipeline were removed from this page (no Outreach↔Salesforce link).
export default function Outreach() {
  // Practice area is page-local (pillar lives only in this feed, not globally).
  const [workstream, setWorkstream] = useState(null) // OR2: Type of Outreach filter
  // Margot (20 Jul): this page is ONLY about the 3 marketing workstreams (Historic Data
  // Reactivation / SoPro / Microsoft TUM) — sales & one-off sequences are always excluded.
  // Hard-locked marketing-only (the "All sequences" toggle was removed).
  const q = useOutreach(workstream, true)
  const mtg = useOutreachAttributedMeetings(true, workstream) // follows the Type of Outreach filter

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Outreach<span className="accent">.io</span> — Sales Engagement</div>
          <div className="page-sub">
            Sales engagement · prospects, emails, replies and the meetings that followed · FY2026
          </div>
        </div>
        <QuarterPills />
      </div>

      <div className="callout" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          <strong>Channel scope:</strong> Outreach.io covers SDR-led sales engagement — multi-step
          cadences with replies and meetings booked. Figures are a <strong>cumulative lifetime
          snapshot</strong> (not a daily trend); <strong>region</strong> scopes them. <strong>Meetings booked</strong>{' '}
          count only where the person <strong>replied to the outreach</strong> and met soon after; <strong>opportunities</strong>{' '}
          count only where Salesforce links the deal to one of the <strong>Outreach campaigns</strong>. This page reports on the{' '}
          <strong>three marketing workstreams only</strong> — Historic Data Reactivation, Outbound Prospecting · SoPro,
          and Outbound Prospecting · Microsoft TUM; sales &amp; one-off account sequences are excluded throughout.
        </div>
      </div>

      {/* Filter — Type of Outreach (the 3 marketing workstreams). The "Sequence set" toggle was
          removed (Margot 20 Jul): the page is always marketing-only, so there's nothing to toggle. */}
      <div className="filters">
        <div className="filter" title="Filter by workstream (Type of Outreach) — the three marketing workstreams: Historic Data Reactivation, Outbound Prospecting · SoPro, and Outbound Prospecting · Microsoft TUM.">
          <span className="label">Type of Outreach</span>
          <select value={workstream ?? 'all'} onChange={(e) => setWorkstream(e.target.value === 'all' ? null : e.target.value)}>
            <option value="all">All workstreams</option>
            <option value="Historic Data Reactivation">Historic Data Reactivation</option>
            <option value="Outbound Prospecting · SoPro">Outbound Prospecting · SoPro</option>
            <option value="Outbound Prospecting · Microsoft TUM">Outbound Prospecting · Microsoft TUM</option>
          </select>
        </div>
      </div>

      {q.isLoading && <Loading label="Loading Outreach snapshot…" />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && <EmptyState message="No marketing Outreach sequences for this region / workstream." />}
      {q.data && q.data.hasData && <Body data={q.data} meetings={mtg.data} />}
    </>
  )
}

const MEETINGS_TARGET = 100 // Paul's Q2 outbound-generated meetings target (24 Apr call)

function Body({ data, meetings }) {
  const { kpis, workstreams, sellers, seqCounts, marketingOnly, snapshotDate } = data
  const su = data.sequenceUsage // created vs ever-used vs live-now (prospect-level, not "enabled")
  const eb = data.emailBasis // replies/opens per email delivered — the PRIMARY basis (W3)
  const outbound = meetings?.tiers?.outbound ?? null
  const rule = meetings?.rule ?? null // the attribution rule's working (candidates -> rejected -> attributed)
  // Attribution (meetings / opps / won) per sequence, for merging onto product & seller rows.
  // A meeting or opp can match several sequences, so these merged sums can overlap — noted
  // under each table; the de-duplicated truth is the tier figure on the attribution panel.
  const seqAttr = new Map((meetings?.bySequence || []).map((s) => [s.sequence, s]))
  const attrFor = (names) => {
    const acc = { meetings: 0, createdOpps: 0, oppValue: 0, closedWon: 0 }
    for (const n of names || []) {
      const s = seqAttr.get(n)
      if (s) { acc.meetings += s.meetings; acc.createdOpps += s.createdOpps; acc.oppValue += s.oppValue; acc.closedWon += s.closedWon }
    }
    return acc
  }
  return (
    <>
      {/* Scope + basis, stated where the questioned figures are read. The prospect and
          reply-rate counters are ALL-TIME per-sequence counters (the quarter pill does not
          change them), cover the 3 marketing workstreams only, and the reply rate is per
          PERSON — Outreach.io's own reporting is usually per EMAIL, which reads far lower. */}
      <div className="callout" style={{ marginBottom: 14 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          <strong>Which figures move with the quarter.</strong> <strong>Meetings</strong> and the
          run-this-period panel are <strong>dated</strong>, so they follow the quarter and region you
          select. <strong>Prospects, emails, opens and replies are lifetime totals</strong> and do not
          — the sales engagement platform reports these as running per-sequence counters rather than
          dated activity{snapshotDate ? <>, as at <strong>{snapshotDate}</strong></> : null}, so they
          cannot honestly be cut by quarter. Where a figure is lifetime it says so beside it.
          They cover the <strong>three marketing workstreams only</strong>
          {seqCounts ? <> ({num(seqCounts.marketing)} of {num(seqCounts.total)} sequences in the account)</> : null}, so
          they are deliberately far smaller than the whole Outreach.io account — the sales and one-off account
          sequences are excluded on purpose. <strong>Open and reply rates are per email delivered</strong> — the same
          basis Outreach.io's own reports use, and one that can never read above 100%. The per-person rate
          (replies ÷ prospects, which reads higher because a cadence sends several emails to each person) is kept as
          the smaller secondary line. <strong>Meetings</strong> are credited only when the person was emailed by the
          sequence and <strong>replied</strong>; <strong>opportunities</strong> only when the deal's Salesforce campaign is
          one of the Outreach campaigns. Being emailed by a sequence is not, on its own, enough to claim a meeting or a deal.{' '}
          <Explain id="outreachReplyRate" />
        </div>
      </div>

      {/* 4 KPI cards (mockup order: sequences, prospects, reply rate, meetings) */}
      <div className="kpis cols-4">
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" /></svg></div>
            <span className="tl green"><span className="tl-dot" />Active</span>
          </div>
          <div className="kpi-label">Sequences live now <Explain id="outreachSequencesLive" /></div>
          <div className="kpi-val">{num(su ? su.liveNow : kpis.activeSequences)}</div>
          <div className="kpi-sub">
            <span className="kpi-target">
              {num(su ? su.created : kpis.totalSequences)} created · {num(su ? su.everUsed : 0)} ever used
            </span>
            {su && su.neverUsed > 0 && (
              <span className="kpi-target" style={{ display: 'block', opacity: 0.65 }}>
                {num(su.neverUsed)} built but never sent to
              </span>
            )}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24"><path d="M9 11H6a2 2 0 0 0-2 2v7h16v-7a2 2 0 0 0-2-2h-3" /><circle cx="12" cy="7" r="4" /></svg></div>
          </div>
          <div className="kpi-label">Prospects in cadence <Explain id="outreachProspects" /></div>
          <div className="kpi-val">{num(su ? su.activeProspects : kpis.prospects)}</div>
          <div className="kpi-sub">
            <span className="kpi-target">
              currently working through a sequence{su ? <> · {num(kpis.prospects)} ever added</> : null} · lifetime
            </span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></div>
          </div>
          <div className="kpi-label">Reply rate · per email <Explain id="outreachReplyRate" /></div>
          <div className="kpi-val">{eb && eb.delivered > 0 ? ratePct(eb.replyRate) : '—'}</div>
          <div className="kpi-sub">
            {eb && eb.delivered > 0 && (
              <span className="kpi-target">
                {num(eb.replies)} replies ÷ {num(eb.delivered)} emails delivered · <strong>all-time</strong>
              </span>
            )}
            <span className="kpi-target" style={{ display: 'block', opacity: 0.65 }}>
              {ratePct(kpis.replyRate)} per person ({num(kpis.replies)} ÷ {num(kpis.prospects)} prospects) — reads
              higher because each person gets several emails
            </span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /></svg></div>
            {outbound != null && (
              <span className={`tl ${outbound >= MEETINGS_TARGET ? 'green' : outbound >= MEETINGS_TARGET * 0.8 ? 'amber' : 'neu'}`}>
                <span className="tl-dot" />{Math.round((outbound / MEETINGS_TARGET) * 100)}%
              </span>
            )}
          </div>
          <div className="kpi-label">Meetings booked <Explain id="outreachMeetings" /></div>
          <div className="kpi-val">{outbound == null ? '—' : num(outbound)}</div>
          <div className="kpi-sub">
            <span className="kpi-target">
              with someone who replied to the outreach · vs {MEETINGS_TARGET} target
            </span>
            {rule && rule.influenced > 0 && (
              <span className="kpi-target" style={{ display: 'block', opacity: 0.65 }}>
                {num(rule.influenced)} meetings involved someone we emailed at some point (the
                all-time report's wider basis)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Engagement funnel — per-EMAIL basis (W3): every rate here has emails delivered as its
          denominator, so nothing can read above 100%. The old per-person open rate (open EVENTS
          ÷ people) is gone — it exceeded 100% by construction and read as a data error. */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Outreach Engagement Funnel</div>
            <div className="panel-sub">Prospects → Emails delivered → Opens → Replies → Meetings · rates per email delivered · engagement is lifetime, meetings follow the selected quarter · all figures follow the Type of Outreach filter</div>
          </div>
          <span className="chip blue">snapshot</span>
        </div>
        <div className="panel-body">
          <div className="h-funnel">
            <Stage name="Prospects" val={num(kpis.prospects)} extra="people in cadence" />
            <Stage name="Emails delivered" val={eb ? num(eb.delivered) : '—'} extra={eb && kpis.prospects ? `≈${(eb.delivered / kpis.prospects).toFixed(1)} per prospect` : 'per-step feed'} />
            <Stage name="Opens" val={eb ? num(eb.opens) : '—'} extra={eb && eb.delivered > 0 ? `${ratePct(eb.openRate, 0)} of delivered` : 'n/a'} />
            <Stage name="Replies" val={eb ? num(eb.replies) : '—'} extra={eb && eb.delivered > 0 ? `${ratePct(eb.replyRate)} of delivered` : 'n/a'} />
            <Stage name="Meetings" val={outbound == null ? '—' : num(outbound)} extra="attributed via Salesforce" />
          </div>
        </div>
      </div>

      <OutreachRunVsOngoing />

      {/* How the meetings figure is arrived at. Shown because this number is far smaller than
          the one previously on the page (35 -> 6) and a shrinking figure with no explanation
          invites less trust than the arithmetic does. */}
      {rule && rule.candidates > 0 && (
        <div className="callout" style={{ marginBottom: 18 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
          <div className="callout-body">
            <strong>How meetings are credited to Outreach.</strong> A meeting counts only when the person
            was <strong>emailed by the sequence</strong>, <strong>replied</strong> to it, met{' '}
            <strong>between the first email and 90 days after replying</strong>, and had{' '}
            <strong>no meeting with CWSI before the outreach began</strong>. Of{' '}
            <strong>{num(rule.candidates)}</strong> meetings involving someone who appears in a sequence:{' '}
            <strong>{num(rule.rejectedNeverEmailed)}</strong> were with people never emailed,{' '}
            <strong>{num(rule.rejectedBeforeOutreach)}</strong> took place before the outreach started,{' '}
            <strong>{num(rule.rejectedNoReply)}</strong> were with people who never replied to the outreach,{' '}
            <strong>{num(rule.rejectedOutsideWindow)}</strong> fell more than 90 days after the reply, and{' '}
            <strong>{num(rule.rejectedExistingRelationship)}</strong> were with people CWSI was already meeting
            before the outreach — existing customer and project meetings the outreach did not create. That
            leaves <strong>{num(rule.attributed)}</strong>.
            <br />
            <strong>Meetings, not attendees.</strong> Salesforce writes one record per person
            invited, so a meeting with three attendees appears three times. These figures count each
            meeting once, matching on subject and date.
            {rule.influenced > 0 && (
              <>
                <br />
                <strong>Reconciling with the all-time Outreach report:</strong> that report shows{' '}
                <strong>{num(rule.influenced)}</strong> on the same data. It uses the wider test —
                the person was emailed, with no requirement that the meeting followed the outreach —
                and describes the figure as <em>influence, not attribution</em>. Both are correct
                answers to different questions; this page reports the narrower, causal one.
              </>
            )}
          </div>
        </div>
      )}

      {/* The standalone "Meetings Booked — Attributed to Outreach" section was REMOVED
          (client, 20 Aug: "remove it — data already reflected elsewhere"). Meetings remain
          as a KPI card and a column on the tables below, counted once. */}

      {/* Sequence Performance — by Workstream (OR7/OR8) */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Sequence Performance — by Workstream</div>
            <div className="panel-sub">
              {marketingOnly && seqCounts
                ? <><strong>{num(seqCounts.marketing)} marketing sequences</strong> of {num(seqCounts.total)} total · </>
                : <>All {num(seqCounts?.total)} sequences · </>}
              the three marketing workstreams (Historic Data Reactivation · Outbound Prospecting SoPro / Microsoft TUM) → region → product / flow
            </div>
          </div>
          <span className="chip blue">{num(kpis.totalSequences)} sequences</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Product / sequence group</th>
                <th className="r">Prospects</th>
                <th className="r">Emails sent</th>
                <th className="r">Open % <span style={{ opacity: 0.55 }}>per email</span></th>
                <th className="r">Reply % <span style={{ opacity: 0.55 }}>per email</span></th>
                <th className="r">Meetings</th>
                <th className="r">Created Opportunities</th>
                <th className="r">Closed Won €</th>
              </tr>
            </thead>
            <tbody>
              {workstreams.map((g) => <WorkstreamGroup key={g.workstream} g={g} attrFor={attrFor} opps={meetings?.oppByWorkstream?.[g.workstream]} />)}
              <tr className="total">
                <td>Total · {num(kpis.totalSequences)} sequences</td>
                <td className="r mono">{num(kpis.prospects)}</td>
                <td className="r mono">{eb ? num(eb.delivered) : '—'}</td>
                <td className="r mono">{eb && eb.delivered > 0 ? ratePct(eb.openRate, 0) : 'n/a'}</td>
                <td className="r mono">{eb && eb.delivered > 0 ? ratePct(eb.replyRate) : 'n/a'}</td>
                <td className="r mono">{meetings ? num(meetings.tiers.outbound) : '—'}</td>
                <td className="r mono">{meetings?.oppTiers?.outbound?.createdOpps ? num(meetings.oppTiers.outbound.createdOpps) : '—'}</td>
                <td className="r mono">{meetings?.oppTiers?.outbound && !isNA(meetings.oppTiers.outbound.won) ? eur(meetings.oppTiers.outbound.won) : '—'}</td>
              </tr>
            </tbody>
          </table>
          <div className="panel-note" style={{ padding: '8px 12px 12px', fontSize: 12, opacity: 0.7 }}>
            Meetings count only people who replied to the outreach. <strong>Created Opportunities and Closed Won come from the
            Outreach campaigns in Salesforce</strong>, one campaign per workflow rather than per sequence or seller, so they are
            shown on each workstream's subtotal line, not on the product rows. A meeting can involve prospects from several
            sequence groups, so the meetings column can overlap across rows — the{' '}
            <strong>Total row shows the de-duplicated truth</strong>, counting each meeting and deal once.
          </div>
        </div>
      </div>

      <OutreachDeals deals={meetings?.oppDeals} />

      {/* W3 — Seller performance (marketing campaigns only): the rep segment retained */}
      {sellers && sellers.length > 0 && (
        <SellerTable sellers={sellers} attrFor={attrFor} />
      )}

      <div className="callout amber" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div className="callout-body">
          <strong>Open % / Reply %</strong> are per <strong>email delivered</strong> and show "n/a" only where the
          per-step feed has no delivered count for that group yet. Engagement counts (prospects → replies) are the live
          Outreach snapshot; <strong>Meetings booked</strong> come from Salesforce and count only people who replied to the
          outreach; <strong>Created Opportunities / Closed Won</strong> are the deals Salesforce links to the Outreach
          campaigns. <strong>Sequence set:</strong> per your
          feedback this view shows <strong>only the three marketing workstreams</strong> — Historic Data Reactivation,
          Outbound Prospecting · SoPro, and Outbound Prospecting · Microsoft TUM — with sales &amp;
          one-off account sequences excluded throughout.
        </div>
      </div>
    </>
  )
}

// Per-email rates (W3): opens/replies ÷ emails delivered for the row's sequences — never
// above 100% (open events are capped at delivered). 'n/a' where the per-step feed has no
// delivered count for the flow yet.
const rowOpenPct = (r) => (r.delivered > 0 ? `${Math.min(r.emailOpens / r.delivered, 1) * 100 < 100 ? (Math.min(r.emailOpens / r.delivered, 1) * 100).toFixed(0) : '100'}%` : 'n/a')
const rowReplyPct = (r) => (r.delivered > 0 ? `${((r.emailReplies / r.delivered) * 100).toFixed(1)}%` : 'n/a')

function WorkstreamGroup({ g, attrFor, opps }) {
  const sub = g.subtotal
  const subEmail = g.rows.reduce((a, r) => ({ delivered: a.delivered + (r.delivered || 0), emailOpens: a.emailOpens + (r.emailOpens || 0), emailReplies: a.emailReplies + (r.emailReplies || 0) }), { delivered: 0, emailOpens: 0, emailReplies: 0 })
  const subAttr = attrFor(g.rows.flatMap((r) => r.sequenceNames || []))
  // Group this workstream's product flows BY REGION so the region name shows ONCE (a
  // sub-header), not repeated on every product row (Margot, 20 Jul). Regions ordered by size.
  const byRegion = new Map()
  for (const r of g.rows) {
    const k = r.region || 'UNASSIGNED'
    if (!byRegion.has(k)) byRegion.set(k, [])
    byRegion.get(k).push(r)
  }
  const regionGroups = [...byRegion.entries()]
    .map(([region, rows]) => ({ region, rows, prospects: rows.reduce((a, r) => a + (r.prospects || 0), 0) }))
    .sort((a, b) => b.prospects - a.prospects)
  return (
    <>
      <tr className="cat"><td colSpan={8}>{g.workstream} · {num(sub.sequences)} sequences</td></tr>
      {regionGroups.map((rg) => (
        <Fragment key={rg.region}>
          <tr>
            <td colSpan={8} style={{ paddingLeft: 22, fontWeight: 600, opacity: 0.7, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {regionLabel(rg.region)} · {num(rg.prospects)} prospects
            </td>
          </tr>
          {rg.rows.map((r, i) => {
            const a = attrFor(r.sequenceNames)
            return (
              <tr key={r.label + '|' + r.region + i}>
                <td style={{ paddingLeft: 34 }}>{r.label}{r.sequences > 1 ? <span style={{ opacity: 0.55 }}> · {num(r.sequences)} flows</span> : null}</td>
                <td className="r mono">{num(r.prospects)}</td>
                <td className="r mono">{r.delivered > 0 ? num(r.delivered) : '—'}</td>
                <td className="r mono">{rowOpenPct(r)}</td>
                <td className="r mono">{rowReplyPct(r)}</td>
                <td className="r mono">{a.meetings ? num(a.meetings) : '—'}</td>
                <td className="r mono">{a.createdOpps ? num(a.createdOpps) : '—'}</td>
                <td className="r mono">{a.closedWon ? eur(a.closedWon) : '—'}</td>
              </tr>
            )
          })}
        </Fragment>
      ))}
      <tr className="total">
        <td>subtotal</td>
        <td className="r mono">{num(sub.prospects)}</td>
        <td className="r mono">{subEmail.delivered > 0 ? num(subEmail.delivered) : '—'}</td>
        <td className="r mono">{rowOpenPct(subEmail)}</td>
        <td className="r mono">{rowReplyPct(subEmail)}</td>
        <td className="r mono">{subAttr.meetings ? num(subAttr.meetings) : '—'}</td>
        <td className="r mono">{opps?.createdOpps ? num(opps.createdOpps) : '—'}</td>
        <td className="r mono">{opps?.won ? eur(opps.won) : '—'}</td>
      </tr>
    </>
  )
}

// W3 — Seller performance (marketing sequences only): engagement from the Outreach snapshot,
// meetings/opps/won merged from the Salesforce attribution rows via the rep segment of each
// sequence name. Sellers whose sequences carry no rep segment (e.g. Historic Data
// Reactivation) aren't listed — that workstream reports in the table above.
function SellerTable({ sellers, attrFor }) {
  // The seller is the owner of the MAILBOX the emails are sent from (v_outreach_seller), not a
  // name parsed out of the sequence title. Assignment and sending share that one key, so these
  // rows sum to the totals above — the client's "per-seller figures don't align with the
  // overviews" was two different keys being unioned.
  const started = sellers.filter((x) => x.emailed > 0)
  const notStarted = sellers.filter((x) => x.emailed === 0)
  const tot = (k) => sellers.reduce((a, x) => a + (Number(x[k]) || 0), 0)
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Seller Performance</div>
          <div className="panel-sub">
            Per seller · the person whose mailbox the emails are sent from · engagement lifetime · meetings follow the selected quarter · opportunities are reported per workstream, from the Outreach campaigns
          </div>
        </div>
        <span className="chip blue">{num(sellers.length)} sellers</span>
      </div>
      <div className="panel-body no-pad">
        <table className="tbl">
          <thead>
            <tr>
              <th>Seller</th>
              <th className="r">Sequences</th>
              <th className="r">Prospects assigned</th>
              <th className="r">In cadence</th>
              <th className="r">People emailed</th>
              <th className="r">Emails sent</th>
              <th className="r">Opened <span style={{ opacity: 0.55 }}>of those emailed</span></th>
              <th className="r">Replied <span style={{ opacity: 0.55 }}>of those emailed</span></th>
              <th className="r">Meetings</th>
            </tr>
          </thead>
          <tbody>
            {[...started, ...notStarted].map((x) => {
              const a = attrFor(x.sequenceNames)
              const idle = x.emailed === 0
              return (
                <tr key={x.seller} style={idle ? { opacity: 0.62 } : undefined}>
                  <td>{x.seller}</td>
                  <td className="r mono">{num(x.sequences)}</td>
                  <td className="r mono">{num(x.prospects)}</td>
                  <td className="r mono">{num(x.active)}</td>
                  <td className="r mono">{idle ? 'none yet' : num(x.emailed)}</td>
                  <td className="r mono">{idle ? '—' : num(x.delivered)}</td>
                  <td className="r mono">{x.openRatePct == null ? '—' : `${x.openRatePct}%`}</td>
                  <td className="r mono">{x.replyRatePct == null ? '—' : `${x.replyRatePct}%`}</td>
                  <td className="r mono">{a.meetings ? num(a.meetings) : '—'}</td>
                </tr>
              )
            })}
            <tr className="total">
              <td>Total · {num(sellers.length)} sellers</td>
              <td className="r mono">{num(tot('sequences'))}</td>
              <td className="r mono">{num(tot('prospects'))}</td>
              <td className="r mono">{num(tot('active'))}</td>
              <td className="r mono">{num(tot('emailed'))}</td>
              <td className="r mono">{num(tot('delivered'))}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
        <div className="panel-note" style={{ padding: '8px 12px 12px', fontSize: 12, opacity: 0.7 }}>
          <strong>The seller is whoever owns the mailbox the emails go out from.</strong> Prospects
          assigned, emails sent and both rates use that same person, so these rows add up to the
          figures above — and a seller with two mailboxes (from a company-domain change) is still
          one row. Open and reply rates are the share of <strong>people actually emailed</strong>,
          never of prospects merely assigned.
          {notStarted.length > 0 && (
            <>
              {' '}<strong>{notStarted.length} sellers have prospects loaded but nothing sent yet</strong>
              {' '}({notStarted.map((x) => x.seller).join(', ')}) — greyed above, showing prospects
              assigned and no engagement. Their sequences have not been started; this is not missing data.
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Run-this-period vs ongoing impact for Outreach — the client's Generic item ("Also not
// showing for Outreach"). Split on each prospect's FIRST TOUCH date, the same principle as the
// opportunity-creation-date basis used elsewhere. Engagement only, and the panel says why:
// the commercial side rests on two campaign-linked opportunities, which cannot be honestly
// divided into two buckets.
function OutreachRunVsOngoing() {
  const q = useOutreachRunVsOngoing()
  const d = q.data
  if (!d || !d.hasData) return null
  const Col = ({ title, sub, v }) => (
    <div className="kpi">
      <div className="kpi-label">{title}</div>
      <div className="kpi-val">{num(v.emailed)}</div>
      <div className="kpi-sub">
        <span className="kpi-target">{sub}</span>
        <span className="kpi-target" style={{ display: 'block', opacity: 0.7 }}>
          {num(v.prospects)} added · {num(v.delivered)} emails · {num(v.replied)} replied
        </span>
      </div>
    </div>
  )
  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Outreach Run This Period vs Ongoing Impact</div>
          <div className="panel-sub">People first contacted in this period, against those first contacted earlier</div>
        </div>
      </div>
      <div className="panel-body">
        <div className="kpis cols-2">
          <Col title="Contacted this period" sub="first emailed inside the selected window" v={d.run} />
          <Col title="Contacted earlier, still working" sub="first emailed before this window" v={d.ongoing} />
        </div>
        <p className="panel-note" style={{ padding: '6px 4px 0', fontSize: 12, opacity: 0.7 }}>
          Split on the date each person was <strong>first worked</strong>, the same principle as the
          opportunity-creation date used elsewhere on the dashboard. <strong>Engagement only:</strong>{' '}
          the commercial side of Outreach currently rests on two opportunities linked to the dedicated
          Salesforce campaigns, which is too few to divide between the two periods without inventing
          precision — so it is reported once, in full, rather than split.
        </p>
      </div>
    </div>
  )
}

const Stage = ({ name, val, extra }) => (
  <div className="h-funnel-stage">
    <div className="stage-name">{name}</div>
    <div className="stage-val">{val}</div>
    {extra ? <div className="stage-extra">{extra}</div> : null}
  </div>
)

// The deals behind the Outreach opportunity figures, listed so the number can be checked by
// hand (client, 23 Oct: "who are those 13?"). Basis: the deal's Salesforce primary campaign is
// one of the Outreach workflow campaigns — the client's 20 Aug choice.
function OutreachDeals({ deals }) {
  if (!deals) return null
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Opportunities from the Outreach campaigns</div>
          <div className="panel-sub">
            Every deal Salesforce links to an Outreach campaign · follows the selected quarter, region and Type of Outreach
          </div>
        </div>
        <span className="chip blue">{num(deals.length)} {deals.length === 1 ? 'opportunity' : 'opportunities'}</span>
      </div>
      <div className="panel-body no-pad">
        {deals.length === 0 ? (
          <div style={{ padding: '14px 16px', opacity: 0.75 }}>
            No opportunities in this period have one of the Outreach campaigns as their Salesforce campaign.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Account</th>
                <th>Salesforce campaign</th>
                <th>Created</th>
                <th>Stage</th>
                <th className="r">Gross profit €</th>
                <th className="r">Revenue €</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.oppId}>
                  <td>{d.name || d.oppId}</td>
                  <td>{d.account || '—'}</td>
                  <td>{d.campaign}</td>
                  <td className="mono">{d.created}</td>
                  <td>{d.stage}</td>
                  <td className="r mono">{d.grossProfit == null ? '—' : eur(d.grossProfit)}</td>
                  <td className="r mono">{eur(d.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
