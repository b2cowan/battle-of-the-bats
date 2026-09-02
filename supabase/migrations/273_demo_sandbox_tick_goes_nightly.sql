-- 273_demo_sandbox_tick_goes_nightly.sql
--
-- Reschedules the tournament "See it live" demo's tick from every 2 minutes to once nightly,
-- matching the coach sandbox's own `coach-sandbox-tick` schedule (migration 226).
--
-- Why: the tournament demo no longer simulates a live-scoring cycle (see
-- docs/projects/active/TOURNAMENT_SANDBOX_DAILY_SNAPSHOT_PLAN.md) — `resolveDemoState(now)` is
-- now a fixed daily snapshot that ignores the hour and minute of `now` entirely, so running the
-- reconcile more than once a day writes the same rows it already wrote. The 2-minute cadence
-- (migration 224) existed solely to make a live scoreboard convincing; there is no illusion left
-- to maintain, and the cadence was also a real, measurable share of the app's request volume —
-- both the cron dispatch itself and, separately, every visitor's browser polling
-- `/api/sandbox/live-beat` (removed in this same change) every ten seconds.
--
-- 08:10 UTC — ten minutes before the coach sandbox's own 08:20 UTC nightly tick (migration 226),
-- so the two never contend for the same minute. Adds NO tables and NO columns, so — like migs 122,
-- 183, 224 and 226 before it — `check:migrations` CANNOT see this change; apply it to prod
-- deliberately, as part of this change's release step.
--
-- `cron.schedule(name, ...)` upserts by (jobname, username), so re-invoking it with the SAME
-- jobname and a NEW schedule string replaces the existing schedule in place — no `cron.unschedule`
-- call is needed first.

select cron.schedule(
  'demo-sandbox-tick',
  '10 8 * * *',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('demo_sandbox_tick', '/api/platform-admin/demo-sandbox-tick'); $job$
);
