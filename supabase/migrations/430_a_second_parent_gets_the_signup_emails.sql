-- ---------------------------------------------------------------
-- Migration 430 — Signed-in family accounts Stage 3 Part 1: a second parent's email on the house-league sign-up
-- (plan docs/projects/active/SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md, Stage 3, all six asks ruled A 2026-11-03; build prompt
-- docs/projects/active/SIGNED_IN_FAMILY_STAGE3_BUILD_PROMPT.md, Part 1).
--
-- WHY: a parent signing up a child can add the other parent's email, and both addresses then get every email about the
-- sign-up (receipts and refunds excepted: they follow whoever paid). No place for it exists today.
--
-- WHAT CHANGES (league_registrations, one column):
--   guardian_email_2 text NULL — the second parent's email, as the first parent (or club staff) typed it, stored
--   lowercased and trimmed exactly as guardian_email is (normalizeGuardianEmailRequired). One address per SIGN-UP: every
--   child sharing a signup_ref carries the same value. Null = no second parent.
--
-- ⚠ NOT a household key. Households, the status page lookup, the pay/status joins and the duplicate rule all stay on
-- guardian_email. ⚠ NEVER read for marketing or consent: the first parent's tick-box is one person's consent, and the
-- second address was typed by someone else (ask 3).
--
-- The CHECK holds the shape the code writes (lowercased, trimmed, non-empty, at most 200 like the form's cap) and the
-- drawn refusal "the same email as yours": the second address can never equal the first. A staff edit that would make
-- them equal is refused in the route with words before it reaches this.
--
-- AND league_registration_place (the ONE way a child is placed, lib/league-registration-place.ts) writes it from
-- p_child->>'guardianEmail2' inside the same locked step, so every placed child of the sign-up carries it. Redefined from
-- the LIVE dev definition (pg_get_functiondef, 2026-11-03), changed in exactly two places (the v_email2 line and the
-- column in the INSERT). ⚠ The duplicate rule (league_is_duplicate) still keys on the FIRST address only. CREATE OR
-- REPLACE keeps the function's owner and grants.
--
-- Safe on a table with rows: a nullable column, no default, no rewrite. Re-runnable.
-- ---------------------------------------------------------------

ALTER TABLE public.league_registrations
  ADD COLUMN IF NOT EXISTS guardian_email_2 text NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'league_registrations_guardian_email_2_check') THEN
    ALTER TABLE public.league_registrations
      ADD CONSTRAINT league_registrations_guardian_email_2_check CHECK (
        guardian_email_2 IS NULL OR (
          guardian_email_2 = lower(btrim(guardian_email_2))
          AND guardian_email_2 <> ''
          AND char_length(guardian_email_2) <= 200
          AND guardian_email_2 <> lower(btrim(guardian_email))
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.league_registration_place(p_org uuid, p_season uuid, p_division uuid, p_child jsonb, p_want text, p_signup_ref text, p_signup_position integer, p_fee numeric)
 RETURNS TABLE(id uuid, status text, waitlist_position integer, refusal text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_season league_seasons%ROWTYPE; v_div league_divisions%ROWTYPE;
  v_status text; v_pos integer; v_id uuid; v_room boolean; v_line boolean; v_dob date;
  v_first text := btrim(p_child->>'first'); v_last text := btrim(p_child->>'last');
  v_email text := lower(btrim(p_child->>'guardianEmail'));
  -- Mig 430: the second parent's email, the same on every child of the sign-up; empty = none. Never read below.
  v_email2 text := nullif(lower(btrim(coalesce(p_child->>'guardianEmail2', ''))), '');
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
    guardian_first_name, guardian_last_name, guardian_email, guardian_email_2, guardian_phone,
    status, waitlist_position, source, waiver_accepted_at, signup_ref, signup_position, fee_amount
  ) VALUES (
    p_season, p_org, p_division, v_first, v_last, v_dob,
    nullif(p_child->>'jersey',''), nullif(p_child->>'position',''), nullif(p_child->>'notes',''),
    p_child->>'guardianFirst', p_child->>'guardianLast', v_email, v_email2, nullif(p_child->>'guardianPhone',''),
    v_status, v_pos, coalesce(p_child->>'source','public_form'), nullif(btrim(coalesce(p_child->>'waiverAt','')),'')::timestamptz,
    p_signup_ref, p_signup_position, p_fee
  ) RETURNING league_registrations.id INTO v_id;

  RETURN QUERY SELECT v_id, v_status, v_pos, NULL::text;
END $function$;

COMMENT ON COLUMN public.league_registrations.guardian_email_2 IS
  'The second parent''s email (Signed-in family accounts Stage 3), lowercased and trimmed; the same on every child of the sign-up. Receives every email about the sign-up except receipts and refunds. Never a household key; never read for marketing or consent. Null = none.';
