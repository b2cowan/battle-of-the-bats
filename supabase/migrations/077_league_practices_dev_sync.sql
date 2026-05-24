-- ============================================================
-- Migration 077 — Add league_practices to dev (corrective sync)
-- DEV ONLY — this table already exists in prod; do NOT apply to prod.
-- ============================================================
-- league_practices exists in prod but was never applied to dev.
-- This corrective migration creates the table in dev to match prod's
-- schema snapshot (2026-05-23) column-for-column.
--
-- Column sources:
--   - Column names: prod schema snapshot (memory/reference_db_schema.md)
--   - Types / nullability: lib/types.ts LeaguePractice + LeaguePracticeInput
--   - Status enum: LeaguePracticeStatus = 'scheduled' | 'cancelled'
--
-- Note: prod does not have org_id on this table. This migration matches
-- prod exactly. A follow-up migration should add org_id to BOTH
-- environments (same pattern as league_games / migration 075) to
-- eliminate the 2-hop RLS chain (season_id → league_seasons.org_id).
--
-- After applying, update AgentPlaybook.tsx line ~194 to remove
-- league_practices from the "tables that do NOT exist" list.
-- ============================================================

CREATE TABLE IF NOT EXISTS league_practices (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id            uuid        NOT NULL REFERENCES league_seasons(id) ON DELETE CASCADE,
  division_id          uuid        REFERENCES league_divisions(id) ON DELETE SET NULL,
  team_id              uuid        NOT NULL REFERENCES league_teams(id) ON DELETE CASCADE,
  scheduled_at         timestamptz,
  ends_at              timestamptz,
  location             text,
  notes                text,
  status               text        NOT NULL DEFAULT 'scheduled'
                                   CHECK (status IN ('scheduled', 'cancelled')),
  recurrence_group_id  uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Index: primary query pattern — all practices for a season (getPracticesForSeason)
CREATE INDEX IF NOT EXISTS league_practices_season_idx
  ON league_practices(season_id);

-- Index: team-scoped query (getPracticesForTeam)
CREATE INDEX IF NOT EXISTS league_practices_team_idx
  ON league_practices(team_id);

-- Index: schedule ordering within a season (ORDER BY scheduled_at)
CREATE INDEX IF NOT EXISTS league_practices_schedule_idx
  ON league_practices(season_id, scheduled_at);

-- Partial index: recurrence group lookups (cancelPractice bulk-cancel)
-- Only rows that belong to a recurring series have this set.
CREATE INDEX IF NOT EXISTS league_practices_recurrence_idx
  ON league_practices(recurrence_group_id)
  WHERE recurrence_group_id IS NOT NULL;

-- ---------------------------------------------------------------
-- RLS — consistent with league module pattern (migration 020)
-- All app writes use supabaseAdmin (service role, bypasses RLS).
-- Read policies mirror league_games.
-- ---------------------------------------------------------------
ALTER TABLE league_practices ENABLE ROW LEVEL SECURITY;

-- Org members can read practices for their seasons
CREATE POLICY "org members can read practices"
  ON league_practices FOR SELECT
  USING (
    season_id IN (
      SELECT id FROM league_seasons
      WHERE org_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );
