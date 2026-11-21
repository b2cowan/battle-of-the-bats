-- ---------------------------------------------------------------
-- Migration 519 — Board Ready Stage 4 Part 3, owner call 2 (2026-11-20, "go with your recommendations": skip reopened
-- seasons). The retention clock (mig 518, ruling 10) removes family files and health answers 90 days after a season is
-- marked finished, or 120 days after its last day when it never is. A season that was finished and then REOPENED has its
-- finish cleared (mig 377/471), so it read as "never finished" and lost its answers at the next run while live again.
--
-- WHAT CHANGES:
--   (1) league_seasons.reopened_at — when a finished season was last made live again (stamped by the finish trigger).
--   (2) league_seasons_finished() — mig 471's body, unchanged, plus that stamp in its reopen branch.
--   (3) club_form_retention_sweep() — mig 518's body; the 120-day branch skips a reopened season. Once it is finished
--       again, the 90-day clock runs from that finish, as for any season.
--
-- A column check:migrations sees, and two functions it does not: MANUAL_PROD_STEPS.json. ORDER: after 518. Promote with
-- Parts 1–3 (owner call C1). Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.league_seasons ADD COLUMN IF NOT EXISTS reopened_at timestamptz;

-- Mig 471's body, unchanged, plus the reopen stamp.
CREATE OR REPLACE FUNCTION public.league_seasons_finished() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.status IN ('completed','archived') THEN
    IF OLD.status NOT IN ('completed','archived') THEN
      NEW.finished_at := now();
      DELETE FROM league_player_ratings WHERE season_id = NEW.id;
      -- Board Ready Stage 1 (A12): friend requests and friend codes are deleted when the season is marked finished.
      -- The sign-ups first: that locks every one of them, so a family's save already in flight (it locks its sign-up,
      -- league_friend_requests_save) finishes before the requests are deleted, and a later one waits and is refused
      -- (the save's finished check below) (/review 2026-11-11). Every sign-up is locked, not only those with a code.
      PERFORM 1 FROM league_registrations WHERE season_id = NEW.id FOR UPDATE;
      UPDATE league_registrations SET friend_code = NULL WHERE season_id = NEW.id AND friend_code IS NOT NULL;
      DELETE FROM league_friend_requests WHERE season_id = NEW.id;
    END IF;
  ELSE
    -- Reopened: it is live again. Its ratings do not come back (they were erased, as ruled), nor its friend requests.
    NEW.finished_at := NULL;
    -- Board Ready Stage 4 Part 3 (owner call 2): a season made live again after its finish keeps its family files and
    -- health answers until it is finished again (the retention clock skips it).
    IF OLD.status IN ('completed','archived') THEN
      NEW.reopened_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.club_form_retention_sweep()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_removed integer;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS club_form_retention_due (form_id uuid PRIMARY KEY) ON COMMIT DROP;
  DELETE FROM club_form_retention_due;
  INSERT INTO club_form_retention_due (form_id)
  SELECT f.id FROM club_forms f
    JOIN league_seasons s ON f.owner_table = 'league_seasons' AND s.id = f.owner_id
   WHERE (s.finished_at IS NOT NULL AND s.finished_at <= now() - interval '90 days')
      -- Never marked finished: 120 days after its last day. A season reopened after its finish is not "never finished"
      -- (owner call 2, mig 519): it waits for its next finish.
      OR (s.finished_at IS NULL AND s.reopened_at IS NULL AND league_season_last_day(s) < current_date - 120);

  -- A health answer, or any file answer: emptied and stamped. The record says only "Removed {date}" / "File removed {date}";
  -- the file's stored object goes through the removal list.
  WITH gone AS (
    UPDATE club_form_answers a
       SET value_text = NULL, value_choice_ids = NULL, value_bool = NULL, value_date = NULL, removed_at = now()
      FROM club_form_retention_due d, club_form_questions q
     WHERE a.form_id = d.form_id AND q.id = a.question_id AND a.removed_at IS NULL
       AND (q.health OR q.question_type = 'file')
    RETURNING 1
  )
  SELECT count(*) INTO v_removed FROM gone;

  -- The family's own name for the file goes too: only "File removed {date}" is left (/legal Part 3 F1).
  UPDATE club_form_files fl SET status = 'removed', removed_at = now(), file_name = 'removed'
    FROM club_form_retention_due d
   WHERE fl.form_id = d.form_id AND fl.status <> 'removed';

  DELETE FROM club_form_answer_clears c USING club_form_retention_due d WHERE c.form_id = d.form_id;

  RETURN v_removed;
END $$;
REVOKE ALL ON FUNCTION public.club_form_retention_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_form_retention_sweep() TO service_role;

COMMIT;
