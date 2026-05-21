-- Migration 053: durable platform events
-- Stores lifecycle events used by platform-admin metrics and investigations.

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  source text not null default 'app',
  source_event_id text,
  org_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid,
  actor_email text,
  previous_plan_id text,
  plan_id text,
  previous_subscription_status text,
  subscription_status text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_platform_events_source_event
  on public.platform_events(source, source_event_id)
  where source_event_id is not null;

create index if not exists idx_platform_events_type_time
  on public.platform_events(event_type, occurred_at desc);

create index if not exists idx_platform_events_org_time
  on public.platform_events(org_id, occurred_at desc);

insert into public.platform_events (
  event_type,
  source,
  source_event_id,
  org_id,
  actor_user_id,
  actor_email,
  previous_plan_id,
  plan_id,
  metadata,
  occurred_at
)
select
  case
    when intent_type = 'cancellation' then 'subscription_canceled'
    when intent_type = 'downgrade' then 'plan_downgraded'
    else intent_type
  end,
  'migration_053',
  id::text,
  org_id,
  created_by,
  created_by_email,
  from_plan,
  target_plan,
  jsonb_build_object(
    'intentType', intent_type,
    'retentionUntil', retention_until,
    'reason', reason
  ),
  coalesce(applied_at, created_at)
from public.billing_retention_intents
where status = 'applied'
  and intent_type in ('cancellation', 'downgrade')
on conflict (source, source_event_id) where source_event_id is not null do nothing;

comment on table public.platform_events is
  'Durable platform lifecycle events for platform-admin metrics and investigations.';
