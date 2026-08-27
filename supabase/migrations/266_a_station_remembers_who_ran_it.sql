-- 266_a_station_remembers_who_ran_it.sql
--
-- Widen rep_team_tags.kind to admit 'staff' and 'equipment' — real, team-wide libraries for the
-- two remaining free-text fields on a practice plan (COACH_PRACTICE_STAFF_EQUIPMENT_TAGS_PLAN.md).
--
-- ⚠ This reopens a choice a prior session deliberately made the other way (COACH_PRACTICE_PLANS_PLAN.md
-- §10.3): D12 originally ruled staff should be `rep_team_tags` rows, and the build shipped plain
-- self-healing names instead, because `merge_rep_team_tags` re-points join-table rows and CANNOT
-- reach an id embedded inside a plan's jsonb — a merge would silently orphan every practice plan
-- referencing the loser. Proceeding anyway (owner instruction, 2026-08-27) means the merge and
-- delete routes for these two kinds MUST re-point/strip ids inside every affected plan's jsonb
-- themselves (`lib/rep-practice-plan-tag-repoint.ts`), in the SAME transaction as the tag write —
-- `merge_rep_team_tags` alone is not sufficient for 'staff' or 'equipment' the way it is for the
-- other three kinds.
ALTER TABLE public.rep_team_tags DROP CONSTRAINT IF EXISTS rep_team_tags_kind_check;
ALTER TABLE public.rep_team_tags
  ADD CONSTRAINT rep_team_tags_kind_check CHECK (kind IN ('game', 'expense', 'focus', 'staff', 'equipment'));
