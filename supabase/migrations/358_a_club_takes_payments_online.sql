-- ---------------------------------------------------------------
-- Migration 358 — Club Tier Stage 12a: a club takes payments online, and a tournament team pays its entry by card.
-- Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md (rulings §0b, §0c); schema review
-- docs/projects/active/CLUB_TIER_STAGE12A_SCHEMA_REVIEW.md (/dba, 2026-10-25, every FIX taken).
--
-- WHY: a club connects its OWN Stripe account (direct charges; FieldLogicHQ never holds the money) and a team pays its
-- deposit or its entry by card. The money is ONE online-payment record that lands through the tournament's own writer
-- (tournament_team_payment_record, mig 345) — never a second money writer — so the team's paid figure, its payment rows
-- and the tournament's book behave exactly as a hand-recorded payment does.
--
-- WHAT CHANGES:
--   1. org_payment_accounts — the club's connected account (one per org): Stripe's facts, who pays the fee (A14), the
--      refund-policy sentence (A9), who agreed to the payments terms and when.
--   2. online_payments — one per Checkout: what it paid for, base / fee / total, the rate used, Stripe's ids, the receipt
--      number (taken at landing, so only paid payments are numbered), and whether it landed.
--   3. online_payment_refunds — a full refund to the card (12a, A12). FieldLogicHQ's fee is never refunded (owner
--      2026-10-25, §0c); when the organizer includes the fee (A2's box), the club pays it back.
--   4. stripe_connect_events — every Connect event once (a short-circuit and an audit trail; correctness lives in the
--      landing functions' row locks).
--   5. tournament_team_payments — `online_payment_id`; method 'online_card'; status 'refunded' (the paid figure falls,
--      the row stays to read "Refunded to card"). A trigger refuses any hand change to an online row.
--   6. teams.pay_link_sent_at — "Pay link sent".
--   7. The event shelf's two spending words, "Refunds" and "Payment processing", added the first time one is needed
--      (owner 2026-10-25: a tournament's refunds and processing costs file on its OWN shelf so its net stays true).
--   8. The landing and refund functions.
--   9. Three Needs attention kinds → both partial indexes rebuilt (the mig 338 precedent; MANUAL_PROD_STEPS.json).
--
-- ⚠ LOCK ORDER (mig 345's, extended): tournament row (club_tournament_fee_word, only when the book is on) → team row →
-- the online_payments row → the refund row → ledger lines. NEVER lock an online payment before its team.
-- ⚠ The write flag `flhq.online_payment_write` is transaction-local and is set back to 'off' before each function returns.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. The club's connected account ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_payment_accounts (
  org_id uuid NOT NULL,
  stripe_account_id text NOT NULL,
  livemode boolean NOT NULL DEFAULT false,
  country char(2),
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  requirements_due text[] NOT NULL DEFAULT '{}',
  disabled_reason text,
  requirements_deadline timestamptz,
  stripe_synced_at timestamptz,
  fee_payer text NOT NULL DEFAULT 'family',
  refund_policy text,
  terms_version text,
  terms_agreed_by uuid,
  terms_agreed_by_email text,
  terms_agreed_at timestamptz,
  connected_by uuid,
  connected_at timestamptz NOT NULL DEFAULT now(),
  disconnected_by uuid,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_payment_accounts_pkey PRIMARY KEY (org_id),
  CONSTRAINT org_payment_accounts_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT org_payment_accounts_terms_by_fk FOREIGN KEY (terms_agreed_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT org_payment_accounts_connected_by_fk FOREIGN KEY (connected_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT org_payment_accounts_disconnected_by_fk FOREIGN KEY (disconnected_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT org_payment_accounts_fee_payer_chk CHECK (fee_payer IN ('family', 'club')),
  CONSTRAINT org_payment_accounts_refund_policy_chk CHECK (refund_policy IS NULL OR char_length(refund_policy) <= 300),
  -- The terms evidence is all there or not there: counsel's record must never be half a fact.
  CONSTRAINT org_payment_accounts_terms_chk CHECK (
    (terms_version IS NULL AND terms_agreed_at IS NULL AND terms_agreed_by_email IS NULL)
    OR (terms_version IS NOT NULL AND terms_agreed_at IS NOT NULL AND terms_agreed_by_email IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS org_payment_accounts_stripe_account_key ON public.org_payment_accounts(stripe_account_id);
ALTER TABLE public.org_payment_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_payment_accounts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_payment_accounts TO service_role;

-- ── 2. Online payments ──────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.online_payment_receipt_seq START WITH 1001;
REVOKE ALL ON SEQUENCE public.online_payment_receipt_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.online_payment_receipt_seq TO service_role;

CREATE TABLE IF NOT EXISTS public.online_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  stripe_account_id text NOT NULL,
  flow text NOT NULL,
  tournament_id uuid,
  team_id uuid,
  scope text NOT NULL,
  description text NOT NULL,
  payer_email text,
  base_amount numeric(12,2) NOT NULL,
  fee_amount numeric(12,2) NOT NULL,
  total_amount numeric(12,2) NOT NULL,
  fee_payer text NOT NULL,
  fee_pct numeric(6,4) NOT NULL,
  fee_flat numeric(12,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'CAD',
  rail text NOT NULL DEFAULT 'card',
  status text NOT NULL DEFAULT 'open',
  livemode boolean NOT NULL DEFAULT false,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  card_brand text,
  card_last4 text,
  receipt_no bigint,
  paid_on date,
  paid_at timestamptz,
  landed_at timestamptz,
  land_error text,
  processing_cost_entry_id uuid,
  receipt_emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT online_payments_pkey PRIMARY KEY (id),
  CONSTRAINT online_payments_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- A deleted team or tournament must not erase a payment Stripe still holds: the link goes, the frozen description stays.
  CONSTRAINT online_payments_tournament_fk FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE SET NULL,
  CONSTRAINT online_payments_team_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL,
  CONSTRAINT online_payments_cost_entry_fk FOREIGN KEY (processing_cost_entry_id) REFERENCES public.accounting_entries(id),
  CONSTRAINT online_payments_flow_chk CHECK (flow IN ('tournament_team')),
  CONSTRAINT online_payments_scope_chk CHECK (scope IN ('deposit', 'balance', 'full')),
  CONSTRAINT online_payments_base_chk CHECK (base_amount > 0 AND base_amount <= 1000000),
  CONSTRAINT online_payments_fee_chk CHECK (fee_amount >= 0),
  CONSTRAINT online_payments_total_chk CHECK (total_amount > 0),
  CONSTRAINT online_payments_fee_payer_chk CHECK (fee_payer IN ('family', 'club')),
  -- Who pays the fee decides the total (A14): the payer pays base + fee, or the base alone.
  CONSTRAINT online_payments_arithmetic_chk CHECK (
    (fee_payer = 'family' AND total_amount = base_amount + fee_amount)
    OR (fee_payer = 'club' AND total_amount = base_amount)),
  CONSTRAINT online_payments_currency_chk CHECK (currency = 'CAD'),
  CONSTRAINT online_payments_rail_chk CHECK (rail IN ('card')),
  CONSTRAINT online_payments_status_chk CHECK (status IN ('open', 'paid', 'expired', 'refunded')),
  CONSTRAINT online_payments_paid_chk CHECK (
    status NOT IN ('paid', 'refunded') OR (paid_at IS NOT NULL AND stripe_payment_intent_id IS NOT NULL AND receipt_no IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS online_payments_session_key ON public.online_payments(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS online_payments_intent_key ON public.online_payments(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS online_payments_receipt_key ON public.online_payments(receipt_no) WHERE receipt_no IS NOT NULL;
-- One open Checkout per team: a double press reuses it instead of opening two that could both be paid.
CREATE UNIQUE INDEX IF NOT EXISTS online_payments_one_open_per_team ON public.online_payments(team_id)
  WHERE status = 'open' AND team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS online_payments_org_idx ON public.online_payments(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS online_payments_team_idx ON public.online_payments(team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS online_payments_tournament_idx ON public.online_payments(tournament_id) WHERE tournament_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS online_payments_open_idx ON public.online_payments(created_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS online_payments_cost_entry_idx ON public.online_payments(processing_cost_entry_id)
  WHERE processing_cost_entry_id IS NOT NULL;
ALTER TABLE public.online_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.online_payments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_payments TO service_role;

-- ── 3. Refunds ──────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.online_payment_refunds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  online_payment_id uuid NOT NULL,
  org_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  -- The part of `amount` that is the processing fee the club pays back (A2's box); 0 when not included.
  fee_refunded numeric(12,2) NOT NULL DEFAULT 0,
  reason text,
  note text,
  origin text NOT NULL DEFAULT 'app',
  status text NOT NULL DEFAULT 'pending',
  failure_reason text,
  stripe_refund_id text,
  refund_entry_id uuid,
  processing_cost_entry_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  succeeded_at timestamptz,
  CONSTRAINT online_payment_refunds_pkey PRIMARY KEY (id),
  CONSTRAINT online_payment_refunds_payment_fk FOREIGN KEY (online_payment_id) REFERENCES public.online_payments(id),
  CONSTRAINT online_payment_refunds_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT online_payment_refunds_entry_fk FOREIGN KEY (refund_entry_id) REFERENCES public.accounting_entries(id),
  CONSTRAINT online_payment_refunds_cost_entry_fk FOREIGN KEY (processing_cost_entry_id) REFERENCES public.accounting_entries(id),
  CONSTRAINT online_payment_refunds_created_by_fk FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT online_payment_refunds_amount_chk CHECK (amount > 0 AND fee_refunded >= 0 AND fee_refunded < amount),
  CONSTRAINT online_payment_refunds_reason_chk CHECK (reason IS NULL OR reason IN ('organizer_ended', 'team_left')),
  CONSTRAINT online_payment_refunds_note_chk CHECK (note IS NULL OR char_length(note) <= 1000),
  -- A refund can start in the club's own Stripe dashboard; it then lands the same way, with no one of ours behind it.
  CONSTRAINT online_payment_refunds_origin_chk CHECK (origin IN ('app', 'stripe_dashboard')),
  CONSTRAINT online_payment_refunds_status_chk CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled')),
  CONSTRAINT online_payment_refunds_succeeded_chk CHECK ((status = 'succeeded') = (succeeded_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS online_payment_refunds_stripe_key ON public.online_payment_refunds(stripe_refund_id)
  WHERE stripe_refund_id IS NOT NULL;
-- 12a refunds in full only, so one live refund per payment. ⚠ 12b's partial refunds (L1) drop this index by name.
CREATE UNIQUE INDEX IF NOT EXISTS online_payment_refunds_one_full_refund ON public.online_payment_refunds(online_payment_id)
  WHERE status IN ('pending', 'succeeded');
CREATE INDEX IF NOT EXISTS online_payment_refunds_payment_idx ON public.online_payment_refunds(online_payment_id);
CREATE INDEX IF NOT EXISTS online_payment_refunds_org_idx ON public.online_payment_refunds(org_id);
CREATE INDEX IF NOT EXISTS online_payment_refunds_entry_idx ON public.online_payment_refunds(refund_entry_id) WHERE refund_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS online_payment_refunds_cost_entry_idx ON public.online_payment_refunds(processing_cost_entry_id)
  WHERE processing_cost_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS online_payment_refunds_created_by_idx ON public.online_payment_refunds(created_by) WHERE created_by IS NOT NULL;
ALTER TABLE public.online_payment_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.online_payment_refunds FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_payment_refunds TO service_role;

-- ── 4. Connect events, once each ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stripe_connect_events (
  id text NOT NULL,
  type text NOT NULL,
  account text,
  livemode boolean,
  org_id uuid,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 1,
  error text,
  CONSTRAINT stripe_connect_events_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS stripe_connect_events_received_idx ON public.stripe_connect_events(received_at);
CREATE INDEX IF NOT EXISTS stripe_connect_events_unprocessed_idx ON public.stripe_connect_events(received_at) WHERE processed_at IS NULL;
ALTER TABLE public.stripe_connect_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_connect_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stripe_connect_events TO service_role;

-- ── 5. A team's payment rows learn about online payments ────────────────────────────────────────
ALTER TABLE public.tournament_team_payments ADD COLUMN IF NOT EXISTS online_payment_id uuid;
-- NO ACTION, not RESTRICT: checked at the END of the statement, so deleting an organization (which cascades into both
-- tables) works, while deleting a payment that a team's row still points at is refused.
ALTER TABLE public.tournament_team_payments DROP CONSTRAINT IF EXISTS tournament_team_payments_online_payment_fk;
ALTER TABLE public.tournament_team_payments ADD CONSTRAINT tournament_team_payments_online_payment_fk
  FOREIGN KEY (online_payment_id) REFERENCES public.online_payments(id);
ALTER TABLE public.online_payment_refunds DROP CONSTRAINT IF EXISTS online_payment_refunds_payment_fk;
ALTER TABLE public.online_payment_refunds ADD CONSTRAINT online_payment_refunds_payment_fk
  FOREIGN KEY (online_payment_id) REFERENCES public.online_payments(id);
CREATE UNIQUE INDEX IF NOT EXISTS tournament_team_payments_online_payment_key ON public.tournament_team_payments(online_payment_id)
  WHERE online_payment_id IS NOT NULL;
ALTER TABLE public.tournament_team_payments DROP CONSTRAINT IF EXISTS tournament_team_payments_method_chk;
ALTER TABLE public.tournament_team_payments ADD CONSTRAINT tournament_team_payments_method_chk
  CHECK (method IS NULL OR method IN ('etransfer', 'cash', 'cheque', 'card', 'other', 'online_card'));
ALTER TABLE public.tournament_team_payments DROP CONSTRAINT IF EXISTS tournament_team_payments_status_chk;
ALTER TABLE public.tournament_team_payments ADD CONSTRAINT tournament_team_payments_status_chk
  CHECK (status IN ('posted', 'removed', 'refunded'));

-- The backstop: an online row changes only through the landing and refund functions below. Keyed on online_payment_id,
-- not method, so the landing's own stamp (method NULL → 'online_card', link set) is the one allowed transition.
-- Never on DELETE: teams, tournaments and organizations cascade into this table.
CREATE OR REPLACE FUNCTION public.tournament_team_payments_online_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.online_payment_id IS NOT NULL OR NEW.method = 'online_card' OR NEW.status = 'refunded' THEN
      RAISE EXCEPTION 'An online payment is recorded by the payment itself.';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.online_payment_id IS NOT NULL THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.paid_on IS DISTINCT FROM OLD.paid_on
       OR NEW.method IS DISTINCT FROM OLD.method OR NEW.team_id IS DISTINCT FROM OLD.team_id
       OR NEW.online_payment_id IS DISTINCT FROM OLD.online_payment_id OR NEW.entry_id IS DISTINCT FROM OLD.entry_id
       OR NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'An online payment is changed by refunding it to the card.';
    END IF;
  ELSIF NEW.online_payment_id IS NOT NULL OR NEW.method = 'online_card' OR NEW.status = 'refunded' THEN
    RAISE EXCEPTION 'An online payment is recorded by the payment itself.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tournament_team_payments_online_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS tournament_team_payments_online_guard ON public.tournament_team_payments;
CREATE TRIGGER tournament_team_payments_online_guard
  BEFORE INSERT OR UPDATE ON public.tournament_team_payments
  FOR EACH ROW EXECUTE FUNCTION public.tournament_team_payments_online_guard();

-- ── 6. "Pay link sent" ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS pay_link_sent_at timestamptz;

-- ── 7. The event shelf's spending words for online payments ─────────────────────────────────────
-- Finds or adds a money-out word by name on the tournament's own shelf, creating the shelf if the event has none yet
-- (club_tournament_fee_word, which also takes the tournament row lock — first in the lock order). A word of that name
-- that is money IN is never reused for money out: the line is then filed under the shelf with no word (null item).
CREATE OR REPLACE FUNCTION public.club_tournament_out_word(p_tournament uuid, p_name text)
RETURNS TABLE(category_id uuid, item_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_dir text; v_next integer;
BEGIN
  SELECT w.category_id INTO category_id FROM club_tournament_fee_word(p_tournament) w;
  SELECT org_id INTO v_org FROM budget_categories WHERE id = category_id;
  SELECT i.id, i.direction INTO item_id, v_dir FROM budget_items i
    WHERE i.category_id = club_tournament_out_word.category_id AND lower(i.name) = lower(p_name)
    ORDER BY (i.direction = 'out') DESC LIMIT 1;
  IF item_id IS NOT NULL AND v_dir <> 'out' THEN item_id := NULL; RETURN NEXT; RETURN; END IF;
  IF item_id IS NULL THEN
    SELECT coalesce(max(sort_order), 0) + 1 INTO v_next FROM budget_items WHERE budget_items.category_id = club_tournament_out_word.category_id;
    INSERT INTO budget_items(category_id, org_id, name, direction, actual_source, is_default, sort_order)
    VALUES(club_tournament_out_word.category_id, v_org, p_name, 'out', 'typed', false, v_next) RETURNING id INTO item_id;
  END IF;
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.club_tournament_out_word(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_tournament_out_word(uuid, text) TO service_role;

-- One money-out line on the tournament's book, filed under the named spending word. Only called when the book is on.
CREATE OR REPLACE FUNCTION public.online_payment_post_out(
  p_tournament uuid, p_word text, p_day date, p_description text, p_amount numeric, p_source_id uuid, p_actor uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid; v_item uuid; v_book uuid; v_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_day IS NULL THEN RAISE EXCEPTION 'A money-out line needs a positive amount and day'; END IF;
  SELECT w.category_id, w.item_id INTO v_cat, v_item FROM club_tournament_out_word(p_tournament, p_word) w;
  v_book := club_tournament_ledger(p_tournament);
  INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category, source_module,
    source_entity_id, created_by, budget_category_id, budget_item_id, payment_method)
  VALUES(v_book, p_day, left(p_description, 500), round(p_amount, 2), 'expense', 'posted', NULL, 'online_payment',
    p_source_id, p_actor, v_cat, v_item, 'online_card')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_post_out(uuid, text, date, text, numeric, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_post_out(uuid, text, date, text, numeric, uuid, uuid) TO service_role;

-- ── 8a. The landing: Stripe says paid → the tournament's own writer records it ──────────────────
-- Idempotent (a payment that already landed answers {already:true}). The day is the payment's day in Toronto, clamped to
-- today, and moved to today when it sits inside a closed fiscal year (mig 318) — the real moment stays in paid_at.
-- A throw (an "our team" link made after the page opened, a deleted team) is the caller's to catch: it then calls
-- online_payment_land_failed, so the fact that Stripe took the money is never lost.
CREATE OR REPLACE FUNCTION public.online_payment_land(
  p_online_payment uuid, p_paid_at timestamptz, p_payment_intent text, p_charge text, p_brand text, p_last4 text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_book_on boolean := false; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_day date; v_closed date; v_label text; v_rec jsonb; v_pay uuid; v_entry uuid; v_cost uuid; v_receipt bigint;
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.landed_at IS NOT NULL OR v_op.status = 'refunded' THEN
    RETURN jsonb_build_object('already', true, 'receiptNo', v_op.receipt_no);
  END IF;
  IF v_op.team_id IS NULL OR v_op.tournament_id IS NULL THEN RAISE EXCEPTION 'The team is no longer in the tournament.'; END IF;

  -- Lock order: tournament (when the book is on) → team → this payment.
  IF tournament_fee_book_on(v_op.tournament_id) THEN
    v_book_on := true;
    PERFORM 1 FROM club_tournament_fee_word(v_op.tournament_id);
  END IF;
  PERFORM 1 FROM teams WHERE id = v_op.team_id FOR UPDATE;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;
  IF v_op.landed_at IS NOT NULL OR v_op.status = 'refunded' THEN
    RETURN jsonb_build_object('already', true, 'receiptNo', v_op.receipt_no);
  END IF;

  v_day := least((p_paid_at AT TIME ZONE 'America/Toronto')::date, v_today);
  v_closed := club_books_closed_through(v_op.org_id);
  IF v_closed IS NOT NULL AND v_day <= v_closed THEN v_day := v_today; END IF;
  v_label := CASE v_op.scope WHEN 'deposit' THEN 'Deposit' WHEN 'balance' THEN 'Balance' ELSE 'Payment' END;

  PERFORM set_config('flhq.online_payment_write', 'on', true);
  -- THE tournament writer, with no method (its own validation stays hand-only); the stamp below marks it online.
  v_rec := tournament_team_payment_record(v_op.team_id, v_op.base_amount, v_day, v_label, NULL, NULL);
  v_pay := (v_rec ->> 'paymentId')::uuid;
  v_entry := nullif(v_rec ->> 'entryId', '')::uuid;
  UPDATE tournament_team_payments SET method = 'online_card', online_payment_id = v_op.id, updated_at = now() WHERE id = v_pay;
  IF v_entry IS NOT NULL THEN UPDATE accounting_entries SET payment_method = 'online_card' WHERE id = v_entry; END IF;
  -- The club pays the fee (A14): one "Payment processing" cost per payment — never less fee revenue.
  IF v_op.fee_payer = 'club' AND v_op.fee_amount > 0 AND v_entry IS NOT NULL THEN
    v_cost := online_payment_post_out(v_op.tournament_id, 'Payment processing', v_day,
      'Payment processing · ' || v_op.description, v_op.fee_amount, v_op.id, NULL);
  END IF;
  v_receipt := coalesce(v_op.receipt_no, nextval('online_payment_receipt_seq'));
  UPDATE online_payments SET status = 'paid', paid_at = p_paid_at, paid_on = v_day, landed_at = now(), land_error = NULL,
    stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
    stripe_charge_id = coalesce(p_charge, stripe_charge_id), card_brand = coalesce(p_brand, card_brand),
    card_last4 = coalesce(p_last4, card_last4), receipt_no = v_receipt, processing_cost_entry_id = v_cost, updated_at = now()
  WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN v_rec || jsonb_build_object('already', false, 'receiptNo', v_receipt, 'teamPaymentId', v_pay);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_land(uuid, timestamptz, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_land(uuid, timestamptz, text, text, text, text) TO service_role;

-- A landing that could not complete: the payment is still PAID (Stripe has the money) and numbered, with the reason kept.
CREATE OR REPLACE FUNCTION public.online_payment_land_failed(
  p_online_payment uuid, p_paid_at timestamptz, p_payment_intent text, p_charge text, p_brand text, p_last4 text, p_error text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_receipt bigint;
BEGIN
  UPDATE online_payments SET status = CASE WHEN status = 'refunded' THEN status ELSE 'paid' END,
    paid_at = coalesce(paid_at, p_paid_at), paid_on = coalesce(paid_on, (p_paid_at AT TIME ZONE 'America/Toronto')::date),
    stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
    stripe_charge_id = coalesce(p_charge, stripe_charge_id), card_brand = coalesce(p_brand, card_brand),
    card_last4 = coalesce(p_last4, card_last4), receipt_no = coalesce(receipt_no, nextval('online_payment_receipt_seq')),
    land_error = left(coalesce(p_error, 'Not recorded'), 500), updated_at = now()
  WHERE id = p_online_payment AND landed_at IS NULL
  RETURNING receipt_no INTO v_receipt;
  RETURN v_receipt;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_land_failed(uuid, timestamptz, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_land_failed(uuid, timestamptz, text, text, text, text, text) TO service_role;

-- ── 8b. Refunds ─────────────────────────────────────────────────────────────────────────────────
-- Opens the refund BEFORE Stripe is asked, so a second press or a second organizer meets the one-refund index.
CREATE OR REPLACE FUNCTION public.online_payment_refund_open(
  p_online_payment uuid, p_fee_included boolean, p_reason text, p_note text, p_actor uuid, p_origin text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_op public.online_payments%ROWTYPE; v_fee numeric(12,2); v_id uuid;
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.status <> 'paid' THEN RAISE EXCEPTION 'This payment can no longer be refunded.'; END IF;
  -- The fee goes back only when the payer paid it (A2's box shows only then); the club pays it back.
  v_fee := CASE WHEN p_fee_included AND v_op.fee_payer = 'family' THEN v_op.fee_amount ELSE 0 END;
  INSERT INTO online_payment_refunds(online_payment_id, org_id, amount, fee_refunded, reason, note, origin, created_by)
  VALUES(v_op.id, v_op.org_id, v_op.base_amount + v_fee, v_fee,
    CASE WHEN v_op.fee_payer = 'family' THEN p_reason END, nullif(trim(p_note), ''), coalesce(p_origin, 'app'), p_actor)
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'This payment is already being refunded.';
END $$;
REVOKE ALL ON FUNCTION public.online_payment_refund_open(uuid, boolean, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_refund_open(uuid, boolean, text, text, uuid, text) TO service_role;

-- Stripe says the refund succeeded → the team's paid figure falls (the row reads "Refunded to card"), the book keeps the
-- receipt and gains the refund as a money-out line ("Refunds"), and the fee the club paid back is a "Payment processing"
-- cost. FieldLogicHQ's fee is not refunded (§0c). Idempotent. Never calls _remove/_change: they void the receipt.
CREATE OR REPLACE FUNCTION public.online_payment_refund_land(p_refund uuid, p_stripe_refund text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r public.online_payment_refunds%ROWTYPE; v_op public.online_payments%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date; v_refund_entry uuid; v_cost uuid; v_refresh jsonb;
  v_receipt uuid; v_how text;
BEGIN
  SELECT * INTO v_r FROM online_payment_refunds WHERE id = p_refund;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF v_r.status = 'succeeded' THEN RETURN jsonb_build_object('already', true); END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = v_r.online_payment_id;

  -- Lock order: tournament → team → payment → refund. The tournament is locked whenever there is one (not only when the
  -- book is on now): the refund's lines follow the receipt, and posting them takes the tournament row.
  IF v_op.tournament_id IS NOT NULL THEN
    PERFORM 1 FROM tournaments WHERE id = v_op.tournament_id FOR UPDATE;
  END IF;
  IF v_op.team_id IS NOT NULL THEN PERFORM 1 FROM teams WHERE id = v_op.team_id FOR UPDATE; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = v_r.online_payment_id FOR UPDATE;
  SELECT * INTO v_r FROM online_payment_refunds WHERE id = p_refund FOR UPDATE;
  IF v_r.status = 'succeeded' THEN RETURN jsonb_build_object('already', true); END IF;

  SELECT entry_id INTO v_receipt FROM tournament_team_payments WHERE online_payment_id = v_op.id AND status = 'posted';
  -- No Stripe refund behind it = the club refunded another way after a refund to the card was returned.
  v_how := CASE WHEN coalesce(p_stripe_refund, v_r.stripe_refund_id) IS NULL THEN 'Refunded another way · ' ELSE 'Refunded to card · ' END;
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE tournament_team_payments SET status = 'refunded', updated_at = now()
    WHERE online_payment_id = v_op.id AND status = 'posted';
  IF v_receipt IS NOT NULL AND v_op.tournament_id IS NOT NULL THEN
    v_refund_entry := online_payment_post_out(v_op.tournament_id, 'Refunds', v_today,
      v_how || v_op.description, v_r.amount - v_r.fee_refunded, v_r.id, v_r.created_by);
    IF v_r.fee_refunded > 0 THEN
      v_cost := online_payment_post_out(v_op.tournament_id, 'Payment processing', v_today,
        'Processing fee refunded · ' || v_op.description, v_r.fee_refunded, v_r.id, v_r.created_by);
    END IF;
  END IF;
  UPDATE online_payment_refunds SET status = 'succeeded', succeeded_at = now(),
    stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), refund_entry_id = v_refund_entry,
    processing_cost_entry_id = v_cost, failure_reason = NULL, updated_at = now()
  WHERE id = v_r.id;
  UPDATE online_payments SET status = 'refunded', updated_at = now() WHERE id = v_op.id;
  IF v_op.team_id IS NOT NULL THEN
    v_refresh := team_payments_refresh(v_op.team_id, v_r.created_by, 'live', NULL);
  END IF;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN coalesce(v_refresh, '{}'::jsonb) || jsonb_build_object('already', false, 'refundEntryId', v_refund_entry);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_refund_land(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_refund_land(uuid, text) TO service_role;

-- Stripe refused or failed the refund: the payment stays paid and refundable again.
CREATE OR REPLACE FUNCTION public.online_payment_refund_failed(p_refund uuid, p_stripe_refund text, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE online_payment_refunds SET status = 'failed', failure_reason = left(coalesce(p_reason, 'failed'), 500),
    stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), updated_at = now()
  WHERE id = p_refund AND status = 'pending';
END $$;
REVOKE ALL ON FUNCTION public.online_payment_refund_failed(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_refund_failed(uuid, text, text) TO service_role;

-- ── 9. Three Needs attention kinds: the two partial indexes list every kind (mig 338 precedent) ──
--   payouts_need_attention      — the owner and the treasurer: Stripe needs something; clears when the account is enabled
--   online_payment_not_recorded — a paid online payment that could not land in the team's record
--   card_refund_failed          — a refund that could not reach the card; refund another way
drop index if exists public.notifications_user_needs_attention_idx;
create index notifications_user_needs_attention_idx
  on public.notifications (user_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'card_refund_failed', 'club_hand_back_asked', 'club_hand_back_unasked',
                         'club_payment_handed_off', 'club_schedule_review', 'online_payment_not_recorded', 'payment_failed',
                         'payouts_need_attention', 'team_coach_payment_reminder', 'team_money_sent', 'team_move_requested',
                         'team_no_show', 'team_request_filed', 'team_request_holding_payout');

drop index if exists public.notifications_org_needs_attention_idx;
create index notifications_org_needs_attention_idx
  on public.notifications (org_id, event_type)
  where cleared_at is null
    and event_type in ('assistant_coach_approval_requested', 'card_refund_failed', 'club_hand_back_asked', 'club_hand_back_unasked',
                         'club_payment_handed_off', 'club_schedule_review', 'online_payment_not_recorded', 'payment_failed',
                         'payouts_need_attention', 'team_coach_payment_reminder', 'team_money_sent', 'team_move_requested',
                         'team_no_show', 'team_request_filed', 'team_request_holding_payout');

COMMIT;
