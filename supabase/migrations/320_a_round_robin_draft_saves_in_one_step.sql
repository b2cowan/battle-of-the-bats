-- Migration 320: a round-robin draft saves in one step.
-- (Tournament admin redesign, Stage 3 defects pass A45 — F70 and the placement P1, owner ruling 2026-10-09:
--  "Database function". Plan: docs/projects/active/TOURNAMENT_ADMIN_REDESIGN_PLAN.md §3 F70, §6c; prompt
--  TOURNAMENT_ADMIN_REDESIGN_STAGE3_DEFECTS_PROMPT.md.)
--
-- THE CASE. The schedule generator saved a draft in two requests: it cleared the division's games in one, then
-- inserted the draft in a second. A failure between them left the division with its games deleted and the draft
-- unsaved. Worse, the default clear ("Replace all") took every round-robin game of the division in ANY state, so a
-- draft saved over a played division deleted its final scores.
--
-- WHAT THIS ADDS. One function that does the whole save in one transaction:
--   0. One save per division at a time: it locks the DIVISION row first, so a second save of the same division (a
--      double submit, two organizers) waits for the first and then sees what it wrote.
--   1. Every team, pool slot and temporary facility a drafted game names must be THIS tournament's own, or it
--      returns `{ok:false, code:'foreign_reference'}` before any write (the route checks venues against the
--      tournament's catalog; these it could not).
--   2. It LOCKS the division's round-robin games still to play (`scheduled`, not kept — `generator_locked`) and
--      refuses — before any write — unless they are EXACTLY the games the draft says it replaces. A game scored, kept,
--      added, moved or deleted since the draft was made — including another save's whole draft — returns
--      `{ok:false, code:'schedule_changed'}` and nothing is written. Played, cancelled, kept and playoff games are
--      never in reach.
--   3. It removes those games, then inserts the draft's games, every one stamped with THIS division and its
--      tournament (never the caller's), `scheduled`, round robin. Any failure after the removal (a bad reference on
--      an inserted row, say) raises, and the removal rolls back with it: "deleted, then failed to save" cannot
--      happen.
--
-- The policy (which games a draft may replace) lives in app code too — lib/game-delete-policy.ts, the generator's
-- own preview and the route's pre-check — and this function holds the same rule as defence in depth, the way
-- `bulk_reschedule_games` (mig 178) guards on `status = 'scheduled'`. Venue references and the derived `location`
-- are resolved by the route against the tournament's own catalog before the call, exactly as `bulk-save` does.
--
-- No table or column change → the drift check cannot see this file; MANUAL_PROD_STEPS.json carries it.
-- ⚠ ORDER-CRITICAL: the generator that ships with this calls it on every save. Apply to prod BEFORE promoting
-- that code.
--
-- Locked to service_role (the route calls it after capability, scope, plan and lock checks); not exposed to
-- anon/authenticated PostgREST callers. Idempotent (CREATE OR REPLACE).

BEGIN;

CREATE OR REPLACE FUNCTION public.replace_division_round_robin_games(
  p_division_id uuid,
  p_replace_ids uuid[],    -- the division's games this draft replaces (may be empty)
  p_games jsonb            -- [{ home_team_id, away_team_id, game_date, game_time, duration_minutes, location,
                           --    diamond_id, venue_facility_id, schedule_facility_lane_id, home_placeholder,
                           --    away_placeholder, home_slot_id, away_slot_id, notes, generator_locked }]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament_id uuid;
  v_replace_ids   uuid[];
  v_current       int := 0;
  v_matched       int := 0;
  v_removed       int := 0;
  v_inserted      uuid[];
BEGIN
  -- 0. The division row is the lock: one save per division at a time. A second save waits here, and each statement
  --    after the wait reads what the first committed (READ COMMITTED).
  SELECT tournament_id INTO v_tournament_id FROM public.divisions WHERE id = p_division_id FOR UPDATE;
  IF v_tournament_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'division_not_found');
  END IF;

  -- 1. Every team, pool slot and temporary facility the draft names is this tournament's own.
  IF EXISTS (
    SELECT 1
      FROM jsonb_to_recordset(COALESCE(p_games, '[]'::jsonb)) AS g(
        home_team_id uuid, away_team_id uuid, home_slot_id uuid, away_slot_id uuid, schedule_facility_lane_id uuid
      )
     WHERE (g.home_team_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM public.teams t WHERE t.id = g.home_team_id AND t.tournament_id = v_tournament_id))
        OR (g.away_team_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM public.teams t WHERE t.id = g.away_team_id AND t.tournament_id = v_tournament_id))
        OR (g.home_slot_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM public.pool_slots ps WHERE ps.id = g.home_slot_id AND ps.tournament_id = v_tournament_id))
        OR (g.away_slot_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM public.pool_slots ps WHERE ps.id = g.away_slot_id AND ps.tournament_id = v_tournament_id))
        OR (g.schedule_facility_lane_id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM public.schedule_facility_lanes sl
              WHERE sl.id = g.schedule_facility_lane_id AND sl.tournament_id = v_tournament_id))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'foreign_reference');
  END IF;

  v_replace_ids := ARRAY(SELECT DISTINCT x FROM unnest(COALESCE(p_replace_ids, '{}'::uuid[])) AS x WHERE x IS NOT NULL);

  -- 2. Lock the division's round-robin games still to play, and refuse unless they are EXACTLY the ones the draft
  --    replaces. A row another session changed is re-checked after its lock is released, so a game scored a moment
  --    ago no longer counts; a game added since (another save's draft among them) is one the draft didn't mean to
  --    replace — both mean the draft was made against a schedule that is no longer there.
  SELECT count(*), count(*) FILTER (WHERE replaceable.id = ANY(v_replace_ids))
    INTO v_current, v_matched
    FROM (
      SELECT id
        FROM public.games
       WHERE division_id = p_division_id
         AND is_playoff = false
         AND status = 'scheduled'
         AND generator_locked = false
       FOR UPDATE
    ) AS replaceable;
  IF v_current <> cardinality(v_replace_ids) OR v_matched <> cardinality(v_replace_ids) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'schedule_changed');
  END IF;

  IF cardinality(v_replace_ids) > 0 THEN
    -- 3a. Remove them (the same guard again: the rows are locked, so this removes exactly what was counted).
    DELETE FROM public.games
     WHERE id = ANY(v_replace_ids)
       AND division_id = p_division_id
       AND is_playoff = false
       AND status = 'scheduled'
       AND generator_locked = false;
    GET DIAGNOSTICS v_removed = ROW_COUNT;
  END IF;

  -- 3b. Insert the draft. A failure here raises and takes the removal above back out with it.
  WITH ins AS (
    INSERT INTO public.games (
      tournament_id, division_id, home_team_id, away_team_id, game_date, game_time, duration_minutes,
      location, diamond_id, venue_facility_id, schedule_facility_lane_id, home_placeholder, away_placeholder,
      home_slot_id, away_slot_id, notes, status, is_playoff, generator_locked
    )
    SELECT
      v_tournament_id, p_division_id, g.home_team_id, g.away_team_id, g.game_date, g.game_time, g.duration_minutes,
      g.location, g.diamond_id, g.venue_facility_id, g.schedule_facility_lane_id, g.home_placeholder, g.away_placeholder,
      g.home_slot_id, g.away_slot_id, g.notes, 'scheduled', false, COALESCE(g.generator_locked, false)
    FROM jsonb_to_recordset(COALESCE(p_games, '[]'::jsonb)) AS g(
      home_team_id uuid, away_team_id uuid, game_date date, game_time time, duration_minutes integer,
      location text, diamond_id uuid, venue_facility_id uuid, schedule_facility_lane_id uuid,
      home_placeholder text, away_placeholder text, home_slot_id uuid, away_slot_id uuid, notes text,
      generator_locked boolean
    )
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}'::uuid[]) INTO v_inserted FROM ins;

  RETURN jsonb_build_object('ok', true, 'inserted', to_jsonb(v_inserted), 'replaced', v_removed);
END;
$$;

-- Only the server (service_role, post-auth) may call this. Keep it off the public PostgREST RPC surface.
REVOKE ALL ON FUNCTION public.replace_division_round_robin_games(uuid, uuid[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_division_round_robin_games(uuid, uuid[], jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_division_round_robin_games(uuid, uuid[], jsonb) TO service_role;

COMMENT ON FUNCTION public.replace_division_round_robin_games(uuid, uuid[], jsonb) IS
  'Tournament schedule generator (Stage 3 defects pass, F70/P1): save a round-robin draft in one transaction. Locks the division (one save at a time), refuses a team/pool slot/temporary facility from another tournament ({ok:false, code:foreign_reference}), locks the division''s scheduled unkept round-robin games and refuses ({ok:false, code:schedule_changed}) unless they are exactly the ones the draft replaces; then removes them and inserts the draft stamped with the division and its tournament. A failure after the removal rolls it back. Server-only (service_role).';

COMMIT;
