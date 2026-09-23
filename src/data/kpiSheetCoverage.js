// ---- Coverage of CWSI's FY26 quarterly KPI sheet -----------------------------
// Margot, 23 Sep 2026: "I shared the quarterly KPIs a little while ago and asked for that
// section to be updated." They were loaded on 1 Sep, but nothing in the report said so, and
// its closing note ("some KPIs read not available yet") read as if the section was untouched.
//
// This list is her sheet, row for row and in her order ("Braind KPI Input" tab of
// docs/kpi/CWSI_FY26_Quarterly_KPIs_Braind_Dashboard.xlsx), with where each KPI now stands.
// The report prints it with the targets read live from the dashboard's target tables, so a
// target edited on the KPI Tracker shows up here on the next export.
//
//   status  'live'    — measured automatically; target loaded
//           'manual'  — no system records it; actual and target are entered on the KPI Tracker
//           'hidden'  — target loaded, figure switched off for now (GA4 conversions, 23 Sep)
//           'missing' — not on the dashboard yet; `note` says what is needed
//   key     the target-table key (kpi_targets, or kpi_manual when status is 'manual')
//   note    plain-language caveat shown in the report (client-facing — no internal names)

export const KPI_SHEET_COVERAGE = [
  // Overall
  { section: 'Overall', kpi: 'Marketing-influenced pipeline (gross profit)', key: 'influencedPipeline', status: 'live' },
  { section: 'Overall', kpi: 'MQLs', key: 'totalMqls', status: 'live' },
  { section: 'Overall', kpi: 'SQLs', key: 'totalSqls', status: 'live' },
  { section: 'Overall', kpi: 'MQL → SQL conversion', key: 'mqlToSql', status: 'live' },
  { section: 'Overall', kpi: 'Created opportunities', key: 'createdOpportunities', status: 'live' },
  { section: 'Overall', kpi: 'Closed-won opportunities', key: 'closedWonCount', status: 'live' },
  { section: 'Overall', kpi: 'Closed-won value (revenue)', key: 'closedWonValue', status: 'live',
    note: 'Your target is on revenue; the dashboard now shows closed-won as gross profit, with revenue beside it. Please confirm which basis this target should be scored against.' },
  { section: 'Overall', kpi: 'Influenced margin (gross profit)', key: 'influencedMargin', status: 'live',
    note: 'The same deals and the same figure as closed-won value (gross profit), so it is no longer listed separately in this report; its target is kept on the KPI Tracker.' },
  { section: 'Overall', kpi: 'Return on spend', key: 'returnOnSpend', status: 'live',
    note: 'LinkedIn Ads only, as it is the only channel with spend recorded.' },
  // Paid & Digital
  { section: 'Paid & Digital', kpi: 'Impressions', key: 'impressions', status: 'live' },
  { section: 'Paid & Digital', kpi: 'Click-through rate', key: 'paidCtr', status: 'live' },
  { section: 'Paid & Digital', kpi: 'Cost per click', key: 'cpc', status: 'live' },
  { section: 'Paid & Digital', kpi: 'Cost per thousand impressions', key: 'cpm', status: 'live' },
  { section: 'Paid & Digital', kpi: 'MQL → SQL conversion', key: null, status: 'missing',
    note: 'The dashboard has one overall MQL → SQL figure, which carries the Overall row\'s target (Q3/Q4 are the same 22% in both rows). Tell us if you want a paid-only conversion as its own KPI.' },
  { section: 'Paid & Digital', kpi: 'SQL → Closed/Won conversion', key: 'sqlToWon', status: 'live',
    note: 'Measured across all channels.' },
  // Organic Social
  { section: 'Organic Social', kpi: 'Traffic from organic social', key: 'socialSessions', status: 'live' },
  { section: 'Organic Social', kpi: 'LinkedIn follower growth', key: 'followerGrowth', status: 'live',
    note: 'The dashboard counts net new followers; the target is a percentage, which needs each page\'s follower total at the start of the period to score.' },
  // Email
  { section: 'Email', kpi: 'Open rate', key: 'emailOpenRate', status: 'live' },
  { section: 'Email', kpi: 'Click-through rate', key: 'emailCtr', status: 'live' },
  { section: 'Email', kpi: 'Unsubscribe rate', key: 'unsubscribeRate', status: 'live' },
  { section: 'Email', kpi: 'Inbound leads nurtured automatically', key: null, status: 'missing',
    note: 'Needs nurture-programme membership from Account Engagement, which is not connected yet. Your sheet marks this as "add only if it can be sourced reliably".' },
  // Organic SEO
  { section: 'Organic SEO', kpi: 'Organic traffic', key: 'totalOrganicTraffic', status: 'live',
    note: 'Currently counts traffic from all channels on cwsisecurity.com. Please confirm whether it should be organic search only.' },
  { section: 'Organic SEO', kpi: 'Organic traffic growth vs prior quarter', key: 'organicTrafficGrowth', status: 'live' },
  { section: 'Organic SEO', kpi: 'Organic conversions', key: 'conversionsFromOrganic', status: 'hidden',
    note: 'Target loaded (Q4). Hidden for now, as you asked, until the Google Analytics conversion set-up is corrected.' },
  { section: 'Organic SEO', kpi: 'Visitor → MQL conversion', key: 'visitorToMql', status: 'hidden',
    note: 'Target loaded (Q4). Hidden for now for the same reason, as it is built on the same conversions.' },
  { section: 'Organic SEO', kpi: 'Website measurement integrity', key: 'websiteIntegrity', status: 'manual' },
  { section: 'Organic SEO', kpi: 'Organic engagement time', key: 'organicEngagementTime', status: 'manual' },
  // Events
  { section: 'Events', kpi: 'Registrations / leads', key: 'registrations', status: 'live',
    note: 'Now in-person events only; webinars are reported separately. Please confirm the target still applies to in-person events alone.' },
  { section: 'Events', kpi: 'Attendance rate', key: 'attendanceRate', status: 'live',
    note: 'Now in-person events only (about 50% this year); webinar attendance (about 37%) is shown separately. Please confirm whether you want a separate webinar target.' },
  { section: 'Events', kpi: 'MQL → SQL conversion', key: 'mqlToSqlEvents', status: 'live' },
  { section: 'Events', kpi: 'Event → MQL conversion', key: null, status: 'missing',
    note: 'Under the agreed definition every event registration is an MQL, so this would always be 100%. Please tell us what it should be measured against (for example attendees, or people invited).' },
  // Outreach
  { section: 'Outreach', kpi: 'Prospects added to cadence', key: 'outreachProspects', status: 'live',
    note: 'Outreach reports a running total rather than a dated series, so this is shown once as a to-date figure. Counting new prospects per quarter, as your sheet prefers, needs dated data from Outreach.' },
  { section: 'Outreach', kpi: 'Open rate', key: 'outreachOpenRate', status: 'live' },
  { section: 'Outreach', kpi: 'Reply rate', key: 'outreachReplyRate', status: 'live' },
  { section: 'Outreach', kpi: 'Meetings booked', key: 'outreachMeetings', status: 'live' },
  { section: 'Outreach', kpi: 'SQLs generated', key: null, status: 'missing',
    note: 'Outreach prospects are not Salesforce leads, so they have no lead stages. Please confirm what counts as an Outreach SQL (a booked meeting is the obvious candidate).' },
  // PR / Earned
  { section: 'PR / Earned', kpi: 'Tier-1 earned media placements', key: 'prPlacements', status: 'manual' },
  { section: 'PR / Earned', kpi: 'Thought-leadership / contributed articles', key: 'thoughtLeadershipArticles', status: 'manual' },
  // Content / Case Studies
  { section: 'Content / Case Studies', kpi: 'Hero case studies produced', key: 'heroCaseStudies', status: 'manual' },
  // Sales Enablement
  { section: 'Sales Enablement', kpi: 'Sales-cycle reduction', key: null, status: 'missing',
    note: 'Cycle lengths are already calculated on the dashboard; what is missing is the baseline cycle length to measure the reduction against.' },
  // Partner / MDF
  { section: 'Partner / MDF', kpi: 'MDF secured', key: null, status: 'missing',
    note: 'MDF is shown on the Budget page as an annual figure. A quarterly secured-versus-target measure needs to know how "secured" is recorded, and in which currency.' },
  { section: 'Partner / MDF', kpi: 'MDF claim success rate', key: 'mdfClaimRate', status: 'manual' },
]

// Table cells must not break the markdown table.
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')

// The KPI sheet section. Targets come from the dashboard's own target tables, so the report
// shows what the KPI Tracker is actually scoring against.
export function renderKpiCoverage(targets = {}, manual = {}) {
  const Q = ['q1', 'q2', 'q3', 'q4']
  const fmtT = (unit, v) => {
    if (v == null || v === '') return '—'
    const n = Number(v)
    if (Number.isNaN(n)) return String(v)
    if (unit === 'rate') return `${+(n * 100).toFixed(2)}%`
    if (unit === 'gbp' || unit === 'eur') return `€${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
    if (unit === 'x') return `${n}×`
    return n.toLocaleString('en-GB')
  }
  const targetsFor = (row) => {
    if (row.status === 'manual') {
      const m = manual[row.key] || {}
      return Q.map((q) => {
        const r = m[q]
        if (!r) return '—'
        if (r.target_text) return String(r.target_text)
        const unit = /rate/i.test(row.key) ? 'rate' : 'count'
        return fmtT(unit, r.target_num)
      })
    }
    const t = row.key ? targets[row.key] : null
    if (!t) return Q.map(() => '—')
    return Q.map((q) => fmtT(t.unit, t[q]))
  }
  const STATUS = { live: 'On the dashboard', manual: 'On the dashboard, entered by hand', hidden: 'Target loaded, hidden for now', missing: 'Not yet — needs input' }
  const count = (st) => KPI_SHEET_COVERAGE.filter((r) => r.status === st).length
  const live = count('live'), man = count('manual'), hid = count('hidden'), miss = count('missing')

  let md = `\n---\n\n# Your FY26 quarterly KPI targets\n\n`
  md += `Every KPI in the quarterly KPI sheet you shared (FY26 reforecast, August 2026), in the same order, `
  md += `with the targets the KPI Tracker is scoring against. The targets were loaded on 1 September and `
  md += `are the ones from your sheet; any of them can be edited directly on the KPI Tracker.\n\n`
  md += `- **${live + man} of ${KPI_SHEET_COVERAGE.length} KPIs are on the dashboard with your targets** — `
  md += `${live} measured automatically and ${man} entered by hand, because no connected system records them `
  md += `(PR placements, contributed articles, case studies, MDF claim rate, website measurement integrity, `
  md += `organic engagement time). Their actuals are entered on the KPI Tracker.\n`
  md += `- **${hid} have their targets loaded but are hidden for now**: the two website conversion KPIs, `
  md += `switched off at your request until the Google Analytics conversion set-up is corrected.\n`
  md += `- **${miss} are not on the dashboard yet.** Each needs a definition or a data source from CWSI; `
  md += `the reason is given against each one below. Your notes say these should only be added where they `
  md += `can be sourced reliably, so they do not hold up using the dashboard.\n\n`
  md += `| Section | KPI | Q1 target | Q2 target | Q3 target | Q4 target | Status | Note |\n|---|---|---|---|---|---|---|---|\n`
  for (const r of KPI_SHEET_COVERAGE) {
    const [q1, q2, q3, q4] = r.status === 'missing' ? ['—', '—', '—', '—'] : targetsFor(r)
    md += `| ${esc(r.section)} | ${esc(r.kpi)} | ${q1} | ${q2} | ${q3} | ${q4} | ${STATUS[r.status]} | ${esc(r.note || '')} |\n`
  }
  md += `\nA few rows on the KPI Tracker are not in your sheet, such as engagement rate and blended cost per `
  md += `lead. They still carry the indicative targets set before your reforecast; tell us if you would `
  md += `like those removed or replaced.\n\n---\n\n`
  return md
}
