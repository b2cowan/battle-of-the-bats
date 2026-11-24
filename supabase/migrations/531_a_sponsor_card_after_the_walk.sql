-- 531 — The sponsor card payment, after the walk (Board Ready Stage 6, Part 3b; walk §564 owner calls, 2026-11-24; the list
-- is docs/projects/active/BOARD_READY_STAGE6_P3B_AFTER_WALK_FIXES_PROMPT.md items 2, 4, 5, 7 and walk call (g)).
-- A NEW migration, not an edit of 530: 530 is applied to dev and pending on production (owner, 2026-11-24).
--
-- What it changes:
--   1. (item 2) club_sponsor_card_unlanded_refunded: a card payment that arrived but could not be recorded ("not recorded",
--      landed_at empty) and was then given back IN FULL from the club's own Stripe dashboard is marked refunded, so it stops
--      wedging the deal. Until now it stayed "paid" with nothing landed forever, the notices never cleared, and Withdraw was
--      the only way out. A part refund of it is left to the notice (the money is neither recorded nor gone).
--   2. (item 4, call (g)) A deal ends when a refund BOOKS and gives back the last of the deal's money, decided then, under
--      the deal's lock, from refunds that actually succeeded — not forecast when the refund opened. And when a card payment
--      is given back in full but another payment stands (a cheque), the deal goes back to Invoiced and the money returned
--      is owing again: a card payment given back in full (`returned_at`) no longer counts toward the invoice.
--   3. (item 5) club_sponsor_deal_payments.online_payment_id is NO ACTION like every other key into online_payments (530
--      made it RESTRICT, which is checked at once and can block deleting an organization).
--   4. (item 7) Credit notes: every refund on a TAXED invoice carries a credit note number, even one so small its tax rounds
--      to $0.00 (/accounting 2026-11-23). A number given to a refund that later failed stays on record — the note is kept,
--      marked cancelled, rather than the number being reused.

BEGIN;

-- ── 1. A card payment given back in full stops counting toward the invoice ────────────────────────────
ALTER TABLE public.club_sponsor_deal_payments ADD COLUMN IF NOT EXISTS returned_at timestamptz;
COMMENT ON COLUMN public.club_sponsor_deal_payments.returned_at IS
  'A card payment (mig 531): when every refundable dollar of it had gone back to the card (refunds that succeeded). It stops counting toward the invoice then (the money is owing again); the fee the sponsor paid is never returned. Cleared if a booked refund later fails.';

-- ── 2. The online payment key: NO ACTION, like the rest ───────────────────────────────────────────────
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.club_sponsor_deal_payments'::regclass AND confrelid = 'public.online_payments'::regclass AND contype = 'f';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.club_sponsor_deal_payments DROP CONSTRAINT %I', c); END IF;
  ALTER TABLE public.club_sponsor_deal_payments
    ADD CONSTRAINT club_sponsor_deal_payments_online_payment_id_fkey FOREIGN KEY (online_payment_id) REFERENCES public.online_payments(id);
END $$;

-- ── 3. What has really gone back to the card on a payment ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.club_sponsor_card_returned(p_payment uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(r.amount), 0) FROM club_sponsor_deal_refunds r WHERE r.payment_id = p_payment AND r.status = 'succeeded'
$$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_returned(uuid) FROM PUBLIC, anon, authenticated;

-- ── 4. Landing a card payment and recording a cheque: a payment given back in full does not count ─────
-- (club_sponsor_card_land: 530's function, its one change: a payment given back in full no longer counts as paid.)
CREATE OR REPLACE FUNCTION public.club_sponsor_card_land(
  p_online_payment uuid, p_paid_at timestamptz, p_payment_intent text, p_charge text, p_brand text, p_last4 text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op       online_payments%ROWTYPE;
  d          club_sponsor_deals%ROWTYPE;
  v_plan     jsonb;
  v_day      date;
  v_year     integer;
  v_seq      integer;
  v_paid     numeric;
  v_tax_paid numeric;
  v_owing    numeric;
  v_amount   numeric;
  v_tax      numeric := 0;
  v_fee_in   numeric := 0;
  v_fee_tax  numeric := 0;
  v_business text;
  v_number   text;
  v_ledger   uuid;
  v_cat      uuid;
  v_income   uuid;
  v_taxline  uuid;
  v_feeline  uuid;
  v_cost     uuid;
  v_id       uuid;
  v_state    text := 'invoiced';
  v_receipt  bigint;
  c_item     constant uuid := '5b0d0528-0528-4c1b-8a50-7ea0507c0001';
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.flow <> 'sponsorship' THEN RAISE EXCEPTION 'Not a sponsorship payment'; END IF;
  IF v_op.landed_at IS NOT NULL OR v_op.status IN ('partly_refunded', 'refunded') THEN
    RETURN jsonb_build_object('already', true, 'dealId', v_op.sponsor_deal_id);
  END IF;
  IF v_op.sponsor_deal_id IS NULL THEN RAISE EXCEPTION 'The sponsorship deal is gone.'; END IF;
  -- Lock order: the deal, then this payment.
  SELECT * INTO d FROM club_sponsor_deals WHERE id = v_op.sponsor_deal_id AND org_id = v_op.org_id FOR UPDATE;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;
  IF v_op.landed_at IS NOT NULL OR v_op.status IN ('partly_refunded', 'refunded') THEN
    RETURN jsonb_build_object('already', true, 'dealId', v_op.sponsor_deal_id);
  END IF;
  IF d.state = 'withdrawn' THEN RAISE EXCEPTION 'The deal was withdrawn before the card payment arrived.'; END IF;

  v_day := club_sponsor_book_day(v_op.org_id, (p_paid_at AT TIME ZONE 'America/Toronto')::date);
  v_plan := v_op.sponsor_invoice;
  PERFORM set_config('flhq.sponsor_deal_money', 'on', true);

  IF v_plan IS NOT NULL THEN
    -- This payment issues the invoice (the business chose card before any invoice): at the figures its page showed.
    IF d.state NOT IN ('offered', 'form_received') THEN
      RAISE EXCEPTION 'The deal was invoiced another way while the card payment was open.';
    END IF;
    v_year := extract(year FROM v_day)::integer;
    v_seq := club_sponsor_invoice_next(v_op.org_id, v_year);
    IF v_op.fee_payer = 'family' THEN
      v_fee_in := v_op.fee_amount;
      v_fee_tax := coalesce(v_op.sponsor_fee_tax, 0);
    END IF;
    UPDATE club_sponsor_deals SET
      state = 'invoiced', pay_method = 'card', invoice_year = v_year, invoice_seq = v_seq, invoiced_at = now(),
      invoiced_on = v_day, due_on = v_day + coalesce((v_plan->>'dueDays')::integer, 0),
      amount = (v_plan->>'amount')::numeric,
      tax_kind = nullif(v_plan->>'taxKind', ''), tax_rate = nullif(v_plan->>'taxRate', '')::numeric,
      tax_amount = CASE WHEN nullif(v_plan->>'taxKind', '') IS NULL THEN NULL ELSE (v_plan->>'tax')::numeric + v_fee_tax END,
      card_fee = nullif(v_fee_in, 0), card_fee_tax = CASE WHEN v_fee_in > 0 THEN v_fee_tax END,
      total = v_op.total_amount, updated_at = now()
     WHERE id = d.id;
    SELECT * INTO d FROM club_sponsor_deals WHERE id = d.id;
    v_amount := v_op.total_amount;
  ELSE
    -- An invoice already issued: the card pays (part of) what is owing, at the invoice total; the club pays the fee.
    IF d.state <> 'invoiced' OR d.total IS NULL THEN RAISE EXCEPTION 'The deal has nothing owing on its invoice.'; END IF;
    v_amount := v_op.base_amount;
  END IF;

  SELECT coalesce(sum(amount), 0), coalesce(sum(tax_part), 0) INTO v_paid, v_tax_paid
    FROM club_sponsor_deal_payments WHERE deal_id = d.id AND voided_at IS NULL AND returned_at IS NULL;
  v_owing := d.total - v_paid;
  IF v_amount > v_owing THEN RAISE EXCEPTION 'The card paid % but only % is owing.', v_amount, v_owing; END IF;
  -- The tax share: mig 528's rule (in proportion; the payment that clears the invoice takes what is left).
  IF coalesce(d.tax_amount, 0) > 0 THEN
    v_tax := CASE WHEN v_amount = v_owing THEN d.tax_amount - v_tax_paid ELSE round(v_amount * d.tax_amount / d.total, 2) END;
    v_tax := greatest(0, least(v_tax, d.tax_amount - v_tax_paid, v_amount));
  END IF;

  SELECT coalesce(d.business_name, s.name) INTO v_business FROM club_sponsors s WHERE s.id = d.sponsor_id;
  v_number := d.invoice_year::text || '-' || lpad(d.invoice_seq::text, 3, '0');
  v_ledger := club_general_ledger(v_op.org_id);
  SELECT category_id INTO v_cat FROM budget_items WHERE id = c_item;

  IF v_amount - v_tax - v_fee_in > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, budget_category_id, budget_item_id, payment_method, notes)
    VALUES (v_ledger, v_day,
      left(coalesce(v_business, 'Sponsor') || ' · ' || d.package_name || coalesce(', ' || nullif(d.target_name, ''), ''), 200),
      v_amount - v_tax - v_fee_in, 'income', 'posted', 'club_sponsorship', 'sponsorship_deal', d.id, NULL, v_cat, c_item,
      'online_card', 'Invoice ' || v_number)
    RETURNING id INTO v_income;
  END IF;
  IF v_fee_in > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, budget_category_id, budget_item_id, payment_method, notes)
    VALUES (v_ledger, v_day, left('Processing fee charged to ' || coalesce(v_business, 'the sponsor'), 200), v_fee_in, 'income',
      'posted', 'club_sponsorship', 'sponsorship_deal', d.id, NULL, v_cat, c_item, 'online_card', 'Invoice ' || v_number)
    RETURNING id INTO v_feeline;
  END IF;
  IF v_tax > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes)
    VALUES (v_ledger, v_day, coalesce(d.tax_kind, 'GST/HST') || ' on invoice ' || v_number, v_tax, 'income', 'posted',
      'gst_hst_collected', 'sponsorship_deal', d.id, NULL, 'online_card', 'Invoice ' || v_number)
    RETURNING id INTO v_taxline;
  END IF;
  IF v_op.fee_amount > 0 THEN
    v_cost := club_sponsor_cost_out(v_op.org_id, d.id, v_day, 'Card processing fee · invoice ' || v_number, v_op.fee_amount, 'online_card');
  END IF;

  INSERT INTO club_sponsor_deal_payments(org_id, deal_id, amount, tax_part, received_on, method, reference, note,
    income_entry_id, tax_entry_id, recorded_by, recorded_by_name, online_payment_id, card_brand, card_last4,
    fee_paid_by, fee_amount, fee_charged, fee_tax, fee_income_entry_id, fee_cost_entry_id)
  VALUES (v_op.org_id, d.id, v_amount, v_tax, v_day, 'card', NULL, NULL, v_income, v_taxline, NULL, 'Paid by card',
    v_op.id, coalesce(p_brand, v_op.card_brand), coalesce(p_last4, v_op.card_last4),
    CASE WHEN v_op.fee_payer = 'family' THEN 'sponsor' ELSE 'club' END, v_op.fee_amount, v_fee_in, v_fee_tax, v_feeline, v_cost)
  RETURNING id INTO v_id;

  IF v_amount = v_owing THEN
    UPDATE club_sponsor_deals SET state = 'paid', updated_at = now(),
      paid_on = (SELECT max(received_on) FROM club_sponsor_deal_payments WHERE deal_id = d.id AND voided_at IS NULL)
     WHERE id = d.id;
    v_state := 'paid';
  END IF;
  PERFORM set_config('flhq.sponsor_deal_money', 'off', true);

  v_receipt := coalesce(v_op.receipt_no, nextval('online_payment_receipt_seq'));
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE online_payments SET status = 'paid', paid_at = p_paid_at, paid_on = v_day, landed_at = now(), land_error = NULL,
    stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
    stripe_charge_id = coalesce(p_charge, stripe_charge_id), card_brand = coalesce(p_brand, card_brand),
    card_last4 = coalesce(p_last4, card_last4), receipt_no = v_receipt, processing_cost_entry_id = v_cost, updated_at = now()
  WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN jsonb_build_object('already', false, 'dealId', d.id, 'paymentId', v_id, 'state', v_state, 'issued', v_plan IS NOT NULL);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_land(uuid, timestamptz, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_land(uuid, timestamptz, text, text, text, text) TO service_role;

-- (club_sponsor_deal_pay: 528's function, its two changes: the same.)
CREATE OR REPLACE FUNCTION public.club_sponsor_deal_pay(
  p_org uuid, p_deal uuid, p_amount numeric, p_on date, p_method text, p_reference text, p_note text,
  p_actor uuid, p_actor_name text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  d          club_sponsor_deals%ROWTYPE;
  v_business text;
  v_number   text;
  v_paid     numeric;
  v_tax_paid numeric;
  v_owing    numeric;
  v_tax      numeric := 0;
  v_ledger   uuid;
  v_cat      uuid;
  v_how      text;
  v_income   uuid;
  v_taxline  uuid;
  v_id       uuid;
  v_state    text;
  c_item     constant uuid := '5b0d0528-0528-4c1b-8a50-7ea0507c0001';
BEGIN
  SELECT * INTO d FROM club_sponsor_deals WHERE id = p_deal AND org_id = p_org FOR UPDATE;
  IF NOT FOUND OR d.state <> 'invoiced' OR d.total IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_deal_not_owing';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 2) OR p_on IS NULL
     OR p_method NOT IN ('etransfer', 'cash', 'cheque', 'card', 'other') THEN
    RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_payment_refused';
  END IF;
  SELECT coalesce(sum(amount), 0), coalesce(sum(tax_part), 0) INTO v_paid, v_tax_paid
    FROM club_sponsor_deal_payments WHERE deal_id = p_deal AND voided_at IS NULL AND returned_at IS NULL;
  v_owing := d.total - v_paid;
  IF p_amount > v_owing THEN
    RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_payment_over';
  END IF;
  -- The tax share: in proportion, the last payment taking what is left (so the lines land on the invoice exactly).
  IF coalesce(d.tax_amount, 0) > 0 THEN
    v_tax := CASE WHEN p_amount = v_owing THEN d.tax_amount - v_tax_paid
                  ELSE round(p_amount * d.tax_amount / d.total, 2) END;
    v_tax := greatest(0, least(v_tax, d.tax_amount - v_tax_paid, p_amount));
  END IF;

  SELECT coalesce(d.business_name, s.name) INTO v_business FROM club_sponsors s WHERE s.id = d.sponsor_id;
  v_number := d.invoice_year::text || '-' || lpad(d.invoice_seq::text, 3, '0');
  v_ledger := club_general_ledger(p_org);
  SELECT category_id INTO v_cat FROM budget_items WHERE id = c_item;
  v_how := club_sponsor_method_word(p_method, p_reference);

  PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
  IF p_amount - v_tax > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, budget_category_id, budget_item_id, payment_method, notes)
    VALUES (v_ledger, p_on,
      left(coalesce(v_business, 'Sponsor') || ' · ' || d.package_name || coalesce(', ' || nullif(d.target_name, ''), ''), 200),
      p_amount - v_tax, 'income', 'posted', 'club_sponsorship', 'sponsorship_deal', p_deal, p_actor, v_cat, c_item,
      v_how, 'Invoice ' || v_number)
    RETURNING id INTO v_income;
  END IF;
  IF v_tax > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes)
    VALUES (v_ledger, p_on, coalesce(d.tax_kind, 'GST/HST') || ' on invoice ' || v_number, v_tax, 'income', 'posted',
      'gst_hst_collected', 'sponsorship_deal', p_deal, p_actor, v_how, 'Invoice ' || v_number)
    RETURNING id INTO v_taxline;
  END IF;
  INSERT INTO club_sponsor_deal_payments(org_id, deal_id, amount, tax_part, received_on, method, reference, note,
    income_entry_id, tax_entry_id, recorded_by, recorded_by_name)
  VALUES (p_org, p_deal, p_amount, v_tax, p_on, p_method, nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''),
    v_income, v_taxline, p_actor, left(btrim(p_actor_name), 120))
  RETURNING id INTO v_id;

  v_state := 'invoiced';
  IF p_amount = v_owing THEN
    UPDATE club_sponsor_deals SET state = 'paid', updated_at = now(),
      paid_on = (SELECT max(received_on) FROM club_sponsor_deal_payments WHERE deal_id = p_deal AND voided_at IS NULL AND returned_at IS NULL)
     WHERE id = p_deal;
    v_state := 'paid';
  END IF;
  PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
  RETURN jsonb_build_object('payment_id', v_id, 'state', v_state);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_pay(uuid, uuid, numeric, date, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_deal_pay(uuid, uuid, numeric, date, text, text, text, uuid, text) TO service_role;

-- ── 5. Booking a refund (item 4, call (g), item 7) ────────────────────────────────────────────────────
-- Stripe accepted the refund: its two lines (the sponsorship and its GST/HST, out), the credit note's number on a taxed
-- invoice, whether it gave back the last of the deal's money NOW (then the deal is Withdrawn with the refund's reason), and,
-- when a payment is given back in full while another still stands, the deal owing again. Once only.
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
  v_ends := v_full AND NOT EXISTS (
    SELECT 1 FROM club_sponsor_deal_payments o WHERE o.deal_id = d.id AND o.id <> p.id AND o.voided_at IS NULL AND o.returned_at IS NULL);
  IF v_ends IS DISTINCT FROM r.ends_deal THEN UPDATE club_sponsor_deal_refunds SET ends_deal = v_ends WHERE id = r.id; END IF;
  IF v_ends AND d.state <> 'withdrawn' THEN
    PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
    UPDATE club_sponsor_deals SET state = 'withdrawn', paid_on = NULL, withdrawn_at = now(), withdrawn_by = r.created_by,
      withdrawn_by_name = r.created_by_name, withdrawn_reason = r.reason, updated_at = now()
     WHERE id = d.id;
    PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
  ELSIF v_full AND d.state = 'paid' THEN
    -- Call (g): this payment came back in full, another stands: the invoice is owing again (as when a payment is voided).
    PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
    UPDATE club_sponsor_deals SET state = 'invoiced', paid_on = NULL, receipt_emailed_at = NULL, updated_at = now() WHERE id = d.id;
    PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
  END IF;
  RETURN jsonb_build_object('already', false, 'dealId', d.id, 'endsDeal', v_ends, 'creditSeq', v_seq,
    'owingAgain', v_full AND NOT v_ends AND d.state = 'paid');
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_refund_book(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_refund_book(uuid, text) TO service_role;

-- ── 6. A refund Stripe returned ("Refund didn't reach the card") ──────────────────────────────────────
-- A pending one simply failed (nothing was booked); one already booked has its two lines voided, so the money reads as
-- still with the club. Its credit-note number stays on record (the note is kept, marked cancelled). The payment stops
-- being "given back in full"; a deal that went back to owing because of it is Paid again when the money covers the invoice.
-- A deal the refund ENDED stays ended (the club decides), and the answer says so, so the club is told.
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
  IF r.status = 'failed' THEN RETURN jsonb_build_object('already', true, 'wasBooked', r.income_entry_id IS NOT NULL OR r.tax_entry_id IS NOT NULL); END IF;
  v_was := r.status;
  UPDATE accounting_entries SET status = 'void', void_reason = 'The refund didn''t reach the card', voided_at = now(), updated_at = now()
   WHERE id IN (r.income_entry_id, r.tax_entry_id) AND status <> 'void';
  UPDATE club_sponsor_deal_refunds SET status = 'failed', failed_at = now(), succeeded_at = NULL, refunded_on = NULL,
    stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), failure_reason = left(coalesce(nullif(btrim(p_reason), ''), 'failed'), 300)
   WHERE id = r.id;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = r.payment_id FOR UPDATE;
  IF p.returned_at IS NOT NULL AND club_sponsor_card_returned(p.id) < p.amount - p.fee_charged - p.fee_tax THEN
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

-- ── 7. A payment that could not be recorded and was given back in full from the club's own Stripe dashboard ──
-- Returns handled=false for anything else (a payment that landed, one still open, a part refund): the caller raises its notice.
CREATE OR REPLACE FUNCTION public.club_sponsor_card_unlanded_refunded(p_online_payment uuid, p_refunded numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_op online_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;
  IF NOT FOUND OR v_op.flow <> 'sponsorship' OR v_op.landed_at IS NOT NULL OR v_op.status <> 'paid'
     OR p_refunded IS NULL OR p_refunded < v_op.total_amount THEN
    RETURN jsonb_build_object('handled', false);
  END IF;
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE online_payments SET status = 'refunded', updated_at = now() WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN jsonb_build_object('handled', true, 'dealId', v_op.sponsor_deal_id);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_unlanded_refunded(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_unlanded_refunded(uuid, numeric) TO service_role;

COMMIT;
