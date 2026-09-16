-- 299 · A review is the coach's own record, not an audit trail (development lifecycle
-- re-evaluation stage 3 · Player follow-up, owner ruling 2026-09-16): "we don't want to feed
-- mistakes to parents either — this is a custom portal for a coach, and the coach enters and
-- reads the data, so they should be able to modify it to their liking." Mig 295 built goal
-- reviews append-only on purpose ("a mistaken review is answered by another review"); this
-- reverses that one call, on this one table, in light of the handout the history now feeds
-- (Player stage 3, 2026-09-15) making a stale mistake worse to leave standing than to correct.
--
-- ORDER: no order dependency on 297/298 — a policy add on an unrelated table. Apply to dev with
-- `node scripts/apply-migration-api.mjs supabase/migrations/299_a_review_is_the_coachs_own_record.sql`,
-- then `npm run refresh:snapshots`. PROD-OWED (RLS is schema-invisible to check:migrations —
-- declared in MANUAL_PROD_STEPS.json).
--
-- WHAT CHANGES
--   rep_development_goal_reviews — adds UPDATE and DELETE RLS policies, same predicate as every
--   other development-writer policy on this table (and the observations precedent): a head coach,
--   or any coach holding the `development` capability, on the review's own team. No schema change
--   (no column, no CHECK, no index) — policy only. Also corrects the table's COMMENT, which mig 295
--   left claiming "No UPDATE/DELETE policy on purpose" — `\d+` would otherwise keep telling that
--   story after this file makes it false.
--
-- WHAT DOES NOT CHANGE
--   The route still recomputes the goal's `status` (and next-review date) from whichever review is
--   now the LATEST remaining one after an edit or a delete — the same "status is the latest
--   review's" rule mig 295 established for the append path (dictionary gotcha 5), just re-run
--   after a correction can move which review that is. No review left = the goal's pre-review
--   default ('working', no next review named).

begin;

drop policy if exists "development writers can update rep_development_goal_reviews" on public.rep_development_goal_reviews;
create policy "development writers can update rep_development_goal_reviews"
  on public.rep_development_goal_reviews for update
  using (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')))
  with check (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')));

drop policy if exists "development writers can delete rep_development_goal_reviews" on public.rep_development_goal_reviews;
create policy "development writers can delete rep_development_goal_reviews"
  on public.rep_development_goal_reviews for delete
  using (team_id in (
    select team_id from public.rep_team_coaches
    where user_id = auth.uid() and (coach_role = 'head_coach' or (capabilities->>'development') = 'true')));

-- Mig 295's table comment claimed "No UPDATE/DELETE policy on purpose" — no longer true; corrected
-- here rather than editing that applied file (/review 2026-09-16: a stale claim in `\d+` output).
comment on table public.rep_development_goal_reviews is
  'Dated review events on a goal (plan §7 Goal review; F08): the status chosen (required), an optional note, the next review date and evidence references. The goal''s status is always the LATEST review''s, written in the same step — re-derived after an edit or a delete too (mig 299). Editable/removable by a development writer on the review''s own team (mig 299, owner ruling 2026-09-16) — no longer append-only.';

commit;

-- Verify (dev and, later, prod — the gates see the tables, columns, CHECKs and indexes; they
-- cannot see the policies):
--   select tablename, policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'rep_development_goal_reviews'
--    order by cmd;
--   → 4 rows: 2 SELECT + INSERT + UPDATE + DELETE (matches rep_player_observations' shape now).
