-- Club Tier Stage 9c Part 4 · A placement email is sent once (HOUSE_LEAGUE_STAGE9C_BUILD_PROMPT.md argument 4).
--
-- Publish writes one league_placement_emails row per family (mig 377); the send afterwards claims the rows it will send,
-- so two presses of "Send the {n} again" (or a resend racing the first send) can never email a family twice. A claimed
-- row is 'sending'; one left 'sending' for ten minutes (a send that died mid-flight) can be claimed again.
-- Requires 377.

ALTER TABLE public.league_placement_emails DROP CONSTRAINT IF EXISTS league_placement_emails_status_check;
ALTER TABLE public.league_placement_emails ADD CONSTRAINT league_placement_emails_status_check
  CHECK (status IN ('pending','sending','sent','failed','skipped'));

CREATE OR REPLACE FUNCTION public.league_placement_emails_claim(p_org uuid, p_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE league_placement_emails e
     SET status = 'sending', attempts = e.attempts + 1, updated_at = now()
   WHERE e.org_id = p_org AND e.id = ANY(p_ids)
     AND (e.status IN ('pending','failed') OR (e.status = 'sending' AND e.updated_at < now() - interval '10 minutes'))
  RETURNING e.id
$$;
REVOKE ALL ON FUNCTION public.league_placement_emails_claim(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.league_placement_emails_claim(uuid, uuid[]) TO service_role;

-- The org_id of each 9c table leads an index (scripts/check-index-coverage.mjs: org_id is the tenancy anchor).
CREATE INDEX IF NOT EXISTS league_placement_emails_org_id_idx ON public.league_placement_emails (org_id);
CREATE INDEX IF NOT EXISTS league_player_ratings_org_id_idx ON public.league_player_ratings (org_id);
CREATE INDEX IF NOT EXISTS league_team_coaches_org_id_idx ON public.league_team_coaches (org_id);
