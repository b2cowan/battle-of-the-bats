-- 408_the_portal_free_time_daily_job_is_scheduled.sql
--
-- WATCHED AUTOMATION. Schedules the Coaches Portal free-time daily job (Support console Stage 4b; owner 2026-10-28,
-- asked for in conversation: "go with b", the Overview band AND email reminders): once a day the database calls
-- POST /api/platform-admin/portal-free-time-daily on the app, the same way migration 395 calls the online-payments job.
-- NOT APPLIED when written: the yes to switch it on (dev first) is asked for in the build's hand-off; the production job
-- is a manual prod step (MANUAL_PROD_STEPS.json), created only AFTER the code is serving on production and mig 407 is
-- applied.
--
-- What it does each day (lib/portal-free-time-reminders.ts): finds every Coaches Portal staff gave free time whose
-- free time is in its last 14 days, and emails the portal's owner once at 14 days and once at 3 days before it runs out
-- ("runs through" the last free day; nothing is deleted; one Keep Premium button). Each is claimed with a once-only stamp
-- (mig 407) BEFORE it is sent, so a second run sends nothing twice. No portal in its last 14 days: a few reads, no email.
--
-- Adds NO tables and NO columns: **the check:migrations drift gate CANNOT detect prod missing this migration**; it is
-- tracked in MANUAL_PROD_STEPS.json. Reuses migration 183's public.app_cron_http_tick(job, path). Until the deployed app
-- carries the route, the tick is harmless (a 404 nobody consults).
--
-- 12:15 GMT = 8:15 a.m. in Toronto in summer, 7:15 a.m. in winter: in the coach's morning. cron.schedule(name, ...)
-- upserts by (jobname, username), so re-applying is idempotent.

select cron.schedule(
  'portal-free-time-daily',
  '15 12 * * *',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('portal_free_time_tick', '/api/platform-admin/portal-free-time-daily'); $job$
);
