-- 324 — The team-wide calendar token retires: rep_teams.family_calendar_token_hash is dropped
-- (Club Tier Stage 6d, A6 — owner 2026-10-11: "Write it now, hold for prod"; plan:
--  docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md §6 Stage 6d, D07)
--
-- Mig 215 added a team-wide feed token, stored as a fingerprint, to be handed out at Public link. It never was: the
-- function that minted it made a NEW token on every call (named "ensure", it rotated), so a public page that showed it
-- would have stopped every subscriber on each visit (S6D-02) — 0 rows ever held one, on dev and on production. Stage 6d
-- gives the team's public feed the page's own address instead (`/{org}/teams/{team}/calendar`: no secret, nothing to
-- reset), and nothing reads or writes this column after the 6d code (`ensureTeamCalendarToken` and
-- `resolveTeamByCalendarToken` are gone, and the family feed's team-wide branch with them).
--
-- ⚠ A DROP-COLUMN MIGRATION GOES ON LAST AT A PROMOTE (the release-history record): production must be running the 6d
-- code — which never selects the column — before this applies, or the old code's family surfaces (they select it in
-- lib/family-access.ts TEAM_COLUMNS) fail. Held in MANUAL_PROD_STEPS.json until then. The partial unique index goes with
-- the column.

begin;

drop index if exists public.rep_teams_family_calendar_token_uniq;
alter table public.rep_teams drop column if exists family_calendar_token_hash;

commit;
