-- Migration 054: platform metric snapshots, admin visit tracking, and structured org notes
-- Supports Phase 2 trend infrastructure, "since last visit" alerts, and durable support-note history.

create table if not exists public.platform_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  metrics jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  created_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_metric_snapshots_date
  on public.platform_metric_snapshots(snapshot_date desc);

comment on table public.platform_metric_snapshots is
  'Daily platform-admin metric snapshots used for future trend charts and historical comparisons.';

create table if not exists public.platform_admin_visits (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_email text not null,
  path text not null default '/platform-admin',
  visited_at timestamptz not null default now()
);

create index if not exists idx_platform_admin_visits_actor_time
  on public.platform_admin_visits(actor_email, visited_at desc);

create index if not exists idx_platform_admin_visits_path_time
  on public.platform_admin_visits(path, visited_at desc);

comment on table public.platform_admin_visits is
  'Platform-admin page visits used for since-last-visit operational alerts.';

create table if not exists public.org_internal_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  body text not null,
  created_by_email text not null,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by_email text
);

create index if not exists idx_org_internal_notes_org_time
  on public.org_internal_notes(org_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_org_internal_notes_org_deleted_time
  on public.org_internal_notes(org_id, deleted_at desc)
  where deleted_at is not null;

insert into public.org_internal_notes (
  org_id,
  body,
  created_by_email,
  updated_by_email,
  created_at,
  updated_at
)
select
  id,
  internal_notes,
  'migration_054',
  'migration_054',
  coalesce(created_at, now()),
  now()
from public.organizations
where internal_notes is not null
  and btrim(internal_notes) <> ''
  and not exists (
    select 1
    from public.org_internal_notes existing
    where existing.org_id = organizations.id
      and existing.created_by_email = 'migration_054'
  );

comment on table public.org_internal_notes is
  'Structured, timestamped internal support notes for platform admins.';
