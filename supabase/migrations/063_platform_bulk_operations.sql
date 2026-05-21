-- Migration 063: platform bulk operations
-- Records guarded platform-admin bulk operation batches and their outcomes.

create table if not exists public.platform_bulk_operations (
  id uuid primary key default gen_random_uuid(),
  action_type text not null,
  status text not null default 'completed',
  target_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  reason text not null,
  parameters jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  created_by_email text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint platform_bulk_operations_action_check
    check (action_type in ('subscription_status_override', 'comp_period', 'plan_change')),
  constraint platform_bulk_operations_status_check
    check (status in ('completed', 'partial_failed', 'failed'))
);

create index if not exists idx_platform_bulk_operations_time
  on public.platform_bulk_operations(created_at desc);

create index if not exists idx_platform_bulk_operations_actor_time
  on public.platform_bulk_operations(created_by_email, created_at desc);

comment on table public.platform_bulk_operations is
  'Platform-admin bulk operation batches with reason, parameters, and per-target outcome summary.';
