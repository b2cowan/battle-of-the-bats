-- 185_user_marketing_opt_outs.sql
--
-- Per-person marketing-email opt-out (Notification Settings Phase 2 — CASL fix).
--
-- Fixes the wrong-party unsubscribe bug: the coach-audience campaign (spotlight_coaches_coach)
-- emails an INDIVIDUAL coach, but the unsubscribe footer was org-scoped, so a coach clicking
-- "Unsubscribe" flipped organizations.email_marketing_opt_out — killing the ORG's marketing
-- consent (cross-identity), not the coach's own. No per-person opt-out store existed; this adds
-- the narrowest one: a single-purpose table keyed by user_id (presence of a row = opted out).
--
-- Scope: authenticated users (coaches) only — one boolean fact per user, "opted out of
-- individual marketing email." This is NOT the parked general per-recipient/guardian
-- suppression system (arbitrary non-user emails, per-campaign granularity).
--
-- Adds a TABLE, so the check:migrations drift gate CAN detect prod missing this — but still
-- apply to prod (apply-migration-api.mjs --prod) before/with the code promote.

create table if not exists public.user_marketing_opt_outs (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  opted_out_at timestamptz not null default now()
);

comment on table public.user_marketing_opt_outs is
  'Per-person marketing-email opt-out (CASL). Presence of a row = this user opted out of individual marketing email (the coach spotlight campaign). Written by the user-scoped /unsubscribe path; read by lib/email-sender.ts for user-scoped (recipientUserId) sends. Distinct from organizations.email_marketing_opt_out (org-level).';

-- Service-role only. This table is written/read exclusively via the service-role client
-- (email-sender + the token-authorized /unsubscribe route). PROD anon carries a default
-- SELECT grant, so RLS MUST be enabled to wall it off; enable with NO policies — anon /
-- authenticated get no rows, service-role bypasses RLS (see memory reference_supabase_rls_grants).
alter table public.user_marketing_opt_outs enable row level security;
