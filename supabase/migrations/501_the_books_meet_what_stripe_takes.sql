-- ---------------------------------------------------------------
-- Migration 501 — Stripe-owned pricing, Stage 3: the club's books match what Stripe really takes (plan
-- docs/projects/active/STRIPE_OWNED_PRICING_PLAN.md Stage 3; owner rulings 2026-11-18 (a)–(f); probe .probe/s3/).
--
-- WHY: on a Stripe-owned account (org_payment_accounts.fees_collector = 'stripe') Stripe takes its own fee from the club's
-- balance. The landing's one "Payment processing" cost (the whole fee, club-pays mode) is already exact for a domestic card
-- or bank debit: Stripe's fee matched our standard cost to the cent in every probe. What was off, and is fixed here:
--   - Stripe's extra on a payment (a foreign card +0.8%, a conversion +2%) was never booked, in either payer mode;
--   - a dispute's fee ($15 card / $5 debit, attached to the dispute's withdrawal) was stored, never booked;
--   - Stripe's stand-alone fees billed later with no source (a debit that fails before clearing: $5 "Payment Failure"; an
--     answered card dispute: $15 "Dispute Countered Fee") were never booked (ruling (d): matched to their payment daily);
--   - ruling (f): when the FAMILY paid the fee and the payment is reversed (a lost card dispute, or a bank debit returned
--     after it cleared), Stripe pulls back everything the family paid, fee included, and keeps both parts; the books
--     posted only the base.
-- Every new line is only for a payment taken on a Stripe-owned account. Old 'application' accounts (dev only) read exactly
-- as before: the platform paid Stripe there, so a Stripe fee booked on them would be wrong.
--
-- WHAT CHANGES
--   online_payments.stripe_fee_amount        NEW numeric(12,2) >= 0: Stripe's own processing fee on this payment, the
--       `stripe_fee` fee detail on its charge's balance transaction (NEVER the transaction's `fee`, which adds ours). NULL =
--       not read yet (it appears about a second after the payment succeeds; the landing or the daily job catches it up),
--       or a payment on an old account (never read).
--   online_payments.stripe_extra_entry_id    NEW uuid FK: the "Stripe's extra · …" cost (Stripe's fee less its standard
--       cost, fee_amount − application_fee_amount, when above zero).
--   online_payments.dispute_fee_entry_id     NEW uuid FK: the cost of the fee attached to a dispute: "Dispute fee ·
--       receipt N" on a card, "Returned debit fee · receipt N" on a bank debit taken back after it cleared (/marketing
--       2026-11-18: everywhere else that debit reads "Returned by the bank", never a dispute).
--   online_payments.reversal_fee_entry_id    NEW uuid FK: ruling (f)'s "Payment processing · …" cost at a reversal.
--   online_payments_guard()                  ▶ 501: the four new columns start NULL and are frozen outside the writers.
--   online_payment_stripe_fee_lines (NEW)    one row per stand-alone Stripe fee line on a club's balance, matched or not.
--   online_payment_cost_out(...)             NEW internal: a "Payment processing" money-out line on the payment's own
--       book (tournament or house-league season).
--   online_payment_stripe_owned(text)        NEW: whether a Stripe account is the org's current Stripe-owned account.
--   online_payment_stripe_fee_set(...)       NEW: stores Stripe's fee once and books the extra.
--   online_payment_dispute_fee_book(...)     NEW: books a dispute's attached fee once.
--   online_payment_stripe_fee_line_take(...) NEW: records a stand-alone fee line once and books it on its one match.
--   online_payment_reverse(...)              ▶ 501: mig 391's, plus ruling (f).
--
-- NOT HERE: a countered fee RETURNED on a won dispute is not matched (Stripe's line for it was not seen in the probe): a
-- credit line stays unmatched and the bank check names it. GST/HST Stage 5. No backfill: dev's payments on Stripe-owned
-- accounts are probe-era and are caught up by the daily job only within its window.
-- ---------------------------------------------------------------
BEGIN;

-- 1. The columns.
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS stripe_fee_amount numeric(12,2);
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS stripe_extra_entry_id uuid;
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS dispute_fee_entry_id uuid;
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS reversal_fee_entry_id uuid;
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_stripe_fee_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_stripe_fee_chk CHECK (stripe_fee_amount >= 0);
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_extra_entry_fk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_extra_entry_fk
  FOREIGN KEY (stripe_extra_entry_id) REFERENCES public.accounting_entries(id);
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_dispute_fee_entry_fk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_dispute_fee_entry_fk
  FOREIGN KEY (dispute_fee_entry_id) REFERENCES public.accounting_entries(id);
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_reversal_fee_entry_fk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_reversal_fee_entry_fk
  FOREIGN KEY (reversal_fee_entry_id) REFERENCES public.accounting_entries(id);
CREATE INDEX IF NOT EXISTS online_payments_extra_entry_idx ON public.online_payments(stripe_extra_entry_id)
  WHERE stripe_extra_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS online_payments_dispute_fee_entry_idx ON public.online_payments(dispute_fee_entry_id)
  WHERE dispute_fee_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS online_payments_reversal_fee_entry_idx ON public.online_payments(reversal_fee_entry_id)
  WHERE reversal_fee_entry_id IS NOT NULL;
COMMENT ON COLUMN public.online_payments.stripe_fee_amount IS
  'Stripe''s own processing fee on this payment: the stripe_fee fee detail on its charge''s balance transaction, never the transaction''s fee (which adds ours). NULL = not read yet, or a payment on an old application account (never read). Stripe-owned pricing Stage 3, mig 501.';
COMMENT ON COLUMN public.online_payments.stripe_extra_entry_id IS
  'The "Stripe''s extra" cost line: stripe_fee_amount less Stripe''s standard cost (fee_amount - application_fee_amount), when above zero (a foreign card, a conversion). Mig 501.';
COMMENT ON COLUMN public.online_payments.dispute_fee_entry_id IS
  'The cost line for the fee Stripe attached to this payment''s dispute: "Dispute fee · receipt N" (card, $15) or "Returned debit fee · receipt N" (a bank debit taken back after it cleared, $5). Mig 501.';
COMMENT ON COLUMN public.online_payments.reversal_fee_entry_id IS
  'Family-pays mode: the "Payment processing" cost posted when the payment was reversed (lost dispute, debit returned after clearing), for the fee the family paid that Stripe pulled back from the club. Mig 501.';

-- 2. Stand-alone Stripe fee lines (ruling (d)).
CREATE TABLE IF NOT EXISTS public.online_payment_stripe_fee_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL,
  stripe_txn_id text NOT NULL,
  livemode boolean NOT NULL,
  amount numeric(12,2) NOT NULL,
  description text,
  stripe_created_at timestamptz NOT NULL,
  kind text NOT NULL,
  online_payment_id uuid REFERENCES public.online_payments(id) ON DELETE SET NULL,
  entry_id uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  booked_at timestamptz,
  unmatched_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT online_payment_stripe_fee_lines_txn_key UNIQUE (stripe_txn_id),
  CONSTRAINT online_payment_stripe_fee_lines_kind_chk CHECK (kind IN ('debit_failure', 'dispute_countered', 'other')),
  CONSTRAINT online_payment_stripe_fee_lines_unmatched_chk
    CHECK (unmatched_reason IS NULL OR unmatched_reason IN ('no_payment', 'several_payments', 'not_a_charge', 'unknown_kind', 'refused'))
);
CREATE INDEX IF NOT EXISTS online_payment_stripe_fee_lines_org_idx ON public.online_payment_stripe_fee_lines(org_id, stripe_created_at DESC);
CREATE INDEX IF NOT EXISTS online_payment_stripe_fee_lines_payment_idx ON public.online_payment_stripe_fee_lines(online_payment_id)
  WHERE online_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS online_payment_stripe_fee_lines_entry_idx ON public.online_payment_stripe_fee_lines(entry_id)
  WHERE entry_id IS NOT NULL;
COMMENT ON TABLE public.online_payment_stripe_fee_lines IS
  'Stripe-owned pricing Stage 3 (mig 501): one row per stand-alone stripe_fee balance transaction on a club''s Stripe-owned account (no source: Stripe bills it later, e.g. a failed debit''s $5, an answered dispute''s $15). Amount as Stripe gives it (negative = taken from the club). Matched to one payment and booked once, or left unmatched with the reason; the bank check names an unmatched one. Written only by online_payment_stripe_fee_line_take.';
ALTER TABLE public.online_payment_stripe_fee_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.online_payment_stripe_fee_lines FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_payment_stripe_fee_lines TO service_role;

-- 3. The guard: mig 498's, with the new columns starting NULL and frozen (▶ 501).
CREATE OR REPLACE FUNCTION public.online_payments_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'open' OR NEW.paid_at IS NOT NULL OR NEW.landed_at IS NOT NULL OR NEW.receipt_no IS NOT NULL
       OR NEW.stripe_payment_intent_id IS NOT NULL OR NEW.processing_cost_entry_id IS NOT NULL
       OR NEW.bank_last4 IS NOT NULL OR NEW.clearing_at IS NOT NULL OR NEW.returned_at IS NOT NULL
       OR NEW.return_reason IS NOT NULL OR NEW.return_detail IS NOT NULL OR NEW.reversed_at IS NOT NULL
       OR NEW.stripe_dispute_id IS NOT NULL OR NEW.over_amount IS NOT NULL OR NEW.over_whole IS NOT NULL
       OR NEW.stripe_fee_amount IS NOT NULL OR NEW.stripe_extra_entry_id IS NOT NULL           -- ▶ 501
       OR NEW.dispute_fee_entry_id IS NOT NULL OR NEW.reversal_fee_entry_id IS NOT NULL THEN  -- ▶ 501
      RAISE EXCEPTION 'An online payment starts open; Stripe''s answer records the rest.';
    END IF;
    IF (NEW.flow = 'tournament_team' AND (NEW.team_id IS NULL OR NEW.tournament_id IS NULL))
       OR (NEW.flow = 'league_signup' AND NEW.season_id IS NULL) THEN
      RAISE EXCEPTION 'An online payment opens on what it pays for.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.base_amount IS DISTINCT FROM OLD.base_amount OR NEW.fee_amount IS DISTINCT FROM OLD.fee_amount
     OR NEW.application_fee_amount IS DISTINCT FROM OLD.application_fee_amount -- ▶ 498
     OR NEW.stripe_fee_amount IS DISTINCT FROM OLD.stripe_fee_amount           -- ▶ 501
     OR NEW.stripe_extra_entry_id IS DISTINCT FROM OLD.stripe_extra_entry_id   -- ▶ 501
     OR NEW.dispute_fee_entry_id IS DISTINCT FROM OLD.dispute_fee_entry_id     -- ▶ 501
     OR NEW.reversal_fee_entry_id IS DISTINCT FROM OLD.reversal_fee_entry_id   -- ▶ 501
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount OR NEW.fee_payer IS DISTINCT FROM OLD.fee_payer
     OR NEW.fee_pct IS DISTINCT FROM OLD.fee_pct OR NEW.fee_flat IS DISTINCT FROM OLD.fee_flat
     OR NEW.org_id IS DISTINCT FROM OLD.org_id OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.flow IS DISTINCT FROM OLD.flow OR NEW.scope IS DISTINCT FROM OLD.scope OR NEW.livemode IS DISTINCT FROM OLD.livemode
     OR NEW.rail IS DISTINCT FROM OLD.rail
     OR NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id
     OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
     OR NEW.stripe_charge_id IS DISTINCT FROM OLD.stripe_charge_id OR NEW.receipt_no IS DISTINCT FROM OLD.receipt_no
     OR NEW.landed_at IS DISTINCT FROM OLD.landed_at OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.paid_on IS DISTINCT FROM OLD.paid_on OR NEW.processing_cost_entry_id IS DISTINCT FROM OLD.processing_cost_entry_id
     OR NEW.signup_key IS DISTINCT FROM OLD.signup_key
     OR NEW.bank_last4 IS DISTINCT FROM OLD.bank_last4 OR NEW.clearing_at IS DISTINCT FROM OLD.clearing_at
     OR NEW.returned_at IS DISTINCT FROM OLD.returned_at OR NEW.return_reason IS DISTINCT FROM OLD.return_reason
     OR NEW.return_detail IS DISTINCT FROM OLD.return_detail OR NEW.reversed_at IS DISTINCT FROM OLD.reversed_at
     OR NEW.stripe_dispute_id IS DISTINCT FROM OLD.stripe_dispute_id
     OR NEW.over_amount IS DISTINCT FROM OLD.over_amount OR NEW.over_whole IS DISTINCT FROM OLD.over_whole
     OR (NEW.team_id IS DISTINCT FROM OLD.team_id AND NEW.team_id IS NOT NULL)
     OR (NEW.tournament_id IS DISTINCT FROM OLD.tournament_id AND NEW.tournament_id IS NOT NULL)
     OR (NEW.season_id IS DISTINCT FROM OLD.season_id AND NEW.season_id IS NOT NULL)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'open' AND NEW.status = 'expired')) THEN
    RAISE EXCEPTION 'An online payment changes only through its landing or its refund.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.online_payments_guard() FROM PUBLIC, anon, authenticated;

-- 4. Whether a Stripe account is its org's Stripe-owned account. A replaced account's payments no longer match the org's
--    row (one row per org, mig 358), and the accounts it replaced were all 'application' (mig 498): they read as not ours.
CREATE OR REPLACE FUNCTION public.online_payment_stripe_owned(p_stripe_account text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM org_payment_accounts a WHERE a.stripe_account_id = p_stripe_account AND a.fees_collector = 'stripe');
$$;
REVOKE ALL ON FUNCTION public.online_payment_stripe_owned(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_stripe_owned(text) TO service_role;

-- 5. A "Payment processing" money-out line on the payment's own book: the tournament's, or the house-league season's.
--    NULL when the book is gone (a deleted tournament). Callers hold the payment's locks and the write flag.
CREATE OR REPLACE FUNCTION public.online_payment_cost_out(p_op uuid, p_day date, p_description text, p_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_op public.online_payments%ROWTYPE; v_method text; v_day date := p_day;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date; v_closed date;
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_op;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  -- A day in a closed fiscal year is dated today, as the landing dates its own lines (mig 358): Stripe's figure can arrive
  -- after the year closed, and a refused line would lose it (hardening, owner 2026-11-18).
  v_closed := club_books_closed_through(v_op.org_id);
  IF v_day IS NULL OR v_day > v_today THEN v_day := v_today; END IF;
  IF v_closed IS NOT NULL AND v_day <= v_closed THEN v_day := v_today; END IF;
  v_method := CASE WHEN v_op.rail = 'bank_debit' THEN 'online_bank' ELSE 'online_card' END;
  IF v_op.flow = 'league_signup' THEN
    RETURN online_payment_league_post_out(v_op.season_id, 'Payment processing', v_day, p_description, p_amount, v_op.id, NULL, v_method);
  END IF;
  IF v_op.tournament_id IS NULL THEN RETURN NULL; END IF;
  -- A tournament whose fees are not kept in the books (the fee book off, mig 373: no Club plan or Accounting add-on, or a
  -- free tournament) books no receipt and no processing cost at the landing (mig 390), so none of these either: never a
  -- Stripe cost in a book that holds none of its payments (/review 2026-11-18). A debit that failed before it cleared has no
  -- receipt but is still booked where the book is on (ruling (d)).
  IF NOT tournament_fee_book_on(v_op.tournament_id) THEN RETURN NULL; END IF;
  RETURN online_payment_post_out(v_op.tournament_id, 'Payment processing', v_day, p_description, p_amount, v_op.id, NULL, v_method);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_cost_out(uuid, date, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_cost_out(uuid, date, text, numeric) TO service_role;

-- The payment's locks, in the landing's order: tournament → team (or season → registrations) → payment.
CREATE OR REPLACE FUNCTION public.online_payment_lock_for_cost(p_op uuid)
RETURNS public.online_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_op public.online_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_op;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.tournament_id IS NOT NULL THEN PERFORM 1 FROM tournaments WHERE id = v_op.tournament_id FOR NO KEY UPDATE; END IF;
  IF v_op.team_id IS NOT NULL THEN PERFORM 1 FROM teams WHERE id = v_op.team_id FOR UPDATE; END IF;
  IF v_op.season_id IS NOT NULL THEN PERFORM 1 FROM league_seasons s WHERE s.id = v_op.season_id FOR NO KEY UPDATE; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_op FOR UPDATE;
  RETURN v_op;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_lock_for_cost(uuid) FROM PUBLIC, anon, authenticated;

-- 6. Stripe's fee on a landed payment: stored once; the part above Stripe's standard cost is its own cost line, in either
--    payer mode, dated the day the payment landed (it leaves in the same payout).
CREATE OR REPLACE FUNCTION public.online_payment_stripe_fee_set(p_online_payment uuid, p_stripe_fee numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_op public.online_payments%ROWTYPE; v_fee numeric(12,2) := round(p_stripe_fee, 2); v_extra numeric(12,2);
  v_entry uuid;
BEGIN
  IF v_fee IS NULL OR v_fee < 0 THEN RAISE EXCEPTION 'Stripe''s fee must be zero or more'; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF NOT online_payment_stripe_owned(v_op.stripe_account_id) THEN RETURN jsonb_build_object('skipped', 'old_account'); END IF;
  IF v_op.stripe_fee_amount IS NOT NULL THEN RETURN jsonb_build_object('already', true); END IF;
  IF v_op.landed_at IS NULL THEN RETURN jsonb_build_object('skipped', 'not_landed'); END IF;
  v_op := online_payment_lock_for_cost(p_online_payment);
  IF v_op.stripe_fee_amount IS NOT NULL THEN RETURN jsonb_build_object('already', true); END IF;
  -- Stripe's standard cost is what the application fee left of the fee (rate design A, mig 498): no price list here.
  v_extra := v_fee - (v_op.fee_amount - v_op.application_fee_amount);
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  IF v_extra > 0 THEN
    v_entry := online_payment_cost_out(v_op.id, coalesce(v_op.paid_on, (now() AT TIME ZONE 'America/Toronto')::date),
      'Stripe’s extra · ' || v_op.description, v_extra);
  END IF;
  UPDATE online_payments SET stripe_fee_amount = v_fee, stripe_extra_entry_id = v_entry, updated_at = now() WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN jsonb_build_object('already', false, 'extra', greatest(v_extra, 0), 'entryId', v_entry);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_stripe_fee_set(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_stripe_fee_set(uuid, numeric) TO service_role;

-- 7. The fee Stripe attached to a dispute (its withdrawal's `stripe_fee` detail): booked once, the day it is read.
CREATE OR REPLACE FUNCTION public.online_payment_dispute_fee_book(p_online_payment uuid, p_fee numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_op public.online_payments%ROWTYPE; v_fee numeric(12,2) := round(p_fee, 2); v_entry uuid;
BEGIN
  IF v_fee IS NULL OR v_fee <= 0 THEN RETURN jsonb_build_object('skipped', 'no_fee'); END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF NOT online_payment_stripe_owned(v_op.stripe_account_id) THEN RETURN jsonb_build_object('skipped', 'old_account'); END IF;
  IF v_op.dispute_fee_entry_id IS NOT NULL THEN RETURN jsonb_build_object('already', true); END IF;
  IF v_op.landed_at IS NULL THEN RETURN jsonb_build_object('skipped', 'not_landed'); END IF;
  v_op := online_payment_lock_for_cost(p_online_payment);
  IF v_op.dispute_fee_entry_id IS NOT NULL THEN RETURN jsonb_build_object('already', true); END IF;
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  -- A bank debit's dispute is the debit taken back after it cleared: the product calls it "Returned by the bank", so its
  -- fee reads as a returned debit's, never a dispute's (/marketing 2026-11-18). Not "Returned by the bank · …": that
  -- prefix finds a team's returned line (lib/online-payouts.ts, the 12c check).
  v_entry := online_payment_cost_out(v_op.id, (now() AT TIME ZONE 'America/Toronto')::date,
    CASE WHEN v_op.rail = 'bank_debit' THEN 'Returned debit fee · receipt ' ELSE 'Dispute fee · receipt ' END || v_op.receipt_no, v_fee);
  UPDATE online_payments SET dispute_fee_entry_id = v_entry, updated_at = now() WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN jsonb_build_object('already', false, 'entryId', v_entry);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_dispute_fee_book(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_dispute_fee_book(uuid, numeric) TO service_role;

-- 8. A stand-alone Stripe fee line (ruling (d)): recorded once by its transaction id, matched to exactly one payment of
--    its kind near its day, and booked on that payment's book. The kind and day are read from Stripe's wording by the
--    caller (lib/online-payment-stripe-fees.ts). Several candidates, none, or a credit: recorded, never guessed.
CREATE OR REPLACE FUNCTION public.online_payment_stripe_fee_line_take(
  p_org uuid, p_stripe_account text, p_txn text, p_livemode boolean, p_amount numeric, p_description text,
  p_created timestamptz, p_kind text, p_day date
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_line public.online_payment_stripe_fee_lines%ROWTYPE; v_ids uuid[]; v_op public.online_payments%ROWTYPE;
  v_entry uuid; v_reason text; v_desc text; v_retry boolean := false;
BEGIN
  IF p_kind NOT IN ('debit_failure', 'dispute_countered', 'other') THEN RAISE EXCEPTION 'Unknown Stripe fee kind'; END IF;
  IF NOT EXISTS (SELECT 1 FROM org_payment_accounts a WHERE a.org_id = p_org AND a.stripe_account_id = p_stripe_account
                   AND a.fees_collector = 'stripe') THEN
    RAISE EXCEPTION 'Not this organization''s Stripe-owned account';
  END IF;
  INSERT INTO online_payment_stripe_fee_lines(org_id, stripe_account_id, stripe_txn_id, livemode, amount, description,
    stripe_created_at, kind)
  VALUES (p_org, p_stripe_account, p_txn, coalesce(p_livemode, false), round(p_amount, 2), left(p_description, 500),
    p_created, p_kind)
  ON CONFLICT (stripe_txn_id) DO NOTHING
  RETURNING * INTO v_line;
  IF v_line.id IS NULL THEN
    -- Recorded before. Booked, or never a fee to book (a credit, an unknown kind): done. Left unmatched or refused: tried
    -- again (hardening, owner 2026-11-18), since the payment's side can be stamped after Stripe's line is first read (a
    -- late webhook) or a refusal can clear (a book reopened). Bounded by the job's look-back: a line older than it is not
    -- listed again, so it stays as it last read.
    SELECT * INTO v_line FROM online_payment_stripe_fee_lines WHERE stripe_txn_id = p_txn FOR UPDATE;
    IF v_line.entry_id IS NOT NULL OR v_line.unmatched_reason IS NULL
       OR v_line.unmatched_reason NOT IN ('no_payment', 'several_payments', 'refused') THEN
      RETURN jsonb_build_object('already', true);
    END IF;
    v_retry := true;
  END IF;

  IF p_amount >= 0 THEN v_reason := 'not_a_charge';
  ELSIF p_kind = 'other' THEN v_reason := 'unknown_kind';
  ELSIF p_kind = 'debit_failure' THEN
    -- A debit that failed before it cleared (never landed, nothing else in the books), on this account, near the day.
    SELECT array_agg(p.id) INTO v_ids FROM online_payments p
     WHERE p.stripe_account_id = p_stripe_account AND p.rail = 'bank_debit' AND p.status = 'returned'
       -- D+1 too (hardening 2026-11-18): our return stamp can land after the UTC midnight of Stripe's dated line.
       AND (p.returned_at AT TIME ZONE 'UTC')::date BETWEEN p_day - 1 AND p_day + 1
       AND NOT EXISTS (SELECT 1 FROM online_payment_stripe_fee_lines l
                        WHERE l.online_payment_id = p.id AND l.kind = 'debit_failure' AND l.id <> v_line.id);
  ELSE
    -- A card dispute this club answered near the day (answered_at is our first read of the answer).
    SELECT array_agg(DISTINCT p.id) INTO v_ids FROM online_payment_disputes d JOIN online_payments p ON p.id = d.online_payment_id
     WHERE p.stripe_account_id = p_stripe_account AND d.answered
       -- An inquiry (`warning_*`) answered carries no countered fee (/review 2026-11-18): never a candidate.
       AND d.status NOT LIKE 'warning%'
       AND (d.answered_at AT TIME ZONE 'UTC')::date BETWEEN p_day - 2 AND p_day + 1
       AND NOT EXISTS (SELECT 1 FROM online_payment_stripe_fee_lines l
                        WHERE l.online_payment_id = p.id AND l.kind = 'dispute_countered' AND l.id <> v_line.id);
  END IF;
  IF v_reason IS NULL AND coalesce(array_length(v_ids, 1), 0) = 0 THEN v_reason := 'no_payment'; END IF;
  IF v_reason IS NULL AND array_length(v_ids, 1) > 1 THEN v_reason := 'several_payments'; END IF;
  IF v_reason IS NOT NULL THEN
    UPDATE online_payment_stripe_fee_lines SET unmatched_reason = v_reason WHERE id = v_line.id;
    RETURN jsonb_build_object('already', false, 'retried', v_retry, 'matched', false, 'reason', v_reason);
  END IF;

  v_op := online_payment_lock_for_cost(v_ids[1]);
  -- Checked again under the payment's lock (hardening 2026-11-18): two runs at once (the cron and a person's Run) could
  -- each see the one candidate before the other's line was committed. A second line of this kind is not this payment's.
  IF EXISTS (SELECT 1 FROM online_payment_stripe_fee_lines l
              WHERE l.online_payment_id = v_op.id AND l.kind = p_kind AND l.id <> v_line.id) THEN
    UPDATE online_payment_stripe_fee_lines SET unmatched_reason = 'no_payment' WHERE id = v_line.id;
    RETURN jsonb_build_object('already', false, 'retried', v_retry, 'matched', false, 'reason', 'no_payment');
  END IF;
  v_desc := CASE WHEN p_kind = 'debit_failure' THEN 'Returned debit fee · ' || v_op.description
                 -- The fee for answering a card dispute, told apart from the one taken when it opened (/marketing 2026-11-18).
                 ELSE 'Dispute fee · answered · receipt ' || v_op.receipt_no END;
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  BEGIN
    v_entry := online_payment_cost_out(v_op.id, (p_created AT TIME ZONE 'America/Toronto')::date, v_desc, -round(p_amount, 2));
  EXCEPTION WHEN others THEN
    IF SQLSTATE ~ '^(40|53|57)' OR SQLSTATE = '55P03' THEN RAISE; END IF;
    v_entry := NULL;
    RAISE WARNING 'stand-alone Stripe fee % left unbooked: %', p_txn, SQLERRM;
  END;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  UPDATE online_payment_stripe_fee_lines SET online_payment_id = v_op.id, entry_id = v_entry,
    booked_at = CASE WHEN v_entry IS NOT NULL THEN now() END,
    unmatched_reason = CASE WHEN v_entry IS NULL THEN 'refused' END
   WHERE id = v_line.id;
  RETURN jsonb_build_object('already', false, 'retried', v_retry, 'matched', v_entry IS NOT NULL, 'onlinePaymentId', v_op.id, 'entryId', v_entry,
    'reason', CASE WHEN v_entry IS NULL THEN 'refused' END);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_stripe_fee_line_take(uuid, text, text, boolean, numeric, text, timestamptz, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_stripe_fee_line_take(uuid, text, text, boolean, numeric, text, timestamptz, text, date) TO service_role;

-- 9. A reversal: mig 391's, plus ruling (f) (▶ 501). When the family paid the fee, Stripe pulled it back with the payment
--    and keeps both parts, so the fee (less any of it already given back in a refund) is the club's cost now: the ordinary
--    "Payment processing" line, as club-pays mode has had since the landing. Stripe-owned accounts only.
CREATE OR REPLACE FUNCTION public.online_payment_reverse(p_online_payment uuid, p_dispute text, p_reason text, p_detail text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_it public.online_payment_items%ROWTYPE; v_row public.tournament_team_payments%ROWTYPE;
  v_entry uuid; v_refusal text; v_children jsonb := '[]'::jsonb; v_refresh jsonb; v_left numeric(12,2);
  v_card boolean; v_method text; v_taken numeric(12,2) := 0;
  v_fee_left numeric(12,2); v_fee_entry uuid; -- ▶ 501
BEGIN
  IF p_reason IS NOT NULL AND p_reason NOT IN ('insufficient_funds', 'account_closed', 'invalid_account', 'not_authorized') THEN
    RAISE EXCEPTION 'Invalid return reason';
  END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  v_card := v_op.rail = 'card'; -- ▶ 390
  IF v_card AND p_dispute IS NULL THEN RAISE EXCEPTION 'A card payment is reversed only by a lost dispute.'; END IF;
  v_method := CASE WHEN v_card THEN 'online_card' ELSE 'online_bank' END;
  -- ▶ 388: once per dispute, whatever the payment reads now.
  IF v_op.status = 'reversed' OR (p_dispute IS NOT NULL AND EXISTS (SELECT 1 FROM online_payments o WHERE o.stripe_dispute_id = p_dispute)) THEN
    RETURN jsonb_build_object('already', true);
  END IF;
  IF v_op.landed_at IS NULL OR v_op.status NOT IN ('paid', 'partly_refunded', 'refunded') THEN
    RAISE EXCEPTION 'This payment never landed, so there is nothing to reverse.';
  END IF;

  -- Lock order: tournament → team (or season → registrations) → payment.
  IF v_op.tournament_id IS NOT NULL THEN PERFORM 1 FROM tournaments WHERE id = v_op.tournament_id FOR NO KEY UPDATE; END IF; -- ▶ 391
  IF v_op.team_id IS NOT NULL THEN PERFORM 1 FROM teams WHERE id = v_op.team_id FOR UPDATE; END IF;
  IF v_op.season_id IS NOT NULL THEN
    PERFORM 1 FROM league_seasons s WHERE s.id = v_op.season_id FOR NO KEY UPDATE;
    PERFORM 1 FROM league_registrations r
     WHERE r.id IN (SELECT i.registration_id FROM online_payment_items i WHERE i.online_payment_id = v_op.id)
     ORDER BY r.id FOR UPDATE;
  END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;
  IF v_op.status = 'reversed' THEN RETURN jsonb_build_object('already', true); END IF;

  PERFORM set_config('flhq.online_payment_write', 'on', true);
  IF v_op.flow = 'league_signup' THEN
    FOR v_it IN SELECT * FROM online_payment_items i WHERE i.online_payment_id = v_op.id AND i.entry_id IS NOT NULL
                 AND i.registration_id IS NOT NULL ORDER BY i.created_at, i.id LOOP
      SELECT v_it.amount - coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_left
        FROM online_payment_refunds r
       WHERE r.online_payment_item_id = v_it.id AND (r.booked_at IS NOT NULL OR r.status = 'succeeded');
      IF v_left > 0 THEN
        SELECT m.entry, m.refusal INTO v_entry, v_refusal
          FROM club_league_money(v_op.org_id, v_op.season_id, v_it.registration_id, 'reverse', v_left, v_today,
                                 v_method, NULL, NULL) m;
        IF v_refusal IS NOT NULL THEN RAISE EXCEPTION 'The returned line was refused (%).', v_refusal; END IF;
        v_children := v_children || jsonb_build_array(jsonb_build_object('registrationId', v_it.registration_id,
          'amount', v_left, 'entryId', v_entry, 'description', v_it.description));
        v_taken := v_taken + v_left;
      END IF;
    END LOOP;
  ELSE
    SELECT * INTO v_row FROM tournament_team_payments WHERE online_payment_id = v_op.id FOR UPDATE;
    IF FOUND AND v_row.status IN ('posted', 'refunded') THEN
      v_left := CASE WHEN v_row.status = 'refunded' THEN 0 ELSE v_row.amount - v_row.refunded_amount END;
      UPDATE tournament_team_payments SET status = 'reversed', updated_at = now() WHERE id = v_row.id;
      IF v_left > 0 AND v_row.entry_id IS NOT NULL AND v_op.tournament_id IS NOT NULL THEN
        v_entry := online_payment_post_out(v_op.tournament_id, 'Returned by the bank', v_today,
          CASE WHEN v_card THEN 'Dispute lost · receipt ' || v_op.receipt_no                       -- ▶ 390
               ELSE 'Returned by the bank · ' || v_op.description END, v_left, v_op.id, NULL, v_method);
      END IF;
      v_taken := greatest(v_left, 0);
    END IF;
    IF v_op.team_id IS NOT NULL THEN v_refresh := team_payments_refresh(v_op.team_id, NULL, 'live', NULL); END IF;
  END IF;
  -- ▶ 501 (f): the family's fee went back with the payment; Stripe and we keep our parts, so it is the club's cost.
  IF v_taken > 0 AND v_op.fee_payer = 'family' AND v_op.fee_amount > 0 AND v_op.processing_cost_entry_id IS NULL
     AND v_op.reversal_fee_entry_id IS NULL AND online_payment_stripe_owned(v_op.stripe_account_id) THEN
    SELECT v_op.fee_amount - coalesce(sum(r.fee_refunded), 0) INTO v_fee_left
      FROM online_payment_refunds r
     WHERE r.online_payment_id = v_op.id AND (r.booked_at IS NOT NULL OR r.status = 'succeeded');
    IF v_fee_left > 0 THEN
      v_fee_entry := online_payment_cost_out(v_op.id, v_today, 'Payment processing · ' || v_op.description, v_fee_left);
    END IF;
  END IF;
  UPDATE online_payments SET status = 'reversed', reversed_at = now(), stripe_dispute_id = p_dispute,
    return_reason = p_reason, return_detail = left(nullif(btrim(coalesce(p_detail, '')), ''), 200),
    reversal_fee_entry_id = coalesce(v_fee_entry, reversal_fee_entry_id), -- ▶ 501
    updated_at = now()
  WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN coalesce(v_refresh, '{}'::jsonb) || jsonb_build_object('already', false, 'flow', v_op.flow,
    'children', v_children, 'teamId', v_op.team_id, 'entryId', v_entry, 'taken', v_taken,
    'feeEntryId', v_fee_entry); -- ▶ 501
END $$;
REVOKE ALL ON FUNCTION public.online_payment_reverse(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_reverse(uuid, text, text, text) TO service_role;

COMMIT;
