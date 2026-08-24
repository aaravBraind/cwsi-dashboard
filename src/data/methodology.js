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
    what: 'Each quarter has one overarching quarterly campaign — “Data Is an Asset, Not a Liability” (Q1), “Innovation Without Risk” (Q2), and the Q3 campaign (theme name to be confirmed) — each rolled up as a whole with its individual activities beneath, plus an “Other activities” catch-all.',
    source: 'Salesforce campaigns, grouped by the quarter each one belongs to.',
    calc: 'Each campaign is placed in its quarter from the campaign itself — the date in its name (e.g. “07.05.2026 …” → Q2), then an explicit “Q1/Q2/Q3” label, then a curated hint for the named campaigns that carry no date, then the Salesforce Campaign Start Date. In other words a campaign is keyed to when it STARTED, never to when it closed or ended. Everything in Q1 rolls up under “Data Is an Asset, Not a Liability”, everything in Q2 under “Innovation Without Risk”, everything in Q3 under “Build Trust in a Distrustful World” and everything in Q4 under “Cybersecurity. Safeguarding Business Growth.”. The page shows only the campaigns belonging to the selected quarter, so activities no longer cross between quarters. Anything not tied to a 2026 quarter sits under “Other activities”. Each activity has a Theme dropdown to move it to Q1, Q2, Q3, Q4 or Other (it saves and sticks across refreshes). The rows are ordered by contribution (pipeline, then revenue), not by date.',
    caveat:
      'The money against an activity is dated by the DEAL, not by the campaign: an open opportunity counts in the quarter it was created, a won one in the quarter it closed — so an activity placed in Q1 can still be showing revenue in Q2. Two different things are also shown per activity: the FUNNEL (MQL / SQL) counts campaign RESPONDERS — people logged as “responded” to the campaign in Salesforce — while the MONEY (Open Pipeline / Closed-Won) counts OPPORTUNITIES linked to the campaign. They’re independent, so an activity (often an in-person event) can show pipeline or revenue with 0 responders: deals were attributed to the event, but the attendees weren’t recorded as responded members.',
  },
  currentVsOngoing: {
    label: 'Current-quarter activity vs ongoing impact',
    what: 'Splits this period’s pipeline and revenue by whether the campaign that drove it started this period or in an earlier one — showing marketing’s long tail.',
    source: 'Salesforce Campaign Start Date, against the opportunity/close dates behind each figure.',
    calc: 'Each figure is bucketed by the OPPORTUNITY’S CREATION DATE: “run this period” if the opportunity was created inside the selected quarter/window, “ongoing impact” if it was created earlier and is only landing now. A won deal counts in the window it closed in; an open one counts while it sits in pipeline. MQLs have no opportunity to date them by, so they keep their own activity date and are not split.',
    caveat: 'The two buckets are a complete split — run this period + ongoing impact always equals the view’s total, and the panel states that sum so it can be checked at a glance. (The former third “undated” bucket is gone: it existed because some Salesforce campaigns carry no start date, and dating by the opportunity instead removes the problem at source.) In 2026 to date most of the pipeline and revenue landing in a quarter comes from campaigns that started EARLIER — the whole point of this split. A €0 for “run this period” closed-won is a genuine zero, not missing data — newly-started campaigns generate pipeline first and their revenue lands in later quarters. The split is relative to the selected period (a deal created in Q1 is “run this period” under YTD but “ongoing impact” under the Q2 pill); the quarterly TOTALS still sum to the YTD totals.',
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
    what: 'The GROSS PROFIT on the opportunities that were actually created in the selected period.',
    source: 'Salesforce opportunities, by the date each was created (marketing-attributed) — each opportunity’s own Gross Profit Value.',
    calc: 'Sum of gross profit (EUR) across opportunities whose created date falls in the reporting window. Unlike Influenced Pipeline (open + won, dated by activity/close), this counts only opportunities created this period — so it answers "new pipeline created this period" without pulling in older deals that merely closed now. An opportunity with no Gross Profit in Salesforce is excluded rather than counted at full deal value.',
    caveat: 'Gross-profit basis since 24 Aug 2026, at CWSI’s request — earlier screenshots showed the full deal value and read higher. Gross profit is stored per opportunity, so this is a true per-deal figure, not a channel average. One of three pipeline terms used consistently across the dashboard: New Pipeline Created (this), Influenced Pipeline (open + won) and Closed-Won.',
  },

  // ── How rows are dated (the client's second core definition question:
  //    "are campaign rows keyed to start date or close date?"). Answer: results are
  //    dated by the event that produced them (activity_date — responder date / opp
  //    CreatedDate for open, CloseDate for closed); a CAMPAIGN is placed in a quarter
  //    by its own start (name date, else Campaign.StartDate). Campaign end/close date
  //    is never used. See docs/METRIC_DEFINITIONS.md.
  campaignDating: {
    label: 'How campaigns and results are dated',
    what: 'Two different dates are at work: results are dated by when they happened, while a campaign is placed in a quarter by when it started. A campaign’s close / end date is never used.',
    source: 'Salesforce — the response date on a campaign member, the created and close dates on an opportunity, and the campaign’s own date (its name date, else its Start Date).',
    calc: 'Results (what the quarter pills filter): a campaign responder is dated by the day they responded; an OPEN opportunity by its created date; a CLOSED opportunity (won or lost) by its close date; Created Opportunities and New Pipeline Created always by created date. So a deal created in Q1 and won in Q2 shows under Q1 Created Opportunities and Q2 Closed-Won — correct in both. Campaign placement (the Campaigns page): each campaign belongs to ONE quarter, taken from the date in its name, then an explicit “Q1 / Q2 / Q3” in the name, then a curated match for the named campaigns without a date, then the Salesforce Campaign Start Date; anything not tied to a 2026 quarter sits under “Other activities”.',
    caveat:
      'The name date deliberately beats Start Date, because Start Date is empty on around a quarter of campaigns and sometimes contradicts the real event date. Any activity can be moved between quarters with its Theme dropdown, and that choice survives every data refresh. Worth knowing why the two axes are kept apart: in 2026 to date, most of the pipeline and revenue landing in a quarter comes from campaigns that STARTED in an earlier quarter — which is exactly what the “current-quarter activity vs ongoing impact” view is built to show. Campaign tables are ordered by contribution, not by date.',
  },

  emailAudience: {
    label: 'Audience (emails delivered)',
    what: 'How many times the campaign’s emails actually landed in inboxes — deliveries across all of the campaign’s sends.',
    source: 'the email marketing platform’s per-email delivery counters (changed 11 Aug 2026 — previously this was the Salesforce enrolment list, which counts people added to a campaign whether or not anything was ever sent to them).',
    calc: 'Sum of delivered counts across every email in the campaign (operational/system emails excluded). Whitepaper campaigns count only their whitepaper emails — the webinar promos that shared their bucket in the platform are excluded by name.',
    caveat:
      'These are DELIVERIES, not unique people: a reminder send reaches many of the same inboxes as the first send, so one person on three sends counts three times. It is therefore an upper bound on unique individuals reached — a de-duplicated person count needs recipient-level list data the platform feed doesn’t carry at this grain. Where a campaign has no emails in the platform (e.g. a Salesforce-only workflow), Audience reads “—”.',
  },

  // ── Email engagement (per-email opens/clicks/unsubscribes) — fed from the
  //    marketing email platform behind Salesforce (fact_ae_email / v_ae_email).
  emailEngagement: {
    label: 'Email engagement — where these figures come from',
    what: 'Real per-email results — how many were delivered, opened and clicked, and who unsubscribed — for every marketing email sent in 2026.',
    source: 'Read directly from your marketing email platform (the system behind the Engagement History on your Salesforce records). Each email is linked back to its Salesforce campaign, so engagement sits alongside the leads and pipeline the same campaign produced.',
    calc: 'Counters are lifetime totals per email — an email sent in March keeps gaining opens afterwards — so figures are “to date” as of the refresh date shown, and the quarter selector groups emails by their send date.',
    caveat: 'Not split by region: one send typically goes to several regions’ mailing lists at once, so a regional split would be a guess rather than a measurement. Scheduled emails that haven’t gone out yet are excluded so they can’t drag the rates down.',
  },
  aeOpenRate: {
    label: 'Open rate',
    what: 'The share of delivered emails that were opened by at least one person.',
    source: 'Your marketing email platform’s own counters.',
    calc: 'Unique opens ÷ delivered. “Unique” counts each recipient once, however many times they re-open — the same basis your email platform’s own reports use, so the two will agree.',
    caveat: 'Apple Mail and some corporate filters pre-load images, which can count as an open — an industry-wide effect that slightly flatters every sender’s open rate, not something specific to this dashboard.',
  },
  aeCtr: {
    label: 'Click-through rate (CTR)',
    what: 'The share of delivered emails where the recipient clicked a link.',
    source: 'Your marketing email platform’s own counters.',
    calc: 'People who clicked ÷ delivered — each recipient counted once, however many links they clicked.',
    caveat: 'This is deliberately NOT the email platform’s headline click rate, which counts every click event and reads far higher (roughly 29% on this account) — corporate mail filters open and “click” links automatically to scan them for threats, and those machine clicks land in the total. The per-person figure is the honest measure of reader behaviour; if you compare against the platform’s own report, expect its headline number to be much larger for this reason.',
  },
  aeUnsubRate: {
    label: 'Unsubscribe rate',
    what: 'The share of delivered emails that led the recipient to opt out of future marketing email.',
    source: 'Your marketing email platform’s opt-out counter.',
    calc: 'Opt-outs ÷ delivered.',
    caveat: 'An opt-out removes the person from all future marketing sends, not just this email’s list — which is why keeping this rate low matters more than any single campaign.',
  },

  // ── Why a campaign's own row is not quarter-sliced (the reported under-count).
  //    Rows on per-campaign tables are the campaign's whole-2026 contribution; see
  //    campaignRows() in queries.js and docs/CAMPAIGN_ATTRIBUTION.md.
  campaignWindow: {
    label: 'Why a campaign shows its full-year figures',
    what: 'On a per-campaign table, each row is that campaign’s whole-2026 contribution — not only the part that happened inside the selected quarter.',
    source: 'Salesforce opportunities and campaign responses attributed to the campaign.',
    calc: 'Results are dated by the deal — an open opportunity by the day it was created, a won one by the day it closed. A single campaign’s opportunities therefore land in different quarters, so slicing a campaign’s own row by the quarter pill would split the campaign in half and make it look smaller than it does in Salesforce. Instead the row totals the campaign’s whole 2026, and the quarter pill decides WHICH campaigns are listed (a campaign has to have contributed something in the selected period to appear).',
    caveat:
      'This is why a campaign table can add up to more than the quarter tiles above it — the tiles are the selected quarter, the rows are the campaigns in full. It matters more than it sounds: one in-person event holds an opportunity created in January that is 45% of its qualified pipeline, and across 2026 nine campaigns are split across quarters, so roughly a fifth of open pipeline used to be invisible whenever a single quarter was selected. Two opportunity columns are shown so the figures can be checked against Salesforce directly: “Opps” counts every opportunity created off the campaign (including ones still marked unqualified), and “Qualified” counts those at a genuine stage that are still open or won — the ones Open Pipeline is summed from.',
  },

  // ── Money
  pipeline: {
    label: 'Influenced Pipeline (gross profit)',
    what: 'The GROSS PROFIT on the qualified opportunities marketing touched — open pipeline plus deals already won. Presented on the gross-profit basis (the profit in the deals), matching how CWSI tracks company pipeline; the full deal value (revenue) is shown alongside as a secondary reference.',
    source: 'campaign-attributed opportunities in Salesforce — each opportunity’s Gross Profit Value (or Amount × Gross Profit Margin % where only the % is set); the secondary revenue figure uses the Amount field.',
    calc: 'Sum of gross profit (EUR) across open qualified opportunities plus gross profit across won deals, converted to EUR using the Salesforce corporate exchange rate. Won deals are included so that the won gross profit is always part of — never larger than — the pipeline generated. An opportunity with no Gross Profit in Salesforce is excluded from the sum (never counted at full revenue) and reported in the “gross profit known for X of Y deals” coverage note.',
    caveat:
      'The basis changed on 11 Aug 2026 at CWSI’s request — figures before that date were shown on the REVENUE basis (full deal value), so earlier screenshots read higher. Gross profit depends on deal type: for CWSI’s own services revenue and margin are set equal in Salesforce, so gross profit can sit close to deal value today. Three pipeline terms are used consistently on the dashboard — New Pipeline Created (opportunities created this period), Influenced Pipeline (open + won — this) and Closed-Won (won only), all three on gross profit; only campaign-attributed opportunities are included, not the whole sales pipeline. Per-campaign tables show an “Open Pipeline” column alongside “Closed-Won”, so a campaign can show €0 open pipeline next to a Closed-Won value — its opportunities have already closed and been won, not missing data.',
  },
  closedWon: {
    label: 'Closed Won (revenue)',
    what: 'The REVENUE from won opportunities that marketing touched — deal value, not gross margin.',
    source: 'won, campaign-attributed opportunities in Salesforce (the opportunity Amount field).',
    calc: 'Sum of won deal values, converted to EUR when the data is synced using the Salesforce corporate exchange rate. Won deals are counted in the quarter they CLOSED.',
    caveat: 'Revenue basis — the profit on these same deals is the separate Influenced Margin figure. A deal is only ever in one state at a time: once it closes and is won it moves OUT of open pipeline INTO Closed-Won. So seeing a Closed-Won value alongside €0 open pipeline is expected — it means those deals have already landed. It never appears in both at once.',
  },
  margin: {
    label: 'Influenced Margin (gross profit)',
    what: 'The GROSS PROFIT on the marketing-attributed won deals — a profit basis, unlike Influenced Pipeline and Closed-Won, which are revenue.',
    source: 'the opportunity’s Gross Profit field in Salesforce (or amount × gross-profit-margin % where only the % is set).',
    calc: 'Sum of gross profit (EUR) across won deals. A deal with neither field filled is excluded — never counted as full revenue.',
    caveat:
      'Gross profit depends on the type of deal: for CWSI’s OWN SERVICES, revenue and margin are set equal in Salesforce, while resold third-party product carries a real margin below the deal value. In the current 2026 data, 20 of the 24 won-deal records show gross profit equal to the full deal value and only 4 show a margin below it — a blended ~91% — so this figure presently tracks close to revenue. That is faithful to Salesforce, not a dashboard error. The useful signal is the GAP between this and Closed-Won: it widens as more resold product enters the marketing-influenced mix. Pending with CWSI: confirming those equal-value deals are genuinely all own-services rather than resold deals with cost not yet entered.',
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
    what: 'Salesforce campaign types we can’t map to a marketing channel — plus campaigns with no type set at all.',
    source: 'Salesforce campaigns whose Type is Other, Telemarketing, Partners or Referral Program, is blank, or belongs to a system/list-import campaign (e.g. the “Salesforce Connector” integration bucket, newsletter contact lists).',
    calc: 'Every campaign that can’t be placed under LinkedIn Paid, Email, Events & Webinars or Organic SEO is grouped here, so nothing is silently dropped — the channel table always adds up to the total.',
    caveat: 'This bucket is mostly system and housekeeping campaigns rather than marketing activity, but deals genuinely attributed to them are real revenue and stay counted. Outreach is deliberately NOT a row here: outreach deals are identified by contact matching (a different method), so they appear as the separately-labelled “Outreach · outbound” row instead.',
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
    caveat:
      'This is an ALL-TIME figure, not a quarter figure — the quarter pill does not change it, because Outreach.io gives us running per-sequence counters rather than dated activity. The date it was last refreshed is shown on the page. It covers the three marketing workstreams only, so it is deliberately much smaller than the whole Outreach.io account: the sales and one-off account sequences hold roughly ten times as many prospects and are excluded here on purpose.',
  },
  outreachReplyRate: {
    label: 'Reply rate',
    what: 'How often outreach emails get a reply. The headline basis is PER EMAIL DELIVERED — the basis Outreach.io’s own reporting uses, and one that can never read above 100%.',
    source: 'Outreach.io engagement snapshot (per-step counters for the email basis, per-sequence counters for the secondary people basis).',
    calc:
      'The headline figure is PER EMAIL: replies ÷ emails delivered (changed 11 Aug 2026 — it was per person before). The smaller secondary line is PER PERSON: replies ÷ prospects in cadence, which always reads higher because a multi-step cadence sends several emails to each prospect. Both are all-time, across the three marketing workstreams.',
    caveat:
      'If this looks lower than a previous screenshot, check the basis: before 11 Aug the headline was per person (~9% vs ~1% per email for the same programme). Neither basis is wrong — per person answers “how many of the people we approached answered us”, per email answers “how well does an individual email perform”. Two further things depress the blended figure honestly: the SoPro and Microsoft TUM workstreams currently sit at zero replies (the cold sending was paused over the sending-domain issue), so nearly all replies come from Historic Data Reactivation; and Outreach.io’s own counters disagree with each other for the same snapshot (30 people marked replied vs 12 reply events on 9 sequences) — until that is settled the per-person figure is the softer of the two. The check that resolves it — counting the individual email records directly — is built and waiting on one data pull.',
  },
  outreachOpenRate: {
    label: 'Open rate',
    what: 'How often outreach emails are opened, per email delivered.',
    source: 'Outreach.io per-step engagement snapshot.',
    calc: 'Opens ÷ emails delivered across the sequences in scope (cumulative lifetime snapshot). Changed 11 Aug 2026: the old formula divided open EVENTS by PEOPLE, which read above 100% by construction (each person receives several emails and one email can register several opens) — that reading was the formula, not bad data.',
    caveat: 'An all-time figure, not a per-quarter one — the quarter pill does not change it. Open tracking is approximate: it counts tracking-pixel fires, so it over-counts (one person opening twice, or a mail client pre-loading images, both register) — the displayed rate is capped at 100%.',
  },
  outreachOpps: {
    label: 'Opportunities from Outreach (outbound)',
    what: 'Salesforce opportunities whose contact is a member of an outbound Outreach sequence — created count, influenced pipeline (open + won) and closed-won value.',
    source: 'Salesforce opportunities joined to Outreach sequence membership by the contact’s email; scoped to the selected region and quarter.',
    calc: 'An opportunity is credited to a sequence when its Salesforce contact matches a prospect in that sequence AND that prospect was actually contacted (tightened 11 Aug 2026: queued, failed and bounced prospects no longer claim credit — they never received anything). Counted DISTINCT per opportunity for the Outbound-prospecting tier only. Influenced pipeline = open-qualified value + closed-won value; closed-won = won value.',
    caveat: 'Contact-attributed (a sequenced contact is on the opp), NOT campaign-attributed — so these can overlap the campaign channels on the Pipeline page and are shown separately, not added to the campaign total. Pipeline reads as contact-touch (full deal value, revenue), not "generated", and can be dominated by a single large sales-led deal.',
  },
  marketingSpend: {
    label: 'Marketing Spend (actual)',
    what: 'Actual marketing spend recorded to date.',
    source: 'The marketing budget tracker (EUR-native).',
    calc: 'Sum of spend line items, net of correction rows (negative adjustments are subtracted, not counted as events).',
    caveat: 'This is actual spend from the tracker; the sync date is shown on the tile because a stale sync reads as "spend too low". The annual budget (€466,394.92) and available MDF (€86,394.92, part of the total — the remainder is an exact €380,000 core budget) were supplied by CWSI on 11 Aug 2026. Budget and MDF utilisation are always full-year, all-regions figures, even when a quarter or region is selected.',
  },
  outreachMeetings: {
    label: 'Meetings booked (Outreach-attributed)',
    what: 'Salesforce meetings that the outreach can reasonably be said to have produced — the person was actually emailed, and the meeting happened after the outreach began.',
    source: 'Salesforce meetings (Event, Type = Meeting) joined to Outreach prospects on the contact’s email address, then to the sequence that emailed them.',
    calc:
      'TWO CONDITIONS, both required, adopted at CWSI’s request on 20 Aug 2026. (1) The person was ACTUALLY EMAILED — at least one email landed and did not bounce; someone sitting unworked in a sequence’s queue cannot claim credit. (2) The meeting took place ON OR AFTER the date that person was first worked; a meeting that predates the outreach cannot have been caused by it. Where someone sits on several sequences the test passes if ANY of them had emailed them before the meeting, so a sequence added later never disqualifies a meeting an earlier one earned.\n\n' +
      'MEETINGS ARE COUNTED, NOT ATTENDEES. Salesforce writes one Event record per person invited, each with its own record ID, so a meeting with three attendees appears three times. Meetings are identified by subject + date, with “Following:”, “RE:” and “FW:” stripped because Outlook adds those to the same booking. Counting records rather than meetings inflated this figure by roughly double before it was corrected on 24 Aug 2026.',
    caveat:
      'THIS DIFFERS DELIBERATELY FROM THE ALL-TIME OUTREACH PROGRAMME REPORT, and both are right. That report applies only the first condition — the person was emailed — and states plainly that its figure “indicates influence, not attribution”. On the same data it shows 16 where this page shows 3: the 13 in between are meetings with people we had emailed, but which took place BEFORE the outreach started — continuations of existing relationships. This page reports the narrower, causal question because the figure sits beside opportunities and closed-won, where it reads as credit.\n\n' +
      'The match is email-based, so coverage is partial: a contact who used a different address in Outreach than in Salesforce will not match. And note that none of the currently attributed meetings involved a reply to the sequence, so even these should be read as indicative rather than outreach-generated — the reply figure is the stronger signal of interest.',
  },
}

// Look up an entry; returns null if the id is unknown (so <Explain> can no-op safely).
export function methodologyOf(id) {
  return METHODOLOGY[id] || null
}
