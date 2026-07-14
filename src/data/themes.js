// Quarterly campaign THEMES (Margot, 14 Jul 2026 — supersedes the earlier 5-theme model).
//
// Margot's 14.07 instruction: "All Q2 activities should be grouped under the
// Innovation Without Risk campaign. All Q1 activities should be grouped under the
// Data Is an Asset, Not a Liability campaign." So there are exactly TWO quarter
// umbrellas plus an "Other activities" catch-all — not the five narrative sub-themes
// we ran through 9 Jul.
//
// WHY BY QUARTER, DETERMINED FROM THE CAMPAIGN ITSELF:
// The old model classified a campaign by keyword-matching its NAME (date-blind) while
// the Campaigns page FILTERED rows by their activity date. Those two axes disagreed, so
// a Q2 campaign whose name matched a Q1 keyword (e.g. the May "Data That Moves" LinkedIn
// ad) surfaced under Q1, and Q1 campaigns with a stray Q2-dated opp appeared under Q2 —
// the "Q1 campaigns appearing in Q2 and vice versa" bug. We now derive a single quarter
// per campaign, and the page filters campaigns by THAT quarter (see getCampaignThemes).
//
// A campaign's quarter is resolved in priority order:
//   1. the dd.mm.yyyy date prefix in the campaign name (the curated 2026 campaigns carry
//      it, and it beats StartDate — which is null for ~26% of campaigns and sometimes
//      contradicts the event date, e.g. the 22.04 event whose StartDate is 16.03);
//   2. an explicit "Q1"/"Q2" token in the name;
//   3. a curated key / keyword hint for the named campaigns that carry no date;
//   4. Salesforce StartDate (2026);
//   else → Other (prior-year, always-on, list imports — no 2026 quarter).
//
// A per-campaign manual override (the "Theme" dropdown → campaign_overrides.theme,
// value 'q1' | 'q2' | 'other') still wins over this rule; NULL means "Auto".

import { REPORTING_YEAR } from './constants'

export const Q1_THEME = {
  key: 'q1',
  quarter: 'Q1',
  label: 'Data Is an Asset, Not a Liability',
  blurb: 'Q1 2026 quarterly campaign — the data-security narrative: the AI & data-security webinars, the “Data That Moves Your Business Forward” whitepaper, and the NL Samenwerkingsdag Zorg event.',
}
export const Q2_THEME = {
  key: 'q2',
  quarter: 'Q2',
  label: 'Innovation Without Risk',
  blurb: 'Q2 2026 quarterly campaign — the safe-AI-innovation narrative: the Protect Data, Power AI events, the Becoming Frontier / Agent 365 webinars & whitepaper, and the Microsoft E7 workflow.',
}
// Catch-all — everything not tied to a 2026 quarterly theme (list imports, partner/MDF,
// outreach lists, prior-year activity still generating pipeline).
export const OTHER = {
  key: 'other',
  quarter: null,
  label: 'Other activities',
  blurb: 'Campaigns not part of a 2026 quarterly theme — list imports, partner / MDF, outreach lists, and prior-year activity still generating pipeline.',
}

const THEMES = [Q1_THEME, Q2_THEME]

// Curated quarter hints for the named campaigns whose Salesforce name carries no
// dd.mm.yyyy prefix. `keys` = exact Salesforce campaign_key; `kw` = name keywords.
const Q1_KEYS = new Set([
  '701Si00000S2Zj7IAF', // 19.02.2026 Webinar AI and Data Security
  '701Si00000TlRLrIAN', // Q1 Data is an Asset, Not a Liability
  '701Si00000V3LvjIAF', // Q1 2026 - Data That Moves Your Business Forward Whitepaper
  '701Si00000Tyxu9IAB', // 31.03.2026 - NL - Samenwerkingsdag Zorg
])
const Q2_KEYS = new Set([
  '701Si00000UOSYCIA5', // 22.04.2026 - UK - Protect Data, Power AI Event
  '701Tm00000ZXsNFIA1', // 10.06.2026 (SF "Microsoft E7…") — Margot's IE Protect Data event
  '701Si00000VOjzqIAD', // Protect data, power AI outreach workflows
  '701Si00000VBdQoIAL', // 07.05.2026 - Becoming Frontier: Innovating with Agent 365
  '701Tm00000a9FhTIAU', // 18.06.2026 - Innovating with Agent 365 in the Public Sector
  '701Tm00000c9ygeIAA', // 2026 - Whitepaper - Becoming Frontier: Leading the Next Phase of AI
  '701Tm00000az9RSIAY', // 2026 - Microsoft E7 Offering Workflow
])
const Q1_KW = ['data is an asset', 'ai and data security', 'ai and the data security', 'ai & the data security', 'samenwerkingsdag']
const Q2_KW = ['protect data', 'protect, data', 'power ai', 'becoming frontier', 'agent 365', 'microsoft e7', 'innovating with agent']

// Read a dd.mm.yyyy / dd.mm.yy date prefix (requires day.month.year with separators —
// so a bare "10.06" or a version like "1.2.3" won't match) and map it to a 2026 quarter.
function quarterFromDatePrefix(name) {
  const m = String(name || '').match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b/)
  if (!m) return null
  const month = Number(m[2])
  let year = Number(m[3])
  if (year < 100) year += 2000
  if (year !== REPORTING_YEAR || month < 1 || month > 12) return null
  return month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : null // H1 2026 only
}

// The single quarter a campaign belongs to: 'Q1' | 'Q2' | null (Other). See header.
export function quarterOfCampaign(name, key = null, startDate = null) {
  const byDate = quarterFromDatePrefix(name)
  if (byDate) return byDate
  const n = ` ${String(name || '').toLowerCase()} `
  if (/\bq1\b/.test(n)) return 'Q1'
  if (/\bq2\b/.test(n)) return 'Q2'
  if (key && Q1_KEYS.has(key)) return 'Q1'
  if (key && Q2_KEYS.has(key)) return 'Q2'
  if (Q1_KW.some((kw) => n.includes(kw))) return 'Q1'
  if (Q2_KW.some((kw) => n.includes(kw))) return 'Q2'
  if (startDate) {
    const d = new Date(startDate)
    if (!Number.isNaN(d.getTime()) && d.getUTCFullYear() === REPORTING_YEAR) {
      const mo = d.getUTCMonth() + 1
      if (mo <= 3) return 'Q1'
      if (mo <= 6) return 'Q2'
    }
  }
  return null
}

// Assign a campaign to its quarter umbrella (or Other). Manual overrides are applied by
// the caller via themeMeta(pinned); NULL there falls back to this rule.
export function themeForCampaign(name, key = null, startDate = null) {
  const q = quarterOfCampaign(name, key, startDate)
  if (q === 'Q1') return Q1_THEME
  if (q === 'Q2') return Q2_THEME
  return OTHER
}

// Display order: Q1, Q2, then Other last.
export const THEME_ORDER = [Q1_THEME.key, Q2_THEME.key, OTHER.key]

export function themeMeta(key) {
  return [...THEMES, OTHER].find((t) => t.key === key) || OTHER
}

export { THEMES }
