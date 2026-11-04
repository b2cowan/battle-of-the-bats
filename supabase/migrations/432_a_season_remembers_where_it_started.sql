-- ---------------------------------------------------------------
-- Migration 432 — House League 9f-2, Start next season: a season remembers where it started
-- (build prompt docs/projects/active/HOUSE_LEAGUE_STAGE9F2_BUILD_PROMPT.md; plan HOUSE_LEAGUE_STAGE9_PLAN.md §0j, 9f·8–9f·13;
-- words HOUSE_LEAGUE_STAGE9F_COPY.md §11; owner ruled the column 2026-11-03, push-back 1).
--
-- WHY: a season made with "Start from" shows a banner ("Started from Draft Test 2027: …") and a "From Draft Test 2027" /
-- "Moved 52 weeks" mark on each checklist line that came across, and a mark goes once its line is edited. That needs the new
-- season to know its source, what was brought, and how each line looked when it arrived.
--
-- WHAT CHANGES (league_seasons only): one nullable jsonb column, started_from. Written once, by the season create route, when
-- a season is started from another; null for every other season (including every existing one). Shape (lib/house-league-
-- start-from.ts, StartedFrom): { sourceId, sourceName, live, shiftDays, bornShift, brought: { settings, ageGroups, teams,
-- practice, coaches }, prints: { ageGroups?, prices?, dates?, pay?, waiver? } }. sourceId is deliberately NOT a foreign key:
-- the source may be deleted, and the record (with the name as it was) must not move with it.
--
-- Additive, nullable, no default, no backfill, no row changed. Re-runnable. Prod order: either way round (nothing reads the
-- column until the 9f-2 code ships, and the code writes it only on a Start from create).
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.league_seasons ADD COLUMN IF NOT EXISTS started_from jsonb;

COMMENT ON COLUMN public.league_seasons.started_from IS
  'Start next season (9f-2): the season this one was started from (id, name as it was), what came across, and a fingerprint per checklist line so its "From {season}" mark goes once the line is edited. Null when not started from another season. sourceId is not a foreign key.';

COMMIT;
