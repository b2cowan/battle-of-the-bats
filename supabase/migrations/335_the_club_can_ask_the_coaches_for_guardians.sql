-- ---------------------------------------------------------------
-- Migration 335 — Club Tier Stage 5b: the club can ask the coaches for the guardians it is missing (Ask 4, owner
-- ratification 2026-10-17; build prompt docs/projects/active/CLUB_TIER_STAGE5B_BUILD_PROMPT.md)
--
-- WHY: since Club Stage 2 a rep roster is the coach's, so a club admin cannot type a rep child's guardian anywhere —
-- Families' "No family on file" list was work the club could not do (S5-01). "Ask the coaches" emails each team's head
-- coach the names of their players with no guardian on file and where to add one (their Roster), through the one club
-- send window, the way the club's reminders and the scheduler already reach coaches.
--
-- WHAT CHANGES:
--   (1) family_coach_asks — one row per Ask the coaches send: who sent it, when, which teams it reached, how many
--       players it named and how many coaches it emailed. ⚠ NEVER the children's names (the build prompt): the email
--       names them, the record keeps counts. "Last sent … by …" reads the newest row.
--   (2) family_coach_ask_claim(org, actor, team_ids, player_count) — the claim BEFORE any email goes, under a per-club
--       lock: a second press within a minute waits, sees the first and is refused 'just_sent' (the reminders' rule,
--       mig 315's club_reminder_wave_claim). The app completes the row with what actually went, or removes it when
--       nothing did.
--
-- INVISIBLE to the drift check for the function: declared in MANUAL_PROD_STEPS.json with a prosrc check. Safe to run
-- twice. Prod: at or before the promote that carries Stage 5b's code.
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.family_coach_asks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sent_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  team_ids        uuid[] NOT NULL DEFAULT '{}',
  player_count    integer NOT NULL DEFAULT 0 CHECK (player_count >= 0),
  recipient_count integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0)
);

CREATE INDEX IF NOT EXISTS family_coach_asks_org_sent_idx ON public.family_coach_asks (org_id, sent_at DESC);

ALTER TABLE public.family_coach_asks ENABLE ROW LEVEL SECURITY;
-- Server-only (mig 311's rule): no policies, nothing to anon/authenticated; the service role granted explicitly.
REVOKE ALL ON TABLE public.family_coach_asks FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_coach_asks TO service_role;

COMMENT ON TABLE public.family_coach_asks IS
  'Club Tier Stage 5b (Ask 4): one row per Families "Ask the coaches" send — who sent it, when, which teams it reached, '
  'how many players it named and how many coaches it emailed. NEVER the children''s names. The row is the send''s claim '
  '(family_coach_ask_claim, written before any email goes) and "Last sent … by …". A claim whose send reached nobody is removed.';
COMMENT ON COLUMN public.family_coach_asks.team_ids IS
  'Every team whose head coach the send emailed. Not FK-checked: a record of a send, kept when a team is later archived.';
COMMENT ON COLUMN public.family_coach_asks.player_count IS 'How many players with no guardian on file the emails named, across the teams reached.';
COMMENT ON COLUMN public.family_coach_asks.recipient_count IS 'How many coaches were emailed.';

CREATE OR REPLACE FUNCTION public.family_coach_ask_claim(p_org uuid, p_actor uuid, p_team_ids uuid[], p_player_count integer)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_last timestamptz;
  v_id   uuid;
BEGIN
  -- One club's asks serialize here: the second of two presses waits, then sees the first and is refused.
  PERFORM pg_advisory_xact_lock(hashtextextended('family_coach_ask:' || p_org::text, 0));

  SELECT max(sent_at) INTO v_last FROM family_coach_asks WHERE org_id = p_org;
  IF v_last IS NOT NULL AND v_last > now() - interval '60 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'just_sent');
  END IF;

  INSERT INTO family_coach_asks (org_id, sent_by, team_ids, player_count, recipient_count)
  VALUES (p_org, p_actor, coalesce(p_team_ids, '{}'), greatest(coalesce(p_player_count, 0), 0), 0)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'askId', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.family_coach_ask_claim(uuid, uuid, uuid[], integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_coach_ask_claim(uuid, uuid, uuid[], integer) TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT to_regclass('public.family_coach_asks');                                                        -- not null
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'family_coach_asks';                               -- t
--   SELECT count(*) FROM pg_proc WHERE proname = 'family_coach_ask_claim'
--      AND prosrc LIKE '%family_coach_ask:%' AND prosrc LIKE '%60 seconds%';                              -- 1
