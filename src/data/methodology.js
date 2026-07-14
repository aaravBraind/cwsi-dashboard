// ─────────────────────────────────────────────────────────────────────────────
// METHODOLOGY REGISTRY — client-facing "how we got this number" explanations.
//
// One entry per metric, keyed by a stable id. The <Explain> eye-button renders
// these into a callout so the client can, anywhere on the dashboard, click the
// eye next to a figure and see exactly what it counts, where it comes from, and
// any caveat. Keep the language plain (this is read by the client, not by us).
//
// Each entry:
//   label   – short human name of the metric (popover heading)
//   what    – one line: what the number represents
//   source  – where the raw data lives (Salesforce object/field, GA4, etc.)
//   calc    – how we turn the source into the figure shown
//   caveat  – (optional) the honest limitation the client should know
//
// The funnel counts (leads / MQL / SQL) are computed once, at ingest, in the
// Salesforce workflow ("Build Fact Rows") and stored on fact_channel_daily.
// These notes describe that derivation. When a definition changes it changes
// there + a re-ingest — update the matching note here in the same change.
// ─────────────────────────────────────────────────────────────────────────────

export const METHODOLOGY = {
  // ── Funnel definitions (the client's core question: "what is a lead / MQL / SQL?")
  leads: {
    label: 'Leads',
    what: 'People who responded to a marketing campaign in the period.',
    source: 'Salesforce campaign membership, limited to members marked as “Responded”.',
    calc: 'We count each campaign member who actively responded — a form fill, gated-content download or event/webinar registration. Bulk-uploaded lists and email audiences that were only linked to a campaign (but never responded) are excluded.',
    caveat:
      'This counts genuine responses, not everyone added to a campaign — so it is deliberately smaller than a raw membership count. Because a person can respond to several campaigns, the same person may be counted under more than one campaign.',
  },
  mql: {
    label: 'Marketing Qualified Leads (MQL)',
    what: 'The top of the funnel — everyone who responded to a marketing campaign (form fills, gated-content downloads, event / webinar registrations).',
    source: 'Salesforce campaign membership, limited to members marked as “Responded”.',
    calc:
      'Count of campaign members who actively responded. This is the funnel’s starting stage — any genuine campaign response counts as marketing-qualified (the separate “Leads” stage was removed, as a response is what qualifies someone as an MQL). Bulk-uploaded lists and audiences that never responded are excluded.',
    caveat:
      'Because a person can respond to several campaigns, the same person may be counted under more than one campaign. The qualification that narrows the funnel happens at the SQL stage below.',
  },
  campaignTheme: {
    label: 'How this page is built',
    what: 'There are two overarching quarterly campaigns — “Data Is an Asset, Not a Liability” (Q1) and “Innovation Without Risk” (Q2) — each rolled up as a whole with its individual activities beneath, plus an “Other activities” catch-all.',
    source: 'Salesforce campaigns, grouped by the quarter each one belongs to.',
    calc: 'Each campaign is placed in its quarter from the campaign itself — the date in its name (e.g. “07.05.2026 …” → Q2), then an explicit “Q1/Q2” label, then a curated hint for the named campaigns that carry no date. Everything in Q1 rolls up under “Data Is an Asset, Not a Liability”, everything in Q2 under “Innovation Without Risk”. The page shows only the campaigns belonging to the selected quarter, so activities no longer cross between quarters. Anything not tied to a 2026 quarter sits under “Other activities”. Each activity has a Theme dropdown to move it to Q1, Q2 or Other (it saves and sticks across refreshes).',
    caveat:
      'Two different things are shown per activity: the FUNNEL (MQL / SQL) counts campaign RESPONDERS — people logged as “responded” to the campaign in Salesforce — while the MONEY (Open Pipeline / Closed-Won) counts OPPORTUNITIES linked to the campaign. They’re independent, so an activity (often an in-person event) can show pipeline or revenue with 0 responders: deals were attributed to the event, but the attendees weren’t recorded as responded members.',
  },
  currentVsOngoing: {
    label: 'Current-quarter activity vs ongoing impact',
    what: 'Splits this period’s pipeline and revenue by whether the campaign that drove it started this period or in an earlier one — showing marketing’s long tail.',
    source: 'Salesforce Campaign Start Date, against the opportunity/close dates behind each figure.',
    calc: 'Each figure is bucketed by its campaign’s Start Date: “this period” if the campaign started in the selected quarter/window, “earlier activities” if it started before. The average sales-cycle is the mean days from a campaign’s start to a won deal’s close.',
    caveat: 'A €0 for "this period" closed-won is a genuine zero, not missing data — newly-started campaigns generate pipeline first and their revenue lands in later quarters (the lag this view is built to show). Campaigns with no Start Date in Salesforce can’t be classified and are shown separately. Proposed view — the same split can be applied per channel once confirmed.',
  },
  opportunities: {
    label: 'Opportunities',
    what: 'Qualified opportunities that are still open or already won — the live + won marketing book.',
    source: 'Salesforce Opportunity (linked to a marketing campaign).',
    calc: 'Count of opportunities at a genuine sales stage (any stage except “Unqualified opp”) that are still open or won. Closed-lost deals are excluded.',
    caveat: 'This is not “Created Opportunities” (every opp created in the period, including those later lost) — that is a separate metric being added.',
  },
  sql: {
    label: 'Sales Qualified Leads (SQL)',
    what: 'Leads that sales actively engaged because they saw genuine potential.',
    source: 'the lead’s status in Salesforce (and, for existing customers, a booked meeting).',
    calc: 'For leads, we count those whose status reached “Attempt 1” or a later stage — a seller has started working them. For existing customers (who have no lead funnel), a booked meeting in their activity history marks them as sales-qualified.',
    caveat: 'Because a status is a point-in-time snapshot, we treat “Attempt 1 or beyond” as sales-qualified. A few boundary statuses (for example nurture) are being confirmed with CWSI. Takes effect at the next data refresh.',
  },
  createdOpps: {
    label: 'Created Opportunities',
    what: 'Every opportunity created in the period — regardless of whether it qualified.',
    source: 'Salesforce opportunities, by the date each was created (marketing-attributed).',
    calc: 'Count of all opportunities created in the reporting window, including those still unqualified.',
    caveat: 'New headline metric. Lands at the next data refresh; shown as “—” until then.',
  },
  salesCycle: {
    label: 'Sales Cycle',
    what: 'How long opportunities take from creation to close, split by outcome (won / lost / still-open) and by source.',
    source: 'Salesforce opportunities (marketing-attributed), by their created and close dates.',
    calc: 'Cycle = close date − created date. Closed deals are scoped by close date (so long-running deals that closed this period are included); open deals are those created this period. Average and median are shown per outcome and per source channel.',
    caveat: 'Phase 1 measures created→close. The full lead-to-opportunity timeline (time from MQL to opportunity) is a follow-up that needs the contact-response join. Populates after the opportunity data refresh.',
  },
  createdOppsValue: {
    label: 'New Pipeline Created',
    what: 'The pipeline value of opportunities that were actually created in the selected period.',
    source: 'Salesforce opportunities, by the date each was created (marketing-attributed).',
    calc: 'Sum of opportunity value for opps whose created date falls in the reporting window, in EUR. Unlike Influenced Pipeline (open + won, dated by activity/close), this counts only opps created this period — so it answers "new pipeline created this period" without pulling in older deals that merely closed now.',
    caveat: 'One of three distinct pipeline terms used consistently across the dashboard — New Pipeline Created (this), Influenced Pipeline (open + won), and Closed-Won. Lands at the next data refresh; shown as “—” until then.',
  },

  // ── Money
  pipeline: {
    label: 'Influenced Pipeline',
    what: 'The total value of qualified opportunities marketing touched — open pipeline plus deals already won.',
    source: 'campaign-attributed opportunities in Salesforce.',
    calc: 'Sum of open qualified opportunity value plus closed-won value, converted to EUR using the Salesforce corporate exchange rate. Won deals are included so that Closed Won is always part of — never larger than — the pipeline generated.',
    caveat: 'Three pipeline terms are used consistently on the dashboard: New Pipeline Created (opps created this period), Influenced Pipeline (open + won — this), and Closed-Won (won only). Only opportunities attributed to a marketing campaign are included — not the whole sales pipeline. Per-campaign tables show an “Open Pipeline” column (deals still open) alongside “Closed-Won”, so a campaign can show €0 open pipeline next to a Closed-Won value — its opportunities have already closed and been won, not missing data.',
  },
  closedWon: {
    label: 'Closed Won',
    what: 'Revenue from won opportunities that marketing touched.',
    source: 'won, campaign-attributed opportunities in Salesforce.',
    calc: 'Sum of won deal values, converted to EUR when the data is synced using the Salesforce corporate exchange rate.',
    caveat: 'A deal is only ever in one state at a time: once it closes and is won it moves OUT of open pipeline INTO Closed-Won. So seeing a Closed-Won value alongside €0 open pipeline is expected — it means those deals have already landed. It never appears in both at once.',
  },
  margin: {
    label: 'Influenced Margin',
    what: 'The gross profit on the marketing-attributed won deals.',
    source: 'the opportunity’s Gross Profit field in Salesforce (or amount × gross-profit-margin % where only the % is set).',
    calc: 'Sum of gross profit (EUR) across won deals. A deal with neither field filled is excluded — never counted as full revenue.',
    caveat:
      'Heads-up: as currently entered in Salesforce, most 2026 won deals show gross profit equal to the full deal value (no cost deducted), so influenced margin presently tracks close to revenue rather than true profit. This has been flagged with CWSI to confirm whether cost data is missing on those deals.',
  },
  retention: {
    label: 'Retained Contracts',
    what: 'Renewal opportunities won in the period.',
    source: 'Salesforce renewal opportunities.',
    calc: 'Count and value of won renewals, in EUR.',
    caveat:
      'Currently the whole renewal book, not only marketing-influenced renewals (renewals carry no CampaignId). The marketing-specific scope is pending confirmation with CWSI.',
  },

  // ── Currency & attribution (cross-cutting)
  currency: {
    label: 'Currency (EUR)',
    what: 'All Salesforce money on the dashboard is shown in euros.',
    source: 'Salesforce is multi-currency (EUR / GBP / USD deals); each opportunity’s value is in its own currency.',
    calc: 'Every amount is converted to EUR when the data is synced using the Salesforce corporate exchange rate, then summed. We never add across currencies.',
    caveat: 'LinkedIn delivery spend is billed in GBP (a separate feed) and is converted to EUR for display at a fixed rate, so every figure on the dashboard reads in euros. It is never mixed into the EUR marketing budget.',
  },

  // ── Channels
  linkedinRoi: {
    label: 'LinkedIn ROI',
    what: 'Return on LinkedIn ad spend.',
    source: 'Salesforce-attributed pipeline (EUR) ÷ LinkedIn delivery spend (converted to EUR).',
    calc: 'Influenced pipeline attributed to LinkedIn, divided by LinkedIn spend — both in EUR.',
    caveat: 'LinkedIn spend is converted from GBP at a fixed rate and uses a single lifetime snapshot — treat the ratio as indicative, not exact. Reconciliation against the LinkedIn Ads export is pending.',
  },
  linkedinBudget: {
    label: 'LinkedIn Budget',
    what: 'The planned budget for each LinkedIn campaign that ran in 2026.',
    source: 'the campaign Total Budget from the LinkedIn Ads exports supplied by CWSI.',
    calc: 'Per-campaign budget from LinkedIn, converted from GBP to EUR at a fixed rate; the total sums the campaigns that have a budget in the export.',
    caveat: 'One campaign (Protect Data, Power AI event) had no budget in the export, so it is excluded from the total (shown as n/a). Budgets are converted from GBP at a fixed rate.',
  },
  linkedinSpend: {
    label: 'LinkedIn Spend',
    what: 'Money spent delivering LinkedIn campaigns, shown in EUR.',
    source: 'LinkedIn delivery snapshot (billed in GBP), converted to EUR at a fixed rate for display.',
    calc: 'Cumulative spend across the LinkedIn campaigns in the snapshot, converted to EUR.',
    caveat: 'A single lifetime snapshot — the GBP→EUR rate is fixed (not a live daily rate), and the figures are not yet reconciled against the LinkedIn Ads Manager export nor are per-campaign budgets loaded.',
  },
  organicTraffic: {
    label: 'Website traffic',
    what: 'Website engagement on the CWSI sites, shown as the four preferred GA4 metrics: Sessions, Users, Average Session Duration and Bounce Rate.',
    source: 'Google Analytics 4 (cwsisecurity.com + insights.cwsisecurity.com).',
    calc: 'Sessions = all visits. Users = distinct visitors (summed across days — a small over-count vs GA4’s de-duplicated period figure). Avg session duration = total session time ÷ sessions (mm:ss). Bounce rate = 1 − engaged sessions ÷ sessions (the share of visits with no meaningful interaction).',
    caveat: 'Bounce rate is live now (from sessions + engaged sessions). Users and Avg session duration populate after the next GA4 data refresh (shown as “—” until then).',
  },
  otherChannel: {
    label: 'Other / Unmapped',
    what: 'Campaigns whose Salesforce type has no dedicated channel of its own.',
    source: 'Salesforce campaign types Other, Telemarketing, Partners or Referral (or a blank / unmapped type).',
    calc: 'Everything not mapped to a named channel (LinkedIn, Email, Events, Organic SEO) is grouped here.',
    caveat: 'Some Outreach activity currently lands here or in Email/LinkedIn via its campaign type — a dedicated Outreach channel is being added.',
  },

  // ── Events
  webinarAttendance: {
    label: 'Webinar Attendance',
    what: 'People who attended a webinar out of those who registered.',
    source: 'GoToWebinar registration/attendance feed.',
    calc: 'Attendees ÷ registrants across the webinars in scope.',
    caveat: 'Webinars are group-wide, so attendance is not split by region. In-person event attendance is not yet available — Salesforce only records whether an invite was sent or responded to, not whether the person actually attended.',
  },
  conversion: {
    label: 'Conversion rate',
    what: 'The share of one funnel stage that reaches the next.',
    source: 'Derived from the two stage counts shown.',
    calc: 'Later stage ÷ earlier stage (e.g. MQL ÷ Leads), expressed as a percentage.',
  },

  // ── Outreach.io
  outreachProspects: {
    label: 'Prospects in cadence',
    what: 'Unique people being worked through Outreach.io sales cadences.',
    source: 'Outreach.io sequence snapshot.',
    calc: 'Distinct prospects across the sequences in scope (cumulative lifetime snapshot, filtered to the selected region).',
    caveat: 'A cumulative snapshot, not a daily trend. Currently includes all sequences; a marketing-only, defined list of sequences is planned.',
  },
  outreachReplyRate: {
    label: 'Reply rate',
    what: 'How often prospects reply to outreach.',
    source: 'Outreach.io engagement snapshot.',
    calc: 'Replies ÷ prospects across the sequences in scope.',
  },
  marketingSpend: {
    label: 'Marketing Spend (actual)',
    what: 'Actual marketing spend recorded to date.',
    source: 'The marketing budget tracker (EUR-native).',
    calc: 'Sum of spend line items, net of correction rows (negative adjustments are subtracted, not counted as events).',
    caveat: 'This is actual spend. The planned budget (for budget-vs-actual and MDF split) is client-gated and shows “not set” until CWSI provides it.',
  },
  outreachMeetings: {
    label: 'Meetings booked (Outreach-attributed)',
    what: 'Salesforce meetings whose contact is a member of a marketing Outreach sequence — the agreed attribution method.',
    source: 'Salesforce meetings joined to Outreach sequence membership by the contact’s email address.',
    calc: 'A meeting is credited to a sequence when the meeting’s contact email matches a prospect email in that sequence. Sequences are grouped into three tiers — Outbound prospecting (SoPro / Microsoft TUM / Historic Data Reactivation), Events & campaigns, and Broadcast/newsletter — and each tier counts DISTINCT meetings (a meeting can relate to several sequences, so per-sequence counts overlap).',
    caveat: 'The match is email-based, so coverage is partial — a contact who used a different email in Outreach vs Salesforce won’t match. “Broadcast/newsletter” matches (e.g. monthly updates everyone is on) indicate correlation, not that the sequence generated the meeting; the Outbound tier is the strict, defensible figure and is what the 100-meetings target measures.',
  },
}

// Look up an entry; returns null if the id is unknown (so <Explain> can no-op safely).
export function methodologyOf(id) {
  return METHODOLOGY[id] || null
}
