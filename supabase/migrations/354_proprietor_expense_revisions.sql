-- Private sole-proprietor expense capture. No org_id: club data must never join this table.
-- Every edit is a new immutable revision. The service-role API is the only reader/writer.
BEGIN;

CREATE TABLE IF NOT EXISTS public.proprietor_expense_revisions (
  expense_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  expense_date date NOT NULL,
  supplier text NOT NULL CHECK (length(btrim(supplier)) BETWEEN 1 AND 160),
  category text NOT NULL CHECK (length(btrim(category)) BETWEEN 1 AND 80),
  business_purpose text NOT NULL CHECK (length(btrim(business_purpose)) BETWEEN 1 AND 500),
  original_currency text NOT NULL CHECK (original_currency IN ('CAD', 'USD')),
  original_cents bigint NOT NULL CHECK (original_cents > 0),
  cad_cents bigint NOT NULL CHECK (cad_cents > 0),
  tax_cad_cents bigint NOT NULL CHECK (tax_cad_cents >= 0 AND tax_cad_cents <= cad_cents),
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
  created_by uuid NOT NULL REFERENCES auth.users(id),
  PRIMARY KEY (expense_id, revision),
  CHECK ((receipt_path IS NULL) = (receipt_name IS NULL)),
  CHECK (revision = 1 OR change_reason IS NOT NULL),
  CHECK (original_currency = 'CAD' OR conversion_note IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS proprietor_expense_revisions_date_idx
  ON public.proprietor_expense_revisions (expense_date DESC, expense_id);
ALTER TABLE public.proprietor_expense_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proprietor_expense_revisions FROM anon, authenticated;
GRANT SELECT, INSERT ON public.proprietor_expense_revisions TO service_role;

CREATE OR REPLACE FUNCTION public.proprietor_expense_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Expense revisions are immutable; add a new revision';
END;
$$;
REVOKE ALL ON FUNCTION public.proprietor_expense_immutable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.proprietor_expense_immutable() TO service_role;
DROP TRIGGER IF EXISTS proprietor_expense_immutable ON public.proprietor_expense_revisions;
CREATE TRIGGER proprietor_expense_immutable
  BEFORE UPDATE OR DELETE ON public.proprietor_expense_revisions
  FOR EACH ROW EXECUTE FUNCTION public.proprietor_expense_immutable();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('proprietor-receipts', 'proprietor-receipts', false, 10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
-- No storage.objects policy: all file operations pass through the owner-gated server route.
COMMIT;
