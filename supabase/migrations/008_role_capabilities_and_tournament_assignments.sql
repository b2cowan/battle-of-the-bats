-- Phase 1: capabilities column + tournament assignment scoping
--
-- capabilities: nullable JSONB override map on organization_members.
--   Absence = use role defaults from lib/roles.ts.
--   { "send_communications": true } grants that capability above the role default.
--   { "update_schedule": false } revokes it.
--
-- org_member_tournament_assignments: absence-means-unrestricted junction table.
--   A user with zero rows here sees ALL tournaments for the org.
--   A user with rows here sees ONLY those tournaments.
--   Owners always bypass this table (enforced in application layer).

ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS capabilities jsonb;

CREATE TABLE IF NOT EXISTS org_member_tournament_assignments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_member_id   uuid        NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  tournament_id   uuid        NOT NULL REFERENCES tournaments(id)          ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_member_id, tournament_id)
);

CREATE INDEX IF NOT EXISTS idx_omta_org_member ON org_member_tournament_assignments(org_member_id);
CREATE INDEX IF NOT EXISTS idx_omta_tournament  ON org_member_tournament_assignments(tournament_id);
