# Schema → Mock-data mapping note (Step 0)

The pasted "component" is a single static HTML artifact (a GoHighLevel funnel export) with
hard-coded numbers. It has been ported to React **without changing markup or styling** — only the
hard-coded figures are replaced with live reads from the canonical Supabase views.

## Views actually read (verified via MCP)

`v_fact_enriched` (3,090 seed rows) — columns:
`fact_id, campaign_key, campaign_name, region_code, region_name, channel_name, pillar_name,
activity_date, year, quarter, source, spend, impressions, leads, mql_count, sql_count,
pipeline_value, closed_won_value, loaded_at`

`v_campaign_current` (482 rows) — columns:
`campaign_id, campaign_key, channel_id, campaign_name, source_system, spend_rate,
valid_from, valid_to, is_current, created_at`

The view is already denormalised: `region_code / region_name / channel_name / pillar_name` and
`year / quarter` (from `dim_date`) are present, so **no joins are needed** for the dashboard.

## Live data state (build defensively for this)

| Fact column        | State in seed data                | UI consequence                                |
|--------------------|-----------------------------------|-----------------------------------------------|
| `leads`            | populated (Σ 23,636)              | ✅ rendered live                               |
| `mql_count`        | populated (Σ 555)                 | ✅ rendered live                               |
| `sql_count`        | populated (Σ 688)                 | ✅ rendered live                               |
| `pipeline_value`   | populated (Σ £1.26M)              | ✅ rendered live                               |
| `closed_won_value` | populated (Σ £7.12M)              | ✅ rendered live                               |
| `spend`            | LinkedIn rows GBP (snapshot); SF rows 0 | ✅ LinkedIn spend live (GBP); other channels still pending |
| `impressions`      | LinkedIn rows populated; SF rows 0 | ✅ LinkedIn impressions live; others pending           |
| `clicks`           | **now in the view** (migration added) | ✅ LinkedIn CTR/clicks live (GBP); see currency note   |
| `pillar_name`      | **null on every row**             | pillar filter treats null as "Unmapped" (first-class)  |
| `source`           | only `salesforce`                 | source breakdowns collapse to one source     |
| channels present   | Email, Events & Webinars, LinkedIn Paid, Organic SEO | Paid Search + Outreach render the **empty state** |

### Resolved via migration (2026-06) + new sources
- **`clicks`** — was missing from `v_fact_enriched`; **now added** (migration
  `expose_marketing_spend_and_clicks_to_anon`). LinkedIn CTR/CPC now derive on the LinkedIn page.
- **`fact_marketing_spend` (NEW, EUR)** — finance-grained budget tracker (88 lines, net €98,819.39).
  No view existed and the base table was RLS-blocked for anon; migration adds **`v_marketing_spend`**
  (denormalised region) granted to anon. Feeds budget-vs-actual + spend-by-category/region.
- **LinkedIn delivery (NEW, GBP)** — `fact_channel_daily` rows with `source='linkedin'`: a
  **cumulative lifetime snapshot** on a single `activity_date` (2026-06-12). Rendered as current
  totals (spend/impr/clicks), **never a daily trend**. Trends use the daily Salesforce rows.
- **CURRENCY:** LinkedIn spend = **GBP**, marketing budget = **EUR**. Never summed; each labelled.
  Optional single FX rate (`FX_GBP_PER_EUR`) is null by default (no conversion).

### ⚠️ Still flagged
- **meetings booked** — does not exist anywhere in the schema. The Outreach "Meetings booked"
  tile and engagement funnel render "not available yet" (never zero-filled).
- **registrations / attendance / open rate / reply rate / keyword & page SEO / web sessions** —
  belong to `fact_web_daily` / `fact_seo_*` (empty, and not in `v_fact_enriched`). These panels
  render "not available yet".

## Mock → real field map

| Mock figure (HTML)                         | Real source                                                        |
|--------------------------------------------|--------------------------------------------------------------------|
| Overview "Influenced Pipeline £290k"       | `Σ pipeline_value` over filters                                    |
| Overview "Influenced Margin £91k"          | `Σ closed_won_value` (proxy; true margin not in schema → labelled) |
| Lead Conversion Funnel (Leads→MQL→SQL)     | `Σ leads`, `Σ mql_count`, `Σ sql_count`; opps/retained → n/a       |
| Pipeline by Channel (pipeline/cw/spend)    | group by `channel_name`; spend → n/a (0)                           |
| KPI register: Influenced pipeline/margin, MQL→SQL, total leads | live; CPL/CPC/CPM/ROI/web/email/event rows → n/a |
| Pipeline-by-source table                   | group by `source` (+ channel); CPL → n/a                           |
| Channel pages: per-campaign drill-down     | group `v_fact_enriched` by `campaign_name`/`campaign_key`, filtered by `channel_name` |
| Region tabs (All/UKI/BeLux/NL)             | `region_code` filter; **"All" includes `UNASSIGNED`**              |
| Quarter pills (Q1–Q4 / YTD)                | `quarter` filter within `year = 2026`; YTD = all quarters of 2026  |

## "All" semantics
- **Region = All** → no `region_code` predicate, i.e. UK&Ireland + BeLux + NL **and** Unassigned.
- **Quarter = YTD** → `year = 2026`, no quarter predicate.
- **Pillar = Unmapped** → `pillar_name IS NULL` (the only state present today).
