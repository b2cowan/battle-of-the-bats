-- 133: drop the stale score-submission-source CHECK so forfeits can be recorded.
--
-- Forfeit results write score_submission_source = 'forfeit' (added for FP-5 / J1-091),
-- but the CHECK created in migration 068 still only allowed
-- scorekeeper | admin_results | system — so submitting a forfeit failed with
--   new row for relation "games" violates check constraint "games_score_submission_source_check"
--
-- The allowed set is governed by the app-level ScoreSubmissionSource enum
-- (lib/types.ts) and written only via the scoring service; the Data Dictionary
-- already documents this column as "app enum, no DB CHECK". This drops the drifted
-- constraint so the database matches that design and stops breaking whenever the
-- enum grows. Safe + reversible (re-add the CHECK to restore).

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_score_submission_source_check;
