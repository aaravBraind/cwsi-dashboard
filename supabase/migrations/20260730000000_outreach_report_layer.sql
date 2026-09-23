-- Outreach reporting layer: row-per-object raw tables + rollup views.
--
-- WHY THIS EXISTS
-- The existing fact_outreach_* tables are SNAPSHOT grain: they store Outreach's
-- lifetime counters stamped with the run date. Those counters cannot be sliced by
-- time (they only ever grow, and they do not decrement when prospects are removed),
-- so a "last 7 days" or "June only" report is impossible from them.
--
-- These tables store the underlying OBJECTS instead — one row per mailing, per
-- sequence state, per step. A mailing carries delivered_at, so any window becomes a
-- WHERE clause and "all-time" is simply no WHERE clause at all. That removes the
-- weekly-vs-lifetime ambiguity permanently rather than re-deciding it per report.
--
-- The fact_outreach_* snapshot tables are left untouched; the dashboard still reads them.

-- ---------------------------------------------------------------------------
-- 1. Raw tables (upsert on the Outreach object id)
-- ---------------------------------------------------------------------------

create table if not exists outreach_sequence (
  id                     text primary key,
  name                   text,
  programme              text,          -- Secure Outbound | Microsoft | SoPro | Other
  region_code            text,          -- UK&I | BeLux | NL | UNASSIGNED
  seller                 text,          -- resolved from the sequence owner, name as fallback
  owner_user_id          text,
  enabled                boolean,
  created_at             timestamptz,
  step_count             integer,
  -- lifetime counters, kept only as a cross-check against the mailing-derived figures
  schedule_count         integer,
  deliver_count          integer,
  open_count             integer,
  click_count            integer,
  reply_count            integer,
  bounce_count           integer,
  opt_out_count          integer,
  failure_count          integer,
  positive_reply_count   integer,
  neutral_reply_count    integer,
  negative_reply_count   integer,
  loaded_at              timestamptz default now()
);

create table if not exists outreach_user (
  id          text primary key,
  first_name  text,
  last_name   text,
  full_name   text,
  email       text,
  title       text,
  loaded_at   timestamptz default now()
);

create table if not exists outreach_prospect (
  id          text primary key,
  email       text,
  company     text,
  title       text,
  country     text,
  stage       text,
  engaged_at  timestamptz,
  loaded_at   timestamptz default now()
);
create index if not exists outreach_prospect_email_idx on outreach_prospect (lower(email));

create table if not exists outreach_sequence_step (
  id              text primary key,
  sequence_id     text,
  step_order      integer,
  step_type       text,
  display_name    text,
  schedule_count  integer,
  deliver_count   integer,
  open_count      integer,
  click_count     integer,
  reply_count     integer,
  bounce_count    integer,
  opt_out_count   integer,
  loaded_at       timestamptz default now()
);
create index if not exists outreach_sequence_step_seq_idx on outreach_sequence_step (sequence_id);

-- Assigned prospects. NOTE: Outreach DELETES the sequence state when a prospect is
-- bulk-removed from a sequence, so this is "assigned and still on the sequence", not
-- "ever assigned". Mailings do not suffer this — they are immutable history.
create table if not exists outreach_sequence_state (
  id                    text primary key,
  sequence_id           text,
  prospect_id           text,
  mailbox_id            text,
  state                 text,          -- active | finished | paused | bounced | opted_out | ...
  created_at            timestamptz,   -- when the prospect was added
  active_at             timestamptz,
  state_changed_at      timestamptz,
  replied_at            timestamptz,
  deliver_count         integer,
  open_count            integer,
  click_count           integer,
  reply_count           integer,
  bounce_count          integer,
  opt_out_count         integer,
  positive_reply_count  integer,
  neutral_reply_count   integer,
  negative_reply_count  integer,
  loaded_at             timestamptz default now()
);
create index if not exists outreach_sequence_state_seq_idx on outreach_sequence_state (sequence_id);
create index if not exists outreach_sequence_state_prospect_idx on outreach_sequence_state (prospect_id);

-- The ground truth. One row per individual email.
create table if not exists outreach_mailing (
  id                text primary key,
  sequence_id       text,
  sequence_step_id  text,
  prospect_id       text,
  user_id           text,
  mailbox_id        text,
  state             text,
  mailing_type      text,
  subject           text,
  error_reason      text,
  scheduled_at      timestamptz,
  delivered_at      timestamptz,       -- the date column every window filters on
  opened_at         timestamptz,
  clicked_at        timestamptz,
  replied_at        timestamptz,
  bounced_at        timestamptz,
  open_count        integer,
  click_count       integer,
  reply_count       integer,
  loaded_at         timestamptz default now()
);
create index if not exists outreach_mailing_seq_idx on outreach_mailing (sequence_id);
create index if not exists outreach_mailing_delivered_idx on outreach_mailing (delivered_at);
create index if not exists outreach_mailing_prospect_idx on outreach_mailing (prospect_id);

-- ---------------------------------------------------------------------------
-- 2. Lock down access (Supabase auto-grants anon on new tables — revoke it)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['outreach_sequence','outreach_user','outreach_prospect',
                           'outreach_sequence_step','outreach_sequence_state','outreach_mailing']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon', t);
    execute format('grant select on table %I to authenticated', t);
    execute format('drop policy if exists authenticated_read on %I', t);
    execute format('create policy authenticated_read on %I for select to authenticated using (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Base view: one row per email, enriched with the reporting dimensions.
--    Filter THIS on delivered_at for any window. No filter = all-time.
-- ---------------------------------------------------------------------------
create or replace view v_outreach_mailing as
select
  m.id                as mailing_id,
  m.sequence_id,
  s.name              as sequence_name,
  s.programme,
  s.region_code,
  coalesce(u.first_name, s.seller) as seller,   -- first name only: the report reads "Barry-John", not "Barry-John <surname>"
  m.prospect_id,
  p.email             as prospect_email,
  p.company           as prospect_company,
  st.step_order,
  st.step_type,
  m.state,
  m.delivered_at,
  m.opened_at,
  m.clicked_at,
  m.replied_at,
  m.bounced_at,
  coalesce(m.open_count, 0)  as open_count,
  coalesce(m.click_count, 0) as click_count,
  coalesce(m.reply_count, 0) as reply_count
from outreach_mailing m
left join outreach_sequence      s  on s.id  = m.sequence_id
left join outreach_sequence_step st on st.id = m.sequence_step_id
left join outreach_user          u  on u.id  = m.user_id
left join outreach_prospect      p  on p.id  = m.prospect_id;

-- Base view: one row per assigned prospect, same dimensions.
create or replace view v_outreach_assignment as
select
  ss.id           as state_id,
  ss.sequence_id,
  s.name          as sequence_name,
  s.programme,
  s.region_code,
  s.seller,
  ss.prospect_id,
  p.email         as prospect_email,
  ss.state,
  ss.created_at   as assigned_at,
  ss.replied_at
from outreach_sequence_state ss
left join outreach_sequence s on s.id = ss.sequence_id
left join outreach_prospect p on p.id = ss.prospect_id;

-- ---------------------------------------------------------------------------
-- 4. Rollups. All-time by construction.
--
--    DEFINITIONS (these are what the report prints under each table):
--      assigned            prospects currently registered to the sequence
--      sent                individual emails delivered (a 4-step sequence sends up
--                          to 4 emails per prospect, which is why sent can exceed
--                          assigned — they are different units, not a contradiction)
--      prospects_emailed    distinct prospects who received at least one email
--      opens / replies      DISTINCT PROSPECTS who opened / replied (not raw events)
--      open_events          raw open pixel fires, kept as a secondary column only
--      open_rate/reply_rate divided by prospects_emailed, never by assigned
-- ---------------------------------------------------------------------------

create or replace view v_outreach_report_by_seller as
with m as (
  select seller,
         count(*) filter (where delivered_at is not null)                       as sent,
         count(distinct prospect_id) filter (where delivered_at is not null)    as prospects_emailed,
         count(distinct prospect_id) filter (where opened_at   is not null)     as opens,
         count(distinct prospect_id) filter (where replied_at  is not null)     as replies,
         count(distinct prospect_id) filter (where clicked_at  is not null)     as clicks,
         count(distinct prospect_id) filter (where bounced_at  is not null)     as bounces,
         sum(open_count)                                                        as open_events
  from v_outreach_mailing group by 1
),
a as (
  select seller,
         count(*) as assigned,
         count(*) filter (where state = 'active')   as assigned_active,
         count(*) filter (where state = 'finished') as assigned_finished
  from v_outreach_assignment group by 1
)
select coalesce(m.seller, a.seller) as seller,
       coalesce(a.assigned, 0) as assigned, coalesce(a.assigned_active, 0) as assigned_active,
       coalesce(a.assigned_finished, 0) as assigned_finished,
       coalesce(m.sent, 0) as sent, coalesce(m.prospects_emailed, 0) as prospects_emailed,
       coalesce(m.opens, 0) as opens, coalesce(m.open_events, 0) as open_events,
       coalesce(m.clicks, 0) as clicks, coalesce(m.replies, 0) as replies,
       coalesce(m.bounces, 0) as bounces,
       round(100.0 * m.opens   / nullif(m.prospects_emailed, 0), 1) as open_rate_pct,
       round(100.0 * m.replies / nullif(m.prospects_emailed, 0), 1) as reply_rate_pct
from m full outer join a on a.seller = m.seller
order by 5 desc, 2 desc;

create or replace view v_outreach_report_by_programme as
with m as (
  select programme,
         count(distinct sequence_id)                                            as sequences_sending,
         count(*) filter (where delivered_at is not null)                        as sent,
         count(distinct prospect_id) filter (where delivered_at is not null)     as prospects_emailed,
         count(distinct prospect_id) filter (where opened_at   is not null)      as opens,
         count(distinct prospect_id) filter (where replied_at  is not null)      as replies,
         sum(open_count)                                                         as open_events
  from v_outreach_mailing group by 1
),
a as (select programme, count(*) as assigned from v_outreach_assignment group by 1),
s as (select programme, count(*) as sequences from outreach_sequence group by 1)
select coalesce(s.programme, m.programme, a.programme) as programme,
       coalesce(s.sequences, 0) as sequences,
       coalesce(m.sequences_sending, 0) as sequences_sending,
       coalesce(a.assigned, 0) as assigned, coalesce(m.sent, 0) as sent,
       coalesce(m.prospects_emailed, 0) as prospects_emailed,
       coalesce(m.opens, 0) as opens, coalesce(m.open_events, 0) as open_events,
       coalesce(m.replies, 0) as replies,
       round(100.0 * m.opens   / nullif(m.prospects_emailed, 0), 1) as open_rate_pct,
       round(100.0 * m.replies / nullif(m.prospects_emailed, 0), 1) as reply_rate_pct
from s full outer join m on m.programme = s.programme
       full outer join a on a.programme = coalesce(s.programme, m.programme)
order by 5 desc;

create or replace view v_outreach_report_by_region as
with m as (
  select region_code,
         count(*) filter (where delivered_at is not null)                        as sent,
         count(distinct prospect_id) filter (where delivered_at is not null)     as prospects_emailed,
         count(distinct prospect_id) filter (where opened_at   is not null)      as opens,
         count(distinct prospect_id) filter (where replied_at  is not null)      as replies,
         sum(open_count)                                                         as open_events
  from v_outreach_mailing group by 1
),
a as (select region_code, count(*) as assigned from v_outreach_assignment group by 1),
s as (select region_code, count(*) as sequences from outreach_sequence group by 1)
select coalesce(s.region_code, m.region_code, a.region_code) as region_code,
       coalesce(s.sequences, 0) as sequences, coalesce(a.assigned, 0) as assigned,
       coalesce(m.sent, 0) as sent, coalesce(m.prospects_emailed, 0) as prospects_emailed,
       coalesce(m.opens, 0) as opens, coalesce(m.open_events, 0) as open_events,
       coalesce(m.replies, 0) as replies,
       round(100.0 * m.opens   / nullif(m.prospects_emailed, 0), 1) as open_rate_pct,
       round(100.0 * m.replies / nullif(m.prospects_emailed, 0), 1) as reply_rate_pct
from s full outer join m on m.region_code = s.region_code
       full outer join a on a.region_code = coalesce(s.region_code, m.region_code)
order by 4 desc;

create or replace view v_outreach_report_by_sequence as
with m as (
  select sequence_id,
         count(*) filter (where delivered_at is not null)                        as sent,
         count(distinct prospect_id) filter (where delivered_at is not null)     as prospects_emailed,
         count(distinct prospect_id) filter (where opened_at   is not null)      as opens,
         count(distinct prospect_id) filter (where replied_at  is not null)      as replies,
         sum(open_count)                                                         as open_events,
         min(delivered_at)                                                       as first_sent_at,
         max(delivered_at)                                                       as last_sent_at
  from v_outreach_mailing group by 1
),
a as (select sequence_id, count(*) as assigned from v_outreach_assignment group by 1)
select s.id as sequence_id, s.name as sequence_name, s.programme, s.region_code, s.seller,
       s.enabled, s.step_count,
       coalesce(a.assigned, 0) as assigned, coalesce(m.sent, 0) as sent,
       coalesce(m.prospects_emailed, 0) as prospects_emailed,
       coalesce(m.opens, 0) as opens, coalesce(m.open_events, 0) as open_events,
       coalesce(m.replies, 0) as replies,
       round(100.0 * m.opens   / nullif(m.prospects_emailed, 0), 1) as open_rate_pct,
       round(100.0 * m.replies / nullif(m.prospects_emailed, 0), 1) as reply_rate_pct,
       m.first_sent_at, m.last_sent_at,
       -- cross-check: Outreach's own lifetime counter vs our mailing-derived figure
       s.deliver_count as outreach_deliver_count
from outreach_sequence s
left join m on m.sequence_id = s.id
left join a on a.sequence_id = s.id
order by s.programme, s.name;

-- Step-level drop-off (step 1 vs step 4), mailing-derived so it is windowable.
create or replace view v_outreach_report_by_step as
select programme, step_order, step_type,
       count(*) filter (where delivered_at is not null)                    as sent,
       count(distinct prospect_id) filter (where opened_at  is not null)   as opens,
       count(distinct prospect_id) filter (where replied_at is not null)   as replies
from v_outreach_mailing
where step_order is not null
group by 1, 2, 3
order by 1, 2;

-- ---------------------------------------------------------------------------
-- 5. Meetings. Outreach's v2 API has no meetings resource, so meetings come from
--    Salesforce and are credited to a sequence when the meeting's contact email
--    matches a prospect assigned to that sequence — the same email-based method the
--    dashboard's Outreach page already uses. Coverage is limited to meetings that
--    carry a contact email, so this reads low rather than high.
-- ---------------------------------------------------------------------------
create or replace view v_outreach_meeting_attribution as
select distinct
  fm.meeting_id, fm.activity_date, fm.subject, fm.contact_email,
  a.sequence_id, a.sequence_name, a.programme, a.region_code, a.seller
from fact_meeting fm
join v_outreach_assignment a
  on lower(a.prospect_email) = lower(fm.contact_email)
where fm.contact_email is not null and fm.contact_email <> '';

grant select on v_outreach_mailing, v_outreach_assignment,
                v_outreach_report_by_seller, v_outreach_report_by_programme,
                v_outreach_report_by_region, v_outreach_report_by_sequence,
                v_outreach_report_by_step, v_outreach_meeting_attribution
  to authenticated;
revoke all on v_outreach_mailing, v_outreach_assignment,
              v_outreach_report_by_seller, v_outreach_report_by_programme,
              v_outreach_report_by_region, v_outreach_report_by_sequence,
              v_outreach_report_by_step, v_outreach_meeting_attribution
  from anon;
