// EUR→GBP conversion for display. The marketing budget / Outreach cost is stored
// in EUR (fact_marketing_spend.amount); the board reports in GBP, so we convert
// for display only. The rate is fetched ONCE and PINNED per calendar day in
// localStorage so figures are stable within a session and the board-pack export
// is reproducible — we never convert live on every render. Source: ECB daily
// reference rates via frankfurter.dev (free, no API key, CORS-enabled).
//
// NO FALLBACK RATE: if the API is unavailable we return rate: null and the UI
// shows amounts in their NATIVE currency (EUR) — converting at a stale hardcoded
// rate could silently produce false GBP figures, which is worse than not converting.
//
// GUARDRAIL: callers must convert EUR→GBP BEFORE summing with any GBP figure —
// never add raw EUR + GBP.

const LS_KEY = 'cwsi_fx_eur_gbp_v1'
// Canonical frankfurter host (.app 301-redirects to .dev; hit .dev directly to
// avoid relying on cross-origin redirect following). Shape:
// {"amount":1,"base":"EUR","date":"YYYY-MM-DD","rates":{"GBP":0.863}}
const ENDPOINT = 'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=GBP'

function today() {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD (browser runtime)
}

// Returns { rate, day, asOf, source, isFallback }.
export async function getFxEurToGbp() {
  const day = today()

  // 1) pinned cache for today
  try {
    const cached = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
    if (cached && cached.day === day && Number.isFinite(cached.rate)) {
      return { ...cached, cached: true }
    }
  } catch {
    /* ignore malformed cache */
  }

  // 2) fetch ECB rate and pin it
  try {
    const res = await fetch(ENDPOINT)
    if (!res.ok) throw new Error(`FX HTTP ${res.status}`)
    const json = await res.json()
    const rate = json?.rates?.GBP
    if (!Number.isFinite(rate)) throw new Error('FX: GBP rate missing')
    const pinned = {
      rate,
      day,
      asOf: json.date || day, // ECB publication date
      source: 'ECB · frankfurter.app',
      isFallback: false,
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(pinned))
    } catch {
      /* storage may be unavailable (private mode) — still return the rate */
    }
    return pinned
  } catch {
    // 3) no rate — UI falls back to NATIVE currency (EUR), never a stale rate
    return { rate: null, day, asOf: null, source: 'FX unavailable', unavailable: true }
  }
}

// Convert an EUR amount to GBP with a given rate. Returns null if no valid rate.
export function eurToGbp(amountEur, rate) {
  if (amountEur == null || !Number.isFinite(rate)) return null
  return amountEur * rate
}

// True when a usable live rate is present.
export function hasRate(fx) {
  return !!fx && Number.isFinite(fx.rate)
}

// Short human label of the rate actually used, for board reproducibility.
export function fxLabel(fx) {
  if (!fx) return 'EUR→GBP loading…'
  if (!Number.isFinite(fx.rate)) return 'FX unavailable — showing native EUR'
  return `EUR→GBP ${fx.rate.toFixed(4)} · ${fx.source}${fx.asOf ? ` · ${fx.asOf}` : ''}`
}
