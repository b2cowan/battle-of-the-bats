-- 207: real tournament games become first-class team events (Coach Portal Launch Batch 4, P0 #2).
--
-- THE GAP THIS CLOSES
-- Attendance (rep_team_event_attendance) and lineups (rep_team_lineups) both hang off
-- rep_team_events.id. A team's REAL platform tournament game is a tournament-side `games` row
-- reached through its registration — it has NO rep_team_events row, so there is nothing for
-- attendance or a lineup to attach to. The premium Schedule could only render it as a read-only
-- chip. For many teams tournament games ARE the season, so the paid portal was at its weakest
-- exactly where it was sold hardest.
--
-- WHY A MIRROR RATHER THAN A SECOND KEY ON EVERY TOOL
-- Every consumer in the portal ALREADY accepts event_type='tournament_game' — the lineups list and
-- save route, the attendance reliability rollup, the canonical record rule (WRAPPED_RECORD_EVENT_TYPES),
-- the Overview phase anchors, Season Wrapped, and the club admin's past-year record. Mirroring each
-- real game into a rep_team_events row therefore makes all of them work with ZERO changes. The
-- alternative (teaching attendance + lineups to attach to either a rep event or a tournament game)
-- needs new partial-unique indexes on both child tables and an OR-branch threaded through ~12 query
-- sites, any one of which could later be updated for one arm and not the other.
--
-- WHY NOT A FOREIGN KEY (deliberate — mirrors 143's `source_basic_event_id`)
-- A loose provenance tag, not an FK. If the organizer deletes a game, an FK cascade would silently
-- destroy the coach's attendance and lineup for it; ON DELETE SET NULL would be worse still, quietly
-- converting an organizer-owned game into a fully-editable coach event. The reconcile in
-- lib/rep-tournament-game-mirror.ts owns that decision instead: it re-points the row at a recognisable
-- replacement where one exists (delete-and-recreate / bracket regeneration), otherwise cancels the row
-- when the coach has work on it and removes it cleanly when they don't.
--
-- The PARTIAL UNIQUE index is the idempotency guarantee: a given tournament game can be mirrored at
-- most once per season, so a concurrent double-sync can only ever produce one row (the loser hits the
-- index and is skipped). NULLs are ignored by the index, so a coach's own events — which always leave
-- this column NULL — are never constrained by it.
--
-- Additive + reversible. Written ONLY by the mirror sync; coach-created events leave it NULL.

alter table public.rep_team_events
  add column if not exists source_tournament_game_id uuid;

create unique index if not exists rep_team_events_src_tournament_game_uq
  on public.rep_team_events (program_year_id, source_tournament_game_id)
  where source_tournament_game_id is not null;

comment on column public.rep_team_events.source_tournament_game_id is
  'Provenance tag (Batch 4, mig 207): the tournament-side games.id this event mirrors. NOT an FK — the mirror reconcile owns delete/re-point behaviour so an organizer deleting a game can never cascade away a coach''s attendance or lineup. NULL on every coach-created event. See DATA_DICTIONARY.md.';
