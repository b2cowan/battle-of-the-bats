-- 470_a_waiting_two_step_reset_is_run_on_the_hour.sql
--
-- WATCHED AUTOMATION. Schedules the hourly run of support's waiting two-step resets (Board Ready · two-step sign-in,
-- Part 3; owner's go 2026-11-11 in conversation: "the timed reset runs from the existing scheduled-job path", hourly as
-- recommended, so "24 hours" is 24 to 25). Once an hour the database calls
-- POST /api/platform-admin/two-step-resets-hourly on the app, the same way migrations 395, 408 and 422 call their jobs.
--
-- What it does each hour (lib/two-step-support-reset.ts `runDueResets`): every reset whose person confirmed it, whose
-- 24 hours have passed, and that is neither held, cancelled nor done, is run: the platform audit line is written FIRST,
-- then the person is signed out everywhere and every authenticator and backup code is removed (lib/two-step-reset.ts),
-- then the person is emailed. It is idempotent (a done reset is never run again) and refuses a held or cancelled one.
--
-- Adds NO tables and NO columns: **the check:migrations drift gate CANNOT detect prod missing this migration**; it is
-- tracked in MANUAL_PROD_STEPS.json. Reuses migration 183's public.app_cron_http_tick(job, path). Until the deployed app
-- carries the route, the tick is harmless (a 404 nobody consults). The production job is created only AFTER the code is
-- serving on production and mig 469 is applied.
--
-- At 7 minutes past each hour (clear of the daily jobs' quarter hours). cron.schedule(name, ...) upserts by
-- (jobname, username), so re-applying is idempotent.

select cron.schedule(
  'two-step-resets-hourly',
  '7 * * * *',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('two_step_resets_tick', '/api/platform-admin/two-step-resets-hourly'); $job$
);
