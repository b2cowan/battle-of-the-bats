-- Migration 111: drop the vestigial teams.players jsonb column.
--
-- Tournament rosters now live in `tournament_roster_players` (migration 110).
-- The DB architecture review (2026-05-23, docs/agents/db/DB_ARCHITECTURE_REVIEW.md #3)
-- flagged `teams.players` as never-read / never-written ("drop before any roster
-- feature ships"). All app references were removed alongside this migration.

alter table public.teams drop column if exists players;
