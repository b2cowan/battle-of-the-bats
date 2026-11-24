-- 533 — A payment that holds no money, said once more (Board Ready Stage 6, Part 3b, after the walk: the /simplify altitude review
-- of 2026-11-24). 531 and 532 made a card payment that was given back in full, or lost to a dispute, stop COUNTING toward its
-- invoice (club_sponsor_deal_payments.returned_at). Three places still asked only "was it voided?":
--   1. The deal's money guard refused Withdraw while any payment was not voided, so after a lost dispute the screen offered
--      Withdraw (it reads what holds money) and the database refused it: a sponsor who never pays left a deal that could be
--      neither withdrawn nor revised, and a card payment can never be voided.
--   2. club_sponsor_deal_revise refused a revision for the same reason.
--   3. club_sponsor_card_land took the deal's "paid on" day from every payment not voided, so a payment given back could set it.
-- And one gap of delivery: the correction email for a refund that did not reach the card (owner 2026-11-24: keep the credit
-- note, cancelled, and tell the business) was bound to the failure's own once-only moment, so a send that failed was never
-- tried again. It now has its own stamp, claimed and released as the refund email's is.
-- A NEW migration: 530, 531 and 532 are applied to dev and pending on production.

BEGIN;

ALTER TABLE public.club_sponsor_deal_refunds ADD COLUMN IF NOT EXISTS cancel_emailed_at timestamptz;
GRANT UPDATE (cancel_emailed_at) ON public.club_sponsor_deal_refunds TO service_role;
COMMENT ON COLUMN public.club_sponsor_deal_refunds.cancel_emailed_at IS
  'Mig 533: when the business was told that this refund did not reach the card and its credit note is cancelled. Claimed by the server before the send and released if the send fails, so a replay tries again and a sent one is never doubled.';

CREATE OR REPLACE FUNCTION public.club_sponsor_deal_money_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_open boolean := coalesce(current_setting('flhq.sponsor_deal_money', true), '') = 'on';
BEGIN
  IF v_open THEN RETURN NEW; END IF;
  IF NEW.state = 'paid' AND OLD.state <> 'paid' THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_paid_by_a_payment_only';
  END IF;
  IF NEW.paid_on IS DISTINCT FROM OLD.paid_on OR NEW.revised_on IS DISTINCT FROM OLD.revised_on
     OR NEW.original_amount IS DISTINCT FROM OLD.original_amount OR NEW.original_charge_tax IS DISTINCT FROM OLD.original_charge_tax
     OR NEW.original_tax_kind IS DISTINCT FROM OLD.original_tax_kind OR NEW.original_tax_rate IS DISTINCT FROM OLD.original_tax_rate
     OR NEW.original_tax_amount IS DISTINCT FROM OLD.original_tax_amount OR NEW.original_total IS DISTINCT FROM OLD.original_total
     OR NEW.card_fee IS DISTINCT FROM OLD.card_fee OR NEW.card_fee_tax IS DISTINCT FROM OLD.card_fee_tax THEN -- ▶ 530
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_money_columns';
  END IF;
  IF OLD.state IN ('invoiced', 'paid') AND (
       NEW.amount IS DISTINCT FROM OLD.amount OR NEW.charge_tax IS DISTINCT FROM OLD.charge_tax
    OR NEW.total IS DISTINCT FROM OLD.total OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
    OR NEW.tax_rate IS DISTINCT FROM OLD.tax_rate OR NEW.tax_kind IS DISTINCT FROM OLD.tax_kind) THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_invoice_figures';
  END IF;
  IF OLD.state = 'paid' AND NEW.state <> 'paid' THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_unpaid_by_a_void_only';
  END IF;
  IF NEW.state = 'withdrawn' AND OLD.state <> 'withdrawn' AND EXISTS (
       SELECT 1 FROM club_sponsor_deal_payments p WHERE p.deal_id = OLD.id AND p.voided_at IS NULL AND p.returned_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_has_a_payment';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_money_guard() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.club_sponsor_deal_revise(
  p_org uuid, p_deal uuid, p_amount numeric, p_charge_tax boolean, p_tax_kind text, p_tax_rate numeric,
  p_tax_amount numeric, p_total numeric, p_on date
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d club_sponsor_deals%ROWTYPE;
BEGIN
  SELECT * INTO d FROM club_sponsor_deals WHERE id = p_deal AND org_id = p_org FOR UPDATE;
  IF NOT FOUND OR d.state <> 'invoiced' THEN
    RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_deal_not_invoiced';
  END IF;
  IF EXISTS (SELECT 1 FROM club_sponsor_deal_payments WHERE deal_id = p_deal AND voided_at IS NULL AND returned_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_has_a_payment';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_total IS NULL OR p_on IS NULL
     OR round(p_amount + coalesce(p_tax_amount, 0), 2) <> p_total THEN
    RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_revision_refused';
  END IF;
  PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
  UPDATE club_sponsor_deals SET
    -- The first figures, kept the first time only: while the invoice was never revised, its figures ARE the first issue's.
    -- A second revision keeps them. An invoice revised before this migration has no first figures to keep (they were
    -- overwritten then), so it stays NULL rather than stamping its earlier revision as "first" (/review 2026-11-23).
    original_amount     = CASE WHEN d.revised_on IS NULL THEN d.amount     ELSE d.original_amount     END,
    original_charge_tax = CASE WHEN d.revised_on IS NULL THEN d.charge_tax ELSE d.original_charge_tax END,
    original_tax_kind   = CASE WHEN d.revised_on IS NULL THEN d.tax_kind   ELSE d.original_tax_kind   END,
    original_tax_rate   = CASE WHEN d.revised_on IS NULL THEN d.tax_rate   ELSE d.original_tax_rate   END,
    original_tax_amount = CASE WHEN d.revised_on IS NULL THEN d.tax_amount ELSE d.original_tax_amount END,
    original_total      = CASE WHEN d.revised_on IS NULL THEN d.total      ELSE d.original_total      END,
    amount = p_amount, charge_tax = p_charge_tax, tax_kind = p_tax_kind, tax_rate = p_tax_rate,
    tax_amount = p_tax_amount, total = p_total, revised_on = p_on, invoice_emailed_at = NULL, updated_at = now()
   WHERE id = p_deal;
  PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_revise(uuid, uuid, numeric, boolean, text, numeric, numeric, numeric, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_deal_revise(uuid, uuid, numeric, boolean, text, numeric, numeric, numeric, date) TO service_role;

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
      paid_on = (SELECT max(received_on) FROM club_sponsor_deal_payments WHERE deal_id = d.id AND voided_at IS NULL AND returned_at IS NULL)
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

COMMIT;
