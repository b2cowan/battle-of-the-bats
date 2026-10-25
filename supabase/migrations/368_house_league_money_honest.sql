-- ---------------------------------------------------------------
-- Migration 368 — Club Tier Stage 9b-2 Part 1: house-league money, honest.
-- Plan: docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md §2 (the payments contract), §0e (the 9b-2 rulings, owner
-- 2026-10-25), §6a (the build notes).
--
-- WHY: the fee was one paid/unpaid tick. Undoing it, ending the registration or correcting a price voided the line
-- silently; nothing recorded when a child was accepted, how a family paid, or money given back.
--
-- WHAT CHANGES:
--   1. league_registrations.accepted_at — when the child was last accepted (a trigger, every door). NULL on a row accepted
--      before this column existed: "owing" with no day count, never amber (§0e; no date is invented).
--      ended_at / spot_released / end_money / end_money_reason — how a registration ended and what happened to its money.
--   2. league_seasons.owing_amber_days — "owing" turns amber after this many days (9b·8, starts at 14).
--   3. league_registration_price_changes — every price correction and every re-price on a move (the Money page's history).
--   4. club_league_money — THE ONE MONEY WRITER for a house-league registration: receive (an amount, a day, a method),
--      refund (money OUT, its own line, never a void), undo (a payment marked by mistake), price (a correction with a reason;
--      on a paid registration a lower price refunds the difference, a higher one leaves it owing).
--   5. league_registration_close — ending (decline / withdraw / release the spot) asks about money when there is some:
--      refunded (through the writer) or kept with a reason, in ONE transaction with the waitlist promotion. Nothing is voided.
--   6. league_registration_move_division — Move division with an optional new price; a child who has paid keeps theirs.
--   7. The old call shapes stay (club_league_fee_set, league_registration_end, club_league_fee_end) and route through the
--      new functions, so the code before this release is safe until the promote.
--   8. A one-time catch-up line for every paid tick that has no posted line (fixture hygiene: no club is on production).
--
-- Book lines (accounting_entries, all source_module 'league_registration', source_entity_id = the registration):
--   money in  → entry_type 'income',  category 'registration_fee'
--   money out → entry_type 'expense', category 'registration_refund' (notes = the reason)
-- A registration's RECEIVED figure is posted in − posted out (league_reg_received). registration_fee_paid and fee_entry_id
-- are kept in step for every reader that still reads them.
-- Functions and triggers are invisible to check:migrations; MANUAL_PROD_STEPS.json carries this file.
-- ---------------------------------------------------------------

BEGIN;

-- 1 · Facts on the registration ---------------------------------------------------------------
ALTER TABLE public.league_registrations
  ADD COLUMN IF NOT EXISTS accepted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at         timestamptz,
  ADD COLUMN IF NOT EXISTS spot_released    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS end_money        text,
  ADD COLUMN IF NOT EXISTS end_money_reason text;

ALTER TABLE public.league_registrations DROP CONSTRAINT IF EXISTS league_registrations_end_money_check;
ALTER TABLE public.league_registrations ADD CONSTRAINT league_registrations_end_money_check CHECK (
  (end_money IS NULL OR end_money IN ('refunded','kept'))
  AND (end_money_reason IS NULL OR char_length(end_money_reason) <= 500)
  AND (end_money IS DISTINCT FROM 'kept' OR coalesce(btrim(end_money_reason),'') <> '')
);

-- When the child was accepted: set on every move INTO accepted, cleared on a move back to review or the waitlist,
-- kept on an ended row (its history). A trigger, so no door can forget it.
CREATE OR REPLACE FUNCTION public.league_registrations_accepted_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    NEW.accepted_at := now();
  ELSIF NEW.status IN ('pending_review','waitlisted') THEN
    NEW.accepted_at := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS league_registrations_accepted_at ON public.league_registrations;
CREATE TRIGGER league_registrations_accepted_at
  BEFORE INSERT OR UPDATE OF status ON public.league_registrations
  FOR EACH ROW EXECUTE FUNCTION public.league_registrations_accepted_at();

-- 2 · The season's amber threshold ------------------------------------------------------------
ALTER TABLE public.league_seasons
  ADD COLUMN IF NOT EXISTS owing_amber_days smallint NOT NULL DEFAULT 14;
ALTER TABLE public.league_seasons DROP CONSTRAINT IF EXISTS league_seasons_owing_amber_days_check;
ALTER TABLE public.league_seasons ADD CONSTRAINT league_seasons_owing_amber_days_check CHECK (
  owing_amber_days BETWEEN 1 AND 365
);

-- 3 · Price history ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.league_registration_price_changes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id       uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  registration_id uuid NOT NULL REFERENCES public.league_registrations(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  old_amount      numeric(10,2),
  new_amount      numeric(10,2) NOT NULL,
  reason          text,
  refund_entry_id uuid REFERENCES public.accounting_entries(id) ON DELETE SET NULL,
  changed_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT league_registration_price_changes_kind_chk CHECK (kind IN ('corrected','moved')),
  CONSTRAINT league_registration_price_changes_amount_chk CHECK (new_amount >= 0 AND (old_amount IS NULL OR old_amount >= 0)),
  CONSTRAINT league_registration_price_changes_reason_chk CHECK (
    (reason IS NULL OR char_length(reason) <= 500)
    AND (kind <> 'corrected' OR coalesce(btrim(reason),'') <> '')
  )
);
CREATE INDEX IF NOT EXISTS league_registration_price_changes_org_idx ON public.league_registration_price_changes(org_id);
CREATE INDEX IF NOT EXISTS league_registration_price_changes_season_idx
  ON public.league_registration_price_changes(season_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS league_registration_price_changes_reg_idx
  ON public.league_registration_price_changes(registration_id);
CREATE INDEX IF NOT EXISTS league_registration_price_changes_refund_idx
  ON public.league_registration_price_changes(refund_entry_id) WHERE refund_entry_id IS NOT NULL;
ALTER TABLE public.league_registration_price_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.league_registration_price_changes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_registration_price_changes TO service_role;

-- A registration's book lines are read by their source; this index serves every sum below.
CREATE INDEX IF NOT EXISTS accounting_entries_league_registration_idx
  ON public.accounting_entries(source_entity_id) WHERE source_module = 'league_registration';

-- 4 · The one money writer --------------------------------------------------------------------
-- What a registration has received: posted money in, less posted money out.
CREATE OR REPLACE FUNCTION public.league_reg_received(p_registration uuid)
RETURNS numeric LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(sum(CASE WHEN e.entry_type = 'income' THEN e.amount ELSE -e.amount END), 0)
    FROM accounting_entries e
   WHERE e.source_module = 'league_registration' AND e.source_entity_id = p_registration
     AND e.status = 'posted' AND e.entry_type IN ('income','expense');
$$;
REVOKE ALL ON FUNCTION public.league_reg_received(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_reg_received(uuid) TO service_role;

-- registration_fee_paid / fee_entry_id follow the lines, for every reader that still reads them.
CREATE OR REPLACE FUNCTION public.league_reg_money_sync(p_registration uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_fee numeric; v_got numeric; v_last uuid;
BEGIN
  SELECT coalesce(r.fee_amount, s.registration_fee, 0) INTO v_fee
    FROM league_registrations r JOIN league_seasons s ON s.id = r.season_id WHERE r.id = p_registration;
  v_got := league_reg_received(p_registration);
  SELECT e.id INTO v_last FROM accounting_entries e
   WHERE e.source_module = 'league_registration' AND e.source_entity_id = p_registration
     AND e.status = 'posted' AND e.entry_type = 'income'
   ORDER BY e.entry_date DESC, e.created_at DESC LIMIT 1;
  UPDATE league_registrations r
     SET registration_fee_paid = (v_fee > 0 AND v_got >= v_fee), fee_entry_id = v_last, updated_at = now()
   WHERE r.id = p_registration;
END $$;
REVOKE ALL ON FUNCTION public.league_reg_money_sync(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_reg_money_sync(uuid) TO service_role;

-- p_action:
--   'receive' — money in. p_amount NULL = the whole balance owed; never more than it. Only an accepted child owes (Q1).
--   'refund'  — money out, its own line. p_amount NULL = everything received; never more than it. p_reason = why.
--   'undo'    — the latest payment was marked by mistake: void it (refused if refunds would leave the figure below zero).
--   'price'   — p_amount = the new price, p_reason required. Paid more than the new price → the difference is refunded
--               (p_day, p_method); paid less → the difference shows owing. Records the change in the price history.
-- Returns the line written (or voided) and a refusal word; a refusal writes nothing. The caller pre-checks the closed
-- fiscal year; the lock trigger (mig 318) refuses a closed-year write regardless.
CREATE OR REPLACE FUNCTION public.club_league_money(
  p_org uuid, p_season uuid, p_registration uuid, p_action text,
  p_amount numeric, p_day date, p_method text, p_reason text, p_actor uuid
) RETURNS TABLE (entry uuid, refusal text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reg league_registrations%ROWTYPE; v_season league_seasons%ROWTYPE;
  v_fee numeric; v_got numeric; v_amt numeric; v_book uuid; v_id uuid; v_line accounting_entries%ROWTYPE;
  v_who text; v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
  v_method text := nullif(btrim(coalesce(p_method,'')), '');
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

  IF p_action = 'receive' THEN
    IF v_reg.status IN ('declined','withdrawn') THEN RETURN QUERY SELECT NULL::uuid, 'ended'::text; RETURN; END IF;
    IF v_reg.status <> 'active' THEN RETURN QUERY SELECT NULL::uuid, 'not_accepted'::text; RETURN; END IF;
    IF v_fee - v_got <= 0 THEN RETURN QUERY SELECT NULL::uuid, 'already_received'::text; RETURN; END IF;
    v_amt := coalesce(p_amount, v_fee - v_got);
    IF v_amt <= 0 THEN RETURN QUERY SELECT NULL::uuid, 'amount'::text; RETURN; END IF;
    IF v_amt > v_fee - v_got THEN RETURN QUERY SELECT NULL::uuid, 'over'::text; RETURN; END IF;
    IF p_day IS NULL THEN RAISE EXCEPTION 'A payment needs a day'; END IF;
    v_book := club_league_season_ledger(p_org, p_season);
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes, created_at)
    VALUES (v_book, p_day, v_who || ' — registration fee', v_amt, 'income', 'posted', 'registration_fee',
      'league_registration', p_registration, p_actor, v_method, v_reason, clock_timestamp())
    RETURNING id INTO v_id;

  ELSIF p_action = 'refund' THEN
    IF v_got <= 0 THEN RETURN QUERY SELECT NULL::uuid, 'nothing_received'::text; RETURN; END IF;
    v_amt := coalesce(p_amount, v_got);
    IF v_amt <= 0 OR v_amt > v_got THEN RETURN QUERY SELECT NULL::uuid, 'amount'::text; RETURN; END IF;
    IF p_day IS NULL THEN RAISE EXCEPTION 'A refund needs a day'; END IF;
    v_book := club_league_season_ledger(p_org, p_season);
    INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
      source_module, source_entity_id, created_by, payment_method, notes, created_at)
    VALUES (v_book, p_day, v_who || ' — refund', v_amt, 'expense', 'posted', 'registration_refund',
      'league_registration', p_registration, p_actor, v_method, v_reason, clock_timestamp())
    RETURNING id INTO v_id;

  ELSIF p_action = 'undo' THEN
    SELECT * INTO v_line FROM accounting_entries e
     WHERE e.source_module = 'league_registration' AND e.source_entity_id = p_registration
       AND e.status = 'posted' AND e.entry_type = 'income'
     ORDER BY e.entry_date DESC, e.created_at DESC LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RETURN QUERY SELECT NULL::uuid, 'nothing_received'::text; RETURN; END IF;
    IF v_got - v_line.amount < 0 THEN RETURN QUERY SELECT NULL::uuid, 'refunded'::text; RETURN; END IF;
    PERFORM club_fee_void(v_line.id, p_actor, coalesce(v_reason, 'Marked received by mistake'));
    v_id := v_line.id;

  ELSE -- price
    IF v_reg.status IN ('declined','withdrawn') THEN RETURN QUERY SELECT NULL::uuid, 'ended'::text; RETURN; END IF;
    IF p_amount IS NULL OR p_amount < 0 THEN RETURN QUERY SELECT NULL::uuid, 'amount'::text; RETURN; END IF;
    IF p_amount = v_fee THEN RETURN QUERY SELECT NULL::uuid, 'same'::text; RETURN; END IF;
    IF v_reason IS NULL THEN RETURN QUERY SELECT NULL::uuid, 'reason'::text; RETURN; END IF;
    IF char_length(v_reason) > 500 THEN RAISE EXCEPTION 'A reason is at most 500 characters'; END IF;
    IF v_got > p_amount THEN
      -- Paid more than the new price: the difference goes back to the family, its own line out.
      IF p_day IS NULL THEN RAISE EXCEPTION 'A refund needs a day'; END IF;
      v_book := club_league_season_ledger(p_org, p_season);
      INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
        source_module, source_entity_id, created_by, payment_method, notes, created_at)
      VALUES (v_book, p_day, v_who || ' — refund', v_got - p_amount, 'expense', 'posted', 'registration_refund',
        'league_registration', p_registration, p_actor, v_method, v_reason, clock_timestamp())
      RETURNING id INTO v_id;
    END IF;
    INSERT INTO league_registration_price_changes(org_id, season_id, registration_id, kind, old_amount, new_amount,
      reason, refund_entry_id, changed_by)
    VALUES (p_org, p_season, p_registration, 'corrected', v_fee, p_amount, v_reason, v_id, p_actor);
    UPDATE league_registrations r SET fee_amount = p_amount, updated_at = now() WHERE r.id = p_registration;
  END IF;

  PERFORM league_reg_money_sync(p_registration);
  RETURN QUERY SELECT v_id, NULL::text;
END $$;
REVOKE ALL ON FUNCTION public.club_league_money(uuid,uuid,uuid,text,numeric,date,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_league_money(uuid,uuid,uuid,text,numeric,date,text,text,uuid) TO service_role;

-- 5 · Ending, honest --------------------------------------------------------------------------
-- Decline / withdraw / release the spot. A registration that has received money asks what happened to it:
-- 'refunded' (through the writer: p_day, p_method, p_money_reason) or 'kept' (p_money_reason required). One transaction
-- with the waitlist gap and the promotion; nothing is voided — the payment stays in the book with any refund beside it.
CREATE OR REPLACE FUNCTION public.league_registration_close(
  p_org uuid, p_season uuid, p_registration uuid, p_status text, p_notes text, p_actor uuid, p_promote boolean,
  p_released boolean, p_money text, p_money_reason text, p_day date, p_method text
) RETURNS TABLE (prior_status text, promoted uuid, refusal text, refund_entry uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reg league_registrations%ROWTYPE; v_promoted uuid; v_got numeric; v_refund uuid; v_refusal text;
  v_reason text := nullif(btrim(coalesce(p_money_reason,'')), ''); v_money text := p_money;
BEGIN
  IF p_status NOT IN ('declined','withdrawn') THEN RAISE EXCEPTION 'Invalid ending status'; END IF;
  IF p_money IS NOT NULL AND p_money NOT IN ('refunded','kept') THEN RAISE EXCEPTION 'Invalid money answer'; END IF;
  PERFORM 1 FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  SELECT * INTO v_reg FROM league_registrations r
   WHERE r.id = p_registration AND r.org_id = p_org AND r.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
  IF v_reg.status IN ('declined','withdrawn') THEN
    RETURN QUERY SELECT v_reg.status, NULL::uuid, 'ended'::text, NULL::uuid; RETURN;
  END IF;
  IF coalesce(p_released, false) AND v_reg.status <> 'active' THEN
    RETURN QUERY SELECT v_reg.status, NULL::uuid, 'not_accepted'::text, NULL::uuid; RETURN;
  END IF;

  v_got := league_reg_received(p_registration);
  IF v_got > 0 THEN
    IF v_money IS NULL THEN RETURN QUERY SELECT v_reg.status, NULL::uuid, 'money'::text, NULL::uuid; RETURN; END IF;
    IF v_money = 'kept' AND v_reason IS NULL THEN
      RETURN QUERY SELECT v_reg.status, NULL::uuid, 'reason'::text, NULL::uuid; RETURN;
    END IF;
    IF v_money = 'refunded' THEN
      SELECT m.entry, m.refusal INTO v_refund, v_refusal
        FROM club_league_money(p_org, p_season, p_registration, 'refund', NULL, p_day, p_method, v_reason, p_actor) m;
      IF v_refusal IS NOT NULL THEN RETURN QUERY SELECT v_reg.status, NULL::uuid, v_refusal, NULL::uuid; RETURN; END IF;
    END IF;
  ELSE
    v_money := NULL; v_reason := NULL;
  END IF;

  UPDATE league_registrations r SET status = p_status, waitlist_position = NULL, ended_at = now(),
    spot_released = coalesce(p_released, false), end_money = v_money, end_money_reason = v_reason,
    admin_notes = coalesce(p_notes, r.admin_notes), updated_at = now()
   WHERE r.id = p_registration;
  IF v_reg.status = 'waitlisted' AND v_reg.waitlist_position IS NOT NULL AND v_reg.division_id IS NOT NULL THEN
    PERFORM league_waitlist_close_gap(v_reg.division_id, v_reg.waitlist_position);
  END IF;
  IF p_promote AND v_reg.status IN ('active','pending_review') THEN
    v_promoted := league_waitlist_promote_locked(v_reg.division_id, NULL);
  END IF;
  RETURN QUERY SELECT v_reg.status, v_promoted, NULL::text, v_refund;
END $$;
REVOKE ALL ON FUNCTION public.league_registration_close(uuid,uuid,uuid,text,text,uuid,boolean,boolean,text,text,date,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_registration_close(uuid,uuid,uuid,text,text,uuid,boolean,boolean,text,text,date,text) TO service_role;

-- The 9b-1 ending (same signature, for the code before this release): an ending with no money answer. A registration
-- that has received money is refused rather than voided — the old silent void is gone.
CREATE OR REPLACE FUNCTION public.league_registration_end(
  p_org uuid, p_season uuid, p_registration uuid, p_status text, p_notes text, p_actor uuid, p_promote boolean
) RETURNS TABLE (prior_status text, promoted uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prior text; v_promoted uuid; v_refusal text;
BEGIN
  PERFORM 1 FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  SELECT c.prior_status, c.promoted, c.refusal INTO v_prior, v_promoted, v_refusal
    FROM league_registration_close(p_org, p_season, p_registration, p_status, p_notes, p_actor, p_promote,
      false, NULL, NULL, NULL, NULL) c;
  IF v_refusal = 'money' THEN RAISE EXCEPTION 'money_unsettled: this registration has money on it'; END IF;
  RETURN QUERY SELECT v_prior, v_promoted;
END $$;
REVOKE ALL ON FUNCTION public.league_registration_end(uuid,uuid,uuid,text,text,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_registration_end(uuid,uuid,uuid,text,text,uuid,boolean) TO service_role;

-- 6 · Move division, with a price -------------------------------------------------------------
-- p_price NULL keeps the price. A child who has received money keeps theirs (kept_price = true); re-pricing a paid child
-- is Correct the price's job, where the difference is settled.
CREATE OR REPLACE FUNCTION public.league_registration_move_division(
  p_org uuid, p_season uuid, p_registration uuid, p_division uuid, p_promote boolean, p_price numeric, p_actor uuid
) RETURNS TABLE (refusal text, promoted uuid, kept_price boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_refusal text; v_promoted uuid; v_old numeric; v_kept boolean := false;
BEGIN
  IF p_price IS NOT NULL AND p_price < 0 THEN RAISE EXCEPTION 'A price is never below zero'; END IF;
  PERFORM 1 FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  SELECT coalesce(r.fee_amount, s.registration_fee) INTO v_old
    FROM league_registrations r JOIN league_seasons s ON s.id = r.season_id
   WHERE r.id = p_registration AND r.org_id = p_org AND r.season_id = p_season;
  SELECT c.refusal, c.promoted INTO v_refusal, v_promoted
    FROM league_registration_change_division(p_org, p_season, p_registration, p_division, p_promote) c;
  IF v_refusal IS NOT NULL THEN RETURN QUERY SELECT v_refusal, NULL::uuid, false; RETURN; END IF;
  IF p_price IS NOT NULL AND p_price IS DISTINCT FROM v_old THEN
    IF league_reg_received(p_registration) > 0 THEN
      v_kept := true;
    ELSE
      INSERT INTO league_registration_price_changes(org_id, season_id, registration_id, kind, old_amount, new_amount, changed_by)
      VALUES (p_org, p_season, p_registration, 'moved', v_old, p_price, p_actor);
      UPDATE league_registrations r SET fee_amount = p_price, updated_at = now() WHERE r.id = p_registration;
      PERFORM league_reg_money_sync(p_registration);
    END IF;
  END IF;
  RETURN QUERY SELECT NULL::text, v_promoted, v_kept;
END $$;
REVOKE ALL ON FUNCTION public.league_registration_move_division(uuid,uuid,uuid,uuid,boolean,numeric,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_registration_move_division(uuid,uuid,uuid,uuid,boolean,numeric,uuid) TO service_role;

-- 7 · The old paid tick (mig 342 / 361 signature, for the code before this release) -----------
-- paid = true receives the whole balance (dated p_day, method unknown); paid = false undoes the payments. Same returns.
CREATE OR REPLACE FUNCTION public.club_league_fee_set(
  p_org uuid, p_season uuid, p_registration uuid, p_paid boolean, p_actor uuid, p_day date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_reg league_registrations%ROWTYPE; v_entry uuid; v_refusal text;
BEGIN
  SELECT * INTO v_reg FROM league_registrations
    WHERE id=p_registration AND org_id=p_org AND season_id=p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
  IF p_paid AND v_reg.status IN ('declined','withdrawn') THEN
    RAISE EXCEPTION 'A declined or withdrawn registration cannot be marked paid';
  END IF;
  IF p_paid THEN
    IF v_reg.status <> 'active' THEN RAISE EXCEPTION 'Only an accepted registration owes its fee'; END IF;
    SELECT m.entry, m.refusal INTO v_entry, v_refusal
      FROM club_league_money(p_org, p_season, p_registration, 'receive', NULL, p_day, NULL, NULL, p_actor) m;
    IF v_refusal = 'already_received' THEN RETURN v_reg.fee_entry_id; END IF;
    RETURN v_entry;
  END IF;
  -- A pending line from before mig 342's paid-only rule never counted; undoing clears it too (as 342 did).
  PERFORM club_fee_void(e.id, p_actor, 'Fee payment undone') FROM accounting_entries e
   WHERE e.source_module = 'league_registration' AND e.source_entity_id = p_registration AND e.status = 'pending';
  LOOP
    SELECT m.refusal INTO v_refusal
      FROM club_league_money(p_org, p_season, p_registration, 'undo', NULL, NULL, NULL, 'Fee payment undone', p_actor) m;
    EXIT WHEN v_refusal IS NOT NULL;
  END LOOP;
  PERFORM league_reg_money_sync(p_registration);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.club_league_fee_set(uuid,uuid,uuid,boolean,uuid,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_league_fee_set(uuid,uuid,uuid,boolean,uuid,date) TO service_role;

-- 8 · The catch-up: a paid tick with nothing posted gets its line ------------------------------
-- The frozen price, dated the registration's last change (the club's day), method not recorded. A pending line the old
-- fixture wrote is voided first (it never counted). A row that cannot be posted (a closed fiscal year) is skipped and
-- named in the migration's notices.
DO $$
DECLARE r record; v_book uuid; v_id uuid; v_day date;
BEGIN
  FOR r IN
    SELECT lr.id, lr.org_id, lr.season_id, lr.fee_entry_id, lr.player_first_name, lr.player_last_name, lr.updated_at,
           coalesce(lr.fee_amount, s.registration_fee, 0) AS fee
      FROM league_registrations lr JOIN league_seasons s ON s.id = lr.season_id
     WHERE lr.registration_fee_paid AND lr.status NOT IN ('declined','withdrawn')
       AND coalesce(lr.fee_amount, s.registration_fee, 0) > 0
       AND league_reg_received(lr.id) = 0
  LOOP
    BEGIN
      v_day := (r.updated_at AT TIME ZONE 'America/Toronto')::date;
      IF r.fee_entry_id IS NOT NULL THEN
        UPDATE accounting_entries SET status = 'void', voided_at = now(),
          void_reason = 'Replaced by the catch-up line (migration 368)', updated_at = now()
         WHERE id = r.fee_entry_id AND status = 'pending';
      END IF;
      v_book := club_league_season_ledger(r.org_id, r.season_id);
      INSERT INTO accounting_entries(ledger_id, entry_date, description, amount, entry_type, status, category,
        source_module, source_entity_id, notes)
      VALUES (v_book, v_day, r.player_first_name || ' ' || r.player_last_name || ' — registration fee', r.fee,
        'income', 'posted', 'registration_fee', 'league_registration', r.id, 'Recorded before payments kept a date and method')
      RETURNING id INTO v_id;
      UPDATE league_registrations SET fee_entry_id = v_id WHERE id = r.id;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'catch-up skipped % % (%): %', r.player_first_name, r.player_last_name, r.id, SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;
