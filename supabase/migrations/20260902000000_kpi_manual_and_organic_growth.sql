-- Two additions from the CWSI FY26 reforecast that were previously unbuildable.
--
-- 1) organicTrafficGrowth — computed, no storage needed beyond a target row.
-- 2) kpi_manual — a place to record the KPIs CWSI tracks but no system holds
--    (PR placements, contributed articles, hero case studies, MDF claim rate), plus the
--    two NON-NUMERIC ones the numeric target columns could never hold: the Website
--    measurement integrity RAG flag and the Organic engagement time trend.
--
-- Manual KPIs keep BOTH their actual and their target here, per period, because their
-- targets are not uniformly numeric ('GREEN', 'Improve vs Q3'). kpi_targets stays
-- numeric-only rather than growing a parallel set of text columns.
--
-- See docs/kpi/KPI_REFORECAST_AUG2026.md, "Added 2 September".

create table if not exists kpi_manual (
  kpi_key     text not null,
  period      text not null check (period in ('q1','q2','q3','q4','fy')),
  value_num   numeric,
  value_text  text,
  target_num  numeric,
  target_text text,
  note        text,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (kpi_key, period)
);

comment on table kpi_manual is
  'Manually-maintained KPI actuals and targets for measures with no system of record. One row per KPI per period. Numeric measures use value_num/target_num; RAG and trend measures use value_text/target_text.';

alter table kpi_manual enable row level security;

drop policy if exists kpi_manual_select on kpi_manual;
drop policy if exists kpi_manual_insert on kpi_manual;
drop policy if exists kpi_manual_update on kpi_manual;
create policy kpi_manual_select on kpi_manual for select to authenticated using (true);
create policy kpi_manual_insert on kpi_manual for insert to authenticated with check (true);
create policy kpi_manual_update on kpi_manual for update to authenticated using (true) with check (true);

-- Supabase auto-grants anon on new tables; the dashboard reads as `authenticated` only.
revoke all on kpi_manual from anon;
grant select, insert, update on kpi_manual to authenticated;

-- Targets from the reforecast sheet, seeded with no actuals (nobody has entered any yet).
insert into kpi_manual (kpi_key, period, target_num, target_text, note, updated_by) values
  ('prPlacements','q1',3,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('prPlacements','q2',3,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('prPlacements','q3',3,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('prPlacements','q4',3,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('prPlacements','fy',12,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('thoughtLeadershipArticles','q1',1,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('thoughtLeadershipArticles','q2',1,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('thoughtLeadershipArticles','q3',1,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('thoughtLeadershipArticles','q4',1,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('thoughtLeadershipArticles','fy',4,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('heroCaseStudies','q1',1,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('heroCaseStudies','q2',1,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('heroCaseStudies','q3',1,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('heroCaseStudies','q4',1,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('heroCaseStudies','fy',4,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('mdfClaimRate','q1',0.75,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('mdfClaimRate','q2',0.75,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('mdfClaimRate','q3',0.75,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('mdfClaimRate','q4',0.75,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('mdfClaimRate','fy',0.75,null,null,'CWSI FY26 reforecast (Aug 2026)'),
  ('websiteIntegrity','q3',null,'GREEN',null,'CWSI FY26 reforecast (Aug 2026)'),
  ('websiteIntegrity','q4',null,'GREEN',null,'CWSI FY26 reforecast (Aug 2026)'),
  ('organicEngagementTime','q1',null,'Improve',null,'CWSI FY26 reforecast (Aug 2026)'),
  ('organicEngagementTime','q2',null,'Improve',null,'CWSI FY26 reforecast (Aug 2026)'),
  ('organicEngagementTime','q3',null,'Baseline',null,'CWSI FY26 reforecast (Aug 2026)'),
  ('organicEngagementTime','q4',null,'Improve vs Q3',null,'CWSI FY26 reforecast (Aug 2026)')
on conflict (kpi_key, period) do nothing;

-- Organic traffic growth vs prior quarter: computed from GA4 sessions, so it needs only a
-- target. Q1-Q3 deliberately have none — the sheet sets a Q4-only +20% vs the Q3 baseline.
insert into kpi_targets (kpi_key, label, unit, lower_is_better, q4, source, note, updated_by)
values ('organicTrafficGrowth', 'Organic traffic growth vs prior quarter', 'rate', false, 0.20, 'client',
  'ADDITIONAL — Optional supporting KPI. Q4 target is +20% vs the Q3 baseline; do not use until Q3 closes. (Source: CWSI FY26 Quarterly KPI reforecast, Aug 2026; sheet section "Organic SEO", KPI "Organic traffic growth vs prior quarter".)',
  'CWSI FY26 reforecast (Aug 2026)')
on conflict (kpi_key) do nothing;
