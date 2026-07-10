import { useEffect, useState } from 'react'
import QuarterPills from '../QuarterPills'
import { Loading, ErrorState, EmptyState } from '../States'
import { useBoardPack, useGenerateBoardPack, useSavedBoardPack, useOutreachAttributedMeetings } from '../../hooks/useDashboardData'
import { useFilters } from '../../filters/FilterContext'
import { I } from '../icons'
import Explain from '../Explain'
import CurrentVsOngoing from '../CurrentVsOngoing'
import { eur } from '../../data/format'

// Board metric key → methodology-registry id, so each card's eye-button explains
// the right figure to the client.
const METRIC_EXPLAIN = {
  mqls: 'mql',
  sqls: 'sql',
  createdOpps: 'createdOpps',
  mqlToSql: 'conversion',
  closedOpps: 'closedWon',
  pipeline: 'pipeline',
  margin: 'margin',
}

// T-7 — AI Insights & Board Pack Generator (trace-to-data enforced).
// The app computes every figure (useBoardPack); the AI layer narrates only those
// figures; the trace-to-data validator blocks any number it can't match. Metrics
// render in the AGREED ORDER: MQLs → SQLs → MQL→SQL → closed opps → influenced
// pipeline → influenced margin → CPL.

const TL = { 'on-track': 'green', watch: 'amber', behind: 'red', pending: 'neu', 'no-target': 'neu' }

export default function Board() {
  const q = useBoardPack()
  const gen = useGenerateBoardPack()
  const saved = useSavedBoardPack()
  const { filters } = useFilters()

  // A generated narrative is pinned to the scope it was generated for. If the
  // user changes region/quarter, the figures change — drop the stale narrative
  // so it can't be read against the wrong numbers.
  useEffect(() => {
    if (gen.data || gen.isError) gen.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.region, filters.quarter])

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Board <span className="accent">Pack</span></div>
          <div className="page-sub">AI insights · every figure checked against the source data · FY2026</div>
        </div>
        <QuarterPills />
      </div>

      {q.isLoading && <Loading />}
      {q.isError && <ErrorState error={q.error} />}
      {q.data && !q.data.hasData && <EmptyState />}
      {q.data && q.data.hasData && <Body pack={q.data} gen={gen} saved={saved.data} />}
    </>
  )
}

function Body({ pack, gen, saved }) {
  const { metrics, meta, conversion, channels, regions, pipelineHealth } = pack
  return (
    <>
      {/* Targets are client-gated → flagged provisional everywhere they surface. */}
      <div className="callout amber" style={{ marginTop: 4 }}>
        <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
        <div className="callout-body">
          <strong>Targets are provisional.</strong> Actuals are live from the source data; the FY targets
          shown are placeholders until the formal target register is delivered. The AI narrative cites these targets flagged as provisional and never invents a number.
        </div>
      </div>

      {/* 1. Top-line — agreed order (QoQ trend vs {meta.prevQuarterLabel} where available) */}
      <div className="kpis cols-4">
        {metrics.slice(0, 4).map((m) => <MetricCard key={m.key} m={m} prevQ={meta.prevQuarterLabel} />)}
      </div>
      <div className="kpis cols-3">
        {metrics.slice(4).map((m) => <MetricCard key={m.key} m={m} prevQ={meta.prevQuarterLabel} />)}
      </div>

      {/* Why are some headline figures "n/a"? List each pending metric + reason. */}
      {metrics.some((m) => m.valueDisplay === 'n/a') && (
        <div className="callout amber" style={{ marginBottom: 0 }}>
          <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
          <div className="callout-body">
            <strong>Why some figures show "n/a".</strong> These metrics don't yet have the underlying data to
            calculate them — the figure is left blank rather than shown as a misleading zero. Every other number
            above is live.
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {metrics.filter((m) => m.valueDisplay === 'n/a').map((m) => (
                <li key={m.key}><strong>{m.label}</strong> — {m.note || 'source data pending'}.</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 2. Deep-dive detail — each section is expandable ONLY when it has data in
          this scope, so the top line stays scannable and the depth is one click away. */}
      {channels.length > 0 && <ChannelSection channels={channels} meta={meta} />}
      {conversion.some((c) => c.rate != null) && <ConversionSection conversion={conversion} />}

      {/* Legacy vs Current Activity (Margot — key board narrative): this-quarter results vs
          pipeline/revenue still coming from prior-quarter activity + implied avg sales cycle. */}
      <CurrentVsOngoing label="campaign" />

      {pipelineHealth.hasData && <PipelineHealthSection ph={pipelineHealth} />}
      {meta.scopeIsAllRegions && regions.length > 0 && <RegionSection regions={regions} />}

      {/* 3. AI narrative + recommendations */}
      <NarrativePanel pack={pack} gen={gen} saved={saved} />
    </>
  )
}

function MetricCard({ m, prevQ }) {
  const tl = TL[m.status] || 'neu'
  const pending = m.status === 'pending'
  return (
    <div className="kpi">
      {/* Icons removed (per client — they carried no meaning); traffic-light pill kept, label enlarged with the freed space. */}
      <div className="kpi-head" style={{ justifyContent: 'flex-end' }}>
        <span className={`tl ${tl}`}>
          <span className="tl-dot" />{pending ? 'pending' : m.pctOfTargetDisplay !== 'n/a' ? `${m.pctOfTargetDisplay} of FY` : 'no target'}
        </span>
      </div>
      <div className="kpi-label" style={{ fontSize: 15, letterSpacing: 0 }}>{m.order} · {m.label} {METRIC_EXPLAIN[m.key] && <Explain id={METRIC_EXPLAIN[m.key]} />}</div>
      <div className="kpi-val">{m.valueDisplay}</div>
      {/* BP2: the per-card target sub-figure duplicated the traffic-light "% of FY", so it's removed
          to simplify. The traffic light carries target-attainment; QoQ trend + any "pending" note stay. */}
      <div className="kpi-sub">
        {m.trend && (
          <span className={`kpi-delta ${m.trend.dir}`} title={prevQ ? `vs ${prevQ}` : 'quarter-over-quarter'}>
            {m.trend.display}
          </span>
        )}
        {m.note && <span className="kpi-target" style={{ display: 'block', opacity: 0.65 }}>{m.note}</span>}
      </div>
    </div>
  )
}

// Expandable wrapper — a panel that shows its body by default (so all detail is
// visible at a glance) with a header click to COLLAPSE it. Rendered only by callers
// that have data, so the section never appears empty.
function Expandable({ icon, title, sub, chip, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="panel">
      <button
        className="panel-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ background: 'none', border: 0, width: '100%', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
      >
        <div className="left" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {icon && <svg className="icon icon-lg" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}>{icon}</svg>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
            <div className="panel-title">{title}</div>
            {sub && <div className="panel-sub">{sub}</div>}
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
          {chip}
          <svg
            className="icon" viewBox="0 0 24 24" aria-hidden
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', opacity: 0.6 }}
          >
            <polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && <div className="panel-body">{children}</div>}
    </div>
  )
}

// 2a. Channel contribution — who drove the pipeline (share of total).
function ChannelSection({ channels, meta }) {
  // Outreach isn't a Salesforce campaign channel (it's contact-attributed), so it's absent from
  // the campaign-based channels above. Surface it as an indicative row — NOT in the donut/shares
  // or any total — so the board sees it without double-counting it against the campaign channels.
  const outbound = useOutreachAttributedMeetings().data?.oppTiers?.outbound
  const showOutreach = outbound && (outbound.pipeline > 0 || outbound.won > 0)
  return (
    <Expandable
      icon={I.grid}
      title="Channel Contribution"
      sub={`Pipeline & MQL share by channel · ${meta.regionLabel} · ${meta.quarterLabel}`}
      chip={<span className="chip blue">{channels.length} channel{channels.length === 1 ? '' : 's'}</span>}
    >
      <ShareDonut title="Pipeline share" items={channels.map((c) => ({ label: c.channel, share: c.pipelineShare, display: c.pipelineShareDisplay }))} />
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Channel <Explain id="otherChannel" /></th><th className="r">MQLs <Explain id="mql" /></th><th className="r">Pipeline <Explain id="pipeline" /></th><th className="r">Closed-Won <Explain id="closedWon" /></th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.channel}>
                <td>{c.channel}</td>
                <td className="r">{c.mqlDisplay}</td>
                <td className="r">{c.pipelineDisplay}</td>
                <td className="r">{c.closedWonDisplay}</td>
              </tr>
            ))}
            {showOutreach && (
              <tr style={{ opacity: 0.85 }}>
                <td>Outreach · outbound <span className="chip neu">contact-attributed</span></td>
                <td className="r">—</td>
                <td className="r">{eur(outbound.pipeline)}</td>
                <td className="r">{eur(outbound.won)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {showOutreach && (
        <div className="callout" style={{ marginTop: 12 }}>
          <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
          <div className="callout-body">
            <strong>Outreach is shown separately, on purpose.</strong> Its opportunities are attributed by
            <em> contact</em> (a sequenced contact is on the opp), not by campaign — so they can overlap the
            campaign channels above. It's therefore listed as an indicative row and <strong>excluded from the
            pipeline-share donut and any totals</strong> to avoid double-counting. Full detail is on the Outreach page.
          </div>
        </div>
      )}
    </Expandable>
  )
}

// 2b. Funnel stage-to-stage conversion.
function ConversionSection({ conversion }) {
  const max = 1
  return (
    <Expandable
      icon={I.trend}
      title="Funnel Conversion"
      sub="MQL → SQL → Created Opps → Closed-Won · stage-to-stage"
      chip={<span className="chip neu">{conversion.filter((c) => c.rate != null).length} steps</span>}
    >
      <div className="bar-list">
        {conversion.map((c) => (
          <div className="bar-row" key={`${c.from}-${c.to}`}>
            <div className="bar-label">{c.from} → {c.to}</div>
            <div className="bar-track">
              <div className="bar-fill bf-blue" style={{ width: `${Math.max(2, (c.rate || 0) / max * 100)}%` }} />
            </div>
            <div className="bar-val">{c.display}</div>
          </div>
        ))}
      </div>
      <div className="callout" style={{ marginTop: 12 }}>
        <div className="callout-icn">
          <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </div>
        <div className="callout-body">
          These are <strong>stage-to-stage ratios for the selected period</strong>, not a single group of
          deals followed end to end: each stage is dated differently in Salesforce (leads by lead date,
          opportunities by their created/close dates), so a deal can sit in different quarters at each stage.
          Read them as "what share of this period's leads/MQLs/etc. reached the next stage", and use YTD for
          the fullest picture.
        </div>
      </div>
    </Expandable>
  )
}

// 2c. Open-pipeline health — stage distribution snapshot + weighted forecast.
function PipelineHealthSection({ ph }) {
  return (
    <Expandable
      icon={I.chart}
      title="Pipeline Health"
      sub={`Open opportunities by stage${ph.snapshotDate ? ` · snapshot ${ph.snapshotDate}` : ''}`}
      chip={<span className="chip blue">{ph.openValueDisplay} open</span>}
    >
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr><th>Stage</th><th className="r">Probability</th><th className="r">Open opps</th><th className="r">Value</th></tr>
          </thead>
          <tbody>
            {ph.stages.map((s) => (
              <tr key={s.stage}>
                <td>{s.stage}</td>
                <td className="r">{s.probability == null ? '—' : `${s.probability}%`}</td>
                <td className="r">{s.countDisplay}</td>
                <td className="r">{s.valueDisplay}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total open</td><td className="r">—</td>
              <td className="r">{ph.openCountDisplay}</td><td className="r">{ph.openValueDisplay}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="callout" style={{ marginTop: 14, marginBottom: 0 }}>
        <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
        <div className="callout-body">
          This is a current-state open-pipeline snapshot for the selected region, not limited to one quarter.
          The Probability column is Salesforce's win-probability for each stage; a <strong>"—"</strong> means that
          stage has no probability set in Salesforce yet.
        </div>
      </div>
    </Expandable>
  )
}

// 2d. Regional split — only surfaced at All-Regions scope.
function RegionSection({ regions }) {
  return (
    <Expandable
      icon={I.globe}
      title="Regional Split"
      sub="Pipeline & MQL contribution by region"
      chip={<span className="chip neu">{regions.length} region{regions.length === 1 ? '' : 's'}</span>}
    >
      <ShareDonut title="Pipeline share" items={regions.map((r) => ({ label: r.region, share: r.pipelineShare, display: r.pipelineShareDisplay }))} />
      <div className="tbl-scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th>Region</th>
              <th className="r">MQLs <Explain id="mql" /></th>
              <th className="r">SQLs <Explain id="sql" /></th>
              <th className="r">Created Opps <Explain id="createdOpps" /></th>
              <th className="r">Pipeline <Explain id="pipeline" /></th>
              <th className="r">Closed-Won <Explain id="closedWon" /></th>
            </tr>
          </thead>
          <tbody>
            {regions.map((r) => (
              <tr key={r.region}>
                <td>{r.region}</td>
                <td className="r">{r.mqlDisplay}</td>
                <td className="r">{r.sqlDisplay}</td>
                <td className="r">{r.createdOppsDisplay}</td>
                <td className="r">{r.pipelineDisplay}</td>
                <td className="r">{r.closedWonDisplay}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {regions.some((r) => /unassign/i.test(r.region)) && (
        <div className="callout" style={{ marginTop: 12 }}>
          <div className="callout-icn">
            <svg className="icon icon-lg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
          </div>
          <div className="callout-body">
            <strong>Unassigned</strong> = records whose region couldn't be resolved from Salesforce — the
            Account has no <em>Region</em> or billing country set, so we can't place them in UK&I / BeLux / NL.
            It's a data-completeness gap in Salesforce, not a real region.
          </div>
        </div>
      )}
    </Expandable>
  )
}

// Retention (retained contracts + expansion) removed from the board pack per Margot
// (9 Jul call) — too hard to attribute to marketing for now.

// Share as a donut (client asked for Share as a pie/donut, not a number). Each
// slice is a stroke arc on one ring; slices with no/zero share are dropped.
const DONUT_COLORS = ['#2f6df6', '#1c8a4a', '#5fa1ff', '#f5a623', '#8e7cc3', '#e0574a', '#7b8794', '#3bbfad']

function ShareDonut({ items, title }) {
  const slices = items.filter((s) => s.share != null && s.share > 0)
  if (slices.length === 0) return null
  const R = 54
  const C = 2 * Math.PI * R
  let acc = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', marginBottom: 16 }}>
      <svg viewBox="0 0 140 140" width="124" height="124" role="img" aria-label={title}>
        <g transform="rotate(-90 70 70)">
          {slices.map((s, i) => {
            const dash = s.share * C
            const seg = (
              <circle
                key={s.label}
                cx="70" cy="70" r={R} fill="none"
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="18"
                strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc * C}
              />
            )
            acc += s.share
            return seg
          })}
        </g>
        <text x="70" y="70" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 10.5, fill: 'var(--text-3)' }}>{title}</text>
      </svg>
      <div className="seg-legend" style={{ marginTop: 0, flexDirection: 'column', gap: 8 }}>
        {slices.map((s, i) => (
          <div className="leg" key={s.label}>
            <span className="dot" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            {s.label} · <strong style={{ marginLeft: 4 }}>{s.display}</strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function NarrativePanel({ pack, gen, saved }) {
  // Prefer a freshly generated pack this session; otherwise fall back to the last
  // published pack saved for this scope (re-hydrated from the board_pack archive so
  // the narrative survives a refresh). A failed/in-flight regenerate keeps `saved`
  // visible underneath rather than blanking the panel.
  const result = gen.data || saved
  const v = result?.validation
  const blocked = result && v && !v.ok
  const fromArchive = !gen.data && !!saved
  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div className="panel-head">
        <div className="left">
          <div className="panel-title">AI Board Narrative</div>
          <div className="panel-sub">3-part: on track · behind &amp; addressable · H2 plan</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {fromArchive && saved.generatedAt && (
            <span className="chip blue" title="When this narrative was last published">
              Last published {new Date(saved.generatedAt).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          )}
          <button
            className="btn primary"
            onClick={() => gen.mutate(pack)}
            disabled={gen.isPending}
          >
            {gen.isPending ? 'Generating…' : result ? 'Regenerate' : 'Generate narrative'}
          </button>
        </div>
      </div>
      <div className="panel-body">
        {gen.isIdle && !result && (
          <div className="callout" style={{ marginBottom: 0 }}>
            <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.board}</svg></div>
            <div className="callout-body">
              Generate an AI-written board narrative + prioritised recommendations from the figures above.
              The app sends only the calculated figures to the AI, then checks every number in the result
              against those figures — if a number doesn't match the source data it's blocked, so the AI can't
              invent or drift a figure.
            </div>
          </div>
        )}

        {gen.isPending && <Loading label="Writing the board narrative…" />}
        {gen.isError && <ErrorState error={gen.error} />}

        {result && (
          <>
            <ValidationBadge v={v} />
            <div className={blocked ? 'board-blocked' : ''} style={blocked ? { opacity: 0.55 } : undefined}>
              <NarrativeSection title="On Track" body={result.narrative.onTrack} />
              <NarrativeSection title="Behind & Addressable" body={result.narrative.behindAddressable} />
              {/* Enriched sections — render only when the AI layer returns them. */}
              <NarrativeSection title="Channel Insights" body={result.narrative.channelInsights} />
              <NarrativeSection title="Pipeline Commentary" body={result.narrative.pipelineCommentary} />
              <NarrativeSection title="Risks & Caveats" body={result.narrative.riskFlags} />
              <NarrativeSection title="H2 Plan" body={result.narrative.h2Plan} />
              {result.recommendations.length > 0 && (
                <>
                  <div className="bn-recs-head">
                    <div className="panel-title">Prioritised Recommendations</div>
                    <span className="chip neu">{result.recommendations.length} action{result.recommendations.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="rec-list">
                    {result.recommendations.map((r, i) => <Recommendation key={i} r={r} rank={i + 1} high={i === 0} />)}
                  </div>
                </>
              )}
            </div>
            {blocked && <FlagLog flags={v.flags} />}
          </>
        )}
      </div>
    </div>
  )
}

function ValidationBadge({ v }) {
  if (!v) return null
  if (v.ok) {
    return (
      <div className="callout" style={{ marginTop: 0 }}>
        <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.target}</svg></div>
        <div className="callout-body">
          <strong style={{ color: 'var(--green, #1c8a4a)' }}>✓ Checked against source data.</strong>{' '}
          All {v.claimCount} number{v.claimCount === 1 ? '' : 's'} in the narrative match the {v.checked} figure
          {v.checked === 1 ? '' : 's'} on this page. Safe to publish.
        </div>
      </div>
    )
  }
  return (
    <div className="callout amber" style={{ marginTop: 0 }}>
      <div className="callout-icn"><svg className="icon icon-lg" viewBox="0 0 24 24">{I.info}</svg></div>
      <div className="callout-body">
        <strong>⚠ Publish blocked — {v.flags.length} figure{v.flags.length === 1 ? '' : 's'} don't match the source.</strong>{' '}
        The narrative below is held for review because it contains numbers that don't match the figures on this page.
        Regenerate, or correct the flagged figures before publishing.
      </div>
    </div>
  )
}

function FlagLog({ flags }) {
  return (
    <div className="panel" style={{ marginTop: 16, marginBottom: 0 }}>
      <div className="panel-head">
        <div className="left"><div className="panel-title">Review flags — numbers that don't match the source</div></div>
        <span className="chip neu">{flags.length}</span>
      </div>
      <div className="panel-body">
        <div className="def-grid" style={{ gridTemplateColumns: '1fr', gap: 0 }}>
          {flags.map((f, i) => (
            <div className="def-row" key={i} style={{ alignItems: 'flex-start' }}>
              <span className="def-key"><code>{f.raw}</code> <em style={{ opacity: 0.6 }}>· {f.where}</em></span>
              <span className="tl red" style={{ maxWidth: '60%', textAlign: 'right' }}>“{f.context}”</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Each narrative section gets a tone so it reads at a glance: on-track = green,
// behind = amber, plan = blue (matches the dashboard traffic-light palette).
const NARR_TONE = {
  'On Track': 'green',
  'Behind & Addressable': 'amber',
  'Channel Insights': 'blue',
  'Pipeline Commentary': 'blue',
  'Risks & Caveats': 'amber',
  'H2 Plan': 'blue',
}

// Each narrative section is collapsible — expanded by default so the detailed
// text is visible, with a caret to collapse it (keeps a long board narrative
// navigable). The AI is prompted to write a developed paragraph per section.
function NarrativeSection({ title, body }) {
  const [open, setOpen] = useState(true)
  if (!body) return null
  return (
    <div className={`bn-sec ${NARR_TONE[title] || ''}`}>
      <button
        className="bn-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ background: 'none', border: 0, width: '100%', cursor: 'pointer', font: 'inherit', color: 'inherit', display: 'flex', alignItems: 'center', gap: 8, padding: 0 }}
      >
        <span className="bn-dot" />
        <span className="bn-title">{title}</span>
        <svg
          className="icon" viewBox="0 0 24 24" aria-hidden
          style={{ marginLeft: 'auto', width: 16, height: 16, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', opacity: 0.55 }}
        >
          <polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="bn-body">{body}</div>}
    </div>
  )
}

// "target pending" / "pending" impacts read as neutral; real £/× figures as a blue impact chip.
const isPendingImpact = (s) => !s || /pending|n\/a/i.test(s)

const Recommendation = ({ r, rank, high }) => (
  <div className={`rec${high ? ' high' : ''}`}>
    <div className="rec-icn"><span className="rec-rank">{rank}</span></div>
    <div className="rec-body">
      <div className="rec-title">{r.title}</div>
      {r.rationale && <div className="rec-desc">{r.rationale}</div>}
      <div className="rec-meta">
        {r.estimatedImpact && (
          <span className={`chip ${isPendingImpact(r.estimatedImpact) ? 'neu' : 'blue'}`}>
            {isPendingImpact(r.estimatedImpact) ? r.estimatedImpact : `${r.estimatedImpact} impact`}
          </span>
        )}
        {r.metric && <span className="chip neu">moves: {r.metric}</span>}
      </div>
    </div>
  </div>
)
