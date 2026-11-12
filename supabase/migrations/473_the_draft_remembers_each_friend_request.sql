-- Migration 473 — Board Ready Stage 1 Part 3 (friend requests in the house-league draft; plan BOARD_READY_PLAN.md §5
-- Stage 1; drawings BOARD_READY_FRIEND_REQUESTS_DRAWINGS.html tabs 5, 5b and 6, every ask ruled as recommended,
-- owner 2026-11-10).
--
-- WHY: the draft keeps confirmed friends together in groups of at most 3 children (A1, A6, A7). After the draft every
-- request reads Honoured or Not honoured, read live from the teams (A3), with the reason. Two of the reasons are only
-- known at the moment of the deal — "the group would pass 3 children" and "{friend} is locked to {team}" — so the deal
-- remembers, per request, what it did with it.
--
--   (1) league_friend_requests.draft_outcome — what the last draft of the asking child's division did with this request:
--       kept (in one group) · over_cap (the group would pass 3) · locked (the two are locked to different teams) · apart
--       (kept apart on the board, or joining would have put two children kept apart in one group: /review 2026-11-12, so
--       a split undone after the draft still reads true) · off ("Keep friends together" was off). NULL: the request was
--       not part of a draft (not confirmed then, or no draft yet).
--       Cleared by a registrar's decision (lib/league-friend-queue-server.ts), so a request confirmed after the draft
--       reads "Confirmed after the draft". Deleted with the request when the season finishes (mig 471).
--   (2) league_division_draft_apply gains p_friend_ids / p_friend_outcomes (DEFAULT NULL, so a caller that sends the
--       old six arguments still resolves): in the SAME transaction as the deal it clears the outcome of every request
--       asked by an accepted player of the division, then writes the ones given (this season's requests only).
--   (3) league_division_clear ("Take all players off teams") clears those outcomes too: no draft, no outcome.
--
-- Additive and re-runnable. ⚠ The old six-argument function is DROPPED and replaced by the eight-argument one with
-- defaults (two overloads would make a six-argument call ambiguous); a named-argument call from the code already on
-- production resolves to the new one, so the order against the code does not matter.

-- ─── 1 · The outcome ───────────────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.league_friend_requests
  ADD COLUMN IF NOT EXISTS draft_outcome text;

-- Dropped and re-made, so a re-run always leaves this exact list.
ALTER TABLE public.league_friend_requests DROP CONSTRAINT IF EXISTS league_friend_requests_draft_outcome_check;
ALTER TABLE public.league_friend_requests
  ADD CONSTRAINT league_friend_requests_draft_outcome_check
  CHECK (draft_outcome IS NULL OR draft_outcome IN ('kept', 'over_cap', 'locked', 'apart', 'off'));

-- ─── 2 · The draft lands whole, with what it did to each friend request ───────────────────────────────────────────

DROP FUNCTION IF EXISTS public.league_division_draft_apply(uuid, uuid, uuid, text, uuid[], uuid[]);

CREATE OR REPLACE FUNCTION public.league_division_draft_apply(
  p_org uuid, p_season uuid, p_division uuid, p_fingerprint text, p_regs uuid[], p_teams uuid[],
  p_friend_ids uuid[] DEFAULT NULL, p_friend_outcomes text[] DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_div league_divisions%ROWTYPE; v_status text; v_open integer; v_done integer;
BEGIN
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF v_status IN ('completed','archived') THEN RETURN 'finished'; END IF;
  SELECT * INTO v_div FROM league_divisions d WHERE d.id = p_division AND d.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Division not found'; END IF;
  IF v_div.teams_published_at IS NOT NULL THEN RETURN 'published'; END IF;
  IF league_division_fingerprint(p_division) IS DISTINCT FROM p_fingerprint THEN RETURN 'changed'; END IF;
  IF cardinality(p_regs) IS DISTINCT FROM cardinality(p_teams) THEN RAISE EXCEPTION 'A deal pairs each player with a team'; END IF;
  IF cardinality(p_friend_ids) IS DISTINCT FROM cardinality(p_friend_outcomes) THEN
    RAISE EXCEPTION 'Each friend request needs one outcome';
  END IF;

  SELECT count(*) INTO v_open FROM league_registrations r
   WHERE r.division_id = p_division AND r.status = 'active' AND r.team_locked_at IS NULL;
  IF v_open IS DISTINCT FROM coalesce(cardinality(p_regs), 0) THEN RETURN 'changed'; END IF;

  UPDATE league_registrations r SET team_id = a.team, draft_team_id = a.team, updated_at = now()
    FROM unnest(p_regs, p_teams) AS a(reg, team)
   WHERE r.id = a.reg AND r.division_id = p_division AND r.status = 'active' AND r.team_locked_at IS NULL;
  GET DIAGNOSTICS v_done = ROW_COUNT;
  IF v_done IS DISTINCT FROM v_open THEN RAISE EXCEPTION 'The deal did not cover every player'; END IF;

  -- A locked player was "dealt" where they stand.
  UPDATE league_registrations r SET draft_team_id = r.team_id
   WHERE r.division_id = p_division AND r.status = 'active' AND r.team_locked_at IS NOT NULL;

  -- Mig 473: what this deal did with each friend request. Every request asked by an accepted player of the division
  -- starts again from nothing; then the given outcomes land (this season's requests of this division only).
  UPDATE league_friend_requests q SET draft_outcome = NULL
    FROM league_registrations r
   WHERE q.registration_id = r.id AND q.season_id = p_season
     AND r.division_id = p_division AND r.status = 'active' AND q.draft_outcome IS NOT NULL;
  IF coalesce(cardinality(p_friend_ids), 0) > 0 THEN
    UPDATE league_friend_requests q SET draft_outcome = a.outcome
      FROM unnest(p_friend_ids, p_friend_outcomes) AS a(id, outcome), league_registrations r
     WHERE q.id = a.id AND q.season_id = p_season AND q.registration_id = r.id
       AND r.division_id = p_division AND r.status = 'active';
  END IF;
  RETURN NULL;
END $$;

-- ─── 3 · "Take all players off teams": no draft, no outcome ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.league_division_clear(
  p_org uuid, p_season uuid, p_division uuid, p_fingerprint text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_div league_divisions%ROWTYPE; v_status text;
BEGIN
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF v_status IN ('completed','archived') THEN RETURN 'finished'; END IF;
  SELECT * INTO v_div FROM league_divisions d WHERE d.id = p_division AND d.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Division not found'; END IF;
  IF v_div.teams_published_at IS NOT NULL THEN RETURN 'published'; END IF;
  IF league_division_fingerprint(p_division) IS DISTINCT FROM p_fingerprint THEN RETURN 'changed'; END IF;
  UPDATE league_registrations r SET team_id = NULL, draft_team_id = NULL, team_locked_at = NULL, updated_at = now()
   WHERE r.division_id = p_division AND r.status = 'active'
     AND (r.team_id IS NOT NULL OR r.draft_team_id IS NOT NULL OR r.team_locked_at IS NOT NULL);
  -- Mig 473: the requests of the division's players were part of no draft now.
  UPDATE league_friend_requests q SET draft_outcome = NULL
    FROM league_registrations r
   WHERE q.registration_id = r.id AND q.season_id = p_season
     AND r.division_id = p_division AND r.status = 'active' AND q.draft_outcome IS NOT NULL;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.league_division_draft_apply(uuid,uuid,uuid,text,uuid[],uuid[],uuid[],text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_division_draft_apply(uuid,uuid,uuid,text,uuid[],uuid[],uuid[],text[]) TO service_role;
REVOKE ALL ON FUNCTION public.league_division_clear(uuid,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_division_clear(uuid,uuid,uuid,text) TO service_role;
