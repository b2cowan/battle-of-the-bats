-- ---------------------------------------------------------------
-- Migration 549 — Club Website Stage 2, Session 2D (close several places in one press; rulings M1–M8 and D1, owner
-- 2026-11-26, plan docs/projects/active/CLUB_WEBSITE_ENHANCEMENTS_PLAN.md §7; build prompt
-- CLUB_WEBSITE_STAGE2_PLACES_BUILD_PROMPT.md; the drawing CLUB_WEBSITE_STAGE2_PLACES_DRAWINGS.html).
--
-- WHY: two of three diamonds at one park took two presses (families with games on both got two emails): mig 539's press
-- refused two entries for one place. M8 (replacing K2's "two diamonds = two closures"): several diamonds of one park close
-- in one press, a closure row each, as two parks already did.
--
-- WHAT CHANGES (org_place_closure_press only, replaced whole; mig 539's text otherwise):
--   (1) The places: each (place, diamond) pair once, instead of each place once. Still refused: the same pair twice, and a
--       whole place beside a diamond of that place (the whole place already holds it).
--   (2) D1: a rep game is MARKED by EVERY closure of the press it is at, not only the first. A game at the park with no
--       diamond recorded, when two of its diamonds close, so keeps a standing mark until the last of them reopens (the
--       marks table already allows one row per closure and game; a mark is spent by reading, never written). The house
--       league side is unchanged: each game still belongs to the FIRST closure it is at (its Rainout record), so it is
--       postponed once and its families are emailed once.
--
-- No table, column or index changes; check:migrations sees nothing (MANUAL_PROD_STEPS.json). Re-runnable. Follows 539
-- (pending on prod): apply 539, then this, BEFORE promoting the code that sends several diamonds of one park.
-- ---------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.org_place_closure_press(
  p_org uuid, p_actor uuid, p_press_key uuid, p_places jsonb, p_first_day date, p_last_day date,
  p_verb text, p_line text, p_league jsonb, p_rep jsonb, p_links jsonb
) RETURNS TABLE (refusal text, changed uuid[], closures uuid[], rainouts uuid[], marks integer, replay boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_line text;
  v_today date := (now() AT TIME ZONE 'America/Toronto')::date;
  v_places jsonb;
  v_np integer; v_nall integer;
  v_league uuid[]; v_rep uuid[]; v_link_league uuid[]; v_link_rep uuid[];
  v_all_league uuid[]; v_all_rep uuid[];
  v_divs uuid[]; v_div uuid;
  v_changed uuid[];
  v_assign_league jsonb; v_mark_pairs jsonb;
  v_t0 timestamptz; v_ends timestamptz;
  v_closures uuid[]; v_rainouts uuid[]; v_marks integer := 0; v_held integer;
BEGIN
  -- ── The request's shape ──
  v_line := nullif(btrim(coalesce(p_line, '')), '');
  IF p_org IS NULL OR p_press_key IS NULL OR p_verb IS NULL OR p_verb NOT IN ('postponed', 'cancelled')
     OR p_first_day IS NULL OR p_last_day IS NULL OR p_last_day < p_first_day OR p_last_day - p_first_day > 13
     OR (v_line IS NOT NULL AND char_length(v_line) > 120)
     OR jsonb_typeof(p_places) IS DISTINCT FROM 'array' OR jsonb_typeof(p_league) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_rep) IS DISTINCT FROM 'array' OR jsonb_typeof(p_links) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_places) NOT BETWEEN 1 AND 10
     OR jsonb_array_length(p_league) > 500 OR jsonb_array_length(p_rep) > 200 OR jsonb_array_length(p_links) > 500 THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;

  -- ── A retried press runs once ── (the key's lock first, so two copies of one press cannot both pass this check)
  PERFORM pg_advisory_xact_lock(hashtextextended('place_closure_press:' || p_press_key::text, 0));
  IF EXISTS (SELECT 1 FROM org_place_closures c WHERE c.press_key = p_press_key) THEN
    IF EXISTS (SELECT 1 FROM org_place_closures c WHERE c.press_key = p_press_key AND c.org_id <> p_org) THEN
      RETURN QUERY SELECT 'invalid'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
    END IF;
    RETURN QUERY SELECT NULL::text, ARRAY[]::uuid[],
      (SELECT array_agg(c.id ORDER BY c.press_seq) FROM org_place_closures c WHERE c.press_key = p_press_key),
      (SELECT coalesce(array_agg(r.id ORDER BY r.id), ARRAY[]::uuid[]) FROM league_rainouts r
         JOIN org_place_closures c ON c.id = r.closure_id WHERE c.press_key = p_press_key),
      (SELECT count(*)::integer FROM rep_event_closure_marks m
         JOIN org_place_closures c ON c.id = m.closure_id WHERE c.press_key = p_press_key),
      true;
    RETURN;
  END IF;

  IF p_first_day < v_today THEN
    RETURN QUERY SELECT 'past'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;

  -- ── The places: the club's own, each place or diamond once (a whole place never beside one of its diamonds), or
  --    "every place" alone ──
  SELECT count(*), count(*) FILTER (WHERE nullif(e->>'venueId', '') IS NULL) INTO v_np, v_nall
    FROM jsonb_array_elements(p_places) e;
  IF v_nall > 0 THEN
    IF v_np <> 1 OR nullif(p_places->0->>'facilityId', '') IS NOT NULL THEN
      RETURN QUERY SELECT 'invalid'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
    END IF;
    v_places := jsonb_build_array(jsonb_build_object('seq', 1, 'scope', 'all', 'v', NULL, 'f', NULL, 'name', NULL, 'fname', NULL));
  ELSE
    -- The places held still for the press (a rename would change what "Link both" may link; a delete would fail the
    -- closure's foreign key mid-press) — and FIRST, before any game row, in the order a place's delete takes them.
    PERFORM 1 FROM org_venues ov
     WHERE ov.org_id = p_org AND ov.id IN (SELECT (e->>'venueId')::uuid FROM jsonb_array_elements(p_places) e)
     ORDER BY ov.id FOR SHARE;
    PERFORM 1 FROM org_venue_facilities fac
     WHERE fac.id IN (SELECT nullif(e->>'facilityId', '')::uuid FROM jsonb_array_elements(p_places) e)
     ORDER BY fac.id FOR SHARE;
    SELECT jsonb_agg(jsonb_build_object(
             'seq', x.ord, 'scope', CASE WHEN x.f IS NULL THEN 'place' ELSE 'diamond' END,
             'v', x.v, 'f', x.f, 'name', ov.name, 'fname', fac.name) ORDER BY x.ord)
      INTO v_places
      FROM (SELECT ord, (e->>'venueId')::uuid v, nullif(e->>'facilityId', '')::uuid f
              FROM jsonb_array_elements(p_places) WITH ORDINALITY t(e, ord)) x
      JOIN org_venues ov ON ov.id = x.v AND ov.org_id = p_org
      LEFT JOIN org_venue_facilities fac ON fac.id = x.f AND fac.org_venue_id = x.v;
    IF coalesce(jsonb_array_length(v_places), 0) <> v_np
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_places) pl WHERE pl->>'f' IS NOT NULL AND pl->>'fname' IS NULL)
       OR (SELECT count(DISTINCT (pl->>'v') || ':' || coalesce(pl->>'f', '')) FROM jsonb_array_elements(v_places) pl) <> v_np
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_places) wp JOIN jsonb_array_elements(v_places) dp ON dp->>'v' = wp->>'v'
                   WHERE wp->>'f' IS NULL AND dp->>'f' IS NOT NULL) THEN
      RETURN QUERY SELECT 'invalid'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
    END IF;
  END IF;

  -- ── The games named ──
  SELECT coalesce(array_agg(DISTINCT (e->>'id')::uuid), ARRAY[]::uuid[]) INTO v_league FROM jsonb_array_elements(p_league) e;
  SELECT coalesce(array_agg(DISTINCT (e->>'id')::uuid), ARRAY[]::uuid[]) INTO v_rep FROM jsonb_array_elements(p_rep) e;
  IF cardinality(v_league) <> jsonb_array_length(p_league) OR cardinality(v_rep) <> jsonb_array_length(p_rep)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_links) e
                 WHERE e->>'kind' IS NULL OR e->>'kind' NOT IN ('league', 'rep') OR e->>'id' IS NULL
                    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_places) pl
                                    WHERE pl->>'scope' <> 'all' AND (pl->>'v')::uuid = (e->>'venueId')::uuid))
     OR (SELECT count(DISTINCT (e->>'kind') || ((e->>'id')::uuid)::text) FROM jsonb_array_elements(p_links) e) <> jsonb_array_length(p_links) THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;
  SELECT coalesce(array_agg((e->>'id')::uuid), ARRAY[]::uuid[]) INTO v_link_league FROM jsonb_array_elements(p_links) e WHERE e->>'kind' = 'league';
  SELECT coalesce(array_agg((e->>'id')::uuid), ARRAY[]::uuid[]) INTO v_link_rep FROM jsonb_array_elements(p_links) e WHERE e->>'kind' = 'rep';
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x), ARRAY[]::uuid[]) INTO v_all_league FROM unnest(v_league || v_link_league) x;
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x), ARRAY[]::uuid[]) INTO v_all_rep FROM unnest(v_rep || v_link_rep) x;

  -- Every game the club's own (cross-tenant): another club's game is not_found. A game that no longer exists at all is a
  -- change (it was removed after the window read it) and is named with the others, after the locks, below.
  IF EXISTS (SELECT 1 FROM league_games g WHERE g.id = ANY (v_all_league) AND g.org_id <> p_org)
     OR EXISTS (SELECT 1 FROM rep_team_events ev WHERE ev.id = ANY (v_all_rep) AND ev.org_id <> p_org) THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;
  -- ── The locks: every division of every season the press touches, ONE AT A TIME IN ID ORDER (the send, Undo and the
  --    Rainout take the same lock in the same order, so two closures — or a closure and a send — cannot deadlock); then
  --    the rows, so the game window's save and the coach's edit cannot land between the check and the write. ──
  SELECT coalesce(array_agg(DISTINCT g.division_id ORDER BY g.division_id), ARRAY[]::uuid[]) INTO v_divs
    FROM league_games g WHERE g.id = ANY (v_all_league);
  FOREACH v_div IN ARRAY v_divs LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('league_schedule:' || v_div::text, 0));
  END LOOP;
  PERFORM 1 FROM league_games g WHERE g.id = ANY (v_all_league) ORDER BY g.id FOR UPDATE;
  -- Only rep GAMES are locked: a practice id (never offered, so stale or made up) is refused below as changed without
  -- taking a lock the club schedule's practice moves could be waiting on in the other order.
  PERFORM 1 FROM rep_team_events ev
   WHERE ev.id = ANY (v_all_rep) AND ev.event_type IN ('league_game', 'tournament_game') ORDER BY ev.id FOR UPDATE;

  -- A season finished while this waited for the locks (read after them, as the send reads it).
  IF EXISTS (SELECT 1 FROM league_games g JOIN league_seasons s ON s.id = g.season_id
              WHERE g.id = ANY (v_all_league) AND s.status IN ('completed', 'archived')) THEN
    RETURN QUERY SELECT 'finished'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;

  -- ── Every refusal, decided BEFORE the first write ──
  -- A game removed while this waited for a lock is a change, not a failure.
  SELECT coalesce(array_agg(x ORDER BY x), ARRAY[]::uuid[]) INTO v_changed FROM (
    SELECT x FROM unnest(v_all_league) x WHERE NOT EXISTS (SELECT 1 FROM league_games g WHERE g.id = x)
    UNION SELECT x FROM unnest(v_all_rep) x WHERE NOT EXISTS (SELECT 1 FROM rep_team_events ev WHERE ev.id = x)) gone;
  IF cardinality(v_changed) > 0 THEN
    RETURN QUERY SELECT 'changed'::text, v_changed, NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;

  -- A draft division's (or a draft season's) game is never called off (a draft records nothing and emails nobody).
  IF EXISTS (SELECT 1 FROM league_games g JOIN league_divisions d ON d.id = g.division_id
               JOIN league_seasons s ON s.id = g.season_id
              WHERE g.id = ANY (v_league) AND (d.schedule_published_at IS NULL OR s.status = 'draft')) THEN
    RETURN QUERY SELECT 'draft'::text, NULL::uuid[], NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;

  SELECT coalesce(array_agg(DISTINCT id ORDER BY id), ARRAY[]::uuid[]) INTO v_changed FROM (
    -- House league: still to play (a scored game is `completed`, never touched, K6; a started game is still `scheduled`
    -- and is touched only because the admin ticked it), on a closed day, as the window saw it, at a closed place.
    SELECT g.id FROM jsonb_array_elements(p_league) e JOIN league_games g ON g.id = (e->>'id')::uuid
     WHERE g.status <> 'scheduled' OR g.scheduled_at IS NULL
        OR (g.scheduled_at AT TIME ZONE 'America/Toronto')::date NOT BETWEEN p_first_day AND p_last_day
        OR (e->>'seen') IS NULL
        OR date_trunc('milliseconds', g.updated_at) <> date_trunc('milliseconds', (e->>'seen')::timestamptz)
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_places) pl
                        WHERE place_closure_match(pl->>'scope', (pl->>'v')::uuid, (pl->>'f')::uuid, pl->>'name',
                                                  g.org_venue_id, g.org_venue_facility_id, g.location) IS NOT NULL)
    UNION ALL
    -- Rep: a game (not a club tournament's, which only its own Rain delay moves), on, unscored, on a closed day, as the
    -- window saw it, at a closed place. Its typed text is its own typed place and its team place's name, together.
    SELECT ev.id FROM jsonb_array_elements(p_rep) e JOIN rep_team_events ev ON ev.id = (e->>'id')::uuid
      LEFT JOIN rep_team_places tp ON tp.id = ev.place_id
     WHERE ev.event_type NOT IN ('league_game', 'tournament_game') OR ev.source_tournament_game_id IS NOT NULL
        OR ev.status <> 'scheduled'
        OR ev.team_score IS NOT NULL OR ev.opponent_score IS NOT NULL OR ev.result IS NOT NULL
        OR (ev.starts_at AT TIME ZONE 'America/Toronto')::date NOT BETWEEN p_first_day AND p_last_day
        OR (e->>'seen') IS NULL
        OR date_trunc('milliseconds', ev.updated_at) <> date_trunc('milliseconds', (e->>'seen')::timestamptz)
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_places) pl
                        WHERE place_closure_match(pl->>'scope', (pl->>'v')::uuid, (pl->>'f')::uuid, pl->>'name',
                                                  ev.org_venue_id, ev.org_venue_facility_id,
                                                  concat_ws(' · ', ev.location, tp.name)) IS NOT NULL)
    UNION ALL
    -- A link: the game still has no place id and no diamond, is on a closed day, and its typed text holds the name of the
    -- place it is linked to (so the recorder reads it as "Link both", not as a move).
    SELECT g.id FROM jsonb_array_elements(p_links) e JOIN league_games g ON g.id = (e->>'id')::uuid
      JOIN org_venues ov ON ov.id = (e->>'venueId')::uuid
     WHERE e->>'kind' = 'league'
       AND (g.status <> 'scheduled' OR g.org_venue_id IS NOT NULL OR g.org_venue_facility_id IS NOT NULL OR g.scheduled_at IS NULL
            OR (g.scheduled_at AT TIME ZONE 'America/Toronto')::date NOT BETWEEN p_first_day AND p_last_day
            OR NOT place_name_in_typed(ov.name, g.location))
    UNION ALL
    SELECT ev.id FROM jsonb_array_elements(p_links) e JOIN rep_team_events ev ON ev.id = (e->>'id')::uuid
      JOIN org_venues ov ON ov.id = (e->>'venueId')::uuid
      LEFT JOIN rep_team_places tp ON tp.id = ev.place_id
     WHERE e->>'kind' = 'rep'
       AND (ev.event_type NOT IN ('league_game', 'tournament_game') OR ev.source_tournament_game_id IS NOT NULL
            OR ev.status <> 'scheduled'
            OR ev.team_score IS NOT NULL OR ev.opponent_score IS NOT NULL OR ev.result IS NOT NULL
            OR ev.org_venue_id IS NOT NULL OR ev.org_venue_facility_id IS NOT NULL
            OR (ev.starts_at AT TIME ZONE 'America/Toronto')::date NOT BETWEEN p_first_day AND p_last_day
            OR NOT place_name_in_typed(ov.name, concat_ws(' · ', ev.location, tp.name)))
  ) bad;
  IF cardinality(v_changed) > 0 THEN
    RETURN QUERY SELECT 'changed'::text, v_changed, NULL::uuid[], NULL::uuid[], 0, false; RETURN;
  END IF;

  -- ════ From here on nothing refuses: a failure RAISES, and the whole call rolls back. ════
  v_t0 := clock_timestamp();
  v_ends := ((p_last_day + 1)::timestamp AT TIME ZONE 'America/Toronto');

  INSERT INTO org_place_closures(org_id, press_key, press_seq, scope, org_venue_id, org_venue_facility_id, place_name,
                                 facility_name, first_day, last_day, shows_from, ends_at, verb, line, closed_by)
  SELECT p_org, p_press_key, (pl->>'seq')::smallint, pl->>'scope', (pl->>'v')::uuid, (pl->>'f')::uuid, pl->>'name',
         pl->>'fname', p_first_day, p_last_day, now(), v_ends, p_verb, v_line, p_actor
    FROM jsonb_array_elements(v_places) pl;
  SELECT array_agg(c.id ORDER BY c.press_seq) INTO v_closures FROM org_place_closures c WHERE c.press_key = p_press_key;

  -- Each game belongs to the first closed place (in the window's order) it is at — decided BEFORE any link moves an id.
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'closure', m.id, 'season', g.season_id, 'division', g.division_id,
                                               'day', (g.scheduled_at AT TIME ZONE 'America/Toronto')::date)), '[]'::jsonb)
    INTO v_assign_league
    FROM league_games g CROSS JOIN LATERAL (
      SELECT c.id FROM org_place_closures c
       WHERE c.press_key = p_press_key
         AND place_closure_match(c.scope, c.org_venue_id, c.org_venue_facility_id, c.place_name,
                                 g.org_venue_id, g.org_venue_facility_id, g.location) IS NOT NULL
       ORDER BY c.press_seq LIMIT 1) m
   WHERE g.id = ANY (v_league);
  -- A rep game is marked by EVERY closure of this press it is at (D1, mig 549): a game at the park with no diamond, two of
  -- its diamonds closed, stays marked until the last of them reopens.
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', ev.id, 'closure', c.id) ORDER BY ev.id, c.press_seq), '[]'::jsonb) INTO v_mark_pairs
    FROM rep_team_events ev LEFT JOIN rep_team_places tp ON tp.id = ev.place_id
    JOIN org_place_closures c ON c.press_key = p_press_key
     AND place_closure_match(c.scope, c.org_venue_id, c.org_venue_facility_id, c.place_name,
                             ev.org_venue_id, ev.org_venue_facility_id, concat_ws(' · ', ev.location, tp.name)) IS NOT NULL
   WHERE ev.id = ANY (v_rep);
  IF jsonb_array_length(v_assign_league) <> cardinality(v_league)
     OR (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(v_mark_pairs) x) <> cardinality(v_rep) THEN
    RAISE EXCEPTION 'A closure game matched no closed place';
  END IF;

  -- "Link both": the place id only; the typed text stays. The recorder writes no change for it (section 5) — only while
  -- league.quiet_link is on, which is only here, and off again before the games are called off.
  PERFORM set_config('league.quiet_link', 'on', true);
  UPDATE league_games g SET org_venue_id = (e->>'venueId')::uuid, updated_at = now()
    FROM jsonb_array_elements(p_links) e WHERE e->>'kind' = 'league' AND g.id = (e->>'id')::uuid;
  PERFORM set_config('league.quiet_link', 'off', true);
  UPDATE rep_team_events ev SET org_venue_id = (e->>'venueId')::uuid, updated_at = now()
    FROM jsonb_array_elements(p_links) e WHERE e->>'kind' = 'rep' AND ev.id = (e->>'id')::uuid;

  -- House league: called off; the recorder writes one held row per game (mig 409, source 'league').
  UPDATE league_games g SET status = p_verb, updated_at = now() WHERE g.id = ANY (v_league);
  SELECT count(*) INTO v_held FROM league_game_changes c
   WHERE c.game_id = ANY (v_league) AND c.sent_at IS NULL AND c.created_at >= v_t0 AND c.kind = p_verb;
  IF v_held <> cardinality(v_league) THEN
    RAISE EXCEPTION 'A closure game did not record its change';
  END IF;

  -- One Rainout record per closure, season and day: how the families' emails already go (per division, per record).
  WITH a AS (
    SELECT (x->>'id')::uuid AS id, (x->>'closure')::uuid AS closure, (x->>'season')::uuid AS season,
           (x->>'division')::uuid AS division, (x->>'day')::date AS day
      FROM jsonb_array_elements(v_assign_league) x
  ), ch AS (
    SELECT c.game_id, c.id FROM league_game_changes c
     WHERE c.game_id = ANY (v_league) AND c.sent_at IS NULL AND c.created_at >= v_t0 AND c.kind = p_verb
  ), ins AS (
    INSERT INTO league_rainouts(org_id, season_id, day, verb, line, game_ids, division_ids, change_ids, created_by,
                                closure_id, org_venue_id)
    SELECT p_org, a.season, a.day, p_verb, v_line, array_agg(a.id ORDER BY a.id),
           array_agg(DISTINCT a.division ORDER BY a.division), array_agg(ch.id ORDER BY a.id), p_actor, a.closure, cl.org_venue_id
      FROM a JOIN ch ON ch.game_id = a.id JOIN org_place_closures cl ON cl.id = a.closure
     GROUP BY a.season, a.day, a.closure, cl.org_venue_id
    RETURNING id
  )
  SELECT coalesce(array_agg(ins.id ORDER BY ins.id), ARRAY[]::uuid[]) INTO v_rainouts FROM ins;

  -- Rep: marked, never moved (A5), once per closure it is at. The mark keeps the game as it is now (after any link above).
  INSERT INTO rep_event_closure_marks(org_id, closure_id, event_id, team_id, marked_starts_at, marked_org_venue_id,
                                      marked_facility_id, marked_place_id, marked_location)
  SELECT p_org, (x->>'closure')::uuid, ev.id, ev.team_id, ev.starts_at, ev.org_venue_id, ev.org_venue_facility_id,
         ev.place_id, ev.location
    FROM jsonb_array_elements(v_mark_pairs) x JOIN rep_team_events ev ON ev.id = (x->>'id')::uuid;
  GET DIAGNOSTICS v_marks = ROW_COUNT;

  RETURN QUERY SELECT NULL::text, ARRAY[]::uuid[], v_closures, v_rainouts, v_marks, false;
END $$;

REVOKE ALL ON FUNCTION public.org_place_closure_press(uuid, uuid, uuid, jsonb, date, date, text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_place_closure_press(uuid, uuid, uuid, jsonb, date, date, text, text, jsonb, jsonb, jsonb) TO service_role;

COMMENT ON COLUMN public.org_place_closures.press_key IS
  'The window''s key for one press (a uuid the window makes when it opens). A retried press with the same key answers with '
  'what the first wrote. One press closing two places, or two diamonds of one place (mig 549), is two rows with one key '
  '(press_seq 1, 2).';
COMMENT ON TABLE public.rep_event_closure_marks IS
  'Club Website Stage 2: a rep game a closure MARKED for its coach (Stage 0 A5: marked, not moved). One row per closure per '
  'game, so a second closure over the same game never clears the first''s mark; one press marks a game once for EVERY '
  'closure of it the game is at (mig 549, D1: a game with no diamond, two of its park''s diamonds closed, stays marked '
  'until the last reopens). A mark STANDS while its closure is not reopened and the game still has the time and place it '
  'had when marked and is not cancelled; "the coach moved it" is read from rep_team_events, never written here '
  '(lib/place-closures.ts markStanding). Written only by org_place_closure_press. Service role only.';

COMMIT;

-- Verify (dev, then prod):
--   SELECT count(*) FROM pg_proc WHERE proname = 'org_place_closure_press' AND prosrc LIKE '%v_mark_pairs%';  -- 1
--   routine_privileges EXECUTE on org_place_closure_press = postgres + service_role only.
-- Proof (rolled back): node scripts/db-query.mjs --dev -f scripts/club-website-stage2-closure-check.sql
