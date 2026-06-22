// Traffic-light thresholds + FY targets are CLIENT-GATED and NOT FINAL.
// They live here (not in the store) so they can be tuned without touching
// query or component code. Targets are display-only context — never used to
// fabricate an actual measure. When a measure is "not available yet" its light
// is neutral regardless of target.
import { isNA } from './constants'

export const FY_TARGETS = {
  influencedPipeline: 800_000,
  influencedMargin: 252_000,
  totalLeads: 970,
  mqls: 400,
  sqls: 80,
  // Closed-won opportunity COUNT (B/KPI_REGISTER §3.1). PROVISIONAL placeholder —
  // the mockup's dummy FY figure, NOT a signed client target. The live actual is
  // real and may already exceed it; the gap-to-close handles "exceeded" gracefully.
  closedWonCount: 7,
}

// ───────────────────────────────────────────────────────────────────────────
// PLACEHOLDER QUARTERLY KPI TARGETS — DEV/TEST ONLY (added 2026-06-22).
// CWSI has NOT delivered the formal per-quarter kpi_targets register (Margot,
// 22 May: "still being finalised"). These values are lifted from the functional
// mockup's dummy data purely so the build + target-dependent UI (traffic lights,
// gap-to-close, board-pack vs-target story) can be exercised end-to-end. SWAP the
// moment the real register lands — this object is the single swap point.
// CONVENTION: money = absolute units (GBP); rates/percentages = 0..1; counts =
// integers; ratios (ROS) = the multiple. `lowerIsBetter:true` = target is a ceiling.
// ⚠️ ACTUALS ARE NOT AFFECTED — they stay live/real; n/a KPIs stay "not available
// yet". Only these *targets* are placeholder. See docs/DASHBOARD_VS_MOCKUP.md §5–§7.
export const KPI_QUARTERLY_TARGETS = {
  // Overall Commercial Outcomes
  closedWonCount:       { q1: 2,       q2: 1,       q3: 2,       q4: 2,       fy: 7,        unit: 'count' },
  influencedPipeline:   { q1: 140_000, q2: 150_000, q3: 245_000, q4: 245_000, fy: 800_000,  unit: 'gbp' },
  influencedMargin:     { q1: 44_000,  q2: 47_000,  q3: 77_000,  q4: 84_000,  fy: 252_000,  unit: 'gbp' },
  retainedContracts:    { q1: null,    q2: null,    q3: null,    q4: null,    fy: 3,        unit: 'count', note: 'scope unconfirmed — actual whole-book ~186; see §6' },
  costPerLead:          { q1: 195,     q2: 180,     q3: 140,     q4: 140,     fy: 150,      unit: 'gbp', lowerIsBetter: true },
  returnOnSpend:        { q1: 2.1,     q2: 2.4,     q3: 3.0,     q4: 3.2,     fy: 3.0,      unit: 'x' },
  // Paid & Digital Acquisition
  impressions:          { q1: 410_000, q2: 485_000, q3: 560_000, q4: 600_000, fy: 2_050_000, unit: 'count' },
  cpc:                  { q1: 3.40,    q2: 3.10,    q3: 2.80,    q4: 2.70,    fy: 2.80,     unit: 'gbp', lowerIsBetter: true },
  cpm:                  { q1: 42,      q2: 39,      q3: 36,      q4: 35,      fy: 37,       unit: 'gbp', lowerIsBetter: true },
  conversionsFromOrganic:{ q1: 128,    q2: 154,     q3: 195,     q4: 220,     fy: 700,      unit: 'count' },
  visitorToMql:         { q1: 0.019,   q2: 0.021,   q3: 0.025,   q4: 0.026,   fy: 0.024,    unit: 'rate' },
  mqlToSql:             { q1: 0.170,   q2: 0.175,   q3: 0.20,    q4: 0.22,    fy: 0.20,     unit: 'rate' },
  sqlToWon:             { q1: 0.08,    q2: 0.09,    q3: 0.11,    q4: 0.12,    fy: 0.10,     unit: 'rate' },
  // Organic Social (no live actuals yet — targets staged for when a feed lands)
  engagementRate:       { q1: 0.034,   q2: 0.038,   q3: 0.042,   q4: 0.045,   fy: 0.040,    unit: 'rate' },
  socialSessions:       { q1: 3_150,   q2: 3_420,   q3: 4_100,   q4: 4_500,   fy: 15_170,   unit: 'count' },
  followerGrowth:       { q1: 0.05,    q2: 0.12,    q3: 0.18,    q4: 0.25,    fy: 0.25,     unit: 'rate' },
  // Email Performance (no live actuals — no Pardot in org)
  emailCtr:             { q1: 0.032,   q2: 0.035,   q3: 0.050,   q4: 0.060,   fy: 0.050,    unit: 'rate' },
  unsubscribeRate:      { q1: 0.0032,  q2: 0.0028,  q3: 0.0025,  q4: 0.0025,  fy: 0.0030,   unit: 'rate', lowerIsBetter: true },
  conversionsFromEmail: { q1: 42,      q2: 58,      q3: 85,      q4: 95,      fy: 280,      unit: 'count' },
  readerToMql:          { q1: 0.020,   q2: 0.024,   q3: 0.030,   q4: 0.032,   fy: 0.027,    unit: 'rate' },
  // Website / Pipeline volumes
  totalOrganicTraffic:  { q1: 8_400,   q2: 9_600,   q3: 11_500,  q4: 12_800,  fy: 42_300,   unit: 'count' },
  totalLeads:           { q1: 182,     q2: 218,     q3: 270,     q4: 300,     fy: 970,      unit: 'count' },
  totalMqls:            { q1: null,    q2: null,    q3: null,    q4: null,    fy: 400,      unit: 'count', note: 'FY-only (no mockup quarterly split)' },
  totalSqls:            { q1: null,    q2: null,    q3: null,    q4: null,    fy: 80,       unit: 'count', note: 'FY-only (no mockup quarterly split)' },
  // Events Performance
  registrations:        { q1: 450,     q2: 520,     q3: 700,     q4: 800,     fy: 2_470,    unit: 'count' },
  attendanceRate:       { q1: 0.62,    q2: 0.64,    q3: 0.70,    q4: 0.72,    fy: 0.68,     unit: 'rate' },
  mqlToSqlEvents:       { q1: 0.19,    q2: 0.21,    q3: 0.23,    q4: 0.25,    fy: 0.22,     unit: 'rate' },
  costPerConversion:    { q1: 140,     q2: 128,     q3: 110,     q4: 100,     fy: 120,      unit: 'gbp', lowerIsBetter: true },
}

// Conversion-rate FY targets (0..1). MQL→SQL is the one in the agreed board-pack
// metric order (KPI_REGISTER §3.2: FY 20%, H2 stretch 22%). PROVISIONAL — swap
// when Paul + Claire deliver the formal kpi_targets register. See [[project-cwsi-kpi-targets]].
export const CONVERSION_TARGETS = {
  mqlToSqlRate: 0.2,
}

// Blended cost-per-lead FY target (GBP, LOWER is better — KPI_REGISTER §3.1: ≤ £150).
// PROVISIONAL. The ACTUAL CPL is not computable yet (no per-channel spend mapping →
// spend is NA), so the board pack renders CPL as "pending", never a fabricated number.
export const CPL_TARGET_GBP = 150

// Meetings target (B7) — Paul's Q2 target = 100 Outreach-SEQUENCE-generated
// ADDITIONAL meetings (24 Apr call: ~1k prospects → ~30 in the Q1 pilot; 5k
// prospects → 100 in Q2). This belongs to the OUTREACH page tile, fed by
// Outreach.io /meetings — NOT the SF all-sales-meetings count (different
// population; SF can't isolate the outbound subset). Lives here for when the
// Outreach meetings feed is unblocked (stale-token, SALESFORCE_TODO §4).
export const MEETINGS_TARGET_PER_QUARTER = 100

// Marketing budget PLAN (EUR) for budget-vs-actual. fact_marketing_spend only
// holds ACTUALS (status='Spent'); the planned budget is client-gated and not in
// the store. Leave null until CWSI confirms it — the UI shows actuals live and
// flags the budget as "not set" rather than fabricating a number. Set e.g.
// 250_000 once confirmed.
export const MARKETING_BUDGET_EUR = null

// NOTE: there is intentionally NO hardcoded fallback FX rate. The live ECB rate
// is fetched + pinned per day in src/data/fx.js. If the API is unavailable, the
// UI shows amounts in their NATIVE currency (EUR) rather than converting at a
// stale rate that could silently produce false GBP figures.

// Outreach reply-rate traffic-light thresholds (PROVISIONAL — client-gated, not
// final). Drives the Status dot on the Region × Practice-Area grid. Tune here.
export const OUTREACH_REPLY_RATE = { green: 0.05, amber: 0.035 }

export function replyLight(rate) {
  if (rate == null || isNA(rate)) return 'neu'
  if (rate >= OUTREACH_REPLY_RATE.green) return 'g'
  if (rate >= OUTREACH_REPLY_RATE.amber) return 'a'
  return 'r'
}

// returns 'green' | 'amber' | 'red' | 'neu'
export function light(value, target, { greenAt = 0.95, amberAt = 0.8 } = {}) {
  if (isNA(value) || value == null || !target) return 'neu'
  const r = value / target
  if (r >= greenAt) return 'green'
  if (r >= amberAt) return 'amber'
  return 'red'
}
