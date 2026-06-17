# CWSI Marketing Dashboard — Data Source Map & Glossary

**As of:** 14 June 2026 · **Warehouse:** Supabase (`supabase-cwsi`) · **Pipelines:** n8n → Postgres

> **⚠️ Canonical mapping is now `CWSI_Dashboard_DataSource_Mapping.md`** (kept current). This file remains useful for the glossary/definitions; for panel→source status see the canonical doc.
> **Update 2026-06-16:** Overview funnel completed (Leads→MQL→SQL→**Opportunities**→**Closed Won**; `opp_count` + `closed_won_count` live, 245 won / £7.12M). MQL resolved to "reached MQL or beyond" (no longer inverts). Fixed a PostgREST **1000-row cap** that silently truncated reads (funnel + SEO top-pages) — reads now paginate / aggregate server-side. Architecture: **warehouse, not live source-fetching** (`DEPENDENCIES.md` §8).

This doc maps every dashboard surface to the data behind it: **what feeds it → which DB table → which original source → status**, then explains exactly **how region and pillar are derived**, what's missing, and what each term means.

Legend: ✅ live · 🟡 partial / loaded but caveat · 🔴 not started / empty · ⛔ blocked on client/external

---

## 1. How REGION is derived (per source)

Region is **not** one clean field — every source produces it differently. Canonical list lives in `dim_region`: **UKI** (UK & Ireland), **BeLux** (Belgium & Luxembourg), **NL** (Netherlands), **UNASSIGNED**.

| Source | How region is set | Reliability (assigned / total) |
|---|---|---|
| **Budget tracker** | Real **`Market` column** in the sheet (UK / UK & IE → UKI, BELUX → BeLux, NL → NL, ALL → UNASSIGNED) | 34 / 88 (54 are "ALL" → UNASSIGNED by design) |
| **LinkedIn** | **Parsed from the campaign name** (tokens: UK/UKI/Ireland, Benelux/BeLux, Netherlands/NL) | 4 / 13 (most legacy names have no region token) |
| **Outreach** (sequences + steps) | **Parsed from the sequence name** ("… - UK&I …", "… - BeLux …", "… - NL …") | seq 129 / 211 · steps 480 / 1150 |
| **Salesforce** | Derived inside the SF ingestion (campaign/lead based); `Lead.Country` is dirty so most fall through | 982 / 3090 (2,108 UNASSIGNED) |

**So: region is name-parsed for LinkedIn & Outreach, a real field for the budget sheet, and weakly derived for Salesforce.** This is the project's biggest cross-cutting data-quality gap. The durable fix is a dedicated Region/Market field on the Salesforce Campaign/Account object (then everything joins to that), or a maintained `campaign → region` map.

## 2. How PILLAR (practice area) is derived

Canonical list in `dim_practice_pillar`: **Secure AI** (AI Guard), **Secure Data** (Data Guard), **Secure Endpoints** (Device Guard), **Secure Identity** (Identity Guard), **Secure Operations** (Watch Guard).

| Source | How pillar is set | Coverage |
|---|---|---|
| **Outreach** (sequences + steps) | **Parsed from the sequence name** + topic synonyms: "Secure X" direct; Copilot → Secure AI; Data Security → Secure Data; UEM/Endpoint → Secure Endpoints; SecOps/Threat Protection → Secure Operations | seq 134 / 211 · steps 572 / 1150 |
| **Salesforce** | Not currently set | 0 / 3090 |
| **LinkedIn** | Not currently set | 0 / 13 |
| **Budget tracker** | N/A (uses finance "Budget Line", not pillar) | — |

**So: pillar is currently an Outreach-only dimension**, parsed from names. If the dashboard wants pillar on other channels, that's a follow-on (name-parse SF/LinkedIn campaigns, or a campaign→pillar map).

---

## 3. Data sources → tables (with current row counts)

| Source system | Lands in (DB) | Rows | Status | Notes |
|---|---|---|---|---|
| **Salesforce** (system of record: MQL/SQL/pipeline, Email, Event regs) | `fact_channel_daily` (source='salesforce') | 3,090 | ✅ live (hourly) | MQL counts look low; no Outreach/Paid-Search channel rows; region mostly UNASSIGNED |
| **LinkedIn Ads** (manual Fluoro CSV, UTF-16) | `fact_channel_daily` (source='linkedin') | 13 | 🟡 snapshot | Lifetime totals, GBP, no pillar |
| **Budget tracker** (live Excel, manual copy now) | `fact_marketing_spend` | 88 | 🟡 loaded | EUR; signed corrections; ALL→UNASSIGNED |
| **Outreach.io API** — sequences | `fact_outreach_sequence_daily` | 211 | ✅ live | Engagement snapshot (prospects/opens/clicks/replies) |
| **Outreach.io API** — steps | `fact_outreach_step_daily` | 1,150 | ✅ live | Per-step open/reply for "Engagement by Step" |
| **Outreach → pipeline** (SF campaigns) | `v_outreach_pipeline` (view) | ~0 | 🟡 wired | Program new → ~£0; auto-fills |
| **GA4** (web) | `fact_web_daily` | 0 | 🔴 empty | OAuth wired, returns no rows (scope/property access) |
| **Google Search Console** (SEO) | `fact_seo_daily`, `fact_seo_page_daily` | 0 | 🔴 empty | Same OAuth issue |
| **Google Ads** (Paid Search) | — | — | 🔴 not started | Dev-token approval pending |
| **GoToWebinar** (attendance) | — | — | ⛔ pending | Registrations come via SF; attendance needs GTW API/export |

Supporting dims: `dim_region`, `dim_practice_pillar`, `dim_channel`, `dim_campaign`, `dim_date` (2010–2031). QA log: `data_quality_log`.

---

## 4. Dashboard surface → data mapping

| Dashboard page | Feeds from | Source | Status |
|---|---|---|---|
| **Overview** | `fact_channel_daily` (all channels) + `fact_marketing_spend` | SF + LinkedIn + budget | 🟡 web/traffic tiles blank (GA4 empty); currency split (GBP/EUR) |
| **KPI Tracker** | `fact_channel_daily` (MQL/SQL/pipeline) vs `kpi_targets` | SF + (targets) | 🟡 targets ⛔ client-gated; MQL low |
| **LinkedIn Paid** | `fact_channel_daily` (source='linkedin') | LinkedIn CSV | 🟡 snapshot totals (not daily); GBP |
| **Paid Search** | — | Google Ads | 🔴 no source yet |
| **Organic SEO** | `fact_seo_daily`, `fact_seo_page_daily` | GSC | 🔴 empty |
| **Email** | `fact_channel_daily` (channel='Email') | Salesforce | ✅ live |
| **Outreach.io** | `fact_outreach_sequence_daily` (funnel + 15-cell matrix), `fact_outreach_step_daily` (Engagement by Step), `v_outreach_pipeline` (pipeline) | Outreach API + SF | ✅ engagement live · 🟡 pipeline ~£0 (program new); meetings ⛔ not in API |
| **Events** | `fact_channel_daily` (channel='Events & Webinars') | Salesforce | 🟡 registrations only; attendance pending GTW |
| **Pipeline Report** | `fact_channel_daily` (sql/pipeline/won by channel×region) | Salesforce | 🟡 live; MQL mapping + region gaps |
| **Board Pack** | Aggregation/export of all of the above (PPTX) | derived | 🔴 build pending (T-7) |
| **Salesforce Sync** | `data_quality_log` + SF run status | n8n/SF | 🟡 monitoring view |
| **Export** | All tables | derived | 🔴 build pending |

### Outreach.io page — component detail
- **Engagement funnel** (Prospect → Open → Click → Reply): `fact_outreach_sequence_daily`, prospect-level counts, latest snapshot. Meeting/SQL stages pending SF.
- **15-cell matrix** (Region × Practice area): `fact_outreach_sequence_daily` grouped by `region_id` × `pillar_id`.
- **Engagement by Step**: `fact_outreach_step_daily` grouped by `step_order` (filter `step_type LIKE '%email%'`).
- **Pipeline Contribution**: `v_outreach_pipeline` — currently ~£0 because the SF "2026 - Outreach … Workflow" campaigns have no opportunities yet (confirmed in Salesforce). The historic outbound pipeline (~£1.5M opp value / ~£340k won) sits under **SoPro**, a *separate* service — deliberately not merged in.

---

## 5. What's missing / open

1. **GA4 + GSC return 0 rows** → Organic SEO page + Overview web tiles blank. (OAuth scope / property access.) — highest-impact gap.
2. **Google Ads / Paid Search** — not started.
3. **Salesforce MQL counts low** (~10 vs 584 leads YTD) — status-mapping bug; affects KPI + Pipeline pages.
4. **Region quality** — 2,108/3,090 SF rows UNASSIGNED; needs a dedicated SF region field or a campaign→region map.
5. **Pillar coverage** — only Outreach has pillar; SF/LinkedIn don't.
6. **Currency** — LinkedIn GBP vs budget EUR; no FX normalisation yet (don't sum across).
7. **Outreach meetings/SQL/opps** — not in Outreach API; pipeline fills only as SF opportunities land on the Outreach program campaigns.
8. **`kpi_targets`** — client-gated; thresholds not finalised by CWSI.
9. **GoToWebinar attendance** — registrations via SF only; attendance pending GTW.
10. **Email-join attribution (ticket T-4)** — prospect↔SF email join is the precision upgrade; needs Outreach prospect + record-level SF data (not yet in warehouse).

---

## 6. Glossary — what each term means

**Region** — CWSI's three go-to-market territories: **UKI** = UK & Ireland (bundled), **BeLux** = Belgium & Luxembourg, **NL** = Netherlands. **UNASSIGNED** = couldn't be determined from the source.

**Pillar / Practice area** — CWSI's five security offerings (a.k.a. "Guard" brands): **Secure AI** (AI Guard), **Secure Data** (Data Guard), **Secure Endpoints** (Device Guard), **Secure Identity** (Identity Guard), **Secure Operations** (Watch Guard).

**Channel** — marketing motion: LinkedIn Paid, Paid Search, Organic SEO, Email, Outreach.io, Events & Webinars.

**Snapshot vs daily** — *Snapshot* tables (LinkedIn, Outreach sequence/step) store a **lifetime running total** stamped with the pull date; query the **latest** snapshot only and show as current totals, **never as a daily trend**. *Daily* sources (Salesforce) have genuine per-day rows and can be trended.

**MQL / SQL** — Marketing Qualified Lead / Sales Qualified Lead — funnel stages tracked in Salesforce.

**Pipeline £ / Closed-Won £** — open opportunity value / won deal value, from Salesforce opportunities.

**Cadence / Sequence** — an Outreach multi-step outbound play. **"5 × 3 = 15 cadences"** = 5 pillars × 3 regions = 15 logical region×pillar cells (in reality each cell is run by several SDRs, rolled up to the 15 cells).

**Prospect / Open / Click / Reply / Meeting** — Outreach funnel stages. Prospect-level unique counts are used so rates read as "% of prospects."

**SoPro** — a separate third-party outbound **email** service CWSI uses; holds real historic pipeline but is **not** the Outreach.io channel.

**fact_ / dim_ / v_** — `fact_*` = measures (metrics by date/dimension); `dim_*` = lookup dimensions (region, pillar, channel, campaign, date); `v_*` = a SQL view (computed, not stored).

**`source` column** — tags each fact row by origin: `salesforce`, `linkedin`, `budget_tracker`, `outreach`.
