-- 528 — A club records a sponsor's payment (Board Ready Stage 6, Part 3a; round 1 tabs 6 and 7; owner calls 2026-11-23).
-- Plan: docs/projects/active/BOARD_READY_PLAN.md §5 Stage 6. Build prompt: BOARD_READY_STAGE6_SPONSORSHIPS_BUILD_PROMPT.md Part 3.
--
-- What it adds:
--   1. On a deal: the revised invoice's day, when the invoice and the receipt were emailed, and the day it was paid in full.
--   2. The library's new word "Club sponsorship", an item under the existing Sponsorship category (round 1 tab 7: "a new
--      item … next to the coaches' Team sponsorship"). A platform row with a FIXED id the code names; the team-visibility
--      rule (lib/coach-budget-item-tiers.ts) keeps it off every team's picker — a team's sponsorships stay the team's
--      (2026-11-06).
--   3. club_sponsor_deal_payments: each cheque, e-transfer, cash or other payment recorded on an invoiced deal. Written
--      ONLY by the functions below (service_role reads); a wrong one is voided, never deleted (its ledger lines are marked
--      void with the reason, as bills and requests are).
--   4. club_sponsor_deal_pay — records one payment in ONE transaction: its two General-ledger lines (the sponsorship under
--      Sponsorship › Club sponsorship, the GST/HST under its own word "GST/HST collected", category key
--      'gst_hst_collected', no library word: the tax is the club's to pass on, not its income), the payment, and — when
--      nothing is left owing — the deal to Paid. A part payment splits in proportion (owner default 2026-11-23); the last
--      payment takes the remainder, so the two lines land exactly on the invoice.
--   5. club_sponsor_deal_payment_void — voids one payment and its lines with a reason; a paid deal goes back to Invoiced.
--   6. club_sponsor_deal_revise — the revised invoice (owner default 2026-11-23): an invoiced deal's amount and tax change,
--      the number kept, the revision's day stamped, only while no payment stands on it.
--   7. A guard on club_sponsor_deals: once a deal is invoiced, its money columns and its Paid state change only inside
--      those functions (a transaction-local flag, the online-payments pattern, mig 359), and a deal with a live payment
--      can't be withdrawn.
--
-- Errors (the routes say each in words): SP002 not owing (not invoiced, or a deal of another club), SP003 a payment the
-- invoice can't take (amount, day, method), SP004 money stands on the deal (void it first). A day in a closed fiscal
-- year is refused by accounting_entries_fiscal_lock (mig 318) as it always is.

BEGIN;

-- ── 1. The deal's new facts ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.club_sponsor_deals
  ADD COLUMN IF NOT EXISTS revised_on         date,
  ADD COLUMN IF NOT EXISTS invoice_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_on            date;
ALTER TABLE public.club_sponsor_deals
  DROP CONSTRAINT IF EXISTS club_sponsor_deals_paid_on,
  DROP CONSTRAINT IF EXISTS club_sponsor_deals_revised_invoiced;
ALTER TABLE public.club_sponsor_deals
  ADD CONSTRAINT club_sponsor_deals_paid_on CHECK ((state = 'paid') = (paid_on IS NOT NULL)),
  ADD CONSTRAINT club_sponsor_deals_revised_invoiced CHECK (revised_on IS NULL OR invoice_seq IS NOT NULL);

COMMENT ON COLUMN public.club_sponsor_deals.revised_on IS
  'The day the invoice''s amount or tax last changed after it was issued (the revised invoice; the number is kept). Set only by club_sponsor_deal_revise.';
COMMENT ON COLUMN public.club_sponsor_deals.invoice_emailed_at IS
  'When the invoice (or its latest revision) was emailed to the business. NULL: not emailed (the email failed; the link shows it). The history''s "invoice emailed".';
COMMENT ON COLUMN public.club_sponsor_deals.receipt_emailed_at IS
  'When the "Paid in full" receipt (the paid invoice) was emailed to the business.';
COMMENT ON COLUMN public.club_sponsor_deals.paid_on IS
  'The day the deal was paid in full: the latest live payment''s day. Set and cleared only by the payment functions; NOT NULL exactly when state = paid.';

-- ── 2. The library word "Club sponsorship" (a fixed id: lib/club-sponsor-invoice.ts names it) ─────────
INSERT INTO public.budget_items (id, category_id, org_id, name, sort_order, is_default, is_misc, sports, direction, actual_source)
SELECT '5b0d0528-0528-4c1b-8a50-7ea0507c0001'::uuid, c.id, NULL, 'Club sponsorship', 20, true, false, NULL, 'in', 'typed'
  FROM public.budget_categories c
 WHERE c.org_id IS NULL AND c.name = 'Sponsorship'
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.budget_items WHERE id = '5b0d0528-0528-4c1b-8a50-7ea0507c0001') THEN
    RAISE EXCEPTION 'mig 528: the platform Sponsorship category was not found, so Club sponsorship was not added';
  END IF;
END $$;

-- ── 3. The payments ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_sponsor_deal_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id         uuid NOT NULL REFERENCES public.club_sponsor_deals(id) ON DELETE CASCADE,
  amount          numeric(10,2) NOT NULL CHECK (amount > 0),
  -- The GST/HST share of it (0 on an untaxed invoice).
  tax_part        numeric(10,2) NOT NULL DEFAULT 0 CHECK (tax_part >= 0 AND tax_part <= amount),
  received_on     date NOT NULL,
  method          text NOT NULL CHECK (method IN ('etransfer', 'cash', 'cheque', 'card', 'other')),
  reference       text CHECK (reference IS NULL OR char_length(btrim(reference)) BETWEEN 1 AND 60),
  note            text CHECK (note IS NULL OR char_length(btrim(note)) BETWEEN 1 AND 300),
  -- Its lines in the club's General ledger (the sponsorship; the tax, when it carries some).
  income_entry_id uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  tax_entry_id    uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  recorded_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_by_name text NOT NULL CHECK (char_length(btrim(recorded_by_name)) BETWEEN 1 AND 120),
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  voided_at       timestamptz,
  voided_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  voided_by_name  text CHECK (voided_by_name IS NULL OR char_length(btrim(voided_by_name)) BETWEEN 1 AND 120),
  void_reason     text CHECK (void_reason IS NULL OR char_length(btrim(void_reason)) BETWEEN 1 AND 300),
  CONSTRAINT club_sponsor_deal_payments_void_whole CHECK (
    (voided_at IS NULL) = (voided_by_name IS NULL) AND (voided_at IS NULL) = (void_reason IS NULL))
);
CREATE INDEX IF NOT EXISTS club_sponsor_deal_payments_deal_idx ON public.club_sponsor_deal_payments (org_id, deal_id, received_on);

ALTER TABLE public.club_sponsor_deal_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_sponsor_deal_payments FROM PUBLIC, anon, authenticated, service_role;
-- Read-only to the server: every write is one of the functions below (they run as their owner).
-- no-service-role-grant: club_sponsor_deal_payments — read-only to the server by design; every write is club_sponsor_deal_pay / club_sponsor_deal_payment_void (SECURITY DEFINER)
GRANT SELECT ON public.club_sponsor_deal_payments TO service_role;

COMMENT ON TABLE public.club_sponsor_deal_payments IS
  'Board Ready Stage 6 Part 3a (mig 528): a cheque, e-transfer, cash or other payment a club recorded on an invoiced sponsorship deal, with its General-ledger lines. Written only by club_sponsor_deal_pay / club_sponsor_deal_payment_void; a wrong one is voided with a reason, never deleted. Service role reads only.';

-- ── 7. The guard (before the functions, which open it) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.club_sponsor_deal_money_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_open boolean := coalesce(current_setting('flhq.sponsor_deal_money', true), '') = 'on';
BEGIN
  IF v_open THEN RETURN NEW; END IF;
  -- Paid, and the day it was paid, are the payment functions' alone.
  IF NEW.state = 'paid' AND OLD.state <> 'paid' THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_paid_by_a_payment_only';
  END IF;
  IF NEW.paid_on IS DISTINCT FROM OLD.paid_on OR NEW.revised_on IS DISTINCT FROM OLD.revised_on THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_money_columns';
  END IF;
  -- An issued invoice's figures change only as a revision.
  IF OLD.state IN ('invoiced', 'paid') AND (
       NEW.amount IS DISTINCT FROM OLD.amount OR NEW.charge_tax IS DISTINCT FROM OLD.charge_tax
    OR NEW.total IS DISTINCT FROM OLD.total OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
    OR NEW.tax_rate IS DISTINCT FROM OLD.tax_rate OR NEW.tax_kind IS DISTINCT FROM OLD.tax_kind) THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_invoice_figures';
  END IF;
  -- A paid deal leaves Paid only through a void; a deal with money on it is never withdrawn.
  IF OLD.state = 'paid' AND NEW.state <> 'paid' THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_unpaid_by_a_void_only';
  END IF;
  IF NEW.state = 'withdrawn' AND OLD.state <> 'withdrawn' AND EXISTS (
       SELECT 1 FROM club_sponsor_deal_payments p WHERE p.deal_id = OLD.id AND p.voided_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_has_a_payment';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_money_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS club_sponsor_deals_money_guard ON public.club_sponsor_deals;
CREATE TRIGGER club_sponsor_deals_money_guard BEFORE UPDATE ON public.club_sponsor_deals
  FOR EACH ROW EXECUTE FUNCTION public.club_sponsor_deal_money_guard();

-- The words the ledger reads for "How" (round 2 ask 6: "E-transfer").
CREATE OR REPLACE FUNCTION public.club_sponsor_method_word(p_method text, p_reference text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_method WHEN 'etransfer' THEN 'E-transfer' WHEN 'cash' THEN 'Cash' WHEN 'cheque' THEN 'Cheque'
                       WHEN 'card' THEN 'Card' ELSE 'Other' END
         || coalesce(' ' || nullif(btrim(p_reference), ''), '')
$$;
REVOKE ALL ON FUNCTION public.club_sponsor_method_word(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_method_word(text, text) TO service_role;

-- ── 4. Record a payment ─────────────────────────────────────────────────────────────────────────────
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
    FROM club_sponsor_deal_payments WHERE deal_id = p_deal AND voided_at IS NULL;
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
      paid_on = (SELECT max(received_on) FROM club_sponsor_deal_payments WHERE deal_id = p_deal AND voided_at IS NULL)
     WHERE id = p_deal;
    v_state := 'paid';
  END IF;
  PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
  RETURN jsonb_build_object('payment_id', v_id, 'state', v_state);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_pay(uuid, uuid, numeric, date, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_deal_pay(uuid, uuid, numeric, date, text, text, text, uuid, text) TO service_role;

-- ── 5. Void a payment ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.club_sponsor_deal_payment_void(
  p_org uuid, p_payment uuid, p_reason text, p_actor uuid, p_actor_name text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p   club_sponsor_deal_payments%ROWTYPE;
  d   club_sponsor_deals%ROWTYPE;
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
BEGIN
  IF v_reason = '' THEN RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_void_needs_a_reason'; END IF;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = p_payment AND org_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_payment_not_found'; END IF;
  -- The deal first, then the payment (the lock order every writer of a deal's money takes).
  SELECT * INTO d FROM club_sponsor_deals WHERE id = p.deal_id AND org_id = p_org FOR UPDATE;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = p_payment FOR UPDATE;
  IF p.voided_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_payment_already_void'; END IF;

  PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
  UPDATE accounting_entries SET status = 'void', void_reason = left(v_reason, 500), voided_by = p_actor, voided_at = now(), updated_at = now()
   WHERE id IN (p.income_entry_id, p.tax_entry_id) AND status <> 'void';
  UPDATE club_sponsor_deal_payments SET voided_at = now(), voided_by = p_actor, voided_by_name = left(btrim(p_actor_name), 120), void_reason = v_reason
   WHERE id = p_payment;
  IF d.state = 'paid' THEN
    UPDATE club_sponsor_deals SET state = 'invoiced', paid_on = NULL, receipt_emailed_at = NULL, updated_at = now() WHERE id = d.id;
  END IF;
  PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
  RETURN jsonb_build_object('deal_id', d.id, 'state', CASE WHEN d.state = 'paid' THEN 'invoiced' ELSE d.state END);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_payment_void(uuid, uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_deal_payment_void(uuid, uuid, text, uuid, text) TO service_role;

-- ── 6. The revised invoice ──────────────────────────────────────────────────────────────────────────
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
  IF EXISTS (SELECT 1 FROM club_sponsor_deal_payments WHERE deal_id = p_deal AND voided_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_has_a_payment';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_total IS NULL OR p_on IS NULL
     OR round(p_amount + coalesce(p_tax_amount, 0), 2) <> p_total THEN
    RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_revision_refused';
  END IF;
  PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
  UPDATE club_sponsor_deals SET amount = p_amount, charge_tax = p_charge_tax, tax_kind = p_tax_kind, tax_rate = p_tax_rate,
    tax_amount = p_tax_amount, total = p_total, revised_on = p_on, invoice_emailed_at = NULL, updated_at = now()
   WHERE id = p_deal;
  PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_revise(uuid, uuid, numeric, boolean, text, numeric, numeric, numeric, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_deal_revise(uuid, uuid, numeric, boolean, text, numeric, numeric, numeric, date) TO service_role;

COMMIT;
