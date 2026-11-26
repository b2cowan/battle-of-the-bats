-- 545_a_schedules_slots_are_found_by_its_schedule.sql
--
-- Club schedules Stage 2, the /dba advisory on Session 2B (plan docs/projects/active/SCHEDULE_FIELDS_SAME_TIME_TRADES_PLAN.md,
-- the "2B built 2026-11-26" line; owner 2026-11-26: "build the dba index on the slot lookup then apply to dev").
--
-- WHY
--   club_schedule_slots has no index that starts with schedule_id. club_schedule_save (mig 544) finds each stored slot by
--   (schedule, venue, facility, section_mask, starts_at), once per slot it saves, and deletes or marks a schedule's other
--   slots by schedule_id; the schedule's own reads (loadSchedule, the bill, Send) filter by schedule_id too. Every one of
--   them reads every slot of the club (club_schedule_slots_org_idx is (org_id, starts_at)) or the venue's
--   (club_schedule_slots_venue_idx). True before Session 2B; 2B adds a slot per part, so a save does more lookups.
--
-- WHAT
--   One btree index on (schedule_id, org_venue_id, starts_at): the save's lookup narrows to a schedule's one venue and
--   start (facility and part are then a handful of rows), and every schedule_id-only read uses its first column.
--   Not unique: a removed slot and a part can share a place and start (the uniqueness is 541's exclusion constraint).
--
-- Plain CREATE INDEX (not CONCURRENTLY, which can't run inside a transaction block): the table is small (production held
-- 0 slots on 2026-11-25, per 541's note), so the brief write lock is nothing. Schema-visible (an index), so
-- check:migrations sees it.
-- Idempotent.

create index if not exists club_schedule_slots_schedule_idx
  on public.club_schedule_slots (schedule_id, org_venue_id, starts_at);
