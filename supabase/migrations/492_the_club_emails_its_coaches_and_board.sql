-- 492_the_club_emails_its_coaches_and_board.sql
--
-- Club Communications Stage 1, Session 1 (docs/projects/active/CLUB_COMMUNICATIONS_STAGE1_BUILD_PROMPT.md; plan
-- CLUB_COMMUNICATIONS_PLAN.md §1 incl. R1–R4 2026-11-17 and §8 the retention ruling; legal spec
-- docs/agents/legal/CLUB_COMMUNICATIONS_STAGE1.md "Build-prompt checklist 2026-11-16" + "Addendum 2026-11-17").
--
-- The club's email to its COACHES and its BOARD (colleague mail): a send log, its words kept apart, and who it went to.
--   (1) club_group_email_sends — one row per send: who pressed Send (account id, and their name and seat AS SENT), the kind
--       (coaches | board), the group (an open-ended slug: Stage 3 adds a value, never a rewire), its words for the list, its
--       parameters, where replies went (the club or the sender, R2), the club-inbox copy's outcome (R4), the counts, the status.
--       ⚠ NO address anywhere: not the sender's, not the club's contact, not a recipient's (legal §2d).
--   (2) club_group_email_bodies — the subject and the message, ONE row per send, so the retention clock can delete the words
--       and keep the who-and-when (legal §2d "separable body"; T19).
--   (3) club_group_email_recipients — one row per person it went to: the id of the SOURCE row (an account, or a house-league
--       coach row for a coach with no account), the name and the team line or board seat AS SENT, why they got it, and a
--       status. NO email column, and a CHECK that a name never holds an '@' (T17/T18: a nameless person is "A coach").
--   (4) family_email_sends gains reply_to (R2/R3; default 'sender' = the shipped behaviour), club_copy (R4), and the two
--       clock marks; subject and body become nullable so the clock can blank them in place (their length CHECKs stay).
--   (5) club_group_email_claim(): the just-sent check (60 seconds, the family send's length; NO daily allowance, coach ask 12)
--       and the insert of the send AND its words, in one transaction under an advisory lock.
--   (6) club_email_retention_sweep(): the clock the owner ruled 2026-11-17 — words deleted 12 months after the send, the list of
--       who it reached 24 months after; the sender, date, group and counts kept while the organization exists. Covers the new
--       tables AND family_email_sends / family_email_recipients. Scheduled nightly by mig 493 (watched automation, own commit).
--
-- Additive. RLS on with NO policies; anon/authenticated revoked; service_role only (the app reads through its server routes).
-- Requires 347/348/385 (family_email_sends, family_email_recipients). ORDER ON PRODUCTION: apply BEFORE the promote that ships
-- the Session 1 code (its routes write these tables; the family send writes reply_to). Then 493. Idempotent. /dba read
-- 2026-11-17 before apply: renumbered from 491 (taken), partial "due" indexes for the clock, bodies org index, sender_role CHECK.

BEGIN;

-- ─── 1 · the send log ────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_group_email_sends (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind              text NOT NULL CHECK (kind IN ('coaches', 'board')),
  group_kind        text NOT NULL CHECK (char_length(group_kind) BETWEEN 1 AND 40),
  group_key         text NOT NULL CHECK (char_length(group_key) BETWEEN 1 AND 200),
  group_label       text NOT NULL CHECK (char_length(group_label) BETWEEN 1 AND 500),
  group_params      jsonb NOT NULL DEFAULT '{}'::jsonb,
  reaches_rep       boolean NOT NULL DEFAULT false,
  reaches_house_league boolean NOT NULL DEFAULT false,
  sent_by           uuid,
  sender_name       text CHECK (sender_name IS NULL OR (char_length(sender_name) BETWEEN 1 AND 200 AND position('@' in sender_name) = 0)),
  sender_role       text CHECK (sender_role IS NULL OR sender_role IN ('owner', 'admin', 'league_admin', 'league_registrar', 'treasurer')),
  reply_to          text NOT NULL CHECK (reply_to IN ('club', 'sender')),
  club_copy         text CHECK (club_copy IN ('asked', 'sent', 'failed', 'already_listed')),
  sent_at           timestamptz NOT NULL DEFAULT now(),
  retried_at        timestamptz,
  recipient_count   integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  left_out_count    integer NOT NULL DEFAULT 0 CHECK (left_out_count >= 0),
  reached_count     integer NOT NULL DEFAULT 0 CHECK (reached_count >= 0),
  failed_count      integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  status            text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'done')),
  words_cleared_at  timestamptz,
  names_cleared_at  timestamptz
);

CREATE INDEX IF NOT EXISTS club_group_email_sends_org_sent_idx ON public.club_group_email_sends (org_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS club_group_email_sends_group_idx ON public.club_group_email_sends (org_id, kind, group_key, sent_at DESC);
-- The clock's own scans (every org): only the sends not yet swept, by age, so a swept row is never re-read.
CREATE INDEX IF NOT EXISTS club_group_email_sends_words_due_idx ON public.club_group_email_sends (sent_at) WHERE words_cleared_at IS NULL;
CREATE INDEX IF NOT EXISTS club_group_email_sends_names_due_idx ON public.club_group_email_sends (sent_at) WHERE names_cleared_at IS NULL;

ALTER TABLE public.club_group_email_sends ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.club_group_email_sends FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_group_email_sends TO service_role;

COMMENT ON TABLE public.club_group_email_sends IS
  'Club Communications Stage 1: one row per club email to its coaches or its board (colleague mail). Who pressed Send, the group, '
  'where replies went, the counts. Never an address. The words live in club_group_email_bodies (deleted 12 months after the send); '
  'who it went to in club_group_email_recipients (deleted 24 months after). A row still sending 15 minutes after sent_at (or '
  'retried_at) is read as stopped.';
COMMENT ON COLUMN public.club_group_email_sends.group_kind IS
  'The group, open-ended (Stage 3 adds values): coaches_all, rep_staff, rep_head, league_season, league_division, coaches_picked, board_all, board_picked.';
COMMENT ON COLUMN public.club_group_email_sends.group_key IS 'The group with its parameters as one string (e.g. league_division:<uuid>); the just-sent check compares it.';
COMMENT ON COLUMN public.club_group_email_sends.reaches_rep IS 'It went to at least one rep team staff member. A league admin or registrar never reads a pick or a rep group that did (an All coaches row they do, with rep names withheld).';
COMMENT ON COLUMN public.club_group_email_sends.sender_name IS 'The sender''s name as it was at the send (R1: a sender with no name is refused). Never an address.';
COMMENT ON COLUMN public.club_group_email_sends.sender_role IS 'The sender''s seat at the send (owner, admin, league_admin, league_registrar, treasurer).';
COMMENT ON COLUMN public.club_group_email_sends.reply_to IS 'R2: club = replies went to the club''s public contact and the email named the club; sender = to the sender''s own address. One mode for every message of the send.';
COMMENT ON COLUMN public.club_group_email_sends.club_copy IS 'R4: NULL = no copy asked; asked → sent | failed | already_listed (the club''s contact was a recipient). Never the address.';
COMMENT ON COLUMN public.club_group_email_sends.left_out_count IS 'People in the group who could not be sent to (an invitation not accepted, no address on file). A count only, never their names.';
COMMENT ON COLUMN public.club_group_email_sends.words_cleared_at IS 'When the retention clock deleted the subject and message (12 months after the send).';
COMMENT ON COLUMN public.club_group_email_sends.names_cleared_at IS 'When the retention clock deleted the list of who it went to (24 months after the send).';

-- ─── 2 · the words, stored apart ────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_group_email_bodies (
  send_id     uuid PRIMARY KEY REFERENCES public.club_group_email_sends(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  subject     text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_group_email_bodies_org_idx ON public.club_group_email_bodies (org_id);

ALTER TABLE public.club_group_email_bodies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.club_group_email_bodies FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_group_email_bodies TO service_role;

COMMENT ON TABLE public.club_group_email_bodies IS
  'The subject and message of a club_group_email_sends row, kept apart so the retention clock deletes the words (12 months after '
  'the send) and keeps the who-and-when. No row = the words are gone: Send to the ones it missed is refused.';

-- ─── 3 · who it went to ─────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_group_email_recipients (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id          uuid NOT NULL REFERENCES public.club_group_email_sends(id) ON DELETE CASCADE,
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          uuid,
  league_coach_id  uuid,
  name             text CHECK (name IS NULL OR (char_length(name) BETWEEN 1 AND 200 AND position('@' in name) = 0)),
  line             text CHECK (line IS NULL OR (char_length(line) BETWEEN 1 AND 300 AND position('@' in line) = 0)),
  basis            text NOT NULL CHECK (basis IN ('rep_staff', 'house_league', 'picked', 'board')),
  board_role       text CHECK (board_role IN ('owner', 'admin', 'league_admin', 'league_registrar', 'treasurer')),
  rep              boolean NOT NULL DEFAULT false,
  house_league     boolean NOT NULL DEFAULT false,
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT club_group_email_recipients_source CHECK (user_id IS NOT NULL OR league_coach_id IS NOT NULL),
  CONSTRAINT club_group_email_recipients_board_role CHECK ((basis = 'board') = (board_role IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS club_group_email_recipients_send_idx ON public.club_group_email_recipients (send_id, status);
CREATE INDEX IF NOT EXISTS club_group_email_recipients_user_idx ON public.club_group_email_recipients (user_id, send_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS club_group_email_recipients_org_idx ON public.club_group_email_recipients (org_id);

ALTER TABLE public.club_group_email_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.club_group_email_recipients FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_group_email_recipients TO service_role;

COMMENT ON TABLE public.club_group_email_recipients IS
  'Who a club coach or board email went to, one row per person, AS SENT: the source row''s id (account, or a house-league coach '
  'row), the name, the team line or board seat, why, and whether the mail service accepted it. NO address column: a resend reads '
  'the address from the source row at that moment. Deleted 24 months after the send.';
COMMENT ON COLUMN public.club_group_email_recipients.user_id IS 'The account (rep staff, a board seat, a house-league coach with an account). Not FK-checked: a record of a send. The board read rule reads it (a recipient may read their board email).';
COMMENT ON COLUMN public.club_group_email_recipients.league_coach_id IS 'The league_team_coaches row of a house-league coach with no account. Not FK-checked.';
COMMENT ON COLUMN public.club_group_email_recipients.name IS 'The name as it was at the send, or NULL (read as "A coach" / "A board member (treasurer)"). Never an address (CHECK).';
COMMENT ON COLUMN public.club_group_email_recipients.line IS 'The team line ("15U AAA · Head coach", "House league · Reds, U9 Rookie") or the board seat ("Treasurer"), as at the send.';
COMMENT ON COLUMN public.club_group_email_recipients.basis IS 'Why they got it, from their own role (legal C8): rep_staff, house_league, picked, board. Drives the reason line.';
COMMENT ON COLUMN public.club_group_email_recipients.house_league IS 'A house-league coach (also when their basis is rep_staff). A league admin or registrar sees these named; every other recipient is counted.';
COMMENT ON COLUMN public.club_group_email_recipients.status IS 'pending until tried; sent = the mail service accepted it (not a read receipt); failed.';

-- ─── 4 · the family log: where replies went, the inbox copy, the clock ──────────────────────────────────────────────────
ALTER TABLE public.family_email_sends ADD COLUMN IF NOT EXISTS reply_to text NOT NULL DEFAULT 'sender';
ALTER TABLE public.family_email_sends DROP CONSTRAINT IF EXISTS family_email_sends_reply_to_check;
ALTER TABLE public.family_email_sends ADD CONSTRAINT family_email_sends_reply_to_check CHECK (reply_to IN ('club', 'sender'));
ALTER TABLE public.family_email_sends ADD COLUMN IF NOT EXISTS club_copy text;
ALTER TABLE public.family_email_sends DROP CONSTRAINT IF EXISTS family_email_sends_club_copy_check;
ALTER TABLE public.family_email_sends ADD CONSTRAINT family_email_sends_club_copy_check CHECK (club_copy IN ('asked', 'sent', 'failed', 'already_listed'));
ALTER TABLE public.family_email_sends ADD COLUMN IF NOT EXISTS words_cleared_at timestamptz;
ALTER TABLE public.family_email_sends ADD COLUMN IF NOT EXISTS names_cleared_at timestamptz;
-- The clock blanks the words in place; the length CHECKs still hold for any words present.
ALTER TABLE public.family_email_sends ALTER COLUMN subject DROP NOT NULL;
ALTER TABLE public.family_email_sends ALTER COLUMN body DROP NOT NULL;
CREATE INDEX IF NOT EXISTS family_email_sends_words_due_idx ON public.family_email_sends (sent_at) WHERE words_cleared_at IS NULL;
CREATE INDEX IF NOT EXISTS family_email_sends_names_due_idx ON public.family_email_sends (sent_at) WHERE names_cleared_at IS NULL;

COMMENT ON COLUMN public.family_email_sends.reply_to IS 'R2/R3 (2026-11-17): club = replies went to the club''s public contact and every message of the send named the club; sender = the sender''s own address (the shipped behaviour, the default).';
COMMENT ON COLUMN public.family_email_sends.club_copy IS 'R4: NULL = no copy asked; asked → sent | failed | already_listed. The copy is colleague-built (never the family envelope). Never the address.';
COMMENT ON COLUMN public.family_email_sends.words_cleared_at IS 'When the retention clock blanked subject and body (12 months after the send). Send to the ones it missed is refused after.';
COMMENT ON COLUMN public.family_email_sends.names_cleared_at IS 'When the retention clock deleted the send''s family_email_recipients rows (24 months after the send).';

-- ─── 5 · the claim: the just-sent check and the insert (the send, its words AND its people), in one step ─────────────────
-- /review 2026-11-17: the people are written in the same transaction, so no crash or lost reply can leave a send with no one
-- in it. The first draft's 17-argument form (applied to dev only, never prod) is dropped so only this one exists.
DROP FUNCTION IF EXISTS public.club_group_email_claim(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text, text, boolean, text, text, integer, integer);
CREATE OR REPLACE FUNCTION public.club_group_email_claim(
  p_org uuid, p_actor uuid, p_kind text, p_group_kind text, p_group_key text, p_label text, p_params jsonb,
  p_reaches_rep boolean, p_reaches_house_league boolean, p_sender_name text, p_sender_role text, p_reply_to text,
  p_club_copy boolean, p_subject text, p_body text, p_recipients jsonb, p_left_out_count integer
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_last timestamptz;
  v_id   uuid;
BEGIN
  -- One press at a time per club and kind: two presses on the same group serialize here.
  PERFORM pg_advisory_xact_lock(hashtextextended('club_group_email:' || p_org::text || ':' || p_kind, 0));
  -- Just sent: the same group within the family send's 60 seconds. No daily allowance (coach ask 12, legal §2a.10).
  SELECT max(sent_at) INTO v_last FROM club_group_email_sends
   WHERE org_id = p_org AND kind = p_kind AND group_key = p_group_key;
  IF v_last IS NOT NULL AND v_last > now() - interval '60 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'just_sent');
  END IF;
  INSERT INTO club_group_email_sends (org_id, kind, group_kind, group_key, group_label, group_params, reaches_rep,
    reaches_house_league, sent_by, sender_name, sender_role, reply_to, club_copy, recipient_count, left_out_count)
  VALUES (p_org, p_kind, p_group_kind, p_group_key, p_label, coalesce(p_params, '{}'::jsonb), p_reaches_rep,
    p_reaches_house_league, p_actor, p_sender_name, p_sender_role, p_reply_to, CASE WHEN p_club_copy THEN 'asked' END,
    jsonb_array_length(coalesce(p_recipients, '[]'::jsonb)), p_left_out_count)
  RETURNING id INTO v_id;
  INSERT INTO club_group_email_bodies (send_id, org_id, subject, body) VALUES (v_id, p_org, p_subject, p_body);
  -- Who it goes to, recorded with the send (a stopped send reads whom it missed from these). Never an address: the
  -- recordset names only the columns the table has, and the table has no address column.
  INSERT INTO club_group_email_recipients (id, send_id, org_id, user_id, league_coach_id, name, line, basis, board_role, rep, house_league)
  SELECT r.id, v_id, p_org, r.user_id, r.league_coach_id, r.name, r.line, r.basis, r.board_role, coalesce(r.rep, false), coalesce(r.house_league, false)
    FROM jsonb_to_recordset(coalesce(p_recipients, '[]'::jsonb))
      AS r(id uuid, user_id uuid, league_coach_id uuid, name text, line text, basis text, board_role text, rep boolean, house_league boolean);
  RETURN jsonb_build_object('ok', true, 'sendId', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.club_group_email_claim(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text, text, boolean, text, text, jsonb, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_group_email_claim(uuid, uuid, text, text, text, text, jsonb, boolean, boolean, text, text, text, boolean, text, text, jsonb, integer) TO service_role;

-- ─── 6 · the retention clock (owner 2026-11-17: words 12 months, names 24 months) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.club_email_retention_sweep() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_words_cut timestamptz := now() - interval '12 months';
  v_names_cut timestamptz := now() - interval '24 months';
  v_cw integer; v_cn integer; v_fw integer; v_fn integer;
BEGIN
  -- Coach and board email: delete the words, mark the send.
  WITH due AS (
    SELECT id FROM club_group_email_sends WHERE sent_at < v_words_cut AND words_cleared_at IS NULL
  ), gone AS (
    DELETE FROM club_group_email_bodies b USING due WHERE b.send_id = due.id RETURNING 1
  ), marked AS (
    UPDATE club_group_email_sends s SET words_cleared_at = now() FROM due WHERE s.id = due.id RETURNING 1
  )
  SELECT count(*) INTO v_cw FROM marked;

  -- Coach and board email: delete who it went to (the counts stay on the send).
  WITH due AS (
    SELECT id FROM club_group_email_sends WHERE sent_at < v_names_cut AND names_cleared_at IS NULL
  ), gone AS (
    DELETE FROM club_group_email_recipients r USING due WHERE r.send_id = due.id RETURNING 1
  ), marked AS (
    UPDATE club_group_email_sends s SET names_cleared_at = now() FROM due WHERE s.id = due.id RETURNING 1
  )
  SELECT count(*) INTO v_cn FROM marked;

  -- Family email: blank the words in place.
  WITH marked AS (
    UPDATE family_email_sends SET subject = NULL, body = NULL, words_cleared_at = now()
     WHERE sent_at < v_words_cut AND words_cleared_at IS NULL RETURNING 1
  )
  SELECT count(*) INTO v_fw FROM marked;

  -- Family email: delete who it went to (family names and person ids); the counts stay on the send.
  WITH due AS (
    SELECT id FROM family_email_sends WHERE sent_at < v_names_cut AND names_cleared_at IS NULL
  ), gone AS (
    DELETE FROM family_email_recipients r USING due WHERE r.send_id = due.id RETURNING 1
  ), marked AS (
    UPDATE family_email_sends s SET names_cleared_at = now() FROM due WHERE s.id = due.id RETURNING 1
  )
  SELECT count(*) INTO v_fn FROM marked;

  RETURN jsonb_build_object('club_words', v_cw, 'club_names', v_cn, 'family_words', v_fw, 'family_names', v_fn);
END;
$$;

REVOKE ALL ON FUNCTION public.club_email_retention_sweep() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_email_retention_sweep() TO service_role;

COMMIT;

-- Verify (dev and prod):
--   SELECT to_regclass('public.club_group_email_sends'), to_regclass('public.club_group_email_bodies'),
--          to_regclass('public.club_group_email_recipients');                                              -- all not null
--   SELECT count(*) FROM information_schema.columns WHERE table_name = 'club_group_email_recipients'
--      AND column_name ILIKE '%email%';                                                                     -- 0
--   SELECT count(*) FROM information_schema.columns WHERE table_name = 'family_email_sends'
--      AND column_name IN ('reply_to','club_copy','words_cleared_at','names_cleared_at');                  -- 4
--   SELECT count(*) FROM pg_proc WHERE proname IN ('club_group_email_claim','club_email_retention_sweep'); -- 2
--   SELECT public.club_email_retention_sweep();   -- a jsonb of four counts (0s on a log younger than 12 months)
