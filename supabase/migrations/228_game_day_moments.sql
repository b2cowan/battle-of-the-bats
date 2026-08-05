-- 228_game_day_moments.sql
-- Game-Day Mode P2 — "moments" (docs/projects/active/COACH_GAME_DAY_MODE_PLAN.md §3.7/§4,
-- owner-approved mockups artifact 46d0fa8b rev 4, decisions Q1–Q5 signed off 2026-08-05).
--
-- ONE line a coach types at the bench because they want to remember it, optionally tagged to a
-- player. The feature's whole design is that this table feeds NOTHING — not playing time, not
-- attendance, not the season record, not a notification. P1 kept its promise by writing no new
-- table at all; P2 writes one, so the promise has to be kept by what the table is allowed to
-- touch instead (tests/unit/coach-game-moments.test.ts holds the line).
--
-- ⚠ APPEND-ONLY AT THE APP LAYER, deliberately not by a DB trigger: there is no UPDATE route
-- and no update helper in lib/db.ts to call. A mistyped moment is DELETED and retyped, so
-- "what you wrote at 7:32" is always what was written at 7:32. Deletion is head-coach-any /
-- author-own, the Scouting Book's curation rule (mig 225).
--
-- ⚠ Coach-API-only (service role). RLS is ENABLED with no policies so the default anon SELECT
-- grant cannot reach it (memory: reference_supabase_rls_grants) — the same treatment mig 225's
-- three tables received.
--
-- ⚠ program_year_id is stored rather than derived through the event, because Season Wrapped
-- reads a whole season's moments and a finished season must be able to answer that question
-- without walking every event row. `event_id` stays NOT NULL: a moment without a night is not
-- a moment, and CASCADE is correct — delete the game, delete what was written at it.

CREATE TABLE IF NOT EXISTS rep_team_game_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  org_id uuid NOT NULL,
  program_year_id uuid NOT NULL,
  event_id uuid NOT NULL,
  -- Optional player tag. SET NULL rather than CASCADE: a player leaving the roster must not
  -- erase the coach's memory of the night, only the name attached to it.
  player_id uuid,
  body text NOT NULL,
  happened_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The app enforces 1–280 (lib/coach-game-moments.ts). The CHECK is the floor under it, not
  -- the product rule — a length message belongs in the UI, not in a Postgres error.
  CONSTRAINT rep_team_game_moments_body_len CHECK (char_length(body) BETWEEN 1 AND 280),
  CONSTRAINT fk_rep_team_game_moments_team FOREIGN KEY (team_id) REFERENCES rep_teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_game_moments_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_game_moments_year FOREIGN KEY (program_year_id) REFERENCES rep_program_years(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_game_moments_event FOREIGN KEY (event_id) REFERENCES rep_team_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_rep_team_game_moments_player FOREIGN KEY (player_id) REFERENCES rep_roster_players(id) ON DELETE SET NULL,
  CONSTRAINT fk_rep_team_game_moments_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ONE index per read the feature actually makes, and no more — every unmatched index is pure
-- write cost on a table whose whole job is being cheap to append to:
--   1. tonight's game        → console + End-game wrap   (team_id, event_id)
--   2. one player's season   → the player's page          (team_id, program_year_id, player_id)
--   3. a whole season        → Season Wrapped's one slot  (team_id, program_year_id)
-- #3 is the left prefix of #2, so two indexes serve all three reads. There is deliberately no
-- index on org_id alone: org_id is stored for scoping and cascade, never queried by itself.
CREATE INDEX IF NOT EXISTS idx_rep_team_game_moments_event ON rep_team_game_moments(team_id, event_id);
CREATE INDEX IF NOT EXISTS idx_rep_team_game_moments_season_player
  ON rep_team_game_moments(team_id, program_year_id, player_id);

ALTER TABLE rep_team_game_moments ENABLE ROW LEVEL SECURITY;
