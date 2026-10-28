-- Migration 412 — House League Stage 9d-2b Part 6: a season's schedule rules are kept ("Adjust the rules", frame d3).
--
-- WHY (rulings 9d2·4, 9d2a·G, 9d2b·C; plan HOUSE_LEAGUE_STAGE9_PLAN.md §0h): Schedule health scores a season by three
-- rules — games per team, whether a team may play twice in a day, and how far home and away may differ. 9d-2a had nowhere
-- to keep them, so the window's foot said the rules it assumed (no, 1, and each division's own plan) and had no door.
--   · league_seasons.twice_in_a_day_allowed (default false) and .home_away_tolerance (default 1): one answer per season.
--   · league_divisions.games_per_team (null = the number most of the division's teams were given, as today): per DIVISION,
--     not per season — a season's divisions are different sizes, and a round robin gives 8 teams 7 games and 5 teams 4,
--     so one season number would mark every team in one of them short. (Build call, said out loud; 9d2b·C's "stored on the
--     season" is kept for the two rules that are one answer per season.)
--   · league_season_rules_save: the three saved together, in one transaction, refused on a finished season (Q16) and for a
--     division that is not the season's.
-- The defaults are 9d-2a's assumed rules, so every existing season scores exactly as it did. Additive, re-runnable, no row
-- change. Service role only, as every house-league function.

BEGIN;

ALTER TABLE public.league_seasons
  ADD COLUMN IF NOT EXISTS twice_in_a_day_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS home_away_tolerance smallint NOT NULL DEFAULT 1;

ALTER TABLE public.league_divisions
  ADD COLUMN IF NOT EXISTS games_per_team smallint;

ALTER TABLE public.league_seasons DROP CONSTRAINT IF EXISTS league_seasons_home_away_tolerance_check;
ALTER TABLE public.league_seasons
  ADD CONSTRAINT league_seasons_home_away_tolerance_check CHECK (home_away_tolerance BETWEEN 0 AND 9);

ALTER TABLE public.league_divisions DROP CONSTRAINT IF EXISTS league_divisions_games_per_team_check;
ALTER TABLE public.league_divisions
  ADD CONSTRAINT league_divisions_games_per_team_check CHECK (games_per_team IS NULL OR games_per_team BETWEEN 1 AND 99);

-- p_games: [{ "division": uuid, "games": integer | null }, …] — the divisions the window showed; a division left out keeps
-- what it has. Returns a refusal word, or null when saved.
CREATE OR REPLACE FUNCTION public.league_season_rules_save(
  p_org uuid, p_season uuid, p_twice boolean, p_tolerance integer, p_games jsonb
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_row jsonb; v_div uuid; v_n integer;
BEGIN
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR UPDATE;
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

REVOKE ALL ON FUNCTION public.league_season_rules_save(uuid, uuid, boolean, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_season_rules_save(uuid, uuid, boolean, integer, jsonb) TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns
--    WHERE (table_name = 'league_seasons' AND column_name IN ('twice_in_a_day_allowed', 'home_away_tolerance'))
--       OR (table_name = 'league_divisions' AND column_name = 'games_per_team');                        -- 3 rows
--   SELECT count(*) FROM pg_proc WHERE proname = 'league_season_rules_save';                            -- 1
--   SELECT count(*) FROM league_seasons WHERE twice_in_a_day_allowed OR home_away_tolerance <> 1;       -- 0 right after
