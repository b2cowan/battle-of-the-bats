-- Club Tier Stage 12d-1, owner ruling 7 (2026-10-27): a returned answering fee goes back against the invoice that
-- carried the answering fee. When that invoice is finished it is a Stripe credit note on it (lowering what is owed while
-- it is open; refunded to the card once paid), so the credit has no invoice line of its own: it is billed 'credit_note',
-- and the credit note's id is stored on the credit's row, once only (unique). When both fall on one invoice they still
-- net there as two lines, as before ('subscription' / 'own_invoice').
--
-- The billed rule widens with it: a fee is billed exactly when it carries a line OR a credit note; a credit note is only
-- ever a returned answering fee's, and only with 'credit_note'. Additive and re-runnable; no row changes (no credit note
-- has been issued before this migration).

ALTER TABLE public.platform_stripe_fees ADD COLUMN IF NOT EXISTS stripe_credit_note_id text;

CREATE UNIQUE INDEX IF NOT EXISTS platform_stripe_fees_credit_note_key
  ON public.platform_stripe_fees (stripe_credit_note_id) WHERE stripe_credit_note_id IS NOT NULL;

ALTER TABLE public.platform_stripe_fees DROP CONSTRAINT IF EXISTS platform_stripe_fees_billed_chk;
ALTER TABLE public.platform_stripe_fees ADD CONSTRAINT platform_stripe_fees_billed_chk CHECK (
  (billed_at IS NULL) = (stripe_invoice_item_id IS NULL AND stripe_credit_note_id IS NULL));

-- As mig 390's, plus the third way to be billed (each clause NULL-safe: a CHECK that reads NULL passes).
ALTER TABLE public.platform_stripe_fees DROP CONSTRAINT IF EXISTS platform_stripe_fees_billed_on_chk;
ALTER TABLE public.platform_stripe_fees ADD CONSTRAINT platform_stripe_fees_billed_on_chk CHECK (
  (billed_at IS NULL) = (billed_on IS NULL)
  AND (billed_on IS NULL OR billed_on IN ('subscription', 'own_invoice', 'credit_note'))
  AND (billed_on IS DISTINCT FROM 'subscription' OR fee_invoice_id IS NULL)
  AND (billed_on IS DISTINCT FROM 'own_invoice' OR fee_invoice_id IS NOT NULL)
  AND (billed_on IS DISTINCT FROM 'credit_note'
       OR (stripe_credit_note_id IS NOT NULL AND stripe_invoice_item_id IS NULL AND fee_invoice_id IS NULL))
  AND (stripe_credit_note_id IS NULL OR billed_on = 'credit_note'));

ALTER TABLE public.platform_stripe_fees DROP CONSTRAINT IF EXISTS platform_stripe_fees_credit_note_chk;
ALTER TABLE public.platform_stripe_fees ADD CONSTRAINT platform_stripe_fees_credit_note_chk CHECK (
  stripe_credit_note_id IS NULL OR kind = 'dispute_answer_returned');

COMMENT ON COLUMN public.platform_stripe_fees.stripe_credit_note_id IS 'Club Tier 12d-1 ruling 7 (mig 399): the Stripe credit note that returned this answering fee against the invoice that carried the answering fee (billed_on = credit_note). Once only: unique, and read back from Stripe by its metadata before another is made.';
