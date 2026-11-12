-- 471_friend_requests_are_deleted_after_the_season.sql
--
-- Board Ready Stage 1 Part 2 (BOARD_READY_PLAN.md §5 Stage 1; ruling A12, owner 2026-11-10; /legal build rules): the
-- sign-up form promises families that the friend names they type "are deleted after the season". This makes it true.
--
-- WHAT IS DELETED, TOGETHER (A12: "typed names, codes, matches and keep-together groups go together"): every row of
-- league_friend_requests for the season (what each family typed or entered, the registrar's match and decision; the
-- draft's keep-together groups are built from these rows, so they go with them), and every sign-up's friend_code.
--
-- WHEN (A12, the single trigger; not the earlier 30-day option):
--   1 · the moment the club marks the season finished (completed or archived): inside public.league_seasons_finished(),
--       the BEFORE UPDATE OF status trigger that already erases the season's player ratings (mig 377), so both happen in
--       the same statement. Reopening the season gives codes back (mig 461's AFTER trigger); the requests do not return.
--   2 · or 60 days after the season's last day if it is never marked finished. A season's dates are optional, so its
--       "last day" is season_end_date, else a year after season_start_date, else a year after it was created (/legal
--       2026-11-11: a season with no end date must not keep names forever):
--       public.league_friend_requests_backstop(), run nightly by mig 472's pg_cron job. Re-runnable: a season already
--       swept has nothing left to delete.
--
-- Also re-makes mig 461's league_friend_requests_save with a finished-season check (section 3).
--
-- Adds NO tables and NO columns. The three functions are invisible to check:migrations, so the prod step is tracked in
-- MANUAL_PROD_STEPS.json. ⚠ ORDER ON PRODUCTION: after mig 377 and mig 461. In the same promote as Part 1 (the /legal
-- release gate: Part 1 is never promoted without this).

BEGIN;

-- ─── 1 · The season's finish ─────────────────────────────────────────────────────────────────────────────────────────
-- Mig 377's body, unchanged, plus the friend lines (and `pg_temp` last on the search path, as every newer function has it).
CREATE OR REPLACE FUNCTION public.league_seasons_finished() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status IN ('completed','archived') THEN
    IF OLD.status NOT IN ('completed','archived') THEN
      NEW.finished_at := now();
      DELETE FROM league_player_ratings WHERE season_id = NEW.id;
      -- Board Ready Stage 1 (A12): friend requests and friend codes are deleted when the season is marked finished.
      -- The sign-ups first: that locks every one of them, so a family's save already in flight (it locks its sign-up,
      -- league_friend_requests_save) finishes before the requests are deleted, and a later one waits and is refused
      -- (the save's finished check below) (/review 2026-11-11). Every sign-up is locked, not only those with a code.
      PERFORM 1 FROM league_registrations WHERE season_id = NEW.id FOR UPDATE;
      UPDATE league_registrations SET friend_code = NULL WHERE season_id = NEW.id AND friend_code IS NOT NULL;
      DELETE FROM league_friend_requests WHERE season_id = NEW.id;
    END IF;
  ELSE
    -- Reopened: it is live again. Its ratings do not come back (they were erased, as ruled), nor its friend requests.
    NEW.finished_at := NULL;
  END IF;
  RETURN NEW;
END $$;

-- ─── 2 · The backstop: 60 days after the last day ────────────────────────────────────────────────────────────────────
-- Every season that is not finished and whose last day (as above) was more than 60 days ago, and every finished season
-- that still holds anything (the finish deletes it all; this sweeps any straggler, /review 2026-11-11). Returns how many
-- requests it deleted (the job's own record; nothing names a child).
CREATE OR REPLACE FUNCTION public.league_friend_requests_backstop() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_deleted integer;
BEGIN
  WITH due AS (
    SELECT id FROM public.league_seasons
     WHERE (status IN ('completed', 'archived')
           OR coalesce(season_end_date, (season_start_date + interval '1 year')::date, (created_at + interval '1 year')::date)
              < current_date - 60)
  ), gone AS (
    DELETE FROM public.league_friend_requests r USING due WHERE r.season_id = due.id RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM gone;

  UPDATE public.league_registrations lr SET friend_code = NULL
    FROM public.league_seasons s
   WHERE lr.season_id = s.id AND lr.friend_code IS NOT NULL
     AND (s.status IN ('completed', 'archived')
          OR coalesce(s.season_end_date, (s.season_start_date + interval '1 year')::date, (s.created_at + interval '1 year')::date)
             < current_date - 60);

  RETURN v_deleted;
END $$;

REVOKE ALL ON FUNCTION public.league_friend_requests_backstop() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_friend_requests_backstop() TO service_role;

-- ─── 3 · A family's save never lands in a finished season ─────────────────────────────────────────────────────────
-- Mig 461's body, unchanged, plus the finished check after the lock (/review 2026-11-11: a save racing the finish).
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
  -- Mig 471 (/review 2026-11-11): read after the lock, so a save that waited out the season's finish sees it finished
  -- and stores nothing (the finish has just deleted the season's requests).
  IF EXISTS (SELECT 1 FROM public.league_seasons WHERE id = p_season AND status IN ('completed', 'archived')) THEN
    RAISE EXCEPTION 'league_friend_requests_save: finished';
  END IF;
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

COMMIT;
