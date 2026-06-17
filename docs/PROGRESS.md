# CWSI Marketing Dashboard — Build Progress

**Target delivery:** 2026-06-23 · **Owner:** BrainD (Aarav) · **Last updated:** 2026-06-16
**Overall build ≈ 65–70%.** Foundation (T-1/2/3) and surface (T-4/5/6) are largely done; the differentiator + close-out (T-7/8/9/10) are not started.

> **2026-06-16:** Overview funnel completed end-to-end — **Opportunities** (`opp_count`) + **Closed Won** (`closed_won_count`) added to the SF workflow + store and re-run (245 won / £7.12M reconciled). Fixed a systemic **PostgREST 1000-row cap** that was silently undercounting reads (funnel + SEO top-pages); all reads now paginate / aggregate server-side. Loading states restyled. Architecture decision recorded (warehouse vs live fetch) — `DEPENDENCIES.md` §8.

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
| **T-6** Pipeline / funnel / attribution | SF-mirrored funnel, by-source, vs target | 🟡 | ~92 | Funnel now complete (Leads→MQL→SQL→**Opp**→**Closed Won**); opp-level stage distribution (per SF stage) still not modelled |
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

### T-6 Pipeline / funnel / attribution 🟡 ~92%
Funnel, pipeline-by-source, channel split all live and correctly attributed. Funnel is now **complete** — Leads→MQL→SQL→**Opportunities**→**Closed Won**, all real counts (`opp_count` = qualified open+won opps, a subset of SQL so the funnel narrows; `closed_won_count` = won deals). **Caveats:** (1) MQL definition (resolved to "reached MQL or beyond" — see §4); (2) opportunity-**stage** distribution (per SF StageName) still not modelled (fact is channel-daily, not opp-level); (3) influenced margin now live (vendor-cost basis — Paul to confirm).

### T-7–T-10 ⬜
Not started. T-8 export buttons are visual stubs.

---

## 🚦 T-7 readiness gate — what must be true before the AI board pack is meaningful

T-7 can be *built* against live data, but the board narrative leads on **MQL, SQL, MQL→SQL, closed opps, influenced pipeline, influenced margin, CPL**. Of those:

| Board metric | Ready? | Blocker | Owner |
|---|---|---|---|
| Closed opps, Opportunities, Influenced pipeline, Closed-Won | ✅ actuals live | targets only | client |
| MQL, SQL, MQL→SQL | 🟢 | **RESOLVED** — MQL = "reached MQL or beyond"; funnel no longer inverts. Only Margot's nod on status buckets | Margot (confirm) |
| Influenced margin | 🟢 | **RESOLVED & LIVE** — vendor-cost basis (~£3.0M); Paul to confirm basis | Paul (confirm) |
| CPL | 🔴 | spend per channel — only LinkedIn has spend | T-3 / Margot |
| Every "vs target" / status | 🔴 | `kpi_targets` register absent | Paul + Claire |

**Conclusion:** the funnel + margin blockers are now resolved, so T-7 can narrate a coherent funnel. Only **two** gate items remain: **per-channel spend → CPL** (T-3 / Margot) and the **`kpi_targets` register** (Paul + Claire). Either resolve them, or T-7 launches with those two metrics explicitly **"pending"** (trace-to-data enforced) — a product decision to confirm with Paul/Margot.

See `DEPENDENCIES.md` for owners and `WORKFLOWS.md` for the ingestion detail behind each row.
