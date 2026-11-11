-- ---------------------------------------------------------------
-- Migration 464 — the two merge functions answer the server alone (found 2026-11-11 by the two-step sign-in census,
-- Board Ready Part 1; recorded in docs/projects/active/BOARD_READY_ACCESS_SWEEP_3.md as a late finding; owner: fix now,
-- its own commit).
--
-- WHY: merge_rep_team_tags (mig 302, the current body) and merge_rep_team_award_types (mig 289) are SECURITY DEFINER and
-- were granted EXECUTE to `authenticated`, and neither asks who is calling. Any signed-in account, in any club, that knew
-- two ids could merge one team's tags or award types into another's (re-pointing every link) and delete the one merged
-- away. The app only ever calls them through the service role (lib/db.ts mergeRepTeamTags / the second tag merge /
-- mergeRepTeamAwardTypes), after its own team and capability checks, so the grant was never needed.
--
-- WHAT CHANGES: EXECUTE is revoked from `authenticated` (and, again, from public and anon). service_role keeps it.
-- Nothing else moves. A later CREATE OR REPLACE keeps these privileges; a later migration that re-grants them to
-- `authenticated` would reopen this (the earlier ones each did: 221, 239, 289, 302).
--
-- Idempotent. Invisible to check:migrations (grants), so it is in MANUAL_PROD_STEPS.json.
-- ---------------------------------------------------------------

begin;

revoke all on function public.merge_rep_team_tags(uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_rep_team_tags(uuid, uuid) to service_role;

revoke all on function public.merge_rep_team_award_types(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_rep_team_award_types(uuid, uuid, uuid) to service_role;

commit;
