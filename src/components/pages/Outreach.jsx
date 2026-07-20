import { useState, Fragment } from 'react'
import { Loading, ErrorState, EmptyState } from '../States'
import { useOutreach, useOutreachAttributedMeetings } from '../../hooks/useDashboardData'
import { num, eur, isNA } from '../../data/format'
import { replyLight } from '../../data/thresholds'
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
  const { kpis, funnel, workstreams, seqCounts, marketingOnly } = data
  const outbound = meetings?.tiers?.outbound ?? null
  return (
    <>
      {/* 4 KPI cards (mockup order: sequences, prospects, reply rate, meetings) */}
      <div className="kpis cols-4">
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18" /></svg></div>
            <span className="tl green"><span className="tl-dot" />Active</span>
          </div>
          <div className="kpi-label">Active sequences</div>
          <div className="kpi-val">{num(kpis.activeSequences)}</div>
          <div className="kpi-sub"><span className="kpi-target">{num(kpis.totalSequences)} total</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24"><path d="M9 11H6a2 2 0 0 0-2 2v7h16v-7a2 2 0 0 0-2-2h-3" /><circle cx="12" cy="7" r="4" /></svg></div>
          </div>
          <div className="kpi-label">Prospects in cadence <Explain id="outreachProspects" /></div>
          <div className="kpi-val">{num(kpis.prospects)}</div>
          <div className="kpi-sub"><span className="kpi-target">unique prospects</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn"><svg className="icon icon-lg" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></div>
            <span className={`tl ${replyLight(kpis.replyRate) === 'g' ? 'green' : replyLight(kpis.replyRate) === 'a' ? 'amber' : 'neu'}`}>
              <span className="tl-dot" />{ratePct(kpis.replyRate)}
            </span>
          </div>
          <div className="kpi-label">Reply rate <Explain id="outreachReplyRate" /></div>
          <div className="kpi-val">{ratePct(kpis.replyRate)}</div>
          <div className="kpi-sub"><span className="kpi-target">{num(kpis.replies)} replies</span></div>
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

      {/* Engagement funnel */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Outreach Engagement Funnel</div>
            <div className="panel-sub">Prospect → Open → Click → Reply → Meeting</div>
          </div>
          <span className="chip blue">snapshot</span>
        </div>
        <div className="panel-body">
          <div className="h-funnel">
            <Stage name="Prospects" val={num(funnel.prospects)} extra="in cadence" />
            <Stage name="Opens" val={num(funnel.opens)} extra={`${ratePct(kpis.openRate)} open`} />
            <Stage name="Clicks" val={num(funnel.clicks)} extra={`${ratePct(kpis.clickRate)} click`} />
            <Stage name="Replies" val={num(funnel.replies)} extra={`${ratePct(kpis.replyRate)} reply`} />
            <Stage name="Meetings" val={outbound == null ? '—' : num(outbound)} extra="outbound-attributed" />
          </div>
          <div className="h-funnel-conv">
            <span className="conv">▶ {ratePct(kpis.openRate)} Open</span>
            <span className="conv">▶ {ratePct(kpis.clickRate)} Click</span>
            <span className="conv">▶ {ratePct(kpis.replyRate)} Reply</span>
            <span className="conv">▶ Meeting → attributed via SF</span>
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
                <th className="r">Open %</th>
                <th className="r">Reply %</th>
                <th className="c">Status</th>
              </tr>
            </thead>
            <tbody>
              {workstreams.map((g) => <WorkstreamGroup key={g.workstream} g={g} />)}
              <tr className="total">
                <td>Total · {num(kpis.totalSequences)} sequences</td>
                <td className="r mono">{num(kpis.prospects)}</td>
                <td className="r mono">{ratePct(kpis.openRate, 0)}</td>
                <td className="r mono">{ratePct(kpis.replyRate)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="callout amber" style={{ marginBottom: 18 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div className="callout-body">
          <strong>Open % / Reply %</strong> show "n/a" only where a sequence has no prospects yet (the rate
          has no denominator). Engagement counts (prospects → replies) are the live Outreach snapshot;
          <strong> Meetings booked</strong> are attributed from Salesforce (see the panel above) — the
          per-region "Meetings" column here is intentionally omitted because a meeting can span several
          sequences and is best read at the tier level, not per workstream. <strong>Sequence set:</strong> per your
          feedback this view shows <strong>only the three marketing workstreams</strong> — Historic Data Reactivation,
          Outbound Prospecting · SoPro, and Outbound Prospecting · Microsoft TUM — with sales &amp;
          one-off account sequences excluded. Switch "Sequence set" to "All sequences" to see everything.
        </div>
      </div>
    </>
  )
}

function WorkstreamGroup({ g }) {
  const sub = g.subtotal
  const subOpen = sub.prospects ? sub.opens / sub.prospects : null
  const subReply = sub.prospects ? sub.replies / sub.prospects : null
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
      <tr className="cat"><td colSpan={5}>{g.workstream} · {num(sub.sequences)} sequences</td></tr>
      {regionGroups.map((rg) => (
        <Fragment key={rg.region}>
          <tr>
            <td colSpan={5} style={{ paddingLeft: 22, fontWeight: 600, opacity: 0.7, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {regionLabel(rg.region)} · {num(rg.prospects)} prospects
            </td>
          </tr>
          {rg.rows.map((r, i) => {
            const open = r.prospects ? r.opens / r.prospects : null
            const reply = r.prospects ? r.replies / r.prospects : null
            const lt = replyLight(reply)
            return (
              <tr key={r.label + '|' + r.region + i}>
                <td style={{ paddingLeft: 34 }}>{r.label}{r.sequences > 1 ? <span style={{ opacity: 0.55 }}> · {num(r.sequences)} flows</span> : null}</td>
                <td className="r mono">{num(r.prospects)}</td>
                <td className="r mono">{open == null ? 'n/a' : `${(open * 100).toFixed(0)}%`}</td>
                <td className="r mono">{reply == null ? 'n/a' : `${(reply * 100).toFixed(1)}%`}</td>
                <td className="c"><span className={`tl-bare ${lt}`} /></td>
              </tr>
            )
          })}
        </Fragment>
      ))}
      <tr className="total">
        <td>subtotal</td>
        <td className="r mono">{num(sub.prospects)}</td>
        <td className="r mono">{subOpen == null ? 'n/a' : `${(subOpen * 100).toFixed(0)}%`}</td>
        <td className="r mono">{subReply == null ? 'n/a' : `${(subReply * 100).toFixed(1)}%`}</td>
        <td />
      </tr>
    </>
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
          <div className="kpi">
            <div className="kpi-label" style={{ marginTop: 26 }}>Matched from</div>
            <div className="kpi-val">{num(coverage.attributed)}<span style={{ fontSize: 15, opacity: 0.55 }}> / {num(coverage.withEmail)}</span></div>
            <div className="kpi-sub"><span className="kpi-target">meetings with a contact email we could match ({num(coverage.totalMeetings)} in scope)</span></div>
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

        <table className="tbl">
          <thead>
            <tr>
              <th>Sequence</th><th>Type</th><th>Region</th>
              <th className="r">Meetings</th><th className="r">Created Opps</th>
              <th className="r">Opp Value</th><th className="r">Closed Won</th>
            </tr>
          </thead>
          <tbody>
            {bySequence.slice(0, 15).map((s) => (
              <tr key={s.sequence}>
                <td>{s.sequence}</td>
                <td><span className={`chip ${catClass(s.category)}`}>{s.category}</span></td>
                <td>{s.region === 'UNASSIGNED' ? 'Unassigned' : s.region}</td>
                <td className="r mono">{num(s.meetings)}</td>
                <td className="r mono">{s.createdOpps ? num(s.createdOpps) : '—'}</td>
                <td className="r mono">{s.oppValue ? eur(s.oppValue) : '—'}</td>
                <td className="r mono">{s.closedWon ? eur(s.closedWon) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="panel-note" style={{ padding: '8px 4px 0', fontSize: 12, opacity: 0.7 }}>
          Meetings &amp; opportunities can each match several sequences, so per-sequence counts overlap and add up to more
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
