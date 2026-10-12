-- Migration 327: a playoff draft saves in one step, with its plan; "Playoffs are set" once per division; no silent plan.
-- (Tournament admin redesign, Stage 3 addendum — the Playoff generator, ruled 2026-10-12: A63, A68, A69; build-start
--  rulings P1 and P4, owner 2026-10-12. Plan: docs/projects/active/TOURNAMENT_ADMIN_REDESIGN_PLAN.md §6c "The Playoff
--  generator"; prompt TOURNAMENT_ADMIN_REDESIGN_PLAYOFF_GENERATOR_BUILD_PROMPT.md, Part 0.)
--
-- THREE THINGS, ONE FILE (they ship together and the code reads all three):
--
-- 1. replace_division_playoff_games — the Playoff generator's save as ONE transaction, in the shape of mig 320's
--    replace_division_round_robin_games. Before it the window sent two requests (delete every playoff game of the
--    division, played ones and their scores included — then insert the draft), and a failure between them lost the
--    bracket. It:
--      0. locks the DIVISION row (one save per division at a time);
--      1. refuses a team that is not this division's own, or a temporary facility from another tournament
--         ({ok:false, code:'foreign_reference'}), before any write;
--      2. locks the division's PLAYOFF games still to play (`scheduled`, not kept) and refuses
--         ({ok:false, code:'schedule_changed'}) unless they are EXACTLY the games the client says it replaces;
--      3. A68 — a played game is never removed (submitted, completed and forfeit games are out of reach by step 2), and
--         a bracket with a played game KEEPS ITS SHAPE: the draft must re-place exactly the games it replaces (the same
--         bracket and bracket code, one for one), or it is refused ({ok:false, code:'shape_held'}); in any bracket, a
--         drafted game whose bracket code another kept game of that bracket already holds (a played or a cancelled one)
--         is refused the same way — two games can never answer to one place in a bracket;
--      4. removes the replaced games and inserts the draft, every row stamped with THIS division and its tournament. A
--         replaced game's team carries to its re-placed game when the same bracket place waits on the same slot (a
--         semifinal winner already moved into the final keeps its place). A failure after the removal raises and the
--         removal rolls back with it;
--      5. A63 — writes the division's PLAYOFF PLAN in the same transaction: the plan keys (teamsQualifying, format,
--         type, crossover, hasThirdPlace, grandFinalReset, splitConfigs, tierConfigs) are replaced by the draft's, and
--         every other key of playoff_config — tieBreakers, maxRunDiffPerGame, coinTossResults — is kept. A held bracket
--         keeps its saved plan (its shape is the plan). p_plan NULL leaves the plan as it is.
--    Locked to service_role; the games route calls it after its capability, scope, plan and lock checks.
--
-- 2. divisions.playoffs_announced_at — A69 + P4: "Playoffs are set" goes ONCE PER DIVISION, when a PUBLISHED division's
--    playoff teams are all known (it was once per TOURNAMENT, on the first bracket saved anywhere, published or not).
--    The server claims it NULL → now() before it sends, as tournaments.playoffs_published_at was claimed. BACKFILL:
--    a division whose families were already TOLD under the old rule — its tournament's one-time push went
--    (tournaments.playoffs_published_at) and its bracket already has a known team — is stamped now(), so a score
--    after the deploy never announces a bracket families already saw. Every other division is left NULL and announces
--    when it is true: a bracket still all slots (the old push said "set" before it was), and a division whose
--    tournament never sent the old push (a bracket seeded without it — prod 2026-10-12: two unpublished Riverdale
--    divisions, which the first draft of this rule would have silenced for good).
--
-- 3. P1 — the silent plan goes. A division added on the Divisions page was written "top 4, single elimination" that
--    nobody chose, and the public standings drew a cut line from it. Every division with NO playoff games loses its
--    plan keys (its tie-breakers, run-differential cap and coin tosses stay; a config left empty becomes NULL). A
--    division with a bracket keeps its plan; its next save corrects it. (Dev 2026-10-12: 7 divisions; prod: 0.)
--
-- The function and the backfill/cleanup are INVISIBLE to the drift check (only the column is a column) —
-- MANUAL_PROD_STEPS.json carries this file.
-- ⚠ ORDER-CRITICAL: apply to prod BEFORE promoting the code that ships with it — the Playoff generator calls the
-- function on every save, and the announcement claims the column.
-- Re-runnable for the schema (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE). The two data UPDATEs belong to the
-- release: re-run on the day, they touch nothing a second time; re-run LATER, the backfill would stamp a division the
-- new rule has not announced yet — apply the file once.

BEGIN;

-- ── 2. The per-division announcement ─────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.divisions ADD COLUMN IF NOT EXISTS playoffs_announced_at timestamptz;

COMMENT ON COLUMN public.divisions.playoffs_announced_at IS
  'When "Playoffs are set" went for this division (A69/P4, mig 327): claimed NULL -> now() by the server the first time the division is published with every playoff team known. NULL = not announced yet.';

UPDATE public.divisions d
   SET playoffs_announced_at = now()
  FROM public.tournaments t
 WHERE t.id = d.tournament_id
   AND t.playoffs_published_at IS NOT NULL
   AND d.playoffs_announced_at IS NULL
   AND EXISTS (
     SELECT 1 FROM public.games g
      WHERE g.division_id = d.id
        AND g.is_playoff
        AND (g.home_team_id IS NOT NULL OR g.away_team_id IS NOT NULL)
   );

-- ── 3. No silent plan (P1) ───────────────────────────────────────────────────────────────────────────────────────────
UPDATE public.divisions d
   SET playoff_config = NULLIF(
         d.playoff_config - ARRAY['teamsQualifying', 'format', 'type', 'crossover', 'hasThirdPlace', 'grandFinalReset',
                                  'splitConfigs', 'tierConfigs'],
         '{}'::jsonb)
 WHERE d.playoff_config ?| ARRAY['teamsQualifying', 'format', 'type', 'crossover', 'hasThirdPlace', 'grandFinalReset',
                                 'splitConfigs', 'tierConfigs']
   AND NOT EXISTS (SELECT 1 FROM public.games g WHERE g.division_id = d.id AND g.is_playoff);

-- ── 1. The one-step save ─────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.replace_division_playoff_games(
  p_division_id uuid,
  p_replace_ids uuid[],    -- the division's playoff games still to play that this draft replaces (may be empty)
  p_games jsonb,           -- [{ home_team_id, away_team_id, game_date, game_time, duration_minutes, location, diamond_id,
                           --    venue_facility_id, schedule_facility_lane_id, home_placeholder, away_placeholder,
                           --    bracket_id, bracket_code, bracket_label, round_label, notes }]
  p_plan jsonb             -- the division's playoff plan (its plan keys only), or NULL to leave it
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_keys     constant text[] := ARRAY['teamsQualifying', 'format', 'type', 'crossover', 'hasThirdPlace',
                                           'grandFinalReset', 'splitConfigs', 'tierConfigs'];
  v_tournament_id uuid;
  v_replace_ids   uuid[];
  v_current       int := 0;
  v_matched       int := 0;
  v_removed       int := 0;
  v_held          boolean := false;
  v_old           jsonb;
  v_inserted      uuid[];
  v_plan          jsonb;
BEGIN
  -- 0. The division row is the lock: one save per division at a time.
  SELECT tournament_id INTO v_tournament_id FROM public.divisions WHERE id = p_division_id FOR UPDATE;
  IF v_tournament_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'division_not_found');
  END IF;
  IF p_games IS NOT NULL AND jsonb_typeof(p_games) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid');
  END IF;
  IF p_plan IS NOT NULL AND jsonb_typeof(p_plan) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid');
  END IF;

  -- 1. Every team is this division's own; every temporary facility this tournament's.
  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(COALESCE(p_games, '[]'::jsonb)) AS g(
        home_team_id uuid, away_team_id uuid, schedule_facility_lane_id uuid
      )
     WHERE (g.home_team_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM public.teams t WHERE t.id = g.home_team_id AND t.division_id = p_division_id))
        OR (g.away_team_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM public.teams t WHERE t.id = g.away_team_id AND t.division_id = p_division_id))
        OR (g.schedule_facility_lane_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM public.schedule_facility_lanes sl
              WHERE sl.id = g.schedule_facility_lane_id AND sl.tournament_id = v_tournament_id))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'foreign_reference');
  END IF;

  v_replace_ids := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_replace_ids, '{}'::uuid[])) AS x WHERE x IS NOT NULL);

  -- 2. Lock the division's playoff games still to play; refuse unless they are EXACTLY the ones the draft replaces.
  SELECT count(*), count(*) FILTER (WHERE replaceable.id = ANY(v_replace_ids))
    INTO v_current, v_matched
    FROM (
      SELECT id
        FROM public.games
       WHERE division_id = p_division_id
         AND is_playoff = true
         AND status = 'scheduled'
         AND generator_locked = false
       FOR UPDATE
    ) AS replaceable;
  IF v_current <> cardinality(v_replace_ids) OR v_matched <> cardinality(v_replace_ids) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'schedule_changed');
  END IF;

  -- 3. The held shape (A68). A played playoff game holds the bracket: the draft re-places the games still to play, one
  --    for one, by bracket and bracket code.
  SELECT EXISTS (
    SELECT 1 FROM public.games
     WHERE division_id = p_division_id AND is_playoff AND status IN ('submitted', 'completed', 'forfeit')
  ) INTO v_held;
  IF v_held AND (
    SELECT COALESCE(array_agg(s.place ORDER BY s.place), '{}'::text[])
      FROM (SELECT COALESCE(g.bracket_id::text, '') || '|' || COALESCE(g.bracket_code, '') AS place
              FROM jsonb_to_recordset(COALESCE(p_games, '[]'::jsonb)) AS g(bracket_id uuid, bracket_code text)) AS s
  ) IS DISTINCT FROM (
    SELECT COALESCE(array_agg(s.place ORDER BY s.place), '{}'::text[])
      FROM (SELECT COALESCE(r.bracket_id::text, '') || '|' || COALESCE(r.bracket_code, '') AS place
              FROM public.games r WHERE r.id = ANY(v_replace_ids)) AS s
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'shape_held');
  END IF;
  --    …and in any bracket: a drafted game may not take a bracket place a KEPT game holds (played, cancelled or kept).
  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(COALESCE(p_games, '[]'::jsonb)) AS g(bracket_id uuid, bracket_code text)
      JOIN public.games k
        ON k.division_id = p_division_id AND k.is_playoff
       AND NOT (k.id = ANY(v_replace_ids))
       AND k.bracket_code IS NOT NULL AND k.bracket_code = g.bracket_code
       AND k.bracket_id IS NOT DISTINCT FROM g.bracket_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'shape_held');
  END IF;

  -- 4a. What the replaced games held, read before they go: a team already in a bracket place carries to its re-placed
  --     game when the place waits on the same slot.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'bracket_id', r.bracket_id, 'bracket_code', r.bracket_code,
           'home_placeholder', r.home_placeholder, 'away_placeholder', r.away_placeholder,
           'home_team_id', r.home_team_id, 'away_team_id', r.away_team_id)), '[]'::jsonb)
    INTO v_old
    FROM public.games r WHERE r.id = ANY(v_replace_ids) AND r.bracket_code IS NOT NULL;

  IF cardinality(v_replace_ids) > 0 THEN
    DELETE FROM public.games
     WHERE id = ANY(v_replace_ids)
       AND division_id = p_division_id
       AND is_playoff = true
       AND status = 'scheduled'
       AND generator_locked = false;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
  END IF;

  -- 4b. Insert the draft. A failure here raises and takes the removal above back out with it.
  WITH old AS (
    SELECT * FROM jsonb_to_recordset(v_old) AS o(
      bracket_id uuid, bracket_code text, home_placeholder text, away_placeholder text, home_team_id uuid, away_team_id uuid)
  ), ins AS (
    INSERT INTO public.games (
      tournament_id, division_id, home_team_id, away_team_id, game_date, game_time, duration_minutes,
      location, diamond_id, venue_facility_id, schedule_facility_lane_id, home_placeholder, away_placeholder,
      bracket_id, bracket_code, bracket_label, round_label, notes, status, is_playoff, generator_locked
    )
    SELECT
      v_tournament_id, p_division_id,
      COALESCE(g.home_team_id, (SELECT o.home_team_id FROM old o
                                 WHERE o.bracket_code = g.bracket_code AND o.bracket_id IS NOT DISTINCT FROM g.bracket_id
                                   AND o.home_placeholder IS NOT DISTINCT FROM g.home_placeholder LIMIT 1)),
      COALESCE(g.away_team_id, (SELECT o.away_team_id FROM old o
                                 WHERE o.bracket_code = g.bracket_code AND o.bracket_id IS NOT DISTINCT FROM g.bracket_id
                                   AND o.away_placeholder IS NOT DISTINCT FROM g.away_placeholder LIMIT 1)),
      g.game_date, g.game_time, g.duration_minutes,
      g.location, g.diamond_id, g.venue_facility_id, g.schedule_facility_lane_id, g.home_placeholder, g.away_placeholder,
      g.bracket_id, g.bracket_code, g.bracket_label, left(g.round_label, 60), g.notes, 'scheduled', true, false
    FROM jsonb_to_recordset(COALESCE(p_games, '[]'::jsonb)) AS g(
      home_team_id uuid, away_team_id uuid, game_date date, game_time time, duration_minutes integer,
      location text, diamond_id uuid, venue_facility_id uuid, schedule_facility_lane_id uuid,
      home_placeholder text, away_placeholder text, bracket_id uuid, bracket_code text, bracket_label text,
      round_label text, notes text
    )
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_inserted FROM ins;

  -- 5. The division's playoff plan (A63), in the same step — its plan keys only; the rest of playoff_config stays. A
  --    held bracket keeps the plan it was built from.
  IF p_plan IS NOT NULL AND NOT v_held THEN
    SELECT COALESCE(jsonb_object_agg(e.key, e.value), '{}'::jsonb) INTO v_plan
      FROM jsonb_each(p_plan) AS e WHERE e.key = ANY(v_plan_keys);
    UPDATE public.divisions
       SET playoff_config = (COALESCE(playoff_config, '{}'::jsonb) - v_plan_keys) || v_plan
     WHERE id = p_division_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'inserted', to_jsonb(v_inserted), 'replaced', v_removed, 'held', v_held);
END;
$$;

REVOKE ALL ON FUNCTION public.replace_division_playoff_games(uuid, uuid[], jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_division_playoff_games(uuid, uuid[], jsonb, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_division_playoff_games(uuid, uuid[], jsonb, jsonb) TO service_role;

COMMENT ON FUNCTION public.replace_division_playoff_games(uuid, uuid[], jsonb, jsonb) IS
  'Tournament Playoff generator (Stage 3 addendum, A63/A68, mig 327): save a playoff draft in one transaction. Locks the division, refuses a team not of this division or a temporary facility of another tournament (foreign_reference), locks the division''s scheduled unkept playoff games and refuses (schedule_changed) unless they are exactly the ones the draft replaces; a division with a played playoff game holds its shape (the draft must re-place exactly the replaced games by bracket and code), and no drafted game may take a bracket place a kept game holds (shape_held). Removes, inserts (a replaced game''s team carries to its re-placed game on the same slot), and writes the division''s playoff plan keys (keeping tieBreakers, maxRunDiffPerGame, coinTossResults) unless the bracket is held. Server-only (service_role).';

COMMIT;
