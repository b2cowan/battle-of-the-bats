-- 224_demo_sandbox_tick_schedule.sql
--
-- Schedules the "See it live" demo sandbox tick (TOURNAMENT_ADMIN_SANDBOX_PLAN.md, slice S5).
--
-- The route has existed since S5 and is ready; nothing was calling it, so the demo only moved when
-- somebody ran the tick by hand. That is the one failure the plan calls worse than having no demo:
-- a frozen sandbox still renders, it just shows a "live" semifinal that finished hours ago — on the
-- single surface we point strangers at as proof the product works.
--
-- Adds NO tables and NO columns. Like migs 122 and 183, that means **the check:migrations drift
-- gate CANNOT detect prod missing this migration** — apply it to prod deliberately, as part of the
-- sandbox's production release step, and track it as PROD-PENDING in the plan doc.
--
-- Reuses migration 183's `public.app_cron_http_tick(job, path)` wrapper wholesale: Vault-held base
-- URL + shared secret, async dispatch via pg_net, and a heartbeat row in
-- observability_cron_heartbeat that the platform-admin observability freshness chip already reads.
-- Nothing new to learn and nothing new to operate.
--
-- ── Why every two minutes ───────────────────────────────────────────────────────────────────
--
-- The demo's whole claim is that it is running, not recorded, and the plan's definition of done is
-- that "a cold visitor sees a live score move within two minutes". The cadence has to be at least
-- as fast as the promise, so worst-case staleness is bounded by it. Two minutes also sits
-- comfortably above the public pages' own ~30-second refresh, so a visitor watching a score sees it
-- move on its own rather than only on reload.
--
-- The cost is nearly nothing: the reconcile is diff-only, so a run where the clock implies no
-- change reads fifteen games and writes zero rows. It is also stateless and self-healing, so a
-- missed run is not a missed step — the next one computes the state from the clock and lands on it.
--
-- ── Safe to run where the sandbox does not exist ────────────────────────────────────────────
--
-- `reconcileDemoTournament()` treats "not seeded in this environment" as a normal, successful
-- no-op (phase null, zero changes) rather than an error. So this schedule is harmless on an
-- environment that has no demo org yet — and the day one is seeded, it simply starts working.
--
-- cron.schedule(name, ...) upserts by (jobname, username), so re-applying this migration is
-- idempotent. Schedules are GMT on Supabase.

select cron.schedule(
  'demo-sandbox-tick',
  '*/2 * * * *',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('demo_sandbox_tick', '/api/platform-admin/demo-sandbox-tick'); $job$
);
