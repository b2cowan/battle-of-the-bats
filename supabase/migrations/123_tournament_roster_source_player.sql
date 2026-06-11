-- Migration 123: tournament_roster_players.source_player_id (free-tier Coaches Phase 5j)
-- Provenance back-link from a per-event roster snapshot row to the persistent master-roster
-- player it was copied from (basic_coach_team_players, mig 114). Enables idempotent coach
-- re-submission (replace only the coach's own source='coach' rows), a "N of M players submitted"
-- UX, and an audit of which master player each snapshot row originated from.
--
-- Nullable + ON DELETE SET NULL: the per-event snapshot is INDEPENDENT of the master by design
-- (the master is identity-only and is NEVER mutated by a submission — see lib/basic-coach-roster.ts
-- buildTournamentRosterSnapshot, the master/snapshot seam). Gate-captured (source='gate') and
-- admin-entered (source='admin') rows have no master origin and keep this null. If a coach later
-- deletes a master player, the already-submitted snapshot row survives with a null back-link.
--
-- DEPLOY GATE: the FK target basic_coach_team_players is mig 114 (dev-only today). This migration
-- joins migrations 114–117 in the Phase-5 prod deploy gate (npm run check:migrations) — all of them
-- must reach prod before any Phase-5 prod deploy, and 114 must apply before 123 (FK dependency).

alter table public.tournament_roster_players
  add column if not exists source_player_id uuid
  references public.basic_coach_team_players(id) on delete set null;

comment on column public.tournament_roster_players.source_player_id is
  'OPTIONAL provenance back-link to the master-roster player (basic_coach_team_players.id, mig 114) this snapshot row was copied from by a coach event-roster submission (source=''coach''). Null for gate/admin-entered rows and for coach rows whose master player was later deleted (ON DELETE SET NULL). The snapshot is independent of the master — submitting NEVER mutates basic_coach_team_players.';
