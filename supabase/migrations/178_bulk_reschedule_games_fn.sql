-- Migration 178: Atomic bulk game reschedule / cancel (Rain-Delay Day-of Ops — Feature B1)
--
-- Backs the organizer "shift the day" tool. Applies new wall-clock date/time to a set of
-- still-scheduled games AND/OR cancels a set of still-scheduled games in ONE transaction, so
-- a rained-out day can never be left half-shifted (locked design constraint: all-or-nothing).
--
-- New date/time values are computed in app code (wall-clock arithmetic via lib/schedule-shift.ts;
-- DST is handled by operating on the stored America/Toronto wall-clock, NOT an absolute instant).
-- Bracket-ordering validation is enforced server-side BEFORE this is called
-- (lib/playoff-bracket.findBracketSchedulingViolations). This function is purely the
-- transactional apply step — not the policy.
--
-- Safety / defense-in-depth: every write is guarded to the target tournament AND
-- status = 'scheduled', so an already-played (submitted/completed/forfeit) or already-cancelled
-- game is never moved or cancelled even if its id is passed. Counts returned reflect only rows
-- actually changed.
--
-- Additive + idempotent (CREATE OR REPLACE). No table/column change → data dictionary unchanged.
-- Locked to service_role (the app calls it only after capability + bracket checks); NOT exposed
-- to anon/authenticated PostgREST callers.

CREATE OR REPLACE FUNCTION public.bulk_reschedule_games(
  p_tournament_id uuid,
  p_shifts jsonb,          -- [{ "id": uuid, "game_date": "YYYY-MM-DD", "game_time": "HH:MM" }]
  p_cancel_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shifted   int := 0;
  v_cancelled int := 0;
  v_row       jsonb;
BEGIN
  -- Apply each computed wall-clock shift, guarded to this tournament's still-scheduled games.
  IF p_shifts IS NOT NULL THEN
    FOR v_row IN SELECT * FROM jsonb_array_elements(p_shifts)
    LOOP
      UPDATE public.games
         SET game_date = (v_row->>'game_date')::date,
             game_time = (v_row->>'game_time')::time
       WHERE id = (v_row->>'id')::uuid
         AND tournament_id = p_tournament_id
         AND status = 'scheduled';
      IF FOUND THEN
        v_shifted := v_shifted + 1;
      END IF;
    END LOOP;
  END IF;

  -- Cancel the requested still-scheduled games (reversible later via revert-to-scheduled).
  IF p_cancel_ids IS NOT NULL AND array_length(p_cancel_ids, 1) > 0 THEN
    UPDATE public.games
       SET status = 'cancelled'
     WHERE id = ANY(p_cancel_ids)
       AND tournament_id = p_tournament_id
       AND status = 'scheduled';
    GET DIAGNOSTICS v_cancelled = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('shifted', v_shifted, 'cancelled', v_cancelled);
END;
$$;

-- Only the server (service_role, post-auth) may call this. Keep it off the public PostgREST RPC surface.
REVOKE ALL ON FUNCTION public.bulk_reschedule_games(uuid, jsonb, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bulk_reschedule_games(uuid, jsonb, uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_reschedule_games(uuid, jsonb, uuid[]) TO service_role;

COMMENT ON FUNCTION public.bulk_reschedule_games(uuid, jsonb, uuid[]) IS
  'Rain-Delay Day-of Ops (Feature B): atomically apply new wall-clock date/time to a set of scheduled games and/or cancel a set of scheduled games within one tournament. Guarded to status = scheduled. Called only by the server (service_role) after capability + bracket-order checks.';
