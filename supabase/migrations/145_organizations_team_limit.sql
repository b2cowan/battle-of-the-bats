-- 145_organizations_team_limit.sql
-- Club Repackaging (2026-06-22): per-org rep-team capacity override, mirroring
-- organizations.tournament_limit. NULL = use the plan band default (Club=15,
-- Club · Association=30, others≈unlimited via PLAN_CONFIG.teamLimit). A stored
-- value RAISES the cap for "custom above 30" Club · Association deals — set by
-- platform-admin. Read via getEffectiveTeamLimit(planId, team_limit).
--
-- Additive + idempotent. No backfill: existing orgs keep NULL (plan default).

alter table public.organizations
  add column if not exists team_limit integer;

comment on column public.organizations.team_limit is
  'Per-org rep-team capacity override (Club Repackaging). NULL = plan band default. A value raises the band for custom >30 Club · Association deals. Mirrors tournament_limit; read via getEffectiveTeamLimit.';
