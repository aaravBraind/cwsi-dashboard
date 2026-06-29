import { useState } from 'react'
import { Loading, ErrorState, EmptyState } from '../States'
import { useOutreach, useOutreachSteps } from '../../hooks/useDashboardData'
import { num, isNA, NA } from '../../data/format'
import { PILLARS, PILLAR_UNMAPPED } from '../../data/constants'
import { replyLight } from '../../data/thresholds'

const ratePct = (r, d = 1) => (isNA(r) || r == null ? 'n/a' : `${(r * 100).toFixed(d)}%`)

// Outreach.io — SDR sales-engagement channel. Matches the functional mockup
// layout. Engagement is live (lifetime snapshot); meetings are Outreach-sourced
// and render explicit "pending" (Outreach meetings feed reads 0 — never fabricated).
// SQL / pipeline were removed from this page (no Outreach↔Salesforce link).
export default function Outreach() {
  // Practice area is page-local (pillar lives only in this feed, not globally).
  const [pillar, setLocalPillar] = useState(null)
  const q = useOutreach(pillar)
  const pillarValue = pillar ?? 'all'

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
          snapshot</strong> (not a daily trend); <strong>region</strong> scopes them. <strong>Meetings</strong>{' '}
          come from Outreach.io's own counter and show as <strong>pending</strong> until that feed is flowing
          (it currently reads 0).
        </div>
      </div>

      {/* Filters — Practice area is live; Sequence stage needs step-level ingest */}
      <div className="filters">
        <div className="filter">
          <span className="label">Practice area</span>
          <select value={pillarValue} onChange={(e) => setLocalPillar(e.target.value === 'all' ? null : e.target.value)}>
            <option value="all">All practice areas</option>
            {PILLARS.map((p) => <option key={p} value={p}>{p}</option>)}
            <option value={PILLAR_UNMAPPED}>Others (unmapped)</option>
          </select>
        </div>
        <div className="filter" title="Step-level data not ingested yet">
          <span className="label">Sequence stage</span>
          <select disabled><option>All stages · pending</option></select>
        </div>
      </div>

      {q.isLoading && <Loading label="Loading Outreach snapshot…" />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && <EmptyState message="No Outreach sequences for this region / practice area." />}
      {q.data && q.data.hasData && <Body data={q.data} pillar={pillar} />}
    </>
  )
}

function Body({ data, pillar }) {
  const { kpis, funnel, groups, pillarCoverage } = data
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
          <div className="kpi-label">Prospects in cadence</div>
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
          <div className="kpi-label">Reply rate</div>
          <div className="kpi-val">{ratePct(kpis.replyRate)}</div>
          <div className="kpi-sub"><span className="kpi-target">{num(kpis.replies)} replies</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-head">
            <div className="kpi-icn amber"><svg className="icon icon-lg" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /></svg></div>
            <span className="tl neu"><span className="tl-dot" />pending</span>
          </div>
          <div className="kpi-label">Meetings booked</div>
          <div className="kpi-val">—</div>
          <div className="kpi-sub"><span className="kpi-target">pending Outreach meetings feed</span></div>
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
            <Stage name="Meetings" val="—" extra="pending" />
          </div>
          <div className="h-funnel-conv">
            <span className="conv">▶ {ratePct(kpis.openRate)} Open</span>
            <span className="conv">▶ {ratePct(kpis.clickRate)} Click</span>
            <span className="conv">▶ {ratePct(kpis.replyRate)} Reply</span>
            <span className="conv">▶ Meeting → pending</span>
          </div>
        </div>
      </div>

      {/* Sequence Performance — by Region × Practice Area */}
      <div className="panel">
        <div className="panel-head">
          <div className="left">
            <div className="panel-title">Sequence Performance — by Region × Practice Area</div>
            <div className="panel-sub">
              Cadence engagement · {num(pillarCoverage.mappedSequences)}/{num(pillarCoverage.totalSequences)} sequences
              mapped to a practice area · {num(pillarCoverage.othersSequences)} "Others" ({num(pillarCoverage.othersProspects)} prospects)
            </div>
          </div>
          <span className="chip blue">{num(kpis.totalSequences)} sequences</span>
        </div>
        <div className="panel-body no-pad">
          <table className="tbl">
            <thead>
              <tr>
                <th>Region</th>
                <th>Practice area</th>
                <th className="r">Prospects</th>
                <th className="r">Open %</th>
                <th className="r">Reply %</th>
                <th className="r">Meetings</th>
                <th className="c">Status</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => <RegionGroup key={g.region} g={g} />)}
              <tr className="total">
                <td colSpan={2}>Total · {num(kpis.totalSequences)} sequences</td>
                <td className="r mono">{num(kpis.prospects)}</td>
                <td className="r mono">{ratePct(kpis.openRate, 0)}</td>
                <td className="r mono">{ratePct(kpis.replyRate)}</td>
                <td className="r mono mono-d">pending</td>
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
          has no denominator). <strong>Meetings</strong> show "pending" because the meetings-booked counter from
          Outreach.io isn't flowing yet (it currently reads 0) — these are the Outreach-sequence-generated
          meetings, distinct from the all-meetings figure held in Salesforce. Engagement counts (prospects →
          replies) are live.
        </div>
      </div>

      {/* Step-level engagement */}
      <EngagementBySteps pillar={pillar} />
    </>
  )
}

// Engagement by Step — ONE unified, cadence-ordered view of every step type
// (email, call, LinkedIn, task). Each row shows the metric that applies to its
// type. No email-only filter; the whole cadence is represented.
function EngagementBySteps({ pillar }) {
  const s = useOutreachSteps(pillar)
  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">Engagement by Step Type</div>
          <div className="panel-sub">Each step type once, aggregated across all cadence positions</div>
        </div>
        <span className="chip blue">by type</span>
      </div>
      <div className="panel-body">
        {s.isLoading && <Loading label="Loading steps…" />}
        {s.isError && <ErrorState error={s.error} />}
        {s.data && !s.data.hasData && <EmptyState message="No step data for this region / practice area." />}
        {s.data && s.data.hasData && <AllStepsBars steps={s.data.allSteps} />}
      </div>
    </div>
  )
}

// Mockup-style bar list. One combined label per row ("Step 1 · Auto Email"),
// the bar = the engagement rate that applies to the type (open% for email,
// connect% for call), and the value at the right. LinkedIn/task have no rate.
function AllStepsBars({ steps }) {
  const hasActivityStep = steps.some((x) => !x.email && !x.isCall)
  const rateOf = (x) => (x.email ? x.openRate : x.isCall ? x.connectRate : NA)
  return (
    <>
      <div className="bar-list">
        {steps.map((x) => {
          const rate = rateOf(x)
          const w = isNA(rate) ? 0 : Math.round(rate * 100)
          const fill = x.email
            ? w >= 50 ? 'bf-blue' : w >= 35 ? 'bf-blue-soft' : 'bf-amber'
            : x.isCall ? 'bf-green' : 'bf-neutral'
          const val = x.email
            ? `${ratePct(x.openRate, 0)} open`
            : x.isCall ? `${ratePct(x.connectRate, 0)} connect` : 'no engagement'
          return (
            <div className="bar-row" key={x.type}>
              <div className="bar-label" style={{ width: 240 }} title={`${x.label} · ${num(x.count)} cadence steps`}>
                {x.label}
              </div>
              <div className="bar-track">
                <div className={`bar-fill ${fill}`} style={{ width: `${w}%` }} />
              </div>
              <div className="bar-val">{val}</div>
              <div className="bar-pct">{x.email ? ratePct(x.replyRate) : ''}</div>
            </div>
          )
        })}
      </div>
      <div className="info-pill" style={{ marginTop: 14 }}>
        Bar = open rate (email) / connect rate (call); reply % at the right for emails.
        {hasActivityStep && ' LinkedIn & task steps are manual touchpoints — Outreach records no open/reply, so "no engagement" is correct, not missing data.'}
      </div>
    </>
  )
}

function RegionGroup({ g }) {
  const sub = g.subtotal
  const subReply = sub.prospects ? sub.replies / sub.prospects : null
  const label = g.region === 'UNASSIGNED' ? 'Unassigned / ad-hoc' : g.region
  return (
    <>
      <tr className="cat"><td colSpan={7}>{label}</td></tr>
      {g.rows.map((r) => {
        const open = r.prospects ? r.opens / r.prospects : null
        const reply = r.prospects ? r.replies / r.prospects : null
        const lt = replyLight(reply)
        return (
          <tr key={g.region + r.pillar}>
            <td>{g.region === 'UNASSIGNED' ? 'Unassigned' : g.region}</td>
            <td>{r.pillar}</td>
            <td className="r mono">{num(r.prospects)}</td>
            <td className="r mono">{open == null ? 'n/a' : `${(open * 100).toFixed(0)}%`}</td>
            <td className="r mono">{reply == null ? 'n/a' : `${(reply * 100).toFixed(1)}%`}</td>
            <td className="r mono mono-d">pending</td>
            <td className="c"><span className={`tl-bare ${lt}`} /></td>
          </tr>
        )
      })}
      <tr className="total">
        <td>{label}</td>
        <td>subtotal</td>
        <td className="r mono">{num(sub.prospects)}</td>
        <td className="r mono">{sub.prospects ? `${((sub.opens / sub.prospects) * 100).toFixed(0)}%` : 'n/a'}</td>
        <td className="r mono">{subReply == null ? 'n/a' : `${(subReply * 100).toFixed(1)}%`}</td>
        <td className="r mono mono-d">pending</td>
        <td />
      </tr>
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
