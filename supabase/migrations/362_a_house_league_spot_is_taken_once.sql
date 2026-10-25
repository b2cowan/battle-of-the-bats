-- 362 · A house-league spot is taken once (Club Tier Stage 9b-1, Part 3 — a live defect fix; owner rulings 2026-10-24
-- plan §2 contract "capacity atomic + a waitlist that can't collide; no duplicate child; approve respects capacity", and
-- 2026-10-25 "a received child holds a spot").
--
-- Before: the public sign-up counted the division's active registrations, then inserted in a separate request, so two
-- families pressing Sign up for the last spot both got it; a review-first season counted no received child at all; a
-- waitlist place was "count + 1", so two waitlisted children could share one; nothing stopped the same child twice;
-- staff approving a waitlisted child or moving a child to another division never checked for room; declining or
-- withdrawing anyone promoted the first waitlisted child, even when the leaving child held no spot.
--
-- Now every placement goes through these functions, which take the SEASON row lock first (FOR NO KEY UPDATE: it
-- serialises the season's sign-ups and staff moves against each other, and does not block an ordinary insert's foreign-key
-- check). Inside that one transaction they count, decide, write — and promote, when a spot was freed.
--
--   HOLDS A SPOT  = status active or pending_review (a received child holds its spot until staff decide).
--   A division with no capacity has unlimited spots.
--   NOBODY JUMPS THE LINE: while a division has a waitlist, a public sign-up joins it even if a spot is free.
--   A waitlist place is the division's highest place + 1; a child leaving the waitlist closes the gap behind it.
--   THE SAME CHILD ONCE PER SEASON (a declined or withdrawn sign-up aside): the same name (case and spacing ignored) and
--   the same date of birth; with no date of birth, the same name under the same guardian email.
--   No unique index on waitlist_position (closing a gap shifts several rows in one statement; the lock is the
--   guarantee) and none on the child (the rule above is not an index shape, and prod's data was never checked).
--
--   league_registration_place           one child in: the public form (the rule decides) or staff adding by hand.
--   league_registration_move            staff move between Received, Accepted and Waitlist.
--   league_registration_change_division staff move a child to another division of the season.
--   league_registration_end             decline / withdraw: void the fee, end it, close the gap, promote.
--   league_waitlist_promote             the first waitlisted child into a FREE spot.
--   club_league_fee_end                 (mig 342, same signature, for code before this release) = end without promoting.
--
-- service_role only. Refusals come back as a `refusal` word, never an exception, so a route can say why.
BEGIN;

-- league_registration_move's return shape changed while it existed only on dev (this file, before review).
DROP FUNCTION IF EXISTS public.league_registration_move(uuid,uuid,uuid,text,text);

CREATE OR REPLACE FUNCTION public.league_held_count(p_division uuid)
RETURNS integer LANGUAGE sql SET search_path = public AS $$
  SELECT count(*)::int FROM league_registrations
   WHERE division_id = p_division AND status IN ('active','pending_review');
$$;
REVOKE ALL ON FUNCTION public.league_held_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_held_count(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.league_waitlist_close_gap(p_division uuid, p_position integer)
RETURNS void LANGUAGE sql SET search_path = public AS $$
  UPDATE league_registrations SET waitlist_position = waitlist_position - 1, updated_at = now()
   WHERE division_id = p_division AND status = 'waitlisted' AND waitlist_position > p_position;
$$;
REVOKE ALL ON FUNCTION public.league_waitlist_close_gap(uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_waitlist_close_gap(uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.league_name_key(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT regexp_replace(lower(btrim(coalesce(p, ''))), '\s+', ' ', 'g');
$$;
REVOKE ALL ON FUNCTION public.league_name_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_name_key(text) TO service_role;

-- The same child already live in the season (p_exclude: the registration being moved).
CREATE OR REPLACE FUNCTION public.league_is_duplicate(
  p_season uuid, p_exclude uuid, p_first text, p_last text, p_dob date, p_email text
) RETURNS boolean LANGUAGE sql SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_registrations r
     WHERE r.season_id = p_season AND r.id IS DISTINCT FROM p_exclude
       AND r.status NOT IN ('declined','withdrawn')
       AND league_name_key(r.player_first_name) = league_name_key(p_first)
       AND league_name_key(r.player_last_name)  = league_name_key(p_last)
       AND CASE WHEN p_dob IS NOT NULL THEN r.player_date_of_birth = p_dob
                ELSE r.player_date_of_birth IS NULL AND lower(btrim(r.guardian_email)) = lower(btrim(p_email)) END
  );
$$;
REVOKE ALL ON FUNCTION public.league_is_duplicate(uuid,uuid,text,text,date,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_is_duplicate(uuid,uuid,text,text,date,text) TO service_role;

-- The first waitlisted child (other than p_exclude) into a free spot. The CALLER holds the season lock.
CREATE OR REPLACE FUNCTION public.league_waitlist_promote_locked(p_division uuid, p_exclude uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_cap integer; v_next league_registrations%ROWTYPE;
BEGIN
  IF p_division IS NULL THEN RETURN NULL; END IF;
  SELECT d.capacity INTO v_cap FROM league_divisions d WHERE d.id = p_division;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_cap IS NOT NULL AND league_held_count(p_division) >= v_cap THEN RETURN NULL; END IF;
  SELECT * INTO v_next FROM league_registrations r
   WHERE r.division_id = p_division AND r.status = 'waitlisted' AND r.id IS DISTINCT FROM p_exclude
   ORDER BY r.waitlist_position NULLS LAST, r.registered_at LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  UPDATE league_registrations r SET status = 'active', waitlist_position = NULL, updated_at = now() WHERE r.id = v_next.id;
  IF v_next.waitlist_position IS NOT NULL THEN PERFORM league_waitlist_close_gap(p_division, v_next.waitlist_position); END IF;
  RETURN v_next.id;
END $$;
REVOKE ALL ON FUNCTION public.league_waitlist_promote_locked(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_waitlist_promote_locked(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.league_registration_place(
  p_org uuid, p_season uuid, p_division uuid, p_child jsonb, p_want text,
  p_signup_ref text, p_signup_position integer, p_fee numeric
) RETURNS TABLE (id uuid, status text, waitlist_position integer, refusal text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_season league_seasons%ROWTYPE; v_div league_divisions%ROWTYPE;
  v_status text; v_pos integer; v_id uuid; v_room boolean; v_line boolean; v_dob date;
  v_first text := btrim(p_child->>'first'); v_last text := btrim(p_child->>'last');
  v_email text := lower(btrim(p_child->>'guardianEmail'));
BEGIN
  SELECT * INTO v_season FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  SELECT * INTO v_div FROM league_divisions d WHERE d.id = p_division AND d.season_id = p_season;
  IF NOT FOUND THEN RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::integer, 'division'::text; RETURN; END IF;
  IF p_want NOT IN ('auto','active','pending_review','waitlisted','declined','withdrawn') THEN
    RAISE EXCEPTION 'Invalid placement';
  END IF;
  IF coalesce(v_first,'') = '' OR coalesce(v_last,'') = '' THEN RAISE EXCEPTION 'A child needs a first and last name'; END IF;
  v_dob := nullif(btrim(coalesce(p_child->>'dob','')), '')::date;

  IF league_is_duplicate(p_season, NULL, v_first, v_last, v_dob, v_email) THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::integer, 'duplicate'::text; RETURN;
  END IF;

  v_room := v_div.capacity IS NULL OR league_held_count(p_division) < v_div.capacity;
  IF p_want = 'auto' THEN
    -- Nobody jumps the line: a waiting child keeps its turn even when a spot has just freed.
    v_line := EXISTS (SELECT 1 FROM league_registrations r WHERE r.division_id = p_division AND r.status = 'waitlisted');
    v_status := CASE WHEN NOT v_room OR v_line THEN 'waitlisted'
                     WHEN v_season.auto_approve_under_capacity THEN 'active' ELSE 'pending_review' END;
  ELSIF p_want IN ('active','pending_review') AND NOT v_room THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::integer, 'full'::text; RETURN;
  ELSE v_status := p_want;
  END IF;
  IF v_status = 'waitlisted' THEN
    SELECT coalesce(max(r.waitlist_position), 0) + 1 INTO v_pos FROM league_registrations r
     WHERE r.division_id = p_division AND r.status = 'waitlisted';
  END IF;

  INSERT INTO league_registrations (
    season_id, org_id, division_id, player_first_name, player_last_name, player_date_of_birth,
    player_jersey_pref, player_position_pref, player_notes,
    guardian_first_name, guardian_last_name, guardian_email, guardian_phone,
    status, waitlist_position, source, waiver_accepted_at, signup_ref, signup_position, fee_amount
  ) VALUES (
    p_season, p_org, p_division, v_first, v_last, v_dob,
    nullif(p_child->>'jersey',''), nullif(p_child->>'position',''), nullif(p_child->>'notes',''),
    p_child->>'guardianFirst', p_child->>'guardianLast', v_email, nullif(p_child->>'guardianPhone',''),
    v_status, v_pos, coalesce(p_child->>'source','public_form'), nullif(btrim(coalesce(p_child->>'waiverAt','')),'')::timestamptz,
    p_signup_ref, p_signup_position, p_fee
  ) RETURNING league_registrations.id INTO v_id;

  RETURN QUERY SELECT v_id, v_status, v_pos, NULL::text;
END $$;
REVOKE ALL ON FUNCTION public.league_registration_place(uuid,uuid,uuid,jsonb,text,text,integer,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_registration_place(uuid,uuid,uuid,jsonb,text,text,integer,numeric) TO service_role;

-- Staff: Received ↔ Accepted ↔ Waitlist. `changed` says whether anything moved (one email per real change); with
-- p_promote, a child who held a spot going to the waitlist frees it for the first child already waiting.
CREATE OR REPLACE FUNCTION public.league_registration_move(
  p_org uuid, p_season uuid, p_registration uuid, p_to text, p_notes text, p_promote boolean
) RETURNS TABLE (status text, waitlist_position integer, refusal text, changed boolean, promoted uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reg league_registrations%ROWTYPE; v_cap integer; v_pos integer; v_held boolean; v_promoted uuid;
BEGIN
  IF p_to NOT IN ('active','pending_review','waitlisted') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  PERFORM 1 FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  SELECT * INTO v_reg FROM league_registrations r
   WHERE r.id = p_registration AND r.org_id = p_org AND r.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;

  IF v_reg.status = p_to THEN
    IF p_notes IS NOT NULL THEN UPDATE league_registrations r SET admin_notes = p_notes, updated_at = now() WHERE r.id = p_registration; END IF;
    RETURN QUERY SELECT v_reg.status, v_reg.waitlist_position, NULL::text, false, NULL::uuid; RETURN;
  END IF;
  v_held := v_reg.status IN ('active','pending_review');

  -- Coming back from declined / withdrawn must not make the same child twice.
  IF v_reg.status IN ('declined','withdrawn') AND league_is_duplicate(p_season, p_registration,
       v_reg.player_first_name, v_reg.player_last_name, v_reg.player_date_of_birth, v_reg.guardian_email) THEN
    RETURN QUERY SELECT v_reg.status, v_reg.waitlist_position, 'duplicate'::text, false, NULL::uuid; RETURN;
  END IF;

  IF p_to IN ('active','pending_review') THEN
    -- Taking a spot it did not hold needs a free one.
    IF NOT v_held AND v_reg.division_id IS NOT NULL THEN
      SELECT d.capacity INTO v_cap FROM league_divisions d WHERE d.id = v_reg.division_id;
      IF v_cap IS NOT NULL AND league_held_count(v_reg.division_id) >= v_cap THEN
        RETURN QUERY SELECT v_reg.status, v_reg.waitlist_position, 'full'::text, false, NULL::uuid; RETURN;
      END IF;
    END IF;
    UPDATE league_registrations r SET status = p_to, waitlist_position = NULL,
      admin_notes = coalesce(p_notes, r.admin_notes), updated_at = now() WHERE r.id = p_registration;
    IF v_reg.status = 'waitlisted' AND v_reg.waitlist_position IS NOT NULL THEN
      PERFORM league_waitlist_close_gap(v_reg.division_id, v_reg.waitlist_position);
    END IF;
    RETURN QUERY SELECT p_to, NULL::integer, NULL::text, true, NULL::uuid; RETURN;
  END IF;

  -- → waitlisted: the end of its division's line.
  IF v_reg.division_id IS NULL THEN
    RETURN QUERY SELECT v_reg.status, v_reg.waitlist_position, 'no_division'::text, false, NULL::uuid; RETURN;
  END IF;
  SELECT coalesce(max(r.waitlist_position), 0) + 1 INTO v_pos FROM league_registrations r
   WHERE r.division_id = v_reg.division_id AND r.status = 'waitlisted';
  UPDATE league_registrations r SET status = 'waitlisted', waitlist_position = v_pos,
    admin_notes = coalesce(p_notes, r.admin_notes), updated_at = now() WHERE r.id = p_registration;
  IF p_promote AND v_held THEN
    v_promoted := league_waitlist_promote_locked(v_reg.division_id, p_registration);
    IF v_promoted IS NOT NULL THEN
      SELECT r.waitlist_position INTO v_pos FROM league_registrations r WHERE r.id = p_registration;
    END IF;
  END IF;
  RETURN QUERY SELECT 'waitlisted'::text, v_pos, NULL::text, true, v_promoted;
END $$;
REVOKE ALL ON FUNCTION public.league_registration_move(uuid,uuid,uuid,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_registration_move(uuid,uuid,uuid,text,text,boolean) TO service_role;

-- Staff move a child to another division of the season (or clear it). A child holding a spot needs one in the new
-- division; a waitlisted child joins the end of the new line and the old line closes up; a spot freed in the old division
-- goes to its first waiting child (p_promote). The recorded price does not move (re-pricing is 9b-2's).
CREATE OR REPLACE FUNCTION public.league_registration_change_division(
  p_org uuid, p_season uuid, p_registration uuid, p_division uuid, p_promote boolean
) RETURNS TABLE (refusal text, promoted uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reg league_registrations%ROWTYPE; v_cap integer; v_pos integer; v_held boolean; v_promoted uuid;
BEGIN
  PERFORM 1 FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  SELECT * INTO v_reg FROM league_registrations r
   WHERE r.id = p_registration AND r.org_id = p_org AND r.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
  IF v_reg.division_id IS NOT DISTINCT FROM p_division THEN
    RETURN QUERY SELECT NULL::text, NULL::uuid; RETURN;
  END IF;
  v_held := v_reg.status IN ('active','pending_review');

  IF p_division IS NULL THEN
    IF v_reg.status = 'waitlisted' THEN RETURN QUERY SELECT 'no_division'::text, NULL::uuid; RETURN; END IF;
  ELSE
    SELECT d.capacity INTO v_cap FROM league_divisions d WHERE d.id = p_division AND d.season_id = p_season;
    IF NOT FOUND THEN RETURN QUERY SELECT 'division'::text, NULL::uuid; RETURN; END IF;
    IF v_held AND v_cap IS NOT NULL AND league_held_count(p_division) >= v_cap THEN
      RETURN QUERY SELECT 'full'::text, NULL::uuid; RETURN;
    END IF;
    IF v_reg.status = 'waitlisted' THEN
      SELECT coalesce(max(r.waitlist_position), 0) + 1 INTO v_pos FROM league_registrations r
       WHERE r.division_id = p_division AND r.status = 'waitlisted';
    END IF;
  END IF;

  UPDATE league_registrations r SET division_id = p_division,
    waitlist_position = CASE WHEN v_reg.status = 'waitlisted' THEN v_pos ELSE NULL END, updated_at = now()
   WHERE r.id = p_registration;
  IF v_reg.status = 'waitlisted' AND v_reg.waitlist_position IS NOT NULL AND v_reg.division_id IS NOT NULL THEN
    PERFORM league_waitlist_close_gap(v_reg.division_id, v_reg.waitlist_position);
  END IF;
  IF p_promote AND v_held AND v_reg.division_id IS NOT NULL THEN
    v_promoted := league_waitlist_promote_locked(v_reg.division_id, NULL);
  END IF;
  RETURN QUERY SELECT NULL::text, v_promoted;
END $$;
REVOKE ALL ON FUNCTION public.league_registration_change_division(uuid,uuid,uuid,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_registration_change_division(uuid,uuid,uuid,uuid,boolean) TO service_role;

-- Decline / withdraw: void any fee line, end the registration, close its waitlist gap, and — with p_promote — give a
-- freed spot to the first waiting child, all in one transaction (a failure can never leave the spot freed and unfilled).
CREATE OR REPLACE FUNCTION public.league_registration_end(
  p_org uuid, p_season uuid, p_registration uuid, p_status text, p_notes text, p_actor uuid, p_promote boolean
) RETURNS TABLE (prior_status text, promoted uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_reg league_registrations%ROWTYPE; v_promoted uuid;
BEGIN
  IF p_status NOT IN ('declined','withdrawn') THEN RAISE EXCEPTION 'Invalid ending status'; END IF;
  PERFORM 1 FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  SELECT * INTO v_reg FROM league_registrations r
   WHERE r.id = p_registration AND r.org_id = p_org AND r.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registration not found'; END IF;
  IF v_reg.fee_entry_id IS NOT NULL THEN
    PERFORM club_fee_void(v_reg.fee_entry_id, p_actor, 'Registration ' || p_status);
  END IF;
  UPDATE league_registrations r SET status = p_status, registration_fee_paid = false, fee_entry_id = NULL,
    waitlist_position = NULL, admin_notes = coalesce(p_notes, r.admin_notes), updated_at = now()
   WHERE r.id = p_registration;
  IF v_reg.status = 'waitlisted' AND v_reg.waitlist_position IS NOT NULL AND v_reg.division_id IS NOT NULL THEN
    PERFORM league_waitlist_close_gap(v_reg.division_id, v_reg.waitlist_position);
  END IF;
  IF p_promote AND v_reg.status IN ('active','pending_review') THEN
    v_promoted := league_waitlist_promote_locked(v_reg.division_id, NULL);
  END IF;
  RETURN QUERY SELECT v_reg.status, v_promoted;
END $$;
REVOKE ALL ON FUNCTION public.league_registration_end(uuid,uuid,uuid,text,text,uuid,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_registration_end(uuid,uuid,uuid,text,text,uuid,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.league_waitlist_promote(p_org uuid, p_season uuid, p_division uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM 1 FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  PERFORM 1 FROM league_divisions d WHERE d.id = p_division AND d.season_id = p_season;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN league_waitlist_promote_locked(p_division, NULL);
END $$;
REVOKE ALL ON FUNCTION public.league_waitlist_promote(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_waitlist_promote(uuid,uuid,uuid) TO service_role;

-- Ending a registration (mig 342, same signature, for the code before this release): end without promoting.
CREATE OR REPLACE FUNCTION public.club_league_fee_end(
  p_org uuid,p_season uuid,p_registration uuid,p_status text,p_notes text,p_actor uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM 1 FROM league_registration_end(p_org, p_season, p_registration, p_status, p_notes, p_actor, false);
END $$;
REVOKE ALL ON FUNCTION public.club_league_fee_end(uuid,uuid,uuid,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_league_fee_end(uuid,uuid,uuid,text,text,uuid) TO service_role;

COMMIT;
