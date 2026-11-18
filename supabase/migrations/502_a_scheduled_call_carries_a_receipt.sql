-- 502 · A scheduled call carries a receipt (Board Ready trust close-out call 21; owner chose option B, 2026-11-18).
--
-- WHY. "Restore to a New Project" copies the pg_cron jobs AND both Vault keys and starts the jobs at once, so the copy calls
-- the LIVE site's job routes with a valid x-cron-secret (docs/agents/ops/BACKUPS_AND_RESTORE.md, the trap section). The
-- secret proves only "someone who has the key"; it never proved "the live database's own scheduler".
--
-- NOW. Every scheduled call carries a one-use receipt that THIS database wrote in the same transaction that queued the call
-- (pg_net sends a queued request only after its transaction commits, so the receipt is always readable before the call
-- lands). The app runs a machine call only after it consumes a receipt that its OWN database holds, for that route's path,
-- issued in the last 15 minutes, and not used before (lib/cron-auth.ts scheduledCall: one conditional UPDATE, so two calls
-- with one receipt cannot both run). A restored copy writes its receipts into the COPY, so the live site refuses every call
-- it makes, in any minute; a leaked secret alone cannot run a job; no call runs twice.
--
-- The rest of app_cron_http_tick is unchanged from mig 183 (Vault read, error heartbeat, 27-second async post, heartbeat).
-- Each tick also clears its own receipts older than two days, so the table stays under a thousand rows (the 5-minute job alone keeps ~576).
--
-- ORDER on production, load-bearing: apply this FIRST, then ship the code. Old code ignores the extra header, so this is
-- harmless on its own. Code first would refuse EVERY scheduled job until this lands (each refusal opens an error-log issue,
-- which emails; check:manual-prod-migrations --promote also blocks a promote while this is pending).
-- Idempotent (create table if not exists; create or replace function).

begin;

create table if not exists public.cron_call_receipts (
  id        uuid primary key default gen_random_uuid(),
  job_name  text not null,
  path      text not null,
  issued_at timestamptz not null default now(),
  used_at   timestamptz
);

-- The tick purges by (job_name, issued_at); the app reads by id (the primary key).
create index if not exists cron_call_receipts_job_issued_idx on public.cron_call_receipts (job_name, issued_at);

alter table public.cron_call_receipts enable row level security;
-- No policies: the tick (SECURITY DEFINER, owner postgres) writes it and the app's service role consumes it. Nobody else.
-- (service_role also inserts on DEV only: scripts/lib/billing-walk-fixture.mjs fireJob writes its own receipt to fire a job by hand.)
revoke all on public.cron_call_receipts from public, anon, authenticated;
grant select, insert, update, delete on public.cron_call_receipts to service_role;

create or replace function public.app_cron_http_tick(p_job_name text, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base_url text;
  v_secret   text;
  v_receipt  uuid;
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

  -- The receipt this call carries. Old ones (used or not) go here too: two days is far past the app's 15-minute window.
  delete from public.cron_call_receipts where job_name = p_job_name and issued_at < now() - interval '2 days';
  insert into public.cron_call_receipts (job_name, path) values (p_job_name, p_path) returning id into v_receipt;

  -- Async dispatch; the response (if any) lands in net._http_response and is not consulted.
  -- Timeout stays under the app's ~30s serverless ceiling.
  perform net.http_post(
    url := v_base_url || p_path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret,
      'x-cron-receipt', v_receipt::text
    ),
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

commit;
