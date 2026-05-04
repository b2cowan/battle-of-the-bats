-- =============================================================================
-- Migration 007: Tournament Archives (Digital Ledger)
-- Run in Supabase SQL Editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS tournament_archives (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id    uuid        REFERENCES tournaments(id) ON DELETE SET NULL,
  org_id           uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tournament_name  text        NOT NULL,
  season           text        NOT NULL,          -- String year, e.g. "2026"
  division         text,                          -- Comma-separated age group names
  final_snapshot   jsonb       NOT NULL,          -- Full data blob; never mutated
  winner_team_id   uuid        REFERENCES teams(id) ON DELETE SET NULL,
  winner_team_name text,
  runner_up_name   text,
  total_teams      integer,
  total_games      integer,
  integrity_hash   text        NOT NULL,
  sealed_at        timestamptz NOT NULL DEFAULT now(),
  sealed_by        uuid        REFERENCES auth.users(id)
);

-- One archive record per tournament (where tournament_id is not null)
CREATE UNIQUE INDEX tournament_archives_tournament_id_unique
  ON tournament_archives(tournament_id)
  WHERE tournament_id IS NOT NULL;

-- Fetch all records for an org, newest first
CREATE INDEX tournament_archives_org_season
  ON tournament_archives(org_id, season DESC, sealed_at DESC);

ALTER TABLE tournament_archives ENABLE ROW LEVEL SECURITY;

-- Public read — same pattern as all other tables in this codebase
CREATE POLICY "anon_read_archives"
  ON tournament_archives FOR SELECT USING (true);

-- Only org members can seal (insert).
-- In practice, all inserts come via supabaseAdmin in the API route (bypasses RLS).
-- This policy is belt-and-suspenders protection.
CREATE POLICY "org_members_insert_archives"
  ON tournament_archives FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- No UPDATE or DELETE policies — table is intentionally append-only.
