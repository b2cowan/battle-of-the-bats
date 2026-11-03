-- ---------------------------------------------------------------
-- Migration 427 — House League Stage 9e-2 (rulings 9e·10 to 9e·14, plan HOUSE_LEAGUE_STAGE9_PLAN.md §0i; build prompt
-- docs/projects/active/HOUSE_LEAGUE_STAGE9E2_BUILD_PROMPT.md, Part 1): a rainout calls off a day's games in one press.
--
-- WHY: a wet evening meant postponing a dozen games one window at a time. The Rainout window postpones (or cancels) the
-- day's chosen games across divisions in one press, emails families now or holds the changes in Changes to send, and —
-- while they are held — puts them all back in one press.
--
-- WHAT CHANGES:
--   (1) league_rainouts — one row per press: the day, the verb, the club's optional line for the email (9e·14, 120
--       characters), and the games, divisions and held change rows it made. The line is READ AT SEND TIME by whichever
--       press sends those rows (the window's own, or Changes to send a day later — COPY §14.2): an email is rebuilt from
--       the stamped rows when it goes, so a line kept in memory would be lost. Service role only; nothing public reads it.
--   (2) league_rainout_press — ALL OR NOTHING: locks the games' divisions in a fixed order (sorted ids, the send's lock),
--       refuses `changed` if any game moved on since the window read it (nothing written), refuses a draft division's
--       game (a draft records nothing and emails nobody, so it is never in a rainout), writes the status of every game
--       (mig 409's trigger records each change with source 'league'), and stores the record.
--   (3) league_rainout_refusal / league_rainout_put_back / league_rainouts_waiting — "Put all back" (9e·13): only while
--       every change the rainout made is still held and nothing has happened to its games since; otherwise nothing is
--       put back. After a send it answers `gone`. The banner in Changes to send lists exactly the rainouts this would
--       put back (one rule, league_rainout_refusal, for both).
--       ⚖ NOT league_game_undo. Undo puts a game back to what families LAST HEARD, which also throws away an older held
--       change to the same game (a move made yesterday, not yet sent). Put all back undoes the rainout only: each game's
--       status goes back to its rainout row's `before`, and that row (with the put-back's own row) goes; an older held
--       change stays. When the rainout is the game's only held change — the usual case — the result is Undo's.
--
-- No change to the send (league_division_changes_send), the trigger or any existing table. Additive and re-runnable.
-- A new table is visible to check:migrations; the four functions are not (MANUAL_PROD_STEPS.json). Apply BEFORE promoting
-- the code that reads it.
-- ---------------------------------------------------------------

BEGIN;

-- ─── 1 · The record of a press ───────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_rainouts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id     uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  day           date NOT NULL,
  verb          text NOT NULL CHECK (verb IN ('postponed', 'cancelled')),
  line          text CHECK (line IS NULL OR char_length(line) BETWEEN 1 AND 120),
  game_ids      uuid[] NOT NULL,
  division_ids  uuid[] NOT NULL,
  change_ids    uuid[] NOT NULL,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  put_back_at   timestamptz,
  put_back_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (cardinality(game_ids) > 0 AND cardinality(game_ids) = cardinality(change_ids))
);

CREATE INDEX IF NOT EXISTS league_rainouts_season_idx ON public.league_rainouts (season_id) WHERE put_back_at IS NULL;
CREATE INDEX IF NOT EXISTS league_rainouts_org_idx ON public.league_rainouts (org_id);
CREATE INDEX IF NOT EXISTS league_rainouts_changes_idx ON public.league_rainouts USING gin (change_ids);

ALTER TABLE public.league_rainouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.league_rainouts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_rainouts TO service_role;

COMMENT ON TABLE public.league_rainouts IS
  'House League 9e-2 (Rainout): one row per press of the Rainout window — the day, postponed or cancelled, the club''s '
  'optional line for the email, and the games, divisions and held league_game_changes rows it made. Written only by '
  'league_rainout_press; put_back_* stamped only by league_rainout_put_back. Service role only.';
COMMENT ON COLUMN public.league_rainouts.day IS 'The org-zone day the rainout called off (the window''s Day).';
COMMENT ON COLUMN public.league_rainouts.line IS
  'The club''s own line for the email (9e·14), verbatim, at most 120 characters; null = none. Read when the rows in '
  'change_ids are SENT (by the window or by Changes to send later): it goes above the first part of the Games changed '
  'email and the coaches'' copy. Never edited by the product.';
COMMENT ON COLUMN public.league_rainouts.change_ids IS
  'The held league_game_changes rows this press made, one per game. Put all back works only while every one is held and '
  'is still its game''s latest held change; the send reads the line through them.';
COMMENT ON COLUMN public.league_rainouts.put_back_at IS 'When Put all back restored every game (null = not put back).';

-- ─── 2 · The press ───────────────────────────────────────────────────────────────────────────────────────────────────

-- p_games: [{"id": game uuid, "seen": the game's updated_at as the window read it}]. Returns refusal null + the record,
-- or a refusal with nothing written: invalid, finished, nothing, not_found, draft, changed.
CREATE OR REPLACE FUNCTION public.league_rainout_press(
  p_org uuid, p_season uuid, p_actor uuid, p_day date, p_verb text, p_line text, p_games jsonb
) RETURNS TABLE (refusal text, rainout uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_line text; v_ids uuid[]; v_divs uuid[]; v_div uuid; v_found integer; v_t0 timestamptz;
        v_changes uuid[]; v_rain uuid;
BEGIN
  v_line := nullif(btrim(coalesce(p_line, '')), '');
  IF p_verb IS NULL OR p_verb NOT IN ('postponed', 'cancelled') OR p_day IS NULL
     OR (v_line IS NOT NULL AND char_length(v_line) > 120)
     OR p_games IS NULL OR jsonb_typeof(p_games) <> 'array' THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN;
  END IF;
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF v_status IN ('completed', 'archived') THEN RETURN QUERY SELECT 'finished'::text, NULL::uuid; RETURN; END IF;

  SELECT array_agg(DISTINCT (e->>'id')::uuid ORDER BY (e->>'id')::uuid) INTO v_ids FROM jsonb_array_elements(p_games) e;
  IF v_ids IS NULL THEN RETURN QUERY SELECT 'nothing'::text, NULL::uuid; RETURN; END IF;
  SELECT count(*), array_agg(DISTINCT g.division_id ORDER BY g.division_id) INTO v_found, v_divs
    FROM league_games g WHERE g.id = ANY (v_ids) AND g.season_id = p_season AND g.org_id = p_org;
  IF v_found <> cardinality(v_ids) THEN RETURN QUERY SELECT 'not_found'::text, NULL::uuid; RETURN; END IF;

  -- One division's lock at a time, in id order (the send and Undo take the same lock; a fixed order cannot deadlock).
  FOREACH v_div IN ARRAY v_divs LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('league_schedule:' || v_div::text, 0));
  END LOOP;
  -- The game window's save takes no advisory lock: hold the rows so it cannot land between the check and the write.
  PERFORM 1 FROM league_games g WHERE g.id = ANY (v_ids) ORDER BY g.id FOR UPDATE;
  -- A game removed while this waited for a lock (an Undo of an added game, a draft's remove) is a change, not a failure.
  IF (SELECT count(*) FROM league_games g WHERE g.id = ANY (v_ids)) <> cardinality(v_ids) THEN
    RETURN QUERY SELECT 'changed'::text, NULL::uuid; RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM league_divisions d WHERE d.id = ANY (v_divs) AND d.schedule_published_at IS NULL) THEN
    RETURN QUERY SELECT 'draft'::text, NULL::uuid; RETURN;
  END IF;
  -- Every game as the window saw it (to the millisecond, as the game window compares), still to play, and on the day
  -- the record names (the org's zone, ORG_TIME_ZONE in lib/timezone.ts, as migs 232 / 342 / 345 read it).
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_games) e JOIN league_games g ON g.id = (e->>'id')::uuid
              WHERE g.status <> 'scheduled'
                 OR g.scheduled_at IS NULL OR (g.scheduled_at AT TIME ZONE 'America/Toronto')::date <> p_day
                 OR (e->>'seen') IS NULL
                 OR date_trunc('milliseconds', g.updated_at) <> date_trunc('milliseconds', (e->>'seen')::timestamptz)) THEN
    RETURN QUERY SELECT 'changed'::text, NULL::uuid; RETURN;
  END IF;

  v_t0 := clock_timestamp();
  UPDATE league_games g SET status = p_verb, updated_at = now() WHERE g.id = ANY (v_ids);
  -- The trigger recorded one held row per game (a published division, a status families hear).
  SELECT array_agg(c.id ORDER BY c.id) INTO v_changes FROM league_game_changes c
   WHERE c.game_id = ANY (v_ids) AND c.sent_at IS NULL AND c.created_at >= v_t0 AND c.kind = p_verb;
  IF coalesce(cardinality(v_changes), 0) <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'A rainout game did not record its change';
  END IF;

  INSERT INTO league_rainouts(org_id, season_id, day, verb, line, game_ids, division_ids, change_ids, created_by)
  VALUES (p_org, p_season, p_day, p_verb, v_line, v_ids, v_divs, v_changes, p_actor)
  RETURNING id INTO v_rain;
  RETURN QUERY SELECT NULL::text, v_rain;
END $$;

-- ─── 3 · Put all back ────────────────────────────────────────────────────────────────────────────────────────────────

-- Whether Put all back would work now: null = yes; 'back' = already put back; 'gone' = a change was sent; 'refused' = a
-- change was undone, or a game changed since (a later held change, or its status is no longer the rainout's).
CREATE OR REPLACE FUNCTION public.league_rainout_refusal(r public.league_rainouts) RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE
    WHEN r.put_back_at IS NOT NULL THEN 'back'
    WHEN EXISTS (SELECT 1 FROM league_game_changes c WHERE c.id = ANY (r.change_ids) AND c.sent_at IS NOT NULL) THEN 'gone'
    WHEN (SELECT count(*) FROM league_game_changes c WHERE c.id = ANY (r.change_ids) AND c.sent_at IS NULL)
         <> cardinality(r.change_ids) THEN 'refused'
    WHEN EXISTS (SELECT 1 FROM league_game_changes mine JOIN league_game_changes c
                   ON c.game_id = mine.game_id AND c.sent_at IS NULL AND c.id <> mine.id
                  AND (c.created_at, c.id) > (mine.created_at, mine.id)
                  WHERE mine.id = ANY (r.change_ids)) THEN 'refused'
    WHEN EXISTS (SELECT 1 FROM league_games g WHERE g.id = ANY (r.game_ids) AND g.status <> r.verb) THEN 'refused'
    ELSE NULL END;
$$;

-- Returns null (put back, or already put back), or: not_found, finished, gone, refused.
CREATE OR REPLACE FUNCTION public.league_rainout_put_back(p_org uuid, p_season uuid, p_rainout uuid, p_actor uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_r league_rainouts%ROWTYPE; v_status text; v_div uuid; v_why text;
BEGIN
  SELECT * INTO v_r FROM league_rainouts r WHERE r.id = p_rainout AND r.season_id = p_season AND r.org_id = p_org;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org;
  IF v_status IN ('completed', 'archived') THEN RETURN 'finished'; END IF;

  FOREACH v_div IN ARRAY (SELECT array_agg(x ORDER BY x) FROM unnest(v_r.division_ids) x) LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('league_schedule:' || v_div::text, 0));
  END LOOP;
  -- Read again under the locks (a send or another Put all back may have finished while this waited).
  SELECT * INTO v_r FROM league_rainouts r WHERE r.id = p_rainout AND r.season_id = p_season AND r.org_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  PERFORM 1 FROM league_games g WHERE g.id = ANY (v_r.game_ids) ORDER BY g.id FOR UPDATE;
  v_why := league_rainout_refusal(v_r);
  IF v_why = 'back' THEN RETURN NULL; END IF;
  IF v_why IS NOT NULL THEN RETURN v_why; END IF;

  UPDATE league_games g SET status = mine.before->>'status', updated_at = now()
    FROM league_game_changes mine WHERE mine.id = ANY (v_r.change_ids) AND g.id = mine.game_id;
  -- The put-back recorded itself as one more change on each game; it and the rainout's row go. An older held change
  -- to the same game stays: it is still news families have not heard.
  DELETE FROM league_game_changes c USING league_game_changes mine
   WHERE mine.id = ANY (v_r.change_ids) AND c.game_id = mine.game_id AND c.sent_at IS NULL
     AND (c.created_at, c.id) >= (mine.created_at, mine.id);
  UPDATE league_rainouts r SET put_back_at = now(), put_back_by = p_actor WHERE r.id = p_rainout;
  RETURN NULL;
END $$;

-- The banner in Changes to send: the season's rainouts that Put all back would restore now (one division's, when named).
DROP FUNCTION IF EXISTS public.league_rainouts_waiting(uuid, uuid);
DROP FUNCTION IF EXISTS public.league_rainouts_waiting(uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION public.league_rainouts_waiting(p_org uuid, p_season uuid, p_division uuid DEFAULT NULL)
RETURNS TABLE (id uuid, day date, verb text, games integer, division_ids uuid[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.day, r.verb, cardinality(r.game_ids), r.division_ids
    FROM league_rainouts r
   WHERE r.org_id = p_org AND r.season_id = p_season AND r.put_back_at IS NULL
     AND (p_division IS NULL OR p_division = ANY (r.division_ids))
     AND league_rainout_refusal(r) IS NULL
   ORDER BY r.created_at;
$$;

REVOKE ALL ON FUNCTION public.league_rainout_press(uuid, uuid, uuid, date, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_rainout_refusal(public.league_rainouts) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_rainout_put_back(uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_rainouts_waiting(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_rainout_press(uuid, uuid, uuid, date, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_rainout_refusal(public.league_rainouts) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_rainout_put_back(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_rainouts_waiting(uuid, uuid, uuid) TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT count(*) FROM information_schema.tables WHERE table_name = 'league_rainouts';                         -- 1
--   SELECT count(*) FROM pg_proc WHERE proname IN ('league_rainout_press', 'league_rainout_refusal',
--     'league_rainout_put_back', 'league_rainouts_waiting');                                                    -- 4
--   SELECT count(*) FROM pg_proc WHERE proname = 'league_rainout_press' AND prosrc LIKE '%pg_advisory_xact_lock%'; -- 1
--   routine_privileges EXECUTE on the four = postgres + service_role only.
-- Proof (rolled back): node scripts/db-query.mjs --dev -f scripts/house-league-9e2-rainout-check.sql
