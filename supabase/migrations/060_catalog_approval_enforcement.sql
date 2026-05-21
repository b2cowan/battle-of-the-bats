-- Migration 060: catalog approval enforcement
-- Records each live pricing/config application against an approved catalog change request.

create table if not exists public.platform_catalog_change_applications (
  id uuid primary key default gen_random_uuid(),
  change_request_id uuid not null references public.platform_catalog_change_requests(id) on delete restrict,
  surface text not null,
  target_key text not null,
  actor_email text not null,
  applied_payload jsonb not null default '{}'::jsonb,
  applied_at timestamptz not null default now(),
  constraint platform_catalog_change_applications_surface_check
    check (surface in ('plan_gating', 'plan_config', 'stripe_price'))
);

create index if not exists idx_platform_catalog_change_applications_request_time
  on public.platform_catalog_change_applications(change_request_id, applied_at desc);

create index if not exists idx_platform_catalog_change_applications_surface_time
  on public.platform_catalog_change_applications(surface, applied_at desc);

comment on table public.platform_catalog_change_applications is
  'Audit-friendly linkage between approved product catalog change requests and live plan/pricing/config applications.';
