import { useState, Fragment } from 'react'
import { Loading, ErrorState, EmptyState } from '../States'
import { useOutreach, useOutreachAttributedMeetings } from '../../hooks/useDashboardData'
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
  const mtg = useOutreachAttributedMeetings(true)

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Outreach<span className="accent">.io</span> — Sales Engagement</div>
          <div className="page-sub">
            SDR cadences · prospect-to-MQL handoff · cumulative snapshot
            {q.data?.snapshotDate ? ` as of ${q.data.snapshotDate}` : ''} · FY2026
          </div>
        </div>
      </div>

      <div className="callout" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          <strong>Channel scope:</strong> Outreach.io covers SDR-led sales engagement — multi-step
          cadences with replies and meetings booked. Figures are a <strong>cumulative lifetime
          snapshot</strong> (not a daily trend); <strong>region</strong> scopes them. <strong>Meetings booked</strong>{' '}
          are now <strong>attributed via Salesforce</strong> — a meeting is credited to a sequence when its
          contact is a member of that sequence (the agreed attribution method). This page reports on the{' '}
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
  const eb = data.emailBasis // replies/opens per email delivered — the PRIMARY basis (W3)
  const outbound = meetings?.tiers?.outbound ?? null
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
          <strong>Reading these four figures.</strong> They are <strong>all-time</strong> running counters from
          Outreach.io{snapshotDate ? <> as at <strong>{snapshotDate}</strong></> : null} — <strong>the quarter pill
          does not change them</strong>, because Outreach.io gives us per-sequence totals rather than dated activity.
          They cover the <strong>three marketing workstreams only</strong>
          {seqCounts ? <> ({num(seqCounts.marketing)} of {num(seqCounts.total)} sequences in the account)</> : null}, so
          they are deliberately far smaller than the whole Outreach.io account — the sales and one-off account
          sequences are excluded on purpose. <strong>Open and reply rates are per email delivered</strong> — the same
          basis Outreach.io's own reports use, and one that can never read above 100%. The per-person rate
          (replies ÷ prospects, which reads higher because a cadence sends several emails to each person) is kept as
          the smaller secondary line. <strong>Meetings and opportunities</strong> are credited only when the matched
          prospect was <strong>actually contacted</strong> — people sitting in a sequence's queue who have not yet
          received an email cannot claim credit.{' '}
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
          <div className="kpi-label">Active sequences</div>
          <div className="kpi-val">{num(kpis.activeSequences)}</div>
          <div className="kpi-sub"><span className="kpi-target">{num(kpis.totalSequences)} total · all-time</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24"><path d="M9 11H6a2 2 0 0 0-2 2v7h16v-7a2 2 0 0 0-2-2h-3" /><circle cx="12" cy="7" r="4" /></svg></div>
          </div>
          <div className="kpi-label">Prospects in cadence <Explain id="outreachProspects" /></div>
          <div className="kpi-val">{num(kpis.prospects)}</div>
          <div className="kpi-sub">
            <span className="kpi-target">
              unique prospects · <strong>all-time</strong>, not this quarter
              {snapshotDate ? ` · as at ${snapshotDate}` : ''}
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
          <div className="kpi-sub"><span className="kpi-target">outbound-attributed · vs {MEETINGS_TARGET} target</span></div>
        </div>
      </div>

      {/* Engagement funnel — per-EMAIL basis (W3): every rate here has emails delivered as its
          denominator, so nothing can read above 100%. The old per-person open rate (open EVENTS
          ÷ people) is gone — it exceeded 100% by construction and read as a data error. */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Outreach Engagement Funnel</div>
            <div className="panel-sub">Prospects → Emails delivered → Opens → Replies → Meetings · rates per email delivered</div>
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
          <div className="h-funnel-conv">
            <span className="conv">▶ {eb && eb.delivered > 0 ? `${ratePct(eb.openRate, 0)} Open` : 'Open n/a'}</span>
            <span className="conv">▶ {eb && eb.delivered > 0 ? `${ratePct(eb.replyRate)} Reply` : 'Reply n/a'}</span>
            <span className="conv">▶ Meeting → attributed via SF · contacted prospects only</span>
          </div>
        </div>
      </div>

      {/* Meetings attributed to Outreach sequences (CC-6, Paul's method) */}
      {meetings && <MeetingAttribution m={meetings} />}

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
                <th>Product / flow</th>
                <th className="r">Prospects</th>
                <th className="r">Emails sent</th>
                <th className="r">Open % <span style={{ opacity: 0.55 }}>per email</span></th>
                <th className="r">Reply % <span style={{ opacity: 0.55 }}>per email</span></th>
                <th className="r">Meetings</th>
                <th className="r">Created Opps</th>
                <th className="r">Closed Won €</th>
              </tr>
            </thead>
            <tbody>
              {workstreams.map((g) => <WorkstreamGroup key={g.workstream} g={g} attrFor={attrFor} />)}
              <tr className="total">
                <td>Total · {num(kpis.totalSequences)} sequences</td>
                <td className="r mono">{num(kpis.prospects)}</td>
                <td className="r mono">{eb ? num(eb.delivered) : '—'}</td>
                <td className="r mono">{eb && eb.delivered > 0 ? ratePct(eb.openRate, 0) : 'n/a'}</td>
                <td className="r mono">{eb && eb.delivered > 0 ? ratePct(eb.replyRate) : 'n/a'}</td>
                <td className="r mono">{meetings ? num(meetings.tiers.outbound) : '—'}</td>
                <td className="r mono">{meetings?.oppTiers?.outbound ? num(meetings.oppTiers.outbound.createdOpps) : '—'}</td>
                <td className="r mono">{meetings?.oppTiers?.outbound ? eur(meetings.oppTiers.outbound.won) : '—'}</td>
              </tr>
            </tbody>
          </table>
          <div className="panel-note" style={{ padding: '8px 12px 12px', fontSize: 12, opacity: 0.7 }}>
            Meetings, Created Opps and Closed Won are Salesforce-attributed (contacted prospects only). A meeting or
            deal can involve prospects from several flows, so those columns can overlap across rows — the{' '}
            <strong>Total row shows the de-duplicated truth</strong>, counting each meeting and deal once.
          </div>
        </div>
      </div>

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
          per-step feed has no delivered count for a flow yet. Engagement counts (prospects → replies) are the live
          Outreach snapshot; <strong>Meetings booked / Created Opps / Closed Won</strong> are attributed from
          Salesforce, counting only prospects who were actually contacted. <strong>Sequence set:</strong> per your
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

function WorkstreamGroup({ g, attrFor }) {
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
        <td className="r mono">{subAttr.createdOpps ? num(subAttr.createdOpps) : '—'}</td>
        <td className="r mono">{subAttr.closedWon ? eur(subAttr.closedWon) : '—'}</td>
      </tr>
    </>
  )
}

// W3 — Seller performance (marketing sequences only): engagement from the Outreach snapshot,
// meetings/opps/won merged from the Salesforce attribution rows via the rep segment of each
// sequence name. Sellers whose sequences carry no rep segment (e.g. Historic Data
// Reactivation) aren't listed — that workstream reports in the table above.
function SellerTable({ sellers, attrFor }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Seller Performance — marketing sequences</div>
          <div className="panel-sub">Per seller across the SoPro / Microsoft TUM prospecting flows · engagement all-time · outcomes Salesforce-attributed</div>
        </div>
        <span className="chip blue">{num(sellers.length)} sellers</span>
      </div>
      <div className="panel-body no-pad">
        <table className="tbl">
          <thead>
            <tr>
              <th>Seller</th>
              <th className="r">Sequences</th>
              <th className="r">Prospects</th>
              <th className="r">Emails sent</th>
              <th className="r">Open % <span style={{ opacity: 0.55 }}>per email</span></th>
              <th className="r">Reply % <span style={{ opacity: 0.55 }}>per email</span></th>
              <th className="r">Meetings</th>
              <th className="r">Opps created</th>
              <th className="r">Closed Won €</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((s) => {
              const a = attrFor(s.sequenceNames)
              return (
                <tr key={s.seller}>
                  <td>{s.seller}</td>
                  <td className="r mono">{num(s.sequences)}</td>
                  <td className="r mono">{num(s.prospects)}</td>
                  <td className="r mono">{s.delivered > 0 ? num(s.delivered) : '—'}</td>
                  <td className="r mono">{rowOpenPct(s)}</td>
                  <td className="r mono">{rowReplyPct(s)}</td>
                  <td className="r mono">{a.meetings ? num(a.meetings) : '—'}</td>
                  <td className="r mono">{a.createdOpps ? num(a.createdOpps) : '—'}</td>
                  <td className="r mono">{a.closedWon ? eur(a.closedWon) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="panel-note" style={{ padding: '8px 12px 12px', fontSize: 12, opacity: 0.7 }}>
          A meeting or deal can involve prospects from several sellers' sequences, so the outcome columns can overlap
          between rows. Engagement covers each seller's marketing prospecting sequences only.
        </div>
      </div>
    </div>
  )
}

function MeetingAttribution({ m }) {
  const { tiers, oppTiers, bySequence, coverage } = m
  const ot = oppTiers?.outbound
  const catClass = (c) => (c === 'Outbound prospecting' ? 'green' : c === 'Events & campaigns' ? 'blue' : 'neu')
  if (!coverage.totalMeetings) {
    return (
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Meetings Booked — Attributed to Outreach <Explain id="outreachMeetings" /></div>
            <div className="panel-sub">Salesforce meetings matched to marketing sequences by contact email</div>
          </div>
        </div>
        <div className="panel-body"><EmptyState message="No Salesforce meetings in this scope to attribute." /></div>
      </div>
    )
  }
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Meetings Booked — Attributed to Outreach <Explain id="outreachMeetings" /></div>
          <div className="panel-sub">Salesforce meetings credited to a sequence when the contact is a member (the agreed attribution method)</div>
        </div>
        <span className="chip blue">{num(coverage.totalMeetings)} meetings in scope</span>
      </div>
      <div className="panel-body">
        {/* The "Matched from" tile was removed (Margot, 11 Aug: "I'm not sure what value the
            Matched from metric adds — please remove it"); the match coverage stays in the
            how-to-read note below for anyone auditing the attribution. */}
        <div className="kpis cols-2" style={{ marginBottom: 4 }}>
          <div className="kpi">
            <div className="kpi-head">
              <span className={`tl ${tiers.outbound >= MEETINGS_TARGET ? 'green' : tiers.outbound >= MEETINGS_TARGET * 0.8 ? 'amber' : 'neu'}`}>
                <span className="tl-dot" />{Math.round((tiers.outbound / MEETINGS_TARGET) * 100)}% of {MEETINGS_TARGET}
              </span>
            </div>
            <div className="kpi-label">Meetings booked · marketing workstreams</div>
            <div className="kpi-val">{num(tiers.outbound)}</div>
            <div className="kpi-sub"><span className="kpi-target">Historic Data Reactivation · SoPro · Microsoft TUM — the 100 target</span></div>
          </div>
        </div>

        <div className="callout" style={{ margin: '14px 0' }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
          <div className="callout-body">
            <strong>How to read this:</strong> a meeting is credited to a workstream sequence when its Salesforce
            contact email matches a prospect in that sequence. We matched <strong>{num(coverage.attributed)}</strong> of
            the <strong>{num(coverage.withEmail)}</strong> meetings that carry a contact email
            ({num(coverage.totalMeetings)} meetings in scope). The match is <strong>email-based, so coverage is
            partial</strong> (a contact who used a different email in Outreach won't match).{' '}
            <strong>This is the strict figure</strong> the 100-meetings target measures — reconciled against
            Salesforce and de-duplicated per meeting, so it cannot double-count and reads lower, not higher, than the
            true total. <strong>Marketing workstreams only:</strong> meetings whose only match was an event, campaign or
            sales sequence are excluded{coverage.excluded > 0 ? <> — {num(coverage.excluded)} such meeting{coverage.excluded === 1 ? '' : 's'} dropped</> : ''}.
          </div>
        </div>

        {ot && ot.createdOpps > 0 && (
          <div className="callout" style={{ margin: '0 0 14px', background: 'transparent', border: '1px dashed var(--line, #2a3550)' }}>
            <div className="callout-body">
              <strong>Opportunities from outbound sequences:</strong> {num(ot.createdOpps)} created ·{' '}
              {eur(ot.pipeline)} open pipeline · {eur(ot.won)} closed-won. Credited when the opp's Salesforce
              contact is a member of an outbound sequence, dated by opportunity <em>created</em> date (open or
              won; closed-lost excluded). <strong>Read the pipeline € as contact-touch, not "generated":</strong>{' '}
              it's the full opportunity value of any deal a sequenced contact is on, so it can be dominated by a
              single large sales-led deal and is much broader than the campaign-influenced pipeline shown elsewhere.
              The <strong>count</strong> of created opportunities and closed-won are the more reliable read.
            </div>
          </div>
        )}

        {/* Grouped by product / flow cluster (W3): the raw per-sequence list leaked seller
            names into a client-facing table and repeated the same product once per rep.
            Sellers now have their own table on this page. */}
        <table className="tbl">
          <thead>
            <tr>
              <th>Product / flow</th><th>Type</th>
              <th className="r">Meetings</th><th className="r">Created Opps</th>
              <th className="r">Opp Value</th><th className="r">Closed Won</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const byCluster = new Map()
              for (const s of bySequence) {
                const label = outreachProduct(s.sequence) || s.sequence
                if (!byCluster.has(label)) byCluster.set(label, { label, category: s.category, meetings: 0, createdOpps: 0, oppValue: 0, closedWon: 0, flows: 0 })
                const c = byCluster.get(label)
                c.meetings += s.meetings; c.createdOpps += s.createdOpps; c.oppValue += s.oppValue; c.closedWon += s.closedWon; c.flows += 1
              }
              return [...byCluster.values()]
                .sort((a, b) => (b.meetings - a.meetings) || (b.createdOpps - a.createdOpps))
                .slice(0, 15)
                .map((c) => (
                  <tr key={c.label}>
                    <td>{c.label}{c.flows > 1 ? <span style={{ opacity: 0.55 }}> · {num(c.flows)} flows</span> : null}</td>
                    <td><span className={`chip ${catClass(c.category)}`}>{c.category}</span></td>
                    <td className="r mono">{num(c.meetings)}</td>
                    <td className="r mono">{c.createdOpps ? num(c.createdOpps) : '—'}</td>
                    <td className="r mono">{c.oppValue ? eur(c.oppValue) : '—'}</td>
                    <td className="r mono">{c.closedWon ? eur(c.closedWon) : '—'}</td>
                  </tr>
                ))
            })()}
          </tbody>
        </table>
        <div className="panel-note" style={{ padding: '8px 4px 0', fontSize: 12, opacity: 0.7 }}>
          Meetings &amp; opportunities can each match several flows, so rows overlap and add up to more
          than the tier totals above. Opportunity Value = open qualified pipeline; Closed Won = won amount (EUR).
        </div>
      </div>
    </div>
  )
}

const Stage = ({ name, val, extra }) => (
  <div className="h-funnel-stage">
    <div className="stage-name">{name}</div>
    <div className="stage-val">{val}</div>
    <div className="stage-extra">{extra}</div>
  </div>
)
