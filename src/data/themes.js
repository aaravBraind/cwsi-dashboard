// Quarterly campaign THEMES (Margot, Jul 2026 — feedback item X4 / G3).
//
// A "theme" is an overarching quarterly narrative that CWSI delivers through
// several campaigns / touchpoints (a webinar + an in-person event + a whitepaper +
// a nurture workflow all telling one story). The dashboard used to show every
// Salesforce campaign as a flat, standalone row; this layer rolls them up into the
// theme they belong to, so we can show "the campaign as a whole" alongside the
// individual activities within it.
//
// KEY DESIGN POINT (per user): this is NOT a hard-coded list of the ~10 campaigns
// Margot named. It's a RULE that themes EVERY campaign in the book by matching its
// name — so sibling activities she didn't list (on-demand replays, regional/language
// variants, the LinkedIn-ad promotion of a whitepaper, the NL "juni" version) get
// pulled into the right theme automatically. Anything that matches no theme falls
// into "Other activities" so nothing is ever hidden. First matching rule wins.
//
// WHY NAME-MATCHING AND NOT SALESFORCE CAMPAIGN HIERARCHY (ParentId)?
// Salesforce has a native "campaign hierarchy": each Campaign can point to a parent
// campaign via ParentId (its built-in way to say "these roll up into one bigger
// campaign"). Ideally that WOULD be the theme grouping and we'd just read it. But in
// CWSI's org the hierarchy is organised by VENDOR/PARTNER, not by quarterly theme —
// the populated parents are "Microsoft Parent" (18 children), "SentinelOne Parent" (6),
// "Dubber Parent" (5), Jamf/Ivanti/Wandera/VMO2/O2/EMEA (1–2 each), and only 41 of 504
// campaigns have a parent at all. So ParentId answers "which vendor funded this?", not
// "which quarterly campaign is this part of?" — it can't drive the themes. We still
// ingest ParentId/Parent.Name (dim_campaign) so a future by-vendor view is possible,
// but THEMES are derived from the campaign NAME here.
//
// This is a PROPOSED mapping for Margot to confirm and curate. Keyword rules will
// occasionally mis-file a campaign — e.g. the 10.06.2026 event is stored in
// Salesforce as "Microsoft E7: Governing AI Agents at Scale", but in her feedback
// she referred to the 10.06 IE event as "Protect Data, Power AI". We theme it by its
// actual SF name and flag it; a per-campaign theme override (the "Theme" dropdown on
// the Campaigns page, stored in campaign_overrides.theme) lets Margot correct any
// mis-file — NULL there means fall back to this name rule. Once the SF re-ingest lands
// Campaign.StartDate + ParentId, we can anchor themes on the native SF campaign
// hierarchy where CWSI populates it, and date them precisely.

const THEMES = [
  {
    key: 'q1-data-asset',
    quarter: 'Q1',
    label: 'Data is an Asset (Data Security)',
    blurb: 'Q1 narrative — AI & data-security webinars plus the flagship “Data That Moves Your Business Forward” whitepaper.',
    any: ['data is an asset', 'data that moves', 'ai and data security', 'ai and the data security', 'ai & the data security'],
  },
  {
    key: 'q1-samenwerkingsdag',
    quarter: 'Q1',
    label: 'Samenwerkingsdag Zorg (NL)',
    blurb: 'Q1 in-person healthcare event in the Netherlands.',
    any: ['samenwerkingsdag'],
  },
  {
    key: 'q2-protect-data',
    quarter: 'Q2',
    label: 'Protect Data, Power AI',
    blurb: 'Q2 in-person events (UK / IE) plus the supporting outreach workflows.',
    any: ['protect data', 'protect, data', 'power ai'],
  },
  {
    key: 'q2-becoming-frontier',
    quarter: 'Q2',
    label: 'Becoming Frontier — Agent 365',
    blurb: 'Q2 narrative — “Innovating with Agent 365” webinars + whitepaper, including on-demand replays and the NL/public-sector versions.',
    any: ['becoming frontier', 'agent 365', '18.06.2026', '18 juni 2026'],
  },
  {
    key: 'q2-microsoft-e7',
    quarter: 'Q2',
    label: 'Microsoft E7',
    blurb: 'Q2 Microsoft E7 event (10.06.2026) + the E7 offering email workflow.',
    any: ['microsoft e7'],
  },
]

// Catch-all — everything that isn't part of a named quarterly theme (list imports,
// partner / MDF campaigns, outreach lists, prior-year activity still generating).
const OTHER = {
  key: 'other',
  quarter: null,
  label: 'Other activities',
  blurb: 'Campaigns not part of a named quarterly theme — list imports, partner/MDF, outreach lists, and prior-year activity still generating pipeline.',
}

// Assign a campaign name to its theme (case-insensitive substring match, padded so
// short tokens don't match mid-word). First rule wins; unmatched → Other.
export function themeForCampaign(name) {
  const n = ` ${String(name || '').toLowerCase()} `
  for (const t of THEMES) {
    if (t.any.some((kw) => n.includes(kw))) return t
  }
  return OTHER
}

// Display order: named themes (Q1 then Q2, as authored) then Other last.
export const THEME_ORDER = [...THEMES.map((t) => t.key), OTHER.key]

export function themeMeta(key) {
  return [...THEMES, OTHER].find((t) => t.key === key) || OTHER
}

export { THEMES, OTHER }
