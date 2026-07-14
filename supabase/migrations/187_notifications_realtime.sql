-- 187_notifications_realtime.sql
--
-- (Renumbered from a working 184 to avoid colliding with the committed
-- 184_money_tags_and_org_shared_library.sql from a concurrent chat; 185/186 also taken.)
--
-- Live notification-badge fix. The NotificationBell (components/notifications/NotificationBell.tsx)
-- subscribes to postgres_changes INSERT on public.notifications to bump the unread badge the instant
-- a row is written for the current user — but the table was never added to the `supabase_realtime`
-- publication, so Postgres never broadcast those inserts and the browser channel received nothing.
-- The badge therefore only refreshed on page load. This affected EVERY notification type; the coach
-- Insights weekly digest just happened to be the first time someone watched an open page for a live
-- bump.
--
-- Safe by construction: RLS on notifications already scopes reads to the owner
-- ("own notifications select": auth.uid() = user_id), and Realtime authorizes postgres_changes
-- against that SELECT policy — so each subscriber only ever receives their OWN inserts. INSERT
-- payloads carry the full NEW row regardless of replica identity, so the default identity suffices
-- for the badge (no REPLICA IDENTITY FULL needed here — unlike mig 132's score-UPDATE case).
--
-- Idempotent (guarded add, safe to re-apply). Table-only publication change (no columns) ⇒ the
-- check:migrations column-diff gate is BLIND to prod missing this (same caveat as migs 122/183) —
-- track PROD-PENDING and apply deliberately before/with the promotion that ships the digest.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;
end $$;
