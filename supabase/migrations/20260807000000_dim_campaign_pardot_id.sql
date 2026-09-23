-- dim_campaign.pardot_campaign_id — the bridge between Account Engagement and Salesforce.
-- ✅ APPLIED 2026-08-07 (as migration `dim_campaign_pardot_id`); column + partial index verified.
--    Reads NULL on all 514 campaigns until the next Salesforce ingestion run.
--
-- Why this is needed: an Account Engagement email carries `campaignId`, but that is a **Pardot**
-- campaign id (5-digit, e.g. 28237 on "Save The Date: Connectivity Tour 2023"), NOT a Salesforce
-- 18-character campaign id. Confirmed against the live AE API 2026-08-07. Without this column the
-- AE engagement feed (`fact_ae_email`) can report per-email opens/clicks but cannot be grouped by
-- Salesforce campaign — which is how the Email page, and every other campaign view, is organised.
--
-- Salesforce already maintains the counterpart: `Campaign.pi__Pardot_Campaign_Id__c`, a Text(10)
-- External ID installed by the Account Engagement connector. Stored as text to match, rather than
-- coerced to a number, so a leading zero or a non-numeric id can never be silently mangled.
--
-- Populated by `workflows/salesforce_ingestion.json` (SF: Get Campaigns → Map Campaigns to
-- dim_campaign → Upsert dim_campaign). Reads NULL until the next Salesforce ingestion run — the
-- same run already pending for `audience_size`.
--
-- NOTE: coverage is unverified. The field exists on the Campaign object, but how many campaigns
-- actually carry a value is unknown until the run. Any AE email whose campaign has no match will
-- load with `campaign_key = NULL` and stay visible per-email — never dropped, never guessed at by
-- name-matching (the fragile route we deliberately avoided here).

ALTER TABLE public.dim_campaign
  ADD COLUMN IF NOT EXISTS pardot_campaign_id text;

-- The join direction is AE → SF (given a Pardot id, find the Salesforce campaign), and dim_campaign
-- is SCD2, so the lookup is always filtered to the current record.
CREATE INDEX IF NOT EXISTS idx_dim_campaign_pardot_id
  ON public.dim_campaign (pardot_campaign_id)
  WHERE is_current AND pardot_campaign_id IS NOT NULL;

COMMENT ON COLUMN public.dim_campaign.pardot_campaign_id IS
  'Account Engagement (Pardot) campaign id from Campaign.pi__Pardot_Campaign_Id__c. Joins AE email engagement (fact_ae_email.ae_campaign_id) to this Salesforce campaign. Text, not numeric, to match the SF External ID field exactly.';
