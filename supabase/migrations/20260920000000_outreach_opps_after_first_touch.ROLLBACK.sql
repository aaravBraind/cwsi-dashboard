-- ROLLBACK for 20260920000000_outreach_opps_after_first_touch.sql
--
-- Restores v_outreach_attributed_opps EXACTLY as it was before 20 Sep 2026: no emailed /
-- after-first-touch rule, built on fact_outreach_prospect, non-marketing sequences included.
-- Captured verbatim from pg_get_viewdef() before the change was applied.
--
-- Apply only if the client withdraws the causality rule. Running this puts the Outreach
-- figures back to 140 marketing opportunities / EUR 4,704,258 open pipeline / EUR 420,466 won.

DROP VIEW IF EXISTS v_outreach_attributed_opps;

CREATE VIEW v_outreach_attributed_opps AS
 SELECT DISTINCT oc.opp_id,
    oc.created_date,
    oc.is_won,
    oc.is_closed,
    oc.stage_name,
    oc.amount_eur,
    dd.year,
    dd.quarter,
    p.sequence_id,
    p.sequence_name,
    p.region_id,
    r.region_code,
    p.sequence_name ~* '^cwsi - sopro|^cwsi - microsoft|^cwsi secure .*outbound'::text AS is_marketing
   FROM fact_opportunity_contact oc
     JOIN fact_outreach_prospect p ON lower(p.email) = lower(oc.contact_email)
     LEFT JOIN dim_date dd ON dd.date_id = oc.created_date
     LEFT JOIN dim_region r ON r.region_id = p.region_id
  WHERE oc.contact_email IS NOT NULL
    AND oc.contact_email <> ''::text
    AND (p.state <> ALL (ARRAY['pending'::text, 'failed'::text, 'bounced'::text]));

REVOKE ALL ON v_outreach_attributed_opps FROM anon;
GRANT SELECT ON v_outreach_attributed_opps TO authenticated;
