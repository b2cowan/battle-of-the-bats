-- Migration 058: product catalog foundation
-- Adds read-focused catalog records for Phase 5 product planning.

create table if not exists public.platform_plan_versions (
  id uuid primary key default gen_random_uuid(),
  version_key text not null unique,
  title text not null,
  description text,
  status text not null default 'draft',
  effective_at timestamptz,
  published_at timestamptz,
  created_by_email text,
  snapshot jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_plan_versions_status_check
    check (status in ('draft', 'published', 'scheduled', 'archived'))
);

create index if not exists idx_platform_plan_versions_status_time
  on public.platform_plan_versions(status, created_at desc);

comment on table public.platform_plan_versions is
  'Platform-admin product catalog plan versions for draft, scheduled, published, and archived plan snapshots.';

create table if not exists public.platform_addon_catalog (
  id uuid primary key default gen_random_uuid(),
  addon_key text not null unique,
  label text not null,
  description text,
  module_key text,
  status text not null default 'planned',
  default_included_plans text[] not null default '{}'::text[],
  pricing_model text not null default 'custom',
  monthly_price numeric(10,2),
  annual_price numeric(10,2),
  effective_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_addon_catalog_status_check
    check (status in ('planned', 'draft', 'live', 'retired')),
  constraint platform_addon_catalog_pricing_model_check
    check (pricing_model in ('included', 'flat', 'per_team', 'per_seat', 'custom'))
);

create index if not exists idx_platform_addon_catalog_status_label
  on public.platform_addon_catalog(status, label);

comment on table public.platform_addon_catalog is
  'Platform-admin add-on catalog for product planning and future packaging changes.';

insert into public.platform_plan_versions (
  version_key,
  title,
  description,
  status,
  effective_at,
  published_at,
  created_by_email,
  snapshot,
  notes
)
values (
  'current-2026-05',
  'Current public catalog',
  'Baseline catalog matching the current four-tier FieldLogicHQ packaging.',
  'published',
  now(),
  now(),
  'migration_058',
  jsonb_build_object(
    'plans', jsonb_build_array('tournament', 'tournament_plus', 'league', 'club'),
    'source', 'PLAN_CONFIG',
    'purpose', 'Baseline for future draft and scheduled plan changes'
  ),
  'Seeded from the current code-defined plan configuration.'
)
on conflict (version_key) do nothing;

insert into public.platform_addon_catalog (
  addon_key,
  label,
  description,
  module_key,
  status,
  default_included_plans,
  pricing_model,
  monthly_price,
  annual_price,
  notes
)
values
  (
    'public_site',
    'Public Site',
    'Hosted public organization site with content, schedule, standings, and registration entry points.',
    'module_public_site',
    'live',
    array['league', 'club'],
    'included',
    null,
    null,
    'Included with League and Club plans.'
  ),
  (
    'house_league',
    'House League',
    'House league seasons, divisions, registration, schedules, standings, and communications.',
    'module_house_league',
    'live',
    array['league', 'club'],
    'included',
    null,
    null,
    'Included with League and Club plans.'
  ),
  (
    'accounting',
    'Accounting',
    'Org, tournament, and team accounting ledgers, budgets, expenses, and reconciliation workflows.',
    'module_accounting',
    'live',
    array['club'],
    'included',
    null,
    null,
    'Included with Club plan.'
  ),
  (
    'rep_teams',
    'Rep Teams',
    'Rep team tryouts, program years, rosters, coach portal, documents, and per-team accounting.',
    'module_rep_teams',
    'live',
    array['club'],
    'included',
    null,
    null,
    'Included with Club plan.'
  ),
  (
    'extra_rep_team',
    'Additional Rep Team',
    'Extra rep team billing quantity for organizations using the Rep Teams module.',
    'module_rep_teams',
    'planned',
    array[]::text[],
    'per_team',
    null,
    null,
    'Tracked as a future public add-on catalog item; Stripe price IDs live in stripe_prices.'
  ),
  (
    'support_package',
    'Support Package',
    'Optional onboarding, migration, or season-launch support package for larger organizations.',
    null,
    'planned',
    array[]::text[],
    'custom',
    null,
    null,
    'Placeholder for future support packaging.'
  )
on conflict (addon_key) do nothing;
