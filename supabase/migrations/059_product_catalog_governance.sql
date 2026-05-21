-- Migration 059: product catalog governance
-- Adds durable product-catalog change requests and campaign tracking.

create table if not exists public.platform_catalog_change_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null,
  title text not null,
  description text,
  status text not null default 'draft',
  priority text not null default 'medium',
  target_plan_id text,
  target_addon_key text,
  target_version_id uuid references public.platform_plan_versions(id) on delete set null,
  effective_at timestamptz,
  impact_summary text,
  proposal jsonb not null default '{}'::jsonb,
  submitted_by_email text,
  submitted_at timestamptz,
  reviewed_by_email text,
  reviewed_at timestamptz,
  implementation_notes text,
  created_by_email text not null,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_catalog_change_requests_type_check
    check (request_type in ('plan_version', 'feature_matrix', 'addon', 'pricing', 'grandfathering', 'campaign', 'trial')),
  constraint platform_catalog_change_requests_status_check
    check (status in ('draft', 'needs_review', 'approved', 'rejected', 'implemented', 'canceled')),
  constraint platform_catalog_change_requests_priority_check
    check (priority in ('low', 'medium', 'high', 'launch_blocker'))
);

create index if not exists idx_platform_catalog_change_requests_status_time
  on public.platform_catalog_change_requests(status, created_at desc);

create index if not exists idx_platform_catalog_change_requests_effective
  on public.platform_catalog_change_requests(effective_at asc)
  where effective_at is not null;

comment on table public.platform_catalog_change_requests is
  'Product catalog change requests for proposed plan, pricing, entitlement, add-on, grandfathering, and campaign work.';

create table if not exists public.platform_catalog_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null unique,
  title text not null,
  campaign_type text not null,
  status text not null default 'draft',
  target_plan_ids text[] not null default '{}'::text[],
  starts_at timestamptz,
  ends_at timestamptz,
  coupon_code text,
  discount_summary text,
  trial_days integer,
  notes text,
  created_by_email text not null,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_catalog_campaigns_type_check
    check (campaign_type in ('coupon', 'promo', 'trial', 'launch', 'retention')),
  constraint platform_catalog_campaigns_status_check
    check (status in ('draft', 'scheduled', 'active', 'paused', 'ended')),
  constraint platform_catalog_campaigns_trial_days_check
    check (trial_days is null or trial_days >= 0)
);

create index if not exists idx_platform_catalog_campaigns_status_time
  on public.platform_catalog_campaigns(status, created_at desc);

create index if not exists idx_platform_catalog_campaigns_dates
  on public.platform_catalog_campaigns(starts_at asc, ends_at asc);

comment on table public.platform_catalog_campaigns is
  'Coupon, promo, trial, launch, and retention campaign tracking for product planning.';
