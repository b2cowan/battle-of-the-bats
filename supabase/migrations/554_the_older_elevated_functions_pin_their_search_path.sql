-- ---------------------------------------------------------------
-- Migration 554 — the older elevated functions pin their search_path (/dba, owner 2026-11-27: "both")
--
-- WHY: Supabase's security advisor, WARN function_search_path_mutable. Seven SECURITY DEFINER functions (owner
-- postgres) never fixed where they look their unqualified table names up, on dev and prod alike; six of them anon and
-- authenticated may EXECUTE. A temporary table of the same name is searched BEFORE public, and on dev a look-alike
-- organization_members made is_org_owner() answer true for a made-up person (rolled back). Nothing reaches it today:
-- the API lets no visitor create a table or send its own SQL, and neither role has CREATE on public.
-- The eighth, league_game_snapshot (552), is not elevated and reads no table; it is the 2026-11-27 morning report's
-- warning, pinned here so the same change clears it.
--
-- WHAT CHANGES: ALTER FUNCTION … SET search_path = public, pg_temp on the eight. pg_temp is named LAST on purpose:
-- left out, Postgres still searches it first for tables, which `SET search_path = public` alone does not stop.
-- Bodies, grants, owners and signatures untouched. Every unqualified name in the eight bodies is a public table, a
-- public function (can_access_tournament, which pins its own empty path) or a pg_catalog built-in; auth.uid() is
-- already qualified.
--
-- ⚠ ORDER: AFTER 552, on every database. CREATE OR REPLACE FUNCTION resets a function's settings, so applying 552
-- (or an earlier definition of any of the eight) after this one would undo it, and a later replacement of any of them
-- must carry the SET clause in its own definition. INVISIBLE to the drift check: declared in MANUAL_PROD_STEPS.json
-- with a proconfig check. Safe to run twice. Prod: in the same promote as 552, applied after it.
-- ---------------------------------------------------------------

ALTER FUNCTION public.is_org_owner(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_my_org_ids() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_org_member_for_tournament(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_org_member_for_age_group(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.can_access_tournament_for_pool(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.can_access_tournament_for_rule_item(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.claim_next_slot(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.league_game_snapshot(public.league_games) SET search_path = public, pg_temp;
