// Fixed, closed dimension sets (verified against the live dims) and the
// active reporting year. Quarter/region/channel/pillar are real columns on
// v_fact_enriched; everything else the UI shows is presentational.

export const REPORTING_YEAR = 2026

// Reporting is scoped to 2026 only (client decision, 19 Jun). YTD = 2026-to-now;
// all earlier years (2019–2025) are excluded from every figure. Equal to
// REPORTING_YEAR so YTD and the quarter tabs cover the same single year.
export const HISTORY_START_YEAR = 2026

// Region tabs -> region_code on the views. "all" applies no predicate, so it
// INCLUDES Unassigned (UNASSIGNED) — documented in MAPPING.md. region_id is the
// dim_region key (1 UKI, 2 BeLux, 3 NL, 4 UNASSIGNED).
export const REGIONS = [
  { key: 'all', label: 'All Regions', code: null, region_id: null },
  { key: 'UKI', label: 'UKI', code: 'UKI', region_id: 1 },
  { key: 'BeLux', label: 'BeLux', code: 'BeLux', region_id: 2 },
  { key: 'NL', label: 'NL', code: 'NL', region_id: 3 },
]

// fact_marketing_spend.quarter is stored as text 'Q1 2026' / 'Q2 2026'.
// Map the shared quarter filter to that literal (within REPORTING_YEAR).
export function quarterLabel(quarter) {
  if (!quarter || quarter === 'ytd') return null
  const n = String(quarter).replace('q', '')
  return `Q${n} ${REPORTING_YEAR}`
}

// channel_name values exactly as they appear in v_fact_enriched / dim_channel.
export const CHANNELS = [
  { id: 1, name: 'Events & Webinars', page: 'ch-events' },
  { id: 2, name: 'LinkedIn Paid', page: 'ch-linkedin' },
  { id: 3, name: 'Paid Search', page: 'ch-search' },
  { id: 4, name: 'Organic SEO', page: 'ch-seo' },
  { id: 5, name: 'Email', page: 'ch-email' },
  { id: 6, name: 'Outreach', page: 'ch-outreach' },
]

export const channelByPage = (page) => CHANNELS.find((c) => c.page === page)

// Reporting window is fixed to H1 2026 (Q1 + Q2) per the client (Margot, 1 Jul
// 2026): the dashboard shows Q1 2026 and Q2 2026 ONLY. Q3/Q4 are intentionally
// omitted — the pills are removed here so they can't be selected, and every
// to-date read is capped at REPORTING_END_ISO so YTD (= Q1+Q2 combined) can
// never leak Q3+ rows either. To re-open later quarters, add the pills back and
// move REPORTING_END_ISO forward (or set it to null to fall back to "today").
export const QUARTER_PILLS = [
  { q: 'q1', label: 'Q1' },
  { q: 'q2', label: 'Q2' },
  { q: 'ytd', label: 'YTD' },
]

// End of the visible reporting window (inclusive). Q2 2026 close. Every
// date-scoped query caps activity_date at min(today, REPORTING_END_ISO).
export const REPORTING_END_ISO = '2026-06-30'

// Sentinel used by the pillar filter for the null ("Unmapped") bucket.
export const PILLAR_UNMAPPED = '__unmapped__'

// Fixed practice pillars (dim_practice_pillar). Used by the Outreach
// practice-area filter and to order the Region × Practice-Area grid.
export const PILLARS = [
  'Secure AI',
  'Secure Data',
  'Secure Endpoints',
  'Secure Identity',
  'Secure Operations',
]

// Region display order for grouped grids (includes UNASSIGNED, which has no tab).
export const REGION_ORDER = ['UKI', 'BeLux', 'NL', 'UNASSIGNED']

// Marks a measure the store cannot serve yet. Components render an explicit
// "not available yet" state instead of a fabricated 0.
export const NA = Symbol('not-available-yet')
export const isNA = (v) => v === NA
