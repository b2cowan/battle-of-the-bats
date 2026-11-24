-- 530 — A sponsor pays by card, and the club refunds it (Board Ready Stage 6, Part 3b; round 2 tabs 1 and 2; Part 3's four
-- owner calls, 2026-11-23; the card-refund drawing, RULED 2026-11-23, all seven as recommended).
-- Plan: docs/projects/active/BOARD_READY_PLAN.md §5 Stage 6. Kickoff: BOARD_READY_STAGE6_P3B_KICKOFF_PROMPT.md.
--
-- What it adds:
--   1. A THIRD online-payment flow, 'sponsorship': one deal, card only, scope 'full'. Its own shape, its one-open-per-deal
--      index, and the guard's arm for it. Said out loud from the code (kickoff): the rail's shared functions send any flow
--      that isn't a house-league sign-up down the tournament-team path. The ones a sponsorship reaches are answered here —
--      the cost line (online_payment_cost_out: Stripe's extra, a dispute's fee) and its locks — and the landing and the
--      refunds are the sponsorship's own functions below. The tournament-only ones (online_payment_land, refund_open,
--      refund_land, over_left, dispute_apply, reverse) are never called for one: lib/online-payment-landing.ts answers a
--      sponsorship before each, and a unit test holds it.
--   2. On a deal: the card fee the SPONSOR paid and its GST/HST (round 2: "the fee is its own invoice row with the club's
--      GST/HST on it"), set only by the card landing, only on an invoice the card payment itself issues. Owner call (3): a
--      card payment on an invoice already issued is at the invoice total and the CLUB pays the fee — an issued invoice
--      never gains a fee line.
--   3. On a deal payment: the online payment it came from, the card, the fee (who paid it, its amount, and — when the
--      sponsor paid it — what was charged for it and its tax), and the fee's lines. A card payment is never voided: the
--      money moved, so it comes off only by a refund (the drawing's tab 1).
--   4. club_sponsor_deal_refunds: a refund to the card, all of what is left or part of it, never the fee (round 2 tab 1;
--      the drawing's tab 2). Its two lines reverse the payment's (the sponsorship and its GST/HST, in proportion, the last
--      taking the remainder); the fee lines never move (/accounting 2026-11-23). On a taxed invoice each refund carries a
--      credit note number (/accounting 2026-11-23: the club reduces the tax it collected only with a credit note). A full
--      refund of the deal's money ends the deal as Withdrawn (ask 3).
--   5. The platform word "Payment processing" under Sponsorship (a money-out item with a FIXED id, club-only as Club
--      sponsorship is: lib/coach-budget-item-tiers.ts) — the club's general book had no processing word (build prompt).
--   6. "Send the invoice" (round 1 tab 5): club_sponsor_deal_issue issues the invoice of a deal its business left at Form
--      received (an unfinished card payment), as choosing a cheque or e-transfer does.
--
-- Errors (the routes say each in words): SP001 the deal no longer takes this, SP002 nothing owing / nothing left to refund /
-- not found, SP003 a refund the payment can't take, SP004 money stands, SP005 a card payment page is open on the deal.

BEGIN;

-- ── 1. The flow ───────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.online_payments
  ADD COLUMN IF NOT EXISTS sponsor_deal_id uuid REFERENCES public.club_sponsor_deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sponsor_fee_tax numeric(10,2),
  ADD COLUMN IF NOT EXISTS sponsor_invoice jsonb;
COMMENT ON COLUMN public.online_payments.sponsor_deal_id IS
  'Board Ready Stage 6 Part 3b (mig 530): the sponsorship deal a flow = sponsorship payment pays. NULL on every other flow.';
COMMENT ON COLUMN public.online_payments.sponsor_fee_tax IS
  'The GST/HST on the processing fee when the sponsor paid the fee on a taxed deal (mig 530). It is part of base_amount (what the club keeps before its own costs), never of fee_amount, so Stripe''s standard cost still reads fee_amount less the application fee.';
COMMENT ON COLUMN public.online_payments.sponsor_invoice IS
  'A card payment that issues its deal''s invoice (mig 530; the business chose card before any invoice): the figures the page showed — { amount, taxKind, taxRate, tax, total, dueDays } — fixed when the page opened. NULL when the deal was already invoiced (then the club pays the fee, owner call (3)).';

ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_flow_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_flow_chk CHECK (flow IN ('tournament_team', 'league_signup', 'sponsorship'));
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_flow_shape_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_flow_shape_chk CHECK (
  (flow = 'tournament_team' AND season_id IS NULL AND signup_key IS NULL AND sponsor_deal_id IS NULL
     AND sponsor_fee_tax IS NULL AND sponsor_invoice IS NULL)
  OR (flow = 'league_signup' AND tournament_id IS NULL AND team_id IS NULL AND signup_key IS NOT NULL
     AND char_length(signup_key) BETWEEN 1 AND 64 AND scope = 'full' AND sponsor_deal_id IS NULL
     AND sponsor_fee_tax IS NULL AND sponsor_invoice IS NULL)
  -- A deal deleted later leaves its payment (SET NULL), as a deleted tournament does; the guard holds it at the open.
  OR (flow = 'sponsorship' AND tournament_id IS NULL AND team_id IS NULL AND season_id IS NULL AND signup_key IS NULL
     AND scope = 'full' AND rail = 'card'
     AND (sponsor_fee_tax IS NULL OR (sponsor_fee_tax >= 0 AND fee_payer = 'family'))
     AND (sponsor_invoice IS NULL OR jsonb_typeof(sponsor_invoice) = 'object')));
-- One payment page open per deal: the backstop under the pay route's own reuse-or-expire.
CREATE UNIQUE INDEX IF NOT EXISTS online_payments_one_open_per_deal ON public.online_payments(sponsor_deal_id)
  WHERE status = 'open' AND flow = 'sponsorship' AND sponsor_deal_id IS NOT NULL;

-- Mig 501's guard with the sponsorship arm (marked ▶ 530).
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
       OR NEW.stripe_fee_amount IS NOT NULL OR NEW.stripe_extra_entry_id IS NOT NULL
       OR NEW.dispute_fee_entry_id IS NOT NULL OR NEW.reversal_fee_entry_id IS NOT NULL THEN
      RAISE EXCEPTION 'An online payment starts open; Stripe''s answer records the rest.';
    END IF;
    IF (NEW.flow = 'tournament_team' AND (NEW.team_id IS NULL OR NEW.tournament_id IS NULL))
       OR (NEW.flow = 'league_signup' AND NEW.season_id IS NULL)
       OR (NEW.flow = 'sponsorship' AND NEW.sponsor_deal_id IS NULL) THEN             -- ▶ 530
      RAISE EXCEPTION 'An online payment opens on what it pays for.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.base_amount IS DISTINCT FROM OLD.base_amount OR NEW.fee_amount IS DISTINCT FROM OLD.fee_amount
     OR NEW.application_fee_amount IS DISTINCT FROM OLD.application_fee_amount
     OR NEW.stripe_fee_amount IS DISTINCT FROM OLD.stripe_fee_amount
     OR NEW.stripe_extra_entry_id IS DISTINCT FROM OLD.stripe_extra_entry_id
     OR NEW.dispute_fee_entry_id IS DISTINCT FROM OLD.dispute_fee_entry_id
     OR NEW.reversal_fee_entry_id IS DISTINCT FROM OLD.reversal_fee_entry_id
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
     OR NEW.sponsor_fee_tax IS DISTINCT FROM OLD.sponsor_fee_tax                                    -- ▶ 530
     OR NEW.sponsor_invoice IS DISTINCT FROM OLD.sponsor_invoice                                    -- ▶ 530
     OR (NEW.sponsor_deal_id IS DISTINCT FROM OLD.sponsor_deal_id AND NEW.sponsor_deal_id IS NOT NULL) -- ▶ 530
     OR (NEW.team_id IS DISTINCT FROM OLD.team_id AND NEW.team_id IS NOT NULL)
     OR (NEW.tournament_id IS DISTINCT FROM OLD.tournament_id AND NEW.tournament_id IS NOT NULL)
     OR (NEW.season_id IS DISTINCT FROM OLD.season_id AND NEW.season_id IS NOT NULL)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'open' AND NEW.status = 'expired')) THEN
    RAISE EXCEPTION 'An online payment changes only through its landing or its refund.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.online_payments_guard() FROM PUBLIC, anon, authenticated;

-- ── 5. The word "Payment processing" under Sponsorship (a fixed id: lib/club-sponsor-invoice.ts names it) ──
INSERT INTO public.budget_items (id, category_id, org_id, name, sort_order, is_default, is_misc, sports, direction, actual_source)
SELECT '5b0d0530-0530-4c1b-8a50-7ea0507c0001'::uuid, c.id, NULL, 'Payment processing', 30, true, false, NULL, 'out', 'typed'
  FROM public.budget_categories c
 WHERE c.org_id IS NULL AND c.name = 'Sponsorship'
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.budget_items WHERE id = '5b0d0530-0530-4c1b-8a50-7ea0507c0001') THEN
    RAISE EXCEPTION 'mig 530: the platform Sponsorship category was not found, so Payment processing was not added';
  END IF;
END $$;

-- ── 2. The deal: the card fee the sponsor paid ───────────────────────────────────────────────────────
ALTER TABLE public.club_sponsor_deals
  ADD COLUMN IF NOT EXISTS card_fee     numeric(10,2),
  ADD COLUMN IF NOT EXISTS card_fee_tax numeric(10,2);
ALTER TABLE public.club_sponsor_deals DROP CONSTRAINT IF EXISTS club_sponsor_deals_card_fee;
ALTER TABLE public.club_sponsor_deals ADD CONSTRAINT club_sponsor_deals_card_fee CHECK (
  (card_fee IS NULL OR (card_fee > 0 AND invoice_seq IS NOT NULL AND pay_method = 'card'))
  AND (card_fee_tax IS NULL OR (card_fee IS NOT NULL AND card_fee_tax >= 0)));
COMMENT ON COLUMN public.club_sponsor_deals.card_fee IS
  'The card processing fee the SPONSOR paid, a row of its own on the invoice (mig 530; round 2: the Payouts card''s "The sponsor pays it"). Only on an invoice its card payment issued (owner call (3)); included in total. Set only by club_sponsor_card_land.';
COMMENT ON COLUMN public.club_sponsor_deals.card_fee_tax IS
  'The club''s GST/HST on card_fee (mig 530), included in tax_amount and total. NULL with card_fee, or 0 on an untaxed deal.';

-- The money guard (mig 529's) also holds the card fee (▶ 530).
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
       SELECT 1 FROM club_sponsor_deal_payments p WHERE p.deal_id = OLD.id AND p.voided_at IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_deal_has_a_payment';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_money_guard() FROM PUBLIC, anon, authenticated;

-- ── 3. A deal payment by card ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.club_sponsor_deal_payments
  ADD COLUMN IF NOT EXISTS online_payment_id   uuid REFERENCES public.online_payments(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS card_brand          text,
  ADD COLUMN IF NOT EXISTS card_last4          text,
  ADD COLUMN IF NOT EXISTS fee_paid_by         text,
  ADD COLUMN IF NOT EXISTS fee_amount          numeric(10,2),
  ADD COLUMN IF NOT EXISTS fee_charged         numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_tax             numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_income_entry_id uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fee_cost_entry_id   uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL;
ALTER TABLE public.club_sponsor_deal_payments DROP CONSTRAINT IF EXISTS club_sponsor_deal_payments_card;
ALTER TABLE public.club_sponsor_deal_payments ADD CONSTRAINT club_sponsor_deal_payments_card CHECK (
  (online_payment_id IS NULL AND fee_paid_by IS NULL AND fee_amount IS NULL AND fee_charged = 0 AND fee_tax = 0)
  OR (online_payment_id IS NOT NULL AND method = 'card' AND fee_paid_by IN ('club', 'sponsor') AND fee_amount >= 0
      AND (fee_paid_by = 'sponsor' OR (fee_charged = 0 AND fee_tax = 0))
      AND fee_charged >= 0 AND fee_tax >= 0 AND fee_tax <= tax_part AND fee_charged + fee_tax < amount
      AND (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$')));
CREATE UNIQUE INDEX IF NOT EXISTS club_sponsor_deal_payments_online_uniq ON public.club_sponsor_deal_payments(online_payment_id)
  WHERE online_payment_id IS NOT NULL;
COMMENT ON COLUMN public.club_sponsor_deal_payments.online_payment_id IS
  'A card payment (mig 530): the online payment it landed from. Such a payment is never voided — it comes off only by a refund to the card.';
COMMENT ON COLUMN public.club_sponsor_deal_payments.fee_paid_by IS
  'Who paid the processing fee on a card payment: club (a Payment processing cost) or sponsor (charged on the invoice, booked both ways: income under Club sponsorship and the same cost).';
COMMENT ON COLUMN public.club_sponsor_deal_payments.fee_charged IS
  'The processing fee charged to the sponsor (before its tax), inside amount. 0 when the club paid the fee. A refund never returns it.';
COMMENT ON COLUMN public.club_sponsor_deal_payments.fee_tax IS
  'The GST/HST on fee_charged, inside tax_part. A refund never returns it (the fee''s consideration is kept; /accounting 2026-11-23).';

-- ── 4. Refunds to the card ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_sponsor_deal_refunds (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id           uuid NOT NULL REFERENCES public.club_sponsor_deals(id) ON DELETE CASCADE,
  payment_id        uuid NOT NULL REFERENCES public.club_sponsor_deal_payments(id) ON DELETE CASCADE,
  online_payment_id uuid NOT NULL REFERENCES public.online_payments(id) ON DELETE CASCADE,
  amount            numeric(10,2) NOT NULL CHECK (amount > 0),
  -- The GST/HST share of it (the sponsorship's tax only; the fee's tax never comes back).
  tax_part          numeric(10,2) NOT NULL DEFAULT 0 CHECK (tax_part >= 0 AND tax_part <= amount),
  -- "All of it" (what was left of the payment) or "Part of it".
  whole             boolean NOT NULL,
  -- It returns the last of the deal's money: when it succeeds, the deal ends as Withdrawn (ask 3).
  ends_deal         boolean NOT NULL DEFAULT false,
  reason            text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 300),
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  stripe_refund_id  text,
  failure_reason    text CHECK (failure_reason IS NULL OR char_length(failure_reason) <= 300),
  refunded_on       date,
  -- The credit note's number on its invoice ("2027-014-C1"), given when a refund on a taxed invoice succeeds.
  credit_seq        integer CHECK (credit_seq IS NULL OR credit_seq > 0),
  income_entry_id   uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  tax_entry_id      uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name   text NOT NULL CHECK (char_length(btrim(created_by_name)) BETWEEN 1 AND 120),
  created_at        timestamptz NOT NULL DEFAULT now(),
  succeeded_at      timestamptz,
  failed_at         timestamptz,
  emailed_at        timestamptz,
  CONSTRAINT club_sponsor_deal_refunds_succeeded CHECK ((succeeded_at IS NULL) = (refunded_on IS NULL)
    AND (status <> 'succeeded' OR succeeded_at IS NOT NULL) AND (status <> 'failed' OR failed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS club_sponsor_deal_refunds_deal_idx ON public.club_sponsor_deal_refunds (org_id, deal_id, created_at);
CREATE INDEX IF NOT EXISTS club_sponsor_deal_refunds_payment_idx ON public.club_sponsor_deal_refunds (payment_id);
CREATE UNIQUE INDEX IF NOT EXISTS club_sponsor_deal_refunds_stripe_uniq ON public.club_sponsor_deal_refunds (stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS club_sponsor_deal_refunds_credit_uniq ON public.club_sponsor_deal_refunds (deal_id, credit_seq) WHERE credit_seq IS NOT NULL;

ALTER TABLE public.club_sponsor_deal_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_sponsor_deal_refunds FROM PUBLIC, anon, authenticated, service_role;
-- no-service-role-grant: club_sponsor_deal_refunds — read-only to the server, plus two columns (the email's stamp, Stripe's id on a pending refund); every other write is a club_sponsor_card_refund_* function (SECURITY DEFINER)
GRANT SELECT ON public.club_sponsor_deal_refunds TO service_role;
GRANT UPDATE (emailed_at, stripe_refund_id) ON public.club_sponsor_deal_refunds TO service_role;
COMMENT ON TABLE public.club_sponsor_deal_refunds IS
  'Board Ready Stage 6 Part 3b (mig 530): a refund to the card of a sponsorship card payment — all of what is left or part of it, never the processing fee. Its two General-ledger lines reverse the payment''s in proportion; the fee lines never move. A refund on a taxed invoice carries a credit-note number (credit_seq). Written only by the club_sponsor_card_refund_* functions; the server stamps emailed_at, and Stripe''s id on a refund still pending.';

-- ── Shared pieces ─────────────────────────────────────────────────────────────────────────────────
-- A day the club's books still take: the given day, else today when it falls in a closed year (the landing's rule, mig 358).
CREATE OR REPLACE FUNCTION public.club_sponsor_book_day(p_org uuid, p_day date)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_today date := (now() AT TIME ZONE 'America/Toronto')::date; v_closed date := club_books_closed_through(p_org); v_day date := p_day;
BEGIN
  IF v_day IS NULL OR v_day > v_today THEN v_day := v_today; END IF;
  IF v_closed IS NOT NULL AND v_day <= v_closed THEN v_day := v_today; END IF;
  RETURN v_day;
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_book_day(uuid, date) FROM PUBLIC, anon, authenticated;

-- The next invoice number of a club's year (mig 526's counter). Called only inside the issuing functions.
CREATE OR REPLACE FUNCTION public.club_sponsor_invoice_next(p_org uuid, p_year integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seq integer;
BEGIN
  INSERT INTO club_sponsor_invoice_counters AS c (org_id, year, last_seq) VALUES (p_org, p_year, 1)
  ON CONFLICT (org_id, year) DO UPDATE SET last_seq = c.last_seq + 1
  RETURNING c.last_seq INTO v_seq;
  RETURN v_seq;
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_invoice_next(uuid, integer) FROM PUBLIC, anon, authenticated;

-- A money-out line on the club's general book under Sponsorship › Payment processing, opening its deal from the Ledger.
CREATE OR REPLACE FUNCTION public.club_sponsor_cost_out(p_org uuid, p_deal uuid, p_day date, p_description text, p_amount numeric, p_method text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid; v_id uuid; c_item constant uuid := '5b0d0530-0530-4c1b-8a50-7ea0507c0001';
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_day IS NULL THEN RAISE EXCEPTION 'A money-out line needs a positive amount and day'; END IF;
  SELECT category_id INTO v_cat FROM budget_items WHERE id = c_item;
  INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
    source_module, source_entity_id, created_by, budget_category_id, budget_item_id, payment_method)
  VALUES (club_general_ledger(p_org), p_day, left(p_description, 500), round(p_amount, 2), 'expense', 'posted', NULL,
    'sponsorship_deal', p_deal, NULL, v_cat, c_item, p_method)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_cost_out(uuid, uuid, date, text, numeric, text) FROM PUBLIC, anon, authenticated;

-- Mig 501's shared cost line, with the sponsorship's book (▶ 530): Stripe's extra and a dispute's fee on a sponsor's card
-- payment go on the club's general book under Sponsorship › Payment processing.
CREATE OR REPLACE FUNCTION public.online_payment_cost_out(p_op uuid, p_day date, p_description text, p_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_op public.online_payments%ROWTYPE; v_method text; v_day date := p_day;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date; v_closed date;
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_op;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  v_closed := club_books_closed_through(v_op.org_id);
  IF v_day IS NULL OR v_day > v_today THEN v_day := v_today; END IF;
  IF v_closed IS NOT NULL AND v_day <= v_closed THEN v_day := v_today; END IF;
  v_method := CASE WHEN v_op.rail = 'bank_debit' THEN 'online_bank' ELSE 'online_card' END;
  IF v_op.flow = 'league_signup' THEN
    RETURN online_payment_league_post_out(v_op.season_id, 'Payment processing', v_day, p_description, p_amount, v_op.id, NULL, v_method);
  END IF;
  IF v_op.flow = 'sponsorship' THEN                                                     -- ▶ 530
    RETURN club_sponsor_cost_out(v_op.org_id, v_op.sponsor_deal_id, v_day, p_description, p_amount, v_method);
  END IF;
  IF v_op.tournament_id IS NULL THEN RETURN NULL; END IF;
  IF NOT tournament_fee_book_on(v_op.tournament_id) THEN RETURN NULL; END IF;
  RETURN online_payment_post_out(v_op.tournament_id, 'Payment processing', v_day, p_description, p_amount, v_op.id, NULL, v_method);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_cost_out(uuid, date, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_cost_out(uuid, date, text, numeric) TO service_role;

-- Mig 501's locks, with the deal's (▶ 530): deal → payment, the order every writer of a deal's money takes.
CREATE OR REPLACE FUNCTION public.online_payment_lock_for_cost(p_op uuid)
RETURNS public.online_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_op public.online_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_op;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.tournament_id IS NOT NULL THEN PERFORM 1 FROM tournaments WHERE id = v_op.tournament_id FOR NO KEY UPDATE; END IF;
  IF v_op.team_id IS NOT NULL THEN PERFORM 1 FROM teams WHERE id = v_op.team_id FOR UPDATE; END IF;
  IF v_op.season_id IS NOT NULL THEN PERFORM 1 FROM league_seasons s WHERE s.id = v_op.season_id FOR NO KEY UPDATE; END IF;
  IF v_op.sponsor_deal_id IS NOT NULL THEN PERFORM 1 FROM club_sponsor_deals d WHERE d.id = v_op.sponsor_deal_id FOR UPDATE; END IF; -- ▶ 530
  SELECT * INTO v_op FROM online_payments WHERE id = p_op FOR UPDATE;
  RETURN v_op;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_lock_for_cost(uuid) FROM PUBLIC, anon, authenticated;

-- ── 6. Send the invoice ──────────────────────────────────────────────────────────────────────────
-- p_invoice: { year, issuedOn, dueOn, taxKind?, taxRate?, taxAmount?, total } — mig 526's shape, the figures fixed by the route.
CREATE OR REPLACE FUNCTION public.club_sponsor_deal_issue(p_org uuid, p_deal uuid, p_invoice jsonb)
RETURNS TABLE (state text, invoice_year integer, invoice_seq integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_deal club_sponsor_deals%ROWTYPE; v_year integer; v_seq integer;
BEGIN
  SELECT * INTO v_deal FROM club_sponsor_deals d WHERE d.id = p_deal AND d.org_id = p_org FOR UPDATE;
  IF NOT FOUND OR v_deal.state <> 'form_received' THEN
    RAISE EXCEPTION USING ERRCODE = 'SP001', MESSAGE = 'club_sponsor_deal_not_form_received';
  END IF;
  -- A card payment page still open on the deal could be paid after the invoice is out: the route closes it first.
  IF EXISTS (SELECT 1 FROM online_payments o WHERE o.sponsor_deal_id = p_deal AND o.flow = 'sponsorship' AND o.status = 'open') THEN
    RAISE EXCEPTION USING ERRCODE = 'SP005', MESSAGE = 'club_sponsor_deal_card_open';
  END IF;
  v_year := (p_invoice->>'year')::integer;
  v_seq := club_sponsor_invoice_next(p_org, v_year);
  UPDATE club_sponsor_deals d SET
    state = 'invoiced', pay_method = 'cheque_etransfer', invoice_year = v_year, invoice_seq = v_seq,
    invoiced_at = now(), invoiced_on = (p_invoice->>'issuedOn')::date, due_on = (p_invoice->>'dueOn')::date,
    tax_kind = nullif(p_invoice->>'taxKind', ''), tax_rate = nullif(p_invoice->>'taxRate', '')::numeric,
    tax_amount = nullif(p_invoice->>'taxAmount', '')::numeric, total = (p_invoice->>'total')::numeric, updated_at = now()
   WHERE d.id = p_deal;
  RETURN QUERY SELECT d.state, d.invoice_year, d.invoice_seq FROM club_sponsor_deals d WHERE d.id = p_deal;
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_deal_issue(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_deal_issue(uuid, uuid, jsonb) TO service_role;

-- ── The card landing ──────────────────────────────────────────────────────────────────────────────
-- Stripe says the card payment is paid: in ONE transaction, the invoice (when this payment issues it), the deal payment
-- with its lines — the sponsorship under Club sponsorship, the GST/HST collected, the fee the sponsor paid (income, its own
-- line) and the fee as a Payment processing cost (always: the club's cost, or the sponsor's booked both ways) — Paid when
-- nothing is left owing, and the online payment marked paid. Idempotent ("already" before and after the locks). Refuses
-- (an exception, so the landing records it "not recorded" for a person) a deal that can't take it.
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
    FROM club_sponsor_deal_payments WHERE deal_id = d.id AND voided_at IS NULL;
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

-- ── A card payment is never voided (the drawing's tab 1): mig 528's void, refusing one (▶ 530) ────────
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
  IF p.online_payment_id IS NOT NULL THEN                                                 -- ▶ 530
    RAISE EXCEPTION USING ERRCODE = 'SP004', MESSAGE = 'club_sponsor_card_payment_refund_only';
  END IF;
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

-- ── Refunds ──────────────────────────────────────────────────────────────────────────────────────
-- What a card payment can still give back: its amount less the fee the sponsor paid and its tax, less every refund not failed.
CREATE OR REPLACE FUNCTION public.club_sponsor_card_refund_left(p_payment uuid)
RETURNS TABLE (refundable numeric, money_left numeric, tax_left numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.amount - p.fee_charged - p.fee_tax,
         p.amount - p.fee_charged - p.fee_tax - coalesce((SELECT sum(r.amount) FROM club_sponsor_deal_refunds r WHERE r.payment_id = p.id AND r.status <> 'failed'), 0),
         p.tax_part - p.fee_tax - coalesce((SELECT sum(r.tax_part) FROM club_sponsor_deal_refunds r WHERE r.payment_id = p.id AND r.status <> 'failed'), 0)
    FROM club_sponsor_deal_payments p WHERE p.id = p_payment
$$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_refund_left(uuid) FROM PUBLIC, anon, authenticated;

-- Open a refund (before Stripe is asked): the payment's lock caps it at what is left. p_amount NULL = all of what is left.
-- Returns what the route asks Stripe with.
CREATE OR REPLACE FUNCTION public.club_sponsor_card_refund_open(
  p_org uuid, p_payment uuid, p_amount numeric, p_reason text, p_actor uuid, p_actor_name text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p        club_sponsor_deal_payments%ROWTYPE;
  v_op     online_payments%ROWTYPE;
  v_reason text := left(btrim(coalesce(p_reason, '')), 300);
  v_refundable numeric; v_left numeric; v_tax_left numeric; v_amount numeric; v_tax numeric := 0;
  v_whole  boolean; v_ends boolean; v_id uuid;
BEGIN
  IF v_reason = '' THEN RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_refund_needs_a_reason'; END IF;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = p_payment AND org_id = p_org;
  IF NOT FOUND OR p.online_payment_id IS NULL OR p.voided_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_not_a_card_payment';
  END IF;
  PERFORM 1 FROM club_sponsor_deals WHERE id = p.deal_id FOR UPDATE;
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = p_payment FOR UPDATE;
  SELECT * INTO v_op FROM online_payments WHERE id = p.online_payment_id;
  IF v_op.stripe_payment_intent_id IS NULL OR v_op.status NOT IN ('paid', 'partly_refunded') THEN
    RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_card_not_paid';
  END IF;
  SELECT l.refundable, l.money_left, l.tax_left INTO v_refundable, v_left, v_tax_left FROM club_sponsor_card_refund_left(p.id) l;
  IF v_left <= 0 THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_nothing_left'; END IF;
  v_amount := coalesce(p_amount, v_left);
  IF v_amount <= 0 OR v_amount <> round(v_amount, 2) OR v_amount > v_left THEN
    RAISE EXCEPTION USING ERRCODE = 'SP003', MESSAGE = 'club_sponsor_refund_amount';
  END IF;
  v_whole := v_amount = v_left;
  -- The tax share of the sponsorship part (never the fee's tax): in proportion, the refund that empties it taking the rest.
  IF v_tax_left > 0 THEN
    v_tax := CASE WHEN v_whole THEN v_tax_left ELSE round(v_amount * (p.tax_part - p.fee_tax) / v_refundable, 2) END;
    v_tax := greatest(0, least(v_tax, v_tax_left, v_amount));
  END IF;
  -- It ends the deal when it gives back the last of the deal's money: nothing left on this payment after it, and no other
  -- payment standing with money on it (a cheque never comes back by card; a card payment already given back counts for nothing).
  v_ends := v_whole AND NOT EXISTS (
    SELECT 1 FROM club_sponsor_deal_payments o
     WHERE o.deal_id = p.deal_id AND o.id <> p.id AND o.voided_at IS NULL
       AND (o.online_payment_id IS NULL OR (SELECT l.money_left FROM club_sponsor_card_refund_left(o.id) l) > 0));
  INSERT INTO club_sponsor_deal_refunds(org_id, deal_id, payment_id, online_payment_id, amount, tax_part, whole, ends_deal,
    reason, created_by, created_by_name)
  VALUES (p_org, p.deal_id, p.id, p.online_payment_id, v_amount, v_tax, v_whole, v_ends, v_reason, p_actor, left(btrim(p_actor_name), 120))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('refundId', v_id, 'amount', v_amount, 'taxPart', v_tax, 'endsDeal', v_ends, 'dealId', p.deal_id,
    'onlinePaymentId', v_op.id, 'stripeAccountId', v_op.stripe_account_id, 'paymentIntent', v_op.stripe_payment_intent_id);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_refund_open(uuid, uuid, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_refund_open(uuid, uuid, numeric, text, uuid, text) TO service_role;

-- The online payment's own state follows its refunds (refunded once nothing is left to give back).
CREATE OR REPLACE FUNCTION public.club_sponsor_card_op_state(p_payment uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p club_sponsor_deal_payments%ROWTYPE; v_left numeric; v_refundable numeric;
BEGIN
  SELECT * INTO p FROM club_sponsor_deal_payments WHERE id = p_payment;
  SELECT l.refundable, l.money_left INTO v_refundable, v_left FROM club_sponsor_card_refund_left(p.id) l;
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE online_payments SET updated_at = now(), status = CASE WHEN v_left <= 0 THEN 'refunded'
      WHEN v_left < v_refundable AND EXISTS (SELECT 1 FROM club_sponsor_deal_refunds r WHERE r.payment_id = p.id AND r.status = 'succeeded')
        THEN 'partly_refunded' ELSE 'paid' END
   WHERE id = p.online_payment_id AND status IN ('paid', 'partly_refunded', 'refunded');
  PERFORM set_config('flhq.online_payment_write', 'off', true);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_op_state(uuid) FROM PUBLIC, anon, authenticated;

-- Stripe accepted the refund: its two lines (the sponsorship and its GST/HST, out), the credit note's number on a taxed
-- invoice, and — when it gives back the last of the deal's money — the deal Withdrawn with the refund's reason (ask 3; the
-- place comes down when the route syncs it). Once only.
CREATE OR REPLACE FUNCTION public.club_sponsor_card_refund_book(p_refund uuid, p_stripe_refund text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r        club_sponsor_deal_refunds%ROWTYPE;
  d        club_sponsor_deals%ROWTYPE;
  v_day    date;
  v_number text;
  v_business text;
  v_ledger uuid;
  v_cat    uuid;
  v_income uuid;
  v_taxline uuid;
  v_seq    integer;
  c_item   constant uuid := '5b0d0528-0528-4c1b-8a50-7ea0507c0001';
BEGIN
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_not_found'; END IF;
  SELECT * INTO d FROM club_sponsor_deals WHERE id = r.deal_id FOR UPDATE;
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund FOR UPDATE;
  IF r.status = 'succeeded' THEN RETURN jsonb_build_object('already', true, 'dealId', r.deal_id, 'endsDeal', r.ends_deal); END IF;

  v_day := club_sponsor_book_day(r.org_id, NULL);
  SELECT coalesce(d.business_name, s.name) INTO v_business FROM club_sponsors s WHERE s.id = d.sponsor_id;
  v_number := d.invoice_year::text || '-' || lpad(d.invoice_seq::text, 3, '0');
  v_ledger := club_general_ledger(r.org_id);
  SELECT category_id INTO v_cat FROM budget_items WHERE id = c_item;
  IF r.amount - r.tax_part > 0 THEN
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, budget_category_id, budget_item_id, payment_method, notes)
    VALUES (v_ledger, v_day, left('Refund to ' || coalesce(v_business, 'the sponsor') || ' · invoice ' || v_number, 200), r.amount - r.tax_part,
      'expense', 'posted', 'club_sponsorship', 'sponsorship_deal', d.id, r.created_by, v_cat, c_item, 'online_card', left(r.reason, 500))
    RETURNING id INTO v_income;
  END IF;
  IF r.tax_part > 0 THEN
    v_seq := coalesce((SELECT max(x.credit_seq) FROM club_sponsor_deal_refunds x WHERE x.deal_id = d.id), 0) + 1;
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
  PERFORM club_sponsor_card_op_state(r.payment_id);
  IF r.ends_deal AND d.state <> 'withdrawn' THEN
    PERFORM set_config('flhq.sponsor_deal_money', 'on', true);
    UPDATE club_sponsor_deals SET state = 'withdrawn', paid_on = NULL, withdrawn_at = now(), withdrawn_by = r.created_by,
      withdrawn_by_name = r.created_by_name, withdrawn_reason = r.reason, updated_at = now()
     WHERE id = d.id;
    PERFORM set_config('flhq.sponsor_deal_money', 'off', true);
  END IF;
  RETURN jsonb_build_object('already', false, 'dealId', d.id, 'endsDeal', r.ends_deal, 'creditSeq', v_seq);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_refund_book(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_refund_book(uuid, text) TO service_role;

-- Stripe returned the refund ("Refund didn't reach the card"): a pending one simply failed (nothing was booked); one already
-- booked has its two lines voided, so the money reads as still with the club, and stays failed for the club to answer. The
-- deal is left as it stands (a deal it ended stays ended: the club decides).
CREATE OR REPLACE FUNCTION public.club_sponsor_card_refund_failed(p_refund uuid, p_stripe_refund text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r club_sponsor_deal_refunds%ROWTYPE; v_was text;
BEGIN
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'SP002', MESSAGE = 'club_sponsor_refund_not_found'; END IF;
  PERFORM 1 FROM club_sponsor_deals WHERE id = r.deal_id FOR UPDATE;
  SELECT * INTO r FROM club_sponsor_deal_refunds WHERE id = p_refund FOR UPDATE;
  IF r.status = 'failed' THEN RETURN jsonb_build_object('already', true, 'wasBooked', r.income_entry_id IS NOT NULL OR r.tax_entry_id IS NOT NULL); END IF;
  v_was := r.status;
  UPDATE accounting_entries SET status = 'void', void_reason = 'The refund didn''t reach the card', voided_at = now(), updated_at = now()
   WHERE id IN (r.income_entry_id, r.tax_entry_id) AND status <> 'void';
  UPDATE club_sponsor_deal_refunds SET status = 'failed', failed_at = now(), succeeded_at = NULL, refunded_on = NULL,
    stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), failure_reason = left(coalesce(nullif(btrim(p_reason), ''), 'failed'), 300)
   WHERE id = r.id;
  PERFORM club_sponsor_card_op_state(r.payment_id);
  RETURN jsonb_build_object('already', false, 'wasBooked', v_was = 'succeeded', 'dealId', r.deal_id);
END $$;
REVOKE ALL ON FUNCTION public.club_sponsor_card_refund_failed(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_sponsor_card_refund_failed(uuid, text, text) TO service_role;

COMMIT;
