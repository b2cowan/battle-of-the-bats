-- ---------------------------------------------------------------
-- Migration 382 — Club Tier Stage 12c Part 1: a team's card payment can be refunded in part (and lowers that team's
-- entry), a refund made in Stripe can be recorded on its own, and a payment can be a bank debit that clears.
-- Plan: docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md §0f, §0g, §0j, §0k (owner rulings 2026-10-26).
--
-- WHY:
--   A. §0j 1–4: a tournament can refund PART of a team's online payment, with a reason, never including the processing
--      fee, and the part refund LOWERS THAT TEAM'S ENTRY by the same amount, so the refund is never owed back. A full
--      refund still makes the team owe, as today. 12a's database refused any amount on a team refund (mig 376).
--   B. §0k 1: the lowered entry is a LIST — one adjustment per part refund, with its amount, day and reason ("made in
--      Stripe" when it has none) — stored as a reduction, so a later fee change still applies. Only a part refund writes
--      one; nobody types it. A team's fee is read in six places (mig 345's tournament_team_fee and five TypeScript
--      readers); they all read teams.entry_lowered, the cache this migration keeps.
--   C. §0g 5: a refund made in the club's Stripe dashboard records itself whenever it can be pinned. A part refund on a
--      payment for two children is split by a person ("whose was it?"), so ONE Stripe refund may become two refund rows,
--      one per child: the Stripe-id key becomes (stripe refund, child). A dashboard part refund carries no reason.
--   D. §0j 5–8, §0k: a payment can be a Canadian pre-authorized debit. It is CLEARING from the moment the family finishes
--      Stripe's page until the bank settles it (up to 5 business days): no book line, no receipt number, the spot held,
--      and no second payment may open for it. It lands through the flow's own writer when Stripe says it succeeded, or is
--      RETURNED (nothing taken, no book touched). The reversal after it cleared (a dispute) writes its book line in a later
--      12c migration (Part 6); its columns are here.
--
-- WHAT CHANGES:
--   1. tournament_team_payments.refunded_amount (part refunds Stripe accepted, never the fee); method 'online_bank'; the
--      guard (mig 358) covers both.
--   2. tournament_team_entry_adjustments (NEW) + teams.entry_lowered (its cache, kept by a trigger).
--   3. tournament_team_fee (mig 345) reads the lowered entry; team_payments_refresh (mig 345) sums each posted row net of
--      its part refunds.
--   4. online_payment_refunds.part_refund; the Stripe-id key per child; the guard (mig 375) covers part_refund.
--   5. online_payment_refund_open (mig 376, same signature): the team branch takes a part; a dashboard refund needs no
--      reason in either flow.
--   6. online_payment_team_refund_book (NEW): a team part refund's row, book line and entry adjustment, the moment
--      Stripe accepts it — house league's rule (mig 375), so the team's figures never disagree with the card.
--      A returned part refund keeps its line and its adjustment (the club still owes it): it is sent another way with
--      online_payment_league_refund_resolve (mig 375), which is flow-blind.
--   7. online_payments: rail 'bank_debit', bank_last4, clearing_at, returned_at, return_reason, return_detail,
--      reversed_at, stripe_dispute_id; statuses 'clearing', 'returned', 'reversed'; one open OR clearing payment per team
--      and per sign-up; the guard (mig 374) covers the new columns.
--   8. online_payment_clearing / online_payment_returned (NEW). online_payment_land (mig 358), online_payment_league_land
--      and online_payment_league_open (mig 374), online_payment_land_failed (mig 359), online_payment_league_refund_book
--      (mig 375) and club_league_money (mig 374) learn the rail: method 'online_bank', a returned debit never lands, a
--      child on a clearing debit can't be put in a second payment.
--
-- ⚠ LOCK ORDER (mig 358's): tournament → team → payment → refund → ledger lines; house league (mig 369/375): season →
-- registrations (id order) → payment → items → refund.
-- ⚠ The write flag `flhq.online_payment_write` is transaction-local and is set back to 'off' before each function returns.
-- RLS: the new table is service-role only, like every Stage 12 table.
-- ---------------------------------------------------------------

BEGIN;

-- ── 1. A team's payment row: part refunds, and the bank-debit method ────────────────────────────
ALTER TABLE public.tournament_team_payments ADD COLUMN IF NOT EXISTS refunded_amount numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.tournament_team_payments DROP CONSTRAINT IF EXISTS tournament_team_payments_refunded_amount_chk;
ALTER TABLE public.tournament_team_payments ADD CONSTRAINT tournament_team_payments_refunded_amount_chk
  CHECK (refunded_amount >= 0 AND refunded_amount <= amount);
ALTER TABLE public.tournament_team_payments DROP CONSTRAINT IF EXISTS tournament_team_payments_method_chk;
ALTER TABLE public.tournament_team_payments ADD CONSTRAINT tournament_team_payments_method_chk
  CHECK (method IS NULL OR method IN ('etransfer', 'cash', 'cheque', 'card', 'other', 'online_card', 'online_bank'));

-- Mig 358's guard with refunded_amount and 'online_bank' (marked ▶ 382).
CREATE OR REPLACE FUNCTION public.tournament_team_payments_online_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.online_payment_id IS NOT NULL OR NEW.method IN ('online_card', 'online_bank') OR NEW.status = 'refunded'
       OR NEW.refunded_amount <> 0 THEN -- ▶ 382
      RAISE EXCEPTION 'An online payment is recorded by the payment itself.';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.online_payment_id IS NOT NULL THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.paid_on IS DISTINCT FROM OLD.paid_on
       OR NEW.method IS DISTINCT FROM OLD.method OR NEW.team_id IS DISTINCT FROM OLD.team_id
       OR NEW.online_payment_id IS DISTINCT FROM OLD.online_payment_id OR NEW.entry_id IS DISTINCT FROM OLD.entry_id
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.refunded_amount IS DISTINCT FROM OLD.refunded_amount THEN -- ▶ 382
      RAISE EXCEPTION 'An online payment is changed by refunding it to the card.';
    END IF;
  ELSIF NEW.online_payment_id IS NOT NULL OR NEW.method IN ('online_card', 'online_bank') OR NEW.status = 'refunded'
        OR NEW.refunded_amount <> 0 THEN -- ▶ 382
    RAISE EXCEPTION 'An online payment is recorded by the payment itself.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tournament_team_payments_online_guard() FROM PUBLIC, anon, authenticated;

-- ── 2. A team's entry, lowered by a part refund ─────────────────────────────────────────────────
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS entry_lowered numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_entry_lowered_chk;
ALTER TABLE public.teams ADD CONSTRAINT teams_entry_lowered_chk CHECK (entry_lowered >= 0);
COMMENT ON COLUMN public.teams.entry_lowered IS 'How much this team''s entry fee is lowered by part refunds (mig 382): the sum of its tournament_team_entry_adjustments, kept by a trigger. Every reader of a team''s fee subtracts it.';

CREATE TABLE IF NOT EXISTS public.tournament_team_entry_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  tournament_id uuid NOT NULL,
  org_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  -- The part refund's reason, which the team read in its refund email. NULL only for a refund made in Stripe.
  reason text,
  origin text NOT NULL DEFAULT 'app',
  -- Only a part refund lowers an entry: one adjustment per refund, never typed.
  refund_id uuid NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tournament_team_entry_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT tournament_team_entry_adjustments_team_fk FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE,
  CONSTRAINT tournament_team_entry_adjustments_tournament_fk FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE,
  CONSTRAINT tournament_team_entry_adjustments_org_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT tournament_team_entry_adjustments_refund_fk FOREIGN KEY (refund_id) REFERENCES public.online_payment_refunds(id),
  CONSTRAINT tournament_team_entry_adjustments_created_by_fk FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT tournament_team_entry_adjustments_amount_chk CHECK (amount > 0 AND amount <= 1000000),
  CONSTRAINT tournament_team_entry_adjustments_origin_chk CHECK (origin IN ('app', 'stripe_dashboard')),
  CONSTRAINT tournament_team_entry_adjustments_reason_chk CHECK (
    (reason IS NULL OR char_length(reason) BETWEEN 1 AND 500) AND (origin <> 'app' OR reason IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS tournament_team_entry_adjustments_refund_key ON public.tournament_team_entry_adjustments(refund_id);
CREATE INDEX IF NOT EXISTS tournament_team_entry_adjustments_team_idx ON public.tournament_team_entry_adjustments(team_id, created_at);
CREATE INDEX IF NOT EXISTS tournament_team_entry_adjustments_tournament_idx ON public.tournament_team_entry_adjustments(tournament_id);
CREATE INDEX IF NOT EXISTS tournament_team_entry_adjustments_org_idx ON public.tournament_team_entry_adjustments(org_id);
CREATE INDEX IF NOT EXISTS tournament_team_entry_adjustments_created_by_idx ON public.tournament_team_entry_adjustments(created_by)
  WHERE created_by IS NOT NULL;
ALTER TABLE public.tournament_team_entry_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tournament_team_entry_adjustments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_team_entry_adjustments TO service_role;
COMMENT ON TABLE public.tournament_team_entry_adjustments IS 'One row per part refund of a team''s online payment (mig 382): the team''s entry is lowered by the refund, so the refund is never owed back (owner ruling §0j 3). Written only by online_payment_team_refund_book; never changed.';

-- Written only by the part refund's booking (under the write flag); never changed afterwards. No DELETE guard: teams,
-- tournaments and organizations cascade into this table.
CREATE OR REPLACE FUNCTION public.tournament_team_entry_adjustments_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'A team''s entry is lowered only by a part refund.';
END $$;
REVOKE ALL ON FUNCTION public.tournament_team_entry_adjustments_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS tournament_team_entry_adjustments_guard ON public.tournament_team_entry_adjustments;
CREATE TRIGGER tournament_team_entry_adjustments_guard BEFORE INSERT OR UPDATE ON public.tournament_team_entry_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.tournament_team_entry_adjustments_guard();

-- The cache follows the list, in the same statement. On DELETE too (/dba): a service-role delete must not leave the
-- cache stale; under a team's cascade the team row is already gone and the update touches nothing.
CREATE OR REPLACE FUNCTION public.tournament_team_entry_lowered_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.team_id ELSE NEW.team_id END;
BEGIN
  UPDATE teams t SET entry_lowered = (SELECT coalesce(sum(a.amount), 0) FROM tournament_team_entry_adjustments a WHERE a.team_id = v_team)
   WHERE t.id = v_team;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.tournament_team_entry_lowered_sync() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS tournament_team_entry_lowered_sync ON public.tournament_team_entry_adjustments;
CREATE TRIGGER tournament_team_entry_lowered_sync AFTER INSERT OR DELETE ON public.tournament_team_entry_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.tournament_team_entry_lowered_sync();

-- ── 3. The fee and the paid figure read the lowered entry and the part refunds ──────────────────
-- Mig 345's fee less the team's lowered entry (never below zero; the deposit never above the entry). A fee of 0 is no
-- fee, decided on the schedule's own figure, so a team whose entry is lowered to nothing is paid in full, not fee-less.
CREATE OR REPLACE FUNCTION public.tournament_team_fee(p_team uuid)
RETURNS TABLE(total numeric, deposit numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE WHEN f.base IS NULL THEN NULL ELSE greatest(f.base - f.lowered, 0) END,
    CASE WHEN f.base IS NULL OR f.dep IS NULL THEN f.dep ELSE least(f.dep, greatest(f.base - f.lowered, 0)) END
  FROM (
    SELECT
      nullif(CASE WHEN tr.fee_schedule_mode = 'division' AND d.total_fee_amount IS NOT NULL THEN d.total_fee_amount ELSE tr.total_fee_amount END, 0) AS base,
      CASE WHEN tr.fee_schedule_mode = 'division' AND d.total_fee_amount IS NOT NULL THEN d.deposit_amount ELSE tr.deposit_amount END AS dep,
      t.entry_lowered AS lowered
    FROM teams t
    JOIN tournaments tr ON tr.id = t.tournament_id
    LEFT JOIN divisions d ON d.id = t.division_id
    WHERE t.id = p_team
  ) f
$$;

-- Mig 345's cache writer: each posted row counts net of its part refunds (marked ▶ 382). Same signature.
CREATE OR REPLACE FUNCTION public.team_payments_refresh(p_team uuid, p_actor uuid, p_mode text DEFAULT 'live', p_completed_on date DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team public.teams%ROWTYPE; v_fee_total numeric; v_fee_dep numeric; v_sum numeric(12,2); v_dep numeric(12,2);
  v_status text; v_became_paid boolean := false; v_became_unpaid boolean := false; v_collected timestamptz; v_day date;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
BEGIN
  SELECT * INTO v_team FROM teams WHERE id = p_team;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;
  SELECT f.total, f.deposit INTO v_fee_total, v_fee_dep FROM tournament_team_fee(p_team) f;
  -- ▶ 382: net of part refunds.
  SELECT coalesce(sum(amount - refunded_amount), 0) INTO v_sum FROM tournament_team_payments WHERE team_id = p_team AND status = 'posted';
  v_dep := CASE WHEN v_fee_dep IS NULL THEN 0 ELSE least(v_sum, v_fee_dep) END;
  v_status := v_team.payment_status;
  v_collected := v_team.payment_collected_at;
  IF p_mode = 'live' AND v_fee_total IS NOT NULL THEN
    IF v_sum >= v_fee_total THEN
      v_status := 'paid';
      IF v_team.payment_status IS DISTINCT FROM 'paid' THEN v_became_paid := true; END IF;
      -- The day the payment that completed the fee arrived (an undated "Earlier payment" completing it leaves the stamp alone).
      SELECT r.d INTO v_day FROM (
        SELECT paid_on AS d, sum(amount - refunded_amount) OVER (ORDER BY coalesce(paid_on, date '1900-01-01'), ordinal) AS running -- ▶ 382
        FROM tournament_team_payments WHERE team_id = p_team AND status = 'posted'
      ) r WHERE r.running >= v_fee_total ORDER BY r.running LIMIT 1;
      IF v_day IS NOT NULL AND (v_collected IS NULL OR (v_collected AT TIME ZONE 'America/Toronto')::date <> v_day) THEN
        v_collected := CASE WHEN v_day >= v_today THEN now() ELSE ((v_day + time '12:00') AT TIME ZONE 'America/Toronto') END;
      END IF;
    ELSIF v_team.payment_status = 'paid' AND v_team.total_paid >= v_fee_total THEN
      -- Paid BY these payments, and now short of the fee. (A legacy team marked paid with too little recorded is left as
      -- marked: this change did not make it unpaid.)
      v_status := 'pending'; v_became_unpaid := true; v_collected := NULL;
    END IF;
  END IF;
  UPDATE teams SET total_paid = v_sum, deposit_paid = v_dep, payment_status = v_status,
    payment_collected_at = v_collected, fee_changed_by = coalesce(p_actor, fee_changed_by)
  WHERE id = p_team;
  RETURN jsonb_build_object('total', v_sum, 'deposit', v_dep, 'status', v_status, 'feeTotal', v_fee_total,
    'becamePaid', v_became_paid, 'becameUnpaid', v_became_unpaid);
END $$;

-- Mig 345's Mark paid / Deposit paid: what is due is the fee less what is paid NET of part refunds (marked ▶ 382; /dba —
-- summing whole rows would record too little after a part refund). Same signature and grants.
CREATE OR REPLACE FUNCTION public.tournament_team_payment_pay_due(p_team uuid, p_actor uuid, p_scope text, p_label text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team public.teams%ROWTYPE; v_fee_total numeric; v_fee_dep numeric; v_sum numeric; v_amount numeric; v_label text;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
BEGIN
  IF p_scope NOT IN ('all', 'deposit') THEN RAISE EXCEPTION 'Unknown payment scope'; END IF;
  SELECT * INTO v_team FROM teams WHERE id = p_team;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team not found'; END IF;
  -- The tournament's lock comes first (see mig 345's note), exactly as record() takes it, then the team: two presses
  -- still serialise on the team, and a press cannot deadlock with a record on the same team.
  IF tournament_fee_book_on(v_team.tournament_id) THEN PERFORM club_tournament_fee_word(v_team.tournament_id); END IF;
  SELECT * INTO v_team FROM teams WHERE id = p_team FOR UPDATE;
  SELECT f.total, f.deposit INTO v_fee_total, v_fee_dep FROM tournament_team_fee(p_team) f;
  IF v_fee_total IS NULL THEN RETURN jsonb_build_object('recorded', false, 'noFee', true); END IF;
  SELECT coalesce(sum(amount - refunded_amount), 0) INTO v_sum FROM tournament_team_payments WHERE team_id = p_team AND status = 'posted'; -- ▶ 382
  IF p_scope = 'deposit' THEN
    IF v_fee_dep IS NULL THEN RETURN jsonb_build_object('recorded', false, 'total', v_sum); END IF;
    v_amount := least(v_fee_dep, v_fee_total) - v_sum; v_label := 'Deposit';
  ELSE
    v_amount := v_fee_total - v_sum; v_label := 'Payment';
  END IF;
  IF v_amount <= 0 THEN
    -- Nothing is due: the sum already covers it. A team whose status still reads pending (a fee lowered after it paid, an old
    -- typed total) is brought in line with its payments, so "Mark paid" never silently does nothing.
    RETURN team_payments_refresh(p_team, p_actor, 'live', NULL) || jsonb_build_object('recorded', false);
  END IF;
  RETURN tournament_team_payment_record(p_team, v_amount, v_today, coalesce(p_label, v_label), NULL, p_actor) || jsonb_build_object('recorded', true);
END $$;
REVOKE ALL ON FUNCTION public.tournament_team_payment_pay_due(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_team_payment_pay_due(uuid, uuid, text, text) TO service_role;

-- ── 4. Refunds: which are part refunds, and one Stripe refund per child ─────────────────────────
ALTER TABLE public.online_payment_refunds ADD COLUMN IF NOT EXISTS part_refund boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.online_payment_refunds.part_refund IS 'A tournament team''s part refund (mig 382): never the fee, books when Stripe accepts it, and lowers the team''s entry. House-league part refunds are told by their item and amount (mig 375) and leave this false.';
-- §0g 5: a part refund in Stripe on a payment for two children may be split between them — one Stripe refund, a row per child.
DROP INDEX IF EXISTS public.online_payment_refunds_stripe_key;
CREATE UNIQUE INDEX IF NOT EXISTS online_payment_refunds_stripe_child_key
  ON public.online_payment_refunds(stripe_refund_id, online_payment_item_id) NULLS NOT DISTINCT
  WHERE stripe_refund_id IS NOT NULL;
-- The lookup by Stripe id alone rides the key's leading column (/dba: a separate index would be redundant).
DROP INDEX IF EXISTS public.online_payment_refunds_stripe_idx;

-- Mig 375's guard with part_refund (marked ▶ 382).
CREATE OR REPLACE FUNCTION public.online_payment_refunds_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.online_payment_item_id IS NULL
     AND EXISTS (SELECT 1 FROM online_payments p WHERE p.id = NEW.online_payment_id AND p.flow = 'league_signup') THEN
    RAISE EXCEPTION 'A house-league refund names the child it refunds.';
  END IF;
  IF TG_OP = 'INSERT' AND NEW.online_payment_item_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM online_payment_items i
                      WHERE i.id = NEW.online_payment_item_id AND i.online_payment_id = NEW.online_payment_id AND i.org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'A refund''s child belongs to its own payment.';
  END IF;
  IF coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending' OR NEW.succeeded_at IS NOT NULL OR NEW.refund_entry_id IS NOT NULL
       OR NEW.processing_cost_entry_id IS NOT NULL OR NEW.booked_at IS NOT NULL OR NEW.part_refund THEN -- ▶ 382
      RAISE EXCEPTION 'A refund starts pending; Stripe''s answer records the rest.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.fee_refunded IS DISTINCT FROM OLD.fee_refunded
     OR NEW.online_payment_id IS DISTINCT FROM OLD.online_payment_id OR NEW.org_id IS DISTINCT FROM OLD.org_id
     OR NEW.online_payment_item_id IS DISTINCT FROM OLD.online_payment_item_id
     OR NEW.partial_reason IS DISTINCT FROM OLD.partial_reason OR NEW.booked_at IS DISTINCT FROM OLD.booked_at
     OR NEW.part_refund IS DISTINCT FROM OLD.part_refund -- ▶ 382
     OR NEW.refund_entry_id IS DISTINCT FROM OLD.refund_entry_id OR NEW.processing_cost_entry_id IS DISTINCT FROM OLD.processing_cost_entry_id
     OR NEW.succeeded_at IS DISTINCT FROM OLD.succeeded_at
     OR (NEW.stripe_refund_id IS DISTINCT FROM OLD.stripe_refund_id AND OLD.stripe_refund_id IS NOT NULL)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'pending' AND NEW.status IN ('failed', 'canceled'))) THEN
    RAISE EXCEPTION 'A refund changes only through its landing.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_refunds_guard() FROM PUBLIC, anon, authenticated;

-- ── 5. Opening a refund (mig 376's, same signature) ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.online_payment_refund_open(
  p_online_payment uuid, p_fee_included boolean, p_reason text, p_note text, p_actor uuid, p_origin text,
  p_item uuid DEFAULT NULL, p_amount numeric DEFAULT NULL, p_partial_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_it public.online_payment_items%ROWTYPE;
  v_back numeric(12,2); v_left numeric(12,2); v_amt numeric(12,2); v_fee numeric(12,2) := 0; v_id uuid;
  v_book_left numeric(12,2); v_n integer;
  v_why text := nullif(btrim(coalesce(p_partial_reason, '')), '');
  v_origin text := coalesce(p_origin, 'app');
  v_reg uuid;
BEGIN
  -- Lock order is the booking's (mig 375): the child's registration BEFORE the payment, so an open and a booking on one
  -- child queue rather than deadlock.
  IF p_item IS NOT NULL THEN
    SELECT i.registration_id INTO v_reg FROM online_payment_items i WHERE i.id = p_item;
    IF v_reg IS NOT NULL THEN PERFORM 1 FROM league_registrations g WHERE g.id = v_reg FOR UPDATE; END IF;
  END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.status NOT IN ('paid', 'partly_refunded') THEN RAISE EXCEPTION 'This payment can no longer be refunded.'; END IF;

  IF v_op.flow = 'tournament_team' THEN
    IF p_item IS NOT NULL THEN RAISE EXCEPTION 'A team''s payment has no children to name.'; END IF;
    IF p_reason IS NOT NULL AND p_reason NOT IN ('organizer_ended', 'team_left') THEN RAISE EXCEPTION 'Invalid refund reason'; END IF;
    SELECT coalesce(sum(r.amount - r.fee_refunded), 0), count(*) INTO v_back, v_n FROM online_payment_refunds r
     WHERE r.online_payment_id = v_op.id AND (r.status IN ('pending', 'succeeded') OR r.booked_at IS NOT NULL);
    IF p_amount IS NULL THEN
      -- "All of it" (12a): the whole payment, once, and only while nothing of it has gone back.
      IF v_n > 0 THEN RAISE EXCEPTION 'This payment is already being refunded.'; END IF;
      v_fee := CASE WHEN p_fee_included AND v_op.fee_payer = 'family' THEN v_op.fee_amount ELSE 0 END;
      INSERT INTO online_payment_refunds(online_payment_id, org_id, amount, fee_refunded, reason, note, origin, created_by)
      VALUES (v_op.id, v_op.org_id, v_op.base_amount + v_fee, v_fee,
        CASE WHEN v_op.fee_payer = 'family' THEN p_reason END, nullif(trim(p_note), ''), v_origin, p_actor)
      RETURNING id INTO v_id;
      RETURN v_id;
    END IF;
    -- ▶ 382 · "Part of it" (§0j 1–2): up to what is left of the base, never the fee, with a reason (a refund made in
    -- Stripe has none to give).
    -- /dba: a part refund lowers the team's entry against a payment IN its record; one that never landed is refunded
    -- in full from its notice, or recorded first.
    IF v_op.landed_at IS NULL THEN RAISE EXCEPTION 'This payment isn''t in the team''s record yet.'; END IF;
    v_left := v_op.base_amount - v_back;
    IF v_left <= 0 THEN RAISE EXCEPTION 'This payment is already refunded.'; END IF;
    v_amt := round(p_amount, 2);
    IF v_amt <= 0 OR v_amt > v_left THEN RAISE EXCEPTION 'A refund is more than zero and no more than what is left: %', v_left; END IF;
    IF v_why IS NULL AND v_origin = 'app' THEN RAISE EXCEPTION 'A partial refund needs a reason.'; END IF;
    PERFORM set_config('flhq.online_payment_write', 'on', true);
    INSERT INTO online_payment_refunds(online_payment_id, org_id, amount, fee_refunded, reason, partial_reason, note, origin,
      created_by, part_refund)
    VALUES (v_op.id, v_op.org_id, v_amt, 0, NULL, v_why, nullif(trim(p_note), ''), v_origin, p_actor, true)
    RETURNING id INTO v_id;
    PERFORM set_config('flhq.online_payment_write', 'off', true);
    RETURN v_id;
  END IF;

  IF p_item IS NULL THEN RAISE EXCEPTION 'A house-league refund names the child it refunds.'; END IF;
  SELECT * INTO v_it FROM online_payment_items i WHERE i.id = p_item AND i.online_payment_id = v_op.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That child is not on this payment.'; END IF;
  IF p_reason IS NOT NULL AND p_reason NOT IN ('club_ended', 'family_left', 'price_corrected') THEN RAISE EXCEPTION 'Invalid refund reason'; END IF;
  SELECT coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_back FROM online_payment_refunds r
   WHERE r.online_payment_item_id = v_it.id AND (r.status IN ('pending', 'succeeded') OR r.booked_at IS NOT NULL);
  v_left := v_it.amount - v_back;
  -- A landed share's refund is also capped by the season's book — what the registration still shows received, less
  -- refunds of its card shares opened and not booked yet (they will take a line when Stripe accepts them).
  IF v_it.entry_id IS NOT NULL AND v_it.registration_id IS NOT NULL THEN
    SELECT league_reg_received(v_it.registration_id) - coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_book_left
      FROM online_payment_refunds r JOIN online_payment_items i ON i.id = r.online_payment_item_id
     WHERE i.registration_id = v_it.registration_id AND r.status = 'pending' AND r.booked_at IS NULL;
    v_left := least(v_left, v_book_left);
  END IF;
  IF v_left <= 0 THEN RAISE EXCEPTION 'This child''s payment is already refunded.'; END IF;
  v_amt := coalesce(round(p_amount, 2), v_left);
  IF v_amt <= 0 OR v_amt > v_left THEN RAISE EXCEPTION 'A refund is more than zero and no more than what is left: %', v_left; END IF;
  -- A reason only when the refund leaves part of the share behind, and never for a refund made in Stripe (▶ 382).
  IF v_amt < v_left AND v_why IS NULL AND coalesce(p_reason, '') <> 'price_corrected' AND v_origin = 'app' THEN
    RAISE EXCEPTION 'A partial refund needs a reason.';
  END IF;
  IF p_fee_included AND v_op.fee_payer = 'family' AND v_amt = v_it.amount AND v_back = 0 THEN v_fee := v_it.fee_share; END IF;
  INSERT INTO online_payment_refunds(online_payment_id, online_payment_item_id, org_id, amount, fee_refunded, reason,
    partial_reason, note, origin, created_by)
  VALUES (v_op.id, v_it.id, v_op.org_id, v_amt + v_fee, v_fee,
    CASE WHEN v_op.fee_payer = 'family' THEN p_reason END, v_why, nullif(trim(p_note), ''), v_origin, p_actor)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_refund_open(uuid, boolean, text, text, uuid, text, uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_refund_open(uuid, boolean, text, text, uuid, text, uuid, numeric, text) TO service_role;

-- ── 5b. Money-out lines say how the money moved ─────────────────────────────────────────────────
-- /dba: mig 358's and mig 374's money-out lines were always 'online_card'. They take the method now (a new trailing
-- argument, default 'online_card', so the old signatures are dropped and every 7-argument call still resolves).
DROP FUNCTION IF EXISTS public.online_payment_post_out(uuid, text, date, text, numeric, uuid, uuid);
CREATE OR REPLACE FUNCTION public.online_payment_post_out(
  p_tournament uuid, p_word text, p_day date, p_description text, p_amount numeric, p_source_id uuid, p_actor uuid,
  p_method text DEFAULT 'online_card'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cat uuid; v_item uuid; v_book uuid; v_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_day IS NULL THEN RAISE EXCEPTION 'A money-out line needs a positive amount and day'; END IF;
  IF p_method NOT IN ('online_card', 'online_bank') THEN RAISE EXCEPTION 'An online money-out line is card or bank debit'; END IF;
  SELECT w.category_id, w.item_id INTO v_cat, v_item FROM club_tournament_out_word(p_tournament, p_word) w;
  v_book := club_tournament_ledger(p_tournament);
  INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category, source_module,
    source_entity_id, created_by, budget_category_id, budget_item_id, payment_method)
  VALUES(v_book, p_day, left(p_description, 500), round(p_amount, 2), 'expense', 'posted', NULL, 'online_payment',
    p_source_id, p_actor, v_cat, v_item, p_method)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_post_out(uuid, text, date, text, numeric, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_post_out(uuid, text, date, text, numeric, uuid, uuid, text) TO service_role;

DROP FUNCTION IF EXISTS public.online_payment_league_post_out(uuid, text, date, text, numeric, uuid, uuid);
CREATE OR REPLACE FUNCTION public.online_payment_league_post_out(
  p_season uuid, p_word text, p_day date, p_description text, p_amount numeric, p_source_id uuid, p_actor uuid,
  p_method text DEFAULT 'online_card'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid; v_cat uuid; v_item uuid; v_book uuid; v_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_day IS NULL THEN RAISE EXCEPTION 'A money-out line needs a positive amount and day'; END IF;
  IF p_method NOT IN ('online_card', 'online_bank') THEN RAISE EXCEPTION 'An online money-out line is card or bank debit'; END IF;
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
    p_source_id, p_actor, v_cat, v_item, p_method)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_league_post_out(uuid, text, date, text, numeric, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_league_post_out(uuid, text, date, text, numeric, uuid, uuid, text) TO service_role;

-- Mig 358's full-refund landing (marked ▶ 382): a part refund never lands here (it would strike the whole row through and
-- refund the whole payment; /dba), and a bank debit's lines say 'online_bank'.
CREATE OR REPLACE FUNCTION public.online_payment_refund_land(p_refund uuid, p_stripe_refund text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r public.online_payment_refunds%ROWTYPE; v_op public.online_payments%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date; v_refund_entry uuid; v_cost uuid; v_refresh jsonb;
  v_receipt uuid; v_how text; v_method text;
BEGIN
  SELECT * INTO v_r FROM online_payment_refunds WHERE id = p_refund;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF v_r.part_refund THEN RAISE EXCEPTION 'A part refund books through online_payment_team_refund_book.'; END IF; -- ▶ 382
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
  v_method := CASE WHEN v_op.rail = 'bank_debit' THEN 'online_bank' ELSE 'online_card' END; -- ▶ 382

  SELECT entry_id INTO v_receipt FROM tournament_team_payments WHERE online_payment_id = v_op.id AND status = 'posted';
  -- No Stripe refund behind it = the club refunded another way after a refund to the card was returned.
  v_how := CASE WHEN coalesce(p_stripe_refund, v_r.stripe_refund_id) IS NULL THEN 'Refunded another way · '
                WHEN v_op.rail = 'bank_debit' THEN 'Refunded to bank account · ' ELSE 'Refunded to card · ' END; -- ▶ 382
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE tournament_team_payments SET status = 'refunded', updated_at = now()
    WHERE online_payment_id = v_op.id AND status = 'posted';
  IF v_receipt IS NOT NULL AND v_op.tournament_id IS NOT NULL THEN
    v_refund_entry := online_payment_post_out(v_op.tournament_id, 'Refunds', v_today,
      v_how || v_op.description, v_r.amount - v_r.fee_refunded, v_r.id, v_r.created_by, v_method);
    IF v_r.fee_refunded > 0 THEN
      v_cost := online_payment_post_out(v_op.tournament_id, 'Payment processing', v_today,
        'Processing fee refunded · ' || v_op.description, v_r.fee_refunded, v_r.id, v_r.created_by, v_method);
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

-- ── 6. Booking a team's part refund ─────────────────────────────────────────────────────────────
-- Stripe accepted the part refund (p_succeeded: already finished; else pending) → once: the payment row's refunded amount,
-- the "Refunds" line on the tournament's book (when the receipt is on it), and the entry adjustment (only when the payment
-- was in the team's record — a payment that never landed lowers nothing). The team's paid figure is refreshed against the
-- lowered entry, so its balance does not move. A booked refund only moves to succeeded on a repeat. Never voids the receipt.
CREATE OR REPLACE FUNCTION public.online_payment_team_refund_book(p_refund uuid, p_stripe_refund text, p_succeeded boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r public.online_payment_refunds%ROWTYPE; v_op public.online_payments%ROWTYPE; v_row public.tournament_team_payments%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date; v_entry uuid; v_back numeric(12,2); v_refresh jsonb;
  v_adjusted boolean := false;
BEGIN
  SELECT * INTO v_r FROM online_payment_refunds WHERE id = p_refund;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = v_r.online_payment_id;
  IF v_op.flow <> 'tournament_team' OR NOT v_r.part_refund THEN RAISE EXCEPTION 'Not a team''s part refund'; END IF;

  -- Lock order: tournament → team → payment → refund.
  IF v_op.tournament_id IS NOT NULL THEN PERFORM 1 FROM tournaments WHERE id = v_op.tournament_id FOR UPDATE; END IF;
  IF v_op.team_id IS NOT NULL THEN PERFORM 1 FROM teams WHERE id = v_op.team_id FOR UPDATE; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = v_r.online_payment_id FOR UPDATE;
  SELECT * INTO v_r FROM online_payment_refunds WHERE id = p_refund FOR UPDATE;

  PERFORM set_config('flhq.online_payment_write', 'on', true);
  IF v_r.booked_at IS NULL THEN
    IF v_r.status NOT IN ('pending', 'succeeded') THEN RAISE EXCEPTION 'This refund did not go through.'; END IF;
    SELECT * INTO v_row FROM tournament_team_payments WHERE online_payment_id = v_op.id AND status = 'posted' FOR UPDATE;
    IF FOUND THEN
      IF v_row.refunded_amount + v_r.amount > v_row.amount THEN RAISE EXCEPTION 'A refund is more than what is left of this payment.'; END IF;
      UPDATE tournament_team_payments SET refunded_amount = refunded_amount + v_r.amount,
        status = CASE WHEN refunded_amount + v_r.amount >= amount THEN 'refunded' ELSE status END, updated_at = now()
      WHERE id = v_row.id;
      IF v_row.entry_id IS NOT NULL AND v_op.tournament_id IS NOT NULL THEN
        v_entry := online_payment_post_out(v_op.tournament_id, 'Refunds', v_today,
          CASE WHEN v_op.rail = 'bank_debit' THEN 'Part refunded to bank account · ' ELSE 'Part refunded to card · ' END || v_op.description,
          v_r.amount, v_r.id, v_r.created_by, CASE WHEN v_op.rail = 'bank_debit' THEN 'online_bank' ELSE 'online_card' END);
      END IF;
      IF v_op.team_id IS NOT NULL AND v_op.tournament_id IS NOT NULL THEN
        INSERT INTO tournament_team_entry_adjustments(team_id, tournament_id, org_id, amount, reason, origin, refund_id, created_by)
        VALUES (v_op.team_id, v_op.tournament_id, v_op.org_id, v_r.amount, v_r.partial_reason, v_r.origin, v_r.id, v_r.created_by)
        ON CONFLICT (refund_id) DO NOTHING;
        v_adjusted := true;
      END IF;
    END IF;
    UPDATE online_payment_refunds SET booked_at = now(), refund_entry_id = v_entry,
      stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), updated_at = now()
    WHERE id = v_r.id;
  END IF;
  IF p_succeeded THEN
    UPDATE online_payment_refunds SET status = 'succeeded', succeeded_at = coalesce(succeeded_at, now()), failure_reason = NULL,
      stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), updated_at = now()
    WHERE id = v_r.id AND status <> 'succeeded';
  END IF;
  SELECT coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_back FROM online_payment_refunds r
   WHERE r.online_payment_id = v_op.id AND (r.booked_at IS NOT NULL OR r.status = 'succeeded');
  UPDATE online_payments SET status = CASE WHEN v_back >= v_op.base_amount THEN 'refunded' WHEN v_back > 0 THEN 'partly_refunded' ELSE status END,
    updated_at = now()
  WHERE id = v_op.id;
  IF v_op.team_id IS NOT NULL THEN v_refresh := team_payments_refresh(v_op.team_id, v_r.created_by, 'live', NULL); END IF;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN coalesce(v_refresh, '{}'::jsonb) || jsonb_build_object('refundEntryId', v_entry, 'returned', v_back, 'adjusted', v_adjusted);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_team_refund_book(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_team_refund_book(uuid, text, boolean) TO service_role;

-- ── 7. Online payments: the bank-debit rail and its states ──────────────────────────────────────
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS bank_last4 text;
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS clearing_at timestamptz;
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS returned_at timestamptz;
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS return_reason text;
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS return_detail text;
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS reversed_at timestamptz;
ALTER TABLE public.online_payments ADD COLUMN IF NOT EXISTS stripe_dispute_id text;
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_rail_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_rail_chk CHECK (rail IN ('card', 'bank_debit'));
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_bank_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_bank_chk CHECK (
  (rail = 'bank_debit' OR (bank_last4 IS NULL AND clearing_at IS NULL AND returned_at IS NULL AND stripe_dispute_id IS NULL))
  AND (bank_last4 IS NULL OR bank_last4 ~ '^[0-9]{3,4}$')
  AND (return_detail IS NULL OR char_length(return_detail) <= 200));
-- The bank's reason, mapped (words §2.3); anything Stripe gives that maps to none of these is kept in return_detail only.
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_return_reason_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_return_reason_chk CHECK (
  return_reason IS NULL OR return_reason IN ('insufficient_funds', 'account_closed', 'invalid_account', 'not_authorized'));
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_status_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_status_chk
  CHECK (status IN ('open', 'clearing', 'paid', 'expired', 'returned', 'partly_refunded', 'refunded', 'reversed'));
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_paid_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_paid_chk CHECK (
  status NOT IN ('paid', 'partly_refunded', 'refunded', 'reversed')
  OR (paid_at IS NOT NULL AND stripe_payment_intent_id IS NOT NULL AND receipt_no IS NOT NULL));
ALTER TABLE public.online_payments DROP CONSTRAINT IF EXISTS online_payments_state_chk;
ALTER TABLE public.online_payments ADD CONSTRAINT online_payments_state_chk CHECK (
  (status <> 'clearing' OR (rail = 'bank_debit' AND clearing_at IS NOT NULL AND landed_at IS NULL))
  AND (status <> 'returned' OR (returned_at IS NOT NULL AND landed_at IS NULL))
  AND (status <> 'reversed' OR reversed_at IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS online_payments_dispute_key ON public.online_payments(stripe_dispute_id) WHERE stripe_dispute_id IS NOT NULL;
-- §0j 6: no second payment while one clears — the backstop under the pay routes' own refusal.
DROP INDEX IF EXISTS public.online_payments_one_open_per_team;
CREATE UNIQUE INDEX online_payments_one_open_per_team ON public.online_payments(team_id)
  WHERE status IN ('open', 'clearing') AND team_id IS NOT NULL;
DROP INDEX IF EXISTS public.online_payments_one_open_per_signup;
CREATE UNIQUE INDEX online_payments_one_open_per_signup ON public.online_payments(season_id, signup_key)
  WHERE status IN ('open', 'clearing') AND flow = 'league_signup' AND season_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS online_payments_clearing_idx ON public.online_payments(org_id) WHERE status = 'clearing';

-- Mig 374's guard with the bank-debit columns (marked ▶ 382).
CREATE OR REPLACE FUNCTION public.online_payments_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('flhq.online_payment_write', true), 'off') = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'open' OR NEW.paid_at IS NOT NULL OR NEW.landed_at IS NOT NULL OR NEW.receipt_no IS NOT NULL
       OR NEW.stripe_payment_intent_id IS NOT NULL OR NEW.processing_cost_entry_id IS NOT NULL
       OR NEW.bank_last4 IS NOT NULL OR NEW.clearing_at IS NOT NULL OR NEW.returned_at IS NOT NULL -- ▶ 382
       OR NEW.return_reason IS NOT NULL OR NEW.return_detail IS NOT NULL OR NEW.reversed_at IS NOT NULL
       OR NEW.stripe_dispute_id IS NOT NULL THEN
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
     OR NEW.rail IS DISTINCT FROM OLD.rail -- ▶ 382
     OR NEW.stripe_checkout_session_id IS DISTINCT FROM OLD.stripe_checkout_session_id
     OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
     OR NEW.stripe_charge_id IS DISTINCT FROM OLD.stripe_charge_id OR NEW.receipt_no IS DISTINCT FROM OLD.receipt_no
     OR NEW.landed_at IS DISTINCT FROM OLD.landed_at OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.paid_on IS DISTINCT FROM OLD.paid_on OR NEW.processing_cost_entry_id IS DISTINCT FROM OLD.processing_cost_entry_id
     OR NEW.signup_key IS DISTINCT FROM OLD.signup_key
     OR NEW.bank_last4 IS DISTINCT FROM OLD.bank_last4 OR NEW.clearing_at IS DISTINCT FROM OLD.clearing_at -- ▶ 382
     OR NEW.returned_at IS DISTINCT FROM OLD.returned_at OR NEW.return_reason IS DISTINCT FROM OLD.return_reason
     OR NEW.return_detail IS DISTINCT FROM OLD.return_detail OR NEW.reversed_at IS DISTINCT FROM OLD.reversed_at
     OR NEW.stripe_dispute_id IS DISTINCT FROM OLD.stripe_dispute_id
     OR (NEW.team_id IS DISTINCT FROM OLD.team_id AND NEW.team_id IS NOT NULL)
     OR (NEW.tournament_id IS DISTINCT FROM OLD.tournament_id AND NEW.tournament_id IS NOT NULL)
     OR (NEW.season_id IS DISTINCT FROM OLD.season_id AND NEW.season_id IS NOT NULL)
     OR (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'open' AND NEW.status = 'expired')) THEN
    RAISE EXCEPTION 'An online payment changes only through its landing or its refund.';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.online_payments_guard() FROM PUBLIC, anon, authenticated;

-- ── 8a. A bank debit clears, or comes back ──────────────────────────────────────────────────────
-- The family finished Stripe's page and the debit is on its way (checkout.session.completed, unpaid): CLEARING. Only from
-- open, so a late "completed" after the debit already landed or came back changes nothing. Idempotent.
CREATE OR REPLACE FUNCTION public.online_payment_clearing(p_online_payment uuid, p_payment_intent text, p_bank_last4 text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_done boolean := false;
BEGIN
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE online_payments SET status = 'clearing', clearing_at = now(),
    stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
    bank_last4 = coalesce(nullif(btrim(coalesce(p_bank_last4, '')), ''), bank_last4), updated_at = now()
  WHERE id = p_online_payment AND status = 'open' AND rail = 'bank_debit'
  RETURNING true INTO v_done;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN coalesce(v_done, false);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_clearing(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_clearing(uuid, text, text) TO service_role;

-- The bank returned the debit before it settled (checkout.session.async_payment_failed): nothing was taken, nothing is in
-- a book, the spot stays held and the family may pay again. Only a debit that never landed; idempotent.
CREATE OR REPLACE FUNCTION public.online_payment_returned(p_online_payment uuid, p_reason text, p_detail text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_done boolean := false;
BEGIN
  IF p_reason IS NOT NULL AND p_reason NOT IN ('insufficient_funds', 'account_closed', 'invalid_account', 'not_authorized') THEN
    RAISE EXCEPTION 'Invalid return reason';
  END IF;
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE online_payments SET status = 'returned', returned_at = now(), return_reason = p_reason,
    return_detail = left(nullif(btrim(coalesce(p_detail, '')), ''), 200), updated_at = now()
  WHERE id = p_online_payment AND status IN ('open', 'clearing') AND rail = 'bank_debit' AND landed_at IS NULL
  RETURNING true INTO v_done;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN coalesce(v_done, false);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_returned(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_returned(uuid, text, text) TO service_role;

-- ── 8b. The landings learn the rail ─────────────────────────────────────────────────────────────
-- Mig 358's tournament landing (marked ▶ 382): a returned debit never lands; a bank debit's row and line say 'online_bank'.
CREATE OR REPLACE FUNCTION public.online_payment_land(
  p_online_payment uuid, p_paid_at timestamptz, p_payment_intent text, p_charge text, p_brand text, p_last4 text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_book_on boolean := false; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_day date; v_closed date; v_label text; v_rec jsonb; v_pay uuid; v_entry uuid; v_cost uuid; v_receipt bigint; v_method text;
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.landed_at IS NOT NULL OR v_op.status IN ('partly_refunded', 'refunded', 'returned') THEN -- ▶ 382
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
  IF v_op.landed_at IS NOT NULL OR v_op.status IN ('partly_refunded', 'refunded', 'returned') THEN -- ▶ 382
    RETURN jsonb_build_object('already', true, 'receiptNo', v_op.receipt_no, 'returned', v_op.status = 'returned');
  END IF;

  v_day := least((p_paid_at AT TIME ZONE 'America/Toronto')::date, v_today);
  v_closed := club_books_closed_through(v_op.org_id);
  IF v_closed IS NOT NULL AND v_day <= v_closed THEN v_day := v_today; END IF;
  v_label := CASE v_op.scope WHEN 'deposit' THEN 'Deposit' WHEN 'balance' THEN 'Balance' ELSE 'Payment' END;
  v_method := CASE WHEN v_op.rail = 'bank_debit' THEN 'online_bank' ELSE 'online_card' END; -- ▶ 382

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
    card_last4 = coalesce(p_last4, card_last4), receipt_no = v_receipt, processing_cost_entry_id = v_cost, updated_at = now()
  WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN v_rec || jsonb_build_object('already', false, 'receiptNo', v_receipt, 'teamPaymentId', v_pay);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_land(uuid, timestamptz, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_land(uuid, timestamptz, text, text, text, text) TO service_role;

-- Mig 359's (marked ▶ 382): a returned debit is never stamped paid — Stripe did not take it.
CREATE OR REPLACE FUNCTION public.online_payment_land_failed(
  p_online_payment uuid, p_paid_at timestamptz, p_payment_intent text, p_charge text, p_brand text, p_last4 text, p_error text
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_receipt bigint;
BEGIN
  PERFORM set_config('flhq.online_payment_write', 'on', true);
  UPDATE online_payments SET status = CASE WHEN status = 'refunded' THEN status ELSE 'paid' END,
    paid_at = coalesce(paid_at, p_paid_at), paid_on = coalesce(paid_on, (p_paid_at AT TIME ZONE 'America/Toronto')::date),
    stripe_payment_intent_id = coalesce(p_payment_intent, stripe_payment_intent_id),
    stripe_charge_id = coalesce(p_charge, stripe_charge_id), card_brand = coalesce(p_brand, card_brand),
    card_last4 = coalesce(p_last4, card_last4), receipt_no = coalesce(receipt_no, nextval('online_payment_receipt_seq')),
    land_error = left(coalesce(p_error, 'Not recorded'), 500), updated_at = now()
  WHERE id = p_online_payment AND landed_at IS NULL AND status <> 'returned' -- ▶ 382
  RETURNING receipt_no INTO v_receipt;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN v_receipt;
END $$;
REVOKE ALL ON FUNCTION public.online_payment_land_failed(uuid, timestamptz, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_land_failed(uuid, timestamptz, text, text, text, text, text) TO service_role;

-- Mig 374's house-league writer (marked ▶ 382): 'online_bank', like 'online_card', is Stripe's answer, never typed.
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
  -- A card or bank-debit payment or refund is Stripe's answer, written only by the online-payment functions (under their
  -- write flag). A person never types "Online, card" or "Online, bank debit" (the hand pickers don't offer them).
  IF v_method IN ('online_card', 'online_bank') AND coalesce(current_setting('flhq.online_payment_write', true), 'off') <> 'on' THEN -- ▶ 382
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
    -- An online payment really arrived; it comes off only by a refund (drawings m4).
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

-- Mig 374's house-league opening, with the rail (a new trailing argument, so the old signature is dropped; the 12b call
-- still resolves through the default) and a child on a CLEARING debit counted as in a payment (marked ▶ 382).
DROP FUNCTION IF EXISTS public.online_payment_league_open(uuid, uuid, text, uuid, text, text, text, numeric, text, numeric, numeric, boolean, text, jsonb);
CREATE OR REPLACE FUNCTION public.online_payment_league_open(
  p_id uuid, p_org uuid, p_stripe_account text, p_season uuid, p_signup_key text, p_description text, p_payer_email text,
  p_fee_amount numeric, p_fee_payer text, p_fee_pct numeric, p_fee_flat numeric, p_livemode boolean, p_session text,
  p_items jsonb, p_rail text DEFAULT 'card'
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
    base_amount, fee_amount, total_amount, fee_payer, fee_pct, fee_flat, livemode, stripe_checkout_session_id, rail)
  VALUES (p_id, p_org, p_stripe_account, 'league_signup', p_season, p_signup_key, 'full', left(p_description, 500),
    nullif(btrim(coalesce(p_payer_email, '')), ''), v_base, v_fee,
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
REVOKE ALL ON FUNCTION public.online_payment_league_open(uuid, uuid, text, uuid, text, text, text, numeric, text, numeric, numeric, boolean, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_league_open(uuid, uuid, text, uuid, text, text, text, numeric, text, numeric, numeric, boolean, text, jsonb, text) TO service_role;

-- Mig 374's house-league landing (marked ▶ 382): a returned debit never lands; a bank debit lands as 'online_bank'.
CREATE OR REPLACE FUNCTION public.online_payment_league_land(
  p_online_payment uuid, p_paid_at timestamptz, p_payment_intent text, p_charge text, p_brand text, p_last4 text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op public.online_payments%ROWTYPE; v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_day date; v_closed date; v_receipt bigint; v_it public.online_payment_items%ROWTYPE;
  v_entry uuid; v_refusal text; v_cost uuid; v_landed integer := 0; v_unrecorded jsonb := '[]'::jsonb; v_method text;
BEGIN
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment;
  IF NOT FOUND THEN RAISE EXCEPTION 'Online payment not found'; END IF;
  IF v_op.flow <> 'league_signup' THEN RAISE EXCEPTION 'Not a house-league payment'; END IF;
  IF v_op.landed_at IS NOT NULL OR v_op.status IN ('partly_refunded', 'refunded', 'returned') THEN -- ▶ 382
    RETURN jsonb_build_object('already', true, 'receiptNo', v_op.receipt_no, 'returned', v_op.status = 'returned');
  END IF;
  IF v_op.season_id IS NULL THEN RAISE EXCEPTION 'The house-league season is gone.'; END IF;

  PERFORM 1 FROM league_seasons s WHERE s.id = v_op.season_id FOR NO KEY UPDATE;
  PERFORM 1 FROM league_registrations r
   WHERE r.id IN (SELECT i.registration_id FROM online_payment_items i WHERE i.online_payment_id = v_op.id)
   ORDER BY r.id FOR UPDATE;
  SELECT * INTO v_op FROM online_payments WHERE id = p_online_payment FOR UPDATE;
  IF v_op.landed_at IS NOT NULL OR v_op.status IN ('partly_refunded', 'refunded', 'returned') THEN -- ▶ 382
    RETURN jsonb_build_object('already', true, 'receiptNo', v_op.receipt_no, 'returned', v_op.status = 'returned');
  END IF;

  v_day := least((p_paid_at AT TIME ZONE 'America/Toronto')::date, v_today);
  v_closed := club_books_closed_through(v_op.org_id);
  IF v_closed IS NOT NULL AND v_day <= v_closed THEN v_day := v_today; END IF;
  v_receipt := coalesce(v_op.receipt_no, nextval('online_payment_receipt_seq'));
  v_method := CASE WHEN v_op.rail = 'bank_debit' THEN 'online_bank' ELSE 'online_card' END; -- ▶ 382

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
                                 v_method, NULL, NULL) m;
      EXCEPTION WHEN others THEN
        -- A passing failure is the WHOLE landing's to retry (Stripe redelivers); kept, it would stamp a child unrecorded
        -- for good. Classes 40 (rollback), 53 (resources), 57 (operator), and 55P03 (lock not available).
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
      'Payment processing · ' || v_op.description, v_op.fee_amount, v_op.id, NULL, v_method);
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

-- Mig 375's house-league refund booking (marked ▶ 382): a bank debit's refund goes back to the bank account, and its
-- line says so ('online_bank', "Refunded to bank account").
CREATE OR REPLACE FUNCTION public.online_payment_league_refund_book(p_refund uuid, p_stripe_refund text, p_succeeded boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_r public.online_payment_refunds%ROWTYPE; v_op public.online_payments%ROWTYPE; v_it public.online_payment_items%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date; v_entry uuid; v_refusal text; v_cost uuid;
  v_back numeric(12,2); v_word text; v_to text; v_method text;
BEGIN
  SELECT * INTO v_r FROM online_payment_refunds WHERE id = p_refund;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = v_r.online_payment_id;
  IF v_op.flow <> 'league_signup' OR v_r.online_payment_item_id IS NULL THEN RAISE EXCEPTION 'Not a house-league refund'; END IF;
  SELECT * INTO v_it FROM online_payment_items WHERE id = v_r.online_payment_item_id;

  IF v_op.season_id IS NOT NULL THEN PERFORM 1 FROM league_seasons s WHERE s.id = v_op.season_id FOR NO KEY UPDATE; END IF;
  IF v_it.registration_id IS NOT NULL THEN PERFORM 1 FROM league_registrations g WHERE g.id = v_it.registration_id FOR UPDATE; END IF;
  SELECT * INTO v_op FROM online_payments WHERE id = v_r.online_payment_id FOR UPDATE;
  SELECT * INTO v_r FROM online_payment_refunds WHERE id = p_refund FOR UPDATE;
  v_to := CASE WHEN v_op.rail = 'bank_debit' THEN 'Refunded to bank account' ELSE 'Refunded to card' END; -- ▶ 382
  v_method := CASE WHEN v_op.rail = 'bank_debit' THEN 'online_bank' ELSE 'online_card' END;

  PERFORM set_config('flhq.online_payment_write', 'on', true);
  IF v_r.booked_at IS NULL THEN
    IF v_r.status NOT IN ('pending', 'succeeded') THEN RAISE EXCEPTION 'This refund did not go through.'; END IF;
    IF v_it.entry_id IS NOT NULL AND v_it.registration_id IS NOT NULL AND v_op.season_id IS NOT NULL THEN
      v_word := coalesce(v_r.partial_reason, CASE v_r.reason WHEN 'price_corrected' THEN 'Price corrected · ' || lower(v_to) ELSE v_to END);
      SELECT m.entry, m.refusal INTO v_entry, v_refusal
        FROM club_league_money(v_op.org_id, v_op.season_id, v_it.registration_id, 'refund', v_r.amount - v_r.fee_refunded, v_today,
                               v_method, v_word, v_r.created_by) m;
      IF v_refusal IS NOT NULL THEN RAISE EXCEPTION 'The refund could not go in the season''s book: %', v_refusal; END IF;
    END IF;
    IF v_r.fee_refunded > 0 AND v_op.season_id IS NOT NULL THEN
      v_cost := online_payment_league_post_out(v_op.season_id, 'Payment processing', v_today,
        'Processing fee refunded · ' || v_it.description, v_r.fee_refunded, v_r.id, v_r.created_by, v_method);
    END IF;
    UPDATE online_payment_refunds SET booked_at = now(), refund_entry_id = v_entry, processing_cost_entry_id = v_cost,
      stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), updated_at = now()
    WHERE id = v_r.id;
  END IF;
  IF p_succeeded THEN
    UPDATE online_payment_refunds SET status = 'succeeded', succeeded_at = coalesce(succeeded_at, now()), failure_reason = NULL,
      stripe_refund_id = coalesce(p_stripe_refund, stripe_refund_id), updated_at = now()
    WHERE id = v_r.id AND status <> 'succeeded';
  END IF;
  -- The payment reads what has gone back: everything booked or succeeded, against the base.
  SELECT coalesce(sum(r.amount - r.fee_refunded), 0) INTO v_back FROM online_payment_refunds r
   WHERE r.online_payment_id = v_op.id AND (r.booked_at IS NOT NULL OR r.status = 'succeeded');
  UPDATE online_payments SET status = CASE WHEN v_back >= v_op.base_amount THEN 'refunded' WHEN v_back > 0 THEN 'partly_refunded' ELSE status END,
    updated_at = now()
  WHERE id = v_op.id;
  PERFORM set_config('flhq.online_payment_write', 'off', true);
  RETURN jsonb_build_object('refundEntryId', v_entry, 'processingCostEntryId', v_cost, 'returned', v_back);
END $$;
REVOKE ALL ON FUNCTION public.online_payment_league_refund_book(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_payment_league_refund_book(uuid, text, boolean) TO service_role;

COMMIT;
