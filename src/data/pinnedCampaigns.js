// The CLIENT-CURATED campaign lists (Margot, 11 Aug 2026 written feedback).
//
// Campaigns page: "I've flagged this several times, but the campaigns currently displayed
// are still not the correct ones. I only want the following campaigns included" — exactly
// 11 campaigns (4 × Q1, 7 × Q2). Each entry below is one row on the page; `keys` are the
// Salesforce campaigns that make up that row (several SF campaigns can be one client-facing
// campaign, e.g. the two Protect Data events, or a live webinar plus its on-demand twin).
// Everything NOT listed here rolls into "Other activities" (kept so page totals still
// reconcile to the Overview), except Q3 activities, which list automatically under the Q3
// umbrella (her list predates the Q3 window).
//
// Email page: "Only the following campaigns should be included" — exactly 4. An email
// FAMILY needs name-pattern matching on top of campaign keys because the email platform's
// campaign buckets are contaminated (verified 16 Aug): the "Q1 Data is an Asset" bucket
// mixes the webinar's promos with the WHITEPAPER's emails (the whitepaper's own emails are
// titled "…Data is an Asset…") and one unrelated event email. `matchesEmail` picks exactly
// the family's emails from the platform feed.
//
// Key → name reference (resolved against dim_campaign, 16 Aug 2026 — all verified live):
//   701Si00000Tyxu9IAB  31.03.2026 - NL - Samenwerkingsdag Zorg
//   701Si00000S2Zj7IAF  19.02.2026 Webinar AI and Data Security
//   701Tm00000ZPAxlIAH  2026 - On Demand Webinar - AI & Data Security Risk (its evergreen twin)
//   701Si00000TlRLrIAN  Q1 Data is an Asset, Not a Liability
//   701Tm00000ZP4cEIAT  2026 - On Demand Webinar - Data Is An Asset (its evergreen twin)
//   701Si00000V3LvjIAF  Q1 2026 - Data That Moves Your Business Forward Whitepaper
//   701Si00000UOSYCIA5  22.04.2026 - UK - Protect Data, Power AI Event
//   701Tm00000Z6i5SIAR  10.06.2026 - IE - Protect Data, Power AI Event
//   701Tm00000ZXsNFIA1  10.06.2026 - Microsoft E7: Governing AI Agents at Scale
//   701Tm00000a9FhTIAU  18.06.2026 - Innovating with Agent 365 in the Public Sector
//   701Tm00000chbPpIAI  2026 - On Demand Webinar - Innovating with Agent 365… (evergreen twin)
//   701Si00000VBdQoIAL  07.05.2026 - Becoming Frontier: Innovating with Agent 365…
//   701Tm00000ZWYCBIA5  2026 - On Demand Webinar - Becoming Frontier… (evergreen twin)
//   701Tm00000c9ygeIAA  2026 - Whitepaper - Becoming Frontier: Leading the Next Phase of AI
//   701Tm00000az9RSIAY  2026 - Microsoft E7 Offering Workflow
//   701Tm00000ZUJUEIA5  07.05.2026 - BeNeLux - LinkedIn Ads - Data That Moves Your Business Forward
//   701Tm00000cHsHgIAK  2026 - Apple for Enterprise Tech Deep Dive - Whitepaper
//   701Tm00000ZKcd1IAD  2026 - Apple for Enterprise Tech Deep Dive 2025 Whitepaper (variant, no activity)
//   701Tm00000ZKsmVIAT  2026 - Apple for Enterprise 2025 Whitepaper (variant, no activity)

export const CURATED_CAMPAIGNS = [
  // ── Q1 (4) ──
  { id: 'samenwerkingsdag-zorg', quarter: 'Q1', label: 'Samenwerkingsdag Zorg', keys: ['701Si00000Tyxu9IAB'] },
  { id: 'webinar-ai-data-security', quarter: 'Q1', label: 'Webinar AI and Data Security', keys: ['701Si00000S2Zj7IAF', '701Tm00000ZPAxlIAH'] },
  { id: 'q1-data-asset', quarter: 'Q1', label: 'Q1 Data is an Asset, Not a Liability', keys: ['701Si00000TlRLrIAN', '701Tm00000ZP4cEIAT'] },
  { id: 'data-that-moves-wp', quarter: 'Q1', label: 'Data That Moves Your Business Forward Whitepaper', keys: ['701Si00000V3LvjIAF'] },
  // ── Q2 (7) ──
  { id: 'protect-data-power-ai', quarter: 'Q2', label: 'Protect Data, Power AI', keys: ['701Si00000UOSYCIA5', '701Tm00000Z6i5SIAR'] },
  { id: 'ms-e7-governing-ai', quarter: 'Q2', label: 'Microsoft E7: Governing AI Agents at Scale', keys: ['701Tm00000ZXsNFIA1'] },
  { id: 'agent365-public-sector', quarter: 'Q2', label: 'Innovating with Agent 365 in the Public Sector', keys: ['701Tm00000a9FhTIAU', '701Tm00000chbPpIAI'] },
  { id: 'becoming-frontier-webinar', quarter: 'Q2', label: 'Becoming Frontier: Innovating with Agent 365 without losing control', keys: ['701Si00000VBdQoIAL', '701Tm00000ZWYCBIA5'] },
  { id: 'becoming-frontier-wp', quarter: 'Q2', label: 'Whitepaper: Becoming Frontier: Leading the Next Phase of AI', keys: ['701Tm00000c9ygeIAA'] },
  { id: 'ms-e7-offering', quarter: 'Q2', label: 'Microsoft E7 Offering Workflow', keys: ['701Tm00000az9RSIAY'] },
  { id: 'benelux-li-ads-dtm', quarter: 'Q2', label: 'BeNeLux LinkedIn Ads — Data That Moves Your Business Forward', keys: ['701Tm00000ZUJUEIA5'] },
]

// Every Salesforce key claimed by a curated row (for the "everything else → Other" split).
export const CURATED_KEY_SET = new Set(CURATED_CAMPAIGNS.flatMap((c) => c.keys))

const APPLE_WP_KEYS = ['701Tm00000cHsHgIAK', '701Tm00000ZKcd1IAD', '701Tm00000ZKsmVIAT']

// The 4 Email-page campaign families. `factKeys` scope the COMMERCIAL funnel
// (Salesforce members/opps per campaign key); `matchesEmail` picks the family's emails
// from the email-platform feed (row shape: { campaign_key, email_name }).
// QUARTER (Margot, 20 Aug): "These need to be split by quarter. The Data That Moves Your
// Business Forward whitepaper falls under Q1, while the remaining items fall under Q2. For
// Q3, we have the E3/E5 workflow and The Governance Gap whitepaper."
//
// The quarter is a property of the CAMPAIGN, not of each send. That distinction matters:
// the Data That Moves whitepaper is a Q1 campaign whose emails all went out from 2 Apr
// (Q2), so filtering engagement by send date left the Q1 view empty — the "Email Engagement
// section appears to be empty for Q1" she reported. Filtering by the family's quarter fixes
// both asks at once.
export const EMAIL_FAMILIES = [
  {
    id: 'data-that-moves-wp',
    quarter: 'Q1',
    label: 'Data That Moves Your Business Forward Whitepaper',
    kind: 'Whitepaper',
    factKeys: ['701Si00000V3LvjIAF'],
    // The whitepaper's own emails are titled "…Data is an Asset…" and partly live in the
    // WEBINAR campaign's bucket in the platform — pick them by the "Whitepaper" word, which
    // the webinar promos never carry.
    matchesEmail: (r) =>
      r.campaign_key === '701Si00000V3LvjIAF' ||
      (r.campaign_key === '701Si00000TlRLrIAN' && /whitepaper/i.test(r.email_name || '')),
  },
  {
    id: 'becoming-frontier-wp',
    quarter: 'Q2',
    label: 'Whitepaper: Becoming Frontier: Leading the Next Phase of AI',
    kind: 'Whitepaper',
    factKeys: ['701Tm00000c9ygeIAA'],
    matchesEmail: (r) => r.campaign_key === '701Tm00000c9ygeIAA',
  },
  {
    id: 'apple-wp',
    quarter: 'Q2',
    label: 'Apple for Enterprise Tech Deep Dive Whitepaper',
    kind: 'Whitepaper',
    factKeys: APPLE_WP_KEYS, // 2026 edition + its two empty SF variants; the "Expert Commentary Blog" campaign is deliberately NOT part of the whitepaper family
    matchesEmail: (r) => APPLE_WP_KEYS.includes(r.campaign_key),
  },
  {
    id: 'ms-e7-offering',
    quarter: 'Q2',
    label: 'Microsoft E7 Offering Workflow',
    kind: 'Workflow',
    factKeys: ['701Tm00000az9RSIAY'],
    matchesEmail: (r) => r.campaign_key === '701Tm00000az9RSIAY',
  },
  // ── Q3 (added 20 Aug on Margot's instruction) ──
  {
    id: 'e3-e5-workflow',
    quarter: 'Q3',
    label: 'Microsoft 365 E3/E5 Capabilities Workflow',
    kind: 'Workflow',
    factKeys: ['701Tm00000dllI0IAI'],
    matchesEmail: (r) => r.campaign_key === '701Tm00000dllI0IAI',
  },
  {
    id: 'governance-gap-wp',
    quarter: 'Q3',
    label: 'Whitepaper: The Governance Gap — Why AI Fails Without Identity Discipline',
    kind: 'Whitepaper',
    factKeys: ['701Tm00000dP1otIAC'],
    matchesEmail: (r) => r.campaign_key === '701Tm00000dP1otIAC',
  },
]

// The families in scope for the selected quarter pill ('ytd' = all of them).
export function emailFamiliesFor(quarter) {
  if (!quarter || quarter === 'ytd') return EMAIL_FAMILIES
  const q = String(quarter).toUpperCase()
  return EMAIL_FAMILIES.filter((f) => f.quarter === q)
}

export const EMAIL_FAMILY_FACT_KEYS = [...new Set(EMAIL_FAMILIES.flatMap((f) => f.factKeys))]

// Which family an email-platform row belongs to (null = not on the Email page).
export function emailFamilyOf(row) {
  return EMAIL_FAMILIES.find((f) => f.matchesEmail(row)) || null
}
