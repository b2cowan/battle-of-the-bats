-- Migration 131: basic_coach_teams.activated_features (coach portal progressive disclosure)
--
-- WHY: the rebuilt org-less Coaches Portal is team-scoped and TOURNAMENT-FIRST. A coach
-- who registers a team for a tournament is a participant, not someone who signed up to run
-- team operations — so the team-ops sections (Roster, Schedule, Fees, Announcements) are
-- Tier-2: HIDDEN from the nav until the coach opts in to them (via the "Explore" catalog or
-- an earned in-context nudge, e.g. "reuse this roster next time?"). See
-- docs/projects/active/COACH_NAV_REBUILD_PLAN.md (Decision 2b/2c, OQ-7).
--
-- This column persists WHICH Tier-2 capabilities a coach has turned on for a given team, so
-- nav visibility and the persisted-roster opt-in survive across sessions. A feature key in
-- the array → its section appears in the rail. Empty array (the default) = a brand-new
-- tournament-only coach: clean, tournament-first nav, no ops bloat.
--
-- Feature keys (string set, app-defined — not enforced by the DB): 'roster', 'schedule',
-- 'fees', 'announcements'. The set may grow; keeping it as a JSONB array avoids a migration
-- per new capability.
--
-- JSONB (not text[]) with a '[]' default so a row always has a usable empty array (no NULL
-- handling at every read site). NOT NULL with default keeps the app code simple.
--
-- DEPLOY GATE: dev-only on apply. Must reach prod (npm run check:migrations) before the
-- nav-rebuild code that reads activated_features ships to prod.

alter table public.basic_coach_teams
  add column if not exists activated_features jsonb not null default '[]'::jsonb;

comment on column public.basic_coach_teams.activated_features is
  'Coach-opt-in set of Tier-2 team-ops capabilities turned on for this team, driving Coaches Portal nav visibility (progressive disclosure, mig 131). JSONB array of feature keys (''roster''|''schedule''|''fees''|''announcements''; app-defined, not DB-enforced). Empty [] (default) = tournament-only coach, ops sections hidden. A key present = that section appears in the rail. See COACH_NAV_REBUILD_PLAN.md.';
