-- Emits the entire Outreach report as a single JSON row, ready to pipe into
-- scripts/build_outreach_report.py.
--
--   ALL-TIME (default): run as-is.
--   ANY WINDOW: put the dates in the `win` CTE below. Nothing else changes — that is
--   the reason the report is built on individual mailings rather than on Outreach's
--   lifetime counters, which cannot be sliced by time at all.
--
-- Metric definitions (these are what the report prints under each table):
--   assigned            prospects currently registered to the sequence
--   sent                individual emails delivered
--   prospects_emailed   distinct people who received >= 1 email  <- every rate uses this
--   opens / replies     distinct PEOPLE who opened / replied (not raw events)
--   open_events         raw open pixel fires, secondary column only

with win as (
  -- ALL-TIME: both null. For a window, e.g. select '2026-07-01'::timestamptz, '2026-08-01'
  select null::timestamptz as from_ts, null::timestamptz as to_ts
),
mail as (
  select m.* from v_outreach_mailing m, win w
  where m.delivered_at is not null
    and (w.from_ts is null or m.delivered_at >= w.from_ts)
    and (w.to_ts   is null or m.delivered_at <  w.to_ts)
),
-- Engagement is attributed to the mailing's own delivery window, so a prospect who
-- opened an email sent inside the window counts even if the open landed later.
asg as (select * from v_outreach_assignment),

-- Meetings. A meeting can match more than one sequence (the same contact may sit on
-- several), so per-sequence and per-seller counts can sum above the headline. The
-- headline total is de-duplicated on meeting_id.
mtg as (
  select ma.* from v_outreach_meeting_attribution ma, win w
  where (w.from_ts is null or ma.activity_date >= w.from_ts::date)
    and (w.to_ts   is null or ma.activity_date <  w.to_ts::date)
),

by_seller as (
  select coalesce(s.seller, 'Unassigned') as seller,
         max(s.region_code) as region_code,
         count(distinct a.state_id)                                    as assigned,
         count(distinct m.mailing_id)                                  as sent,
         count(distinct m.prospect_id)                                 as prospects_emailed,
         count(distinct m.prospect_id) filter (where m.opened_at is not null)  as opens,
         count(distinct m.prospect_id) filter (where m.replied_at is not null) as replies,
         count(distinct g.meeting_id)                                  as meetings
  from outreach_sequence s
  left join mail m on m.sequence_id = s.id
  left join asg  a on a.sequence_id = s.id
  left join mtg  g on g.sequence_id = s.id
  group by 1
),
-- open_events is a SUM, so it must come off mail alone. Every other metric above is a
-- count(distinct ...), which is why joining three tables at once does not inflate them.
seller_events as (
  select coalesce(seller, 'Unassigned') as seller, sum(open_count) as open_events
  from mail group by 1
),
by_programme as (
  select coalesce(s.programme, 'Other') as programme,
         count(distinct s.id)                                          as sequences,
         count(distinct m.sequence_id)                                 as sequences_sending,
         count(distinct a.state_id)                                    as assigned,
         count(distinct m.mailing_id)                                  as sent,
         count(distinct m.prospect_id)                                 as prospects_emailed,
         count(distinct m.prospect_id) filter (where m.opened_at is not null)  as opens,
         count(distinct m.prospect_id) filter (where m.replied_at is not null) as replies,
         count(distinct g.meeting_id)                                  as meetings
  from outreach_sequence s
  left join mail m on m.sequence_id = s.id
  left join asg  a on a.sequence_id = s.id
  left join mtg  g on g.sequence_id = s.id
  group by 1
),
by_region as (
  select coalesce(s.region_code, 'Unassigned') as region_code,
         count(distinct s.id)                                          as sequences,
         count(distinct a.state_id)                                    as assigned,
         count(distinct m.mailing_id)                                  as sent,
         count(distinct m.prospect_id)                                 as prospects_emailed,
         count(distinct m.prospect_id) filter (where m.opened_at is not null)  as opens,
         count(distinct m.prospect_id) filter (where m.replied_at is not null) as replies,
         count(distinct g.meeting_id)                                  as meetings
  from outreach_sequence s
  left join mail m on m.sequence_id = s.id
  left join asg  a on a.sequence_id = s.id
  left join mtg  g on g.sequence_id = s.id
  group by 1
),
by_sequence as (
  select s.id, s.name as sequence_name, coalesce(s.programme,'Other') as programme,
         s.region_code, s.seller,
         count(distinct a.state_id)                                    as assigned,
         count(distinct m.mailing_id)                                  as sent,
         count(distinct m.prospect_id)                                 as prospects_emailed,
         count(distinct m.prospect_id) filter (where m.opened_at is not null)  as opens,
         count(distinct m.prospect_id) filter (where m.replied_at is not null) as replies,
         count(distinct g.meeting_id)                                  as meetings
  from outreach_sequence s
  left join mail m on m.sequence_id = s.id
  left join asg  a on a.sequence_id = s.id
  left join mtg  g on g.sequence_id = s.id
  group by 1,2,3,4,5
),
by_step as (
  select coalesce(programme,'Other') as programme, step_order, step_type,
         count(*)                                                      as sent,
         count(distinct prospect_id) filter (where opened_at is not null)  as opens,
         count(distinct prospect_id) filter (where replied_at is not null) as replies
  from mail where step_order is not null group by 1,2,3
),
totals as (
  select (select count(*) from asg)                                    as assigned,
         (select count(*) from mail)                                   as sent,
         (select count(distinct prospect_id) from mail)                as prospects_emailed,
         (select count(distinct prospect_id) from mail where opened_at is not null)  as opens,
         (select coalesce(sum(open_count),0) from mail)                as open_events,
         (select count(distinct prospect_id) from mail where replied_at is not null) as replies,
         (select count(distinct meeting_id) from mtg)                  as meetings,
         (select count(distinct sequence_id) from mail)                as sequences_sending,
         (select count(*) from outreach_sequence)                      as sequence_count
)
select jsonb_pretty(jsonb_build_object(
  'period_label', case when (select from_ts from win) is null
                       then 'All activity to date (all time)'
                       else 'Selected period' end,
  'period_sentence', case when (select from_ts from win) is null
                          then 'their full time live, from the first email sent to today'
                          else 'the selected period' end,
  'as_of', to_char(current_date, 'FMDD Mon YYYY'),
  'sequence_count', (select sequence_count from totals),
  'totals', (select (to_jsonb(t) - 'sequence_count') ||
                    jsonb_build_object('reply_rate_pct',
                      round(100.0 * t.replies / nullif(t.prospects_emailed,0), 1))
             from totals t),
  'by_seller', (select coalesce(jsonb_agg(x order by x.sent desc, x.assigned desc), '[]'::jsonb)
                from (select b.seller, b.region_code, b.assigned, b.sent, b.prospects_emailed,
                             b.opens, coalesce(e.open_events,0) as open_events, b.replies,
                             round(100.0*b.replies/nullif(b.prospects_emailed,0),1) as reply_rate_pct,
                             b.meetings
                      from by_seller b left join seller_events e on e.seller = b.seller) x),
  'by_programme', (select coalesce(jsonb_agg(x order by x.sent desc), '[]'::jsonb)
                   from (select p.*, round(100.0*p.replies/nullif(p.prospects_emailed,0),1)
                                as reply_rate_pct from by_programme p) x),
  'by_region', (select coalesce(jsonb_agg(x order by x.sent desc), '[]'::jsonb)
                from (select r.*, round(100.0*r.replies/nullif(r.prospects_emailed,0),1)
                             as reply_rate_pct from by_region r) x),
  'by_step', (select coalesce(jsonb_agg(x order by x.programme, x.step_order), '[]'::jsonb)
              from by_step x),
  'by_sequence', (select coalesce(jsonb_agg(x order by x.programme, x.sequence_name), '[]'::jsonb)
                  from (select q.*, round(100.0*q.replies/nullif(q.prospects_emailed,0),1)
                               as reply_rate_pct from by_sequence q) x),
  'meetings_detail', (select coalesce(jsonb_agg(jsonb_build_object(
                        'activity_date', to_char(activity_date,'DD Mon YYYY'),
                        'sequence_name', sequence_name, 'programme', programme,
                        'region_code', region_code, 'seller', seller)
                        order by activity_date), '[]'::jsonb) from mtg),
  'meetings_narrative', (
     select case when count(distinct meeting_id) = 0
                 then 'No meetings have yet been credited to a CWSI outreach sequence. '
                      || 'Meetings are matched from Salesforce on the contact''s email address, '
                      || 'so a meeting booked with someone who is not a sequence prospect will '
                      || 'not appear here.'
                 when count(distinct meeting_id) = 1
                 then 'One meeting has been booked from CWSI outreach to date.'
                 else count(distinct meeting_id) || ' meetings have been booked from CWSI '
                      || 'outreach to date, across '
                      || count(distinct sequence_id) || ' sequences.' end
     from mtg),
  'region_note', (
     -- Names the regions that have loaded prospects but not started sending, so the zero
     -- rows read as "not started" rather than "tried and failed".
     select case when count(*) = 0
                 then 'Every region with prospects assigned has started sending.'
                 else 'Prospects are assigned in ' || string_agg(region_code, ' and ' order by region_code)
                      || ', but sending has not started there yet, so the zeros in those rows '
                      || 'are not a performance result.' end
     from (select coalesce(s.region_code,'Unassigned') as region_code
           from outreach_sequence s
           left join asg a on a.sequence_id = s.id
           left join mail m on m.sequence_id = s.id
           group by 1
           having count(a.state_id) > 0 and count(m.mailing_id) = 0) z),
  'meetings_caveat', 'A meeting can involve a contact who sits on more than one sequence, so '
                     'the per-sequence and per-seller meeting counts can add up to more than '
                     'the headline total. The total is counted once per meeting.'
)) as payload;
