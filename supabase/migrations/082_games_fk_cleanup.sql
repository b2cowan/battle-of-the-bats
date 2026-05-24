-- Migration 082: Drop residual duplicate FK constraints on games (prod only)
-- Finding #21 — Migration 080 cleaned up tournament_id FK duplicates but missed
-- two additional duplicate FKs on games.age_group_id and games.away_team_id.
--
-- ⚠️  PROD ONLY. Dev has only the auto-named *_fkey versions (one each), which
--     is correct for dev. These IF EXISTS drops are no-ops on dev.
--
-- Keeping: fk_games_age_group, fk_games_away_team (explicit names, prod convention)
-- Dropping: games_age_group_id_fkey, games_away_team_id_fkey (auto-named duplicates)

BEGIN;

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_age_group_id_fkey;

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_away_team_id_fkey;

COMMIT;
