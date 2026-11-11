-- ---------------------------------------------------------------
-- Migration 461 — Board Ready Stage 1 Part 1 (friend requests in the house-league draft; plan
-- docs/projects/active/BOARD_READY_PLAN.md §5 Stage 1, build prompt BOARD_READY_S1_FRIEND_REQUESTS_BUILD_PROMPT.md Part 1;
-- drawings BOARD_READY_FRIEND_REQUESTS_DRAWINGS.html tabs 1–3, every ask ruled as recommended, owner 2026-11-10).
--
-- WHY: a parent signing a child up for the house league can name up to the club's maximum of friends the child would
-- like to play with, by name or by the other family's FRIEND CODE. The registrar confirms name matches (Part 2); a code
-- match arrives confirmed; the draft keeps confirmed friends together (Part 3).
--
-- WHAT CHANGES:
--   (1) league_seasons.friend_requests_max — the season's maximum per child: 0 (None: the form asks nothing and the
--       Friend requests view is absent), 1 or 2. Default 2 (ruling A8).
--   (2) league_registrations.friend_code — one code per child sign-up, six characters from 2–9 and A–Z without I and O;
--       the sixth is a check letter (lib/league-friend-code.ts; the SQL twin is league_friend_code_new below, and the
--       two must stay identical). Unique within a season. Filled by a BEFORE INSERT trigger on every insert path (the
--       family's form, a staff add, a carry-over), and backfilled here for every sign-up in a season that is not
--       finished. A finished season's sign-ups get none: their requests are deleted at the finish (ruling A12, Part 2).
--   (3) league_friend_requests — ONE ROW PER FRIEND A FAMILY NAMED, hung on the season's registration (the asking
--       child's sign-up), never on the child's cross-season record (/legal build rule), so the deletion at the season's
--       end is clean. Typed first / last / parent name, or the code entered; the state (to_confirm · confirmed ·
--       not_signed_up · cant_honour); the mark (different_division); the matched sign-up; the reason and note; who
--       decided and when; who kept them apart and when (Part 3). SERVICE ROLE ONLY: mig 020 lets every org member read
--       league_registrations, and these names are for the seats that can open Registrations alone (ruling A11).
--   (4) league_friend_requests_save — one child's whole list saved in ONE transaction (keep / move / replace; a code
--       resolves to a live sign-up). /review 2026-11-11: a delete-then-insert from the app could lose a family's set.
--   (5) a reopened season (finished → live) gives a code to every sign-up without one (trigger on league_seasons).
--
-- Additive. Re-runnable (IF NOT EXISTS / CREATE OR REPLACE; the backfill fills only empty codes). check:migrations sees
-- the columns, the table and the indexes; the two functions and the trigger are invisible to it (MANUAL_PROD_STEPS.json).
-- Apply BEFORE promoting the code (the register route and "Your sign-up" read and write these).
-- ---------------------------------------------------------------

BEGIN;

-- ─── 1 · The season's maximum ───────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.league_seasons
  ADD COLUMN IF NOT EXISTS friend_requests_max smallint NOT NULL DEFAULT 2;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'league_seasons_friend_requests_max_check') THEN
    ALTER TABLE public.league_seasons
      ADD CONSTRAINT league_seasons_friend_requests_max_check CHECK (friend_requests_max IN (0, 1, 2));
  END IF;
END $$;

-- ─── 2 · The friend code ────────────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.league_registrations
  ADD COLUMN IF NOT EXISTS friend_code text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'league_registrations_friend_code_check') THEN
    ALTER TABLE public.league_registrations
      ADD CONSTRAINT league_registrations_friend_code_check
      CHECK (friend_code IS NULL OR friend_code ~ '^[2-9A-HJ-NP-Z]{5}[A-HJ-NP-Y]$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS league_registrations_friend_code_uniq
  ON public.league_registrations (season_id, friend_code) WHERE friend_code IS NOT NULL;

-- A new code, not yet used in the season. The check letter: the five data characters' places in the 32-symbol
-- alphabet, weighted 1..5, summed, mod 23, picking one of 23 letters (A–Z without I, O, Z). Identical to
-- lib/league-friend-code.ts makeFriendCode (tests/unit/league-friend-code.test.ts pins both).
CREATE OR REPLACE FUNCTION public.league_friend_code_new(p_season uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_alpha  constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_checks constant text := 'ABCDEFGHJKLMNPQRSTUVWXY';
  v_data   text;
  v_sum    integer;
  v_idx    integer;
  v_code   text;
  v_try    integer := 0;
BEGIN
  LOOP
    v_data := '';
    v_sum := 0;
    FOR i IN 1..5 LOOP
      v_idx := floor(random() * 32)::integer;          -- 0..31
      v_data := v_data || substr(v_alpha, v_idx + 1, 1);
      v_sum := v_sum + i * v_idx;
    END LOOP;
    v_code := v_data || substr(v_checks, (v_sum % 23) + 1, 1);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.league_registrations WHERE season_id = p_season AND friend_code = v_code
    );
    v_try := v_try + 1;
    IF v_try > 50 THEN RAISE EXCEPTION 'league_friend_code_new: no free code after 50 tries'; END IF;
  END LOOP;
  RETURN v_code;
END $$;

CREATE OR REPLACE FUNCTION public.league_registrations_friend_code_fill()
RETURNS trigger
LANGUAGE plpgsql
-- DEFINER so the generator (service role only) runs whoever inserts; mig 020 still lets a public insert through RLS.
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.friend_code IS NULL THEN
    NEW.friend_code := public.league_friend_code_new(NEW.season_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS league_registrations_friend_code_fill ON public.league_registrations;
CREATE TRIGGER league_registrations_friend_code_fill
  BEFORE INSERT ON public.league_registrations
  FOR EACH ROW EXECUTE FUNCTION public.league_registrations_friend_code_fill();

REVOKE ALL ON FUNCTION public.league_friend_code_new(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_registrations_friend_code_fill() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_friend_code_new(uuid) TO service_role;

-- Backfill: every sign-up in a season that is not finished, one at a time (each call sees the codes already given).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT lr.id, lr.season_id
      FROM public.league_registrations lr
      JOIN public.league_seasons s ON s.id = lr.season_id
     WHERE lr.friend_code IS NULL
       AND s.status NOT IN ('completed', 'archived')
  LOOP
    UPDATE public.league_registrations
       SET friend_code = public.league_friend_code_new(r.season_id)
     WHERE id = r.id;
  END LOOP;
END $$;

-- ─── 3 · The requests ───────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_friend_requests (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id                uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  -- The asking child's sign-up: deleting it deletes what its family typed.
  registration_id          uuid NOT NULL REFERENCES public.league_registrations(id) ON DELETE CASCADE,
  slot                     smallint NOT NULL CHECK (slot BETWEEN 1 AND 2),
  typed_first              text CHECK (typed_first IS NULL OR char_length(typed_first) BETWEEN 1 AND 80),
  typed_last               text CHECK (typed_last IS NULL OR char_length(typed_last) BETWEEN 1 AND 80),
  typed_parent             text CHECK (typed_parent IS NULL OR char_length(typed_parent) BETWEEN 1 AND 120),
  code_entered             text CHECK (code_entered IS NULL OR code_entered ~ '^[2-9A-HJ-NP-Z]{5}[A-HJ-NP-Y]$'),
  state                    text NOT NULL DEFAULT 'to_confirm'
                           CHECK (state IN ('to_confirm', 'confirmed', 'not_signed_up', 'cant_honour')),
  mark                     text CHECK (mark IS NULL OR mark IN ('different_division')),
  matched_registration_id  uuid REFERENCES public.league_registrations(id) ON DELETE SET NULL,
  reason                   text CHECK (reason IS NULL OR reason IN ('different_division', 'other')),
  note                     text CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 280),
  decided_by               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at               timestamptz,
  kept_apart_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kept_apart_at            timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  -- A friend is named by a code, or by a name (a first or a last name at least; the parent's name only helps).
  CONSTRAINT league_friend_requests_named CHECK (
    (code_entered IS NOT NULL AND typed_first IS NULL AND typed_last IS NULL AND typed_parent IS NULL)
    OR (code_entered IS NULL AND (typed_first IS NOT NULL OR typed_last IS NOT NULL))
  ),
  -- Never a request for the asking child itself.
  CONSTRAINT league_friend_requests_not_self CHECK (matched_registration_id IS NULL OR matched_registration_id <> registration_id),
  CONSTRAINT league_friend_requests_slot_uniq UNIQUE (registration_id, slot)
);

CREATE INDEX IF NOT EXISTS league_friend_requests_season_idx ON public.league_friend_requests (season_id);
CREATE INDEX IF NOT EXISTS league_friend_requests_org_idx ON public.league_friend_requests (org_id);
CREATE INDEX IF NOT EXISTS league_friend_requests_matched_idx
  ON public.league_friend_requests (matched_registration_id) WHERE matched_registration_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS league_friend_requests_decided_by_idx
  ON public.league_friend_requests (decided_by) WHERE decided_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS league_friend_requests_kept_apart_by_idx
  ON public.league_friend_requests (kept_apart_by) WHERE kept_apart_by IS NOT NULL;

ALTER TABLE public.league_friend_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.league_friend_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_friend_requests TO service_role;

-- ─── 4 · Saving one child's friends, in one step (/review 2026-11-11) ───────────────────────────────────────────────
-- The family's form and "Your sign-up"'s Change send the child's whole list (already checked by lib/league-friends.ts
-- readFriends: [{by:'name', first, last, parent} | {by:'code', code}], at most 2, in slot order). One transaction:
-- the registration row is locked (a double press waits), a row whose friend is still asked for is KEPT with every
-- column it had (the registrar's decision stands) and takes its new slot, the rest are replaced. A code resolves here:
-- a LIVE sign-up (not declined or withdrawn) in the same season; the same division arrives confirmed (decided_at only),
-- another division waits marked different_division, an asking child with no division waits unmarked, no match waits
-- with no match. Nothing is returned: the family is never told what matched.
CREATE OR REPLACE FUNCTION public.league_friend_requests_save(
  p_org uuid, p_season uuid, p_registration uuid, p_friends jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_division uuid;
  v_old      public.league_friend_requests[];
  v_used     uuid[] := ARRAY[]::uuid[];
  v_keep     public.league_friend_requests;
  v_f        jsonb;
  v_i        integer := 0;
  v_by       text;
  v_first    text; v_last text; v_parent text; v_code text;
  v_hit      record;
BEGIN
  SELECT division_id INTO v_division FROM public.league_registrations
   WHERE id = p_registration AND season_id = p_season AND org_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'league_friend_requests_save: not_found'; END IF;
  IF jsonb_typeof(p_friends) <> 'array' OR jsonb_array_length(p_friends) > 2 THEN
    RAISE EXCEPTION 'league_friend_requests_save: bad_list';
  END IF;

  SELECT coalesce(array_agg(r ORDER BY r.slot), ARRAY[]::public.league_friend_requests[]) INTO v_old
    FROM public.league_friend_requests r WHERE r.registration_id = p_registration;
  DELETE FROM public.league_friend_requests WHERE registration_id = p_registration;

  FOR v_f IN SELECT value FROM jsonb_array_elements(p_friends) LOOP
    v_i := v_i + 1;
    v_by := v_f->>'by';
    v_first := nullif(btrim(v_f->>'first'), ''); v_last := nullif(btrim(v_f->>'last'), '');
    v_parent := nullif(btrim(v_f->>'parent'), ''); v_code := nullif(btrim(v_f->>'code'), '');

    -- Still asked for? Keep it whole.
    SELECT o.* INTO v_keep FROM unnest(v_old) o
     WHERE NOT (o.id = ANY (v_used))
       AND CASE WHEN v_by = 'code' THEN o.code_entered = v_code
                ELSE o.code_entered IS NULL AND o.typed_first IS NOT DISTINCT FROM v_first
                     AND o.typed_last IS NOT DISTINCT FROM v_last AND o.typed_parent IS NOT DISTINCT FROM v_parent END
     ORDER BY o.slot LIMIT 1;
    IF v_keep.id IS NOT NULL THEN
      v_used := v_used || v_keep.id;
      v_keep.slot := v_i;
      v_keep.updated_at := now();
      INSERT INTO public.league_friend_requests SELECT (v_keep).*;
      CONTINUE;
    END IF;

    IF v_by = 'code' THEN
      SELECT lr.id, lr.division_id INTO v_hit FROM public.league_registrations lr
       WHERE lr.season_id = p_season AND lr.friend_code = v_code AND lr.id <> p_registration
         AND lr.status NOT IN ('declined', 'withdrawn')
       LIMIT 1;
      IF v_hit.id IS NULL THEN
        INSERT INTO public.league_friend_requests (org_id, season_id, registration_id, slot, code_entered, state)
        VALUES (p_org, p_season, p_registration, v_i, v_code, 'to_confirm');
      ELSIF v_division IS NOT NULL AND v_hit.division_id = v_division THEN
        INSERT INTO public.league_friend_requests (org_id, season_id, registration_id, slot, code_entered, state, matched_registration_id, decided_at)
        VALUES (p_org, p_season, p_registration, v_i, v_code, 'confirmed', v_hit.id, now());
      ELSE
        INSERT INTO public.league_friend_requests (org_id, season_id, registration_id, slot, code_entered, state, matched_registration_id, mark)
        VALUES (p_org, p_season, p_registration, v_i, v_code, 'to_confirm', v_hit.id,
                CASE WHEN v_division IS NULL OR v_hit.division_id IS NULL THEN NULL ELSE 'different_division' END);
      END IF;
    ELSE
      INSERT INTO public.league_friend_requests (org_id, season_id, registration_id, slot, typed_first, typed_last, typed_parent, state)
      VALUES (p_org, p_season, p_registration, v_i, v_first, v_last, v_parent, 'to_confirm');
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.league_friend_requests_save(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_friend_requests_save(uuid, uuid, uuid, jsonb) TO service_role;

-- ─── 5 · A reopened season gets its codes back (/review 2026-11-11) ─────────────────────────────────────────────────
-- A finished season's sign-ups hold no code (none were given, and Part 2's purge clears them). When the season is
-- reopened to a live status, every sign-up without one gets one, in the same statement as the status change.
CREATE OR REPLACE FUNCTION public.league_seasons_friend_codes_on_reopen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE r record;
BEGIN
  IF OLD.status IN ('completed', 'archived') AND NEW.status NOT IN ('completed', 'archived') THEN
    FOR r IN SELECT id FROM public.league_registrations WHERE season_id = NEW.id AND friend_code IS NULL LOOP
      UPDATE public.league_registrations SET friend_code = public.league_friend_code_new(NEW.id) WHERE id = r.id;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS league_seasons_friend_codes_on_reopen ON public.league_seasons;
CREATE TRIGGER league_seasons_friend_codes_on_reopen
  AFTER UPDATE OF status ON public.league_seasons
  FOR EACH ROW EXECUTE FUNCTION public.league_seasons_friend_codes_on_reopen();

REVOKE ALL ON FUNCTION public.league_seasons_friend_codes_on_reopen() FROM PUBLIC, anon, authenticated;

COMMIT;
