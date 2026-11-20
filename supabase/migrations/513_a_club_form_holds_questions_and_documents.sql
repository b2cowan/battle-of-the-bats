-- ---------------------------------------------------------------
-- Migration 513 — Board Ready Stage 4 Part 1 (the club's sign-up form, first used by house league; plan
-- docs/projects/active/BOARD_READY_PLAN.md §5 Stage 4, build prompt BOARD_READY_STAGE4_FORMS_BUILD_PROMPT.md Part 1;
-- drawings BOARD_READY_STAGE4_FORMS_DRAWINGS.html, all 20 asks ruled as recommended, owner 2026-11-20).
--
-- WHY: a club asks its own questions on a sign-up and asks families to read its documents (the waiver, a code of
-- conduct). Today a season has one typed waiver it can edit at any time, and the records keep only the text (finding F5).
--
-- WHAT CHANGES:
--   (1) club_forms — ONE FORM PER OWNER. The owner is named by table + id (a house-league season now; a camp, a
--       sponsorship package, a tryout later), as family_consents names its source. The data model never says "house
--       league". subject_kind decides whether "Asked" and the Health switch exist (drawing tab 9).
--   (2) club_form_questions — seven types, required (never a file), help text, choices with ids for life, Asked (each
--       child / once per sign-up), Health, Show on the draft board (never with Health), order, archived.
--   (3) club_form_documents + club_form_document_versions — a PDF or typed text; the tick kind; versions that keep their
--       ticks (a version with ticks can't be deleted: the tick's foreign key refuses it). A fingerprint (SHA-256, hex) of
--       the exact bytes or text.
--   (4) club_form_submissions — one row per sign-up a family sends (the family's reference), so a tick and a
--       once-per-sign-up answer can say which sign-up they came from.
--   (5) club_form_answers, club_form_ticks, club_form_files — what families give. A tick records the document, version,
--       fingerprint, the exact sentence, the subject (registration), the sign-up, the guardian, server time and, for a
--       PDF, the hand-over time. NO IP ADDRESS (ruling 18).
--   (6) storage bucket club-form-files (private, 8 MB, PDF / JPEG / PNG / HEIC). No storage policies.
--   (7) club_form_for_season(season, moved) — the season's form, made on first need. A season made with waiver text
--       gets it as its first document ("Waiver", typed text, "I have read and agree to the waiver.", version 1); every
--       registration already ticked gets a tick row BESIDE its record, marked moved, pointing at no version (F5:
--       nobody can prove which text was seen). waiver_accepted_at and family_consents are NEVER rewritten.
--   (8) THE WAIVER MOVE: the function, run once for every season (moved = true). Counts shown to the owner before it ran
--       (production 0 seasons; dev 7 seasons with text, 333 ticked; owner yes 2026-11-20).
--   (9) Deleting a registration takes its answers, ticks and files with it (F7 for this store; the stored file itself is
--       removed by the route that deletes); deleting a season takes its form.
--
-- SERVICE ROLE ONLY, every table: answers, ticks and files are read only through our server (the published Privacy
-- Policy's promise), and the form itself is read through the same routes.
--
-- Re-runnable (IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT; the move makes a form only where none exists).
-- check:migrations sees the tables; the bucket, the functions, the triggers and the move are invisible to it
-- (MANUAL_PROD_STEPS.json). Apply BEFORE promoting the code. ⚠ Promote Parts 1, 2 and 3 TOGETHER (owner ruling
-- 2026-11-20, call C1, on /legal's recommendation): Part 1 lets a club add a PDF, and only Part 2's sign-up page asks
-- families to open it before ticking; Part 2 lets a family answer a health question that only Part 3 lets the club read and
-- guards out of lists, the board, emails and exports.
-- Also: (10) club_form_counts / club_form_reorder / club_form_season_signups — the database counts and orders (no answer
-- and no guardian's email leaves it for the form page); the subject trigger also removes a sign-up left with nothing.
-- ---------------------------------------------------------------

BEGIN;

-- ─── 1 · Forms ──────────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.club_forms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_table   text NOT NULL CHECK (owner_table IN ('league_seasons')),
  owner_id      uuid NOT NULL,
  subject_kind  text NOT NULL CHECK (subject_kind IN ('child_signup', 'business')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_forms_owner_uniq UNIQUE (owner_table, owner_id)
);
CREATE INDEX IF NOT EXISTS club_forms_org_idx ON public.club_forms (org_id);

-- ─── 2 · Questions ──────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.club_form_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  form_id        uuid NOT NULL REFERENCES public.club_forms(id) ON DELETE CASCADE,
  question_type  text NOT NULL CHECK (question_type IN ('short_answer', 'long_answer', 'one_choice', 'many_choices', 'yes_no', 'date', 'file')),
  label          text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 200),
  help_text      text CHECK (help_text IS NULL OR char_length(help_text) BETWEEN 1 AND 500),
  choices        jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(choices) = 'array'),
  required       boolean NOT NULL DEFAULT false,
  asked          text NOT NULL DEFAULT 'per_subject' CHECK (asked IN ('per_subject', 'once')),
  health         boolean NOT NULL DEFAULT false,
  on_board       boolean NOT NULL DEFAULT false,
  sort_order     integer NOT NULL DEFAULT 0,
  archived_at    timestamptz,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_form_questions_file_not_required CHECK (NOT (question_type = 'file' AND required)),
  CONSTRAINT club_form_questions_health_not_on_board CHECK (NOT (health AND on_board))
);
CREATE INDEX IF NOT EXISTS club_form_questions_form_idx ON public.club_form_questions (form_id, sort_order);
CREATE INDEX IF NOT EXISTS club_form_questions_org_idx ON public.club_form_questions (org_id);
CREATE INDEX IF NOT EXISTS club_form_questions_created_by_idx ON public.club_form_questions (created_by) WHERE created_by IS NOT NULL;

-- ─── 3 · Documents and their versions ───────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.club_form_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  form_id      uuid NOT NULL REFERENCES public.club_forms(id) ON DELETE CASCADE,
  name         text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  source_kind  text NOT NULL CHECK (source_kind IN ('pdf', 'text')),
  tick_kind    text NOT NULL CHECK (tick_kind IN ('read', 'read_agree')),
  sort_order   integer NOT NULL DEFAULT 0,
  archived_at  timestamptz,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_form_documents_form_idx ON public.club_form_documents (form_id, sort_order);
CREATE INDEX IF NOT EXISTS club_form_documents_org_idx ON public.club_form_documents (org_id);
CREATE INDEX IF NOT EXISTS club_form_documents_created_by_idx ON public.club_form_documents (created_by) WHERE created_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.club_form_document_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id  uuid NOT NULL REFERENCES public.club_form_documents(id) ON DELETE CASCADE,
  version_no   integer NOT NULL CHECK (version_no >= 1),
  -- 100,000: room for a long waiver moved in from before (new text is capped at 20,000 by the routes).
  body_text    text CHECK (body_text IS NULL OR char_length(body_text) BETWEEN 1 AND 100000),
  file_path    text,
  file_name    text CHECK (file_name IS NULL OR char_length(file_name) BETWEEN 1 AND 200),
  file_size    integer CHECK (file_size IS NULL OR file_size BETWEEN 1 AND 8388608),
  fingerprint  text NOT NULL CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  reason       text CHECK (reason IS NULL OR char_length(reason) BETWEEN 1 AND 300),
  ticks_stand  boolean,
  moved_in     boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_form_document_versions_no_uniq UNIQUE (document_id, version_no),
  CONSTRAINT club_form_document_versions_one_source CHECK ((body_text IS NULL) <> (file_path IS NULL)),
  CONSTRAINT club_form_document_versions_file_named CHECK (file_path IS NULL OR (file_name IS NOT NULL AND file_size IS NOT NULL)),
  -- Version 1 answers no "what about the ticks before"; every later version does (ruling 8). Tick again needs a reason.
  CONSTRAINT club_form_document_versions_ticks_said CHECK ((version_no = 1) = (ticks_stand IS NULL)),
  CONSTRAINT club_form_document_versions_again_reason CHECK (ticks_stand IS DISTINCT FROM false OR reason IS NOT NULL)
);
-- Re-runnable widening of the text cap (dev was first made with 20,000; /review 2026-11-20: a longer waiver moved in
-- would fail every read of its season's form).
DO $$ BEGIN
  ALTER TABLE public.club_form_document_versions DROP CONSTRAINT IF EXISTS club_form_document_versions_body_text_check;
  ALTER TABLE public.club_form_document_versions
    ADD CONSTRAINT club_form_document_versions_body_text_check CHECK (body_text IS NULL OR char_length(body_text) BETWEEN 1 AND 100000);
END $$;
CREATE INDEX IF NOT EXISTS club_form_document_versions_org_idx ON public.club_form_document_versions (org_id);
CREATE INDEX IF NOT EXISTS club_form_document_versions_created_by_idx ON public.club_form_document_versions (created_by) WHERE created_by IS NOT NULL;

-- ─── 4 · Sign-ups ───────────────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.club_form_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  form_id         uuid NOT NULL REFERENCES public.club_forms(id) ON DELETE CASCADE,
  ref             text NOT NULL CHECK (char_length(ref) BETWEEN 1 AND 40),
  guardian_email  text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_form_submissions_ref_uniq UNIQUE (form_id, ref)
);
CREATE INDEX IF NOT EXISTS club_form_submissions_org_idx ON public.club_form_submissions (org_id);

-- ─── 5 · What families give ─────────────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.club_form_files (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  form_id        uuid NOT NULL REFERENCES public.club_forms(id) ON DELETE CASCADE,
  question_id    uuid NOT NULL REFERENCES public.club_form_questions(id),
  submission_id  uuid REFERENCES public.club_form_submissions(id) ON DELETE SET NULL,
  subject_table  text CHECK (subject_table IS NULL OR subject_table IN ('league_registrations')),
  subject_id     uuid,
  path           text NOT NULL UNIQUE,
  file_name      text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 200),
  size_bytes     integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 8388608),
  content_type   text NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif')),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attached', 'removed')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  attached_at    timestamptz,
  removed_at     timestamptz,
  CONSTRAINT club_form_files_subject_pair CHECK ((subject_table IS NULL) = (subject_id IS NULL))
);
CREATE INDEX IF NOT EXISTS club_form_files_org_idx ON public.club_form_files (org_id);
CREATE INDEX IF NOT EXISTS club_form_files_form_idx ON public.club_form_files (form_id);
CREATE INDEX IF NOT EXISTS club_form_files_question_idx ON public.club_form_files (question_id);
CREATE INDEX IF NOT EXISTS club_form_files_submission_idx ON public.club_form_files (submission_id) WHERE submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS club_form_files_subject_idx ON public.club_form_files (subject_table, subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS club_form_files_pending_idx ON public.club_form_files (created_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.club_form_answers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  form_id          uuid NOT NULL REFERENCES public.club_forms(id) ON DELETE CASCADE,
  -- No cascade: a question is deleted only while nobody has answered it; after that it is archived (ruling 7).
  question_id      uuid NOT NULL REFERENCES public.club_form_questions(id),
  submission_id    uuid REFERENCES public.club_form_submissions(id) ON DELETE CASCADE,
  subject_table    text CHECK (subject_table IS NULL OR subject_table IN ('league_registrations')),
  subject_id       uuid,
  value_text       text CHECK (value_text IS NULL OR char_length(value_text) <= 5000),
  value_choice_ids text[],
  value_bool       boolean,
  value_date       date,
  file_id          uuid REFERENCES public.club_form_files(id) ON DELETE SET NULL,
  removed_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_form_answers_subject_pair CHECK ((subject_table IS NULL) = (subject_id IS NULL)),
  -- An answer is about a child (its registration) or about the whole sign-up.
  CONSTRAINT club_form_answers_has_target CHECK (subject_id IS NOT NULL OR submission_id IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS club_form_answers_subject_uniq
  ON public.club_form_answers (question_id, subject_table, subject_id) WHERE subject_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS club_form_answers_submission_uniq
  ON public.club_form_answers (question_id, submission_id) WHERE subject_id IS NULL;
CREATE INDEX IF NOT EXISTS club_form_answers_org_idx ON public.club_form_answers (org_id);
CREATE INDEX IF NOT EXISTS club_form_answers_form_idx ON public.club_form_answers (form_id);
CREATE INDEX IF NOT EXISTS club_form_answers_subject_idx ON public.club_form_answers (subject_table, subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS club_form_answers_submission_idx ON public.club_form_answers (submission_id) WHERE submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS club_form_answers_file_idx ON public.club_form_answers (file_id) WHERE file_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.club_form_ticks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  form_id         uuid NOT NULL REFERENCES public.club_forms(id) ON DELETE CASCADE,
  -- No cascade on the document or the version: a version with ticks is never deleted (ruling 8).
  document_id     uuid NOT NULL REFERENCES public.club_form_documents(id),
  version_id      uuid REFERENCES public.club_form_document_versions(id),
  submission_id   uuid REFERENCES public.club_form_submissions(id) ON DELETE SET NULL,
  subject_table   text NOT NULL CHECK (subject_table IN ('league_registrations')),
  subject_id      uuid NOT NULL,
  guardian_email  text NOT NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sentence        text NOT NULL CHECK (char_length(sentence) BETWEEN 1 AND 300),
  fingerprint     text CHECK (fingerprint IS NULL OR fingerprint ~ '^[0-9a-f]{64}$'),
  handed_over_at  timestamptz,
  ticked_at       timestamptz NOT NULL DEFAULT now(),
  -- Recorded before documents had versions (the waiver move): no version, no fingerprint, no hand-over (F5).
  moved           boolean NOT NULL DEFAULT false,
  consent_id      uuid REFERENCES public.family_consents(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_form_ticks_versioned CHECK (moved OR (version_id IS NOT NULL AND fingerprint IS NOT NULL)),
  CONSTRAINT club_form_ticks_moved_bare CHECK (NOT moved OR (version_id IS NULL AND fingerprint IS NULL AND handed_over_at IS NULL))
);
CREATE INDEX IF NOT EXISTS club_form_ticks_org_idx ON public.club_form_ticks (org_id);
CREATE INDEX IF NOT EXISTS club_form_ticks_form_idx ON public.club_form_ticks (form_id);
CREATE INDEX IF NOT EXISTS club_form_ticks_document_idx ON public.club_form_ticks (document_id);
CREATE INDEX IF NOT EXISTS club_form_ticks_version_idx ON public.club_form_ticks (version_id) WHERE version_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS club_form_ticks_submission_idx ON public.club_form_ticks (submission_id) WHERE submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS club_form_ticks_subject_idx ON public.club_form_ticks (subject_table, subject_id);
CREATE INDEX IF NOT EXISTS club_form_ticks_consent_idx ON public.club_form_ticks (consent_id) WHERE consent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS club_form_ticks_user_idx ON public.club_form_ticks (user_id) WHERE user_id IS NOT NULL;

-- ─── Server only ────────────────────────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.club_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_form_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_form_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_form_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_form_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_form_ticks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.club_forms, public.club_form_questions, public.club_form_documents,
  public.club_form_document_versions, public.club_form_submissions, public.club_form_files, public.club_form_answers,
  public.club_form_ticks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_forms, public.club_form_questions, public.club_form_documents,
  public.club_form_document_versions, public.club_form_submissions, public.club_form_files, public.club_form_answers,
  public.club_form_ticks TO service_role;

-- ─── 6 · The bucket ─────────────────────────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-form-files', 'club-form-files', false, 8388608,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'])
on conflict (id) do nothing;
-- No storage policies: the server reads and writes it with the service role, and every link it hands out is signed for
-- one hour. Paths start with the club's id ({org}/{form}/…) so deleting the club finds them (lib/org-storage-purge.ts).

-- ─── 7 · A season's form, made on first need (and the waiver moved into it) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.club_form_for_season(p_season uuid, p_moved boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_form  uuid;
  v_org   uuid;
  v_text  text;
  v_doc   uuid;
  v_ticked boolean;
BEGIN
  SELECT id INTO v_form FROM club_forms WHERE owner_table = 'league_seasons' AND owner_id = p_season;
  IF v_form IS NOT NULL THEN RETURN v_form; END IF;

  -- Trimmed of every edge whitespace (spaces, tabs, line breaks), as the app trims text it stores.
  SELECT org_id, nullif(btrim(coalesce(waiver_text, ''), E' 	
'), '') INTO v_org, v_text FROM league_seasons WHERE id = p_season;
  IF v_org IS NULL THEN RETURN NULL; END IF;

  INSERT INTO club_forms (org_id, owner_table, owner_id, subject_kind)
  VALUES (v_org, 'league_seasons', p_season, 'child_signup')
  ON CONFLICT (owner_table, owner_id) DO NOTHING
  RETURNING id INTO v_form;
  -- Another request made it a moment ago: theirs is the form, and it already carries the waiver.
  IF v_form IS NULL THEN
    SELECT id INTO v_form FROM club_forms WHERE owner_table = 'league_seasons' AND owner_id = p_season;
    RETURN v_form;
  END IF;

  SELECT EXISTS (SELECT 1 FROM league_registrations WHERE season_id = p_season AND waiver_accepted_at IS NOT NULL) INTO v_ticked;
  IF v_text IS NULL AND NOT v_ticked THEN RETURN v_form; END IF;

  -- The waiver: today's text as version 1. A season whose waiver was emptied after families ticked keeps the document
  -- ARCHIVED with no version, so those ticks still have a home and the sign-up page asks nothing.
  INSERT INTO club_form_documents (org_id, form_id, name, source_kind, tick_kind, sort_order, archived_at)
  VALUES (v_org, v_form, 'Waiver', 'text', 'read_agree', 0, CASE WHEN v_text IS NULL THEN now() END)
  RETURNING id INTO v_doc;
  IF v_text IS NOT NULL THEN
    INSERT INTO club_form_document_versions (org_id, document_id, version_no, body_text, fingerprint, moved_in)
    VALUES (v_org, v_doc, 1, v_text, encode(sha256(convert_to(v_text, 'UTF8')), 'hex'), p_moved);
  END IF;

  -- Every tick already recorded gets a row BESIDE it: moved, no version, no fingerprint, the time it was ticked, and the
  -- consent record that holds the text the family saw, where one exists. Nothing on the registration or the ledger moves.
  INSERT INTO club_form_ticks (org_id, form_id, document_id, version_id, subject_table, subject_id, guardian_email,
                               sentence, ticked_at, moved, consent_id)
  SELECT r.org_id, v_form, v_doc, NULL, 'league_registrations', r.id, r.guardian_email,
         'I have read and agree to the waiver.', r.waiver_accepted_at, true,
         (SELECT fc.id FROM family_consents fc
           WHERE fc.basis = 'league_registration' AND fc.source_table = 'league_registrations' AND fc.source_id = r.id
           ORDER BY fc.basis_started_at LIMIT 1)
  FROM league_registrations r
  WHERE r.season_id = p_season AND r.waiver_accepted_at IS NOT NULL;

  RETURN v_form;
END $$;
REVOKE ALL ON FUNCTION public.club_form_for_season(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_form_for_season(uuid, boolean) TO service_role;

-- ─── 9 · What goes with a deleted registration or season ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.club_form_subject_gone()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM club_form_answers WHERE subject_table = TG_TABLE_NAME AND subject_id = OLD.id;
  DELETE FROM club_form_ticks WHERE subject_table = TG_TABLE_NAME AND subject_id = OLD.id;
  DELETE FROM club_form_files WHERE subject_table = TG_TABLE_NAME AND subject_id = OLD.id;
  -- A sign-up left with no answer, tick or file of its own holds only a guardian's email: it goes too (/legal 2026-11-20).
  DELETE FROM club_form_submissions s
   WHERE NOT EXISTS (SELECT 1 FROM club_form_ticks t WHERE t.submission_id = s.id)
     AND NOT EXISTS (SELECT 1 FROM club_form_answers a WHERE a.submission_id = s.id)
     AND NOT EXISTS (SELECT 1 FROM club_form_files f WHERE f.submission_id = s.id)
     AND s.ref = OLD.signup_ref
     AND s.form_id IN (SELECT f.id FROM club_forms f WHERE f.owner_table = 'league_seasons' AND f.owner_id = OLD.season_id);
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.club_form_subject_gone() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS club_form_subject_gone ON public.league_registrations;
CREATE TRIGGER club_form_subject_gone AFTER DELETE ON public.league_registrations
  FOR EACH ROW EXECUTE FUNCTION public.club_form_subject_gone();

CREATE OR REPLACE FUNCTION public.club_form_owner_gone()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM club_forms WHERE owner_table = TG_TABLE_NAME AND owner_id = OLD.id;
  RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.club_form_owner_gone() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS club_form_owner_gone ON public.league_seasons;
CREATE TRIGGER club_form_owner_gone AFTER DELETE ON public.league_seasons
  FOR EACH ROW EXECUTE FUNCTION public.club_form_owner_gone();

-- ─── 10 · Counts, an order, and a season's sign-up count — the database does the counting ─────────────────────────

-- Per question, the answers; per version, the ticks and the FAMILIES behind them; per document, the moved ticks. Counts
-- only: no answer and no guardian's email leaves the database for the form page (/simplify 2026-11-20).
CREATE OR REPLACE FUNCTION public.club_form_counts(p_form uuid)
RETURNS TABLE (kind text, id uuid, n integer, families integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT 'question', a.question_id, count(*)::int, NULL::int FROM club_form_answers a WHERE a.form_id = p_form GROUP BY a.question_id
  UNION ALL
  SELECT 'version', t.version_id, count(*)::int, count(DISTINCT t.guardian_email)::int
    FROM club_form_ticks t WHERE t.form_id = p_form AND NOT t.moved AND t.version_id IS NOT NULL GROUP BY t.version_id
  UNION ALL
  SELECT 'moved', t.document_id, count(*)::int, count(DISTINCT t.guardian_email)::int FROM club_form_ticks t WHERE t.form_id = p_form AND t.moved GROUP BY t.document_id;
$$;
REVOKE ALL ON FUNCTION public.club_form_counts(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_form_counts(uuid) TO service_role;

-- A new order for a form's questions or documents, in one statement. Ids not on this form are ignored; the caller checks
-- they all are first. Returns how many rows moved.
CREATE OR REPLACE FUNCTION public.club_form_reorder(p_form uuid, p_kind text, p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_n integer;
BEGIN
  IF p_kind = 'questions' THEN
    UPDATE club_form_questions q SET sort_order = o.ord - 1, updated_at = now()
      FROM unnest(p_ids) WITH ORDINALITY AS o(id, ord) WHERE q.id = o.id AND q.form_id = p_form;
  ELSIF p_kind = 'documents' THEN
    UPDATE club_form_documents d SET sort_order = o.ord - 1, updated_at = now()
      FROM unnest(p_ids) WITH ORDINALITY AS o(id, ord) WHERE d.id = o.id AND d.form_id = p_form;
  ELSE
    RAISE EXCEPTION 'club_form_reorder: kind %', p_kind;
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.club_form_reorder(uuid, text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_form_reorder(uuid, text, uuid[]) TO service_role;

-- How many children and how many sign-ups a question added now would read "Not asked" on (drawing tab 2's foot).
-- Declined and withdrawn sign-ups aren't counted.
CREATE OR REPLACE FUNCTION public.club_form_season_signups(p_season uuid)
RETURNS TABLE (children integer, signups integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT count(*)::int, count(DISTINCT coalesce(signup_ref, id::text))::int
    FROM league_registrations WHERE season_id = p_season AND status NOT IN ('declined', 'withdrawn');
$$;
REVOKE ALL ON FUNCTION public.club_form_season_signups(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_form_season_signups(uuid) TO service_role;

-- ─── 8 · The waiver move: every season, once ────────────────────────────────────────────────────────────────────────

SELECT public.club_form_for_season(s.id, true) FROM public.league_seasons s
WHERE NOT EXISTS (SELECT 1 FROM public.club_forms f WHERE f.owner_table = 'league_seasons' AND f.owner_id = s.id);

COMMIT;
