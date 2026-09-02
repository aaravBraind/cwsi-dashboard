// ---- Shared KPI register definition --------------------------------------
// The single source of truth for the KPI register rows, used by BOTH the KPI
// Tracker page (KpiTracker.jsx) and the Export layer (exporters.js) so the two
// can never drift. Pure: takes the already-fetched, already-scoped data and
// returns the row list. Actuals are real; only targets (resolved elsewhere from
// kpi_targets) are placeholder.
//
// Row shape: { t, label, ctx?, key?, num? }
//   t    'cat' | 'live' | 'na'
//   key  kpi_targets key → links the row to its editable target + status
//   num  numeric actual for the status comparison (rates as fractions)
//   val  display string for a live actual (n/a rows show "not available yet")

import { eur, num, pct, isNA } from './format'

const has = (x) => x != null && !isNA(x)

export function buildKpiRegisterRows({ funnel, web, events, attendance, outreach, outreachMeetings, linkedin, linkedinPage, aeEmail, eventAttendance, emailFunnel, webFunnel, eventsFunnel } = {}) {
  const f = funnel || {}
  const w = web || {}
  const o = outreach?.kpis || {}
  const oe = outreach?.emailBasis || {} // per-email rates (W3: the primary basis)
  const ot = outreachMeetings?.oppTiers?.outbound || null
  const outMeetings = outreachMeetings?.tiers?.outbound
  const outInfluenced = ot ? ot.pipeline + ot.won : null
  // Retained contracts + expansion removed from the register (Margot, 9 Jul call).

  // W9 (11 Aug): the stub rows are wired to the data that already exists —
  //   linkedin  — the LinkedIn Ads snapshot (linkedin_campaign_2026 totals + efficiency)
  //   aeEmail   — email-platform engagement for the four named campaigns (open/CTR/unsub)
  //   eventAttendance — the in-person attendee lists, combined with GoToWebinar
  const li = linkedin?.totals || {}
  const lie = linkedin?.efficiency || {}
  const ae = aeEmail?.totals || {}
  // LinkedIn company-PAGE analytics (organic social), distinct from `linkedin` which is Ads.
  const lp = linkedinPage || {}
  const ea = eventAttendance?.totals || null
  // Post-QA review (17 Aug): Margot re-listed the funnel metrics PER SECTION and the
  // register only showed each once — these channel-scoped funnels fill her lists.
  //   emailFunnel  — the four named email campaigns (same scope as the Email page)
  //   webFunnel    — the Organic SEO channel excl. whitepapers (same as the SEO page)
  //   eventsFunnel — the Events & Webinars channel (same as the Events page)
  const ef = emailFunnel || {}
  const wf = webFunnel || {}
  const evf = eventsFunnel || {}
  // Channel-scoped derived-rate + funnel rows, built one way for all three sections.
  const chRows = (p, ctx, fn) => {
    const won = has(fn.closedWonCount) ? fn.closedWonCount : null
    return [
      has(fn.sql) && fn.mql
        ? { t: 'live', label: 'MQL → SQL conversion', val: pct(fn.sql, fn.mql), ctx, key: `${p}MqlToSql`, num: fn.sql / fn.mql }
        : { t: 'na', label: 'MQL → SQL conversion', ctx, key: `${p}MqlToSql` },
      won != null && fn.sql
        ? { t: 'live', label: 'SQL → Closed/Won', val: pct(won, fn.sql), ctx, key: `${p}SqlToWon`, num: won / fn.sql }
        : { t: 'na', label: 'SQL → Closed/Won', ctx: `${ctx} — no closed deals in scope yet`, key: `${p}SqlToWon` },
      won != null
        ? { t: 'live', label: 'Closed-won opportunities', val: num(won), ctx, key: `${p}ClosedOpps`, num: won }
        : { t: 'na', label: 'Closed-won opportunities', ctx: `${ctx} — none in scope yet`, key: `${p}ClosedOpps` },
      has(fn.marginPipeline)
        ? { t: 'live', label: 'Influenced pipeline (gross profit)', val: eur(fn.marginPipeline), ctx, key: `${p}InfluencedPipeline`, num: fn.marginPipeline }
        : { t: 'na', label: 'Influenced pipeline (gross profit)', ctx: `${ctx} — none in scope yet`, key: `${p}InfluencedPipeline` },
      has(fn.margin)
        ? { t: 'live', label: 'Influenced margin (gross profit)', val: eur(fn.margin), ctx, key: `${p}InfluencedMargin`, num: fn.margin }
        : { t: 'na', label: 'Influenced margin (gross profit)', ctx: `${ctx} — no won deals with gross profit in scope yet`, key: `${p}InfluencedMargin` },
    ]
  }

  const convCtx = has(w.keyEvents) && w.sessions ? `${pct(w.keyEvents, w.sessions)} of sessions` : 'GA4 conversions'

  const evTypes = events?.byType || []
  const evLeads = evTypes.reduce((s, t) => s + (Number(t.leads) || 0), 0)
  const evMql = evTypes.reduce((s, t) => s + (Number(t.mql) || 0), 0)
  const evSql = evTypes.reduce((s, t) => s + (Number(t.sql) || 0), 0)

  const visitorToMqlV = has(w.keyEvents) && Number(w.sessions) > 0 ? w.keyEvents / w.sessions : null
  const mqlToSqlV = has(f.sql) && f.mql ? f.sql / f.mql : null
  const sqlToWonV = has(f.closedWonCount) && f.sql ? f.closedWonCount / f.sql : null
  const overallConvV = has(f.closedWonCount) && f.mql ? f.closedWonCount / f.mql : null
  const eventsMqlSqlV = evMql > 0 ? evSql / evMql : null
  const attendanceV = attendance && attendance.registrants > 0 ? attendance.attendees / attendance.registrants : null
  // Combined attendance = GoToWebinar (webinars) + the attendee lists (in-person), when loaded.
  const combRegs = (attendance?.registrants || 0) + (ea?.registered || 0)
  const combAtt = (attendance?.attendees || 0) + (ea?.attended || 0)
  const combAttendanceV = ea && combRegs > 0 ? combAtt / combRegs : null
  const money2 = (v) => (v == null || isNA(v) ? null : `€${Number(v).toFixed(2)}`)

  return [
    // ── Overall marketing summary (KR1/KR2: merged Pipeline Volumes + Commercial
    //    Outcomes into ONE lead section; funnel order MQL→SQL→Created Opps→Closed→outcomes) ──
    { t: 'cat', label: 'Overall Marketing Summary' },
    { t: 'live', label: 'Total MQLs', val: num(f.mql), ctx: '', key: 'totalMqls', num: f.mql },
    { t: 'live', label: 'Total SQLs', val: num(f.sql), ctx: '', key: 'totalSqls', num: f.sql },
    has(f.createdOpps)
      ? { t: 'live', label: 'Created opportunities', val: num(f.createdOpps), ctx: 'all opportunities created in period (marketing-attributed, by created date)', key: 'createdOpportunities', num: f.createdOpps }
      : { t: 'na', label: 'Created opportunities', ctx: 'created-opp count arrives at the next data refresh', key: 'createdOpportunities' },
    has(f.closedWonCount)
      ? { t: 'live', label: 'Closed-won opportunities', val: num(f.closedWonCount), ctx: 'won deals', key: 'closedWonCount', num: f.closedWonCount }
      : { t: 'na', label: 'Closed-won opportunities', ctx: 'closed-won count arrives at the next data refresh', key: 'closedWonCount' },
    has(f.marginPipeline)
      ? { t: 'live', label: 'Influenced pipeline (gross profit)', val: eur(f.marginPipeline), ctx: `gross profit on generated (open + closed-won) opportunities · ${eur(f.pipeline)} on the revenue basis`, key: 'influencedPipeline', num: f.marginPipeline }
      : { t: 'na', label: 'Influenced pipeline (gross profit)', ctx: 'open-deal gross profit arrives at the next data refresh', key: 'influencedPipeline' },
    { t: 'live', label: 'Closed-won value (revenue)', val: eur(f.closedWon), ctx: 'won deal value — revenue basis, by close date', key: 'closedWonValue', num: f.closedWon },
    has(f.margin)
      ? {
          t: 'live', label: 'Influenced margin (gross profit)',
          val: eur(f.margin),
          ctx: f.marginPendingDeals > 0
            ? `gross profit (EUR) · ${num(f.marginKnownDeals)}/${num(f.marginKnownDeals + f.marginPendingDeals)} won deals have gross profit (rest pending in Salesforce)`
            : 'gross profit (EUR)',
          key: 'influencedMargin', num: f.margin,
        }
      : { t: 'na', label: 'Influenced margin (gross profit)', ctx: 'Gross Profit blank on all won deals in scope — pending in Salesforce (not shown as revenue)', key: 'influencedMargin' },
    lie.cplForm != null && !isNA(lie.cplForm)
      ? { t: 'live', label: 'Cost per lead', val: money2(lie.cplForm), ctx: 'LinkedIn paid — the only channel with spend recorded; a blended CPL needs per-channel spend for the rest', key: 'costPerLead', num: Number(lie.cplForm) }
      : { t: 'na', label: 'Cost per lead', ctx: 'no data source yet — per-channel spend beyond LinkedIn is not recorded', key: 'costPerLead' },
    lie.roiPipeline != null && !isNA(lie.roiPipeline)
      ? { t: 'live', label: 'Return on spend', val: `${Number(lie.roiPipeline).toFixed(1)}×`, ctx: 'LinkedIn paid — SF-attributed pipeline (revenue) ÷ spend; blended return needs per-channel spend', key: 'returnOnSpend', num: Number(lie.roiPipeline) }
      : { t: 'na', label: 'Return on spend', ctx: 'no data source yet — per-channel spend beyond LinkedIn is not recorded', key: 'returnOnSpend' },

    // ── Paid & Digital Acquisition (the acquisition funnel; conversions shown once here) ──
    { t: 'cat', label: 'Paid & Digital Acquisition' },
    li.impressions > 0
      ? { t: 'live', label: 'Impressions', val: num(li.impressions), ctx: 'LinkedIn Ads — the only paid channel running in 2026', key: 'impressions', num: li.impressions }
      : { t: 'na', label: 'Impressions', ctx: 'no paid campaigns delivering in scope (LinkedIn is the only paid channel)', key: 'impressions' },
    li.clicks > 0
      ? { t: 'live', label: 'Clicks', val: num(li.clicks), ctx: 'LinkedIn Ads', key: 'clicks', num: li.clicks }
      : { t: 'na', label: 'Clicks', ctx: 'no paid campaigns delivering in scope', key: 'clicks' },
    // Paid click-through rate — new in the CWSI FY26 reforecast (Aug 2026). Already
    // derivable from the LinkedIn Ads feed, so it is reported rather than deferred.
    lie.ctr != null && !isNA(lie.ctr)
      ? { t: 'live', label: 'Click-through rate', val: `${(Number(lie.ctr) * 100).toFixed(2)}%`, ctx: 'LinkedIn Ads — clicks ÷ impressions', key: 'paidCtr', num: Number(lie.ctr) }
      : { t: 'na', label: 'Click-through rate', ctx: 'LinkedIn clicks/impressions pending', key: 'paidCtr' },
    lie.cpc != null && !isNA(lie.cpc)
      ? { t: 'live', label: 'Cost per click (CPC)', val: money2(lie.cpc), ctx: 'LinkedIn Ads (EUR)', key: 'cpc', num: Number(lie.cpc) }
      : { t: 'na', label: 'Cost per click (CPC)', ctx: 'LinkedIn spend/clicks pending', key: 'cpc' },
    lie.cpm != null && !isNA(lie.cpm)
      ? { t: 'live', label: 'Cost per thousand (CPM)', val: money2(lie.cpm), ctx: 'LinkedIn Ads (EUR)', key: 'cpm', num: Number(lie.cpm) }
      : { t: 'na', label: 'Cost per thousand (CPM)', ctx: 'LinkedIn spend/impressions pending', key: 'cpm' },
    has(w.keyEvents)
      ? { t: 'live', label: 'Total conversions (downloads & form fills)', val: num(w.keyEvents), ctx: `GA4 on-site conversions, paid + organic traffic · ${convCtx}`, key: 'totalConversions', num: w.keyEvents }
      : { t: 'na', label: 'Total conversions (downloads & form fills)', ctx: 'GA4 key events (on-site conversions)', key: 'totalConversions' },
    { t: 'live', label: 'MQL → SQL conversion', val: pct(f.sql, f.mql), ctx: 'derived', key: 'mqlToSql', num: mqlToSqlV },
    has(f.closedWonCount)
      ? { t: 'live', label: 'SQL → Closed/Won', val: pct(f.closedWonCount, f.sql), ctx: 'derived', key: 'sqlToWon', num: sqlToWonV }
      : { t: 'na', label: 'SQL → Closed/Won', ctx: 'closed-count arrives at the next data refresh', key: 'sqlToWon' },
    has(f.closedWonCount)
      ? { t: 'live', label: 'Overall conversion (MQL → closed-won)', val: pct(f.closedWonCount, f.mql), ctx: 'derived — end-to-end', key: 'overallConversion', num: overallConvV }
      : { t: 'na', label: 'Overall conversion (MQL → closed-won)', ctx: 'closed-count arrives at the next data refresh', key: 'overallConversion' },

    // ── Organic Social (KR3 — distinct group) ──
    { t: 'cat', label: 'Organic Social' },
    has(lp.engagementRate)
      ? { t: 'live', label: 'Engagement rate', val: `${(lp.engagementRate * 100).toFixed(2)}%`,
          ctx: `reactions + comments + reposts + clicks ÷ impressions · LinkedIn company page${lp.regions?.length > 1 ? `s (${lp.regions.join(', ')})` : lp.regions?.length ? ` (${lp.regions[0]})` : ''}`,
          key: 'engagementRate', num: lp.engagementRate }
      : { t: 'na', label: 'Engagement rate', ctx: 'no LinkedIn page activity in this period', key: 'engagementRate' },
    has(w.socialSessions)
      ? { t: 'live', label: 'Traffic from organic social (sessions)', val: num(w.socialSessions), ctx: 'GA4 channel = Organic Social', key: 'socialSessions', num: w.socialSessions }
      : { t: 'na', label: 'Traffic from organic social', ctx: 'GA4 Organic Social channel', key: 'socialSessions' },
    lp.hasData
      ? { t: 'live', label: 'Follower growth', val: num(lp.followersNew),
          ctx: `net new followers in the period · LinkedIn company page${lp.regions?.length > 1 ? 's' : ''}`,
          key: 'followerGrowth', num: lp.followersNew }
      : { t: 'na', label: 'Follower growth', ctx: 'no LinkedIn page data for this period', key: 'followerGrowth' },

    // ── Email Performance — live from the email platform (W9), scoped to the four
    //    named campaigns, matching the Email page ──
    { t: 'cat', label: 'Email Performance' },
    has(ae.openRate)
      ? { t: 'live', label: 'Open rate', val: `${(ae.openRate * 100).toFixed(1)}%`, ctx: 'unique opens ÷ delivered · the four named campaigns · email platform', key: 'emailOpenRate', num: ae.openRate }
      : { t: 'na', label: 'Open rate', ctx: 'no sends from the named campaigns in this period', key: 'emailOpenRate' },
    has(ae.ctr)
      ? { t: 'live', label: 'Click-through rate', val: `${(ae.ctr * 100).toFixed(1)}%`, ctx: 'people who clicked ÷ delivered · the four named campaigns', key: 'emailCtr', num: ae.ctr }
      : { t: 'na', label: 'Click-through rate', ctx: 'no sends from the named campaigns in this period', key: 'emailCtr' },
    has(ae.unsubRate)
      ? { t: 'live', label: 'Unsubscribe rate', val: `${(ae.unsubRate * 100).toFixed(2)}%`, ctx: 'opt-outs ÷ delivered · the four named campaigns', key: 'unsubscribeRate', num: ae.unsubRate }
      : { t: 'na', label: 'Unsubscribe rate', ctx: 'no sends from the named campaigns in this period', key: 'unsubscribeRate' },
    { t: 'na', label: 'Reader → MQL', ctx: 'no data source yet — needs each campaign’s downloads joined to its email opens (planned once download attribution lands)', key: 'readerToMql' },
    { t: 'na', label: 'Conversions from email', ctx: 'no data source yet — form-fill attribution back to the sending email is not recorded', key: 'conversionsFromEmail' },
    // Post-QA review: her Email Performance list also names the funnel + money metrics,
    // scoped to email — same figures as the Email page's four named campaigns.
    ...chRows('email', 'the four named campaigns · Salesforce-attributed', ef),
    { t: 'na', label: 'Cost per conversion', ctx: 'no data source yet — email-channel spend is not recorded in the tracker', key: 'emailCostPerConversion' },

    // ── Website Performance (GA4-sourced; visitor conversions shown here) ──
    { t: 'cat', label: 'Website Performance' },
    has(w.sessions) && Number(w.sessions) > 0
      ? { t: 'live', label: 'Total organic traffic (sessions)', val: num(w.sessions), ctx: 'GA4', key: 'totalOrganicTraffic', num: w.sessions }
      : { t: 'na', label: 'Total organic traffic', ctx: 'GA4 sessions', key: 'totalOrganicTraffic' },
    has(w.keyEvents)
      ? { t: 'live', label: 'Conversions from organic (GA4)', val: num(w.keyEvents), ctx: convCtx, key: 'conversionsFromOrganic', num: w.keyEvents }
      : { t: 'na', label: 'Conversions from organic', ctx: 'GA4 key events', key: 'conversionsFromOrganic' },
    visitorToMqlV != null
      ? { t: 'live', label: 'Visitor → MQL conversion', val: pct(w.keyEvents, w.sessions, 2), ctx: 'GA4 conv ÷ sessions', key: 'visitorToMql', num: visitorToMqlV }
      : { t: 'na', label: 'Visitor → MQL conversion', ctx: 'GA4 key events ÷ sessions', key: 'visitorToMql' },
    // Post-QA review: her Website Performance list also names the lead-funnel + money
    // metrics — the Organic SEO channel funnel (whitepapers excluded; same as the SEO page).
    has(wf.mql)
      ? { t: 'live', label: 'Total leads', val: num(wf.mql), ctx: 'Organic SEO channel · campaign responders', key: 'webTotalLeads', num: wf.mql }
      : { t: 'na', label: 'Total leads', ctx: 'Organic SEO channel · campaign responders', key: 'webTotalLeads' },
    ...chRows('web', 'Organic SEO channel · Salesforce-attributed', wf),

    { t: 'cat', label: 'Events Performance' },
    evLeads > 0
      ? { t: 'live', label: 'Registrations (leads)', val: num(evLeads), ctx: 'campaign membership · event campaigns', key: 'registrations', num: evLeads }
      : { t: 'na', label: 'Registrations (leads)', ctx: 'event-campaign members (at the next data refresh)', key: 'registrations' },
    combAttendanceV != null
      ? { t: 'live', label: 'Attendance rate', val: `${(combAttendanceV * 100).toFixed(0)}%`, ctx: `webinars (GoToWebinar) + in-person (attendee lists) combined · ${num(combAtt)} of ${num(combRegs)}`, key: 'attendanceRate', num: combAttendanceV }
      : attendanceV != null
      ? { t: 'live', label: 'Attendance rate (webinar)', val: pct(attendance.attendees, attendance.registrants), ctx: 'GoToWebinar · webinar only until the in-person attendee lists load', key: 'attendanceRate', num: attendanceV }
      : { t: 'na', label: 'Attendance rate', ctx: 'GoToWebinar attendance match pending', key: 'attendanceRate' },
    eventsMqlSqlV != null
      ? { t: 'live', label: 'MQL → SQL conversion (events)', val: pct(evSql, evMql), ctx: 'event-campaign funnel', key: 'mqlToSqlEvents', num: eventsMqlSqlV }
      : { t: 'na', label: 'MQL → SQL conversion (events)', ctx: 'event-campaign funnel (at the next data refresh)', key: 'mqlToSqlEvents' },
    // Post-QA review: her Events Performance list also names SQL→Won + the money metrics
    // (MQL→SQL already lives just above, so chRows' first entry is dropped).
    ...chRows('events', 'Events & Webinars channel · Salesforce-attributed', evf).slice(1),
    { t: 'na', label: 'Cost per conversion', ctx: 'no data source yet — per-event spend is not recorded in the tracker', key: 'costPerConversion' },

    // ── Outreach (Prospecting) — K1. Engagement (prospects/opens/replies) is a
    //    lifetime cadence snapshot; meetings/opps are Salesforce, contact-attributed
    //    to OUTBOUND sequences and current-view scoped (so they can overlap campaigns). ──
    { t: 'cat', label: 'Outreach (Prospecting)' },
    o.prospects > 0
      ? { t: 'live', label: 'Prospects in cadence', val: num(o.prospects), ctx: 'marketing sequences · lifetime snapshot', key: 'outreachProspects', num: o.prospects }
      : { t: 'na', label: 'Prospects in cadence', ctx: 'Outreach sequence snapshot', key: 'outreachProspects' },
    // W3 (11 Aug): open/reply rates are per EMAIL DELIVERED (Outreach.io's own basis, never
    // >100%) — the old opens-events ÷ people formula produced the >100% readings.
    has(oe.openRate)
      ? { t: 'live', label: 'Open rate', val: `${(oe.openRate * 100).toFixed(0)}%`, ctx: 'opens ÷ emails delivered · lifetime snapshot', key: 'outreachOpenRate', num: oe.openRate }
      : { t: 'na', label: 'Open rate', ctx: 'Outreach per-step engagement snapshot', key: 'outreachOpenRate' },
    has(oe.replyRate)
      ? { t: 'live', label: 'Reply rate', val: `${(oe.replyRate * 100).toFixed(1)}%`, ctx: 'replies ÷ emails delivered · lifetime snapshot', key: 'outreachReplyRate', num: oe.replyRate }
      : { t: 'na', label: 'Reply rate', ctx: 'Outreach per-step engagement snapshot', key: 'outreachReplyRate' },
    // Post-QA review: the rest of her Outreach metric list, live where a source exists.
    has(oe.clickRate)
      ? { t: 'live', label: 'Click-through rate', val: `${(oe.clickRate * 100).toFixed(1)}%`, ctx: 'clicks ÷ emails delivered · lifetime snapshot', key: 'outreachCtr', num: oe.clickRate }
      : { t: 'na', label: 'Click-through rate', ctx: 'Outreach per-step engagement snapshot', key: 'outreachCtr' },
    has(oe.unsubRate)
      ? { t: 'live', label: 'Unsubscribe rate', val: `${(oe.unsubRate * 100).toFixed(2)}%`, ctx: 'opt-outs ÷ emails delivered · lifetime snapshot', key: 'outreachUnsubRate', num: oe.unsubRate }
      : { t: 'na', label: 'Unsubscribe rate', ctx: 'Outreach per-step engagement snapshot', key: 'outreachUnsubRate' },
    outMeetings != null
      ? { t: 'live', label: 'MQLs (meetings booked)', val: num(outMeetings), ctx: 'your definition counts meetings booked + content downloads; downloads aren’t recorded for outreach yet, so this is meetings only', key: 'outreachMqls', num: outMeetings }
      : { t: 'na', label: 'MQLs (meetings booked)', ctx: 'outbound-attributed meetings (at the next data refresh)', key: 'outreachMqls' },
    { t: 'na', label: 'Reader → MQL', ctx: 'no data source yet — needs per-prospect content-download tracking for outreach sends', key: 'outreachReaderToMql' },
    { t: 'na', label: 'MQL → SQL conversion', ctx: 'not derivable — outreach prospects aren’t Salesforce leads, so there are no lead-funnel stages; outcomes are contact-attributed instead', key: 'outreachMqlToSql' },
    { t: 'na', label: 'SQL → Closed/Won', ctx: 'not derivable — outreach prospects aren’t Salesforce leads, so there are no lead-funnel stages; closed-won below is contact-attributed', key: 'outreachSqlToWon' },
    { t: 'na', label: 'Cost per conversion', ctx: 'no data source yet — outreach spend is not recorded in the tracker', key: 'outreachCostPerConversion' },
    { t: 'na', label: 'Influenced margin (gross profit)', ctx: 'no data source yet — contact-attributed deals don’t carry per-deal gross profit; the campaign-attributed margin is in the summary above', key: 'outreachInfluencedMargin' },
    outMeetings != null
      ? { t: 'live', label: 'Meetings booked (outbound)', val: num(outMeetings), ctx: 'Salesforce meetings attributed to outbound sequences', key: 'outreachMeetings', num: outMeetings }
      : { t: 'na', label: 'Meetings booked (outbound)', ctx: 'outbound-attributed meetings (at the next data refresh)', key: 'outreachMeetings' },
    ot
      ? { t: 'live', label: 'Opportunities created (outbound)', val: num(ot.createdOpps), ctx: 'contact-attributed to outbound sequences', key: 'outreachCreatedOpps', num: ot.createdOpps }
      : { t: 'na', label: 'Opportunities created (outbound)', ctx: 'outbound-attributed opportunities', key: 'outreachCreatedOpps' },
    ot
      ? { t: 'live', label: 'Closed-won (outbound)', val: eur(ot.won), ctx: 'won value · contact-attributed to outbound sequences', key: 'outreachClosedWon', num: ot.won }
      : { t: 'na', label: 'Closed-won (outbound)', ctx: 'outbound-attributed closed-won', key: 'outreachClosedWon' },
    outInfluenced != null
      ? { t: 'live', label: 'Influenced pipeline (outbound)', val: eur(outInfluenced), ctx: 'open + won · contact-attributed to outbound sequences', key: 'outreachPipeline', num: outInfluenced }
      : { t: 'na', label: 'Influenced pipeline (outbound)', ctx: 'outbound-attributed pipeline', key: 'outreachPipeline' },
  ]
}

// Target helpers shared by the page + exporter (reading a kpi_targets row).
export const periodOf = (q) => (!q || q === 'ytd' ? 'fy' : q)
export const scopeLabel = (q) => (!q || q === 'ytd' ? 'FY' : String(q).toUpperCase())

// Achievement fraction vs the target at this period (1.0 = on target); inverts
// for lower-is-better ceilings. null when no target or no live actual.
export function achievement(row, period, value) {
  if (!row) return null
  const t = row[period]
  if (t == null || value == null || isNA(value) || !Number.isFinite(Number(value))) return null
  const v = Number(value)
  return row.lower_is_better ? (v === 0 ? null : Number(t) / v) : v / Number(t)
}

// Status-light class from the achievement fraction (green ≥95% / amber ≥80% / red).
export function lightOf(row, period, value) {
  const r = achievement(row, period, value)
  if (r == null) return 'neu'
  if (r >= 0.95) return 'green'
  if (r >= 0.8) return 'amber'
  return 'red'
}

// The raw target number at this period, or null.
export const targetAt = (row, period) => (row && row[period] != null ? Number(row[period]) : null)

// Format a target value by its kpi_targets unit ('gbp'|'rate'|'count'|'x').
export function fmtTarget(unit, t) {
  if (t == null) return null
  if (unit === 'gbp') return eur(t)
  if (unit === 'rate') return `${(Number(t) * 100).toFixed(1)}%`
  if (unit === 'x') return `${Number(t).toFixed(1)}×`
  return num(t)
}
