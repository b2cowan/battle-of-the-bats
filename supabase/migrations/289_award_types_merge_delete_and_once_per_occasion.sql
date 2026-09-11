-- Migration 289: award types learn merge + delete; a player holds an award once per occasion
-- (Awards Join the One Tag Idiom, Part B, Phase 2).
--
-- Three things, all gated on the same team-scoped drawer the rest of the portal's tag
-- libraries already use:
--
-- 1. R5 (owner, 2026-09-11): "if a player was given 2 awards and you merge, we don't want them
--    to have the same award twice." The app already refuses a NEW collision at the route level
--    (`findRepPlayerAwardCollision` in lib/db.ts, shipped with Part A) — this migration is the
--    DB-level half that makes the rule airtight against a race, and the invariant the merge
--    below relies on. Two partial unique indexes: one keyed on (player, type, event) for a
--    game-linked award, one on (player, type, date, label) for a general one — the same
--    definition as `lib/rep-award-occasion.ts:sameAwardOccasion`, expressed as a SQL constraint
--    because a DB constraint can't call a JS function.
--
--    ⚠ A partial unique index cannot be created over existing collisions, so the dedupe DO block
--    below runs FIRST — a data-only step invisible to every schema gate (the mig-264 lesson).
--    It keeps the EARLIEST-created award per collision group and drops the rest, carrying a
--    dropped award's note onto the survivor only when the survivor's own note is NULL (never
--    overwriting what a coach actually wrote). ⚠⚠ CHECKED BOTH DATABASES BEFORE WRITING THIS
--    FILE (2026-09-11): dev and prod both returned ZERO doubles on both shapes — the dedupe
--    block below is defensive (idempotent, and cheap insurance against a double minted between
--    this check and the migration's application), not a correction of known bad data.
--
-- 2. merge_rep_team_award_types(winner, loser, team): proves both ids belong to the caller's own
--    team (never a shared, org-authored type — those are a different screen's job per the plan's
--    out-of-scope), collapses any (player, occasion) collision between the two types FIRST
--    (dropping the LATER-created award of each colliding pair — the earlier one is the record
--    the coach actually made at the time), re-points every remaining loser-type award to the
--    winner, then deletes the loser type. Modelled on merge_rep_team_tags (migration 221), which
--    collapses with `ON CONFLICT DO NOTHING` because its link table has a bare PK; awards are
--    rows with their own notes and creation times, so the collapse here is explicit.
--
-- 3. A DELETE RLS policy on rep_team_award_types, parity with rep_team_tags (migration 181).
--    The RESTRICT FK on rep_player_awards.award_type_id stays exactly as migration 182 left it —
--    a used type still cannot be hard-deleted by ANY path; delete only succeeds app-side once
--    usage is zero (the route's job, not this migration's).

-- ════════════════════════════════════════════════════════════════════
-- 1a. Dedupe existing collisions before the indexes can be created
-- ════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_touched_event int := 0;
  v_touched_general int := 0;
BEGIN
  -- Event-linked doubles: keep the earliest-created award per (player, type, event).
  WITH ranked AS (
    SELECT id, player_id, award_type_id, event_id, note, created_at,
           row_number() OVER (
             PARTITION BY player_id, award_type_id, event_id
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM public.rep_player_awards
    WHERE event_id IS NOT NULL
  ),
  loser_notes AS (
    SELECT DISTINCT ON (s.id) s.id AS survivor_id, l.note
    FROM ranked s
    JOIN ranked l
      ON l.player_id = s.player_id AND l.award_type_id = s.award_type_id AND l.event_id = s.event_id
     AND l.rn > 1
    WHERE s.rn = 1 AND l.note IS NOT NULL
    ORDER BY s.id, l.rn ASC
  )
  UPDATE public.rep_player_awards a
  SET note = ln.note
  FROM loser_notes ln
  WHERE a.id = ln.survivor_id AND a.note IS NULL;

  WITH ranked AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY player_id, award_type_id, event_id
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM public.rep_player_awards
    WHERE event_id IS NOT NULL
  )
  DELETE FROM public.rep_player_awards a
  USING ranked r
  WHERE a.id = r.id AND r.rn > 1;
  GET DIAGNOSTICS v_touched_event = ROW_COUNT;

  -- General-award doubles: same rule keyed on (player, type, date, label).
  WITH ranked AS (
    SELECT id, player_id, award_type_id, awarded_at,
           coalesce(tournament_label, '') AS lbl, note, created_at,
           row_number() OVER (
             PARTITION BY player_id, award_type_id, awarded_at, coalesce(tournament_label, '')
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM public.rep_player_awards
    WHERE event_id IS NULL
  ),
  loser_notes AS (
    SELECT DISTINCT ON (s.id) s.id AS survivor_id, l.note
    FROM ranked s
    JOIN ranked l
      ON l.player_id = s.player_id AND l.award_type_id = s.award_type_id
     AND l.awarded_at = s.awarded_at AND l.lbl = s.lbl AND l.rn > 1
    WHERE s.rn = 1 AND l.note IS NOT NULL
    ORDER BY s.id, l.rn ASC
  )
  UPDATE public.rep_player_awards a
  SET note = ln.note
  FROM loser_notes ln
  WHERE a.id = ln.survivor_id AND a.note IS NULL;

  WITH ranked AS (
    SELECT id,
           row_number() OVER (
             PARTITION BY player_id, award_type_id, awarded_at, coalesce(tournament_label, '')
             ORDER BY created_at ASC, id ASC
           ) AS rn
    FROM public.rep_player_awards
    WHERE event_id IS NULL
  )
  DELETE FROM public.rep_player_awards a
  USING ranked r
  WHERE a.id = r.id AND r.rn > 1;
  GET DIAGNOSTICS v_touched_general = ROW_COUNT;

  RAISE NOTICE 'award dedupe (mig 289): % event-linked row(s) dropped, % general row(s) dropped',
    v_touched_event, v_touched_general;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- 1b. The two partial unique indexes (the R5 rule, made airtight)
-- ════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS rep_player_awards_once_per_game_uniq
  ON public.rep_player_awards(player_id, award_type_id, event_id)
  WHERE event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rep_player_awards_once_per_general_occasion_uniq
  ON public.rep_player_awards(player_id, award_type_id, awarded_at, coalesce(tournament_label, ''))
  WHERE event_id IS NULL;

-- ════════════════════════════════════════════════════════════════════
-- 2. merge_rep_team_award_types — collapses R5 collisions, re-points, deletes the loser type
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.merge_rep_team_award_types(p_winner uuid, p_loser uuid, p_team uuid)
RETURNS TABLE(moved int, dropped int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner public.rep_team_award_types%rowtype;
  v_loser  public.rep_team_award_types%rowtype;
  v_moved int := 0;
  v_dropped int := 0;
BEGIN
  IF p_winner = p_loser THEN
    RAISE EXCEPTION 'merge_rep_team_award_types_same_type';
  END IF;

  SELECT * INTO v_winner FROM public.rep_team_award_types WHERE id = p_winner FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merge_rep_team_award_types_winner_not_found';
  END IF;
  IF v_winner.team_id IS DISTINCT FROM p_team THEN
    RAISE EXCEPTION 'merge_rep_team_award_types_winner_not_owned';
  END IF;

  SELECT * INTO v_loser FROM public.rep_team_award_types WHERE id = p_loser FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merge_rep_team_award_types_loser_not_found';
  END IF;
  IF v_loser.team_id IS DISTINCT FROM p_team THEN
    RAISE EXCEPTION 'merge_rep_team_award_types_loser_not_owned';
  END IF;

  -- "moved" is the coach-facing scope of the merge — every award the loser type currently holds,
  -- counted BEFORE the collapse below touches anything (the confirm dialog's preview computes
  -- this same number the same way, so the number on the button matches the number in the
  -- sentence). "dropped" is the subset of those that collide with an existing winner-type award
  -- and are removed rather than re-pointed.
  SELECT count(*) INTO v_moved
  FROM public.rep_player_awards WHERE award_type_id = p_loser AND team_id = p_team;

  -- Collapse R5 collisions first: a loser award whose (player, occasion) already holds a winner
  -- award would double the player up the instant it's re-pointed. Drop the LATER-created of each
  -- colliding pair — the earlier one is the record the coach actually made at the time — and
  -- carry the dropped award's note onto the survivor only when the survivor's own is NULL.
  WITH collisions AS (
    SELECT l.id AS loser_award_id, w.id AS winner_award_id,
           l.created_at AS loser_created, w.created_at AS winner_created,
           l.note AS loser_note, w.note AS winner_note
    FROM public.rep_player_awards l
    JOIN public.rep_player_awards w
      ON w.award_type_id = p_winner
     AND w.team_id = p_team
     AND w.player_id = l.player_id
     AND (
       (l.event_id IS NOT NULL AND w.event_id = l.event_id)
       OR (l.event_id IS NULL AND w.event_id IS NULL
           AND w.awarded_at = l.awarded_at
           AND coalesce(w.tournament_label, '') = coalesce(l.tournament_label, ''))
     )
    WHERE l.award_type_id = p_loser AND l.team_id = p_team
  ),
  resolved AS (
    SELECT
      CASE WHEN loser_created <= winner_created THEN loser_award_id ELSE winner_award_id END AS survivor_id,
      CASE WHEN loser_created <= winner_created THEN winner_award_id ELSE loser_award_id END AS dropped_id,
      CASE WHEN loser_created <= winner_created THEN loser_note ELSE winner_note END AS survivor_note,
      CASE WHEN loser_created <= winner_created THEN winner_note ELSE loser_note END AS dropped_note
    FROM collisions
  ),
  noted AS (
    UPDATE public.rep_player_awards a
    SET note = r.dropped_note
    FROM resolved r
    WHERE a.id = r.survivor_id AND a.note IS NULL AND r.dropped_note IS NOT NULL
    RETURNING a.id
  )
  DELETE FROM public.rep_player_awards a
  USING resolved r
  WHERE a.id = r.dropped_id;
  GET DIAGNOSTICS v_dropped = ROW_COUNT;

  -- Re-point everything still carrying the loser type — including a collapsed pair's survivor,
  -- when the survivor was the loser-side award (it still reads award_type_id = p_loser here).
  UPDATE public.rep_player_awards
  SET award_type_id = p_winner, updated_at = now()
  WHERE award_type_id = p_loser AND team_id = p_team;

  DELETE FROM public.rep_team_award_types WHERE id = p_loser;

  RETURN QUERY SELECT v_moved, v_dropped;
END;
$$;

COMMENT ON FUNCTION public.merge_rep_team_award_types(uuid, uuid, uuid) IS
  'Awards Join the One Tag Idiom Part B (migration 289): collapses R5 collisions (drops the '
  'later-created of each colliding pair), re-points every remaining rep_player_awards row from '
  'the loser award type to the winner, then deletes the loser type. Both ids must belong to '
  'p_team — a shared, org-authored type is never merged from a team route.';

REVOKE ALL ON FUNCTION public.merge_rep_team_award_types(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.merge_rep_team_award_types(uuid, uuid, uuid) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════
-- 3. DELETE RLS policy — parity with rep_team_tags (migration 181)
-- ════════════════════════════════════════════════════════════════════
--
-- The RESTRICT FK on rep_player_awards.award_type_id (migration 182) stays as the backstop: a
-- used type still cannot be hard-deleted by any path, this policy included. Delete only succeeds
-- once the app-side route has confirmed zero usage.

CREATE POLICY "coaches can delete rep_team_award_types"
  ON public.rep_team_award_types FOR DELETE
  USING (
    team_id IN (SELECT team_id FROM public.rep_team_coaches WHERE user_id = auth.uid())
  );

CREATE POLICY "org admins can delete rep_team_award_types"
  ON public.rep_team_award_types FOR DELETE
  USING (
    org_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
