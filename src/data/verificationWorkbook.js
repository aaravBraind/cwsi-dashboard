// ---- Verification workbook -------------------------------------------------
// Margot, 3 Sep 2026: "What I'm looking for is all of the data that's feeding into all
// numbers being displayed in the dashboard so I can verify whether the data displayed is
// correct… I've tried verifying all of the data in the dashboard and it seems harder than
// I expected."
//
// The per-panel drill-downs answer one figure at a time. This hands over the WHOLE record
// set behind the dashboard as one Excel workbook: a sheet per data source, plus — the part
// that actually makes verification possible — a "Figures" sheet listing every headline
// number with the sheet and filter that reproduces it.
//
// Without that index it is 5,000 rows and no way in. With it, every number has a recipe.
//
// Two rules this file follows:
//   • The VALUES on the Figures sheet come from the dashboard's own query functions, never
//     recomputed here. If the export recomputed them it could disagree with the screen,
//     which is the exact problem this is meant to solve.
//   • Anything that would make an honest hand-tally come out differently is stated on the
//     Read me sheet rather than left to be discovered — the monotonic funnel floor, the
//     date cap, gross profit vs revenue, and the region overrides.

import {
  getVerificationData, getKpiTracker, getWebTraffic, getLinkedInSnapshot,
  getAeEmailEngagement, getCurrentVsOngoing,
} from './queries'
import { REPORTING_END_ISO, isNA } from './constants'

const S = String
const N = Number

// Column definitions follow write-excel-file v4: `header` + a `cell(row)` returning a
// cell object. (v3's `column`/`value`/`schema` form was removed — passing `schema` now
// throws.) `w` is the Excel column width in characters.
const HEAD = { fontWeight: 'bold', backgroundColor: '#EAF0F8', align: 'left' }
const col = (header, value, { type = S, format, w, align } = {}) => ({
  header: { value: header, ...HEAD },
  width: w,
  cell: (r) => ({ type, value: value(r), format, align }),
})
const money = (header, value, w = 16) => col(header, value, { type: N, format: '#,##0.00', w })
const count = (header, value, w = 12) => col(header, value, { type: N, format: '#,##0', w })
const text = (header, value, w = 22) => col(header, value, { type: S, w })
const date = (header, value, w = 13) => col(header, value, { type: S, w })

// Excel chokes on undefined; null renders as an empty cell.
const str = (v) => (v == null ? null : String(v))
const numOr = (v) => (v == null || v === '' || isNA(v) || Number.isNaN(Number(v)) ? null : Number(v))

const REGION_LABEL = { all: 'All regions', UKI: 'UKI', BELUX: 'BeLux', NL: 'NL' }
const QUARTER_LABEL = { q1: 'Q1 2026', q2: 'Q2 2026', q3: 'Q3 2026', q4: 'Q4 2026', ytd: 'Year to date 2026' }

export async function generateVerificationWorkbook(filters = {}) {
  const scopeRegion = REGION_LABEL[filters.region || 'all'] || filters.region
  const scopeQuarter = QUARTER_LABEL[filters.quarter || 'ytd'] || filters.quarter
  const today = new Date().toISOString().slice(0, 10)
  const cap = today < REPORTING_END_ISO ? today : REPORTING_END_ISO

  // Raw rows and the dashboard's own computed figures, fetched together at one scope.
  const [d, kpi, web, li, email, split] = await Promise.all([
    getVerificationData(filters),
    getKpiTracker(filters),
    getWebTraffic(filters),
    getLinkedInSnapshot(filters),
    getAeEmailEngagement(filters),
    getCurrentVsOngoing(filters),
  ])
  const f = kpi?.funnel || {}
  const wt = web?.totals || {}
  const lt = li?.totals || {}
  const et = email?.totals || {}

  // ---- Sheet 1: Read me ----------------------------------------------------
  const readme = [
    ['CWSI marketing dashboard — verification workbook', ''],
    ['', ''],
    ['Scope of this file', `${scopeRegion} · ${scopeQuarter}`],
    ['Generated', today],
    ['Dates included up to', cap],
    ['', ''],
    ['What this is', 'Every record behind every number on the dashboard, at the scope above. One sheet per data source.'],
    ['Where to start', 'The "Figures" sheet lists each headline number with the sheet and filter that reproduces it.'],
    ['', ''],
    ['FOUR THINGS THAT WILL MAKE A HAND TALLY DIFFER', ''],
    ['1. Gross profit, not revenue',
      'Pipeline, influenced margin and the campaign figures are GROSS PROFIT. Each deal also carries its full revenue ("Value EUR") for comparison — summing that column instead will give a higher number. Where Salesforce holds no gross profit for a deal, the deal is left OUT of the gross-profit total rather than counted at full value.'],
    ['2. The funnel has a floor',
      'Anyone who reached a later stage must have passed the earlier ones, so each stage is shown as at least as large as the next (Leads ≥ MQL ≥ SQL ≥ Opportunities ≥ Closed-won). The displayed MQL figure can therefore be slightly higher than the sum of the MQL column. Leads and MQL are the same measure by definition (agreed 9 July), so MQL is shown as the larger of the two.'],
    ['3. Dates are capped',
      `Everything stops at ${cap} — today, or the end of the reporting window, whichever is earlier. Rows dated later exist in the source systems but are deliberately excluded, so a sum over a full quarter can exceed the dashboard.`],
    ['4. Region can be overridden',
      'A campaign can be reassigned to a different region in the dashboard, and regional figures follow that override rather than the region on the Salesforce account. The "Campaigns" sheet shows the region actually used.'],
    ['', ''],
    ['If a recipe does not reproduce its figure', 'Please tell us — that is a fault worth fixing, not something to work around.'],
  ].map(([k, v]) => ({ k, v }))

  const readmeCols = [text('', (r) => r.k, 34), text(' ', (r) => r.v, 120)]

  // ---- Sheet 2: Figures ----------------------------------------------------
  // Values come from the dashboard's own functions; the recipe says how to rebuild each
  // one from the sheets in this file.
  const fig = (metric, value, sheet, how) => ({ metric, value: numOr(value), sheet, how })
  const figures = [
    fig('MQLs', f.mql, 'Campaign funnel', 'Sum "MQL" — see note 2 on Read me: the displayed figure is the larger of the Leads and MQL columns.'),
    fig('SQLs', f.sql, 'Campaign funnel', 'Sum "SQL".'),
    fig('Created opportunities', f.createdOpps, 'Campaign funnel', 'Sum "Created opportunities". Cross-check: the Deals sheet, count of rows created inside the period.'),
    fig('Qualified opportunities (open + won)', f.opp, 'Campaign funnel', 'Sum "Opportunities".'),
    fig('Closed-won opportunities', f.closedWonCount, 'Campaign funnel', 'Sum "Closed-won count". Cross-check: Deals sheet, count where Status = Won.'),
    fig('Influenced pipeline (gross profit)', f.marginPipeline, 'Deals', 'Sum "Gross profit EUR" for rows where Status = Open or Won. Deals with no gross profit are excluded, not zeroed.'),
    fig('Influenced pipeline (revenue)', f.pipeline, 'Deals', 'Sum "Value EUR" for rows where Status = Open or Won. Shown for comparison — the dashboard reports the gross-profit figure above.'),
    fig('Closed-won value (revenue)', f.closedWon, 'Deals', 'Sum "Value EUR" where Status = Won.'),
    fig('Influenced margin (gross profit)', f.margin, 'Deals', 'Sum "Gross profit EUR" where Status = Won.'),
    fig('Activity run this period — closed-won (gross profit)', split?.current?.closedWon, 'Deals', 'Status = Won, Created date INSIDE the period, closed inside the period. Sum "Gross profit EUR".'),
    fig('Ongoing impact — closed-won (gross profit)', split?.prior?.closedWon, 'Deals', 'Status = Won, Created date BEFORE the period, closed inside the period. Sum "Gross profit EUR".'),
    fig('Organic traffic (sessions)', wt.sessions, 'Web traffic', 'Sum "Sessions". The sheet already excludes non-CWSI hostnames.'),
    fig('Traffic from organic social (sessions)', wt.socialSessions, 'Web traffic', 'Sum "Sessions" where Channel = Organic Social.'),
    fig('Total conversions (GA4 key events)', wt.keyEvents, 'Web traffic', 'Sum "Key events".'),
    fig('LinkedIn impressions', lt.impressions, 'LinkedIn Ads', 'Sum "Impressions".'),
    fig('LinkedIn clicks', lt.clicks, 'LinkedIn Ads', 'Sum "Clicks".'),
    fig('LinkedIn spend', lt.spend, 'LinkedIn Ads', 'Sum "Spend".'),
    fig('Emails delivered', et.delivered, 'Email sends', 'Sum "Delivered".'),
    fig('Unique email opens', et.uniqueOpens ?? et.opens, 'Email sends', 'Sum "Unique opens".'),
    fig('Unique email clicks', et.uniqueClicks ?? et.clicks, 'Email sends', 'Sum "Unique clicks".'),
    fig('Meetings', d.meetings.length, 'Meetings', 'Count of rows.'),
  ].filter((r) => r.value != null)

  const figuresCols = [
    text('Figure on the dashboard', (r) => r.metric, 44),
    money('Value', (r) => r.value, 18),
    text('Sheet in this file', (r) => r.sheet, 20),
    text('How to reproduce it', (r) => r.how, 110),
  ]

  // ---- Data sheets ---------------------------------------------------------
  const dealsCols = [
    text('Opportunity', (r) => str(r.opp_name), 40),
    text('Account', (r) => str(r.account_name), 28),
    text('Campaign', (r) => str(r.campaign_name), 40),
    text('Channel', (r) => str(r.channel_name), 20),
    text('Region', (r) => str(r.region_code), 10),
    text('Stage', (r) => str(r.stage_name), 20),
    text('Status', (r) => (r.is_won ? 'Won' : r.is_closed ? 'Lost' : 'Open'), 10),
    money('Value EUR', (r) => numOr(r.amount_eur)),
    money('Gross profit EUR', (r) => numOr(r.margin_eur)),
    date('Created', (r) => str(r.created_date)),
    date('Closed', (r) => str(r.close_date)),
    text('Salesforce ID', (r) => str(r.opp_id), 20),
  ]

  const funnelCols = [
    date('Date', (r) => str(r.activity_date)),
    text('Campaign', (r) => str(r.campaign_name), 40),
    text('Channel', (r) => str(r.channel_name), 20),
    text('Type', (r) => str(r.campaign_type), 20),
    text('Region', (r) => str(r.region_code), 10),
    count('Leads', (r) => numOr(r.leads)),
    count('MQL', (r) => numOr(r.mql_count)),
    count('SQL', (r) => numOr(r.sql_count)),
    count('Created opportunities', (r) => numOr(r.created_opp_count), 20),
    count('Opportunities', (r) => numOr(r.opp_count), 15),
    count('Closed-won count', (r) => numOr(r.closed_won_count), 17),
    money('Open pipeline EUR', (r) => numOr(r.pipeline_value)),
    money('Closed-won EUR', (r) => numOr(r.closed_won_value)),
    money('Won gross profit EUR', (r) => numOr(r.margin_value), 19),
    money('Open pipeline gross profit EUR', (r) => numOr(r.pipeline_margin_value), 26),
  ]

  const campaignsCols = [
    text('Campaign', (r) => str(r.campaign_name), 44),
    text('Type', (r) => str(r.campaign_type), 22),
    date('Start date', (r) => str(r.start_date)),
    text('Parent campaign', (r) => str(r.parent_name), 30),
    text('Source system', (r) => str(r.source_system), 16),
    count('Audience size', (r) => numOr(r.audience_size), 14),
    count('Number sent', (r) => numOr(r.number_sent), 13),
    text('Salesforce ID', (r) => str(r.campaign_key), 20),
  ]

  const webCols = [
    date('Date', (r) => str(r.activity_date)),
    text('Region', (r) => str(r.region_code), 10),
    text('Website', (r) => str(r.hostname), 28),
    text('Channel', (r) => str(r.channel_group), 22),
    count('Sessions', (r) => numOr(r.sessions)),
    count('Engaged sessions', (r) => numOr(r.engaged_sessions), 17),
    count('Key events', (r) => numOr(r.key_events)),
    count('Users', (r) => numOr(r.users)),
    count('Page views', (r) => numOr(r.page_views)),
  ]

  const adsCols = [
    date('Date', (r) => str(r.activity_date)),
    text('Campaign ID', (r) => str(r.campaign_key), 22),
    text('Source', (r) => str(r.source), 14),
    money('Spend', (r) => numOr(r.spend)),
    count('Impressions', (r) => numOr(r.impressions), 14),
    count('Clicks', (r) => numOr(r.clicks)),
    count('Leads', (r) => numOr(r.leads)),
  ]

  const pageCols = [
    date('Date', (r) => str(r.activity_date)),
    text('Region', (r) => str(r.region_code), 10),
    count('New followers', (r) => numOr(r.followers_new_total), 14),
    count('Impressions', (r) => numOr(r.impressions_total), 14),
    count('Engagements', (r) => numOr(r.engagements_total), 14),
    count('Clicks', (r) => numOr(r.clicks_total)),
    count('Reactions', (r) => numOr(r.reactions_total)),
    count('Comments', (r) => numOr(r.comments_total)),
    count('Reposts', (r) => numOr(r.reposts_total)),
    count('Page views', (r) => numOr(r.page_views_total)),
    count('Unique visitors', (r) => numOr(r.unique_visitors_total), 15),
  ]

  const meetingsCols = [
    date('Date', (r) => str(r.activity_date)),
    text('Subject', (r) => str(r.subject), 46),
    text('Contact', (r) => str(r.contact_email), 30),
    text('Related to', (r) => str(r.what_type), 16),
    text('Salesforce ID', (r) => str(r.meeting_id), 20),
  ]

  const emailCols = [
    text('Email', (r) => str(r.email_name), 44),
    date('Sent', (r) => str(r.sent_at ? String(r.sent_at).slice(0, 10) : null)),
    count('Sent', (r) => numOr(r.sent)),
    count('Delivered', (r) => numOr(r.delivered)),
    count('Unique opens', (r) => numOr(r.unique_opens), 14),
    count('Total opens', (r) => numOr(r.total_opens), 13),
    count('Unique clicks', (r) => numOr(r.unique_clicks), 14),
    count('Total clicks', (r) => numOr(r.total_clicks), 13),
    count('Opt-outs', (r) => numOr(r.opt_outs)),
    count('Hard bounces', (r) => numOr(r.hard_bounces), 14),
    count('Soft bounces', (r) => numOr(r.soft_bounces), 14),
    text('Campaign ID', (r) => str(r.campaign_key), 22),
  ]

  const spendCols = [
    date('Date', (r) => str(r.activity_date)),
    text('Quarter', (r) => str(r.quarter), 10),
    text('Budget line', (r) => str(r.budget_line), 40),
    text('Audience', (r) => str(r.primary_audience), 24),
    text('Status', (r) => str(r.status), 14),
    text('Owner', (r) => str(r.owner), 20),
    money('Amount', (r) => numOr(r.amount)),
    text('Currency', (r) => str(r.currency), 10),
    text('Notes', (r) => str(r.notes), 40),
  ]

  // Targets: the numeric register plus the hand-entered measures, in one list.
  const targetRows = [
    ...Object.values(d.targets || {}).map((t) => ({
      kpi: t.label || t.kpi_key, unit: t.unit,
      q1: numOr(t.q1), q2: numOr(t.q2), q3: numOr(t.q3), q4: numOr(t.q4), fy: numOr(t.fy),
      source: t.source === 'client' ? 'CWSI' : 'BrainD provisional',
      note: t.note,
    })),
    ...Object.entries(d.manual || {}).map(([key, byPeriod]) => ({
      kpi: key, unit: 'entered by hand',
      q1: numOr(byPeriod.q1?.target_num) ?? null, q2: numOr(byPeriod.q2?.target_num) ?? null,
      q3: numOr(byPeriod.q3?.target_num) ?? null, q4: numOr(byPeriod.q4?.target_num) ?? null,
      fy: numOr(byPeriod.fy?.target_num) ?? null,
      source: 'CWSI',
      note: ['q1', 'q2', 'q3', 'q4'].map((p) => byPeriod[p]?.target_text).filter(Boolean).join(' / ') || null,
    })),
  ]
  const targetsCols = [
    text('KPI', (r) => str(r.kpi), 40),
    text('Unit', (r) => str(r.unit), 16),
    money('Q1', (r) => r.q1, 12),
    money('Q2', (r) => r.q2, 12),
    money('Q3', (r) => r.q3, 12),
    money('Q4', (r) => r.q4, 12),
    money('Full year', (r) => r.fy, 14),
    text('Target set by', (r) => str(r.source), 18),
    text('Note', (r) => str(r.note), 90),
  ]

  // Empty sheets are dropped rather than shipped as a confusing blank tab.
  const all = [
    ['Read me', readme, readmeCols],
    ['Figures', figures, figuresCols],
    ['Deals', d.deals, dealsCols],
    ['Campaign funnel', d.funnel, funnelCols],
    ['Campaigns', d.campaigns, campaignsCols],
    ['Web traffic', d.web, webCols],
    ['LinkedIn Ads', d.linkedinAds, adsCols],
    ['LinkedIn page', d.linkedinPage, pageCols],
    ['Meetings', d.meetings, meetingsCols],
    ['Email sends', d.emails, emailCols],
    ['Marketing spend', d.spend, spendCols],
    ['KPI targets', targetRows, targetsCols],
  ].filter(([, rows]) => Array.isArray(rows) && rows.length > 0)

  // v4 multi-sheet form: an array of sheet objects, each carrying its own rendered data.
  // `columns` is passed through as well so Excel picks up the column widths.
  const { default: writeXlsxFile, getSheetData } = await import('write-excel-file/browser')
  const sheets = all.map(([name, rows, columns]) => ({
    sheet: name,
    data: getSheetData(rows, columns),
    columns,
    stickyRowsCount: 1, // freeze the header row on every sheet
  }))
  const fileName = `CWSI-dashboard-data-${(filters.region || 'all').toLowerCase()}-${filters.quarter || 'ytd'}-${today}.xlsx`
  await writeXlsxFile(sheets).toFile(fileName)
}
