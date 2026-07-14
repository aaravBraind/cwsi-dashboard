// ---- Board Pack figure set (T-7, enriched) --------------------------------
// The differentiator. The APP computes EVERY number here, from the warehouse;
// the AI layer (n8n → Claude) only narrates the figures we supply, and the
// post-generation validator (traceValidator.js) checks that every number in the
// generated text traces back to one of these. Never invent a number.
//
// getBoardPack assembles, for the active region/quarter scope:
//   1. metrics      — the 7 board metrics in the AGREED ORDER (MQLs → SQLs →
//                     MQL→SQL rate → Created Opps → closed opps → influenced
//                     pipeline → influenced margin), each with actual, (provisional) target,
//                     % of target, status AND a QoQ trend vs the prior quarter.
//   2. levers       — gaps-to-close ranked by ESTIMATED PIPELINE IMPACT.
//   3. conversion   — funnel stage-to-stage conversion rates.
//   4. channels     — channel contribution (pipeline / MQL share) — who drove it.
//   5. regions      — regional split (only when scope is All Regions).
//   6. pipelineHealth — open-pipeline stage distribution + weighted forecast.
//   7. retention    — retained contracts (won renewals) + expansion split.
//   8. traceTable   — a flat list of EVERY number the model is allowed to cite.
//                     This SAME table feeds the prompt and the validator, so the
//                     "zero invented numbers" guarantee has a single source of
//                     truth. As the figure set grows, the trace table grows with
//                     it — anything not here is flagged as untraceable on publish.
//
// Actuals are always real. Only TARGETS are placeholder (client-gated) — they are
// flagged provisional everywhere they surface. See docs/KPI_REGISTER.md.

import { getBoardPackData, getKpiTargets } from './queries'
import { FY_TARGETS, CONVERSION_TARGETS } from './thresholds'
import { isNA, REGIONS, QUARTER_PILLS } from './constants'
import { eur, num } from './format'

// A real, finite number (not the NA sentinel, not null/undefined).
const real = (v) => !isNA(v) && v != null && Number.isFinite(Number(v))

const pctStr = (a, b, d = 1) => (real(a) && b ? `${((a / b) * 100).toFixed(d)}%` : 'n/a')

// status vs a "higher is better" target. neutral when the actual is pending.
function statusOf(value, target) {
  if (!real(value)) return 'pending'
  if (!target) return 'no-target'
  const r = value / target
  if (r >= 0.95) return 'on-track'
  if (r >= 0.8) return 'watch'
  return 'behind'
}

// QoQ trend of a metric vs its prior-quarter value. null when there is no
// in-scope prior quarter (Q1 / YTD) or the prior value is missing/zero — the
// board pack then omits the trend rather than implying one. The % magnitude is
// added to the trace table so the AI may cite "up 12% QoQ".
function trendOf(curr, prev) {
  if (!real(curr) || !real(prev) || Number(prev) === 0) return null
  const pct = ((Number(curr) - Number(prev)) / Number(prev)) * 100
  const dir = Math.abs(pct) < 0.5 ? 'flat' : pct > 0 ? 'up' : 'down'
  const display = dir === 'flat' ? 'flat QoQ' : `${pct > 0 ? '+' : '−'}${Math.abs(pct).toFixed(0)}% QoQ`
  return { pct, dir, display, prev: Number(prev) }
}

const regionLabel = (code) =>
  (REGIONS.find((r) => r.code === code || r.key === code) || {}).label ||
  (code && code !== 'all' ? code : 'All Regions')
const quarterLabel = (q) => (QUARTER_PILLS.find((p) => p.q === q) || {}).label || 'YTD'

// Assemble the board-pack figure set for the active filters. Reuses the same
// funnel/channel/stage/retention aggregates the rest of the dashboard shows
// (via getBoardPackData), so the board pack can never disagree with a channel
// or pipeline page.
export async function getBoardPack(filters = {}) {
  const data = await getBoardPackData(filters)
  const { funnel, prevFunnel, prevQuarter, byChannel, byRegion, stage, hasData } = data

  // Targets read from the editable kpi_targets DB table (FY values), falling back
  // to the thresholds.js placeholders if a row/value is absent — so a client target
  // edit propagates to the board pack, not just the KPI Tracker.
  const targetsByKey = await getKpiTargets()
  const fyTgt = (key, fallback) => {
    const v = targetsByKey[key] ? targetsByKey[key].fy : null
    return v == null ? fallback : Number(v)
  }
  const TGT = {
    mqls: fyTgt('totalMqls', FY_TARGETS.mqls),
    sqls: fyTgt('totalSqls', FY_TARGETS.sqls),
    mqlToSql: fyTgt('mqlToSql', CONVERSION_TARGETS.mqlToSqlRate),
    closedWonCount: fyTgt('closedWonCount', FY_TARGETS.closedWonCount),
    pipeline: fyTgt('influencedPipeline', FY_TARGETS.influencedPipeline),
    margin: fyTgt('influencedMargin', FY_TARGETS.influencedMargin),
  }

  const mql = funnel.mql
  const sql = funnel.sql
  const pipeline = funnel.pipeline
  const margin = funnel.margin
  const closedWonCount = funnel.closedWonCount
  const opp = funnel.opp
  const createdOpps = funnel.createdOpps

  const mqlToSql = real(sql) && mql ? sql / mql : null // 0..1

  // Prior-quarter values keyed by metric, for the QoQ trend.
  const prevRate =
    prevFunnel && real(prevFunnel.sql) && prevFunnel.mql ? prevFunnel.sql / prevFunnel.mql : null
  const prevByKey = {
    mqls: prevFunnel ? prevFunnel.mql : null,
    sqls: prevFunnel ? prevFunnel.sql : null,
    mqlToSql: prevRate,
    createdOpps: prevFunnel ? prevFunnel.createdOpps : null,
    closedOpps: prevFunnel ? prevFunnel.closedWonCount : null,
    pipeline: prevFunnel ? prevFunnel.pipeline : null,
    margin: prevFunnel ? prevFunnel.margin : null,
  }

  // ---- 1. Metrics in the agreed order ------------------------------------
  const metrics = [
    {
      key: 'mqls', order: 1, label: 'MQLs', unit: 'count',
      value: mql, valueDisplay: real(mql) ? num(mql) : 'n/a',
      target: TGT.mqls, targetDisplay: `FY ${num(TGT.mqls)}`,
      trace: 'Σ v_fact_enriched.mql_count (scoped)',
    },
    {
      key: 'sqls', order: 2, label: 'SQLs', unit: 'count',
      value: sql, valueDisplay: real(sql) ? num(sql) : 'n/a',
      target: TGT.sqls, targetDisplay: `FY ${num(TGT.sqls)}`,
      trace: 'Σ v_fact_enriched.sql_count (scoped)',
    },
    {
      key: 'mqlToSql', order: 3, label: 'MQL → SQL Rate', unit: 'rate',
      value: mqlToSql, valueDisplay: mqlToSql == null ? 'n/a' : `${(mqlToSql * 100).toFixed(1)}%`,
      target: TGT.mqlToSql,
      targetDisplay: `FY ${(TGT.mqlToSql * 100).toFixed(0)}%`,
      trace: 'sql_count ÷ mql_count (derived)',
    },
    {
      key: 'createdOpps', order: 4, label: 'Created Opportunities', unit: 'count',
      value: createdOpps, valueDisplay: real(createdOpps) ? num(createdOpps) : 'n/a',
      target: null, targetDisplay: 'no target set',
      trace: 'Σ v_fact_enriched.created_opp_count (scoped; all opps created in period, marketing-attributed, any stage)',
      note: real(createdOpps) ? null : 'pending Salesforce data refresh',
    },
    {
      key: 'closedOpps', order: 5, label: 'Closed Opportunities', unit: 'count',
      value: closedWonCount, valueDisplay: real(closedWonCount) ? num(closedWonCount) : 'n/a',
      target: TGT.closedWonCount, targetDisplay: `FY ${num(TGT.closedWonCount)}`,
      trace: 'Σ v_fact_enriched.closed_won_count (scoped)',
      note: real(closedWonCount) ? null : 'pending Salesforce data refresh',
    },
    {
      key: 'pipeline', order: 6, label: 'Influenced Pipeline', unit: 'gbp',
      value: pipeline, valueDisplay: real(pipeline) ? eur(pipeline) : 'n/a',
      target: TGT.pipeline, targetDisplay: `FY ${eur(TGT.pipeline)}`,
      trace: 'Σ v_fact_enriched.pipeline_value + Σ closed_won_value (generated = open + won, scoped)',
    },
    {
      key: 'margin', order: 7, label: 'Influenced Margin', unit: 'gbp',
      value: margin, valueDisplay: real(margin) ? eur(margin) : 'n/a',
      target: TGT.margin, targetDisplay: `FY ${eur(TGT.margin)}`,
      trace: 'Σ v_fact_enriched.margin_value (gross profit in EUR — Salesforce Gross_Profit_Value__c, else Amount × Gross_Profit_Margin__c; scoped; blank/invalid → NULL, excluded — never counted as full revenue)',
      note: real(margin)
        ? (funnel.marginPendingDeals > 0
            ? `${funnel.marginKnownDeals}/${funnel.marginKnownDeals + funnel.marginPendingDeals} won deals have gross profit; rest pending in Salesforce`
            : null)
        : 'gross profit pending on all won deals',
    },
  ].map((m) => ({
    ...m,
    targetProvisional: true, // every target is client-gated until the kpi_targets register lands
    pctOfTarget: real(m.value) && m.target ? m.value / m.target : null,
    pctOfTargetDisplay: pctStr(m.value, m.target, 0),
    status: statusOf(m.value, m.target),
    trend: trendOf(m.value, prevByKey[m.key]), // {pct, dir, display, prev} | null
  }))

  // ---- 2. Gaps-to-close, ranked by estimated pipeline impact -------------
  // Each lever's £ impact is computed from current yields, so it is itself a
  // store-derived number (added to the trace table). The AI prioritises + writes
  // the rationale; it must reference these impact figures, not invent new ones.
  const yieldPerMql = real(pipeline) && real(mql) && mql > 0 ? pipeline / mql : null
  const yieldPerSql = real(pipeline) && real(sql) && sql > 0 ? pipeline / sql : null
  const levers = []

  if (yieldPerMql && real(mql) && mql < TGT.mqls) {
    const gap = TGT.mqls - mql
    levers.push({
      id: 'mql-gap', title: 'Close the MQL volume gap to FY target',
      gap, gapDisplay: `${num(gap)} more MQLs`,
      impactValue: gap * yieldPerMql,
      basis: `${num(gap)} MQLs × ${eur(yieldPerMql)} pipeline/MQL`,
    })
  }
  if (yieldPerSql && real(mql) && mql > 0 && real(sql)) {
    const targetSqls = mql * TGT.mqlToSql
    if (sql < targetSqls) {
      const extra = targetSqls - sql
      levers.push({
        id: 'mqlsql-lift', title: `Lift MQL→SQL conversion to FY ${(TGT.mqlToSql * 100).toFixed(0)}%`,
        gap: extra, gapDisplay: `${num(Math.round(extra))} more SQLs`,
        impactValue: extra * yieldPerSql,
        basis: `${num(Math.round(extra))} SQLs × ${eur(yieldPerSql)} pipeline/SQL`,
      })
    }
  }
  if (real(pipeline) && pipeline < TGT.pipeline) {
    const gap = TGT.pipeline - pipeline
    levers.push({
      id: 'pipeline-gap', title: 'Close the influenced-pipeline gap to FY target',
      gap, gapDisplay: `${eur(gap)} to FY target`,
      impactValue: gap,
      basis: `FY ${eur(TGT.pipeline)} − current ${eur(pipeline)}`,
    })
  }
  levers.sort((a, b) => b.impactValue - a.impactValue)
  levers.forEach((l) => { l.impactDisplay = eur(l.impactValue) })

  // ---- 3. Funnel stage-to-stage conversion (BP8) -------------------------
  // Aligned to Margot's funnel: MQL → SQL → Created Opps → Closed-Won
  // (was Leads→MQL→SQL→Opp→Won using opp_count, a qualified subset — confusing and
  // near-100% at SQL→Opp). Rate capped at 100% for display since stages are event-dated
  // differently (leads by lead date, SQL by opp activity, created-opps by created date,
  // won by close date) so this is a PERIOD-SCOPED ratio, not a same-cohort flow.
  const convRate = (a, b) => (real(a) && real(b) && b > 0 ? Math.min(a / b, 1) : null)
  // Leads = MQL by definition now (Margot 9 Jul), so a Leads→MQL step is always 100% and
  // misleading — dropped. The funnel starts at MQL: MQL → SQL → Created Opp → Closed-Won.
  const conversion = [
    { from: 'MQL', to: 'SQL', rate: convRate(sql, mql) },
    { from: 'SQL', to: 'Created Opp', rate: convRate(createdOpps, sql) },
    { from: 'Created Opp', to: 'Won', rate: convRate(closedWonCount, createdOpps) },
  ].map((c) => ({ ...c, display: c.rate == null ? 'n/a' : `${(c.rate * 100).toFixed(1)}%` }))

  // ---- 4. Channel contribution (share of pipeline / MQL) -----------------
  const totalPipe = byChannel.reduce((a, c) => a + (Number(c.pipeline) || 0), 0)
  const channels = byChannel.map((c) => ({
    channel: c.channel,
    mql: c.mql, mqlDisplay: num(c.mql),
    pipeline: c.pipeline, pipelineDisplay: eur(c.pipeline),
    closedWon: c.closedWon, closedWonDisplay: eur(c.closedWon),
    pipelineShare: totalPipe > 0 ? c.pipeline / totalPipe : null,
    pipelineShareDisplay: totalPipe > 0 ? `${((c.pipeline / totalPipe) * 100).toFixed(0)}%` : 'n/a',
  }))

  // ---- 5. Regional split (only meaningful at All-Regions scope) ----------
  const scopeIsAllRegions = !filters.region || filters.region === 'all'
  const totalRegionPipe = byRegion.reduce((a, r) => a + (Number(r.pipeline) || 0), 0)
  const regions = scopeIsAllRegions
    ? byRegion.map((r) => ({
        region: r.region,
        mql: r.mql, mqlDisplay: num(r.mql),
        sql: r.sql, sqlDisplay: num(r.sql),
        createdOpps: r.createdOpps, createdOppsDisplay: real(r.createdOpps) ? num(r.createdOpps) : 'n/a',
        pipeline: r.pipeline, pipelineDisplay: eur(r.pipeline),
        closedWon: r.closedWon, closedWonDisplay: eur(r.closedWon),
        pipelineShare: totalRegionPipe > 0 ? r.pipeline / totalRegionPipe : null,
        pipelineShareDisplay: totalRegionPipe > 0 ? `${((r.pipeline / totalRegionPipe) * 100).toFixed(0)}%` : 'n/a',
      }))
    : []
  // BP11: is any region the "Unassigned" bucket? (drives the explanatory note)
  const regionsHaveUnassigned = regions.some((r) => /unassign/i.test(r.region))

  // ---- 6. Open-pipeline health (stage distribution snapshot) -------------
  // Region-scoped current-state snapshot (NOT a quarter slice) — labelled as such.
  // BP4: the probability-weighted forecast was removed (Margot — "overly complicated").
  const stageRows = stage?.stages || []
  const openCount = stageRows.reduce((a, s) => a + (Number(s.count) || 0), 0)
  const openValue = stageRows.reduce((a, s) => a + (Number(s.value) || 0), 0)
  const pipelineHealth = {
    hasData: !!stage?.hasData,
    snapshotDate: stage?.snapshotDate || null,
    stages: stageRows.map((s) => ({
      stage: s.stage,
      probability: s.probability,
      count: s.count, countDisplay: num(s.count),
      value: s.value, valueDisplay: eur(s.value),
    })),
    openCount, openCountDisplay: num(openCount),
    openValue, openValueDisplay: eur(openValue),
  }

  // ---- 7. Retention removed (Margot, 9 Jul call) — retained contracts + expansion
  // are too hard to attribute to marketing for now, so they no longer feature in the
  // board pack, its trace table, or the AI narrative.

  // ---- 8. Trace table — the single source of allowed numbers -------------
  // Everything the model may cite, with both the raw value and its display form.
  // Percentage entries carry a "%"-bearing display so the validator stores them as
  // a fraction (matched within 0.5pt); money/counts match within 2%.
  const traceTable = []
  const add = (id, label, value, display) => {
    if (real(value)) traceTable.push({ id, label, value: Number(value), display })
  }
  for (const m of metrics) {
    add(`${m.key}.value`, m.label, m.value, m.valueDisplay)
    if (m.target != null) add(`${m.key}.target`, `${m.label} target`, m.target, m.targetDisplay)
    if (m.pctOfTarget != null) add(`${m.key}.pct`, `${m.label} % of target`, m.pctOfTarget * 100, m.pctOfTargetDisplay)
    if (m.trend) add(`${m.key}.qoq`, `${m.label} QoQ change`, Math.abs(m.trend.pct), `${Math.abs(m.trend.pct).toFixed(0)}%`)
  }
  for (const l of levers) {
    add(`${l.id}.gap`, `${l.title} — gap`, l.gap, l.gapDisplay)
    add(`${l.id}.impact`, `${l.title} — pipeline impact`, l.impactValue, l.impactDisplay)
  }
  for (const c of conversion) {
    if (c.rate != null) add(`conv.${c.from}-${c.to}`, `${c.from}→${c.to} conversion`, c.rate * 100, c.display)
  }
  for (const c of channels) {
    add(`ch.${c.channel}.pipeline`, `${c.channel} pipeline`, c.pipeline, c.pipelineDisplay)
    if (real(c.mql) && c.mql > 0) add(`ch.${c.channel}.mql`, `${c.channel} MQLs`, c.mql, c.mqlDisplay)
    if (c.pipelineShare != null) add(`ch.${c.channel}.share`, `${c.channel} pipeline share`, c.pipelineShare * 100, c.pipelineShareDisplay)
    if (real(c.closedWon) && c.closedWon > 0) add(`ch.${c.channel}.won`, `${c.channel} closed-won`, c.closedWon, c.closedWonDisplay)
  }
  for (const r of regions) {
    add(`rg.${r.region}.pipeline`, `${r.region} pipeline`, r.pipeline, r.pipelineDisplay)
    if (r.pipelineShare != null) add(`rg.${r.region}.share`, `${r.region} pipeline share`, r.pipelineShare * 100, r.pipelineShareDisplay)
  }
  if (pipelineHealth.hasData) {
    add('pipe.openCount', 'Open opportunities', openCount, pipelineHealth.openCountDisplay)
    add('pipe.openValue', 'Open pipeline value', openValue, pipelineHealth.openValueDisplay)
    // BP4: weighted (probability-adjusted) forecast removed — "overly complicated, not adding value".
    for (const s of pipelineHealth.stages) {
      add(`stage.${s.stage}.value`, `${s.stage} value`, s.value, s.valueDisplay)
      add(`stage.${s.stage}.count`, `${s.stage} count`, s.count, s.countDisplay)
    }
  }

  return {
    meta: {
      regionLabel: regionLabel(filters.region),
      quarterLabel: quarterLabel(filters.quarter),
      prevQuarterLabel: prevQuarter ? quarterLabel(prevQuarter) : null,
      metricOrder: metrics.map((m) => m.label),
      provisionalTargets: true,
      scopeIsAllRegions,
      hasData,
    },
    metrics,
    levers,
    conversion,
    channels,
    regions,
    regionsHaveUnassigned,
    pipelineHealth,
    traceTable,
    // Funnel summary as display strings — additive (Board.jsx + the validator read
    // metrics/levers/traceTable/meta, not this). Used by the branded-deck exporter
    // to fill the funnel slide. Starts at MQL — the "Leads" stage was removed (Margot
    // 14.07: the funnel should start at MQL).
    funnel: {
      mql: real(mql) ? num(mql) : 'n/a',
      sql: real(sql) ? num(sql) : 'n/a',
      opp: real(funnel.opp) ? num(funnel.opp) : 'n/a',
      pipeline: real(pipeline) ? eur(pipeline) : 'n/a',
      closedWon: real(funnel.closedWon) ? eur(funnel.closedWon) : 'n/a',
    },
    hasData,
  }
}
