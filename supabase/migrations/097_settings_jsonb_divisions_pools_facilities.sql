-- Migration 097: Add settings JSONB column to divisions, pools, and venue_facilities
-- These flexible config bags allow new per-entity settings without future schema changes.
-- Matches the pattern already established on the tournaments table.

-- divisions.settings — stores game timing overrides (game_duration_minutes, buffer_minutes)
-- and future per-division config (scoring format, tiebreaker rules, pool advancement logic).
ALTER TABLE divisions
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';

-- pools.settings — reserved for future pool-level config.
ALTER TABLE pools
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';

-- venue_facilities.settings — reserved for future facility-level config.
ALTER TABLE venue_facilities
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
