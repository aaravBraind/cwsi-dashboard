// ---- The words that explain a metric --------------------------------------
// Shared by the in-app report (compositionReport.js, which has a live database session and
// can therefore include figures) and the offline generator
// (scripts/build_calculation_report.mjs, which cannot). One source of truth for the prose,
// so the two can never describe the same figure differently.
//
// Everything here names the SYSTEM and the FIELD — "Salesforce campaign responders" — never
// the warehouse table. The reader is checking figures against Salesforce and GA4, not
// reading our schema.

export const SOURCE_LABEL = {
  facts: 'Salesforce — campaign responses and the opportunities linked to each campaign',
  web: 'Website analytics (GA4), cwsisecurity.com domains only',
  ads: 'LinkedIn Ads — the agreed 2026 campaign figures',
  page: 'LinkedIn company page analytics',
  events: 'GoToWebinar registrations and attendance, plus the in-person attendee lists',
  outreachSeq: 'Outreach.io — sequence totals (lifetime snapshot)',
  outreachStep: 'Outreach.io — cadence step totals, email steps only (lifetime snapshot)',
  outreachMeetingRows: 'Salesforce meetings, attributed to outbound sequences by contact',
  outreachOppRows: 'Salesforce opportunities, attributed to outbound sequences by contact',
}

const FIELD_LABEL = {
  leads: 'campaign responders',
  mql_count: 'MQLs',
  sql_count: 'SQLs',
  created_opp_count: 'opportunities created',
  opp_count: 'qualified opportunities (open or won)',
  closed_won_count: 'won deals',
  closed_won_value: 'won deal value (revenue, EUR)',
  margin_value: 'gross profit on won deals (EUR)',
  pipeline_margin_value: 'gross profit on open opportunities (EUR)',
  sessions: 'sessions',
  key_events: 'conversions (GA4 key events)',
  engaged_sessions: 'engaged sessions',
  impressions: 'impressions',
  clicks: 'clicks',
  followers_new_total: 'net new followers',
  engagements_total: 'engagements (reactions + comments + reposts + clicks)',
  impressions_total: 'impressions',
  registrants: 'registrants',
  attendees: 'attendees',
  prospects: 'prospects in cadence',
  delivered: 'emails delivered',
  opens: 'opens',
  replies: 'replies',
  opt_outs: 'opt-outs',
}
const field = (c) => FIELD_LABEL[c] || c

// Where each figure sits in the report, matching the KPI Tracker's own order.
export const SECTIONS = [
  ['Commercial outcomes', ['totalMqls', 'totalSqls', 'createdOpportunities', 'opportunities',
    'closedWonCount', 'influencedPipeline', 'closedWonValue', 'influencedMargin',
    'mqlToSql', 'sqlToWon', 'overallConversion']],
  ['Paid media — LinkedIn Ads', ['impressions', 'clicks']],
  ['Organic social — LinkedIn company page', ['pageImpressions', 'pageEngagements', 'engagementRate', 'followerGrowth']],
  ['Website', ['totalOrganicTraffic', 'socialSessions', 'totalConversions', 'conversionsFromOrganic',
    'organicTrafficGrowth', 'webTotalLeads', 'webSqls', 'webMqlToSql', 'webSqlToWon',
    'webClosedOpps', 'webInfluencedPipeline', 'webInfluencedMargin',
    'organicEngagementTime', 'websiteIntegrity']],
  ['Email', ['emailMqls', 'emailSqls', 'emailMqlToSql', 'emailSqlToWon', 'emailClosedOpps',
    'emailInfluencedPipeline', 'emailInfluencedMargin']],
  ['Events', ['registrations', 'eventRegistrants', 'eventAttendees', 'attendanceRate',
    'eventsMqls', 'eventsMqlRaw', 'eventsSqls', 'mqlToSqlEvents', 'eventsSqlToWon',
    'eventsClosedOpps', 'eventsInfluencedPipeline', 'eventsInfluencedMargin']],
  ['Outreach — prospecting', ['outreachProspects', 'outreachDelivered', 'outreachOpens',
    'outreachClicks', 'outreachReplies', 'outreachOptOuts', 'outreachOpenRate', 'outreachCtr',
    'outreachReplyRate', 'outreachUnsubRate', 'outreachMeetings', 'outreachMqls',
    'outreachCreatedOpps', 'outreachClosedWon', 'outreachPipeline']],
  ['Recorded by hand', ['prPlacements', 'thoughtLeadershipArticles', 'heroCaseStudies', 'mdfClaimRate']],
]

// Which figures are worth listing campaign-by-campaign. Rates are covered by their two
// sides rather than repeated; per-channel copies of the same funnel are omitted because
// they would multiply the length without showing a record the reader cannot already see.
export const COMPOSITION_FIGURES = new Set([
  'totalMqls', 'totalSqls', 'createdOpportunities', 'opportunities', 'closedWonCount',
  'influencedPipeline', 'closedWonValue', 'influencedMargin',
  'totalOrganicTraffic', 'socialSessions', 'impressions', 'clicks',
  'pageImpressions', 'pageEngagements', 'followerGrowth',
  'eventRegistrants', 'eventAttendees', 'registrations',
  'outreachProspects', 'outreachDelivered', 'outreachOpens', 'outreachClicks',
  'outreachReplies', 'outreachOptOuts',
  'outreachMeetings', 'outreachCreatedOpps', 'outreachClosedWon', 'outreachPipeline',
])

export function describeSource(spec) {
  if (spec.kind === 'ratio') return 'Derived — it divides two other figures, both listed below.'
  if (spec.kind === 'manual') return 'Entered by hand in the dashboard. No system records this measure.'
  if (spec.kind === 'growth') return SOURCE_LABEL.web
  return SOURCE_LABEL[spec.from] || spec.from || 'Derived'
}

export function describeCalculation(spec, registry = {}) {
  const scope = []
  if (spec.channel) scope.push(`only the **${spec.channel}** channel`)
  if (spec.excludeTypes?.length) scope.push(`excluding ${spec.excludeTypes.join(', ')} campaigns`)
  if (spec.keys?.length) scope.push(`only the ${spec.keys.length} pinned campaign records for the named email campaigns`)
  const scoped = scope.length ? ` Counted across ${scope.join(', ')}.` : ''

  switch (spec.kind) {
    case 'ratio': {
      const n = registry[spec.num], d = registry[spec.den]
      return `**${n?.label || spec.num} ÷ ${d?.label || spec.den}.** A rate, so it has no records of its own. Each side is itself a figure in this report, and both can be opened separately in the dashboard.`
    }
    case 'manual':
      return '**Typed in by a person each quarter.** Nothing we are connected to records it, so the dashboard provides a field for it and shows who last set the value and when.'
    case 'growth':
      return '**This quarter against the quarter before it.** Blank for Q1, which has no earlier quarter inside the reporting year, and for the year-to-date view, which is not a single quarter.'
    case 'distinct':
      return `**De-duplicated, then ${spec.measure ? 'valued' : 'counted'}.**${
        spec.measure === 'openPlusWon' ? ' Open qualified opportunities plus those already won.'
        : spec.measure === 'won' ? ' Won value only.'
        : spec.measure === 'pipeline' ? ' Open qualified opportunities only.' : ''
      } Salesforce writes one row per meeting attendee, so a meeting attended by three people is three rows and one meeting. Records are therefore counted once each rather than once per row. Outbound prospecting sequences only.`
    default: {
      const cols = spec.columns || [spec.column]
      return `**Sum of ${cols.map(field).join(' **plus** ')}**, across every contributing record in the selected region and period.${scoped}`
    }
  }
}

// The front matter. These five rules account for essentially every case of an
// independently-calculated figure disagreeing with the dashboard.
export const PREAMBLE_RULES = `## Five rules that apply to everything

Worth reading before the detail — these account for essentially every case of an independently
calculated figure disagreeing with the dashboard.

1. **Every financial figure is gross profit, not revenue.** Influenced pipeline, influenced margin,
   new pipeline created, closed-won and the campaign figures are all gross profit, taken from each
   opportunity's Gross Profit Value in Salesforce. Where a deal has no Gross Profit recorded it is
   left **out** of the total rather than counted at its full value — every won 2026 deal currently
   carries one, so nothing is excluded today. The full deal value is shown beside the gross-profit
   figure wherever it is useful, always labelled as the revenue basis.
2. **Influenced pipeline is open *plus* won.** A deal that has closed was still influenced, so
   closed-won is always a subset of influenced pipeline — never a separate amount to add on.
   Closed-won and influenced margin are the same deals valued the same way, so they are deliberately
   the same number: one names the outcome, the other names the profit on it.
3. **MQLs are responded Salesforce campaign members.** One MQL per campaign member that Salesforce
   has flagged as having responded — a form fill, a gated download, an event registration. Members
   who were only added to a campaign, such as bulk list uploads, are not counted. Leads and MQL are
   the same measure by definition (agreed 9 July).
4. **The funnel has a floor.** Anyone who reached a later stage must have passed the earlier ones, so
   each stage is shown as at least as large as the next. In the current data this affects **SQLs**,
   where a quarter can show more qualified opportunities than leads recorded at Attempt-1 stage, and
   the SQL figure is lifted to match. It can in principle lift MQLs the same way; it does not today.
   Where it applies, the figure says so rather than leaving you to spot the difference.
5. **Dates are capped, and region can be overridden.** Nothing dated beyond today — or the end of the
   reporting window, whichever is earlier — is counted, even where later-dated records exist in the
   source systems. And a campaign reassigned to a different region in the dashboard is counted in
   that region, rather than the region held on the Salesforce account.

Two further points specific to Outreach:

- **Outreach engagement is a lifetime snapshot.** The platform reports a running counter per
  sequence rather than a dated series, so prospects, opens, replies, clicks and opt-outs show the
  **same figure in every period**. That is correct, not a fault.
- **Outreach meetings and deals are counted once each.** Salesforce writes one row per meeting
  attendee, so a meeting with three attendees is three rows and one meeting. Attribution to a
  sequence is one-to-one in the current data — no meeting and no opportunity in the marketing
  workstreams is attributed to more than one sequence — so the per-sequence rows in a breakdown add
  to the total shown above them.
`
