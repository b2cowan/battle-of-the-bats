-- Migration 316: a club shares payees with its teams.
-- (Ledger Parity session 1 — the server half. Owner rulings 2026-10-02, D5 + D7 + D7a + D7b: "I agree with your
--  recommendations on D1-D7". Business Decisions Log 2026-10-02 "A club can SHARE payees…". Plan:
--  docs/projects/active/LEDGER_PARITY_PLAN.md; build prompt LEDGER_PARITY_SERVER_PROMPT.md.)
--
-- THE CASE. In a club, every coach's payee picker listed EVERY club payee (`team_id IS NULL OR team_id = team`),
-- wholesale and silent; a coach could create and search payees but never rename, merge or delete one.
--
-- WHAT THIS ADDS
--   1. `org_payees.shared_with_teams` + `shared_at` — the club chooses which of ITS payees (`team_id IS NULL`) its
--      teams use. Only a club-scope row can be shared; a shared row always carries the moment it was shared, an
--      unshared one never does (one CHECK holds both). Unsharing clears the stamp; a later re-share starts a new
--      clock. `shared_at` is what Club Tier Stage 3b's report reads (D7a): a team's payment counts only when it
--      was recorded on or after it.
--   2. D7b, ONE-SHOT: in every club (NOT a team-workspace org), a club payee any team's record already names
--      starts shared, stamped now — so nothing a coach relies on vanishes from a picker. Every other club payee
--      starts unshared. Runs only when the columns are created, so re-applying this file never re-shares a payee
--      a club has since unshared. Counted 2026-10-02: dev 0 of 6 club payees (2 orgs) start shared; prod has no
--      payees at all (plan § Round 2 build record).
--      ⚠ The stamp is this migration's time, and it goes on prod minutes before the promote that ships the
--      picker's notice ("Your club sees payments to these payees"); those minutes are an accepted gap.
--   3. `team_payee_merge` — a team folds its own duplicate into its own payee or into a SHARED club payee, in one
--      step (D5). It moves THIS team's records only and refuses when anything else still names the payee.
--   4. `club_payee_merge` keeps sharing honest: the payee kept is shared if either was, with the LATER of the two
--      stamps, so no payment recorded before a notice is ever counted.
--
-- ⚠ TEAM-WORKSPACE (standalone) ORGS ARE UNTOUCHED: their `team_id IS NULL` rows are the team's own (the
--   team-move rule, mig 313: on a move into a club they become `team_id = team`), never shared, and the coach
--   sees all of them whatever the flag. `organizations.account_kind = 'team_workspace' OR plan_id = 'team'` is
--   the same test as `isTeamWorkspaceOrg` (lib/team-workspace-kind.ts).
-- ⚠ ORDER-CRITICAL on prod: AFTER mig 315 (it replaces 315's `club_payee_merge`; re-running 315 after this would
--   put the sharing-blind version back).

BEGIN;

-- 0. After 315, never before: this replaces 315's `club_payee_merge`, so applied first it would be overwritten by 315
--    with the sharing-blind version. 315's reminder-wave table is the proof 315 is in. (The reverse — 315 re-run
--    after this — is caught by the prod verify step in MANUAL_PROD_STEPS: club_payee_merge must contain GREATEST.)
DO $$
BEGIN
  IF to_regclass('public.rep_allocation_reminder_waves') IS NULL THEN
    RAISE EXCEPTION 'Migration 316 needs migration 315 first (club_payee_merge is replaced here). Apply 315, then 316.';
  END IF;
END $$;

-- 1 + 2. The flag, the stamp, the rule, and the launch step — together, once.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'org_payees' AND column_name = 'shared_with_teams'
  ) THEN
    ALTER TABLE public.org_payees
      ADD COLUMN shared_with_teams boolean NOT NULL DEFAULT false,
      ADD COLUMN shared_at timestamptz;
    ALTER TABLE public.org_payees
      ADD CONSTRAINT org_payees_sharing_check CHECK (
        (NOT shared_with_teams AND shared_at IS NULL)
        OR (shared_with_teams AND shared_at IS NOT NULL AND team_id IS NULL)
      );

    -- D7b: a club payee a team already uses starts shared. The only team-side record that names a payee is
    -- `rep_team_expenses.payee_id` (the other FK, `accounting_entries.payee_id`, is the club's own books).
    UPDATE public.org_payees p
       SET shared_with_teams = true, shared_at = now()
     WHERE p.team_id IS NULL
       AND EXISTS (
         SELECT 1 FROM public.organizations o
          WHERE o.id = p.org_id
            AND o.account_kind IS DISTINCT FROM 'team_workspace'
            AND o.plan_id IS DISTINCT FROM 'team'
       )
       AND EXISTS (
         SELECT 1 FROM public.rep_team_expenses e WHERE e.payee_id = p.id AND e.org_id = p.org_id
       );
  END IF;
END $$;

COMMENT ON COLUMN public.org_payees.shared_with_teams IS
  'A club payee (team_id IS NULL) the club shares with its teams: only shared club payees reach a club team''s picker (Ledger Parity D7, mig 316). Never set in a team-workspace org.';
COMMENT ON COLUMN public.org_payees.shared_at IS
  'When the club last shared this payee; NULL while unshared. Stage 3b counts a team''s payment only when it was recorded on or after it (D7a).';

-- 3. A team merges its own duplicate (D5). Codes: same_payee · not_found · not_allowed · named_elsewhere.
--   `from` must be the team's own (in a team-workspace org a `team_id IS NULL` row is the team's own too); a shared
--   club payee the team can see is `not_allowed` (the club's to change). `into` is the team's own or a SHARED club
--   payee of the same org. Anything the team cannot see — another team's payee, an unshared club payee, another
--   org's — is `not_found`, so the answer never confirms that one exists.
--   Repoints THIS team's records only (`rep_team_expenses`, every season), never the club's `accounting_entries`.
--   ⚠ Checked BEFORE any write: when anything else still names `from` (another team's record, a club entry) the
--   merge refuses `named_elsewhere` rather than leave the delete to fail on the FK. The lock on both payee rows
--   holds off a new record naming `from` (its FK check waits on the row) until this commits.
CREATE OR REPLACE FUNCTION public.team_payee_merge(p_org uuid, p_team uuid, p_from uuid, p_into uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_workspace boolean;
  v_from      org_payees%ROWTYPE;
  v_into      org_payees%ROWTYPE;
  v_from_own  boolean;
  v_into_own  boolean;
  v_moved     integer;
BEGIN
  IF p_from = p_into THEN RETURN jsonb_build_object('ok', false, 'code', 'same_payee'); END IF;

  SELECT coalesce(o.account_kind = 'team_workspace' OR o.plan_id = 'team', false) INTO v_workspace
    FROM organizations o JOIN rep_teams t ON t.org_id = o.id
   WHERE o.id = p_org AND t.id = p_team;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'code', 'not_found'); END IF;

  PERFORM 1 FROM org_payees WHERE id IN (p_from, p_into) ORDER BY id FOR UPDATE;
  SELECT * INTO v_from FROM org_payees WHERE id = p_from AND org_id = p_org;
  SELECT * INTO v_into FROM org_payees WHERE id = p_into AND org_id = p_org;

  -- ⚠ coalesce is load-bearing: a club payee's `team_id = p_team` is NULL, not false, and `IF NOT NULL` does
  -- not fire — without it a club payee reads as the team's own.
  v_from_own := v_from.id IS NOT NULL
    AND coalesce(v_from.team_id = p_team, v_workspace AND v_from.team_id IS NULL, false);
  v_into_own := v_into.id IS NOT NULL
    AND coalesce(v_into.team_id = p_team, v_workspace AND v_into.team_id IS NULL, false);

  IF NOT v_from_own THEN
    IF v_from.id IS NOT NULL AND NOT v_workspace AND v_from.team_id IS NULL AND v_from.shared_with_teams THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_allowed');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;
  IF NOT v_into_own AND NOT coalesce(
    v_into.id IS NOT NULL AND NOT v_workspace AND v_into.team_id IS NULL AND v_into.shared_with_teams, false
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM rep_team_expenses WHERE payee_id = p_from AND team_id IS DISTINCT FROM p_team)
     OR EXISTS (SELECT 1 FROM accounting_entries WHERE payee_id = p_from) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'named_elsewhere');
  END IF;

  UPDATE rep_team_expenses SET payee_id = p_into WHERE payee_id = p_from AND team_id = p_team;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  DELETE FROM org_payees WHERE id = p_from;

  RETURN jsonb_build_object('ok', true, 'moved', v_moved);
END;
$$;

-- 4. Club: merge one of the club's payees into another (Club Tier C01, mig 315) — now keeping sharing honest.
-- Every line that names it moves to the one kept and it is removed, in one step. The club's payees only
-- (team_id IS NULL); a team's payees are the coach's. The kept payee is shared if either was, with the LATER
-- stamp (GREATEST skips a NULL), so a team payment recorded before either notice is never counted.
-- Codes: not_found · same_payee. `entries` is the club's own lines moved — the only count the club is shown;
-- `expenses` (team records) is reported for the record, never displayed.
CREATE OR REPLACE FUNCTION public.club_payee_merge(p_org uuid, p_from uuid, p_into uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_entries  integer;
  v_expenses integer;
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
  IF v_from.shared_with_teams OR v_into.shared_with_teams THEN
    UPDATE org_payees SET shared_with_teams = true, shared_at = GREATEST(v_from.shared_at, v_into.shared_at)
     WHERE id = p_into;
  END IF;
  DELETE FROM org_payees WHERE id = p_from;

  RETURN jsonb_build_object('ok', true, 'moved', v_entries + v_expenses, 'entries', v_entries, 'expenses', v_expenses);
END;
$$;

-- Server-only (mig 311's rule): the service role calls these; the browser key cannot.
REVOKE ALL ON FUNCTION
  public.team_payee_merge(uuid, uuid, uuid, uuid),
  public.club_payee_merge(uuid, uuid, uuid)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.team_payee_merge(uuid, uuid, uuid, uuid),
  public.club_payee_merge(uuid, uuid, uuid)
  TO service_role;

COMMIT;

-- Verify (dev, then prod):
--   SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'org_payees' AND column_name IN ('shared_with_teams','shared_at');
--     -- 2 rows: boolean NO false · timestamp with time zone YES
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'org_payees_sharing_check';      -- 1 row
--   SELECT proname FROM pg_proc WHERE proname IN ('team_payee_merge','club_payee_merge');                  -- 2 rows
--   SELECT prosrc LIKE '%GREATEST(v_from.shared_at, v_into.shared_at)%' FROM pg_proc WHERE proname = 'club_payee_merge'; -- t
--   SELECT grantee FROM information_schema.routine_privileges
--    WHERE routine_name IN ('team_payee_merge','club_payee_merge') AND privilege_type = 'EXECUTE';      -- postgres + service_role only
--   SELECT count(*) FILTER (WHERE shared_with_teams) AS shared, count(*) AS club_payees FROM org_payees WHERE team_id IS NULL;
