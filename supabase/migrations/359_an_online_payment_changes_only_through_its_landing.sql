-- ---------------------------------------------------------------
-- Migration 359 — Club Tier Stage 12a, review fix M4 (2026-10-25): an online payment's money and state change only
-- through its landing and refund functions (mig 358), exactly as a team's online payment row already does.
--
-- WHY: the whole-build /review found that nothing in the database stopped a direct write to `online_payments` or
-- `online_payment_refunds` — the app holds the service role, which may UPDATE either — so a stray route could mark a
-- payment paid, change what was charged, or call a refund succeeded without the team's record or the book following. The
-- unit guard (`online-payments-guard.test.ts`) reads the source; this is the backstop that reads the write.
--
-- WHAT CHANGES:
--   1. A trigger on online_payments: without the write flag (set only inside the mig 358 functions), an insert is an OPEN
--      payment with nothing paid, and an update may only close an open one (expired), set what the page and the emails
--      keep (receipt_emailed_at, land_error), or let a team or tournament go (their FKs set NULL). Money, Stripe's ids,
--      the receipt number and the paid / refunded states are the landing's alone.
--   2. A trigger on online_payment_refunds: a refund's amount never changes, and only the refund landing calls it
--      succeeded. Stripe's id may be recorded, and a pending refund may fail.
--   3. online_payment_land_failed now opens the flag too (it marks a payment paid that couldn't land).
-- Both triggers are BEFORE INSERT OR UPDATE, never DELETE (organizations cascade into both tables).
-- ---------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.online_payments_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'open' OR NEW.paid_at IS NOT NULL OR NEW.landed_at IS NOT NULL OR NEW.receipt_no IS NOT NULL
       OR NEW.stripe_payment_intent_id IS NOT NULL OR NEW.processing_cost_entry_id IS NOT NULL THEN
      RAISE EXCEPTION 'An online payment starts open; Stripe''s answer records the rest.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.base_amount IS DISTINCT FROM OLD.base_amount OR NEW.fee_amount IS DISTINCT FROM OLD.fee_amount
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount OR NEW.fee_payer IS DISTINCT FROM OLD.fee_payer
     OR NEW.fee_pct IS DISTINCT FROM OLD.fee_pct OR NEW.fee_flat IS DISTINCT FROM OLD.fee_flat
     OR NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.flow IS DISTINCT FROM OLD.flow OR NEW.scope IS DISTINCT FROM OLD.scope OR NEW.livemode IS DISTINCT FROM OLD.livemode
     OR NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id
     OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
     OR NEW.stripe_charge_id IS DISTINCT FROM OLD.stripe_charge_id OR NEW.receipt_no IS DISTINCT FROM OLD.receipt_no
     OR NEW.landed_at IS DISTINCT FROM OLD.landed_at OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.paid_on IS DISTINCT FROM OLD.paid_on OR NEW.processing_cost_entry_id IS DISTINCT FROM OLD.processing_cost_entry_id
     OR (NEW.team_id IS DISTINCT FROM OLD.team_id AND NEW.team_id IS NOT NULL)
     OR (NEW.tournament_id IS DISTINCT FROM OLD.tournament_id AND NEW.tournament_id IS NOT NULL)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'open' AND NEW.status = 'expired')) THEN
    RAISE EXCEPTION 'An online payment changes only through its landing or its refund.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.online_payments_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS online_payments_guard ON public.online_payments;
CREATE TRIGGER online_payments_guard BEFORE INSERT OR UPDATE ON public.online_payments
  FOR EACH ROW EXECUTE FUNCTION public.online_payments_guard();

CREATE OR REPLACE FUNCTION public.online_payment_refunds_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' OR NEW.succeeded_at IS NOT NULL OR NEW.refund_entry_id IS NOT NULL OR NEW.processing_cost_entry_id IS NOT NULL THEN
      RAISE EXCEPTION 'A refund starts pending; Stripe''s answer records the rest.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.fee_refunded IS DISTINCT FROM OLD.fee_refunded
     OR NEW.online_payment_id IS DISTINCT FROM OLD.online_payment_id OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.refund_entry_id IS DISTINCT FROM OLD.refund_entry_id OR NEW.processing_cost_entry_id IS DISTINCT FROM OLD.processing_cost_entry_id
     OR NEW.succeeded_at IS DISTINCT FROM OLD.succeeded_at
     OR (NEW.stripe_refund_id IS DISTINCT FROM OLD.stripe_refund_id AND OLD.stripe_refund_id IS NOT NULL)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'pending' AND NEW.status IN ('failed', 'canceled'))) THEN
    RAISE EXCEPTION 'A refund changes only through its landing.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_refunds_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS online_payment_refunds_guard ON public.online_payment_refunds;
CREATE TRIGGER online_payment_refunds_guard BEFORE INSERT OR UPDATE ON public.online_payment_refunds
  FOR EACH ROW EXECUTE FUNCTION public.online_payment_refunds_guard();

-- A payment that couldn't land is still PAID (Stripe has the money): this function marks it so, under the flag.
CREATE OR REPLACE FUNCTION public.online_payment_land_failed(
  p_online_payment uuid, p_paid_at timestamptz, p_payment_intent text, p_charge text, p_brand text, p_last4 text, p_error text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_receipt bigint;
BEGIN
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE online_payments SET status = CASE WHEN status = 'refunded' THEN status ELSE 'paid' END,
    paid_at = coalesce(paid_at, p_paid_at), paid_on = coalesce(paid_on, (p_paid_at AT TIME ZONE 'America/Toronto')::date),
    stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
    stripe_charge_id = coalesce(p_charge, stripe_charge_id), card_brand = coalesce(p_brand, card_brand),
    card_last4 = coalesce(p_last4, card_last4), receipt_no = coalesce(receipt_no, nextval('online_payment_receipt_seq')),
    land_error = left(coalesce(p_error, 'Not recorded'), 500), updated_at = now()
  WHERE id = p_online_payment AND landed_at IS NULL
  RETURNING receipt_no INTO v_receipt;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN v_receipt;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_land_failed(uuid, timestamptz, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_land_failed(uuid, timestamptz, text, text, text, text, text) TO service_role;

COMMIT;
