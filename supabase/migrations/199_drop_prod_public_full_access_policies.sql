-- 199: Drop the PROD-only legacy wide-open RLS policies (Codebase Cleanup Tranche 0, finding D01).
--
-- Live pg_policies on prod (verified 2026-07-24) carries permissive policies absent from dev:
--   * "Allow public full access to <table>"  roles={anon}, cmd=ALL, USING(true), WITH CHECK(true)
--     on announcements, diamonds, divisions (policy still named for pre-rename "age_groups"),
--     games, teams, tournaments — i.e. the PUBLIC anon key could write/delete these tables via REST.
--   * pools_admin_all  roles={authenticated}, cmd=ALL, USING(true) — any signed-in account could
--     write any pools row.
--   * Two redundant prod-only duplicate read policies on pools (covered by pools_anon_read, which
--     exists on both envs).
--
-- Dev has NONE of these and operates correctly: public reads are served by the scoped *_anon_read
-- policies (present on both envs) and all app writes go through the service role, which bypasses
-- RLS. Dropping these therefore removes attack surface with no behavior change.
--
-- Guarded with IF EXISTS so the migration is a no-op on dev (keeps envs applied-in-lockstep).
-- NOT dropped here (exists on BOTH envs, possibly by design — flagged for the DB tranche):
--   teams_anon_insert (public INSERT on teams).

DROP POLICY IF EXISTS "Allow public full access to announcements" ON public.announcements;
DROP POLICY IF EXISTS "Allow public full access to diamonds" ON public.diamonds;
DROP POLICY IF EXISTS "Allow public full access to age_groups" ON public.divisions;
DROP POLICY IF EXISTS "Allow public full access to games" ON public.games;
DROP POLICY IF EXISTS "Allow public full access to teams" ON public.teams;
DROP POLICY IF EXISTS "Allow public full access to tournaments" ON public.tournaments;

DROP POLICY IF EXISTS "pools_admin_all" ON public.pools;
DROP POLICY IF EXISTS "Allow public read access for pools" ON public.pools;
DROP POLICY IF EXISTS "pools_public_read" ON public.pools;
