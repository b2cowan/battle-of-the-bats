-- ---------------------------------------------------------------
-- Migration 390 — Club Tier Stage 12d-1 Part 1: a team never overpays silently, a card dispute is recorded, and every
-- Stripe fee a club causes is recorded against it (comped and free included).
-- Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md §0 (12d-1 build state); words
-- docs/projects/active/CLUB_TIER_STAGE12D_COPY.md §1, §2; prompt CLUB_TIER_STAGE12D1_BUILD_PROMPT.md.
--
-- WHY: a tournament team's online payment booked silently past what the team owed (`tournament_team_payment_record` has
-- no check against the fee, and a pay page left open while the desk recorded an e-transfer paid twice with no item). A
-- card dispute was dropped without a word (the webhook handled a bank debit's only). And Stripe's fees a club's payments
-- cause were recovered only for a returned debit, never from a comped or free club (owner 2026-10-26: "comped clubs do not
-- get any reprieve on stripe fees in any capacity").
--
-- WHAT CHANGES:
--   1. online_payments gains the card's issuing country (a card from outside the club's country costs Stripe more, billed
--      to the club) and the overpayment flag: what was extra when it landed, whether the WHOLE payment was extra, and the
--      club's "Keep it" note. The extra still standing is read live (what is paid past the fee, never above the flag), so
--      a refund, a refund recorded another way or a raised entry clears it with nothing to stamp.
--   2. online_payment_land: an online team payment books in full (the book says what Stripe says) and records what was
--      extra. Signature unchanged.
--   3. online_payment_disputes (NEW): one row per Stripe dispute (an inquiry included), on either rail. Stripe's own state
--      at the last read (every event re-reads the dispute, so order never matters), where Stripe took its dispute fee, the
--      two emails' stamps, and what a loss took back (so a later win can put exactly that back).
--   4. online_payment_reverse: a CARD payment is reversed too, by a lost dispute (the bank-debit path is unchanged): the
--      card's lines say "Dispute lost · receipt N" and the method 'online_card'.
--   5. online_payment_dispute_apply (NEW): writes Stripe's read of a dispute, and in the same transaction books a loss
--      (once, through online_payment_reverse) or a win after a loss (once: a fresh receipt line through each flow's writer;
--      a child marked received meanwhile is refused and handed back, which is the drawn "paid twice after all" case).
--   6. platform_debit_fees → platform_stripe_fees (renamed; 12c's rows and constraints kept): every Stripe fee a club owes
--      — a returned or reversed debit, a dispute, an answering fee and its return, a card from outside the club's country.
--      Where the figure came from (Stripe's own, or the published rate held as one constant), and how it was billed (a
--      line on the subscription's next invoice, or on the club's own invoice). Mig 387 is not on production, so the
--      rename costs nothing there.
--   7. platform_fee_invoices (NEW): a club with no subscription invoice gets ONE invoice a month (owner 2026-10-27),
--      sent in our email; Stripe's ids, the hosted page, the two email stamps, and paid.
--   8. Needs attention kinds: card_disputed, card_dispute_lost, online_payment_over (the partial indexes list every kind;
--      the one-open index keys a dispute on its dispute id).
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. The card's country, and the overpayment flag ─────────────────────────────────────────────────
ALTER TABLE public.online_payments
  ADD COLUMN IF NOT EXISTS card_country char(2),
  ADD COLUMN IF NOT EXISTS over_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS over_whole boolean,
  ADD COLUMN IF NOT EXISTS over_kept_reason text,
  ADD COLUMN IF NOT EXISTS over_kept_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS over_kept_at timestamptz;
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_card_country_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_card_country_chk
  CHECK (card_country IS NULL OR card_country ~ '^[A-Z]{2}$');
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_over_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_over_chk
  CHECK ((over_amount IS NULL) = (over_whole IS NULL) AND (over_amount IS NULL OR over_amount > 0));
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_over_kept_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_over_kept_chk
  CHECK ((over_kept_at IS NULL) = (over_kept_reason IS NULL)
     AND (over_kept_reason IS NULL OR char_length(btrim(over_kept_reason)) BETWEEN 1 AND 500)
     AND (over_kept_at IS NULL OR over_amount IS NOT NULL));
CREATE INDEX IF NOT EXISTS online_payments_over_idx ON public.online_payments (team_id)
  WHERE over_amount IS NOT NULL AND over_kept_at IS NULL;
CREATE INDEX IF NOT EXISTS online_payments_over_kept_by_idx ON public.online_payments (over_kept_by) WHERE over_kept_by IS NOT NULL;
-- Mig 382's bank-only rule (marked ▶ 390): a CARD payment now carries the dispute that a loss reversed it on. The other
-- bank-only facts stay bank-only.
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_bank_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_bank_chk CHECK (
  (rail = 'bank_debit' OR (bank_last4 IS NULL AND clearing_at IS NULL AND returned_at IS NULL))
  AND (bank_last4 IS NULL OR bank_last4 ~ '^[0-9]{3,4}$')
  AND (return_detail IS NULL OR char_length(return_detail) <= 200));

-- Mig 382's guard (marked ▶ 390): what was extra is the landing's alone. (The card's country and the club's "Keep it"
-- note are written by the server after the landing, outside the write flag, so they are not frozen here.)
CREATE OR REPLACE FUNCTION public.online_payments_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'open' OR NEW.paid_at IS NOT NULL OR NEW.landed_at IS NOT NULL OR NEW.receipt_no IS NOT NULL
       OR NEW.stripe_payment_intent_id IS NOT NULL OR NEW.processing_cost_entry_id IS NOT NULL
       OR NEW.bank_last4 IS NOT NULL OR NEW.clearing_at IS NOT NULL OR NEW.returned_at IS NOT NULL
       OR NEW.return_reason IS NOT NULL OR NEW.return_detail IS NOT NULL OR NEW.reversed_at IS NOT NULL
       OR NEW.stripe_dispute_id IS NOT NULL OR NEW.over_amount IS NOT NULL OR NEW.over_whole IS NOT NULL THEN -- ▶ 390
      RAISE EXCEPTION 'An online payment starts open; Stripe''s answer records the rest.';
    END IF;
    IF (NEW.flow = 'tournament_team' AND (NEW.team_id IS NULL OR NEW.tournament_id IS NULL))
       OR (NEW.flow = 'league_signup' AND NEW.season_id IS NULL) THEN
      RAISE EXCEPTION 'An online payment opens on what it pays for.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.base_amount IS DISTINCT FROM OLD.base_amount OR NEW.fee_amount IS DISTINCT FROM OLD.fee_amount
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
     OR NEW.over_amount IS DISTINCT FROM OLD.over_amount OR NEW.over_whole IS DISTINCT FROM OLD.over_whole -- ▶ 390
     OR (NEW.team_id IS DISTINCT FROM OLD.team_id AND NEW.team_id IS NOT NULL)
     OR (NEW.tournament_id IS DISTINCT FROM OLD.tournament_id AND NEW.tournament_id IS NOT NULL)
     OR (NEW.season_id IS DISTINCT FROM OLD.season_id AND NEW.season_id IS NOT NULL)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'open' AND NEW.status = 'expired')) THEN
    RAISE EXCEPTION 'An online payment changes only through its landing or its refund.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.online_payments_guard() FROM PUBLIC, anon, authenticated;

-- ── 2. A team payment lands in full and says what was extra ──────────────────────────────────────
-- Mig 382's (marked ▶ 390): what the team owed before this payment is the fee less what is paid net of part refunds
-- (`tournament_team_payment_pay_due`'s own figure); anything past it is extra. A team with no fee owes nothing to measure.
CREATE OR REPLACE FUNCTION public.online_payment_land(
  p_online_payment uuid, p_paid_at timestamptz, p_payment_intent text, p_charge text, p_brand text, p_last4 text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_book_on boolean := false; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_day date; v_closed date; v_label text; v_rec jsonb; v_pay uuid; v_entry uuid; v_cost uuid; v_receipt bigint; v_method text;
  v_fee numeric; v_paid numeric; v_owed numeric; v_over numeric(12,2); -- ▶ 390
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.landed_at IS NOT NULL OR v_op.status IN ('partly_refunded', 'refunded', 'returned') THEN
    RETURN jsonb_build_object('already', true, 'receiptNo', v_op.receipt_no, 'returned', v_op.status = 'returned');
  END IF;
  IF v_op.team_id IS NULL OR v_op.tournament_id IS NULL THEN RAISE EXCEPTION 'The team is no longer in the tournament.'; END IF;

  -- Lock order: tournament (when the book is on) → team → this payment.
  IF tournament_fee_book_on(v_op.tournament_id) THEN
    v_book_on := true;
    PERFORM 1 FROM club_tournament_fee_word(v_op.tournament_id);
  END IF;
  PERFORM 1 FROM teams WHERE id = v_op.team_id FOR UPDATE;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;
  IF v_op.landed_at IS NOT NULL OR v_op.status IN ('partly_refunded', 'refunded', 'returned') THEN
    RETURN jsonb_build_object('already', true, 'receiptNo', v_op.receipt_no, 'returned', v_op.status = 'returned');
  END IF;

  -- ▶ 390: what the team owed before this payment, under the team's lock.
  SELECT f.total INTO v_fee FROM tournament_team_fee(v_op.team_id) f;
  IF v_fee IS NOT NULL THEN
    SELECT coalesce(sum(amount - refunded_amount), 0) INTO v_paid FROM tournament_team_payments
     WHERE team_id = v_op.team_id AND status = 'posted';
    v_owed := greatest(v_fee - v_paid, 0);
    v_over := greatest(v_op.base_amount - v_owed, 0);
  END IF;

  v_day := least((p_paid_at AT TIME ZONE 'America/Toronto')::date, v_today);
  v_closed := club_books_closed_through(v_op.org_id);
  IF v_closed IS NOT NULL AND v_day <= v_closed THEN v_day := v_today; END IF;
  v_label := CASE v_op.scope WHEN 'deposit' THEN 'Deposit' WHEN 'balance' THEN 'Balance' ELSE 'Payment' END;
  v_method := CASE WHEN v_op.rail = 'bank_debit' THEN 'online_bank' ELSE 'online_card' END;

  PERFORM set_config('flhq.online_payment_write', 'on', true);
  -- THE tournament writer, with no method (its own validation stays hand-only); the stamp below marks it online.
  v_rec := tournament_team_payment_record(v_op.team_id, v_op.base_amount, v_day, v_label, NULL, NULL);
  v_pay := (v_rec ->> 'paymentId')::uuid;
  v_entry := nullif(v_rec ->> 'entryId', '')::uuid;
  UPDATE tournament_team_payments SET method = v_method, online_payment_id = v_op.id, updated_at = now() WHERE id = v_pay;
  IF v_entry IS NOT NULL THEN UPDATE accounting_entries SET payment_method = v_method WHERE id = v_entry; END IF;
  -- The club pays the fee (A14): one "Payment processing" cost per payment — never less fee revenue.
  IF v_op.fee_payer = 'club' AND v_op.fee_amount > 0 AND v_entry IS NOT NULL THEN
    v_cost := online_payment_post_out(v_op.tournament_id, 'Payment processing', v_day,
      'Payment processing · ' || v_op.description, v_op.fee_amount, v_op.id, NULL, v_method);
  END IF;
  v_receipt := coalesce(v_op.receipt_no, nextval('online_payment_receipt_seq'));
  UPDATE online_payments SET status = 'paid', paid_at = p_paid_at, paid_on = v_day, landed_at = now(), land_error = NULL,
    stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
    stripe_charge_id = coalesce(p_charge, stripe_charge_id), card_brand = coalesce(p_brand, card_brand),
    card_last4 = coalesce(p_last4, card_last4), receipt_no = v_receipt, processing_cost_entry_id = v_cost,
    over_amount = nullif(v_over, 0), over_whole = CASE WHEN v_over > 0 THEN v_owed = 0 END, -- ▶ 390
    updated_at = now()
  WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN v_rec || jsonb_build_object('already', false, 'receiptNo', v_receipt, 'teamPaymentId', v_pay,
    'over', coalesce(v_over, 0), 'overWhole', coalesce(v_over > 0 AND v_owed = 0, false)); -- ▶ 390
END $$;
REVOKE ALL ON FUNCTION public.online_payment_land(uuid, timestamptz, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_land(uuid, timestamptz, text, text, text, text) TO service_role;

-- The extra still standing on a team's online payment: what is paid past the fee now, never above what was extra when it
-- landed, and nothing once the club kept it. 0 when nothing is extra (a refund, a refund recorded another way, or a
-- raised entry each bring it to 0 with nothing stamped).
CREATE OR REPLACE FUNCTION public.online_payment_over_left(p_online_payment uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN o.over_amount IS NULL OR o.over_kept_at IS NOT NULL OR o.team_id IS NULL OR f.total IS NULL THEN 0
    ELSE greatest(least(o.over_amount,
      (SELECT coalesce(sum(p.amount - p.refunded_amount), 0) FROM tournament_team_payments p
        WHERE p.team_id = o.team_id AND p.status = 'posted') - f.total), 0)
  END
  FROM online_payments o
  LEFT JOIN LATERAL tournament_team_fee(o.team_id) f ON true
  WHERE o.id = p_online_payment
$$;
REVOKE ALL ON FUNCTION public.online_payment_over_left(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_over_left(uuid) TO service_role;

-- ── 3. A dispute is its own record ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.online_payment_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  online_payment_id uuid NOT NULL REFERENCES public.online_payments(id) ON DELETE CASCADE,
  stripe_dispute_id text NOT NULL,
  -- Stripe's state at the last read. warning_* is an inquiry (the bank is only asking; nothing taken).
  status text NOT NULL CHECK (status IN ('warning_needs_response', 'warning_under_review', 'warning_closed',
    'needs_response', 'under_review', 'won', 'lost', 'prevented')),
  reason text CHECK (reason IS NULL OR char_length(reason) <= 60),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  held numeric(12,2) NOT NULL DEFAULT 0 CHECK (held >= 0),
  due_by timestamptz,
  answered boolean NOT NULL DEFAULT false,
  answered_at timestamptz,
  -- Stripe's dispute fee as Stripe reported it, and whose balance it came from: 'club' (on the club's own Stripe balance,
  -- nothing for us to bill) or 'platform' (ours; recovered through platform_stripe_fees).
  stripe_fee numeric(12,2) CHECK (stripe_fee IS NULL OR stripe_fee >= 0),
  fee_paid_from text CHECK (fee_paid_from IS NULL OR fee_paid_from IN ('club', 'platform')),
  livemode boolean NOT NULL DEFAULT false,
  opened_at timestamptz NOT NULL,
  closed_at timestamptz,
  read_at timestamptz NOT NULL DEFAULT now(),
  -- What a loss took back ({amount, children:[{registrationId, amount}]}) and when; a later win puts exactly that back.
  lost_booked_at timestamptz,
  taken_back jsonb,
  won_back_at timestamptz,
  won_back jsonb,
  -- The two emails to the person who can answer (words §1.6), each once.
  opened_emailed_at timestamptz,
  reminder_emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT online_payment_disputes_answered_chk CHECK (answered OR answered_at IS NULL),
  CONSTRAINT online_payment_disputes_won_back_chk CHECK (won_back_at IS NULL OR lost_booked_at IS NOT NULL)
);
COMMENT ON TABLE public.online_payment_disputes IS 'Club Tier 12d-1 (mig 390): one row per Stripe dispute on an online payment (an inquiry included), either rail. Stripe''s state at the last read; a loss is booked once (online_payment_reverse) and a win after it once (a fresh receipt line). Written only by online_payment_dispute_apply and the timer''s email stamps.';
CREATE UNIQUE INDEX IF NOT EXISTS online_payment_disputes_stripe_key ON public.online_payment_disputes (stripe_dispute_id);
CREATE INDEX IF NOT EXISTS online_payment_disputes_payment_idx ON public.online_payment_disputes (online_payment_id);
CREATE INDEX IF NOT EXISTS online_payment_disputes_org_idx ON public.online_payment_disputes (org_id);
CREATE INDEX IF NOT EXISTS online_payment_disputes_open_idx ON public.online_payment_disputes (org_id)
  WHERE status IN ('warning_needs_response', 'warning_under_review', 'needs_response', 'under_review');
ALTER TABLE public.online_payment_disputes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.online_payment_disputes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_payment_disputes TO service_role;

-- ── 4. A card payment is reversed by a lost dispute ──────────────────────────────────────────────
-- Mig 388's (marked ▶ 390): a card is accepted only with its dispute; its lines read "Dispute lost · receipt N" with the
-- card's method. A bank debit's path is unchanged.
CREATE OR REPLACE FUNCTION public.online_payment_reverse(p_online_payment uuid, p_dispute text, p_reason text, p_detail text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_it public.online_payment_items%ROWTYPE; v_row public.tournament_team_payments%ROWTYPE;
  v_entry uuid; v_refusal text; v_children jsonb := '[]'::jsonb; v_refresh jsonb; v_left numeric(12,2);
  v_card boolean; v_method text; v_taken numeric(12,2) := 0;
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
  IF v_op.tournament_id IS NOT NULL THEN PERFORM 1 FROM tournaments WHERE id = v_op.tournament_id FOR UPDATE; END IF;
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
  UPDATE online_payments SET status = 'reversed', reversed_at = now(), stripe_dispute_id = p_dispute,
    return_reason = p_reason, return_detail = left(nullif(btrim(coalesce(p_detail, '')), ''), 200), updated_at = now()
  WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN coalesce(v_refresh, '{}'::jsonb) || jsonb_build_object('already', false, 'flow', v_op.flow,
    'children', v_children, 'teamId', v_op.team_id, 'entryId', v_entry, 'taken', v_taken);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_reverse(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_reverse(uuid, text, text, text) TO service_role;

-- ── 5. Stripe's read of a dispute, and what it does to the book ───────────────────────────────────
-- Called with Stripe's CURRENT dispute (the caller re-reads it on every event), so a replay or an out-of-order event
-- writes the same row. A card dispute's loss is booked once; a win after a loss puts back once what the loss took. A
-- bank debit's dispute is recorded here for the record but booked by 12c's own path (online_payment_reverse, at
-- `created`: a debit dispute is lost on arrival), never twice.
CREATE OR REPLACE FUNCTION public.online_payment_dispute_apply(
  p_online_payment uuid, p_dispute text, p_status text, p_reason text, p_amount numeric, p_held numeric,
  p_due_by timestamptz, p_answered boolean, p_stripe_fee numeric, p_fee_paid_from text, p_livemode boolean,
  p_opened_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_d public.online_payment_disputes%ROWTYPE; v_prev text; v_created boolean := false;
  v_rev jsonb; v_lost_now boolean := false; v_won_back boolean := false; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_child jsonb; v_entry uuid; v_refusal text; v_back jsonb := '[]'::jsonb; v_refused jsonb := '[]'::jsonb;
  v_rec jsonb; v_pay uuid; v_amt numeric(12,2); v_closed timestamptz; v_status text := p_status;
  v_fee numeric; v_paid numeric; v_over numeric(12,2) := 0; v_owed numeric;
BEGIN
  IF p_status NOT IN ('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review',
                      'won', 'lost', 'prevented') THEN RAISE EXCEPTION 'Unknown dispute status'; END IF;
  IF p_fee_paid_from IS NOT NULL AND p_fee_paid_from NOT IN ('club', 'platform') THEN RAISE EXCEPTION 'Unknown fee payer'; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF p_livemode IS DISTINCT FROM v_op.livemode THEN RAISE EXCEPTION 'The dispute and the payment are in different modes.'; END IF;

  -- Lock order, as every money writer takes it: tournament (its book) → team (or season → registrations by id) → the
  -- payment → the dispute last. A refund or a landing on the same payment waits here instead of deadlocking (/dba).
  IF v_op.tournament_id IS NOT NULL THEN
    IF tournament_fee_book_on(v_op.tournament_id) THEN PERFORM 1 FROM club_tournament_fee_word(v_op.tournament_id); END IF;
    PERFORM 1 FROM tournaments WHERE id = v_op.tournament_id FOR UPDATE;
  END IF;
  IF v_op.team_id IS NOT NULL THEN PERFORM 1 FROM teams WHERE id = v_op.team_id FOR UPDATE; END IF;
  IF v_op.season_id IS NOT NULL THEN
    PERFORM 1 FROM league_seasons s WHERE s.id = v_op.season_id FOR NO KEY UPDATE;
    PERFORM 1 FROM league_registrations r
     WHERE r.id IN (SELECT i.registration_id FROM online_payment_items i WHERE i.online_payment_id = v_op.id)
     ORDER BY r.id FOR UPDATE;
  END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;

  -- One writer per dispute: the first delivery inserts; any other (a replay, a later event, or a twin that lost the
  -- insert race) takes the row's lock and updates it.
  v_closed := CASE WHEN p_status IN ('won', 'lost', 'warning_closed', 'prevented') THEN now() END;
  INSERT INTO online_payment_disputes(org_id, online_payment_id, stripe_dispute_id, status, reason, amount, held, due_by,
    answered, answered_at, stripe_fee, fee_paid_from, livemode, opened_at, closed_at)
  VALUES (v_op.org_id, v_op.id, p_dispute, p_status, left(p_reason, 60), p_amount, greatest(coalesce(p_held, 0), 0),
    p_due_by, coalesce(p_answered, false), CASE WHEN p_answered THEN now() END, p_stripe_fee, p_fee_paid_from,
    coalesce(p_livemode, false), coalesce(p_opened_at, now()), v_closed)
  ON CONFLICT (stripe_dispute_id) DO NOTHING
  RETURNING * INTO v_d;
  v_created := FOUND;
  IF NOT v_created THEN
    SELECT * INTO v_d FROM online_payment_disputes WHERE stripe_dispute_id = p_dispute FOR UPDATE;
    IF v_d.online_payment_id <> v_op.id THEN RAISE EXCEPTION 'This dispute belongs to another payment.'; END IF;
    v_prev := v_d.status;
    -- A decided dispute is never reopened by a stale read (/dba): won/lost move only to the other outcome (Stripe's late
    -- win), and an open read arriving after either leaves it as it is.
    IF v_prev IN ('won', 'lost') AND p_status NOT IN ('won', 'lost') THEN v_status := v_prev; END IF;
    v_closed := CASE WHEN v_status IN ('won', 'lost', 'warning_closed', 'prevented') THEN coalesce(v_d.closed_at, now()) END;
    UPDATE online_payment_disputes SET status = v_status, reason = coalesce(left(p_reason, 60), reason), amount = p_amount,
      held = greatest(coalesce(p_held, held), 0), due_by = coalesce(p_due_by, due_by),
      answered = answered OR coalesce(p_answered, false),
      answered_at = CASE WHEN answered_at IS NULL AND coalesce(p_answered, false) THEN now() ELSE answered_at END,
      stripe_fee = coalesce(p_stripe_fee, stripe_fee), fee_paid_from = coalesce(p_fee_paid_from, fee_paid_from),
      closed_at = v_closed, read_at = now(), updated_at = now()
    WHERE id = v_d.id RETURNING * INTO v_d;
  END IF;

  -- A card dispute lost: the money is out of the book, once. (A bank debit's loss is 12c's, at `created`.) A payment that
  -- never landed in a record has no line to take back; the caller holds an unlanded one for Stripe to redeliver.
  -- Known edge, not built (/dba M4–M5, "extremely rare"): a loss after a win-after-loss, or a second dispute lost on a
  -- payment already reversed, books nothing more — the payment is already out of the book once.
  IF v_op.rail = 'card' AND v_d.status = 'lost' AND v_d.lost_booked_at IS NULL AND v_op.landed_at IS NOT NULL THEN
    v_rev := online_payment_reverse(v_op.id, p_dispute, NULL, p_reason);
    IF NOT coalesce((v_rev ->> 'already')::boolean, false) THEN
      UPDATE online_payment_disputes SET lost_booked_at = now(),
        taken_back = jsonb_build_object('amount', v_rev -> 'taken', 'children', v_rev -> 'children'), updated_at = now()
      WHERE id = v_d.id RETURNING * INTO v_d;
      v_lost_now := true;
    END IF;
  END IF;

  -- Won after it was lost: put back exactly what the loss took, once, as a fresh receipt line in each flow's own writer.
  IF v_op.rail = 'card' AND v_d.status = 'won' AND v_d.lost_booked_at IS NOT NULL AND v_d.won_back_at IS NULL THEN
    PERFORM set_config('flhq.online_payment_write', 'on', true);
    IF v_op.flow = 'league_signup' THEN
      FOR v_child IN SELECT * FROM jsonb_array_elements(coalesce(v_d.taken_back -> 'children', '[]'::jsonb)) LOOP
        v_amt := (v_child ->> 'amount')::numeric;
        -- 'receive_decided' lands into the book whatever the registration's status; a child received meanwhile (paid
        -- again another way) is refused — words §1.2 dispute.againAfterOther — and handed back for its item.
        SELECT m.entry, m.refusal INTO v_entry, v_refusal
          FROM club_league_money(v_op.org_id, v_op.season_id, (v_child ->> 'registrationId')::uuid, 'receive_decided',
                                 v_amt, v_today, 'online_card', NULL, NULL) m;
        IF v_refusal IS NULL THEN
          v_back := v_back || jsonb_build_array(jsonb_build_object('registrationId', v_child ->> 'registrationId', 'amount', v_amt, 'entryId', v_entry));
        ELSE
          v_refused := v_refused || jsonb_build_array(jsonb_build_object('registrationId', v_child ->> 'registrationId', 'amount', v_amt, 'refusal', v_refusal));
        END IF;
      END LOOP;
    ELSIF v_op.team_id IS NOT NULL AND coalesce((v_d.taken_back ->> 'amount')::numeric, 0) > 0 THEN
      v_amt := (v_d.taken_back ->> 'amount')::numeric;
      -- What the team owes now, before the money is put back: anything past it is extra (the team paid again another way
      -- after the loss), flagged on the payment as a landing flags it (/dba M6).
      SELECT f.total INTO v_fee FROM tournament_team_fee(v_op.team_id) f;
      IF v_fee IS NOT NULL THEN
        SELECT coalesce(sum(amount - refunded_amount), 0) INTO v_paid FROM tournament_team_payments
         WHERE team_id = v_op.team_id AND status = 'posted';
        v_owed := greatest(v_fee - v_paid, 0);
        v_over := greatest(v_amt - v_owed, 0);
      END IF;
      -- The team's writer allows only its own labels (mig 345): the put-back is a plain "Payment" by card; the dispute
      -- row names it (won_back.teamPaymentId) so the record can say "dispute won".
      v_rec := tournament_team_payment_record(v_op.team_id, v_amt, v_today, 'Payment', NULL, NULL);
      v_pay := (v_rec ->> 'paymentId')::uuid;
      v_entry := nullif(v_rec ->> 'entryId', '')::uuid;
      UPDATE tournament_team_payments SET method = 'online_card', updated_at = now() WHERE id = v_pay;
      IF v_entry IS NOT NULL THEN UPDATE accounting_entries SET payment_method = 'online_card' WHERE id = v_entry; END IF;
      IF v_over > 0 THEN
        UPDATE online_payments SET over_amount = v_over, over_whole = v_owed = 0, updated_at = now() WHERE id = v_op.id;
      END IF;
      v_back := jsonb_build_array(jsonb_build_object('teamPaymentId', v_pay, 'amount', v_amt, 'entryId', v_entry, 'over', v_over));
    END IF;
    PERFORM set_config('flhq.online_payment_write', 'off', true);
    UPDATE online_payment_disputes SET won_back_at = now(),
      won_back = jsonb_build_object('back', v_back, 'refused', v_refused), updated_at = now()
    WHERE id = v_d.id RETURNING * INTO v_d;
    v_won_back := true;
  END IF;

  RETURN jsonb_build_object('disputeId', v_d.id, 'created', v_created, 'from', v_prev, 'status', v_d.status,
    'lostNow', v_lost_now, 'wonBack', v_won_back, 'refused', v_refused, 'over', v_over,
    'teamId', v_op.team_id, 'flow', v_op.flow);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_dispute_apply(uuid, text, text, text, numeric, numeric, timestamptz, boolean, numeric, text, boolean, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_dispute_apply(uuid, text, text, text, numeric, numeric, timestamptz, boolean, numeric, text, boolean, timestamptz) TO service_role;

-- ── 6. Every Stripe fee a club owes ───────────────────────────────────────────────────────────────
ALTER TABLE IF EXISTS public.platform_debit_fees RENAME TO platform_stripe_fees;
ALTER INDEX IF EXISTS public.platform_debit_fees_pkey RENAME TO platform_stripe_fees_pkey;
ALTER INDEX IF EXISTS public.platform_debit_fees_unbilled_idx RENAME TO platform_stripe_fees_unbilled_idx;
DROP INDEX IF EXISTS public.platform_debit_fees_key;
-- Every constraint mig 387 named (or Postgres named for it) after the old table, renamed so an error never says "debit"
-- for a dispute. Guarded, so the migration can run again (RENAME CONSTRAINT has no IF EXISTS).
DO $rename$
DECLARE v_pair text[];
BEGIN
  FOREACH v_pair SLICE 1 IN ARRAY ARRAY[
    ['platform_debit_fees_billed_chk', 'platform_stripe_fees_billed_chk'],
    ['platform_debit_fees_exempt_chk', 'platform_stripe_fees_exempt_chk'],
    ['platform_debit_fees_amount_check', 'platform_stripe_fees_amount_chk'],
    ['platform_debit_fees_exempt_reason_check', 'platform_stripe_fees_exempt_reason_chk'],
    ['platform_debit_fees_bill_error_check', 'platform_stripe_fees_bill_error_chk'],
    ['platform_debit_fees_org_id_fkey', 'platform_stripe_fees_org_id_fkey'],
    ['platform_debit_fees_online_payment_id_fkey', 'platform_stripe_fees_online_payment_id_fkey']] LOOP
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = v_pair[1] AND conrelid = 'public.platform_stripe_fees'::regclass) THEN
      EXECUTE format('ALTER TABLE public.platform_stripe_fees RENAME CONSTRAINT %I TO %I', v_pair[1], v_pair[2]);
    END IF;
  END LOOP;
END $rename$;
ALTER TABLE public.platform_stripe_fees DROP CONSTRAINT IF EXISTS platform_debit_fees_kind_check;
ALTER TABLE public.platform_stripe_fees DROP CONSTRAINT IF EXISTS platform_stripe_fees_kind_chk;
ALTER TABLE public.platform_stripe_fees ADD CONSTRAINT platform_stripe_fees_kind_chk CHECK (kind IN (
  'returned', 'reversed',                                  -- a bank debit that came back (12c)
  'dispute', 'dispute_answer', 'dispute_answer_returned',  -- a card dispute's fee, the answering fee, its return on a win
  'foreign_card'));                                        -- a card issued outside the club's country
ALTER TABLE public.platform_stripe_fees
  ADD COLUMN IF NOT EXISTS dispute_id uuid REFERENCES public.online_payment_disputes(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS amount_source text NOT NULL DEFAULT 'rate',
  ADD COLUMN IF NOT EXISTS billed_on text,
  ADD COLUMN IF NOT EXISTS fee_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS bill_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE public.platform_stripe_fees DROP CONSTRAINT IF EXISTS platform_stripe_fees_source_chk;
ALTER TABLE public.platform_stripe_fees ADD CONSTRAINT platform_stripe_fees_source_chk CHECK (amount_source IN ('stripe', 'rate'));
-- 12c billed every recovered fee on the subscription's invoice; say so before the rule below asks how each was billed.
UPDATE public.platform_stripe_fees SET billed_on = 'subscription' WHERE billed_at IS NOT NULL AND billed_on IS NULL;
ALTER TABLE public.platform_stripe_fees DROP CONSTRAINT IF EXISTS platform_stripe_fees_billed_on_chk;
-- Billed says how, and how agrees with the invoice it names (each clause NULL-safe: a CHECK that reads NULL passes). A fee
-- may sit on a club's own invoice that is still a draft before it is billed.
ALTER TABLE public.platform_stripe_fees ADD CONSTRAINT platform_stripe_fees_billed_on_chk CHECK (
  (billed_at IS NULL) = (billed_on IS NULL)
  AND (billed_on IS NULL OR billed_on IN ('subscription', 'own_invoice'))
  AND (billed_on IS DISTINCT FROM 'subscription' OR fee_invoice_id IS NULL)
  AND (billed_on IS DISTINCT FROM 'own_invoice' OR fee_invoice_id IS NOT NULL));
ALTER TABLE public.platform_stripe_fees DROP CONSTRAINT IF EXISTS platform_stripe_fees_dispute_chk;
ALTER TABLE public.platform_stripe_fees ADD CONSTRAINT platform_stripe_fees_dispute_chk CHECK (
  (kind IN ('dispute', 'dispute_answer', 'dispute_answer_returned')) = (dispute_id IS NOT NULL));
-- 12c's two exempt reasons stay readable for rows already written; new code writes 'test_mode' only (owner 2026-10-26).
COMMENT ON COLUMN public.platform_stripe_fees.exempt_reason IS 'Why a fee is not billed. Only test_mode is written from mig 390 on (a test payment never reaches a live invoice); comped and no_subscription are 12c''s, before the owner ruled every club pays its Stripe fees (2026-10-26).';
-- One fee of a kind per payment (and per dispute, for a dispute's kinds).
CREATE UNIQUE INDEX IF NOT EXISTS platform_stripe_fees_key ON public.platform_stripe_fees (online_payment_id, kind, dispute_id) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS platform_stripe_fees_invoice_idx ON public.platform_stripe_fees (fee_invoice_id) WHERE fee_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_stripe_fees_dispute_idx ON public.platform_stripe_fees (dispute_id) WHERE dispute_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_stripe_fees_org_idx ON public.platform_stripe_fees (org_id);
COMMENT ON TABLE public.platform_stripe_fees IS 'Club Tier 12c (mig 387, as platform_debit_fees) and 12d-1 (mig 390): every Stripe fee a club''s online payments cost the platform, recovered from the club on every plan: a line on its subscription''s next invoice, or on its own monthly invoice (platform_fee_invoices). A dispute_answer_returned row is a credit. exempt_reason only for test mode.';

-- ── 7. A club's own invoice ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_fee_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  livemode boolean NOT NULL DEFAULT false,
  period_start date NOT NULL CHECK (extract(day FROM period_start) = 1),
  stripe_customer_id text NOT NULL,
  stripe_invoice_id text,
  invoice_number text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  amount_due numeric(12,2),
  hosted_invoice_url text,
  due_at timestamptz,
  finalized_at timestamptz,
  emailed_at timestamptz,
  reminded_at timestamptz,
  paid_at timestamptz,
  send_error text CHECK (send_error IS NULL OR char_length(send_error) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_fee_invoices_paid_chk CHECK ((status = 'paid') = (paid_at IS NOT NULL)),
  CONSTRAINT platform_fee_invoices_final_chk CHECK (status = 'draft' OR (stripe_invoice_id IS NOT NULL AND finalized_at IS NOT NULL))
);
COMMENT ON TABLE public.platform_fee_invoices IS 'Club Tier 12d-1 (mig 390): a club with no subscription invoice to ride on (comped, free, cancelled) is sent ONE invoice a month for its Stripe fees (owner 2026-10-27), in our email (Stripe''s own invoice email off), paid on Stripe''s hosted page. Unpaid: shown in platform admin, one reminder, nothing switches off.';
CREATE UNIQUE INDEX IF NOT EXISTS platform_fee_invoices_period_key ON public.platform_fee_invoices (org_id, livemode, period_start);
CREATE UNIQUE INDEX IF NOT EXISTS platform_fee_invoices_stripe_key ON public.platform_fee_invoices (stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_fee_invoices_unpaid_idx ON public.platform_fee_invoices (org_id) WHERE status = 'open';
ALTER TABLE public.platform_fee_invoices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_fee_invoices FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_fee_invoices TO service_role;
ALTER TABLE public.platform_stripe_fees DROP CONSTRAINT IF EXISTS platform_stripe_fees_invoice_fk;
ALTER TABLE public.platform_stripe_fees ADD CONSTRAINT platform_stripe_fees_invoice_fk
  FOREIGN KEY (fee_invoice_id) REFERENCES public.platform_fee_invoices(id) ON DELETE RESTRICT;

-- ── 8. Three Needs attention kinds ─────────────────────────────────────────────────────────────────
--   card_disputed      — a card payment is disputed (amber for the person who set up payouts; info for the desk)
--   card_dispute_lost  — the bank took back a payment; out of the book, owing again
--   online_payment_over — a team's online payment landed past what it owed (paid twice / more than owed)
drop index if exists public.notifications_user_needs_attention_idx;
create index notifications_user_needs_attention_idx
  on public.notifications (user_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'card_dispute_lost', 'card_disputed', 'card_refund_failed',
                         'card_refund_still_enrolled', 'card_refund_unmatched',
                         'card_refund_whose', 'club_hand_back_asked', 'club_hand_back_unasked',
                         'club_payment_handed_off', 'club_schedule_review', 'debit_returned', 'debit_reversed',
                         'house_league_withdraw_request', 'online_payment_not_recorded', 'online_payment_over',
                         'payment_failed', 'payouts_need_attention', 'team_coach_payment_reminder', 'team_money_sent',
                         'team_move_requested', 'team_no_show', 'team_request_filed', 'team_request_holding_payout');

drop index if exists public.notifications_org_needs_attention_idx;
create index notifications_org_needs_attention_idx
  on public.notifications (org_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'card_dispute_lost', 'card_disputed', 'card_refund_failed',
                         'card_refund_still_enrolled', 'card_refund_unmatched',
                         'card_refund_whose', 'club_hand_back_asked', 'club_hand_back_unasked',
                         'club_payment_handed_off', 'club_schedule_review', 'debit_returned', 'debit_reversed',
                         'house_league_withdraw_request', 'online_payment_not_recorded', 'online_payment_over',
                         'payment_failed', 'payouts_need_attention', 'team_coach_payment_reminder', 'team_money_sent',
                         'team_move_requested', 'team_no_show', 'team_request_filed', 'team_request_holding_payout');

-- One open copy per person and subject: a dispute keys on its dispute (a payment can be disputed twice).
DROP INDEX IF EXISTS public.notifications_one_open_online_payments_notice;
CREATE UNIQUE INDEX notifications_one_open_online_payments_notice
  ON public.notifications (org_id, user_id, event_type,
    (COALESCE(metadata->>'onlineDisputeId', metadata->>'stripeAccountId', metadata->>'onlinePaymentItemId',
              metadata->>'onlinePaymentId', metadata->>'unassignedRefundId', metadata->>'enrolledRefundId',
              metadata->>'unmatchedStripeRefundId')))
  WHERE cleared_at IS NULL
    AND event_type IN ('payouts_need_attention', 'online_payment_not_recorded', 'card_refund_failed',
                       'card_refund_whose', 'card_refund_still_enrolled', 'card_refund_unmatched',
                       'debit_returned', 'debit_reversed', 'card_disputed', 'card_dispute_lost', 'online_payment_over');

COMMIT;
