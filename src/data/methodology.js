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
    what: 'Each quarter has one overarching quarterly campaign — “Data Is an Asset, Not a Liability” (Q1), “Innovation Without Risk” (Q2), “Build Trust in a Distrustful World” (Q3) and “Cybersecurity. Safeguarding Business Growth.” (Q4) — each rolled up as a whole with its individual activities beneath, plus an “Other activities” catch-all.',
    source: 'Salesforce campaigns, grouped by the quarterly campaign each one belongs to.',
    calc: 'An activity belongs to the quarterly campaign it was part of, which is not always the quarter it ran in: the Q1 and Q2 campaigns list exactly the activities CWSI named for them, so the May LinkedIn ads promoting the “Data That Moves Your Business Forward” whitepaper sit under Q1, and the September and October Microsoft E7 Suite events and the Becoming Frontier legal campaign sit under Q2. Any other activity is placed by the date in its campaign name (e.g. “10.09.2026 …” → Q3), then an explicit “Q1/Q2/Q3” label, then the Salesforce Campaign Start Date — so it is keyed to when it STARTED, never to when it closed or ended. The page shows only the campaigns belonging to the selected quarter, so activities do not cross between quarters as deals land. Anything not tied to a 2026 quarterly campaign sits under “Other activities”. The rows are ordered by contribution (pipeline, then revenue), not by date.',
    caveat:
      'The money against an activity is dated by the DEAL, not by the campaign: an open opportunity counts in the quarter it was created, a won one in the quarter it closed — so an activity placed in Q1 can still be showing revenue in Q2. Two different things are also shown per activity: the FUNNEL (MQL / SQL) counts campaign RESPONDERS — people logged as “responded” to the campaign in Salesforce — while the MONEY (Open Pipeline / Closed-Won) counts OPPORTUNITIES linked to the campaign. They’re independent, so an activity (often an in-person event) can show pipeline or revenue with 0 responders: deals were attributed to the event, but the attendees weren’t recorded as responded members.',
  },
  currentVsOngoing: {
    label: 'Current-quarter activity vs ongoing impact',
    what: 'Splits this period’s pipeline and revenue by whether the opportunity behind it was created this period or in an earlier one — showing marketing’s long tail.',
    source: 'Salesforce Opportunity — its Created Date, Close Date, Stage and Gross Profit, for opportunities credited to a marketing campaign (Primary Campaign Source).',
    calc: 'Each figure is bucketed by the OPPORTUNITY’S CREATION DATE: “run this period” if the opportunity was created inside the selected quarter/window, “ongoing impact” if it was created earlier and is only landing now. A won deal counts in the window it closed in; an open one counts while it sits in pipeline. MQLs have no opportunity to date them by, so they keep their own activity date and are not split.',
    caveat: 'The two buckets are a complete split — run this period + ongoing impact always equals the view’s total, and the panel states that sum so it can be checked at a glance. (The former third “undated” bucket is gone: it existed because some Salesforce campaigns carry no start date, and dating by the opportunity instead removes the problem at source.) In 2026 to date most of the pipeline and revenue landing in a quarter comes from campaigns that started EARLIER — the whole point of this split. A €0 for “run this period” closed-won is a genuine zero, not missing data — newly-started campaigns generate pipeline first and their revenue lands in later quarters. The split is relative to the selected period (a deal created in Q1 is “run this period” under YTD but “ongoing impact” under the Q2 pill); the quarterly TOTALS still sum to the YTD totals. On the year-to-date view ongoing impact is €0 by definition, because the period starts on the first day the dashboard holds data and no opportunity can pre-date it — pick a quarter to see it. Each figure has a “show the campaigns and deals behind this number” link beneath it listing every contributing opportunity, the exact amount it contributed and a CSV export, so the total can be checked line by line against Salesforce.',
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
    caveat: 'From 9 October 2026, an SQL counts for a campaign only if the lead became sales-qualified after responding to that campaign, so a lead that was already being worked when it registered for an event is not credited to the event. Salesforce has recorded status changes only since 8 October 2026, so for responses before then we cannot tell which came first and count the lead’s current status, as before.',
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
    label: 'Closed Won (gross profit)',
    what: 'The GROSS PROFIT on won opportunities that marketing touched. The full deal value is shown alongside it, labelled as the revenue basis.',
    source: 'won, campaign-attributed opportunities in Salesforce — each opportunity’s Gross Profit Value (or Amount × Gross Profit Margin % where only the % is set). The secondary revenue figure uses the Amount field.',
    calc: 'Sum of gross profit (EUR) across won deals, converted to EUR using the Salesforce corporate exchange rate. Won deals are counted in the quarter they CLOSED. A deal with no Gross Profit in Salesforce is excluded rather than counted at its full value — every won 2026 deal currently carries one, so nothing is excluded today.',
    caveat: 'The basis changed on 18 September 2026 at CWSI’s request, so that every financial figure on the dashboard is gross profit; earlier screenshots show the higher revenue figure. This is the same set of deals, and the same number, as Influenced Margin — Closed-Won states the outcome, Influenced Margin states the profit on it. A deal is only ever in one state at a time: once it closes and is won it moves OUT of open pipeline INTO Closed-Won, so a Closed-Won value alongside €0 open pipeline is expected, not missing data.',
  },
  margin: {
    label: 'Influenced Margin (gross profit)',
    what: 'The GROSS PROFIT on the marketing-attributed won deals. Since September 2026 Closed-Won is reported on the same gross-profit basis, so the two figures are deliberately identical — this row names the profit, Closed-Won names the deals it came from.',
    source: 'the opportunity’s Gross Profit field in Salesforce (or amount × gross-profit-margin % where only the % is set).',
    calc: 'Sum of gross profit (EUR) across won deals. A deal with neither field filled is excluded — never counted as full revenue.',
    caveat:
      'Gross profit depends on the type of deal: for CWSI’s OWN SERVICES, revenue and margin are set equal in Salesforce, while resold third-party product carries a real margin below the deal value. In the current 2026 data, 20 of the 24 won-deal records show gross profit equal to the full deal value and only 4 show a margin below it — a blended ~91% — so this figure presently tracks close to revenue. That is faithful to Salesforce, not a dashboard error. The useful signal is the GAP between this and the revenue basis shown beside Closed-Won: it widens as more resold product enters the marketing-influenced mix. Pending with CWSI: confirming those equal-value deals are genuinely all own-services rather than resold deals with cost not yet entered.',
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
    caveat: 'This bucket is mostly system and housekeeping campaigns rather than marketing activity, but deals genuinely attributed to them are real revenue and stay counted. Outreach is NOT in this bucket: the Outreach campaigns in Salesforce have their own Outreach channel row.',
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
    what: 'Salesforce opportunities linked to the Outreach campaigns — created count, influenced pipeline (open + won) and closed-won, on gross profit.',
    source: 'Salesforce opportunities whose primary campaign is one of the dedicated Outreach workflow campaigns (“2026 - Outreach … Workflow”); scoped to the selected region and quarter.',
    calc: 'A deal counts for Outreach when Salesforce records one of the Outreach workflow campaigns as its campaign — the basis CWSI chose on 20 Aug 2026 (“the specific campaign that generated the opportunity, which Salesforce records at the campaign level”), applied on 26 Oct 2026. Each campaign belongs to one workstream (the Secure workflows to Historic Data Reactivation, the SoPro and Microsoft TUM workflows to their own), so opportunities are reported per workstream rather than per sequence or seller. Influenced pipeline = open qualified gross profit + won gross profit; closed-won = won gross profit. Every deal is listed on the Outreach page.',
    caveat: 'Until 26 Oct 2026 this figure credited any deal where one of the contacts had at some point been emailed by a sequence. That counted renewals and add-ons with existing customers who had been loaded into the sequences, so it overstated Outreach several times over (65 deals in 2026 against 2 on this basis). A deal only counts here if it is linked to an Outreach campaign in Salesforce, so a deal the outreach helped win but that carries another campaign will not show — that is a Salesforce data-entry question rather than a dashboard one.',
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
    what: 'Salesforce meetings that the outreach can reasonably be said to have produced — the person replied to the outreach and met soon after.',
    source: 'Salesforce meetings (Event, Type = Meeting) joined to Outreach prospects on the contact’s email address, then to the sequence that emailed them.',
    calc:
      'FOUR CONDITIONS, all required (tightened 26 Oct 2026 after CWSI pointed out meetings that could never have come from Outreach). (1) The person was EMAILED by the sequence — at least one email landed and did not bounce. (2) They REPLIED to the outreach. (3) The meeting took place between the first email and 90 DAYS AFTER THE REPLY. (4) CWSI had NO MEETING with that person before the outreach began — otherwise it is an existing customer or project relationship the outreach did not create. Where someone sits on several sequences the test passes if any one of them meets all four.\n\n' +
      'A note on replies: the sales engagement platform stamps a reply date when a prospect answers ANY email, including a seller’s ordinary one-to-one mail, and then closes the sequence. A reply date on someone the sequence never emailed is therefore not counted as a reply to the outreach.\n\n' +
      'MEETINGS ARE COUNTED, NOT ATTENDEES. Salesforce writes one Event record per person invited, so a meeting with three attendees appears three times. Meetings are identified by subject + date, with “Following:”, “RE:” and “FW:” stripped because Outlook adds those to the same booking.',
    caveat:
      'This differs deliberately from the all-time Outreach programme report, which counts any meeting with someone who was emailed and says its figure “indicates influence, not attribution”. Until 26 Oct 2026 this page used conditions (1) and the meeting-after-first-email test only, which credited delivery and account meetings with existing customers (findings presentations, project kick-offs) because those people had been loaded into a sequence. The match is email-based, so a contact who used a different address in the two systems will not match.',
  },
}

// Look up an entry; returns null if the id is unknown (so <Explain> can no-op safely).
export function methodologyOf(id) {
  return METHODOLOGY[id] || null
}
