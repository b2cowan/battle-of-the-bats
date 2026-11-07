-- GST/HST Stage 4a: which tax each expense paid, the supplier's number and CRA registration, and the kind of purchase.
-- Historical revisions keep NULL in every new column; the app maps them (DATA_DICTIONARY, Accounting domain).
-- The credit is computed on read from these facts and the registration date. It is never stored.
ALTER TABLE bookkeeping.expense_revisions ADD COLUMN IF NOT EXISTS tax_answer text;
ALTER TABLE bookkeeping.expense_revisions ADD COLUMN IF NOT EXISTS supplier_tax_number text;
ALTER TABLE bookkeeping.expense_revisions ADD COLUMN IF NOT EXISTS supplier_registration text;
ALTER TABLE bookkeeping.expense_revisions ADD COLUMN IF NOT EXISTS purchase_kind text;
ALTER TABLE bookkeeping.expense_revisions ADD COLUMN IF NOT EXISTS number_unobtainable boolean;
-- One row per tax on a receipt, written with its revision. The app refuses lines that do not sum to tax_cad_cents.
CREATE TABLE IF NOT EXISTS bookkeeping.expense_tax_lines (
  expense_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  line_no smallint NOT NULL CHECK (line_no BETWEEN 1 AND 10),
  tax_type text NOT NULL CHECK (tax_type IN ('gst5', 'hst13', 'hst14', 'hst15', 'pst', 'qst', 'other', 'unset')),
  cents bigint NOT NULL CHECK (cents > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expense_id, revision, line_no)
);
REVOKE ALL ON bookkeeping.expense_tax_lines FROM PUBLIC;
GRANT SELECT, INSERT ON bookkeeping.expense_tax_lines TO bookkeeping_app;
-- The GST/HST registration effective date, as a setting with its history. The highest revision is current.
CREATE TABLE IF NOT EXISTS bookkeeping.gst_registration_revisions (
  revision integer NOT NULL CHECK (revision > 0),
  effective_date date NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  PRIMARY KEY (revision)
);
REVOKE ALL ON bookkeeping.gst_registration_revisions FROM PUBLIC;
GRANT SELECT, INSERT ON bookkeeping.gst_registration_revisions TO bookkeeping_app;
-- Seed: the owner's registration date, 2026-09-26 (given 2026-11-06). The nil uuid marks a row written by this migration, not a person.
INSERT INTO bookkeeping.gst_registration_revisions (revision, effective_date, reason, created_by)
  SELECT 1, DATE '2026-09-26', 'First entry', '00000000-0000-0000-0000-000000000000'::uuid
  WHERE NOT EXISTS (SELECT 1 FROM bookkeeping.gst_registration_revisions);
