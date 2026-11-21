-- 516_waiting_family_files_are_swept_every_six_hours.sql
--
-- WATCHED AUTOMATION — the owner's yes 2026-11-20 (Board Ready Stage 4 Part 3, call 1: "go with your recommendations"; AGENCY_RULES:
-- shared automation changes only on the owner's word in the conversation; its own commit). Applied nowhere yet: on production
-- only AFTER the Parts 1–3 code is serving (below). Schedules the sweep of family files that never joined a sign-up (Board Ready
-- Stage 4 Part 2; ruling 9: "a file never attached to a sign-up is deleted within a day"). Every 6 hours the database
-- calls POST /api/platform-admin/club-form-files-sweep on the app, the same way migrations 395, 408, 422 and 470 call
-- their jobs (migration 183's public.app_cron_http_tick(job, path); 502's one-use receipt).
--
-- What it does each run (lib/club-form-family.ts `sweepWaitingFiles`): every club_form_files row still 'pending' more than
-- 12 hours after it was uploaded is deleted, its stored file first. Idempotent. Without this schedule the sweep still
-- runs a few files at a time on each family upload (a backstop that stops when uploads stop), and by hand ("run_jobs").
-- Board Ready Stage 4 Part 3 widened the SAME run (owner call 1, "as recommended" 2026-11-20: one schedule, not two):
-- the retention clock (ruling 10; mig 518 `club_form_retention_sweep`: family files and health answers removed 90 days
-- after a season is marked finished, or 120 days after its last day when it never is) and the deletion of every stored
-- file on mig 518's removal list (a deleted registration's, a season delete's, a replaced file's). Until this schedule
-- exists NOTHING is removed by the clock, so the Privacy Policy's retention sentence waits for it.
--
-- Adds NO tables and NO columns: the check:migrations drift gate CANNOT detect prod missing it (MANUAL_PROD_STEPS.json).
-- Until the deployed app carries the route the tick is harmless (a 404 nobody consults). On production, create it only
-- AFTER the Part 2 code is serving. At 37 minutes past every sixth hour (clear of the other jobs' minutes).
-- cron.schedule(name, ...) upserts by (jobname, username), so re-applying is idempotent.

select cron.schedule(
  'club-form-files-sweep',
  '37 */6 * * *',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('club_form_files_sweep', '/api/platform-admin/club-form-files-sweep'); $job$
);
