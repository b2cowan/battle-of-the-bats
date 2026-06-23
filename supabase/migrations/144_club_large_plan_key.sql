-- 144_club_large_plan_key.sql
-- Club Repackaging (2026-06-22): add the new 'club_large' capacity band
-- ("Club · Association", up to 30 teams) to the two plan-keyed catalog tables
-- that carry a CHECK constraint locked to the existing 5 plans. Without this,
-- the feature-matrix publish path errors and the gating toggle silently no-ops
-- for the new band.
--
-- Additive + idempotent. `organizations.plan_id` and `stripe_prices.plan_id`
-- carry NO CHECK, so no change is needed there. `organizations.team_limit`
-- (the per-org >30 custom cap) is added in a later migration with the
-- capacity-enforcement phase.

-- ---------------------------------------------------------------------------
-- plan_gating.plan_key — widen CHECK + seed the early-access row
-- (the gating route does UPDATE-only, so a missing row silently no-ops).
-- ---------------------------------------------------------------------------
alter table public.plan_gating
  drop constraint if exists plan_gating_plan_key_check;

alter table public.plan_gating
  add constraint plan_gating_plan_key_check
  check (plan_key in ('tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'));

insert into public.plan_gating (plan_key, gating_status, updated_by_email)
values ('club_large', 'early_access', 'migration_144')
on conflict (plan_key) do nothing;

-- ---------------------------------------------------------------------------
-- platform_plan_module_entitlements.plan_id — widen CHECK + seed module rows.
-- club_large mirrors club exactly (all 7 modules included).
-- ---------------------------------------------------------------------------
alter table public.platform_plan_module_entitlements
  drop constraint if exists platform_plan_module_entitlements_plan_check;

alter table public.platform_plan_module_entitlements
  add constraint platform_plan_module_entitlements_plan_check
  check (plan_id in ('tournament', 'team', 'tournament_plus', 'league', 'club', 'club_large'));

insert into public.platform_plan_module_entitlements (
  plan_id,
  module_key,
  included,
  updated_by_email
)
values
  ('club_large', 'module_tournaments', true, 'migration_144'),
  ('club_large', 'module_communications', true, 'migration_144'),
  ('club_large', 'module_members', true, 'migration_144'),
  ('club_large', 'module_public_site', true, 'migration_144'),
  ('club_large', 'module_house_league', true, 'migration_144'),
  ('club_large', 'module_accounting', true, 'migration_144'),
  ('club_large', 'module_rep_teams', true, 'migration_144')
on conflict (plan_id, module_key) do nothing;
