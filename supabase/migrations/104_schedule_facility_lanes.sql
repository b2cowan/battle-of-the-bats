-- =============================================================================
-- Migration 104: Schedule Facility Lanes
-- Created: 2026-06-01
--
-- Adds temporary schedule resources that can stand in for real venues/facilities
-- during generation. A lane can later be resolved to a real venue/facility and
-- all linked games keep following that mapping.
-- =============================================================================

CREATE TABLE IF NOT EXISTS schedule_facility_lanes (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id              uuid        NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  division_id                uuid        NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  label                      text        NOT NULL,
  sort_order                 int         NOT NULL DEFAULT 0,
  resolved_venue_id          uuid        REFERENCES diamonds(id) ON DELETE SET NULL,
  resolved_venue_facility_id uuid        REFERENCES venue_facilities(id) ON DELETE SET NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT schedule_facility_lanes_label_not_blank
    CHECK (length(trim(label)) > 0),
  CONSTRAINT schedule_facility_lanes_unique_label
    UNIQUE (tournament_id, division_id, label)
);

CREATE INDEX IF NOT EXISTS schedule_facility_lanes_tournament_id_idx
  ON schedule_facility_lanes (tournament_id);
CREATE INDEX IF NOT EXISTS schedule_facility_lanes_division_id_idx
  ON schedule_facility_lanes (division_id);
CREATE INDEX IF NOT EXISTS schedule_facility_lanes_resolved_venue_id_idx
  ON schedule_facility_lanes (resolved_venue_id);
CREATE INDEX IF NOT EXISTS schedule_facility_lanes_resolved_venue_facility_id_idx
  ON schedule_facility_lanes (resolved_venue_facility_id);

ALTER TABLE schedule_facility_lanes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_schedule_facility_lanes"
  ON schedule_facility_lanes FOR SELECT
  USING (true);

CREATE POLICY "org_members_insert_schedule_facility_lanes"
  ON schedule_facility_lanes FOR INSERT
  WITH CHECK (can_access_tournament(tournament_id));

CREATE POLICY "org_members_update_schedule_facility_lanes"
  ON schedule_facility_lanes FOR UPDATE
  USING (can_access_tournament(tournament_id));

CREATE POLICY "org_members_delete_schedule_facility_lanes"
  ON schedule_facility_lanes FOR DELETE
  USING (can_access_tournament(tournament_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_facility_lanes TO authenticated;
GRANT SELECT                         ON public.schedule_facility_lanes TO anon;

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS schedule_facility_lane_id uuid
    REFERENCES schedule_facility_lanes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS games_schedule_facility_lane_id_idx
  ON games (schedule_facility_lane_id);
