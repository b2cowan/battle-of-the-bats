-- Migration 122 — Observability Phase 4: pg_cron rollup + retention + alert flags
-- See docs/projects/active/OBSERVABILITY_ERROR_TRACKING_PLAN.md §14 (owner-approved 2026-06-10).
--
-- Adds NO tables/columns (⚠️ the check:migrations drift gate CANNOT detect prod missing this
-- migration — apply to prod manually before promoting the code to master):
--   1. pg_cron extension + the grants Supabase's install doc mandates for the postgres role.
--   2. obs_fold_metrics()    — atomically folds request_metrics_raw → request_metrics_rollup
--                              (5-min buckets), drains staging, stamps the heartbeat.
--   3. obs_retention_sweep() — reopens expired snoozes, purges error_events >30d (+ recomputes
--                              distinct_org_count for affected groups), ages out resolved
--                              error_groups >90d, trims rollups >1y, prunes cron run history >7d.
--   4. Two cron jobs (fold every 5 min; sweep nightly 08:15 UTC ≈ 3–4 am Eastern; pg_cron
--                              schedules are GMT on Supabase). cron.schedule(name, …) is a
--                              named upsert, so re-applying this file is idempotent.
--   5. record_error_event    — DROP + recreate RETURNS jsonb (was uuid; a return type cannot be
--                              changed in place) adding the Phase-4 alert transition flags.
--                              Backward-compatible: the deployed caller ignores the return value.
--
-- Heartbeat discipline: last_run_at is bumped ONLY on success. Failures upsert status='error' +
-- error_detail WITHOUT touching last_run_at, so persistent failures surface as freshness-chip
-- staleness instead of a false-fresh green chip.
--
-- Both job functions are SECURITY DEFINER (owner postgres; needed so the service-role-called
-- manual sweep can prune cron.job_run_details) with a pinned empty search_path and EXECUTE
-- revoked from PUBLIC/anon/authenticated (service_role + owner only). The observability tables
-- stay RLS-enabled-no-policies; postgres (owner, BYPASSRLS) and service_role both bypass.

-- ── 1. pg_cron ──────────────────────────────────────────────────────────────────
create extension if not exists pg_cron;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- ── 2. obs_fold_metrics ─────────────────────────────────────────────────────────
-- One atomic statement: DELETE raw → aggregate into 5-min buckets → upsert rollup. Rows
-- committed after the statement snapshot simply survive to the next run (writer is insert-only).
-- Bucket keys are pre-normalized with the SAME coalesce as the unique index, then mapped back to
-- NULL via nullif on insert: two raw rows whose keys differ only as NULL-vs-sentinel would
-- otherwise collide inside one INSERT (SQLSTATE 21000) and wedge the fold forever.
create or replace function public.obs_fold_metrics()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_folded bigint := 0;
  v_upserted bigint := 0;
begin
  with moved as (
    delete from public.request_metrics_raw
    returning flushed_at, env, route, org_id, call_count, error_count
  ),
  agg as (
    select
      to_timestamp(floor(extract(epoch from flushed_at) / 300) * 300) as bucket_start,
      env,
      coalesce(route, '') as route_key,
      coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid) as org_key,
      sum(call_count) as call_count,
      sum(error_count) as error_count
    from moved
    group by 1, 2, 3, 4
  ),
  ins as (
    insert into public.request_metrics_rollup (bucket_start, env, route, org_id, call_count, error_count)
    select
      bucket_start, env,
      nullif(route_key, ''),
      nullif(org_key, '00000000-0000-0000-0000-000000000000'::uuid),
      call_count, error_count
    from agg
    on conflict (bucket_start, env, coalesce(route, ''), coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid))
    do update set
      call_count  = public.request_metrics_rollup.call_count  + excluded.call_count,
      error_count = public.request_metrics_rollup.error_count + excluded.error_count
    returning 1
  )
  select (select count(*) from moved), (select count(*) from ins)
    into v_folded, v_upserted;

  insert into public.observability_cron_heartbeat (job_name, last_run_at, rows_folded, rows_purged, status, error_detail)
  values ('metrics_fold', now(), v_folded, null, 'ok', null)
  on conflict (job_name) do update set
    last_run_at = excluded.last_run_at,
    rows_folded = excluded.rows_folded,
    status = 'ok',
    error_detail = null;

  return jsonb_build_object('job', 'metrics_fold', 'status', 'ok', 'rows_folded', v_folded, 'buckets_upserted', v_upserted);
exception when others then
  -- Failure path: record the error WITHOUT bumping last_run_at (staleness = the alarm signal).
  insert into public.observability_cron_heartbeat (job_name, status, error_detail)
  values ('metrics_fold', 'error', left(sqlerrm, 2000))
  on conflict (job_name) do update set
    status = 'error',
    error_detail = excluded.error_detail;
  return jsonb_build_object('job', 'metrics_fold', 'status', 'error', 'error', left(sqlerrm, 2000));
end;
$$;

revoke execute on function public.obs_fold_metrics() from public, anon, authenticated;
grant execute on function public.obs_fold_metrics() to service_role;

-- ── 3. obs_retention_sweep ──────────────────────────────────────────────────────
create or replace function public.obs_retention_sweep()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reopened bigint := 0;
  v_events_purged bigint := 0;
  v_affected uuid[] := '{}';
  v_recounted bigint := 0;
  v_groups_purged bigint := 0;
  v_rollup_trimmed bigint := 0;
  v_cron_purged bigint := 0;
begin
  -- (a) Reopen expired snoozes (closes the Phase-2 read-time-only deferral).
  update public.error_groups
     set status = 'open', snooze_until = null
   where status = 'snoozed' and snooze_until is not null and snooze_until < now();
  get diagnostics v_reopened = row_count;

  -- (b) Purge raw events past 30 days, collecting which groups lost rows.
  with purged as (
    delete from public.error_events
     where occurred_at < now() - interval '30 days'
    returning group_id
  )
  select count(*), coalesce(array_agg(distinct group_id), '{}'::uuid[])
    into v_events_purged, v_affected
    from purged;

  -- Recompute distinct_org_count for exactly those groups in a SEPARATE statement (a CTE
  -- recount would share the DELETE's snapshot and still see the deleted rows; this statement
  -- sees the same transaction's own deletes). Meaning is now consistently "distinct orgs among
  -- retained events" — see DATA_DICTIONARY.md.
  update public.error_groups g
     set distinct_org_count = (
       select count(distinct e.org_id)
         from public.error_events e
        where e.group_id = g.id and e.org_id is not null
     )
   where g.id = any(v_affected);
  get diagnostics v_recounted = row_count;

  -- (c) Age out groups resolved more than 90 days ago (FK cascades their remaining events).
  --     Ignored groups are kept indefinitely — they are deliberate triage decisions.
  delete from public.error_groups
   where status = 'resolved' and resolved_at is not null and resolved_at < now() - interval '90 days';
  get diagnostics v_groups_purged = row_count;

  -- (d) Trim chart rollups past 1 year.
  delete from public.request_metrics_rollup where bucket_start < now() - interval '1 year';
  get diagnostics v_rollup_trimmed = row_count;

  -- (e) pg_cron never cleans its own run history — unbounded growth otherwise.
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  get diagnostics v_cron_purged = row_count;

  insert into public.observability_cron_heartbeat (job_name, last_run_at, rows_folded, rows_purged, status, error_detail)
  values ('retention_sweep', now(), null, v_events_purged + v_groups_purged + v_rollup_trimmed + v_cron_purged, 'ok', null)
  on conflict (job_name) do update set
    last_run_at = excluded.last_run_at,
    rows_purged = excluded.rows_purged,
    status = 'ok',
    error_detail = null;

  return jsonb_build_object(
    'job', 'retention_sweep', 'status', 'ok',
    'snoozes_reopened', v_reopened,
    'events_purged', v_events_purged,
    'org_counts_recomputed', v_recounted,
    'resolved_groups_purged', v_groups_purged,
    'rollup_rows_trimmed', v_rollup_trimmed,
    'cron_history_purged', v_cron_purged
  );
exception when others then
  insert into public.observability_cron_heartbeat (job_name, status, error_detail)
  values ('retention_sweep', 'error', left(sqlerrm, 2000))
  on conflict (job_name) do update set
    status = 'error',
    error_detail = excluded.error_detail;
  return jsonb_build_object('job', 'retention_sweep', 'status', 'error', 'error', left(sqlerrm, 2000));
end;
$$;

revoke execute on function public.obs_retention_sweep() from public, anon, authenticated;
grant execute on function public.obs_retention_sweep() to service_role;

-- ── 4. Schedule the jobs ────────────────────────────────────────────────────────
-- cron.schedule(name, …) upserts by (jobname, username) — idempotent on re-apply (note: it does
-- NOT re-activate a job deactivated via cron.alter_job(active := false)). pg_cron never runs the
-- same job concurrently with itself. The leading SET bounds a hung run so it cannot hold its
-- pg_cron slot indefinitely (a function-level SET cannot bound the already-started outer statement).
select cron.schedule(
  'observability-metrics-fold',
  '*/5 * * * *',
  $job$ set statement_timeout = '120s'; select public.obs_fold_metrics(); $job$
);
select cron.schedule(
  'observability-retention-sweep',
  '15 8 * * *',
  $job$ set statement_timeout = '300s'; select public.obs_retention_sweep(); $job$
);

-- ── 5. record_error_event → returns jsonb with alert transition flags ────────────
-- A function's return type cannot be changed in place. DB-side this is clean: the only caller is
-- lib/observability/capture.ts (which today destructures only { error }), the ACL is the default
-- (anon execution dies on the RLS-no-policy insert), and Supabase's pgrst_ddl_watch event trigger
-- reloads the PostgREST schema cache at commit.
drop function if exists public.record_error_event(
  text, text, text, text, text, int, text, text, text, text, text,
  uuid, text, uuid, text, text, text, text, text, jsonb
);

create or replace function public.record_error_event(
  p_fingerprint text,
  p_title text,
  p_error_name text,
  p_route text,
  p_http_method text,
  p_status_code int,
  p_error_message text,
  p_stack text,
  p_severity text,
  p_env text,
  p_source text,
  p_org_id uuid,
  p_org_slug text,
  p_user_id uuid,
  p_user_email text,
  p_user_role text,
  p_request_id text,
  p_ip text,
  p_user_agent text,
  p_context jsonb
) returns jsonb language plpgsql as $$
declare
  v_group_id uuid;
  v_count bigint;
  v_old_severity text;
  v_old_status text;
  v_old_last_seen timestamptz;
  v_old_resolved_at timestamptz;
  v_new_severity text;
  v_new_status text;
  v_cap constant int := 50;          -- store every occurrence up to this many ...
  v_sample_k constant int := 10;     -- ... then only every Kth (occurrence_count keeps counting)
  v_reopen_after constant interval := interval '7 days';
begin
  -- OLD values for the Phase-4 alert transition flags. A pre-SELECT can only observe the
  -- pre-transition row — the NEW values MUST come from the upsert's RETURNING below. The tiny
  -- read-then-upsert race is accepted: worst case is one duplicate alert email; is_new stays
  -- exact because it derives from the atomic ON CONFLICT.
  select severity, status, last_seen_at, resolved_at
    into v_old_severity, v_old_status, v_old_last_seen, v_old_resolved_at
    from public.error_groups where fingerprint = p_fingerprint;

  insert into public.error_groups (
    fingerprint, title, error_name, route, http_method, severity, env,
    first_seen_at, last_seen_at, occurrence_count, sample_stack, sample_context
  ) values (
    p_fingerprint, p_title, p_error_name, p_route, p_http_method,
    coalesce(p_severity, 'error'), coalesce(p_env, 'production'),
    now(), now(), 1, p_stack, coalesce(p_context, '{}'::jsonb)
  )
  on conflict (fingerprint) do update set
    last_seen_at = now(),
    occurrence_count = error_groups.occurrence_count + 1,
    sample_stack = excluded.sample_stack,
    sample_context = excluded.sample_context,
    severity = case
      when public.obs_severity_rank(excluded.severity) > public.obs_severity_rank(error_groups.severity)
      then excluded.severity else error_groups.severity end,
    status = case
      when error_groups.status = 'resolved'
       and error_groups.resolved_at is not null
       and error_groups.resolved_at < now() - v_reopen_after
      then 'open' else error_groups.status end
  returning id, occurrence_count, severity, status
    into v_group_id, v_count, v_new_severity, v_new_status;

  -- sampling: keep every occurrence up to v_cap, then only every v_sample_k-th raw row after.
  -- occurrence_count above already counts ALL occurrences; this governs only raw-row STORAGE.
  if v_count <= v_cap or ((v_count - v_cap) % v_sample_k) = 0 then
    insert into public.error_events (
      group_id, occurred_at, env, source, route, http_method, status_code,
      error_name, error_message, stack_trace, org_id, org_slug,
      user_id, user_email, user_role, request_id, ip_address, user_agent, request_context
    ) values (
      v_group_id, now(), coalesce(p_env,'production'), coalesce(p_source,'server'), p_route, p_http_method, p_status_code,
      p_error_name, p_error_message, p_stack, p_org_id, p_org_slug,
      p_user_id, p_user_email, p_user_role, p_request_id, p_ip, p_user_agent, coalesce(p_context,'{}'::jsonb)
    );

    -- distinct_org_count only changes when a new event row lands, so recompute HERE (inside the
    -- sample gate) rather than on every call. The idx_error_events_group_org partial index keeps
    -- this count(distinct) cheap.
    if p_org_id is not null then
      update public.error_groups g set distinct_org_count = (
        select count(distinct e.org_id) from public.error_events e
        where e.group_id = v_group_id and e.org_id is not null
      ) where g.id = v_group_id;
    end if;
  end if;

  -- Alert transition flags (consumed by lib/observability/alerts.ts):
  --   is_new          — brand-new fingerprint (insert path always returns occurrence_count 1;
  --                     the conflict path always returns >= 2 — nothing ever resets the counter).
  --   became_critical — an existing group escalated to critical for the first time.
  --   regressed       — first recurrence since a resolve (covers the <=7-day window where the
  --                     group deliberately stays 'resolved' to avoid flapping); fires once per
  --                     resolution cycle because last_seen_at advances with this very event.
  --   reopened        — the >7-day auto-reopen above fired (resolved → open).
  return jsonb_build_object(
    'group_id', v_group_id,
    'is_new', v_count = 1,
    'became_critical', coalesce(v_old_severity is not null and v_old_severity <> 'critical' and v_new_severity = 'critical', false),
    'regressed', coalesce(v_old_status = 'resolved' and v_old_resolved_at is not null and v_old_last_seen <= v_old_resolved_at, false),
    'reopened', coalesce(v_old_status = 'resolved' and v_new_status = 'open', false),
    'severity', v_new_severity,
    'status', v_new_status
  );
end;
$$;
