-- 542 — A refund the club makes in its own Stripe dashboard (Board Ready Stage 6 fixes, Part A; owner 2026-11-25: asks 1–7 all
-- A, then "yes, write 542"). Drawing: https://claude.ai/artifact/59e8zBT9RYsFGFPzwJ4kZX. /accounting: the 2026-11-25 addendum in
-- docs/agents/accounting/CLUB_SPONSOR_INVOICE_REVIEW.md.
--
-- Before this, a refund made in Stripe raised a notice and nothing else: the deal read paid, the books held the money, and the
-- deal's own Refund offered the same money again. Now:
--   1. It is RECORDED on its payment (origin 'stripe', keyed on Stripe's refund id, safe to repeat and out of order), counted
--      against what can still go back from the moment Stripe accepts it (pending included).
--   2. When Stripe says it SUCCEEDED its money lines book by themselves, dated the day Stripe made it (never before the
--      payment's own day; today when that year is closed): the sponsorship, the processing fee when it went back too, and the
--      GST/HST. The deal's state does NOT move (ask 2).
--   3. The club FINISHES it on the deal (club_sponsor_card_refund_finish): a reason, the credit note (numbered and dated the day
--      it is issued), and on the last of the deal's money "It has ended" (Withdrawn) or "They still owe it" (owing again).
--   4. Sponsorship first, the fee only after all of the sponsorship (ask 3): fee_part / fee_tax_part say how much of a refund was
--      the fee, so "what can go back" and the fee never return the same money twice.
--   5. A refund made after the sponsor's bank already took the payment back (a lost dispute) books NOTHING (the loss already
--      reversed the lines): after_lost_dispute. If the club later WINS that dispute, club_sponsor_card_twice_settle books it.
--   6. A refund made in Stripe that fails before it succeeded is marked failed; one that bounces after booking takes the shipped
--      bounce path (club_sponsor_card_refund_failed, which now also voids the fee line).
--   7. The daily retry (sweepStuckSponsorRefunds) re-asks Stripe only for a row with NO Stripe id: a 'stripe' row always has one
--      (CHECK below), so it can never be sent twice.
--   8. Two Needs-attention kinds of their own (owner 2026-11-26, after /simplify: "yes, make both database changes on dev"):
--      sponsor_refund_to_finish and sponsor_refund_twice, one open copy per person and refund (keyed on sponsorRefundId), so
--      neither borrows card_refund_unmatched (a family's "matches no payment we recorded") or its Stripe-id key.
--   9. Added by the /review and /dba of 2026-11-26 (owner: "All five"): a finish, and a refund from the deal (534's
--      club_sponsor_card_refund_book, redefined here), puts a paid deal back to owing only when what still stands no longer
--      covers the invoice; what happens to the deal is asked once per payment; a refund on its way when a dispute is lost or
--      won is judged when it SUCCEEDS; a "paid back twice" refund that bounces booked nothing and says so (wasBooked false).
--  10. Owing again (/accounting + /legal 2026-11-26, owner: "Fee first, no note"): "They still owe it" is taken only when
--      everything the sponsor paid on that payment, the fee included, has gone back and no earlier refund on it has a credit
--      note; a finish that leaves the money owed again issues NO credit note (the price didn't change) and is marked 'owing',
--      whether the club chose it or what else stands no longer covers the invoice, and so is every later finish on it.
-- The fee line's column is fee_refund_entry_id: the shorter name belongs to a house-league registration's fee line (its money guard).
-- 530 to 534 are applied to dev and pending on production; this is a NEW migration on top of them.

BEGIN;

-- ── 1. The refund row learns where it was made ────────────────────────────────────────────────────────────
ALTER TABLE public.club_sponsor_deal_refunds
  ADD COLUMN IF NOT EXISTS origin             text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS stripe_created_at  timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_reason      text,
  ADD COLUMN IF NOT EXISTS fee_part           numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_tax_part       numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_refund_entry_id       uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS after_lost_dispute boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finished_at        timestamptz,
  ADD COLUMN IF NOT EXISTS finished_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS finished_by_name   text,
  ADD COLUMN IF NOT EXISTS outcome            text,
  ADD COLUMN IF NOT EXISTS credit_on          date;

-- A refund made in Stripe has no reason or person until the club finishes it.
ALTER TABLE public.club_sponsor_deal_refunds ALTER COLUMN reason DROP NOT NULL;
ALTER TABLE public.club_sponsor_deal_refunds ALTER COLUMN created_by_name DROP NOT NULL;

ALTER TABLE public.club_sponsor_deal_refunds DROP CONSTRAINT IF EXISTS club_sponsor_deal_refunds_origin;
ALTER TABLE public.club_sponsor_deal_refunds ADD CONSTRAINT club_sponsor_deal_refunds_origin CHECK (
  origin IN ('app', 'stripe')
  -- A refund from the deal always has its reason and its person, and none of the Stripe-only facts.
  AND (origin = 'stripe' OR (reason IS NOT NULL AND created_by_name IS NOT NULL AND stripe_created_at IS NULL
       AND fee_part = 0 AND fee_tax_part = 0 AND NOT after_lost_dispute AND finished_at IS NULL AND outcome IS NULL))
  -- A refund made in Stripe always carries Stripe's id (so the daily retry, which re-asks only rows without one, never sends it).
  AND (origin = 'app' OR stripe_refund_id IS NOT NULL)
  -- Finished = a reason and a person; only a finished one carries an outcome.
  AND ((finished_at IS NULL) = (finished_by_name IS NULL))
  AND (finished_at IS NULL OR reason IS NOT NULL)
  AND (outcome IS NULL OR (outcome IN ('ended', 'owing') AND finished_at IS NOT NULL))
  AND (finished_by_name IS NULL OR char_length(btrim(finished_by_name)) BETWEEN 1 AND 120)
  AND (stripe_reason IS NULL OR char_length(stripe_reason) <= 60)
  -- The fee part sits inside the amount, its tax inside both the fee part and the tax part.
  AND fee_part >= 0 AND fee_tax_part >= 0 AND fee_tax_part <= fee_part AND fee_part <= amount AND fee_tax_part <= tax_part
  AND (credit_on IS NULL OR credit_seq IS NOT NULL));
CREATE INDEX IF NOT EXISTS club_sponsor_deal_refunds_unfinished_idx ON public.club_sponsor_deal_refunds (org_id, deal_id)
  WHERE origin = 'stripe' AND status = 'succeeded' AND finished_at IS NULL AND NOT after_lost_dispute;

COMMENT ON COLUMN public.club_sponsor_deal_refunds.origin IS
  'Where the refund was made (mig 542): app (Refund on the deal''s payment) or stripe (the club''s own Stripe dashboard, recorded from Stripe''s event). A stripe one books its money lines by itself on success and waits for the club to finish it (finished_at).';
COMMENT ON COLUMN public.club_sponsor_deal_refunds.stripe_created_at IS
  'A refund made in Stripe: the moment Stripe made it. Its money lines are dated this day in Toronto (never before the payment''s day; today when that year is closed).';
COMMENT ON COLUMN public.club_sponsor_deal_refunds.stripe_reason IS
  'A refund made in Stripe: Stripe''s own reason word (duplicate, fraudulent, requested_by_customer), shown to the club only. The business reads `reason`, which the club writes when it finishes the refund.';
COMMENT ON COLUMN public.club_sponsor_deal_refunds.fee_part IS
  'How much of `amount` was the processing fee the sponsor paid, with its tax (mig 542). Always 0 for a refund from the deal (it never returns the fee). A refund in Stripe returns the sponsorship first and the fee only after all of the sponsorship.';
COMMENT ON COLUMN public.club_sponsor_deal_refunds.fee_tax_part IS
  'The GST/HST inside fee_part. Also inside tax_part, which is the whole refund''s tax (the sponsorship''s and the fee''s).';
COMMENT ON COLUMN public.club_sponsor_deal_refunds.fee_refund_entry_id IS
  'The money-out line that reversed the processing-fee income (a refund in Stripe that returned the fee).';
COMMENT ON COLUMN public.club_sponsor_deal_refunds.after_lost_dispute IS
  'Made in Stripe after the sponsor''s bank had already taken the payment back: the sponsor got the money twice. No lines are booked (the loss already reversed them) and there is nothing to finish; the club is asked to get it back. A dispute WON later books it (club_sponsor_card_twice_settle).';
COMMENT ON COLUMN public.club_sponsor_deal_refunds.finished_at IS
  'A refund made in Stripe that the club finished on the deal: its reason written, its credit note issued, the business emailed. NULL on a refund from the deal (it is finished when it is made).';
COMMENT ON COLUMN public.club_sponsor_deal_refunds.outcome IS
  'What a finished refund in Stripe did to the deal: ended (it gave back the last of the money and the deal is Withdrawn) or owing (the money is owed again, chosen or because what else stands no longer covers the invoice; no credit note). NULL when finishing moved nothing.';
COMMENT ON COLUMN public.club_sponsor_deal_refunds.credit_on IS
  'The credit note''s issue day when it differs from refunded_on: a refund in Stripe, finished later. NULL means the note is dated refunded_on (every refund from the deal).';

-- ── 2. What a payment can still give back counts every refund, wherever it was made ─────────────────────
-- refundable / money_left / tax_left are the SPONSORSHIP part (the fee never goes back from the deal); a refund in Stripe that
-- returned the fee counts only its sponsorship part here. The lib/club-sponsor-invoice.ts twin changes in the same unit of work.
CREATE OR REPLACE FUNCTION public.club_sponsor_card_refund_left(p_payment uuid)
RETURNS TABLE (refundable numeric, money_left numeric, tax_left numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.amount - p.fee_charged - p.fee_tax,
         p.amount - p.fee_charged - p.fee_tax - coalesce((SELECT sum(r.amount - r.fee_part) FROM club_sponsor_deal_refunds r WHERE r.payment_id = p.id AND r.status <> 'failed'), 0),
         p.tax_part - p.fee_tax - coalesce((SELECT sum(r.tax_part - r.fee_tax_part) FROM club_sponsor_deal_refunds r WHERE r.payment_id = p.id AND r.status <> 'failed'), 0)
    FROM club_sponsor_deal_payments p WHERE p.id = p_payment
$$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_refund_left(uuid) FROM PUBLIC, anon, authenticated;

-- What has really gone back of the SPONSORSHIP (refunds that succeeded): compared with refundable by every caller.
CREATE OR REPLACE FUNCTION public.club_sponsor_card_returned(p_payment uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(r.amount - r.fee_part), 0) FROM club_sponsor_deal_refunds r WHERE r.payment_id = p_payment AND r.status = 'succeeded'
$$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_returned(uuid) FROM PUBLIC, anon, authenticated;

-- ── 3. The money lines of a refund made in Stripe, and the day they take (called only inside this migration's functions; the caller
--    holds the locks and writes refunded_on with the status, so the row is never half-succeeded). p_book false: the day only.
CREATE OR REPLACE FUNCTION public.club_sponsor_card_stripe_refund_lines(p_refund uuid, p_book boolean)
RETURNS date LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r club_sponsor_deal_refunds%ROWTYPE; d club_sponsor_deals%ROWTYPE; p club_sponsor_deal_payments%ROWTYPE;
  v_day date; v_number text; v_business text; v_ledger uuid; v_cat uuid; v_income uuid; v_fee uuid; v_taxline uuid;
  v_spons numeric; v_feepre numeric; v_who text;
  c_note constant text := 'Refunded in the club''s Stripe dashboard. Finish it on the deal.';
  c_item constant uuid := '5b0d0528-0528-4c1b-8a50-7ea0507c0001';
BEGIN
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund;
  SELECT * INTO d FROM club_sponsor_deals WHERE id = r.deal_id;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = r.payment_id;
  -- The day the money left, never before the payment's own day (a refund whose event beat the landing), today in a closed year.
  v_day := club_sponsor_book_day(r.org_id, greatest(
    coalesce((r.stripe_created_at AT TIME ZONE 'America/Toronto')::date, (now() AT TIME ZONE 'America/Toronto')::date), p.received_on));
  IF NOT p_book THEN RETURN v_day; END IF;
  SELECT coalesce(d.business_name, s.name) INTO v_business FROM club_sponsors s WHERE s.id = d.sponsor_id;
  v_who := coalesce(v_business, 'the sponsor');
  v_number := d.invoice_year::text || '-' || lpad(d.invoice_seq::text, 3, '0');
  v_ledger := club_general_ledger(r.org_id);
  SELECT category_id INTO v_cat FROM budget_items WHERE id = c_item;
  v_spons := (r.amount - r.fee_part) - (r.tax_part - r.fee_tax_part);
  v_feepre := r.fee_part - r.fee_tax_part;
  IF v_spons > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, budget_category_id, budget_item_id, payment_method, notes)
    VALUES (v_ledger, v_day, left('Refund in Stripe to ' || v_who || ' · invoice ' || v_number, 200), v_spons,
      'expense', 'posted', 'club_sponsorship', 'sponsorship_deal', d.id, NULL, v_cat, c_item, 'online_card', c_note)
    RETURNING id INTO v_income;
  END IF;
  IF v_feepre > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, budget_category_id, budget_item_id, payment_method, notes)
    VALUES (v_ledger, v_day, left('Refund in Stripe to ' || v_who || ' · processing fee · invoice ' || v_number, 200), v_feepre,
      'expense', 'posted', 'club_sponsorship', 'sponsorship_deal', d.id, NULL, v_cat, c_item, 'online_card', c_note)
    RETURNING id INTO v_fee;
  END IF;
  IF r.tax_part > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes)
    VALUES (v_ledger, v_day, left('Refund in Stripe to ' || v_who || ' · invoice ' || v_number || ' · credit note owed', 200), r.tax_part,
      'expense', 'posted', 'gst_hst_collected', 'sponsorship_deal', d.id, NULL, 'online_card', c_note)
    RETURNING id INTO v_taxline;
  END IF;
  UPDATE club_sponsor_deal_refunds SET income_entry_id = v_income, fee_refund_entry_id = v_fee, tax_entry_id = v_taxline WHERE id = r.id;
  RETURN v_day;
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_stripe_refund_lines(uuid, boolean) FROM PUBLIC, anon, authenticated, service_role;

-- ── 4. Record a refund made in Stripe (from refund.created / .updated / .failed, any order, any number of times) ──────────
-- Returns one of: {noPayment} (not landed yet: the landing's reconcile feeds it again), {ours, refundId} (a refund from the deal:
-- the caller settles it as today), {ignored} (failed before it was ever seen), {recorded|booked|failed|already, refundId, ...}.
CREATE OR REPLACE FUNCTION public.club_sponsor_card_stripe_refund(
  p_online_payment uuid, p_stripe_refund text, p_amount numeric, p_status text, p_created timestamptz, p_stripe_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op online_payments%ROWTYPE; d club_sponsor_deals%ROWTYPE; p club_sponsor_deal_payments%ROWTYPE; r club_sponsor_deal_refunds%ROWTYPE;
  v_status text; v_refundable numeric; v_left numeric; v_tax_left numeric; v_fee_left numeric; v_fee_tax_left numeric;
  v_spons numeric; v_fee numeric; v_stax numeric := 0; v_ftax numeric := 0; v_id uuid; v_fail jsonb; v_twice boolean; v_day date;
BEGIN
  IF p_stripe_refund IS NULL OR btrim(p_stripe_refund) = '' OR char_length(p_stripe_refund) > 255 THEN
    RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_stripe_refund_id';
  END IF;
  v_status := CASE WHEN p_status = 'succeeded' THEN 'succeeded' WHEN p_status IN ('failed', 'canceled') THEN 'failed' ELSE 'pending' END;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND OR v_op.flow <> 'sponsorship' THEN RAISE EXCEPTION 'Not a sponsorship payment'; END IF;
  -- Lock order, as every writer of a deal's money takes it: deal → payment → refund.
  SELECT * INTO d FROM club_sponsor_deals WHERE id = v_op.sponsor_deal_id FOR UPDATE;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE online_payment_id = v_op.id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('noPayment', true); END IF;

  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE stripe_refund_id = p_stripe_refund FOR UPDATE;
  IF FOUND THEN
    IF r.payment_id <> p.id THEN RAISE EXCEPTION 'That refund belongs to another payment'; END IF;
    IF r.origin = 'app' THEN RETURN jsonb_build_object('ours', true, 'refundId', r.id); END IF;
    IF r.status = 'failed' THEN RETURN jsonb_build_object('already', true, 'refundId', r.id, 'status', 'failed', 'dealId', r.deal_id); END IF;
    IF v_status = 'failed' THEN
      IF r.status = 'succeeded' THEN
        -- It bounced after booking: the shipped path (lines voided; a finished one keeps its credit note, marked cancelled).
        v_fail := club_sponsor_card_refund_failed(r.id, p_stripe_refund, 'failed');
        -- One made after a lost dispute booked nothing: it says so, so nobody is told to refund the sponsor again.
        RETURN jsonb_build_object('failed', true, 'refundId', r.id, 'dealId', r.deal_id, 'wasBooked', NOT r.after_lost_dispute,
          'wasFinished', r.finished_at IS NOT NULL, 'dealEnded', coalesce((v_fail->>'dealEnded')::boolean, false));
      END IF;
      UPDATE club_sponsor_deal_refunds SET status = 'failed', failed_at = now(), failure_reason = 'failed' WHERE id = r.id;
      PERFORM club_sponsor_card_op_state(p.id);
      RETURN jsonb_build_object('failed', true, 'refundId', r.id, 'dealId', r.deal_id, 'wasBooked', false, 'wasFinished', false);
    END IF;
    IF v_status = 'succeeded' AND r.status = 'pending' THEN
      -- Whether the money went back twice is judged now, not when it was first seen: a dispute may have been lost or won
      -- while it was on its way.
      v_twice := p.dispute_lost_at IS NOT NULL;
      v_day := club_sponsor_card_stripe_refund_lines(r.id, NOT v_twice);
      UPDATE club_sponsor_deal_refunds SET status = 'succeeded', succeeded_at = now(), refunded_on = v_day, after_lost_dispute = v_twice
       WHERE id = r.id;
      PERFORM club_sponsor_card_op_state(p.id);
      RETURN jsonb_build_object('booked', NOT v_twice, 'refundId', r.id, 'dealId', r.deal_id, 'afterLostDispute', v_twice,
        'amount', r.amount);
    END IF;
    RETURN jsonb_build_object('already', true, 'refundId', r.id, 'status', r.status, 'dealId', r.deal_id);
  END IF;

  IF v_status = 'failed' THEN RETURN jsonb_build_object('ignored', true); END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_stripe_refund_amount';
  END IF;

  -- Sponsorship first, the fee only after all of the sponsorship (ask 3).
  SELECT l.refundable, l.money_left, l.tax_left INTO v_refundable, v_left, v_tax_left FROM club_sponsor_card_refund_left(p.id) l;
  v_left := greatest(v_left, 0); v_tax_left := greatest(v_tax_left, 0);
  SELECT p.fee_charged + p.fee_tax - coalesce(sum(x.fee_part), 0), p.fee_tax - coalesce(sum(x.fee_tax_part), 0)
    INTO v_fee_left, v_fee_tax_left FROM club_sponsor_deal_refunds x WHERE x.payment_id = p.id AND x.status <> 'failed';
  v_spons := least(p_amount, v_left);
  v_fee := p_amount - v_spons;
  -- More than the payment holds (Stripe never allows it; only drifted data could): refused, and the caller raises its notice.
  IF v_fee > v_fee_left THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_stripe_refund_over'; END IF;
  IF v_spons > 0 AND v_tax_left > 0 THEN
    v_stax := CASE WHEN v_spons = v_left THEN v_tax_left ELSE round(v_spons * (p.tax_part - p.fee_tax) / v_refundable, 2) END;
    v_stax := greatest(0, least(v_stax, v_tax_left, v_spons));
  END IF;
  IF v_fee > 0 AND v_fee_tax_left > 0 THEN
    v_ftax := CASE WHEN v_fee = v_fee_left THEN v_fee_tax_left ELSE round(v_fee * p.fee_tax / (p.fee_charged + p.fee_tax), 2) END;
    v_ftax := greatest(0, least(v_ftax, v_fee_tax_left, v_fee));
  END IF;
  v_twice := p.dispute_lost_at IS NOT NULL;

  INSERT INTO club_sponsor_deal_refunds(org_id, deal_id, payment_id, online_payment_id, amount, tax_part, whole, ends_deal,
    reason, status, stripe_refund_id, created_by, created_by_name, origin, stripe_created_at, stripe_reason,
    fee_part, fee_tax_part, after_lost_dispute)
  VALUES (p.org_id, p.deal_id, p.id, v_op.id, p_amount, v_stax + v_ftax, v_left > 0 AND v_spons = v_left, false,
    NULL, 'pending', p_stripe_refund, NULL, NULL, 'stripe', coalesce(p_created, now()), left(nullif(btrim(p_stripe_reason), ''), 60),
    v_fee, v_ftax, v_twice)
  RETURNING id INTO v_id;
  IF v_status = 'succeeded' THEN
    v_day := club_sponsor_card_stripe_refund_lines(v_id, NOT v_twice);
    UPDATE club_sponsor_deal_refunds SET status = 'succeeded', succeeded_at = now(), refunded_on = v_day WHERE id = v_id;
  END IF;
  PERFORM club_sponsor_card_op_state(p.id);
  RETURN jsonb_build_object('recorded', true, 'refundId', v_id, 'dealId', p.deal_id, 'status', v_status, 'afterLostDispute', v_twice,
    'amount', p_amount, 'feePart', v_fee, 'booked', v_status = 'succeeded' AND NOT v_twice);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_stripe_refund(uuid, text, numeric, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_stripe_refund(uuid, text, numeric, text, timestamptz, text) TO service_role;

-- ── 5. The club finishes a refund made in Stripe ──────────────────────────────────────────────────────────────────────
-- p_outcome: 'ended' | 'owing' when the refund gave back the last of the deal's money (asked only then), else NULL.
CREATE OR REPLACE FUNCTION public.club_sponsor_card_refund_finish(
  p_org uuid, p_refund uuid, p_reason text, p_outcome text, p_actor uuid, p_actor_name text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r club_sponsor_deal_refunds%ROWTYPE; d club_sponsor_deals%ROWTYPE; p club_sponsor_deal_payments%ROWTYPE;
  v_reason text := left(btrim(coalesce(p_reason, '')), 300); v_name text := left(btrim(coalesce(p_actor_name, '')), 120);
  v_full boolean; v_last boolean; v_seq integer; v_number text; v_closed date; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_ends boolean := false; v_owing boolean := false; v_owed_again boolean;
BEGIN
  IF v_reason = '' THEN RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_refund_needs_a_reason'; END IF;
  IF v_name = '' THEN RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_refund_needs_a_person'; END IF;
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund AND org_id = p_org;
  IF NOT FOUND OR r.origin <> 'stripe' THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_not_found'; END IF;
  SELECT * INTO d FROM club_sponsor_deals WHERE id = r.deal_id FOR UPDATE;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = r.payment_id FOR UPDATE;
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund FOR UPDATE;
  IF r.finished_at IS NOT NULL THEN
    RETURN jsonb_build_object('already', true, 'dealId', r.deal_id, 'creditSeq', r.credit_seq, 'endsDeal', r.ends_deal);
  END IF;
  IF r.status <> 'succeeded' OR r.after_lost_dispute THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_nothing_to_finish'; END IF;

  -- The last of the deal's money: this payment's sponsorship all back, and nothing else standing.
  v_full := club_sponsor_card_returned(p.id) >= p.amount - p.fee_charged - p.fee_tax;
  v_last := v_full AND p.dispute_lost_at IS NULL AND d.state <> 'withdrawn' AND NOT EXISTS (
    SELECT 1 FROM club_sponsor_deal_payments o WHERE o.deal_id = d.id AND o.id <> p.id AND o.voided_at IS NULL AND o.returned_at IS NULL)
    -- Asked once per payment: a later refund on it never asks again.
    AND NOT EXISTS (SELECT 1 FROM club_sponsor_deal_refunds x WHERE x.payment_id = p.id AND x.id <> r.id AND x.status = 'succeeded' AND x.outcome IS NOT NULL);
  IF v_last AND (p_outcome IS NULL OR p_outcome NOT IN ('ended', 'owing')) THEN
    RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_refund_needs_an_outcome';
  END IF;
  IF NOT v_last AND p_outcome IS NOT NULL THEN
    -- The screen asked a question the deal no longer has (another refund or payment moved it): it refreshes and asks again.
    RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_outcome_not_asked';
  END IF;

  -- "They still owe it" asks for the whole payment again: only once all of it, the fee too, is back with the sponsor (or
  -- they would pay the fee twice), and never beside a credit note that already reduced the invoice.
  IF v_last AND p_outcome = 'owing' THEN
    IF (SELECT coalesce(sum(x.amount), 0) FROM club_sponsor_deal_refunds x WHERE x.payment_id = p.id AND x.status = 'succeeded') < p.amount THEN
      RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_owing_needs_fee';
    END IF;
    IF EXISTS (SELECT 1 FROM club_sponsor_deal_refunds x WHERE x.payment_id = p.id AND x.id <> r.id AND x.status = 'succeeded' AND x.credit_seq IS NOT NULL) THEN
      RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_owing_noted';
    END IF;
  END IF;
  -- Does this finish leave the money owed again? Chosen; or this payment, all back, stops counting and what else stands
  -- doesn't cover a deal that is paid or already invoiced; or an earlier finish on this payment already did.
  v_owed_again := coalesce((v_last AND p_outcome = 'owing')
    OR (NOT v_last AND v_full AND p.dispute_lost_at IS NULL AND d.state IN ('paid', 'invoiced') AND d.total > (SELECT coalesce(sum(o.amount), 0)
          FROM club_sponsor_deal_payments o WHERE o.deal_id = d.id AND o.id <> p.id AND o.voided_at IS NULL AND o.returned_at IS NULL))
    OR EXISTS (SELECT 1 FROM club_sponsor_deal_refunds x WHERE x.payment_id = p.id AND x.id <> r.id AND x.status = 'succeeded' AND x.outcome = 'owing'), false);

  -- A refund on a taxed invoice carries a credit note, dated the day it is issued (/accounting 2026-11-25, Q1–Q2) — except
  -- money owed again: the price didn't change, so there is nothing to credit (/accounting 2026-11-26).
  IF coalesce(d.tax_amount, 0) > 0 AND NOT v_owed_again THEN
    v_seq := coalesce((SELECT max(x.credit_seq) FROM club_sponsor_deal_refunds x WHERE x.deal_id = d.id), 0) + 1;
  END IF;
  v_number := d.invoice_year::text || '-' || lpad(d.invoice_seq::text, 3, '0');
  UPDATE club_sponsor_deal_refunds SET reason = v_reason, finished_at = now(), finished_by = p_actor, finished_by_name = v_name,
    outcome = CASE WHEN v_last THEN p_outcome WHEN v_owed_again THEN 'owing' END, credit_seq = v_seq,
    credit_on = CASE WHEN v_seq IS NOT NULL AND v_today <> refunded_on THEN v_today END,
    ends_deal = v_last AND p_outcome = 'ended'
   WHERE id = r.id;
  -- The lines take the club's reason, and the tax line its credit note's number, where their year is still open (a closed
  -- year's line is never edited: it keeps "credit note owed", and the note itself is what the return relies on).
  v_closed := club_books_closed_through(r.org_id);
  UPDATE accounting_entries SET notes = v_reason, updated_at = now(),
      description = CASE
        WHEN id = r.tax_entry_id AND v_seq IS NOT NULL THEN left(replace(description, ' · credit note owed', ' · credit note ' || v_number || '-C' || v_seq), 200)
        WHEN id = r.tax_entry_id AND v_owed_again THEN replace(description, ' · credit note owed', '')
        ELSE description END
   WHERE id IN (r.income_entry_id, r.fee_refund_entry_id, r.tax_entry_id) AND status <> 'void'
     AND (v_closed IS NULL OR entry_date > v_closed);

  IF v_full THEN UPDATE club_sponsor_deal_payments SET returned_at = coalesce(returned_at, now()) WHERE id = p.id; END IF;
  PERFORM club_sponsor_card_op_state(p.id);
  IF v_last AND p_outcome = 'ended' THEN
    PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
    UPDATE club_sponsor_deals SET state = 'withdrawn', paid_on = NULL, withdrawn_at = now(), withdrawn_by = p_actor,
      withdrawn_by_name = v_name, withdrawn_reason = v_reason, updated_at = now()
     WHERE id = d.id;
    PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
    v_ends := true;
  ELSIF v_full AND p.dispute_lost_at IS NULL AND d.state = 'paid' AND d.total > (SELECT coalesce(sum(o.amount), 0)
      FROM club_sponsor_deal_payments o WHERE o.deal_id = d.id AND o.voided_at IS NULL AND o.returned_at IS NULL) THEN
    -- "They still owe it", or what else stands doesn't cover it: the invoice is owing again. A deal another payment already
    -- covers (paid again by cheque, a dispute won since) stays paid.
    PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
    UPDATE club_sponsor_deals SET state = 'invoiced', paid_on = NULL, receipt_emailed_at = NULL, updated_at = now() WHERE id = d.id;
    PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
    v_owing := true;
  END IF;
  RETURN jsonb_build_object('already', false, 'dealId', d.id, 'creditSeq', v_seq, 'endsDeal', v_ends, 'owingAgain', v_owing,
    'amount', r.amount, 'feePart', r.fee_part);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_refund_finish(uuid, uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_refund_finish(uuid, uuid, text, text, uuid, text) TO service_role;

-- ── 6. A dispute WON after a refund made in Stripe returned the money a second time: the refund now books ──────────────────
-- Called by the app after club_sponsor_card_dispute_won. Once only (the flag clears).
CREATE OR REPLACE FUNCTION public.club_sponsor_card_twice_settle(p_online_payment uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_op online_payments%ROWTYPE; p club_sponsor_deal_payments%ROWTYPE; x record; v_n integer := 0; v_day date;
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND OR v_op.flow <> 'sponsorship' THEN RAISE EXCEPTION 'Not a sponsorship payment'; END IF;
  PERFORM 1 FROM club_sponsor_deals WHERE id = v_op.sponsor_deal_id FOR UPDATE;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE online_payment_id = v_op.id FOR UPDATE;
  IF NOT FOUND OR p.dispute_lost_at IS NOT NULL THEN RETURN jsonb_build_object('settled', 0); END IF;
  FOR x IN SELECT id FROM club_sponsor_deal_refunds
            WHERE payment_id = p.id AND origin = 'stripe' AND status = 'succeeded' AND after_lost_dispute ORDER BY created_at FOR UPDATE LOOP
    UPDATE club_sponsor_deal_refunds SET after_lost_dispute = false WHERE id = x.id;
    v_day := club_sponsor_card_stripe_refund_lines(x.id, true);
    UPDATE club_sponsor_deal_refunds SET refunded_on = v_day WHERE id = x.id;
    v_n := v_n + 1;
  END LOOP;
  RETURN jsonb_build_object('settled', v_n, 'dealId', p.deal_id);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_twice_settle(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_twice_settle(uuid) TO service_role;

-- ── 7. A refund that bounces voids the fee line too (532's function; its one change is fee_refund_entry_id in the void) ─────────────
CREATE OR REPLACE FUNCTION public.club_sponsor_card_refund_failed(p_refund uuid, p_stripe_refund text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r club_sponsor_deal_refunds%ROWTYPE;
  d club_sponsor_deals%ROWTYPE;
  p club_sponsor_deal_payments%ROWTYPE;
  v_was text; v_paid numeric;
BEGIN
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_not_found'; END IF;
  SELECT * INTO d FROM club_sponsor_deals WHERE id = r.deal_id FOR UPDATE;
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund FOR UPDATE;
  IF r.status = 'failed' THEN RETURN jsonb_build_object('already', true, 'wasBooked', r.income_entry_id IS NOT NULL OR r.tax_entry_id IS NOT NULL OR r.fee_refund_entry_id IS NOT NULL); END IF;
  v_was := r.status;
  UPDATE accounting_entries SET status = 'void', void_reason = 'The refund didn''t reach the card', voided_at = now(), updated_at = now()
   WHERE id IN (r.income_entry_id, r.tax_entry_id, r.fee_refund_entry_id) AND status <> 'void';                         -- ▶ 542: fee_refund_entry_id
  UPDATE club_sponsor_deal_refunds SET status = 'failed', failed_at = now(), succeeded_at = NULL, refunded_on = NULL,
    stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), failure_reason = left(coalesce(nullif(btrim(p_reason), ''), 'failed'), 300)
   WHERE id = r.id;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = r.payment_id FOR UPDATE;
  IF p.returned_at IS NOT NULL AND p.dispute_lost_at IS NULL AND club_sponsor_card_returned(p.id) < p.amount - p.fee_charged - p.fee_tax THEN
    UPDATE club_sponsor_deal_payments SET returned_at = NULL WHERE id = p.id;
    IF d.state = 'invoiced' THEN
      SELECT coalesce(sum(amount), 0) INTO v_paid FROM club_sponsor_deal_payments WHERE deal_id = d.id AND voided_at IS NULL AND returned_at IS NULL;
      IF d.total IS NOT NULL AND v_paid >= d.total THEN
        PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
        UPDATE club_sponsor_deals SET state = 'paid', updated_at = now(),
          paid_on = (SELECT max(received_on) FROM club_sponsor_deal_payments WHERE deal_id = d.id AND voided_at IS NULL AND returned_at IS NULL)
         WHERE id = d.id;
        PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
      END IF;
    END IF;
  END IF;
  PERFORM club_sponsor_card_op_state(r.payment_id);
  RETURN jsonb_build_object('already', false, 'wasBooked', v_was = 'succeeded', 'dealId', r.deal_id,
    'dealEnded', v_was = 'succeeded' AND r.ends_deal AND d.state = 'withdrawn');
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_refund_failed(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_refund_failed(uuid, text, text) TO service_role;

-- ── 7b. A refund from the deal: owing again only when what stands no longer covers the invoice (534's function; changes marked) ──
-- 534 put a paid deal back to owing whenever the refunded payment came back in full, even when another payment covered the
-- invoice by itself (a sponsor who paid again while a dispute had the first, which the club then won and was told to refund).
CREATE OR REPLACE FUNCTION public.club_sponsor_card_refund_book(p_refund uuid, p_stripe_refund text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r        club_sponsor_deal_refunds%ROWTYPE;
  d        club_sponsor_deals%ROWTYPE;
  p        club_sponsor_deal_payments%ROWTYPE;
  v_day    date;
  v_number text;
  v_business text;
  v_ledger uuid;
  v_cat    uuid;
  v_income uuid;
  v_taxline uuid;
  v_seq    integer;
  v_full   boolean;
  v_ends   boolean;
  v_owing  boolean := false;                                                                                  -- ▶ 542
  c_item   constant uuid := '5b0d0528-0528-4c1b-8a50-7ea0507c0001';
BEGIN
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_not_found'; END IF;
  SELECT * INTO d FROM club_sponsor_deals WHERE id = r.deal_id FOR UPDATE;
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund FOR UPDATE;
  IF r.status = 'succeeded' THEN RETURN jsonb_build_object('already', true, 'dealId', r.deal_id, 'endsDeal', r.ends_deal); END IF;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = r.payment_id FOR UPDATE;

  v_day := club_sponsor_book_day(r.org_id, NULL);
  SELECT coalesce(d.business_name, s.name) INTO v_business FROM club_sponsors s WHERE s.id = d.sponsor_id;
  v_number := d.invoice_year::text || '-' || lpad(d.invoice_seq::text, 3, '0');
  v_ledger := club_general_ledger(r.org_id);
  SELECT category_id INTO v_cat FROM budget_items WHERE id = c_item;
  -- Every refund on a taxed invoice carries a credit note, even one whose tax rounds to $0.00 (/accounting 2026-11-23).
  IF coalesce(d.tax_amount, 0) > 0 THEN
    v_seq := coalesce((SELECT max(x.credit_seq) FROM club_sponsor_deal_refunds x WHERE x.deal_id = d.id), 0) + 1;
  END IF;
  IF r.amount - r.tax_part > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, budget_category_id, budget_item_id, payment_method, notes)
    VALUES (v_ledger, v_day, left('Refund to ' || coalesce(v_business, 'the sponsor') || ' · invoice ' || v_number, 200), r.amount - r.tax_part,
      'expense', 'posted', 'club_sponsorship', 'sponsorship_deal', d.id, r.created_by, v_cat, c_item, 'online_card', left(r.reason, 500))
    RETURNING id INTO v_income;
  END IF;
  IF r.tax_part > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes)
    VALUES (v_ledger, v_day, left('Refund to ' || coalesce(v_business, 'the sponsor') || ' · invoice ' || v_number || ' · credit note ' || v_number || '-C' || v_seq, 200), r.tax_part,
      'expense', 'posted', 'gst_hst_collected', 'sponsorship_deal', d.id, r.created_by, 'online_card', left(r.reason, 500))
    RETURNING id INTO v_taxline;
  END IF;
  UPDATE club_sponsor_deal_refunds SET status = 'succeeded', succeeded_at = now(), refunded_on = v_day, failed_at = NULL,
    failure_reason = NULL, stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), credit_seq = v_seq,
    income_entry_id = v_income, tax_entry_id = v_taxline
   WHERE id = r.id;

  -- Is every refundable dollar of this payment back on the card now? (Refunds that SUCCEEDED, this one included.)
  v_full := club_sponsor_card_returned(p.id) >= p.amount - p.fee_charged - p.fee_tax;
  IF v_full THEN UPDATE club_sponsor_deal_payments SET returned_at = coalesce(returned_at, now()) WHERE id = p.id; END IF;
  PERFORM club_sponsor_card_op_state(r.payment_id);
  -- The deal ends only when that was the last of its money: nothing else standing (a cheque never comes back by card).
  v_ends := v_full AND p.dispute_lost_at IS NULL AND NOT EXISTS (
    SELECT 1 FROM club_sponsor_deal_payments o WHERE o.deal_id = d.id AND o.id <> p.id AND o.voided_at IS NULL AND o.returned_at IS NULL);
  IF v_ends IS DISTINCT FROM r.ends_deal THEN UPDATE club_sponsor_deal_refunds SET ends_deal = v_ends WHERE id = r.id; END IF;
  IF v_ends AND d.state <> 'withdrawn' THEN
    PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
    UPDATE club_sponsor_deals SET state = 'withdrawn', paid_on = NULL, withdrawn_at = now(), withdrawn_by = r.created_by,
      withdrawn_by_name = r.created_by_name, withdrawn_reason = r.reason, updated_at = now()
     WHERE id = d.id;
    PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
  ELSIF v_full AND p.dispute_lost_at IS NULL AND d.state = 'paid' AND d.total > (SELECT coalesce(sum(o.amount), 0)     -- ▶ 542
      FROM club_sponsor_deal_payments o WHERE o.deal_id = d.id AND o.voided_at IS NULL AND o.returned_at IS NULL) THEN   -- ▶ 542
    -- Call (g): this payment came back in full, another stands: the invoice is owing again (as when a payment is voided).
    PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
    UPDATE club_sponsor_deals SET state = 'invoiced', paid_on = NULL, receipt_emailed_at = NULL, updated_at = now() WHERE id = d.id;
    PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
    v_owing := true;                                                                                          -- ▶ 542
  END IF;
  RETURN jsonb_build_object('already', false, 'dealId', d.id, 'endsDeal', v_ends, 'creditSeq', v_seq,
    'owingAgain', v_owing);                                                                                   -- ▶ 542
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_refund_book(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_refund_book(uuid, text) TO service_role;

-- ── 8. Two Needs-attention kinds for a refund made in Stripe (403's three indexes, plus these two kinds and their key) ─────────
-- sponsor_refund_to_finish: in the books, the club finishes it on the deal. sponsor_refund_twice: made after the sponsor's bank
-- already took the payment back. Both keyed on sponsorRefundId (the refund row), which also gives a sponsor's card_refund_failed
-- its one-open key (it carried none: checked 2026-11-26, no two open copies on dev or production).
DROP INDEX IF EXISTS public.notifications_user_needs_attention_idx;
CREATE INDEX notifications_user_needs_attention_idx
  ON public.notifications (user_id, event_type)
  WHERE cleared_at IS NULL
    AND event_type IN ('assistant_coach_approval_requested', 'card_dispute_lost', 'card_disputed', 'card_refund_failed',
                       'card_refund_still_enrolled', 'card_refund_unmatched',
                       'card_refund_whose', 'club_hand_back_asked', 'club_hand_back_unasked',
                       'club_payment_handed_off', 'club_schedule_review', 'debit_returned', 'debit_reversed',
                       'house_league_withdraw_request', 'online_payment_not_recorded', 'online_payment_over',
                       'payment_failed', 'payments_ending', 'payments_terms_changed', 'payouts_need_attention',
                       'sponsor_refund_to_finish', 'sponsor_refund_twice',
                       'team_coach_payment_reminder', 'team_money_sent',
                       'team_move_requested', 'team_no_show', 'team_request_filed', 'team_request_holding_payout');

DROP INDEX IF EXISTS public.notifications_org_needs_attention_idx;
CREATE INDEX notifications_org_needs_attention_idx
  ON public.notifications (org_id, event_type)
  WHERE cleared_at IS NULL
    AND event_type IN ('assistant_coach_approval_requested', 'card_dispute_lost', 'card_disputed', 'card_refund_failed',
                       'card_refund_still_enrolled', 'card_refund_unmatched',
                       'card_refund_whose', 'club_hand_back_asked', 'club_hand_back_unasked',
                       'club_payment_handed_off', 'club_schedule_review', 'debit_returned', 'debit_reversed',
                       'house_league_withdraw_request', 'online_payment_not_recorded', 'online_payment_over',
                       'payment_failed', 'payments_ending', 'payments_terms_changed', 'payouts_need_attention',
                       'sponsor_refund_to_finish', 'sponsor_refund_twice',
                       'team_coach_payment_reminder', 'team_money_sent',
                       'team_move_requested', 'team_no_show', 'team_request_filed', 'team_request_holding_payout');

DROP INDEX IF EXISTS public.notifications_one_open_online_payments_notice;
CREATE UNIQUE INDEX notifications_one_open_online_payments_notice
  ON public.notifications (org_id, user_id, event_type,
    (COALESCE(metadata->>'onlineDisputeId', metadata->>'stripeAccountId', metadata->>'onlinePaymentItemId',
              metadata->>'onlinePaymentId', metadata->>'unassignedRefundId', metadata->>'enrolledRefundId',
              metadata->>'unmatchedStripeRefundId', metadata->>'termsVersion', metadata->>'endingFor',
              metadata->>'sponsorRefundId')))
  WHERE cleared_at IS NULL
    AND event_type IN ('payouts_need_attention', 'online_payment_not_recorded', 'card_refund_failed',
                       'card_refund_whose', 'card_refund_still_enrolled', 'card_refund_unmatched',
                       'debit_returned', 'debit_reversed', 'card_disputed', 'card_dispute_lost', 'online_payment_over',
                       'payments_terms_changed', 'payments_ending', 'sponsor_refund_to_finish', 'sponsor_refund_twice');

COMMENT ON TABLE public.club_sponsor_deal_refunds IS
  'Board Ready Stage 6 Part 3b (mig 530) + Part A fixes (mig 542): a refund to the card of a sponsorship card payment. origin app = Refund on the deal (all of what is left or part of it, never the processing fee). origin stripe = made in the club''s own Stripe dashboard, recorded from Stripe''s event: its lines book by themselves on success, dated Stripe''s day; it can return the fee (fee_part), sponsorship first; the club finishes it (reason, credit note, outcome). A refund on a taxed invoice carries a credit-note number (credit_seq). Written only by the club_sponsor_card_* functions; the server stamps emailed_at, cancel_emailed_at, and Stripe''s id on a refund from the deal still pending.';

COMMIT;
