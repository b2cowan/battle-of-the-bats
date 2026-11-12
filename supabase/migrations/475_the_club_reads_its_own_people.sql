-- Migration 475 — Board Ready two-step sign-in, Part 4 (owner rulings 2026-11-12).
--
-- WHY, two things:
--
--   1. The club's Members list read its people's email and last sign-in from ONE platform-wide page of 1,000 accounts
--      (the sign-in service's admin "list users"). Past 1,000 accounts on the whole platform, a member on a later page
--      showed "(unknown)" and no last sign-in — and Part 4's new Two-step column would have read "Off" for them. Owner
--      ruling: read only this club's own people. `public.people_sign_in_facts(uuid[])` answers, for the accounts asked,
--      their email, last sign-in and two-step state, in one query. Server key only (it reads auth.users and
--      auth.mfa_factors, which nothing else may).
--
--   2. The two grace emails (ask 7) ride the existing hourly two-step job (owner ruling 2026-11-12, no new schedule):
--      "your club now requires it" within the hour of a person's 14 days starting, and "3 days left". Each stamp is the
--      deadline its email was sent for, so nobody gets one twice, and a switch turned off and on again (a new deadline)
--      gets its own emails.
--
-- Two-step "on" here matches the app's own read (lib/two-step-reset.ts twoStepFactsFor): a verified authenticator, OR a
-- lost phone being replaced (app_metadata.two_step_replacing = true; two-step stays on while it is replaced). "Since" is
-- the earliest verified authenticator's set-up time.
--
-- Additive and re-runnable. Visible to check:migrations (a column). Prod: apply BEFORE the Part 4 code (the Members list
-- and the hourly job call the function; without it the Members list answers 500).

ALTER TABLE public.two_step_grace
  ADD COLUMN IF NOT EXISTS start_email_for timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_for timestamptz;

COMMENT ON COLUMN public.two_step_grace.start_email_for IS
  'The deadline the "your club now requires two-step sign-in" email was sent for (null = not sent). The hourly job sends '
  'it, paced, so a switch turned on for a club of many coaches never sends inside the owner''s press. Mig 475.';
COMMENT ON COLUMN public.two_step_grace.reminder_sent_for IS
  'The deadline the "3 days left" two-step reminder email was sent for (null = not sent). A row may exist only for these '
  'stamps, written by the hourly job with starts_at = the switch''s own time (which changes no deadline). Mig 475.';

CREATE OR REPLACE FUNCTION public.people_sign_in_facts(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  email text,
  last_sign_in_at timestamptz,
  two_step_on boolean,
  two_step_since timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    u.id,
    u.email::text,
    u.last_sign_in_at,
    -- A text compare, never a cast: a malformed mark must not fail the whole read (/review 2026-11-12).
    (f.since IS NOT NULL) OR coalesce(u.raw_app_meta_data ->> 'two_step_replacing', '') = 'true',
    f.since
  FROM auth.users u
  LEFT JOIN LATERAL (
    SELECT min(m.created_at) AS since
    FROM auth.mfa_factors m
    WHERE m.user_id = u.id AND m.status = 'verified'
  ) f ON true
  WHERE u.id = ANY (p_user_ids);
$$;

REVOKE ALL ON FUNCTION public.people_sign_in_facts(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.people_sign_in_facts(uuid[]) TO service_role;

COMMENT ON FUNCTION public.people_sign_in_facts(uuid[]) IS
  'For the accounts asked: email, last sign-in, two-step on (verified authenticator or a phone being replaced) and since '
  'when. Server key only. The club''s Members list, the Overview reminder and the hourly grace reminder read it (mig 475).';

NOTIFY pgrst, 'reload schema';
