-- Migration 062: feature matrix publishing
-- Stores live plan/module entitlement decisions published from approved catalog requests.

create table if not exists public.platform_plan_module_entitlements (
  plan_id text not null,
  module_key text not null,
  included boolean not null default false,
  updated_by_email text,
  updated_at timestamptz not null default now(),
  primary key (plan_id, module_key),
  constraint platform_plan_module_entitlements_plan_check
    check (plan_id in ('tournament', 'tournament_plus', 'league', 'club')),
  constraint platform_plan_module_entitlements_module_check
    check (module_key in (
      'module_tournaments',
      'module_communications',
      'module_members',
      'module_public_site',
      'module_house_league',
      'module_accounting',
      'module_rep_teams'
    ))
);

insert into public.platform_plan_module_entitlements (
  plan_id,
  module_key,
  included,
  updated_by_email
)
values
  ('tournament', 'module_tournaments', true, 'migration_061'),
  ('tournament', 'module_communications', true, 'migration_061'),
  ('tournament', 'module_members', true, 'migration_061'),
  ('tournament', 'module_public_site', false, 'migration_061'),
  ('tournament', 'module_house_league', false, 'migration_061'),
  ('tournament', 'module_accounting', false, 'migration_061'),
  ('tournament', 'module_rep_teams', false, 'migration_061'),
  ('tournament_plus', 'module_tournaments', true, 'migration_061'),
  ('tournament_plus', 'module_communications', true, 'migration_061'),
  ('tournament_plus', 'module_members', true, 'migration_061'),
  ('tournament_plus', 'module_public_site', false, 'migration_061'),
  ('tournament_plus', 'module_house_league', false, 'migration_061'),
  ('tournament_plus', 'module_accounting', false, 'migration_061'),
  ('tournament_plus', 'module_rep_teams', false, 'migration_061'),
  ('league', 'module_tournaments', true, 'migration_061'),
  ('league', 'module_communications', true, 'migration_061'),
  ('league', 'module_members', true, 'migration_061'),
  ('league', 'module_public_site', true, 'migration_061'),
  ('league', 'module_house_league', true, 'migration_061'),
  ('league', 'module_accounting', false, 'migration_061'),
  ('league', 'module_rep_teams', false, 'migration_061'),
  ('club', 'module_tournaments', true, 'migration_061'),
  ('club', 'module_communications', true, 'migration_061'),
  ('club', 'module_members', true, 'migration_061'),
  ('club', 'module_public_site', true, 'migration_061'),
  ('club', 'module_house_league', true, 'migration_061'),
  ('club', 'module_accounting', true, 'migration_061'),
  ('club', 'module_rep_teams', true, 'migration_061')
on conflict (plan_id, module_key) do nothing;

alter table public.platform_catalog_change_applications
  drop constraint if exists platform_catalog_change_applications_surface_check;

alter table public.platform_catalog_change_applications
  add constraint platform_catalog_change_applications_surface_check
  check (surface in ('plan_gating', 'plan_config', 'stripe_price', 'feature_matrix'));

comment on table public.platform_plan_module_entitlements is
  'Live product-catalog plan/module entitlement matrix published from approved platform catalog change requests.';
