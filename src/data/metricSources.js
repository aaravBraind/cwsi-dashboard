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

const CAMPAIGN = { field: 'campaign_name', label: 'Campaign', fallback: 'No campaign in Salesforce' }
const CHANNEL = { field: 'channel_name', label: 'Channel', fallback: 'Other / Unmapped' }

// The funnel counts and money all come from one place: the campaign × date fact rows.
const facts = (label, column, extra = {}) => ({
  label, from: 'facts', column, unit: 'count',
  group: CHANNEL, sub: CAMPAIGN, date: 'activity_date',
  ...extra,
})

export const METRIC_SOURCES = {
  // ---- Funnel counts -------------------------------------------------------
  totalMqls: facts('MQLs', 'mql_count', {
    note: 'The dashboard shows each funnel stage as at least as large as the next, so the headline MQL figure can be slightly higher than the campaign rows below add up to — it is the larger of the Leads and MQL counts. Leads and MQL are the same measure by definition (agreed 9 July).',
  }),
  totalSqls: facts('SQLs', 'sql_count'),
  createdOpportunities: facts('Created opportunities', 'created_opp_count', {
    note: 'Every opportunity created in the period, at any stage — not only qualified ones.',
  }),
  opportunities: facts('Qualified opportunities', 'opp_count'),
  closedWonCount: facts('Closed-won opportunities', 'closed_won_count'),

  // ---- Money ---------------------------------------------------------------
  closedWonValue: facts('Closed-won value (revenue)', 'closed_won_value', {
    unit: 'money',
    note: 'Revenue, not gross profit — this is the one money figure on the dashboard reported at full deal value.',
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
    group: { field: 'region_code', label: 'Region', fallback: 'Multi-market' },
    sub: { field: 'campaign_name', label: 'Campaign', fallback: 'No campaign' },
    date: 'quarter',
    note: 'LinkedIn Ads is the only paid channel running in 2026. A campaign can target several markets, so it is counted for each region it targets.',
  },
  clicks: {
    label: 'Clicks', from: 'ads', column: 'clicks', unit: 'count',
    group: { field: 'region_code', label: 'Region', fallback: 'Multi-market' },
    sub: { field: 'campaign_name', label: 'Campaign', fallback: 'No campaign' },
    date: 'quarter',
  },

  // ---- LinkedIn company page (organic social) ------------------------------
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
