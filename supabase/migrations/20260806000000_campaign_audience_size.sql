-- Campaign audience size ("how many people did we actually send this to?").
--
-- Paul, review call: on the email campaigns table — "one thing I can also add here is how
-- many people were actually enrolled in these emails… number of people we sent it to,
-- audience size or whatever."
--
-- We already ingest every CampaignMember (the funnel counts then narrow to HasResponded =
-- true). So audience size is derivable with no new Salesforce field: it is the COUNT of
-- campaign members, responded or not. Salesforce's own Campaign.NumberSent is stored
-- alongside it as a cross-check — it is manually maintained, so it can be blank or stale,
-- and the derived member count is the figure the dashboard reads.
--
-- Campaign-level attributes, so they live on dim_campaign rather than the daily fact table
-- (audience is a property of the campaign, not of a day's activity). Both nullable: they
-- read NULL until the next Salesforce refresh populates them, and the UI shows "—" rather
-- than a misleading zero.

alter table dim_campaign add column if not exists audience_size integer;
alter table dim_campaign add column if not exists number_sent integer;

comment on column dim_campaign.audience_size is
  'People enrolled in the campaign = COUNT of Salesforce CampaignMember rows (responded or not). Derived at ingest; NULL until the next refresh.';
comment on column dim_campaign.number_sent is
  'Salesforce Campaign.NumberSent as entered by the team — a cross-check on audience_size, not the reported figure (manually maintained, often blank).';

-- Re-expose through the read view. CREATE OR REPLACE VIEW only permits APPENDING columns,
-- so the existing list is repeated verbatim and the two new ones go last.
create or replace view v_fact_enriched as
 SELECT f.fact_id,
    f.campaign_key,
    c.campaign_name,
    r.region_code,
    r.region_name,
    ch.channel_name,
    p.pillar_name,
    f.activity_date,
    dd.year,
    dd.quarter,
    f.source,
    f.spend,
    f.impressions,
    f.leads,
    f.mql_count,
    f.sql_count,
    f.pipeline_value,
    f.closed_won_value,
    f.loaded_at,
    f.clicks,
        CASE
            WHEN f.margin_value > f.closed_won_value THEN NULL::numeric
            ELSE f.margin_value
        END AS margin_value,
    f.opp_count,
    f.closed_won_count,
    c.campaign_type,
    f.created_opp_count,
    c.start_date AS campaign_start_date,
    f.created_opp_value,
    c.audience_size,
    c.number_sent
   FROM fact_channel_daily f
     JOIN dim_region r ON r.region_id = f.region_id
     JOIN dim_channel ch ON ch.channel_id = f.channel_id
     LEFT JOIN dim_practice_pillar p ON p.pillar_id = f.pillar_id
     JOIN dim_date dd ON dd.date_id = f.activity_date
     LEFT JOIN dim_campaign c ON c.campaign_key = f.campaign_key AND c.is_current;

-- The dashboard reads as `authenticated` (anon was revoked project-wide when auth was added).
-- CREATE OR REPLACE VIEW keeps existing grants, but re-assert them so a future rebuild of
-- this view from the migration alone cannot silently lock the dashboard out — or hand
-- anon access back.
revoke all on v_fact_enriched from anon;
grant select on v_fact_enriched to authenticated;
