-- ---------------------------------------------------------------
-- Migration 347 — Club Tier Stage 7c: the club can email its families (Asks 6 and 7, option A each; owner answers to
-- the build prompt's "Put to the owner" 1–6, 2026-10-22; build prompt docs/projects/active/CLUB_TIER_STAGE7C_BUILD_PROMPT.md)
--
-- WHY: no send reached every family (finding G02). Families' "Email families" sends one email to each family the club
-- picks — every family, some rep teams, or one house-league season — through the one club send window, and its new
-- Emails tab lists what the club sent.
--
-- WHAT CHANGES:
--   (1) family_email_sends — one row per Email families send. ⚖ It keeps the SUBJECT, the MESSAGE, who it went to (the
--       audience's kind and its description) and COUNTS — families it was going to, opted out, reached, failed, head
--       coaches copied. ⚠ NEVER a list of families or addresses (owner, Put to the owner 1, option a: "who bounced" is a
--       count, never names). The 5a rule for a one-household message (date and sender only, family_messages) is
--       unchanged.
--   (2) family_email_claim(...) — the claim BEFORE any email goes, under a per-club lock: a second press within a minute
--       is refused 'just_sent'; a fourth send in any rolling 24 hours is refused 'cap' with when the next can go (owner,
--       Put to the owner 2: a per-CLUB count over Email families sends only — a one-household message never counts
--       toward it, and this send never counts against a family's own three, family_message_claim). The app completes
--       the row with what went, or deletes it when the send reached nobody, so a failed send never spends the day.
--
-- A row left 'sending' (the server stopped mid-send) is read as "Stopped at x of y" after a grace period, by the app;
-- there is no Resume (owner, Put to the owner 4) — a resend is a new send against the cap.
--
-- INVISIBLE to the drift check for the function: declared in MANUAL_PROD_STEPS.json with a prosrc check. Safe to run
-- twice. Prod: at or before the promote that carries Stage 7c's code.
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.family_email_sends (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sent_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  subject          text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  body             text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  audience_kind    text NOT NULL CHECK (audience_kind IN ('every', 'teams', 'season')),
  audience_label   text NOT NULL CHECK (char_length(audience_label) BETWEEN 1 AND 500),
  team_ids         uuid[] NOT NULL DEFAULT '{}',
  season_id        uuid,
  family_count     integer NOT NULL DEFAULT 0 CHECK (family_count >= 0),
  opted_out_count  integer NOT NULL DEFAULT 0 CHECK (opted_out_count >= 0),
  reached_count    integer NOT NULL DEFAULT 0 CHECK (reached_count >= 0),
  failed_count     integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  coach_count      integer NOT NULL DEFAULT 0 CHECK (coach_count >= 0),
  status           text NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'done'))
);

CREATE INDEX IF NOT EXISTS family_email_sends_org_sent_idx ON public.family_email_sends (org_id, sent_at DESC);

ALTER TABLE public.family_email_sends ENABLE ROW LEVEL SECURITY;
-- Server-only (mig 311's rule): no policies, nothing to anon/authenticated; the service role granted explicitly.
REVOKE ALL ON TABLE public.family_email_sends FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_email_sends TO service_role;

COMMENT ON TABLE public.family_email_sends IS
  'Club Tier Stage 7c (Asks 6, 7): one row per Families "Email families" send — who sent it, when, the subject and the '
  'message, who it went to (kind + description) and counts. NEVER a list of families or addresses (owner 2026-10-22). '
  'The row is the send''s claim (family_email_claim, written before any email goes), the club''s three-a-day cap, and the '
  'Emails tab''s record. A claim whose send reached nobody is deleted.';
COMMENT ON COLUMN public.family_email_sends.audience_kind IS
  'every = every family with a child on a live team or in an open season; teams = the families of the rep teams in team_ids; season = the families of the house-league season season_id.';
COMMENT ON COLUMN public.family_email_sends.audience_label IS 'Who it went to, in words, as the Emails tab shows it ("Every family", "15U AAA · 14U AA", "Fall 2026").';
COMMENT ON COLUMN public.family_email_sends.team_ids IS 'The rep teams picked (kind teams). Not FK-checked: a record of a send, kept when a team is later archived.';
COMMENT ON COLUMN public.family_email_sends.season_id IS 'The house-league season picked (kind season). Not FK-checked, for the same reason.';
COMMENT ON COLUMN public.family_email_sends.family_count IS 'Families the send was going to (households, each once, opted-out families and the sender not counted) — the lime''s "Send to N".';
COMMENT ON COLUMN public.family_email_sends.opted_out_count IS 'Families in the audience the send skipped because every address had opted out of club email.';
COMMENT ON COLUMN public.family_email_sends.reached_count IS 'Families at least one of whose addresses the mail service accepted. Updated as each batch goes. Not a delivery receipt: the platform takes no bounce reports.';
COMMENT ON COLUMN public.family_email_sends.failed_count IS 'Families none of whose addresses the mail service accepted.';
COMMENT ON COLUMN public.family_email_sends.coach_count IS 'Head coaches sent a colleague copy (each once).';
COMMENT ON COLUMN public.family_email_sends.status IS 'sending while the batches go; done when the send finished. A row still sending long after sent_at is read as stopped.';

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
  -- One club's sends serialize here: the second of two presses (one admin twice, or two admins at once) waits, then
  -- sees the first and is refused.
  PERFORM pg_advisory_xact_lock(hashtextextended('family_email:' || p_org::text, 0));

  SELECT max(sent_at) INTO v_last FROM family_email_sends WHERE org_id = p_org;
  IF v_last IS NOT NULL AND v_last > now() - interval '60 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'just_sent');
  END IF;

  SELECT count(*) INTO v_count
    FROM family_email_sends WHERE org_id = p_org AND sent_at > now() - interval '24 hours';
  IF v_count >= v_cap THEN
    -- The next send can go when the oldest send that still counts turns 24 hours old.
    SELECT sent_at + interval '24 hours' INTO v_next
      FROM family_email_sends WHERE org_id = p_org AND sent_at > now() - interval '24 hours'
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

COMMIT;

-- Verify (dev, then prod):
--   SELECT to_regclass('public.family_email_sends');                                                       -- not null
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'family_email_sends';                              -- t
--   SELECT count(*) FROM pg_proc WHERE proname = 'family_email_claim'
--      AND prosrc LIKE '%family_email:%' AND prosrc LIKE '%60 seconds%' AND prosrc LIKE '%v_cap   constant integer := 3%'; -- 1
--   SELECT proconfig FROM pg_proc WHERE proname = 'family_email_claim';                                    -- {search_path=public}
