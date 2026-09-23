-- Pardot / Account Engagement — real email-engagement store (replaces the stale
-- fact_email_engagement, which holds 2 rows from 2022 and no unsubscribes/bounces).
--
-- ✅ APPLIED 2026-08-07 (as migration `pardot_ae_email_engagement`). Verified after apply:
-- 20 columns, RLS on, ZERO anon privileges on both table and view, authenticated SELECT on both,
-- and all six rate expressions reproduce AE's own published percentages to 2dp.
-- Column set CONFIRMED against the live API on 2026-08-06:
-- the counters come from the Account Engagement **v4** `email/version/4/do/stats/id/{id}`
-- endpoint (v5 has no stats equivalent — `list-email-stats` 404s and the v5 email object
-- carries no counters at all; both were probed). Verified response on email 84390732:
--   sent 863 · delivered 538 · hard_bounced 305 · soft_bounced 20
--   opens 161 / unique_opens 119 · total_clicks 4 / unique_clicks 3
--   opt_outs 20 · spam_complaints 0
-- Internally consistent: delivered + soft_bounced + hard_bounced == sent (538+20+305 = 863).
--
-- Grain: one row per Account-Engagement email per daily snapshot (AE stats are
-- lifetime counters, so we snapshot). campaign_key/region_id are nullable — the
-- Pardot→Salesforce-campaign link is resolved later (an AE email may map to an SF
-- campaign; until confirmed we ingest engagement standalone and join opportunistically).

CREATE TABLE IF NOT EXISTS public.fact_ae_email (
  ae_email_id      text        NOT NULL,           -- AE email object id
  email_name       text,
  sent_at          timestamptz,
  is_list_email    boolean,                         -- list email (batch) vs 1:1
  snapshot_date    date        NOT NULL,            -- daily snapshot of the lifetime counters
  region_id        integer     REFERENCES public.dim_region(region_id),  -- nullable, parsed from the email name
  campaign_key     text,                            -- nullable SF campaign, resolved via ae_campaign_id
  -- AE's OWN campaign id (a Pardot id, e.g. 28237 — NOT a Salesforce 18-char id). Always stored,
  -- even when it resolves to no Salesforce campaign, so the link can be re-derived later without
  -- re-ingesting from the API. Bridge: dim_campaign.pardot_campaign_id (migration 20260807000000).
  ae_campaign_id   text,
  -- Operational (transactional) emails bypass opt-out and are not marketing sends. Confirmed
  -- present on the AE object as `operationalEmail`/`isOperational`. Stored rather than filtered at
  -- ingest so the Email page can exclude them while the raw feed stays complete and auditable.
  is_operational   boolean,
  -- ---- engagement counters, from the v4 do/stats response (field names confirmed) ----
  sent             bigint      NOT NULL DEFAULT 0,
  delivered        bigint      NOT NULL DEFAULT 0,
  hard_bounces     bigint      NOT NULL DEFAULT 0,
  soft_bounces     bigint      NOT NULL DEFAULT 0,
  unique_opens     bigint      NOT NULL DEFAULT 0,
  total_opens      bigint      NOT NULL DEFAULT 0,
  unique_clicks    bigint      NOT NULL DEFAULT 0,
  total_clicks     bigint      NOT NULL DEFAULT 0,
  spam_complaints  bigint      NOT NULL DEFAULT 0,
  -- AE reports ONE opt-out counter, which IS the unsubscribe count. The draft had a
  -- separate `unsubscribes` column; it was removed rather than fed the same number twice,
  -- because two columns holding one measurement is how a metric gets double-reported.
  opt_outs         bigint      NOT NULL DEFAULT 0,
  loaded_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ae_email_id, snapshot_date)
);

-- Auth model (mirrors every other fact table): reads run as the signed-in
-- `authenticated` user only; `anon` has NO access; n8n writes via its privileged
-- Postgres service connection (owner), so no INSERT policy for authenticated is needed.
ALTER TABLE public.fact_ae_email ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fact_ae_email_auth_read ON public.fact_ae_email;
CREATE POLICY fact_ae_email_auth_read ON public.fact_ae_email
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.fact_ae_email FROM anon;                 -- Supabase auto-grants anon on new tables → revoke
GRANT SELECT ON public.fact_ae_email TO authenticated;

-- Read view: adds region_code + the engagement rates.
-- Every denominator below was REVERSE-ENGINEERED FROM AE'S OWN COMPUTED RATES on email
-- 84390732 and matches to the second decimal, so our figures will tie to what CWSI sees in
-- the Account Engagement UI rather than quietly disagreeing with it:
--   delivery_rate     62.34% = delivered / sent
--   open_rate         22.12% = UNIQUE_opens / delivered   (NOT raw opens, which gives 29.93%)
--   ctr                0.74% = total_clicks / delivered    (AE's headline "click_through_rate")
--   unique_ctr         0.56% = unique_clicks / delivered
--   unsubscribe_rate   3.72% = opt_outs / delivered        (the draft divided by sent — wrong)
--   click_to_open      2.52% = unique_clicks / unique_opens
-- hard_bounce_rate is ours, not AE's, and it is not decoration: this email hard-bounced
-- 305 of 863 (35.3%), so a page showing only opens would hide a serious list-quality problem.
-- campaign_name now joins through: AE gives us a Pardot campaign id, the Salesforce ingestion
-- brings the same id onto dim_campaign, and the ingestion resolves it to campaign_key on write.
CREATE OR REPLACE VIEW public.v_ae_email AS
SELECT
  e.ae_email_id, e.email_name, e.sent_at, e.is_list_email, e.snapshot_date,
  e.region_id, r.region_code, e.campaign_key, e.ae_campaign_id, e.is_operational,
  c.campaign_name,
  e.sent, e.delivered, e.hard_bounces, e.soft_bounces,
  e.unique_opens, e.total_opens, e.unique_clicks, e.total_clicks,
  e.spam_complaints, e.opt_outs,
  CASE WHEN e.sent > 0
       THEN round(e.delivered::numeric      / e.sent, 4) END AS delivery_rate,
  CASE WHEN e.sent > 0
       THEN round(e.hard_bounces::numeric   / e.sent, 4) END AS hard_bounce_rate,
  CASE WHEN e.delivered > 0
       THEN round(e.unique_opens::numeric   / e.delivered, 4) END AS open_rate,
  CASE WHEN e.delivered > 0
       THEN round(e.total_clicks::numeric   / e.delivered, 4) END AS ctr,
  CASE WHEN e.delivered > 0
       THEN round(e.unique_clicks::numeric  / e.delivered, 4) END AS unique_ctr,
  CASE WHEN e.delivered > 0
       THEN round(e.opt_outs::numeric       / e.delivered, 4) END AS unsubscribe_rate,
  CASE WHEN e.unique_opens > 0
       THEN round(e.unique_clicks::numeric  / e.unique_opens, 4) END AS click_to_open_rate
FROM public.fact_ae_email e
LEFT JOIN public.dim_region r ON r.region_id = e.region_id
-- dim_campaign is SCD2 → always pin to the current record, or one email fans out across versions.
LEFT JOIN public.dim_campaign c ON c.campaign_key = e.campaign_key AND c.is_current;

REVOKE ALL ON public.v_ae_email FROM anon;
GRANT SELECT ON public.v_ae_email TO authenticated;
