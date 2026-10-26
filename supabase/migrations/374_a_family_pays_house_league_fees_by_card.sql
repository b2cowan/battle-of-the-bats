-- ---------------------------------------------------------------
-- Migration 374 — Club Tier Stage 12b Part 1: a family pays house-league fees by card (the schema and the landing).
-- Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md §0e (owner rulings at the 12b build start, 2026-10-25).
--
-- WHY: 12a's online payments are team-shaped (mig 358): one flow, a tournament and a team, landed by the tournament's
-- own writer. A house-league sign-up pays for one or more children in ONE checkout (§0e a), and each child's fee must
-- land on that child's registration through THE house-league money writer (club_league_money, mig 369), once, under a
-- replayed webhook (§0e b).
--
-- WHAT CHANGES:
--   1. online_payments learns the flow 'league_signup': season_id + signup_key (the sign-up's reference, or the one
--      registration's id when it has none), one open Checkout per sign-up, and the shape of each flow is a CHECK (a team
--      payment never carries a season, a league payment never a team). Status gains 'partly_refunded' for 12b's partial
--      refunds (L1; the refund functions follow in their own migration).
--   2. online_payment_items: one row per child a payment covers (amount, its share of the processing fee, and — once it
--      lands — the house-league money line it became). This corrects the schema review's "the destination row is the
--      item": a child's line exists only once the money lands, so the split is held from the moment of paying.
--   3. online_payment_refunds names the child it refunds (online_payment_item_id), keeps a partial refund's reason, and
--      takes the house-league reasons. The one-full-refund index is NOT dropped here: it stays the double-press guard
--      until the partial-refund functions replace it in one step.
--   4. league_registrations.pay_link_sent_at ("Pay link sent", as teams.pay_link_sent_at).
--   5. The two guards (mig 359) cover the new columns, and a third guards the items: they change only inside the
--      functions below.
--   6. club_league_money (mig 369, same signature): the method 'online_card' is the card landing's alone (refused as
--      'method' outside the online-payment write flag), and Undo refuses a card payment ('card') — a card payment comes
--      off only by a refund (drawings m4).
--   7. A season's "Payment processing" spending word (club_league_out_word, under the club's one House league
--      registration fees category, mig 371) and its money-out line (online_payment_league_post_out, source_module
--      'online_payment'). Never a 'league_registration' expense: that would net fees as a refund (isFeeRefund).
--   8. online_payment_league_open (the payment and its items, atomically) and online_payment_league_land (each child's
--      fee through club_league_money, in one transaction; a refused child keeps the payment PAID with that child's
--      reason, for Needs attention; idempotent).
-- RLS: online_payment_items is service-role only, like every 358 table.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. online_payments: the house-league flow ──────────────────────────────────────────────────
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS season_id uuid;
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS signup_key text;
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_season_fk;
-- A deleted season must not erase a payment Stripe still holds: the link goes, the frozen description stays.
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_season_fk
  FOREIGN KEY (season_id) REFERENCES public.league_seasons(id) ON DELETE SET NULL;
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_flow_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_flow_chk CHECK (flow IN ('tournament_team', 'league_signup'));
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_flow_shape_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_flow_shape_chk CHECK (
  (flow = 'tournament_team' AND season_id IS NULL AND signup_key IS NULL)
  OR (flow = 'league_signup' AND tournament_id IS NULL AND team_id IS NULL AND signup_key IS NOT NULL
      AND char_length(signup_key) BETWEEN 1 AND 64 AND scope = 'full'));
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_status_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_status_chk
  CHECK (status IN ('open', 'paid', 'expired', 'partly_refunded', 'refunded'));
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_paid_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_paid_chk CHECK (
  status NOT IN ('paid', 'partly_refunded', 'refunded')
  OR (paid_at IS NOT NULL AND stripe_payment_intent_id IS NOT NULL AND receipt_no IS NOT NULL));
-- One open Checkout per sign-up: a double press or a second sibling's link reuses it instead of opening two.
CREATE UNIQUE INDEX IF NOT EXISTS online_payments_one_open_per_signup ON public.online_payments(season_id, signup_key)
  WHERE status = 'open' AND flow = 'league_signup' AND season_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS online_payments_season_idx ON public.online_payments(season_id) WHERE season_id IS NOT NULL;

-- ── 2. The children a payment covers ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.online_payment_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  online_payment_id uuid NOT NULL,
  org_id uuid NOT NULL,
  registration_id uuid,
  -- "Ava Smith · U9", frozen when the family paid (a renamed child or a deleted registration keeps the receipt honest).
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  -- This child's part of the payment's processing fee (the parts sum to online_payments.fee_amount): what a full refund
  -- with A2's box gives back for this child.
  fee_share numeric(12,2) NOT NULL DEFAULT 0,
  -- The house-league money line this child's fee became (club_league_money 'receive'); NULL until it lands.
  entry_id uuid,
  -- Why this child's fee could not land (the writer's refusal code, or an error): the payment is still PAID.
  land_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT online_payment_items_pkey PRIMARY KEY (id),
  CONSTRAINT online_payment_items_payment_fk FOREIGN KEY (online_payment_id) REFERENCES public.online_payments(id),
  CONSTRAINT online_payment_items_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT online_payment_items_registration_fk FOREIGN KEY (registration_id)
    REFERENCES public.league_registrations(id) ON DELETE SET NULL,
  CONSTRAINT online_payment_items_entry_fk FOREIGN KEY (entry_id) REFERENCES public.accounting_entries(id),
  CONSTRAINT online_payment_items_amount_chk CHECK (amount > 0 AND amount <= 1000000 AND fee_share >= 0),
  CONSTRAINT online_payment_items_description_chk CHECK (char_length(description) BETWEEN 1 AND 300),
  CONSTRAINT online_payment_items_land_error_chk CHECK (land_error IS NULL OR char_length(land_error) <= 500),
  CONSTRAINT online_payment_items_landed_chk CHECK (entry_id IS NULL OR land_error IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS online_payment_items_one_per_child ON public.online_payment_items(online_payment_id, registration_id)
  WHERE registration_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS online_payment_items_entry_key ON public.online_payment_items(entry_id) WHERE entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS online_payment_items_payment_idx ON public.online_payment_items(online_payment_id);
CREATE INDEX IF NOT EXISTS online_payment_items_org_idx ON public.online_payment_items(org_id);
CREATE INDEX IF NOT EXISTS online_payment_items_registration_idx ON public.online_payment_items(registration_id)
  WHERE registration_id IS NOT NULL;
ALTER TABLE public.online_payment_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.online_payment_items FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.online_payment_items TO service_role;

-- ── 3. Refunds name the child, and keep a partial refund's reason ──────────────────────────────
ALTER TABLE public.online_payment_refunds ADD COLUMN IF NOT EXISTS online_payment_item_id uuid;
ALTER TABLE public.online_payment_refunds ADD COLUMN IF NOT EXISTS partial_reason text;
ALTER TABLE public.online_payment_refunds DROP CONSTRAINT IF EXISTS online_payment_refunds_item_fk;
ALTER TABLE public.online_payment_refunds ADD CONSTRAINT online_payment_refunds_item_fk
  FOREIGN KEY (online_payment_item_id) REFERENCES public.online_payment_items(id);
ALTER TABLE public.online_payment_refunds DROP CONSTRAINT IF EXISTS online_payment_refunds_partial_reason_chk;
ALTER TABLE public.online_payment_refunds ADD CONSTRAINT online_payment_refunds_partial_reason_chk
  CHECK (partial_reason IS NULL OR char_length(partial_reason) BETWEEN 1 AND 500);
-- A2 = C's who-ended-it, per flow: the organizer or the team (tournaments); the club, the family, or a lower price
-- (house league — a price correction is not an ending, and its refund never includes the fee).
ALTER TABLE public.online_payment_refunds DROP CONSTRAINT IF EXISTS online_payment_refunds_reason_chk;
ALTER TABLE public.online_payment_refunds ADD CONSTRAINT online_payment_refunds_reason_chk
  CHECK (reason IS NULL OR reason IN ('organizer_ended', 'team_left', 'club_ended', 'family_left', 'price_corrected'));
CREATE INDEX IF NOT EXISTS online_payment_refunds_item_idx ON public.online_payment_refunds(online_payment_item_id)
  WHERE online_payment_item_id IS NOT NULL;

-- ── 4. "Pay link sent" ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.league_registrations ADD COLUMN IF NOT EXISTS pay_link_sent_at timestamptz;
-- The index-coverage gate (every org_id leads an index): mig 358 left the Connect event log's org_id without one.
CREATE INDEX IF NOT EXISTS stripe_connect_events_org_id_idx ON public.stripe_connect_events(org_id);
-- One open copy of a notice (mig 366) learns the house-league child's subject: a child's "couldn't be recorded" notice
-- names its item (metadata onlinePaymentItemId), which mig 366's key read as NULL — and NULLs never collide. No such
-- notice exists before this migration, so the rebuild meets no duplicate.
DROP INDEX IF EXISTS public.notifications_one_open_online_payments_notice;
CREATE UNIQUE INDEX notifications_one_open_online_payments_notice
  ON public.notifications (org_id, user_id, event_type,
    (COALESCE(metadata->>'stripeAccountId', metadata->>'onlinePaymentItemId', metadata->>'onlinePaymentId')))
  WHERE cleared_at IS NULL
    AND event_type IN ('payouts_need_attention', 'online_payment_not_recorded', 'card_refund_failed');

-- ── 5. The guards (mig 359) cover the new columns; the items get their own ─────────────────────
CREATE OR REPLACE FUNCTION public.online_payments_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'open' OR NEW.paid_at IS NOT NULL OR NEW.landed_at IS NOT NULL OR NEW.receipt_no IS NOT NULL
       OR NEW.stripe_payment_intent_id IS NOT NULL OR NEW.processing_cost_entry_id IS NOT NULL THEN
      RAISE EXCEPTION 'An online payment starts open; Stripe''s answer records the rest.';
    END IF;
    -- Each flow opens on what it pays for (the FKs may later go NULL; a new payment never starts without them).
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
     OR NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id
     OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
     OR NEW.stripe_charge_id IS DISTINCT FROM OLD.stripe_charge_id OR NEW.receipt_no IS DISTINCT FROM OLD.receipt_no
     OR NEW.landed_at IS DISTINCT FROM OLD.landed_at OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.paid_on IS DISTINCT FROM OLD.paid_on OR NEW.processing_cost_entry_id IS DISTINCT FROM OLD.processing_cost_entry_id
     OR NEW.signup_key IS DISTINCT FROM OLD.signup_key
     OR (NEW.team_id IS DISTINCT FROM OLD.team_id AND NEW.team_id IS NOT NULL)
     OR (NEW.tournament_id IS DISTINCT FROM OLD.tournament_id AND NEW.tournament_id IS NOT NULL)
     OR (NEW.season_id IS DISTINCT FROM OLD.season_id AND NEW.season_id IS NOT NULL)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'open' AND NEW.status = 'expired')) THEN
    RAISE EXCEPTION 'An online payment changes only through its landing or its refund.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.online_payments_guard() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.online_payment_refunds_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- /dba: 12a's refund functions are team-shaped (they refund the whole payment and touch no registration). A house-league
  -- refund names its child; until 12b's refund functions exist, nothing else may open one — flag or no flag.
  IF TG_OP = 'INSERT' AND NEW.online_payment_item_id IS NULL
     AND EXISTS (SELECT 1 FROM online_payments p WHERE p.id = NEW.online_payment_id AND p.flow = 'league_signup') THEN
    RAISE EXCEPTION 'A house-league refund names the child it refunds.';
  END IF;
  -- /review: the child is one of THIS payment's, in this club.
  IF TG_OP = 'INSERT' AND NEW.online_payment_item_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM online_payment_items i
                      WHERE i.id = NEW.online_payment_item_id AND i.online_payment_id = NEW.online_payment_id AND i.org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'A refund''s child belongs to its own payment.';
  END IF;
  IF coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' OR NEW.succeeded_at IS NOT NULL OR NEW.refund_entry_id IS NOT NULL OR NEW.processing_cost_entry_id IS NOT NULL THEN
      RAISE EXCEPTION 'A refund starts pending; Stripe''s answer records the rest.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.fee_refunded IS DISTINCT FROM OLD.fee_refunded
     OR NEW.online_payment_id IS DISTINCT FROM OLD.online_payment_id OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.online_payment_item_id IS DISTINCT FROM OLD.online_payment_item_id
     OR NEW.partial_reason IS DISTINCT FROM OLD.partial_reason
     OR NEW.refund_entry_id IS DISTINCT FROM OLD.refund_entry_id OR NEW.processing_cost_entry_id IS DISTINCT FROM OLD.processing_cost_entry_id
     OR NEW.succeeded_at IS DISTINCT FROM OLD.succeeded_at
     OR (NEW.stripe_refund_id IS DISTINCT FROM OLD.stripe_refund_id AND OLD.stripe_refund_id IS NOT NULL)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'pending' AND NEW.status IN ('failed', 'canceled'))) THEN
    RAISE EXCEPTION 'A refund changes only through its landing.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_refunds_guard() FROM PUBLIC, anon, authenticated;

-- The items are written only inside online_payment_league_open and online_payment_league_land (under the flag).
CREATE OR REPLACE FUNCTION public.online_payment_items_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  -- A deleted registration lets its item go (the FK sets NULL); nothing else moves outside the functions.
  IF TG_OP = 'UPDATE' AND NEW.registration_id IS NULL AND OLD.registration_id IS NOT NULL
     AND (to_jsonb(NEW) - 'registration_id' - 'updated_at') = (to_jsonb(OLD) - 'registration_id' - 'updated_at') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'A payment''s children change only through its opening or its landing.';
END $$;
REVOKE ALL ON FUNCTION public.online_payment_items_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS online_payment_items_guard ON public.online_payment_items;
CREATE TRIGGER online_payment_items_guard BEFORE INSERT OR UPDATE ON public.online_payment_items
  FOR EACH ROW EXECUTE FUNCTION public.online_payment_items_guard();

-- ── 6. The one house-league writer: 'online_card' is the landing's, and a card payment has no Undo ──
-- Mig 369's body with two refusals added (marked ▶ 12b). Same signature, same grants.
CREATE OR REPLACE FUNCTION public.club_league_money(
  p_org uuid, p_season uuid, p_registration uuid, p_action text,
  p_amount numeric, p_day date, p_method text, p_reason text, p_actor uuid, p_entry uuid DEFAULT NULL
) RETURNS TABLE (entry uuid, refusal text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reg league_registrations%ROWTYPE; v_season league_seasons%ROWTYPE;
  v_fee numeric; v_got numeric; v_amt numeric; v_book uuid; v_id uuid; v_line accounting_entries%ROWTYPE;
  v_who text; v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
  v_method text := nullif(btrim(coalesce(p_method,'')), '');
  v_price numeric := round(p_amount, 2);
BEGIN
  IF p_action NOT IN ('receive','refund','undo','price') THEN RAISE EXCEPTION 'Invalid money action'; END IF;
  SELECT * INTO v_reg FROM league_registrations r
   WHERE r.id = p_registration AND r.org_id = p_org AND r.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
  SELECT * INTO v_season FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  v_fee := coalesce(v_reg.fee_amount, v_season.registration_fee, 0);
  v_got := league_reg_received(p_registration);
  v_who := v_reg.player_first_name || ' ' || v_reg.player_last_name;
  IF v_method IS NOT NULL AND char_length(v_method) > 100 THEN RAISE EXCEPTION 'A method is at most 100 characters'; END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN RAISE EXCEPTION 'A reason is at most 500 characters'; END IF;
  -- ▶ 12b: a card payment or a card refund is Stripe's answer, written only by the online-payment functions (under their
  -- write flag). A person never types "Online, card" (the hand pickers don't offer it; this is the backstop).
  IF v_method = 'online_card' AND coalesce(current_setting('flhq.online_payment_write', true), 'off') <> 'on' THEN
    RETURN QUERY SELECT NULL::uuid, 'method'::text; RETURN;
  END IF;

  IF p_action = 'receive' THEN
    IF v_reg.status IN ('declined','withdrawn') THEN RETURN QUERY SELECT NULL::uuid, 'ended'::text; RETURN; END IF;
    IF v_reg.status <> 'active' THEN RETURN QUERY SELECT NULL::uuid, 'not_accepted'::text; RETURN; END IF;
    IF v_fee - v_got <= 0 THEN RETURN QUERY SELECT NULL::uuid, 'already_received'::text; RETURN; END IF;
    v_amt := coalesce(v_price, v_fee - v_got);
    IF v_amt <= 0 THEN RETURN QUERY SELECT NULL::uuid, 'amount'::text; RETURN; END IF;
    IF v_amt > v_fee - v_got THEN RETURN QUERY SELECT NULL::uuid, 'over'::text; RETURN; END IF;
    IF p_day IS NULL THEN RETURN QUERY SELECT NULL::uuid, 'date'::text; RETURN; END IF;
    v_book := club_league_season_ledger(p_org, p_season);
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes, created_at)
    VALUES (v_book, p_day, v_who || ' — registration fee', v_amt, 'income', 'posted', 'registration_fee',
      'league_registration', p_registration, p_actor, v_method, v_reason, clock_timestamp())
    RETURNING id INTO v_id;

  ELSIF p_action = 'refund' THEN
    IF v_got <= 0 THEN RETURN QUERY SELECT NULL::uuid, 'nothing_received'::text; RETURN; END IF;
    v_amt := coalesce(v_price, v_got);
    IF v_amt <= 0 OR v_amt > v_got THEN RETURN QUERY SELECT NULL::uuid, 'amount'::text; RETURN; END IF;
    IF p_day IS NULL THEN RETURN QUERY SELECT NULL::uuid, 'date'::text; RETURN; END IF;
    v_book := club_league_season_ledger(p_org, p_season);
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes, created_at)
    VALUES (v_book, p_day, v_who || ' — refund', v_amt, 'expense', 'posted', 'registration_refund',
      'league_registration', p_registration, p_actor, v_method, v_reason, clock_timestamp())
    RETURNING id INTO v_id;

  ELSIF p_action = 'undo' THEN
    -- A mistake fix on a live registration only: an ended one's money was answered (refunded or kept) when it ended.
    IF v_reg.status IN ('declined','withdrawn') THEN RETURN QUERY SELECT NULL::uuid, 'ended'::text; RETURN; END IF;
    SELECT * INTO v_line FROM accounting_entries e
     WHERE e.source_module = 'league_registration' AND e.source_entity_id = p_registration
       AND e.status = 'posted' AND e.entry_type = 'income'
     ORDER BY e.created_at DESC LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RETURN QUERY SELECT NULL::uuid, 'nothing_received'::text; RETURN; END IF;
    -- The window named the payment it shows; a different latest one means a second press or a stale window.
    IF p_entry IS NOT NULL AND p_entry IS DISTINCT FROM v_line.id THEN RETURN QUERY SELECT NULL::uuid, 'changed'::text; RETURN; END IF;
    -- ▶ 12b: a card payment really arrived; it comes off only by a refund (drawings m4).
    IF EXISTS (SELECT 1 FROM online_payment_items i WHERE i.entry_id = v_line.id) THEN
      RETURN QUERY SELECT NULL::uuid, 'card'::text; RETURN;
    END IF;
    IF v_got - v_line.amount < 0 THEN RETURN QUERY SELECT NULL::uuid, 'refunded'::text; RETURN; END IF;
    PERFORM club_fee_void(v_line.id, p_actor, coalesce(v_reason, 'Marked received by mistake'));
    v_id := v_line.id;

  ELSE -- price
    IF v_reg.status IN ('declined','withdrawn') THEN RETURN QUERY SELECT NULL::uuid, 'ended'::text; RETURN; END IF;
    IF v_price IS NULL OR v_price < 0 THEN RETURN QUERY SELECT NULL::uuid, 'amount'::text; RETURN; END IF;
    IF v_price = v_fee THEN RETURN QUERY SELECT NULL::uuid, 'same'::text; RETURN; END IF;
    IF v_reason IS NULL THEN RETURN QUERY SELECT NULL::uuid, 'reason'::text; RETURN; END IF;
    IF v_got > v_price THEN
      -- Paid more than the new price: the difference goes back to the family, its own line out.
      IF p_day IS NULL THEN RETURN QUERY SELECT NULL::uuid, 'date'::text; RETURN; END IF;
      v_book := club_league_season_ledger(p_org, p_season);
      INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
        source_module, source_entity_id, created_by, payment_method, notes, created_at)
      VALUES (v_book, p_day, v_who || ' — refund', v_got - v_price, 'expense', 'posted', 'registration_refund',
        'league_registration', p_registration, p_actor, v_method, v_reason, clock_timestamp())
      RETURNING id INTO v_id;
    END IF;
    INSERT INTO league_registration_price_changes(org_id, season_id, registration_id, kind, old_amount, new_amount,
      reason, refund_entry_id, changed_by)
    VALUES (p_org, p_season, p_registration, 'corrected', v_fee, v_price, v_reason, v_id, p_actor);
    UPDATE league_registrations r SET fee_amount = v_price, updated_at = now() WHERE r.id = p_registration;
  END IF;

  PERFORM league_reg_money_sync(p_registration);
  RETURN QUERY SELECT v_id, NULL::text;
END $$;
REVOKE ALL ON FUNCTION public.club_league_money(uuid,uuid,uuid,text,numeric,date,text,text,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_league_money(uuid,uuid,uuid,text,numeric,date,text,text,uuid,uuid) TO service_role;

-- ── 7. A season's "Payment processing" word and line ───────────────────────────────────────────
-- A money-out word by name under the club's one House league registration fees category (mig 371/372's), so a club-paid
-- processing fee and a fee the club gives back on a refund read as a COST on the Statement — never as a fee refund (a
-- 'league_registration' expense nets fees: isFeeRefund). One word for every season; each season's line stays on that
-- season's own book. Creating it takes only an advisory lock (mig 372's rule: no row lock inside a money write). A word
-- of that name that is money IN is never reused for money out: the line is then filed under the category with no word.
CREATE OR REPLACE FUNCTION public.club_league_out_word(p_season uuid, p_name text)
RETURNS TABLE(category_id uuid, item_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_dir text; v_next integer;
BEGIN
  SELECT w.category_id INTO category_id FROM club_league_fee_word(p_season) w;
  SELECT c.org_id INTO v_org FROM budget_categories c WHERE c.id = category_id;
  SELECT i.id, i.direction INTO item_id, v_dir FROM budget_items i
   WHERE i.category_id = club_league_out_word.category_id AND lower(i.name) = lower(p_name)
   ORDER BY (i.direction = 'out') DESC LIMIT 1;
  IF item_id IS NOT NULL AND v_dir <> 'out' THEN item_id := NULL; RETURN NEXT; RETURN; END IF;
  IF item_id IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('club_league_out_word:' || category_id::text || ':' || lower(p_name), 0));
    SELECT i.id INTO item_id FROM budget_items i
     WHERE i.category_id = club_league_out_word.category_id AND lower(i.name) = lower(p_name) AND i.direction = 'out' LIMIT 1;
    IF item_id IS NULL THEN
      SELECT coalesce(max(b.sort_order), 0) + 1 INTO v_next FROM budget_items b WHERE b.category_id = club_league_out_word.category_id;
      INSERT INTO budget_items(category_id, org_id, name, direction, actual_source, is_default, sort_order)
      VALUES (club_league_out_word.category_id, v_org, p_name, 'out', 'typed', false, v_next) RETURNING id INTO item_id;
    END IF;
  END IF;
  RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION public.club_league_out_word(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_league_out_word(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.online_payment_league_post_out(
  p_season uuid, p_word text, p_day date, p_description text, p_amount numeric, p_source_id uuid, p_actor uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_cat uuid; v_item uuid; v_book uuid; v_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_day IS NULL THEN RAISE EXCEPTION 'A money-out line needs a positive amount and day'; END IF;
  SELECT s.org_id INTO v_org FROM league_seasons s WHERE s.id = p_season;
  IF v_org IS NULL THEN RAISE EXCEPTION 'House league season not found'; END IF;
  -- A word that can't be made leaves the line unfiled (mig 372's rule): the cost is never refused for a budget word.
  BEGIN
    SELECT w.category_id, w.item_id INTO v_cat, v_item FROM club_league_out_word(p_season, p_word) w;
  EXCEPTION WHEN others THEN
    IF SQLSTATE ~ '^(40|53|57)' OR SQLSTATE = '55P03' THEN RAISE; END IF;
    v_cat := NULL; v_item := NULL;
    RAISE WARNING 'payment processing line left unfiled (season %): %', p_season, SQLERRM;
  END;
  v_book := club_league_season_ledger(v_org, p_season);
  INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category, source_module,
    source_entity_id, created_by, budget_category_id, budget_item_id, payment_method)
  VALUES (v_book, p_day, left(p_description, 500), round(p_amount, 2), 'expense', 'posted', NULL, 'online_payment',
    p_source_id, p_actor, v_cat, v_item, 'online_card')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_league_post_out(uuid, text, date, text, numeric, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_league_post_out(uuid, text, date, text, numeric, uuid, uuid) TO service_role;

-- ── 8a. Opening a house-league payment: the payment and its children, atomically ───────────────
-- Called once the Checkout Session exists (the pay route, as 12a's): p_items is [{registrationId, description, amount,
-- feeShare}]. The base is the sum of the children; the fee shares sum to the fee. Every child is a registration of this
-- club's season. A second open payment for the sign-up meets the one-open index: the caller expires its own session.
CREATE OR REPLACE FUNCTION public.online_payment_league_open(
  p_id uuid, p_org uuid, p_stripe_account text, p_season uuid, p_signup_key text, p_description text, p_payer_email text,
  p_fee_amount numeric, p_fee_payer text, p_fee_pct numeric, p_fee_flat numeric, p_livemode boolean, p_session text,
  p_items jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_base numeric(12,2); v_shares numeric(12,2); v_count integer; v_known integer; v_fee numeric(12,2) := round(p_fee_amount, 2);
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A house-league payment covers at least one child';
  END IF;
  SELECT count(*), sum(round((i ->> 'amount')::numeric, 2)), sum(round(coalesce((i ->> 'feeShare')::numeric, 0), 2))
    INTO v_count, v_base, v_shares FROM jsonb_array_elements(p_items) i;
  IF v_shares IS DISTINCT FROM v_fee THEN RAISE EXCEPTION 'The children''s fee shares must add up to the fee'; END IF;
  SELECT count(*) INTO v_known FROM jsonb_array_elements(p_items) i
    JOIN league_registrations r ON r.id = (i ->> 'registrationId')::uuid AND r.org_id = p_org AND r.season_id = p_season;
  IF v_known <> v_count THEN RAISE EXCEPTION 'Every child must be a registration of this season'; END IF;
  -- /dba: a family never opens a payment for a child who can't take it (accepted, and no more than is still owing). The
  -- pay route re-reads the same before Stripe is asked; this is the backstop, and the landing still refuses a late change.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) i
               JOIN league_registrations r ON r.id = (i ->> 'registrationId')::uuid
               JOIN league_seasons s ON s.id = r.season_id
              WHERE r.status <> 'active'
                 OR round((i ->> 'amount')::numeric, 2) > coalesce(r.fee_amount, s.registration_fee, 0) - league_reg_received(r.id)) THEN
    RAISE EXCEPTION 'A child in this payment no longer owes it';
  END IF;
  -- /review: a child is in at most ONE open payment, whatever sign-up key opened it — two payable pages for one child
  -- would let a family pay twice.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) i
               JOIN online_payment_items oi ON oi.registration_id = (i ->> 'registrationId')::uuid
               JOIN online_payments p ON p.id = oi.online_payment_id AND p.status = 'open') THEN
    RAISE EXCEPTION 'A payment for a child in this sign-up is already open';
  END IF;

  INSERT INTO online_payments(id, org_id, stripe_account_id, flow, season_id, signup_key, scope, description, payer_email,
    base_amount, fee_amount, total_amount, fee_payer, fee_pct, fee_flat, livemode, stripe_checkout_session_id)
  VALUES (p_id, p_org, p_stripe_account, 'league_signup', p_season, p_signup_key, 'full', left(p_description, 500),
    nullif(btrim(coalesce(p_payer_email, '')), ''), v_base, v_fee,
    CASE WHEN p_fee_payer = 'family' THEN v_base + v_fee ELSE v_base END, p_fee_payer, p_fee_pct, p_fee_flat,
    coalesce(p_livemode, false), p_session);

  PERFORM set_config('flhq.online_payment_write', 'on', true);
  INSERT INTO online_payment_items(online_payment_id, org_id, registration_id, description, amount, fee_share)
  SELECT p_id, p_org, (i ->> 'registrationId')::uuid, left(i ->> 'description', 300), round((i ->> 'amount')::numeric, 2),
         round(coalesce((i ->> 'feeShare')::numeric, 0), 2)
    FROM jsonb_array_elements(p_items) i
   -- /review: each insert takes the registration's key-share lock through its FK; id order, as the landing locks them.
   ORDER BY (i ->> 'registrationId')::uuid;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_league_open(uuid, uuid, text, uuid, text, text, text, numeric, text, numeric, numeric, boolean, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_league_open(uuid, uuid, text, uuid, text, text, text, numeric, text, numeric, numeric, boolean, text, jsonb) TO service_role;

-- ── 8b. The landing: Stripe says paid → each child's fee through THE house-league writer ───────
-- One transaction, idempotent (a landed payment answers {already:true}; a replayed webhook writes nothing). Lock order is
-- the ending's (mig 369): the season, then the registrations (id order), then this payment, then its items — so a Mark
-- received, an ending and this landing on one child queue rather than deadlock, and whichever comes second sees the
-- first. The day is the payment's day in Toronto, clamped to today, and moved to today when it sits inside a closed
-- fiscal year (the tournament landing's rule, mig 358) — the real moment stays in paid_at.
-- A child the writer refuses (declined or withdrawn in the meantime, marked received by hand, more than is owing) keeps
-- the payment PAID: that child's item carries the refusal and the caller raises Needs attention with the refund door.
-- Stripe has the money either way; nothing is lost and nothing is written twice.
CREATE OR REPLACE FUNCTION public.online_payment_league_land(
  p_online_payment uuid, p_paid_at timestamptz, p_payment_intent text, p_charge text, p_brand text, p_last4 text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_day date; v_closed date; v_receipt bigint; v_it public.online_payment_items%ROWTYPE;
  v_entry uuid; v_refusal text; v_cost uuid; v_landed integer := 0; v_unrecorded jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.flow <> 'league_signup' THEN RAISE EXCEPTION 'Not a house-league payment'; END IF;
  IF v_op.landed_at IS NOT NULL OR v_op.status IN ('partly_refunded', 'refunded') THEN
    RETURN jsonb_build_object('already', true, 'receiptNo', v_op.receipt_no);
  END IF;
  IF v_op.season_id IS NULL THEN RAISE EXCEPTION 'The house-league season is gone.'; END IF;

  PERFORM 1 FROM league_seasons s WHERE s.id = v_op.season_id FOR NO KEY UPDATE;
  PERFORM 1 FROM league_registrations r
   WHERE r.id IN (SELECT i.registration_id FROM online_payment_items i WHERE i.online_payment_id = v_op.id)
   ORDER BY r.id FOR UPDATE;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;
  IF v_op.landed_at IS NOT NULL OR v_op.status IN ('partly_refunded', 'refunded') THEN
    RETURN jsonb_build_object('already', true, 'receiptNo', v_op.receipt_no);
  END IF;

  v_day := least((p_paid_at AT TIME ZONE 'America/Toronto')::date, v_today);
  v_closed := club_books_closed_through(v_op.org_id);
  IF v_closed IS NOT NULL AND v_day <= v_closed THEN v_day := v_today; END IF;
  v_receipt := coalesce(v_op.receipt_no, nextval('online_payment_receipt_seq'));

  PERFORM set_config('flhq.online_payment_write', 'on', true);
  FOR v_it IN SELECT * FROM online_payment_items i WHERE i.online_payment_id = v_op.id AND i.entry_id IS NULL
               ORDER BY i.created_at, i.id FOR UPDATE LOOP
    v_entry := NULL; v_refusal := NULL;
    IF v_it.registration_id IS NULL THEN
      v_refusal := 'gone';
    ELSE
      BEGIN
        -- THE house-league writer (mig 369), with no person behind it: Stripe's answer.
        SELECT m.entry, m.refusal INTO v_entry, v_refusal
          FROM club_league_money(v_op.org_id, v_op.season_id, v_it.registration_id, 'receive', v_it.amount, v_day,
                                 'online_card', NULL, NULL) m;
      EXCEPTION WHEN others THEN
        -- /dba + /review: a passing failure is the WHOLE landing's to retry (Stripe redelivers); kept, it would stamp a
        -- child unrecorded for good. Classes 40 (rollback), 53 (resources), 57 (operator), and 55P03 (lock not available).
        IF SQLSTATE ~ '^(40|53|57)' OR SQLSTATE = '55P03' THEN RAISE; END IF;
        v_entry := NULL; v_refusal := left('error: ' || SQLERRM, 500);
      END;
    END IF;
    IF v_refusal IS NULL AND v_entry IS NOT NULL THEN
      UPDATE online_payment_items SET entry_id = v_entry, land_error = NULL, updated_at = now() WHERE id = v_it.id;
      v_landed := v_landed + 1;
    ELSE
      v_refusal := coalesce(v_refusal, 'not_recorded');
      UPDATE online_payment_items SET land_error = v_refusal, updated_at = now() WHERE id = v_it.id;
      v_unrecorded := v_unrecorded || jsonb_build_array(jsonb_build_object('itemId', v_it.id,
        'registrationId', v_it.registration_id, 'refusal', v_refusal, 'amount', v_it.amount, 'description', v_it.description));
    END IF;
  END LOOP;

  -- The club pays the fee (A14): one "Payment processing" cost per payment — never less fee revenue. Stripe charged the
  -- fee on the whole payment, so it is the club's cost even when a child's share couldn't land.
  IF v_op.fee_payer = 'club' AND v_op.fee_amount > 0 AND v_op.processing_cost_entry_id IS NULL THEN
    v_cost := online_payment_league_post_out(v_op.season_id, 'Payment processing', v_day,
      'Payment processing · ' || v_op.description, v_op.fee_amount, v_op.id, NULL);
  END IF;

  UPDATE online_payments SET status = 'paid', paid_at = p_paid_at, paid_on = v_day, landed_at = now(),
    land_error = CASE WHEN jsonb_array_length(v_unrecorded) > 0
      THEN left('Not recorded for ' || jsonb_array_length(v_unrecorded) || ' of ' || (v_landed + jsonb_array_length(v_unrecorded))
                || ' children', 500) END,
    stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
    stripe_charge_id = coalesce(p_charge, stripe_charge_id), card_brand = coalesce(p_brand, card_brand),
    card_last4 = coalesce(p_last4, card_last4), receipt_no = v_receipt,
    processing_cost_entry_id = coalesce(v_cost, processing_cost_entry_id), updated_at = now()
  WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN jsonb_build_object('already', false, 'receiptNo', v_receipt, 'day', v_day, 'landed', v_landed,
    'unrecorded', v_unrecorded);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_league_land(uuid, timestamptz, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_league_land(uuid, timestamptz, text, text, text, text) TO service_role;

COMMIT;
