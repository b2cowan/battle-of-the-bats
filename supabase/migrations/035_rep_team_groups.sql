-- Migration 035: rep team groups

CREATE TABLE rep_team_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 50),
  display_order int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_rep_team_groups_org_name ON rep_team_groups (org_id, lower(name));

ALTER TABLE rep_teams
  ADD COLUMN group_id uuid REFERENCES rep_team_groups(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE rep_team_groups ENABLE ROW LEVEL SECURITY;

-- Any org member can read their org's groups
CREATE POLICY "org members can read groups"
  ON rep_team_groups FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Only owner/admin can write
CREATE POLICY "owner admin can manage groups"
  ON rep_team_groups FOR ALL
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
