-- Migration 036: multi-group rep team scope for org members

CREATE TABLE org_member_rep_group_scopes (
  member_id uuid NOT NULL REFERENCES organization_members(id) ON DELETE CASCADE,
  group_id  uuid NOT NULL REFERENCES rep_team_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (member_id, group_id)
);

CREATE INDEX idx_org_member_rep_group_scopes_member
  ON org_member_rep_group_scopes (member_id);
