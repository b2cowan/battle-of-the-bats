-- Migration 118 — Observability & Feedback
-- The platform-admin error-tracking + in-app feedback "notification center" (Phase 1).
-- See docs/projects/active/OBSERVABILITY_ERROR_TRACKING_PLAN.md.
--
-- All six tables here are PLATFORM-ADMIN ONLY. RLS is ENABLED with NO policies: supabaseAdmin
-- (service_role) has BYPASSRLS so capture/reads work, while anon + authenticated get zero rows —
-- so they are never exposed via the public REST API even though prod grants anon SELECT on public
-- tables by default. (This matches the LIVE posture of email_sends/platform_events, which have RLS
-- enabled in prod despite their migration comments — decide from live schema, not migrations.)
-- Raw rows are auto-purged (Phase 4 pg_cron / manual sweep); see DATA_DICTIONARY.md.

-- ── severity rank helper (used by record_error_event to escalate group severity) ──
create or replace function public.obs_severity_rank(sev text)
returns int language sql immutable as $$
  select case sev
    when 'critical' then 4
    when 'error'    then 3
    when 'warning'  then 2
    when 'info'     then 1
    else 0
  end;
$$;

-- ── error_groups ──────────────────────────────────────────────────────────────
-- One row per distinct issue (fingerprint). The triage / list / drilldown unit.
-- Status + severity live HERE (not on raw events) so a "resolved" decision survives
-- the 30-day raw-event purge.
create table if not exists public.error_groups (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  title text,
  error_name text,
  route text,
  http_method text,
  severity text not null default 'error' check (severity in ('critical','error','warning','info')),
  status text not null default 'open' check (status in ('open','resolved','ignored','snoozed')),
  env text not null default 'production' check (env in ('production','dev')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrence_count bigint not null default 0,
  distinct_org_count int not null default 0,
  resolved_at timestamptz,
  resolved_by text,
  snooze_until timestamptz,
  sample_stack text,
  sample_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_error_groups_env_last_seen on public.error_groups (env, last_seen_at desc);
create index if not exists idx_error_groups_status_severity on public.error_groups (status, severity);

comment on table public.error_groups is
  'Platform-admin only; RLS enabled, no policies (service-role only) — writes via supabaseAdmin. One row per error fingerprint (the triage unit); status/severity persist across the raw-event purge. See docs/projects/active/OBSERVABILITY_ERROR_TRACKING_PLAN.md.';

-- ── error_events ────────────────────────────────────────────────────────────────
-- High-volume append-only log, one row per occurrence (sampled after a per-fingerprint
-- cap). Mirrors email_sends (migration 100): org_id FK ON DELETE SET NULL, denormalized
-- org_slug snapshot for join-free org filtering, time-desc composite indexes.
create table if not exists public.error_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.error_groups(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  env text not null default 'production',
  source text not null default 'server' check (source in ('server','client')),
  route text,
  http_method text,
  status_code int,
  error_name text,
  error_message text,
  stack_trace text,
  org_id uuid references public.organizations(id) on delete set null,
  org_slug text,
  user_id uuid,
  user_email text,
  user_role text,
  request_id text,
  ip_address text,
  user_agent text,
  request_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_error_events_group_time on public.error_events (group_id, occurred_at desc);
create index if not exists idx_error_events_org_time on public.error_events (org_id, occurred_at desc);
create index if not exists idx_error_events_occurred on public.error_events (occurred_at);
-- Keeps the distinct_org_count recompute in record_error_event cheap (count(distinct org_id) per group).
create index if not exists idx_error_events_group_org on public.error_events (group_id, org_id) where org_id is not null;

comment on table public.error_events is
  'Platform-admin only; RLS enabled, no policies (service-role only) — writes via supabaseAdmin. Append-only, one row per error occurrence (sampled after a per-fingerprint cap); raw rows auto-purged after 30 days. Mirrors email_sends. See DATA_DICTIONARY.md.';

-- ── request_metrics_rollup (the calls-vs-errors chart source) ────────────────────
-- Coarse counters, NOT one row per request. 5-min buckets; NULL route/org = aggregate.
-- Folded from request_metrics_raw by pg_cron (Phase 4). O(buckets) to chart.
create table if not exists public.request_metrics_rollup (
  id uuid primary key default gen_random_uuid(),
  bucket_start timestamptz not null,
  env text not null default 'production',
  route text,
  org_id uuid,
  call_count bigint not null default 0,
  error_count bigint not null default 0,
  created_at timestamptz not null default now()
);
-- NULL route/org must still bucket uniquely → coalesce in the unique index expression
create unique index if not exists idx_request_metrics_rollup_bucket
  on public.request_metrics_rollup (bucket_start, env, coalesce(route,''), coalesce(org_id,'00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists idx_request_metrics_rollup_env_time on public.request_metrics_rollup (env, bucket_start desc);

comment on table public.request_metrics_rollup is
  'Platform-admin only; RLS enabled, no policies (service-role only). Coarse calls-vs-errors counters (the dashboard chart source), folded from request_metrics_raw every 5 min by pg_cron (Phase 4). NOT one row per request. See DATA_DICTIONARY.md.';

-- ── request_metrics_raw (thin staging) ──────────────────────────────────────────
-- Periodic in-process call/error tally flushes land here (so we never insert one row
-- per HTTP call). pg_cron folds it into request_metrics_rollup every 5 min then truncates.
create table if not exists public.request_metrics_raw (
  id uuid primary key default gen_random_uuid(),
  flushed_at timestamptz not null default now(),
  env text not null default 'production',
  route text,
  org_id uuid,
  call_count bigint not null default 0,
  error_count bigint not null default 0
);
create index if not exists idx_request_metrics_raw_flushed on public.request_metrics_raw (flushed_at);

comment on table public.request_metrics_raw is
  'Platform-admin only; RLS enabled, no policies (service-role only). Thin staging for periodic in-process call/error tally flushes; pg_cron folds it into request_metrics_rollup every 5 min then truncates. See DATA_DICTIONARY.md.';

-- ── feedback_submissions ──────────────────────────────────────────────────────────
-- In-app bug / feature / feedback submissions from org admin, coach, scorekeeper, public.
-- org_id nullable (org-less Basic coaches + public allowed). context jsonb deep-links a bug
-- report to its error_group via the last request_id the client saw.
create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  user_id uuid,
  user_email text,
  submitter_name text,
  type text not null default 'feedback' check (type in ('bug','feature','feedback')),
  category text,
  title text,
  body text not null,
  status text not null default 'new' check (status in ('new','triaged','acknowledged','resolved')),
  severity text check (severity in ('critical','error','warning','info')),
  context jsonb not null default '{}'::jsonb,
  triaged_by text,
  triaged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_feedback_submissions_status_time on public.feedback_submissions (status, created_at desc);
create index if not exists idx_feedback_submissions_org_time on public.feedback_submissions (org_id, created_at desc);
create index if not exists idx_feedback_submissions_type on public.feedback_submissions (type);

comment on table public.feedback_submissions is
  'Platform-admin only; RLS enabled, no policies (service-role only) — writes via supabaseAdmin. In-app bug/feature/feedback submissions from all personas; org_id nullable (public / org-less coaches). context jsonb deep-links a bug report to its error_group via the last request_id. See DATA_DICTIONARY.md.';

-- ── observability_cron_heartbeat ────────────────────────────────────────────────
-- One row per pg_cron job; updated each run so a silently-failed rollup/retention job is
-- visible on the dashboard ("last rollup N minutes ago"). Populated in Phase 4.
create table if not exists public.observability_cron_heartbeat (
  job_name text primary key,
  last_run_at timestamptz,
  rows_folded bigint,
  rows_purged bigint,
  status text check (status in ('ok','error')),
  error_detail text
);

comment on table public.observability_cron_heartbeat is
  'Platform-admin only; RLS enabled, no policies (service-role only). Freshness sentinel updated by the Phase-4 pg_cron rollup/retention jobs so a silently-failed job is visible on the dashboard. See DATA_DICTIONARY.md.';

-- ── Row-Level Security ──────────────────────────────────────────────────────────────
-- Enable RLS with NO policies on all six tables. supabaseAdmin (service_role) bypasses RLS, so
-- every capture/read still works; anon + authenticated resolve to zero rows via PostgREST. This is
-- the real protection in prod, where anon/authenticated hold the default SELECT grant on public
-- tables (verified: has_table_privilege('anon','public.email_sends','SELECT') = true in prod).
alter table public.error_groups                 enable row level security;
alter table public.error_events                 enable row level security;
alter table public.request_metrics_rollup       enable row level security;
alter table public.request_metrics_raw          enable row level security;
alter table public.feedback_submissions         enable row level security;
alter table public.observability_cron_heartbeat enable row level security;

-- ── record_error_event RPC ────────────────────────────────────────────────────────
-- Atomic group-upsert + (sampled) event insert + distinct-org maintenance, in one round trip.
-- Called fire-and-forget by lib/observability/capture.ts via supabaseAdmin.rpc(...). Grouping
-- happens at write time: a flood of identical errors collapses into one occurrence_count bump.
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
) returns uuid language plpgsql as $$
declare
  v_group_id uuid;
  v_count bigint;
  v_cap constant int := 50;          -- store every occurrence up to this many ...
  v_sample_k constant int := 10;     -- ... then only every Kth (occurrence_count keeps counting)
  v_reopen_after constant interval := interval '7 days';
begin
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
  returning id, occurrence_count into v_group_id, v_count;

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

  return v_group_id;
end;
$$;
