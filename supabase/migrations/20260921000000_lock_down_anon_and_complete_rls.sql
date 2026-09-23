-- Security hardening, 21 Sep 2026. Applied in three steps; kept here as one file.
--
-- FINDING. RLS was already enabled on all 44 tables and every policy already targeted
-- `authenticated` only — but RLS was NOT the control protecting the data:
--
--   1. `anon` held ALL privileges (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) on 9 objects.
--   2. Every v_* view was SECURITY DEFINER (the Postgres default), so it ran with the OWNER's
--      rights and BYPASSED RLS on its base tables.
--
-- Together those meant one stray grant was enough to expose data with the publishable key that
-- ships in the browser bundle. Verified live before the fix: as `anon`,
--   select count(*) from v_outreach_engagement  ->  10,420 rows
-- including prospect_email, prospect_company, seller_name and mailbox_email — named contacts'
-- personal data, readable without logging in. The other four anon-granted views happened to be
-- security_invoker already, so RLS blocked them; that was luck, not design.

-- 1. Remove every anon privilege.
REVOKE ALL ON fact_email_engagement, fact_meeting_daily, fact_opportunity_stage, fact_renewal_daily,
              v_email_engagement, v_meetings, v_opportunity_stage_current, v_retention,
              v_outreach_engagement
  FROM anon;

-- 2. Four tables had RLS on but NO policy — which denies the authenticated role too. They were
--    only reachable because the views above them bypassed RLS.
CREATE POLICY authenticated_read ON fact_web_page_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON linkedin_page_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON linkedin_page_post  FOR SELECT TO authenticated USING (true);
CREATE POLICY authenticated_read ON outreach_mailbox    FOR SELECT TO authenticated USING (true);
GRANT SELECT ON fact_web_page_daily, linkedin_page_daily, linkedin_page_post, outreach_mailbox
  TO authenticated;

-- 3. Make RLS actually apply through the read path: every view becomes security_invoker, so the
--    querying role's own policies are enforced and a stray grant can no longer bypass them.
--    Verified first inside a rolled-back transaction: all 33 objects the dashboard reads plus
--    all 3 RPCs passed as `authenticated` with the flip in place.
do $$
declare v record;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'v'
             and coalesce((select option_value from pg_options_to_table(c.reloptions)
                           where option_name = 'security_invoker'), 'false') = 'false'
  loop execute format('alter view public.%I set (security_invoker = true)', v.relname); end loop;
end $$;

-- 4. Functions. Postgres grants EXECUTE to PUBLIC by default, so `REVOKE ... FROM anon` is a
--    NO-OP — anon inherits it through PUBLIC. This is why the first revoke looked successful
--    while the privilege was still live. Revoke from PUBLIC, and stop new functions inheriting it.
REVOKE EXECUTE ON FUNCTION public.get_outreach_meetings_rule(integer, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_seo_top_pages(integer, integer, integer, integer)   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_seo_top_queries(integer, integer, integer, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.touch_kpi_targets_updated_at()                          FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;
GRANT EXECUTE ON FUNCTION public.get_outreach_meetings_rule(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seo_top_pages(integer, integer, integer, integer)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seo_top_queries(integer, integer, integer, integer) TO authenticated;

-- 5. Advisor: pin the trigger function's search_path.
ALTER FUNCTION public.touch_kpi_targets_updated_at() SET search_path = public, pg_temp;
