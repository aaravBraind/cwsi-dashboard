// ---- Trace-to-data validator (T-7) ---------------------------------------
// The zero-invention guarantee. After the AI layer returns a narrative +
// recommendations, EVERY numeric claim in the generated text must trace back to
// a value the app computed from the warehouse (the board pack's traceTable). Any
// number that doesn't match is FLAGGED and blocks publish — the model cannot
// smuggle in a fabricated figure.
//
// This runs in the app (not just in n8n) on purpose: it makes the guarantee
// testable, endpoint-independent, and enforced at the display boundary — the UI
// renders the pack only if validation passes (or shows the flags if it doesn't).
//
// Pure module — no React, no network. validate(text, traceTable) → {ok, claims, flags}.

// Matches money / counts / percentages with optional £$€ prefix, thousands
// commas, decimals and k/m/bn or % suffixes. The leading negative lookbehind
// drops digits glued to letters or a dot ("GA4", "H2", "Q3", "v4.2", "B9") so
// label tokens are never mistaken for numeric claims.
const NUMBER_RE = /(?<![A-Za-z0-9.])([£$€]\s?)?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(%|bn|[kmKMB])?/g

// Numbers that are never "claims": reporting years and the 1–7 metric ordinals
// the agreed order is numbered with. Kept tight on purpose — better to flag a
// stray number for human review than to wave through an invented one.
const WHITELIST = new Set([2023, 2024, 2025, 2026, 2027, 1, 2, 3, 4, 5, 6, 7])

// Normalise one regex match into a canonical magnitude. Percentages collapse to
// a fraction (17.5% → 0.175) so they compare consistently regardless of whether
// a figure was stored as a rate or as percentage points.
function normalize(currency, intPart, decPart, suffix) {
  let v = parseFloat(intPart.replace(/,/g, '') + (decPart || ''))
  if (!Number.isFinite(v)) return null
  const s = (suffix || '').toLowerCase()
  let isPercent = false
  if (s === 'k') v *= 1e3
  else if (s === 'm') v *= 1e6
  else if (s === 'bn' || s === 'b') v *= 1e9
  else if (s === '%') { isPercent = true; v /= 100 }
  return { value: v, isPercent }
}

// Pull every numeric token out of a string, with its position + raw text (for
// surfacing context in a flag).
export function extractNumbers(text) {
  const out = []
  if (!text) return out
  const re = new RegExp(NUMBER_RE.source, 'g')
  let m
  while ((m = re.exec(text)) !== null) {
    const n = normalize(m[1], m[2], m[3], m[4])
    if (n) out.push({ raw: m[0].trim(), value: n.value, isPercent: n.isPercent, index: m.index })
  }
  return out
}

// Build the allowed-number set from the board pack's trace table. For each entry
// we accept every number that appears in its DISPLAY string (e.g. "£800k" → 800000,
// "FY 20%" → 0.20) plus, for non-percent entries, the exact raw value (so both the
// rounded display and the precise figure are citable).
export function buildAllowedSet(traceTable = []) {
  const entries = []
  for (const t of traceTable) {
    const displayHasPct = /%/.test(t.display || '')
    for (const tok of extractNumbers(t.display || '')) {
      entries.push({ value: tok.value, isPercent: tok.isPercent, label: t.label })
    }
    if (!displayHasPct && Number.isFinite(Number(t.value))) {
      entries.push({ value: Number(t.value), isPercent: false, label: t.label })
    }
  }
  return entries
}

// Does a token match any allowed value? Percentages match within 0.5 percentage
// points; money/counts within max(2%, 0.5) to absorb rounding between the raw
// figure and its compact display.
function matchAllowed(token, allowed) {
  for (const a of allowed) {
    if (a.isPercent !== token.isPercent) continue
    const tol = token.isPercent ? 0.005 : Math.max(0.5, Math.abs(a.value) * 0.02)
    if (Math.abs(token.value - a.value) <= tol) return a
  }
  return null
}

const snippet = (text, index, raw) => {
  const start = Math.max(0, index - 24)
  const end = Math.min(text.length, index + raw.length + 24)
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '')
}

// Validate one block of generated text against the trace table.
// → { ok, claims:[{raw,label}], flags:[{raw,context}], checked }
export function validate(text, traceTable) {
  const allowed = buildAllowedSet(traceTable)
  const tokens = extractNumbers(text)
  const claims = []
  const flags = []
  for (const tok of tokens) {
    if (!tok.isPercent && WHITELIST.has(tok.value)) continue
    const hit = matchAllowed(tok, allowed)
    if (hit) claims.push({ raw: tok.raw, label: hit.label })
    else flags.push({ raw: tok.raw, context: snippet(text, tok.index, tok.raw) })
  }
  return { ok: flags.length === 0, claims, flags, checked: tokens.length }
}

// Validate a whole board-pack response (narrative + recommendations) against the
// figure set. Returns an aggregate verdict with per-section flags so the UI can
// block publish and show exactly which numbers couldn't be traced.
export function validateBoardPack(response, traceTable) {
  const sections = []
  const push = (where, text) => {
    if (text && String(text).trim()) sections.push({ where, ...validate(String(text), traceTable) })
  }

  const n = response?.narrative || {}
  push('On track', n.onTrack)
  push('Behind & addressable', n.behindAddressable)
  push('H2 plan', n.h2Plan)
  ;(response?.recommendations || []).forEach((r, i) => {
    push(`Recommendation ${i + 1} · ${r.title || ''}`.trim(), [r.rationale, r.estimatedImpact].filter(Boolean).join(' '))
  })

  const flags = sections.flatMap((s) => s.flags.map((f) => ({ ...f, where: s.where })))
  const claims = sections.reduce((a, s) => a + s.claims.length, 0)
  const checked = sections.reduce((a, s) => a + s.checked, 0)
  return { ok: flags.length === 0, sections, flags, claimCount: claims, checked }
}
