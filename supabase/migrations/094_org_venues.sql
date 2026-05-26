-- =============================================================================
-- Migration 094: Org Venue Library
-- Created: 2026-05-25
-- Plan: docs/active/VENUE_HIERARCHY_PLAN.md
--
-- Adds the org-level venue library — a central store for physical facilities
-- (arenas, parks, complexes) that org admins define once and import into
-- individual tournaments. These tables are INDEPENDENT of tournament venues.
--
-- org_venues         — one row per physical facility (Lions Park, Canlan, etc.)
-- org_venue_facilities — playing surfaces within a facility (Diamond 1, Rink A)
--
-- Terminology locked:
--   Venue        = the physical location / facility
--   Facility     = the individual playing surface within a venue
--   Facility Type = enum: diamond | field | court | rink | gym | other
--
-- All admin API routes use supabaseAdmin (bypasses RLS).
-- RLS policies here cover direct browser-client (authClient()) calls only.
-- =============================================================================

-- =============================================================================
-- STEP 1: org_venues
-- =============================================================================

CREATE TABLE org_venues (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  address      text,
  notes        text,
  is_active    bool        NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX org_venues_org_id_idx ON org_venues (org_id);

ALTER TABLE org_venues ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's venue library
CREATE POLICY "org_members_read_org_venues"
  ON org_venues FOR SELECT
  USING (is_org_member(org_id));

-- Org members can write (admin API gate handles capability checks)
CREATE POLICY "org_members_write_org_venues"
  ON org_venues FOR INSERT
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "org_members_update_org_venues"
  ON org_venues FOR UPDATE
  USING (is_org_member(org_id));

CREATE POLICY "org_members_delete_org_venues"
  ON org_venues FOR DELETE
  USING (is_org_member(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_venues TO authenticated;

-- =============================================================================
-- STEP 2: org_venue_facilities
-- =============================================================================

CREATE TABLE org_venue_facilities (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_venue_id    uuid        NOT NULL REFERENCES org_venues(id) ON DELETE CASCADE,
  org_id          uuid        NOT NULL REFERENCES organizations(id),
  name            text        NOT NULL,
  facility_type   text        NOT NULL DEFAULT 'other',
  display_order   int         NOT NULL DEFAULT 0,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_venue_facilities_facility_type_check
    CHECK (facility_type IN ('diamond','field','court','rink','gym','other'))
);

CREATE INDEX org_venue_facilities_org_venue_id_idx ON org_venue_facilities (org_venue_id);
CREATE INDEX org_venue_facilities_org_id_idx       ON org_venue_facilities (org_id);

ALTER TABLE org_venue_facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_read_org_venue_facilities"
  ON org_venue_facilities FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "org_members_write_org_venue_facilities"
  ON org_venue_facilities FOR INSERT
  WITH CHECK (is_org_member(org_id));

CREATE POLICY "org_members_update_org_venue_facilities"
  ON org_venue_facilities FOR UPDATE
  USING (is_org_member(org_id));

CREATE POLICY "org_members_delete_org_venue_facilities"
  ON org_venue_facilities FOR DELETE
  USING (is_org_member(org_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_venue_facilities TO authenticated;
