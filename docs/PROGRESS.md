# CWSI Marketing Dashboard — Build Progress

**Target delivery:** 2026-06-23 · **Owner:** BrainD (Aarav) · **Last updated:** 2026-08-06
**Overall build ≈ 85%** (original tickets: Foundation T-1/2/3 + surface T-4/5/6 done; **T-7 AI board pack** BUILT + verified live; **T-8 export** BUILT — browser-print PDF (no server) + Gamma PPTX; T-9 QA gate + T-10 handover not started). **Margot Jul-2026 revamp: everything buildable without client input is now DONE** across all 10 areas (see `CLIENT_FEEDBACK_MARGOT_JUL2026.md` for per-item status, `MARGOT_MEETING_WALKTHROUGH.md` for the client-facing summary). The remaining revamp work is **client-dependent** — 12 confirmations/inputs in `MARGOT_CONFIRMATIONS_NEEDED.md` (biggest: real targets + per-channel spend sheet). **Per-ticket completion: see `TICKET_TRACKING.md`.**

> **2026-10-08 (CAMPAIGNS PAGE — ACTIVITIES "SHIFTED ACROSS QUARTERS" — FIXED, not yet committed):** Margot: "some of the campaign activities seem to have shifted across quarters. Before this was correct. The Data That Moves Your Business Forward LinkedIn campaign should be part of the Q1 campaign. The E7 events that are in Q3 should be in Q2. Same as the legal always-on vertical campaign." **Root cause (code history, no data change):** the 9 Jul Campaigns page grouped activities by theme KEYWORD, date-blind ("data that moves" → Q1, "microsoft e7" / "becoming frontier" → Q2). On 15 Jul the rule became date-first (name date beats keywords) to stop Q1/Q2 crossover; on 11 Aug the Q3 window opened, so anything dated Jul–Sep or named "Q3 …" rolled into Q3 — that moved the three September E7 Suite events (`701Tm00000doSViIAM`, `701Tm00000ZEHhcIAH`, `701Tm00000dAAMDIA4`) and "Q3 2026 - Becoming Frontier - Legal Always-On Vertical Campaign" (`701Tm00000drvHsIAI`) out of Q2; and the 23 Aug curated list put the May BeNeLux LinkedIn ad (`701Tm00000ZUJUEIA5`) under Q2 because her own 11 Aug list had it there. Those events only gained activity in Sep, so she saw the shift now. Verified: `dim_campaign` start dates unchanged since June, no theme overrides lost (`campaign_overrides` has one, E3/E5 → q3), event dates in `fact_event_attendance` correct, today's SF run clean. **Decision applied:** a quarter on the Campaigns page = the QUARTERLY CAMPAIGN an activity belongs to, not the calendar quarter it ran in. `pinnedCampaigns.js`: LinkedIn ad → Q1 (5 rows); the 3 Sep E7 Suite events + Legal Always-On Vertical → Q2 (10 rows). `getCampaignThemes`: curated theme now generic (`themeMeta(quarter)`), and a saved `campaign_overrides.theme` wins for non-curated rows instead of being forced to Other. Q3 now lists exactly E3/E5 workflow, Governance Gap whitepaper and the 10 Sep webinar. Methodology (`campaignTheme`), page callout and `docs/METRIC_DEFINITIONS.md` Axis B rewritten. Build green; placement simulated against the live campaign list. **Not changed (by design):** Events / KPI / Overview still date events by when they were held (Sep E7 = Q3 events); LinkedIn page keeps the ad in Q2 (run date, her 11 Aug instruction). **Open:** the 22.10 BE E7 Suite event is Q4-dated → "Other activities" while the Q4 pill is hidden — ask Margot whether it is also a Q2 activity.

> **2026-10-08 (WHOLE-DASHBOARD AUDIT):** Checked: (1) every `.from()`/`.rpc()` in `src` (33 relations, 3 functions) exists, columns selected exist, RPC params match, `authenticated` can read all and RLS hides nothing (role-switched counts = postgres counts); (2) used-but-unselected columns — only the Campaigns/Events money bug (fixed, `5124275`) + an unused `coverage.withEmail` in `getOutreachAttributedMeetings` (no UI effect); (3) no undefined identifiers / JSX components (eslint no-undef + custom scan); (4) feeds: Salesforce, Outreach, GA4, GSC, GoToWebinar, Pardot all fresh 8 Oct, every scheduled workflow last run = success. **Gaps needing CWSI / the user, not code:** marketing spend ends 12 May (manual budget sheet; Budget Tracker sync inactive) → no Q3 spend on the Budget page; LinkedIn Ads table = 9 Jul seed (Legal campaigns export outstanding) → LinkedIn CPL/ROI are H1-only; LinkedIn page analytics end 22 Sep; in-person events without attendee lists (AI Tour Brussels/Utrecht, Samenwerkingsdag Zorg, Irish Embassy dinner, Cybersec Europe, IE Protect Data, Henley) show no attendance; 30 reforecast KPIs have no target (27 placeholder + 3 webinar); stored board-pack narrative last generated 22 Jul (pre gross-profit/FX changes) → regenerate before use. Q4 pill hidden (`REPORTING_END_ISO` 2026-09-30) by design. Cosmetic: `v_data_freshness` latest_activity 2027-01-01 from zero-valued future-dated Salesforce rows (capped out of every figure).

> **2026-10-08 (CAMPAIGNS + EVENTS MONEY FIGURES SHOWED €0 — FIXED, pushed as 5124275):** Margot: "in the campaigns tab I'm not seeing any ROI". Cause: `getCampaignThemes` and `getEventsDetail` fetch `v_fact_enriched` with an explicit column list that never included the gross-profit columns, but since the 24 Aug commit (`50f9d4e`, gross-profit basis) both pages sum `created_opp_margin_value` / `pipeline_margin_value` / `margin_value` (and `created_opp_value`) — unselected columns come back undefined → every Pipeline Created / Open Pipeline / Closed-Won (gross profit) figure on those two pages read €0 since 24 Aug. Data was fine throughout (13:00 load: Q1–Q3 pipeline/won GP populated); not caused by today's SQL-rule publish. Fix: added the 4 columns to both selects (`queries.js`). Scanned every explicit select in `queries.js` for the same used-but-unselected pattern: only these two (Email uses `FACT_COLS`, which has them). `vite build` ✓.

> **2026-10-08 (SQL ONLY AFTER THE CAMPAIGN RESPONSE — built and PUBLISHED to n8n, first run clean):** `salesforce_ingestion.json` (repo; backup `.pre-sqlhistory-bak`) gains `SF: Get Lead Status History` (`LeadHistory`, `Field='Status'`, from 8 Oct; executeOnce + alwaysOutputData + continue-on-error) between `SF: Get Leads` and `SF: Get CampaignMembers`, and `Build Fact Rows` applies the rule: SQL entry recorded → counts only if on/after that campaign's `FirstRespondedDate`; no entry + response ≥ 9 Oct → already SQL before responding → not counted; responses before 9 Oct → current-status rule; history read error → current-status rule for the run. Contacts' meeting SQLs unchanged. Base = live workflow (Build Fact Rows from the repo copy, which differed only by comments). Offline test on synthetic cases passes (incl. empty history and read error). SQL explanation updated in `methodology.js`, `USER_GUIDE.md`, `DATA_SOURCES.md`, `CONTEXT.md`. `vite build` ✓. Baseline raw SQL (fact_channel_daily, salesforce, 2026, 8 Oct 12:05 UTC): Q1 17 · Q2 166 · Q3 188 · Q4 5 — must be unchanged after publishing (rule only bites from 9 Oct responses). ✅ **Published** (user-approved) to `CWSI - Salesforce Ingestion (T-2)` (`1vUk2rpbcJ2EqVz4`) as version "SQL only after the campaign response". First run after (13:00 UTC, exec 123262): success, history step 0 changes / no error, 46,636 members, 2,793 rows; SQL unchanged Q1 17 · Q2 166 · Q3 188 · Q4 5. SQL explanation pushed (`0e2e241`, as aarav@braind.io). Linear AIT-470 (Done).

> **2026-10-08 (LEAD STATUS HISTORY TRACKING CONFIRMED ON):** Margot reported the change done. Re-ran `salesforce_status_history_fx_probe` (temp webhook + a temporary `FieldDefinition` query node, both removed; workflow verified identical to backup, inactive). Salesforce: **Lead.Status `IsFieldHistoryTracked` = true** (Lead Source / Owner false). LeadHistory still 0 Status rows — expected, history only accrues from enablement. **Next, our side:** ingest LeadHistory (Status) and apply "SQL only when it follows the campaign response" from 8 Oct onward; earlier SQLs keep the current rule. Also checked her other open points: webinar targets still empty in `kpi_targets`; no full-period Legal LinkedIn Ads export received; 2026 deals still on old website-leads campaigns = 2023 Website Leads 11 (€301k) + 2025 Blaud Website Leads 9 (€101k), against 8 on the 2026 campaign.

> **2026-10-08 (OUTREACH MEETINGS FOLLOW THE "TYPE OF OUTREACH" FILTER):** The meetings card, the meetings-rule callout, the attribution tables' meetings/opps and the per-sequence attribution ignored the workstream filter, so a Microsoft TUM engagement view sat beside an all-workstream "4 meetings" (raised by Aryamaan/Margot). Fixed: `getOutreachAttributedMeetings` filters meeting + opp attribution rows by `outreachWorkstream()`; `useOutreachAttributedMeetings(marketingOnly, workstream)` (other pages omit it → unchanged all-workstream figures); Outreach page passes its filter; migration `20261008000000_outreach_meetings_rule_workstream` adds `p_workstream` to `get_outreach_meetings_rule` (same name patterns as `outreachWorkstream()`, unknown label matches nothing; old 3-arg signature dropped to avoid PostgREST overload ambiguity; anon/PUBLIC revoked). Verified card == rule per filter: All 4 Q3 / 7 YTD · Historic Data Reactivation 4 / 6 · SoPro 0 / 1 · **Microsoft TUM 0 / 0** — every Q3 meeting came from Historic Data Reactivation. Funnel sub-line now says all figures follow the filter. `vite build` ✓. Uncommitted.
>
> **2026-10-08 (OUTREACH FEED RESTORED — funnel current again; per-person sync still blocked):** The Outreach page had been serving **3 Sep** data (Microsoft TUM "0 replies" was a frozen snapshot). Cause: the two funnel feeds (`Outreach Ingestion -> fact_outreach_sequence_daily`, `Outreach Steps Ingestion -> fact_outreach_step_daily`) used the old "Outreach Sequence" OAuth credential, which lost its token → "Unable to sign without access token" daily from 4 Sep. The user moved them to "Outreach CWSI App 20260908" (7 Oct). Re-ran via the n8n API (retry with `loadWorkflow`), in order: sync_sequences (147 seqs, was 121) → users (117) → mailboxes (131) → steps (428) → step feed (1,687 rows) → sequence feed (313 seqs + 16,304 prospect memberships). **Verified in the DB, 7 Oct snapshot, 3 marketing workstreams:** 4,664 prospects · 11,255 delivered · 6,289 opens (56%) · 34 replies (0.30%); **Microsoft TUM 680 / 1,514 / 1,100 / 5 replies** (was 164 / 498 / 350 / 0). ⚠️ **Still open (n8n edits, user):** (1) `outreach_sync_states` → `Run Chunk (sub-workflow)` fails `Invalid input for 'chunk'` (number vs string; node is continue-on-fail so the run shows SUCCESS) — the child has never executed, so `outreach_sequence_state`/`outreach_prospect` are frozen at **24 Aug**: meetings attribution, opp attribution, "Prospects in cadence", "Sequences live now" and the seller table are stale and the 16 new SoPro/Microsoft sequences read as never-used. Fix: turn on "Attempt to convert types" on that node, then run states. (2) `outreach_sync_steps` was retried from its failed node so it used the 3 Sep list of 121 sequence ids — the 26 new sequences have no rows in `outreach_sequence_step` until the next full run (05:00 schedule covers it).
>
> **2026-10-08 later — BOTH OPEN ITEMS CLOSED.** User applied the chunk fix ("Attempt to convert types"); with their go-ahead I ran `outreach_sync_steps` and `outreach_sync_states` fresh via a temporary webhook node (added, run, removed — both workflows back to their original node count, still active). Steps: 147 sequences / 526 steps. States: 15/15 child chunks succeeded, 13,741 states + 13,738 prospects loaded, latest reply 7 Oct. **DB fix:** 2,335 orphan state rows (prospects Outreach has since removed from sequences — not returned by a complete, untruncated fetch; 1,126 pending, only 5 ever emailed, 0 touching any meeting or deal) backed up to `_bak_20261008_outreach_sequence_state_orphans` (RLS on, anon+authenticated revoked) and deleted — they were inflating "Prospects in cadence" (5,794 → 4,688). **Verified current, marketing workstreams:** 137 sequences created / 98 ever used / 61 live now · 4,688 prospects in cadence · meetings attributed Q3 = 4, Q4 = 1, YTD = 7 (20 influenced) · 57 attributed 2026 opps. ✅ **Recurring-orphan prevention APPLIED (8 Oct, user-approved)** — published as version "Prune removed sequence states" (with description) on `outreach_sync_states`; repo copy `workflows/outreach_sync_states.json` synced to the live version (also carries the chunk fix). It prepends a guarded `DELETE FROM outreach_sequence_state WHERE loaded_at < now() - interval '3 hours' AND sequence_id IN (SELECT DISTINCT sequence_id FROM outreach_sequence_state WHERE loaded_at >= now() - interval '3 hours')` to the `Write data_quality_log` query in `outreach_sync_states`.
>
> **2026-08-13 (W1 — CAMPAIGN DATA INTEGRITY, code + data done; n8n re-import pending):** The RC1 fix from `DEVELOPMENT_PLAN_11AUG_FEEDBACK.md` is built. **`workflows/salesforce_ingestion.json` (5 changes):** (1) `Map Campaigns to dim_campaign` now derives `start_date` **prefix-first** — `dd.mm.yyyy` name prefix (guarded against 5-digit-year typos like "27.10.20215", year 2015–2035) → SF `StartDate` → explicit "Qn 20yy" name token → NULL. Evidence for prefix-first: 92 current campaigns had StartDate ≠ name-date, all by promotion-setup lead time (StartDate is when promo *began*, the prefix is the event date — same conclusion the GoToWebinar matcher reached on 20 Jun when StartDate joined 0/4 webinars). (2) `Upsert dim_campaign` now also updates `source_system` on conflict — the pre-18-Jun comma column-shift rows could never self-heal because that column wasn't in the `DO UPDATE` set. (3) The **triplicated channel map is consolidated**: `Build Fact Rows` + `Build Opp Rows` now read `channel_name`/`campaign_type` from `Map Campaigns to dim_campaign` output (which executes earlier in the run) instead of carrying their own copies of `CHANNEL_BY_TYPE`/`CHANNEL_OVERRIDE_BY_KEY`. (4) `Upsert fact_channel_daily` + `Write data_quality_log` bindings switched from comma-joined strings to **array `queryReplacement`** (the known n8n comma gotcha). (5) `data_quality_log.issues` now counts current campaigns named "2026" that still have **no derivable start date** after the hierarchy — the loud NULL-start check. **One-off SQL applied to Supabase (13 Aug, after backing up `_bak_20260813_dim_campaign` / `_fact_opportunity` / `_fact_channel_daily`, anon+authenticated revoked):** healed all 18 corrupted `source_system` rows (0 left) + backfilled `start_date` from name prefixes (138 → 130 NULLs; the 8 fixed include the two that matter: **"10.06.2026 - Microsoft E7: Governing AI Agents at Scale" → 2026-06-10** — the two Dublin deals €46,275 + €9,500 now date-bucket correctly — and **"02.07.2026 - UK - Henley Regatta" → 2026-07-02**). Remaining NULL-start rows are genuinely undated legacy (all 6 NULL-start OwnedEvents are 2019/2021/2025 partner events; the biggest undated 2026 contributor is the **"Salesforce Connector" system bucket — 7 opps / €375,620 closed-won 2026** — which W6's explicit "Undated" row will surface honestly). "Dublin Networking Event - June 25th" keeps its odd 2019 date deliberately: zero opps, zero 2026 activity — correcting it would change nothing. ⚠️ **PENDING (operational, you): re-import `salesforce_ingestion.json` into n8n ("CWSI - Salesforce Ingestion (T-2)") and run it** — n8n runs its own stored copy, and until the import the **hourly schedule will keep reverting the backfilled start_dates** to raw SF StartDate. After the run, verify: `data_quality_log` latest row issues ≈ 42-or-fewer, 0 comma-corrupted rows, Dublin/Henley dates intact.
>
> **2026-08-17 (CLIENT RESPONSE DRAFTED):** **`docs/RESPONSE_11AUG_FEEDBACK.md`** — the send-ready reply to Margot covering the entire 11 Aug feedback: headline fixes up top (Dublin, email mixing, attribution, gross-profit basis, stale spend sync), then section-by-section answers to every item, the attribution findings with the client decision (SF Campaign Influence vs computed multi-touch), the what-we-need-from-you list (6 items incl. the SF tidy-ups and the Q3 theme name), the two items still completing on our side (budget sync restart, early-Jan page-views backfill), and the comparing-to-old-screenshots note (3 basis changes). Fully client-facing — no internal jargon, tool names, or raw Salesforce IDs. Sourced from `QA_11AUG_VERIFICATION.md`; review the "Still completing on our side" section before sending (delete lines as the two syncs finish).
>
> **2026-08-17 (POST-QA REVIEW — 4 verified gaps fixed):** An independent line-by-line verification of the round (all ~60 docx items vs the QA doc, all 11 invariants re-run live, all 12 Notion tickets confirmed in QA, per-item code checks) confirmed the build holds but caught **4 real gaps the QA doc overstated** — all fixed same day: **(1)** the "Other / Unmapped" explain was only on the Board → `<Explain id="otherChannel" />` now renders on the Overview channel panel and the Pipeline-by-Source header, plus a plain-English sentence in the Pipeline callout; **(2)** the KPI Tracker didn't carry Margot's FULL per-section metric list (she repeats the funnel metrics per section; we showed each once) → new `chRows()` builder in `kpiRegister.js` adds channel-scoped MQL→SQL / SQL→Won / closed-won / influenced pipeline (GP) / influenced margin rows to the **Email** (four named campaigns via `getEmailReport`), **Website** (Organic SEO channel via `getChannel`, whitepapers excluded) and **Events** (Events & Webinars channel) sections + Website Total-leads + Paid **Clicks** + Outreach **CTR/unsubscribe** (per-email basis; `emailBasis` in `getOutreach` gained clicks/clickRate/unsubRate) + **MQLs (meetings booked — downloads not recorded, stated)** + honest na-rows (reader→MQL, MQL→SQL/SQL→Won not derivable for outreach, cost-per-conversion, influenced margin) — plumbed through KpiTracker.jsx AND exporters (25 new `kpi_targets` seeds, REGISTER_EXPLAIN mappings); **(3)** Q1 page views undercounted — the 15 Aug GA4 run (which DID happen — that pending item is done) used a 200-day lookback that missed early January (202 of 942 Q1 rows NULL, earliest page-views date 17 Jan) → `lookback_days` bumped to **240** in GA4_ingest.json; ✅ re-ran 16 Aug, verified 17 Aug — page views populated across all of 2026 (one residual June row / 2 sessions, negligible); **(4)** raw SF campaign ID `701Tm00000ZUJUEIA5` leaked into the Pipeline callout → replaced with the campaign's name. The QA doc now carries a **"Post-verification corrections (17 Aug)"** section recording all four (paper trail stays honest). Also confirmed by the review: budget sync STILL stale at 14 Jun (the one remaining operational item), the undated bucket is benign (€53.7k Salesforce-Connector + evergreen MQLs, shown by design), and the untracked "Feedback (2).docx" is her old July doc, not new feedback. `vite build` ✓. Still uncommitted by request.
>
> **2026-08-16 (ATTRIBUTION PROBE ANALYZED — the 11 Aug round is now fully complete):** The user ran the (fixed) `campaign_attribution_probe`; results are analyzed and folded into **`docs/QA_11AUG_VERIFICATION.md`** (new "Attribution findings" section with the per-campaign table, plus updated answers under Campaigns, Events and the outstanding list). **The short version for the client conversation:** Margot's instinct is confirmed — primary-campaign attribution loses real credit on **5 of the 7 campaigns probed**; the starkest case is the "Q1 Data is an Asset" webinar, which has **zero** primary-attributed deals while **23 deals carry its attendees**. **But the €10.65M "hidden" total must never be quoted** — it triple-counts deals shared across campaigns, includes deals created *before* the campaigns ran (existing-customer contacts who also registered — one webinar's 22 contacts sit on 144 deals going back to 2023), and mixes currencies and lost deals. A defensible influenced figure needs a **time window** (deals created on/after the campaign start) and **de-duplication**. **Three immediately actionable Salesforce items (in the client note):** (1) large 2026 won deals with **no primary campaign at all** — a $220k June win and a €210k March win are invisible to every campaign view; setting Primary Campaign Source fixes them with no dashboard change; (2) the **IE Protect Data (Dublin) campaign is completely empty** — its real results sit on the E7 campaign for the same date; attendees/deals should be attached to whichever campaign is meant to carry them; (3) **Campaign Influence is off in Salesforce**, so the decision for Margot is: enable Customizable Campaign Influence (Salesforce owns the credit split), or we ingest contact roles + campaign members and compute a labelled, time-windowed "influenced (multi-touch)" basis alongside the primary figures — either way the primary figures stay the headline, no silent basis change. **Round status: all 12 workstreams done, 11/11 verification checks passing, QA doc final, nothing committed (by request).** Remaining before the reply to Margot: the two n8n syncs (GA4 page views, budget tracker), and optionally a skim of `QA_11AUG_VERIFICATION.md` — it's written so the answers can be lifted straight into the reply.
>
> **2026-08-16 (W12 — VERIFICATION HARNESS + DELIVERY QA · the round is CODE-COMPLETE, uncommitted by request):** **`scripts/reconcile_audit.sql`** written and run live via MCP — 11 invariants, **all passing**: region partition, run+ongoing+undated=total, ΣQ=YTD, created=open+closed-won+closed-lost (111=76+21+14), GP≤revenue (scoped to positive-revenue rows — the one flag was a 2023 refund row where the inequality legitimately inverts, documented in the script), email rates≤100%, outreach contacted-only (check rewritten during QA: the first version flagged opps that ALSO had a queued contact even when a contacted witness carried the attribution — the invariant is "every attribution row has a contacted witness"), pinned keys resolve, campaign dates stay healed, **Dublin €55,775 → Run This Period Q2**, **Henley listed**. **`docs/QA_11AUG_VERIFICATION.md`** written — every question from the 11.08 feedback quoted VERBATIM with what-we-found / what-changed / verification, the automated-check table, and the outstanding list (CWSI-side: GSC insights property, LinkedIn page-analytics access, invite lists, SF tidy-ups incl. the CyberSec duplicate + unassigned Accounts + missing Gross Profit; ops: GA4 re-run, budget sync restart, optional attribution probe; decision: labelled multi-touch basis if the probe shows a material gap). Data answers locked in during QA: **NL 50 vs UKI 46 created opps with 15 unassigned** — the unassigned bucket exceeds the gap, so regioning those Accounts may flip it (deal list is on the Board). Whitepaper opp visible (Becoming Frontier: 2 created, €24.5k open). `vite build` ✓. **NOT committed — per the user's explicit instruction; the whole round sits in the working tree.**
>
> **2026-08-16 (W8–W11 — SEO · KPI TRACKER · BOARD · LINKEDIN):** **W8 SEO:** GA4 gains **page views** end-to-end (migration `w8_web_page_views` on `fact_web_daily` + `v_web_daily`; `GA4_ingest.json` requests `screenPageViews` — ⚠️ needs an n8n re-import + run of the GA4 workflow; tiles/tables read "—/after next GA4 refresh" until then) with a page-views-first tile row + per-property column; GSC "Impr." relabelled **"Search impr."** with "times a result appeared in Google search, not page views" spelled out; a **domain-scope callout** states GA4 = both sites all quarters while Search Console = the cwsisecurity.com property only (the insights property must be created on the Google/DNS side; no backfill — the one SEO item not deliverable); **measured zeros render as 0/€0** (her ask) via zn/ze helpers on both funnels; the wider-channel section renamed "Whole organic channel — incl. older campaigns still converting", gains **Qualified + Closed-Won** tiles (the Overview/Board/SEO closed-won discrepancy is dead) and hosts the W6 run-vs-ongoing split. **W9 KPI Tracker:** register wired to existing data — paid rows live from the LinkedIn snapshot (impressions/CPC/CPM/CPL/return-on-spend, all labelled LinkedIn-scope; "(non-LinkedIn)" caption gone), **Email block live from the email platform** (open/CTR/unsub — the four named campaigns, matching the Email page), events attendance-rate **combined** GTW + attendee lists when loaded, new **Total conversions** + **Overall conversion (MQL→closed-won)** rows (kpi_targets seeded), organic-social rows now say "awaiting LinkedIn company-page analytics access", remaining gaps say WHY ("no data source yet — …"); plumbed through both the page and the exporters so exports can't drift; REGISTER_EXPLAIN mappings added. **W10 Board:** "Closed Opportunities" relabelled **"Closed-Won Opportunities"** with the created = open + closed(won+lost) identity in the note/trace (asserted in W12); margin note states the basis ("includes sales-generated campaigns — the Overview toggle is a what-if and never changes the board"); channel-contribution sub labelled revenue-basis explicitly; **Unassigned footnote now lists the actual deals** (new `getUnassignedOpps` + `useUnassignedOpps`, rendered in the Regional Split with SF opportunity IDs/channel/created/value/status so each can be fixed at source). **W11 LinkedIn:** `linkedin_campaign_2026` gains `quarter` (migration `w11_linkedin_campaign_quarter`, all rows = q2); `getLinkedInSnapshot` + hook honour the quarter pill and return `outOfQuarter` for empty quarters → the page shows an explicit "No LinkedIn campaigns ran in this quarter — all 2026 campaigns ran in Q2" state instead of repeating lifetime figures; SF-attributed outcomes stay date-filtered as before; the KPI Tracker's paid rows inherit the same behaviour. `vite build` ✓ after each.
>
> **2026-08-16 (W7 — EVENTS PAGE OVERHAUL, all 9 of Margot's items):** `Events.jsx` rebuilt + `getEventsDetail` extended. **(1) Owned-vs-Earned moved to the TOP** and its count fixed: webinars no longer count as owned events (the main inflator behind "we did not host 23 events") and the count is now "held this period" (event's own date in the window) with earlier-still-contributing stated separately — YTD reads **10 owned + 3 earned**, with 12 earlier events listed apart. **(2) The four excluded events** (Zorgeloos aan de slag met AI · SentinelOne F1 · Mission Impossible · Blaud EOY Event) are filtered from every tile/table via `EXCLUDED_EVENTS_RE`, with an on-page note stating their remaining 2026 pipeline/closed-won is still counted in the ongoing-impact panel (which reads the warehouse directly — nothing hidden). **(3) Henley "missing" fixed structurally:** `getEventsDetail` now appends dated event campaigns with NO recorded activity (from `v_campaign_current`, which gained `campaign_type`+`start_date` via migration `w7_campaign_current_type_startdate`; capped at today so future scheduled events don't count as hosted; skipped under a region filter) — Henley (02.07.2026) lists with a "no activity recorded yet" chip. **(4) Metric parity:** webinars AND in-person both show the full shared set (MQLs, SQLs, Created Opps, Qualified Opportunities, Open Pipeline, Closed-Won) + attendance-rate tile on in-person (attendee-lists coverage stated; registration RATE flagged as needing the missing invite lists — Cybersec Europe / MS AI Tours / Henley, per A11). **(5) MQL section moved above Webinar Performance** (Attendance split into tiles + `WebinarTable`). **(6) The in-person table is split into two identical-metric sub-tables** — "Events Run This Period" vs "Ongoing Impact — Earlier Events Still Contributing" — under the headline figures, split by the event's own date (`startDate` now on every row). **(7) Campaigns cross-reference:** both pages read the same campaign-attributed full-2026 figures (post-W1/W5), stated on-page; the "closed-won at least double" claim = primary-campaign vs multi-touch attribution — quantified once the (now-fixed) `campaign_attribution_probe` is re-run. Stale copy killed ("Henley has no SF campaign", "OwnedEvent is a new type"). **Data-entry find for the client note:** SF holds TWO duplicate CyberSec Europe campaigns (both name-tagged Earned) — merge in Salesforce. `vite build` ✓.
>
> **2026-08-16 (W6 — RUN-VS-ONGOING EVERYWHERE + RECONCILIATION IDENTITIES):** `CurrentVsOngoing` reworked and mounted on the missing pages. **Component:** explicit third **"Undated"** tile whenever undated activity exists (her "how can Closed Won and Ongoing Impact not match when Run Activities is zero" was exactly this bucket being silently absent), an identity footer stating **run + ongoing (+ undated) = the view's totals** with the YTD-vs-quarter semantics spelled out (the split is relative to the window; the totals sum), sales-cycle comparison on BOTH buckets (SEO ask), "proposed view" chip dropped, gained a `keys` prop (hook + `getCurrentVsOngoing` accept a pinned-campaign scope). **Mounted:** Overview (all channels), Campaigns (all), SEO (`channel="Organic SEO"`, inside the wider-channel funnel section), Email (`keys=EMAIL_FAMILY_FACT_KEYS` — exactly her 4 campaigns). Outreach deliberately NOT mounted: contact-attributed lifetime counters carry no campaign start date, so the split doesn't apply there (documented). **Null-channel fix:** `displayChannel` now coalesces a missing channel to "Other / Unmapped", so Overview/Pipeline/Board agree; the `otherChannel` methodology rewritten in plain English (SF types Other/Telemarketing/Partners/Referral + blanks + system buckets; Outreach explicitly not here — it's the labelled contact-attributed row). **Stage distribution** labelled "point-in-time snapshot as of {date} — the quarter pill does not apply". **Identities verified live:** Run 215,547 + Ongoing 254,971 + Undated 53,660 = 524,179 = Total closed-won ✓ · Q1+Q2+Q3 = YTD (524,179) ✓. Bonus finding: the feared €375k undated "Salesforce Connector" bucket was mostly **stale orphan grains from upsert-only drift** — the W1 full-replace re-ingest cleaned it; genuine undated closed-won is €53,660 (one March deal). `vite build` ✓.
>
> **2026-08-16 (W5 — CAMPAIGN + EMAIL WHITELISTS):** Both pages are pinned to Margot's exact lists via the new **`src/data/pinnedCampaigns.js`** (all keys resolved + verified against dim_campaign live). **Campaigns page:** Q1/Q2 now list EXACTLY her 11 campaigns (`CURATED_CAMPAIGNS`) — one row per client-facing campaign, aggregated over its SF keys (Protect Data = UK + IE events; webinars include their on-demand twins), rendered even at zero; everything non-curated rolls into "Other activities" (kept so totals reconcile to Overview) except Q3-dated activity which lists automatically (her list predates Q3). The **Theme dropdown column is removed** (her ask) along with its explainer callout; quarter grouping headers stay. Spot-check: the "Microsoft E7: Governing AI Agents at Scale" row now shows **€55,775 closed-won — her Dublin €55.8k** on the row she'll look for. **Email page:** replaced the type-scope with her 4 pinned families (`EMAIL_FAMILIES`), each aggregating key-sets + **email-NAME patterns** — necessary because the platform's campaign buckets are contaminated exactly as she suspected (verified: the "Q1 Data is an Asset" bucket held the WHITEPAPER's own emails — titled "…Data is an Asset…" — alongside webinar promos and one AI-Tour email; the name rule `/whitepaper/i` splits them). Engagement is **campaign-level first** (family table; per-email demoted to a collapsed drill-down); the Whitepaper/Workflow filter dropdown removed (nothing left to filter); **Audience = summed deliveries from the email platform** (operational sends excluded, replaces the enrolment-list `audience_size`; methodology rewritten — explicitly deliveries, an upper bound on unique people). Apple family = the 2026 edition + its two empty SF variants; the "Expert Commentary Blog" campaign deliberately excluded from the whitepaper family. Rows render even when empty (`hasData: true` — the list is hers, zeros are information). `vite build` ✓.
>
> **2026-08-15 (W4 — MARKETING BUDGET: real totals + MDF + freshness):** The two client-gated numbers Margot supplied on 11 Aug are in: `MARKETING_BUDGET_EUR = 466_394.92`, new `MDF_BUDGET_EUR = 86_394.92` (`thresholds.js`). The split is exact — 466,394.92 − 86,394.92 = **€380,000.00** — so MDF is presented as "of which", not additional (noted in code + methodology). `getMarketingSpend` now fetches the tracker unfiltered and scopes in JS, returning both the scoped view AND full-year all-regions totals (`fy.netActual`, `fy.mdfSpend` via `budget_line='MDF'`) — so annual budget/MDF utilisation no longer shrinks under a quarter/region pill. `MarketingBudget.jsx` rebuilt: 3 tiles (scoped actual w/ tracker-synced date · Annual Budget w/ spent/remaining + % used light · MDF Available w/ spent/remaining), a Budget Utilisation spent-vs-remaining bar panel (total + MDF), and a **freshness guard** — the "Marketing budget & spend" row of `v_data_freshness` renders on the tile, with a loud amber callout when the sync is >3 days behind (the stale-since-14-Jun sync IS her "spend looks too low"; it can never be silent again). All "pending from CWSI" copy stripped (component + Overview panel-sub + methodology). `vite build` ✓. **Pending (user, n8n): `budget_tracker_live_sync_workflow`** — daily-07:00 schedule reading the CWSI spend tracker (Microsoft Excel 365, full-replace load): check it's ACTIVE and run once manually; if the Excel node errors, reconnect the Microsoft credential (stale two months = deactivated or expired OAuth). Also W3 note: `outreach_report_sync` declared not-required by the user (B5 tables stay empty; per-mailing denominators come from the step feed); `campaign_attribution_probe` was RUN — read its Summarize output from the n8n execution when W7/W10 need the attribution-gap numbers.
>
> **2026-08-15 (W3 — OUTREACH: one attribution story):** RC2+RC3 built. **Views (migration `w3_outreach_attribution_tightening`):** `v_outreach_attributed_meetings`/`_opps` now (a) require the matched prospect was **actually contacted** — states `pending`/`failed`/`bounced` are excluded at the view level (3,051 of 8,313 prospect rows were 'pending', i.e. queued-never-emailed, and could still claim deals by email match — pure correlation), and (b) expose `is_marketing` (the 3-workstream regex) so app + harness share one definition. Impact (marketing scope, lifetime): opps 129→104, influenced €4.61M→**€4.37M**, meetings 42→35. ⚠️ Honesty note for the client reply: her "€4.2M seems incorrect" was ALREADY the marketing-restricted figure — the ANSWERS doc's promise that it would "drop materially" was wrong; the tightening trims it ~5%, and the real answer is the basis (contact-touch full deal value, labelled as such everywhere, with count/closed-won as the reliable reads). **Rates (the >100% kill):** the per-EMAIL basis (opens/replies ÷ delivered, Outreach.io's own basis) is now PRIMARY everywhere — page KPI card (per-person demoted to the secondary line), engagement funnel rebuilt as Prospects → Emails delivered → Opens → Replies → Meetings, Sequence-Performance columns (per-row via a new per-sequence email-step rollup in `getOutreach`), KPI-register rows, and methodology entries (which now explain the 11 Aug basis change and why the old formula exceeded 100% by construction). Open-rate display capped at 100% (pixel events). **Page rework:** "Matched from" tile removed (her ask; coverage stays in the audit prose); the attribution table regrouped by **product/flow cluster** (raw sequence names leaked seller names and repeated products per rep); NEW **Seller Performance table** (`outreachRep()` + `sellers` in `getOutreach`, outcomes merged per rep from the attribution rows) with sequences/prospects/emails sent/open %/reply %/meetings/opps/closed-won; Sequence Performance gains Meetings → Created Opps → Closed Won € columns with a de-dup note (Total row = de-duplicated tier truth); stale "switch Sequence set" copy removed. `vite build` ✓. **Pending (user, n8n):** run `outreach_report_sync` (B5 — fills the still-empty `outreach_mailing`/`outreach_prospect`/`outreach_sequence_state`) and `campaign_attribution_probe` (B4 — quantifies primary-campaign attribution for W7/W10).
>
> **2026-08-15 (W2 — INFLUENCED PIPELINE → GROSS-PROFIT BASIS + funnel labels):** Margot's 11 Aug instruction ("Influenced pipeline should be gross margin — use the Gross Profit Value for each opportunity") is implemented end-to-end; it **supersedes the 6 Aug revenue lock** (see the change-note now at the top of `METRIC_DEFINITIONS.md` §1). The catch: gross profit was only ever ingested for WON deals, so the warehouse gained it for open opps — **migration `w2_pipeline_margin_columns`** adds `pipeline_margin_value` + `pipeline_margin_known_count`/`_pending_count` to `fact_channel_daily` (+ `v_fact_enriched`, with a GP≤pipeline sanity CASE), and `Build Fact Rows` now derives open-opp GP identically to won-deal GP (GPV else Amount×GPM, EUR, per-opp; no GP → counted pending, never assumed). **App:** `funnelOf` gains `marginPipeline` (open GP + won GP; **NA — never revenue, never 0 — while open pipeline exists with zero ingested GP coverage**, so pre-refresh it reads "—/arrives at next refresh" rather than silently showing won-only GP) + `marginPipelineKnownOpps/PendingOpps` coverage for the caveat line; `getPipeline.bySource` rows and `salesGenerated` (exclude-toggle) carry the same basis. Every "Influenced Pipeline" display switched to **"Influenced Pipeline (gross profit)"** with revenue kept as a labelled secondary line: Overview headline KPI (+ rewritten basis callout), Pipeline tiles + Pipeline-by-Source column (Outreach's contact-attributed row explicitly marked "(revenue)" — no per-opp GP on that path until W3), Channel page (both KPI spots), SEO (both funnels), KPI register row, board pack figure #6 (value now `funnel.marginPipeline`, trace updated, revenue in the note) and both exports (Gamma brief + HTML report). Events' tile stays explicitly "(revenue)" until W7 extends the event aggregates with GP (noted in the task). Funnel-label sweep: Overview conversion strip now matches Pipeline ("SQL → Qualified", "Qualified → Won"); Campaigns header "Qualified" → "Qualified Opportunities". The ROI-on-website item: **no ROI string exists in any website/SEO context in current code** (only LinkedIn, where it's correct) — her screenshot predates the current build; stated in the delivery note. `vite build` ✓. ⚠️ **The pending n8n re-import is now REQUIRED** (it carries the open-GP ingestion + the executeOnce fix): until imported + run, Influenced Pipeline (gross profit) shows "—" everywhere with "arrives at the next data refresh".
>
> **2026-08-15 (W1 follow-up — n8n "no connection back" error fixed by rewiring):** The first import attempt failed at execution: n8n only resolves `$('node')` reads when the referenced node is a **connected ancestor**, and `Map Campaigns to dim_campaign` sat on a sibling branch. Rewired: `SF: Get Campaigns → Map Campaigns → SF: Get Opportunities` (safe — `SF: Get Opportunities` is `executeOnce`, so the 514 campaign items cause no fan-out), making the mapped campaigns an ancestor of every builder. **Bonus real fix:** the same ancestry rule means the `$('SF: Get Meetings')` read in `Build Fact Rows` (contact-meeting SQL credit, 9 Jul locked definition) had been **silently dead since 20 Jun** — its try/catch swallowed the "no connection back" error, so pure contacts never earned SQL credit. `Build Fact Rows` now hangs off `SF: Get Meetings` instead of `SF: Get CampaignMembers` (its code ignores `$input`, so only ancestry changes). Expect `sql_count` to tick up slightly on the next ingest — that's the definition finally being applied, not a regression. All cross-node references machine-verified against the new topology.
>
> **2026-08-12 (MARGOT'S 11.08 FEEDBACK ROUND — tickets logged + full audit + dev plan):** The 11 Aug feedback doc (~60 items across 12 pages) was logged as **12 Notion Feedback tickets** (Backlog, assigned Aarav, due 14 Aug), then a deep code + database audit produced **`docs/DEVELOPMENT_PLAN_11AUG_FEEDBACK.md`** — read that for the full plan. Six verified root causes: (RC1) **`dim_campaign` rot — 138/514 current campaigns have NULL `start_date`** + 18 comma-corrupted rows; this alone explains the Dublin "Run Activities = 0" bug (the two >€50k Dublin deals sit on the NULL-start "10.06.2026 - Microsoft E7: Governing AI Agents at Scale"), the "missing" Henley Regatta (exists, NULL start), and feeds the "23 owned events" inflation (13 + 10 NULL-start, plus the owned/earned counter never excludes webinars); (RC2) Outreach open-rate >100% is the event-counts-over-people formula (`queries.js:1567`), and meeting attribution over-matches beyond the 3 marketing workstreams; (RC3) **no ingestion rule ever maps an opp to the Outreach channel**, so Pipeline-by-Source excludes it while the contact-matched path shows €4.2M — one metric, two stories; (RC4) she has now decided influenced pipeline = **gross margin** (overrides the 6 Aug revenue lock; also closes A8); (RC5) LinkedIn snapshot is quarter-invariant (no date column in `linkedin_campaign_2026`) → Q1/Q3 leak; (RC6) budget/MDF/email-campaign-list were client-gated and **she supplied all three in this feedback** (budget €466,394.92 · MDF €86,394.92 · the 4 email campaigns) — A1/A5 unblocked; budget sheet sync also stale since 14 Jun (her "spend too low"). Plan = 12 workstreams over 2 days, ending in a reconciliation harness (`scripts/reconcile_audit.sql`) asserting region/quarter/run-vs-ongoing/created-vs-open+closed identities before delivery. Known not-deliverable-by-14-Aug: GSC insights property, organic-social engagement/followers feed, missing attendance lists (all client/external-gated — stated in the delivery note rather than silently skipped).
>
> **2026-08-11 (Q3 REPORTING WINDOW OPENED — frontend only):** The dashboard now shows **Q3 2026** alongside Q1/Q2: the Q3 pill is back in `QUARTER_PILLS`, `REPORTING_END_ISO` moved `2026-06-30 → 2026-09-30` (the min(today, cap) rule means figures accrue day-by-day while the quarter runs), and the default landing quarter is now Q3 (the live quarter). No query changes were needed — all quarter filtering was already generic; only the pill list and the date cap gated Q3. Store verified before enabling: **86 Q3 fact rows, ~£65k pipeline / ~£63k closed-won / 96 leads**; the 2 future-dated Q4 artifact rows stay hidden by the cap exactly as designed. On-screen copy updated ("Q1–Q3 2026" window note on channel pages). Q3 KPI targets already existed in `thresholds.js` (placeholder set), so the KPI Tracker works unchanged.
>
> **2026-08-11 (later — PROVISIONAL Q3 THEME UMBRELLA + on-page notice):** Follow-through on the one gap the window-opening left: `getCampaignThemes` filters campaigns to `theme.quarter === selQuarter`, and no theme had quarter Q3 — so the Campaigns page (now landing on Q3 by default) would have rendered **empty** on the Q3 pill, with Q3 campaigns only visible under "Other" on YTD. Rather than a notice on an empty page, `themes.js` gained a clearly-labelled **provisional `Q3_THEME`** — "Q3 2026 Campaign (theme to be confirmed)" — with the full rule chain extended (dd.mm date prefix months 7–9, explicit "Q3" name token, StartDate months 7–9; Q4 still unmapped by design), `THEME_ORDER` now q1/q2/q3/other, and the Theme dropdown offering Q3 (no DB change needed — `campaign_overrides.theme` has no CHECK constraint). The Campaigns page carries a **"Q3 theme name pending" callout** (figures real/final, only the heading changes once the client names the Q3 theme), and the intro callout + both methodology explains updated from "two quarterly campaigns" to per-quarter wording. Verified against the store: real Q3-classified campaigns exist ("Q3 2026 - Becoming Frontier - Legal Always-On Vertical", the 10.09 + 15.09 September events, the 02.07 Governance Gap whitepaper), so the umbrella lands populated. **Client input still owed: the Q3 overarching theme name** — swap `Q3_THEME.label/blurb` when it arrives.
>
> **2026-08-11 (IN-PERSON ATTENDANCE IS LIVE — first real rows, corroborated against Salesforce):** The extended parser's first run landed both complete pairs: **Protect Data, Power AI (22.04): 48 registered / 24 attended · Microsoft E7 Suite (10.06): 70 registered / 35 attended**. Both rates being exactly 50.0% looked like a counting artifact, so it was corroborated rather than trusted: the AE-list denominators reconcile with Salesforce's own campaign-member counts (`audience_size`) at **48 vs 49** and **70 vs 74** — two independent systems within ~2–5%, so the coin-flip turnout is genuine (and a normal in-person show rate). The Events page attendance-by-region panel now renders, and the **EventsSummary attendees tile self-upgrades** via its `hasData` branch — the combined programme figure now includes 59 in-person attendees alongside the 175 GoToWebinar ones, exactly the upgrade path designed on 29 Jul. Rows carry region UNASSIGNED (the in-person list names have no region prefix — noted in A11's FYI). "CWSI @ The Movies" remains correctly held out by the complete-pair rule pending its Non-Attendees list (A11a). **The whole B3 arc closes:** June: "Margot must export ~10 CSVs" → 10 Aug: "the lists live in AE, no export needed" → 11 Aug: "they exist date-prefixed, parser extended" → now: **live data on the page with zero client action**, and the residual ask is one missing list + one confirmation.
>
> **2026-08-11 (later — AUDIT PROBE FALSIFIES "NO 2026 IN-PERSON LISTS"; parser extended; a sign-flip bug caught by unit test):** Aarav challenged the "no 2026 in-person lists exist" conclusion, and the challenge was right: it rested on the strict `REGION - Attendees - Event` convention, while ~131 of the 140 attendance-ish lists had never been individually examined. Built `pardot_list_audit_probe.json` (one call; scans all 530 names for the known 2026 in-person event names + attendance-ish words outside the convention, newest-first by id since AE ids increment). **Result: the lists exist under a DATE-prefixed shape** — `22.04.2026 - Attendees|Non-Attendees - Protect Data, Power AI Event` (complete pair, the flagship event), `10.06.2026 - … - The Microsoft E7 Suite` (complete pair), `18.06.2026 - Attendees - CWSI @ The Movies` (attendees only). All three verified **OwnedEvent** in Salesforce. Parser extended to the three real shapes (A: region-prefixed · B: date-prefixed · C: date+region-prefixed), with a **real year filter** now that dates are in the names (the 22.10.2025 "Practical Guide" lists drop by date, no name knowledge needed) and a **complete-pair rule** replacing the 100%-flag: a group without BOTH lists is skipped and logged, because attendees-only publishes as perfect turnout ("CWSI @ The Movies" is exactly this today). **The unit test earned its keep:** pattern C's region group split "Non-Attendees" on its own hyphen into region="Non" + token="Attendees" — silently flipping the Protect Data NON-attendees list into an attendees list. Caught against the real names before any run; fixed by trying the date-only shape first (a genuine region can never match its attendee-token slot). Also seen in the audit and noted, not ingested: region-split attendee lists exist for the 2026 **webinars** (BE/IE/NL/UK × Data-as-an-Asset, Agent 365) — a future source for webinar-attendance-by-region, which GoToWebinar can't give; and Registration lists exist for several events. **A11 shrinks again:** (a) create the missing Movies Non-Attendees list, (b) confirm whether CyberSec/AI Tours/Henley track attendance anywhere. **Next run of the attendance feed should land Protect Data + E7.**
>
> **2026-08-11 (C12 FIRST RUN — pipeline proven end-to-end; both events it found were then falsified by Salesforce; table returned to empty as the honest state):** The attendance ingestion ran: 9 convention-shaped lists parsed, memberships counted, 4 event×region rows written — mechanics all correct, including the 100%-attendance flag firing exactly where designed. Then the two-step verification unwound the content. (1) A list named "…Microsoft Ecosystem **Webina**" exposed that **AE truncates long list names mid-word**, so the webinar exclusion missed it (now /webina/, with the trailing fragment stripped before grouping so a truncated name can't orphan its partner list). (2) Pulling the raw list names showed the region prefixes are **BE / IRL / NL / UK** — mapped now, with UK + IRL folding into UKI and BE into BeLux (summed after mapping, so the fold is safe). (3) The decisive check was **against dim_campaign**: "From Strategy to Security" is SF Type **Webinar** — an on-demand webinar, which is exactly why GoToWebinar doesn't carry it — and "A Practical Guide to Securing AI" is an OwnedEvent dated **22–23 Oct 2025**, outside the client-fixed 2026-only scope. Neither belongs in a 2026 in-person attendance table, so **the table was emptied back to zero rows** and the Events page correctly reads "webinars only · pending" again. **The real finding: AE holds NO attendance lists for any 2026 in-person event** — Protect Data Power AI, CyberSec Europe, Disclosure Day, the AI Tours all have none. Workflow updated accordingly: event-level `Config.exclude_events` (seeded with the two verified out-of-scope events; event-level so one odd list can never leave a poisoned half-pair) and **empty-in-scope is now a quiet exit rather than an error**, so the daily trigger keeps watching and the moment CWSI creates 2026 lists in the existing convention they flow to the Events page unaided. Client ask shrinks from "export the lists" (withdrawn) to **"create the lists"** — logged as **A11** with the exact naming convention to follow. Optional client question also logged: the on-demand webinar's attendance (98 registered / 22 attended across BE/IRL/NL/UK) exists but sits outside both feeds — report it in the webinar section?
>
> **2026-08-10 (C12 BUILT — event attendance ingestion from the AE segmentation lists):** `workflows/pardot_event_attendance_ingestion.json`, counts-only (no prospect fan-out — the table's grain is event × region counts, so memberships are counted, not resolved to people; a run is a handful of requests). Chain: lists → strict-parse `REGION - Attendees|Non-Attendees - Event` (**regex unit-tested against the real names from the probe** — the 2026 convention matches, and all four shapes of the ~2023 legacy naming self-exclude, so the decade of drift stays out of a 2026-only table without any date logic) → one throttled membership-count per list → roll up to `(event_name, region_code)`: `registered` = attendees + non-attendees, `attended` = attendees → upsert onto the table's PK. **The design call that matters: webinar lists are deliberately EXCLUDED** (event name containing "webinar") — GoToWebinar already owns webinar attendance and `EventsSummary` ADDS `fact_event_attendance` on top of the GTW figure, so ingesting webinar lists here would silently double-count the programme's attendee total; the excluded lists are logged every run so the choice stays visible. Guard-rails in the same spirit as the email feed: a failed or >1000-member list **poisons its entire event×region** (a half of an attendee/non-attendee pair is a wrong number that looks right); 100%-attendance groups are flagged as "probably a missing Non-Attendees list, not perfect turnout"; unknown region prefixes land as UNASSIGNED and are named in the log. Region prefixes map directly onto dim_region codes (UKI / NL / BeLux — the AE lists use the warehouse's own codes). Also swept the stale copy: the Events page no longer claims the lists "aren't available through the API", and `getEventAttendance`'s comment now records the real route. `vite build` ✓. **What the first run will decide:** every attendance list actually sampled so far is a *webinar* list — if 2026's in-person events have no lists of this shape, the workflow throws with the full excluded/unmatched name list, and the finding goes back to Margot as "the in-person lists don't exist yet", which is a different (and smaller) ask than the export she was originally down for.
>
> **2026-08-10 (EMAIL PAGE ENGAGEMENT SECTION BUILT — EM2 delivered):** The Email page now shows real engagement. Three new blocks under the commercial funnel, all reading the LATEST snapshot of `v_ae_email`: an **Email Engagement summary** (Sent → Delivered → Open Rate → Click-Through → Unsubscribes, with the refresh date on the panel), an **Engagement by Campaign** table (aggregated view, EM2's second half), and a **Per-Email Performance** sortable table (EM2's per-email KPIs — every individual send with recipients/delivered/opens/open-rate/clicks/CTR/unsubs). Wiring: `getAeEmailEngagement()` in `queries.js` (latest-snapshot-only — counters are lifetime, summing snapshots would double-count; quarter pill groups emails by SEND date under the same H1-2026 window rules as every other read; **region deliberately not applied** — one send covers several regions' lists, so a split would be invented, not measured — stated on the panel), `useAeEmailEngagement()` hook, four new methodology eye-button entries (`emailEngagement`, `aeOpenRate`, `aeCtr`, `aeUnsubRate` — all client-readable, no vendor names per the readability sweep), and the old amber "why no figures yet" callout **deleted** — the thing it apologised for now exists. **The judgment call worth recording: CTR is shown on the PER-PERSON basis (unique clicks ÷ delivered), deliberately NOT the platform's headline total-clicks basis.** On this account the headline basis computes to **~29%** — corporate mail filters (link-scanning security tools) auto-click every URL and land in the total — an absurd number that would have invited the exact "your figures don't match" conversation the Outreach reply-rate went through. Same resolution as then: per-person shown, the divergence + reason stated in the eye-button so anyone comparing against the platform's own report knows its headline will read far higher. Open/unsubscribe/delivery keep the platform's own bases (verified to 2dp). **Live H1-2026 numbers on the page: 113 emails · 248,407 sent · 99.5% delivery · 30.6% open · 10.0% CTR (per person) · 0.19% unsubscribe · 17 campaigns.** Q1: 38 emails / 96,665 sent; Q2: 75 / 151,742. The 20 Jul–Aug sends (84,291) sit outside the client-fixed 30 Jun reporting cap and appear when the window is extended. `vite build` ✓. **Remaining on this stream:** KPI Tracker CTR/unsubscribe rows still read n/a (wire to these actuals next), C12 attendance ingestion, activate the daily 05:00 trigger on the feed, and the client-facing docs "being built" → "live" pass.
>
> **2026-08-10 (latest — CAMPAIGN BRIDGE 100% + ATTENDANCE PROBE GREEN; two client asks die in one day):** The re-run of `pardot_email_ingestion` resolved **133 of 133 emails to Salesforce campaigns — 19 of 19 campaigns, zero dangling ids** — via AE's `salesforceId`, and the 7 Aug snapshot was backfilled by SQL from the same mapping (`still_unlinked: 0` across both snapshots). Name check ties out exactly (AE "Q1 Data is an Asset, Not a Liability" → the SF campaign of the same name). One design fact for the page build: the linked campaigns span **Events & Webinars and Organic SEO channels**, not just Email-channel campaigns — AE sends include webinar invites and whitepaper promos, so the Email page must present scope honestly rather than silently filtering. **And the list probe re-ran GREEN on a live 2026 list** (`UKI - Non-Attendees - Innovating with Agent 365 in the Public Sector Webinar`): memberships readable, member resolved to a real prospect email — so **event attendance (B3) is ingestable with no client export, and Margot's two-month-old ask is withdrawn** (`NEEDED_FROM_MARGOT.md` A3 struck). The first prospect 404 was diagnosed correctly: a 2023 list whose member had been deleted since — the probe now picks the newest attendance list. **Remaining builds: C12** (attendance ingestion: 2026 lists → memberships → prospect emails → email-match to SF → `fact_event_attendance`, which has waited empty since 10 Jul, feeding the Events view that already self-upgrades on data) and **the Email-page read** over `v_ae_email` (summary rates vs targets + the per-email table, EM2).
>
> **2026-08-10 (later — EVENT ATTENDEE LISTS FOUND IN ACCOUNT ENGAGEMENT; B3 may need no client export after all):** Aarav's screenshot of AE → Prospects → Segmentation → Segmentation Lists (~530 lists) shows the **event attendee / non-attendee lists per region** (`UKI - Attendees - Innovating with Agent 365 in the Public Sector Webinar`, `NL - Non-Attendees - …`, `BeLux - …`) — the exact lists B3 has been waiting on Margot to export since June, on the belief they lived only in Outreach's UI (where they are genuinely not API-reachable). `NEEDED_FROM_MARGOT.md` A3 explicitly hedged *"if these lists actually live in Account Engagement rather than Outreach, they're API-reachable via the Pardot connection — confirm which system"* — the screenshot answers it: **they live in AE.** Also visible: `2026 - Downloads - Becoming Frontier…` lists, which bear on the parked M2 whitepaper-downloads-basis question (a per-list download count could reconcile responders-vs-downloads without Margot's form-tool export). **Built `workflows/pardot_list_probe.json`** (read-only, strictly serial — every `$()` reference verified wired upstream, the lesson from the same-day n8n error): v5 `/objects/lists` (single page, limit 1000, truncation reported) → membership read for one attendee list → prospect lookup for one member, ending in a single verdict node. The prospect **email** is the payoff field: it joins attendance to Salesforce contacts/leads by the same email-match the Outreach feed already uses, which would light up `fact_event_attendance` (built 10 Jul, still 0 rows) and the Events attendance-by-region view with **zero client action** — withdrawing an ask that's been on Margot's list for two months.
>
> **2026-08-10 (later — AE PAGINATION RULE: `nextPageToken` must travel ALONE):** First run of the bridge-enabled ingestion 400'd on the campaign catalogue: *"nextPageToken cannot be combined with orderBy, limit, deleted, offset, or filter parameters."* AE v5's cursor must be the **only** query parameter on follow-up requests, but n8n's update-a-parameter pagination re-sends the original query string every page — so any AE v5 call that actually needs page 2 breaks. The 7 Aug email run passed only by luck: page 1 satisfied its stop condition, so the token was never followed; the campaign catalogue is bigger and wasn't so lucky. Nothing partial was written (the workflow died before any upsert). **Fix: no n8n pagination on either AE call.** Both fetch a single page at AE's maximum `limit=1000` (vs 133 in-scope emails and ~a-few-hundred campaigns today), and truncation is made LOUD instead of silent: the email branch throws only if a token is present **and** the oldest fetched row is still inside the 2026 window (a leftover token beyond a pre-2026 row is provably harmless — everything past it is older still); the campaign branch throws on any token at all, because a partial **bridge** would quietly load emails campaign-less and under-group the page. If either throw ever fires, the fetch needs a real token-following loop with the token sent alone — a known, documented next move rather than a mystery.
>
> **2026-08-10 (CAMPAIGN BRIDGE SOLVED — the link lives on the AE side, not Salesforce's):** Probe 4 ran with both controls passing. **The AE campaign object carries `salesforceId`** — the Salesforce campaign each AE campaign syncs with — and that is the only live end of the bridge, because `pi__Pardot_Campaign_Id__c` is NULL on all 514 Salesforce campaigns (it populates when a campaign originates in Pardot; CWSI's originate in Salesforce and sync outward). Of seven candidate spellings, only `salesforceId` is valid; all 19 AE campaigns behind our 133 emails resolved by name with **zero duplicate names**. Three caveats built in rather than assumed away: **(1) coverage is unproven** — the one sampled campaign ("Website Tracking", AE housekeeping) has `salesforceId: null`, so the ingestion logs synced-campaign and resolved-email counts every run instead of trusting the field; **(2) 15 vs 18-char Salesforce ids** — connector ids are typically 15-char case-sensitive while our `campaign_key` is 18-char SOQL, so the ingestion converts with the standard suffix algorithm, verified against a reference pair, never prefix-matching; **(3) dangling ids can't corrupt the join** — the resolved key is validated against `dim_campaign` before writing (COALESCE falls back to the old `pardot_campaign_id` route should Salesforce's field ever populate). `pardot_email_ingestion.json` now pulls the AE campaign catalogue each run (`AE: Get Campaigns`, paged + throttled) and writes `campaign_key` directly. **Also verified the 7 Aug Salesforce run was healthy** (2,727 rows fresh-loaded, zero stale, `audience_size` on 501/514, funnel sane at 867 leads / 856 MQL / 193 SQL / €510,730 won; the single margin>revenue row is a 2023 credit-memo outside the 2026 scope). **Next:** one re-run of `pardot_email_ingestion` → new snapshot rows carry real `campaign_key` → backfill the 7 Aug snapshot by SQL → build the Email-page read.
>
> **2026-08-07 (EMAIL ENGAGEMENT IS LIVE IN THE WAREHOUSE — 133 emails, 332,697 sends; campaign bridge failed and needs a different route):** Both workflows ran. **`fact_ae_email` now holds real email engagement for the first time in this project's history:** 133 AE emails, all inside 2026 (**2026-01-08 .. 2026-08-06**), one snapshot date, **zero rows with sent=0**, and **zero future-dated rows** — the scheduled-send filter did its job (the 2026-09-17 "Reminder 2" and friends are correctly absent). Aggregate 2026: **332,697 sent · 331,342 delivered · 92,653 unique opens · 27,639 unique clicks · 606 opt-outs · 1,055 hard bounces** → **delivery 99.59% · open 27.96% · unique CTR 8.34% · unsubscribe 0.18% · hard bounce 0.32%**. Sanity: these are healthy marketing-list numbers and a completely different picture from the 2023 email the probe sampled (62% delivery, 35% hard bounce) — that one was an old list, not the current programme. **Against the placeholder KPI targets this beats two of them** — CTR target 5.0% vs **8.34%** actual, unsubscribe ceiling ≤0.30% vs **0.18%** — which are the first real actuals those two register rows have ever had (they were `🔴 impossible` a day ago). **The grain decision is vindicated by the data:** the 133 emails sit behind only **19 Pardot campaigns**, 15 of which carry more than one email and one carrying **28** ("Q1 2026 Webinar UK/IRE: Data is an Asset, Not a Liability", 65,156 sends, 31.9% open). The old campaign-keyed `fact_email_engagement` would have collapsed 133 rows into 19 and destroyed exactly the per-email comparison Margot asked for. The names also confirm we're looking at the right campaigns — Becoming Frontier, Apple for Enterprise Tech Deep Dive, Microsoft E7 Suite, Protect Data Power AI, Data is an Asset are all Margot's named campaigns. **What did NOT work: the Salesforce-side campaign bridge.** `Campaign.pi__Pardot_Campaign_Id__c` came back **NULL on all 514 campaigns**, so all 133 emails loaded with `campaign_key = NULL` (`ae_campaign_id` is populated on every row, so nothing is lost and the link is re-derivable without re-hitting the API — that design call paid off immediately). Most likely cause is directional: that External ID is populated when a campaign **originates in Pardot**, and CWSI's campaigns are created in Salesforce and synced outward, which leaves it blank. **Built probe 4** (`workflows/pardot_campaign_bridge_probe.json`) to try the link **from the AE end instead**, which would be strictly better — an AE campaign usually carries the Salesforce id it syncs with, giving an exact join with **no Salesforce change at all**. It tests the several spellings the field goes by across AE API generations (`salesforceId`, `salesforceCampaignId`, `crmId`, `crmFid`, `fid`, `sfdcId`, `externalId`), one per request with the positive/negative control pair, and separately resolves the **names** of our 19 campaigns so we can judge whether a name-based match is a viable fallback — including a duplicate-name check, because a name join that's ambiguous by construction should be ruled out before anyone proposes it. **Note the ambiguity we have NOT resolved:** the NULL result is consistent both with "the Salesforce field is genuinely empty" and with "the run used the n8n copy of the workflow rather than the re-imported patched file" — `audience_size` populated on 501 campaigns either way, so the database can't tell them apart. Worth confirming before concluding anything about the Salesforce field.
>
> **2026-08-07 (ACCOUNT ENGAGEMENT — ingestion COMPLETE; the AE→Salesforce campaign bridge built; two data traps caught):** Probe 3 came back with **both controls passing**, so its field verdicts are trustworthy. **`campaignId` is VALID** (sample `28237`) along with `isSent`, `isPaused`, `operationalEmail`, `isOperational`, `clientType`, `emailTemplateId` — while **every** remaining counter name (`deliveredCount`, `openCount`, `clickCount`, `uniqueClickCount`, `optOutCount`, `unsubscribeCount`, `hardBouncedCount`, `spamComplaintCount`, `stats`) was rejected as an unknown field, which closes that question permanently: there are **no counters on the AE email object** and the v4 `do/stats` call is mandatory, not a workaround. **The finding that changed the design: `campaignId` is a PARDOT id, not a Salesforce one.** `28237` is five digits; Salesforce campaign ids are eighteen characters. So an AE email does not point at a Salesforce campaign, and without a bridge the feed could report per-email opens but never group them by campaign — which is how the Email page, and every other campaign view, is organised. Salesforce already maintains the counterpart, **`Campaign.pi__Pardot_Campaign_Id__c`** (a Text(10) External ID installed by the Account Engagement connector), and we were **not ingesting it**. Now wired end to end: `salesforce_ingestion.json` pulls it in `SF: Get Campaigns`, carries it through `Map Campaigns to dim_campaign` and writes it in `Upsert dim_campaign` (backup `salesforce_ingestion.json.pre-ae-bak`); new migration `20260807000000_dim_campaign_pardot_id.sql` adds `dim_campaign.pardot_campaign_id` with a partial index on the current record; the AE upsert resolves `campaign_key` through it, **pinned to the current SCD2 record**, and stores `ae_campaign_id` regardless so an unresolved link can be re-derived later without re-hitting the API. Chosen deliberately over **matching AE emails to Salesforce campaigns by name** — the fragile route we already have to live with on the GoToWebinar feed (which matches on a date embedded in a campaign name). Coverage of the Salesforce field is **unverified** until the next run; unmatched emails load with `campaign_key = NULL` and stay reportable per email rather than being dropped or guessed at. **Windowing settled: `orderBy=sentAt desc`** is the only ordering syntax AE accepts (`-sentAt` → "Unknown field name"; `sentAtAfter` and `sentAtAfterOrEqualTo` are *recognised* but rejected our ISO-with-`Z` values as "Invalid date time value" — a different format may well work, but newest-first paging with an early stop is strictly more robust, so it wasn't chased). **Good news: CWSI is actively sending in 2026** — the earlier worry that AE might hold nothing but 2023 sends is dead. **🚩 Two traps caught before they could produce plausible-looking wrong numbers.** (1) **AE returns FUTURE-DATED sends** — the newest email in the account is "NL - The Governance Gap: Why AI Fails Without Identity Discipline - Reminder 2" dated **2026-09-17**, about six weeks *after* the run date, because scheduled emails carry their scheduled date in `sentAt`. Ingesting those would add rows with zero engagement (nothing has been sent yet) and **silently drag every open and click rate down**. Now filtered three independent ways — `sentAt >= 2026-01-01`, `sentAt <= today`, `isSent !== false` — with **every drop logged by reason**, because a silent filter is how a total quietly stops reconciling. (2) A **missing comma** in the draft migration (`is_operational boolean` with no trailing comma) would have failed the `CREATE TABLE`; caught before applying. **Ingestion is now complete and TODO-free:** newest-first catalogue with real cursor pagination that stops as soon as a page ends before 2026 (so it never walks history back to 2023) → de-dupe across pages + the three scope filters → v4 stats at 1 req/1.5s with retries → rows paired **by index** (pairedItem is unreliable after a fan-out) → upsert. Failed stats calls are **skipped loudly, never written as zeros** (a zeroed row is indistinguishable from a real email that got no engagement), AE is cross-checked against itself on `delivered + bounces == sent`, and operational/transactional emails are **flagged, not dropped**, so the raw feed stays auditable and the page decides. `fact_ae_email` gained `ae_campaign_id` + `is_operational`; `v_ae_email` now joins `campaign_name`. **Remaining (all ours, OPEN_ITEMS D5):** apply the two migrations (the AE one **REVOKEs anon**, which Supabase auto-grants) → re-run the Salesforce ingestion so `pardot_campaign_id` populates (the same run already pending for `audience_size`) → run the AE feed and read its log line → build the Email-page read over `v_ae_email`.
>
> **2026-08-07 (ACCOUNT ENGAGEMENT — COUNTER SOURCE FOUND; ingestion wired; two probe bugs of my own fixed):** Ran the follow-up probe and got the answer that unblocks the whole email-engagement build. **The counters are not in the v5 API at all** — the v5 email object exposes only metadata, `v5/objects/list-email-stats` 404s, and every counter-shaped v5 field name (`sentCount`, `uniqueOpenCount`, `bounceCount`, `emailStats`) is rejected as unknown. They live on the **legacy v4** endpoint `email/version/4/do/stats/id/{id}`, which returned, for email 84390732: **sent 863 · delivered 538 · hard_bounced 305 · soft_bounced 20 · opens 161 / unique_opens 119 · total_clicks 4 / unique_clicks 3 · opt_outs 20 · spam_complaints 0**, plus AE's own computed rates. It is internally consistent — `delivered + soft + hard == sent` (538+20+305 = 863). **Reverse-engineered all six of AE's rate bases and matched them to two decimals**, so our figures will tie to what CWSI sees in the AE UI instead of quietly disagreeing: delivery = delivered÷sent (62.34%) · open = **unique** opens÷delivered (22.12%; raw opens would read 29.93%) · CTR = total clicks÷delivered (0.74%) · unique CTR = unique clicks÷delivered (0.56%) · **unsubscribe = opt-outs÷delivered** (3.72%) · click-to-open = unique clicks÷unique opens (2.52%). **Three findings beyond the field names.** (1) **v4 is a legacy API generation** — the only route to these counters today, but Salesforce has been retiring older Pardot API versions, so a future 404 is the API sunsetting, not our code; noted in the workflow itself so the next person doesn't debug the wrong thing. (2) **AE rate-limits hard:** 21 of the 35 field requests came back `429 concurrent request limit`, because n8n's HTTP node fires all input items concurrently by default — everything is now throttled to 1 request/1.5s with retries. (3) **That 2023 email hard-bounced 305 of 863 (35.3%) and delivered to only 62%**, so the Email page needs delivery and bounce rates, not just opens — a page showing opens alone would hide a list-quality problem that large. **Two bugs in my own probe, reported rather than buried.** Its `counterSource` named the *wrong* endpoint (the v5 object) because the counter regex matched `sentAt` — a timestamp; fixed so a counter must be numeric and non-date and an endpoint needs at least two before it can win. And its field list was **incomplete, not authoritative**: the 429s were bucketed as rejections, so it reported 8 valid fields when the real number is higher — provably, `name` sat in the rejected bucket while probe 1 had already returned it. Genuinely valid: `subject`, `createdAt/ById`, `updatedAt/ById`, `sentAt`, `folderId`, `trackerDomainId`. Genuinely invalid: `replyToOptions`, `sentCount`, `uniqueOpenCount`, `bounceCount`, `softBouncedCount`, `emailStats`. The rest undecided — including **`campaignId`**, which is how an AE email joins to a Salesforce campaign and therefore how the Email page groups anything. **Built probe 3** (`workflows/pardot_email_window_probe.json`) for exactly the two things still unknown: it retests only the undecided fields one at a time with a **positive control** (`name`, known valid) and a **negative control** (an impossible field) so an untrustworthy run announces itself instead of handing over a plausible field list, and it settles **how to window AE to 2026** — everything AE has returned so far is 2023 because `list-emails` pages oldest-first — by trying 5 ordering/date-filter syntaxes and then running the v4 stats call on the newest email found, to confirm the counters are populated for a *recent* send and not just the 2023 one. **Ingestion now wired to what's confirmed, zero TODOs left** (`workflows/pardot_email_ingestion.json`): `AE: List Emails` → **`Filter to 2026 + Explode`** → `AE: Email Stats` (v4, throttled) → `Build AE Email Rows` (v4 field names, paired **by index** because pairedItem is unreliable after a fan-out — the GoToWebinar lesson) → `Upsert fact_ae_email`. It **throws rather than truncates** when AE signals more pages (a partial catalogue that looks complete is worse than a failed run), throws with the actual date range if nothing in 2026 comes back so "no 2026 sends" is distinguishable from "wrong paging", **skips failed stats calls loudly instead of writing zeros** (a zeroed row is indistinguishable from a real email with no engagement), and cross-checks AE against itself on `delivered+bounces == sent`. **Migration corrected to the confirmed shape** (still unapplied): dropped the duplicate `unsubscribes` column — AE reports **one** opt-out counter, and two columns holding one measurement is how a metric ends up double-reported — and fixed `v_ae_email`'s denominators to AE's own bases (**the draft divided unsubscribes by `sent` instead of `delivered`**), adding `delivery_rate`, `hard_bounce_rate` and `click_to_open_rate`. **Next:** run probe 3 → set `Config.campaign_id_field` → apply the migration (it **revokes anon**, which Supabase auto-grants on new tables) → build the Email-page read.
>
> **2026-08-06 (PARDOT / ACCOUNT ENGAGEMENT PROBE — GREEN; the "email engagement is impossible" finding is FALSIFIED):** Ran `workflows/pardot_email_probe.json` (setup per `docs/PARDOT_SETUP.md`) and it came back **`pardot_api: REACHABLE`**, returning 10 rows off the Account Engagement v5 `list-emails` endpoint (e.g. `84390732 · "Save The Date: Connectivity Tour 2023" · 2023-04-28`). That single result clears all three prerequisites at once — the Business Unit ID is valid, the Salesforce user is a recognised AE user, and the Connected App carries the `pardot_api` scope. **Why this matters beyond one workflow:** since 19/20 Jun the build has recorded email **opens / click-through / unsubscribe / reader→MQL** as *impossible in this org*, because the Salesforce probes found no `pi__` objects, no queryable `ListEmail`, and the Campaign engagement rollups (`UniqueEmailOpens`, `TotalEmailsDelivered`) erroring with "No such column" — so the Email page shipped **sends-only** (`fact_email_engagement`, Path A) and those four KPIs were written up as permanently n/a in `KPI_REGISTER.md`, `REMAINING_THINGS.md`, `DASHBOARD_VS_MOCKUP.md`, `SALESFORCE_TODO.md` and the client-facing answer docs. That conclusion was about **Salesforce SOQL**, and Account Engagement is a separate platform on its own API — which is now proven reachable. Those metrics move from **impossible → not yet built**, and the affected doc rows need re-wording (tracked as OPEN_ITEMS **B1a**; the client-facing docs must be corrected before the next review, since we have twice told Margot/Paul this was not obtainable). **Two caveats recorded rather than glossed:** (1) the probe's `availableFields: [id, name, sentAt]` is **not** a full field list — the request itself asked for exactly those three (`?fields=id,name,sentAt`), so it is no evidence that engagement counters are missing; in AE v5 the counters live on a separate stats endpoint anyway. (2) The rows returned are **2023** sends — the default page is oldest-first and AE holds history well outside our 2026-only scope, so the ingestion needs an explicit sort + date filter or it will resurface exactly the kind of pre-2026 legacy rows we stripped from this fact table on 1 Jul. **Next (B1a, no client action needed — same credential):** re-run `list-emails` without the `fields=` allow-list to dump the real field set, and read per-email sends/delivered/unique-opens/unique-clicks/unsubscribes for one known id (`84390732`) to fix the table shape. **Then (C1):** build the ingestion into a fresh engagement table, 2026-filtered and joined to `dim_campaign`, replacing the sends-only `fact_email_engagement` (currently empty for 2026), and light up real open/CTR/unsub rates plus the **per-email breakdown** Margot asked for (EM2).
>
> **2026-08-06 (4 AUG FEEDBACK TICKETS — Outreach metrics verified · campaign/email table asks built · sales-split mechanism · data-refresh visibility):** Worked the remaining tickets from the 4 Aug review-call batch.
>
> **Verify Outreach.io summary metrics — the figures were RIGHT; the scope and basis were unstated.** Reconciled against the live warehouse: the marketing workstreams hold **318 prospects / 30 replies** (the "319" quoted on the call), against **3,581 prospects / 353 replies across the whole Outreach.io account** — so anyone comparing our card to the native dashboard sees roughly **10× more**, because that view includes the 125 sales and one-off account sequences we deliberately exclude. It is **not Q2-scoped** — these are all-time running per-sequence counters and the quarter pill genuinely cannot move them. The substantive finding is the **basis**: 8.8% (now 9.4%) is **per person** (replies ÷ prospects); Outreach.io's own reporting is **per email** — the same scope reads **1.2%** (12 replies ÷ 988 delivered), because a multi-step cadence sends several emails per prospect. **Both bases now render on the reply-rate card**, the all-time scope + refresh date are stated on the cards themselves (not just the page sub-head), and a reconciliation callout sits above them. Surfaced two things honestly rather than smoothing them. **(1) A real contradiction in Outreach.io's own counters** — initially written up as a harmless units difference, then disproved: for the SAME 3 Aug snapshot its per-sequence counter reports **30 people replied** while its per-step counters record **12 reply events**, on **9 sequences**, and one sequence shows 3 replies against 0 contacted prospects. People cannot reply without generating a reply event, so one counter is not measuring what its name says, and the dashboard now flags the per-person figure as the softer of the two rather than presenting both as equally solid. Built `v_outreach_reconciliation` to settle it in data: per programme it lines up all four bases (Outreach's rollup counters · prospect-level records · mailing-level records · what the dashboard renders) with variance columns — so the outstanding acceptance point is closed by **API, not by reading the Outreach UI**. It needs `outreach_report_sync` (already built) to finish: `outreach_sequence` has 117 rows from 30 Jul but `outreach_mailing` / `outreach_sequence_state` / `outreach_prospect` are still **empty**. **(2)** the blended rate is depressed because **every reply comes from Historic Data Reactivation (33%)** while SoPro and Microsoft TUM sit at **0.0%** — consistent with the paused cold sending discussed on the call. Doc: **`docs/OUTREACH_METRICS_RECONCILIATION.md`**, with the exact figures for CWSI to check in the Outreach UI (the one acceptance point we cannot reach from the build).
>
> **Campaign & email table enhancements — all three asks delivered.** (a) **Opportunity columns** (Paul: "another column that had the number of opportunities… to marry up") — *Opps* + *Qualified*, shipped alongside the attribution fix. (b) **Audience / enrolled on email campaigns** (Paul: "how many people were actually enrolled… number of people we sent it to") — needed no new Salesforce field, because we already ingest **every** CampaignMember and only narrow to responders when building the funnel, so audience is simply the member count. Added `dim_campaign.audience_size` + `number_sent` (migration applied, `v_fact_enriched` re-issued, **anon revoked / authenticated granted** per the standing gotcha), plus two new nodes in the Salesforce workflow (**Build Campaign Audience** → **Update campaign audience**) fed off the members node so ordering is safe. Reads "—" until the next ingestion run, per the established pattern. (c) **Column-header sorting** (Robin: "can you filter from best to worst?") — new `components/SortableTable.jsx`; every column on the Campaigns, Events and Email tables sorts, numbers high→low on first click, and missing values always sink to the bottom so an unpopulated column never buries real data.
>
> **Separate sales-generated Outreach from marketing-influenced — mechanism built, default OFF.** Keyed on campaign **TYPE, not name**, per Robin's warning that campaigns are also used to group contacts for sequences. **The blocker: Salesforce has no sales campaign type** — all 11 types in use are marketing types, and the sales-generated campaigns are sitting on them. So `src/data/attribution.js` carries an (empty, ready) type set plus a short, individually-evidenced key list: *BLAUD - SoPro Intune Health Check* and *Hubspot Imports*, both typed `Advertisement`, worth **€30,965 open pipeline + €31,142 closed-won + €11,867 margin**. Three more are held pending a client judgement about partner-sourced revenue (*Salesforce Connector* — Other, €53,660 won; *FY26 UKI Major Growth MAL* — Partners; *SME&C Co Sell* — Referral Program). The Overview shows the split as **a separate row with a toggle and deducts nothing by default**, so no figure moves under a reader who has already seen it, while the amount at stake stays visible either way; flipping the default is one line. Doc: **`docs/OUTREACH_AND_SALES_SPLIT.md`**, with the three asks for CWSI (A10).
>
> **Access, targets & data refresh (P2, "details to be filled in") — delivered the one concrete part.** New `v_data_freshness` view + a **Data refresh** panel on Settings showing, per source, when we last pulled the feed **and** the most recent date that feed's data covers — two separate dates on purpose, since a feed can refresh today and still only carry data to last week. It immediately surfaced a real gap: the **marketing budget & spend sheet has not been refreshed since 14 Jun**. Access and targets are already covered (Supabase Auth; editable `kpi_targets` with placeholder values pending A3), so the rest of that ticket waits on the client's actual asks. `vite build` ✓ throughout.

> **2026-08-06 (CAMPAIGN ATTRIBUTION UNDER-REPORTING — window bug FIXED; primary-source gap probed):** The two campaigns called out on the review call turned out to be **two different problems**. Canonical write-up: **`docs/CAMPAIGN_ATTRIBUTION.md`**.
>
> **Case 1 — 22.04.2026 UK Protect Data, Power AI event: the data was complete, the reporting WINDOW was wrong.** The warehouse holds precisely what Robin described — **10 opportunities, €143,084**, including the large one — so nothing was missing from the ingestion. But results are dated by the deal (open opps by created date), and that campaign's biggest opportunity was **created 13 Jan**, so with the **Q2** pill selected the events list showed **€50,232 open pipeline instead of €114,887 — 45% of the campaign's qualified pipeline invisible** purely because of the quarter filter. Not a one-off: across 2026, **9 campaigns are split across quarters and €113,450 of €546,388 (21%) of open pipeline disappeared whenever a single quarter was selected**. **Fixed** with a new shared `campaignRows()` helper in `queries.js`: per-campaign tables now show each campaign's **whole-2026 contribution** (so a row ties to the campaign record in Salesforce), while the quarter pill still decides *which* campaigns are listed (the M3 stale-campaign rule is preserved) and every row also carries its `period` figures so the "current view" KPI tiles keep their period basis — nothing was silently redefined. Applied to the **Events** and **Email** campaign lists; **Campaigns by Theme** already read the full year (which is why that page alone looked right). The pages now state on screen that a campaign table can exceed the quarter tiles above it, and why. **Also delivered Paul's explicit ask** ("another column with the number of opportunities… to marry up"): **Opps** (every opportunity created off the campaign, incl. *Unqualified opp*) and **Qualified** (genuine stage, still open or won — what Open Pipeline sums from) on the Events, Email and Campaigns tables. That pair explains a further **€14,085 across 3 unqualified opps** plus a €1,250 closed-lost on the same campaign, with one €7,042 won deal closing 31 Jul (beyond the 30 Jun window). Ruled out first: **campaign hierarchy** (none of the named campaigns has a parent or children) and any general row loss in our read. Verified by unit-checking the shipped helper (50,232 → 114,887; period basis preserved; M3 rule still drops zero-contribution campaigns) + `vite build` ✓. Known remaining cause, by design: opportunities carry their own account region, so 3 region-unassigned opps on this campaign still drop out when a specific region is selected — view All Regions to see a campaign whole.
>
> **Case 2 — 18.06.2026 Agent 365 in the Public Sector genuinely has ZERO opportunities by primary campaign source** (139 responders, 8 SQLs, no opportunity anywhere in the warehouse — not a window issue). Three more campaigns show the same shape, including the **Becoming Frontier whitepaper Paul flagged separately** on the call (28 responders / 17 SQLs / 0 opps). Cause is almost certainly that we read `Opportunity WHERE CampaignId != null` — and `Opportunity.CampaignId` is the **Primary Campaign Source: ONE campaign per deal** — so a webinar that contributed to a deal primarily sourced elsewhere contributes nothing. Rather than rebuild attribution blind, built **`workflows/campaign_attribution_probe.json`** (read-only): per named campaign it compares Salesforce's own `Campaign.NumberOfOpportunities` rollup, the primary-source opps we ingest, `CampaignInfluence` rows (if Customizable Campaign Influence is on), and opps whose **contact is a campaign member but whose primary source is another campaign** — the honest upper bound on what multi-touch would add. Its verdict separates the three real possibilities (ingestion gap / influence loss / genuinely zero) and emits the matching recommendation. **Pending: run it (B4).** If influence data exists, influenced figures land as a **second, clearly-labelled basis alongside** primary source, never added to it — under multi-touch every campaign touching a deal claims the same money, so summing the two would inflate influenced pipeline. That is a client reporting decision (**A9**).

> **2026-08-06 (METRIC DEFINITIONS LOCKED & SURFACED IN THE UI):** Settled the two definition questions left open on the review call and wrote the answers into the product, so a reader never has to ask them again. Canonical write-up: **`docs/METRIC_DEFINITIONS.md`**.
>
> **(1) Basis — revenue or gross margin?** Traced through the ingestion: `pipeline_value`, `created_opp_value` and `closed_won_value` are all `Opportunity.Amount` (EUR) → **revenue**; `margin_value` is `Gross_Profit_Value__c`, else `Amount × Gross_Profit_Margin__c` → **gross profit**, with a deal that has neither excluded rather than counted as full revenue. So Influenced Pipeline is revenue and Influenced Margin is gross profit — two different bases, now stated on the face of each figure. **And it does vary by opportunity type, as Paul said:** own-services deals set revenue = margin in Salesforce. Quantified against the live warehouse (H1 2026): of 24 won-deal records, **20 carry gross profit equal to the full deal value, 4 carry a real margin, 0 are missing it** — blended **€406,148 GP on €448,058 revenue (~91%)**. Also surfaced the trap behind Paul's original question: the company's own €4.1m quarterly pipeline is a **gross-margin** number, so dividing our revenue-basis figure into it is not like-for-like — the dashboard now says to compare Influenced *Margin* against the closed-won gross-margin figure instead, and offers a gross-margin pipeline metric as an option (the GP fields are already read for every opp, won or open — see A8).
>
> **(2) Dating — start date or close date?** Neither alone, and the two axes are now named explicitly. A **campaign** is placed in a quarter by when it **STARTED** (the date in its name, else Salesforce `Campaign.StartDate`) — a campaign's **end/close date is never used anywhere**. The **results** against it are dated by the **deal or the response**: an open opportunity by `CreatedDate`, a closed one by `CloseDate`, Created Opps / New Pipeline Created always by `CreatedDate`, a responder by the day they responded. Quantified why it matters: in H1 2026 campaigns that started in an **earlier** quarter carry €390,983 open pipeline + €338,173 won, versus €83,655 + €9,950 for same-quarter campaigns — most of any quarter's money comes from older activity, which is what the current-vs-ongoing view exists to show. Campaign tables are ordered by contribution, not by time (the other half of what was asked on the call).
>
> **Written into the UI, not just the doc:** labels now carry the basis — *Influenced Pipeline (revenue)* · *Influenced Margin (gross profit)* · *Closed-Won (revenue · by close date)* — across Overview, Pipeline, Channel, Events, SEO, the KPI Tracker register, the board pack metric set, and the report + Gamma PPT exports. The `pipeline` / `margin` / `closedWon` / `createdOppsValue` explain notes state the basis and the own-services nuance; a new **"How campaigns and results are dated"** explain note (`campaignDating`) covers both axes and is attached on the Campaigns and Pipeline pages; basis callouts added to Overview, Pipeline and Campaigns. Two client confirmations opened off the back of it (**A7** — are all 20 equal-value deals genuinely own-services, or is cost simply not entered? **A8** — do you want a gross-margin pipeline metric alongside the revenue one?). `vite build` ✓.

> **2026-07-30 (OUTREACH ALL-TIME PROGRAMME REPORT — reporting layer built; awaiting one n8n run):** Built the pipeline behind the client-facing Outreach report covering the three outbound programmes (Secure Outbound · Microsoft · SoPro). **First, settled the question the report hinged on: the 8 Jun document was genuinely all-time, not weekly, so it is correctly labelled and does not need retracting.** Proved it from the warehouse rather than assumed — lifetime counters only ever grow, so a 7-day pull would sit *below* the 14 Jun snapshot on every row; instead they match it exactly (Secure Data/Chris 91 sent both; Secure Endpoints/Chris 18/2 both; Secure Identity/Chris 13/6 both; Secure AI/Connor 9/9 both). **What IS wrong with that document is different and now fixed by construction:** (1) `Sent` exceeded `Assigned` in six rows with no definition line — the figures are right (a multi-step sequence sends several emails per prospect) but the columns count different units; (2) opens were **raw pixel fires, not people** (Connor/Threat Protection read 44 sent vs 36 opens); (3) it is badly stale — sent went 419 (8 Jun) → 977 (1 Jul), and Barry-John, reported at **0 sent across 260 assigned**, had ~131 emails out by 14 Jun. **Root cause of why none of this was fixable in place:** every existing Outreach feed stores Outreach's *lifetime counters* stamped with the run date, and those counters cannot be sliced by time at all — so "all-time" was whatever the last run captured and "weekly" was impossible. **Built a second, parallel reporting layer at row-per-object grain** (`supabase/migrations/20260730000000_outreach_report_layer.sql`): `outreach_sequence` · `outreach_user` · `outreach_prospect` · `outreach_sequence_state` · `outreach_sequence_step` · `outreach_mailing`, the last being one row per individual email carrying `delivered_at` — so any window is a `WHERE` clause and all-time is no clause at all, killing the weekly-vs-all-time ambiguity permanently instead of re-deciding it per report. Plus rollup views `v_outreach_report_by_seller`/`_programme`/`_region`/`_sequence`/`_step`, base views `v_outreach_mailing`/`v_outreach_assignment`, and `v_outreach_meeting_attribution`. **`fact_outreach_*` untouched — the dashboard still reads those.** RLS + `authenticated_read` policies applied and **anon revoked on all six tables** (Supabase auto-grants it on create). **New `workflows/outreach_report_sync.json`** (24 nodes, weekly Mon 05:00): `/sequences?include=owner` → `/users` → sequence ids chunked 20-at-a-time through a batch loop for `/sequenceStates` (+ side-loaded prospects), `/mailings`, `/sequenceSteps`; n8n cursor pagination on `links.next`. Three non-obvious things handled. **`filter[name]` is an EXACT match, not a substring search** — the first build used `filter[name]=CWSI` and the sequences call returned an empty `data[]` on the first run, because Outreach looked for a sequence literally *named* "CWSI"; all sequences are now fetched and the CWSI/test filtering happens in `Map Sequences`, the way `outreach_ingestion.json` already did it (should have followed the existing pattern from the start). Outreach also **deprecated filtering on relationship attributes**, so `filter[sequence][name]` does not work on mailings and the ids must be fetched first; and a Code node emitting **zero items leaves the next Postgres node unexecuted and stalls the batch loop** — which BeLux/NL would trigger immediately since they have prospects assigned but nothing sent — so every mapper returns at least one row and a null-`id` sentinel is discarded by the upsert's `WHERE $1 IS NOT NULL` (**verified against the live DB: sentinel wrote 0 rows, real row upserted**). **Report definitions corrected in the views, not in prose:** `Prospects emailed` is now a column and every rate divides by it (never by Assigned, or the not-yet-started BeLux/NL zeros drag every blended figure down); opens/replies count **distinct people** with raw events kept as a separate secondary column; the document's section 2 states all of it. **Meetings need no manual step and no chasing the Outreach→Salesforce plugin mapping** — Outreach's v2 API has no meetings resource, but the dashboard already credits Salesforce meetings to a sequence by contact-email match, so the report reuses exactly that method and the two agree. **Also built:** `scripts/outreach_report_payload.sql` (one query → the entire report as JSON; all-time by default, any window by setting two dates in one CTE) and `scripts/build_outreach_report.py` (JSON → .docx, using the delivered June report as the **template** so the CWSI logo/headers/footers/fonts/table styles are that file's, not a reconstruction). **Verified:** payload query runs end-to-end on the live DB and returns the correct shape; generator smoke-tested against a synthetic payload → valid OOXML, 8 tables, all sections and definition notes present (caught and fixed a bug where pre-rendered runs were being XML-escaped into literal text). **Pending — one operational step, not a build step:** import `outreach_report_sync.json` on **cwsisecurity.app.n8n.cloud** (the Outreach credential lives there, not on braind) and run it once; the six tables are live but empty until then, after which the report is two commands. **Also built, and now the preferred route (Aarav, 30 Jul): `workflows/outreach_report_export.json`** — a **read-only** sibling (11 nodes, manual trigger) that writes nothing anywhere and instead returns the **entire report as one JSON object** (~45–50 kB at 117 sequences) on the last node, to paste into Claude which writes the document. Same Outreach calls, same corrected definitions, same email-matched meetings (via a read-only `SELECT` on `fact_meeting` that **fails soft**, so a missing Postgres credential still yields a payload with `data_quality.meetings_source` flagging meetings as unavailable → the report says "not available" rather than 0). **It aggregates in-workflow on purpose:** the raw pull is ~2k mailings, which is both too much to paste and would leave the metric definitions to be re-derived by hand every report — so the rollup happens once and the `definitions` block ships *inside* the payload. Includes `by_month`, so a weekly or monthly cut needs no second pull. `executeOnce` is set on the later HTTP nodes because a paginated node emits one item per page and each would otherwise re-trigger the next node. **The `mailings` scope turned out to be OPTIONAL, which matters because the credential may not carry it:** `/sequenceStates` exposes per-prospect `deliverCount`/`openCount`/`clickCount`/`replyCount`/`bounceCount`, which is enough for every corrected definition — including **opens/replies as distinct people, the substantive June error**. So the Mailings node **fails soft** (`onError: continueRegularOutput`, no retry) and `Build Report Payload` falls back to state counters automatically, recording which basis it used in `data_quality.basis` + a `basis_note` stating the limits. **Proven equivalent:** with state counters mirroring the mailings, both bases produce **byte-identical** `totals`, `by_seller`, `by_programme`, `by_region` and `by_sequence`. Three things are genuinely lost without the scope, and the payload says so rather than papering over them: `by_month` becomes `null` (states carry no per-email dates → all-time only, no windowed reports), `by_step` degrades to event counts rather than people (each row carries a `counts` field), and prospects **since removed** from a sequence go uncounted because Outreach deletes the state, so `sent` can read slightly low. Net: the all-time report does not need `mailings` — don't block on requesting it.
>
> **2026-07-30 (OUTREACH EXPORT — 6 CORRECTNESS FIXES after a review round; the metric definitions were wrong in ways that would have shipped):** A review of the first export payload found four unit errors, and all six items are now fixed and verified in `workflows/outreach_report_export.json`. **(1) `sequenceState.deliverCount` is GROSS — bounces are inside it.** Proven on the account: SoPro M365 Review / Barry-John shows `deliverCount` 156 and `bounceCount` 113 while Outreach's own `sequence.deliverCount` is 43 — **156 − 113 = 43 exactly**, and the identity repeats on Microsoft Data Security / Connor (76 − 20 = 56). The asymmetry is the trap: the *sequence-level* counter is already net, the *per-prospect* one is not. So the payload now splits `emails_attempted` (gross, "never call this sent") from `emails_delivered` (attempted − bounces, the publishable figure) — reporting the gross number overstated delivery by ~20% on this account. It also adds `prospects_reached` (people with ≥1 non-bounced email) and **every engagement rate now divides by reach**, not attempts and never registrations, so prospects whose only email bounced no longer drag the rates down. **(2) Seller precedence inverted.** `include=owner` returns whoever *built* the sequence — us — so a BrainD name won on all 117 rows and section 2 of the report collapsed to a single line carrying the entire org's numbers. The sequence NAME now wins (CWSI's convention parses cleanly), owner is a last-resort fallback, `seller_source` records which was used, and `SELLER_ALIAS` maps the sequences named "Barry" onto Barry-John. **(3) Meetings were not being de-duplicated at all.** Salesforce writes **one Event row per attendee**, each with its own id, so `meeting_id` does not identify a meeting — 59 ids were 40 real meetings, and the three "CWSI / Medisec - DLP Discussion" rows on 16 Feb are one. Keying moved to normalised **subject + date** with leading `Following:`/`RE:`/`FW:` stripped; **verified in the warehouse** that "CWSI/Medisec : Recommandations presentation" and "Following: …" both sit on 2026-06-23 (so they merge) while "RE: CWSI / Medisec - DLP Discussion" is on a different date (so it stays separate — the date is in the key, so prefix-stripping cannot over-merge). Raw ids are kept in `meetings_detail.salesforce_row_ids` so the collapse is auditable. **(4) Registrations were being labelled as people.** CWSI loads the same prospect list onto several sequences — the SoPro lists pair almost exactly (1,048/979, 600/599, 563/509) — so the sequence-state row count is REGISTRATIONS, and 6,151 was being read as an audience size. Now `assignments` (registrations) and `prospects_assigned` (distinct people) are **separately named at every level**; per-sequence rows keep registrations, which is the correct unit there. *Deviated from the review's suggestion here on purpose:* it proposed `assigned` meaning people at total level while remaining registrations elsewhere — one name with two meanings is precisely the trap that produced June's labels, so both are explicitly named instead. **(5) `definitions` block rewritten** to the new field names — those strings are read straight into the document, which is how June's wrong definitions propagated in the first place. **(6) Pagination guard** — `maxRequests: 50` stopped silently at the cap, which would yield a plausible-looking short report with no sign data was dropped; `data_quality.pagination` now reports per-node page counts plus a `truncated` flag with a "do not publish" note. **Housekeeping:** `/mailings` is now **disabled** rather than 403-ing on every run (a disabled node passes input straight through, so the chain to Sequence Steps holds), and `basis_note` was reworded from an apology into a statement of design — sequence-state counters are the basis, all-time is the reportable period, step figures are events. **Verified by running both Code nodes against fixtures carrying the real numbers:** 156/113→43 and 76/20→56 reproduce exactly and `emails_delivered` ties to the Outreach cross-check; a bounced-only prospect is counted as attempted but NOT reached; owner "Aryamaan" never appears while the name-parse and the Barry alias both resolve; 6 Salesforce rows collapse to 2 meetings with the `Following:` variant merged and the different-date `RE:` kept; registrations 7 vs people 6. `node --check` passes on both nodes. ⚠️ **Route B (`outreach_report_sync.json` + the views + `outreach_report_payload.sql`) still carries the OLD definitions** — it treats `deliverCount` as delivered, counts state rows as people, and de-duplicates meetings on record id. Those three fixes must be ported before Route B is used client-facing; its tables are empty so nothing has shipped from it. Flagged at the top of `docs/OUTREACH_REPORT.md`.
>
> **2026-07-30 (OUTREACH EXPORT — FIRST REAL RUN validated the bounce split and exposed 3 more defects, all fixed):** Ran the export against the live account (117 CWSI sequences of 242, 6,151 registrations, 7 pages of sequence states, nothing truncated). **The headline result: `emails_delivered` came out at 987 against Outreach's own net-of-bounces counter of 988 — one apart, so the attempted/delivered split is right on real data.** The output then surfaced three genuine defects. **(1) `deliverCount` means different things at different levels.** It is GROSS on `sequenceState` but **NET on `sequenceStep`** (and on `sequence`). Caught because SoPro step 1 reported **175 bounces against 71 "attempts" and zero delivered** — impossible on its face. Confirmed arithmetically: summing step `deliverCount` as NET gives Microsoft 497 / Secure Outbound 297 / SoPro 194 against the state-derived 497 / 295 / 195; treating it as gross gave 455 / 271 / 114. `by_step` now uses `delivered = deliverCount`, `attempted = delivered + bounces`. **(2) Engagement was not a subset of reach, so open rates exceeded 100%** — Modern SecOps / Sean read 2 opens against 1 reached (200%), SoPro Copilot Readiness 133%, UEM Check 150%. Cause: a prospect whose **every** email bounced can still register an `openCount` — a security scanner or image proxy firing on the bounce — while being correctly excluded from reach. Opens/replies/clicks are now counted only for reached prospects (an "open" on a wholly bounced send is not a human reading the email), and the dropped records are exposed as `engagement_on_unreached_prospects_excluded` rather than silently discarded. **(3) Meetings were being credited to sequences that had never sent an email.** The assignment-only match gave **39 meetings** against the June report's 1 — but Robin's sequences had 51 prospects loaded and only **7 emails delivered to 4 people**, yet picked up **23 meetings**, whose subjects are plainly existing-project work (Purview kick-offs, PoC check-ins, "Carne/CWSI Catch up"). Outbound cannot have generated those. Credit now requires the prospect to have been **actually emailed and not bounced**; the looser figure survives as `data_quality.meetings_if_assignment_only`, explicitly labelled an upper bound. **Also added a top-level `caveats` array** carrying the four things that decide whether the document survives a client question: **open rate ~80% is a scanner artifact, not engagement** (norm is 20–40% — lead on replies, which cannot be faked by a pixel fetch); **bounce rate is a finding, not a footnote** (~20% overall, **72% on Barry-John's SoPro M365 list** — that is list quality, not performance); meetings are **influenced, not generated**, and Paul/Robin must confirm before they are called outbound-sourced; and BeLux/NL zeros mean "not started", never folded into a blended rate. **Verified** against a fixture reproducing each defect — no `open_rate_pct` above 100% anywhere, `opens ≤ prospects_reached`, `attempted = delivered + bounces`, step delivered ≤ attempted on every row, the excluded-engagement counter reporting 1, and a meeting on a loaded-but-never-emailed sequence correctly dropped while the emailed one is kept. `node --check` passes on both Code nodes. **Expect the re-run to move numbers:** `opens` falls below 283, every rate lands ≤ 100%, SoPro step 1 becomes 246 attempted / 71 delivered, and **meetings drop sharply from 39** — most of Robin's 23 depended on prospects who were never emailed.
>
> **2026-07-31 (OUTREACH EXPORT — reach widened, rate clamped, `by_step` dropped):** Four further edits to `Build Report Payload`. **Reach is no longer `deliver_count - bounce_count` alone:** a prospect who **opened, clicked or replied demonstrably received an email**, so they now count as reached whatever the subtraction says. The subtraction is unreliable on its own because these are aggregates across all steps and bounce events are not strictly one-per-failed-email, so it can read ≤ 0 for someone who genuinely got mail — which was suppressing real reach and dragging `prospects_reached` below its true value (339 was too low). Applied on both bases, so it holds if `/mailings` is ever re-enabled. **`rate()` now clamps at 100** as a backstop — a value above 100 means the denominator is wrong, and clamping beats publishing an impossible figure. **`by_step` is no longer emitted** (the builder is left in place; re-adding `by_step: byStepOut,` restores it). ⚠️ *Worth recording that the stated reason for dropping it — "Microsoft 455 vs 497" — was the gross/net bug fixed the day before; read correctly as net, the step sums DO tie (497 / 297 / 194 against state-derived 497 / 295 / 195). It is dropped because step counters are a different lineage from the sequence-state counters, not because they fail to reconcile.* **One consequential rename:** `engagement_on_unreached_prospects_excluded` became `prospects_reached_via_engagement_only` (+ an explanatory note), because after widening the reach test nothing is excluded any more — leaving a field asserting records were dropped when they are now counted would have been exactly the kind of false label in the payload that this whole round of fixes exists to eliminate. It now measures how often the subtraction alone would have been wrong. **`emails_delivered` is untouched and still validates at 987 against Outreach's 988.** Verified on the fixture: no rate above 100 anywhere, `by_step` absent, `prospects_reached` up (4→5) while `emails_delivered` held (99), `opens ≤ prospects_reached`, `attempted = delivered + bounces`, and the diagnostic reporting 1. `node --check` passes. **On the real re-run the acceptance range 56.3–83.5% for `totals.open_rate_pct` corresponds exactly to `opens` 283 over `prospects_reached` between 503 and 339** — so the check is really "did reach land between attempted and its old under-counted value". **Verified by running the aggregation JS against synthetic data:** one prospect with 3 emails correctly yields `sent` 3 / `prospects_emailed` 1; `open_events` 6 vs `opens` 2 *people* (exactly the June error); undelivered and out-of-scope mailings excluded; case-insensitive email match; and the not-yet-sending region returns `null` rates rather than 0 so it cannot drag blended figures down. Both workflows' Code nodes pass `node --check`. Runbook + the June-report findings in `docs/OUTREACH_REPORT.md`. Uncommitted on `main`.
>
> **2026-07-29 (EV1 BUILT — combined event-programme summary above the type breakdown):** Built the last outstanding ask from the 8 Jul feedback round. Margot: *"top summary = webinars + in-person hosted in-quarter (registrations, attendees, created opps, influenced pipeline, closed won) before the type breakdown"* — the page previously opened with Owned-vs-Earned counts and left the reader to add the two type sections together. New **`EventsSummary`** panel (`Events.jsx`), rendered directly under the header callout and above the Webinars divider: **"Event Programme — Webinars + In-person"** with five tiles — Registrations · Attendees · Created Opps · Influenced Pipeline · Closed-Won — plus a chip counting each type. **The design point is that the metric bases genuinely differ, so the tiles state them instead of blurring them:** Created Opps / Influenced Pipeline / Closed-Won are **true combined totals** (both types are Salesforce campaign-attributed on one basis; Influenced = open + won per the S3 glossary, with the open/won split in the sub-label); **Registrations** combine GoToWebinar sign-ups with Salesforce campaign members for in-person (per V4 an event's members ARE its registrants), so the webinar/in-person split is shown beneath the figure since they come from two systems; **Attendees is webinars-only for now and says so on the tile** — in-person attendance exists only in the Outreach attendee lists, which aren't API-readable, so presenting a partial as the programme total would have been exactly the kind of quiet inaccuracy the dashboard is meant to avoid. It upgrades itself to a true combined figure automatically once `fact_event_attendance` is seeded (`OPEN_ITEMS.md` B3) — the component branches on `hasData`, no code change needed. Reuses the existing `sumFunnel` helper and the `mql`/`webinarAttendance`/`createdOpps`/`pipeline`/`closedWon` explain entries, so every tile keeps its eye-button. **Verified against the warehouse (All Regions / YTD):** 739 registrations (471 webinar + 268 in-person) · 175 attendees (webinars only, correctly flagged — the attendance table is empty) · 45 created opps · €576,120 influenced pipeline (€322,578 open + €253,542 won) · €253,542 closed-won · 15 webinars + 15 in-person campaigns. `vite build` ✓. **This closes the last unbuilt client ask:** of ~118 items across both feedback rounds, the only one left on our side is **SEO7** (Top Organic Pages per language), which needs a language dimension. The draft client email's "remaining items all depend on your side" line is now accurate. Docs + memory updated. Uncommitted on `main`.
>
> **2026-07-29 (M3 FIXED — zero-contribution campaigns dropped from the Email page; root-caused so it can't recur):** Fixed the one real bug the cross-check audit surfaced. **The bug:** campaigns from earlier years "still appear" in the per-campaign table because they have activity ROWS dated inside the period while every metric on them is zero — so quarter filtering alone can never remove them. Margot raised this for **both** events and email; Events was fixed in V2 (14.07) but Email never was. **The root cause is why it was missed:** `getEventsDetail` and `getEmailReport` each hand-roll their own campaign list, and V2 inlined the fix into the events one only — so there was nothing to propagate. **Fix:** extracted the rule into a shared `contributedInPeriod(c)` predicate in `queries.js` (`mql > 0 || sql > 0 || createdOpps > 0 || pipeline > 0 || closedWon >= 1`; `>= 1` clears rounding noise like €0.86; accepts either `pipeline` or `oppValue` since the two lists shape rows for different tables) and applied it to **both** lists, so they cannot drift again. **Effect:** **3 of 18** campaigns drop from the Email page — `2024 UK Intune Workflow`, `14.04.2025 - NL - Data Security & AI Microsoft Whitepaper Download`, `2.5.2025 - CWSI AI Risk Assessment Lead Magnet`. **Totals are unaffected** — a zero-contribution campaign contributes 0 to every metric by definition, so this is display-only. A campaign dated 2024/2025 that still has genuine 2026 activity (an opp that reached SQL or won this year) is **kept** — only pure-zero clutter goes. **Count corrected:** the audit first reported "6 of 24", measured against the raw campaign types; the Email page's actual scope is narrower (all `Content/White Paper` + only `Email` campaigns whose name matches `/workflow/i`), so the true figure is **3 of 18**. The other three zero-contribution Email-type campaigns (`Blaud - Hoxhunt SoPro Campaign`, `BLAUD - SoPro Connect & Go Campaign`, `October Ben Email MSFT Funded Workshops`) never render on the Email page at all — they fail the workflow name filter. Docs + memory corrected. **Channel pages checked and CLOSED as a non-issue (C7):** `getChannel` has no contribution filter and the warehouse does hold zero-contribution campaigns per channel (LinkedIn Paid 10 of 14 · Events 10 of 40 · Email 4 of 11 · Other/Unmapped 4 of 9 · Organic SEO 3 of 21) — **but none of it reaches a screen.** Traced through the render path: `Channel.jsx` serves only `ch-linkedin` + `ch-search` (SEO/Email/Events/Outreach have dedicated pages); for LinkedIn `Body` **early-returns** the L4 "left blank for now" callout, so the per-campaign Salesforce table never renders; `Seo.jsx` uses `useChannel('Organic SEO')` for **totals only**. The only page that would render the list is Paid Search, which has **zero** campaigns in the period. Adding the filter there would be harmless but change nothing visible — deferred until the LinkedIn table is un-blanked or a Paid Search campaign exists. *(Initially logged as an open judgement call; corrected same session after tracing the render path rather than just the data.)* `vite build` ✓. Uncommitted on `main`.
>
> **2026-07-29 (FEEDBACK CROSS-CHECK AUDIT + USER GUIDE REWRITE — docs only, no behaviour change):** Re-verified **every item in both client-feedback rounds** (~118 items: `CLIENT_FEEDBACK_MARGOT_JUL2026.md` 8 Jul + `CLIENT_FEEDBACK_MARGOT_14JUL2026.md` 14 Jul) against the running code and the **live warehouse**, because the checklists had drifted in both directions. **Corrected 18 items to ✅ that were still marked open** — PR1/PR3/PR7/PR8/PR9 (Created Opps in the funnel, marketing-attribution + %-meaning notes now on the explain layer, LinkedIn attributability answered by L2/L3); **LI1** (the mixed-currency ROI is gone — EUR pipeline ÷ EUR spend); **SEO2** (GA4 workflow *has* been re-run: verified 2,179 2026 rows all carry `users` + `session_duration_total`, 22,293 users — the doc still said "shows — until re-run"); SEO4 (insights subdomain verified, 527 sessions); SEO5; EM3; **OR1** (broken filters resolved by removal — only the working workstream dropdown remains); **EV2/EV4** (Registrations & Attendance by Region panel is built; only the list export is pending); **EV8** — owned/earned was marked 🔴 "no SF field → blocked" but is **built and live** off the existing `OwnedEvent` campaign type, so the blocker verdict was simply wrong; **BP2** (single "% of FY" line, duplicate sub-figure gone); **BP5** — Outreach **is** on the Board channel table as a contact-attributed row; **BP9** (Probability explained in-UI); **O4**. Closed **X5**'s "Board/Pipeline propagation" follow-up as **not applicable** — neither page lists campaigns (both are channel/region level), so there is no name to propagate. **Found one REAL BUG the checklist had closed as "see S2": M3** — the Email page still lists campaigns with **zero 2026 contribution**. Confirmed in the warehouse: **3 of 18** campaigns on the Email page (`2024 UK Intune Workflow`, `14.04.2025 - NL - Data Security & AI Microsoft Whitepaper Download`, `2.5.2025 - CWSI AI Risk Assessment Lead Magnet`, `Blaud - Hoxhunt SoPro Campaign`, `BLAUD - SoPro Connect & Go Campaign`, `October Ben Email MSFT Funded Workshops`) have 0 MQL / 0 SQL / 0 created opps / €0 pipeline / <€1 won and still render — **exactly the clutter Margot flagged**. Events fixed this in V2 (`getEventsDetail`, `queries.js:1134`); `getEmailReport` has no equivalent filter → one-line fix, logged as `OPEN_ITEMS.md` **C4**. Also **still genuinely unbuilt: EV1** (combined webinars + in-person top summary — both former blockers cleared, tile row never built → **C5**) and **SEO7** (Top Organic Pages per language — needs a language dimension → **C6**). **Net: of ~118 items, 1 live bug, 2 unbuilt asks, the rest done or client-gated.** **Docs updated:** both feedback checklists (per-item statuses + an audit summary section each); `OPEN_ITEMS.md` (new C4/C5/C6 build items, A5 EM1 email-campaign scope, A6 LI4 UK budget, D3 retire Gotenberg, + a section F audit summary and a ⚠️ client-comms warning not to claim "everything remaining is on the client" while C4/C5 are open); `MARGOT_CONFIRMATIONS_NEEDED.md` — **closed 3 stale asks** (#4 Retained Contracts — removed from the product on 9 Jul; #7 Outreach meetings tier — resolved 20 Jul; #12 owned/earned downgraded to "confirm the convention" since it's built), **corrected #6/§1.5 which still documented the SUPERSEDED MQL definition** ("lead status Marketing Qualified Lead or beyond") instead of the 9 Jul model (Leads = MQL = responders, SQL = Attempt-1+) — that one was actively misleading, and **added §1.9 whitepaper-downloads basis (M2)** with the live figure re-verified at 89 across 13 campaigns and the two explicit asks (responders-only vs all-members; send a form-tool count for 1–2 campaigns to reconcile). **Also this session — `docs/USER_GUIDE.md` rewritten** as one complete client-facing guide (354 lines, 9 sections): added the two pages it never covered (**Marketing Budget**, **Campaigns**), a **funnel-definitions** section (the single most misread thing on the dashboard), the **eye-button/explain** layer, a "current view vs snapshot" explainer, a **"this doesn't match my own CRM report"** section with the six legitimate reasons, and the new print-to-PDF export steps. **Corrected 6 stale claims in the old guide by checking the components**: Overview has 2 top-line cards not 3 and no longer has Quarter Health or Webinar Attendance panels; the KPI Tracker's budget block moved to its own page; the Board Pack has no Gaps-to-Close and no Retention section (dropped 9 Jul) but does have a review-flags panel; Events has no MQL-Rate-by-Event-Type panel; Paid Search shows a "Spend / CTR / CPL not available" notice rather than a "no live campaigns" state; campaign renaming works on LinkedIn/Email/Events too. No internal jargon (no ticket IDs, table names, tooling or person names). **No code changed in this session's audit** — `vite build` unaffected. Uncommitted on `main`.
>
> **2026-07-29 (PDF EXPORT MOVED FULLY CLIENT-SIDE — Gotenberg dependency dropped):** All three branded PDF exports (Board Pack, KPI Register, Pipeline) now render **entirely in the browser**, via its own print engine, instead of POSTing the HTML to an n8n webhook that drove a hosted **Gotenberg** container. That engine *is* Chromium — the same renderer Gotenberg was driving — so the existing print CSS in `boardPackHtml.js` / `reportHtml.js` (`@page A4`, `break-inside:avoid`, repeating `thead`) still does the pagination, and the output is still **vector with selectable text** (~290 kB for a 3-page pack). Deliberately NOT the rasterising route (`html2canvas`/`jspdf.html()`): that would have meant pixel text — unselectable, unsearchable, 2–6 MB — and hand-rolled A4 pagination in JS, giving up the CSS fragmentation that makes the layout adapt to however much data a scope holds. **New `src/data/printPdf.js`** — `printHtmlToPdf(html, {filename})`: offscreen iframe sized to exactly A4 at 96 dpi (794x1123) so viewport-relative CSS resolves against the page box; waits on `document.fonts.ready` (capped at 4 s — the builders pull Manrope/JetBrains Mono from Google Fonts and an offline fetch must not deadlock the export) and on image decode, then 2x rAF for layout to flush, then prints and cleans up on `afterprint`. **Readiness is a poll, not the `load` event** — for a `srcdoc` frame the event ordering is not dependable (inserting the frame can fire `load` for its initial empty document, and the srcdoc document may get no observable event of its own); acting on the wrong pass printed a blank page or called `print()` on a since-detached window and hung silently. Found and fixed during verification. `pdfClient.js` now builds the HTML exactly as before and calls the printer; the fetch/base64/download path and the `VITE_BOARDPACK_PDF_WEBHOOK_URL` guard are gone. **Hardened against Chrome's "Background graphics" checkbox** (defaults to OFF, and `print-color-adjust:exact` does NOT override it — CSS background fills are dropped): the cover's navy gradient + glow now also ship as an inline **SVG `<img>`** (`COVER_ART`), because images always print — without it the cover's white text landed on white paper, i.e. invisible; status chips/pips/dots gained borders matching their fill so they read as coloured rings rather than disappearing. Cover height moved `100vh` → **296mm** (a viewport unit resolves against the frame, not the page; 296 not 297 leaves rounding room so a sub-pixel overflow can't spill a blank page). Export dialog now tells the user to pick Save as PDF, tick Background graphics and untick Headers and footers (Chrome remembers both). **Verified:** headless Chromium print of the real builder output → **3 pages, 291 kB, 4113 text-show operators** (proving vector text, not a raster snapshot), no stray blank page after the cover; instrumented browser run confirmed frame 794x1123, cover 1118.7 px, fonts + cover art loaded before print, document title swapped for the filename then restored, iframe removed. `vite build` ✓. **Retired:** `VITE_BOARDPACK_PDF_WEBHOOK_URL` removed from `.env` + `.env.example`; `workflows/board_pack_pdf_render.json` is now unused (left in the repo for reference). **Operational win — you can deactivate that n8n workflow and shut down the hosted Gotenberg instance (Railway); board figures no longer leave the browser for PDF export.** Uncommitted on `main`.
>
> **2026-07-20 (OUTREACH HARD-LOCK — Margot: 3 marketing workstreams only):** Margot confirmed the Outreach page must report ONLY the 3 marketing workstreams (Historic Data Reactivation / Outbound Prospecting · SoPro / · Microsoft TUM); sales & one-off sequences excluded everywhere. Built (read-layer/display, no re-ingest): removed the "All sequences" toggle (page hard-locked marketing-only); `getOutreachAttributedMeetings` marketingOnly now filters to `isMarketingSequence` (3 workstreams) rather than only excluding sales-owned — so event/campaign meetings drop too (headline outbound meeting count unchanged; "outbound" already meant these 3). Meetings panel collapsed from 3 nested tiers (outbound/+events/+any) to a single "Meetings booked · marketing workstreams" figure + matched-coverage card. Sequence Performance table restructured to **workstream → region (shown ONCE as a sub-header) → product/flow** — region no longer repeated on every row (Margot's ask). Verified in warehouse: all 3 workstreams carry real region codes (UK&I has the prospects; BeLux/NL empty this snapshot), so "Unassigned" only came from non-marketing sequences and is now gone. `vite build` ✓. Resolves the R2 ambiguous-tail question. Uncommitted on `main`.
>
> **2026-07-16 (WAVE 3 + 4 BUILT — 14.07 restructure/build-out; read-layer + display only, NO re-ingest):** Shipped the remaining 14.07 items. **P1/P2 Pipeline:** removed the top-strip/funnel duplication — top strip is now € money metrics (New Pipeline Created / Influenced Pipeline / Closed-Won), the Lead Journey funnel is counts only and mirrors Overview exactly (adds **Qualified Opportunities** stage; conversions MQL→SQL, SQL→Qualified, Qualified→Won). **K1 KPI Tracker:** new **Outreach (Prospecting)** register category (prospects/open-rate/reply-rate lifetime snapshot + meetings/created-opps/closed-won/influenced-pipeline outbound, contact-attributed) wired into BOTH `kpiRegister.js` consumers (page + `exporters.js`) so they never drift; methodology + Explain added. **R2 Outreach:** `outreachSeqClass`/`isSalesOwnedSequence` (queries.js) — 3 marketing workstreams + event/campaign seqs kept, single-account/renewal/rep cadences = sales-owned; `getOutreachAttributedMeetings` + hook now take `marketingOnly` and the meeting panel honours the page toggle (was ignoring it), dropping sales-owned from every tier + the per-seq table (outbound/100-target untouched); honest excluded-count note. ⚠️ ambiguous sector-named tail defaults excluded — Margot confirms the list. **G1–G4 SEO:** insights.cwsisecurity.com confirmed live in GA4 (527 sessions/7 key-events; `%cwsisecurity.com` filter already includes it) → shows in Traffic by Property (GSC subdomain **property** still to add = data-source config); SF **Website Leads** funnel moved to TOP; added Qualified Opportunities + New Pipeline Created to it; GA4 key-events tile relabelled "on-site conversions · traffic signal, not a Salesforce lead"; wider Organic SEO channel funnel kept but labelled context/superset. **V1–V4 Events:** verified Protect Data (`701Si00000UOSYCIA5`) is now ingested (50 MQL/15 SQL/9 opps/€57k) → flows into In-person; `getEventsDetail` drops zero-2026-contribution old events (kept old-dated campaigns with real 2026 activity); header callout states MQL=registrants / SQL=registrant→qualified-opp + unified metric set. **P4/P5 Pipeline:** Outreach already present as indicative contact-attributed row (chose over fuzzy sequence→campaign matching = more accurate, no double-count); paid→SF linkage (`LI_SF_LEAD_SOURCE`) already routes LinkedIn paid via linked SF campaigns; callout now documents both. **O1:** removed "net of corrections" from Budget tile + Overview sub. **R1:** outbound-meetings verified-correct note added. `vite build` ✓ throughout. Statuses in `docs/CLIENT_FEEDBACK_MARGOT_14JUL2026.md`. **Uncommitted on `main`.**
>
> **2026-07-15 (WAVE 2 BUILT — 14.07 credibility/number fixes):** **O3/L3 Q1 paid ROI (real bug):** SoPro `7013z000002JR0IAAW` + Hubspot Imports `7013z000001k5JLAAY` (+ Mavern, Intune Health Check) are typed `Advertisement` in SF → mapped to LinkedIn Paid, injecting €89k+€32k fake "LinkedIn Paid" won across H1. Added `CHANNEL_OVERRIDE_BY_KEY` to all 3 channel-mapping nodes in `salesforce_ingestion.json` (Build Fact Rows, Build Opp Rows, Map Campaigns) routing these 4 → Other/Unmapped; genuine "BeNeLux LinkedIn Ads" stays LinkedIn. `node --check` ✓, JSON valid. Backup `.pre-chremap-bak`. **✅ RE-INGESTED + VERIFIED LIVE (15 Jul):** the 4 campaigns are now Other/Unmapped; LinkedIn Paid H1 closed-won **€31,142 → €0**; that €31,142 moved to Other/Unmapped (€53,660 → €84,802); grand total closed-won unchanged at €450,062 (30 deals). Overview by-channel + LinkedIn ROI no longer show phantom paid ROI. **P3 Closed/Won (verified consistent):** close-date basis ties everywhere — top strip = by-source = Sales Cycle = €450,062 (30); no date bug. Added a reconciliation note on the by-source panel distinguishing close-date Closed-Won from the open-pipeline Stage Distribution; O3 re-ingest fixes the channel attribution. **L1:** LinkedIn KPI row reordered → Budget Set then Budget Spent (exact EUR). **L2:** `getLinkedInSnapshot` sources leads from each ad's directly-linked SF campaign (`LI_SF_LEAD_SOURCE`: DATA_MOVES→701Tm00000ZUJUEIA5=1 lead; Protect Data→LI_914802433=0; E7 none) — not the broad event campaigns; CPL/labels/notes updated. **L4:** LinkedIn per-campaign "Commercial Outcomes" table replaced with a "left blank" note (not paid ads); channel snapshot retained. **M1 (already satisfied):** Email page reads SF campaign members (whitepaper 89 MQL/13 campaigns, workflow 10/5) — added a note that whitepaper MQL = downloads (responded members). **M2 (flagged):** "downloads higher" = responded (89) vs all-members; `HasResponded` filter excludes bulk imports, so switching to all-members risks over-counting — needs Margot's basis + an ingestion change/re-ingest if all-members. `vite build` ✓ throughout. Checklist statuses in `docs/CLIENT_FEEDBACK_MARGOT_14JUL2026.md`. **Also (15 Jul):** re-laid-out `salesforce_ingestion.json` node positions into a clean 12-column left→right layout (longest-path columns + barycenter ordering) — several nodes previously shared identical coordinates and overlapped on paste; now zero overlaps, connections/logic unchanged.
>
> **2026-07-14 (WAVE 1 BUILT — 14.07 systemic fixes):** Shipped the 3 recurring/systemic items + 2 Campaigns fixes from the 14.07 round (read-layer + display only — **no re-ingest needed**). **S1 remove "Leads" stage → start at MQL:** dropped the Leads stage/column/KPI + Lead→MQL conversion across Overview, Pipeline, Email, Events, Seo, Channel, Campaigns, KPI register; per-campaign `mql` floored to campaign members (= funnelOf) in `getChannel`/`getEmailReport`/`getEventsDetail` so MQL reads identically everywhere (matches Margot's "registrants = MQL"). **S3 terminology:** one glossary — "Generated pipeline"→"Influenced pipeline", "Generated This Quarter"→"New Pipeline Created"; every bare "Pipeline €" is now either **Influenced Pipeline** (open+won) or **Open Pipeline €** (open-only), Channel total sums the open column so rows reconcile; `methodology.js` updated. **E2 themes:** `themes.js` collapsed from 5 sub-themes to 2 quarter umbrellas (Q1 "Data Is an Asset, Not a Liability" / Q2 "Innovation Without Risk") + Other. **E1 crossover fix:** each campaign gets ONE quarter (name-date prefix → Q1/Q2 token → curated key/keyword → StartDate); `getCampaignThemes` fetches both quarters then filters campaigns by their OWN quarter. **Verified:** `vite build` ✓; classifier run over all 2026 campaigns → clean Q1(5)/Q2(17)/Other(7) partition, the "Data That Moves" pair splits correctly (Q1 whitepaper vs Q2 LinkedIn ad). **O2** (Overview "Opportunities"→"Qualified Opportunities") done opportunistically. **Board-pack export cleanup (15 Jul):** Leads also removed from the PDF (`reportHtml.js`) + branded-deck (`gammaClient.js`) funnel tables and the AI-narrative trace table + funnel object (`boardPack.js`) — the board-pack renderer and in-app Board page were already MQL-first. So Wave 1 "remove Leads" is now complete across UI **and** exports. `vite build` ✓. Checklist: `docs/CLIENT_FEEDBACK_MARGOT_14JUL2026.md`.
>
> **2026-07-14 (NEW FEEDBACK — Margot 14.07 round logged + triaged, build not started):** Received `docs/14.07 Marketing Dashboard.docx` — ~28 items across 8 pages. Created canonical checklist `docs/CLIENT_FEEDBACK_MARGOT_14JUL2026.md` and ran a full warehouse + code investigation. **Ground truth on the disputed numbers:** Q1 "paid ROI" = **real bug** (€0 Q1 paid spend; €31,142 is 2 mis-mapped legacy opps — SoPro `7013z000002JR0IAAW` + Hubspot import `7013z000001k5JLAAY` — on channel 2); Closed/Won top-vs-breakdown = **real** (close_date €450,062 vs created_date €320,388 — standardise on close_date); Email = **stale source** (`fact_email_engagement` = 2 rows from 2022 → use `fact_channel_daily` SF campaign members); LinkedIn BeNeLux lead = **real gap** (feed 0, SF ≥1 / whitepaper 34); Protect Data event = **not ingested** (SF campaign has 50 leads/9 opps/€57k); 16 Outreach meetings = **verified correct** (conservative Q2 outbound-attributed SF meetings — needs an explanation, not a fix); insights.cwsisecurity.com = **in GA4 not GSC**. **3 "open" Qs resolved from her own words:** theme model → collapse 5 sub-themes to 2 quarter umbrellas (Q2 *Innovation Without Risk* / Q1 *Data Is an Asset, Not a Liability*) — supersedes 9 Jul 5-theme map; events MQL = registrants, SQL = registrant→qualified-opp; keep ONE SF-sourced organic funnel. **Systemic roots:** remove "Leads" stage (mql=leads by construction) → start at MQL; one pipeline glossary (New Pipeline Created / Influenced Pipeline / Closed-Won) fixing "Pipeline €" open-only-in-rows vs open+won-in-totals; Campaigns Q1↔Q2 crossover = date-blind theme classification vs activity-date filter (fix: parse dd.mm.yyyy name prefix). **Plan = 4 waves; build deferred (Aarav starts later); ingest fixes to be done in workflow JSON + frontend, re-ingest flagged to Aarav.**
>
> **2026-07-11 (Owned/Earned via Campaign.Type 'OwnedEvent'):** SF admin implemented owned/earned as a **Campaign.Type value** — probe (`campaign_owned_earned_probe`) + client SOQL confirmed `Type='OwnedEvent'` (124 in test org; no 'EarnedEvent' — the single 2026 earned event, Cybersec Europe, is name-tagged). **No separate ingestion workflow needed** (it's a Campaign attribute already ingested via dim_campaign). **Must-fix applied:** added `OwnedEvent` + `EarnedEvent` → 'Events & Webinars' to all 3 `CHANNEL_BY_TYPE` maps in `salesforce_ingestion.json` (Build Fact Rows, Build Opp Rows, Map Campaigns to dim_campaign) — otherwise OwnedEvent campaigns would fall into Other/Unmapped. Kept legacy 'Event' so production (still on 'Event') is unaffected. Events.jsx: TYPE_LABEL maps OwnedEvent→'In-person events'; owned/earned notices rewritten (Owned = Type 'OwnedEvent'; earned = Cybersec Europe by name). `vite build` ✓; 3 JS nodes `node --check` ✓. **ACTION: re-run `salesforce_ingestion`** once production adopts the OwnedEvent type (channel mapping is at ingest). Backup `.pre-ownedevent-bak`.
>
> **2026-07-11 (AUDIT — logged-in visual sweep of every page for eye-buttons/notices):** Drove the live dashboard (accounts@braind.io) and audited all pages. **Bug found & fixed:** the Campaigns page was misgrouping Margot's named campaigns — 8 STALE `campaign_overrides.theme` rows (test data predating the themes.js key pinning) pinned e.g. "Data is an Asset"→Becoming Frontier and "Samenwerkingsdag"→Protect Data. Cleared them (`UPDATE … SET theme = NULL`) → all 5 themes now group correctly (verified on YTD). **Eye-button gaps closed:** KPI Tracker "Created opportunities" row (added `createdOpportunities → createdOpps` to REGISTER_EXPLAIN; dropped the dead retention mapping); SEO Users / Avg Session Duration / Bounce KPIs (added `organicTraffic` explain). **Verified adequately covered:** Overview, Budget (MarketingBudget component), Pipeline, Campaigns, LinkedIn, Email, Outreach, Events, Board — all carry eye-buttons on figures + notice boxes (many via shared components, which the earlier grep undercounted). `vite build` ✓. Temp puppeteer-core removed.
>
> **2026-07-11 (BUILD #11 — Board Pack feedback sweep):** **Funnel order** — MQL→SQL Rate now before Created Opportunities (metric order 3/4 swapped). **BP2** — removed the duplicate target sub-figure under each metric card (traffic light carries "% of FY"; QoQ trend + pending note kept). **Legacy vs Current on the Board** — added `CurrentVsOngoing` as a board section (this-quarter results vs prior-quarter carry-over + avg cycle) — Margot's key board narrative; the component self-documents via its callout. **Outreach on the Board channel table** — indicative `Outreach · outbound (contact-attributed)` row, **excluded from the pipeline-share donut + all totals**, with a caveat notice box (contact-attributed, may overlap campaign channels). Pipeline trace description updated to open+won. `vite build` ✓. **Left/decisions:** weighted-forecast line stays removed (Probability column kept per Margot); funnel-conversion already MQL→SQL→Created→Won. Outreach still not on the *Overview* channel chart (only Pipeline + Board now).
>
> **2026-07-10 (POST-CALL BUILD #10 — SEO2 preferred web metrics):** Replaced the Engagement-Rate focus with **Sessions · Users · Avg Session Duration · Bounce Rate** on the SEO page (top KPIs + the Traffic-by-Property table) + methodology note. **Bounce rate is live now** (derived = 1 − engaged/sessions). **Users + Avg Session Duration**: added `totalUsers` + `averageSessionDuration` to the GA4 report, `fact_web_daily.users` + `session_duration_total` (migration `ga4_users_session_duration`; avg = Σ(avgDur×sessions)÷Σsessions), `v_web_daily` + `getWebTraffic` extended. `GA4_ingest.json` edited (backup `.pre-seo2-bak`; JSON + JS validated). `vite build` ✓. **ACTION: re-run `GA4_ingest`** to populate Users + Avg Session Duration (show "—" until then; Bounce + Sessions already live).
>
> **2026-07-10 (POST-CALL BUILD #9 — Event attendance scaffold, EV1/EV2/EV3):** Built the in-person registrations + attendance-by-region view end-to-end on the dashboard side. New **`fact_event_attendance`** table (migration `create_fact_event_attendance`, RLS + anon-revoked; PK event×region). `getEventAttendance` + `useEventAttendance` → per-event/region registered · attended · attendance-rate. New **"Registrations & Attendance by Region"** panel on the Events page (replaces the old NotAvailablePanel) with a **notice box** explaining the source. **Finding:** the attendee lists live in Outreach **Prospects → Prospect Lists** (`Region – Attendees/Non-Attendees – Event`), but those UI lists **aren't in the Outreach v2 API** (it exposes sequences/prospects, not saved lists) — so this is populated by **export → seed** (mirroring the LinkedIn sheets), not an API workflow. View shows an honest "pending export" state + notice until seeded. `vite build` ✓. **ACTION (Margot):** export the attendee / non-attendee lists (CSV) → drop in `sheets/` → we seed the table.
>
> **2026-07-10 (POST-CALL BUILD #8 — LinkedIn regroup + LI2 toggle + Owned/Earned):** **LinkedIn (LI4/LI5)** — reseeded `linkedin_campaign_2026` to Margot's authoritative **3 campaigns with EUR budgets** (migration `linkedin_campaign_2026_regroup`, new `budget_eur` col): Protect Data €3,000/£1,441.66 (event+boost), Microsoft E7 €2,000/£1,189.44 (Ireland), Data That Moves €3,000/£2,260.26 (NL+Benelux). Total budget **€8,000**, spend **€5,723**; impressions/clicks summed from the 5 export rows; getLinkedInSnapshot reads `budget_eur` (no conversion). Notice box updated. **LI2** — `includePrior` param + page **toggle** "Include prior-year campaigns (context)" → surfaces the 8 prior-year warehouse campaigns as a separate context table (not in 2026 totals). **Owned/Earned (EV4)** — interim name rule on Events in-person table (Earned = **Cybersec Europe** + **Henley Regatta**; deliberately NOT bare "cybersec" so CWSI's own Cybersec Dinner events stay Owned) + Owned/Earned column + provisional notice box; swaps to the SF field when it lands. `vite build` ✓; LinkedIn totals + earned-match verified on live data. No re-ingest. Remaining held: Email exact list, BP2 pointer, OR4 UKI repro; larger builds: attendee-list ingest, SEO2 (GA4 dims).
>
> **2026-07-10 (POST-CALL BUILD #7 — full-doc sweep, buildable items):** Actioned the complete feedback doc (Parts 1–5). **Outreach OR4** — `outreachProduct` regex fixed: a hyphenated rep name ("Barry-John") was leaking into the product label and splitting one product into two ("Copilot Readiness" + "Copilot Readiness - Barry"); now strips from the LAST " - " so Barry-John collapses correctly (fixes "Copilot appears twice" + "Barry John shouldn't appear"). **Board** — BP4 removed the probability-weighted forecast (kept Probability column per BP3, dropped from trace); BP8 dropped the redundant Leads→MQL conversion step (Leads=MQL now → always 100%); funnel is MQL→SQL→Created→Won. **SEO8** — Website Leads funnel scoped to the **2026** Website Leads campaign (`ilike '2026%website lead%'`): 7 leads/7 MQL/4 SQL. **SEO3** — verified `insights.cwsisecurity.com` IS included + present (455 sessions, from 12 May → empty pre-Q2); no fix, answer for Margot. **EV2** — Events callout now explains registrations (GoToWebinar) ≠ Leads (responded campaign members). `vite build` ✓; outreachProduct + Website-Leads verified against live data. No re-ingest. **Held pending Margot decisions:** LinkedIn regroup to her 3-campaign EUR-budget table, LI2 keep-prior-years-available, Email exact campaign list, BP2 which-duplicate, OR4 UKI-in-All-tab repro. See `docs/VERSION3.md`.
>
> **2026-07-09 (POST-CALL BUILD #6 — LinkedIn budgets/spend from Margot's exports, LI2/LI4/LI5):** Parsed the 5 LinkedIn Ads exports in `sheets/` (2 UTF-16 CSV + 3 xlsx) → per-campaign spend + budget. New **`linkedin_campaign_2026`** table (migration, RLS + anon-revoked) seeded with the 5 campaigns that ran in 2026 (spend £5,291≈€6,190, budget £4,680≈€5,476 — budgets sum ad-set-level per campaign; NL = £500+£1,400 across 2 ad sets). `getLinkedInSnapshot` now reads it instead of the 13-campaign warehouse snapshot → **LI2** (only 2026 campaigns), **LI4** (per-campaign budget + Used%), **LI5** (spend reconciled to LinkedIn). LinkedIn page: Budget KPI + Budget/Used columns; `linkedinBudget` methodology entry; spend/budget GBP→EUR. `vite build` ✓. Static seed (one-off export) — refresh the table when new exports arrive. ⚠️ UK/Protect-Data-event budget wasn't in the export (n/a) — confirm with Margot. No re-ingest needed.
>
> **2026-07-09 (POST-CALL BUILD #5 — Sales-cycle Phase 2, MQL→opp):** Added the lead→opportunity timing. **New `fact_contact_response`** (per-contact earliest campaign response = MQL date; migration `sales_cycle_phase2_mql`, RLS + anon-revoked) + **`v_opportunity_cycle`** view (fact_opportunity ← min campaign-response date across the opp's contacts via fact_opportunity_contact). **Workflow:** CampaignMembers SOQL gains `FirstRespondedDate, Lead.Email, Contact.Email`; new `Build Contact Response Rows → Upsert fact_contact_response` branch (backup `.pre-phase2-bak`). `getSalesCycle` now reads `v_opportunity_cycle` and computes **MQL→opp** + **MQL→won**; `SalesCycle.jsx` shows them (coverage = matchable opps, stated in-panel). `vite build` ✓; JS `node --check` ✓. **ACTION: re-run `salesforce_ingestion`** to populate `fact_contact_response` (MQL cards show "—" until then; created→close is already live). **This clears the entire buildable-without-Margot list.**
>
> **2026-07-09 (POST-CALL BUILD #4 — Sales-cycle view Phase 1):** Built the sales-cycle view end-to-end. **New `fact_opportunity` table** (migration `create_fact_opportunity`, RLS `authenticated_read` + anon revoked, one row/opp) + **workflow branch** in `salesforce_ingestion.json` (`SF: Get Opportunities → Build Opp Rows → Upsert fact_opportunity`, reuses currency + channel maps, additive — backup `.pre-factopp-bak`). Read layer: `getSalesCycle` (created→close by outcome won/lost/open × source, avg + median) + `useSalesCycle` + new `SalesCycle.jsx` panel on the Pipeline page + `salesCycle` methodology entry. `vite build` ✓; Build Opp Rows JS `node --check` ✓. **ACTION: re-run `salesforce_ingestion`** to populate `fact_opportunity` (panel hidden until then). Phase 2 = MQL→opp timing (contact-response join) still to do. See `docs/VERSION3.md`.
>
> **2026-07-09 (POST-CALL BUILD #3 — SEO9 + sales-cycle scope):** **SEO9** — new **Website Leads** funnel on the SEO page scoped to the "Website Leads" SF campaigns (`getWebsiteLeads` + `useWebsiteLeads`, name-match `ilike '%website lead%'`): Leads 10 · MQL 10 · SQL 4 · Created 31 · Pipeline €132k · Won €85.7k — the accurate website source (vs the "1,720 leads" she flagged); wider Organic SEO channel funnel kept below. Read-layer, no re-ingest. `vite build` ✓. **Scoped** the sales-cycle/timeline view build (new `fact_opportunity` table off the existing opp query: created/close dates + channel + amount; Phase 2 adds MQL date via OpportunityContactRole→CampaignMember) — see `docs/VERSION3.md`. Not yet built (needs its own re-ingest).
>
> **2026-07-09 (POST-CALL BUILD #2 — buildable-now batch):** **G2** LinkedIn spend → EUR (read-layer fixed-rate conversion; spend/CPC/CPM/CPL/ROI + LinkedIn page all EUR, relabelled). **PR6b** "Generated This Quarter" = value of opps created in period — new `created_opp_value` (migration `add_created_opp_value` + `v_fact_enriched` + ingestion opp-loop + INSERT) surfaced as a Pipeline tile + methodology entry (**needs re-ingest to populate**). **G5/PR6a** `CurrentVsOngoing` now renders on every channel page (was Pipeline+Events). **Contact region** — ingestion resolves pure-contact region via `Contact.Account.Region` (CampaignMember SOQL + member loop; **needs re-ingest**). **OV6** Outreach opportunities surfaced on Pipeline by Source as an indicative contact-attributed row (excluded from Total to avoid double-count). `vite build` ✓; fact-builder JS `node --check` ✓. **Remaining buildable:** SEO9 website-leads rescope; the full sales-cycle/timeline view (created/won/lost + MQL→opp by source) is **blocked on data** — opp table lacks close_date/MQL-date (needs a dedicated opp-ingestion field add). See `docs/VERSION3.md`.
>
> **2026-07-09 (POST-CALL BUILD — funnel redefinition + pipeline fix + retention removal + region-everywhere + campaign pinning):** Acted on the 9 Jul Margot+Claire call (transcript). **(1) Funnel redefined** (`salesforce_ingestion.json` Build Fact Rows): Leads = campaign **responders** (`HasResponded`, not all members — kills the inflation); **MQL = Leads** (distinction dropped per call); **SQL = lead status "Attempt 1" or beyond** (`SQL_STATUS` set) with a **contact-meeting SQL path** for existing customers (SF: Get Meetings reordered ahead of the fact builder); SQL removed from the opp loop. methodology.js Leads/MQL/SQL text rewritten. **⚠️ needs n8n re-ingest to take effect** (invalidates the 6 Jul MQL re-ingest). **(2) Generated Pipeline = open + closed-won** across Overview/Pipeline/Board channel+source viz + the funnel (`queries.js`) so Closed Won is always a subset — fixes Margot's "Closed Won > Pipeline / Pipeline empty" (OV6); read-layer, live now. **(3a) Retained Contracts + Expansion removed** from Overview, Board (+ pack/trace/narrative), KPI register (OV1/OV2/BP12). **(3b) Region editable everywhere** — dominant-region added to Channel/Email/Events/Campaigns campaign rows + `field="display_region"` EditableName column (G4). **(3c) Pinned Margot's 10 Word-doc campaigns** to themes by campaign_key in `themes.js` (authoritative over keyword rules; fixes the 10.06 "Microsoft E7" → Protect Data mis-file) (G3). `vite build` ✓; fact-builder JS `node --check` ✓. **Confirm w/ Margot:** SQL boundary statuses (Nurture excluded; MQL-status/Lost-Customer included). See `MEMORY project-cwsi-funnel-definitions-resolved`.
>
> **2026-07-09 (client meeting collateral + state summary):** Created **`docs/MARGOT_MEETING_WALKTHROUGH.md`** — detailed, client-facing "what we built & how" for Aarav's meeting with Margot (foundation · methodology · point-by-point tables for all 10 areas with status + need-from-you · new capabilities · "how it works" mechanism appendix · confirmations · caveats). Also published a **presentation Artifact** (self-contained HTML, status-chipped cards) at `https://claude.ai/code/artifact/32d0a2e8-cc6f-47a9-80f8-82c9f3e38168` (source: scratchpad `cwsi_walkthrough.html`). Doc/collateral only, no code change. **State:** everything buildable-without-Margot is DONE across all sections; remainder is client-dependent (`MARGOT_CONFIRMATIONS_NEEDED.md`). **One op cleanup pending:** re-import `salesforce_ingestion.json` into n8n to drop the stale OR9 branch (OR9 now lives in standalone `opp_contacts_ingestion.json`, already run).
>
> **2026-07-08 (EV5 + LI7 + OV9 + BP8 buildables):** **EV5** — `CurrentVsOngoing` extracted to a shared component + channel-scoped hook, rendered on Events (prior events €112k won vs current €95k won/€153k pipeline — the long-tail story). **LI7** — LinkedIn per-campaign table/KPIs now commercial-outcomes-only (Created Opps/Pipeline/Closed-Won); dropped the inflated Leads/MQL/SQL funnel for LinkedIn. **OV9** — budget panel moved to the top of Overview (total/MDF still client-gated). **BP8** — Board Funnel Conversion realigned to Leads→MQL→SQL→Created Opps→Won (dropped confusing opp_count), capped at 100%, period-scoped caveat added. `vite build` ✓. Buildable-without-Margot set now cleared; remainder is client-dependent.
>
> **2026-07-08 (Board Pack sweep + Paid Search/Outreach note):** Confirmed the re-uploaded feedback doc = canonical v1 (no new items). **BP11 done** — Regional Split gains SQLs + Created Opps columns + an Unassigned explanation (region unresolved from Account). **BP6 confirmed done** (MQLs/SQLs/Created Opps on board), **BP9 confirmed** (Probability explained), **BP10 verified live** (open opps marketing-attributed, 69 opps/€1.25M). **OV5/PR6** — honest Paid Search/Outreach note on Overview + Pipeline (Paid Search = no campaigns; Outreach = contact-attributed on its own page). `vite build` ✓. Deferred-but-buildable next: EV5 (current-vs-ongoing on Events), LI7 (trim LinkedIn table), OV9 (budget to top), BP8 (funnel-conversion viz).
>
> **2026-07-08 (OR7/OR8/OR2 — workstream grouping):** The CWSI sequence naming convention is parseable, so built the workstream restructure (was wrongly deferred to Margot). `outreachWorkstream()` + `outreachProduct()` group Sequence Performance into **SoPro (20) · Microsoft TUM (32) · Historic Data Reactivation (65) · Campaigns & Events (101)**, rows = product/flow × region (reps collapsed); replaces Region × Practice Area (also satisfies OR2 "Type of Outreach"). Products parse from names (M365 Review, Copilot Accelerator, Secure Data…). Labels **provisional — Margot confirms** the mapping (esp. Secure-X Outbound = "Historic Data Reactivation"?). `vite build` ✓. **Outreach section now fully built** — only Margot label/scope confirmations remain.
>
> **2026-07-08 (OR4 — marketing-sequence filter):** The Outreach Sequence Performance list now defaults to **marketing sequences only** (SoPro / Microsoft TUM / Workstream 3 / events / campaigns), excluding sales & one-off account sequences that inflated the count. `isMarketingSequence()` name-allow-list + `marketingOnly` on `getOutreach` (default ON) + a **"Sequence set: Marketing only / All"** page toggle + provisional-classification note. Live: **178 marketing of 218 shown, 40 excluded** (account-named sales seqs). Not a hard hide (toggle shows all); Margot confirms the exact set. Softens OR6 too. `vite build` ✓. OR7/OR8 (workstream grouping/renames) still need Margot's definitions.
>
> **2026-07-08 (OR9 LIVE — per-sequence opps):** Standalone `opp_contacts_ingestion.json` ran; `fact_opportunity_contact` = 1,039 opps / 467 contact emails. Outreach per-sequence table now shows **Created Opps / Opp Value / Closed Won**. Live H1 outbound tier: **109 created opps · €361k closed-won · €4.07M open pipeline**. ⚠️ Finding: the pipeline € is **contact-touch, not generated** — 77% is one €3.13M "At Risk" deal a sequenced contact happens to be on — so it's caveated in-UI (count + won are the reliable read). OR9 done; last Outreach item complete.
>
> **2026-07-08 (OR9 — per-sequence opps built on CC-6):** Opportunities now attribute to Outreach sequences via `OpportunityContactRole` (opp's contact email = sequenced prospect email), mirroring the CC-6 meeting join. New `fact_opportunity_contact` + `v_outreach_attributed_opps` (DISTINCT opp×sequence); SF workflow gains an additive `SF: Get Opp Contacts → Build → Upsert` branch (reuses currency rates; existing branches verified intact). The Outreach per-sequence table gains **Created Opps / Opp Value / Closed Won** columns + an outbound-tier opp summary; accessor computes per-sequence + tier opp metrics (pipeline = open qualified, won = IsWon, per-opp value counted once). `vite build` ✓. **ACTION (you): re-run the SF workflow** to populate `fact_opportunity_contact` (empty until then → opp columns show "—"). Completes **OR9**.
>
> **2026-07-08 (KPI Register rebuild KR1–KR3 + Margot confirmations doc):** New **`docs/MARGOT_CONFIRMATIONS_NEEDED.md`** — one consolidated, call-ready list of all 14 client decisions/data inputs outstanding (targets, bands, spend sheet, retention scope, margin cost-entry, MQL sign-off, OR4 scope, budget/MDF, LinkedIn budgets, attendance lists, email scope, owned/earned, pillar tags, email platform). Rebuilt the **KPI Register** (`kpiRegister.js`, shared by KPI Tracker + exports) to Margot's KR3 tree: merged Pipeline Volumes + Commercial Outcomes into one **Overall Marketing Summary** (order MQLs→SQLs→**Created Opps**→Closed→Pipeline→Margin→Retained→CPL→ROS), then Paid & Digital → **Organic Social (new)** → Email → Website → Events; each conversion shown once; added Created Opps (live from X3), Email Open rate, Reader→MQL; seeded 2 target keys. Code-only, no re-ingest. `vite build` ✓. Serves **KR1/KR2/KR3**.
>
> **2026-07-08 (CC-6 — Outreach meeting attribution LIVE end-to-end):** Both feeds ingested (`fact_outreach_prospect` 3,917 memberships / 122 sequences; `fact_meeting` 372) and the email-join works. Outreach page (OR3) no longer shows meetings as "pending" — new **Meetings Booked — Attributed to Outreach** panel with 3 nested tiers: **Outbound prospecting 38** (SoPro/Microsoft TUM/Workstream 3 — the figure vs Paul's 100 target) · **+Events & campaigns 102** · **Any marketing touch 126** (matched 126 of 239 emailed meetings, 364 total, H1 2026). Tiered deliberately (option 4 + info box) because a meeting can match many sequences and broadcast newsletters over-attribute — Outbound is the strict figure; OR4 "which count" stays Margot's confirm. Email-based join = partial coverage, shown honestly. New `getOutreachAttributedMeetings`/`useOutreachAttributedMeetings` + `v_meeting` view; `methodology.js` updated; `vite build` ✓. Workflow OOM (121 seqs) + pagination-loop both fixed (batched loop + sparse `fields[prospect]=emails`, single page/seq). **OR9 (per-sequence Created Opps/Won) is the remaining follow-on** (meeting→Opportunity hop).
>
> **2026-07-08 (CC-6 — Outreach→SF meeting attribution pipeline built):** Built Paul's meeting-attribution method end-to-end at the data layer (`prospects.read` is available → no Outreach re-consent needed). **All ADDITIVE — no existing node/table/branch touched.** New READ tables `fact_outreach_prospect` (prospect email ↔ sequence) + `fact_meeting` (SF meeting at contact-email grain) + join view `v_outreach_attributed_meetings` (matches on lowercased email; RLS authenticated-only, anon revoked). **SF workflow**: meetings SOQL now selects `Who.Email` (`TYPEOF Who`) + a parallel `Build Meeting Identity Rows → Upsert fact_meeting` branch (aggregated `fact_meeting_daily` branch untouched). **Outreach workflow**: parallel branch off the schedule — `/sequenceStates?include=prospect,sequence` (paginated) → `fact_outreach_prospect` (sequence-engagement branch untouched). Backups `.pre-cc6-bak` on both; JSON round-trip validated; existing branches verified intact. Join is **email-based → partial-match** (honesty note planned). **ACTION (you): import + run both workflows**, then I verify the join + wire the Outreach page (OR3 meetings). Unblocks OR3 + the Outreach-as-channel half of X8; OR9 opps/won is a follow-on hop (meeting→opportunity).
>
> **2026-07-08 (X8 part 1 — Events & Webinars split into two channels):** The single Salesforce "Events & Webinars" channel now presents as **"In-person Events"** + **"Webinars"** across the **Overview** channel chart, **Pipeline** by-source table, and **Board** channel contribution/donut/trace-table. Done at the read layer via a new `displayChannel(row)` helper (`queries.js`) that splits on `campaign_type` (added to `FACT_COLS`; `groupBy` now accepts a fn) — **no re-ingest, no schema change**; `dim_channel` stays one row so the channel filter/selector + the dedicated Events page (which splits internally) are untouched. Verified live (H1: In-person **€298.8k pipeline / 49 SQL** — the revenue driver; Webinars €23.8k / **75 MQL** — top-of-funnel), totals reconcile to the old combined row. `vite build` ✓. Serves Margot **OV6 / X8** (Events↔Webinars half). **Remaining for X8:** Outreach funnel channel (blocked on CC-6) + Paid Search empty-state.
>
> **2026-07-08 (DB freshness + future-dated-rows verification):** Confirmed via live Supabase queries that the SF ingestion **last ran 2026-07-06 (~16:36–16:39 UTC)** — no run since; all July workflow edits (EUR currency, GP margin, status-based MQL, Created Opps, B8 open-opps `CampaignId != null`) are in the store. **B8 is effectively LIVE** (not "awaiting re-ingest" as older entries say): `fact_opportunity_stage` dropped 965 opps/£52.7M whole-book (23 Jun) → **69 opps/€1.25M** marketing-attributed + EUR (05–06 Jul). Also verified the **future-dated rows** in `fact_channel_daily`: **16 rows dated after 2026-06-30** (max 2026-12-31), carrying **€0 pipeline/€0 won** — mostly the closed-lost artifact (**37 SQLs on future `CloseDate`s**, e.g. 26 on 2026-09-30) + 9 July leads + 2 created opps. Loaded on purpose (ingestion isn't date-filtered → Q3/Q4 re-openable with no re-ingest) and **filtered out of every on-screen figure** by the to-date cap — inert data-at-rest, not a leak. Detail written into `NUMBERS_CALCULATION.md` §0.1. In-scope H1: 5,678 leads · 126 SQLs · 94 created opps · €512k pipeline · €450k won.
>
> **2026-07-07 (X3 Created Opportunities + X6 current-vs-ongoing + client answer docs):** **X3 Created Opportunities is LIVE** (2026 = 96) — `fact_channel_daily.created_opp_count` (every opp w/ a CampaignId, counted by CreatedDate, all stages) exposed on `v_fact_enriched`, surfaced via `funnelOf.createdOpps` across the **Overview** funnel, **Pipeline** funnel + by-source column, **Board** overall metrics (order 3, trace-safe), **Events** KPIs, and the **Channel** per-campaign table + KPI (covers LinkedIn LI6). Dating note: Created Opps (96) < SQL (163) is expected — created-in-period vs activity-in-period. **X6 current-vs-ongoing split is LIVE** — new `CurrentVsOngoing` panel on Pipeline (proposed viz): buckets the period's pipeline/revenue by `campaign_start_date` into current / prior / undated + per-bucket avg sales-cycle; verified prior-campaign revenue €255k @ ~651-day cycle vs current €95k @ ~94-day (the long-tail story). The current-period €0 now self-explains (genuine zero — new campaigns build pipeline first). Also: **per-campaign theme override** (move a campaign to another theme, `campaign_overrides.theme`). **Only OR9 remains for X3** (Outreach per-sequence opps — blocked on CC-6 attribution). **New client-facing docs:** `docs/MARGOT_QUESTIONS_ANSWERED.md` (all 38 of her questions answered w/ status) + `docs/FEEDBACK_ANSWERS_MARGOT.md` (full point-by-point); `CLIENT_RESPONSE_MARGOT.md` refreshed to current state. `vite build` ✓. **Next:** X8 (Outreach + Paid Search channels, Events/Webinars split), replicate X6 per-channel/Events, OR9/CC-6, KPI-register rebuild.
>
> **2026-07-06 (later, PM — theme rollup + margin resolved + ingestion enriched):** Built the **campaign-level quarterly-theme view (Margot X4/G3)** — new **Campaigns** page (`src/components/pages/Campaigns.jsx` + `campaigns` route + sidebar entry): every Salesforce campaign is auto-grouped into its overarching quarterly **theme** via a name-matching rule engine (`src/data/themes.js`; 5 named themes + an "Other activities" catch-all so nothing is hidden — NOT a hardcoded list), rendered as an expandable theme card (rollup "as a whole") over a per-activity table with editable names + an `Explain` note. New `getCampaignThemes`/`useCampaignThemes` read `v_fact_enriched`. **Isolated & read-only** — `themes.js` is imported only by that new query + page, so it cannot affect any other metric/page. Chose name-matching over Salesforce `ParentId` because CWSI's campaign hierarchy groups by **vendor/partner** ("Microsoft Parent" 18 children, "SentinelOne Parent" 6…), not by theme; ParentId + `StartDate` were still ingested into `dim_campaign` (start_date 371/504, parent_id 41/504) to unlock the current-vs-ongoing split (X6) + a future by-vendor view. **Margin (OV2/BP3) RESOLVED:** the "94.7% / margin≈revenue" wasn't a data gap — Salesforce has Gross Profit on **all 30** marketing-attributed won 2026 opps, and the ingest loaded €426,132 into the base table; a leftover **`v_fact_enriched` guard** was nulling every 100%-margin deal. Removed it (migration `v_fact_enriched_use_full_gross_profit`) → **influenced margin now €426,132 = 94.7% of €450,062 won, 0 null** (high because ~20 won deals have GP = full revenue / no cost entered in SF — shown faithfully per client decision, flagged for Margot). Also fixed a workflow bug (dim_campaign upsert `queryReplacement` lived under `options`, caused a `$6 out of range`) and made `Build Fact Rows` margin sum partial GP instead of voiding a whole row. `vite build` ✓. Detail in `REVAMP_UPDATES.md`.
>
> **2026-07-06 (Margot revamp — explain layer, MQL live, Track A done):** Shipped the in-UI **"explain" eye-button methodology layer** (`src/data/methodology.js` registry + `src/components/Explain.jsx` portaled popover) across Overview/Pipeline/Board/Channel/Events/SEO/Outreach/KPI-Tracker/Budget — a client-facing "how we got this number" note on every KPI, funnel stage and table header. **MQL redefined** to `Status='Marketing Qualified Lead' or beyond` (workflow `MQL_OR_BEYOND` allow-list); user re-ran ingestion, **verified live** (SEO MQL 99→47, LinkedIn 76→34). **Track A UI clean-ups #5–#7 done:** Outreach (removed Engagement-by-Step-Type, region→header), KPI Tracker (budget → own `Budget.jsx` page, removed spend-lines/correction-rows tiles + line-count affix, Unassigned→"All regions (shared)"), SEO (top pages/keywords capped 10, GA4→cwsisecurity.com family, GSC trimmed to tables). ⚠️ **Margin data issue found post-re-ingest:** Gross_Profit_Value__c = full revenue on 20/24 won deals → influenced margin ≈ closed-won (94.7%); eye-note made honest, flagged for CWSI. Full detail in `REVAMP_UPDATES.md` + `CLIENT_FEEDBACK_MARGOT_JUL2026.md`. `vite build` ✓.
>
> **2026-07-01 (later — full 2026-scope audit; LinkedIn ROI pre-2026 leak fixed):** Swept **every** accessor in `queries.js` for pre-2026 leakage as the app actually queries it. All clean EXCEPT one: **`getLinkedInSnapshot`'s SF-attributed ROI block** (`channel_name='LinkedIn Paid'`) was **unscoped by year** ("lifetime, to match the lifetime spend snapshot"), pulling attributed pipeline/revenue back to 2021 → **ROI inflated** (all-time £170.6k pipeline / £268.2k won vs 2026 **£31.0k / £32.1k**). Fixed: added `year >= HISTORY_START_YEAR` + `activity_date <= toDateCapIso()` to the attributed read, so LinkedIn ROI now uses 2026 attributed value only. Verified all other surfaces 2026-only: LinkedIn **delivery** rows (source='linkedin') are a single 2026-06-12 cumulative snapshot (0 pre-2026); Outreach seq/step are current snapshots (2026); marketing spend 0 Q3+ rows; SEO top-N RPCs 0 rows past 30 Jun. **One cosmetic non-issue left:** the campaign-picker dropdown (`getCampaignsForChannel` → `v_campaign_current`) lists all `is_current` campaigns regardless of year — it's a filter *control*, not displayed data (selecting a pre-2026 campaign just returns an empty 2026-scoped result), so left as-is. `vite build` ✓.
>
> **2026-07-01 (later — "year in campaign name ≠ data period" notice on every channel page):** After the client asked why a campaign called "2024 UK Intune Workflow" appears in a 2026 view, confirmed it's correct — it's a long-running SoPro Email nurture *named* after its 2024 launch but still active, and the row shows only its **real 2026 activity** (1 SQL 27 Jan + 1 lead 8 Apr; the 1,753 leads from 2024 Q3 are excluded by the 2026 scope). Added a **general amber notice above the per-campaign table** — phrased generically (not naming any one campaign): some SF campaigns are named after their launch/event year (e.g. "2024 …", "25.09.2025 …") but are long-running; **the year in the name is just a label, not the data period**; every figure is the campaign's real 2026 activity only (Q1–Q2 2026), earlier-year activity excluded by the 2026 scope. Added in **two places** (they're separate components): (a) `Channel.jsx` `Body` → all channel pages (Email/SEO/LinkedIn/Other); (b) **`Events.jsx` `FunnelAndCampaigns`** → the dedicated Events page (its own per-campaign table, not the Channel component), with wording noting the common case there — an attendee from a 2024/2025 event whose opportunity reaches SQL in 2026 (verified live: "Blaud - EOY Event 2024" + "…Friday Night Breach Event" show only their 2026 SQLs). `vite build` ✓.
>
> **2026-07-01 (later — Email Engagement snapshot scoped to 2026):** The Email page's "Emails sent" engagement snapshot was surfacing **pre-2026 legacy campaigns** ("Deloitte Fast 50 Winner" 2021, "03.05.2022 SoPro Dubber") because `fact_email_engagement` stores a **lifetime `NumberSent`** with no activity-year and the snapshot (like LinkedIn) ignores the quarter/year filter. `getEmailEngagement` (`queries.js`) now filters rows to campaigns that had **Email-channel activity in the reporting window** (`v_fact_enriched`, `channel_name='Email'`, `year ≥ 2026`, capped at Q2 close via `toDateCapIso()`; not region-filtered so a campaign counts as 2026 globally). **Consequence — the snapshot is now EMPTY:** the only campaigns with a `NumberSent` are the two pre-2026 legacy ones, and none of the 18 Email campaigns with 2026 activity carry a send count in this SF org (verified live). So there is genuinely **no 2026 email-send data** — the page now shows a corrected empty-state (`Channel.jsx`: "No 2026 email-send data in Salesforce… only recorded on pre-2026 legacy campaigns") instead of the old misleading "re-run the workflow" message or a 2022 figure. Note: "2024 UK Intune Workflow" in the Email *campaign performance* table is unaffected and correct — it's a 2026-scoped funnel row on a campaign merely *named* "2024" (real 2026 activity: 1 SQL Jan + 1 lead Apr). `vite build` ✓.
>
> **2026-07-01 (later — Q3/Q4 TEMPORARILY hidden by us (reversible); "seed" label removed):** We now display **Q1 2026 + Q2 2026 only**. **This is a deliberate temporary display toggle on our side, NOT a client decision — Q3/Q4 WILL be shown later.** Nothing was deleted; the Q3/Q4 data flows in as normal (ingest is not date-filtered to H1), we've only capped the read/UI layer, so pulling it back is a ~2-min reversal. **What we turned off (two changes, both in `src/data/constants.js` + one helper):** **(1)** `QUARTER_PILLS` trimmed `Q1/Q2/Q3/Q4/YTD` → **`Q1 / Q2 / YTD`** (removed the q3 + q4 entries; `QuarterPills` just maps this array, so the buttons disappear everywhere → can't be selected). **(2)** added `REPORTING_END_ISO = '2026-06-30'`, consumed by new **`toDateCapIso()`** in `queries.js` ( = `min(today, REPORTING_END_ISO)` ), applied to **every date-scoped read** so YTD (=Q1+Q2) can't leak Q3+: `applyFilters` (funnel), `applyWebFilters` (GA4 + SEO daily — previously had NO cap), `getRetention`, `getEvents` (webinars — previously uncapped), `getMeetings`. Snapshots (LinkedIn/email/opp-stage/Outreach) are current-state as-of-date views, untouched. **↩️ To re-enable Q3/Q4 later:** (a) add `{ q:'q3', label:'Q3' }, { q:'q4', label:'Q4' }` back to `QUARTER_PILLS`; (b) set `REPORTING_END_ISO = null` (falls back to plain "today" = the exact pre-1-Jul to-date behaviour) or move it forward (e.g. `'2026-09-30'` to reveal Q3 only); (c) `vite build` + redeploy — no DB/workflow/query-logic change. Full checklist in `CWSI_Dashboard_DataSource_Mapping.md` (scope box). **Verified against live data:** only post-Q2 rows anywhere were 3 GA4 web rows (now capped); SEO top-N RPCs, marketing spend, meetings had 0 rows past 30 Jun. **(3)** Overview subtitle "Source: Salesforce **(seed)**" → **"Source: Salesforce"** — the "seed" tag was stale early-build wording (funnel is live SF data, re-synced today) and misleadingly implied dummy data. `vite build` ✓.
>
> **2026-07-01 (2026-only scope enforced on the two snapshot leaks — Margot's email):** Margot flagged the dashboard still shows historical records (incl. 2022). Audited every surface against the live store: the funnel, channel splits, SEO, GA4 web, events, meetings, outreach, email, LinkedIn and marketing-spend are **already 2026-scoped** (`HISTORY_START_YEAR=2026` year predicate + to-date cap), and their underlying pre-2026 rows (2,726 in `fact_channel_daily`, 5,091 in renewals) are filtered out at query time and never displayed. **Only two snapshot surfaces leaked**, because they deliberately ignore the year filter: **(1) Pipeline → Stage Distribution** (`getOpportunityStage`/`v_opportunity_stage_current`) was **whole-book open pipeline — 965 opps / £52.7M incl. opps created back to 2019/2022**. `fact_opportunity_stage` carries **no created/close date** (only `snapshot_date`), so it can't be app-filtered → fixed at the **data layer**: `salesforce_ingestion.json` "SF: Get Open Opps" SOQL now `WHERE IsClosed = false AND CreatedDate >= 2026-01-01T00:00:00Z` (re-run required to refresh the snapshot). Panel sub-caption updated to "Open opportunities (created 2026) by stage". **(2) Retention KPI** (`getRetention`, Overview + KPI Tracker) used an open-ended `year >= 2026`, leaking **2027/2028 future-dated won renewals** (6 deals, ~£737k). Fixed at the **app layer**: ytd branch bounded to `.eq('year', REPORTING_YEAR)` + a `activity_date <= today` to-date cap (mirrors `applyFilters`) — so future-dated renewals drop without a re-ingest. Verified clean: LinkedIn snapshot (single 2026-06-12 date), email snapshot (2 campaigns, 2026-06-23) carry no pre-2026 rows. `vite build` ✓. **ACTION (you, before the working session): re-import + run `salesforce_ingestion.json` in n8n** so the stage distribution refreshes to the 2026-only snapshot (the retention fix is already live in code).
>
> **2026-06-26 (UI: "why is this n/a?" callouts on unavailable metrics — TEMPORARY, until the data lands):** Surfaced a plain-English reason next to every place the dashboard shows an unavailable value ("—" / "n/a"), so a non-technical viewer understands *why* a number is blank rather than reading it as a bug or a zero. **These callouts are deliberately conditional and self-removing** — each renders only while the underlying data is genuinely missing for the active scope, so the moment the source lands (vendor cost in SF, per-channel spend, SF↔Outreach attribution join) the explanation disappears on its own; nothing to clean up later. Reasons are the canonical `ctx` strings from `kpiRegister.js`, reused verbatim. Added (all reuse the existing `callout amber` / `info-pill` styling — no per-cell table changes, one note per table/section placed outside the table): **(1) Overview — Influenced Margin tile:** amber callout under the top KPI row explaining margin = won amount − vendor cost and that the won deals in scope have no vendor cost entered yet (deal count dynamic via `funnel.marginPendingDeals`); the small "not available yet" pill stays in the tile. **(2) Overview — Quarter Health panel:** `info-pill` footnote explaining CPL average n/a (per-channel spend pending) and event-attendance n/a (no GoToWebinar data in scope, shown only when `!evt`). **(3) Pipeline — "Pipeline by Source" table:** amber callout explaining the CPL column shows n/a because only LinkedIn delivery spend is in `v_fact_enriched`; other channels' spend pending (Margot's merged sheet). **(4) Outreach — "Sequence Performance" table:** amber callout explaining Open%/Reply% n/a where a sequence has no prospects (no denominator) and Meetings/SQLs/Pipeline £ "pending" because the SF attribution join (+ agreed EUR→GBP rate) isn't wired — engagement counts are live, the revenue link is the pending part. **Left as-is (already carry a visible reason):** Channel campaign table + email snapshot (existing callouts), Outreach Pipeline Contribution + Marketing budget, Events in-person/owned-vs-earned (`NotAvailablePanel`), Board pipeline-health + margin card (existing notes), Pipeline/Overview stage-distribution & recommendations (`NotAvailablePanel`). **Deliberately skipped:** the SEO "engagement %" em-dash — there it only means a property had zero sessions (no denominator), a computed-rate edge, not a data-source gap, so a callout would mislead. `vite build` ✓. UI-only; no data/schema/workflow change.
> **Same day — plain-language data sources (no DB internals in the UI):** the dashboard is for non-technical marketing users, so every user-visible reference to a database view/table/field was replaced with the actual data source in plain English. Changes (rendered text, sub-headers, chips, callouts, hover tooltips, `NotAvailablePanel` reasons): `v_fact_enriched` / `v_campaign_current` → **"Salesforce"** (Pipeline + Channel sub-headers, the Pipeline "by Source" chip, the CPL/conversion callouts now say "once that spend is added to the data"); `Campaign.NumberSent` → "campaign send count"; `Campaign.Type` → "campaign type" (Events callout, owned/earned panel, registrant→MQL sub-header); `kpi_targets` → "saves automatically" (KPI Tracker banner + edit tooltip); `docs/KPI_REGISTER.md` path dropped from the Board provisional-targets caveat; **"the warehouse" → "the source data"** everywhere it was viewer-facing (Board trace-to-data pass/blocked/idle copy, the two new callouts). Overview header dropped the redundant "live from v_fact_enriched" (already says "Source: Salesforce"). Code **comments** keep the real view/table names (developer-facing). Verified: no DB view/table/field identifier remains in any rendered string across `src/components`. `vite build` ✓.
> **Same day — Board pack "why n/a / —" callouts:** the board pack previously had only two callouts (provisional-targets + pipeline-health weighted-forecast) and left the headline-card "n/a" values and the pipeline-health "—" unexplained. Added: **(1)** a consolidated amber callout directly under the 7 headline KPI cards that renders only when a metric is "n/a" and **lists each pending metric with its reason** (driven off the per-metric `note`: Influenced Margin → "vendor cost pending on all won deals", Cost per Lead → "pending per-channel spend mapping", Closed Opportunities → "pending Salesforce data refresh"), with a lead line that the blank is deliberate, not a zero, and every other figure is live. **(2)** extended the existing pipeline-health callout to explain the **"—"** in the Probability column (stage has no win-probability set in Salesforce → not weighted into the forecast; Total row "—" because a total has no single probability). Also de-jargoned the metric note `pending SF re-run` → `pending Salesforce data refresh` (`boardPack.js`). Same conditional/self-removing pattern as the page callouts — disappears per metric as each data source lands. `vite build` ✓.
> **Same day — Data Source Report kept in lockstep:** updated `docs/CWSI_Data_Source_Report.md` so the client-facing doc reflects the new on-screen reason callouts. §4.2 now states **"—"** (headline tiles) = **"n/a"** (tables/inline) = *not available yet*, and adds a "**Every unavailable value explains itself**" paragraph (each blank now carries a plain-English reason that self-removes when data lands); §4.8 formatting note updated to mention "—" + the reason-alongside rule; §5.1 Influenced Margin row notes the fully-blank "—" case (current quarter, all won deals un-costed); §5.8 Sequence Performance row notes open%/reply% "n/a" (no prospects) + pending columns; §5.10 Board Pack section documents the consolidated "why n/a" callout (per-metric reasons) and the Pipeline-Health "—" probability. Doc-only.
> **Same day — Email page: dropped not-applicable Spend/Impr columns.** The Email channel reused the generic channel `Body`, so its Salesforce-attributed funnel table carried **Spend** and **Impr.** columns that always read "n/a" (email is sent→delivered→opened, not a paid-impression channel; there's no email-spend feed) — and the explanatory callout was gated off for email, so they showed n/a with no reason. Rather than caveat a column that will never apply, extended the existing `{!isLinkedIn && …}` guards to `{!isLinkedIn && !isEmail && …}` (header, body cells, total row) in `Channel.jsx` so the Email funnel table now shows just Campaign · Leads · MQLs · SQLs · Pipeline £ · Closed-Won £ (all real, SF-attributed); email delivery metrics stay in the dedicated Email Engagement snapshot above. Mirrors the LinkedIn treatment. `vite build` ✓.
> **Same day — Email page: "£0 pipeline is a real zero" callout.** Verified against live data that email-attributed pipeline is genuinely tiny (2026: only one campaign ever generated open pipeline — £5,024 in Q1; Q2 = £0 across all campaigns; YTD £5,024 pipeline / £26,036 closed-won), so a single-quarter view (e.g. current Q2) correctly shows £0 in every Pipeline £ row. This is a true zero (email is top-of-funnel; leads convert under other channels/later), not a missing feed — distinct from n/a per §4.2. Added an email-only callout under the Campaign Performance table explaining this and pointing to YTD for the fuller picture (`Channel.jsx`, gated on `isEmail`). `vite build` ✓.
> **Same day — Outreach: corrected WHY meetings is pending (Outreach feed, not SF attribution).** Client flagged that the "pending" reason on the Outreach page's **Meetings** was mislabelled. Verified in the warehouse: `v_outreach_sequence_current.meetings` is **0 across all 211 sequences** — meetings come from **Outreach.io's own meetings-booked counter**, which isn't syncing yet (reads 0), so it's pending the *Outreach* feed, **not** a Salesforce attribution link. (These are the Outreach-sequence-generated meetings the "100" target tracks — deliberately not the all-meetings `v_meetings` SF figure we already hold.) **SQLs/Pipeline £ remain correctly pending the Outreach↔SF link + EUR→GBP rate** — those are genuine SF outcomes. Fixed the wording everywhere it was wrong: Meetings KPI sub "pending Salesforce attribution" → "pending Outreach meetings feed" (`Outreach.jsx`); the Sequence-Performance callout now splits Meetings (Outreach feed) from SQLs/Pipeline (SF link); `queries.js` comments + the `meetings: NA` inline reason corrected; Data Source Report §5.8 Meetings/Engagement-Funnel/Sequence-Performance rows corrected. `vite build` ✓.
> **Same day — Outreach: removed SQLs + Pipeline £ entirely (no SF link).** Client decision: since the Outreach↔Salesforce attribution link doesn't exist, drop the SQL and pipeline placeholders from the page rather than show perpetual "pending". Removed from `Outreach.jsx`: the SQLs stage + "SQL → pending" step in the Engagement Funnel; the **SQLs** and **Pipeline £** columns (header + every row/subtotal/total cell, table now Region·Practice·Prospects·Open%·Reply%·Meetings·Status, cat `colSpan` 9→7); the entire **"Outreach → Pipeline Contribution"** panel (its sole purpose was the missing SF link) — Engagement-by-Step now spans full width; SQL/pipeline wording stripped from the top scope callout + under-table callout. Removed the now-dead `Def` component. **Meetings KEPT** (Outreach-sourced, pending its own feed — only the meetings "pending" remains). `vite build` ✓. Note: `v_outreach_pipeline` (SF campaigns named "2026 - Outreach%") still exists DB-side and stays unwired; if the SF campaign-attribution is ever populated, SQL/pipeline can be re-added by reading that view + EUR→GBP. Data Source Report §5.8 updated (Engagement Funnel/Sequence-Performance rows trimmed, Pipeline-Contribution row dropped, + a note explaining the removal).
> **Same day — Outreach "Engagement by Step" now grouped by step TYPE (was per step-number).** The step list previously rendered one row per (step_order × step_type), so every type ("Auto Email", "Call", "Manual Email", each LinkedIn action…) repeated at ~9 cadence positions — a long, repetitive list. Changed `getOutreachSteps` (`queries.js`) to group by `step_type` only (collapsing step_order), aggregating delivered/opens/replies/dials across all positions, sorted by engagement volume (reached desc); dropped the now-meaningless `step` field. UI (`Outreach.jsx` `AllStepsBars`): bar label is now just the type name (`{x.label}`, no "Step N ·" prefix), key = `x.type`, tooltip shows "{type} · N cadence steps"; panel renamed "Engagement by Step **Type**" / sub "Each step type once, aggregated across all cadence positions" / chip "by type". Each step name now appears exactly once. Data Source Report §5.8 row updated. `vite build` ✓.
>
> **2026-06-25 (client-facing Data Source Report):** Added `docs/CWSI_Data_Source_Report.md` — the **non-technical, hand-over** deliverable for CWSI covering, for **every page / panel / number**, three things: where the data comes from, how the figure is calculated (plain arithmetic, no code/DB internals), and how it's shown. Structure: §1 exec overview (8 systems, 3 data-movement types); §2 source-by-source catalogue (Salesforce hourly; GA4/GSC/Outreach/GoToWebinar/budget daily; LinkedIn managed-upload snapshot; Google Ads ready-idle); §3 refresh table; §4 universal rules (actuals-real vs provisional targets, "n/a" vs zero, region/quarter scope + to-date cap + 2026-only YTD, snapshots-respond-to-region-not-quarter, narrowing funnel, status bands, EUR↔GBP at ECB rate, formatting); **§5 complete panel inventory** — every page → every panel as a 5-col table (Panel · What it shows · Source · How calculated & shown · Status), client-language statuses (Live / Live-partial / Pending source / Awaiting client / Under review / Static) translated from the mapping doc's ✅🟡🔴⛔❓; §6 currency; §7 live-vs-pending-vs-under-review; §8 "where does this number come from?" index. Grounded in `CWSI_Dashboard_DataSource_Mapping.md` + `WORKFLOWS.md` + `NUMBERS_CALCULATION.md` + full read of workflows and React pages. The earlier interim `DATA_SOURCING.md` was **removed** (consolidated into this report). Doc-only.
>
> **2026-06-24 (small UI/export tweaks):** (1) **Gamma PPTX payload** now sends a `type` field (`'kpi'|'board'|'pipeline'`) on the start call so the n8n workflow can tell the reports apart (`gammaClient.js`); poll call unchanged. (2) **Gamma poll interval** 30s → **10s** with `MAX_ATTEMPTS` 12 → 30 (keeps the ~5-min budget; ~3× more short polls, each still well inside Cloudflare's 100s cap). (3) **Overview webinar attendance** bar now shows the **no-show percentage** instead of the literal word "no-show" (with hover tooltips Attended/No-show). All cosmetic/operational; `vite build` ✓.
>
> **2026-06-24 (future-quarter "to-date" cap on the funnel):** Fixed Q3/Q4 (and YTD) showing phantom funnel data. Root cause: SF **closed-lost** opps can carry a stale *future* `CloseDate`, so they're dated into Q3/Q4 2026 and leak `sql_count` there (£0 pipeline, 0 won); the monotonic floor (`funnelOf`) then lifts Leads/MQL up to that SQL level, making not-yet-started quarters look populated (Q3 showed 34 SQL → 34 MQL → 34 leads from zero real Q3 acquisition). **Fix:** `applyFilters` (`queries.js`) now caps every `v_fact_enriched` read at `activity_date <= today` (`.lte`), so all funnel figures are "to date" — future quarters return empty and YTD stops at today. **Considered + rejected** the heavier option (exclude closed-lost from `sql_count` in ingestion): it's definitionally wrong (a lost deal *was* an SQL), collapses SQL onto Opp (SQL→Opp becomes a constant 100%), and moves a headline board metric (MQL→SQL 54%→21%) — needs Margot sign-off. The date cap fixes the actual *dating* defect without touching the SQL definition or any board metric. **Verified live:** Q3 34→0, Q4 1→0; Q1 unchanged; YTD **influenced pipeline £617k + closed-won 25 fully preserved** (only future-dated phantom SQLs drop: YTD SQL 158→118). Current quarter is now "to date" (Q2 SQL 53→48 as 5 closed-lost opps dated later in June fall outside the cap until their date passes). Scoped to the fact funnel only — **webinars are intentionally not capped** (upcoming events legitimately have future-dated registrations). `vite build` ✓. Docs: `NUMBERS_CALCULATION.md` §0.1.
>
> **2026-06-24 (architecture doc):** Added `docs/ARCHITECTURE.md` — end-to-end system reference: the sources→n8n→Supabase→views→`queries.js`→hooks→React data flow (with the warehouse-not-live rationale); the full **database inventory grounded in the live store** (dim/fact/app tables with grain + row counts, every `v_*` view and which `queries.js` fn reads it, the two SEO top-N RPCs); how data gets **in** (per-workflow ingestion summary) and **out** (the read path + the five cross-cutting mechanics: filter scoping, to-date cap, 1000-row pagination, `NA` sentinel, monotonic floor); the board-pack AI layer (compute→narrate→trace-validate→persist), the export layer (Gotenberg PDF / Gamma PPTX), auth + RLS, a "what fetches what" index, and the tech stack. Doc-only; schema verified via live SQL.
>
> **2026-06-24 (calculation reference doc):** Added `docs/NUMBERS_CALCULATION.md` — a full reference of how **every** dashboard number is calculated: source view/column, scope (filters), step-by-step operations, and the formula, for each surface (funnel, Overview, KPI Tracker, Pipeline, Channel, LinkedIn, Email, Events, Retention, Meetings, Outreach, Board pack, SEO/GA4, Marketing spend) plus the shared foundations (filter scoping, 1000-row pagination, the `NA` "not-available-vs-zero" rule, the monotonic funnel floor, targets/status lights, EUR→GBP FX, display formatting) and a "where does this number come from?" index. Doc-only; no code change.
>
> **2026-06-24 (latest — KPI Register + Pipeline now use the SAME branded PDF + Gamma PPTX routes; CSV + local exporters dropped):** Extended the board pack's two export routes to **all three reports**. The Export page now shows exactly **two buttons per report — PDF + PPTX** (KPI Register lost CSV; Pipeline lost CSV; both lost the old local jsPDF/pptxgenjs renders). **PDF** = the CWSI-branded HTML → headless-Chrome (Gotenberg) PDF; **PPTX** = the editable Gamma deck (preserve-mode, figures kept verbatim). **Both n8n webhooks are report-agnostic** (they render whatever HTML/Markdown they're given), so KPI + Pipeline reuse the *same* endpoints and env vars (`VITE_BOARDPACK_PDF_WEBHOOK_URL`, `VITE_GAMMA_WEBHOOK_URL`) — **no new workflows or operational setup**. New `src/data/reportHtml.js` (`buildKpiRegisterHtml`/`buildPipelineHtml`) renders into the **shared branded shell** now exported from `boardPackHtml.js` (`pageShell` + `esc`/`tableRows`/`block` + shared CSS, plus a lighter `.stat` card + `.cat`/`.dot` register styles) — KPI Register = provisional-targets banner + grouped register table (Actual / Target·scope / vs-Target with 95-/80-band status dots); Pipeline = headline funnel stat strip + by-channel table. New prompt builders `buildKpiRegisterPrompt`/`buildPipelinePrompt` in `gammaClient.js` (one card per KPI category; funnel + by-channel cards). **Clients generalized:** `pdfClient.generateBoardPackPdf` → `generateReportPdf(report, filters)`; `gammaClient.generateGammaPpt` → `generateReportPpt(report, filters)` — each dispatches on `report` to the right builder, fetching the same scope-fresh data the pages show (`assembleKpiRegister`/`assemblePipeline`, still in `exporters.js`). **`exporters.js` slimmed dramatically:** all CSV + jsPDF/pptxgenjs exporters and their heavy imports removed (now fully unused → tree-shaken out: the `exporters` chunk dropped to ~1.5 kB); it's now just `download` + the two assemble helpers + a dispatcher (PDF/BRANDED→`generateReportPdf`, PPTX→`generateReportPpt`). **`Export.jsx`:** KPI + Pipeline formats `['PDF','PPTX']`; board unchanged (`['BRANDED','PPTX']`, branded route still labelled "PDF"); per-report modal notes + button label ("Generate PDF" / "Generate deck") updated; page-sub reworded. `vite build` ✓. **No new operational steps** — once the existing Gotenberg + Gamma webhooks are live (see prior entries), all three reports work.
>
> **2026-06-24 — Board-pack PPTX now via Gamma; Google Slides retired:** The board-pack **PPTX** export is now an **attractive, editable Gamma deck** instead of the plain jsPDF-styled pptxgenjs slides, and the **Google-Slides "Branded deck" path is retired** (the user confirmed its PDF output wasn't attractive). **Trace-to-data preserved — the key design point:** Gamma is called with **`textMode:"preserve"`** (Gamma keeps the supplied text verbatim, only adding structure) so the already-validated figures and the number-checked narrative can never be paraphrased, rounded, or invented — `"generate"` mode would break the zero-invention guarantee. New `src/data/gammaClient.js` (`generateGammaPpt(filters)` + `buildBoardPackPrompt(pack, generated)`): same dual-fetch as `pdfClient` (`getBoardPack` + latest **trace-passed** `getLatestBoardPack`), then assembles a deterministic **Markdown brief** from the SAME pre-formatted display strings the screen shows — cover, top-line KPI table (#/metric/actual/target/%FY/QoQ/status + provisional caveat), channel contribution, the 6 narrative sections verbatim, recommendations, gaps-to-close levers, pipeline health, regional split (all-regions only), retention — each a `\n---\n`-delimited card (so the workflow uses `cardSplit:"inputTextBreaks"` for one-section-per-card). Empty sections are omitted; figures-only deck if no narrative published yet (mirrors `pdfClient`). **Workflow rewritten — `workflows/gamma-generation.json`:** was a manual-trigger test stub returning just a `gammaId`; now **Webhook → Create Generation (`preserve` + `exportAs:"pptx"` + brand `additionalInstructions`) → Wait/Poll loop → Status Switch (completed/failed/pending-loops-back) → Download PPTX (`exportUrl`, response=file) → To Base64 (`this.helpers.getBinaryDataBuffer` — same pattern as the PDF render fix, since n8n may store binary on disk) → Respond `{pptxBase64,gammaUrl}` with CORS \***. The hardcoded Gamma API key was removed from the committed JSON → now `$env.GAMMA_API_KEY` (**rotate the old key — it was in git history**). **Dispatcher (`exporters.js`):** `board/PPTX` now lazy-imports `gammaClient`; the generic `DECK` branch removed. **UI (`Export.jsx`):** board formats `['BRANDED','PDF','PPTX']` (DECK dropped); PPTX dialog copy + button ("Generate deck") updated. **`.env.example`:** `VITE_SLIDESDECK_WEBHOOK_URL` block replaced with `VITE_GAMMA_WEBHOOK_URL`. **Cleanup:** `src/data/deckClient.js` deleted (Google-Slides client, now unwired); `boardPackPptx` in `exporters.js` is now unreachable (retained for reference). KPI/Pipeline PPTX stay on the native path for now — replicating Gamma to them later is just a new prompt builder + dispatcher branch (no new transport). `vite build` ✓. **PENDING (operational, you):** import the rewritten workflow, set `GAMMA_API_KEY` in n8n, activate, paste the production webhook URL into `VITE_GAMMA_WEBHOOK_URL`; then verify a live render end-to-end. **Decision:** keep PDF on Gotenberg (brand-exact, deterministic, trace-safe) and PPT on Gamma (attractive, editable); bind a Gamma **theme/template** once dashboard access exists for full brand consistency. **Note:** board figures pass through Gamma's cloud (same data-egress consideration as Gotenberg) — fine for an accepted vendor, worth flagging for a finance client. **FIX (same day) — async start/poll to beat Cloudflare's 524:** the first live test returned HTTP **524** + a phantom CORS error. Root cause: n8n Cloud is behind **Cloudflare, which hard-times-out any request at ~100s**; a Gamma deck takes 1–3 min, so the *synchronous* webhook (start→poll-loop→download in one held-open request) was severed before `Respond` fired (and Cloudflare's 524 page carries no `Access-Control-Allow-Origin`, hence the misleading CORS message). The deck itself generated fine in n8n — the transport was the problem. **Rebuilt async:** one webhook, an `Is poll?` IF branch on whether the body carries a `generationId` — `{prompt}` → Create Generation → respond `{generationId}` immediately; `{generationId}` → Poll Status → Switch (completed → Download PPTX → base64 → respond `{pptxBase64}`; failed → 502; pending → respond `{status:'pending'}`). The **frontend now drives the loop** (`gammaClient.js`: start, then poll every **30s** up to ~6 min — the interval is a client-side `setTimeout` between separate short requests, so each request returns in ~1–2s regardless; 30s keeps n8n executions low), so every request returns well inside 100s. `vite build` ✓. Re-import the workflow to pick this up.
>
> **2026-06-23 (Branded Board Pack PDF via headless Chrome / Route 3 + narrative-in-export + UI default-expanded):** The downloaded board-pack PDF now **matches the approved artifact design** (navy cover + logo, KPI cards with status chips + QoQ, branded sections + AI narrative) by rendering the *actual branded HTML* through **Gotenberg (headless Chromium)** rather than drawing jsPDF tables — real, vector, selectable text. New pieces: `src/data/boardPackHtml.js` (`buildBoardPackHtml(pack, generated, scope)` → a self-contained HTML doc: inline CSS from `brandKit` tokens, **base64-embedded white CWSI logo**, the full board view — cover, AI narrative with all 6 sections + recommendations, 7 KPI cards w/ QoQ + chips, channel contribution, pipeline health, regional split, retention, levers, confidentiality footer; `@page A4` + `print-color-adjust:exact` so backgrounds render); `src/data/pdfClient.js` (`generateBoardPackPdf` builds the HTML from fresh figures + the latest **trace-passed** saved narrative, POSTs `{html,filename}` to the webhook, downloads the returned base64 PDF); `workflows/board_pack_pdf_render.json` (Webhook → wrap HTML as `index.html` binary → **Gotenberg** `/forms/chromium/convert/html` with `printBackground=true`+`preferCssPageSize=true` → return `{pdfBase64}`, CORS *). Export page gains a **"Branded PDF"** action (primary on Board Pack); dispatcher routes `board/BRANDED` → `pdfClient` (lazy-imported). `VITE_BOARDPACK_PDF_WEBHOOK_URL` added to `.env.example`. **Verified:** HTML builder smoke-tested against the live figure set + live narrative — well-formed doc, 7 cards, all narrative sections, 0 unfilled tokens; rendered preview published as an artifact. **Dependency (the one manual step):** n8n cloud can't run Chrome itself, so this needs a reachable **Gotenberg** instance; set its URL in the workflow's "Gotenberg: render" node, import + activate the workflow, set the webhook env var. Keep Gotenberg on infra you control — board figures pass through it. **VERIFIED LIVE (24 Jun):** rendered the real HTML through the client's hosted Gotenberg (Railway: `gotenberg-production-9d4e.up.railway.app`, workflow node pointed at it) → clean 4-page PDF matching the artifact. **Layout bugs found + fixed during verification:** (a) the n8n `PDF→base64` node returned the storage marker `"filesystem-v2"` instead of bytes when n8n stores binary on disk → fixed to use `this.helpers.getBinaryDataBuffer`; (b) full-page flex cover stretched/pixelated the logo (default `align-items:stretch`) → `align-self:flex-start; width:auto`; (c) the 7-card KPI grid split across pages and the Pipeline-Health header orphaned → `break-inside:avoid` on the grid + a `.keep` modifier on the short table sections. Re-rendered through Gotenberg after each fix to confirm. **Also this session:** the jsPDF/PPTX board export now embeds the **AI narrative + recommendations** from the saved `board_pack` (see entry below); Board.jsx detail sections now **default to expanded** (still collapsible) and the **AI narrative sections are collapsible** (expanded by default); the n8n board-pack prompt was upgraded to write a **developed 4–7 sentence paragraph per section** (more detail) — needs re-import to take effect.
>
> **2026-06-23 (Board Pack enriched + detail-into-export + validator bug fix; verified live):** Made the board pack materially deeper, expandable on-screen, and richer in the AI narrative + export — all still trace-to-data. **Data (`queries.js` + `boardPack.js`):** new `getBoardPackData(filters)` does one scoped fetch + a prior-quarter fetch, reusing the *same* `funnelOf`/`groupBy`/`sum` helpers the rest of the dashboard uses (so the board pack can't disagree with the channel/pipeline pages). `getBoardPack` now returns, alongside the 7 metrics: **QoQ trend** per metric (vs the prior *in-scope* quarter — null on Q1/YTD, never faked against an out-of-scope quarter), **channel contribution** (pipeline/MQL share), **funnel conversion** rates, **open-pipeline health** (stage distribution + probability-weighted forecast — a region-scoped current-state snapshot, **not** a quarter slice, labelled as such), **regional split** (only at All-Regions scope), and **retention** (retained renewals + expansion). **Every new number is added to `traceTable` in lockstep**, so the zero-invention guarantee holds for the richer figures. **UI (`Board.jsx`):** each metric card shows a QoQ trend badge (`.kpi-delta` up/down/flat); five new **expandable** detail sections (Channel Contribution, Funnel Conversion, Pipeline Health, Regional Split, Retention) — each rendered **only when it has data in scope**, so the top line stays scannable and an open caret never leads to an empty panel. **AI layer (`workflows/board_pack_generate.json`):** prompt now feeds Claude the new dimensions; output schema gains three required narrative sections — **`channelInsights`, `pipelineCommentary`, `riskFlags`** — rendered by `NarrativePanel` and trace-checked by `validateBoardPack` (extended to validate them). **Re-imported + VERIFIED LIVE:** POSTed an enriched figure set to the production webhook → **HTTP 200 ~26s, `claude-opus-4-8`**, all 6 narrative sections + 5 recommendations, narrative cited only supplied numbers (channel shares, open-pipeline £, weighted forecast, QoQ %), and the in-app validator passed **62/62 claims traced, 0 flags**. **Validator bug fixed (`traceValidator.js`):** the number regex was eating the "M" of "540 **M**QLs" as a *millions* suffix (540 → 540,000,000), which would falsely block legitimate packs — the enriched channel narrative ("540 MQLs", "410 MQLs") triggers this constantly. Added a trailing `(?![A-Za-z])` lookahead so a `k/m/b` suffix only counts as a real unit when followed by space/punctuation/end; regression-checked (`540 MQLs`→540, `12 meetings`→12, while `£4.1m`/`612k`/`17.5%` still parse, `GA4`/`H2`/`Q3` still ignored, injected fakes still flagged). No committed unit test existed (the "8/8 assertions" were ad-hoc). **Export (`exporters.js`):** the Board Pack **PDF + PPTX** now render the new detail — top-line gains a QoQ column, plus tables/slides for Funnel Conversion, Channel Contribution, Regional Split (all-regions only), Open-pipeline Health (stages + total + weighted forecast), and Retention — each gated on data presence; reuses `assembleBoardPack` (already the full `getBoardPack`), so export can't drift from the screen. Per-export region+quarter dialog unchanged. **AI narrative NOW embedded in the PDF + PPTX export:** `assembleBoardPack` also reads `getLatestBoardPack(filters)` (the latest TRACE-PASSED pack saved for the scope) and renders the full board-pack view — the 6 narrative sections (On Track, Behind & Addressable, Channel Insights, Pipeline Commentary, Risks & Caveats, H2 Plan, colour-coded) + prioritised recommendations table, via autoTable so long text wraps + paginates. Figures stay fresh; the narrative carries its own "generated {date} · {model} · trace-to-data verified" footer (mirrors the Board page: live figures, last-published narrative). Export never triggers generation — if no pack was published for the scope, it renders figures-only with a prompt to generate on the Board page. Only trace-passed packs are persisted, so an embedded narrative always passed the zero-invention check. `vite build` ✓.
>
> **2026-06-23 (quarterly funnel caveat):** Added an on-screen caveat to the **Pipeline** funnel explaining the mixed-dating semantics behind the 23 Jun monotonic-floor fix. The funnel's per-stage counts are event-dated differently (leads/MQLs by lead date; SQLs/pipeline/closed-won by opp created/close date), so under a single-quarter scope a deal can land in different quarters at each stage — which is why e.g. **Q3 shows MQLs/SQLs even when raw Q3 lead creation is ~0**. The floor (`funnelOf`, `queries.js`) keeps the display monotonic (Leads ≥ MQLs ≥ SQLs by construction) but the right reading per quarter is **"reached-or-beyond, scope-dated"**, not same-cohort flow. New `callout amber` in `src/components/pages/Pipeline.jsx` (reuses the existing provisional/margin caveat pattern + `I.info`), gated on `filters.quarter !== 'ytd'` so it shows only on Q1–Q4 and stays hidden on YTD (where stages reconcile). **Decision recorded:** keep the floor + caveat; **rejected cohort-dating** (date every stage by the lead's entry quarter) because it would diverge from how Salesforce itself reports opps (by close/created date) and is a heavy ingestion re-architecture for marginal value given the board pack leads on absolutes + YTD. **Not yet carried into exports** — the PDF/PPTX/branded-deck funnel (`deckClient.js`/`exporters.js`) and the board-pack funnel block don't show the caveat; optionally add there. Funnel still defaults to its current scope (caveat points users to YTD rather than forcing it).
>
> **2026-06-23 (branded decks via Google Slides, Board Pack slice):** New export path: one CWSI-branded Slides master per report → fill via the Slides API → export the *same* deck to **PDF + PPTX**, delivered in-app through an n8n webhook (same seam as board-pack). **Templates auto-created** by a one-time bootstrap workflow (`workflows/slides_template_bootstrap.json` — creates all 3 decks with every `{{token}}`/`[[CHART]]` named); TEMPLATE_IDs captured (board/kpi/pipeline). **Shipped this slice (Board Pack, text+layout; charts deferred):** `src/data/brandKit.js` (canonical tokens, hex+RGB) now backs `exporters.js` (inline `BRAND` removed; `download()` exported); `src/data/deckClient.js` flattens `getBoardPack` → placeholder map and pulls the exec summary from the **`board_pack` table** (latest trace-passed narrative for the scope); `workflows/slides_deck_generate.json` (Webhook → copy template → `replaceAllText` fill + blank `[[CHART]]` slots → export PDF → export PPTX → delete temp → respond `{pdfBase64,pptxBase64}`); Export page gains a **"Branded deck"** action on Board Pack; `getBoardPack` returns an additive `funnel` block (leads/opp/closed-won display strings) for the funnel slide; `VITE_SLIDESDECK_WEBHOOK_URL` added to `.env`/`.env.example`. **Pending:** user activates the workflow + sets the webhook URL; then **charts** (canvas→PNG→public image URL — hosting TBD) and the **KPI + Pipeline** field builders. Docs: `docs/CWSI_BRAND_KIT.md` (tokens + placeholder contract + Google setup how-to). Notes baked in: PPTX isn't pixel-identical (font fallback), chart URLs must be raw image bytes, export is synchronous (no poll).
>
> **2026-06-23 (board packs now PERSISTED: `board_pack` table + save-on-generate):** Generated board packs were ephemeral (the AI narrative lived only in React state, lost on refresh/scope-change), which is also why PDF/PPTX export only carried the figure set, never the narrative. Step 1 of persistence done: migration `create_board_pack` adds `public.board_pack` (`id, region, quarter, generated_at, created_by, model, figure_set jsonb, narrative jsonb, recommendations jsonb, validation jsonb`, index on `(region, quarter, generated_at desc)`). **Immutable artifact:** RLS SELECT+INSERT for `authenticated` only (no UPDATE/DELETE policy), anon table-grant revoked (RLS already denied it — defense-in-depth, same as `kpi_targets`). `saveBoardPack` (`boardPackClient.js`) inserts on generate, wired via `useGenerateBoardPack.onSuccess`; **only trace-passed packs are stored** (`validation.ok` — a blocked pack isn't a publishable artifact) and the **figure set is frozen alongside the narrative** so a saved pack stays internally consistent after the warehouse moves. Save failures are swallowed + logged so they can't break the on-screen result. **Next (not yet done):** wire the PDF/PPTX exporters to read the latest saved pack for the scope and render the narrative + recommendations (currently still figures-only).
>
> **2026-06-23 (orphan-grain fix: SF `fact_channel_daily` → guarded full-replace):** Tracing the headline Q2-26 Influenced Pipeline (£318k) surfaced a **stale-orphan double-count**. `salesforce_ingestion.json` upserted `fact_channel_daily` but **never deleted**, so when an open opp (dated by `CreatedDate`) later **closes** (the build re-dates it by `CloseDate`), its old open-pipeline grain stops being regenerated and **lingers forever**. Confirmed live on opp `701Tm…ZXsNFIA1`: a £16,537.5 open-pipeline row (2026-06-08) left stranded after the deal closed-won £46,275 (2026-06-22) — counted as both open pipeline **and** closed-won. **Fix:** converted the `fact_channel_daily` write to a **guarded full-replace** — `Build Fact Rows → Guard: rows present → Delete SF channel rows (`DELETE … WHERE source='salesforce'`) → Reload Fact Rows → Insert` — mirroring the budget-tracker workflow; the **guard throws before the delete if 0 rows were built**, so a failed/empty SF read can never wipe the table empty. SF queries pull full history (no date filter) so the rebuild is complete. **Re-imported + run. Verified live: Q2-26 Influenced Pipeline £318,405 → £301,867 (~£302k)**, both orphan grains deleted (not masked), 0 SF rows predate the latest run. Closed-won / margin / leads unaffected — orphans only carried *open* pipeline. **Scoped deliberately to `fact_channel_daily`:** `fact_meeting_daily` (grain `region×ActivityDate` — date-stable) and `fact_renewal_daily` (orphans touch only open renewal pipeline, not retained-contracts won figures) are low-risk and left upsert-only; `fact_opportunity_stage` **must not** be full-replaced (it intentionally accumulates per-day snapshots; the view reads the latest). **Also confirmed today:** the 23 Jun **margin fix is deployed** — `data_quality_log` shows a salesforce run today and `fact_channel_daily` carries **0 buggy `margin=revenue` rows** (186 blank-cost → NULL, 37 real), so the earlier '⛔ re-import to activate' action is **done**.
>
> **2026-06-23 (QA HIGH-bug fixes, T-6 layer):** Adversarial QA vs live prod surfaced **two HIGH-severity bugs**; both fixed + proven with re-run reproduce queries. **(1) Funnel inverted under region/quarter scope** (e.g. NL MQL 39 < SQL 56; 2026 Q3 leads 0 / SQL 27) because stages are event-dated differently (leads/MQL by lead date; SQL/Opp/Won by opp/close date), so a deal's stages land in different scoped buckets — invisible at ALL/YTD where it averages out, visible the moment a tab is selected. **Fix at the aggregation layer** (`funnelOf`, `queries.js`): the per-stage counts are *real actuals* and are NOT mutated; instead the funnel is built with a **bottom-up "reached-or-beyond" floor** on the scoped totals (`won → opp=max(opp,won) → sql=max(sql,opp) → mql=max(mql,sql) → leads=max(leads,mql)`), guaranteeing **Leads ≥ MQL ≥ SQL ≥ Opp ≥ Won by construction at every region + quarter** incl. in-progress Q3. Also fixes the >100% conversion rates and the Q3 divide-by-zero. *Proof: monotonic=true for all 17 region×quarter buckets.* **(2) Influenced margin overstated** — blank vendor cost was `COALESCE(cost,0)` upstream, so margin read **full revenue** on **186/223 won rows** (ratio 0.412, plus 1 impossible margin>revenue credit-memo row). Per the PRD T-6 edge case, **blank cost → NULL ("pending cost input"), never revenue, never a fake 0.** Fixed as data (it was a fabricated number, not a real actual): migration `fix_influenced_margin_blank_cost` NULLs blank-cost (`margin = closed_won_value`) + impossible (`margin > closed_won_value`) rows in `fact_channel_daily`, **and** adds a CASE guard in `v_fact_enriched` so a future n8n re-sync can't re-introduce it; logged to `data_quality_log`. The UI (Overview headline, KPI Tracker register, board pack) now shows known margin with a **"X of Y won deals costed · rest pending cost input"** caveat (or "not available yet" if none costed). *Proof: margin_eq_revenue=0, margin_gt_revenue=0, 186 flagged pending, ratio now 0.126 over costed deals only.* **Also fixed:** the Overview "Closed-Won Value" tile was scoring closed-won £ against the *influenced-margin* target — now a correct **Influenced Margin** tile (value + target + coverage). **3 investigate items confirmed already-correct (no change):** "All" tab includes UNASSIGNED (reconciles 5450 = 4621+563+212+54); ROI suppressed when spend=0 (only LinkedIn has spend); CPL/conversion denominators of 0 → "n/a", never Inf/NaN. **Root-cause fixed in repo (n8n):** `workflows/salesforce_ingestion.json` "Build fact_channel_daily rows" node now writes **NULL margin when `Vendor_Cost_Price__c` is blank** (was `Amount − (cost||0)` = full revenue) — uses the real blank-field signal, so it's exact (a genuine zero-cost deal stays £0, not NULL). **⛔ Action (you):** re-import the workflow into n8n to activate; the base `UPDATE` + `v_fact_enriched` CASE guard keep the live dashboard correct until then.
>
> **2026-06-22 (latest):** **KPI targets are now an editable DB register (`kpi_targets`).** Created the table (migration `create_kpi_targets`) — one row per KPI with `q1..q4`/`fy`, `unit`, `lower_is_better`, `note`, `updated_at` — **seeded (29 rows) from the `thresholds.js` placeholders**. RLS: authenticated SELECT/INSERT/UPDATE only; **anon revoked** (Supabase auto-granted anon on the new table via default privileges — stripped as defense-in-depth; RLS already denied anon). The **KPI Tracker** now reads targets from this table (`getKpiTargets` / `useKpiTargets`) and the new **Target column is inline-editable** per active quarter: click the value → edit → saves via `updateKpiTarget` / `useUpdateKpiTarget` → React Query invalidates → %-of-target + status light recompute live. This is the app's **first data write path** (previously reads + auth self-service only). **Read by every page (22 Jun):** the KPI Tracker, the **Overview** tiles/Quarter-Health, and the **Board Pack** all read `kpi_targets` (with the `thresholds.js` placeholders as fallback); a target edit invalidates both the register and the board-pack queries, so it recomputes everywhere. Net effect: the client owns their targets from the dashboard instead of waiting on a code change; when real numbers arrive they overwrite in place. **The placeholders are NOT the client's real targets — the real per-quarter + FY values are still required from Paul + Claire; self-serve editing removes the code step, not the dependency.** Actuals are never stored here.
>
> **2026-06-22 (later):** **Placeholder TARGETS wired into the KPI Tracker + T-7 endpoint configured.** The `KPI_QUARTERLY_TARGETS` set (defined 22 Jun but imported nowhere) is now **consumed** by `KpiTracker.jsx`: new helpers in `thresholds.js` (`targetFor` / `pctOfTarget` / `kpiLight`) resolve each KPI's target at the **active quarter** (FY when YTD), compute a **green/amber/red status light + %-of-target**, and **invert the ratio for `lowerIsBetter` ceilings** (CPL/CPC/CPM/unsub/cost-per-conv). The register's old hardcoded all-green status dot is replaced; every target/%/light is flagged **"prov."** under an amber provisional banner. Two adjustments: **Opportunities (open+won)** placeholder added (FY 28) + wired to live `opp_count`; **Retained contracts** placeholder re-scaled from the mis-scaled `3` → **whole-book ~370** (q-split) because `v_retention` is account-based — still ⚠️ pending Paul's scope call. **Verified live in the DB (YTD 2026):** leads 5,450 · MQL 275 · SQL 156 · **Opportunities 60** · closed-won 24 (£263.6k) · pipeline £633.6k · margin £239.6k; **Retained = 180 won Renewals YTD / 73 Q2** (Upsell 228/102, Cross-Sell 39/18 separate). **Lead→MQL** and **Closed-won value** were initially left targetless (register lists none); **updated 22 Jun** to carry editable provisional targets too, so every KPI row is targetable (Lead→MQL from the mockup 40%; Closed-won value an annualized-run-rate estimate £525k) — both flagged for the client to set. **T-7:** the n8n→Claude workflow was **hardened** (`max_tokens` 8k→16k + `effort: 'medium'` so adaptive-thinking output can't truncate the JSON) and the **webhook endpoint is configured** (`VITE_BOARDPACK_WEBHOOK_URL` set to the n8n-cloud URL) — Generate goes live once the workflow is imported + activated + the Anthropic credential attached in n8n. **Overview made quarter-aware too** — its hero tiles + Quarter-Health rows now resolve the target to the active quarter pill (Q2→Q2 target, YTD→FY) via the same helpers, flagged provisional, so Overview and the KPI Tracker agree for the same quarter (previously Overview always divided by the FY target, making a quarter look like ~40% when it was ahead of pace). Also wired the **webinar attendance rate** into the KPI Tracker register (was `na` only because the page never fetched the feed — the webinar actual is live: Q1 34.2% / Q2 39.3% / YTD 37.2% from `v_event_daily`), labelled "webinar" with the in-person slice flagged pending an SF field — **no fabricated actual**, only the target stays placeholder. Register live count 18 → **19** (when webinar data is in scope). *Hygiene: stray NUL byte in `queries.js` cleaned (was a deliberate composite-key delimiter, now `\u0000`).*
>
> **2026-06-22:** **Organic-social sessions KPI LIVE — GA4 channel re-grain complete (register 27 → 28).** GA4_ingest re-run backfilled the full FY at the new `date×region×hostname×channel_group` grain; removed the stale pre-migration coarse batch (912 rows / 10,278 phantom `Unassigned` sessions, loaded 06-19) that was double-counting against the new per-channel rows. `getWebTraffic` now sums `channel_group='Organic Social'` → `totals.socialSessions`; `KpiTracker.jsx` shows **"Traffic from organic social (sessions)"** under Website Performance — **live 256 YTD '26**. Also wired **Registrations (leads)** into the register (SF CampaignMembers on event campaigns, all types → 664 YTD '26 live). Register = **28 rows (18 live / 10 n/a)**. Org-social engagement + follower growth still need a feed; in-person event *attendance* still needs an SF field. *Ops: revert `GA4_ingest` `Config.lookback_days` 200 → 7.* Also (earlier): added `KPI_QUARTERLY_TARGETS` placeholders (`thresholds.js`, mockup Q1–Q4+FY, dev/test) and renamed the comparison doc → `DASHBOARD_VS_MOCKUP.md`.
>
> **2026-06-21 (later):** **3 KPIs added to the KPI Tracker register + GA4 channel split shipped.** (1) **Visitor → MQL** (GA4 `key_events ÷ sessions`, same source as the SEO tile → live 0.91%) and (2) **MQL → SQL (events)** (`v_fact_enriched` Events & Webinars rollup → live 14.8%) — both were already computed elsewhere, now surfaced as register rows. (3) **Retained Contracts** added to the register too (was Overview-only): won-renewal headline + Expansion (Upsell/Cross-Sell) in context, never blended; `getKpiTracker` now fetches `getRetention`. Register count 24 → 27. (4) **GA4 ingest re-grained** for the *social-referred-sessions* KPI: migration `add_channel_group_to_fact_web_daily` applied (added `channel_group` col, swapped `uq_fact_web_grain`, `v_web_daily` exposes it); `GA4_ingest.json` now pulls `sessionDefaultChannelGroup` — **one-time backfill pending** (`DELETE FROM fact_web_daily WHERE source='ga4'` then re-run with lookback 200). **Open (Paul, confirm-only):** Retained **boundary + scope** — `v_retention` is account-based, so the headline is the whole renewal book (~186 YTD / 73 Q2), not marketing-influenced; mockup placeholder target (3) is ~60× low. See `KPI_REGISTER.md` §3.1/§5.
>
> **2026-06-21:** **T-7 AI Board Pack BUILT — trace-to-data enforced.** Architecture (n8n path chosen): the **app computes every figure** (`src/data/boardPack.js` → the 7 metrics in agreed order MQLs→SQLs→MQL→SQL→closed opps→influenced pipeline→influenced margin→CPL, + gaps-to-close ranked by app-computed pipeline impact, + a flat `traceTable`); the app POSTs the figure set to an **n8n webhook → Claude** (`workflows/board_pack_generate.json`, `claude-opus-4-8`, adaptive thinking, JSON-schema output, key held in n8n); the app then runs the **trace-to-data validator** (`src/data/traceValidator.js`) over the response and **blocks publish on any untraceable number** (8/8 unit assertions pass — clean text passes, injected fakes flagged, label-glued digits/years ignored). UI: `Board.jsx` rebuilt (top-line + ranked levers + Generate button + 3-part narrative + recommendations + pass/blocked badge + flag log). Targets stay **provisional placeholders** (`thresholds.js` extended: `closedWonCount`, `CONVERSION_TARGETS.mqlToSqlRate`, `CPL_TARGET_GBP`). **PENDING ACTION (you):** import the workflow into n8n, select your Anthropic credential, activate, and set `VITE_BOARDPACK_WEBHOOK_URL` in `.env` (template added to `.env.example`). Until then figures+gaps render; only Generate is inert. **LinkedIn efficiency NOW LIVE** — DB check confirmed LinkedIn spend (£9,489 GBP) + SF-attributed pipeline (£170,587) / closed-won (£268,217) are populated, so `getLinkedInSnapshot` + the LinkedIn page now show **CTR 0.52% · CPC £2.98 · CPM £15.60 · CPL £863 (form leads) · ROI 18.0× pipeline / 28.3× revenue** — LinkedIn-only; blended CPL across channels still needs other-channel spend (Margot).
>
> **2026-06-20:** SF re-run **verified live** — funnel + renewals + 3 new facts: **meetings** (`fact_meeting_daily`, 239 deduped, TYPEOF region), **pipeline stage distribution** (`fact_opportunity_stage`, ~963 open opps/£52.7M, Pipeline page panel), **email sends** (`fact_email_engagement` Path A — opens/CTR n/a, no Account Engagement in org). **GTW↔SF webinar attendance LIVE** — match on the date in `Campaign.Name` (NOT `Campaign.StartDate`, which is 0/4); `gotowebinar_ingest.json` writes **4/4 webinars to `fact_event_daily` with campaign_key + registrants + attendees, dry-runs excluded** (reg 131/65/137/138, att 45/22/55/53, ~34–40% attend). Registrant count keyed off `joinUrl` (n8n splits the array → pairedItem unreliable). **Meetings tile reverted** (Overview) — Paul's "100" is Outreach-generated, not all SF meetings (24 Apr call).
>
> **2026-06-19 (later):** **KPI Register refreshed** — `KpiTracker.jsx` now shows closed-won count, Opportunities, Influenced margin, **organic traffic + organic conversions (GA4 key events)** as LIVE (were "n/a"); register is **13 of 24 live** and the sidebar badge corrected 28→24. **Retained Contracts KPI live** — `fact_renewal_daily` populated, Overview shows won renewals + open + Expansion (Upsell/Cross-Sell) with a boundary note (2026: UKI 106 won / £3.08M). **GA4 conversions resolved (B9)** — `key_events` > 0 (115 in 2026); **Visitor → MQL tile wired** on the SEO page, "pending" copy removed. No GA4-admin config needed.
>
> **2026-06-19:** B2/B3 SF discovery builds shipped (email engagement + renewal, pending re-run). **SEO "Top Keywords" panel LIVE** — `fact_seo_query_daily` backfilled (~1M rows), `search_console_query_ingest.json` rewritten as a 10-day-window loop clamped to 2026-01-01, wired via `get_seo_top_queries()`. **Dashboard scoped to 2026-only** (`HISTORY_START_YEAR=2026`). GoToWebinar **API access obtained** but **no GTW↔SF link** found (SF=registration via Google Form, not attendance). 2 more LinkedIn region sheets incoming. Notion board confirmed stale (0 tickets marked Completed) — `TICKET_TRACKING.md` is the real per-ticket status.

> **2026-06-16:** Overview funnel completed end-to-end — **Opportunities** (`opp_count`) + **Closed Won** (`closed_won_count`) added to the SF workflow + store and re-run (245 won / £7.12M reconciled). Fixed a systemic **PostgREST 1000-row cap** that was silently undercounting reads (funnel + SEO top-pages); all reads now paginate / aggregate server-side. Loading states restyled. Architecture decision recorded (warehouse vs live fetch) — `DEPENDENCIES.md` 8.

**Legend:** ✅ done · 🟡 partial (works, gated/incomplete) · 🔴 blocked · ⬜ not started · ⚪ N/A by exception

---

## Ticket status

| Ticket | Scope | Status | % | What remains |
|---|---|---|---|---|
| **T-1** Canonical store | region-tagged star schema, dims+facts, views, validation | ✅ | 100 | — |
| **T-2** API ingestion | SF, GA4, GSC, Google Ads, Outreach | 🟡 | ~95 | All feeds live (SF, GA4, GSC backfilled to Apr 2025, Outreach seq+steps); Google Ads ⚪ N/A (no campaigns) |
| **T-3** Manual ingestion | LinkedIn, spend sheet, GoToWebinar, in-person | 🟡 | ~65 | LinkedIn ✅ (2 more region sheets incoming) · EUR spend ✅ (channel-mapping ⛔ Margot) · **GoToWebinar attendance LIVE (20 Jun)** — `gotowebinar_ingest.json` matches GTW↔SF webinar campaign by name-date, writes attendance + `campaign_key` to `fact_event_daily` (4/4; registrants count fix pending) · in-person SF field ⛔ |
| **T-4** Shell + Overview + KPI Tracker | filters, funnel, 28-KPI register, gaps-to-close | 🟡 | ~97 | **Placeholder targets now WIRED (22 Jun)** — KPI Tracker shows computed R/A/G + %-of-target per KPI, quarter-scoped, flagged provisional. Both KPI Tracker + Overview now quarter-aware; **targets now an editable `kpi_targets` DB table** (KPI Tracker, inline per quarter — client edits in-dashboard, no code change). Remaining: client populates the real numbers; optionally repoint Overview + board pack at the same table |
| **T-5** Six channel pages | per-channel totals + drill-down | 🟡 | ~85 | **LinkedIn efficiency (CTR/CPC/CPM/CPL/ROI) now LIVE (21 Jun)**; Email CTR/opens not sourced (no Pardot); rest live |
| **T-6** Pipeline / funnel / attribution | SF-mirrored funnel, by-source, vs target | 🟡 | ~94 | Funnel complete (Leads→MQL→SQL→**Opp**→**Closed Won**); **23 Jun: monotonic-funnel + margin blank-cost HIGH bugs fixed** (funnel floored by construction; blank cost → NULL not revenue). Opp-level stage distribution (per SF stage) still not modelled |
| **T-7** AI board pack | Claude narrative, trace-to-data | 🟢 | ~95 | **VERIFIED LIVE (22 Jun)** — POSTed a sample figure set to the n8n webhook: HTTP 200 in ~15s, model `claude-opus-4-8`, returned valid `{narrative, recommendations, model}` citing only supplied numbers. Workflow active + Anthropic credential working. In-app trace-to-data validator enforces zero-invention. Soft remainder only: targets provisional until the client enters real ones |
| **T-8** Export CSV/PDF/PPTX | board pack + KPI/pipeline export | 🟡 | ~80 | **BUILT (22 Jun)** — one-click CSV/PDF/PPTX (jsPDF + jspdf-autotable + pptxgenjs); each format opens a **region + quarter dialog** (scope chosen per-export, defaults to current view); KPI Register (CSV/PDF/PPTX), Pipeline (CSV/PDF), Board Pack figure set (PDF/PPTX). KPI rows come from a shared builder so export = on-screen register. Exporter **lazy-loaded** (off the main bundle). Remaining: optional — include the AI narrative inside the board-pack export, and a full all-region/quarter archive mode |
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
Four independent streams; **none of the 45% gap is pending dev — it's client data / external access / parked.**
- ✅ **LinkedIn** delivery snapshot (GBP, manual Drive drop, 13 campaigns). **2 more region sheets incoming (19 Jun)** to complete coverage (ingestion already handles them).
- ✅ **Budget tracker** (EUR actuals, daily Excel sync). But it's **finance/budget-line grained, not channel-attributable** → CPL/CPC/ROI need Margot's **merged spend sheet with a campaign-link column** (⛔ client).
- 🟢 **GoToWebinar attendance — LIVE & verified (20 Jun).** The GTW↔SF link is solved: match GTW webinar to the SF webinar campaign by the **date embedded in `Campaign.Name`** (`dd.mm.yyyy`), since `Campaign.StartDate` is the campaign window-open date (0/4 match). `gotowebinar_ingest.json` carries the matcher; run wrote **4/4 webinars to `fact_event_daily` with `campaign_key` + registrants + attendees**, dry-runs excluded: AI&Data 131/45, Data-Asset 65/22, Becoming-frontier 137/55, Public-Sector 138/53 (~34–40% attend). Attendance inherits the campaign's region/funnel. (n8n quirks handled: SF node `executeOnce`; attendees via paginated `_embedded.attendeeParticipationResponses` + `page.totalElements`; registrants keyed off `joinUrl` since the split array breaks pairedItem.)
- 🔴 **In-person attendance** — no SF field exists (client must create one).

### T-4 Shell + Overview + KPI Tracker 🟡 ~95%
Live shell, region/quarter filters re-scope every figure, funnel, pipeline-by-channel, 28-KPI register actuals, budget tiles. **Gap:** every target / % -of-target / status colour needs `kpi_targets` (client) — currently config placeholders.

### T-5 Six channel pages 🟡 ~80%
- ✅ LinkedIn Paid (GBP snapshot + SF funnel), Outreach (engagement + Region×Pillar + steps), **Organic SEO (now wired to GA4 + GSC)**. **LinkedIn Efficiency panel LIVE (21 Jun)** — CTR 0.52% / CPC £2.98 / CPM £15.60 / CPL £863 (form leads) / ROI 18.0× pipeline / 28.3× revenue, computed in `getLinkedInSnapshot` from spend+clicks+impr (delivery snapshot) and SF-attributed pipeline+closed-won for `channel_name='LinkedIn Paid'` (lifetime, region-scoped). LinkedIn-only — blended efficiency across channels still needs other-channel spend.
- ✅ Paid Search — correct "no live campaigns" state.
- 🟡 Email — pipeline live; CTR/unsub/opens not sourced (ESP/SF email engagement).
- 🟢 Events — **dedicated Events page LIVE (20 Jun)** (`Events.jsx`, routed `ch-events`, mockup-styled): webinar registrations/attendees/attendance-rate per webinar (campaign-linked) + the SF-attributed Events&Webinars funnel. **Overview** "Events Mix" placeholder replaced with a real **Webinar Attendance** panel (seg-bar + per-webinar attendance bars) and the "Event attendance" health row now shows the live rate. In-person owned/earned events + per-event ROI/touchpoints shown as not-available (no SF event-type/in-person field). **MQL Rate by Event Type panel** added (Level A/B): `campaign_type` now stored on `dim_campaign`/`v_fact_enriched` (SF workflow writes `Campaign.Type`), Events page splits the channel into Webinar / In-person / Seminar with MQL rate = MQLs÷leads — **pending an SF re-run to populate `campaign_type`** (shows one 'Untyped' bucket until then). Owned-vs-Earned split still needs a CWSI tag. **Events page has a Type filter + the earlier per-campaign SF funnel drill-down** (leads/MQL/SQL/pipeline/closed-won, sliceable by Campaign.Type) alongside the webinar attendance. **`campaign_type` LIVE & verified (20 Jun re-run)** — all 14 SF types populated; event split: Webinars 418 leads/23.4% MQL · In-person 246/14.6% · Seminars 0 (none 2026).

### T-6 Pipeline / funnel / attribution 🟡 ~92%
Funnel, pipeline-by-source, channel split all live and correctly attributed. Funnel is now **complete** — Leads→MQL→SQL→**Opportunities**→**Closed Won**, all real counts (`opp_count` = qualified open+won opps, a subset of SQL so the funnel narrows; `closed_won_count` = won deals). **Caveats:** (1) MQL definition (resolved to "reached MQL or beyond" — see 4); (2) opportunity-**stage** distribution (per SF StageName) still not modelled (fact is channel-daily, not opp-level); (3) influenced margin now live (vendor-cost basis — Paul to confirm); (4) quarterly funnel is **"reached-or-beyond, scope-dated"** (stages event-dated differently → a deal lands in different quarters per stage; floored monotonic, surfaced via an on-screen caveat gated to Q1–Q4) — YTD is the true end-to-end funnel.

### T-7 🟡 ~85% — BUILT (21 Jun), see the top-of-file entry
App computes the figure set → n8n→Claude webhook → app validates trace-to-data and blocks untraceable numbers. **Pending only:** set the n8n webhook URL + Anthropic key (`VITE_BOARDPACK_WEBHOOK_URL`). Targets render provisional until `kpi_targets`.

### T-8–T-10 ⬜
Not started. T-8 export buttons are visual stubs.

---

## 🚦 T-7 readiness gate — what must be true before the AI board pack is meaningful

T-7 can be *built* against live data, but the board narrative leads on **MQL, SQL, MQL→SQL, closed opps, influenced pipeline, influenced margin, CPL**. Of those:

| Board metric | Ready? | Blocker | Owner |
|---|---|---|---|
| Closed opps, Opportunities, Influenced pipeline, Closed-Won | ✅ actuals live | targets only | client |
| MQL, SQL, MQL→SQL | 🟢 | **RESOLVED** — MQL = "reached MQL or beyond"; funnel no longer inverts. Only Margot's nod on status buckets | Margot (confirm) |
| Influenced margin | 🟢 | **RESOLVED & LIVE** — vendor-cost basis (~£3.0M); Paul to confirm basis | Paul (confirm) |
| CPL | 🟡 | **LinkedIn computes CPC/CTR/CPM/CPL/ROI LIVE (21 Jun)** — CPL £863 (form leads), ROI 18.0× pipeline. **Blended** CPL across channels still needs other-channel spend | T-3 / Margot |
| Every "vs target" / status | 🔴 | `kpi_targets` register absent → board pack renders targets **provisional** (does not block) | Paul + Claire |

**Conclusion:** T-7 is **built** and renders the funnel coherently today. The two remaining gate items are now *soft*, not blocking: **blended per-channel CPL** (LinkedIn is live; other channels show "pending") and the **`kpi_targets` register** (board pack flags targets "provisional" rather than blocking). The only hard pending step is operational: set the n8n webhook + Anthropic key so the **Generate narrative** button is live.

See `DEPENDENCIES.md` for owners and `WORKFLOWS.md` for the ingestion detail behind each row.

## 23 Aug 2026 — Margot's 20 Aug feedback: non-workflow items built

Everything below needed only code / query / view changes. Items requiring the Salesforce
re-ingest, the Outreach sync or a GA4 dimension are listed as still-open at the end.
Plan: `docs/DEVELOPMENT_PLAN_20AUG_FEEDBACK.md`. Build verified green after each batch.

### Two real defects found while building (neither was in her list as a diagnosis)
- **Email figures were exactly 2x reality.** `fact_ae_email` is a snapshot table keyed
  `(ae_email_id, snapshot_date)`; two snapshots (7 + 10 Aug) were loaded and `v_ae_email`
  exposed both, so every send was counted once per run — 662,683 delivered vs the true
  331,341. The view now takes the latest snapshot per email (migration
  `v_ae_email_latest_snapshot_only`). This is the cause of her "emails delivered in the
  Netherlands seems unusually high" and "regional figures higher than the overall total".
- **Region overrides never filtered anything.** `campaign_overrides.display_region` was
  render-only, so her question "if I update the region for a campaign, will the regional
  overviews update?" answered no. Now authoritative — see Region model below.

### Themes
- Q3 = "Build Trust in a Distrustful World", Q4 = "Cybersecurity. Safeguarding Business
  Growth."; provisional-Q3 notice removed; Q4 umbrella added (its pill stays hidden until
  the window opens); methodology text updated.

### Run-vs-ongoing rebuilt on the opportunity's creation date
- `getCurrentVsOngoing` now reads `fact_opportunity` and buckets by `created_date`; the
  **Undated bucket is gone** (she rejected it twice). Won deals count in the window they
  closed; open deals while they sit in pipeline. MQLs keep the activity-date basis and are
  no longer split, stated on the panel. Q2 check: 42 opportunities / EUR 124,828 won run
  this period vs 32 / EUR 159,887 ongoing.

### Region model
- `campaign_overrides` += `regions text[]`, `campaign_type`; overrides now drive the region
  predicate in `fetchFacts` (a campaign goes where the override says, otherwise where the
  deal's account says). New `RegionSelect` picker with UKI / BeLux / NL / **BeNeLux** /
  **Group — all regions** / Auto, on Campaigns, Email and Events.
- `linkedin_campaign_2026` += `regions text[]`; "Data That Moves Your Business Forward" set
  to {BeLux, NL} so it appears under NL as well; LinkedIn filtering uses set-contains.
- Campaign **Type** is now editable.

### Overview
- Unmapped campaigns EXCLUDED from every figure, with a panel naming exactly what was
  dropped and its pipeline/closed-won, so she can rule on each. (2026 bucket = Salesforce
  Connector, BLAUD-SoPro Intune Health Check, Hubspot Imports, FY26 UKI Major Growth MAL.)
- Removed the per-channel "% converted to won" line — the "ROI showing for organic SEO".
- Funnel descriptions removed; long basis callout cut to one line; zeros not dashes.

### Email
- Campaigns split BY QUARTER (Q1 Data That Moves; Q2 Becoming Frontier / Apple / E7; **Q3
  added: E3/E5 Capabilities Workflow + The Governance Gap whitepaper**). The quarter is a
  property of the campaign, not the send date — which also fixes "Email Engagement appears
  to be empty for Q1" (that campaign's emails all went out from 2 Apr).
- **Regional split now works**: the platform feed has no region at all, but send names
  encode it ("UK/IRE:", "BE:", "- NL:", "Lux:"). Derived from the name → UKI 192,444 /
  BeLux 43,663 / NL 21,804 delivered, plus 73,430 on combined lists reported separately
  and never split across tabs.
- Title trimmed to "Email"; Commercial Funnel sub-values removed, Qualified Opportunities
  added; Campaign Performance shows qualified rather than created; the Individual Emails
  drill-down is available in every quarter/region view.

### Campaigns
- Campaign **dropdown** added (narrows the page to one campaign and re-totals it).
- Created and Qualified opportunities are now separate fields; Pipeline Created / Open
  pipeline (gross profit) / Closed (gross profit) as separate tiles.

### Events
- The five campaigns she named are excluded, pinned BY KEY (two Cybersec Europe campaigns
  and two Cybersec dinners exist — only the named ones go).
- Per-event ongoing-impact table removed; the summary panel at the foot of the page remains.
- Webinars and in-person now render the **same** structure: shared `EventFrame` tiles
  (events held / registrations / attendees / attendance rate), the shared Salesforce metric
  set, then one shared `EventTable` — so each webinar now shows its opportunities, pipeline
  and closed-won alongside attendance.
- Descriptions under owned/earned counts removed; won value under Influenced Pipeline gone.

### SEO
- Conversions metric removed (conversion tracking isn't configured — she's right).
- The two competing Salesforce funnels consolidated into one (the whole-channel figure,
  which is what the Overview and Board report). **Note: this dropped the narrower
  "Website Leads" section, itself an earlier ask — flagged for review.**
- Region breakdown under Traffic by Property removed; Top Pages / Keywords show "Visits
  from search" instead of impressions, with an explicit note that Search Console has no
  region at page grain (the real cause of "BeLux and UKI appear to be the same").
- "the traffic figure, not search impressions" and the sessions date range removed.

### Budget
- Duplicate spent figure removed; budget-used % red -> grey; MDF tile shows remaining;
  utilisation figures moved below the bar; Spend-by-Region hidden in regional views;
  zero-spend budget lines stay listed with an empty value.
- **Group spend surfaced**: EUR 74,911 of EUR 98,819 (76%) is booked at group level
  (market 'ALL'). Regional views now state the regional figure AND the group figure.

### Board
- N/A -> 0 where a region has no opportunities; unassigned deals link straight into
  Salesforce when `VITE_SF_INSTANCE_URL` is set (documented in `.env.example`).

### Dashboard-wide presentation sweep
- All 55 "current view" instances removed; "Actual" off Marketing Spend; "full year, all
  regions" off Annual Budget; `opps` -> `opportunities` (28 places); funnel stage
  descriptions removed on Overview / Pipeline / Email; Pipeline money strip stripped of its
  interpretation text and the Closed-Won sub-line.

### Still open — needs the ingest or a client input
- Opportunity name + account name + gross profit at deal grain (Salesforce re-ingest) ->
  the Board's "I can't find these in Salesforce" fix and margin on New Pipeline Created.
- Outreach: parked at the user's request pending `outreach_report_sync`.
- Page views in Top Organic Pages / Keywords -> needs a GA4 `pagePath` feed.
- insights.cwsisecurity.com Search Console property (ours to create; no backfill).
- Per-region Budget Used needs a regional budget split from the client's sheet.

## 24 Aug 2026 — Salesforce re-ingest (W1) done, deal-level evidence layer built

**Re-ingest verified:** 763 of 766 opportunities now carry `opp_name`, `account_name`,
`campaign_name` and `margin_eur`. `created_opp_margin_value` populated on 2,777 fact rows
(2026: EUR 2,292,271 gross profit against EUR 2,448,727 revenue, 109/109 deals known).

**Ingestion changes** (`workflows/salesforce_ingestion.json`, backup `.pre-oppname-bak`):
- SOQL adds `Name`, `Account.Name`, `Campaign.Name`.
- `Build Opp Rows` carries deal name / account / campaign and gross profit per deal in EUR —
  NULL where Salesforce holds none, never inferred from Amount.
- `Build Fact Rows` accumulates gross profit on created opportunities.
- **New `Prune stale fact_opportunity` node.** fact_opportunity was upsert-only, so deals
  deleted in Salesforce (or whose campaign link was cleared) stayed forever. Found three
  2026 opportunities worth EUR 65,000 — one of EUR 40,000 on the Becoming Frontier
  whitepaper — sitting stale in open pipeline. The prune deletes rows untouched for 6 hours
  (six missed hourly runs), so a partial run can never remove live data.

**Built on top:**
- `getCampaignOpportunities()` + `DealDrilldown` — an expandable deal list under every theme
  on Campaigns and every event table on Events: opportunity name, account, the campaign it
  is credited to, stage, value, gross profit, created/closed dates, each linking into
  Salesforce. This is the answer to Margot's four "please provide a breakdown" asks and to
  "you need to look at the campaign the opportunity is assigned to".
- The Board's unassigned-deal list shows name / account / campaign instead of a bare id.
- **New Pipeline Created moved onto the gross-profit basis** on Campaigns and Pipeline.

**Worked example now checkable on screen** — 22.04.2026 UK Protect Data, Power AI:
3 won (Triland EUR 13,448 - Forsters EUR 7,042 - Bite EUR 5,819 = EUR 26,309) + 6 open +
1 lost. Two of the three won deals closed in Q3 (31 Jul, 11 Aug), which is worth checking
against what Margot was comparing to when she said closed-won "should be at least double".

## 24 Aug 2026 — Search Console: insights.cwsisecurity.com property wired in

Margot (20 Aug): "its access is there" for insights.cwsisecurity.com. Property created and
verified 24 Aug (URL-prefix, so its API id is `https://insights.cwsisecurity.com/`).

**Schema.** `site_url` added to `fact_seo_daily`, `fact_seo_page_daily`,
`fact_seo_query_daily`; existing rows backfilled to the domain property; the unique
constraints now include it. Without that the second property's rows collide with the
first's on (activity_date, region_id, source) and silently overwrite them. The column
DEFAULTS to the domain property, so an older workflow revision that omits it still writes
the right value.

**Four workflows — one per feed per property** (split rather than looped: the keyword feed
is 1M+ rows and a windows x properties loop is how n8n runs out of memory; separate
workflows also fail independently):

| Workflow | Property | Trigger | log source |
|---|---|---|---|
| `search_console_ingest` | `sc-domain:cwsisecurity.com` | 05:15 | `gsc` |
| `search_console_query_ingest` | `sc-domain:cwsisecurity.com` | 05:20 | `gsc_query` |
| `search_console_ingest_insights` (new) | `https://insights.cwsisecurity.com/` | 05:35 | `gsc_insights` |
| `search_console_query_ingest_insights` (new) | `https://insights.cwsisecurity.com/` | 05:40 | `gsc_query_insights` |

**PROVEN 24 Aug — the domain property already includes insights.** Once the domain feed was
refreshed to 21 Aug, its page rows showed three hosts: cwsisecurity.com (127,879 rows),
**insights.cwsisecurity.com (95 rows, 3 clicks, 204 impressions, back to 14 May)** and
www.cwsisecurity.com (1 row). So the two properties MUST NEVER BE SUMMED — reads scope to
one (`GSC_PRIMARY_SITE` in constants.js). The insights property exists because the
date x country and date x keyword grains carry no hostname and cannot be split any other
way. `scripts/reconcile_audit.sql` check 12 re-tests this against live data.

Earlier claim corrected: before the refresh the page data showed only cwsisecurity.com, and
I asserted the inclusion from Google's documented behaviour rather than from the data. It
happened to be right, but it was unverified when stated.

**Data as at 24 Aug:** daily + page current to 21 Aug on both properties (insights: 28 and
43 rows, 4-21 Aug, 1 click / 91 impressions). Keyword feeds were mid-backfill
(`lookback_days` 30 on domain, 100 on insights) — **reset both to 7 afterwards**, otherwise
every daily run re-pulls the whole window (~20-25 min).

**Expectation to set with the client:** the pipeline is right, but insights has ~3 clicks
and ~200 impressions since May. There is almost nothing to report on that site yet.

**Docs:** `docs/WORKFLOWS.md` updated — it still described the retired URL-prefix property.

## 24 Aug 2026 — client verification doc for the 20 Aug round + residual sweep

**`docs/QA_20AUG_VERIFICATION.md` written** — the client-facing answer to Margot's 20 Aug
reply, same format as the 11 Aug doc that produced this round (her comments quoted verbatim,
each with what we found / what changed / how it was verified). Deliberately a LIVING doc:
it carries a "Still in progress" section and a "Closed since the first version" line, so it
gets updated as items land rather than rewritten. Owed answers are collected into one
"What we need from you" list (4 decisions, 3 unblockers, 3 with third parties).

**Ticket-by-ticket audit first** (all 13 tickets were still "Backlog" in Notion — statuses
were never advanced, so they were useless as a source of truth). Verified against the code,
not against this file. 10 tickets substantially delivered; 3 not started (Outreach,
Attribution items 2-3, KPI Tracker); 6 residuals found inside the "done" ones.

### Residuals — all fixed
1. **Mixed basis inside a single panel.** Campaigns theme tiles were gross profit while the
   activity rows directly beneath were revenue. Same shape on Events, per-channel, Email and
   SEO. Every money column now reads gross profit: `marginPipeline` / `margin` in the rows,
   the column totals, the sort keys and the default sort. Two query shapes gained the
   gross-profit counterparts they were missing (`getChannel` campaigns; the email families'
   `oppValueMargin` / `margin`), and `zeros` for no-activity events gained the keys or a
   zero-activity event would have NaN'd the Events sums.
2. **Explain text contradicting its own number** — `createdOppsValue` still described "opportunity
   REVENUE value (deal value, not gross margin)" after the tile moved to gross profit; the
   Influenced Pipeline caveat also still called New Pipeline Created revenue. Both rewritten.
3. **`opps` residuals in client-visible strings** — including the board-pack export's "Open opps"
   table header, so it was shipping in the PDF/PPT she reads. Also KPI register context lines,
   the methodology text, the sales-cycle note and the Salesforce status page.
4. `"scoped to the current view"` in one explanation string.
5. Budget Used rendered `n/a`; now a real 0% where a budget exists, `—` where none does.
6. **`scripts/reconcile_audit.sql` was testing a retired model** — check 2 still asserted
   `run + ongoing + undated = total` on campaign start dates. Re-based onto opportunity
   creation dates (2 + new 2b for the gross-profit basis, which is what the panel shows),
   plus three new checks: 13 the excluded-campaign bucket, 14 Outreach campaign-linked
   opportunities, 15 gross-profit coverage at deal grain.

**Verified against live data, not assumed.** Checks 2 and 2b pass (34 won deals, €524,178
revenue / €482,269 gross profit, no NULL created dates, no missing gross profit). Gross-profit
coverage is complete on every channel and never exceeds revenue, so moving the tables onto it
shows real, slightly lower figures rather than blanks.

**Check 13 was wrong on first write and running it caught a client-facing error.** I keyed it
on `fact_opportunity.channel_name`, which returned 0 rows — the bucket is defined at the READ
layer (`displayChannel` coalescing a channel-less row into "Other / Unmapped"), so it has to be
checked on `v_fact_enriched` with the same contributes-something filter the screen applies.
Corrected, it returns the four known campaigns — and showed the open-pipeline column in the
verification doc's table was wrong (BLAUD €5,000 and Hubspot Imports €25,965 were written as
"—"). Fixed in the doc: €84,802 closed-won and €33,551 open pipeline excluded in total.

Build green. **Not fixed, needs client input:** `VITE_SF_INSTANCE_URL` is unset, so the Board's
deal links are inert (names/accounts still render) — needs CWSI's Lightning domain.

**`VITE_SF_INSTANCE_URL` set (24 Aug):** `https://cwsi.lightning.force.com` (supplied by the
client). Verified baked into the built bundle; opportunity ids are the full 18-char Salesforce
form, so the links resolve as `…/lightning/r/Opportunity/<id>/view` (the trailing slash is
stripped in code). This activates the Board's unassigned-deal links and every DealDrilldown
link — the last piece of Margot's "I can't find the opportunities in Salesforce" fix, so it is
no longer an outstanding ask in the client doc.

## 24 Aug 2026 — Outreach sync split one-entity-per-workflow + the seller fix

**Why.** `outreach_report_sync` did every entity in one run and exhausted n8n's memory, so it
never completed — which is the true cause of Margot's "seller performance shows no metrics"
and "Steve is missing". n8n retains every node's output for every loop iteration, so the fix
is structural, not a tuning exercise.

**Five workflows, one entity each** (staggered 04:40–05:00, sequence-dependent ones last):
`outreach_sync_sequences` · `outreach_sync_users` · `outreach_sync_mailboxes` (new) ·
`outreach_sync_steps` · `outreach_sync_states` (+ existing `outreach_states_chunk` child).
Nodes were LIFTED from the old workflow rather than retyped, so the SQL, mappers, pagination
and credentials are byte-identical. `outreach_report_sync` is superseded — deactivate it.

**Two structural improvements beyond the split:**
- **Sequence ids now come from the DATABASE.** `_steps` and `_states` both `SELECT id FROM
  outreach_sequence` instead of re-calling `/sequences`. That removes the largest payload from
  the heavy workflow, makes each workflow independent, and converts the original silent-zero
  failure into a thrown error naming the workflow to run first.
- **The states workflow stays two-level** (parent holds one chunk of 10; child returns one
  summary item), with loop branch 0 = done → log, branch 1 = loop → Chunk Context → child.

**The seller fix — `outreach_mailbox` (migration `outreach_mailbox_table`).** Every candidate
seller key was tested against the loaded data and all but one fails:

| Candidate | Result |
|---|---|
| sequence NAME parsing (what the page uses today) | first names only — Olivier, Erwin, Floris, Jim, Barry-John, Chris, Connor, Sean |
| `outreach_sequence.seller` | sequence OWNER — 'Aryamaan' on every row |
| `sequence_state.creator_user_id` | who LOADED the prospect — Aryamaan on 10,419 of 10,420 |
| `prospect.owner_user_id` | NULL on 90% (1,066 of 10,420 rows) |
| `sequence_state.mailbox_id` | **populated 100%, 12 distinct** — the only usable signal |

**Do not join `mailbox_id` to `outreach_user.id`.** It resolves for 10 of 12 and is wrong:
mailboxes 63 and 112 both land on a "Jim Engelhard" user row (two genuine users, blaud.com and
blaud.nl), mailbox 120 — the largest sender at 788 delivered — resolves to nobody, and the
top row by volume comes out as Margot Vanlaet with 2,898 prospects and zero sends. Separate id
spaces colliding on small integers. Hence the real `/mailboxes?include=user` fetch.

**`v_outreach_report_by_seller` has a structural defect** — it unions two keys that never meet:
Aryamaan carries assigned=10,420/sent=0 while named sellers carry sent>0/assigned=0. Assignment
is credited to the sequence creator, sending to the prospect owner, so each seller's activity is
split across two unaddable rows. That IS Margot's "per-seller figures don't align with the
totals above". Fix is one seller key applied to both halves — next step, after the run.

### Two findings that change what we tell the client
- **The 242-vs-121 discrepancy is not a bug.** The old feed writes all 242 sequences; the
  relational sync keeps CWSI-named non-test ones (121). Of the old 242, **117 are the three
  marketing workstreams and 125 are sales/one-off** — correctly excluded by the marketing-only
  lock. So the earlier "125 of 242 fall to Other" note described sequences that are *supposed*
  to be excluded, and the workstream classifier is NOT broken. Margot's "Type of Outreach isn't
  filtering correctly" must be the region filter or the all-time counters, not the classifier.
- **Both daily Outreach workflows have been dead since 3 Aug.** No `data_quality_log` rows in 21
  days despite daily 06:00 schedules, and `outreach_ingestion` logs BEFORE its prospect loop, so
  a loop failure would still have logged. Credentials are fine (`outreach_report_sync`
  authenticated on 22 Aug) → they are almost certainly deactivated in n8n. **The dashboard's
  Outreach page is therefore serving 3 August data** — 19 days stale when Margot reviewed it, and
  missing 4 CWSI sequences created since.

**Re-run safety confirmed:** `outreach_ingestion` and `outreach_sequence_steps_ingestion` are
both idempotent upserts (grain includes `activity_date`; prospect rows keyed on
`prospect_id, sequence_id`), and reads are latest-snapshot-only, so they can be re-run at any
time. Neither has a prune, so prospects removed from a sequence linger — same class of issue as
the `fact_opportunity` one fixed on 24 Aug.

**Also corrected in the client doc:** the Outreach campaign-linked basis is 2 opportunities of
EUR 9,500 each on *2026 - Outreach Secure Operations Workflow*, both created 12 June — Phonovation
(open) and St John of God (**closed lost**). So EUR 9,500 open and EUR 0 won, not "EUR 19,000
open" as the plan and the first draft of the doc stated.

## 24 Aug 2026 — Outreach: full sync completed, seller table rebuilt on the mailbox key

**The sync ran to completion.** 121/121 sequences, 10,420 state rows, 10,332 prospects, 128
mailboxes (all with an owner), 428 steps across all 121 sequences, `outreach_states`
completion row written. Every mailbox in use resolves — 0 unresolved rows.

### "Steve is missing" — answered, and it is not a dashboard fault
The 43 sequences with no prospect rows are not a fetch gap: all 43 were created in 2026 with
**zero scheduled, zero delivered, zero replies** — built and never used. Among them all five of
Steve's BeLux sequences, the entire BeLux Secure Outbound programme (20 sequences: Kevin,
Olivier, Steve, Vanessa x 5 pillars), 10 NL equivalents and 3 of Sean's Microsoft UK&I. So
**121 created / 78 ever used / 43 never sent to**. Margot's own "sellers haven't followed the
process" hypothesis, confirmed with names.

### The seller rewire (migrations `outreach_seller_one_key_via_mailbox`,
### `outreach_region_code_normalised`, `outreach_seller_sequence_names`)
Root cause of "per-seller figures don't align with the totals": `v_outreach_engagement` keyed
the seller on COALESCE(prospect owner, creator, sequence.seller) while `v_outreach_assignment`
keyed it on `sequence.seller` alone — the sequence OWNER, 'Aryamaan' on every row. The FULL JOIN
then emitted Aryamaan with assigned=10,420/sent=0 next to named sellers with sent>0/assigned=0.
Now ONE key — the **mailbox owner** — on both halves.

New/changed views: `v_outreach_engagement` (+ `seller_user_id`, `seller_name`, `mailbox_id`,
`mailbox_email`), `v_outreach_seller`, `v_outreach_seller_region`, `v_outreach_sequence_usage`,
and `v_outreach_report_by_seller` rebuilt on top of `v_outreach_seller`.

**Reconciliation verified against live data:** per-seller sums = 10,420 assigned / 2,033
delivered / 15 repliers, matching the state-row totals exactly, with 0 rows falling to
'Not recorded'.

Three details worth keeping:
- **Group by USER, not mailbox.** Connor Warner and Chris Knight each hold two mailboxes (a
  cwsi.co.uk -> cwsisecurity.eu domain migration); grouping by mailbox listed them twice.
- **`region_code` normalised in the view.** The relational layer derives region from the
  sequence name and emits `UK&I`; dim_region and every filter in the app use `UKI`, so a
  regional filter would have silently matched nothing. Normalised once in SQL rather than
  mapped per read.
- **Rates divide by PEOPLE EMAILED, never by assigned.** NL/BeLux have 5,648 assigned and 0
  sent; dividing by assigned would drag every blended rate to ~0 and read as a data error.

### Dashboard changes (`Outreach.jsx`, `queries.js`)
- Seller table rebuilt: reads `v_outreach_seller` / `_region`, drops `outreachRep()` name
  parsing. Columns: sequences, prospects assigned, in cadence, people emailed, emails sent,
  opened %, replied %, then the Salesforce-attributed meetings/opportunities/closed-won. Sellers
  with prospects but nothing sent render greyed with "none yet" and are named in the note, so
  "not started" never looks like "data missing".
- **Sequences Created vs Active fixed at source.** The old tile counted `enabled`, which says
  nothing about contact — and `schedule_count` is 0 on all 121 rows, which is exactly why it
  contradicted "Prospects in Cadence = 0". Tile now reads **Sequences live now** from
  prospect-level state, with created / ever used / never sent to beneath it. Prospects in Cadence
  now counts people currently in a cadence, all-time as the secondary figure.
- Removed the standalone "Meetings Booked — Attributed to Outreach" section and its now-dead
  `MeetingAttribution` component (client: "already reflected elsewhere").
- Removed the duplicate conversion strip under the engagement funnel ("only reference the stats
  once"). "flows" -> "sequence group" throughout.

**The headline finding for the client:** UK&I = 5 sellers, 4,772 assigned, 998 emailed, 2,033
sent, 15 repliers. NL + BeLux = 5 sellers, 5,648 assigned, **0 emailed**. More than half the
prospects ever loaded into Outreach have never been contacted. 13 of the 15 replies are Chris
Knight's. This is now visible on the page rather than hidden behind a broken seller key.

### Two process notes
- A `python -c` string-slice edit nearly corrupted `Outreach.jsx`: I sliced
  `s[index(A):index(B)]` where B occurred BEFORE A, giving an empty `old`, and `s.replace('', new)`
  would have inserted the replacement between every character. It threw on the next `.index()`
  before writing, so nothing was lost — but slice-based edits now assert index ordering first.
- Client doc figures were re-checked against the live views before being written, not carried
  over from the plan (which is how the "EUR 19,000 open" Outreach error got in on the first pass).

### Still open in Outreach
1. **Meetings rule** — require the prospect was actually emailed AND the meeting post-dates the
   first touch, plus an "of which replied" column. Not yet built; the page still shows the old
   basis. This is the last substantive item.
2. Re-base the commercial figures on the 2 campaign-linked opportunities in the page itself.
3. Run-vs-ongoing split for Outreach — now POSSIBLE for the first time, because state rows carry
   `created_at` / `active_at` per prospect.
4. Re-test the Type of Outreach filter (the classifier is fine — see the 242-vs-121 note).

**Client doc completed to a full 85-point reference (24 Aug).** Audited `QA_20AUG_VERIFICATION.md`
item-by-item against the 13 Notion tickets and found **4 points missing** from the write-up: the
Outreach Type-of-Outreach filter, the Outreach regional filter, "Meetings Booked & Assigned
Pipeline", and the Influenced Margin half of the "remove Current View" item. All four added, plus a
specific answer for "nothing is showing for Secure Endpoints" (13 sequences, only ONE has ever sent
anything — Chris Knight, 7 prospects / 21 emails / 0 replies; 11 are empty).

Appended an index of **all 85 points** in her original order with a status each, verified
programmatically (row counts per section asserted against the section headers, statuses tallied
from the table rather than counted by hand — the first draft claimed 78 points and 71 done, both
wrong). Final tally: **74 done · 4 answered · 4 open · 3 needing a decision from her**.

## 24 Aug 2026 — the four open items: three built, one handed over

### 1. Meetings on the client's own rule — BUILT (35 -> 6)
`v_outreach_meetings_v2` + `v_outreach_meetings_v2_summary` (migration
`outreach_meetings_attributed_v2`). A meeting counts only if the prospect was ACTUALLY EMAILED
(`deliver_count > 0`) and the meeting POST-DATES the first touch
(`activity_date >= coalesce(active_at, created_at)`). The old view had no date condition at all,
so a January meeting could be credited to a June sequence — which is exactly how 35 meetings
came to exceed 30 replies.

Measured on the completed sync: **66 candidates → 43 with someone never emailed → 38 predating
the outreach → 6 attributed, 0 of which involved a reply.** The page now carries that
decomposition in a callout, because an 83% drop with no explanation earns less trust than the
arithmetic does. `getOutreachAttributedMeetings` reads the v2 view and returns a `rule` block
(candidates / rejected / attributed / withReply) purely so the page can show its working.

### 2. Outreach run-vs-ongoing — BUILT (was genuinely impossible before today)
`v_outreach_run_vs_ongoing` + `getOutreachRunVsOngoing()` + `useOutreachRunVsOngoing()` +
an `OutreachRunVsOngoing` panel. Split on each prospect's FIRST TOUCH date, matching the
opportunity-creation-date basis adopted for the rest of the dashboard. Q2: 912 first contacted /
504 emailed / 1,248 emails / 14 replied. Q3: 9,508 / 494 / 785 / 1.

**Engagement only, and the panel says why:** the commercial side rests on 2 campaign-linked
opportunities; splitting EUR 9,500 across two buckets would be inventing precision. Also added a
shared `quarterWindow(quarter)` helper — the quarter-window map had been inlined.

### 3. Meeting -> opportunity chain — SCHEMA + INGESTION DONE, needs the client's re-run
The chain could not be built because `fact_meeting` stored the meeting's date, subject, contact
and region but NOT what it was about. Salesforce's `Event.WhatId` is the link and the ingestion
already read that field for region resolution — it just discarded the id.
- Migration `meeting_and_opp_account_links`: `fact_meeting.what_id` / `what_type`,
  `fact_opportunity.account_id`, plus indexes. `what_type` derives from the SF key prefix
  (001 = Account, 006 = Opportunity) rather than being guessed.
- `salesforce_ingestion.json` (backup `.pre-meetinglink-bak`): opportunity SOQL adds `AccountId`;
  `Build Meeting Identity Rows` carries `what_id`/`what_type`; both upserts extended. Placeholder
  counts re-checked programmatically (opportunity 17 cols = 16 params + now(); meeting 9 = 8 + now()).
- Remaining after their re-run: one view chaining opportunity -> meeting on account/opportunity id
  with the opportunity created after the meeting, then the page wiring.

### 4. SEO page views — FEED BUILT, needs import + one run
`fact_web_page_daily` + `v_web_page_daily` (migration `fact_web_page_daily`) and a new
**`workflows/ga4_page_ingest.json`** (05:20 daily).

Separate workflow and separate table deliberately: `pagePath` is high-cardinality, so adding it
to `GA4_ingest` would multiply every row in `fact_web_daily` and change the grain of a table the
whole dashboard reads. Filtered to **Organic Search server-side** — these are the organic tables,
and filtering at the API keeps a run inside one response. `lookback_days` = 90, not the sessions
feed's 240, because page grain is far wider and risks the 100k row limit.

**The join needs one normalisation:** Search Console reports a FULL URL, GA4 reports a PATH.
`v_web_page_daily.page_path_clean` strips query strings and trailing slashes for it. Wiring the
SEO tables comes after the first run, so it can be verified against real rows rather than guessed.

Build green throughout.

**GA4 page feed run — SEO page views now LIVE (24 Aug).** `ga4_page_ingest` first run: 1,859 rows,
308 pages, 90 days (26 May – 23 Aug), 3,190 organic page views across 5 hostnames (including a
Google-Translate proxy and both insights subdomains).

`get_seo_top_pages` rebuilt to return `page_views` (had to DROP first — Postgres won't change a
function's return type in place). The join needed the documented normalisation: Search Console
reports FULL URLs, GA4 reports PATHS. **Verified: 260 of 308 GA4 paths match, covering 467,665 of
590,815 impressions (79%).** The unmatched Search Console pages RANKED but were never clicked — no
visit, so no page view — so the function returns NULL, not 0, and the table renders a dash with a
note saying exactly that. Top Organic Pages now shows Page views · Visits from search · Avg pos.

Caught a real mistake: the explanatory note first landed under **Traffic by Property** instead of
Top Organic Pages — a first-match string replace hit an earlier table with the identical
`</tbody></table>` tail. Moved, anchored on the Top-Pages row markup instead, and asserted the
match count. Same class of error as the Outreach slice bug: anchor on something unique to the
target, then assert.

Client doc: item 55 flipped to Done, the open list is down to 3, tallies re-verified
programmatically (75 done / 4 answered / 3 open / 3 needing her).

**Meeting -> opportunity chain view built ahead of the re-run (24 Aug).**
`v_outreach_meeting_opportunities` (migration `outreach_meeting_to_opportunity_chain`) — step 2 of
the client's proposed rule, sitting on top of `v_outreach_meetings_v2` (step 1: emailed + meeting
post-dates first touch).

Two link strengths, kept SEPARATE rather than merged because they are not equally good:
- `direct` — the meeting was logged against the opportunity itself (`Event.WhatId` is an
  Opportunity). Unambiguous.
- `account` — the meeting was logged against the ACCOUNT and an opportunity on that account was
  created on or after the meeting date. Circumstantial, and de-duplicated against `direct` so one
  opportunity can never be counted twice.

**No time window is applied in the view, deliberately.** `days_after_meeting` is returned so the
reader picks and STATES the cutoff; an opportunity created 8 months after a meeting must not be
silently credited to it. Burying a window in SQL hides what it excluded.

Returns 0 rows until the re-import lands (`fact_meeting.what_id` is still NULL on all 428 rows —
the 06:05 run used the pre-edit workflow). Applied now so it can be verified the moment it does.

**Expectation to set:** with only 6 meetings passing the client's own rule, this may well return
ZERO opportunities. That is itself a finding, and consistent with the other two: 2 campaign-linked
opportunities, and 43 of 121 sequences never used. If it returns zero, the honest line is "applied
end to end, your rule credits no 2026 opportunities to Outreach" — not a gap to apologise for.

## 24 Aug 2026 — meeting -> opportunity chain: implemented, and it credits nothing (correctly)

Re-import + re-run landed the ingestion edit: **314 of 428 meetings now carry a link** (263 Account,
51 Opportunity) and **all 763 opportunities carry `account_id`**.

`v_outreach_meeting_opportunities` returns **0 rows**, and every one of the six qualifying meetings
has a specific, defensible reason:

| Meeting | Link | Why not credited |
|---|---|---|
| Cloudology, 23 Jun (3 logged entries) | direct, to opp `006Tm00000PMfUNIA1` | **that opportunity is not in our store at all** — the ingestion loads `WHERE CampaignId != null`, so a deal with no Primary Campaign Source is invisible |
| The National Archives, 18 Jun (2 entries) | account `0013z00002LzcNfAAJ` | its one opportunity was created **2025-07-10**, a year BEFORE the meeting (Closed Lost) |
| Lloyd's Register, 9 Jul | account `0013z00002LzbicAAB` | all three opportunities created **2025-08-20**, ~11 months before the meeting |

So the rule works exactly as intended — it refuses to credit pre-existing deals to a later meeting.
Zero is the honest answer, and it agrees with the two independent measures either side: 2
campaign-linked opportunities, and 43 of 121 sequences never used.

**The genuinely valuable by-product:** of the 51 meetings logged against an opportunity, **36 point
at 20 DISTINCT opportunities that are missing from our figures entirely**, because those deals have
no Primary Campaign Source in Salesforce. Same root cause as the earlier probe finding ("won deals
with no primary campaign"). This is a CWSI data-hygiene action that would make real revenue
countable with no dashboard change — now stated in the client doc with the Cloudology deal as the
worked example.

**Deliberately NOT wired to a panel.** An always-empty section would be clutter, and reducing
clutter was the theme of this whole feedback round. The view is live, so it populates the moment a
qualifying deal is linked; the answer is given in prose in the client doc instead.

Client doc: item 85 closed, items 1/67 closed, tallies re-verified programmatically —
**77 done · 4 answered · 1 open · 3 needing the client**. The single open item is publishing the
6-meeting figure, held only for sign-off.

## 24 Aug 2026 — full cross-reference of the client doc against the code: ONE REAL ERROR FOUND

Verified every "Done" claim in `QA_20AUG_VERIFICATION.md` against the code and the live store
rather than trusting the status table. 30+ automated checks. Result: claims hold, with **one
genuine error of my own and one cross-page inconsistency**.

### The error: "Activity Run vs Ongoing is gross margin" was claimed but FALSE
Item 24 (her "confirm the figures are gross margin, and make gross margin consistent across the
dashboard") was marked Done. It wasn't: `getCurrentVsOngoing` selected `amount_eur` only, so that
panel was showing REVENUE while its neighbours showed gross profit. Now selects `margin_eur` too
and displays gross profit, keeping revenue as `pipelineRevenue`/`closedWonRevenue` for the
secondary line. Deals with NULL gross profit are excluded from the margin sum rather than counted
at full value — same rule as Influenced Pipeline.

**The client-doc figures were therefore wrong and are corrected:** Q2 run-this-period is
**40 opportunities / EUR 106,848 gross profit** (not 42 / EUR 124,828, which was the revenue
basis); ongoing is 33 / EUR 159,887, identical on both bases because those deals carry GP = value.

### The inconsistency: "Closed-Won" meant two different things between pages
Campaigns / Events / Email / SEO / per-channel had moved to gross profit, but Overview, Pipeline
and Pipeline-by-Source still showed revenue under the SAME column header. Exactly the confusion
she complained about. Fixed at 6 render sites; `getOverview.byChannel` and `getPipeline.bySource`
gained a `margin` field.

**Deliberately NOT changed: the Board Pack.** Its exported figures run through the trace-to-data
validator, and switching the basis there means rewriting the trace strings too. Doing that
mid-audit risks breaking the export for no urgent gain — flagged as a decision instead. Board
already states its own basis on-panel ("shares are basis-independent; the headline Influenced
Pipeline is gross profit").

### Also worth recording: three "FAIL"s in the check were false positives
`current view`, `undated` and `Actual` all still matched — in **code comments** and in the field
name `netActual`, not in anything rendered. Crude greps over source will do this; the check was
tightened to look at rendered strings.

## 24 Aug 2026 — LinkedIn company-page analytics LIVE (the parked item)

Client supplied the Page Analytics exports in `docs/linkedin_analytics/` — 9 files, 3 per page.

**The big correction: this is REGIONAL.** CWSI runs three separate LinkedIn Pages
(`cwsi_` = UKI, `cwsibelux_` = BeLux, `cwsinl_` = NL). Earlier notes — and my own advice to the
client — said a company page is global and therefore these two KPI rows could only ever be
all-regions figures. **That was wrong** and is corrected in the client doc.

**Reading the files.** They are real `.xls` (CDFV2/BIFF), not `.xlsx`, so openpyxl cannot read
them; installed `xlrd` (2.x reads .xls only). Dates are **MM/DD/YYYY** — confirmed by post
created-dates reading `08/21/2026`, which is invalid as DD/MM. Each page yields three daily
series (`New followers`, content `Metrics`, `Visitor metrics`), all 234 contiguous days
1 Jan–22 Aug, plus an `All posts` sheet (218 unique posts across the three pages).

**Schema** (migrations `linkedin_page_analytics`, `linkedin_page_daily_trim_v2`):
`linkedin_page_daily` at (activity_date, page_key) + `v_linkedin_page`.
Trimmed to exactly the columns actually loaded — the unloaded ones would have sat at DEFAULT 0,
which reads as a measured zero rather than "not loaded" (same trap as N/A-as-0). LinkedIn's own
per-day `engagement_rate` columns were dropped deliberately: **a rate is not additive**, so a
stored daily rate can only be misused. Window rates are computed from components.

**Loading through an MCP SQL tool efficiently.** A naive VALUES load was ~220KB of tool payload.
Because the dates are contiguous, the load became one statement per page using
`generate_series` for dates + one int[] per metric — ~6KB per page, a ~10x reduction. Verified
each region's totals against the Python parser: UKI 462 followers / 279,287 impressions /
7,202 engagements; BeLux 65 / 26,944 / 2,715; NL 7 / 11,129 / 630. Exact match.

**Wired:** `getLinkedInPage()` + `useLinkedInPage()` + the two KPI Tracker rows, region- and
quarter-aware. Populates at every region/quarter combination.

**Two findings for the client:** BeLux engages at **10.08%** vs UKI's **2.58%** on a tenth of the
reach — a small, highly responsive audience. And the NL page has gained **7 followers all year**,
net-negative in Q2 and Q3, i.e. effectively dormant.

**Not done — the recurring feed.** This is a one-off seed load. A monthly refresh needs either a
Drive-drop workflow (the `linkedin_manual_ingestion` pattern — note that workflow will REJECT
these files: it matches on `linkedin_export`/`performance_report` filenames and validates Ads
columns) or the Community Management API. `linkedin_page_post` was created but is NOT loaded —
the 218 posts weren't needed for the two KPI rows and the payload wasn't worth it yet.

## 24 Aug 2026 — meetings: TWO faults found by reconciling against our own report

The client supplied `docs/CWSI_Outreach_Report_AllTime_Final.docx`, which says **16 meetings**
where the new dashboard view said **6**. Reconciling the two found that BOTH numbers I had
produced were wrong in the same way.

### Fault 1 — I was counting ATTENDEES, not meetings
Salesforce writes **one Event row per attendee**, each with its own Id, so `meeting_id` does not
identify a meeting. `COUNT(DISTINCT meeting_id)` counted invitees. Proof from the data — the six
rows the view called "6 meetings" were actually three:

| rows | date | subject |
|---|---|---|
| 2 | 2026-06-18 | CWSI/The National Archives - Kick Off Copilot Assessment |
| 3 | 2026-06-23 | Following: CWSI/Medisec : Recommandations presentation |
| 1 | 2026-07-09 | LR/CWSI: SoC Service's Overview Discussion |

**The report already had this right** — it keys meetings on normalised subject + date, stripping
`Following:` / `RE:` / `FW:` because Outlook prepends them to the same booking, with the date in
the key so a prefix strip can never merge different days. I wrote a second implementation instead
of reusing it. Third time today that Salesforce attendee rows have been miscounted as meetings.

### Fault 2 — my earlier "the dataset grew" explanation was wrong
I claimed 16→23 was because delivered volume had roughly doubled since the report. It wasn't: the
report's rule reproduces **exactly 16** on today's data. The whole gap was the counting unit.

### Fault 3 (minor) — delivery test
Mine was `deliver_count > 0`; the report uses `deliver_count > bounce_count`, which is stricter and
better — at least one email actually LANDED rather than all bouncing. Adopted the report's.

### The corrected ladder — all in MEETINGS
| Basis | Meetings |
|---|---|
| Someone on the invite appears in a marketing sequence | 43 |
| — person never actually emailed | −27 |
| — emailed, but meeting PREDATES the outreach | −13 |
| **Attributed (client's rule)** | **3** |
| *Influenced (the report's basis — emailed only)* | *16* |

The 13 are precisely the report's "continuations of existing engagements" caveat — it said
"several of the 16"; it is 13 of 16.

### Built (migration `outreach_meetings_v3_dedup_and_rule_v2`)
- `v_outreach_meeting_candidates` — every (meeting, sequence) pair with `meeting_key`,
  `was_emailed`, `after_first_touch`, `person_replied`. One place the rule lives.
- `v_outreach_meetings_v2` — rows surviving both conditions, now carrying `meeting_key`.
- `v_outreach_meetings_v2_summary` — candidates / rejected-never-emailed /
  rejected-before-outreach / attributed / attributed_with_reply / **influenced_report_basis**,
  classified per MEETING via `bool_or`, never per attendee row.
- `v_outreach_meeting_opportunities` rebuilt on top (logic unchanged).
- Multi-sequence handling is PERMISSIVE by design: the date test passes if ANY of a person's
  sequences emailed them before the meeting, so a sequence added later cannot disqualify a meeting
  an earlier one earned.

### Wired
- `queries.js` counts `meeting_key` into the tier Sets (was `meeting_id`), so a three-attendee
  meeting counts once everywhere, and exposes `rule.influenced`.
- Outreach page callout now states the 43 → 27 → 13 → 3 ladder, says explicitly that meetings and
  not attendees are counted, and **reconciles with the report's 16 on the page itself** rather than
  leaving the two documents in apparent conflict. The meetings KPI carries the 16 as a secondary line.
- `methodology.js` `outreachMeetings` eye-button rewritten: both conditions, the attendee-vs-meeting
  correction, and a full paragraph on why this page says 3 where the report says 16 — influence vs
  attribution, with the report's own caveat quoted.
- Client doc: new "Meetings — corrected, and reconciled with the Outreach report" section plus a
  side-by-side rule comparison table.

**Lesson worth keeping: reconcile against our own prior deliverables before publishing a figure.**
The report was right and sitting in `docs/` the whole time; three separate errors would have been
caught in one pass by comparing to it first.

**Client doc status model simplified (24 Aug).** The index had four statuses and one of them —
"Answered" — conflated *we replied* with *it's finished*, so items #27 and #28 appeared closed while
actually waiting on Margot. Collapsed to **two**: `Done` (changed, verified, closed — including
questions answered in the document with anything they implied also built) and `Your call` (our part
done, recommendation stated, waiting on her). #2 and #83 moved to Done; #27 and #28 joined #11 and
#33 under Your call.

**Final tally: 81 Done · 4 Your call · 85 total.** Nothing open on our side.

Also: the "Still in progress" section was retitled **"Nothing outstanding on our side"** and now
lists the two items that are delivered *with a stated limit* (the meeting→opportunity chain, which
correctly credits nothing; page views, where a dash means the page ranked but was never clicked)
rather than implying unfinished work. And "What we need from you" was rewritten so the four
decisions lead, each numbered against its index entry and carrying our recommendation — including
the new CWSI action to set Primary Campaign Source on the 20 opportunities that meetings were
logged against.

**Added "Which meetings figure is which" to the client doc (24 Aug).** Seven different numbers had
circulated across two units (43/16/3 = meetings; 66/25/8 = attendee records; 35 = the superseded old
basis). The table states which three to quote and marks the rest as wrong-unit or superseded. Worth
having in writing: 23 and 6 — both attendee-record counts I quoted during the investigation — nearly
reached the client document as meeting counts.

**Meetings: both calculations now DEFINED side by side in the client doc**, replacing the earlier
"why they differ" summary. Six numbered steps — meeting source, match to outreach, counting unit,
the emailed test, the date test, scope — with the report's and the dashboard's treatment of each, so
either figure can be reproduced from the document. The divergence is isolated to step 5 (the date
test); steps 1-4 and 6 are shared, and step 3 records that the dashboard was corrected to the
report's de-duplication rather than the report changing.

**Stale-text sweep of the client doc (24 Aug).** Found FOUR blocks left behind by edits whose
`str.replace` had silently no-op'd because the target text differed from what I assumed:
1. The index **legend** still described four statuses including "Open"/"Answered".
2. The **summary table** still read 78 Done / 4 Answered / 1 Open / 2 Needs you.
3. "**The one open item** … needs a Salesforce change on our side" — that change was made and run
   hours earlier (314 meetings now carry their linked record, all 763 opportunities their account).
4. The **Organic SEO answer** still said page views were "queued" while the summary said "live" —
   two parts of the same document contradicting each other.

All four corrected, and a regex sweep for tense/state drift (`we are removing`, `not yet`, `queued`,
`awaiting`, `is next`) now runs after doc edits. **Lesson: `s.replace()` without an assert is how a
document ends up disagreeing with itself — every doc edit now asserts the anchor exists first.**
That is the same failure mode as the Outreach slice bug and the SEO note landing under the wrong
table, and it has now cost three separate corrections today.

## 25 Aug 2026 — Outreach quarter filtering (user spotted it)

**Outreach was the ONLY results page with no `QuarterPills`** — every other page (Overview,
Pipeline, Campaigns, Email, Events, SEO, Budget, Channel, Board, KPI Tracker) has one. That was
correct originally: the feed gave lifetime per-sequence counters with no dates, so a pill would have
been a control that changed nothing, and the page said so.

**It stopped being true after the rebuild** — prospect records now carry their own dates, which is
what made the run-vs-ongoing panel possible in the first place.

### The real defect: INVISIBLE filtering, not missing filtering
Three of the four Outreach reads already consumed the GLOBAL quarter filter
(`getOutreachAttributedMeetings`, `getOutreachRunVsOngoing`, `getLinkedInPage`), while the
engagement/seller/sequence reads did not. So picking Q2 on the Overview and opening Outreach
silently changed the meetings figure with no pill on the page to show or undo it.

**Worse, it made the page contradict itself.** The meetings KPI was quarter-scoped but its
explanatory callout read an ALL-TIME summary view: under Q2 the card showed **2** while the sentence
directly beneath it still said "…that leaves 3". Same class of defect as a tile disagreeing with the
table under it.

### Fixed
1. **`get_outreach_meetings_rule(quarter, year, region)`** (migration
   `outreach_meetings_summary_quarter_aware`) replaces the all-time summary view for the callout. A
   view can't take a parameter, so it had to become a function. NULL quarter = whole reporting year,
   matching how every other read treats the YTD pill. Region scopes off the MEETING's own region,
   the basis the rest of the page's regional figures use.
2. **`QuarterPills` added to the Outreach page.**
3. **The mixed grain is now stated, not left to be discovered.** The scope callout was rewritten
   from "the quarter pill does not change them" to spelling out which figures are dated (meetings,
   run-this-period) and which are lifetime (prospects, emails, opens, replies) and WHY — the
   platform reports running per-sequence counters, so they cannot honestly be cut by quarter.
   `· lifetime` added to the sequence and prospect cards, and to the funnel and seller panel subs.

### Verified
Quarters partition cleanly: candidates 21 + 14 + 8 = 43; attributed 0 + 2 + 1 = 3. And the card and
its callout now agree under **every** pill — Q2 2/2, Q3 1/1, YTD 3/3.

**Note the Q1 shape:** 21 candidate meetings, 0 attributed — 12 of them predate the outreach and 9
involve people never emailed. Q1 is when the sequences existed but had barely been run, so a zero
there is the correct reading rather than a gap.

---

## 31 Aug — KPI Tracker crash on open (`linkedinPage is not defined`)

The KPI Tracker page threw a `ReferenceError` and rendered nothing. The LinkedIn company-page
(organic social) feed is read in the outer `KpiTracker` component, but the register rows are built
inside the inner `Register` component — and `linkedinPage` was never passed between the two, so the
build left it as a bare global reference that blew up on first render.

### Fixed
`linkedinPage` is now passed as a prop (`<Register linkedinPage={linkedinPage} … />`) and added to
`Register`'s parameter list, so the Engagement rate and Follower growth rows resolve against real
company-page data instead of crashing the page.

---

## 31 Aug — Line-by-line reconciliation for "Activity run this period vs ongoing impact"

**Why.** Margot: *"I've been trying to go through some of the data today to verify its accuracy, but I
keep on getting different numbers than you guys… the very detailed breakdown is indeed what I'm
looking for. So, for example, on ongoing impact, the campaigns, including value to get to the
number."* The eye-buttons explain the *method*; what was missing was the *evidence* — which campaigns
and which deals add up to the figure on screen.

### Built
Each of the two figures in the panel now carries a **"show the N campaigns and M deals behind this
number"** drill-down: a per-campaign table, expandable to the individual opportunities, with the exact
amount each one contributed, plus a CSV of every deal.

Three things were deliberate, all following from "she needs to reconcile, not to be reassured":

1. **The detail is computed in the same accumulator loop as the headline** (`getCurrentVsOngoing`),
   not recomputed alongside it, so the breakdown cannot drift from the number it explains. The
   component also foots its own subtotals against the headline and says so on screen if they ever
   disagree.
2. **Exact euros to the cent** (€110,634.90), never the compact €111k the tiles show — and 2dp rather
   than whole euros, because at 0dp a column of rows can visibly fail to add to its own total, which
   is the exact complaint being answered. The CSV carries full precision as plain numbers.
3. **Revenue is shown beside gross profit on every row.** The panel reports gross profit; summing
   Amount instead is the most likely reason an independent tally comes out higher, so both columns sit
   side by side and the note says which one the figure uses.

### Also fixed, found while doing this
- **The `currentVsOngoing` eye-button text still described the old basis.** Its *Source* line read
  "Salesforce Campaign Start Date" — the basis that was replaced on 20 Aug by the opportunity's
  creation date. The `calc` had been updated then; `source` and `what` had not. Margot has been
  reading a stale explanation of the very number she was trying to verify.
- **"Ongoing impact" is €0 under the YTD pill (and Q1) by construction, and the panel didn't say so.**
  The store holds 2026-created opportunities only, and YTD's period start *is* 2026-01-01, so no
  opportunity can pre-date the window. It now states that this is a definitional zero rather than
  leaving a bare €0 to be read as missing data.

### Verified
Reconciliation checked against the live store for every bucket × quarter — campaign roll-up vs the
flat headline sum, on deal count, closed-won gross profit and open pipeline gross profit. All six
combinations agree exactly:

| Period | Bucket | Campaigns | Deals | Closed-won GP | Open pipeline GP |
|---|---|---|---|---|---|
| Q1 | run this period | 13 | 30 | €29,590.45 | €421,506.78 |
| Q2 | run this period | 19 | 40 | €106,847.97 | €667,993.42 |
| Q2 | ongoing impact | 12 | 32 | €159,887.11 | €421,506.78 |
| Q3 | run this period | 6 | 10 | €9,500.00 | €340,902.59 |
| Q3 | ongoing impact | 28 | 64 | €110,634.90 | €1,089,500.20 |
| YTD | run this period | 28 | 91 | €416,460.42 | €1,430,402.79 |

Q3's ongoing impact — the figure Margot named — resolves to 3 campaigns: NL Samenwerkingsdag Zorg
€46,130.28, Agent 365 Public Sector €44,014.08, UK Protect Data Power AI €20,490.53.

### Follow-up, same day — the older deal drill-down was contradicting the pages it sits on

`DealDrilldown` (Campaigns, Events) looked like the same reconciliation tool but its totals tied to
nothing. It summed **revenue** for the won/still-open summary, and **every listed row including
closed-lost** for the two column totals. So a client opening it to check the €416,460.42 closed-won
figure above it was shown four numbers, none of them that one:

| Footer showed | Was actually |
|---|---|
| €438,519.22 "won" | revenue, not gross profit |
| €1,536,732.20 "still open" | revenue, not gross profit |
| €2,311,183.77 Value total | all 109 deals, closed-lost included |
| €2,154,727.56 Gross profit total | all 109 deals, closed-lost included |

The €307,864.35 of gross profit sitting in 18 closed-lost deals was silently folded into two of
those totals. This is the same defect class Margot reported — and it was on the two pages she
reviews most, which would have undercut the new drill-down two pages over.

**Fixed.** Totals now use the basis of the table they sit under — gross profit, won and still-open
only. Closed-lost deals stay visible in the rows (they are part of the campaign's story) but are
totalled on their own clearly-labelled line and counted in nothing. Deals with no Gross Profit in
Salesforce are excluded from the gross-profit sums rather than counted at full value, matching
Influenced Pipeline. Row and footer amounts are now exact to the cent (`eurExact`, promoted to
`format.js` and shared with the new breakdown), and a note under the table says which column the
figures use and why summing Value gives a higher number.

**Verified** against the live store: footer closed-won €416,460.42 = table closed-won; footer still
open €1,430,402.79 = table open pipeline; gross-profit column total €1,846,863.21 = the sum of the
two. All three tie.

---

## 1 Sep — CWSI FY26 quarterly KPI reforecast loaded (client-supplied targets)

CWSI's fractional CMO reworked the FY26 quarterly KPIs; Margot sent the sheet and narrative
(`docs/kpi/`) asking us to load them and update the quarterly benchmarks.

**29 of the 42 sheet rows are now live targets** — migrations `20260901000000_kpi_reforecast_aug2026`
(the targets) and `20260901000001_kpi_targets_source_provenance` (the provenance column). Full
row-by-row mapping, including the 13 not loaded and why, is in
**`docs/kpi/KPI_REFORECAST_AUG2026.md`** — that document is the audit trail, not this entry.

### Built
- **28 existing KPIs re-targeted**, Q1–Q4, with the sheet's direction (lower-is-better for cost per
  click, cost per thousand, unsubscribe rate) and each row's status + rationale stored on the KPI and
  surfaced on hover in the KPI Tracker.
- **One new KPI added** — paid click-through rate (`paidCtr`). It was the only unmapped sheet row
  with a live source already in the warehouse (LinkedIn Ads clicks ÷ impressions), so it was worth
  building rather than deferring.
- **Created Opportunities now has a board target** for the first time (FY 81); the Board Pack had
  `target: null, targetDisplay: 'no target set'` hardcoded.
- **Provenance became a stored fact** (`kpi_targets.source` = client | placeholder) rather than a
  blanket caption. Editing a target in the UI sets it to `client` — a hand-entered figure is a client
  decision. Eight KPIs the sheet does not cover keep their BrainD placeholder and now say so.

### Also fixed — the dashboard was about to misrepresent the client's own work
Six surfaces hardcoded "all targets are provisional / placeholders pending CWSI sign-off": the KPI
Tracker banner and page subtitle, the Overview tile tooltips, the Board page callout, both Gamma deck
captions, and both printed-PDF banners (plus every board-pack metric card). With 29 client targets
loaded, that copy would have told the board that their own CMO's signed-off benchmarks were BrainD
guesses. All six now flag provenance **per metric**, from `source`, and say the opposite when nothing
is provisional.

### Year-to-date targets are derived (the sheet gives quarters only)
Counts and money sum; cost per click and cost per thousand take the mean (summing four quarters of
cost-per-click would give a meaningless €28 "full-year cost per click"); MQL→SQL and SQL→Closed/Won
are derived from the volume targets they are ratios of. That last choice self-validates —
SQL→Won = 25 won ÷ 250 SQLs = **10%**, exactly the flat 10% the sheet states. A series with a missing
quarter gets no FY target rather than a Q4-only figure posing as a full-year one.

### Two things to raise with CWSI
1. **Q1/Q2 are planning comparators, not targets** — the narrative says so explicitly, and the
   dashboard now scores actuals against them: Q2 reads **651% of target for MQLs**, 423% SQLs, 377%
   created opportunities, 350% closed-won. Loaded faithfully as supplied, but those percentages read
   as broken at a glance. The per-row rationale is on the hover, and the tracker may want the
   comparator quarters visually separated from the reforecast quarters.
2. **LinkedIn follower growth is a % target against a count actual** — we hold net new followers per
   period, not the follower base to divide by, so %-of-target stays blank until CWSI either restates
   the target as a count or we source the base.

### Verified
All 29 rows loaded and tagged `client` (29 client / 39 placeholder, of which only 12 hold any
target). Q3 actuals score sensibly against the new Q3 targets — MQLs 747 vs 400, SQLs 140 vs 80,
created opportunities 14 vs 25, closed-won 5 vs 8 — no mapping absurdities. YTD MQL actual is 1,507
against an FY target of 1,050, which is worth CWSI knowing.

---

## 2 Sep — Campaigns page layout: content clipped off-screen, quarter filter unreachable

Margot's screenshot showed the Campaigns page with the fourth KPI tile ("Qualified Oppor…") and a
paragraph ("€1.4m oper…") both cut off at the right edge of the window, and no quarter filter in
sight.

### Root causes (three, all pre-existing)
1. **A wide table pushed the whole page sideways.** The activities table has nine columns and was in
   a bare `.panel-body.no-pad` with no scroll wrapper — `DealDrilldown` wrapped its table, this one
   never did. The table's min-content width therefore set the page width, and everything to the
   right of the window edge was simply unreachable. The same omission was in Channel, Events, Email
   and KPI Tracker, so `.panel-body.no-pad` now scrolls horizontally and all five are fixed at once.
2. **`grid-template-columns: repeat(4, 1fr)` cannot shrink.** `1fr` floors at `min-content`, so a
   long label like "Qualified Opportunities" forces the track wider than its share and blows the
   grid out of its container. All grids now use `minmax(0, 1fr)`, with breakpoints widened to match
   the labels actually in use (cols-4 breaks at 1280px, not 1100px).
3. **The quarter pills were never missing — they scrolled away.** Region tabs live in the fixed
   topbar; the quarter pills sit in `.page-head`, which scrolled off. On a long page you lost the
   quarter filter entirely, which reads as "we don't have a quarter tile". `.page-head` is now
   sticky beneath the topbar, so both scope controls stay put on every page.

### Also found and fixed
- **A "SETTINGS PAGE" CSS block was restyling the entire app.** `.page-head`, `.page-title` and
  `.page-sub` were declared unscoped inside it and, being later in the cascade, overrode the real
  definitions everywhere — every page title in the app was rendering at the settings page's 20px
  instead of 26px. Now scoped to `.settings`.
- Flex children (`.callout-body`, `.main`, `.content`) given `min-width: 0`; without it they refuse
  to shrink below their content and contribute to the same overflow.
- The campaign picker sizes to its widest option (full campaign names); capped and ellipsised.

### UX
The two explanatory callouts ran to several paragraphs each and together filled the first screen
before any figure appeared. Both are now collapsed to a one-line summary with **Read more** — the
detail is still there, it just no longer stands between the reader and the data.

**Note:** `overflow-x: hidden` was tried on `.main` and removed — it turns the element into a scroll
container, which would have made the new sticky header stick to `.main` (which never scrolls)
instead of the viewport. The grid and table fixes address the overflow at source.

### Same day — the drill-down toggles didn't look clickable

Margot pointed at the two "Show the N campaigns and M deals behind …" lines: she read them as a
caption, not a control, so the breakdown built for her went unopened. They were plain text at 0.85
opacity with a small `▸` and no border, background or hover — no affordance at all.

Both drill-down toggles (`ImpactBreakdown`, `DealDrilldown`) are now proper buttons: accent colour,
bordered pill, hover and focus-visible states, `aria-expanded`, and a real chevron icon
(`I.chevronRight`, new) that rotates 90° when open instead of swapping `▸`/`▾` glyphs. The campaign
rows inside a breakdown are controls too, so they get the same chevron plus a hover colour and a
title explaining what a click does.

---

## 2 Sep — Seven more reforecast KPIs built (13 unbuildable → 6)

Of the 13 sheet rows the first pass could not load, **seven turned out to be buildable with nothing
further from CWSI**. Migration `20260902000000_kpi_manual_and_organic_growth`. The mapping doc
(`docs/kpi/KPI_REFORECAST_AUG2026.md`) is updated with a new "Added 2 September" section and a
rewritten remainder.

### Computed (1)
**Organic traffic growth vs prior quarter** — derived from GA4 sessions we already hold, no new
data. Verified against the store: Q2 **+78.1%**, Q3 **−31.9%**, and correctly blank for Q1 (no prior
quarter in the reporting year) and year-to-date (not a quarter). The Q3 fall is expected — the
narrative treats Q3 as the post-launch reset quarter.

### Entered by hand (6)
New `kpi_manual` table + an editable **Actual** cell in the KPI Tracker, working like the existing
target editor. Covers the four countable-but-unrecorded KPIs (PR placements, contributed articles,
hero case studies, MDF claim rate) **and the two non-numeric ones** the numeric target columns could
never hold — the Website measurement integrity RAG flag and the Organic engagement time trend.

`kpi_manual` holds actual *and* target per period, because these targets aren't uniformly numeric
('GREEN', 'Improve vs Q3') — so `kpi_targets` stays numeric-only rather than growing a parallel set
of text columns. RLS matches `kpi_targets` exactly: authenticated-only, anon explicitly revoked.

They render in a new **PR, Content & Partner** register section, each showing its agreed target so
the commitment is visible before any figure is entered. The register subtitle now states how many
rows are entered by hand, so they can't be mistaken for a live feed.

### Also fixed while wiring the exports
**`linkedinPage` was missing from `assembleKpiRegister`.** The exporter called the row builder
without it, so LinkedIn engagement rate and follower growth printed "not available yet" in every PDF
and Gamma deck while the screen showed real figures — the same omission class as the crash fixed on
31 Aug, one layer down. Both export renderers also now read a manual row's own actual/target, so
screen and export cannot disagree.

### The remaining 6 are decisions, not builds
Reclassified in the doc, because "no data source" was too crude:
- **Event → MQL** is a *definition collision*, not a data gap: under the 9 Jul locked definition
  Leads = MQL, and the data confirms it (`leads` = `mql_count` on every event row, 774 = 774 YTD).
  Registrations→MQL is 100% by construction, so a 10% target means something else.
- **Sales-cycle reduction** is blocked on **one number** — the baseline. The cycle days are already
  computed.
- **Outreach SQLs** and **MDF secured** need definitions; **nurtured leads** needs the Pardot feed;
  **paid MQL→SQL** is a duplicate and may need nothing at all.

### Client-facing version of the reforecast write-up

`docs/kpi/KPI_REFORECAST_AUG2026.md` is an internal audit trail — it names database tables,
migration files and KPI keys, so it fails the "must read cold" rule for anything that leaves the
building. **`docs/kpi/KPI_REFORECAST_FOR_CWSI.md`** is the version to send: same facts, no internal
jargon (a jargon sweep leaves only "Salesforce" and "GA4", both systems the client uses daily).

It leads with what is live (36 of 42), then three things to know before reading the numbers — the
Q1/Q2 comparators reading as 350–651% of target, MQLs already past the full-year target at 1,507 vs
1,050, and LinkedIn follower growth being unscoreable as written — then the four questions that each
unblock a specific KPI, phrased so they can be answered without knowing how the dashboard works.

---

## 3 Sep — "All Underlying Data" export: every record behind every figure

Margot: *"What I'm looking for is all of the data that's feeding into all numbers being displayed in
the dashboard so I can verify whether the data displayed is correct… I've tried verifying all of the
data in the dashboard and it seems harder than I expected."*

The per-panel drill-downs answer one figure at a time. This hands over the whole record set as an
Excel workbook, from a new card on the Export page (`src/data/verificationWorkbook.js`).

### The design decision that makes it work
A raw dump would have been 5,726 rows and no way in — the same problem, bigger file. So sheet 2 is
**"Figures"**: every headline number, its value, and the sheet + filter that reproduces it. The
values come from the dashboard's **own query functions**, never recomputed in the exporter — an
export that recalculated could disagree with the screen, which is precisely the problem being
solved.

Sheet 1 is **"Read me"**, stating the four things that make an honest hand-tally differ, rather than
leaving them to be discovered:
1. **Gross profit, not revenue** — and deals with no gross profit are excluded, not zeroed.
2. **The funnel has a floor.** Each stage is shown as at least as large as the next, so displayed
   MQL can exceed the sum of the MQL column — currently **1,541 displayed vs 1,530 raw**. Anyone
   summing the column gets a different number and concludes the dashboard is wrong.
3. **Dates are capped** at min(today, 30 Sep 2026). 12 rows in the store are dated later and are
   deliberately excluded, so a full-quarter sum can exceed the dashboard.
4. **Region can be overridden**, and regional figures follow the override, not the Salesforce account.

Then a sheet per source: Deals (111), Campaign funnel (609), Campaigns (521), Web traffic (2,373),
LinkedIn Ads (609), LinkedIn page (702), Meetings (447), Email sends (266), Marketing spend (88),
KPI targets. Region-scoped where the row set carries a region *code*; `fact_channel_daily` and
`fact_marketing_spend` key region numerically, so they go in whole and the Read me says so rather
than shipping a half-filtered sheet.

### Library
`write-excel-file` (4.1.1). `exceljs` was tried first and rejected — it pulled 5 vulnerabilities
including 2 high. `write-excel-file` added **zero**; the 3 remaining in the tree are pre-existing
(`pptxgenjs` → `image-size`). Lazy-imported, so the main bundle grows ~7 kB.

### Verified
- All nine source queries run — column names were checked against the schema first, and six of my
  initial guesses were wrong (`linkedin_page_daily` uses `*_total` suffixes, `dim_campaign` has no
  `end_date`/`region_code`, `fact_channel_daily` keys region numerically, spend's PK is `spend_id`).
- **The v4 API differs from v3 in three ways** that would each have thrown at runtime: `schema` was
  removed in favour of `columns`, columns are `header`+`cell()` not `column`+`value`, and the
  browser build returns `{toBlob, toFile(name)}` rather than taking a `fileName` option. Caught by
  running the real helper code in Node.
- Generated workbook inspected: sheet tabs correct, freeze panes on, column widths applied, `&`
  escaped, **numeric cells written as real numbers** (so they can be summed) and nulls as genuinely
  empty cells rather than zeros.

**Not yet clicked in a browser** — the query layer and the workbook generation are both tested, but
the download path and React wiring have not been exercised end to end.

---

## 6 Sep — "Where does this number come from?" for every number

Margot: *"someone who is going through the database should know where this number is coming from,
which campaign, LinkedIn or any other thing… this is what I want for all the numbers."*

The drill-downs so far each answered one figure and were hand-built. This generalises the pattern:
a **metric registry** (`src/data/metricSources.js`) declares, per metric, the source it is summed
from and how to group the contributing rows; one generic reader (`getMetricSource`) and one generic
component (`SourceBreakdown`) then open **any** registered figure.

Her worked example now resolves on screen: the Overview's **778 MQLs** open as
**Email 562 · Events & Webinars 148 · Organic SEO 68** across 38 campaigns, each expandable to its
individual dated rows, with a CSV of every contributing record.

### Where it is wired
- **Overview funnel** — the stage figures are now clickable (dashed underline, blue on hover). One
  breakdown opens beneath the funnel for whichever stage was picked: MQLs, SQLs, Created
  Opportunities, Qualified Opportunities, Closed Won.
- **KPI Tracker** — every traceable row carries its own inline breakdown, so the register is the one
  place any figure can be opened up. **14 of the register's rows** are covered, plus Qualified
  Opportunities on the Overview.

### Registered so far (16)
Funnel counts (MQL/SQL/created/qualified/won), money (closed-won value, influenced margin,
influenced pipeline), website (organic traffic, organic social, conversions ×2), paid
(impressions, clicks) and LinkedIn page follower growth.

### The bug this design caught
`impressions` and `clicks` initially pointed at `fact_channel_daily` — which returns **0** for 2026.
The dashboard's paid figures actually come from Margot's authoritative `linkedin_campaign_2026`
table (**162,302 impressions / 1,490 clicks across 3 campaigns, all in Q2**), scoped by the
campaign's own `quarter` and its multi-market `regions` array rather than by activity date. The
breakdown would have shown zero against a non-zero tile — the precise drift this whole line of work
exists to prevent. Now corrected, and the registry comment says why.

### Design rules carried over
- Rows come from **the same scoped fetchers the headline uses** — `fetchFacts` in particular, so the
  campaign region overrides apply identically and a breakdown cannot be scoped differently from the
  number above it.
- Contributions are exact; money to the cent.
- The breakdown **foots on screen** and says so (`✓ This matches the 778 shown above`). Where it
  deliberately does not — MQLs under the year-to-date pill, where the funnel floor lifts the headline
  above the raw rows (1,541 vs 1,530) — it explains the difference instead of reporting an error.
- Zero contributions are dropped: a campaign that produced no MQLs is not part of the answer to
  "where did the MQLs come from", and listing it buries the ones that are.

### Adding a metric
One entry in `METRIC_SOURCES` — `{ label, from, column, group, sub, date, note }` — and the figure
becomes traceable everywhere `SourceBreakdown` is rendered. No new query or component.

**Not yet clicked in a browser.** Every registry entry was checked against live data (all 16 resolve,
`totalMqls` = 778 exactly), but the UI wiring has not been exercised end to end.

### Tested in the browser — and it caught a real bug

Driven end to end in Chrome against the dev server. Everything works, and one genuine defect
surfaced that only appeared on screen.

**The bug: Influenced pipeline reported a false discrepancy against its own headline.**
The registry summed `pipeline_margin_value` (gross profit on OPEN opportunities) only, but the
headline is open **plus** won gross profit — a deal that closed was still influenced. So the panel
read:

> *"The figure above reads €175,734.90, which is €120,134.90 higher than these records add up to.
> That is not expected — please flag it, as it points to a fault in the dashboard."*

It was our own composition, documented in the registry note, being reported to the client as a
dashboard fault. Worse than useless — it would have had Margot raising a non-bug.

**Fixed** by supporting multi-column metrics (`columns: ['pipeline_margin_value','margin_value']`).
It now reads **✓ This matches the €175,734.90 shown above**, footing to the cent.

**Verified on screen:**
- Overview funnel **778 MQLs** → Email 562 (72.2%) · Events & Webinars 148 (19.0%) · Organic SEO 68,
  total row **778 / 100%**, `✓ This matches the 778 shown above`.
- Expanding *Legal Always-On Outreach Campaign* gives its dated rows by region
  (419+40+85+11+1+3+1 = 560), matching the campaign subtotal.
- KPI Tracker: inline breakdowns on every traceable row; Created opportunities foots at 16/100%.
- **The deliberate non-foot works**: MQLs under the year-to-date pill read *"1,549 … 11 higher than
  these records add up to. That is the funnel floor described above, not a discrepancy"* — explained
  rather than flagged as an error.
- No console errors. The reforecast work is visibly live: targets from the sheet (MQLs 195% of 400),
  the `prov.` marker on Cost per lead, "6 entered by hand" in the register subtitle, and the sticky
  quarter pills.

*(Mouse-wheel and keyboard scrolling did not respond to the automation's synthetic events, while
`scrollIntoView` did. Margot's own screenshots show normal scrolling, so this is an extension quirk,
not an app defect.)*

### Frontend pass on the source breakdown

The mechanism worked but read poorly: percentages carried no visual weight, channel and campaign
rows had near-identical hierarchy, the header took three loose lines before any data, and on the KPI
Tracker the panel was squeezed into the metric-name **table cell** while the row ran on past it.

**Redesigned:**
- **Proportion bars** in the Share column — magnitude is now readable without parsing a number.
  Channel bars are solid accent, campaign bars a lighter tint, with a 2px floor so a 0.1%
  contribution still registers.
- **Summary strip** replacing the loose header: the figure being explained, then
  *"from 3 channels · 18 campaigns · 136 records"*, with the CSV button (now an icon button matching
  the drill-toggle family) right-aligned on the same line.
- **Real hierarchy** — channel rows get an inset accent edge, own ground and bold label; campaigns
  indent beneath them; an open campaign tints so you can see which one you expanded.
- **The verdict became a status strip** (green/amber band with an icon) instead of a stray coloured
  line. It is the point of the panel, not a footnote.
- **Loading skeleton** shaped like the table it becomes, rather than a line of text.
- **Panel framing** — the whole breakdown now sits in a bordered, rounded container so it reads as
  evidence attached to a figure rather than more table.

**Structural fix:** on the KPI Tracker the breakdown now renders as its own **full-width row**
(`colSpan=4`) beneath its KPI, instead of inside the metric-name cell.

**Two bugs I introduced during this pass and fixed:**
1. Rewriting the stylesheet block wiped the funnel stage-button rules that had been placed just
   above it — every funnel figure rendered as a default white browser button. Restored, and the
   rule now sits before the section marker where a block replace cannot eat it.
2. The verdict icon was invisible: `background: currentColor` alongside `color:` on the same element
   resolves both to the same value, so the tick vanished into its own disc. Now painted from the
   state colour (`.ok`/`.warn`), verified in both variants.

**Verified in the browser:** Overview funnel and KPI Tracker, both variants of the verdict strip —
green `✓ This matches the 778 shown above`, and amber `! The figure above reads 1,549, which is 11
higher … that is the funnel floor described above, not a discrepancy`. No console errors.

### Funnel alignment — and a silent regression I had introduced

Margot's screenshot showed the Lead Conversion Funnel with its numbers out of line and the arrows
floating. Measuring the live layout (rather than reading the CSS) turned up **three** faults, two of
them mine from making the figures clickable:

1. **The figures had been rendering at 14px instead of 24px.** My button reset used
   `font: inherit` — a *shorthand*, so it reset `font-size` and `font-weight` to the inherited body
   values and silently overrode the `24px/800` that `.stage-val` sets. Every traceable funnel number
   on the Overview had been two-thirds the intended size since that change. Caught by noticing the
   measured value box was 22px wide, far too narrow for "783" at 24px. Now resets only
   `font-family`/`color`.
2. **A `<button>` brought its own defaults** — stretched to fill the column (column flex +
   `align-items: stretch`) and centred its own text, so the number no longer sat under its label and
   the dashed affordance spanned the full stage like a divider rule. Now `justify-self: start`,
   `text-align: left`, shrink-wrapped to the number.
3. **Stages could not share a baseline.** Each stage was its own column flexbox, so when a long
   label wrapped ("QUALIFIED OPPORTUNITIES" plus its 22px eye icon) that stage grew and its number
   dropped ~9px below its neighbours.

**Fixed structurally, not by guessing heights:** `.h-funnel` is now a grid whose three rows
(label / value / extra) are adopted by every stage via `grid-template-rows: subgrid`. Alignment then
holds for any label length at any window width — which per-stage flexbox and a reserved `min-height`
both failed to do.

Two grid subtleties worth remembering:
- Placing the arrow explicitly in the value row made grid **auto-placement avoid it**, pushing the
  auto-placed value into an implicit *second column* (measured: `stageCols: "109px 83px"`) on every
  stage except the last, which has no arrow. Every child now has an explicit `grid-area`, and the
  stage is locked to `grid-template-columns: minmax(0,1fr)`.
- The arrow sits in the value row so it connects the numbers, instead of at the stage's mid-height
  which now falls between label and number.

Also shrank the eye icon inside a funnel caption (22px → 17px) and eased the label letter-spacing, so
long labels no longer wrap at normal widths — alignment survives a wrap now regardless, but it
should not wrap in the first place.

**Verified by measurement across pages**, not just by eye — Overview (5 stages, 2 rows), Email
(6 stages) and Outreach (5 stages, 3 rows incl. `extra`): every value box shares an identical `top`,
every value's left edge matches its label's to the pixel, and every figure computes to 24px/800.

---

## 8 Sep — "Where does this number come from?" on every KPI Tracker row

Margot wanted this on **every** number, not the 10 it launched with. Measured against the live
register: **71 rows — 10 traceable, 32 live but not, 29 genuinely without a data source.**

They were not all the same shape, which is why one registry entry per metric was not enough. Four
new kinds now cover them:

| Kind | What it does | Rows |
|---|---|---|
| channel-scoped sums | same fact columns, scoped as the channel page scopes them (`channel`, `keys`, `excludeTypes`) | 13 |
| `ratio` | a rate has no rows of its own — resolves both sides and shows `149 ÷ 783 = 19.0%`, each side openable in place | 13 |
| `manual` | the source is a **person**: shows the value, who set it and when | 6 |
| `distinct` | outreach meetings/deals are deduplicated by key before counting — one row per attendee in Salesforce, one deal across several sequences | 5 |
| `growth` | quarter against quarter, with this quarter's sessions openable | 1 |
| `events` | GoToWebinar **plus** the in-person attendee lists, the same union the headline uses | 2 |

**Result: 42 of 42 live rows traceable, 0 missing.** The other 29 have no data source at all, which
the register already states on the row.

### Verified by opening all 42 and reading each verdict
**22 foot exactly · 13 rates · 6 hand-entered · 0 gaps.** Two real bugs surfaced only by doing this:

1. **`Influenced pipeline (outbound)` was under-reporting by €31,673.92.** The register's figure is
   open **plus** won (a deal that closed was still influenced) and I had measured only the open side
   — the same mistake as the Overall influenced pipeline, in a different metric. Added an
   `openPlusWon` measure. It now foots.
2. **`d?.groups.length` crashed the entire register.** Optional chaining guards only `d`, not
   `groups` — and a rate/manual/growth result has no `groups` at all, so opening any rate blanked
   the whole page. Every level of that traversal is now guarded, because a component rendered 42
   times must not be able to take the app down.

Also: opening all 42 at once could leave one query briefly settled with no data and render an empty
panel; silence reads as a bug, so there is now a fallback line. And the leaf column is labelled from
the metric (`Step`, `Sequence ID`, `Created`) rather than always "Date".

### Notes worth keeping in the UI
Each metric carries its own caveat, shown inside the panel rather than hidden:
- Outreach figures are a **lifetime cadence snapshot** — the quarter pill does not narrow them.
- Outreach meetings/deals are **counted once**, so per-sequence rows can add to more than the total.
- In-person attendance is region-scoped only, so it is not narrowed by the quarter pill either.
- The funnel floor can lift any MQL-type figure above its own rows.

---

## 8 Sep — "How every number is calculated" report + a claude.ai prompt

Margot asked for a report explaining how each dashboard figure is worked out, or a prompt she could
run against Supabase from claude.ai herself.

### The report is GENERATED, not written
`scripts/build_calculation_report.mjs` reads `metricSources.js` (source, columns, scoping, caveats)
and `methodology.js` (the client-facing explanation) and emits
**`docs/kpi/HOW_EVERY_NUMBER_IS_CALCULATED.md`** — 615 lines covering all **69 registered figures**,
grouped in KPI Tracker order. A hand-written version would have drifted from the code within a week;
this one cannot describe a calculation the dashboard is not performing. Re-run it after any change
to how a figure is calculated.

It names the SYSTEM and the FIELD ("Salesforce campaign responders"), never the warehouse table, and
opens with the five rules that account for essentially every discrepancy — gross profit vs revenue,
influenced pipeline being open *plus* won, the funnel floor, the date cap, and region overrides —
plus the two Outreach-specific ones (lifetime snapshot; distinct counting).

### Dated appendix
Live values appended for Q3 and year-to-date (MQLs 783 / 1,554 · influenced pipeline €185,684.90 /
€1,193,320.52 · closed-won €120,134.90 / €568,192.61), used to *demonstrate* two of the rules rather
than just assert them: closed-won sitting inside influenced pipeline (€120,134.90 of the €185,684.90
is already won), and why Q3 closed-won value equals Q3 influenced margin exactly (own-services deals
where gross profit equals deal value) while the year-to-date figures diverge.

### The prompt, with a warning attached
**`docs/kpi/CLAUDE_AI_PROMPT.md`.** A connector can read the data but not the dashboard's rules, so
asking it "how is each number calculated?" cold yields a confident wrong answer — worse than none,
because it looks authoritative. The prompt therefore carries the rules with it: scope, which view
each figure comes from, the six calculation rules, and the traps (read `linkedin_campaign_2026` not
`fact_channel_daily`; count DISTINCT meeting/opp keys; cap at today).

It closes with a differential-diagnosis table — "its money is higher → it summed revenue"; "its
pipeline is lower → it left out won deals" — and the instruction that a difference *not* on that list
is worth reporting, because it may be a real fault in the dashboard.

### Composition appendix — every campaign behind every figure

Margot then asked to *see* the campaigns, not just the method. The report now carries a full
composition appendix for Q3 2026, all regions (740 lines total):

- **26 Salesforce campaigns** with their MQLs, SQLs, opportunities created, wins, pipeline and
  closed-won — footing exactly to 783 / 149 / 17 / 5 / €185,684.89 / €120,134.89.
- **3 LinkedIn Ads campaigns** (162,302 impressions / 1,490 clicks), **3 company-page regions**
  (45,699 impressions, 1,571 engagements, 54 net new followers → 3.44% engagement rate),
  **2 in-person events** (118 registered / 59 attended → 50.0%), and the **3 outreach workstreams**
  across 121 sequences (976 prospects; 2,293 delivered → 60.1% open, 6.2% CTR, 0.61% opt-out).

Each table states its total, and the prose points out the three things the numbers demonstrate:
MQLs being 72% one campaign, closed-won sitting *inside* pipeline (with the €65,550 still-open
balance itemised), and five campaigns showing revenue with zero MQLs — expected for in-person
events, where deals attach to the campaign without attendees being logged as responders.

### A gotcha I proved on myself
Building the outreach table, my first query returned **1,483 emails delivered instead of 2,293 —
35% low**. Cause: the "Historic Data Reactivation" workstream's sequences are **not named** that;
they begin *"CWSI Secure … Outbound"*. Filtering on the workstream label silently dropped 65 of the
121 sequences. `isMarketingSequence` tests three name prefixes, and only the name prefixes work.

Written into the report as a worked warning, and added to `CLAUDE_AI_PROMPT.md` — both the rule and
a diagnosis row ("outreach engagement ~⅓ low → filtered on the workstream label"). Exactly the class
of error that prompt doc exists to prevent, so having tripped it myself is worth recording.

### All periods: generated, not hand-written

Margot then wanted the composition for **Q1, Q2, Q3 and year-to-date**, not just Q3. Hand-assembling
four periods was the wrong tool and I proved it twice — one ad-hoc query under-counted outreach by
35% (the workstream-label trap), a second silently dropped every money row (Q3 pipeline showing
€0.00 where the verified figure is €185,684.89). Two wrong results from someone who knows the schema
is a clear signal to stop hand-writing.

**Built as an export instead:** `src/data/compositionReport.js` → *Export → Campaigns Behind Every
Number*. It loops 28 reported figures × 4 periods through **`getMetricSource()` — the same function
behind each "Where does this number come from?" panel** — so the report cannot disagree with the
screen, and regenerates on demand rather than going stale.

**Verified end to end in the browser:** 112 sections, **1,949 table rows**, 5 genuinely-empty
periods, **0 failures**. And the periods reconcile:
- MQLs 109 + 662 + 784 = **1,555 = year-to-date**
- Influenced pipeline €364,058.72 + €643,576.90 + €185,684.90 = **€1,193,320.52 = year-to-date**

The report states two things readers would otherwise trip over: a campaign only appears in a period
where it contributed something, and year-to-date is not always the sum of quarters because money is
dated by the deal. Outreach figures show the *same* value in every period, correctly — they are a
lifetime snapshot, and each metric's own note says so.

The hand-built Q3 appendix in `HOW_EVERY_NUMBER_IS_CALCULATED.md` is retained but relabelled as a
worked example, pointing at the export for all periods.

### Everything in one report

Margot: *"I want everything in one report."* The methodology document and the composition export were
two separate things; they are now one.

**Export → Full Calculation & Composition Report.** For every one of the **69 registered figures**:
where it comes from in plain English, exactly how it is calculated, what it means, why it might not
tie — and then **every contributing campaign, event, sequence and page across Q1, Q2, Q3 and the
year to date**, each table stating its own total. It opens with an **At a glance** table putting
every figure across all four periods on one page.

Verified by generating it in the browser: **3,650 lines, 215KB, 107 composition tables, 0 failures.**
The at-a-glance figures reconcile (MQLs 109 / 662 / 784 → 1,555 YTD; influenced pipeline
€364,058.72 / €643,576.90 / €185,684.90 → €1,193,320.52 YTD).

Each kind of figure gets the treatment that actually fits it, rather than a records table forced on
everything: rates get a per-period `result = numerator ÷ denominator` table; hand-entered measures
get value, target, who set it and when; growth gets this period against the prior one; sums get the
full contributing-record tables.

### Shared prose, so two documents cannot disagree
`src/data/metricNarrative.js` now holds the source labels, field names, section order and the
`describeSource` / `describeCalculation` helpers. Both the in-app report and the offline Node
generator import it — I had first duplicated all of it into the script, which is exactly the drift
this whole line of work exists to prevent.

### Performance was a real fault, not just slowness
Sequentially the report made ~280 round trips and **timed out**. Two fixes: memoising per
(figure, period) so a rate does not refetch sides that are themselves figures in the report — most
are — and a bounded pool of 6 instead of one-at-a-time. Now **48 seconds**. Since a silent minute
reads as a hang, the dialog button reports progress as a percentage.

### The report as a file — and a real bug it exposed

Asked for the report as an actual markdown file, I generated it from the app (69 figures × 4 periods,
**3,649 lines / 217KB / 107 footed tables**) and routed it through the browser's own download so the
text never had to pass through the conversation.

**Reviewing the output caught a genuine fault in my own registry.** Two figures contradicted the
dashboard:

| Figure | Report said | Dashboard shows |
|---|---|---|
| Q1 SQLs | 17 | **31** |
| Q1 SQL → Closed/Won | 94.1% | **51.6%** |
| Website SQL → Closed/Won (YTD) | **150%** — impossible | **30.0%** |

Cause: funnel stages are dated by different events (leads by lead date, SQL/opp/won by
opportunity/close date), so the dashboard shows each stage as at least as large as the next — the
monotonic floor. My registry summed the raw column, which is the correct *composition* but not the
*displayed figure*. A rate then divided two raw sums and could exceed 100%.

**Fixed** with a `floorOver` declaration on the nine affected metrics naming the columns the floor
maxes over. `getMetricSource` now returns both `total` (the records) and `displayedTotal` (what the
screen shows); rates divide the displayed figures, and the report quotes the displayed figure while
stating the record sum separately wherever the two differ. Verified in SQL: 17 → 31, 94.1% → 51.6%,
150% → 30.0%.

**The already-generated file was withdrawn rather than shipped.** It holds the pre-fix numbers, so it
is renamed `.SUPERSEDED.md` and `docs/kpi/README.md` now says plainly what was wrong with it, that it
must not be sent, and how to regenerate (Export → Full Calculation & Composition Report, ~45s). The
browser extension disconnected before I could regenerate, so the corrected file is one click away
rather than in the repo.

A file of wrong figures in `docs/` is worse than no file — someone eventually sends it.

### Report installed and verified

`docs/kpi/FULL_REPORT_EVERY_NUMBER_TRACED.md` — 3,657 lines / 218KB, 69 figures × 4 periods,
107 footed composition tables.

The first two attempts were both stale builds and were caught by checking rather than trusting the
filename: one was the composition-only version (2,788 lines, no methodology), and both predated the
funnel-floor fix. The Vite dynamic-import cache meant a normal reload kept serving the old module —
a hard reload was needed.

**Verified against the checklist**, all four fixed figures now correct:

| Check | Result |
|---|---|
| At-a-glance section | present |
| Methodology blocks | 69 |
| Q1 SQLs | **31** (was 17) |
| Q1 SQL → Closed/Won | **51.6%** (was 94.1%) |
| Website SQL → Closed/Won YTD | **28.6%** (was an impossible 150%) |
| Any rate above 100% | none |

The floor explanation fires exactly once — on Q1 SQLs, where the dashboard shows 31 while the
records add to 17 — and states why rather than leaving a reader to spot the difference. That is the
only figure in the whole report where the two legitimately diverge.

`docs/kpi/README.md` carries the regeneration steps and the four-point checklist, so the next person
can confirm a fresh copy without re-deriving any of this. The two withdrawn copies sit in
`docs/kpi/_prefix-copies/` with a note naming the wrong figures.

---

## 18 Sep 2026 — Margot's three points on the report notes: one real basis change, two wrong notes

She opened the generated calculation report, read the rules on pages 1–2, and stopped before
reviewing any figure: *"some of the calculations appear to be based on assumptions that don't align
with what I previously requested."* All three points were checked against the ingestion code and the
live store before anything was changed. **One was a real defect on our side; two were notes
describing behaviour that isn't happening.**

### Point 1 — closed-won was still on revenue. She was right, and we had logged it as done.
Her 20 Aug instruction was explicit — *"total pipeline created AND the amount closed, both on gross
margin"* — and item 47 was recorded **Done**. It was done on Campaigns, Events, Email, SEO and the
channel pages and left on revenue on Overview, Pipeline and Pipeline-by-Source. The 24 Aug
cross-reference pass caught the split and fixed six render sites, but never rebased the underlying
measure: `funnelOf` still returned `closedWon = Σ closed_won_value`. **Second time a status table
said Done on something partly done.**

**Now gross profit everywhere**, changed at the aggregation source rather than per page so it cannot
drift apart again: `funnelOf` plus all eleven group aggregators return gross profit as `closedWon`
and keep `closedWonRevenue` for the labelled secondary. Verified against Salesforce: **36 of 36 won
2026 deals carry a Gross Profit Value**, so nothing drops out — €570,704.61 revenue →
**€528,795.30 gross profit**.

Also rebased, because leaving them would recreate the same split-basis complaint: the Overview
per-channel panel (was plotting a revenue pipeline bar beside a gross-profit closed-won bar, and
scaling both off the revenue maximum), and the two LinkedIn paid ROI figures.

**The duplicate this creates is resolved, not shipped.** Closed-won on gross profit is the same 36
deals on the same field as Influenced Margin, so the two are now one number. Her own 11 Aug words
settle which way to collapse it — *"I wouldn't expect Influenced Margin to be higher than the value
of the associated Closed Won deals"* — she already reads Influenced Margin as the margin **of** the
closed-won deals. The Overview shows one tile, *Closed-Won (gross profit)*, with the revenue basis
beneath it; it keeps scoring against the `influencedMargin` target, which is the target for exactly
that measure. The named Influenced Margin row stays in the KPI Tracker, because her own KPI metric
set lists it.

**Deliberately left on revenue:** the Outreach outbound row on the Pipeline page. Those deals are
matched by contact, not by Salesforce campaign, so only **8 of 138** are in the campaign-linked
opportunity feed that carries Gross Profit. Converting it would have dropped 94% of the deals. It
now carries a chip explaining exactly that, rather than being a second unexplained exception.

### Point 3 — MQL *is* campaign members. The note blamed the wrong cause, and there was a real leak.
The ingestion does what she asked: `HasResponded !== true → continue`, then `leads += 1; mql_count
+= 1`. One MQL per responded campaign member.

The note blamed the funnel floor. **The floor does not lift MQL at all** in the live data (Q1 +0,
Q2 +0, Q3 +0). The actual gap was **+11 in Q2**, and it was **LinkedIn lead-gen form leads** —
NCSE 8, CSOC UK Event 2, CWSI & MSFT AI Webinar 1 — which arrive from the LinkedIn Ads export
carrying `leads` with no `mql_count`, and `funnelOf` did `mql = max(leadsRaw, mqlRaw, sql)`. They are
not Salesforce campaign members, so they broke the Salesforce reconciliation she needs, and they
carry a double-count risk: the same person may also be a member of the corresponding SF campaign.

**Fixed** — `leadsRaw` is out of the floor; MQL is now `max(mql_count, sql)`. YTD **1,618 → 1,607,
exactly the campaign member count.** The form leads remain reported on the LinkedIn page, where they
drive cost per form lead. `METRIC_SOURCES.totalMqls` moved from `leads` to `mql_count` to match.

The floor *is* real — it bites on **SQLs** (Q1 raw 17 → displayed 28, lifted to the qualified
opportunity count). The rule now says that instead.

### Outreach — the note described a dataset she never sees
*"Because one meeting can be attributed to several sequences, the per-sequence rows can add to more
than the total."* Measured across the three marketing workstreams: **5 meetings, 0 on more than one
sequence; 138 opportunities, 0 on more than one sequence.** The de-duplication is a safety net that
has never fired on anything visible. The 124-of-273 duplication that motivated the note exists only
in the all-sequences set including sales sequences, which the page excludes.

Her premise checks out too: of 10,332 prospects ever enrolled, 88 (0.85%) were in more than one
sequence, and only **one** had overlapping enrolment dates — the rest were sequential re-enrolments.

### The notes were duplicated, which is how they drifted
`PREAMBLE_RULES` lives in `metricNarrative.js`, and `scripts/build_calculation_report.mjs` carried
its **own hardcoded copy**, already worded differently. The 8 Sep entry claims this prose was
unified; the per-figure tables were, the rules were not. The script now imports the constant, so
correcting a rule in one place corrects both documents. All five rules rewritten, plus both Outreach
bullets and the shared funnel-floor note.

### Still open — raised with her, not silently changed
Responders are dated by `CampaignMember.CreatedDate`, not `FirstRespondedDate`. We pull
FirstRespondedDate and use it only in `Build Contact Response Rows`. If she filters Salesforce
campaign members by responded date, quarter splits can differ — most likely on events, where people
are added to a campaign in one quarter and register in the next. It cannot be sized from the
warehouse (we do not store it at member grain); it needs one ingestion change plus a re-run.

### Report regenerated and installed (same day)
`docs/kpi/FULL_REPORT_EVERY_NUMBER_TRACED.md` — 3,707 lines, 69 figures × 4 periods. Verified
against the checklist: corrected rule 1, corrected Outreach note, closed-won labelled gross profit,
MQLs 1,607 and closed-won €528,795.30 tying to the store to the cent, no rate above 100%.

The copy the client actually read is preserved as
`_prefix-copies/FULL_REPORT_EVERY_NUMBER_TRACED.2026-09-08-AS-READ-BY-CLIENT.md`, with its three
wrong statements listed in `DO_NOT_SEND.md` — the record of what she was looking at when she wrote.
`docs/kpi/README.md`'s verification table was also stale (it still named Q1 SQLs = 31 as the marker,
which would now reject a good file); it is rebuilt around the label and rules text, which are stable
version markers, rather than figures that move as data lands.

---

## 18 Sep 2026 — the organic-traffic KPI was reporting a 32% fall during a 68% rise

Spotted while reading the regenerated report: *Organic traffic growth vs prior quarter* read
**−31.9%** for Q3. The arithmetic was right and both inputs were wrong.

### Cause 1 — the GA4 sessions feed had been dead for 33 days
`fact_web_daily` last loaded **16 Aug 20:27**; nothing since. So the figure was dividing Q3's
**47 days** of data by Q2's **90**, and reporting the missing six weeks as a decline in traffic.

On matched days — Q3's 1 Jul–16 Aug against Q2's 1 Apr–17 May — traffic was **+67.9%** (9,911 vs
5,902). We were reporting a third down during two-thirds up.

**The diagnosis came from the sibling feed:** `ga4_page_ingest` had run that same morning at 04:21,
1 day fresh, on the same GA4 property and credential, scheduled 20 minutes after `GA4_ingest`. That
ruled out Google auth, quota and property access in one step and put the fault in the workflow
itself. Its last write was also at 20:27 rather than the scheduled 05:00, i.e. a manual run — the
schedule had probably been off for longer than the data gap showed.

Re-run by the client the same day: `fact_web_daily` now carries data **to 18 Sep**, loaded 12:19.
Q3 becomes 15,905 sessions and the KPI moves from **−31.9% to +10.9%**.

### Cause 2 — the metric has no partial-period guard, and this one is still open
`getOrganicTrafficGrowth` divides two raw quarter totals with no check that the periods are
comparable. Even with a live feed Q3 is **80 days against Q2's 90**, so the reported +10.9%
understates a true per-day rate of **+24.8%**. **This metric reports a decline, or an understated
rise, for most of every quarter by construction** — and it is one of the reforecast KPIs, so it is
scored against a client target. Fix not yet built; options are matched elapsed days (preferred,
keeps the KPI usable mid-quarter) or suppressing it with a stated reason while a quarter is open.

### Worth recording: we had already explained this figure away
The 2 Sep entry reads *"Q3 −31.9% … The Q3 fall is expected — the narrative treats Q3 as the
post-launch reset quarter."* The figure was identical on 2 Sep and 18 Sep, which was itself the tell
that the feed had stopped. Instead a business story was attached to it. That is the same failure as
the notes that triggered this whole round: a plausible caveat wrapped around something simply
broken. **An unchanged figure across two weeks is a freshness check, not a trend.**

### Feed audit (run because nobody had looked at the Settings freshness panel)
Current after the re-run, excluding the two feeds that are maintained by hand (marketing budget,
LinkedIn page analytics):

| Feed | Latest data | State |
|---|---|---|
| Salesforce — channel, opportunity, meeting | loaded today 12:05 | current (hourly) |
| GA4 sessions | 18 Sep, loaded 12:19 | **fixed today** |
| GA4 pages | 17 Sep, loaded 04:21 | current |
| Search Console — daily + keywords | 15 Sep | current (3-day GSC lag is normal) |
| Pardot / email engagement | **10 Aug** | **39 days stale — `pardot_email_ingestion` needs a run** |

Salesforce being current matters: every figure in the client reply — closed-won €528,795.30,
MQLs 1,607 — was loaded an hour before it was written.

### Consequence for the report — regenerated a second time
The first copy was generated *before* the GA4 re-run, so its web figures were the stale ones
(Q3 9,647 sessions, −31.9%) while every other number in it was current. Regenerated after the
re-run and installed: **3,724 lines**, Q3 organic traffic **15,599** and growth **+10.2%**. All
version markers re-verified (rules text, Outreach note, gross-profit labels) and the commercial
figures unchanged — MQLs 1,607, closed-won €528,795.30.

Noted in `docs/kpi/README.md`: regenerate after any feed re-run, not just after a code change. The
report freezes the warehouse as at generation time and nothing in the file says which feeds were
current when it was built.

---

## 20 Sep 2026 — Margot's reply: the Outreach rule had only ever reached half the metrics

She closed points 1 and 2 ("clear to me, no additional questions") and raised three things about
the remaining items.

### 1. Outreach opportunities — she was right, and it is the same fault as closed-won
*"The number of opportunities linked to Outreach doesn't seem correct. We should only be looking at
opportunities that were created after the relevant marketing emails were sent. I did brief this into
the team a while ago."*

She did, on 20 Aug. It was built for **meetings** (`v_outreach_meetings_v2` filters
`was_emailed AND after_first_touch`) and never for **opportunities** — the third instance this month
of a rule applied at one site and not its twin.

**The reason was structural, not an oversight of attention.** The two were built on different base
tables: meetings on the operational `outreach_prospect` / `outreach_sequence_state` (which carry
`deliver_count`, `bounce_count`, `active_at`), opportunities on `fact_outreach_prospect`, which has
**no delivery data at all** and therefore *cannot express* "was this person emailed". The rule was
unbuildable on that base, so it was never built.

**Fixed** — migration `20260920000000_outreach_opps_after_first_touch`. `v_outreach_attributed_opps`
is rebuilt on the same operational tables the meetings rule uses, so "emailed" and "first touch" now
have ONE definition serving both instead of two that can drift.

Effect, measured on the same base so the rule is isolated from the base change:

| | Opportunities | Open pipeline | Won |
|---|---|---|---|
| Without the rule | 248 | €5,839,945.34 | €702,283.95 |
| **With the rule (now live)** | **49** | **€867,677.43** | **€106,122.00** |

The rule removes **80% of the opportunities and 85% of the pipeline** — deals that already existed
before the prospect was ever emailed, or people who were never emailed at all.

**Note the base change moved the figure too, and in the opposite direction:** the old view's
`fact_outreach_prospect` covered only **36** marketing sequences against the operational tables'
**121**, so it was missing genuine attributions. An earlier estimate of 39 opportunities was computed
on the old base and is superseded by 49 — *better* coverage, then filtered by her rule.

**Non-marketing sequences leave the view** (the operational tables only ever synced the three
marketing workstreams). No user-visible effect: `marketingOnly` defaults to true in both hooks and
nothing passes false — the page has been hard-locked to the three workstreams since 20 Jul. The
toggle in `getOutreach` is dead code and should be removed.

### 2. "Are we only looking at the marketing sequences here?" — yes
| Scope | Opportunities | On more than one sequence |
|---|---|---|
| Marketing workstreams (what the page shows) | 140 | **0** |
| Marketing meetings (what the page shows) | 5 | **0** |
| All sequences incl. sales (never reaches the page) | 276 | **125** |
Nothing to build. Both numbers are worth giving her rather than just the zero.

### 3. Campaign-member dating — she and we mean the same field
*"…based on when they responded to that specific campaign by completing the form associated with it,
rather than using their first responded date."* `CampaignMember.FirstRespondedDate` sits on the
membership record, so it **is** per-campaign — the date this person responded to THIS campaign. Her
instruction and the proposed change are the same thing; only the field name makes it sound
person-level.

`Build Fact Rows` now dates a responder by `FirstRespondedDate`, falling back to `CreatedDate` where
it is blank (backup `.pre-respondeddate-bak`). **Needs one Salesforce re-run**, after which the
before/after shift should be measured before anything is said to her — it moves quarterly splits,
most likely on events where an invite list is loaded in one quarter and registrations land in the
next.

### The basis question this did NOT solve
The Outreach row on the Pipeline page stays on deal value. Fixing the count made the gross-profit
coverage *worse* in proportion, not better: of the 49 deals that pass her rule, exactly **1** is
campaign-linked in Salesforce and carries a Gross Profit Value (€7,042.25) — against 8 of 140 before.
These deals are matched by contact rather than through a campaign, so ~97% have no gross profit in
our store either way. Worth stating plainly to her, because the two issues are easy to conflate and
she may expect fixing the count to fix the basis.

### Same day — the three items left over from the 18 Sep round

**Partial-period guard — BUILT.** `comparableWindow(quarter)` in `queries.js`: while a quarter is
still running, the prior quarter is capped at the **same number of elapsed days** rather than
compared in full. Both filter helpers now honour an optional `maxDate`. Wired into the two places
that divide one period by another:

- **Organic traffic growth** — Q3 (82 days, 16,141 sessions) against Q2's *first 82 days* (12,112)
  rather than its full 14,336: **+12.6% → +33.3%**. The KPI row states the basis on screen
  ("like-for-like over the first 82 days of each quarter, because this one is still running").
- **The board pack** — `trendOf` divides this quarter by the prior one for all seven metrics, so
  mid-quarter every trend arrow pointed down. `getBoardPackData` now caps the prior-quarter read the
  same way and returns `prevComparedOverDays` so the pack can state it.

Returns null when the quarter is complete, so a closed quarter is still compared in full.

**The board pack did have the same flaw** — that was the open question from 18 Sep, now answered: it
does, and it is fixed by the same helper rather than a second implementation.

**Pardot email rates — now traceable.** The three marketing-platform rates (open, click-through,
unsubscribe) were live on the KPI Tracker but had **no entry in the metric registry**, so "42 of 42
live rows traceable" was overstated and they were absent from the report that is supposed to cover
every number. They slipped the net on 8 Sep because the feed was stale that day and the rows were
rendering as *not available*, so they were not counted as live — staleness mistaken for absence,
the same confusion as the GA4 growth figure.

Added a `from: 'aeEmail'` source that reads through **`getAeEmailEngagement` itself** rather than
re-querying `v_ae_email`, so the breakdown is scoped exactly as the figure above it — the quarter
pill selects *campaigns*, not send dates, and a send-date filter is what emptied Q1 in the bug she
reported on 20 Aug. Four base metrics (delivered, unique opens, unique clicks, opt-outs) plus the
three rates, each resolving as `numerator ÷ denominator` with both sides openable.

Report now covers **77 figures, 0 unsectioned** (was 69). Two housekeeping fixes fell out: the rate
labels carry "(marketing email)" because the Outreach section already has an *Open rate* and an
*Unsubscribe rate*, and `closedWonRevenue` — added on 18 Sep — had never been placed in a section.

### Both 20 Sep figure changes are documented as reversible
**`docs/ROLLBACK_20SEP2026.md`** — the undo procedure for each, with the baseline to check against.
The response-date change reverts by restoring `.pre-respondeddate-bak` and re-running (the funnel is
a guarded full-replace, so one run restores it — no data cleanup). The Outreach rule reverts by
applying `20260920000000_outreach_opps_after_first_touch.ROLLBACK.sql`, which holds the previous view
definition captured verbatim — a view swap, no re-ingest, effective immediately.

Both changes move client-visible figures on a client instruction, so the cost of reversing one had
to be known before either went in rather than worked out under pressure afterwards.

### Baseline captured before the response-date re-run (20 Sep)
Dating by `CampaignMember.CreatedDate`, all regions, 2026 to date — compare against this after the
Salesforce re-run to measure what the `FirstRespondedDate` change actually moves:

| Period | MQLs | SQLs | Fact rows |
|---|---|---|---|
| Q1 | 109 | 17 | 136 |
| Q2 | 651 | 171 | 299 |
| Q3 | 849 | 171 | 216 |
| **Year to date** | **1,609** | **359** | **651** |

Expect movement BETWEEN quarters with the year-to-date total roughly stable — a responder only
changes quarter if they were added to the campaign in one and responded in another. A large change
in the YTD total would instead mean `FirstRespondedDate` is sparsely populated and the CreatedDate
fallback is carrying more rows than expected, which is worth knowing before telling the client
anything.

### Result of the response-date re-run (20 Sep, loaded 10:04 UTC) — a NULL RESULT
Dating by `FirstRespondedDate` changes **no reported figure**:

| Period | MQLs | SQLs | Fact rows |
|---|---|---|---|
| Q1 | 109 (=) | 17 (=) | 136 → **133** |
| Q2 | 651 (=) | 171 (=) | 299 (=) |
| Q3 | 849 (=) | 171 (=) | 216 (=) |
| **Year to date** | **1,609 (=)** | **359 (=)** | 651 → **648** |

Read against the criterion set before the run: the year-to-date total holding *exactly* is the good
outcome — it means `FirstRespondedDate` is well populated and the `CreatedDate` fallback is not
quietly carrying rows. No quarter moved, so in this dataset people respond in the same quarter they
are added to a campaign. The three merged Q1 rows are the expected fingerprint: a few members' dates
moved onto an existing campaign × region × date grain and collapsed into it.

**Worth stating to the client as a null result rather than silently:** her instruction is
implemented, it is now the correct basis, and it moves nothing she is looking at. That is a better
answer than an unexplained figure change, and it means this can no longer be a source of
disagreement when she reconciles against Salesforce.

**Caveat on the verification:** the two dates produce identical output on this data, so the
warehouse alone cannot prove the new logic ran — a three-row delta is also consistent with ordinary
hourly Salesforce movement. Confirmation that the updated workflow was imported before the run is
what closes it. Noted so nobody later reads the unchanged figures as evidence the change is live.

---

## 21 Sep 2026 — RLS audit: it was on everywhere, and it was not what was protecting the data

Asked to enable RLS on every table and restrict access to authenticated users. The audit found RLS
**already enabled on all 44 tables**, with **every policy already targeting `authenticated` only**.
Neither fact was doing the work it appeared to.

### What was actually wrong

**1. `anon` held ALL privileges on nine objects** — not just SELECT, but INSERT, UPDATE, DELETE and
TRUNCATE: `fact_email_engagement`, `fact_meeting_daily`, `fact_opportunity_stage`,
`fact_renewal_daily`, and the views `v_email_engagement`, `v_meetings`,
`v_opportunity_stage_current`, `v_retention`, `v_outreach_engagement`.

**2. Every `v_*` view was SECURITY DEFINER** (the Postgres default), so it ran with the owner's
rights and **bypassed RLS on its base tables entirely**.

Those two together are the real finding: **RLS was not the control protecting this database — the
grants were.** Proven live rather than reasoned about, as `anon`:

```
select count(*) from v_outreach_engagement  ->  10,420 rows
```

carrying `prospect_email`, `prospect_company`, `seller_name` and `mailbox_email` — named contacts'
personal data, readable **without logging in**, with the publishable key that ships in the browser
bundle. The other four anon-granted views returned "permission denied" only because they happened to
have been created with `security_invoker` — luck, not design.

### Fixed
- Every `anon` privilege revoked. `anon` now holds **nothing** in `public`.
- **All 31 remaining views set to `security_invoker`**, so RLS is enforced through the read path and
  a future stray grant cannot bypass it.
- Four tables that had RLS on but **no policy** (`fact_web_page_daily`, `linkedin_page_daily`,
  `linkedin_page_post`, `outreach_mailbox`) given an authenticated-read policy. They had been
  reachable only because the views above them bypassed RLS — a direct read would have failed.
- `touch_kpi_targets_updated_at` given a pinned `search_path` (advisor warning).

### The trap worth remembering
`REVOKE EXECUTE ON FUNCTION ... FROM anon` is a **no-op**. Postgres grants EXECUTE to **PUBLIC** by
default, and anon inherits it — so the first revoke reported success while the privilege was still
live, and only a re-check caught it. It needs `FROM PUBLIC`, plus
`ALTER DEFAULT PRIVILEGES ... REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` so new functions do not
inherit it again. `get_seo_top_queries` was the only function already revoked from PUBLIC, and that
inconsistency is what made it visible.

### Verified — nothing broken
The `security_invoker` flip was trialled **inside a rolled-back transaction** before being applied.
After the change, as `authenticated`: **36 of 36 pass** — all 33 tables and views the dashboard
reads, plus all three RPCs. The three write paths (`kpi_targets`, `kpi_manual`,
`campaign_overrides`) were confirmed still updatable.

Final state: 0 tables without RLS · 0 views bypassing RLS · 0 objects anon can touch · 0 functions
anon can execute · 0 policies not restricted to authenticated.

Migration: `supabase/migrations/20260921000000_lock_down_anon_and_complete_rls.sql`.

**Still open (Supabase Auth setting, not SQL):** leaked-password protection is disabled — the
advisor flags it, and it is a toggle in the Auth dashboard. Worth turning on given sign-ups are
closed and the user set is small. The three `_bak_20260813_*` tables have RLS on and no policy or
grants, which is correct for backups — they are deliberately unreachable.

---

## 21 Sep 2026 — Outreach money moves to gross profit: the last exception on the dashboard

The 20 Sep note said the Outreach row had to stay on deal value because only 1 of the 49 attributed
deals was campaign-linked and carried a Gross Profit Value. That was an accurate description of the
data and the **wrong conclusion** — the limitation was our own ingestion, not Salesforce.

**Why the gross profit was missing.** `fact_opportunity` is built from `WHERE CampaignId != null`,
i.e. deals with a Primary Campaign Source. Outreach deals are matched by **contact**, so they mostly
have no campaign and never entered that feed. The gross profit existed in Salesforce the whole time;
we simply were not asking for it on the feed that holds these deals.

**Fixed at source.** `opp_contacts_ingestion` now selects `Gross_Profit_Value__c` and
`Gross_Profit_Margin__c` and derives `margin_eur` with the same rule used everywhere else — gross
profit value, else Amount × margin %, else NULL, **never inferred from Amount**. Migration
`20260921000001_opp_contact_gross_profit` adds the column and re-exposes it through
`v_outreach_attributed_opps` (security_invoker, anon revoked). Backup: `.pre-margin-bak`.

The Outreach tiers now sum gross profit, keep revenue as `pipelineRevenue` / `wonRevenue` for the
labelled secondary, and carry `gpKnownOpps` / `gpPendingOpps` so coverage can be stated.

**The false-zero guard matters more than the change.** Until the feed re-runs, every `margin_eur`
is NULL, so a naive sum would have rendered a confident **€0** on a row that genuinely holds
€1,732,841.69 of deals. `sumTier` now returns NA when not one deal in scope carries a gross profit,
and both render sites guard it, so the page shows "—" rather than a fabricated zero. Falling back to
revenue was rejected: that is precisely the silent basis mix the client raised in the first place.

**Needs one re-run: `opp_contacts_ingestion`** (import the updated workflow first). Until then the
Outreach money cells read "—" by design. Current state verified: 49 opportunities, 0 with gross
profit, €1,732,841.69 of revenue waiting behind them.

This closes the last "why has an exception been made here" on the dashboard — the sentence that
started this whole round of feedback.

### Outreach gross profit — ingested, and a defect I introduced fixing it
Re-run complete. Coverage on the contact-matched deals went from **1 of 49 to 47 of 49 (95.9%)**;
the two without a gross profit in Salesforce are excluded from the sum, never counted at full value.

| Outreach (outbound prospecting) | Q2 | Q3 | Year to date |
|---|---|---|---|
| Influenced pipeline (gross profit) | €154,987.93 | €278,670.60 | **€433,658.53** |
| Closed-won (gross profit) | €45,247.08 | €9,458.31 | **€54,705.39** |
| The same on revenue | — | — | €973,799.43 |

**Worth telling the client:** outreach runs a **45% margin** against roughly 92% on campaign-linked
deals — these are far more resold-product heavy. That gap is exactly what the gross-profit basis
exists to show, and it only becomes visible now the figure is on that basis.

**The defect, recorded because it is the same one the client keeps finding.** The first pass moved
the Outreach money to gross profit on the PAGE and left `getMetricSource`'s `outreachOppRows` path
on `amount_eur`. That path feeds the report and every "where does this number come from" panel, so
the regenerated report still printed €973,799.43 while the page showed gross profit. One site, not
its twin — the fourth instance this month, and the first one I caused rather than found. Caught by
checking the regenerated report against SQL rather than trusting that the change had landed.

Fixed; the fourth regeneration verified against independently-computed SQL and matching to the cent.
The pre-fix copy is archived in `_prefix-copies/` with a note.

**The lesson worth carrying:** when a basis changes, grep for every path that reads the underlying
column — the page aggregation and the metric registry are two separate readers of the same data, and
fixing one looks complete from the screen.

## 23 Sep 2026 — Margot's comments on the Full Composition Report analysed (nothing built yet)

239 PDF annotations extracted and grouped into 14 issues in `docs/CLIENT_FEEDBACK_MARGOT_23SEP2026.md` (full per-comment appendix included). Verified against live data:
- **Q3 – Legal Always-On Outreach Campaign** = 555 MQLs / 85 SQLs all dated 24 Aug (bulk upload); she wants it excluded → Q3 MQLs 854 → ~299.
- **No CWSI-staff filter** on MQLs/registrants; ≥22 staff responders in 2026 across cwsisecurity.com / cwsi.ie / cwsi.co.uk / cwsi.io.
- **Content/White Paper → Organic SEO** is our mapping rule (~45 comments) → needs its own channel.
- **SQL YTD (359) ≠ sum of quarters (370)** because of the per-period funnel floor; report text claiming counts add up is wrong.
- **"Organic traffic" tile = all channels** (7,947); GA4 channel data itself matches hers within ~1.5%.
- **fact_event_attendance has no date** → attendance can't be quartered; NL events missing.
- Protect Data €88k deal created 13 Jan, before its 22 Apr campaign → lands in Q1.
- Only 24/1,620 YTD MQLs are on pre-2026 campaigns (tables look long, volume tiny).
8 decisions pending from Margot (listed in the doc) before the build.

### 23 Sep 2026 — first build pass on the Composition Report feedback
Done (details + status table in `docs/CLIENT_FEEDBACK_MARGOT_23SEP2026.md` → "Build status"):
campaign exclusions + channel/type overrides in the views (live, no re-ingest), whitepaper/webinar
split in report + KPI Tracker, per-quarter funnel floor (YTD = Σ quarters), GA4 conversions hidden,
dated attendance, Outreach report layout, LinkedIn market labels. Migrations `20260923000000..02`.
**n8n still to do:** re-import `salesforce_ingestion.json` (staff filter) and
`pardot_event_attendance_ingestion.json` (event_date), run both. Blocked: AE automation-email probe.

### 24 Sep 2026 — traced report regenerated, verified and installed
`docs/kpi/FULL_REPORT_EVERY_NUMBER_TRACED.md` replaced with the 24 Sep export (previous copy in
`docs/kpi/_prefix-copies/…2026-09-21.md`). Verified: YTD = Σ quarters on every count/money row
(MQLs 92+610+287 = 989), CWSI-staff filter in, 0 hits for the 13 excluded campaigns, 0 whitepapers
under Organic SEO, no influenced-margin section, in-person vs webinar attendance split (in-person Q1
empty, Q2 118 / Q3 38 registrants at 50–53%; webinars 196 / 275 / 90). Found while verifying and
fixed: attendance mixed webinars into Events, floored website figure printed "a genuine zero", stale
preamble rules. Q3 influenced pipeline €422,926 vs €246,401 in her PDF = one new Salesforce deal
(Samsung SDS managed service, €176,525, Negotiation, on 2023 Website Leads).
Comment responses: `docs/MARGOT_23SEP_COMMENT_RESPONSES.md` (238 comments, 35 topics).
- 24 Sep: report now ends with **"Your FY26 quarterly KPI targets"** — her 42-row sheet in order, targets read live from
  kpi_targets / kpi_manual, status per KPI (34 on dashboard = 28 automatic + 6 by hand; 2 loaded but hidden = GA4
  conversions; 6 not yet, each with what is needed). Source list: `src/data/kpiSheetCoverage.js` (renderer lives there
  too, pure, so it can be rendered offline). Replaces the vague "Figures the dashboard cannot yet report" note.
  Installed copy patched to match; regenerating produces the same section.
- 24 Sep: **AE automation-email probe 1 run.** Bridge works (E7 SF 701Tm00000az9RSIAY → AE campaign 283376;
  E3/E5 701Tm00000dllI0IAI → 289875). 18 drip templates found (E7: 57155/57158/57161 + NL 57218/57221/57224;
  E3/E5: 58668–58701, NL/UKI/BeLux × 4). Visitor activities DO carry these campaigns (3 of the latest 1,000 rows:
  2 Email, 1 Email Tracker). `emails` object latest-1,000 window held none of them. Next:
  `workflows/pardot_automation_email_probe_2.json` tests which filters (campaignId / emailTemplateId / type /
  createdAt, plus v4 query) the API honours, to decide the ingestion design.
- 24 Sep: **probe 2 run.** v5 rejects campaignId/emailTemplateId filters (emails + visitor-activities: "Invalid
  parameter"); v5 `type`/`createdAtAfterOrEqualTo` return everything (~1 day per 1,000 rows — unusable). **v4
  `visitorActivity/do/query?campaign_id=` filters correctly** (200/200 E7 rows) and each send carries
  `list_email_id` + `email_template_id`. ES programs: E7 UKI 34211 / NL 34223; E3 NL 35160 / UKI 35166 / BeLux 35172
  (all "paused" = finished). Probe 3 (`pardot_automation_email_probe_3.json`) tests v4 stats on a list_email_id and
  sizes activity volume per campaign/type.
- 24 Sep: **probe 3 run — route confirmed.** v4 `email/do/stats/id/{list_email_id}` works on an automated send
  (NL E7 Email 1: sent 1,018 · delivered 981 · unique opens 271 · unique clicks 22 · opt-outs 11). Volumes since
  1 Jan (activity counts): E7 sent 30,455 / opens 6,873 / clicks 4,501 / unsubs 77 / bounces 203; E3/E5 sent
  48,577 / 12,554 / 5,220 / 59 / 70. Built `workflows/pardot_automation_email_ingestion.json` (v4 activity pages by
  campaign → distinct list_email_id → v4 stats → upsert fact_ae_email, campaign_key = SF id). App fix: Email page
  + engagement now read each email's latest snapshot instead of one global snapshot date (two feeds, two schedules).
- 24 Sep: **automated-email feed run and verified.** 18 emails in fact_ae_email (E7 6: 30,458 sent / 6,873 opens /
  4,501 clicks / 203 bounces; E3/E5 12: 48,581 / 12,554 / 5,220 / 70) — opens, clicks and bounces equal the AE
  activity counts exactly. Names carry region; send dates put E7 in Q2, E3/E5 in Q3 (the families' quarters).
  Comment register: the 7 "overview incomplete" comments moved to Fixed (174 fixed). Report needs regenerating to
  show the new email engagement figures.

## 25 Sep 2026 — Margot's answers on the decisions (docs/sheets/CWSI_Response_23Sep2026.pdf) + LinkedIn refresh
- **LinkedIn page analytics reloaded** from the 8 exports in `docs/sheets/` (1 Jan–22 Sep, all 3 pages). UKI Q1 now
  29,910 impressions / 1,508 engagements = exactly Margot's spot checks (the old gap was LinkedIn revising its data).
  **UKI followers file missing** (`cwsi_followers_*.xls`) — UKI followers kept from the 22 Aug load (Q1 288 vs her 287).
- **Legal LinkedIn Ads export** (`account_509911190_creative_performance_report`) covers only 26 Aug–24 Sep; campaigns
  started 22/24 Jul → NOT loaded; full-range export requested. (Benelux £445.42 / 621 impr / 2 clicks, budget £1,200;
  UK £712.89 / 2,933 / 19, budget £1,400 + £450.)
- **Decisions:** keep 2023 Website Leads (CWSI will fix opp→campaign links in SF); leave Protect Data as is;
  **qualified opps ⊆ created** → workflow now dates opp_count by CreatedDate + app floor no longer lifts qualified by
  won; **SQL only after the response** → probe `salesforce_status_history_fx_probe.json` (LeadHistory tracked?);
  registrations = SF members excl. CWSI/Microsoft (+ mobco, Blaud) → staff domains extended in the workflow;
  GA4 split OK as is; closed-won target → GP (figures to send her); webinar targets wanted → empty kpi_targets rows
  added; Protect Data: her 6 deals = our 6 deals = €151,121.30 → difference is per-deal value (currency) → probe
  checks convertCurrency / dated rates. NL attendance lists uploaded → re-run attendance workflow.
- Pending: 19.02 webinar registrations from GoToWebinar (her instruction) — not yet built.
- 25 Sep: **UKI followers export received and loaded** (`cwsi_followers_1790253642803.xls`). All three LinkedIn pages
  complete 1 Jan–22 Sep. Margot's UKI Q1 spot checks now match exactly: impressions 29,910, engagements 1,508,
  followers 287 (were 29,915 / 1,506 / 288 from the 22 Aug load — LinkedIn revised its data).
- 25 Sep: **Salesforce probe run — two findings.**
  (1) **Currency bug found and fixed (workflows, needs n8n):** Salesforce converts opportunities with DATED rates
  (GBP 0.86, USD 1.14 per EUR; ACM on). Our feeds read static `CurrencyType`, whose GBP = 1.16 (entered inverted) →
  every GBP deal understated ~26% (1.16/0.86); USD off slightly (1.136 vs 1.14). Using SF's `convertCurrency` values,
  Margot's six Protect Data deals sum to exactly €167,859.03 (her figure); Agent 365 deal = €43,859.65 (hers).
  Several "UK" deals are actually USD (TLT $100k, Forsters/Avidity $8k). Fix: "SF: Get Currency Rates" in
  `salesforce_ingestion` + `opp_contacts_ingestion` now reads `DatedConversionRate` for the period covering today
  (all 2026 dates are in one period). Code unchanged (same field names). Backups `*.pre-datedfx-bak`.
  (2) **LeadHistory (Status) returns 0 rows** → status history not tracked, so "SQL only after the response" cannot
  be applied to past data. CWSI action: enable field history tracking on Lead Status; rule can apply from then on.
- 25 Sep: attendance re-run loaded **CWSI @ The Movies** (70 registered / 61 attended, 18 Jun) but NOT the Dutch
  E7-suite events. Cause, from the AE list catalogue: (a) the 15.09 NL Non-Attendees name is truncated at AE's
  100-char limit ("…Public Sect") so the pair split; (b) both 16.09 lists are typed "16.09.206", read as year 206 →
  filtered as outside 2026. Parser fixed in `pardot_event_attendance_ingestion.json` (live-cred copy; backup
  `.pre-namefix-bak`): `fixYear()` maps 3-digit "20x" → "202x"; a name that is a prefix of another list's name for the
  same date + region adopts the longer name. Offline test on the real names: both NL pairs now match (15.09, 16.09).
- 25 Sep: **all three workflows re-run and verified.** Dated FX live: Protect Data campaign = €167,859.04
  (Margot €167,859.03, 1c rounding); Agent 365 = €43,859.65 (exact). Staff filter now incl. Microsoft/mobco/Blaud;
  qualified ⊆ created in every quarter (Q1 24/45, Q2 24/40, Q3 9/28). Dutch E7 events loaded (15.09 Public 15/6,
  16.09 Private 29/21) + CWSI @ The Movies 70/61. Totals vs the 24 Sep report: influenced pipeline YTD
  €1,387,369 → €1,417,160 (+2.1%), closed-won GP €457,560 → €463,555 (+1.3%), MQLs 989 → 994 (exclusions offset by
  new September responses). FX effect small because most "UK" deals are priced in USD, not GBP.
  Traced report needs regenerating before it goes to Margot.
- 25 Sep: **19 Feb webinar registrations from GoToWebinar** (Margot's instruction): `GTW_REGISTRATION_OVERRIDES`
  in queries.js; `getChannel` totals gain `registrations` (Salesforce members, override webinars swapped for GTW
  registrants, quarter/region/cap scoped); KPI Tracker webinar registrations + report breakdown
  (`gtwRegistrations` spec flag) use it. Q1 webinar registrations 71 → 193 (9 SF → 131 GTW). Build ✓.
- 25 Sep: **comment-response doc rebuilt with her 24 Sep answers**: Fixed 191 · Updated 11 · Explained 17 ·
  Needs decision 1 (growth since start of year) · CWSI action 18 (opportunity campaign review, Lead Status history,
  Legal export from 22 Jul). Summary adds the closed-won target basis question and webinar targets.

## 28 Sep 2026 — documentation
- **`docs/DATA_SOURCES.md`** (new): every source → what is collected → verbatim SOQL / endpoint → schedule →
  target table → ingestion rules → freshness; page-to-source map; known gaps. Built from a full read of all 37
  workflows + the live DB.
- **`docs/CONTEXT.md`** (new): project, people, timeline, architecture, collection, DB layers, dashboard logic,
  current metric definitions, reports/exports, security, feedback rounds + decisions, n8n schedule, open items.
- `CWSI_Data_Source_Report.md` and `CWSI_Dashboard_DataSource_Mapping.md` marked superseded.
- Found while documenting: Outreach feeds last loaded 3 Sep, GoToWebinar 3 Aug (schedules to check);
  `search_console_ingest` labelled 05:15 but runs 05:00; exported `pardot_email_ingestion` / budget / GoToWebinar
  files carry placeholder or unbound credentials (the live n8n copies are what run); Outreach region code 'UK&I' in
  `outreach_sequence` vs 'UKI' elsewhere.
