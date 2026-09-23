-- Channel + campaign-type corrections (Margot, 23 Sep 2026). Salesforce Campaign.Type put
-- these campaigns in the wrong reporting channel; the override is applied in the views
-- (see 20260923000000_campaign_exclusions.sql) so it holds through re-ingests.
--
-- campaign_overrides.campaign_type already existed but nothing read it; it now overrides
-- the Salesforce type in v_fact_enriched and v_campaign_current (the Events page splits
-- webinars / owned / earned events on that type).

create or replace view public.v_fact_enriched with (security_invoker = true) as
select f.fact_id, f.campaign_key, c.campaign_name, r.region_code, r.region_name,
    coalesce(o.channel_override, ch.channel_name) as channel_name,
    p.pillar_name, f.activity_date,
    (extract(year from f.activity_date))::integer as year,
    (extract(quarter from f.activity_date))::integer as quarter,
    f.source, f.spend, f.impressions, f.leads, f.mql_count, f.sql_count, f.pipeline_value,
    f.closed_won_value, f.loaded_at, f.clicks, f.margin_value, f.opp_count, f.closed_won_count,
    coalesce(o.campaign_type, c.campaign_type) as campaign_type,
    f.created_opp_count, c.start_date as campaign_start_date, f.created_opp_value,
    c.audience_size, c.number_sent, f.pipeline_margin_value, f.pipeline_margin_known_count,
    f.pipeline_margin_pending_count, f.created_opp_margin_value, f.created_opp_margin_known_count
from fact_channel_daily f
  left join dim_campaign c on c.campaign_key = f.campaign_key and c.is_current
  left join dim_region r on r.region_id = f.region_id
  left join dim_channel ch on ch.channel_id = f.channel_id
  left join dim_practice_pillar p on p.pillar_id = f.pillar_id
  left join campaign_overrides o on o.campaign_key = f.campaign_key
where not coalesce(o.excluded, false);

create or replace view public.v_campaign_current with (security_invoker = true) as
select c.campaign_id, c.campaign_key, c.channel_id, c.campaign_name, c.source_system,
    c.spend_rate, c.valid_from, c.valid_to, c.is_current, c.created_at,
    coalesce(o.campaign_type, c.campaign_type) as campaign_type, c.start_date
from dim_campaign c
  left join campaign_overrides o on o.campaign_key = c.campaign_key
where c.is_current and not coalesce(o.excluded, false);

insert into public.campaign_overrides (campaign_key, channel_override, campaign_type, excluded, exclude_reason, updated_at, updated_by)
values
  -- "Outreach" (she tagged Secure Data / Operations / AI; Endpoints + Identity are the same family)
  ('701Tm00000ZuGAoIAN', 'Outreach', null, false, null, now(), 'margot-23sep'),
  ('701Tm00000Zu7IpIAJ', 'Outreach', null, false, null, now(), 'margot-23sep'),
  ('701Tm00000ZtwNPIAZ', 'Outreach', null, false, null, now(), 'margot-23sep'),
  ('701Tm00000ZtzZpIAJ', 'Outreach', null, false, null, now(), 'margot-23sep'),
  ('701Tm00000ZuFHzIAN', 'Outreach', null, false, null, now(), 'margot-23sep'),
  -- BLAUD SoPro Intune Health Check: "Email" (replaces our 14 Jul Other/Unmapped routing)
  ('7013z000002JR0IAAW', 'Email', null, false, null, now(), 'margot-23sep'),
  -- Legal Always-On Vertical: "This is a LinkedIn Paid ads campaign"
  ('701Tm00000drvHsIAI', 'LinkedIn Paid', null, false, null, now(), 'margot-23sep'),
  -- Cybersec Europe: "Earned Event" (Salesforce has it as OwnedEvent)
  ('701Tm00000aY2h5IAC', null, 'EarnedEvent', false, null, now(), 'margot-23sep'),
  -- the empty second Cybersec Europe campaign would list as a zero row on the Events page
  ('701Si00000VoBuTIAV', null, null, true, 'Duplicate, empty Cybersec Europe campaign (the 20.05 & 21.05 one carries the data)', now(), 'margot-23sep')
on conflict (campaign_key) do update
  set channel_override = coalesce(excluded.channel_override, campaign_overrides.channel_override),
      campaign_type = coalesce(excluded.campaign_type, campaign_overrides.campaign_type),
      excluded = excluded.excluded or campaign_overrides.excluded,
      exclude_reason = coalesce(excluded.exclude_reason, campaign_overrides.exclude_reason),
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;
