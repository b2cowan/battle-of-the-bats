-- Migration 325: a payee merge carries the permits that name it.
-- (Club Tier Stage 10a follow-up, found walking §296 on 2026-10-11 — owner: "can you fix that problem". Plan:
--  docs/projects/active/CLUB_PERMITS_AND_SCHEDULER_PLAN.md, "The issuer list".)
--
-- THE CASE. `club_payee_merge` (mig 316) moves the club's lines (`accounting_entries`) and every team record
-- (`rep_team_expenses`) naming the payee merged away, then deletes it. Mig 322 added a third thing that names a club
-- payee — a permit's issuer (`org_permits.issuer_payee_id`, ON DELETE SET NULL) — and the merge never learned it: its
-- delete nulled the permit's link, and the permit then read the merged-away spelling from `issuer_name`. "Town of
-- Milton Parks" merged into "Town of Milton" left every permit it issued still saying "Town of Milton Parks".
--
-- WHAT THIS CHANGES
--   `club_payee_merge` also repoints every permit of the club naming `from` at `into`, and writes the kept payee's name
--   into `issuer_name` (what a read prints when the link is gone — kept true, never the old spelling). It returns
--   `permits` beside `entries` and `expenses`; `moved` keeps its meaning (entries + expenses). Everything 316 does is
--   unchanged: the lock order, the club-only check, sharing honesty (GREATEST).
--   A permit's issuer is neither its money nor its time, so `org_permits_check` lets it change in a closed fiscal year.
--   (The app's half, same change: a payee a permit names counts as in use — Merge, never Delete — lib/club-payees.ts.)
--
-- ⚠ ORDER-CRITICAL on prod: AFTER mig 316 (this replaces 316's `club_payee_merge`; re-running 316 after this would put
--   the permit-blind version back — caught by the verify below) and AFTER mig 322 (`org_permits` must exist).

BEGIN;

-- 0. After 316 and 322, never before.
DO $$
BEGIN
  IF to_regclass('public.org_permits') IS NULL THEN
    RAISE EXCEPTION 'Migration 325 needs migration 322 first (org_permits). Apply 322, then 325.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'org_payees' AND column_name = 'shared_with_teams'
  ) THEN
    RAISE EXCEPTION 'Migration 325 needs migration 316 first (club_payee_merge is replaced here). Apply 316, then 325.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.club_payee_merge(p_org uuid, p_from uuid, p_into uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
DECLARE
  v_entries  integer;
  v_expenses integer;
  v_permits  integer;
  v_from     org_payees%ROWTYPE;
  v_into     org_payees%ROWTYPE;
BEGIN
  IF p_from = p_into THEN RETURN jsonb_build_object('ok', false, 'code', 'same_payee'); END IF;

  PERFORM 1 FROM org_payees WHERE id IN (p_from, p_into) ORDER BY id FOR UPDATE;
  SELECT * INTO v_from FROM org_payees WHERE id = p_from AND org_id = p_org AND team_id IS NULL;
  SELECT * INTO v_into FROM org_payees WHERE id = p_into AND org_id = p_org AND team_id IS NULL;
  IF v_from.id IS NULL OR v_into.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;

  UPDATE accounting_entries SET payee_id = p_into, updated_at = now() WHERE payee_id = p_from;
  GET DIAGNOSTICS v_entries = ROW_COUNT;
  UPDATE rep_team_expenses SET payee_id = p_into WHERE payee_id = p_from;
  GET DIAGNOSTICS v_expenses = ROW_COUNT;
  -- A permit's issuer (mig 322): the link follows the payee kept, and so does the name a read falls back to.
  UPDATE org_permits SET issuer_payee_id = p_into, issuer_name = v_into.name
   WHERE issuer_payee_id = p_from AND org_id = p_org;
  GET DIAGNOSTICS v_permits = ROW_COUNT;
  IF v_from.shared_with_teams OR v_into.shared_with_teams THEN
    UPDATE org_payees SET shared_with_teams = true, shared_at = GREATEST(v_from.shared_at, v_into.shared_at)
     WHERE id = p_into;
  END IF;
  DELETE FROM org_payees WHERE id = p_from;

  RETURN jsonb_build_object('ok', true, 'moved', v_entries + v_expenses, 'entries', v_entries, 'expenses', v_expenses,
    'permits', v_permits);
END;
$$;

-- Server-only (mig 311's rule): the service role calls it; the browser key cannot. (CREATE OR REPLACE keeps the grants;
-- restated so this file stands alone.)
REVOKE ALL ON FUNCTION public.club_payee_merge(uuid, uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.club_payee_merge(uuid, uuid, uuid) TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT prosrc LIKE '%UPDATE org_permits SET issuer_payee_id = p_into%' AND prosrc LIKE '%GREATEST(v_from.shared_at, v_into.shared_at)%'
--     FROM pg_proc WHERE proname = 'club_payee_merge';                                                   -- t
--   SELECT grantee FROM information_schema.routine_privileges
--    WHERE routine_name = 'club_payee_merge' AND privilege_type = 'EXECUTE';                             -- postgres + service_role only
