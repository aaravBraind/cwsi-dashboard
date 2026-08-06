// ─────────────────────────────────────────────────────────────────────────────
// SALES / PARTNER-GENERATED vs MARKETING-GENERATED campaigns.
//
// Paul, review call: marketing influence "would that include outreach activity or
// not? … I think we should exclude that, because I would see outreach as more
// sales-generated leads."
//
// Robin's warning in the same conversation is why this file keys on TYPE, not name:
// "we do use campaigns in Salesforce for the outreach sequences … there might be an
// outbound outreach on AI as a campaign to group people together in Salesforce."
// Campaign names are grouping labels, so name-matching would break the moment
// someone renames a sequence — and would sweep up genuine marketing campaigns that
// merely mention outreach.
//
// ⚠ THE TAXONOMY DOES NOT EXIST IN SALESFORCE YET. Every Campaign.Type currently in
// use is a marketing type: OwnedEvent, Webinar, Email, Content/White Paper, Inbound
// Web, Advertisement, Seminar / Conference, Partners, Referral Program, Telemarketing,
// Other. There is no "Sales Outbound" value to filter on, and the sales-generated
// campaigns that DO exist are sitting on marketing types (see the key overrides below).
// So this file does two things:
//
//   1. SALES_TYPES — the type-level rule, ready for the new value(s) the moment CWSI
//      adds them. Robin/Margot confirm the list; adding a type here is the whole change.
//   2. SALES_CAMPAIGN_KEYS — a short, explicitly-evidenced list of individual campaigns
//      that are demonstrably not marketing-generated but carry a marketing type. This
//      mirrors the existing channel-override pattern in the Salesforce ingestion and is
//      meant to SHRINK to nothing as the types get fixed at source.
//
// Nothing is excluded from any headline figure by default — see SALES_EXCLUDED_BY_DEFAULT.
// ─────────────────────────────────────────────────────────────────────────────

// Campaign.Type values that mean "sales or partner generated this, not marketing".
// EMPTY until CWSI confirms the taxonomy: excluding a whole type on our own guess would
// move the board numbers on an assumption. Candidates put to CWSI, with the money each
// carries in 2026 to date, are in docs/OUTREACH_AND_SALES_SPLIT.md.
export const SALES_TYPES = new Set([])

// Individual campaigns that are not marketing-generated despite their Salesforce type.
// Each needs a reason — no unexplained entries.
export const SALES_CAMPAIGN_KEYS = {
  // "BLAUD - SoPro Intune Health Check" — typed Advertisement, but SoPro is the outbound
  // prospecting agency: this is cold sales outreach, the exact thing Paul asked to exclude.
  '7013z000002JR0IAAW': 'Outbound prospecting (SoPro) — sales-generated, not a marketing campaign',
  // "Hubspot Imports" — typed Advertisement; a bulk data import, not a campaign at all.
  '7013z000001k5JLAAY': 'Data import, not a campaign',
}

// Campaign names shown alongside the keys above, so the UI can list what would be
// excluded without a second lookup. Kept next to the keys deliberately: if a name here
// stops matching what Salesforce holds, the campaign was renamed and the key still rules.
export const SALES_CAMPAIGN_LABELS = {
  '7013z000002JR0IAAW': 'BLAUD - SoPro Intune Health Check',
  '7013z000001k5JLAAY': 'Hubspot Imports',
}

// Is this fact row's campaign sales/partner-generated rather than marketing-generated?
export function isSalesGenerated(row) {
  if (!row) return false
  if (row.campaign_key && SALES_CAMPAIGN_KEYS[row.campaign_key]) return true
  return SALES_TYPES.has(row.campaign_type)
}

// Default OFF: the headline influenced pipeline / margin still include everything, exactly
// as they did before, and the split is shown next to them so nothing changes silently under
// a client who has already read these numbers. Flip this to true (one line) once Robin and
// Margot confirm the classification — the toggle on the page lets anyone see either view in
// the meantime.
export const SALES_EXCLUDED_BY_DEFAULT = false
