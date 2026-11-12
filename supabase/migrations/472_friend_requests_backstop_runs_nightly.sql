-- 472_friend_requests_backstop_runs_nightly.sql
--
-- WATCHED AUTOMATION. Schedules the nightly run of the friend-request backstop (Board Ready Stage 1 Part 2; ruling A12,
-- owner 2026-11-10: "when the club marks the season finished, or 60 days after its last day if it never does. The
-- deletion is built in this stage, because the form promises it"; the build prompt names "the existing pg_cron tick").
--
-- What it does each night: public.league_friend_requests_backstop() (mig 471) deletes every friend request, and clears
-- every friend code, of each season that is not marked finished and whose last day was more than 60 days ago. It is
-- pure SQL inside the database (no app call, no email), idempotent (a swept season has nothing left), and touches
-- nothing else.
--
-- Adds NO tables and NO columns: **the check:migrations drift gate CANNOT detect prod missing this migration**; it is
-- tracked in MANUAL_PROD_STEPS.json. ⚠ ORDER ON PRODUCTION: after mig 471. The pure-SQL pattern is mig 122's
-- observability-retention-sweep.
--
-- 08:25 GMT = 4:25 a.m. in Toronto in summer, 3:25 a.m. in winter. cron.schedule(name, ...) upserts by
-- (jobname, username), so re-applying is idempotent.

select cron.schedule(
  'league-friend-requests-backstop',
  '25 8 * * *',
  $job$ set statement_timeout = '60s'; select public.league_friend_requests_backstop(); $job$
);
