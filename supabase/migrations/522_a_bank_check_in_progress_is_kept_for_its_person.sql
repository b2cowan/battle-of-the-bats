-- ---------------------------------------------------------------
-- Migration 522 — Bank check through a volunteer's eyes, S7 Part 1 (start, work, save for later; plan
-- docs/projects/active/BANK_CHECK_NOVICE_UX_PLAN.md §0 A18 and its nine rulings, 2026-11-22; build prompt
-- BANK_CHECK_NOVICE_UX_S7_BUILD_PROMPT.md Part 1; drawing BANK_CHECK_NOVICE_UX_S7_DRAWINGS.html). /dba Finding #54.
--
-- WHAT CHANGES:
--   (1) bank_check_drafts — one person's unfinished bank check on one bank account (club account or a team's account),
--       kept as they go from "Start checking this statement", so it follows them to any device they sign in on.
--       Replaces the browser-only working draft (lib/bank-check-draft.ts's localStorage store, WD1/WD2). Ruling 1: MINE
--       ONLY — one row per (account, person); a colleague on the same account reads only who, which date and when it
--       last changed (the route selects those three columns and nothing else). Holds the KEYS of marked lines and the
--       "Started off by" anchor, never a line's figures or names (the card re-reads the books every time).
--   (2) bank_check_drafts_sweep() — deletes every row past its expires_at (ruling 2: 30 days from the last change; the
--       server stamps expires_at on every write from one constant, BANK_CHECK_DRAFT_DAYS in lib/bank-check-work.ts).
--       Scheduled nightly by mig 523 (its own file and commit: watched automation, owner's yes 2026-11-22). The routes
--       also treat an expired row as none and delete it on sight.
--   (3) bank_check_drafts_discard_team(team, user?) — a team's work goes on its season's rollover or close (everyone's),
--       or one coach's on leaving the team or losing money write. In the database, so the club-side callers (the club's
--       season door and staff removal) never read a team's bank account (D1).
--
-- KEYED TO THE ACCOUNT, NOT THE ORG (Finding #54): bank_checks is keyed only by bank_account_id, and a team's account
-- MOVES with the team into a club (move_team_into_club c_moves re-keys bank_accounts.org_id). A draft carrying its own
-- org_id would point at the shadow org after a move. The org is one hop away through bank_accounts.org_id (CASCADE), so a
-- rename never orphans it (the browser key used the club's slug) and a team move carries it.
--
-- HOW A ROW GOES: Save this check and Start over (the routes); 30 days after the last change (the sweep); the account,
-- its team or its org deleted (FK CASCADE through bank_accounts); the person deleted (FK CASCADE from auth.users); the
-- person loses write access (club member removed or Accounting taken away; coach staff removed or money write taken away:
-- the routes that do it delete the person's rows, and every read of an account deletes a colleague's row whose owner can
-- no longer save a check there); a coach's season rolls over or closes (lib/rep-season-rollover.ts, both portals' callers).
--
-- SERVICE ROLE ONLY (RLS on, no policies, anon/authenticated revoked; both functions invoker's rights, execute for
-- service_role only). The table is visible to check:migrations; the functions are not: MANUAL_PROD_STEPS.json. Apply
-- before the S7 code. Re-runnable.
-- ---------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.bank_check_drafts (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id           uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  statement_end_date        date NOT NULL,
  balance_text              text NOT NULL DEFAULT '',
  cash_text                 text,
  marked_keys               text[] NOT NULL DEFAULT '{}',
  started_date              date,
  started_balance_text      text,
  started_difference_cents  bigint,
  revision                  integer NOT NULL DEFAULT 1,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  expires_at                timestamptz NOT NULL,
  CONSTRAINT bank_check_drafts_one_per_person UNIQUE (bank_account_id, user_id),
  CONSTRAINT bank_check_drafts_balance_len CHECK (length(balance_text) <= 32),
  CONSTRAINT bank_check_drafts_cash_len CHECK (cash_text IS NULL OR length(cash_text) BETWEEN 1 AND 32),
  CONSTRAINT bank_check_drafts_marked_count CHECK (cardinality(marked_keys) <= 500),
  CONSTRAINT bank_check_drafts_started_shape CHECK (
    (started_date IS NULL) = (started_balance_text IS NULL)
    AND (started_date IS NULL) = (started_difference_cents IS NULL)
    AND (started_balance_text IS NULL OR length(started_balance_text) <= 32)
  ),
  CONSTRAINT bank_check_drafts_revision_positive CHECK (revision >= 1),
  CONSTRAINT bank_check_drafts_expires_after_change CHECK (expires_at > updated_at)
);

-- The unique (bank_account_id, user_id) covers the account reads and the account cascade.
CREATE INDEX IF NOT EXISTS bank_check_drafts_user_idx ON public.bank_check_drafts (user_id);
CREATE INDEX IF NOT EXISTS bank_check_drafts_expires_idx ON public.bank_check_drafts (expires_at);

ALTER TABLE public.bank_check_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bank_check_drafts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_check_drafts TO service_role;

COMMENT ON TABLE public.bank_check_drafts IS
  'One person''s unfinished bank check on one bank account (S7, mig 522). Mine only; keys of marked lines, never figures. Goes 30 days after the last change (expires_at, swept nightly by mig 523).';

-- (2) The sweep. Invoker's rights, as every bank function (the nightly job runs as the database owner).
CREATE OR REPLACE FUNCTION public.bank_check_drafts_sweep() RETURNS integer
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_n integer;
BEGIN
  DELETE FROM bank_check_drafts WHERE expires_at < now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.bank_check_drafts_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bank_check_drafts_sweep() TO service_role;

-- (3) A team's work goes (ruling 2): its season rolls over or closes (p_user NULL: everyone's), or one coach leaves the
-- team or loses money write (p_user: theirs). Inside the database so the app's club-side code (the club's season door,
-- the club's staff removal) never reads a team's bank account (D1, owner 2026-11-06). Returns how many went.
CREATE OR REPLACE FUNCTION public.bank_check_drafts_discard_team(p_team uuid, p_user uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_n integer;
BEGIN
  DELETE FROM bank_check_drafts d
   USING bank_accounts a
   WHERE d.bank_account_id = a.id AND a.owner_kind = 'team' AND a.team_id = p_team
     AND (p_user IS NULL OR d.user_id = p_user);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.bank_check_drafts_discard_team(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bank_check_drafts_discard_team(uuid, uuid) TO service_role;

COMMIT;
