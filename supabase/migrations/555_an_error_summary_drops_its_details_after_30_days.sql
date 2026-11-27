-- ---------------------------------------------------------------
-- Migration 555 — an error group's kept details go after 30 days (/legal, owner 2026-11-27: "yes to both")
--
-- WHY: the Privacy Policy says error reports are deleted after 30 days. Single events were
-- (error_events, mig 122). The grouped summary was not: error_groups.sample_stack and
-- sample_context hold the LATEST occurrence's technical details, and a group is deleted only 90
-- days after it is resolved; an open or ignored group has no end date.
--
-- WHAT CHANGES: one step added to obs_retention_sweep(), the nightly job (08:15 UTC). A group not
-- seen for 30 days loses sample_stack and sample_context. record_error_event overwrites both on
-- every occurrence, so the sample is exactly as old as last_seen_at. The short entry stays (title,
-- error name, route, severity, status, counts, first and last seen). A group seen again gets a
-- fresh sample. Everything else in the function is migration 122's, unchanged. The returned JSON
-- gains samples_cleared.
--
-- DATA: the first run after this is applied permanently clears the samples older than 30 days.
--
-- INVISIBLE to the drift check (function body only): declared in MANUAL_PROD_STEPS.json with a
-- prosrc check. Safe to run twice. A later replacement of obs_retention_sweep() must keep step (b2)
-- and the SET search_path clause.
-- ---------------------------------------------------------------

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
  v_samples_cleared bigint := 0;
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

  -- (b2) A group's sample is its LATEST occurrence, so it is as old as last_seen_at. It goes at the
  --      same 30 days as the raw events (the Privacy Policy's promise).
  update public.error_groups
     set sample_stack = null, sample_context = '{}'::jsonb
   where last_seen_at < now() - interval '30 days'
     and (sample_stack is not null or sample_context <> '{}'::jsonb);
  get diagnostics v_samples_cleared = row_count;

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
    'samples_cleared', v_samples_cleared,
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
