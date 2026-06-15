# CWSI Marketing Dashboard — Build Progress

**Target delivery:** 2026-06-23 · **Owner:** BrainD (Aarav) · **Last updated:** 2026-06-15
**Overall build ≈ 60–65%.** Foundation (T-1/2/3) and surface (T-4/5/6) are largely done; the differentiator + close-out (T-7/8/9/10) are not started.

**Legend:** ✅ done · 🟡 partial (works, gated/incomplete) · 🔴 blocked · ⬜ not started · ⚪ N/A by exception

---

## Ticket status

| Ticket | Scope | Status | % | What remains |
|---|---|---|---|---|
| **T-1** Canonical store | region-tagged star schema, dims+facts, views, validation | ✅ | 100 | — |
| **T-2** API ingestion | SF, GA4, GSC, Google Ads, Outreach | 🟡 | ~95 | All feeds live (SF, GA4, GSC backfilled to Apr 2025, Outreach seq+steps); Google Ads ⚪ N/A (no campaigns) |
| **T-3** Manual ingestion | LinkedIn, spend sheet, GoToWebinar, in-person | 🟡 | ~55 | **GoToWebinar attendance** + **in-person SF field** not built |
| **T-4** Shell + Overview + KPI Tracker | filters, funnel, 28-KPI register, gaps-to-close | 🟡 | ~95 | Targets/thresholds config-gated (client) |
| **T-5** Six channel pages | per-channel totals + drill-down | 🟡 | ~80 | Email/Events engagement metrics; rest live |
| **T-6** Pipeline / funnel / attribution | SF-mirrored funnel, by-source, vs target | 🟡 | ~90 | MQL definition caveat; opp-stage distribution not modelled |
| **T-7** AI board pack | Claude narrative, trace-to-data | ⬜ | 0 | Not started — **gated, see below** |
| **T-8** Export CSV/PDF/PPTX | board pack + KPI/pipeline export | ⬜ | 0 | Stubs only |
| **T-9** aitp-qa gate | adversarial QA, ship/no-ship | ⬜ | 0 | Not started |
| **T-10** Handover | SOP + Loom + call | ⬜ | 0 | Not started |

---

## Detail

### T-1 Canonical store ✅
Dims (`dim_date`, `dim_region`, `dim_channel` — now incl. id 7 *Other / Unmapped*, `dim_campaign` SCD2, `dim_practice_pillar`) and facts (`fact_channel_daily`, `fact_web_daily`, `fact_seo_daily`, `fact_seo_page_daily`, `fact_marketing_spend`, `fact_outreach_sequence_daily`, `fact_outreach_step_daily`). Read views all anon-granted (RLS read-only). Region mandatory.

### T-2 API ingestion 🟡 ~90%
- ✅ **Salesforce** — hourly; MQL fix (converted leads) + channel map fix both applied.
- ✅ **GA4** — `fact_web_daily` live (8 days). key_events pending.
- ✅ **Search Console** — `fact_seo_daily` + `fact_seo_page_daily` live.
- ✅ **Outreach** — sequence feed (daily) **and step feed** both live and reproducible; `fact_outreach_step_daily` 1,150 rows. (step-ingestion workflow authored 15 Jun.)
- ✅ **Search Console** — backfilled 15 Jun to 2025-04-15 (~14 months).
- ⚪ **Google Ads** — workflow built, never run, no campaigns exist (correct).

### T-3 Manual ingestion 🟡 ~55%
- ✅ **LinkedIn** delivery snapshot (GBP, manual Drive drop).
- ✅ **Budget tracker** (EUR actuals, daily Excel sync).
- 🔴 **GoToWebinar attendance** — not built (no API/export access). Events shows registrations, not attendance.
- 🔴 **In-person attendance** — needs a new SF field (client).

### T-4 Shell + Overview + KPI Tracker 🟡 ~95%
Live shell, region/quarter filters re-scope every figure, funnel, pipeline-by-channel, 28-KPI register actuals, budget tiles. **Gap:** every target / % -of-target / status colour needs `kpi_targets` (client) — currently config placeholders.

### T-5 Six channel pages 🟡 ~80%
- ✅ LinkedIn Paid (GBP snapshot + SF funnel), Outreach (engagement + Region×Pillar + steps), **Organic SEO (now wired to GA4 + GSC)**.
- ✅ Paid Search — correct "no live campaigns" state.
- 🟡 Email — pipeline live; CTR/unsub/opens not sourced (ESP/SF email engagement).
- 🟡 Events — pipeline live; attendance + event sub-types missing.

### T-6 Pipeline / funnel / attribution 🟡 ~90%
Funnel, pipeline-by-source, channel split all live and now correctly attributed (channel fix). **Caveats:** (1) MQL definition causes SQL>MQL in current year (see below); (2) opportunity-stage distribution not modelled (fact is channel-daily, not opp-level); (3) influenced margin has no cost basis.

### T-7–T-10 ⬜
Not started. T-8 export buttons are visual stubs.

---

## 🚦 T-7 readiness gate — what must be true before the AI board pack is meaningful

T-7 can be *built* against live data, but the board narrative leads on **MQL, SQL, MQL→SQL, closed opps, influenced pipeline, influenced margin, CPL**. Of those:

| Board metric | Ready? | Blocker | Owner |
|---|---|---|---|
| Closed opps, Influenced pipeline | ✅ actuals live | targets only | client |
| MQL, SQL, MQL→SQL | 🔴 | **MQL definition** — SQL>MQL in current year; needs MQL event-date from SF | Margot / SF |
| Influenced margin | 🔴 | no cost/COGS basis defined | Paul |
| CPL | 🔴 | spend per channel — only LinkedIn has spend | T-3 / Margot |
| Every "vs target" / status | 🔴 | `kpi_targets` register absent | Paul + Claire |

**Conclusion:** T-7 should not ship a board pack that narrates a broken MQL→SQL funnel or fabricates targets. The four blockers above are tracked in `DEPENDENCIES.md`. Either resolve them, or T-7 launches with those metrics explicitly **"pending"** (trace-to-data enforced) — a product decision to confirm with Paul/Margot.

See `DEPENDENCIES.md` for owners and `WORKFLOWS.md` for the ingestion detail behind each row.
