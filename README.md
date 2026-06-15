# CWSI Marketing Intelligence Dashboard

Vite + React dashboard wired (read-only) to the canonical Supabase Postgres views.
Styling and component structure are unchanged from the original artifact — only the
data layer is live. See [`MAPPING.md`](./MAPPING.md) for the schema → mock mapping.

## Setup

```bash
npm install
cp .env.example .env   # then fill in the two values
npm run dev            # http://localhost:5173
```

### Environment variables

| Var | Meaning |
|-----|---------|
| `VITE_SUPABASE_URL` | Project URL, e.g. `https://xmlfkaftnupwrdofmpox.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Publishable anon key (read-only; RLS-gated) |

No secrets are committed. `.env` is gitignored; `.env.example` holds placeholders.

## Views the UI depends on

- **`v_fact_enriched`** — primary read surface. Funnel + commercial measures
  (`leads, mql_count, sql_count, pipeline_value, closed_won_value`), delivery
  measures (`spend, impressions, clicks`), plus denormalised dims
  (`region_code/name, channel_name, pillar_name, year, quarter`). `clicks` was
  added so LinkedIn CTR/CPC can be derived.
- **`v_campaign_current`** — current-state campaign attributes (SCD2 resolved),
  used for the campaign picker and to resolve LinkedIn campaign names.
- **`v_marketing_spend`** — finance-grained EUR budget tracker
  (`amount, currency, budget_line, primary_audience, region_*, quarter, status`),
  for budget-vs-actual and spend-by-category/region.

The app **only reads**, exclusively through these views (never base `fact_*`
tables, never writes/mutations). RLS is ON; the anon role is granted `SELECT` on
the three views. A one-off migration (`expose_marketing_spend_and_clicks_to_anon`)
created `v_marketing_spend`, added `clicks` to `v_fact_enriched`, and granted both
to anon.

## Currency (critical)

- **LinkedIn delivery spend = GBP** (`v_fact_enriched`, `source='linkedin'`).
- **Marketing budget = EUR** (`v_marketing_spend`).
- These are **never summed**; every spend figure is currency-labelled. An optional
  single rate (`FX_GBP_PER_EUR` in `src/data/thresholds.js`) is `null` by default
  (no conversion). LinkedIn rows are a **cumulative lifetime snapshot** (one
  `activity_date`) — shown as current totals, never plotted as a daily trend.

## Filters (every filter re-scopes every figure)

- **Region** (topbar): All / UKI / BeLux / NL → `region_code`. **All includes Unassigned.**
- **Quarter** (pills): Q1–Q4 / YTD → `quarter` within `year = 2026`. **YTD = whole year.**
- **Channel**: set by the channel pages → `channel_name`.
- **Campaign**: picker on channel pages → `campaign_key`.
- **Pillar**: `pillar_name` / Unmapped (`IS NULL`) — null is first-class (all rows today).

## Current data state

Seed data only. `spend` & `impressions` are 0, `clicks` isn't in the view, `pillar`
is null, only 4 of 6 channels have rows, no meetings-booked measure exists. Affected
tiles render an explicit **"not available yet"** state — never a fabricated 0. They
go live automatically when the underlying data syncs. Full detail in `MAPPING.md`.

## Architecture

```
src/
  lib/supabaseClient.js      single read-only client
  filters/FilterContext.jsx  {region,quarter,channel,campaign,pillar}
  data/
    constants.js             dims, reporting year, NA sentinel
    format.js                gbp / num / pct / ratio
    thresholds.js            client-gated traffic-light targets (not final)
    queries.js               getOverview/getKpiTracker/getPipeline/getChannel/...
  hooks/useDashboardData.js  react-query wrappers over the query layer
  components/
    Sidebar / Topbar / QuarterPills / States
    pages/                   Overview, KpiTracker, Pipeline, Channel, Board, Salesforce, Export
```

Aggregation (sum / group-by) is done client-side over filtered view rows, since
the app cannot create RPCs (read-only). Row volumes are small (seed ≈ 3k total).
