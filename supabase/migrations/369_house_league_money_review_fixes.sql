-- ---------------------------------------------------------------
-- Migration 369 — Club Tier Stage 9b-2 Part 1, /review fixes to mig 368 (house-league money).
-- Plan: docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md §0e, §9 (2026-10-25 review).
--
-- WHAT CHANGES (all functions; nothing visible to check:migrations):
--   1. club_league_money takes p_entry (the payment an Undo means). Undo voids THAT payment, or refuses 'changed' when the
--      latest payment is a different one (a double press, a stale window); "latest" is the one entered last. Undo is
--      refused on an ended registration (a fee the club kept stays kept). A missing day is the refusal 'date', never a
--      raised error. Amounts are rounded to the cent before any comparison.
--   2. league_registration_close: a refund with no day is the refusal 'date'.
--   3. league_registration_move_division reads the price AFTER the move holds the registration (a correction landing in
--      between is no longer overwritten), and writes the price onto a registration that had none.
--   4. The accepted-at trigger clears how a registration ended when it is revived (declined / withdrawn → live).
-- The 9-argument club_league_money (mig 368) is dropped: it existed only on dev, and one signature keeps PostgREST's
-- named call unambiguous. Its in-database callers (league_registration_close, club_league_fee_set) call it positionally
-- and resolve to the new one (p_entry defaults to NULL).
-- ---------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.league_registrations_accepted_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    NEW.accepted_at := now();
  ELSIF NEW.status IN ('pending_review','waitlisted') THEN
    NEW.accepted_at := NULL;
  END IF;
  -- A revived registration is live again: how it ended no longer describes it (its book lines keep the history).
  IF TG_OP = 'UPDATE' AND OLD.status IN ('declined','withdrawn') AND NEW.status NOT IN ('declined','withdrawn') THEN
    NEW.ended_at := NULL; NEW.spot_released := false; NEW.end_money := NULL; NEW.end_money_reason := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP FUNCTION IF EXISTS public.club_league_money(uuid,uuid,uuid,text,numeric,date,text,text,uuid);

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
      IF p_day IS NULL THEN RETURN QUERY SELECT v_reg.status, NULL::uuid, 'date'::text, NULL::uuid; RETURN; END IF;
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

CREATE OR REPLACE FUNCTION public.league_registration_move_division(
  p_org uuid, p_season uuid, p_registration uuid, p_division uuid, p_promote boolean, p_price numeric, p_actor uuid
) RETURNS TABLE (refusal text, promoted uuid, kept_price boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_refusal text; v_promoted uuid; v_old numeric; v_own numeric; v_kept boolean := false;
  v_price numeric := round(p_price, 2);
BEGIN
  IF v_price IS NOT NULL AND v_price < 0 THEN RAISE EXCEPTION 'A price is never below zero'; END IF;
  PERFORM 1 FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  SELECT c.refusal, c.promoted INTO v_refusal, v_promoted
    FROM league_registration_change_division(p_org, p_season, p_registration, p_division, p_promote) c;
  IF v_refusal IS NOT NULL THEN RETURN QUERY SELECT v_refusal, NULL::uuid, false; RETURN; END IF;
  -- The move holds the registration now (league_registration_change_division locked it): read its price under that lock.
  SELECT r.fee_amount, coalesce(r.fee_amount, s.registration_fee) INTO v_own, v_old
    FROM league_registrations r JOIN league_seasons s ON s.id = r.season_id
   WHERE r.id = p_registration AND r.org_id = p_org AND r.season_id = p_season;
  IF v_price IS NOT NULL AND (v_price IS DISTINCT FROM v_old OR v_own IS NULL) THEN
    IF league_reg_received(p_registration) > 0 THEN
      v_kept := v_price IS DISTINCT FROM v_old;
    ELSE
      IF v_price IS DISTINCT FROM v_old THEN
        INSERT INTO league_registration_price_changes(org_id, season_id, registration_id, kind, old_amount, new_amount, changed_by)
        VALUES (p_org, p_season, p_registration, 'moved', v_old, v_price, p_actor);
      END IF;
      UPDATE league_registrations r SET fee_amount = v_price, updated_at = now() WHERE r.id = p_registration;
      PERFORM league_reg_money_sync(p_registration);
    END IF;
  END IF;
  RETURN QUERY SELECT NULL::text, v_promoted, v_kept;
END $$;
REVOKE ALL ON FUNCTION public.league_registration_move_division(uuid,uuid,uuid,uuid,boolean,numeric,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_registration_move_division(uuid,uuid,uuid,uuid,boolean,numeric,uuid) TO service_role;

COMMIT;
