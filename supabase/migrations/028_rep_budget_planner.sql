-- ---------------------------------------------------------------
-- Migration 028 — rep team budget planner
-- Adds a structured season budget planning layer for coaches.
-- The budget is an *estimated* layer; actuals live in accounting_entries.
-- Budget lines link to the shared budget_categories/budget_items library
-- created in migration 027.
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- rep_budget_lines: one estimated cost line item per team per season.
-- description overrides item name when set (free-text custom costs).
-- category_id / item_id link to the shared library but are optional
-- so coaches can add free-text items without selecting from the library.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_budget_lines (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id         uuid          NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  program_year_id uuid          NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,
  category_id     uuid          REFERENCES budget_categories(id) ON DELETE SET NULL,
  item_id         uuid          REFERENCES budget_items(id) ON DELETE SET NULL,
  description     text          NOT NULL,
  total_amount    numeric(10,2) NOT NULL CHECK (total_amount > 0),
  notes           text,
  sort_order      int           NOT NULL DEFAULT 0,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- rep_budget_periods: optional period distribution for a budget line.
-- If no period rows exist for a line → treat it as a single lump sum.
-- Periods are ordered by sort_order (or period_date when set).
-- Sum of period amounts should equal the parent line's total_amount
-- (enforced in application logic, not a DB constraint).
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rep_budget_periods (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_line_id uuid          NOT NULL REFERENCES rep_budget_lines(id) ON DELETE CASCADE,
  period_label   text          NOT NULL,
  period_date    date,
  amount         numeric(10,2) NOT NULL CHECK (amount > 0),
  sort_order     int           NOT NULL DEFAULT 0,
  created_at     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rep_budget_lines_team_year_idx
  ON rep_budget_lines(team_id, program_year_id);

CREATE INDEX IF NOT EXISTS rep_budget_periods_line_idx
  ON rep_budget_periods(budget_line_id);

-- ---------------------------------------------------------------
-- Extend rep_player_dues_installments: track whether an installment
-- was manually created or generated from the budget planner.
-- Also add budget_line_id to rep_player_dues_schedules so generated
-- schedules can trace back to their originating budget plan.
-- ---------------------------------------------------------------
ALTER TABLE rep_player_dues_installments
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'budget_generated'));

ALTER TABLE rep_player_dues_schedules
  ADD COLUMN IF NOT EXISTS budget_line_id uuid REFERENCES rep_budget_lines(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
ALTER TABLE rep_budget_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_budget_periods ENABLE ROW LEVEL SECURITY;

-- Org members can read all budget lines for their org
CREATE POLICY "read rep_budget_lines"
  ON rep_budget_lines FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Coaches can write lines for their assigned teams; admin/owner/treasurer can write any
CREATE POLICY "write rep_budget_lines"
  ON rep_budget_lines FOR ALL
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'treasurer')
    )
    OR team_id IN (
      SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
    )
  );

-- Budget periods inherit access via their parent line
CREATE POLICY "read rep_budget_periods"
  ON rep_budget_periods FOR SELECT
  USING (budget_line_id IN (
    SELECT id FROM rep_budget_lines
    WHERE org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "write rep_budget_periods"
  ON rep_budget_periods FOR ALL
  USING (budget_line_id IN (
    SELECT id FROM rep_budget_lines
    WHERE
      org_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
          AND role IN ('owner', 'admin', 'treasurer')
      )
      OR team_id IN (
        SELECT team_id FROM rep_team_coaches WHERE user_id = auth.uid()
      )
  ));
