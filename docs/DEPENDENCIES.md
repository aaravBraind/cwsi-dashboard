# CWSI Marketing Dashboard — Dependencies & Blockers

**For:** client meeting · **Owner:** BrainD (Aarav) · **Target delivery:** 2026-06-23
**Status key:** 🟢 live · 🟡 partial / live-but-incomplete · 🔴 blocked (needs data/build) · ⛔ blocked on client/external party

> One-line: the dashboard shell, filters, funnel/pipeline, LinkedIn delivery, EUR marketing
> budget, and Outreach engagement are **live on real data**. The gaps below are all **upstream
> data / access / sign-off** items — not frontend work.

---

## 1. Decisions needed FROM CWSI (discuss in the meeting)

| # | Item | Why it matters | Owner | Blocks |
|---|------|----------------|-------|--------|
| 1 | **KPI targets + traffic-light thresholds** (full register, not just Paul's Q2) | Every "% of target", gap-to-close, and status colour is unsourced without them. Currently all targets are config placeholders. | Paul + Claire | KPI Tracker status, Overview health, Board pack |
| 2 | **Marketing budget PLAN (EUR)** | We have actual spend live (€98,819 net). Budget-vs-actual needs the *planned* figure — the feed only has actuals (status='Spent'). | Margot/Paul | Budget-vs-actual KPI |
| 3 | **Influenced-margin definition** | No margin/COGS input in any source — we show closed-won £ as a proxy. Need the cost basis or an agreed rate. | Paul | Margin tile, Board pack metric 6 |
| 4 | **EUR↔GBP FX rate** | 🟢 HANDLED — budget/Outreach cost (EUR) displays in GBP at a per-day-pinned **ECB rate** (frankfurter.dev), labelled on the panel for reproducibility. **No fallback rate** — if the API is down, amounts show in native EUR (a stale rate could produce false GBP). Decision only if CWSI wants a *specific treasury rate* instead of ECB. | Margot/Paul (optional) | — |
| 5 | **Region resolution rule** | ~half of spend (54/88 lines) and 82/211 Outreach sequences are UNASSIGNED; most LinkedIn campaign names carry no region token. Decide: dedicated SF/campaign region field vs name-parsing convention. | Margot + Fluoro | Region filter accuracy everywhere |
| 6 | **"Others" / unmapped practice area** | 77/211 Outreach sequences have no pillar (ad-hoc account/event cadences). Shown as "Others". Confirm that's acceptable vs back-filling pillars. | Margot | Region × Practice grid completeness |

---

## 2. Access / provisioning (gates live data)

| Source | Needed for | Status |
|--------|-----------|--------|
| **Salesforce admin/API** (kept current under new connection policy) | Funnel, pipeline, leads/MQL/SQL, email, events | 🟢 live (monitor connection health) |
| **GA4** + **`insights.cwsisecurity.com`** subdomain linked | Organic SEO traffic, Visitor→MQL, Website KPIs | ⛔ pending provisioning — `fact_web_daily` empty |
| **Google Search Console** | SEO keywords + top pages | ⛔ pending — `fact_seo_*` empty |
| **Google Ads** (dev token, MCC) | Paid Search (historical) | ⛔ pending; no live campaigns anyway |
| **LinkedIn Ads** (Fluoro CSV/export) | LinkedIn delivery (spend/impr/clicks) | 🟡 live via manual lifetime-report ingest; no API (manual step is the dependency) |
| **GoToWebinar** attendance | Events attendance rate (≠ registrations) | ⛔ pending API/export |
| **Outreach.io API** | Outreach engagement | 🟢 live (sequence-level); see step-level + attribution below |
| **In-person event SF field** | In-person attendance in Events | ⛔ field to be created |

---

## 3. Data not in the store yet (panels stubbed "pending")

| Area | Missing data | Source when it lands |
|------|-------------|----------------------|
| Outreach **meetings / SQL / pipeline £** | not in Outreach API (=0 in feed) | Salesforce attribution. `v_outreach_pipeline` is wired but reads ~£0 — **no Outreach opportunities exist in SF yet** (confirmed); tiles auto-fill when they do. Do **not** fold SoPro pipeline in. |
| **Clicks/CTR/CPC** for non-LinkedIn channels | spend/impr/clicks = 0 on Salesforce rows | LinkedIn ✅ done; others need ad-platform/spend ingest |
| **Events sub-types** (Webinar/Owned/Earned) | channel is undifferentiated | event-type classification in SF |
| **Opportunity stages** | fact is channel-daily, not opp-level | SF opportunity stage pull |
| **Multi-touch attribution / CLV** | not modelled | SF "in progress · Q3" |

---

## 4. Known data-quality items

- **Region = UNASSIGNED is large** (spend + Outreach + most LinkedIn). Not an error — it's the
  triage bucket — but it makes the region filter look thin until item #5 is resolved.
- **MQL mapping** in `fact_channel_daily` looked distorted (MQL < SQL on some channels) — confirm
  the SF MQL flag mapping.
- **Campaign names** — FIXED this week: `v_fact_enriched` was showing campaign IDs because the
  name join missed historical rows; now resolves current names.
- **Outreach "Step N" is not a consistent thing across sequences** — each of the ~200 cadences
  designs its own steps, so the *same step number is a different type in different sequences*
  (e.g. Step 1 = Auto Email in one sequence, Manual Email in another, LinkedIn / Phone Call in
  others). The "Engagement by Step" panel aggregates across all sequences at the
  `(step_order, step_type)` grain, so a single step number can appear as several rows
  (Step 1 · Auto Email, Step 1 · Manual Email, Step 1 · LinkedIn …). This is expected, not a bug —
  but it means "Step 1" is not a uniform funnel stage the way the mockup implied. **Decision for
  CWSI:** keep the cross-sequence aggregate (current), or add a single-sequence drill-down so one
  cadence's real Step 1→N flow can be read on its own. Outreach also has no semantic stage names
  (Intro/Value/…) — steps are named only by number + channel type.

---

## 5. What's LIVE today (no dependency — done)

- 🟢 Shell, sidebar, region tabs + quarter filters (re-scope every figure)
- 🟢 Overview funnel + pipeline-by-channel; KPI register actuals; Pipeline report (funnel + by-source)
- 🟢 LinkedIn Paid — GBP delivery snapshot (spend/impr/clicks/CTR/CPL) + SF-attributed funnel
- 🟢 Marketing budget (EUR) — net actual, by budget-line / region / audience, correction-row handling
- 🟢 Outreach.io — engagement snapshot (active sequences, prospects, reply rate), funnel, Region × Practice grid, **Engagement by Step (email steps, live)**
- 🟢 **RLS fixed** — all tables have read-only anon SELECT policies; no fetch failures

---

## 6. Cross-cutting guardrails (how we keep it honest)

- **Currencies never summed raw** — LinkedIn = GBP (native); budget/Outreach cost = EUR, converted to GBP at a pinned ECB rate before any comparison. The rate + source + date are shown on the budget panel so the board-pack export is reproducible.
- **Snapshots ≠ trends** — LinkedIn and Outreach are cumulative lifetime snapshots; shown as
  current totals with an "as of" date, never plotted daily.
- **No fabricated numbers** — anything without a real source renders "pending"/"not available yet",
  never a zero that reads as real.
