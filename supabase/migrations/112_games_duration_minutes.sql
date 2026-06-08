-- 112_games_duration_minutes.sql
-- Applied: dev + prod 2026-06-06.
-- Per-game length. Each game may carry its own duration (in minutes); NULL means
-- "use the default" — resolved division → tournament → system default at read time.
-- This lets playoff/bracket games (and individual games like a final) run a
-- different length than pool games, validated per game by Schedule Health and
-- the conflict checker. Replaces the tournament-level playoff_game_duration_minutes
-- setting (which couldn't vary by division / round / game).

ALTER TABLE games ADD COLUMN IF NOT EXISTS duration_minutes integer;

COMMENT ON COLUMN games.duration_minutes IS
  'Optional per-game length in minutes. NULL = use the resolved default (division.settings.game_duration_minutes → tournament.settings.game_duration_minutes → system default).';
