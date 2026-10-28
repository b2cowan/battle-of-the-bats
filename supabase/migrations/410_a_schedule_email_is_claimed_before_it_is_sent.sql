-- ---------------------------------------------------------------
-- Migration 410 — House League Stage 9d-2b Part 4: a family's schedule email is claimed before it is sent
-- (build prompt docs/projects/active/HOUSE_LEAGUE_STAGE9D2B_BUILD_PROMPT.md, Part 4; the 9c precedent is mig 378).
--
-- WHY: mig 409 writes one league_schedule_emails row per family, pending, in the Publish schedule / Changes to send
-- transaction. The send that follows (and "Send to the N it missed" on the season's Email families history) must never
-- email a family twice when two of them overlap. Each row is CLAIMED first — 'sending' — exactly as Publish teams' rows
-- are (mig 378); one left 'sending' for ten minutes (a send that died mid-flight) can be claimed again.
--
-- WHAT CHANGES:
--   (1) league_schedule_emails.status gains 'sending' (claimed) and 'skipped' (nothing to say any more: the family's
--       children have left the teams, or every game in it was played before a late resend reached it).
--   (2) league_schedule_emails_claim(p_org, p_ids) — the claim, service role only.
--
-- Additive, no row change, re-runnable. Requires 409. INVISIBLE to the drift check: the function.
-- ---------------------------------------------------------------

BEGIN;

ALTER TABLE public.league_schedule_emails DROP CONSTRAINT IF EXISTS league_schedule_emails_status_check;
ALTER TABLE public.league_schedule_emails ADD CONSTRAINT league_schedule_emails_status_check
  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped'));

COMMENT ON COLUMN public.league_schedule_emails.status IS
  'pending (written by the publish / send transaction) → sending (claimed by league_schedule_emails_claim) → sent, '
  'failed (counted, and offered again as "Send to the N it missed") or skipped (nothing left to say to the family). A row '
  'left sending for ten minutes can be claimed again.';

CREATE OR REPLACE FUNCTION public.league_schedule_emails_claim(p_org uuid, p_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE league_schedule_emails e
     SET status = 'sending', updated_at = now()
   WHERE e.org_id = p_org AND e.id = ANY (p_ids)
     AND (e.status IN ('pending', 'failed') OR (e.status = 'sending' AND e.updated_at < now() - interval '10 minutes'))
  RETURNING e.id
$$;
REVOKE ALL ON FUNCTION public.league_schedule_emails_claim(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_schedule_emails_claim(uuid, uuid[]) TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'league_schedule_emails_status_check'; -- has sending, skipped
--   SELECT count(*) FROM pg_proc WHERE proname = 'league_schedule_emails_claim';                                -- 1
