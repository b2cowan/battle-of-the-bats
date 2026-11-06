-- 446_a_refund_carries_its_credit_note.sql
--
-- GST/HST Stage 2 Part 6b, Part 1 (docs/projects/active/GST_HST_STAGE2_PART6B_BUILD_PROMPT.md; owner R1–R3 2026-11-05).
-- A platform-admin refund of a charge that paid an invoice now goes through a Stripe CREDIT NOTE (the Excise Tax Act s.232
-- document that shows the GST/HST reversed; accounting review item 6c). The console's refund record learns two things:
--
--   stripe_invoice_id      the invoice the charge paid, learned BEFORE Stripe is asked and written at the start with the rest of
--                          the request (frozen after it, like the amount). NULL = the charge paid no invoice (R3: a bare refund,
--                          as before this migration), and every row written before it.
--   stripe_credit_note_id  the credit note Stripe made. Written once, with Stripe's answer, never changed after.
--   stripe_credit_note_number  its printed number (e.g. MBEEZ5VW-0001-CN-01), written with the id, so the club's Story names the
--                          document without asking Stripe for every row. The PDF link is read from Stripe in the charge window.
--
-- The refund a credit note makes carries none of our metadata (verified 2026-11-05), so recovery finds the NOTE by its metadata
-- and fills both ids. A finished refund of an invoice charge always has its note (the CHECK below), so a refund that skipped the
-- credit note cannot be recorded as done.
--
-- Additive and nullable: existing rows keep both NULL and read as they did. Nothing is dropped or renamed.

BEGIN;

ALTER TABLE public.platform_refunds ADD COLUMN IF NOT EXISTS stripe_invoice_id text;
ALTER TABLE public.platform_refunds ADD COLUMN IF NOT EXISTS stripe_credit_note_id text;
ALTER TABLE public.platform_refunds ADD COLUMN IF NOT EXISTS stripe_credit_note_number text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_refunds_invoice_id_chk') THEN
    ALTER TABLE public.platform_refunds ADD CONSTRAINT platform_refunds_invoice_id_chk
      CHECK (stripe_invoice_id IS NULL OR stripe_invoice_id ~ '^in_[A-Za-z0-9]+$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_refunds_credit_note_id_chk') THEN
    ALTER TABLE public.platform_refunds ADD CONSTRAINT platform_refunds_credit_note_id_chk
      CHECK (stripe_credit_note_id IS NULL OR stripe_credit_note_id ~ '^cn_[A-Za-z0-9]+$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_refunds_credit_note_number_chk') THEN
    ALTER TABLE public.platform_refunds ADD CONSTRAINT platform_refunds_credit_note_number_chk
      CHECK (stripe_credit_note_number IS NULL OR (stripe_credit_note_id IS NOT NULL AND stripe_credit_note_number ~ '^[A-Za-z0-9-]{1,64}$'));
  END IF;
  -- A credit note belongs to an invoice: never a note on a no-invoice (R3) refund.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_refunds_note_needs_invoice_chk') THEN
    ALTER TABLE public.platform_refunds ADD CONSTRAINT platform_refunds_note_needs_invoice_chk
      CHECK (stripe_credit_note_id IS NULL OR stripe_invoice_id IS NOT NULL);
  END IF;
  -- A refund of an invoice charge is done only with its credit note.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_refunds_done_invoice_has_note_chk') THEN
    ALTER TABLE public.platform_refunds ADD CONSTRAINT platform_refunds_done_invoice_has_note_chk
      CHECK (NOT (status = 'done' AND stripe_invoice_id IS NOT NULL AND stripe_credit_note_id IS NULL));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS platform_refunds_credit_note_uniq
  ON public.platform_refunds (stripe_credit_note_id) WHERE stripe_credit_note_id IS NOT NULL;

-- The guard of migration 380, with the two new columns: the invoice is part of the frozen request; the credit note may go from
-- NULL to a value once (Stripe's answer, or recovery), never change after, and is never written at the start.
CREATE OR REPLACE FUNCTION public.platform_refunds_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'started' OR NEW.stripe_refund_id IS NOT NULL OR NEW.stripe_credit_note_id IS NOT NULL
       OR NEW.stripe_credit_note_number IS NOT NULL OR NEW.completed_at IS NOT NULL THEN
      RAISE EXCEPTION 'A refund starts as started; Stripe''s answer records the rest.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.org_id IS DISTINCT FROM OLD.org_id AND NEW.org_id IS NOT NULL THEN
    RAISE EXCEPTION 'A refund''s club never changes.';
  END IF;
  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id OR NEW.stripe_charge_id IS DISTINCT FROM OLD.stripe_charge_id
     OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.remaining_seen_cents IS DISTINCT FROM OLD.remaining_seen_cents OR NEW.stripe_reason IS DISTINCT FROM OLD.stripe_reason
     OR NEW.reason IS DISTINCT FROM OLD.reason OR NEW.actor_email IS DISTINCT FROM OLD.actor_email
     OR NEW.actor_role IS DISTINCT FROM OLD.actor_role OR NEW.livemode IS DISTINCT FROM OLD.livemode
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.stripe_invoice_id IS DISTINCT FROM OLD.stripe_invoice_id
     OR (OLD.stripe_refund_id IS NOT NULL AND NEW.stripe_refund_id IS DISTINCT FROM OLD.stripe_refund_id)
     OR (OLD.stripe_credit_note_id IS NOT NULL AND NEW.stripe_credit_note_id IS DISTINCT FROM OLD.stripe_credit_note_id)
     OR (OLD.stripe_credit_note_number IS NOT NULL AND NEW.stripe_credit_note_number IS DISTINCT FROM OLD.stripe_credit_note_number) THEN
    RAISE EXCEPTION 'A refund''s request never changes after it starts.';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'started' AND NEW.status IN ('done', 'refused', 'unknown', 'not_made'))
    OR (OLD.status = 'unknown' AND NEW.status IN ('done', 'not_made'))
  ) THEN
    RAISE EXCEPTION 'A refund moves forward only: started, then done, refused, unknown or not made.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.platform_refunds_guard() FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.platform_refunds.stripe_invoice_id IS
  'The invoice the charge paid, learned before Stripe is asked and frozen with the request (GST/HST Part 6b, mig 446). Set = the refund goes through a credit note; NULL = the charge paid no invoice (a bare refund, R3) or the row predates mig 446.';
COMMENT ON COLUMN public.platform_refunds.stripe_credit_note_id IS
  'The Stripe credit note that made this refund (mig 446). Written once with Stripe''s answer or by recovery (found by the note''s metadata.platform_refund_id), never changed. Required when status = done and stripe_invoice_id is set.';
COMMENT ON COLUMN public.platform_refunds.stripe_credit_note_number IS
  'The credit note''s printed number, written with stripe_credit_note_id (mig 446), never changed: the club''s Story names it without a Stripe read.';
COMMENT ON COLUMN public.platform_refunds.status IS
  'started = written, Stripe not yet answered; done = Stripe made the refund (stripe_refund_id set; with stripe_credit_note_id too when the charge paid an invoice); refused = Stripe''s definite no (4xx; stripe_error_code + stripe_request_id kept); unknown = timeout or Stripe fault, until recovery lists the invoice''s credit notes or the charge''s refunds; not_made = recovery found neither with this id (releases the charge). Forward-only (platform_refunds_guard).';

COMMIT;
