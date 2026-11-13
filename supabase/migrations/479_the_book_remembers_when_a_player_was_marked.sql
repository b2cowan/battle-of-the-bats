-- 479_the_book_remembers_when_a_player_was_marked.sql
--
-- Signed-in family accounts Stage 4b, Session 2 (Part 5.4; build prompt docs/projects/active/SIGNED_IN_FAMILY_STAGE4B_BUILD_PROMPT.md).
-- Needs 476.
--
-- WHY: the coach's attendance room warns "⚠ Family changed to Out · Wed" when a family changed their answer AFTER the coach marked
-- that player (ask 3/6), and the warning clears when the coach taps the player's mark again (Part 5.4). Both need "when did the
-- coach last mark THIS player". `updated_at` cannot say it: the room saves the whole roster in one batch, so one tap on Maya
-- re-stamps every player's row.
--
-- WHAT CHANGES
--   rep_team_event_attendance.marked_at   NEW, nullable. When a coach last set or confirmed this player's mark. The attendance PATCH
--                                         writes it only for a row whose status changed or that the coach tapped; every other row in
--                                         the batch keeps its own. Backfilled from updated_at for rows already marked (the best fact
--                                         there is; a row still 'unknown' has no mark and stays null).
--
-- Nothing reads it but the coach's room; a family never sees it (ask 5). Re-runnable.

begin;

set local lock_timeout = '15s';

alter table public.rep_team_event_attendance add column if not exists marked_at timestamptz;

update public.rep_team_event_attendance
   set marked_at = updated_at
 where marked_at is null and status <> 'unknown';

commit;

notify pgrst, 'reload schema';
