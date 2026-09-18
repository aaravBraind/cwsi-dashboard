-- ============================================================================
-- Reconciliation audit — the "zero flaws" gate for the client feedback rounds.
-- Re-based 24 Aug 2026 onto the opportunity-creation-date split and the gross-profit
-- basis; checks 13-15 were added for the 20 Aug round.
-- Run each block against the Supabase warehouse (psql or the SQL editor).
-- Every SELECT returns ok = true when the invariant holds. Run after every
-- re-ingest before sending figures to the client.
-- ============================================================================

-- 1. Regions partition the total: Σ(region rows) = all-regions total,
--    for MQLs, pipeline and closed-won (2026 to date).
WITH t AS (
  SELECT region_id, sum(mql_count) mql, sum(pipeline_value) pipe, sum(closed_won_value) won
  FROM fact_channel_daily WHERE activity_date >= '2026-01-01' AND activity_date <= CURRENT_DATE
  GROUP BY ROLLUP (region_id)
)
SELECT 'regions_sum_to_total' AS check_name,
  (SELECT count(*) FROM t) > 1
  AND (SELECT mql FROM t WHERE region_id IS NULL) = (SELECT sum(mql) FROM t WHERE region_id IS NOT NULL)
  AND (SELECT pipe FROM t WHERE region_id IS NULL) = (SELECT sum(pipe) FROM t WHERE region_id IS NOT NULL)
  AND (SELECT won FROM t WHERE region_id IS NULL) = (SELECT sum(won) FROM t WHERE region_id IS NOT NULL) AS ok;

-- 2. Run this period + ongoing impact = total closed-won (YTD window), on the
--    OPPORTUNITY-CREATION-DATE basis. Re-based 24 Aug 2026 at the client's request
--    ("shouldn't we use the opportunity's creation date… a third bucket seems to be
--    making things unnecessarily complicated"), which retired the campaign-start-date
--    basis AND the undated bucket this check used to assert. Two buckets, no remainder:
--    an opportunity always has a created date, so nothing can fall outside them.
WITH o AS (
  SELECT amount_eur, margin_eur, created_date, close_date
  FROM fact_opportunity
  WHERE is_won AND close_date >= '2026-01-01' AND close_date <= CURRENT_DATE
)
SELECT 'run_plus_ongoing_equals_total' AS check_name,
  abs(sum(amount_eur) - (sum(amount_eur) FILTER (WHERE created_date >= '2026-01-01')
                       + sum(amount_eur) FILTER (WHERE created_date <  '2026-01-01'))) < 0.01
  AND count(*) FILTER (WHERE created_date IS NULL) = 0 AS ok
FROM o;

-- 2b. The same on the gross-profit basis, which is what the panel now displays.
WITH o AS (
  SELECT margin_eur, created_date
  FROM fact_opportunity
  WHERE is_won AND close_date >= '2026-01-01' AND close_date <= CURRENT_DATE
    AND margin_eur IS NOT NULL
)
SELECT 'run_plus_ongoing_equals_total_gross_profit' AS check_name,
  abs(sum(margin_eur) - (sum(margin_eur) FILTER (WHERE created_date >= '2026-01-01')
                       + sum(margin_eur) FILTER (WHERE created_date <  '2026-01-01'))) < 0.01 AS ok
FROM o;

-- 3. Quarters partition YTD: Q1+Q2+Q3 = YTD for every headline metric.
SELECT 'quarters_sum_to_ytd' AS check_name,
  sum(mql_count) = (sum(mql_count) FILTER (WHERE activity_date < '2026-04-01')
                  + sum(mql_count) FILTER (WHERE activity_date >= '2026-04-01' AND activity_date < '2026-07-01')
                  + sum(mql_count) FILTER (WHERE activity_date >= '2026-07-01'))
  AND abs(sum(closed_won_value) - (sum(closed_won_value) FILTER (WHERE activity_date < '2026-04-01')
                  + sum(closed_won_value) FILTER (WHERE activity_date >= '2026-04-01' AND activity_date < '2026-07-01')
                  + sum(closed_won_value) FILTER (WHERE activity_date >= '2026-07-01'))) < 0.01 AS ok
FROM fact_channel_daily WHERE activity_date >= '2026-01-01' AND activity_date <= CURRENT_DATE;

-- 4. Created opportunities = still open + closed (won + lost), per fact_opportunity.
SELECT 'created_equals_open_plus_closed' AS check_name,
  count(*) = count(*) FILTER (WHERE NOT is_closed) + count(*) FILTER (WHERE is_closed) AS ok,
  count(*) AS created, count(*) FILTER (WHERE NOT is_closed) AS open,
  count(*) FILTER (WHERE is_closed AND is_won) AS closed_won,
  count(*) FILTER (WHERE is_closed AND NOT is_won) AS closed_lost
FROM fact_opportunity WHERE created_date >= '2026-01-01';

-- 5. Gross profit never exceeds its revenue basis (row level). Scoped to rows with
--    POSITIVE revenue: on a correction/refund row (negative revenue) the inequality
--    legitimately inverts — the one such row in the store is a 2023 refund (-€1,029
--    revenue, -€226 GP), outside the reporting window.
SELECT 'gross_profit_lte_revenue' AS check_name,
  count(*) FILTER (WHERE closed_won_value > 0 AND margin_value > closed_won_value + 0.01) = 0
  AND count(*) FILTER (WHERE pipeline_value > 0 AND pipeline_margin_value > pipeline_value + 0.01) = 0 AS ok
FROM fact_channel_daily;

-- 6. Email-platform rates can never exceed 100% (unique counters ≤ delivered).
SELECT 'email_rates_lte_100' AS check_name,
  count(*) FILTER (WHERE unique_opens > delivered OR unique_clicks > delivered OR opt_outs > delivered) = 0 AS ok
FROM fact_ae_email
WHERE snapshot_date = (SELECT max(snapshot_date) FROM fact_ae_email);

-- 7. Outreach attribution only counts CONTACTED prospects (view-level rule): every
--    attribution row must have a contacted-prospect witness — a prospect in that
--    sequence, on that opp's contacts, whose state is not pending/failed/bounced.
--    (An opp can ALSO have other contacts still queued in the sequence; that doesn't
--    invalidate the attribution, so the check looks for a witness, not for absence.)
SELECT 'outreach_contacted_only' AS check_name,
  (SELECT count(*) FROM v_outreach_attributed_opps o
    WHERE NOT EXISTS (
      SELECT 1 FROM fact_outreach_prospect p
      JOIN fact_opportunity_contact oc ON oc.opp_id = o.opp_id AND lower(oc.contact_email) = lower(p.email)
      WHERE p.sequence_id = o.sequence_id AND p.state NOT IN ('pending','failed','bounced')
    )) = 0 AS ok;

-- 8. The 11 curated campaign rows + the 4 email families resolve to live SF campaigns.
--    (Keys mirrored from src/data/pinnedCampaigns.js — update BOTH if the client renames.)
WITH pinned(k) AS (VALUES
 ('701Si00000Tyxu9IAB'),('701Si00000S2Zj7IAF'),('701Tm00000ZPAxlIAH'),('701Si00000TlRLrIAN'),
 ('701Tm00000ZP4cEIAT'),('701Si00000V3LvjIAF'),('701Si00000UOSYCIA5'),('701Tm00000Z6i5SIAR'),
 ('701Tm00000ZXsNFIA1'),('701Tm00000a9FhTIAU'),('701Tm00000chbPpIAI'),('701Si00000VBdQoIAL'),
 ('701Tm00000ZWYCBIA5'),('701Tm00000c9ygeIAA'),('701Tm00000az9RSIAY'),('701Tm00000ZUJUEIA5'),
 ('701Tm00000cHsHgIAK'),('701Tm00000ZKcd1IAD'),('701Tm00000ZKsmVIAT'))
SELECT 'pinned_keys_all_exist' AS check_name,
  count(*) = (SELECT count(*) FROM pinned) AS ok
FROM pinned JOIN dim_campaign c ON c.campaign_key = pinned.k AND c.is_current;

-- 9. Campaign date integrity stays healed: no comma-corrupted source_system,
--    no dd.mm.yyyy-named campaign disagreeing with its start_date.
SELECT 'campaign_dates_healed' AS check_name,
  count(*) FILTER (WHERE source_system NOT IN ('salesforce','linkedin')) = 0
  AND count(*) FILTER (WHERE campaign_name ~ '^\d{1,2}\.\d{1,2}\.\d{4}([^0-9]|$)'
        AND substring(campaign_name from '^\d{1,2}\.\d{1,2}\.(\d{4})')::int BETWEEN 2015 AND 2035
        AND start_date IS DISTINCT FROM to_date(substring(campaign_name from '^\d{1,2}\.\d{1,2}\.\d{4}'), 'DD.MM.YYYY')) = 0 AS ok
FROM dim_campaign WHERE is_current;

-- 10. Margot's Dublin spot-check: the two named deals sit on the 10.06.2026
--     "Microsoft E7: Governing AI Agents at Scale" campaign, dated 2026-06-10,
--     worth €55,775 together — so they bucket as "run this period" for Q2/YTD.
SELECT 'dublin_deals_run_this_period' AS check_name,
  count(*) = 2
  AND min(c.start_date) = '2026-06-10'
  AND abs(sum(o.amount_eur) - 55775) < 1 AS ok
FROM fact_opportunity o JOIN dim_campaign c ON c.campaign_key = o.campaign_key AND c.is_current
WHERE o.opp_id IN ('006Tm00000R3sfRIAR','006Tm00000SznV7IAJ') AND o.is_won;

-- 11. Henley Regatta exists and is dated (2026-07-02), so the Events page lists it.
SELECT 'henley_listed' AS check_name,
  count(*) = 1 AND min(start_date) = '2026-07-02' AS ok
FROM dim_campaign WHERE is_current AND campaign_key = '701Tm00000ZEKKaIAP';

-- ─────────────────────────────────────────────────────────────────────────
-- CHECK 12 (24 Aug) — does the cwsisecurity.com DOMAIN property already include
-- insights.cwsisecurity.com, or are the two properties disjoint?
--
-- This decides whether the two may ever be summed. A sc-domain: property is documented to
-- cover all subdomains, but that has NOT been confirmed against this account: as of 24 Aug
-- fact_seo_page_daily held 123,758 rows on a single host (cwsisecurity.com) and no
-- insights. pages at all — explained equally well by insights having almost nothing indexed
-- before the 1 Aug data cutoff. Run once both properties have overlapping days.
--
-- Equal-ish clicks   -> the domain property DOES include insights; keep reads scoped to one
--                       property (current behaviour) and never sum.
-- Insights-only rows -> the properties are disjoint; the domain property is NOT the whole
--                       picture and the reads must sum the two instead.
with overlap as (
  select greatest(
           (select min(activity_date) from fact_seo_page_daily where site_url = 'https://insights.cwsisecurity.com/'),
           (select min(activity_date) from fact_seo_page_daily where site_url = 'sc-domain:cwsisecurity.com')
         ) as from_date,
         least(
           (select max(activity_date) from fact_seo_page_daily where site_url = 'https://insights.cwsisecurity.com/'),
           (select max(activity_date) from fact_seo_page_daily where site_url = 'sc-domain:cwsisecurity.com')
         ) as to_date
)
select
  (select from_date from overlap)                                            as overlap_from,
  (select to_date   from overlap)                                            as overlap_to,
  coalesce(sum(clicks) filter (
    where site_url = 'sc-domain:cwsisecurity.com'
      and page ilike '%//insights.cwsisecurity.com%'), 0)                    as insights_clicks_inside_domain_property,
  coalesce(sum(clicks) filter (
    where site_url = 'https://insights.cwsisecurity.com/'), 0)               as insights_clicks_own_property
from fact_seo_page_daily, overlap
where activity_date between overlap.from_date and overlap.to_date;

-- ─────────────────────────────────────────────────────────────────────────
-- 13. The unmapped bucket is EXACTLY the four campaigns shown to the client
--     (20 Aug round). Excluding them moves the Overview headline, so a fifth
--     campaign appearing here must be ruled on before it is silently dropped.
--     The bucket is defined at the READ layer (displayChannel in queries.js coalesces a
--     channel-less row into 'Other / Unmapped'), so it must be checked on the fact view,
--     not on fact_opportunity — and only campaigns that actually CONTRIBUTE count, which
--     is the same filter unmappedBreakdown() applies on screen.
WITH un AS (
  SELECT coalesce(campaign_name, campaign_key) AS campaign,
         sum(mql_count) mql, sum(pipeline_value) pipe, sum(closed_won_value) won
  FROM v_fact_enriched
  WHERE activity_date >= '2026-01-01' AND activity_date <= CURRENT_DATE
    AND channel_name = 'Other / Unmapped'
  GROUP BY 1
  HAVING sum(mql_count) > 0 OR sum(pipeline_value) > 0 OR sum(closed_won_value) > 0
)
SELECT 'unmapped_bucket_is_the_four_known_campaigns' AS check_name,
  count(*) <= 4 AS ok,
  count(*) AS campaigns_excluded,
  sum(won) AS closed_won_excluded_eur,
  sum(pipe) AS open_pipeline_excluded_eur,
  string_agg(campaign, ' | ' ORDER BY won DESC) AS campaigns
FROM un;

-- 14. Outreach commercial figures rest on the DEDICATED Salesforce campaigns, not on
--     contact matching (client instruction, 20 Aug: "the opportunities should be linked
--     to those campaigns… I'd use that as the basis for now"). Publishing a figure above
--     the campaign-linked count would be back on the rejected basis.
SELECT 'outreach_opps_are_campaign_linked' AS check_name,
  count(*) AS campaign_linked_opps,
  coalesce(sum(amount_eur) FILTER (WHERE NOT is_closed), 0) AS open_pipeline_eur,
  coalesce(sum(amount_eur) FILTER (WHERE is_won), 0) AS closed_won_eur
FROM fact_opportunity
WHERE created_date >= '2026-01-01' AND campaign_name ILIKE '%Outreach%';

-- 15. Gross profit is present at OPPORTUNITY grain — the whole basis for showing gross
--     margin per deal, per campaign and per event. A gap here silently understates every
--     money figure on the dashboard, because deals with no gross profit are excluded
--     rather than counted at full deal value.
SELECT 'opportunity_gross_profit_coverage' AS check_name,
  count(*) AS opportunities,
  count(margin_eur) AS with_gross_profit,
  count(*) - count(margin_eur) AS missing,
  count(*) FILTER (WHERE opp_name IS NULL) = 0 AS every_deal_named
FROM fact_opportunity
WHERE created_date >= '2026-01-01';
