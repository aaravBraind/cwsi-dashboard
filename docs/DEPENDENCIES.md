# CWSI Marketing Dashboard — Dependencies & Blockers

**Owner:** BrainD (Aarav) · **Target delivery:** 2026-06-23 · **Last updated:** 2026-06-15
**Companion docs:** `PROGRESS.md` (ticket status) · `WORKFLOWS.md` (ingestion) · `CWSI_Dashboard_DataSource_Mapping.md` (panel→source)

**Status key:** 🟢 live · 🟡 partial · 🔴 blocked on build · ⛔ blocked on client/external · ⚪ N/A

> **Where we are:** Foundation + surface are largely live on real data (shell, filters, funnel/pipeline, LinkedIn, EUR budget, Outreach engagement, and now **Organic SEO via GA4 + Search Console**). The Salesforce **channel attribution** and **MQL** ingestion bugs are fixed. What remains before **T-7 (AI board pack)** is a short list of **client decisions + two ingestion items** — itemised below by who owns each.
>
> **Update 2026-06-16:** Overview funnel completed — **Opportunities** (`opp_count`) + **Closed Won** (`closed_won_count`) added to the SF workflow + store and re-run (245 won / £7.12M reconciled). Influenced **margin re-run is done** (no longer pending). Fixed a systemic **PostgREST 1000-row cap** that was silently truncating reads (funnel undercounted; SEO top-pages wrong) — all multi-row reads now paginate and SEO pages aggregate via an RPC (§4). Loading states restyled. **Architecture decision recorded: warehouse, not live source-fetching — see §8** (5 reasons + examples for the meeting).

---

## 0. T-7 readiness gate — blockers holding us back

Everything through T-6 is done **except** these. Each is tagged with its owner. T-7 should not start in earnest until these are resolved or explicitly accepted as "pending".

| # | Blocker | Owner | Type |
|---|---|---|---|
| A | **KPI targets + traffic-light thresholds** (full register) | ⛔ Paul + Claire | decision |
| B | ~~MQL definition (SQL > MQL)~~ ✅ **FIXED & LIVE (15 Jun)** — "reached MQL or beyond"; all-time MQL 3,945 > SQL 691, YTD 272 > 155. Only open: Margot's nod on the status buckets (1-line tweak). | 🟢 Margot (confirm only) | done |
| C | ~~Influenced-margin / COGS basis~~ ✅ **LIVE (re-run done 2026-06-16)** — `Opportunity.Vendor_Cost_Price__c` cost rollup (£4.19M cost on £7.20M won → **~£3.0M influenced margin**), computed as Amount − vendor cost. Only open item: Paul to confirm the cost-rollup basis is acceptable. | 🟢 (Paul confirm) | done |
| D | **Per-channel spend** for CPL/ROI (only LinkedIn has spend) | 🟡 Aarav + Margot | build + data |
| E | **GoToWebinar attendance** — workflow + `fact_event_daily` built (15 Jun); pending OAuth client + run. **In-person SF field** still ⛔ Margot. | 🟡 Aarav + Margot | build (in progress) |
| ~~F~~ | ~~Outreach step-ingestion workflow~~ | ✅ Aarav | **DONE 15 Jun** — authored, live (1,150 rows) |

---

## 0b. Remaining steps — in detail

Each blocker below: **what's needed → why it matters → what we build once unblocked → interim state → how to unblock**.

### A. KPI targets + traffic-light thresholds — ⛔ Paul + Claire
- **What's needed:** the full KPI register's quarterly + FY **target values** (Paul's Q2 numbers exist: 5,000 prospects, 100 meetings, £1M new pipeline vs £6M creation; the rest of the 28-KPI register is missing), plus the **threshold bands** for green/amber/red on each metric.
- **Why it matters:** every "% of target", gaps-to-close strip, traffic-light status, Quarter-Health panel, and the board pack's vs-target narrative is unsourced without them. Today they are config placeholders.
- **What we build once unblocked:** load into a `kpi_targets` config; status dots + gaps-to-close compute automatically (thresholds already configurable in `src/data/thresholds.js`).
- **Interim:** actuals render live; targets show "not set", status dots neutral.
- **Unblock:** Paul + Claire supply one row per KPI (target, FY target, green/amber cutoffs). Lock in a 30-min session.

### B. MQL definition / event-date — ⛔ Margot + SF admin
- **What's needed:** confirmation of whether Salesforce exposes an **MQL-transition date** (a "Became MQL" timestamp or lead status-history). 
- **Why it matters:** MQL is currently a *current-status snapshot* (only leads whose status is *right now* 'Marketing Qualified Lead', dated at campaign-join). SQL is a *cumulative event*. So leads that progressed past MQL vanish from the MQL count → **SQL > MQL in 2026 (55 vs 156)** and the funnel reads as broken. This is a definition problem, not a code bug.
- **What we build once unblocked:** (i) if an MQL date/history field exists → date MQL by that event (clean cohort funnel); (ii) else → count MQL cumulatively as "ever reached MQL" (status MQL **or beyond**) so progression doesn't shrink it, dated at campaign-join as a documented proxy.
- **Interim:** funnel shown with a caveat; MQL→SQL not presented as a same-cohort rate.
- **Unblock:** Margot/SF admin answer "is there an MQL date or status history?" → 1-line workflow change.

### C. Influenced margin — ✅ RESOLVED in workflow (15 Jun), pending re-run
- **Found:** `Opportunity.Vendor_Cost_Price__c` (cost rollup from Opportunity Products) is reliably populated in aggregate — £4.19M cost on £7.20M won across 245 campaign-attributed deals → **~£3.0M influenced margin (~42%)**.
- **Built:** `margin_value` column added to `fact_channel_daily` + exposed in `v_fact_enriched`; SF workflow now pulls `Vendor_Cost_Price__c` and computes **margin = Amount − vendor cost** on won opps; `funnelOf` surfaces it.
- **Caveat:** we use the **cost rollup**, NOT `Gross_Profit_Margin__c` (% field defaults to 100 on cost-0 rows). Deals with no product cost show 100% margin (likely PS/services) — minor overstatement, flag to Paul.
- **Remaining:** re-import + re-run the SF workflow → margin populates; then wire the Overview/Board margin tile. (No longer a Paul blocker — just confirm the cost-rollup basis is acceptable.)

### D. Per-channel spend + spend→campaign mapping — 🟡 Aarav + Margot
- **What's needed:** Margot's **merged spend sheet with a column linking each spend line to a channel/campaign** (she committed to co-designing one sheet that serves both her and the dashboard, per the 4-May call). Today `fact_marketing_spend` is **finance/budget-line grained, not channel-attributable**.
- **Why it matters:** every CPL, CPC, ROI, and "performance vs spend" figure (Overview tribar, Pipeline-by-source CPL, Board CPL, channel ROI) needs spend joined at channel/campaign level. Only LinkedIn has delivery spend today (its own GBP snapshot).
- **What we build once unblocked:** BrainD adds the campaign-link column structure to Margot's sheet → ingest maps spend→channel/campaign → CPL/ROI compute across channels.
- **Interim:** CPL/ROI render "n/a"; budget shown as net EUR actual only.
- **Unblock:** co-design the one merged sheet (BrainD provides the column spec; Margot maintains it).

### E. Events completeness — GoToWebinar attendance + in-person SF field — 🟡 in progress
- **What's needed:** (1) **GoToWebinar attendance** (≠ registration). (2) A **new SF field for in-person attendance** (no field exists).
- **DONE 15 Jun:** `fact_event_daily` + `v_event_daily` created; **`gotowebinar_ingest.json` workflow built** (Schedule → Get Webinars → Get Attendees → upsert reg + attended per webinar, region parsed from the subject).
- **Remaining (you):** create the GoTo OAuth2 client, attach it to the two HTTP nodes, set `organizer_key` in Config, run once, and **verify the API field paths** against your account's response (registrant count + attendees array — flagged in the workflow sticky note). Then I wire the Events page attendance panel.
- **Remaining (Margot):** the in-person attendance SF field (no field exists; manual until created). Live vs on-demand webinar sub-split still open.
- **Interim:** Events shows registrations + pipeline; attendance "pending" until the workflow runs.

### Dev items we own (Aarav) — detail in §1
- **Per-channel spend join** (pairs with D), **opportunity-stage distribution** pull (Pipeline stage panel), **GA4 key-events** confirm/map (organic conversions), **re-import fixed SF workflow + delete stale n8n stub**. None blocked on the client.

---

## 1. ON AARAV (BrainD — dev) — build items we own

| Item | Detail | Status | Blocks |
|---|---|---|---|
| ~~Outreach step-ingestion workflow~~ | ✅ **DONE 15 Jun** — `outreach_sequence_steps_ingestion.json` authored (daily, `/sequenceSteps` → `fact_outreach_step_daily`, 1,150 rows). | ✅ | — |
| ~~Re-import fixed Salesforce workflow into n8n~~ | ✅ **DONE 2026-06-16** — corrected workflow (channel map, converted-lead MQL, margin, **`opp_count` + `closed_won_count`**) imported and re-run; store reconciles (245 won / £7.12M, all-time leads 25,231). | 🟢 | — |
| **Delete stale n8n stub** | MCP-visible `rtigmdeHcI6NAjRQ` "CWSI - Salesforce Ingestion (T-2)" is a 10-Jun stub (opps-only, hardcoded channel, no Leads/Members). Still present — remove so the hourly schedule can't run the wrong one. | 🟡 | Operational hygiene |
| **Per-channel spend join** | Wire spend→channel so CPL/CPC/ROI compute beyond LinkedIn (depends on Margot's merged spend mapping, item in §2). | 🔴 | CPL/ROI on every channel, Board CPL |
| **Opportunity-stage distribution** | Pipeline page stage breakdown needs an opp-level pull (fact is channel-daily today). | 🔴 | Pipeline Stage Distribution panel |
| **GA4 key-events** | Confirm whether GA4 conversions exist; if so map them (currently 0 → "pending"). | 🟡 | Organic conversion KPI |
| **T-7 / T-8 / T-9 / T-10** | AI board pack, exports, QA gate, handover — not started. | ⬜ | Delivery |

## 2. ON MARGOT (client — marketing ops) — data, access, hygiene

| Item | Why it matters | Status | Depends on |
|---|---|---|---|
| ~~Region resolution rule~~ | ✅ **RESOLVED & LIVE (15 Jun)** — resolved off `Lead_Region__c` / `Account.Region__c`. UNASSIGNED dropped from ~70% to **~4%** of leads (1,042 / 25,242). | 🟢 | done |
| **MQL event-date / status-history** | The funnel inverts (SQL>MQL) because MQL is a *current-status snapshot*. Confirm whether SF has a "Became MQL" date or status history we can date MQL by. | ⛔ | Margot + SF admin |
| **Merged spend sheet → channel/campaign mapping** | Budget tracker is finance-grained (not per-channel). Need each spend line mapped to a channel/campaign to compute CPL/ROI. | ⛔ | Margot |
| **GoToWebinar access** (API/export) | Events **attendance** (≠ registrations) — currently unavailable. | ⛔ | Margot |
| **In-person event SF field** | In-person attendance has no SF field — manual until one is created. | ⛔ | Margot |
| **GA4 conversions / key events** | If organic conversions should be tracked, configure GA4 key events (none landing today). | ⛔ | Margot |
| ~~`insights.cwsisecurity.com` in GA4~~ | ✅ **RESOLVED** — both `cwsisecurity.com` (main / white papers) and `insights.cwsisecurity.com` (SF landing pages) are tracked in `fact_web_daily`. | 🟢 | — |
| **"Others"/unmapped practice area** | 77/211 Outreach sequences have no pillar (ad-hoc) → shown as "Others". Confirm acceptable vs back-fill. | ⛔ | Margot |

## 3. ON PAUL / CLAIRE (client — exec) — targets, definitions, sign-off

| Item | Why it matters | Status | Depends on |
|---|---|---|---|
| **KPI targets + thresholds** (full register) | Every "% of target", gap-to-close, status colour, and the board pack's vs-target story is unsourced without them. | ⛔ | Paul + Claire |
| **Influenced-margin definition** | No margin/COGS in any source; we show closed-won £ as a proxy. Need the cost basis or an agreed rate. | ⛔ | Paul |
| **Planned marketing budget (EUR)** | Actuals are live (€98,819 net); budget-vs-actual needs the *planned* figure. | ⛔ | Margot/Paul |
| **Board-pack scope** | Confirm T-7 ships with blocked metrics as "pending" if A–C aren't resolved by build. | ⛔ | Paul |

## 4. Data-quality items (tracked, with root cause)

| Item | Root cause | Status |
|---|---|---|
| ~~SQL > MQL in current year~~ | ✅ **RESOLVED (15 Jun)** — switched MQL to "reached MQL or beyond" (no MQL-date field exists). All-time MQL 3,945 > SQL 691; YTD 272 > 155. Status buckets pending Margot's confirm (1-line tweak). | 🟢 |
| ~~Region = UNASSIGNED is large~~ | ✅ **RESOLVED (15 Jun)** — moved off dirty `Lead.Country` to `Lead_Region__c`/`Account.Region__c`. UNASSIGNED ~70% → ~4%. | 🟢 |
| **Lead/Contact misclassification** | Per 4-May call: a colleague from an *existing customer* org who signs up is created as a **Lead** (not Contact); leads are converted to contacts manually by sales. So lead/MQL counts can include people from customer orgs. Inherent SF hygiene, affects funnel counts — note, not fixable in ingest. | 🟡 |
| **PostgREST 1000-row response cap silently truncating reads** | FIXED 2026-06-16 — `.limit()` can't exceed the server `max-rows` (1000), so any scope >1000 rows undercounted. Funnel summed only 1,000 of ~2,100 fact rows (showed 11,590 leads vs 17,031); SEO top-pages used 1,000 of ~110k rows. Now all multi-row reads paginate via `fetchAll()`; SEO pages aggregate via the `get_seo_top_pages()` RPC. | 🟢 |
| **Channel attribution** | FIXED 15 Jun — unmapped SF Campaign.Type no longer dumped into Organic SEO; 43 strays → "Other / Unmapped". Organic SEO 8,388→3,042 leads. | 🟢 |
| **Fact channel_id frozen on re-run** | FIXED 15 Jun — `Upsert fact_channel_daily` now sets `channel_id`; one-time re-sync applied. | 🟢 |
| **Campaign names** | FIXED — `v_fact_enriched` now resolves current names, not IDs. | 🟢 |
| **GA4 key_events = 0** | No GA4 conversions configured/landing → shown "pending". Margot to confirm (§2). | 🟡 |
| **Outreach "Step N" not uniform** | Each cadence designs its own steps; same step number is a different type across sequences. Aggregated at `(step_order, step_type)`. Expected, documented. | 🟢 |

## 4b. How REGION and PILLAR are derived (provenance)

**Region** (UKI = UK & Ireland · BeLux = Belgium + Luxembourg · NL = Netherlands · UNASSIGNED = triage). Mapping applied everywhere: UK/IRELAND/GB/England/Scotland/Wales/Guernsey/Jersey/Isle of Man → **UKI**; BELGIUM/BEL/LUXEMBOURG/LUX → **BeLux**; NETHERLANDS/NL/Holland → **NL**; blank/other → **UNASSIGNED**.

| Source | Region comes from | Coverage |
|---|---|---|
| Salesforce — leads / MQL | `Lead.Lead_Region__c` (fallback `Lead.Country`) | ~86% (≈4% UNASSIGNED) — **fixed 15 Jun** |
| Salesforce — opps / SQL / pipeline | `Opportunity.Account.Region__c` (fallback `Account.BillingCountry`) | ~99.6% — **fixed 15 Jun** |
| GA4 (web) | GA4 `countryId` (alpha-2) | good for subdomains; main `cwsisecurity.com` skews UNASSIGNED (no per-country split) |
| Search Console | GSC country dimension | clean |
| LinkedIn (delivery) | region token parsed from campaign name | mostly UNASSIGNED (Fluoro naming) |
| Marketing budget (EUR) | region column in the spend sheet | mostly UNASSIGNED |
| Outreach.io | sequence region (sequence name / mapping) | 82/211 UNASSIGNED |
| Events (GoToWebinar) | parsed from the webinar **subject** (UK/Ireland→UKI, Belgium/Benelux/Lux→BeLux, Netherlands→NL) | best-effort |

**Pillar** (practice area: Secure AI=AI Guard · Secure Data=Data Guard · Secure Endpoints=Device Guard · Secure Identity=Identity Guard · Secure Operations=Watch Guard).

| Source | Pillar comes from | State |
|---|---|---|
| **Outreach.io** | sequence → pillar mapping | ✅ **the only populated pillar source today**; 77/211 sequences have no pillar → bucketed **"Others"** |
| Salesforce channel facts | **not derivable from `Campaign.Type`** → `pillar_id` is NULL on all SF rows | 🔴 would need campaign-name parsing or a custom Campaign field (discovery query pending — see below) |
| GA4 / GSC / LinkedIn / Events | no pillar at source | 🔴 none |

**So today pillar is meaningful only on the Outreach page.** To get pillar onto SEO/Paid-Search/Events/funnel, we need either a campaign-name keyword parse (AI/Data/Endpoint/Identity/Operations) or a Salesforce Campaign pillar/product field — pending the discovery query in §0b dev items.

## 5. External / vendor

| Dependency | Party | Note |
|---|---|---|
| LinkedIn delivery export | Fluoro | No affordable API → manual CSV drop is the recurring dependency |
| Outreach.io API | Robin / Outreach | Engagement live; meetings/SQL/pipeline need SF attribution (no Outreach opps in SF yet) |
| GoToWebinar | vendor | Attendance API/export pending |
| Google Ads | Google | ⚪ N/A — no campaigns; wire only if Paid Search launches |

---

## 6. What's LIVE today (no dependency)

- 🟢 Shell, sidebar, region tabs + quarter filters (re-scope every figure)
- 🟢 Overview funnel + pipeline-by-channel; KPI register actuals; Pipeline report (funnel + by-source)
- 🟢 **Organic SEO — GA4 traffic + Search Console search + top pages** (NEW)
- 🟢 LinkedIn Paid — GBP delivery snapshot + SF-attributed funnel
- 🟢 Marketing budget (EUR) — net actual, by line/region/audience, correction handling
- 🟢 Outreach.io — engagement snapshot, funnel, Region × Practice grid, Engagement by Step
- 🟢 Salesforce funnel/pipeline with **correct channel attribution** + MQL fix
- 🟢 RLS read-only anon policies; no fetch failures

## 7. Guardrails (how we keep it honest)

- Currencies never summed raw (GBP vs EUR; pinned ECB rate, labelled for board reproducibility).
- Snapshots ≠ trends (LinkedIn, Outreach are lifetime snapshots with an "as of" date).
- No fabricated numbers — missing sources render "pending"/"not available yet", never a zero that reads as real.

## 8. Architecture decision — warehouse, not live source-fetching

**Decision (2026-06-16):** the dashboard reads a **warehouse** — sources are ingested into Supabase (`sources → n8n → Supabase → dashboard`) and the app queries that store. We evaluated **fetching live from the source systems** on each page load (e.g. an edge function that calls Salesforce per request) and **rejected it.**

**This is what was scoped, not a new opinion.** The Vision Document (Component 1) commits to *"one unified, region-tagged marketing data store that every downstream component reads from,"* refreshed **daily**, and is explicit that the source systems *"stay as the systems of record; the dashboard reads from them."* Live-per-request fetching would contradict the signed vision. Five reasons, each grounded in the calls / vision and this build:

1. **Half the channels cannot be live-fetched at all** *(4 May process-mapping call).* The call walked every channel's data source and established that several have **no queryable API**: LinkedIn has *"no LinkedIn API — manual export needed"* (Fluoro CSV); **spend** is Margot's spreadsheet; **GoToWebinar** attendance is an export; **in-person** attendance has *no Salesforce field at all*. You cannot "live fetch" a manual CSV or a spreadsheet on page load — only a store can hold them next to the API sources. The vision even files *"LinkedIn API automation"* under **future enhancements** ("if/when the API economics make sense"), so a live LinkedIn feed isn't on the table. **A warehouse is the only model that unifies manual-export + spreadsheet + API sources.**

2. **Trace-to-data needs a stable, point-in-time source** *(Vision C4 — the board pack is "trace-to-data enforced"; every numeric claim "must trace back to a value in the data").* A warehouse row is fixed and reproducible for audit; a live query returns whatever the source says at that millisecond.
   - *Example:* the pack narrates "**£7.12M closed-won across 245 deals**." From the warehouse that's reproducible next week for the board. With live fetch, re-opening the pack after 3 deals close shows £7.4M / 248 — narrative and number silently diverge, and trace-to-data breaks.

3. **One blended number only exists in one store** *(Vision C1: "join everything on campaign, region, and date").* Unifying Salesforce + LinkedIn + Outreach + GA4 + Search Console + spend into one figure needs them co-located; live-per-source can't produce a blended number.
   - *Example:* "Influenced pipeline by channel" joins SF pipeline + LinkedIn delivery spend (GBP) + GA4 sessions — three APIs, three schemas. Only `v_fact_enriched` expresses that as one query.

4. **The dashboard must never disagree with Salesforce** *(Vision C3: "if the dashboard and Salesforce ever disagree on stage definitions, Paul stops trusting the dashboard").* One warehouse load captures every funnel stage at the same instant, so Leads→MQL→SQL→Opp→Won reconciles. Live per-call data captured at different instants doesn't.
   - *Example:* pulling leads at 10:00 and opportunities at 10:05 during active selling can show more SQLs than the leads they descend from — an unexplainable funnel in front of the board.

5. **Reliability + API-limit safety at the moment that matters.** The pack is generated live for a meeting. Live fetch re-pulls + re-transforms on every page load and filter change, multiplying latency and API calls; if Salesforce is slow or the daily API cap is hit at that instant, the funnel goes blank mid-presentation. The warehouse does the heavy work once per sync and never touches the source at read-time. (See the API-call math below.)

### The API-call math (Salesforce funnel)

The funnel is built from **4 SOQL queries** — Campaigns, Opportunities, Leads, CampaignMembers.

| | Warehouse (current) | Live source-fetch |
|---|---|---|
| When SF is queried | once per **hourly sync** | on **every page load + filter change** |
| Calls/day to Salesforce | **4 × 24 = ~96, fixed** | scales with usage — see below |
| Effect of more users / clicking filters | **none** (reads hit Postgres) | **multiplies** every call |

- *Warehouse:* **~96 Salesforce calls/day, flat** — independent of how many people open the dashboard or how many region/quarter filters they click.
- *Live fetch:* one analyst comparing 3 regions × quarters across Overview + KPI + Pipeline easily triggers ~15 scope changes in a few minutes = **15 × 4 = 60 calls**. On a board-prep day — say 5 users × ~10 sessions × ~20 scope changes — that's ~1,000 loads × 4 = **~4,000 Salesforce calls/day, and that's just the SF funnel** (before LinkedIn/GA4/GSC/Outreach). It peaks exactly when the board is watching, and Salesforce enforces a per-org daily API cap — so the funnel can simply stop returning data mid-meeting.
- *Same pattern, bigger:* the SEO page aggregates **~110,000** Search Console rows; once server-side (the `get_seo_top_pages` RPC) it's instant — re-pulling that live per view is untenable.

**Bottom line:** ~96 calls/day that never moves, vs thousands that grow with every click and spike on board day.

**If the real driver is freshness or dropping n8n:** the answer is a *scheduled* Supabase job (pg_cron + edge function) that still **writes to the warehouse** — keep ELT-into-store, never read-through to the source. That preserves all of the above while removing the n8n dependency.
