-- Stage 3 draft: immutable owner cash-movement facts, separate from expenses and Stripe income.
CREATE TABLE IF NOT EXISTS bookkeeping.owner_movement_revisions (
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
