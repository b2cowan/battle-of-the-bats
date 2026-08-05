-- 226_coach_sandbox_tick_schedule.sql
--
-- Schedules the Coach Sandbox nightly re-anchor (COACH_SANDBOX_SEASON_PHASES_PLAN.md, Phase 1).
--
-- The coach demo's promise is a calendar, not a ticker: the 11U's tryout is always TODAY and the
-- 12U's next game always THIS Saturday. A date goes stale exactly once a day, so this runs once a
-- night (04:20 Toronto in summer; the hour drifts with DST and nothing cares — any small hour
-- works) instead of the tournament tick's every-two-minutes.
--
-- Adds NO tables and NO columns. Like migs 122/183/224, that means **the check:migrations drift
-- gate CANNOT detect prod missing this migration** — apply it to prod deliberately, as part of
-- the coach sandbox's production release step, and track it as PROD-PENDING in the plan doc.
--
-- Reuses migration 183's `public.app_cron_http_tick(job, path)` wrapper wholesale: Vault-held
-- base URL + shared secret, async dispatch via pg_net, and a dispatch heartbeat row the
-- platform-admin freshness chip already reads. The job also writes its own ARRIVAL heartbeat
-- (`coach_sandbox_reconcile`, in lib/demo-coach-reconcile-core.ts) because "dispatched" is not
-- "arrived" — the 2026-08-03 tournament-demo incident, learned once, applied here from day one.
--
-- Safe to run where the sandbox does not exist: `reconcileCoachSandbox()` treats "not seeded in
-- this environment" as a normal, successful no-op, so the schedule is harmless until the seed
-- lands and simply starts working that day.
--
-- cron.schedule(name, ...) upserts by (jobname, username), so re-applying is idempotent.
-- Schedules are GMT on Supabase.

select cron.schedule(
  'coach-sandbox-tick',
  '20 8 * * *',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('coach_sandbox_tick', '/api/platform-admin/coach-sandbox-tick'); $job$
);
