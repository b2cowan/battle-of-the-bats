-- 143: free→Premium upgrade migration — row-level provenance for idempotent retry (Coach Premium).
--
-- The upgrade copies a free Basic team's roster/schedule/fees into the new Premium season at
-- provisioning (Phase 4). If a partial copy failed, there was no SAFE way to retry — migrated rows
-- carried no link to the Basic row they came from, so a blind re-run would DUPLICATE roster/events.
--
-- This tags the two entities that lack a natural dedup key (roster players, schedule events) with the
-- Basic row they came from, plus a PARTIAL UNIQUE index per entity so a re-run (or two concurrent
-- retries) can only ever copy a given Basic row ONCE — the second insert hits the index and is caught
-- + skipped. Fees need no new column: they already have a natural key (UNIQUE(program_year_id,
-- player_id) on rep_player_dues_schedules), so per-player idempotency is already DB-enforced.
--
-- Additive + reversible. The tags are written ONLY by the migration/repair path; coach-created rows
-- leave them NULL, and the partial index ignores NULLs, so manually-added players/events are never
-- constrained by it.

alter table public.rep_roster_players
  add column if not exists source_basic_player_id uuid;

alter table public.rep_team_events
  add column if not exists source_basic_event_id uuid;

create unique index if not exists rep_roster_players_src_basic_player_uq
  on public.rep_roster_players (program_year_id, source_basic_player_id)
  where source_basic_player_id is not null;

create unique index if not exists rep_team_events_src_basic_event_uq
  on public.rep_team_events (program_year_id, source_basic_event_id)
  where source_basic_event_id is not null;
