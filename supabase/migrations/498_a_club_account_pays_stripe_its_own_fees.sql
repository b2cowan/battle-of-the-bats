-- ---------------------------------------------------------------
-- Migration 498 — Stripe-owned pricing, Stage 2: a club's account pays Stripe its own fees, and every payment keeps what
-- FieldLogicHQ took (plan docs/projects/active/STRIPE_OWNED_PRICING_PLAN.md Stage 2; build prompt
-- STRIPE_OWNED_PRICING_STAGE2_BUILD_PROMPT.md; owner rulings 2026-11-17 R3 + rate design A, and 2026-11-18 "refuse and
-- re-create" for the old dev accounts).
--
-- WHY: every club account is now created with fees_collector = 'stripe' (Stripe takes its own fee from the club's balance),
-- so our application fee is the processing fee LESS Stripe's standard cost — no longer equal to fee_amount. Stripe Tax never
-- sees an application fee, so this per-payment figure is the only source for our GST/HST return (/accounting 2026-11-17),
-- and it must be the figure Stripe was told when the Checkout opened, never recomputed from a price that can move.
-- The fee setting is immutable per Stripe account, so each account records which one it was made with.
--
-- WHAT CHANGES
--   online_payments.application_fee_amount   NEW, numeric(12,2) NOT NULL, 0 <= x <= fee_amount (CHECK): every
--       existing row is backfilled with its fee_amount (under the old setting the application fee WAS the whole fee).
--       Written by the team pay route's insert and by online_payment_league_open; frozen by the guard thereafter.
--   online_payments_guard()                  ▶ 498: application_fee_amount joins the frozen columns.
--   online_payment_league_open(...)          ▶ 498: a new REQUIRED argument p_application_fee (the old signature dropped).
--   org_payment_accounts.fees_collector      NEW, text NOT NULL CHECK ('application' | 'stripe'), no default: the one
--       account creation writes it. Existing rows are 'application' (dev only: three clubs; production has none).
--   The 'application' rows still connected are marked disconnected now (owner 2026-11-18: an old-setting account opens no
--       new payment; "Set up payouts again" makes a new Stripe-owned account in its place). This runs as data in the
--       migration, not through the Disconnect button, so it writes no audit row and closes no open pay page — dev only.
--
-- NOT HERE: Stripe's real fee per payment in the club's books (Stage 3); retiring the recovered-fee tables (Stage 4).
-- ---------------------------------------------------------------

-- 1. What we took, per payment.
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS application_fee_amount numeric(12,2);
UPDATE public.online_payments SET application_fee_amount = fee_amount WHERE application_fee_amount IS NULL;
ALTER TABLE public.online_payments ALTER COLUMN application_fee_amount SET NOT NULL;
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_application_fee_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_application_fee_chk
  CHECK (application_fee_amount >= 0 AND application_fee_amount <= fee_amount);
COMMENT ON COLUMN public.online_payments.application_fee_amount IS
  'FieldLogicHQ''s application fee on this payment, as Stripe was told when the Checkout opened: the fee less Stripe''s standard cost (Stripe-owned pricing, mig 498); = fee_amount on payments opened before it. GST/HST included (R1). Never recomputed.';

-- 2. The guard: mig 390's, with the new column frozen (▶ 498).
CREATE OR REPLACE FUNCTION public.online_payments_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'open' OR NEW.paid_at IS NOT NULL OR NEW.landed_at IS NOT NULL OR NEW.receipt_no IS NOT NULL
       OR NEW.stripe_payment_intent_id IS NOT NULL OR NEW.processing_cost_entry_id IS NOT NULL
       OR NEW.bank_last4 IS NOT NULL OR NEW.clearing_at IS NOT NULL OR NEW.returned_at IS NOT NULL
       OR NEW.return_reason IS NOT NULL OR NEW.return_detail IS NOT NULL OR NEW.reversed_at IS NOT NULL
       OR NEW.stripe_dispute_id IS NOT NULL OR NEW.over_amount IS NOT NULL OR NEW.over_whole IS NOT NULL THEN
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

-- 3. The house-league opening: mig 382's, with the application fee as a required argument (▶ 498). The old signature is
--    dropped so a caller that forgets it fails loudly instead of storing a guess.
DROP FUNCTION IF EXISTS public.online_payment_league_open(uuid, uuid, text, uuid, text, text, text, numeric, text, numeric, numeric, boolean, text, jsonb, text);
CREATE OR REPLACE FUNCTION public.online_payment_league_open(
  p_id uuid, p_org uuid, p_stripe_account text, p_season uuid, p_signup_key text, p_description text, p_payer_email text,
  p_fee_amount numeric, p_application_fee numeric, p_fee_payer text, p_fee_pct numeric, p_fee_flat numeric,
  p_livemode boolean, p_session text, p_items jsonb, p_rail text DEFAULT 'card'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_base numeric(12,2); v_shares numeric(12,2); v_count integer; v_known integer; v_fee numeric(12,2) := round(p_fee_amount, 2);
  v_app numeric(12,2) := round(p_application_fee, 2); -- ▶ 498
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A house-league payment covers at least one child';
  END IF;
  IF v_app IS NULL OR v_app <= 0 OR v_app > v_fee THEN -- ▶ 498
    RAISE EXCEPTION 'The application fee must be above zero and no more than the fee';
  END IF;
  SELECT count(*), sum(round((i ->> 'amount')::numeric, 2)), sum(round(coalesce((i ->> 'feeShare')::numeric, 0), 2))
    INTO v_count, v_base, v_shares FROM jsonb_array_elements(p_items) i;
  IF v_shares IS DISTINCT FROM v_fee THEN RAISE EXCEPTION 'The children''s fee shares must add up to the fee'; END IF;
  SELECT count(*) INTO v_known FROM jsonb_array_elements(p_items) i
    JOIN league_registrations r ON r.id = (i ->> 'registrationId')::uuid AND r.org_id = p_org AND r.season_id = p_season;
  IF v_known <> v_count THEN RAISE EXCEPTION 'Every child must be a registration of this season'; END IF;
  -- A family never opens a payment for a child who can't take it (accepted, and no more than is still owing). The pay
  -- route re-reads the same before Stripe is asked; this is the backstop, and the landing still refuses a late change.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) i
               JOIN league_registrations r ON r.id = (i ->> 'registrationId')::uuid
               JOIN league_seasons s ON s.id = r.season_id
              WHERE r.status <> 'active'
                 OR round((i ->> 'amount')::numeric, 2) > coalesce(r.fee_amount, s.registration_fee, 0) - league_reg_received(r.id)) THEN
    RAISE EXCEPTION 'A child in this payment no longer owes it';
  END IF;
  -- A child is in at most ONE open or clearing payment, whatever sign-up key opened it — two payable pages for one child,
  -- or a page while a bank debit clears, would let a family pay twice (▶ 382: §0j 6).
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_items) i
               JOIN online_payment_items oi ON oi.registration_id = (i ->> 'registrationId')::uuid
               JOIN online_payments p ON p.id = oi.online_payment_id AND p.status IN ('open', 'clearing')) THEN
    RAISE EXCEPTION 'A payment for a child in this sign-up is already open';
  END IF;

  INSERT INTO online_payments(id, org_id, stripe_account_id, flow, season_id, signup_key, scope, description, payer_email,
    base_amount, fee_amount, application_fee_amount, total_amount, fee_payer, fee_pct, fee_flat, livemode,
    stripe_checkout_session_id, rail)
  VALUES (p_id, p_org, p_stripe_account, 'league_signup', p_season, p_signup_key, 'full', left(p_description, 500),
    nullif(btrim(coalesce(p_payer_email, '')), ''), v_base, v_fee, v_app,
    CASE WHEN p_fee_payer = 'family' THEN v_base + v_fee ELSE v_base END, p_fee_payer, p_fee_pct, p_fee_flat,
    coalesce(p_livemode, false), p_session, coalesce(p_rail, 'card'));

  PERFORM set_config('flhq.online_payment_write', 'on', true);
  INSERT INTO online_payment_items(online_payment_id, org_id, registration_id, description, amount, fee_share)
  SELECT p_id, p_org, (i ->> 'registrationId')::uuid, left(i ->> 'description', 300), round((i ->> 'amount')::numeric, 2),
         round(coalesce((i ->> 'feeShare')::numeric, 0), 2)
    FROM jsonb_array_elements(p_items) i
   -- Each insert takes the registration's key-share lock through its FK; id order, as the landing locks them.
   ORDER BY (i ->> 'registrationId')::uuid;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_league_open(uuid, uuid, text, uuid, text, text, text, numeric, numeric, text, numeric, numeric, boolean, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_league_open(uuid, uuid, text, uuid, text, text, text, numeric, numeric, text, numeric, numeric, boolean, text, jsonb, text) TO service_role;

-- 4. Each account's fee setting, as it was created (immutable at Stripe, so never changed here either).
ALTER TABLE public.org_payment_accounts ADD COLUMN IF NOT EXISTS fees_collector text;
UPDATE public.org_payment_accounts SET fees_collector = 'application' WHERE fees_collector IS NULL;
ALTER TABLE public.org_payment_accounts ALTER COLUMN fees_collector SET NOT NULL;
ALTER TABLE public.org_payment_accounts DROP CONSTRAINT IF EXISTS org_payment_accounts_fees_collector_chk;
ALTER TABLE public.org_payment_accounts ADD CONSTRAINT org_payment_accounts_fees_collector_chk
  CHECK (fees_collector IN ('application', 'stripe'));
COMMENT ON COLUMN public.org_payment_accounts.fees_collector IS
  'Who pays Stripe''s fees on this Stripe account, as it was created (immutable at Stripe): ''stripe'' = the club''s balance (Stripe-owned pricing, every account since mig 498); ''application'' = FieldLogicHQ (the old setting; opens no new payment).';

-- 5. The old-setting accounts still connected stop taking payments (owner 2026-11-18). Dev only; production has none.
UPDATE public.org_payment_accounts
   SET disconnected_at = now(), disconnected_by = NULL, updated_at = now()
 WHERE fees_collector = 'application' AND disconnected_at IS NULL;
