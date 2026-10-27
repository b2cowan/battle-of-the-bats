-- 395_the_online_payments_daily_job_is_scheduled.sql
--
-- WATCHED AUTOMATION. Schedules the online-payments daily job (Club Tier Stage 12d-1 Part 4; owner 2026-10-27, the build's
-- ask 2: "one new daily scheduled job"): once a day the database calls POST /api/platform-admin/stripe-fees-daily on the
-- app, the same way the dues reminders and the club-address check are called. NOT APPLIED when written (2026-10-27): the
-- owner's yes to switch it on, on DEV, is asked for in the build's hand-off; the production job is a manual prod step
-- (MANUAL_PROD_STEPS.json), created at the release that ships 12d-1, after its code is serving.
--
-- What it does each day (app/api/platform-admin/stripe-fees-daily/route.ts), every step decided from the rows and a
-- once-only stamp, so a second run sends and bills nothing twice:
--   1. the email to the person who answers a card dispute, three days before it is due, while unanswered (one per dispute);
--   2. a re-read from Stripe of recent disputes for a fee Stripe charged FieldLogicHQ after the events stopped;
--   3. a retry of a Stripe fee whose billing failed (at most 5 tries before platform admin's Retry);
--   4. a re-read of each club's own Stripe-fees invoice still open (paid / void);
--   5. on the 1st (or the first run after it): one invoice per club with no subscription invoice to ride on, for last
--      month's Stripe fees, emailed by us;
--   6. the ONE reminder on such an invoice past its due date. Nothing switches off by itself.
-- Stripe calls: one per dispute re-read and per open invoice, plus the monthly invoices. No club, no dispute and no fee:
-- a few reads of small tables and one audit row.
--
-- Adds NO tables and NO columns: **the check:migrations drift gate CANNOT detect prod missing this migration**; it is
-- tracked in MANUAL_PROD_STEPS.json. Reuses migration 183's public.app_cron_http_tick(job, path). Until the deployed app
-- carries the route, the tick is harmless (a 404 nobody consults).
--
-- 11:15 GMT = 7:15 a.m. in Toronto in summer, 6:15 a.m. in winter: after the 1st has begun in every Canadian zone, so the
-- monthly invoice goes out on the 1st. cron.schedule(name, ...) upserts by (jobname, username), so re-applying is idempotent.

select cron.schedule(
  'stripe-fees-daily',
  '15 11 * * *',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('stripe_fees_tick', '/api/platform-admin/stripe-fees-daily'); $job$
);
