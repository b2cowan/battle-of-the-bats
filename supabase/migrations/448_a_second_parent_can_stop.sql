-- ---------------------------------------------------------------
-- Migration 448 — Signed-in family accounts Stage 3b Part 1: a second parent can stop the sign-up emails
-- (plan docs/projects/active/SIGNED_IN_FAMILY_STAGE3B_SECOND_PARENT_STOP_PLAN.md, owner calls O1–O5 ruled 2026-11-06;
-- build prompt SIGNED_IN_FAMILY_STAGE3B_BUILD_PROMPT.md, Part 1; why: docs/agents/legal/CASL_SECOND_PARENT_EMAIL.md).
--
-- WHY: the second parent's address (league_registrations.guardian_email_2, mig 430) is typed by someone else and never
-- verified. The person behind it needs a one-click way off, and a stop must be permanent for that club.
--
-- WHAT CHANGES:
--   (1) second_parent_stops — one row per (org, address) that has stopped. SERVICE-ROLE ONLY (RLS on, no policies).
--         registration_ids = the sign-ups the stop CLEARED; this is how the registrar's record window shows
--         "Stopped by the address owner, {date}" once the address itself is gone from the sign-up.
--   (2) second_parent_stop(p_org, p_email, p_source) — the stop, in ONE transaction: clears guardian_email_2 on every
--       league_registrations row of THAT org whose second address matches, and records the stop (idempotent; a repeat
--       appends the ids it clears). The stop IS the removal: the senders already read guardian_email_2, so no send path
--       gets a suppression check.
--
-- ⚠ NOT family_email_optouts (mig 214): that table means "no announcements", expands to the whole person through
--   org_person_emails, and the sign-up copies never read it. ⚠ NEVER a household key and NEVER read for marketing or
--   consent. org_person_emails never receives a second address (only mig 430 mentions guardian_email_2; the address book is
--   fed from the FIRST address), so the stop has nothing to clear there.
--
-- Safe on a table with rows: a new empty table and a new function; no existing row changes. Re-runnable.
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.second_parent_stops (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Lowercased and trimmed exactly as guardian_email_2 is, with the same 200-character cap.
  email            text NOT NULL,
  stopped_at       timestamptz NOT NULL DEFAULT now(),
  source           text NOT NULL DEFAULT 'stop_page',
  registration_ids uuid[] NOT NULL DEFAULT '{}',
  CONSTRAINT second_parent_stops_email_check CHECK (
    email = lower(btrim(email)) AND email <> '' AND char_length(email) <= 200
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS second_parent_stops_org_email_uniq
  ON public.second_parent_stops (org_id, email);

-- The record window asks "which stop cleared this sign-up?" (registration_ids contains it).
CREATE INDEX IF NOT EXISTS second_parent_stops_registration_ids_idx
  ON public.second_parent_stops USING gin (registration_ids);

ALTER TABLE public.second_parent_stops ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only. The stop page and the form/registrar checks run server-side; there is no
-- browser-visible read path and there must never be one (it holds an address a person asked us to stop using).
-- The server's own admin client needs its grant spelled out: from 2026-10-30 Supabase no longer auto-grants a new table
-- (tests/unit/migration-table-grants-guard.test.ts). anon / authenticated are deliberately NOT granted.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.second_parent_stops TO service_role;

CREATE OR REPLACE FUNCTION public.second_parent_stop(p_org uuid, p_email text, p_source text DEFAULT 'stop_page')
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_ids uuid[];
BEGIN
  IF p_org IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'second_parent_stop needs an org and an address';
  END IF;

  -- Only THIS org's sign-ups; the match is on the lowercased trimmed value, as the column is stored.
  WITH cleared AS (
    UPDATE public.league_registrations
       SET guardian_email_2 = NULL
     WHERE org_id = p_org
       AND guardian_email_2 IS NOT NULL
       AND lower(btrim(guardian_email_2)) = v_email
    RETURNING id
  )
  SELECT coalesce(array_agg(id), '{}'::uuid[]) INTO v_ids FROM cleared;

  INSERT INTO public.second_parent_stops (org_id, email, source, registration_ids)
  VALUES (p_org, v_email, coalesce(nullif(btrim(p_source), ''), 'stop_page'), v_ids)
  ON CONFLICT (org_id, email) DO UPDATE
     SET registration_ids = ARRAY(
       SELECT DISTINCT x FROM unnest(public.second_parent_stops.registration_ids || EXCLUDED.registration_ids) AS x
     );

  RETURN coalesce(array_length(v_ids, 1), 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.second_parent_stop(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.second_parent_stop(uuid, text, text) TO service_role;
