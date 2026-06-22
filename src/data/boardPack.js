// ---- Board Pack figure set (T-7) -----------------------------------------
// The differentiator. The APP computes EVERY number here, from the warehouse;
// the AI layer (n8n → Claude) only narrates the figures we supply, and the
// post-generation validator (traceValidator.js) checks that every number in the
// generated text traces back to one of these. Never invent a number.
//
// getBoardPack assembles, for the active region/quarter scope:
//   1. metrics   — the 7 board metrics in the AGREED ORDER
//                  (MQLs → SQLs → MQL→SQL → closed opps → influenced pipeline →
//                   influenced margin → CPL), each with its actual, its
//                  (provisional) target, % of target and a status.
//   2. levers    — gaps-to-close ranked by ESTIMATED PIPELINE IMPACT, computed
//                  deterministically here (so the impact £ is itself traceable).
//   3. traceTable — a flat list of every number the model is allowed to cite.
//                   This SAME table feeds the prompt and the validator, so the
//                   "zero invented numbers" guarantee has a single source of truth.
//
// Actuals are always real. Only TARGETS are placeholder (client-gated) — they are
// flagged provisional everywhere they surface. See docs/KPI_REGISTER.md.

import { getKpiTracker, getKpiTargets } from './queries'
import { FY_TARGETS, CONVERSION_TARGETS, CPL_TARGET_GBP } from './thresholds'
import { isNA, REGIONS, QUARTER_PILLS } from './constants'
import { gbp, num } from './format'

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

const regionLabel = (code) =>
  (REGIONS.find((r) => r.code === code || r.key === code) || {}).label ||
  (code && code !== 'all' ? code : 'All Regions')
const quarterLabel = (q) => (QUARTER_PILLS.find((p) => p.q === q) || {}).label || 'YTD'

// Assemble the board-pack figure set for the active filters. Reuses the same
// funnel the KPI Tracker shows, so the board pack can never disagree with the
// rest of the dashboard.
export async function getBoardPack(filters = {}) {
  const { funnel, hasData } = await getKpiTracker(filters)

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
    cpl: fyTgt('costPerLead', CPL_TARGET_GBP),
  }

  const mql = funnel.mql
  const sql = funnel.sql
  const pipeline = funnel.pipeline
  const margin = funnel.margin
  const closedWonCount = funnel.closedWonCount
  const leads = funnel.leads

  const mqlToSql = real(sql) && mql ? sql / mql : null // 0..1

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
      key: 'closedOpps', order: 4, label: 'Closed Opportunities', unit: 'count',
      value: closedWonCount, valueDisplay: real(closedWonCount) ? num(closedWonCount) : 'n/a',
      target: TGT.closedWonCount, targetDisplay: `FY ${num(TGT.closedWonCount)}`,
      trace: 'Σ v_fact_enriched.closed_won_count (scoped)',
      note: real(closedWonCount) ? null : 'pending SF re-run',
    },
    {
      key: 'pipeline', order: 5, label: 'Influenced Pipeline', unit: 'gbp',
      value: pipeline, valueDisplay: real(pipeline) ? gbp(pipeline) : 'n/a',
      target: TGT.pipeline, targetDisplay: `FY ${gbp(TGT.pipeline)}`,
      trace: 'Σ v_fact_enriched.pipeline_value (scoped)',
    },
    {
      key: 'margin', order: 6, label: 'Influenced Margin', unit: 'gbp',
      value: margin, valueDisplay: real(margin) ? gbp(margin) : 'n/a',
      target: TGT.margin, targetDisplay: `FY ${gbp(TGT.margin)}`,
      trace: 'Σ v_fact_enriched.margin_value (won Amount − vendor cost, scoped; blank/invalid cost → NULL, excluded — never counted as full revenue)',
      note: real(margin)
        ? (funnel.marginPendingDeals > 0
            ? `${funnel.marginKnownDeals}/${funnel.marginKnownDeals + funnel.marginPendingDeals} won deals costed; rest pending cost input`
            : null)
        : 'vendor cost pending on all won deals',
    },
    {
      key: 'cpl', order: 7, label: 'Cost per Lead', unit: 'gbp',
      // CPL is NOT computable yet — no per-channel spend mapping (spend is NA).
      // Surface as pending; never fabricate. Target stays as context.
      value: null, valueDisplay: 'n/a',
      target: TGT.cpl, targetDisplay: `FY ≤ ${gbp(TGT.cpl)}`,
      trace: 'spend ÷ leads — spend not yet mapped to channel',
      note: 'pending per-channel spend mapping',
    },
  ].map((m) => ({
    ...m,
    targetProvisional: true, // every target is client-gated until the kpi_targets register lands
    pctOfTarget: real(m.value) && m.target ? m.value / m.target : null,
    pctOfTargetDisplay: pctStr(m.value, m.target, 0),
    status: statusOf(m.value, m.target),
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
      basis: `${num(gap)} MQLs × ${gbp(yieldPerMql)} pipeline/MQL`,
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
        basis: `${num(Math.round(extra))} SQLs × ${gbp(yieldPerSql)} pipeline/SQL`,
      })
    }
  }
  if (real(pipeline) && pipeline < TGT.pipeline) {
    const gap = TGT.pipeline - pipeline
    levers.push({
      id: 'pipeline-gap', title: 'Close the influenced-pipeline gap to FY target',
      gap, gapDisplay: `${gbp(gap)} to FY target`,
      impactValue: gap,
      basis: `FY ${gbp(TGT.pipeline)} − current ${gbp(pipeline)}`,
    })
  }
  levers.sort((a, b) => b.impactValue - a.impactValue)
  levers.forEach((l) => { l.impactDisplay = gbp(l.impactValue) })

  // ---- 3. Trace table — the single source of allowed numbers -------------
  // Everything the model may cite, with both the raw value and its display form.
  const traceTable = []
  const add = (id, label, value, display) => {
    if (real(value)) traceTable.push({ id, label, value: Number(value), display })
  }
  add('leads', 'Leads (scoped)', leads, num(leads))
  for (const m of metrics) {
    add(`${m.key}.value`, m.label, m.value, m.valueDisplay)
    if (m.target != null) add(`${m.key}.target`, `${m.label} target`, m.target, m.targetDisplay)
    if (m.pctOfTarget != null) add(`${m.key}.pct`, `${m.label} % of target`, m.pctOfTarget * 100, m.pctOfTargetDisplay)
  }
  for (const l of levers) {
    add(`${l.id}.gap`, `${l.title} — gap`, l.gap, l.gapDisplay)
    add(`${l.id}.impact`, `${l.title} — pipeline impact`, l.impactValue, l.impactDisplay)
  }

  return {
    meta: {
      regionLabel: regionLabel(filters.region),
      quarterLabel: quarterLabel(filters.quarter),
      metricOrder: metrics.map((m) => m.label),
      provisionalTargets: true,
      hasData,
    },
    metrics,
    levers,
    traceTable,
    hasData,
  }
}
