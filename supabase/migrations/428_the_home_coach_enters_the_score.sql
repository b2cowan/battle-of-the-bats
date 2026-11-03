-- ---------------------------------------------------------------
-- Migration 428 — House League Stage 9e-3 Part 1 (rulings 9e·7, 9e·8, 9e·9, plan HOUSE_LEAGUE_STAGE9_PLAN.md §0i; build
-- prompt docs/projects/active/HOUSE_LEAGUE_STAGE9E3_BUILD_PROMPT.md): the home team's coach enters the score.
--
-- WHY: only the club could enter a house-league score, so the league admin typed every result of the season. The home
-- team's coach now enters it from their own team page once the game has started; it counts at once. The other coach can
-- report it (the score stands); the entering side can change it until it is reported or the club touches it; the league
-- admin keeps or corrects it. Nobody is emailed about a score (9d2·2, 9d2·13): nothing here writes a change row.
--
-- WHAT CHANGES:
--   (1) league_game_scores — ONE ROW PER GAME: who entered its score (the user and the name as it read then, so a
--       removed coach's entry keeps their name), which side (coach / club), the team a coach entered for, and when; who
--       reported it, for which team, when, and the note; who checked it and when; who corrected it and when. No row = no
--       score, or a score the club entered before this build. ⚖ ITS OWN TABLE, SERVICE ROLE ONLY, NOT COLUMNS ON
--       league_games: mig 020's "public can read games of active seasons" lets anyone read every column of league_games,
--       so who entered a score and what a coach wrote about it would be public (the 9d-3 shape, mig 415). The scores stay
--       where they are (home_score, away_score, status).
--   (2) league_game_coach_score — the home coach's Enter / Change / clear: refuses finished, unpublished, not home,
--       gone, called off, not started, changed and closed; writes the game (both in: completed; both empty: scheduled)
--       and the record together, and moves the game's updated_at (a rainout window opened before it refuses `changed`).
--   (3) league_game_score_report — the away coach's Report this score (the score stands; the note is optional). It also
--       moves the game's updated_at: a report is news about the score, so a window opened before it (the league admin's
--       Keep, the home coach's Change) refuses `changed` and reads the report instead of acting past it.
--   (4) league_game_score_keep — the league admin's Keep (and ✓ with no change): marks a coach's score checked.
--   (5) league_game_club_write — the club's game PATCH when it carries a score: the game's columns and the record's stamp
--       ("entered by" the club on a game with no score, "corrected by" over a coach's score, the record gone when both
--       boxes are emptied) in ONE statement block, never a best-effort second write.
-- Every function locks the game row (FOR UPDATE) and checks the updated_at the window saw.
--
-- ⚖ What closes a coach's door: a report, a Keep, a correction, or a score the club entered. A score the club CLEARS
-- takes its record with it: the game has no score again and its home coach can enter one (build decision, owner may
-- overrule).
--
-- No change to any existing table, trigger or function; no row changed. Additive and re-runnable. A new table is visible
-- to check:migrations; the four functions are not (MANUAL_PROD_STEPS.json). Apply BEFORE promoting the code that reads it.
-- Proved by scripts/house-league-9e3-scores-check.sql (DEV, rolled back).
-- ---------------------------------------------------------------

BEGIN;

-- ─── 1 · The record ──────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_game_scores (
  game_id            uuid PRIMARY KEY REFERENCES public.league_games(id) ON DELETE CASCADE,
  org_id             uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id          uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  entered_side       text NOT NULL CHECK (entered_side IN ('coach', 'club')),
  entered_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entered_by_name    text NOT NULL,
  entered_for_team   uuid REFERENCES public.league_teams(id) ON DELETE SET NULL,
  entered_at         timestamptz NOT NULL,
  reported_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_by_name   text,
  reported_for_team  uuid REFERENCES public.league_teams(id) ON DELETE SET NULL,
  reported_at        timestamptz,
  report_note        text CHECK (report_note IS NULL OR char_length(report_note) BETWEEN 1 AND 280),
  checked_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_by_name    text,
  checked_at         timestamptz,
  corrected_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  corrected_by_name  text,
  corrected_at       timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- A coach's entry names the team it was entered for; the club's never does.
  CONSTRAINT league_game_scores_side_team CHECK (entered_side = 'coach' OR entered_for_team IS NULL),
  CONSTRAINT league_game_scores_report_whole CHECK ((reported_at IS NULL) = (reported_by_name IS NULL))
);

CREATE INDEX IF NOT EXISTS league_game_scores_season_idx ON public.league_game_scores (season_id);
CREATE INDEX IF NOT EXISTS league_game_scores_org_idx ON public.league_game_scores (org_id);

ALTER TABLE public.league_game_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.league_game_scores FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_game_scores TO service_role;

COMMENT ON TABLE public.league_game_scores IS
  'House League 9e-3 (mig 428): who entered a game''s score, who reported it, who checked or corrected it. One row per game; no row = no score, or a club score from before 9e-3. Service role only: league_games is public, this is not. Written only by league_game_coach_score, league_game_score_report, league_game_score_keep and league_game_club_write.';
COMMENT ON COLUMN public.league_game_scores.entered_side IS
  'coach: the home team''s coach entered it (the coaches'' doors stay open until a report, a Keep or a correction). club: the league admin entered it (no coach door).';
COMMENT ON COLUMN public.league_game_scores.entered_by_name IS
  'The name as it read when the score was entered (a coach''s league_team_coaches.name; a staff member''s account name), so a removed coach''s entry keeps their name.';
COMMENT ON COLUMN public.league_game_scores.entered_for_team IS
  'The team a coach entered the score for (the home team). Null on a club entry.';
COMMENT ON COLUMN public.league_game_scores.report_note IS
  'The away coach''s "What should it be?" (optional, 1-280 characters). Never public, never emailed.';
COMMENT ON COLUMN public.league_game_scores.checked_at IS
  'The league admin kept the coach''s score as it was (Keep, or ✓ with no change). Closes the coaches'' doors.';
COMMENT ON COLUMN public.league_game_scores.corrected_at IS
  'The league admin changed a coach''s score. Closes the coaches'' doors.';

-- ─── 2 · The home coach enters, changes or clears ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.league_game_coach_score(
  p_org uuid, p_game uuid, p_team uuid, p_user uuid, p_name text, p_home integer, p_away integer, p_seen timestamptz
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g        league_games%ROWTYPE;
  v_status text;
  v_pub    timestamptz;
  r        league_game_scores%ROWTYPE;
BEGIN
  IF (p_home IS NULL) <> (p_away IS NULL) OR p_home < 0 OR p_away < 0 THEN
    RAISE EXCEPTION 'Enter both scores, or neither.';
  END IF;
  SELECT * INTO g FROM league_games WHERE id = p_game AND org_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RETURN 'notFound'; END IF;
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = g.season_id;
  IF v_status IN ('completed', 'archived') THEN RETURN 'finished'; END IF;
  SELECT d.schedule_published_at INTO v_pub FROM league_divisions d WHERE d.id = g.division_id;
  IF v_pub IS NULL THEN RETURN 'notFound'; END IF;
  IF g.home_team_id IS DISTINCT FROM p_team THEN RETURN 'notHome'; END IF;
  IF NOT EXISTS (SELECT 1 FROM league_team_coaches c WHERE c.team_id = p_team AND c.user_id = p_user
                    AND c.accepted_at IS NOT NULL AND c.removed_at IS NULL) THEN
    RETURN 'gone';
  END IF;
  IF g.status IN ('cancelled', 'postponed') THEN RETURN 'calledOff'; END IF;
  IF g.scheduled_at IS NULL OR g.scheduled_at > now() THEN RETURN 'notStarted'; END IF;
  IF g.updated_at IS DISTINCT FROM p_seen THEN RETURN 'changed'; END IF;

  SELECT * INTO r FROM league_game_scores WHERE game_id = p_game;
  IF FOUND THEN
    IF r.entered_side <> 'coach' OR r.reported_at IS NOT NULL OR r.checked_at IS NOT NULL OR r.corrected_at IS NOT NULL THEN
      RETURN 'closed';
    END IF;
  ELSIF g.home_score IS NOT NULL OR g.away_score IS NOT NULL THEN
    -- A score the club entered before this record existed: the club's, as if entered by the club.
    RETURN 'closed';
  END IF;

  IF p_home IS NULL AND g.home_score IS NULL AND g.away_score IS NULL THEN
    RETURN NULL; -- nothing to clear
  END IF;

  UPDATE league_games
     SET home_score = p_home, away_score = p_away,
         status = CASE WHEN p_home IS NULL THEN 'scheduled' ELSE 'completed' END,
         updated_at = now()
   WHERE id = p_game;

  IF p_home IS NULL THEN
    DELETE FROM league_game_scores WHERE game_id = p_game;
  ELSE
    INSERT INTO league_game_scores (game_id, org_id, season_id, entered_side, entered_by, entered_by_name, entered_for_team, entered_at)
    VALUES (p_game, g.org_id, g.season_id, 'coach', p_user, p_name, p_team, now())
    ON CONFLICT (game_id) DO UPDATE
      SET entered_by = EXCLUDED.entered_by, entered_by_name = EXCLUDED.entered_by_name,
          entered_for_team = EXCLUDED.entered_for_team, entered_at = EXCLUDED.entered_at, updated_at = now();
  END IF;
  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.league_game_coach_score(uuid, uuid, uuid, uuid, text, integer, integer, timestamptz) IS
  'House League 9e-3: the home coach enters, changes (both scores) or clears (both null) a started game''s score. Returns null when written, else a refusal: notFound, finished, notHome, gone, calledOff, notStarted, changed, closed. Writes the game and its league_game_scores row together; moves updated_at.';

-- ─── 3 · The away coach reports it ───────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.league_game_score_report(
  p_org uuid, p_game uuid, p_team uuid, p_user uuid, p_name text, p_note text, p_seen timestamptz
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g        league_games%ROWTYPE;
  v_status text;
  v_pub    timestamptz;
  r        league_game_scores%ROWTYPE;
  v_note   text := nullif(btrim(p_note), '');
BEGIN
  IF char_length(v_note) > 280 THEN RAISE EXCEPTION 'A note is 280 characters at most.'; END IF;
  SELECT * INTO g FROM league_games WHERE id = p_game AND org_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RETURN 'notFound'; END IF;
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = g.season_id;
  IF v_status IN ('completed', 'archived') THEN RETURN 'finished'; END IF;
  SELECT d.schedule_published_at INTO v_pub FROM league_divisions d WHERE d.id = g.division_id;
  IF v_pub IS NULL THEN RETURN 'notFound'; END IF;
  IF g.away_team_id IS DISTINCT FROM p_team THEN RETURN 'notAway'; END IF;
  IF NOT EXISTS (SELECT 1 FROM league_team_coaches c WHERE c.team_id = p_team AND c.user_id = p_user
                    AND c.accepted_at IS NOT NULL AND c.removed_at IS NULL) THEN
    RETURN 'gone';
  END IF;
  -- A coach of both teams is the home coach: their own score has no Report door.
  IF EXISTS (SELECT 1 FROM league_team_coaches c WHERE c.team_id = g.home_team_id AND c.user_id = p_user
                AND c.accepted_at IS NOT NULL AND c.removed_at IS NULL) THEN
    RETURN 'own';
  END IF;
  IF g.status IN ('cancelled', 'postponed') THEN RETURN 'calledOff'; END IF;
  IF g.updated_at IS DISTINCT FROM p_seen THEN RETURN 'changed'; END IF;
  SELECT * INTO r FROM league_game_scores WHERE game_id = p_game FOR UPDATE;
  IF NOT FOUND OR g.home_score IS NULL OR r.entered_side <> 'coach'
     OR r.reported_at IS NOT NULL OR r.checked_at IS NOT NULL OR r.corrected_at IS NOT NULL THEN
    RETURN 'closed';
  END IF;

  UPDATE league_game_scores
     SET reported_by = p_user, reported_by_name = p_name, reported_for_team = p_team, reported_at = now(),
         report_note = v_note, updated_at = now()
   WHERE game_id = p_game;
  -- Moves the game's mark too, so a window that has not seen the report cannot Keep or change past it. Only updated_at
  -- changes: the game-changes trigger sees no date, place or state change and records nothing.
  UPDATE league_games SET updated_at = now() WHERE id = p_game;
  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.league_game_score_report(uuid, uuid, uuid, uuid, text, text, timestamptz) IS
  'House League 9e-3: the away coach reports a coach''s score the club has not looked at (the score stands). Returns null when written, else: notFound, finished, notAway, gone, own, calledOff, changed, closed. Moves the game''s updated_at, so a window opened before the report refuses `changed`.';

-- ─── 4 · The league admin keeps it ───────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.league_game_score_keep(
  p_org uuid, p_game uuid, p_user uuid, p_name text, p_seen timestamptz
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g league_games%ROWTYPE;
  r league_game_scores%ROWTYPE;
BEGIN
  SELECT * INTO g FROM league_games WHERE id = p_game AND org_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RETURN 'notFound'; END IF;
  IF g.updated_at IS DISTINCT FROM p_seen THEN RETURN 'changed'; END IF;
  SELECT * INTO r FROM league_game_scores WHERE game_id = p_game FOR UPDATE;
  IF NOT FOUND OR r.entered_side <> 'coach' OR r.corrected_at IS NOT NULL OR g.home_score IS NULL THEN
    RETURN 'nothing';
  END IF;
  IF r.checked_at IS NOT NULL THEN RETURN NULL; END IF; -- already checked: the press is what was asked
  UPDATE league_game_scores
     SET checked_by = p_user, checked_by_name = p_name, checked_at = now(), updated_at = now()
   WHERE game_id = p_game;
  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.league_game_score_keep(uuid, uuid, uuid, text, timestamptz) IS
  'House League 9e-3: the league admin keeps a coach''s score as it is (Keep, or ✓ with no change). Returns null when marked (or already marked), else: notFound, changed, nothing.';

-- ─── 5 · The club's game write when it carries a score ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.league_game_club_write(
  p_org uuid, p_game uuid, p_seen timestamptz, p_patch jsonb, p_user uuid, p_name text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g league_games%ROWTYPE;
  n league_games%ROWTYPE;
BEGIN
  SELECT * INTO g FROM league_games WHERE id = p_game AND org_id = p_org FOR UPDATE;
  IF NOT FOUND THEN RETURN 'notFound'; END IF;
  IF g.updated_at IS DISTINCT FROM p_seen THEN RETURN 'changed'; END IF;

  -- The same columns updateLeagueGame (lib/db.ts) writes; a key that is absent keeps the stored value.
  UPDATE league_games SET
    home_team_id          = CASE WHEN p_patch ? 'home_team_id'          THEN (p_patch->>'home_team_id')::uuid               ELSE home_team_id END,
    away_team_id          = CASE WHEN p_patch ? 'away_team_id'          THEN (p_patch->>'away_team_id')::uuid               ELSE away_team_id END,
    slot_use_id           = CASE WHEN p_patch ? 'slot_use_id'           THEN (p_patch->>'slot_use_id')::uuid                ELSE slot_use_id END,
    scheduled_at          = CASE WHEN p_patch ? 'scheduled_at'          THEN (p_patch->>'scheduled_at')::timestamptz        ELSE scheduled_at END,
    ends_at               = CASE WHEN p_patch ? 'ends_at'               THEN (p_patch->>'ends_at')::timestamptz             ELSE ends_at END,
    org_venue_id          = CASE WHEN p_patch ? 'org_venue_id'          THEN (p_patch->>'org_venue_id')::uuid               ELSE org_venue_id END,
    org_venue_facility_id = CASE WHEN p_patch ? 'org_venue_facility_id' THEN (p_patch->>'org_venue_facility_id')::uuid      ELSE org_venue_facility_id END,
    location              = CASE WHEN p_patch ? 'location'              THEN p_patch->>'location'                           ELSE location END,
    home_score            = CASE WHEN p_patch ? 'home_score'            THEN (p_patch->>'home_score')::integer              ELSE home_score END,
    away_score            = CASE WHEN p_patch ? 'away_score'            THEN (p_patch->>'away_score')::integer              ELSE away_score END,
    status                = CASE WHEN p_patch ? 'status'                THEN p_patch->>'status'                             ELSE status END,
    notes                 = CASE WHEN p_patch ? 'notes'                 THEN p_patch->>'notes'                              ELSE notes END,
    updated_at            = now()
  WHERE id = p_game
  RETURNING * INTO n;

  IF (n.home_score, n.away_score) IS NOT DISTINCT FROM (g.home_score, g.away_score) THEN
    RETURN NULL; -- the score did not change: no stamp
  END IF;
  IF n.home_score IS NULL AND n.away_score IS NULL THEN
    DELETE FROM league_game_scores WHERE game_id = p_game;
  ELSIF EXISTS (SELECT 1 FROM league_game_scores WHERE game_id = p_game AND entered_side = 'coach') THEN
    UPDATE league_game_scores
       SET corrected_by = p_user, corrected_by_name = p_name, corrected_at = now(), updated_at = now()
     WHERE game_id = p_game;
  ELSE
    INSERT INTO league_game_scores (game_id, org_id, season_id, entered_side, entered_by, entered_by_name, entered_at)
    VALUES (p_game, n.org_id, n.season_id, 'club', p_user, p_name, now())
    ON CONFLICT (game_id) DO UPDATE
      SET entered_side = 'club', entered_by = EXCLUDED.entered_by, entered_by_name = EXCLUDED.entered_by_name,
          entered_for_team = NULL, entered_at = EXCLUDED.entered_at, updated_at = now();
  END IF;
  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.league_game_club_write(uuid, uuid, timestamptz, jsonb, uuid, text) IS
  'House League 9e-3: the club''s game PATCH when it carries a score. Writes the game''s columns (p_patch, keyed by column; absent = kept) and stamps league_game_scores in the same block: corrected over a coach''s score, entered by the club otherwise, the row deleted when both scores are emptied. Returns null when written, else notFound or changed.';

REVOKE ALL ON FUNCTION public.league_game_coach_score(uuid, uuid, uuid, uuid, text, integer, integer, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_game_score_report(uuid, uuid, uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_game_score_keep(uuid, uuid, uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.league_game_club_write(uuid, uuid, timestamptz, jsonb, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_game_coach_score(uuid, uuid, uuid, uuid, text, integer, integer, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_game_score_report(uuid, uuid, uuid, uuid, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_game_score_keep(uuid, uuid, uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.league_game_club_write(uuid, uuid, timestamptz, jsonb, uuid, text) TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT count(*) FROM information_schema.tables WHERE table_name = 'league_game_scores';                      -- 1
--   SELECT count(*) FROM pg_proc WHERE proname IN ('league_game_coach_score', 'league_game_score_report',
--     'league_game_score_keep', 'league_game_club_write');                                                     -- 4
--   routine_privileges EXECUTE on the four = postgres + service_role only.
-- Proof (rolled back): node scripts/db-query.mjs --dev -f scripts/house-league-9e3-scores-check.sql
