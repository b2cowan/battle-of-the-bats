-- 195_user_preferences.sql
--
-- Per-user (identity-scoped) UI preferences. First consumer: the Dark|Warm app theme
-- toggle (Theme Toggle Foundation — design_decisions TH-1/TH-3). ONE row per user, keyed
-- on user_id alone — the preference is IDENTITY-scoped, NOT membership-scoped, so a
-- multi-org user carries ONE theme everywhere and never forks it per org.
--
-- Why a NEW general table (not user_theme_*): the three existing per-user tables are
-- single-purpose (fan_alert_prefs, user_notification_settings, user_marketing_opt_outs).
-- This one is deliberately the general home for future account-synced UI prefs (e.g. a
-- future account-level density, today device-local via fl_admin_density) so they join as
-- columns instead of spawning more single-column tables.
--
-- theme: NULL / absent row = 'default' = each shell's current default (consumer shell = warm,
-- coaches portal = dark), so non-choosers see ZERO change. 'dark' | 'warm' = an explicit pick.
-- Governs platform-neutral chrome ONLY; org-branded surfaces ignore it (M2 precedence — the
-- org brand always wins on tournament public / org home / public team pages).
--
-- Adds a TABLE, so check:migrations can detect prod missing it — apply to prod
-- (apply-migration-api.mjs --prod) BEFORE promoting the code: the account WRITE path
-- (setUserTheme) would 500 without it. The layout READ is guarded (.catch → default theme).

create table if not exists public.user_preferences (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  theme      text check (theme is null or theme in ('dark', 'warm')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_preferences is
  'Per-user identity-scoped UI preferences — one row per user, keyed on user_id alone (NOT membership-scoped, so a multi-org user carries one set everywhere). First column: theme (the Dark|Warm app theme toggle, TH-1/TH-3). Absent row / NULL theme = each shell''s default (consumer shell warm, coaches portal dark); ''dark''|''warm'' = an explicit pick. Written/read service-role only (lib/user-preferences.ts) via the account API. Kept general so future account-synced UI prefs join as columns.';

comment on column public.user_preferences.theme is
  'App theme preference governing platform-neutral chrome (consumer shell now; coaches portal once its warm leg exists — admin/scorekeeper excluded). NULL / absent row = each shell''s default; ''dark'' | ''warm'' = explicit choice. Org-branded surfaces (tournament public, org home, public team pages) and the warm sign-up journey ignore this entirely (M2 precedence).';

-- Service-role only (same posture as user_notification_settings / fan_alert_prefs /
-- user_marketing_opt_outs). PROD anon carries a default SELECT grant, so RLS MUST be
-- enabled to wall it off; enable with NO policies — anon / authenticated get no rows,
-- service-role bypasses RLS (see memory reference_supabase_rls_grants).
alter table public.user_preferences enable row level security;
