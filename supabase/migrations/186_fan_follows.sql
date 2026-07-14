-- 186_fan_follows.sql
--
-- Unified App Phase 2 (fan accounts & follows). Introduces the FIRST account-linked
-- follow record: a signed-in fan's follows for tournaments/teams/orgs, so a follow
-- travels across every device instead of living only in one browser's localStorage
-- (lib/follow.ts, which stays the permanent anonymous/device-only mechanism — the two
-- coexist by design; this table never replaces it).
--
-- This table IS the authorization for "is this user following X" — presence of a row
-- is the gate, mirroring basic_coach_team_users (there is no org_members involvement;
-- follows cross organizations freely and are NOT org memberships).
--
-- entity_type/entity_id is an intentionally polymorphic pair (tournament|team|org).
-- Postgres can't express a polymorphic FK, so referential integrity is enforced at the
-- application layer (lib/fan-follows.ts validates the entity before inserting). Slice 1
-- only writes 'team' follows (reconciled from device localStorage or made while signed in).
--
-- Scope: adds ONE table. Migrations here are applied BY HAND to dev AND prod via
-- scripts/apply-migration-api.mjs — nothing runs them automatically. Promote code that
-- reads fan_follows only AFTER this is applied to prod (check:migrations gates it; the
-- migration-040 incident is the cautionary precedent for a prod 500 on a missing table).
-- Same unit of work also updates docs/agents/db/DATA_DICTIONARY.md + refresh:snapshots.

create table if not exists public.fan_follows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id   uuid not null,
  source      text not null default 'manual',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint fan_follows_entity_type_check
    check (entity_type in ('tournament', 'team', 'org')),
  constraint fan_follows_source_check
    check (source in ('manual', 'directory', 'qr', 'device_reconcile', 'registration'))
);

-- One follow per (user, entity) — makes re-follow an idempotent upsert.
create unique index if not exists fan_follows_user_entity_unique
  on public.fan_follows(user_id, entity_type, entity_id);

-- "Who follows this entity" fan-out lookup (follower counts, future alert dispatch).
create index if not exists fan_follows_entity_idx
  on public.fan_follows(entity_type, entity_id);

comment on table public.fan_follows is
  'Signed-in account follow list for tournaments/teams/orgs (unified-app Phase 2). A row IS the '
  'authorization for "is this user following X"; presence of the row is the gate (mirrors '
  'basic_coach_team_users). Polymorphic (entity_type/entity_id, app-layer integrity). Distinct '
  'from the anonymous fan_push_subscriptions (endpoint-keyed, no user_id) and lib/follow.ts '
  '(localStorage) — all coexist deliberately.';
comment on column public.fan_follows.entity_type is 'What is followed: tournament | team | org.';
comment on column public.fan_follows.entity_id is 'The followed row id (teams.id for entity_type=team). No FK — polymorphic; validated in lib/fan-follows.ts.';
comment on column public.fan_follows.source is 'How the follow was created: manual | directory | qr | device_reconcile | registration.';

-- Service-role only, same posture as user_marketing_opt_outs (185) / fan_push_subscriptions
-- (107). PROD anon/authenticated hold a DEFAULT SELECT grant on public tables, so RLS MUST be
-- enabled to wall this off; enable with ZERO policies — anon/authenticated resolve to 0 rows,
-- supabaseAdmin (service_role) bypasses RLS. Decide RLS state from live pg_class after apply,
-- not from this comment (see memory reference_supabase_rls_grants).
alter table public.fan_follows enable row level security;
grant all on public.fan_follows to service_role;
