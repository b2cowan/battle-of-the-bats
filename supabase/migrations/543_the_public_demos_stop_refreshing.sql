-- 543 — The two nightly demo refresh jobs no longer run.
--
-- Retire the public demos, Phase 2 (docs/projects/active/RETIRE_PUBLIC_DEMOS_PLAN.md; owner ruling
-- 2026-11-25, BUSINESS_DECISIONS.md "Both public demos are RETIRED").
--
-- Unschedules the tournament demo's tick (scheduled in 224, made nightly in 273) and the coach demo's
-- tick (scheduled in 226). Both post to platform-admin routes that Phase 3 deletes, and the demo
-- data they refresh is deleted in Phase 2, so they go first.
--
-- It also removes the four heartbeat rows those jobs wrote (two dispatch rows, written by
-- app_cron_http_tick, and two arrival rows, written by lib/demo-sandbox-heartbeat.ts). Left behind,
-- the platform-admin job-freshness panel would show them going stale forever.
--
-- Re-runnable: each job is unscheduled only if present; the delete is a no-op the second time.
-- No table, column or function changes.

do $$
declare
  v_job text;
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    foreach v_job in array array['demo-sandbox-tick', 'coach-sandbox-tick'] loop
      if exists (select 1 from cron.job where jobname = v_job) then
        perform cron.unschedule(v_job);
      end if;
    end loop;
  end if;
end;
$$;

delete from public.observability_cron_heartbeat
where job_name in ('demo_sandbox_tick', 'demo_sandbox_reconcile', 'coach_sandbox_tick', 'coach_sandbox_reconcile');

-- Verify:
--   select count(*) from cron.job where jobname in ('demo-sandbox-tick', 'coach-sandbox-tick');  -> 0
--   select count(*) from public.observability_cron_heartbeat
--     where job_name in ('demo_sandbox_tick', 'demo_sandbox_reconcile', 'coach_sandbox_tick', 'coach_sandbox_reconcile');  -> 0
