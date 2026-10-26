-- ---------------------------------------------------------------
-- Migration 385 — Club Tier Stage 9d-1: a house-league season emails its families through the club's one engine
-- (owner rulings 9d1·1–12, 2026-10-26, plan HOUSE_LEAGUE_STAGE9_PLAN.md §0g; build prompt
-- docs/projects/active/HOUSE_LEAGUE_STAGE9D1_BUILD_PROMPT.md, arguments 2–5)
--
-- WHY: a season had its own composer that mailed one email per child and kept its own log (league_email_log). 9d-1
-- sends a season's email through Families' engine — households once, batches, the unsubscribe list — and gives each
-- season its OWN three emails in any 24 hours.
--
-- WHAT CHANGES:
--   (1) family_email_sends — the season's audiences join the kinds (season_divisions, season_teams, season_statuses,
--       season_families; 'season' stays "everyone in the season"), a season kind must name its season, and retried_at
--       marks "Send to the N it missed" on a stopped send (9d1·10: the same row, never a new claim, never counted).
--   (2) family_email_claim — counts and guards BY BUCKET (argument 2): a row with a season_id counts toward that
--       season, from either door (9d1·6); a row without counts toward the club. The 60-second double-press guard looks
--       at the same bucket, so a convenor and a club admin a few seconds apart no longer refuse each other. The lock
--       stays per club. Same signature, same cap (v_cap = CLUB_EMAIL_CAP, one number for the club and every season).
--   (3) family_email_recipients — each family a send was going to and how it went (argument 3), written before the
--       first batch and as each batch returns, so a stopped send knows whom it missed. ⚖ This supersedes 7c's "never a
--       list of families" (owner 2026-10-22) for an email's own record: the 9d-1 drawings, ruled 2026-10-26, name the
--       families an email missed and those who opted out. It keeps the family's PEOPLE and last name, never addresses:
--       a resend goes to each family's address as it is then.
--   (4) league_season_notices — one row per automatic notice to many families (argument 4): Publish teams now, 9d-2's
--       schedule notices later. league_division_publish writes it in its transaction and stamps the act's
--       league_placement_emails rows with it; the app updates its reached/failed counts as the emails go. Never counted
--       toward any allowance, and never in family_email_sends (9d1·7: that is the book of typed emails).
--   (5) family_messages.season_id — a one-family message sent from a season's door names the season (argument 5),
--       so the season's history lists "A message to this family". Still no words, still the family's own three.
--
-- league_email_log is NOT touched: it is read-only history from here (9d1·3); nothing writes it again.
--
-- INVISIBLE to the drift check: the two functions (declared in MANUAL_PROD_STEPS.json with prosrc checks). Safe to run
-- twice. Requires 347, 348 (family_email_sends), 334 (family_messages), 377 (league_placement_emails). Prod: in the
-- promote that ships 9d-1's code.
-- ---------------------------------------------------------------

BEGIN;

-- ─── 1 · family_email_sends: the season's audiences, the season named, the resend's mark ─────────────────────────────

ALTER TABLE public.family_email_sends DROP CONSTRAINT IF EXISTS family_email_sends_audience_kind_check;
ALTER TABLE public.family_email_sends
  ADD CONSTRAINT family_email_sends_audience_kind_check CHECK (audience_kind IN (
    'every', 'teams', 'season', 'list',
    'season_divisions', 'season_teams', 'season_statuses', 'season_families'));

ALTER TABLE public.family_email_sends DROP CONSTRAINT IF EXISTS family_email_sends_season_kind_names_season;
ALTER TABLE public.family_email_sends
  ADD CONSTRAINT family_email_sends_season_kind_names_season
  CHECK (audience_kind NOT LIKE 'season%' OR season_id IS NOT NULL);

ALTER TABLE public.family_email_sends ADD COLUMN IF NOT EXISTS retried_at timestamptz;

CREATE INDEX IF NOT EXISTS family_email_sends_season_sent_idx
  ON public.family_email_sends (season_id, sent_at DESC) WHERE season_id IS NOT NULL;

COMMENT ON COLUMN public.family_email_sends.audience_kind IS
  'every = every family with a child on a live team or in an open season; teams = the families of the rep teams in team_ids; '
  'list = a Families list (audience_label names it); season = everyone in the house-league season season_id (families with an '
  'active child); season_divisions / season_teams / season_statuses = part of that season (audience_label names which; '
  'season_teams also keeps team_ids, the league teams); season_families = the families ticked on Registrations (Stage 9d-1).';
COMMENT ON COLUMN public.family_email_sends.season_id IS
  'The house-league season the email went to (every season kind, from the season''s door or Families). Not FK-checked: a '
  'record of an email, kept when a season is deleted. ⚖ Its BUCKET (9d-1): a row with a season counts toward that season''s '
  'three in any 24 hours, a row without toward the club''s (family_email_claim).';
COMMENT ON COLUMN public.family_email_sends.retried_at IS
  'When "Send to the N it missed" began on this stopped email (9d1·10): the same row, the same words, never a new claim and '
  'never counted. Null when it was never resent.';

-- ─── 2 · The claim, by bucket ────────────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.family_email_claim(
  p_org uuid, p_actor uuid, p_subject text, p_body text, p_kind text, p_label text,
  p_team_ids uuid[], p_season_id uuid, p_family_count integer, p_opted_out_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cap   constant integer := 3;   -- ⚠ CLUB_EMAIL_CAP in lib/families-words.ts says the same number on screen
  v_last  timestamptz;
  v_count integer;
  v_next  timestamptz;
  v_id    uuid;
BEGIN
  -- One club's emails serialize here (every bucket): the second of two presses waits, then sees the first.
  PERFORM pg_advisory_xact_lock(hashtextextended('family_email:' || p_org::text, 0));

  -- The bucket: this season's emails, or the club's (no season). `IS NOT DISTINCT FROM` makes null match null.
  SELECT max(sent_at) INTO v_last FROM family_email_sends
   WHERE org_id = p_org AND season_id IS NOT DISTINCT FROM p_season_id;
  IF v_last IS NOT NULL AND v_last > now() - interval '60 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'just_sent');
  END IF;

  SELECT count(*) INTO v_count FROM family_email_sends
   WHERE org_id = p_org AND season_id IS NOT DISTINCT FROM p_season_id AND sent_at > now() - interval '24 hours';
  IF v_count >= v_cap THEN
    -- The next email can go when the oldest one that still counts turns 24 hours old.
    SELECT sent_at + interval '24 hours' INTO v_next FROM family_email_sends
     WHERE org_id = p_org AND season_id IS NOT DISTINCT FROM p_season_id AND sent_at > now() - interval '24 hours'
     ORDER BY sent_at
     OFFSET (v_count - v_cap) LIMIT 1;
    RETURN jsonb_build_object('ok', false, 'code', 'cap', 'nextAt', v_next);
  END IF;

  INSERT INTO family_email_sends (org_id, sent_by, subject, body, audience_kind, audience_label, team_ids, season_id,
                                  family_count, opted_out_count)
  VALUES (p_org, p_actor, p_subject, p_body, p_kind, p_label, coalesce(p_team_ids, '{}'), p_season_id,
          greatest(coalesce(p_family_count, 0), 0), greatest(coalesce(p_opted_out_count, 0), 0))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'sendId', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.family_email_claim(uuid, uuid, text, text, text, text, uuid[], uuid, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_email_claim(uuid, uuid, text, text, text, text, uuid[], uuid, integer, integer) TO service_role;

-- ─── 3 · Each family an email was going to ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.family_email_recipients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id      uuid NOT NULL REFERENCES public.family_email_sends(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- The household's people (org_people ids), sorted: the family the audience counted once.
  person_ids   uuid[] NOT NULL CHECK (cardinality(person_ids) > 0),
  -- The name the family is called by ("Kim" → "the Kim family"); null when none is known.
  family_name  text CHECK (family_name IS NULL OR char_length(family_name) <= 200),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'opted_out')),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS family_email_recipients_send_idx ON public.family_email_recipients (send_id, status);
CREATE INDEX IF NOT EXISTS family_email_recipients_org_idx ON public.family_email_recipients (org_id);

ALTER TABLE public.family_email_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.family_email_recipients FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_email_recipients TO service_role;

COMMENT ON TABLE public.family_email_recipients IS
  'Club Tier Stage 9d-1 (argument 3): one row per family an Email families email was going to — its people, its last name '
  'and how it went. Written before the first batch (pending, or opted_out) and as each batch returns (sent / failed), so a '
  'stopped email knows whom it missed (9d1·10) and its window names the families missed or opted out. Never addresses. '
  'Server only.';
COMMENT ON COLUMN public.family_email_recipients.status IS
  'pending = not tried yet (a stopped email''s missed families); sent = the mail service accepted at least one address; '
  'failed = it accepted none; opted_out = every address had opted out of club email, so none was tried.';

-- ─── 4 · An automatic notice to many families ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.league_season_notices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  season_id      uuid NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  division_id    uuid REFERENCES public.league_divisions(id) ON DELETE SET NULL,
  -- teams_published: Publish teams (9c). 9d-2's schedule notices add their kinds here.
  kind           text NOT NULL CHECK (kind IN ('teams_published')),
  family_count   integer NOT NULL DEFAULT 0 CHECK (family_count >= 0),
  reached_count  integer NOT NULL DEFAULT 0 CHECK (reached_count >= 0),
  failed_count   integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS league_season_notices_season_idx ON public.league_season_notices (season_id, created_at DESC);
CREATE INDEX IF NOT EXISTS league_season_notices_org_idx ON public.league_season_notices (org_id);
CREATE INDEX IF NOT EXISTS league_season_notices_division_idx ON public.league_season_notices (division_id);

ALTER TABLE public.league_season_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.league_season_notices FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.league_season_notices TO service_role;

COMMENT ON TABLE public.league_season_notices IS
  'Club Tier Stage 9d-1 (9d1·4, argument 4): one row per automatic notice the product sent many families of a house-league '
  'season at once — Publish teams now, 9d-2''s schedule notices later. The season''s Email families history lists it, '
  'tagged Automatic. Never counted toward any allowance; never in family_email_sends. Its counts follow its emails.';

ALTER TABLE public.league_placement_emails
  ADD COLUMN IF NOT EXISTS notice_id uuid REFERENCES public.league_season_notices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS league_placement_emails_notice_idx
  ON public.league_placement_emails (notice_id) WHERE notice_id IS NOT NULL;
COMMENT ON COLUMN public.league_placement_emails.notice_id IS
  'The Publish this email belongs to (league_season_notices, 9d-1). Null for a late placement or a move: one family each, '
  'off the season''s history (9d1·4).';

-- Publish teams writes its notice in the same transaction and stamps its family emails with it. Unchanged otherwise
-- (mig 377 §11).
CREATE OR REPLACE FUNCTION public.league_division_publish(
  p_org uuid, p_season uuid, p_division uuid, p_actor uuid, p_fingerprint text, p_coaches uuid[], p_hashes text[]
) RETURNS TABLE (refusal text, published_at timestamptz, published_by uuid, families integer, invited uuid[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_div league_divisions%ROWTYPE; v_status text; v_families integer; v_invited uuid[]; v_now timestamptz := now();
        v_notice uuid; v_rows uuid[];
BEGIN
  SELECT s.status INTO v_status FROM league_seasons s WHERE s.id = p_season AND s.org_id = p_org FOR NO KEY UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Season not found'; END IF;
  IF v_status IN ('completed','archived') THEN
    RETURN QUERY SELECT 'finished'::text, NULL::timestamptz, NULL::uuid, 0, ARRAY[]::uuid[]; RETURN;
  END IF;
  SELECT * INTO v_div FROM league_divisions d WHERE d.id = p_division AND d.season_id = p_season FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Division not found'; END IF;
  IF v_div.teams_published_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already'::text, v_div.teams_published_at, v_div.teams_published_by, 0, ARRAY[]::uuid[]; RETURN;
  END IF;
  IF league_division_fingerprint(p_division) IS DISTINCT FROM p_fingerprint THEN
    RETURN QUERY SELECT 'changed'::text, NULL::timestamptz, NULL::uuid, 0, ARRAY[]::uuid[]; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM league_registrations r
                  WHERE r.division_id = p_division AND r.status = 'active' AND r.team_id IS NOT NULL) THEN
    RETURN QUERY SELECT 'not_ready'::text, NULL::timestamptz, NULL::uuid, 0, ARRAY[]::uuid[]; RETURN;
  END IF;
  IF cardinality(coalesce(p_coaches, ARRAY[]::uuid[])) IS DISTINCT FROM cardinality(coalesce(p_hashes, ARRAY[]::text[])) THEN
    RAISE EXCEPTION 'Each invited coach needs a token';
  END IF;

  UPDATE league_divisions d SET teams_published_at = v_now, teams_published_by = p_actor WHERE d.id = p_division;
  -- Locks and moves-by-hand end here (copy §5); a previous team from before today is not a move a family hears of.
  UPDATE league_registrations r
     SET team_locked_at = NULL, draft_team_id = NULL, previous_team_id = NULL, team_changed_at = NULL
   WHERE r.division_id = p_division AND r.status = 'active'
     AND (r.team_locked_at IS NOT NULL OR r.draft_team_id IS NOT NULL OR r.previous_team_id IS NOT NULL);

  WITH ins AS (
    INSERT INTO league_placement_emails(org_id, season_id, division_id, kind, guardian_email, registration_ids, created_by)
    SELECT p_org, p_season, p_division, 'placed', lower(btrim(r.guardian_email)),
           array_agg(r.id ORDER BY r.player_first_name, r.player_last_name, r.id), p_actor
      FROM league_registrations r
     WHERE r.division_id = p_division AND r.status = 'active' AND r.team_id IS NOT NULL
       AND btrim(coalesce(r.guardian_email, '')) <> ''
     GROUP BY lower(btrim(r.guardian_email))
    RETURNING id
  ) SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_rows FROM ins;
  v_families := cardinality(v_rows);

  -- 9d-1: the Publish is one notice on the season's history, its family emails (exactly the rows just written) stamped
  -- with it.
  IF v_families > 0 THEN
    INSERT INTO league_season_notices(org_id, season_id, division_id, kind, family_count, created_by, created_at)
    VALUES (p_org, p_season, p_division, 'teams_published', v_families, p_actor, v_now)
    RETURNING id INTO v_notice;
    UPDATE league_placement_emails e SET notice_id = v_notice WHERE e.id = ANY (v_rows);
  END IF;

  WITH done AS (
    UPDATE league_team_coaches c
       SET token_hash = a.hash, invited_at = v_now, expires_at = v_now + interval '7 days', invited_by = p_actor
      FROM unnest(p_coaches, p_hashes) AS a(id, hash)
     WHERE c.id = a.id AND c.removed_at IS NULL AND c.invited_at IS NULL
       AND c.team_id IN (SELECT t.id FROM league_teams t WHERE t.division_id = p_division)
    RETURNING c.id
  ) SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_invited FROM done;

  RETURN QUERY SELECT NULL::text, v_now, p_actor, v_families, v_invited;
END $$;

REVOKE ALL ON FUNCTION public.league_division_publish(uuid, uuid, uuid, uuid, text, uuid[], text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_division_publish(uuid, uuid, uuid, uuid, text, uuid[], text[]) TO service_role;

-- ─── 5 · A one-family message names the season it was sent from ─────────────────────────────────────────────────────

ALTER TABLE public.family_messages ADD COLUMN IF NOT EXISTS season_id uuid;
CREATE INDEX IF NOT EXISTS family_messages_season_idx
  ON public.family_messages (season_id, sent_at DESC) WHERE season_id IS NOT NULL;
COMMENT ON COLUMN public.family_messages.season_id IS
  'The house-league season whose door sent this one-family message (9d-1, argument 5), so the season''s history lists it '
  'as "A message to this family". Null from Families. Not FK-checked, as family_email_sends.season_id. Never counted '
  'toward a season''s three: a family''s own three (family_message_claim) is its only limit.';

COMMIT;

-- Verify (dev, then prod):
--   SELECT to_regclass('public.family_email_recipients'), to_regclass('public.league_season_notices');      -- both not null
--   SELECT relname, relrowsecurity FROM pg_class
--    WHERE relname IN ('family_email_recipients', 'league_season_notices');                                 -- t, t
--   SELECT count(*) FROM pg_proc WHERE proname = 'family_email_claim'
--      AND prosrc LIKE '%IS NOT DISTINCT FROM p_season_id%' AND prosrc LIKE '%v_cap   constant integer := 3%'; -- 1
--   SELECT count(*) FROM pg_proc WHERE proname = 'league_division_publish' AND prosrc LIKE '%league_season_notices%'; -- 1
--   SELECT column_name FROM information_schema.columns
--    WHERE (table_name, column_name) IN (('family_email_sends','retried_at'), ('family_messages','season_id'),
--                                         ('league_placement_emails','notice_id'));                          -- 3 rows
