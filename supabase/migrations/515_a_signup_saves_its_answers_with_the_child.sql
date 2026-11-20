-- ---------------------------------------------------------------
-- Migration 515 — Board Ready Stage 4 Part 2 (the family side of the club's sign-up form; plan
-- docs/projects/active/BOARD_READY_PLAN.md §5 Stage 4, build prompt BOARD_READY_STAGE4_FORMS_BUILD_PROMPT.md Part 2;
-- drawings BOARD_READY_STAGE4_FORMS_DRAWINGS.html tabs 5 and 7, all 20 asks ruled as recommended, owner 2026-11-20).
--
-- WHY: a family's answers, attached files and document ticks must be saved IN THE SAME STEP that places the child
-- (drawing tab 5: "an allergy must never be dropped" the way a failed friend request is only logged today). Part 1
-- recorded ticks just after the placement; this moves them, with the answers and the files, inside it.
--
-- WHAT CHANGES (functions only; no table, no column):
--   (1) club_form_place_signup — the ONE locked placement (league_registration_place, mig 362/430, unchanged) and, when
--       it places the child, in the same transaction: the sign-up row, this child's answers, the once-per-sign-up answers
--       the caller hands to the first child placed, each file attached to the registration (or the sign-up), and one tick
--       per document. Any failure raises and rolls the placement back with it: the child is not signed up and the
--       family is told. A refusal (duplicate, full) writes nothing, as before.
--   (2) club_form_family_answers — Your sign-up's Change (ruling 20): a family's answers for one child (or the sign-up),
--       saved together. A changed file marks the old one removed and returns its stored path (the server deletes it at
--       once); a cleared answer is deleted.
-- The family's "the club changed the form under this page" refusals carry their own SQLSTATE (class CF: CF001 a question,
-- CF002 a document, CF003 a file), read by the routes from the error's code, never its words.
-- Every check a route already makes is made again here (the question is this form's, live, and asked for this kind of
-- subject; a file is this form's, this question's and still waiting), so a page drawn before the club changed the form
-- can't write an answer the form no longer asks.
--
-- SERVICE ROLE ONLY. Invisible to check:migrations (functions): MANUAL_PROD_STEPS.json. ⚠ Promote Parts 1, 2 and 3
-- TOGETHER (owner ruling 2026-11-20, call C1); apply after 513 and BEFORE the Part 2 code. Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

-- One answer's columns from its JSON (the route has already checked the value against the question's type).
CREATE OR REPLACE FUNCTION public.club_form_answer_value(a jsonb)
RETURNS TABLE (value_text text, value_choice_ids text[], value_bool boolean, value_date date, file_id uuid)
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $$
  SELECT nullif(a->>'text', ''),
         CASE WHEN jsonb_typeof(a->'choiceIds') = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(a->'choiceIds')) END,
         CASE WHEN jsonb_typeof(a->'bool') = 'boolean' THEN (a->>'bool')::boolean END,
         nullif(a->>'date', '')::date,
         nullif(a->>'fileId', '')::uuid;
$$;
REVOKE ALL ON FUNCTION public.club_form_answer_value(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_form_answer_value(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.club_form_place_signup(
  p_org uuid, p_season uuid, p_division uuid, p_child jsonb, p_want text, p_signup_ref text, p_signup_position integer,
  p_fee numeric, p_form jsonb
)
RETURNS TABLE (id uuid, status text, waitlist_position integer, refusal text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_form uuid := (p_form->>'formId')::uuid;
  v_id uuid; v_status text; v_pos integer; v_refusal text;
  v_sub uuid; v_n integer; v_want integer; v_a jsonb; v_file uuid; v_q record; v_once_done boolean;
  v_email text := lower(btrim(p_child->>'guardianEmail'));
  v_at timestamptz := coalesce(nullif(p_form->>'tickedAt', '')::timestamptz, now());
BEGIN
  IF NOT EXISTS (SELECT 1 FROM club_forms f WHERE f.id = v_form AND f.org_id = p_org
                   AND f.owner_table = 'league_seasons' AND f.owner_id = p_season) THEN
    RAISE EXCEPTION 'club_form_place_signup: form not this season''s';
  END IF;

  SELECT p.id, p.status, p.waitlist_position, p.refusal INTO v_id, v_status, v_pos, v_refusal
    FROM league_registration_place(p_org, p_season, p_division, p_child, p_want, p_signup_ref, p_signup_position, p_fee) p;
  IF v_refusal IS NOT NULL OR v_id IS NULL THEN
    RETURN QUERY SELECT v_id, v_status, v_pos, v_refusal; RETURN;
  END IF;

  INSERT INTO club_form_submissions (org_id, form_id, ref, guardian_email)
  VALUES (p_org, v_form, p_signup_ref, v_email)
  ON CONFLICT (form_id, ref) DO UPDATE SET guardian_email = EXCLUDED.guardian_email
  RETURNING club_form_submissions.id INTO v_sub;

  -- This child's answers, then the sign-up's own. Every child's call carries the sign-up's own answers; the first child
  -- placed saves them and the rest find them saved (a child refused or failed saved nothing, so the next one does).
  v_once_done := EXISTS (SELECT 1 FROM club_form_answers a WHERE a.submission_id = v_sub AND a.subject_id IS NULL);
  FOR v_a IN SELECT x FROM jsonb_array_elements(coalesce(p_form->'answers', '[]'::jsonb)) x
            UNION ALL SELECT jsonb_set(x, '{once}', 'true')
              FROM jsonb_array_elements(CASE WHEN v_once_done THEN '[]'::jsonb ELSE coalesce(p_form->'once', '[]'::jsonb) END) x LOOP
    SELECT q.id, q.question_type, q.asked INTO v_q FROM club_form_questions q
     WHERE q.id = (v_a->>'questionId')::uuid AND q.form_id = v_form AND q.archived_at IS NULL;
    IF NOT FOUND OR v_q.asked <> (CASE WHEN (v_a->>'once') = 'true' THEN 'once' ELSE 'per_subject' END) THEN
      RAISE EXCEPTION USING ERRCODE = 'CF001', MESSAGE = 'club_form_question_gone';
    END IF;
    v_file := nullif(v_a->>'fileId', '')::uuid;
    IF v_file IS NOT NULL THEN
      UPDATE club_form_files f SET status = 'attached', attached_at = now(), submission_id = v_sub,
             subject_table = CASE WHEN (v_a->>'once') = 'true' THEN NULL ELSE 'league_registrations' END,
             subject_id = CASE WHEN (v_a->>'once') = 'true' THEN NULL ELSE v_id END
       WHERE f.id = v_file AND f.form_id = v_form AND f.question_id = v_q.id AND f.status = 'pending';
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n <> 1 THEN RAISE EXCEPTION USING ERRCODE = 'CF003', MESSAGE = 'club_form_file_gone'; END IF;
    END IF;
    INSERT INTO club_form_answers (org_id, form_id, question_id, submission_id, subject_table, subject_id,
                                   value_text, value_choice_ids, value_bool, value_date, file_id)
    SELECT p_org, v_form, v_q.id, v_sub,
           CASE WHEN (v_a->>'once') = 'true' THEN NULL ELSE 'league_registrations' END,
           CASE WHEN (v_a->>'once') = 'true' THEN NULL ELSE v_id END,
           v.value_text, v.value_choice_ids, v.value_bool, v.value_date, v.file_id
      FROM club_form_answer_value(v_a) v
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- One tick per document, on the version the page showed (the route checked it is the current one).
  v_want := jsonb_array_length(coalesce(p_form->'ticks', '[]'::jsonb));
  IF v_want > 0 THEN
    INSERT INTO club_form_ticks (org_id, form_id, document_id, version_id, submission_id, subject_table, subject_id,
                                 guardian_email, sentence, fingerprint, handed_over_at, ticked_at)
    SELECT p_org, v_form, d.id, v.id, v_sub, 'league_registrations', v_id, v_email,
           t->>'sentence', v.fingerprint, nullif(t->>'handedOverAt', '')::timestamptz, v_at
      FROM jsonb_array_elements(p_form->'ticks') t
      JOIN club_form_documents d ON d.id = (t->>'documentId')::uuid AND d.form_id = v_form AND d.archived_at IS NULL
      JOIN club_form_document_versions v ON v.id = (t->>'versionId')::uuid AND v.document_id = d.id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n <> v_want THEN RAISE EXCEPTION USING ERRCODE = 'CF002', MESSAGE = 'club_form_document_gone'; END IF;
  END IF;

  RETURN QUERY SELECT v_id, v_status, v_pos, NULL::text;
END $$;
REVOKE ALL ON FUNCTION public.club_form_place_signup(uuid, uuid, uuid, jsonb, text, text, integer, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_form_place_signup(uuid, uuid, uuid, jsonb, text, text, integer, numeric, jsonb) TO service_role;

-- Your sign-up's Change: one child's answers (p_subject = its registration) or the sign-up's (p_subject NULL), together.
-- Each element: { questionId, clear?: true, text | choiceIds | bool | date | fileId }. Returns the stored paths of files
-- the change replaced or cleared (marked removed here; the server deletes the stored file at once).
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
    SELECT q.id, q.asked INTO v_q FROM club_form_questions q
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
      UPDATE club_form_files f SET status = 'removed', removed_at = now() WHERE f.id = v_old.file_id AND f.status <> 'removed';
      v_paths := v_paths || ARRAY(SELECT f.path FROM club_form_files f WHERE f.id = v_old.file_id);
    END IF;

    IF (v_a->>'clear') = 'true' THEN
      IF v_old.id IS NOT NULL THEN DELETE FROM club_form_answers a WHERE a.id = v_old.id; END IF;
      CONTINUE;
    END IF;

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

-- (3) What goes with a deleted registration (mig 513's trigger, widened). Part 2 adds answers asked ONCE per sign-up,
-- which belong to the sign-up, not to a child: when the last child of a sign-up is deleted, the sign-up's own answers and
-- files go too, then the sign-up row (it would otherwise keep a guardian's answers with no registration behind them).
-- The stored files of a deleted registration are removed by the route that deletes (carried to Part 3).
CREATE OR REPLACE FUNCTION public.club_form_subject_gone()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_sub uuid;
BEGIN
  DELETE FROM club_form_answers WHERE subject_table = TG_TABLE_NAME AND subject_id = OLD.id;
  DELETE FROM club_form_ticks WHERE subject_table = TG_TABLE_NAME AND subject_id = OLD.id;
  DELETE FROM club_form_files WHERE subject_table = TG_TABLE_NAME AND subject_id = OLD.id;
  SELECT s.id INTO v_sub FROM club_form_submissions s
   WHERE s.ref = coalesce(OLD.signup_ref, OLD.id::text)
     AND s.form_id IN (SELECT f.id FROM club_forms f WHERE f.owner_table = 'league_seasons' AND f.owner_id = OLD.season_id);
  IF v_sub IS NULL THEN RETURN OLD; END IF;
  -- No child of this sign-up is left: the sign-up's own answers and files go with the last one.
  IF NOT EXISTS (SELECT 1 FROM league_registrations r WHERE r.season_id = OLD.season_id AND r.id <> OLD.id
                   AND coalesce(r.signup_ref, r.id::text) = coalesce(OLD.signup_ref, OLD.id::text)) THEN
    DELETE FROM club_form_answers WHERE submission_id = v_sub AND subject_id IS NULL;
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

COMMIT;
