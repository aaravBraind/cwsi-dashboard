-- Event attendance gets a date and a webinar flag (Margot, 23 Sep 2026: "This event was in
-- Q2, so that cannot be correct" ×8). fact_event_attendance had no date at all, so the
-- attendee-list figures could not be placed in a quarter and showed in every one.
--
--   event_date  the event's own date — parsed by the ingest from the DD.MM.YYYY list-name
--               prefix; backfilled below from the Salesforce campaign dates for the rows
--               already loaded. The ingest never overwrites a known date with NULL.
--   is_webinar  an attendee list that belongs to a webinar, not an in-person event (the
--               ingest drops names containing "webinar", but not every webinar says so).
--               Kept, labelled as a webinar, because GoToWebinar does not carry these.

alter table public.fact_event_attendance
  add column if not exists event_date date,
  add column if not exists is_webinar boolean not null default false;

update public.fact_event_attendance set event_date = '2026-04-22'
  where event_name = 'Protect Data, Power AI Event';
-- Two different E7 events: the 10 June one (single venue, UNASSIGNED) and the UK one on 15 Sep.
update public.fact_event_attendance set event_date = '2026-06-10'
  where event_name = 'The Microsoft E7 Suite: Governing AI Agents at Scale';
update public.fact_event_attendance set event_date = '2026-09-15'
  where event_name = 'The Microsoft E7 Suite - Governing AI Agents at Scale';
-- "This is a webinar" (Margot, p97) — Salesforce campaign 10.09.2026, type Webinar.
update public.fact_event_attendance set event_date = '2026-09-10', is_webinar = true
  where event_name = 'Governing Non-Human Identities in the Age of AI Agents';
