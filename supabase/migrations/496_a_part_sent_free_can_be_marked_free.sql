-- 496_a_part_sent_free_can_be_marked_free.sql
--
-- Add time is a second schedule, shown as one — after walk §538 (plan CLUB_SCHEDULE_SEVERAL_PERMITS_PLAN.md §8 Phase 8;
-- owner ruling 2026-11-17, call C2 = C).
-- A part sent WITHOUT a bill gets a row in Needs attention ("… was sent without a bill", Bill it…). A club that sends a part
-- free on purpose had no way to clear that row. The owner ruled: a dismiss ("It's free") for people who can bill, and the row
-- hidden from people who cannot. The dismiss has to be REMEMBERED, so the schedule row learns two columns.
--
-- WHAT CHANGES
--   club_schedules.bill_dismissed_at (NEW, null = not dismissed): when someone with the club's Accounting said "It's free" for
--   a part sent without a bill. club_schedules.bill_dismissed_by (NEW): who (FK auth.users ON DELETE SET NULL, as sent_by).
--   Only the app reads them (Needs attention's row); nothing else — no money — depends on them. A bill made later (Bill it…
--   from anywhere) clears the row on its own, because the row asks "no bill"; the columns stay as the record.
--   No RLS change (the table is read and written by the service role only, as every club_schedules column).
--
-- Idempotent (add column if not exists).

begin;
set local lock_timeout = '15s';

alter table public.club_schedules
  add column if not exists bill_dismissed_at timestamptz,
  add column if not exists bill_dismissed_by uuid references auth.users(id) on delete set null;

commit;
