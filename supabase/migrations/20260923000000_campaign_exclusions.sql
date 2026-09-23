-- Campaign exclusions + channel overrides (Margot, 23 Sep 2026 — comments on the Full
-- Composition Report). She marked a set of Salesforce campaigns as "not a marketing
-- campaign" / "delete from the overview". They must drop out of EVERY figure, table and
-- export, and stay out through re-ingests, so the flag lives on campaign_overrides (which
-- the ingest never touches) and is applied inside the views the app reads.
--
--   excluded         true = the campaign contributes nothing anywhere in the dashboard
--   exclude_reason   why, in the client's words (shown in the audit trail, not on screen)
--   channel_override the marketing channel to report the campaign under, when the
--                    Salesforce Campaign.Type puts it in the wrong one (e.g. an Outreach
--                    workflow typed "Email"). NULL = keep the ingested channel.

alter table public.campaign_overrides
  add column if not exists excluded boolean not null default false,
  add column if not exists exclude_reason text,
  add column if not exists channel_override text;

-- ---- v_fact_enriched: drop excluded campaigns, apply the channel override ----------
create or replace view public.v_fact_enriched with (security_invoker = true) as
select f.fact_id,
    f.campaign_key,
    c.campaign_name,
    r.region_code,
    r.region_name,
    coalesce(o.channel_override, ch.channel_name) as channel_name,
    p.pillar_name,
    f.activity_date,
    (extract(year from f.activity_date))::integer as year,
    (extract(quarter from f.activity_date))::integer as quarter,
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
    f.margin_value,
    f.opp_count,
    f.closed_won_count,
    c.campaign_type,
    f.created_opp_count,
    c.start_date as campaign_start_date,
    f.created_opp_value,
    c.audience_size,
    c.number_sent,
    f.pipeline_margin_value,
    f.pipeline_margin_known_count,
    f.pipeline_margin_pending_count,
    f.created_opp_margin_value,
    f.created_opp_margin_known_count
from fact_channel_daily f
  left join dim_campaign c on c.campaign_key = f.campaign_key and c.is_current
  left join dim_region r on r.region_id = f.region_id
  left join dim_channel ch on ch.channel_id = f.channel_id
  left join dim_practice_pillar p on p.pillar_id = f.pillar_id
  left join campaign_overrides o on o.campaign_key = f.campaign_key
where not coalesce(o.excluded, false);

-- ---- v_campaign_current: excluded campaigns are not offered anywhere ----------------
create or replace view public.v_campaign_current with (security_invoker = true) as
select c.campaign_id, c.campaign_key, c.channel_id, c.campaign_name, c.source_system,
    c.spend_rate, c.valid_from, c.valid_to, c.is_current, c.created_at, c.campaign_type,
    c.start_date
from dim_campaign c
  left join campaign_overrides o on o.campaign_key = c.campaign_key
where c.is_current and not coalesce(o.excluded, false);

-- ---- v_opportunity: the deal list the app reads (was fact_opportunity directly) -----
create or replace view public.v_opportunity with (security_invoker = true) as
select op.opp_id, op.campaign_key,
    coalesce(o.channel_override, op.channel_name) as channel_name,
    op.campaign_type, op.region_code, op.created_date, op.close_date, op.is_won,
    op.is_closed, op.stage_name, op.amount_eur, op.loaded_at, op.opp_name,
    op.account_name, op.campaign_name, op.margin_eur, op.account_id
from fact_opportunity op
  left join campaign_overrides o on o.campaign_key = op.campaign_key
where not coalesce(o.excluded, false);

-- ---- v_opportunity_cycle: same rule for the sales-cycle figures ---------------------
create or replace view public.v_opportunity_cycle with (security_invoker = true) as
select op.opp_id,
    op.campaign_key,
    coalesce(o.channel_override, op.channel_name) as channel_name,
    op.campaign_type,
    op.region_code,
    op.created_date,
    op.close_date,
    op.is_won,
    op.is_closed,
    op.stage_name,
    op.amount_eur,
    m.mql_date,
    op.opp_name,
    op.account_name,
    op.campaign_name,
    op.margin_eur
from fact_opportunity op
  left join (
    select oc.opp_id, min(cr.first_response_date) as mql_date
    from fact_opportunity_contact oc
      join fact_contact_response cr on cr.contact_email = oc.contact_email
    where cr.first_response_date is not null
    group by oc.opp_id
  ) m on m.opp_id = op.opp_id
  left join campaign_overrides o on o.campaign_key = op.campaign_key
where not coalesce(o.excluded, false);

-- Readable by signed-in users only (anon stays revoked — see 20260921 lock-down).
revoke all on public.v_opportunity from anon, public;
grant select on public.v_opportunity to authenticated;

-- ---- The exclusions Margot asked for (23 Sep) ---------------------------------------
insert into public.campaign_overrides (campaign_key, excluded, exclude_reason, updated_at, updated_by)
values
  ('7013z000001k5JLAAY', true, 'Hubspot Imports: a data import, not a campaign ("delete from the overview")', now(), 'margot-23sep'),
  ('7013z000001jwFRAAY', true, 'Salesforce Connector: not a campaign ("delete from the overview")', now(), 'margot-23sep'),
  ('701Tm00000Ys5C2IAJ', true, 'SME&C Co Sell Campaign: "not a marketing campaign"', now(), 'margot-23sep'),
  ('701Si00000QHUlvIAH', true, 'FY26 UKI Major Growth MAL: "not a marketing campaign"', now(), 'margot-23sep'),
  ('701Si00000SFGUAIA5', true, 'CW Accounts AI Leads: "not a marketing campaign"', now(), 'margot-23sep'),
  ('701Tm00000bNqQWIA0', true, 'Jim Outreach Sequences NL Construction & Engineering: "not a marketing campaign"', now(), 'margot-23sep'),
  ('701Tm00000ds9RPIAY', true, 'Jim Outreach Sequences NL Hospitals: same kind as the Construction one she excluded', now(), 'margot-23sep'),
  ('701Tm00000fxYAyIAM', true, 'Q3 Legal Always-On Outreach Campaign: "should be excluded" (555 members bulk-flagged responded on 24 Aug)', now(), 'margot-23sep'),
  ('701Si00000CTbTaIAL', true, '2025 CWSI Website Leads: 2026 website leads belong in the 2026 campaign', now(), 'margot-23sep'),
  ('701Si00000DtsYMIAZ', true, '2025 mobco website leads: 2026 website leads belong in the 2026 campaign', now(), 'margot-23sep'),
  ('701Si0000045wCLIAY', true, '2024 NIS2 Nurture Items: "not sure what this relates to, remove"', now(), 'margot-23sep'),
  ('701Si000006EnAJIA0', true, '2024 Blaud Website Leads: "delete from the overview"', now(), 'margot-23sep'),
  ('701Si00000VoC5lIAF', true, '19.06.2026 Exclusive CyberSec Dinner: duplicate of the 19.05 Irish Embassy dinner (keep 19.05)', now(), 'margot-23sep'),
  ('701Si00000FaavaIAB', true, '03.06.2025 Movie Premiere: 2025 in-person event, cannot have a 2026 MQL', now(), 'margot-23sep')
on conflict (campaign_key) do update
  set excluded = excluded.excluded,
      exclude_reason = excluded.exclude_reason,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
