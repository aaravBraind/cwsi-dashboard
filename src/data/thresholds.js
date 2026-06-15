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
}

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
