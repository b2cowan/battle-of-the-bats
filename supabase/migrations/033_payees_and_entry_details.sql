-- Migration 033: org_payees table + payment detail columns on accounting_entries and rep_team_expenses

-- ── org_payees ────────────────────────────────────────────────────────────────
-- team_id NULL  → org-wide payee (admin-created, visible to all org members)
-- team_id SET   → team-scoped payee (coach-created, visible only to that team)
CREATE TABLE org_payees (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id    uuid REFERENCES rep_teams(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(trim(name)) > 0 AND char_length(name) <= 200),
  notes      text,
  is_active  boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Org-wide payees must be unique by name within org
CREATE UNIQUE INDEX idx_org_payees_org_name   ON org_payees (org_id, lower(name)) WHERE team_id IS NULL;
-- Team-scoped payees must be unique by name within team
CREATE UNIQUE INDEX idx_org_payees_team_name  ON org_payees (org_id, team_id, lower(name)) WHERE team_id IS NOT NULL;

CREATE INDEX idx_org_payees_org_id  ON org_payees(org_id);
CREATE INDEX idx_org_payees_team_id ON org_payees(team_id);

ALTER TABLE org_payees ENABLE ROW LEVEL SECURITY;

-- Org members can read org-wide payees
CREATE POLICY "org members read org-wide payees"
  ON org_payees FOR SELECT
  USING (
    team_id IS NULL AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_payees.org_id
        AND om.user_id = auth.uid()
        AND om.accepted_at IS NOT NULL
    )
  );

-- Team coaches can read their own team-scoped payees
CREATE POLICY "team coaches read team payees"
  ON org_payees FOR SELECT
  USING (
    team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM rep_team_coaches rc
      WHERE rc.team_id = org_payees.team_id
        AND rc.user_id = auth.uid()
    )
  );

-- Org admins can insert org-wide payees
CREATE POLICY "org admins insert org-wide payees"
  ON org_payees FOR INSERT
  WITH CHECK (
    team_id IS NULL AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_payees.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'treasurer', 'admin')
        AND om.accepted_at IS NOT NULL
    )
  );

-- Team coaches can insert team-scoped payees
CREATE POLICY "team coaches insert team payees"
  ON org_payees FOR INSERT
  WITH CHECK (
    team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM rep_team_coaches rc
      WHERE rc.team_id = org_payees.team_id
        AND rc.user_id = auth.uid()
    )
  );

-- Org admins can update org-wide payees; coaches can update their team payees
CREATE POLICY "org admins update org-wide payees"
  ON org_payees FOR UPDATE
  USING (
    team_id IS NULL AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_payees.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'treasurer', 'admin')
        AND om.accepted_at IS NOT NULL
    )
  );

CREATE POLICY "team coaches update team payees"
  ON org_payees FOR UPDATE
  USING (
    team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM rep_team_coaches rc
      WHERE rc.team_id = org_payees.team_id
        AND rc.user_id = auth.uid()
    )
  );

-- ── accounting_entries detail columns ────────────────────────────────────────
ALTER TABLE accounting_entries
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payee_id       uuid REFERENCES org_payees(id),
  ADD COLUMN IF NOT EXISTS payee_payer    text,
  ADD COLUMN IF NOT EXISTS notes          text;

-- ── rep_team_expenses detail columns ────────────────────────────────────────
ALTER TABLE rep_team_expenses
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payee_id       uuid REFERENCES org_payees(id),
  ADD COLUMN IF NOT EXISTS payee_payer    text;
