-- ---------------------------------------------------------------
-- Migration 027 — budget_categories + budget_items
-- Shared two-level category hierarchy used by both org budget planner
-- and rep team budget planner. Platform defaults (org_id IS NULL)
-- are read-only; orgs extend with their own custom categories/items.
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS budget_categories (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        REFERENCES organizations(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  scope      text        NOT NULL DEFAULT 'both'
                         CHECK (scope IN ('org', 'team', 'both')),
  sort_order int         NOT NULL DEFAULT 0,
  is_default boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- budget_items: line items within a category.
-- is_misc = true  → the Misc catch-all for its category (always rendered last).
-- suggested_amount → optional hint shown in the budget planner UI.
-- org_id NULL      → platform default (read-only).
-- org_id set       → custom item created by that org (owner/treasurer/coach).
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget_items (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      uuid          NOT NULL REFERENCES budget_categories(id) ON DELETE CASCADE,
  org_id           uuid          REFERENCES organizations(id) ON DELETE CASCADE,
  name             text          NOT NULL,
  suggested_amount numeric(10,2),
  sort_order       int           NOT NULL DEFAULT 0,
  is_default       boolean       NOT NULL DEFAULT false,
  is_misc          boolean       NOT NULL DEFAULT false,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

-- Prevent duplicate item names within the same category per org
CREATE UNIQUE INDEX IF NOT EXISTS budget_items_unique_org_name
  ON budget_items (category_id, org_id, lower(name))
  WHERE org_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS budget_items_unique_default_name
  ON budget_items (category_id, lower(name))
  WHERE org_id IS NULL;

CREATE INDEX IF NOT EXISTS budget_categories_org_idx ON budget_categories(org_id);
CREATE INDEX IF NOT EXISTS budget_items_category_idx ON budget_items(category_id);
CREATE INDEX IF NOT EXISTS budget_items_org_idx      ON budget_items(org_id);

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items      ENABLE ROW LEVEL SECURITY;

-- All org members can read platform defaults and their own org's categories
CREATE POLICY "read budget_categories"
  ON budget_categories FOR SELECT
  USING (
    org_id IS NULL
    OR org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Owners and treasurers can manage their org's custom categories
CREATE POLICY "write budget_categories"
  ON budget_categories FOR ALL
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'treasurer')
    )
  );

-- All org members can read platform defaults and their org's items
CREATE POLICY "read budget_items"
  ON budget_items FOR SELECT
  USING (
    org_id IS NULL
    OR org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Owners, treasurers, and coaches can create/update custom items
CREATE POLICY "write budget_items"
  ON budget_items FOR ALL
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'treasurer', 'coach')
    )
  );

-- ---------------------------------------------------------------
-- Seed platform-default categories and items.
-- All rows have org_id = NULL and is_default = true.
-- Misc items have is_misc = true and sort_order = 99.
-- ---------------------------------------------------------------
DO $$
DECLARE
  v_cat uuid;
BEGIN

  -- Tournaments (scope: both)
  INSERT INTO budget_categories (name, scope, sort_order, is_default)
    VALUES ('Tournaments', 'both', 1, true)
    RETURNING id INTO v_cat;
  INSERT INTO budget_items (category_id, name, sort_order, is_default, is_misc) VALUES
    (v_cat, 'Entry Fees',  1,  true, false),
    (v_cat, 'Uniforms',    2,  true, false),
    (v_cat, 'Travel',      3,  true, false),
    (v_cat, 'Misc',        99, true, true);

  -- Facilities (scope: both)
  INSERT INTO budget_categories (name, scope, sort_order, is_default)
    VALUES ('Facilities', 'both', 2, true)
    RETURNING id INTO v_cat;
  INSERT INTO budget_items (category_id, name, sort_order, is_default, is_misc) VALUES
    (v_cat, 'Diamond Permits',  1,  true, false),
    (v_cat, 'Dome Time',        2,  true, false),
    (v_cat, 'Field Equipment',  3,  true, false),
    (v_cat, 'Lighting Fees',    4,  true, false),
    (v_cat, 'Misc',             99, true, true);

  -- Officials (scope: both)
  INSERT INTO budget_categories (name, scope, sort_order, is_default)
    VALUES ('Officials', 'both', 3, true)
    RETURNING id INTO v_cat;
  INSERT INTO budget_items (category_id, name, sort_order, is_default, is_misc) VALUES
    (v_cat, 'Umpire Fees',   1,  true, false),
    (v_cat, 'Plate Fees',    2,  true, false),
    (v_cat, 'Certification', 3,  true, false),
    (v_cat, 'Misc',          99, true, true);

  -- Team Gear (scope: team)
  INSERT INTO budget_categories (name, scope, sort_order, is_default)
    VALUES ('Team Gear', 'team', 4, true)
    RETURNING id INTO v_cat;
  INSERT INTO budget_items (category_id, name, sort_order, is_default, is_misc) VALUES
    (v_cat, 'Jerseys', 1,  true, false),
    (v_cat, 'Hats',    2,  true, false),
    (v_cat, 'Balls',   3,  true, false),
    (v_cat, 'Bats',    4,  true, false),
    (v_cat, 'Bags',    5,  true, false),
    (v_cat, 'Misc',    99, true, true);

  -- Training (scope: both)
  INSERT INTO budget_categories (name, scope, sort_order, is_default)
    VALUES ('Training', 'both', 5, true)
    RETURNING id INTO v_cat;
  INSERT INTO budget_items (category_id, name, sort_order, is_default, is_misc) VALUES
    (v_cat, 'Coaching Clinics',    1,  true, false),
    (v_cat, 'Off-Season Training', 2,  true, false),
    (v_cat, 'Batting Cages',       3,  true, false),
    (v_cat, 'Misc',                99, true, true);

  -- Events (scope: both)
  INSERT INTO budget_categories (name, scope, sort_order, is_default)
    VALUES ('Events', 'both', 6, true)
    RETURNING id INTO v_cat;
  INSERT INTO budget_items (category_id, name, sort_order, is_default, is_misc) VALUES
    (v_cat, 'Year-End Party', 1,  true, false),
    (v_cat, 'Photo Day',      2,  true, false),
    (v_cat, 'Awards Night',   3,  true, false),
    (v_cat, 'Banquet',        4,  true, false),
    (v_cat, 'Misc',           99, true, true);

  -- Admin (scope: org)
  INSERT INTO budget_categories (name, scope, sort_order, is_default)
    VALUES ('Admin', 'org', 7, true)
    RETURNING id INTO v_cat;
  INSERT INTO budget_items (category_id, name, sort_order, is_default, is_misc) VALUES
    (v_cat, 'Registration Fees', 1,  true, false),
    (v_cat, 'Insurance',         2,  true, false),
    (v_cat, 'Association Dues',  3,  true, false),
    (v_cat, 'Software',          4,  true, false),
    (v_cat, 'Misc',              99, true, true);

  -- Coaching (scope: org)
  INSERT INTO budget_categories (name, scope, sort_order, is_default)
    VALUES ('Coaching', 'org', 8, true)
    RETURNING id INTO v_cat;
  INSERT INTO budget_items (category_id, name, sort_order, is_default, is_misc) VALUES
    (v_cat, 'Clinics',          1,  true, false),
    (v_cat, 'Certifications',   2,  true, false),
    (v_cat, 'Honorariums',      3,  true, false),
    (v_cat, 'Travel',           4,  true, false),
    (v_cat, 'Misc',             99, true, true);

  -- Fundraising Costs (scope: team)
  INSERT INTO budget_categories (name, scope, sort_order, is_default)
    VALUES ('Fundraising Costs', 'team', 9, true)
    RETURNING id INTO v_cat;
  INSERT INTO budget_items (category_id, name, sort_order, is_default, is_misc) VALUES
    (v_cat, 'Supplies', 1,  true, false),
    (v_cat, 'Venue',    2,  true, false),
    (v_cat, 'Printing', 3,  true, false),
    (v_cat, 'Misc',     99, true, true);

END $$;
