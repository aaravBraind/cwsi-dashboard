import { NA, isNA } from './constants'

// Compact money formatter. CRITICAL: currency is explicit and never inferred —
// LinkedIn spend is GBP (fact_channel_daily), marketing budget is EUR
// (fact_marketing_spend). Never sum across currencies; always label.
export function money(n, symbol = '£') {
  if (isNA(n) || n == null) return 'n/a'
  const v = Number(n)
  const sign = v < 0 ? '-' : ''
  const a = Math.abs(v)
  if (a >= 1_000_000) return `${sign}${symbol}${(a / 1_000_000).toFixed(1)}m`
  if (a >= 1_000) return `${sign}${symbol}${Math.round(a / 1_000)}k`
  return `${sign}${symbol}${Math.round(a)}`
}

// "£290k" — GBP. Now LinkedIn delivery spend ONLY (fact_channel_daily). Salesforce
// pipeline/closed-won/margin are converted to EUR at ingest → use eur() for those.
export const gbp = (n) => money(n, '£')

// "€98k" — EUR. The board's reporting currency: marketing budget + all Salesforce
// money (pipeline, closed-won, margin, retention), which is EUR-native post-ingest.
export const eur = (n) => money(n, '€')

// Exact euros to the cent, for the reconciliation drill-downs. Deliberately NOT the
// compact eur() the tiles use, and NOT rounded to whole euros either: at 0dp a column
// of rows can visibly fail to add to its own total, which is exactly what a client
// checking our figures against Salesforce is trying to do.
export const eurExact = (n) =>
  isNA(n) || n == null ? '—' : `€${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Exact (non-compact) money with currency code suffix, for tooltips/tables.
export function moneyExact(n, code = 'GBP') {
  if (isNA(n) || n == null) return 'n/a'
  const sym = code === 'EUR' ? '€' : '£'
  return `${sym}${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${code}`
}

export function num(n) {
  if (isNA(n) || n == null) return 'n/a'
  return Number(n).toLocaleString('en-GB')
}

export function pct(a, b, digits = 1) {
  if (isNA(a) || isNA(b) || !b) return 'n/a'
  return `${((a / b) * 100).toFixed(digits)}%`
}

// Ratio as a 0..1 number for bar widths; clamped. Returns 0 for n/a.
export function ratio(a, b) {
  if (isNA(a) || isNA(b) || !b) return 0
  return Math.max(0, Math.min(1, a / b))
}

export { NA, isNA }
