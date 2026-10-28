-- Migration 413 — House League Stage 9d-2b Part 7 (the /review of Parts 1–6): three function fixes, no table change.
--
--   (1) UNDO PUTS A GAME BACK ON ITS TIME. A held change's `before` is "the game as families last heard it", but it did not
--       carry which division game time the game was linked to (league_games.slot_use_id, mig 409). Moving a game onto
--       another of the division's times changes that link; Undo restored the date and the place and left the link on the
--       time the game had left, so a later move of the club's time (mig 411) dragged — or skipped — the wrong game.
--       The snapshot now carries `slotUseId`, and Undo restores it when the change recorded one (a change recorded before
--       this migration has no key and leaves the link as it is). A use the club has since taken back clears the link.
--   (2) UNDO READS THE GAME AFTER ITS LOCK. A score saved between Undo's first read and the division's lock left the game
--       'completed' in Undo's copy of the row, so Undo put a played game back to its earlier status while keeping its score.
--   (3) THE RULES SAVE NO LONGER BLOCKS PUBLISH. league_season_rules_save locked the season row FOR UPDATE, which conflicts
--       with the FOR KEY SHARE any foreign key to the season takes (Publish writes a notice row; every game insert). Publish
--       holds the division row and wants the season; the rules save held the season and wants the division row: a deadlock,
--       and every game insert queued behind a rules save. FOR NO KEY UPDATE still serialises two rules saves and lets the
--       key-share readers through.
--
-- Additive and re-runnable (CREATE OR REPLACE). Service role only, as every house-league function.

BEGIN;

-- ── 1 · The snapshot carries the link ────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.league_game_snapshot(g public.league_games) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'scheduledAt', g.scheduled_at, 'endsAt', g.ends_at, 'location', g.location,
    'venueId', g.org_venue_id, 'facilityId', g.org_venue_facility_id, 'status', g.status, 'movedFrom', g.moved_from,
    'slotUseId', g.slot_use_id);
$$;

-- ── 2 · Undo: the link back, the game read under the lock ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.league_game_undo(p_org uuid, p_season uuid, p_game uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_game league_games%ROWTYPE; v_first league_game_changes%ROWTYPE; v_b jsonb;
BEGIN
  SELECT * INTO v_game FROM league_games g WHERE g.id = p_game AND g.season_id = p_season AND g.org_id = p_org;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('league_schedule:' || v_game.division_id::text, 0));
  -- Read again under the lock: a score saved while this waited must be seen (a played game is a record).
  SELECT * INTO v_game FROM league_games g WHERE g.id = p_game;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  SELECT * INTO v_first FROM league_game_changes c
   WHERE c.game_id = p_game AND c.sent_at IS NULL ORDER BY c.created_at, c.id LIMIT 1;
  IF NOT FOUND THEN RETURN 'nothing'; END IF;
  IF v_game.status = 'completed' THEN RETURN 'played'; END IF;
  -- 9d-2b Part 5: a change the CLUB made (its game time moved or went, 9d2·13 / 9d2·16) is never undone here: the game
  -- would go back onto time the club gave away, which no house-league screen may choose (9d2·3). The league admin gives
  -- it a new date instead.
  IF EXISTS (SELECT 1 FROM league_game_changes c WHERE c.game_id = p_game AND c.sent_at IS NULL AND c.source = 'club') THEN
    RETURN 'club';
  END IF;

  IF v_first.kind = 'added' THEN
    DELETE FROM league_games g WHERE g.id = p_game;
    RETURN NULL;
  END IF;

  v_b := v_first.before;
  UPDATE league_games g SET
    scheduled_at = (v_b->>'scheduledAt')::timestamptz, ends_at = (v_b->>'endsAt')::timestamptz,
    location = v_b->>'location', org_venue_id = (v_b->>'venueId')::uuid,
    org_venue_facility_id = (v_b->>'facilityId')::uuid, status = v_b->>'status',
    moved_from = (v_b->>'movedFrom')::timestamptz,
    slot_use_id = CASE WHEN jsonb_exists(v_b, 'slotUseId')
                       THEN (SELECT u.slot_id FROM league_slot_uses u WHERE u.slot_id = (v_b->>'slotUseId')::uuid)
                       ELSE g.slot_use_id END,
    updated_at = now()
   WHERE g.id = p_game;
  -- The put-back recorded itself as one more change; with the rest it goes (the game is as families last heard it).
  DELETE FROM league_game_changes c WHERE c.game_id = p_game AND c.sent_at IS NULL;
  RETURN NULL;
END $$;

-- ── 3 · The rules save locks the season without blocking the key-share readers ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.league_season_rules_save(
  p_org uuid, p_season uuid, p_twice boolean, p_tolerance integer, p_games jsonb
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_row jsonb; v_div uuid; v_n integer;
BEGIN
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF v_status IN ('completed', 'archived') THEN RETURN 'finished'; END IF;
  IF p_tolerance IS NULL OR p_tolerance < 0 OR p_tolerance > 9 THEN RETURN 'invalid'; END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(coalesce(p_games, '[]'::jsonb)) LOOP
    v_div := (v_row->>'division')::uuid;
    v_n := CASE WHEN v_row->'games' IS NULL OR jsonb_typeof(v_row->'games') = 'null' THEN NULL ELSE (v_row->>'games')::integer END;
    IF v_n IS NOT NULL AND (v_n < 1 OR v_n > 99) THEN RAISE EXCEPTION 'invalid'; END IF;
    UPDATE league_divisions d SET games_per_team = v_n WHERE d.id = v_div AND d.season_id = p_season;
    IF NOT FOUND THEN RAISE EXCEPTION 'division'; END IF;
  END LOOP;

  UPDATE league_seasons s SET twice_in_a_day_allowed = coalesce(p_twice, false), home_away_tolerance = p_tolerance
   WHERE s.id = p_season;
  RETURN NULL;
EXCEPTION
  -- A bad division or count undoes every division written before it (the block's own rollback) and says which.
  WHEN raise_exception THEN
    IF SQLERRM IN ('invalid', 'division') THEN RETURN SQLERRM; END IF;
    RAISE;
END $$;

REVOKE ALL ON FUNCTION public.league_game_undo(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_season_rules_save(uuid, uuid, boolean, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_game_undo(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_season_rules_save(uuid, uuid, boolean, integer, jsonb) TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT league_game_snapshot(g) ? 'slotUseId' FROM league_games g LIMIT 1;                                  -- t
--   SELECT pg_get_functiondef('public.league_season_rules_save(uuid,uuid,boolean,integer,jsonb)'::regprocedure)
--     LIKE '%FOR NO KEY UPDATE%';                                                                              -- t
