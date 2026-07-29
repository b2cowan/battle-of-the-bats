-- ============================================================
-- Migration 204 — teams.coach: normalize '' to NULL (data fix, both envs)
--
-- WHAT WAS WRONG
-- Two encodings of "this team has no coach name" existed at once:
--     prod  →  ''      (17 of 21 teams)
--     dev   →  NULL    (49 of 229 teams)
-- because prod's `teams.coach` was NOT NULL until migration 202, and the manual add-team path
-- (app/api/admin/teams/route.ts) coerced with `?? ''` to satisfy it rather than failing. Every
-- OTHER write path — the bulk registration import, the register route — writes NULL or a real
-- name. So the column meant different things depending on which door the row came through.
--
-- WHY IT WAS SAFE BUT STILL WRONG
-- No reader can tell the two apart: every consumer treats the value as falsy and falls back —
-- `team.coach || team.name` (schedule-publish, results email), `team.coach ?? ''` (exports,
-- payment reminders, resend-access). So this rewrite changes NO user-visible behaviour. It is
-- worth doing anyway: a column with two spellings of "absent" is a trap for the next person who
-- writes `WHERE coach IS NULL` (which silently missed 17 of 21 prod teams) or `WHERE coach = ''`.
--
-- SAFETY
-- Touches only rows that are already blank — a name is never altered or lost. Whitespace-only
-- values are included via trim() so " " normalizes too (prod has none; this is future-proofing).
-- Re-runnable: a second run matches zero rows. Prod: 17 rows. Dev: 0 rows (already NULL).
--
-- PAIRED CODE FIX (same unit of work): the `?? ''` coercion is now `|| null`, so the split
-- cannot re-open. The coaches self-serve PATCH route still rejects an empty submitted name with
-- a 400 — that stays, but as a PRODUCT rule (a coach shouldn't blank their own team's name),
-- no longer as a schema constraint.
-- ============================================================

BEGIN;

UPDATE teams
   SET coach = NULL
 WHERE coach IS NOT NULL
   AND trim(coach) = '';

COMMIT;

-- Verification (expect blank_after_trim = 0 in BOTH envs):
--   SELECT count(*) FILTER (WHERE coach IS NOT NULL AND trim(coach) = '') AS blank_after_trim,
--          count(*) FILTER (WHERE coach IS NULL)                          AS nulls,
--          count(*)                                                       AS total
--     FROM teams;
