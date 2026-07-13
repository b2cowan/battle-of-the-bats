-- 183_scheduled_http_ticks.sql
--
-- Scheduled HTTP ticks (SCHEDULED_JOBS_WIRING_PLAN.md): pg_cron + pg_net call the app's
-- machine-authorized trigger routes on a timer —
--   • Coach Insights weekly digest  → POST /api/platform-admin/insights-digest
--   • Dues reminders daily sweep    → POST /api/platform-admin/dues-reminders
--
-- Adds NO tables/columns (⚠️ like mig 122, the check:migrations drift gate CANNOT detect
-- prod missing this migration — apply to prod manually before/with the code promote, and
-- track PROD-PENDING in the plan doc).
--
-- Design (mirrors mig 122's discipline):
--   • One wrapper function, public.app_cron_http_tick(job, path): reads the target base URL
--     and the shared secret from Supabase Vault (names below), POSTs via pg_net (async — the
--     DB never blocks on the app), and heartbeats into observability_cron_heartbeat.
--   • Heartbeat discipline: last_run_at is bumped ONLY when the tick was dispatched; any
--     failure (Vault unset, pg_net error) upserts status='error' + error_detail WITHOUT
--     touching last_run_at — surfacing on the platform-admin observability freshness chip
--     ("· job error"), which reads every row of that table.
--   • The tick's "ok" means "HTTP request dispatched", NOT "sweep succeeded" — pg_net is
--     fire-and-forget. The app-side truth is the platform audit log (each sweep writes
--     insights_digest_sweep / dues_reminders_sweep entries with counts).
--   • cron.schedule(name, ...) upserts by (jobname, username) — idempotent on re-apply.
--     Schedules are GMT on Supabase: send times drift ±1h with Toronto DST (accepted).
--
-- Per-environment setup (NOT in this migration — secrets never live in the repo; run once
-- per project in the SQL editor, and set CRON_SECRET to the same value in the app env):
--   select vault.create_secret('<https://app-base-url>', 'app_cron_base_url');
--   select vault.create_secret('<random-secret>',        'app_cron_secret');
-- Until both exist, ticks no-op with a status='error' heartbeat (visible, harmless).

-- pg_net: Supabase's async HTTP extension (pg_cron itself was installed by mig 122).
create extension if not exists pg_net;

create or replace function public.app_cron_http_tick(p_job_name text, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base_url text;
  v_secret   text;
begin
  select decrypted_secret into v_base_url from vault.decrypted_secrets where name = 'app_cron_base_url';
  select decrypted_secret into v_secret   from vault.decrypted_secrets where name = 'app_cron_secret';

  if v_base_url is null or v_secret is null then
    insert into public.observability_cron_heartbeat (job_name, status, error_detail)
    values (p_job_name, 'error', 'app_cron_base_url / app_cron_secret not set in Vault — tick skipped')
    on conflict (job_name) do update set
      status = 'error',
      error_detail = excluded.error_detail;
    return;
  end if;

  -- Async dispatch; the response (if any) lands in net._http_response and is not consulted.
  -- Timeout stays under the app's ~30s serverless ceiling.
  perform net.http_post(
    url := v_base_url || p_path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 27000
  );

  insert into public.observability_cron_heartbeat (job_name, last_run_at, status, error_detail)
  values (p_job_name, now(), 'ok', null)
  on conflict (job_name) do update set
    last_run_at = excluded.last_run_at,
    status = 'ok',
    error_detail = null;

exception when others then
  insert into public.observability_cron_heartbeat (job_name, status, error_detail)
  values (p_job_name, 'error', left(sqlerrm, 2000))
  on conflict (job_name) do update set
    status = 'error',
    error_detail = excluded.error_detail;
end;
$$;

revoke execute on function public.app_cron_http_tick(text, text) from public, anon, authenticated;
grant execute on function public.app_cron_http_tick(text, text) to postgres, service_role;

-- Sunday 23:00 UTC = 6pm Toronto (EST) / 7pm (EDT) — the "Sunday evening" digest.
select cron.schedule(
  'insights-digest-weekly',
  '0 23 * * 0',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('insights_digest_tick', '/api/platform-admin/insights-digest'); $job$
);

-- Monday 13:00 UTC catch-up: if Sunday's tick was lost (deploy window, app down), the
-- digest's 6-day dedupe means only the MISSED teams get served here — never a duplicate.
select cron.schedule(
  'insights-digest-catchup',
  '0 13 * * 1',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('insights_digest_tick', '/api/platform-admin/insights-digest'); $job$
);

-- Daily 13:30 UTC = 8:30am Toronto (EST) / 9:30am (EDT). Sent-stamps + the 7-day resend
-- cooldown make a lost or doubled tick harmless.
select cron.schedule(
  'dues-reminders-daily',
  '30 13 * * *',
  $job$ set statement_timeout = '60s'; select public.app_cron_http_tick('dues_reminders_tick', '/api/platform-admin/dues-reminders'); $job$
);
