-- 194_user_notification_settings.sql
--
-- Account-level "Pause notifications" master switch (Unified Home / Notification Settings).
--
-- A RECIPIENT-side pause: when on, silences every notification the platform sends this user
-- across all their orgs / teams / follows EXCEPT the protected floor — failed-payment alerts
-- and chat @mentions — which still pierce through. Non-destructive: per-event preferences are
-- untouched; unpausing restores exactly what the user had.
--
-- Why a new table: no existing per-user store fits. notification_preferences and
-- tournament_notification_preferences are org/tournament-scoped (part of their PK);
-- fan_alert_prefs and user_marketing_opt_outs are single-purpose. This is the narrowest new
-- table keyed on user_id alone, modeled on user_marketing_opt_outs (185).
--
-- NOT the organizer-side tournaments.settings.coach_email_pause_all (that silences an
-- organizer's OUTBOUND coach emails on one event — different owner, different scope).
--
-- Adds a TABLE, so check:migrations can detect prod missing it — but still apply to prod
-- (apply-migration-api.mjs --prod) with the code promote (joins the Unified Home bundle).

create table if not exists public.user_notification_settings (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  notifications_paused_at timestamptz,          -- NULL = not paused; timestamp = paused since
  updated_at              timestamptz not null default now()
);

comment on table public.user_notification_settings is
  'Account-level notification settings keyed by user_id. notifications_paused_at NOT NULL = the "Pause notifications" master switch is ON (paused since that time); NULL/absent row = receiving normally. Pause silences all sends via lib/notify.ts AND account-routed fan pushes (lib/fan-notify.ts) EXCEPT the protected floor (payment_failed, chat_mention). Non-destructive (per-event notification_preferences untouched). Written/read service-role only (lib/notification-pause.ts). Distinct from the organizer-side tournaments.settings.coach_email_pause_all.';

-- Service-role only (same posture as user_marketing_opt_outs / fan_alert_prefs). PROD anon
-- carries a default SELECT grant, so RLS MUST be enabled to wall it off; enable with NO
-- policies — anon / authenticated get no rows, service-role bypasses RLS
-- (see memory reference_supabase_rls_grants).
alter table public.user_notification_settings enable row level security;
