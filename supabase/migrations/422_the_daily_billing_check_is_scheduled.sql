-- 422_the_daily_billing_check_is_scheduled.sql
--
-- WATCHED AUTOMATION. Schedules the daily comparison with Stripe (Plans & pricing Stage 0, Part 11, S6; owner's go
-- 2026-11-01 in conversation, with "schedule on dev too"): once a day the database calls
-- POST /api/platform-admin/billing-drift-daily on the app, the same way migrations 395 and 408 call their jobs.
-- The production job is a manual prod step (MANUAL_PROD_STEPS.json), created only AFTER the code is serving on production
-- and mig 421 is applied.
--
-- What it does each day (lib/billing-drift.ts): reads every Stripe subscription (one paged pass) and every billing record
-- of ours that follows one, and records where they disagree (status, plan, monthly/yearly, renewal date, an unknown price,
-- a record whose subscription Stripe does not have, a subscription Stripe bills that nothing of ours follows) in
-- stripe_billing_drift_checks (mig 421). When anything differs, or Stripe could not be read, one email to the owner's
-- inbox, at most once a day per outcome. ⚠ IT NEVER REPAIRS: no club, portal or Stripe object is written.
--
-- Adds NO tables and NO columns: **the check:migrations drift gate CANNOT detect prod missing this migration**; it is
-- tracked in MANUAL_PROD_STEPS.json. Reuses migration 183's public.app_cron_http_tick(job, path). Until the deployed app
-- carries the route, the tick is harmless (a 404 nobody consults).
--
-- 12:15 GMT = 8:15 a.m. in Toronto in summer, 7:15 a.m. in winter, beside the other daily jobs (each tick is an async
-- pg_net call, so they do not queue on each other). cron.schedule(name, ...) upserts by (jobname, username), so
-- re-applying is idempotent.

select cron.schedule(
  'billing-drift-daily',
  '15 12 * * *',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('billing_drift_tick', '/api/platform-admin/billing-drift-daily'); $job$
);
