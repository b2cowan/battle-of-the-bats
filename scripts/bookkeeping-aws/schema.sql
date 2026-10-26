-- Applied separately to the development and production Aurora DSQL clusters.
-- App role has SELECT and INSERT only; old revisions cannot be edited by the app.
CREATE SCHEMA bookkeeping;
REVOKE ALL ON SCHEMA bookkeeping FROM PUBLIC;

CREATE TABLE bookkeeping.expense_revisions (
  expense_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  expense_date date NOT NULL,
  -- Historical revisions may have only the ambiguous expense_date. New revisions set both dates.
  incurred_date date,
  paid_date date,
  supplier text NOT NULL CHECK (length(btrim(supplier)) BETWEEN 1 AND 160),
  category text NOT NULL CHECK (length(btrim(category)) BETWEEN 1 AND 80),
  business_purpose text NOT NULL CHECK (length(btrim(business_purpose)) BETWEEN 1 AND 500),
  original_currency text NOT NULL CHECK (original_currency IN ('CAD', 'USD')),
  original_cents bigint NOT NULL CHECK (original_cents > 0),
  cad_cents bigint NOT NULL CHECK (cad_cents > 0),
  tax_cad_cents bigint NOT NULL CHECK (tax_cad_cents >= 0 AND tax_cad_cents <= cad_cents),
  -- NULL is only for historical revisions predating the explicit unknown/confirmed-zero choice.
  tax_amount_known boolean,
  tax_status text NOT NULL CHECK (tax_status IN ('pending', 'none', 'reviewed')),
  business_use_percent smallint NOT NULL CHECK (business_use_percent BETWEEN 1 AND 100),
  payment_source text NOT NULL CHECK (payment_source IN ('business_bank', 'business_card', 'personal', 'other')),
  conversion_note text CHECK (conversion_note IS NULL OR length(conversion_note) <= 500),
  notes text CHECK (notes IS NULL OR length(notes) <= 2000),
  change_reason text CHECK (change_reason IS NULL OR length(btrim(change_reason)) BETWEEN 1 AND 500),
  receipt_path text,
  receipt_name text,
  void_reason text CHECK (void_reason IS NULL OR length(btrim(void_reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  PRIMARY KEY (expense_id, revision),
  CHECK ((receipt_path IS NULL) = (receipt_name IS NULL)),
  CHECK (revision = 1 OR change_reason IS NOT NULL),
  CHECK (original_currency = 'CAD' OR conversion_note IS NOT NULL)
);
REVOKE ALL ON bookkeeping.expense_revisions FROM PUBLIC;
CREATE ROLE bookkeeping_app WITH LOGIN;
GRANT USAGE ON SCHEMA bookkeeping TO bookkeeping_app;
GRANT SELECT, INSERT ON bookkeeping.expense_revisions TO bookkeeping_app;

-- Owner transfers are cash facts. They are never posted as a second expense or as income.
CREATE TABLE bookkeeping.owner_movement_revisions (
  movement_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  movement_date date NOT NULL,
  movement_kind text NOT NULL CHECK (movement_kind IN ('owner_contribution', 'owner_draw', 'expense_reimbursement')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  linked_expense_id uuid,
  source_reference text CHECK (source_reference IS NULL OR length(source_reference) <= 160),
  note text CHECK (note IS NULL OR length(note) <= 1000),
  change_reason text CHECK (change_reason IS NULL OR length(btrim(change_reason)) BETWEEN 1 AND 500),
  void_reason text CHECK (void_reason IS NULL OR length(btrim(void_reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  PRIMARY KEY (movement_id, revision),
  CHECK ((movement_kind = 'expense_reimbursement') = (linked_expense_id IS NOT NULL)),
  CHECK (revision = 1 OR change_reason IS NOT NULL)
);
REVOKE ALL ON bookkeeping.owner_movement_revisions FROM PUBLIC;
GRANT SELECT, INSERT ON bookkeeping.owner_movement_revisions TO bookkeeping_app;
