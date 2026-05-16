-- ---------------------------------------------------------------
-- Migration 031 — Org Budget Planner
-- Adds org-level season budget tables. The budget is an *estimated*
-- planning layer; actuals live in accounting_entries (unchanged).
-- Budget lines can be directly allocated to teams via the existing
-- rep_cost_allocations system (source_budget_line_id links back).
-- ---------------------------------------------------------------

-- ---------------------------------------------------------------
-- org_budget_lines: one estimated cost line item per org per season year.
-- season_year is a plain int (e.g. 2026) not a FK — the budget planner
-- is year-keyed, not program-year-keyed (org spans multiple teams/years).
-- category_id / item_id are optional; description is always required.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_budget_lines (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  season_year  int           NOT NULL,
  category_id  uuid          REFERENCES budget_categories(id) ON DELETE SET NULL,
  item_id      uuid          REFERENCES budget_items(id) ON DELETE SET NULL,
  description  text          NOT NULL,
  total_amount numeric(10,2) NOT NULL CHECK (total_amount > 0),
  notes        text,
  sort_order   int           NOT NULL DEFAULT 0,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- org_budget_periods: optional monthly/period breakdown for a line.
-- If no period rows exist → treat line as a single lump sum.
-- Sum of period amounts should equal parent line total_amount
-- (enforced in application logic, not a DB constraint).
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_budget_periods (
  id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_line_id uuid          NOT NULL REFERENCES org_budget_lines(id) ON DELETE CASCADE,
  period_label   text          NOT NULL,
  period_date    date,
  amount         numeric(10,2) NOT NULL CHECK (amount > 0),
  sort_order     int           NOT NULL DEFAULT 0,
  created_at     timestamptz   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- Link existing rep_cost_allocations back to the org budget line
-- that triggered the allocation (nullable — standalone allocations
-- created without a budget line leave this null).
-- ---------------------------------------------------------------
ALTER TABLE rep_cost_allocations
  ADD COLUMN IF NOT EXISTS source_budget_line_id uuid
    REFERENCES org_budget_lines(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS org_budget_lines_org_year_idx
  ON org_budget_lines(org_id, season_year);

CREATE INDEX IF NOT EXISTS org_budget_periods_line_idx
  ON org_budget_periods(budget_line_id);

CREATE INDEX IF NOT EXISTS rep_cost_allocations_budget_line_idx
  ON rep_cost_allocations(source_budget_line_id)
  WHERE source_budget_line_id IS NOT NULL;

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
ALTER TABLE org_budget_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_budget_periods ENABLE ROW LEVEL SECURITY;

-- All org members can read the org budget
CREATE POLICY "read org_budget_lines"
  ON org_budget_lines FOR SELECT
  USING (org_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Only owner/treasurer can write budget lines
CREATE POLICY "write org_budget_lines"
  ON org_budget_lines FOR ALL
  USING (org_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'treasurer')
  ));

-- Budget periods inherit read access via their parent line
CREATE POLICY "read org_budget_periods"
  ON org_budget_periods FOR SELECT
  USING (budget_line_id IN (
    SELECT id FROM org_budget_lines
    WHERE org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  ));

-- Budget periods inherit write access via their parent line
CREATE POLICY "write org_budget_periods"
  ON org_budget_periods FOR ALL
  USING (budget_line_id IN (
    SELECT id FROM org_budget_lines
    WHERE org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'treasurer')
    )
  ));
