-- Outreach-attributed opportunities: apply the client's causality rule.
--
-- Margot, 19 Sep 2026: "The number of opportunities linked to Outreach doesn't seem correct.
-- We should only be looking at opportunities that were created after the relevant marketing
-- emails were sent. I did brief this into the team a while ago."
--
-- She did — on 20 Aug, and it was built for MEETINGS (v_outreach_meetings_v2 filters on
-- `was_emailed AND after_first_touch`) and never for OPPORTUNITIES. The reason is structural:
-- the old view was built on fact_outreach_prospect, which carries no delivery counts, so it
-- could not express "was this person actually emailed". Opportunities are therefore rebuilt
-- here on the SAME operational tables the meetings rule uses, so "emailed" and "first touch"
-- have ONE definition serving both rather than two that can drift apart.
--
-- Effect on the marketing workstreams (measured 19 Sep, all-time):
--   before  140 opps · EUR 4,704,258 open pipeline · EUR 420,466 won
--   after    39 opps · EUR   831,537 open pipeline · EUR  35,313 won
-- Of the 101 removed: 66 were never emailed at all, and 35 were emailed but the deal already
-- existed before the first email — outreach cannot have caused a deal that pre-dates it.

DROP VIEW IF EXISTS v_outreach_attributed_opps;

CREATE VIEW v_outreach_attributed_opps AS
SELECT DISTINCT
    oc.opp_id,
    oc.created_date,
    oc.is_won,
    oc.is_closed,
    oc.stage_name,
    oc.amount_eur,
    dd.year,
    dd.quarter,
    st.sequence_id,
    s.name AS sequence_name,
    r.region_id,
    r.region_code,
    -- first touch = when the prospect entered the cadence, same expression as the meetings view
    COALESCE(st.active_at, st.created_at)::date AS first_touch_at,
    s.name ~* '^cwsi - sopro|^cwsi - microsoft|^cwsi secure .*outbound'::text AS is_marketing
FROM fact_opportunity_contact oc
  JOIN outreach_prospect p        ON lower(p.email) = lower(oc.contact_email)
  JOIN outreach_sequence_state st ON st.prospect_id = p.id
  JOIN outreach_sequence s        ON s.id = st.sequence_id
  LEFT JOIN dim_date dd           ON dd.date_id = oc.created_date
  LEFT JOIN dim_region r          ON r.region_code = CASE s.region_code
                                       WHEN 'UK&I' THEN 'UKI' ELSE s.region_code END
WHERE oc.contact_email IS NOT NULL
  AND oc.contact_email <> ''
  -- (1) the prospect was actually emailed: at least one delivery that was not a bounce
  AND st.deliver_count > st.bounce_count
  -- (2) the opportunity was created ON OR AFTER the first touch — the causality rule
  AND oc.created_date >= COALESCE(st.active_at, st.created_at)::date;

COMMENT ON VIEW v_outreach_attributed_opps IS
  'Opportunities attributed to an Outreach sequence by contact, restricted to prospects who were '
  'actually emailed and to deals created on or after the first touch (client rule, 20 Aug 2026, '
  'extended to opportunities 20 Sep 2026). Same emailed/first-touch definition as v_outreach_meetings_v2.';

REVOKE ALL ON v_outreach_attributed_opps FROM anon;
GRANT SELECT ON v_outreach_attributed_opps TO authenticated;
