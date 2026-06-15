-- Migration 130: add `games` to the supabase_realtime publication (J8-005, FP-3)
--
-- THE BUG: the scorekeeper page subscribes to postgres_changes on public.games
-- (app/[orgSlug]/scorekeeper/page.tsx) so the To-Score list self-updates between games when another
-- volunteer posts a score. But `games` was never added to the `supabase_realtime` publication, so
-- Supabase never replicates its changes to clients — the subscription is a silent no-op and the list
-- only updates on manual refresh.
--
-- THE FIX: add `games` to the publication. Idempotent — `pg_publication_tables` is checked first so
-- re-running (or running on an env where it was added via the dashboard) is a no-op.
--
-- RLS note: `games` has RLS DISABLED (schedule data is already public — the public tournament pages
-- render it via REST), so the anon Realtime client can read the replicated rows. No SELECT policy is
-- needed. If `games` ever gains RLS, a policy permitting the scorekeeper/public read must be added
-- for the subscription to keep working (see migration 101's notifications realtime note).
--
-- DEPLOY: dev-first (apply-migration-api.mjs --dev), then prod (--prod); check:migrations gates it.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'games'
  ) then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;
