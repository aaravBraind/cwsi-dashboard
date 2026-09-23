// ---- Where every number comes from -----------------------------------------
// Margot, 6 Sep 2026: "someone who is going through the database should know where this
// number is coming from, which campaign, LinkedIn or any other thing… this is what I want
// for all the numbers."
//
// The drill-downs built so far each answer ONE figure. This registry generalises it: each
// dashboard metric declares the source it is summed from and how to group the contributing
// rows, so a single component (SourceBreakdown) can open ANY of them.
//
// Worked example — the 778 MQLs on the Overview for Q3:
//   Email 562 (6 campaigns) + Events & Webinars 148 (20) + Organic SEO 68 (12) = 778.
//
// `from` names the fetcher in getMetricSource(): every one of them applies the SAME region
// and quarter scoping the dashboard figure uses (including the campaign region overrides),
// so a breakdown can never be scoped differently from the number above it.
//
// `note` is the honest caveat for that metric — the thing that would otherwise make a
// hand-tally differ. It is shown inside the breakdown, not hidden in a tooltip.

import { EMAIL_FAMILY_FACT_KEYS } from './pinnedCampaigns'

const CAMPAIGN = { field: 'campaign_name', label: 'Campaign', fallback: 'No campaign in Salesforce' }
const CHANNEL = { field: 'channel_name', label: 'Channel', fallback: 'Other / Unmapped' }

// Why a funnel-stage breakdown can legitimately not add up to its own headline.
const FLOOR = 'The dashboard shows each funnel stage as at least as large as the next — anyone who reached a later stage must have passed the earlier ones — so this figure can read slightly higher than its own rows add up to. Where that happens the panel says so and gives both numbers. MQLs are responded Salesforce campaign members; Leads and MQL are the same measure by definition (agreed 9 July).'

const WEB_CHANNEL = 'Organic SEO'
const WEB_EXCLUDE = ['Content/White Paper'] // reported on the Email page instead
const EVENTS_CHANNEL = 'Events & Webinars'
const WEBINAR = ['Webinar'] // the one campaign type that is a webinar rather than an in-person event
// Influenced pipeline is gross profit STILL OPEN plus gross profit ALREADY WON, so a
// breakdown summing only the open side would disagree with its own headline.
const GP_BOTH = ['pipeline_margin_value', 'margin_value']
const GP_NOTE = 'Gross profit on generated opportunities — those still open plus those already won, so closed-won is always a subset. A deal with no Gross Profit in Salesforce contributes nothing rather than being counted at its full revenue.'
const WON_GP_NOTE = 'Gross profit on won deals. A deal with no Gross Profit in Salesforce is left out rather than counted at its full revenue, so it contributes nothing here.'

// The funnel counts and money all come from one place: the campaign × date fact rows.
const facts = (label, column, extra = {}) => ({
  label, from: 'facts', column, unit: 'count',
  group: CHANNEL, sub: CAMPAIGN, date: 'activity_date',
  ...extra,
})

export const METRIC_SOURCES = {
  // ---- Funnel counts -------------------------------------------------------
  // MQLs are RESPONDED SALESFORCE CAMPAIGN MEMBERS (`mql_count`), not `leads`. `leads`
  // additionally carries LinkedIn lead-gen form fills, which are not campaign members and
  // must not appear in a figure the client reconciles against Salesforce (Margot, 18 Sep).
  totalMqls: facts('MQLs', 'mql_count', { floorOver: ['mql_count', 'sql_count', 'opp_count', 'closed_won_count'], gapNote: FLOOR }),
  totalSqls: facts('SQLs', 'sql_count', { floorOver: ['sql_count', 'opp_count', 'closed_won_count'], gapNote: FLOOR }),
  createdOpportunities: facts('Created opportunities', 'created_opp_count', {
    note: 'Every opportunity created in the period, at any stage — not only qualified ones.',
  }),
  opportunities: facts('Qualified opportunities', 'opp_count', { floorOver: ['opp_count', 'closed_won_count'], gapNote: FLOOR }),
  closedWonCount: facts('Closed-won opportunities', 'closed_won_count'),

  // ---- Money ---------------------------------------------------------------
  closedWonValue: facts('Closed-won value (gross profit)', 'margin_value', {
    unit: 'money',
    note: WON_GP_NOTE,
  }),
  // The revenue basis, kept as an explicitly labelled secondary so the full deal value
  // stays checkable against Salesforce rather than disappearing.
  closedWonRevenue: facts('Closed-won value (revenue)', 'closed_won_value', {
    unit: 'money',
    note: 'Full deal value on won deals. Shown alongside the gross-profit figure, which is the reported basis.',
  }),
  influencedMargin: facts('Influenced margin (gross profit)', 'margin_value', {
    unit: 'money',
    note: 'Gross profit on won deals. A deal with no Gross Profit in Salesforce is left out of this total rather than counted at its full revenue, so it contributes nothing here.',
  }),
  // Two columns, because the headline is both: gross profit still open PLUS gross profit
  // already won (a deal that closed was still influenced). Summing only the open side
  // would make the breakdown disagree with the number it explains.
  influencedPipeline: facts('Influenced pipeline (gross profit)', null, {
    columns: ['pipeline_margin_value', 'margin_value'],
    unit: 'money',
    note: 'Gross profit on generated opportunities — those still open plus those already won, so closed-won is always a subset. A deal with no Gross Profit in Salesforce contributes nothing rather than being counted at its full revenue.',
  }),

  // ---- Website (GA4) -------------------------------------------------------
  totalOrganicTraffic: {
    label: 'Organic traffic (sessions)', from: 'web', column: 'sessions', unit: 'count',
    group: { field: 'channel_group', label: 'Channel', fallback: 'Unassigned' },
    sub: { field: 'hostname', label: 'Website', fallback: 'Unknown' },
    date: 'activity_date',
    note: 'Only the cwsisecurity.com domain family is counted; development and preview hosts are excluded at source.',
  },
  socialSessions: {
    label: 'Traffic from organic social (sessions)', from: 'web', column: 'sessions', unit: 'count',
    group: { field: 'channel_group', label: 'Channel', fallback: 'Unassigned' },
    sub: { field: 'hostname', label: 'Website', fallback: 'Unknown' },
    date: 'activity_date',
    where: (r) => r.channel_group === 'Organic Social',
  },
  totalConversions: {
    label: 'Total conversions (downloads & form fills)', from: 'web', column: 'key_events', unit: 'count',
    group: { field: 'channel_group', label: 'Channel', fallback: 'Unassigned' },
    sub: { field: 'hostname', label: 'Website', fallback: 'Unknown' },
    date: 'activity_date',
    note: 'GA4 key events across paid and organic traffic.',
  },
  conversionsFromOrganic: {
    label: 'Conversions from organic', from: 'web', column: 'key_events', unit: 'count',
    group: { field: 'channel_group', label: 'Channel', fallback: 'Unassigned' },
    sub: { field: 'hostname', label: 'Website', fallback: 'Unknown' },
    date: 'activity_date',
  },

  // ---- Paid media (LinkedIn Ads) -------------------------------------------
  // Paid figures come from the authoritative LinkedIn campaign table, which is keyed by
  // campaign and quarter rather than by day — so these rows carry no date.
  impressions: {
    label: 'Impressions', from: 'ads', column: 'impressions', unit: 'count',
    group: { field: 'market_label', label: 'Market', fallback: 'Multi-market' },
    sub: { field: 'campaign_name', label: 'Campaign', fallback: 'No campaign' },
    date: 'quarter',
    note: 'LinkedIn Ads is the only paid channel running in 2026. A campaign can target several markets, so it is counted for each region it targets.',
  },
  clicks: {
    label: 'Clicks', from: 'ads', column: 'clicks', unit: 'count',
    group: { field: 'market_label', label: 'Market', fallback: 'Multi-market' },
    sub: { field: 'campaign_name', label: 'Campaign', fallback: 'No campaign' },
    date: 'quarter',
  },

  // ---- Derived rates -------------------------------------------------------
  // A rate has no rows of its own; it divides two figures that DO. Each side is a
  // registered metric, so both remain openable from inside the rate's own panel.
  mqlToSql: { kind: 'ratio', label: 'MQL → SQL conversion', num: 'totalSqls', den: 'totalMqls' },
  sqlToWon: { kind: 'ratio', label: 'SQL → Closed/Won', num: 'closedWonCount', den: 'totalSqls' },
  overallConversion: { kind: 'ratio', label: 'Overall conversion (MQL → closed-won)', num: 'closedWonCount', den: 'totalMqls' },

  // ---- Website Performance — the Organic SEO channel, whitepapers excluded --
  // Scoped exactly as the SEO page scopes it, so the two can never disagree.
  webTotalLeads: facts('Website: total leads', 'leads', { channel: WEB_CHANNEL, excludeTypes: WEB_EXCLUDE, floorOver: ['leads', 'mql_count', 'sql_count', 'opp_count', 'closed_won_count'], gapNote: FLOOR }),
  webSqls: facts('Website: SQLs', 'sql_count', { channel: WEB_CHANNEL, excludeTypes: WEB_EXCLUDE, floorOver: ['sql_count', 'opp_count', 'closed_won_count'], gapNote: FLOOR }),
  webClosedOpps: facts('Website: closed-won opportunities', 'closed_won_count', { channel: WEB_CHANNEL, excludeTypes: WEB_EXCLUDE }),
  webInfluencedPipeline: facts('Website: influenced pipeline (gross profit)', null, {
    columns: GP_BOTH, unit: 'money', channel: WEB_CHANNEL, excludeTypes: WEB_EXCLUDE, note: GP_NOTE,
  }),
  webInfluencedMargin: facts('Website: closed-won value (gross profit)', 'margin_value', {
    unit: 'money', channel: WEB_CHANNEL, excludeTypes: WEB_EXCLUDE, note: WON_GP_NOTE,
  }),
  webMqlToSql: { kind: 'ratio', label: 'Website: MQL → SQL', num: 'webSqls', den: 'webTotalLeads' },
  webSqlToWon: { kind: 'ratio', label: 'Website: SQL → Closed/Won', num: 'webClosedOpps', den: 'webSqls' },

  // ---- Events Performance — IN-PERSON events ---------------------------------
  // Events and webinars are reported separately (Margot, 23 Sep 2026: "We've separated
  // events and webinars in the reporting, but this distinction doesn't seem to be reflected
  // in the current report"). Both live in the Events & Webinars channel, so the split is by
  // campaign type — the same scoping the KPI Tracker uses, so each breakdown foots to its tile.
  eventsMqls: facts('Events: MQLs', 'leads', { channel: EVENTS_CHANNEL, excludeTypes: WEBINAR, floorOver: ['leads', 'mql_count', 'sql_count', 'opp_count', 'closed_won_count'], gapNote: FLOOR }),
  eventsSqls: facts('Events: SQLs', 'sql_count', { channel: EVENTS_CHANNEL, excludeTypes: WEBINAR, floorOver: ['sql_count', 'opp_count', 'closed_won_count'], gapNote: FLOOR }),
  eventsClosedOpps: facts('Events: closed-won opportunities', 'closed_won_count', { channel: EVENTS_CHANNEL, excludeTypes: WEBINAR }),
  eventsInfluencedPipeline: facts('Events: influenced pipeline (gross profit)', null, {
    columns: GP_BOTH, unit: 'money', channel: EVENTS_CHANNEL, excludeTypes: WEBINAR, note: GP_NOTE,
  }),
  eventsInfluencedMargin: facts('Events: closed-won value (gross profit)', 'margin_value', {
    unit: 'money', channel: EVENTS_CHANNEL, excludeTypes: WEBINAR, note: WON_GP_NOTE,
  }),
  eventsSqlToWon: { kind: 'ratio', label: 'Events: SQL → Closed/Won', num: 'eventsClosedOpps', den: 'eventsSqls' },
  registrations: facts('Events: registrations (leads)', 'leads', {
    channel: EVENTS_CHANNEL, excludeTypes: WEBINAR,
    note: 'Campaign membership on in-person event campaigns — the people registered, counted from Salesforce.',
  }),
  // Both sides floored, exactly as the tile divides them.
  mqlToSqlEvents: { kind: 'ratio', label: 'MQL → SQL conversion (events)', num: 'eventsSqls', den: 'eventsMqls' },

  // ---- Webinars Performance — Webinar campaigns only -----------------------
  webinarRegistrations: facts('Webinars: registrations (leads)', 'leads', {
    channel: EVENTS_CHANNEL, onlyTypes: WEBINAR,
    note: 'Campaign membership on webinar campaigns — the people registered, counted from Salesforce.',
  }),
  webinarMqls: facts('Webinars: MQLs', 'leads', { channel: EVENTS_CHANNEL, onlyTypes: WEBINAR, floorOver: ['leads', 'mql_count', 'sql_count', 'opp_count', 'closed_won_count'], gapNote: FLOOR }),
  webinarSqls: facts('Webinars: SQLs', 'sql_count', { channel: EVENTS_CHANNEL, onlyTypes: WEBINAR, floorOver: ['sql_count', 'opp_count', 'closed_won_count'], gapNote: FLOOR }),
  webinarClosedOpps: facts('Webinars: closed-won opportunities', 'closed_won_count', { channel: EVENTS_CHANNEL, onlyTypes: WEBINAR }),
  webinarInfluencedPipeline: facts('Webinars: influenced pipeline (gross profit)', null, {
    columns: GP_BOTH, unit: 'money', channel: EVENTS_CHANNEL, onlyTypes: WEBINAR, note: GP_NOTE,
  }),
  webinarInfluencedMargin: facts('Webinars: closed-won value (gross profit)', 'margin_value', {
    unit: 'money', channel: EVENTS_CHANNEL, onlyTypes: WEBINAR, note: WON_GP_NOTE,
  }),
  webinarMqlToSql: { kind: 'ratio', label: 'Webinars: MQL → SQL conversion', num: 'webinarSqls', den: 'webinarMqls' },
  webinarSqlToWon: { kind: 'ratio', label: 'Webinars: SQL → Closed/Won', num: 'webinarClosedOpps', den: 'webinarSqls' },

  // ---- Quarter-on-quarter growth -------------------------------------------
  organicTrafficGrowth: {
    kind: 'growth', label: 'Organic traffic growth vs prior quarter', base: 'totalOrganicTraffic',
    // While a quarter is still running it is compared against the SAME number of elapsed days
    // of the prior quarter. Dividing a part-quarter by a whole one reported a 32% fall during
    // a 68% rise (18 Sep), and understates the current quarter on almost every day of it.
    note: 'Measured against the quarter before the one selected, so it is blank for Q1 (no earlier quarter in the reporting year) and for the year-to-date view (not a quarter).',
  },

  // ---- Outreach (prospecting) ----------------------------------------------
  // A LIFETIME cadence snapshot, not a dated series: the platform reports running
  // per-sequence counters, so these are region-scoped only and the quarter pill does not
  // narrow them. Said plainly in each note, because it is the likeliest source of confusion.
  // `lifetime: true` — Outreach engagement is a running counter per sequence, not a dated
  // series, so the same figure appears in every quarter. The report shows these ONCE, as a
  // to-date figure (Margot, 23 Sep: "As we're unable to provide an accurate quarterly split
  // for Outreach, please review how the data is currently broken down by quarter … to avoid
  // creating any confusion"). Meetings and opportunities below ARE dated and keep quarters.
  outreachProspects: {
    lifetime: true,
    label: 'Prospects in cadence', from: 'outreachSeq', column: 'prospects', unit: 'count',
    group: { field: 'region_code', label: 'Region', fallback: 'Unassigned' },
    sub: { field: 'sequence_name', label: 'Sequence', fallback: 'Unnamed sequence' },
    date: 'sequence_id', rowLabel: 'Sequence ID',
    note: 'A lifetime snapshot of the marketing sequences — the quarter pill does not narrow it, because the platform reports a running counter per sequence rather than a dated series.',
  },
  outreachDelivered: {
    lifetime: true,
    label: 'Emails delivered', from: 'outreachStep', column: 'delivered', unit: 'count',
    group: { field: 'sequence_name', label: 'Sequence', fallback: 'Unnamed sequence' },
    sub: { field: 'step_type', label: 'Step type', fallback: 'Unknown step' },
    date: 'step_order', rowLabel: 'Step',
    note: 'Email steps only, across the marketing sequences — call steps have no delivery. Lifetime snapshot.',
  },
  outreachOpens: {
    lifetime: true,
    label: 'Opens', from: 'outreachStep', column: 'opens', unit: 'count',
    group: { field: 'sequence_name', label: 'Sequence', fallback: 'Unnamed sequence' },
    sub: { field: 'step_type', label: 'Step type', fallback: 'Unknown step' },
    date: 'step_order', rowLabel: 'Step',
  },
  outreachClicks: {
    lifetime: true,
    label: 'Clicks', from: 'outreachStep', column: 'clicks', unit: 'count',
    group: { field: 'sequence_name', label: 'Sequence', fallback: 'Unnamed sequence' },
    sub: { field: 'step_type', label: 'Step type', fallback: 'Unknown step' },
    date: 'step_order', rowLabel: 'Step',
  },
  outreachReplies: {
    lifetime: true,
    label: 'Replies', from: 'outreachStep', column: 'replies', unit: 'count',
    group: { field: 'sequence_name', label: 'Sequence', fallback: 'Unnamed sequence' },
    sub: { field: 'step_type', label: 'Step type', fallback: 'Unknown step' },
    date: 'step_order', rowLabel: 'Step',
  },
  outreachOptOuts: {
    lifetime: true,
    label: 'Opt-outs', from: 'outreachStep', column: 'opt_outs', unit: 'count',
    group: { field: 'sequence_name', label: 'Sequence', fallback: 'Unnamed sequence' },
    sub: { field: 'step_type', label: 'Step type', fallback: 'Unknown step' },
    date: 'step_order', rowLabel: 'Step',
  },
  outreachOpenRate: { lifetime: true, kind: 'ratio', label: 'Open rate', num: 'outreachOpens', den: 'outreachDelivered',
    note: 'Per email delivered — the platform basis, which cannot exceed 100% per person. Opens are pixel events, so the displayed rate is capped at 100%.' },
  outreachCtr: { lifetime: true, kind: 'ratio', label: 'Click-through rate', num: 'outreachClicks', den: 'outreachDelivered' },
  outreachReplyRate: { lifetime: true, kind: 'ratio', label: 'Reply rate', num: 'outreachReplies', den: 'outreachDelivered' },
  outreachUnsubRate: { lifetime: true, kind: 'ratio', label: 'Unsubscribe rate', num: 'outreachOptOuts', den: 'outreachDelivered' },

  // ---- Attendance — in-person events and webinars reported apart ------------
  // The attendance figures used to combine GoToWebinar webinars with the in-person attendee
  // lists under one "Events" heading, so a Q1 with no in-person event at all showed 196
  // registrants (two webinars). Events and webinars are reported separately (Margot, 23 Sep),
  // so each side now counts only its own rows. `kind` is set by the events fetcher.
  eventRegistrants: {
    label: 'Events: registrants', from: 'events', column: 'registrants', unit: 'count',
    where: (r) => r.kind === 'In-person (attendee lists)',
    group: { field: 'kind', label: 'Source', fallback: 'Unknown' },
    sub: { field: 'event_name', label: 'Event', fallback: 'Unnamed event' },
    date: 'activity_date',
    note: 'From the in-person attendee lists (Attendees + Non-Attendees), each counted in the quarter the event took place.',
  },
  eventAttendees: {
    label: 'Events: attendees', from: 'events', column: 'attendees', unit: 'count',
    where: (r) => r.kind === 'In-person (attendee lists)',
    group: { field: 'kind', label: 'Source', fallback: 'Unknown' },
    sub: { field: 'event_name', label: 'Event', fallback: 'Unnamed event' },
    date: 'activity_date',
  },
  attendanceRate: { kind: 'ratio', label: 'Attendance rate (events)', num: 'eventAttendees', den: 'eventRegistrants',
    note: 'In-person events only; webinar attendance is reported in the Webinars section.' },
  webinarRegistrants: {
    label: 'Webinars: registrants', from: 'events', column: 'registrants', unit: 'count',
    where: (r) => String(r.kind || '').startsWith('Webinars'),
    group: { field: 'kind', label: 'Source', fallback: 'Unknown' },
    sub: { field: 'event_name', label: 'Webinar', fallback: 'Unnamed webinar' },
    date: 'activity_date',
    note: 'From GoToWebinar, plus the attendee lists for the few webinars GoToWebinar does not carry.',
  },
  webinarAttendees: {
    label: 'Webinars: attendees', from: 'events', column: 'attendees', unit: 'count',
    where: (r) => String(r.kind || '').startsWith('Webinars'),
    group: { field: 'kind', label: 'Source', fallback: 'Unknown' },
    sub: { field: 'event_name', label: 'Webinar', fallback: 'Unnamed webinar' },
    date: 'activity_date',
  },
  webinarAttendanceRate: { kind: 'ratio', label: 'Attendance rate (webinars)', num: 'webinarAttendees', den: 'webinarRegistrants' },

  // ---- Outreach outcomes, attributed by contact ----------------------------
  // Counted ONCE each, because Salesforce writes one row per meeting ATTENDEE — a meeting with
  // three attendees is three rows and one meeting. The de-duplication also spans sequences, but
  // that is a safety net rather than a description of the data: within the three marketing
  // workstreams no meeting and no opportunity is currently attributed to more than one sequence
  // (verified 18 Sep — 5 meetings, 138 opportunities, all one-to-one), so per-sequence rows add
  // to the total. Outbound prospecting sequences only.
  outreachMeetings: {
    kind: 'distinct', from: 'outreachMeetingRows', label: 'Meetings booked (outbound)', unit: 'count',
    note: 'Salesforce meetings attributed to outbound sequences, counted once per meeting rather than once per attendee.',
  },
  outreachMqls: {
    kind: 'distinct', from: 'outreachMeetingRows', label: 'MQLs (meetings booked)', unit: 'count',
    note: 'Your MQL definition counts meetings booked plus content downloads; downloads are not recorded for outreach yet, so this is meetings only — counted once per meeting.',
  },
  outreachCreatedOpps: {
    kind: 'distinct', from: 'outreachOppRows', label: 'Opportunities created (outbound)', unit: 'count',
    note: 'Opportunities attributed to outbound sequences by contact, counted once per deal. Counted only where the person was actually emailed and the deal was created ON OR AFTER the first email — outreach cannot have caused a deal that already existed. Same rule as the meetings figure (your instruction, Aug 2026; extended to opportunities Sep 2026).',
  },
  outreachClosedWon: {
    kind: 'distinct', from: 'outreachOppRows', measure: 'won', label: 'Closed-won (outbound)', unit: 'money',
    note: 'Gross profit on won opportunities attributed to outbound sequences, each deal valued once. Deal value is shown alongside it. Counted only where the person was actually emailed and the deal was created ON OR AFTER the first email — outreach cannot have caused a deal that already existed. Same rule as the meetings figure (your instruction, Aug 2026; extended to opportunities Sep 2026).',
  },
  outreachPipeline: {
    kind: 'distinct', from: 'outreachOppRows', measure: 'openPlusWon', label: 'Influenced pipeline (outbound)', unit: 'money',
    note: 'Gross profit on open qualified opportunities PLUS those already won, attributed to outbound sequences by contact — so closed-won is always a subset. Unqualified deals are excluded, each deal is valued once, and a deal with no gross profit in Salesforce contributes nothing rather than its full value. Counted only where the person was actually emailed and the deal was created ON OR AFTER the first email — outreach cannot have caused a deal that already existed. Same rule as the meetings figure (your instruction, Aug 2026; extended to opportunities Sep 2026).',
  },

  // ---- Marketing email platform (Account Engagement) -----------------------
  // Scoped to the named campaigns exactly as the Email page and the KPI Tracker scope them.
  // Each rate resolves both sides, so "60% open rate" opens as opens ÷ delivered with every
  // contributing email listed.
  aeDelivered: {
    label: 'Emails delivered (marketing platform)', from: 'aeEmail', column: 'delivered', unit: 'count',
    group: { field: 'campaign_name', label: 'Campaign', fallback: 'Unattributed' },
    sub: { field: 'email_name', label: 'Email', fallback: 'Unnamed email' }, date: 'sent_date',
    note: 'Emails the platform confirmed as delivered — sends minus hard and soft bounces. The denominator for all three rates below.',
  },
  aeUniqueOpens: {
    label: 'Unique opens (marketing platform)', from: 'aeEmail', column: 'unique_opens', unit: 'count',
    group: { field: 'campaign_name', label: 'Campaign', fallback: 'Unattributed' },
    sub: { field: 'email_name', label: 'Email', fallback: 'Unnamed email' }, date: 'sent_date',
    note: 'People who opened, counted once each however many times they opened. Opens are pixel events, so they undercount where images are blocked.',
  },
  aeUniqueClicks: {
    label: 'Unique clicks (marketing platform)', from: 'aeEmail', column: 'unique_clicks', unit: 'count',
    group: { field: 'campaign_name', label: 'Campaign', fallback: 'Unattributed' },
    sub: { field: 'email_name', label: 'Email', fallback: 'Unnamed email' }, date: 'sent_date',
    note: 'People who clicked, counted once each however many links they clicked.',
  },
  aeOptOuts: {
    label: 'Unsubscribes (marketing platform)', from: 'aeEmail', column: 'opt_outs', unit: 'count',
    group: { field: 'campaign_name', label: 'Campaign', fallback: 'Unattributed' },
    sub: { field: 'email_name', label: 'Email', fallback: 'Unnamed email' }, date: 'sent_date',
    note: 'People who unsubscribed from an email in these campaigns.',
  },
  emailOpenRate: { kind: 'ratio', label: 'Open rate (marketing email)', num: 'aeUniqueOpens', den: 'aeDelivered',
    note: 'Unique opens ÷ delivered — the platform basis, so it cannot exceed 100% per person.' },
  emailCtr: { kind: 'ratio', label: 'Click-through rate (marketing email)', num: 'aeUniqueClicks', den: 'aeDelivered',
    note: 'People who clicked ÷ delivered.' },
  unsubscribeRate: { kind: 'ratio', label: 'Unsubscribe rate (marketing email)', num: 'aeOptOuts', den: 'aeDelivered',
    note: 'Opt-outs ÷ delivered.' },


  // ---- Entered by hand — no system records these ---------------------------
  // The honest answer to "where does this number come from" is "a person typed it", so
  // the panel says so and shows who and when.
  prPlacements: { kind: 'manual', label: 'Tier-1 earned media placements', unit: 'count',
    note: 'There is no PR reporting feed, so this is recorded by hand each quarter.' },
  thoughtLeadershipArticles: { kind: 'manual', label: 'Thought-leadership / contributed articles', unit: 'count',
    note: 'No content-publishing feed is connected, so this is recorded by hand each quarter.' },
  heroCaseStudies: { kind: 'manual', label: 'Hero case studies produced', unit: 'count',
    note: 'No content-publishing feed is connected, so this is recorded by hand each quarter.' },
  mdfClaimRate: { kind: 'manual', label: 'MDF claim success rate', unit: 'rate',
    note: 'Claim-level partner data is not held in the dashboard, so this is recorded by hand.' },
  websiteIntegrity: { kind: 'manual', label: 'Website measurement integrity', unit: 'text', textual: true,
    note: 'A governance status, not a measurement: analytics consent/tracking, campaign conversion events, Account Engagement and territory attribution all validated.' },
  organicEngagementTime: { kind: 'manual', label: 'Organic engagement time', unit: 'text', textual: true,
    note: 'A trend judgement taken from the post-launch performance reporting, recorded by hand.' },

  // ---- Email Performance — pinned to the four named campaign families ------
  // Scoped by campaign key, not by channel: these campaigns span the Email and SEO
  // channels, which is why the Email page pins them explicitly.
  emailMqls: facts('Email: MQLs', 'leads', { keys: EMAIL_FAMILY_FACT_KEYS, floorOver: ['leads', 'mql_count', 'sql_count', 'opp_count', 'closed_won_count'], gapNote: FLOOR }),
  emailSqls: facts('Email: SQLs', 'sql_count', { keys: EMAIL_FAMILY_FACT_KEYS, floorOver: ['sql_count', 'opp_count', 'closed_won_count'], gapNote: FLOOR }),
  emailClosedOpps: facts('Email: closed-won opportunities', 'closed_won_count', { keys: EMAIL_FAMILY_FACT_KEYS }),
  emailInfluencedPipeline: facts('Email: influenced pipeline (gross profit)', null, {
    columns: GP_BOTH, unit: 'money', keys: EMAIL_FAMILY_FACT_KEYS, note: GP_NOTE,
  }),
  emailInfluencedMargin: facts('Email: closed-won value (gross profit)', 'margin_value', {
    unit: 'money', keys: EMAIL_FAMILY_FACT_KEYS, note: WON_GP_NOTE,
  }),
  emailMqlToSql: { kind: 'ratio', label: 'Email: MQL → SQL', num: 'emailSqls', den: 'emailMqls' },
  emailSqlToWon: { kind: 'ratio', label: 'Email: SQL → Closed/Won', num: 'emailClosedOpps', den: 'emailSqls' },

  // ---- LinkedIn company page (organic social) ------------------------------
  pageEngagements: {
    label: 'Page engagements', from: 'page', column: 'engagements_total', unit: 'count',
    group: { field: 'region_code', label: 'Page region', fallback: 'Unassigned' },
    sub: { field: 'page_key', label: 'Page', fallback: 'Company page' },
    date: 'activity_date',
    note: 'Reactions, comments, reposts and clicks on LinkedIn company-page posts.',
  },
  pageImpressions: {
    label: 'Page impressions', from: 'page', column: 'impressions_total', unit: 'count',
    group: { field: 'region_code', label: 'Page region', fallback: 'Unassigned' },
    sub: { field: 'page_key', label: 'Page', fallback: 'Company page' },
    date: 'activity_date',
  },
  engagementRate: { kind: 'ratio', label: 'Engagement rate', num: 'pageEngagements', den: 'pageImpressions' },

  followerGrowth: {
    label: 'Follower growth (net new followers)', from: 'page', column: 'followers_new_total', unit: 'count',
    group: { field: 'region_code', label: 'Page region', fallback: 'Unassigned' },
    sub: { field: 'page_key', label: 'Page', fallback: 'Company page' },
    date: 'activity_date',
    note: 'Net new followers in the period. This is a COUNT — the agreed target is a percentage, which cannot be scored until the follower base is available.',
  },
}

// A metric can be opened only if it is registered here.
export const hasSource = (key) => Boolean(key && METRIC_SOURCES[key])
