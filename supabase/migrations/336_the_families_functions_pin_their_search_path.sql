-- ---------------------------------------------------------------
-- Migration 336 — the Families functions pin their search_path (stack health, owner 2026-10-18)
--
-- WHY: the 2026-10-17 morning check went red on Supabase's security advisor, WARN function_search_path_mutable, for
-- the three functions migs 333–334 created or replaced: families_attach_people, families_merge_people and
-- family_message_claim. None is SECURITY DEFINER and only service_role may EXECUTE them, so no caller could exploit
-- it. They are, though, behind the house standard mig 335 already follows (family_coach_ask_claim: SET search_path =
-- public). Every call in all three bodies is a pg_catalog built-in or a public table, so pinning changes nothing they do.
--
-- WHAT CHANGES: ALTER FUNCTION … SET search_path = public on the three. Bodies, grants and signatures untouched.
--
-- ⚠ ORDER: AFTER 333 and 334, on every database. CREATE OR REPLACE FUNCTION resets a function's settings, so applying
-- 333 or 334 after this one would undo it. INVISIBLE to the drift check: declared in MANUAL_PROD_STEPS.json with a
-- proconfig check. Safe to run twice. Prod: in the same promote as 333–334, applied after them.
-- ---------------------------------------------------------------

ALTER FUNCTION public.families_attach_people(uuid) SET search_path = public;
ALTER FUNCTION public.families_merge_people(uuid, uuid, uuid, uuid) SET search_path = public;
ALTER FUNCTION public.family_message_claim(uuid, uuid, uuid) SET search_path = public;
