-- ---------------------------------------------------------------
-- Migration 518 — Board Ready Stage 4 Part 3 (the club's side of the sign-up form, retention; plan
-- docs/projects/active/BOARD_READY_PLAN.md §5 Stage 4, build prompt BOARD_READY_STAGE4_FORMS_BUILD_PROMPT.md Part 3;
-- drawings BOARD_READY_STAGE4_FORMS_DRAWINGS.html tabs 6, 8 and 9; owner "as recommended" 2026-11-20 on calls 1–6).
--
-- WHAT CHANGES:
--   (1) user_preferences.registration_answer_columns — the answer columns a person chose on Registrations (ruling 11,
--       "remembered per person": the account, so they follow the person to another computer; call 5). A map of form id →
--       up to three question ids. Never an answer.
--   (2) club_form_answer_clears — a family emptied a HEALTH answer on Your sign-up (/legal Part 2 review (f): the club's
--       record reads "Not answered" with "Answer changed by the family {date}"). The answer row is still deleted, as every
--       cleared answer is (mig 515), so EVERY row of club_form_answers is a real answer and no reader has to remember a
--       filter; this table holds only the fact and its date, and goes with its question, its sign-up and its child.
--   (3) club_form_storage_removals — every stored family file or document PDF whose row goes (deleted, or marked removed)
--       is listed here by a trigger, in the same statement, and the six-hourly sweep (mig 516's job, call 1) deletes the
--       stored object and the line. Closes F7 for this store: a deleted registration (the trigger below deletes its file
--       rows), a season-delete cascade, a question delete, a replaced file whose storage delete failed (/legal Part 2 (c)).
--       No foreign key on org_id: an organization delete cascades its file rows, and the line must survive that statement
--       (the org delete also walks the {orgId}/ prefix; deleting an object already gone is a no-op).
--   (4) league_season_last_day(league_seasons) — a season's last day, the one definition: its end date, else a year after
--       its start, else a year after it was made (dates are optional; mig 471's friend-request backstop spells the same rule).
--   (5) club_form_retention_sweep() — ruling 10: family files and health answers are removed 90 days after the season is
--       marked finished (league_seasons.finished_at), or 120 days after its last day when it never is. The values are
--       emptied and removed_at stamped ("Removed {date}" / "File removed {date}"); the file rows go to 'removed' (and so onto
--       the removal list); the clears go. Ticks and every other answer stay with the registration. Idempotent; returns how
--       many answers it removed. A removed file's row keeps no name ('removed'), here and when a family replaces it. Called by the sweep route; nothing schedules it here.
--   (6) club_form_family_answers and club_form_subject_gone — re-made from mig 515 for (2): clearing a health answer
--       records the clear (answering again keeps it: the answer still changed), and a deleted registration (or its
--       sign-up's last child) takes its clears with it.
--
-- SERVICE ROLE ONLY (RLS on, no policies, anon/authenticated revoked). (1)–(3) are columns/tables check:migrations sees;
-- (4)–(6) are functions and triggers it does not: MANUAL_PROD_STEPS.json. ⚠ Promote Parts 1, 2 and 3 TOGETHER (owner call
-- C1); apply after 515 and BEFORE the Part 3 code. Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

-- ─── 1 · The answer columns a person chose ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS registration_answer_columns jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─── 2 · A health answer the family cleared ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_form_answer_clears (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  form_id        uuid NOT NULL REFERENCES public.club_forms(id) ON DELETE CASCADE,
  question_id    uuid NOT NULL REFERENCES public.club_form_questions(id) ON DELETE CASCADE,
  submission_id  uuid REFERENCES public.club_form_submissions(id) ON DELETE CASCADE,
  subject_table  text CHECK (subject_table IS NULL OR subject_table IN ('league_registrations')),
  subject_id     uuid,
  cleared_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_form_answer_clears_subject_pair CHECK ((subject_table IS NULL) = (subject_id IS NULL)),
  CONSTRAINT club_form_answer_clears_has_target CHECK (subject_id IS NOT NULL OR submission_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS club_form_answer_clears_subject_uniq
  ON public.club_form_answer_clears (question_id, subject_table, subject_id) WHERE subject_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS club_form_answer_clears_submission_uniq
  ON public.club_form_answer_clears (question_id, submission_id) WHERE subject_id IS NULL;
CREATE INDEX IF NOT EXISTS club_form_answer_clears_org_idx ON public.club_form_answer_clears (org_id);
CREATE INDEX IF NOT EXISTS club_form_answer_clears_form_idx ON public.club_form_answer_clears (form_id);
CREATE INDEX IF NOT EXISTS club_form_answer_clears_subject_idx ON public.club_form_answer_clears (subject_table, subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS club_form_answer_clears_submission_idx ON public.club_form_answer_clears (submission_id) WHERE submission_id IS NOT NULL;
ALTER TABLE public.club_form_answer_clears ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_form_answer_clears FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_form_answer_clears TO service_role;

CREATE OR REPLACE FUNCTION public.club_form_family_answers(p_form uuid, p_submission uuid, p_subject uuid, p_answers jsonb)
RETURNS TABLE (removed_path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid; v_a jsonb; v_q record; v_old record; v_file uuid; v_n integer; v_paths text[] := '{}';
BEGIN
  SELECT s.org_id INTO v_org FROM club_form_submissions s WHERE s.id = p_submission AND s.form_id = p_form;
  IF v_org IS NULL THEN RAISE EXCEPTION 'club_form_family_answers: sign-up not this form''s'; END IF;

  FOR v_a IN SELECT x FROM jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) x LOOP
    SELECT q.id, q.asked, q.health INTO v_q FROM club_form_questions q
     WHERE q.id = (v_a->>'questionId')::uuid AND q.form_id = p_form AND q.archived_at IS NULL;
    IF NOT FOUND OR v_q.asked <> (CASE WHEN p_subject IS NULL THEN 'once' ELSE 'per_subject' END) THEN
      RAISE EXCEPTION USING ERRCODE = 'CF001', MESSAGE = 'club_form_question_gone';
    END IF;
    IF p_subject IS NULL THEN
      SELECT a.id, a.file_id INTO v_old FROM club_form_answers a WHERE a.question_id = v_q.id AND a.submission_id = p_submission AND a.subject_id IS NULL;
    ELSE
      SELECT a.id, a.file_id INTO v_old FROM club_form_answers a WHERE a.question_id = v_q.id AND a.subject_table = 'league_registrations' AND a.subject_id = p_subject;
    END IF;
    v_file := nullif(v_a->>'fileId', '')::uuid;

    -- The file the answer held goes when the answer is cleared or points at another file.
    IF v_old.id IS NOT NULL AND v_old.file_id IS NOT NULL AND ((v_a->>'clear') = 'true' OR v_file IS DISTINCT FROM v_old.file_id) THEN
      -- The family's own name for the file goes with it (a name can carry health words; /legal Part 3 F1).
      UPDATE club_form_files f SET status = 'removed', removed_at = now(), file_name = 'removed' WHERE f.id = v_old.file_id AND f.status <> 'removed';
      v_paths := v_paths || ARRAY(SELECT f.path FROM club_form_files f WHERE f.id = v_old.file_id);
    END IF;

    IF (v_a->>'clear') = 'true' THEN
      IF v_old.id IS NOT NULL THEN
        DELETE FROM club_form_answers a WHERE a.id = v_old.id;
        -- A health answer the family cleared is said on the club's record (the answer itself is gone).
        IF v_q.health THEN
          IF p_subject IS NULL THEN
            INSERT INTO club_form_answer_clears (org_id, form_id, question_id, submission_id)
            VALUES (v_org, p_form, v_q.id, p_submission)
            ON CONFLICT (question_id, submission_id) WHERE subject_id IS NULL DO UPDATE SET cleared_at = now();
          ELSE
            INSERT INTO club_form_answer_clears (org_id, form_id, question_id, submission_id, subject_table, subject_id)
            VALUES (v_org, p_form, v_q.id, p_submission, 'league_registrations', p_subject)
            ON CONFLICT (question_id, subject_table, subject_id) WHERE subject_id IS NOT NULL DO UPDATE SET cleared_at = now();
          END IF;
        END IF;
      END IF;
      CONTINUE;
    END IF;

    -- Answered again: the clear stays, as the record that the answer changed after it was first given (the new answer is a
    -- new row, so its own dates can't say so); the clock deletes clears with the season's health answers.

    IF v_file IS NOT NULL AND v_file IS DISTINCT FROM v_old.file_id THEN
      UPDATE club_form_files f SET status = 'attached', attached_at = now(), submission_id = p_submission,
             subject_table = CASE WHEN p_subject IS NULL THEN NULL ELSE 'league_registrations' END, subject_id = p_subject
       WHERE f.id = v_file AND f.form_id = p_form AND f.question_id = v_q.id AND f.status = 'pending';
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n <> 1 THEN RAISE EXCEPTION USING ERRCODE = 'CF003', MESSAGE = 'club_form_file_gone'; END IF;
    END IF;

    IF v_old.id IS NOT NULL THEN
      UPDATE club_form_answers a SET value_text = v.value_text, value_choice_ids = v.value_choice_ids, value_bool = v.value_bool,
             value_date = v.value_date, file_id = v.file_id, removed_at = NULL, updated_at = now()
        FROM club_form_answer_value(v_a) v WHERE a.id = v_old.id;
    ELSE
      INSERT INTO club_form_answers (org_id, form_id, question_id, submission_id, subject_table, subject_id,
                                     value_text, value_choice_ids, value_bool, value_date, file_id)
      SELECT v_org, p_form, v_q.id, p_submission, CASE WHEN p_subject IS NULL THEN NULL ELSE 'league_registrations' END, p_subject,
             v.value_text, v.value_choice_ids, v.value_bool, v.value_date, v.file_id
        FROM club_form_answer_value(v_a) v;
    END IF;
  END LOOP;

  RETURN QUERY SELECT unnest(v_paths);
END $$;
REVOKE ALL ON FUNCTION public.club_form_family_answers(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_form_family_answers(uuid, uuid, uuid, jsonb) TO service_role;

-- What goes with a deleted registration (mig 515's trigger, with the clears).
CREATE OR REPLACE FUNCTION public.club_form_subject_gone()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_sub uuid;
BEGIN
  DELETE FROM club_form_answers WHERE subject_table = TG_TABLE_NAME AND subject_id = OLD.id;
  DELETE FROM club_form_answer_clears WHERE subject_table = TG_TABLE_NAME AND subject_id = OLD.id;
  DELETE FROM club_form_ticks WHERE subject_table = TG_TABLE_NAME AND subject_id = OLD.id;
  -- Their stored files go onto the removal list through club_form_file_row_gone (below).
  DELETE FROM club_form_files WHERE subject_table = TG_TABLE_NAME AND subject_id = OLD.id;
  SELECT s.id INTO v_sub FROM club_form_submissions s
   WHERE s.ref = coalesce(OLD.signup_ref, OLD.id::text)
     AND s.form_id IN (SELECT f.id FROM club_forms f WHERE f.owner_table = 'league_seasons' AND f.owner_id = OLD.season_id);
  IF v_sub IS NULL THEN RETURN OLD; END IF;
  -- No child of this sign-up is left: the sign-up's own answers, clears and files go with the last one.
  IF NOT EXISTS (SELECT 1 FROM league_registrations r WHERE r.season_id = OLD.season_id AND r.id <> OLD.id
                   AND coalesce(r.signup_ref, r.id::text) = coalesce(OLD.signup_ref, OLD.id::text)) THEN
    DELETE FROM club_form_answers WHERE submission_id = v_sub AND subject_id IS NULL;
    DELETE FROM club_form_answer_clears WHERE submission_id = v_sub AND subject_id IS NULL;
    DELETE FROM club_form_files WHERE submission_id = v_sub AND subject_id IS NULL;
  END IF;
  -- A sign-up left with no answer, tick or file of its own holds only a guardian's email: it goes too (/legal 2026-11-20).
  DELETE FROM club_form_submissions s
   WHERE s.id = v_sub
     AND NOT EXISTS (SELECT 1 FROM club_form_ticks t WHERE t.submission_id = s.id)
     AND NOT EXISTS (SELECT 1 FROM club_form_answers a WHERE a.submission_id = s.id)
     AND NOT EXISTS (SELECT 1 FROM club_form_files f WHERE f.submission_id = s.id);
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.club_form_subject_gone() FROM PUBLIC, anon, authenticated;

-- ─── 3 · Stored files still to delete ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_form_storage_removals (
  path        text PRIMARY KEY,
  org_id      uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_form_storage_removals_created_idx ON public.club_form_storage_removals (created_at);
ALTER TABLE public.club_form_storage_removals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_form_storage_removals FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_form_storage_removals TO service_role;

CREATE OR REPLACE FUNCTION public.club_form_file_row_gone()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO club_form_storage_removals (path, org_id) VALUES (OLD.path, OLD.org_id) ON CONFLICT (path) DO NOTHING;
    RETURN OLD;
  END IF;
  IF NEW.status = 'removed' AND OLD.status <> 'removed' THEN
    INSERT INTO club_form_storage_removals (path, org_id) VALUES (NEW.path, NEW.org_id) ON CONFLICT (path) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.club_form_file_row_gone() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS club_form_file_row_gone ON public.club_form_files;
CREATE TRIGGER club_form_file_row_gone AFTER DELETE OR UPDATE OF status ON public.club_form_files
  FOR EACH ROW EXECUTE FUNCTION public.club_form_file_row_gone();

CREATE OR REPLACE FUNCTION public.club_form_version_row_gone()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.file_path IS NOT NULL THEN
    INSERT INTO club_form_storage_removals (path, org_id) VALUES (OLD.file_path, OLD.org_id) ON CONFLICT (path) DO NOTHING;
  END IF;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.club_form_version_row_gone() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS club_form_version_row_gone ON public.club_form_document_versions;
CREATE TRIGGER club_form_version_row_gone AFTER DELETE ON public.club_form_document_versions
  FOR EACH ROW EXECUTE FUNCTION public.club_form_version_row_gone();

-- ─── 4 · A season's last day ────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.league_season_last_day(s public.league_seasons)
RETURNS date
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  SELECT coalesce(s.season_end_date, (s.season_start_date + interval '1 year')::date, (s.created_at + interval '1 year')::date);
$$;
REVOKE ALL ON FUNCTION public.league_season_last_day(public.league_seasons) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_season_last_day(public.league_seasons) TO service_role;

-- ─── 5 · The clock: family files and health answers ─────────────────────────────────────────────────────────────────
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
      OR (s.finished_at IS NULL AND league_season_last_day(s) < current_date - 120);

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
