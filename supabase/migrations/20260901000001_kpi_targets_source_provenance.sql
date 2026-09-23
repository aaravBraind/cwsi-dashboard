-- Where a KPI target came from, so a client-approved figure is never displayed as if it
-- were one BrainD invented (and vice versa). Previously the only clue was the updated_by
-- string, which the UI would have had to pattern-match.
--
-- Added alongside the CWSI FY26 reforecast (20260901000000), which is the point at which
-- the dashboard stopped being able to say "all targets are provisional" truthfully.
alter table kpi_targets
  add column if not exists source text not null default 'placeholder';

alter table kpi_targets
  drop constraint if exists kpi_targets_source_chk;
alter table kpi_targets
  add constraint kpi_targets_source_chk check (source in ('client', 'placeholder'));

-- The Aug 2026 reforecast rows are client-supplied; everything else stays a placeholder.
update kpi_targets
   set source = 'client'
 where updated_by = 'CWSI FY26 reforecast (Aug 2026)';

comment on column kpi_targets.source is
  'client = supplied or approved by CWSI; placeholder = BrainD provisional, awaiting a client figure. A manual edit in the KPI Tracker sets this to client.';
