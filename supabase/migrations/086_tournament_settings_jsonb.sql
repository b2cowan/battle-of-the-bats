-- Migration 086: Add tournament_settings JSONB column
-- Stores small per-tournament preferences that don't warrant their own columns.
-- Initial keys: rulesLayout ('columns' | 'single'), resourcesLayout ('list' | 'grid')

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';

COMMENT ON COLUMN tournaments.settings IS
  'Per-tournament display/behaviour preferences. Keys: rulesLayout, resourcesLayout.';
