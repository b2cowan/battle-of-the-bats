-- 188_fan_alert_prefs.sql
--
-- Unified App Phase 2 Slice 3 ("alerts are what signing in gets you" — Business
-- Decisions Log 2026-07-14). Fan push alerts now require a signed-in account; the
-- preference is ACCOUNT-level and GLOBAL across every followed team — exactly two
-- switches (game alerts / event news), one row per user, no per-team or per-device
-- rows. A user with NO row gets the defaults (both on): the row exists only once
-- they change something, so following + enabling push "just works."
--
-- Delivery rides the EXISTING account push pipeline: fan_follows (who follows the
-- team) -> this table (do they want this category) -> push_subscriptions (mig 101,
-- user-keyed endpoints). The anonymous fan_push_subscriptions path stops taking new
-- opt-ins at this slice (existing rows keep receiving until they die naturally).
--
-- Scope: adds ONE table. Migrations are applied BY HAND to dev AND prod via
-- scripts/apply-migration-api.mjs — nothing runs them automatically. Promote code
-- that reads fan_alert_prefs only AFTER this is applied to prod (check:migrations
-- gates it). Same unit of work updates docs/agents/db/DATA_DICTIONARY.md +
-- refresh:snapshots.

create table if not exists public.fan_alert_prefs (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  game_alerts boolean not null default true,
  event_news  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.fan_alert_prefs is
  'Account-level fan alert preferences (unified-app Phase 2 Slice 3) — two global '
  'switches across ALL followed teams: game_alerts (live/final scores + playoff/champions '
  'moments) and event_news (announcements). Absent row = both true (defaults). Dispatch '
  'path: fan_follows -> fan_alert_prefs -> push_subscriptions (user-keyed endpoints).';
comment on column public.fan_alert_prefs.game_alerts is
  'Push when a followed team''s game goes live / finishes (+ playoffs-set / champions moments). Default true.';
comment on column public.fan_alert_prefs.event_news is
  'Push for announcements from events the user''s followed teams are in. Default true.';

-- Service-role only, same posture as fan_follows (186). PROD anon/authenticated hold a
-- DEFAULT SELECT grant on public tables, so RLS MUST be enabled to wall this off; enable
-- with ZERO policies — anon/authenticated resolve to 0 rows, supabaseAdmin (service_role)
-- bypasses RLS. Decide RLS state from live pg_class after apply, not from this comment.
alter table public.fan_alert_prefs enable row level security;
grant all on public.fan_alert_prefs to service_role;
