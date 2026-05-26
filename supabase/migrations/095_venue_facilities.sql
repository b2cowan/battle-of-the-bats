-- =============================================================================
-- Migration 095: Tournament Venue Facilities + Column Additions
-- Created: 2026-05-25
-- Plan: docs/active/VENUE_HIERARCHY_PLAN.md
--
-- Adds the tournament-level facilities layer that sits beneath the existing
-- `diamonds` table (each diamonds row = one venue/facility parent).
--
-- venue_facilities        — playing surfaces within a tournament venue
--                           (imported or locally created per tournament)
-- diamonds.source_org_venue_id — FK back to org_venues if imported from library
-- games.venue_facility_id — links a game to a specific facility
--                           (kept alongside diamond_id for backward compat)
--
-- The data backfill (one facility per existing diamond) is in migration 096.
-- =============================================================================

-- =============================================================================
-- STEP 1: Add import-tracking column to diamonds
-- =============================================================================

ALTER TABLE diamonds
  ADD COLUMN IF NOT EXISTS source_org_venue_id uuid
    REFERENCES org_venues(id) ON DELETE SET NULL;

-- =============================================================================
-- STEP 2: venue_facilities table
-- =============================================================================

CREATE TABLE venue_facilities (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id               uuid        NOT NULL REFERENCES diamonds(id) ON DELETE CASCADE,
  tournament_id          uuid        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name                   text        NOT NULL,
  facility_type          text        NOT NULL DEFAULT 'other',
  display_order          int         NOT NULL DEFAULT 0,
  notes                  text,
  source_org_facility_id uuid        REFERENCES org_venue_facilities(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_facilities_facility_type_check
    CHECK (facility_type IN ('diamond','field','court','rink','gym','other'))
);

CREATE INDEX venue_facilities_venue_id_idx       ON venue_facilities (venue_id);
CREATE INDEX venue_facilities_tournament_id_idx  ON venue_facilities (tournament_id);

ALTER TABLE venue_facilities ENABLE ROW LEVEL SECURITY;

-- Public can read (needed for public schedule pages served via supabaseAdmin,
-- but adding anon SELECT allows direct browser queries too)
CREATE POLICY "anon_read_venue_facilities"
  ON venue_facilities FOR SELECT
  USING (true);

-- Org members can write (capability gate is in the API route)
CREATE POLICY "org_members_write_venue_facilities"
  ON venue_facilities FOR INSERT
  WITH CHECK (can_access_tournament(tournament_id));

CREATE POLICY "org_members_update_venue_facilities"
  ON venue_facilities FOR UPDATE
  USING (can_access_tournament(tournament_id));

CREATE POLICY "org_members_delete_venue_facilities"
  ON venue_facilities FOR DELETE
  USING (can_access_tournament(tournament_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_facilities TO authenticated;
GRANT SELECT                         ON public.venue_facilities TO anon;

-- =============================================================================
-- STEP 3: Add venue_facility_id to games
--
-- Kept alongside diamond_id (which remains the legacy FK to the parent venue).
-- Both coexist until the next major cleanup migration.
-- game.venue_facility_id is the authoritative reference going forward;
-- diamond_id is deprecated but NOT dropped here.
-- =============================================================================

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS venue_facility_id uuid
    REFERENCES venue_facilities(id) ON DELETE SET NULL;

CREATE INDEX games_venue_facility_id_idx ON games (venue_facility_id);
