# CWSI Dashboard — n8n Ingestion Workflows → Data Mapping

**Purpose:** one row of truth per ingestion workflow — what it pulls, how it transforms, which Supabase table it writes, the grain, the schedule, and its known caveats. Files live in `dashboard/workflows/`.

**Last verified:** 2026-06-15 against the live `supabase-cwsi` store and the workflow JSON on disk.

> ⚠️ **n8n runs its own stored copy of each workflow, not these files.** Editing a file here changes nothing until it is **re-imported into n8n**. Always confirm the node code in n8n matches the file before relying on a run. (This bit us on the Salesforce channel fix — see `DEPENDENCIES.md`.)

---

## Summary table

| Workflow file | Source | Auth | Trigger | Writes to | Grain | Status |
|---|---|---|---|---|---|---|
| `salesforce_ingestion.json` | Salesforce (Campaigns, Opportunities, Leads, CampaignMembers) | SF REST (OAuth) | Hourly | `dim_campaign`, `fact_channel_daily` | campaign × region × date | ✅ live |
| `GA4_ingest.json` | GA4 Data API (`runReport`) | Google OAuth2 (aarav@braind.io) | Daily 05:00 | `fact_web_daily` | date × region × hostname | ✅ live |
| `search_console_ingest.json` | Search Console API | Google OAuth2 (webmasters.readonly) | Daily 05:15 | `fact_seo_daily`, `fact_seo_page_daily` | date × region / date × page | ✅ live |
| `linkedin_manual_ingestion.json` | LinkedIn creative/ad export CSV (Fluoro) | Google Drive drop-folder | Drive watch | `dim_campaign`, `fact_channel_daily` | campaign (lifetime snapshot), GBP | ✅ live (manual) |
| `budget_tracker_live_sync_workflow.json` | "Spend Tracker" Excel (Margot) | Microsoft Excel (Graph) | Daily 07:00 | `fact_marketing_spend` | budget line (EUR) | ✅ live |
| `outreach_ingestion.json` | Outreach.io `/sequences` | Outreach API (OAuth2) | Daily 06:00 | `fact_outreach_sequence_daily` | sequence (snapshot) | ✅ live |
| `outreach_list_sequences.json` | Outreach.io `/sequences` | Outreach API | Manual | file export only | sequence | 🔧 helper/export |
| `outreach_list_sequence_steps.json` | Outreach.io `/sequenceSteps` | Outreach API | Manual | file export only | step | 🔧 helper/export |
| `outreach_sequence_steps_ingestion.json` | Outreach.io `/sequenceSteps` | Outreach API | Daily | `fact_outreach_step_daily` | step | ✅ live (added 2026-06-15) |
| `gotowebinar_ingest.json` | GoToWebinar API v2 (webinars + attendees) | GoTo OAuth2 | Daily 05:30 | `fact_event_daily` | webinar × date (reg + attended) | 🟡 built 15 Jun; pending OAuth client + run |
| `google_ads_ingest.json` | Google Ads export CSV | Google Drive drop-folder | Drive watch | `dim_campaign`, `fact_channel_daily` | campaign × date | ⚪ built, **never run** — no Google Ads campaigns exist |

All workflows also write a row to `data_quality_log` (source, run_date, rows_in, rows_written, issues, issue_pct).

---

## 1. `salesforce_ingestion.json` — funnel + pipeline (system of record)

- **Pulls (SOQL):**
  - `SF: Get Campaigns` — `Id, Name, Type, Status`
  - `SF: Get Opportunities` — `Id, StageName, IsClosed, IsWon, Amount, CloseDate, CreatedDate, CampaignId, Account.BillingCountry WHERE CampaignId != null`
  - `SF: Get Leads` — `Id, Status, CreatedDate, Country, IsConverted, ConvertedContactId`
  - `SF: Get CampaignMembers` — `Id, CampaignId, LeadId, ContactId, Status, CreatedDate`
- **Transforms (`Build Fact Rows`):**
  - **Channel** ← `CHANNEL_BY_TYPE[Campaign.Type]`; unmapped/non-channel types → **`Other / Unmapped`** (never Organic SEO). Paid Search has no SF type. *(Map fixed 15 Jun — see DEPENDENCIES.)*
  - **Region** ← `Account.BillingCountry` (opps) / `Lead.Country` (leads) → UKI / BeLux / NL / UNASSIGNED.
  - **Leads + MQL** ← CampaignMember joined to Lead **by `LeadId` OR `ConvertedContactId`** (the MQL fix — converted leads were being dropped). MQL = lead's current `Status == 'Marketing Qualified Lead'`.
  - **SQL / pipeline / closed-won** ← Opportunities. Every qualified opp (`StageName != 'Unqualified opp'`) = 1 SQL; `IsWon` → closed-won £; open qualified → pipeline £.
  - spend / impressions = 0 (SF carries none; filled by LinkedIn + budget feeds).
- **Writes:** `dim_campaign` (SCD `is_current`), `fact_channel_daily` (upsert on `uq_fact_grain = campaign_key, region_id, activity_date, source`).
- **Caveats:**
  - 🔴 **MQL is a status snapshot, SQL is a cumulative event** → SQL > MQL in the current year. Not a code bug — needs an MQL event-date from SF. See DEPENDENCIES §data-quality.
  - The upsert `DO UPDATE SET` now includes `channel_id` (was frozen). `region_id`/`pillar_id` re-maps still need care (region_id is part of the grain).
  - Region is heavily UNASSIGNED because `Lead.Country` is largely blank/dirty.

## 2. `GA4_ingest.json` — website traffic

- **Pulls:** GA4 `runReport`, dims = date × country × hostname, metrics = sessions, engagedSessions, **keyEvents (= GA4 conversions)**. `lookback_days = 7` (daily); set 490 for a one-time backfill then reset.
- **Region** ← GA4 `countryId` (alpha-2) → UKI/BeLux/NL else UNASSIGNED.
- **Writes:** `fact_web_daily` (date × region × hostname). Read via `v_web_daily` (dev/preview/proxy hosts excluded).
- **Caveats:** 🟡 `key_events = 0` on every row so far (no GA4 conversions configured/landing) → dashboard shows **pending**. Main-domain `cwsisecurity.com` mostly lands UNASSIGNED (no per-country split). Only ~8 days of history ingested so far.

## 3. `search_console_ingest.json` — organic search

- **Pulls:** GSC `searchanalytics/query` paginated (25k rows/page). Property = **URL-prefix `https://cwsisecurity.com/`** (no domain property). Two queries: by-country (→ daily) and by-page (→ pages).
- **Region** ← GSC country → UKI/BeLux/NL/UNASSIGNED.
- **Writes:** `fact_seo_daily` (date × region: clicks, impressions, ctr, avg_position) and `fact_seo_page_daily` (date × page). Read via `v_seo_daily` / `v_seo_pages`.
- **Caveats:** GSC retains ~16 months; 2024 not retrievable. Data lags ~2 days. **No query/keyword table** — only page + daily aggregates (vision's "keyword performance" is not yet sourced). **Backfill run 2026-06-15 → data from 2025-04-15** (`fact_seo_daily` 1,700 rows · `fact_seo_page_daily` 110,941 rows).

## 4. `linkedin_manual_ingestion.json` — LinkedIn delivery (GBP)

- **Trigger:** Google Drive drop-folder watch; `If Is LinkedIn export?` gate → download → parse/validate CSV.
- **Writes:** `dim_campaign` (channel 2) + `fact_channel_daily` rows tagged `source='linkedin'`. **Cumulative lifetime snapshot on a single `activity_date`** (GBP spend/impr/clicks/leads).
- **Caveats:** No LinkedIn API → manual Fluoro export is the dependency. Render as **current totals, never a daily trend**. Quarter filter intentionally ignored on the snapshot.

## 5. `budget_tracker_live_sync_workflow.json` — marketing budget (EUR)

- **Source:** Microsoft Excel "Spend Tracker" (Margot's sheet).
- **Pattern:** `Delete existing budget rows WHERE source='budget_tracker'` → re-insert (full refresh, not upsert).
- **Writes:** `fact_marketing_spend` (budget-line grained, EUR). Read via `v_marketing_spend`.
- **Caveats:** Net of 5 negative correction rows (kept, never counted as events). Budget-line grained → **not channel-attributable**. EUR only; converted to GBP at a pinned ECB rate before any comparison. Holds **actuals**; the **planned budget** is client-gated.

## 6. Outreach.io workflows

- **`outreach_ingestion.json`** (daily 06:00) — `/sequences?page[size]=1000` → `fact_outreach_sequence_daily` (snapshot per run). Read via `v_outreach_sequence_current`. Engagement live; meetings/SQL/pipeline = 0 in feed → **pending** (SF attribution not wired).
- **`outreach_list_sequences.json`** / **`outreach_list_sequence_steps.json`** — manual helpers that flatten `/sequences` and `/sequenceSteps` to a file for analysis/export.
- ✅ **`outreach_sequence_steps_ingestion.json`** (added 2026-06-15, daily) — `/sequenceSteps` → `fact_outreach_step_daily` (1,150 rows, read via `v_outreach_step_current`). Per-step engagement; email steps have open/reply, call steps have dials/connect, linkedin/task have none.

## 7. `google_ads_ingest.json` — paid search (built, not run)

- Drive-drop CSV → `dim_campaign` + `fact_channel_daily`. **Never executed — CWSI has no Google Ads campaigns.** This is the correct "no live campaigns" state, not a gap. Wire it only if/when Paid Search launches.

---

## Cross-cutting ingestion guardrails

- **Idempotent upserts** on `uq_fact_grain` (channel facts) / source-delete-reload (budget) — re-runs don't double-count.
- **`data_quality_log`** row per run feeds the "last sync" / Salesforce-Sync panel.
- **Currencies never mixed:** LinkedIn = GBP native; budget/Outreach = EUR → GBP at pinned ECB rate.
- **Snapshots ≠ trends:** LinkedIn + Outreach are lifetime snapshots on a single date.
