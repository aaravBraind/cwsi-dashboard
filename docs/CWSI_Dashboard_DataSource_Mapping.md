# CWSI Marketing Intelligence Dashboard — Panel → Data Source Mapping

**Purpose:** map every frontend panel to the data it needs, the *actual* upstream source, our Supabase table/view, and whether the data exists today. Use this to decide what to simplify, descope, or sequence before 23 Jun.

**Grounding:** this reflects the live `supabase-cwsi` store, not the mockup's placeholder numbers. All mockup figures (£290k pipeline, 160 MQL, etc.) are illustrative — they do **not** match the live store and should be treated as design dummy data.

> **Updated 2026-06-15:** GA4 + Search Console are now **live** (Organic SEO wired); Salesforce **channel attribution** and **MQL** ingestion fixed. See `WORKFLOWS.md`, `PROGRESS.md`, `DEPENDENCIES.md`.

---

## Reality snapshot — what the store actually holds today

| Table / View | Upstream | Rows | Status |
|---|---|---|---|
| `fact_channel_daily` | Salesforce + **LinkedIn (snapshot)** | 3,090 + 13 LI | ✅ Populated — leads, MQL, SQL, pipeline, closed-won; **LinkedIn rows add spend/impr/clicks (GBP)** |
| `fact_marketing_spend` | **Budget tracker (manual)** | **88** | ✅ **NEW** — finance-grained EUR spend lines (Jan–May 2026), net **€98,819.39** |
| `fact_web_daily` | GA4 | ~70 | ✅ **LIVE** — sessions/engaged/key_events; read via `v_web_daily` (junk hosts excluded) |
| `fact_seo_daily` | Google Search Console | 1,700 | ✅ **LIVE** — backfilled to 2025-04-15; region clicks/impr/ctr/position; read via `v_seo_daily` |
| `fact_seo_page_daily` | GSC (page-level) | 110,941 | ✅ **LIVE** — backfilled to 2025-04-15; top pages; read via `v_seo_pages` |
| `fact_outreach_sequence_daily` / `fact_outreach_step_daily` | Outreach.io | 211 / 1,150 | ✅ snapshot; read via `v_outreach_sequence_current` / `v_outreach_step_current` |
| `dim_date`, `dim_channel` (now incl. **7 Other/Unmapped**), `dim_region`, `dim_campaign`, `dim_practice_pillar` | — | populated | ✅ |
| `v_fact_enriched`, `v_campaign_current`, `v_marketing_spend`, `v_web_daily`, `v_seo_daily`, `v_seo_pages`, `v_outreach_*` | — | join layer | ✅ exposed to anon |
| `data_quality_log` | ingestion | populated | ✅ |
| `kpi_targets` | client | — | ⛔ **Does not exist** — all targets are unsourced |

**Live `fact_channel_daily` aggregates (all-time, all regions, post-fix 2026-06-15):** leads **25,240** · MQL **958** · SQL **692** · pipeline £1.26M · closed-won £7.1M.
- **Channel split (leads):** Email 6,333 · LinkedIn 6,306 · **Other/Unmapped 5,346** · Events 4,215 · **Organic SEO 3,042** (was 8,388 before the channel fix de-polluted it).
- **Salesforce rows:** spend £0 · impressions 0 · clicks 0 (SF carries none).
- **LinkedIn rows (snapshot as of 2026-06-12, GBP):** spend **£9,489.19** · impressions **608,460** · clicks **3,186** · leads 11 across 13 campaigns. Cumulative-to-date — current totals, **never a daily trend**.
- ⚠️ **MQL vs SQL:** MQL is a current-status snapshot, SQL a cumulative event → SQL>MQL in 2026 (55 vs 156). Definition issue, not a bug — see `DEPENDENCIES.md` §4.

**Marketing budget (NEW, `fact_marketing_spend`, EUR):** net **€98,819.39** across 88 lines (Q1 €52,995 / Q2 €45,824); 5 negative correction rows (−€24,357.80) that are netted in, never dropped or counted as events; region 4/UNASSIGNED holds €74,911 (54 lines).

**Channels present in `fact_channel_daily`:** Email, Events & Webinars, LinkedIn Paid, Organic SEO, **Other / Unmapped** (NEW — Telemarketing/Partners/Referral/Other/blank, 28 campaigns). **Absent:** Paid Search (no SF type / no Google Ads campaigns — correct). Outreach is in its own `fact_outreach_*` tables, not `fact_channel_daily`.

> **CURRENCY GUARDRAIL:** LinkedIn spend is **GBP** (`fact_channel_daily`); marketing budget is **EUR** (`fact_marketing_spend`). They are two different spend concepts (delivery vs finance budget) and are **never summed** — each surface labels its currency. `fact_marketing_spend` is budget-line grained, **not channel-attributable**.

**Three structural facts that drive most "🔴" rows below:**
1. **Spend now exists in two places, two currencies, two grains.** LinkedIn delivery spend (GBP, snapshot, channel/campaign-grained) + the EUR budget tracker (finance-grained, not per-channel). Salesforce still carries no spend/impr/clicks, so non-LinkedIn channel CPL/CPC/CPM/CTR/ROI remain blocked. Google Ads / other-channel delivery still pending (T-3).
2. **No engagement metrics.** Opens, sends, reply rates, attendance, sequence steps don't exist in Salesforce lead data — they need GA4, the ESP, GoToWebinar, and Outreach.io respectively.
3. **No targets.** Every target column, gap-to-close, traffic-light status, and "% of target" is currently unsourceable (client-gated).

**Status legend:** ✅ Live · 🟡 Partial / quality issue · 🟠 Schema exists, empty · 🔴 No source connected (build/ingest needed) · ⛔ Blocked on client or external party · ❓ No traceable requirement (descope candidate)

---

## Scope & campaign counts — why numbers look small

Quarter scope drives every figure on the dashboard and explains "low" campaign counts:

1. **Q1–Q4 = that quarter of 2026** (`REPORTING_YEAR` in `src/data/constants.js`).
2. **YTD = 2024 → now** (`HISTORY_START_YEAR = 2024`, `year >= 2024`). Spans 2024/2025/2026; the sparse 2019–2023 years (little/no pipeline) are excluded. *(Changed 2026-06: YTD previously meant 2026-only.)*
3. **Default quarter = Q2 2026** (`src/filters/FilterContext.jsx`, matches the mockup's default). So first load shows Q2-only — a subset. Switch to **YTD** for the 2024→now picture.

Distinct-campaign counts by scope (current store):

| Channel / source | All-time | YTD (2024+) | FY2026 | Q2 (default) |
|---|---|---|---|---|
| LinkedIn delivery snapshot (`v_fact_enriched`, `source='linkedin'`, GBP) | 13 | 13 | 13 | 13 |
| LinkedIn SF funnel (`v_fact_enriched`, `source='salesforce'`) | 29 | 20 | 14 | 10 |
| Organic SEO (`v_fact_enriched`, `source='salesforce'`) | 65 | 48 | 29 | 14 |

- LinkedIn page "≈23" = snapshot table (13) + Q2 SF funnel (10) on one page.
- Organic SEO "14" = Q2 2026 count. Switch quarter → **YTD** to see the FY2026 column.
- LinkedIn has **no Q3/Q4 data** — those quarters render empty (real, not a bug).

**Quarter filter on the LinkedIn page:** the **GBP delivery snapshot ignores the quarter pill by design** — it's a cumulative lifetime snapshot on a single `activity_date` (2026-06-12), not a per-quarter slice (its query key is region-only). The **SF-attributed funnel below it does respond** to quarter, but only Q1/Q2 have data. So the snapshot tiles staying constant across quarters is intended, not a broken filter.

---

## MARKETING BUDGET (EUR) — NEW

| Panel / Component | Data required | Actual upstream source | Our DB source | Status | Notes |
|---|---|---|---|---|---|
| Budget vs Actual KPI | net actual spend vs planned budget | Budget tracker (actuals) + client (budget) | `v_marketing_spend` (EUR) | 🟡 | **Actual ✅ live** (net €98,819.39). **Planned budget ⛔** client-gated (`MARKETING_BUDGET_EUR` config, null until provided) — shown "not set", never fabricated |
| Spend by Budget Line / Region / Audience | net EUR grouped | Budget tracker | `v_marketing_spend` | ✅ | Live. Net of correction rows; negatives shown, never dropped/counted as events. Surfaced on KPI Tracker + Overview (compact) |
| Currency separation | GBP (LinkedIn) vs EUR (budget) | — | both views | ✅ | Never summed; each labelled. No FX applied by default (`FX_GBP_PER_EUR` config = null) |

---

## OVERVIEW

| Panel / Component | Data required | Actual upstream source | Our DB source | Status | Notes |
|---|---|---|---|---|---|
| Top-line KPI: Influenced Pipeline YTD | pipeline_value summed, YTD | Salesforce | `fact_channel_daily` / `v_fact_enriched` | ✅ | Live and queryable. "94% of target" needs `kpi_targets` ⛔ |
| Pipeline by Channel — Spend bar | per-channel delivery spend | LinkedIn snapshot (GBP) | `v_fact_enriched` | 🟡 | LinkedIn spend ✅ (GBP, labelled); other channels still pending. Not summed with EUR budget |
| Marketing Budget — Actual Spend (EUR) | net actual + corrections | Budget tracker | `v_marketing_spend` | ✅ | NEW compact tiles; separate currency block from channel spend |
| Top-line KPI: Influenced Margin YTD | margin on influenced revenue | Salesforce (margin field or applied rate) | not in schema | 🔴 | No margin column. SF Sync panel itself flags this "in progress Q3". Needs a margin field or agreed rate |
| Top-line KPI: Retained Contracts | renewal/retained opp count | Salesforce (opp type = renewal) | `fact_channel_daily` (no renewal flag) | 🔴 | No "retained/renewal" classification in current model |
| Lead Conversion Funnel (Leads→MQL→SQL→Opp→Retained) | stage counts + conversion % | Salesforce | `fact_channel_daily` | 🟡 | Leads/MQL/SQL live (MQL fix applied — 958 all-time). **MQL is a status snapshot, SQL a cumulative event → SQL>MQL in 2026** (definition issue, needs MQL event-date — DEPENDENCIES §4). Opp & Retained stages not modelled |
| Pipeline by Channel — Performance vs Spend (tribar) | pipeline, closed-won, **spend**, ROI per channel | Salesforce (pipeline/won) + LinkedIn CSV + Google Ads CSV + spend sheet (spend) | `fact_channel_daily` (pipeline/won only) | 🔴 | Pipeline & closed-won ✅; **spend = £0** so ROI cannot be computed. Blocked on T-3. Paid Search row has no data at all |
| Events Mix — Webinars / Owned / Earned | pipeline + MQL rate split by event sub-type | Salesforce + event-type classification | `fact_channel_daily` (single "Events & Webinars" channel) | 🔴 | No webinar/owned/earned sub-classification exists; channel is undifferentiated |
| Quarter Health (traffic lights) | actual vs target per metric | Salesforce (actuals) + `kpi_targets` | partial | ⛔ | Actuals ✅; every status colour needs targets |
| Q3 Strategic Recommendations ("AI synthesis") | derived narrative | computed layer (not a source) | — | 🔴 | Build-time generation, not ingestion. Decide if in-scope for v1 |

---

## KPI TRACKER

| Panel / Component | Data required | Actual upstream source | Our DB source | Status | Notes |
|---|---|---|---|---|---|
| Gaps-to-Close strip (Pipeline, MQL, SQL, Attendees, Retained — "remaining to FY") | actual + FY target | Salesforce + `kpi_targets` | `fact_channel_daily` | ⛔ | Every "remaining to FY" needs a target. Attendees & Retained also lack source actuals |
| Filters: Region | region list | — | `dim_region` | 🟡 | Works, but actuals heavily **UNASSIGNED** — region filter will look broken until region logic lands |
| Filters: Quarter | date dimension | — | `dim_date` | ✅ | |
| Filters: Channel | channel list | — | `dim_channel` | ✅ | List ✅; Paid Search/Outreach have no rows behind them |
| Filters: Status | actual vs target | `kpi_targets` | — | ⛔ | Status derives from targets |
| Status cards (On target / At risk / Off track / Pending SF) | count of KPIs by status | derived from targets | — | ⛔ | Entirely target-dependent |
| Full KPI Register (28 KPIs) | see breakdown below | mixed | mixed | 🟡 | Only ~a third are sourceable today — see split |
| → Closed opps, Influenced pipeline | counts/value | Salesforce | `fact_channel_daily` | ✅ | Actuals live; targets ⛔ |
| → Influenced margin | margin | Salesforce | not modelled | 🔴 | |
| → Cost per lead, Return on spend | spend ÷ leads; ROI | spend sheet / ad CSVs | not in DB | 🔴 | No spend |
| → Impressions, CPC, CPM | ad delivery metrics | LinkedIn + Google Ads CSV | not in DB | 🔴 | |
| → Conversions from organic, Visitor→MQL | GA4 conversions + leads | GA4 | `fact_web_daily` (empty) | 🟠 | |
| → MQL→SQL, SQL→Closed/Won | funnel rates | Salesforce | `fact_channel_daily` | 🟡 | Computable but distorted by MQL mapping bug |
| → Organic Social (engagement, follower growth) | social platform metrics | LinkedIn/social (organic) | none | 🔴 | No organic-social source in scope at all |
| → Traffic to website (sessions) | sessions | GA4 | `fact_web_daily` (empty) | 🟠 | |
| → Email (CTR, unsub, conversions, reader→MQL) | email engagement | ESP / SF email | none for engagement | 🔴 | Pipeline-side ✅ via channel; engagement metrics unsourced |
| → Website (organic traffic, total leads) | sessions + leads | GA4 + Salesforce | `fact_web_daily` (empty) + `fact_channel_daily` | 🟠 | Leads ✅; traffic empty |
| → Events (registrations, attendance, MQL→SQL, cost/conv) | reg + attendance + spend | Salesforce (reg) + GTW (attendance) + spend sheet | `fact_channel_daily` | 🔴 | Registrations partial; **attendance not available** (needs GTW API/export); cost/conv needs spend |

---

## PIPELINE REPORT

| Panel / Component | Data required | Actual upstream source | Our DB source | Status | Notes |
|---|---|---|---|---|---|
| Top strip (Influenced pipeline, Total leads, Open opps, Closed-won) | counts/value | Salesforce | `fact_channel_daily` | 🟡 | Pipeline/leads/closed-won ✅; **Open Opportunities** not modelled as a stage |
| Pipeline by Activity — Q2 Themes | pipeline/won/**spend**/ROI per pillar + trend | Salesforce + spend sheet | `fact_channel_daily` + `dim_practice_pillar` | 🔴 | Pillar dim exists & pillar extraction is feasible for a subset; **spend/ROI blocked**; trend sparkline needs weekly time series logic |
| Pipeline Stage Distribution (SF stages) | open pipeline by stage | Salesforce Opportunity stage | not modelled | 🔴 | Current model has no Opportunity stage breakdown; fact is channel-daily, not opp-level |
| How "Trends" are Calculated | static methodology text | — | — | ✅ | Static content, no data |
| Pipeline by Source (full breakdown) | leads/MQL/SQL/opps/won/pipeline/CPL by source | Salesforce + spend sheet (CPL) | `fact_channel_daily` | 🟡 | Most columns ✅ for 4 channels; **CPL needs spend**; Paid Search/Referral rows absent; Opps not modelled |

---

## LINKEDIN PAID

| Panel / Component | Data required | Actual upstream source | Our DB source | Status | Notes |
|---|---|---|---|---|---|
| **Delivery snapshot (spend/impr/clicks/CTR)** | ad delivery totals | LinkedIn lifetime report (manual ingest) | `v_fact_enriched` (source='linkedin') | ✅ | **LIVE** — GBP, cumulative as of 2026-06-12. Rendered as current totals, **not a daily trend**. `clicks` added to the view; CTR derived |
| Campaign Performance (per-campaign: spend, impr, clicks, CTR, leads, CPL) | ad delivery by campaign | LinkedIn report | `v_fact_enriched` (source='linkedin') + names from `v_campaign_current` | 🟡 | Delivery ✅ (GBP); leads are LinkedIn-reported (mostly 0) — SF-attributed funnel shown separately. CPL/CTR derived in GBP |
| Funnel by campaign (leads/MQL/SQL/pipeline) | funnel, joined by campaign | Salesforce | `v_fact_enriched` (source='salesforce') | 🟡 | Live; shown as a separate "Salesforce-attributed" section (daily), distinct from the GBP snapshot |
| Attribution callout | static note | — | — | ✅ | Static |
| Net New Audience (metric grid) | delivery + funnel split by audience | LinkedIn CSV (audience dimension) | none | ❓🔴 | No net-new/retargeting split in any source; **no traceable requirement** — descope candidate |
| Retargeting (metric grid) | same, retargeting | LinkedIn CSV | none | ❓🔴 | Same — descope candidate |
| Net New vs Retargeting side-by-side | comparison | LinkedIn CSV | none | ❓🔴 | Same |

---

## PAID SEARCH

| Panel / Component | Data required | Actual upstream source | Our DB source | Status | Notes |
|---|---|---|---|---|---|
| Status callout ("no live campaigns") | static | — | — | ✅ | Accurate — no Paid Search rows exist |
| KPI cards (Impressions, CPC, Visitor→MQL, CPL) | ad delivery + GA4 | Google Ads CSV + GA4 | none | 🔴 | No Google Ads data; dev-token approval + MCC linkage is a known lead-time risk |
| Campaign Performance (historical) | per-campaign delivery + funnel | Google Ads CSV (historical) | none | 🔴 | T-3, not started |
| Performance by Keyword Category | delivery by CWSI taxonomy | Google Ads CSV (keyword→category map) | none | 🔴 | Needs keyword-level data + category mapping; neither exists |

---

## ORGANIC SEO

| Panel / Component | Data required | Actual upstream source | Our DB source | Status | Notes |
|---|---|---|---|---|---|
| KPI cards (organic traffic, leads, Visitor→MQL, pipeline) | sessions + leads + pipeline | GA4 (traffic) + Salesforce (leads/pipeline) | `v_web_daily` + `v_fact_enriched` | ✅🟡 | **LIVE** — GA4 sessions/engaged + SF funnel wired on the SEO page. `key_events` (conversions) = 0 → **pending**; Visitor→MQL needs key_events |
| Top 5 Keywords per Category | query-level clicks by category | GSC (query dimension) | none | 🔴 | `v_seo_pages` is **page-level, not query-level** — no table holds keywords/queries. Either add a query fact or descope |
| Top Organic Pages | page clicks/impr/CTR/position | GSC pages | `v_seo_pages` | ✅ | **LIVE** — top-15 by clicks. MQLs-per-page (GA4↔SF join) still not modelled |

---

## EMAIL

| Panel / Component | Data required | Actual upstream source | Our DB source | Status | Notes |
|---|---|---|---|---|---|
| KPI cards (CTR, unsub, new contacts, pipeline) | email engagement + pipeline | ESP / SF email send data | `fact_channel_daily` (pipeline only) | 🔴 | Pipeline ✅; **CTR/unsub/new-contacts are send-level engagement** not in the model. Confirm whether SF email activity carries these |
| Email Performance by Type (News/TL/Nurture) | engagement + pipeline by type | SF email (with email-type tag) | none for engagement | 🔴 | No email-type dimension; no send/open/CTR/unsub data |
| New Contacts Entering Funnel (per quarter) | new contact counts | Salesforce | `fact_channel_daily` (leads proxy) | 🟡 | Approximable from leads; "new contact" definition needs confirming |
| Trigger Sequences · Phase 2 | placeholder | — | — | ✅ | Explicitly future-phase; static placeholder |

---

## OUTREACH.IO

| Panel / Component | Data required | Actual upstream source | Our DB source | Status | Notes |
|---|---|---|---|---|---|
| Scope callout | static | — | — | ✅ | Static |
| KPI cards (active sequences, prospects, reply rate) | cadence engagement | Outreach.io | `v_outreach_sequence_current` | ✅ | **LIVE** — snapshot (as of 2026-06-14). 211 seqs, 162 enabled, 2,816 prospects, reply rate ≈ 10.3% |
| KPI card: Meetings booked | meetings | Salesforce attribution | — | 🔴 | `meetings`=0 in feed; real value needs SF attribution → **pending** tile, not 0 |
| Outreach Engagement Funnel | prospect→open→click→reply→(meeting→SQL) | Outreach.io (+ SF) | `v_outreach_sequence_current` | 🟡 | Prospect→reply ✅ live; meeting/SQL stages **pending** attribution |
| Sequence Performance (Region × Practice Area) | per-sequence engagement | Outreach.io | `v_outreach_sequence_current` | ✅ | Live, grouped by region × pillar. 82 rows region=UNASSIGNED, 77 null pillar → shown as **Unassigned / Unmapped** buckets (nulls don't break the grid) |
| Engagement by Step | per-step open/reply (email steps) | Outreach.io step report | `v_outreach_step_current` | ✅ | **LIVE** — 1,150 rows, latest snapshot. Email steps only (call/linkedin/task have no opens). Steps run 1..17, not a fixed 5 |
| Outreach → Pipeline Contribution | meetings→SQL→pipeline, cost/meeting | Outreach.io + Salesforce + spend (EUR) | partial | 🔴 | Engagement live; SQL/pipeline/cost need SF attribution + EUR→GBP FX → **stubbed** |

---

## EVENTS

| Panel / Component | Data required | Actual upstream source | Our DB source | Status | Notes |
|---|---|---|---|---|---|
| KPI cards (registrations, attendance rate, MQL→SQL, pipeline) | reg + attendance + funnel | Salesforce (reg) + GoToWebinar (attendance) | `fact_channel_daily` | 🔴 | Registrations partial via SF; **attendance ≠ registrations** — needs GTW API or manual export (open dependency); pipeline ✅ |
| Performance by Event Type (Webinars/Owned/Earned) | reg/attendees/MQL/SQL/won/**spend**/ROI by type | Salesforce + event-type tag + spend sheet | `fact_channel_daily` (undifferentiated) | 🔴 | No event sub-type classification; attendance + spend both missing |
| Pipeline vs Closed-Won vs Investment | pipeline/won/spend by type | Salesforce + spend sheet | `fact_channel_daily` | 🔴 | Investment/spend not available |
| Avg Touchpoints to Conversion | multi-touch attribution | Salesforce campaign influence | none | ⛔❓ | Multi-touch is "in progress Q3" per SF Sync; **no traceable requirement** — strong descope candidate |

---

## BOARD PACK

| Panel / Component | Data required | Actual upstream source | Our DB source | Status | Notes |
|---|---|---|---|---|---|
| 7 board KPIs (MQL, SQL, MQL→SQL, Closed opps, Infl. pipeline, Infl. margin, CPL) | actuals + targets | Salesforce + spend sheet + `kpi_targets` | `fact_channel_daily` | 🟡⛔ | MQL/SQL/pipeline/closed-won actuals ✅ (MQL caveat); **margin 🔴, CPL needs spend 🔴, all targets ⛔** |
| Board Narrative (3 paragraphs) | derived narrative | computed layer | — | 🔴 | Generated, not ingested — confirm if in v1 scope. This is Paul's priority export |

---

## SALESFORCE SYNC

| Panel / Component | Data required | Actual upstream source | Our DB source | Status | Notes |
|---|---|---|---|---|---|
| KPI cards (integrations live / in-progress / planned / last sync) | pipeline run metadata | ingestion logs | `data_quality_log` | 🟡 | Last-sync/health ✅ from `data_quality_log`; "integrations live = 4" is a hand-maintained status, not data |
| Integration Readiness list | per-flow status | config | — | ✅ | Status/config content, not a data feed |

---

## EXPORT

| Panel / Component | Data required | Actual upstream source | Our DB source | Status | Notes |
|---|---|---|---|---|---|
| Export cards (CSV / PDF / PPTX) | whatever the page holds | downstream of all above | all tables | 🟡 | Functionality, not a source. PPTX board-pack is Paul's priority deliverable — depends on Board Pack data landing first |

---

## Cross-cutting items

| Component | Source | Our DB | Status | Notes |
|---|---|---|---|---|
| Region selector (All/UKI/BeLux/NL) | — | `dim_region` | 🟡 | Works, but most actuals are **UNASSIGNED** — needs the region-resolution decision (dedicated SF Region field vs campaign-name parsing) before it filters meaningfully |
| Quarter pills (Q1–Q4/YTD) | — | `dim_date` | ✅ | |
| "Synced just now" timestamp | ingestion | `data_quality_log.created_at` / `loaded_at` | ✅ | |
| All target columns / % of target / status colours | client | `kpi_targets` (absent) | ⛔ | Single biggest cross-cutting blocker — touches nearly every panel |

---

## What this means for simplification — recommended buckets

**Build on what's live now (Salesforce only):** Overview top-line (pipeline, leads, closed-won), Lead Conversion Funnel (after MQL-mapping fix), Pipeline by Source, Board Pack actuals. These four cover most of the executive value and need no new ingestion.

**Unblock with T-2 finish (GA4 + GSC):** Organic SEO traffic + Visitor→MQL, Website Performance KPIs. Tables exist and empty — needs the OAuth/access verification, no schema work.

**Needs T-3 ingestion before it shows anything real (spend & delivery):** every CPL/CPC/CPM/CTR/ROI/spend figure, LinkedIn campaign delivery, Paid Search entirely, Events ROI. This is the largest chunk of "🔴" and the clearest simplification target if 23 Jun is tight.

**Blocked on external parties — flag to client now:**
- `kpi_targets` (client) — unblocks all targets/status across every page
- Outreach.io API (Robin) — the entire Outreach page
- GoToWebinar attendance (API/export) — Events attendance metrics
- Salesforce region field — fixes the UNASSIGNED problem
- Influenced-margin definition + multi-touch (SF, "Q3")

**Descope candidates (no traceable requirement origin):** Net New vs Retargeting (LinkedIn), MQLs-per-page (SEO), Avg Touchpoints to Conversion (Events). Worth an explicit conversation with Margot/Paul rather than building speculatively.

**Data-quality fixes that gate trust regardless of scope:** **MQL definition** (MQL is a current-status snapshot so SQL>MQL in 2026 — needs an MQL event-date from SF, DEPENDENCIES §4) and **region resolution** (UNASSIGNED-heavy). Channel attribution + MQL converted-lead fix are **already done** (2026-06-15). These should land before the funnel/board-pack go in front of CWSI.
