-- CWSI FY26 quarterly KPI reforecast — client-supplied targets.
--
-- Source of truth: docs/kpi/CWSI_FY26_Quarterly_KPIs_Braind_Dashboard.xlsx (tab
-- "Braind KPI Input"), with docs/kpi/CWSI_FY26_Quarterly_KPI_Narrative.docx as the
-- rationale. Supplied by CWSI's fractional CMO, Aug 2026, via Margot 1 Sep 2026.
--
-- This replaces the BrainD PLACEHOLDER targets for every KPI the sheet covers. Q3/Q4
-- are the management reforecast; Q1/Q2 preserve the original planning comparator.
-- The mapping from sheet row to dashboard KPI is documented in
-- docs/kpi/KPI_REFORECAST_AUG2026.md, including the 13 sheet rows deliberately NOT
-- loaded and why.
--
-- FY is the target shown under the year-to-date pill. Counts and money sum the four
-- quarters; MQL→SQL and SQL→Closed/Won are derived from the volume targets they are
-- ratios of; other rates take the mean. A series with a missing quarter gets NULL, so
-- the year-to-date view shows "Set target" rather than a partial-year figure presented
-- as a full-year one.

-- The paid click-through rate is a new KPI in this reforecast; it has a live source
-- (LinkedIn Ads clicks ÷ impressions) so it is added rather than deferred.
insert into kpi_targets (kpi_key, label, unit, lower_is_better)
values ('paidCtr', 'Click-through rate (paid)', 'rate', false)
on conflict (kpi_key) do nothing;

with reforecast(kpi_key, q1, q2, q3, q4, fy, lower_is_better, note) as (
  values
  ('influencedPipeline', 400000, 400000, 300000, 350000, 1450000, false, $note$DEFINITION CHANGED — Reported on a gross-profit basis. Q1/Q2 retain the original phasing as a planning comparator; Q3/Q4 reforecast on the new GP basis. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Overall”, KPI “Marketing-influenced pipeline (gross profit)”.)$note$),
  ('totalMqls', 100, 100, 400, 450, 1050, false, $note$REVISED — Original strategy target was 450 for the full year. Actual volumes are materially higher, so the H2 volume target is raised — quality managed through SQL/opportunity conversion. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Overall”, KPI “MQLs”.)$note$),
  ('totalSqls', 40, 40, 80, 90, 250, false, $note$REVISED — Original working range was c.160-200 high-quality SQLs for the year. H1 actuals support a higher H2 volume target. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Overall”, KPI “SQLs”.)$note$),
  ('mqlToSql', 0.55, 0.55, 0.22, 0.22, 0.2381, false, $note$REVISED — Original strategic assumption is not supported by current actuals. Rebased to low-20s, with a modest stretch above current Q3 performance. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Overall”, KPI “MQL to SQL conversion”.)$note$),
  ('createdOpportunities', 13, 13, 25, 30, 81, false, $note$REVISED — H1 opportunity creation materially exceeded the original planning model. H2 is raised, but below the H1 peak. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Overall”, KPI “Created opportunities”.)$note$),
  ('closedWonCount', 4, 4, 8, 9, 25, false, $note$REVISED — H1 materially exceeded the original quarterly planning level. H2 target is raised while allowing for a slower Q3. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Overall”, KPI “Closed-won opportunities”.)$note$),
  ('closedWonValue', 125000, 125000, 150000, 175000, 575000, false, $note$ADDITIONAL — Retained as a commercial outcome. Q1/Q2 are working comparator targets; Q3/Q4 use actual H1 performance as the evidence base. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Overall”, KPI “Closed-won value (revenue)”.)$note$),
  ('influencedMargin', 100000, 100000, 125000, 150000, 475000, false, $note$ADDITIONAL — Gross-profit outcome measure. H2 targets reflect H1 outperformance without extrapolating the Q2 peak. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Overall”, KPI “Influenced margin (gross profit)”.)$note$),
  ('returnOnSpend', 3.2, 3.2, 3, 3, 3.1, false, $note$HOLD / DATA QA — Not lowered because the dashboard currently shows 0.0x. A 3x H2 ambition is held until marketing spend attribution is validated. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Overall”, KPI “Return on spend”.)$note$),
  ('impressions', 500000, 500000, 200000, 250000, 1450000, false, $note$REVISED — Original working estimate was 500k per quarter. Rebased to observed delivery and the current paid-media mix. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Paid & Digital”, KPI “Impressions”.)$note$),
  ('paidCtr', 0.01, 0.01, 0.01, 0.01, 0.01, false, $note$HOLD — 1.0% is the simple paid engagement benchmark until a channel-specific target is agreed. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Paid & Digital”, KPI “Click-through rate”.)$note$),
  ('cpc', 10, 10, 4, 4, 7.0, true, $note$REVISED — Rebased to observed Q2 cost per click of c.EUR 3.84. EUR 4 is a practical control level. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Paid & Digital”, KPI “Cost per click”.)$note$),
  ('cpm', 25, 25, 40, 40, 32.5, true, $note$REVISED — Rebased to observed Q2 cost per thousand of c.EUR 35.26; EUR 40 is used as a ceiling. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Paid & Digital”, KPI “Cost per thousand impressions”.)$note$),
  ('sqlToWon', 0.1, 0.1, 0.1, 0.1, 0.1, false, $note$CURRENT BASELINE — Q1 is an outlier; 10% is a demanding but usable ongoing benchmark. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Paid & Digital”, KPI “SQL to Closed/Won conversion”.)$note$),
  ('socialSessions', 150, 175, 200, 250, 775, false, $note$REVISED — Previous targets were far above actual traffic. These create a credible growth trajectory from the real baseline. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Organic Social”, KPI “Traffic from organic social”.)$note$),
  ('followerGrowth', 0.1, 0.1, 0.1, 0.1, 0.1, false, $note$EXISTING STRATEGY — Original quarterly growth ambition retained as a channel-health measure. NOTE: the dashboard currently reports net new followers as a COUNT, so this percentage target cannot be scored until a growth rate is available. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Organic Social”, KPI “LinkedIn follower growth”.)$note$),
  ('emailOpenRate', 0.35, 0.35, 0.26, 0.27, 0.3075, false, $note$REVISED — Original H1 ambition was 35%. H1 actuals are around 25-27%, so H2 is reset to a realistic improvement trajectory. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Email”, KPI “Open rate”.)$note$),
  ('emailCtr', 0.1, 0.1, 0.06, 0.06, 0.08, false, $note$REVISED — Original target was 10%. Q2 actual was 5.4%; 6% is a credible stretch target. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Email”, KPI “Click-through rate”.)$note$),
  ('unsubscribeRate', 0.003, 0.003, 0.003, 0.003, 0.003, true, $note$HOLD — 0.3% retained as a guardrail; H1 performance is already comfortably inside it. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Email”, KPI “Unsubscribe rate”.)$note$),
  ('totalOrganicTraffic', 8000, 10000, 10000, 12000, 40000, false, $note$REVISED / RESET — New site launched 23 Feb with a six-week analytics gap. Q3 is the post-launch baseline/reset quarter; Q4 is the first clean performance target. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Organic SEO”, KPI “Organic traffic”.)$note$),
  ('conversionsFromOrganic', NULL, NULL, NULL, 30, NULL, false, $note$REVISED / RESET — No retrospective Q1-Q3 target: campaign conversion tracking was incomplete. Q3 establishes a clean baseline; target 30 in Q4. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Organic SEO”, KPI “Organic conversions”.)$note$),
  ('visitorToMql', NULL, NULL, NULL, 0.005, NULL, false, $note$REVISED / RESET — Tracking discontinuity makes Q1/Q2 unsuitable for trend-setting. Q3 establishes the baseline; 0.5% or better from Q4. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Organic SEO”, KPI “Visitor to MQL conversion”.)$note$),
  ('registrations', 125, 150, 250, 300, 825, false, $note$REVISED — Event volume is inherently lumpy. H2 targets are below the previous placeholders but above the weak Q1 baseline. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Events”, KPI “Registrations / leads”.)$note$),
  ('attendanceRate', 0.45, 0.45, 0.5, 0.55, 0.4875, false, $note$REVISED — Actual attendance improved from c.40-42% to 50% in Q3. Set 50% then 55%, rather than an unsupported 62-70%. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Events”, KPI “Attendance rate”.)$note$),
  ('mqlToSqlEvents', 0.18, 0.2, 0.22, 0.23, 0.2075, false, $note$HOLD / STRETCH — One of the stronger event measures. A low-20s quality target is maintained while volume targets are rebased. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Events”, KPI “MQL to SQL conversion”.)$note$),
  ('outreachProspects', 500, 500, 500, 500, 2000, false, $note$DEFINITION TO CONFIRM — The dashboard shows the same figure each quarter, which suggests a running snapshot. The intended measure is NEW prospects added to cadence per quarter — definition to be confirmed. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Outreach”, KPI “Prospects added to cadence”.)$note$),
  ('outreachOpenRate', 0.45, 0.45, 0.5, 0.5, 0.475, false, $note$REVISED UP — Actual open rate is consistently c.57%. Set at 50% rather than treating 57% as a guaranteed floor. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Outreach”, KPI “Open rate”.)$note$),
  ('outreachReplyRate', 0.05, 0.05, 0.015, 0.02, 0.0338, false, $note$REVISED DOWN — Current baseline is c.0.8%. Staged improvement to 1.5% in Q3 and 2.0% in Q4. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Outreach”, KPI “Reply rate”.)$note$),
  ('outreachMeetings', 12, 12, 5, 8, 37, false, $note$REVISED DOWN — Actuals are 0-2 meetings per quarter. Reset to a credible improvement trajectory; review at year end for 2027. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section “Outreach”, KPI “Meetings booked”.)$note$)
)
update kpi_targets t
   set q1 = r.q1, q2 = r.q2, q3 = r.q3, q4 = r.q4, fy = r.fy,
       lower_is_better = r.lower_is_better,
       note = r.note,
       updated_at = now(),
       updated_by = 'CWSI FY26 reforecast (Aug 2026)'
  from reforecast r
 where t.kpi_key = r.kpi_key;

-- Every KPI the sheet does NOT cover keeps its BrainD placeholder. Say so on the row,
-- so a client-approved target is never mistaken for one we invented.
update kpi_targets
   set note = 'Not included in the CWSI FY26 reforecast (Aug 2026) — this target is still a BrainD placeholder and needs a client figure.',
       updated_at = now()
 where kpi_key in ('conversionsFromEmail','costPerConversion','costPerLead','engagementRate',
                   'outreachClosedWon','outreachCreatedOpps','outreachPipeline','readerToMql')
   and (q1 is not null or q2 is not null or q3 is not null or q4 is not null or fy is not null);

