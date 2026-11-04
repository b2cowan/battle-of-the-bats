-- ---------------------------------------------------------------
-- Migration 436 — Bank reconciliation R1: a bank account, its checked statements, and the ticks beside the money
-- (build prompt docs/projects/active/BANK_RECONCILIATION_R1_BUILD_PROMPT.md; plan BANK_RECONCILIATION_PLAN.md §7 R1;
-- owner rulings 2026-11-04: asks B1–B12 and drawing asks 1–14, all A).
--
-- WHY: a club treasurer and a team's coach check their book against the bank statement, reach a Difference of
-- $0.00 and mark the statement checked. Nothing in the product knows a bank account, a statement or a tick today.
-- The arithmetic lives in lib/bank-check.ts (pure); these tables hold only what a person did.
--
-- THE SHAPE:
--   · bank_accounts — the unit (B1). A NAME, never a number (B12: no bank, transit or account number column, ever).
--     A club may have several; a team has exactly one, and it belongs to the TEAM, not a season (B10). The first
--     check's starting date and bank balance live here (B3).
--   · bank_account_books — which club book's money is in which account (Ask 13). An unmapped club book belongs to the
--     club's first account (oldest live one). A mapping table, not a column on accounting_ledgers, so the fiscal-year
--     lock never refuses a move.
--   · bank_checks — one statement: end date + ending balance (B3). Each starts where the previous one ended (derived,
--     never stored twice). A checked one keeps its outstanding list (B10). Undo reopens it with its ticks (Ask 9).
--   · bank_check_events — who checked, undid (with a reason) and checked again, when (B4, Asks 9 and 11). A check's
--     own history, like org_fiscal_year_reopenings; not a money audit table.
--   · bank_check_marks — THE TICK, a mark BESIDE the money (architectural decision 1): no column on
--     accounting_entries or any rep table. It keeps the line as it was checked, so "changed since" is a comparison.
--     One line ticks on one statement of one account (UNIQUE account + line_key).
--   · bank_check_added_lines — a bank fee, interest or payment-processing line added from a statement's helper
--     (B5, Asks 1, 7, 8): it ticks on that statement whatever its date.
--   · bank_check_changes — a ticked line edited or voided after its statement was checked: as checked, as now, who,
--     when; cleared by "Mark checked again" (B4, Ask 11). Written by the edit routes (R3, R6).
--   · bank_line_exclusions — "Didn't go through the bank" (B6, Ask 6); deleting the row is "Put it back".
--   · bank_saved_lines — lines the account itself holds, outside any book: the first check's still-outstanding items,
--     picked from a book or typed (Ask 3), and the lines carried at Start next season (Ask 12; R4 wires the trigger).
--
-- line_key: `entry:{accounting_entries.id}` (club), the register row id of a settled coach row (`money-in-{uuid}`,
-- `expense-{uuid}-payment-{uuid}` …), `payout:{po_id}` (automatic Stripe payout), `typed:{bank_saved_lines.id}`.
-- No year column anywhere: nothing about a check is keyed to a fiscal year or a season (B3, B10).
--
-- WHAT CHANGES: nine new tables and one trigger function (bank_account_books_guard). RLS on, no policies, grants
-- revoked from anon and authenticated; the service role reads and writes them from the server routes (DATA_DICTIONARY
-- maintenance rule 7), which decide access with the existing money permissions: club, canOpenModule accounting to
-- read and canMoveClubMoney to write (B7); team, canViewMoney / money write. No existing table, function or row changes.
--
-- Re-runnable. Prod order: any time before the promote that ships R2 (the club's Bank tab reads these tables).
-- ---------------------------------------------------------------

BEGIN;

-- ── the account ──────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_kind            text NOT NULL CHECK (owner_kind IN ('club', 'team')),
  team_id               uuid REFERENCES public.rep_teams(id) ON DELETE CASCADE,
  name                  text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 80),
  opening_date          date,
  opening_balance_cents bigint,
  set_up_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  set_up_at             timestamptz,
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  archived_at           timestamptz,
  CONSTRAINT bank_accounts_owner_shape CHECK ((owner_kind = 'team') = (team_id IS NOT NULL)),
  CONSTRAINT bank_accounts_opening_pair CHECK ((opening_date IS NULL) = (opening_balance_cents IS NULL)
    AND (opening_date IS NULL OR set_up_at IS NOT NULL))
);
-- A team has exactly one live account (B1).
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_one_per_team ON public.bank_accounts (team_id)
  WHERE owner_kind = 'team' AND archived_at IS NULL;
-- A club's live accounts have distinct names.
CREATE UNIQUE INDEX IF NOT EXISTS bank_accounts_club_name ON public.bank_accounts (org_id, lower(name))
  WHERE owner_kind = 'club' AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS bank_accounts_org_idx ON public.bank_accounts (org_id, created_at);
CREATE INDEX IF NOT EXISTS bank_accounts_set_up_by_idx ON public.bank_accounts (set_up_by) WHERE set_up_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS bank_accounts_created_by_idx ON public.bank_accounts (created_by) WHERE created_by IS NOT NULL;

-- ── which club book is in which account (Ask 13) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_account_books (
  ledger_id        uuid PRIMARY KEY REFERENCES public.accounting_ledgers(id) ON DELETE CASCADE,
  bank_account_id  uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  moved_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moved_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bank_account_books_account_idx ON public.bank_account_books (bank_account_id);
CREATE INDEX IF NOT EXISTS bank_account_books_moved_by_idx ON public.bank_account_books (moved_by) WHERE moved_by IS NOT NULL;

-- A club book maps only to a CLUB account of its own club; a team book never maps (a team has its own account).
CREATE OR REPLACE FUNCTION public.bank_account_books_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_acct public.bank_accounts%ROWTYPE;
  v_ledger public.accounting_ledgers%ROWTYPE;
BEGIN
  SELECT * INTO v_acct FROM public.bank_accounts WHERE id = NEW.bank_account_id;
  SELECT * INTO v_ledger FROM public.accounting_ledgers WHERE id = NEW.ledger_id;
  IF v_acct.owner_kind IS DISTINCT FROM 'club' THEN
    RAISE EXCEPTION 'bank_book_not_club_account' USING ERRCODE = 'check_violation';
  END IF;
  IF v_ledger.entity_type = 'team' THEN
    RAISE EXCEPTION 'bank_book_is_team_book' USING ERRCODE = 'check_violation';
  END IF;
  IF v_ledger.org_id IS DISTINCT FROM v_acct.org_id THEN
    RAISE EXCEPTION 'bank_book_other_club' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.bank_account_books_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS bank_account_books_guard ON public.bank_account_books;
CREATE TRIGGER bank_account_books_guard BEFORE INSERT OR UPDATE ON public.bank_account_books
  FOR EACH ROW EXECUTE FUNCTION public.bank_account_books_guard();

-- ── a statement ──────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_checks (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id                 uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  statement_end_date              date NOT NULL,
  statement_ending_balance_cents  bigint NOT NULL,
  status                          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'checked')),
  checked_by                      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at                      timestamptz,
  outstanding_snapshot            jsonb CHECK (outstanding_snapshot IS NULL OR jsonb_typeof(outstanding_snapshot) = 'array'),
  created_by                      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_checks_one_per_end_date UNIQUE (bank_account_id, statement_end_date),
  -- The target of bank_check_marks' composite FK: a tick can only point at a statement of ITS OWN account.
  CONSTRAINT bank_checks_id_account UNIQUE (id, bank_account_id),
  CONSTRAINT bank_checks_checked_has_when CHECK (status = 'open' OR (checked_at IS NOT NULL AND outstanding_snapshot IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS bank_checks_checked_by_idx ON public.bank_checks (checked_by) WHERE checked_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS bank_checks_created_by_idx ON public.bank_checks (created_by) WHERE created_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.bank_check_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id         uuid NOT NULL REFERENCES public.bank_checks(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('checked', 'undone', 'checked_again')),
  reason           text CHECK (reason IS NULL OR (reason = btrim(reason) AND char_length(reason) BETWEEN 1 AND 500)),
  by_user          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_check_events_undo_has_reason CHECK (kind <> 'undone' OR reason IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS bank_check_events_check_idx ON public.bank_check_events (check_id, at);
CREATE INDEX IF NOT EXISTS bank_check_events_by_idx ON public.bank_check_events (by_user) WHERE by_user IS NOT NULL;

-- ── the tick ─────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_check_marks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id  uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  check_id         uuid NOT NULL,
  line_key         text NOT NULL CHECK (char_length(line_key) BETWEEN 3 AND 200),
  line_date        date NOT NULL,
  direction        text NOT NULL CHECK (direction IN ('in', 'out')),
  amount_cents     bigint NOT NULL CHECK (amount_cents >= 0),
  payout_key       text CHECK (payout_key IS NULL OR payout_key LIKE 'payout:%'),
  marked_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  marked_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_check_marks_one_tick UNIQUE (bank_account_id, line_key),
  CONSTRAINT bank_check_marks_check_same_account FOREIGN KEY (check_id, bank_account_id)
    REFERENCES public.bank_checks (id, bank_account_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS bank_check_marks_check_idx ON public.bank_check_marks (check_id);
CREATE INDEX IF NOT EXISTS bank_check_marks_by_idx ON public.bank_check_marks (marked_by) WHERE marked_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.bank_check_added_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id         uuid NOT NULL REFERENCES public.bank_checks(id) ON DELETE CASCADE,
  line_key         text NOT NULL CHECK (char_length(line_key) BETWEEN 3 AND 200),
  kind             text NOT NULL CHECK (kind IN ('bank_fee', 'interest', 'payment_processing')),
  added_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_check_added_lines_once UNIQUE (check_id, line_key)
);
CREATE INDEX IF NOT EXISTS bank_check_added_lines_by_idx ON public.bank_check_added_lines (added_by) WHERE added_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.bank_check_changes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id          uuid NOT NULL REFERENCES public.bank_checks(id) ON DELETE CASCADE,
  line_key          text NOT NULL CHECK (char_length(line_key) BETWEEN 3 AND 200),
  was_date          date NOT NULL,
  was_direction     text NOT NULL CHECK (was_direction IN ('in', 'out')),
  was_amount_cents  bigint NOT NULL CHECK (was_amount_cents >= 0),
  now_date          date,
  now_direction     text CHECK (now_direction IS NULL OR now_direction IN ('in', 'out')),
  now_amount_cents  bigint CHECK (now_amount_cents IS NULL OR now_amount_cents >= 0),
  removed           boolean NOT NULL DEFAULT false,
  changed_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at        timestamptz NOT NULL DEFAULT now(),
  cleared_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cleared_at        timestamptz,
  CONSTRAINT bank_check_changes_now_shape CHECK (removed OR (now_date IS NOT NULL AND now_direction IS NOT NULL
    AND now_amount_cents IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS bank_check_changes_open_idx ON public.bank_check_changes (check_id) WHERE cleared_at IS NULL;
CREATE INDEX IF NOT EXISTS bank_check_changes_check_idx ON public.bank_check_changes (check_id, changed_at);
CREATE INDEX IF NOT EXISTS bank_check_changes_changed_by_idx ON public.bank_check_changes (changed_by) WHERE changed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS bank_check_changes_cleared_by_idx ON public.bank_check_changes (cleared_by) WHERE cleared_by IS NOT NULL;

-- ── kept out, and lines the account holds itself ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bank_line_exclusions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id  uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  line_key         text NOT NULL CHECK (char_length(line_key) BETWEEN 3 AND 200),
  excluded_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  excluded_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_line_exclusions_once UNIQUE (bank_account_id, line_key)
);
CREATE INDEX IF NOT EXISTS bank_line_exclusions_by_idx ON public.bank_line_exclusions (excluded_by) WHERE excluded_by IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.bank_saved_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id  uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('opening_picked', 'opening_typed', 'carried')),
  line_key         text NOT NULL CHECK (char_length(line_key) BETWEEN 3 AND 200),
  line_date        date NOT NULL,
  direction        text NOT NULL CHECK (direction IN ('in', 'out')),
  amount_cents     bigint NOT NULL CHECK (amount_cents > 0),
  description      text CHECK (description IS NULL OR (description = btrim(description) AND char_length(description) BETWEEN 1 AND 200)),
  saved_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  saved_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_saved_lines_once UNIQUE (bank_account_id, line_key),
  -- A typed line's key IS its own id (the engine's `typed:{id}`), and no other kind may claim a typed: key.
  CONSTRAINT bank_saved_lines_typed_shape CHECK (
    (kind = 'opening_typed' AND line_key = 'typed:' || id::text AND description IS NOT NULL)
    OR (kind <> 'opening_typed' AND line_key NOT LIKE 'typed:%'))
);
CREATE INDEX IF NOT EXISTS bank_saved_lines_by_idx ON public.bank_saved_lines (saved_by) WHERE saved_by IS NOT NULL;

-- ── access: the server only (DATA_DICTIONARY maintenance rule 7) ─────────────────────────────────
ALTER TABLE public.bank_accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_account_books      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_checks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_check_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_check_marks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_check_added_lines  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_check_changes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_line_exclusions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_saved_lines        ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.bank_accounts, public.bank_account_books, public.bank_checks, public.bank_check_events,
  public.bank_check_marks, public.bank_check_added_lines, public.bank_check_changes, public.bank_line_exclusions,
  public.bank_saved_lines FROM anon, authenticated;
-- The server's own access (Supabase stopped auto-granting new tables 2026-10-30; tests/unit/migration-table-grants-guard.test.ts).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_account_books TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_checks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_check_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_check_marks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_check_added_lines TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_check_changes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_line_exclusions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_saved_lines TO service_role;

COMMENT ON TABLE public.bank_accounts IS 'Bank reconciliation R1 (mig 436): a bank account a club or a team checks statements against. A NAME, never a number. Team: exactly one, belongs to the team (not a season). Holds the first check''s starting date + balance. Service role only.';
COMMENT ON TABLE public.bank_account_books IS 'Bank reconciliation R1 (mig 436): which club book''s money is in which club account. Unmapped = the club''s first (oldest live) account. Never a team book (trigger). Service role only.';
COMMENT ON TABLE public.bank_checks IS 'Bank reconciliation R1 (mig 436): one bank statement (end date + ending balance). Starts where the previous one ended (derived). Checked = $0.00 difference; keeps its outstanding list. Undo reopens it with ticks kept. Service role only.';
COMMENT ON TABLE public.bank_check_events IS 'Bank reconciliation R1 (mig 436): who checked, undid (with a reason) or checked again a statement, and when. Service role only.';
COMMENT ON TABLE public.bank_check_marks IS 'Bank reconciliation R1 (mig 436): THE TICK, a mark beside the money (never a column on the money). Keeps the line as checked. One line ticks once per account. Service role only.';
COMMENT ON TABLE public.bank_check_added_lines IS 'Bank reconciliation R1 (mig 436): a fee / interest / payment-processing line added from a statement''s helper; ticks on that statement whatever its date (Ask 8). Service role only.';
COMMENT ON TABLE public.bank_check_changes IS 'Bank reconciliation R1 (mig 436): a ticked line edited or voided after its statement was checked (as checked / as now / who / when); cleared by Mark checked again. Service role only.';
COMMENT ON TABLE public.bank_line_exclusions IS 'Bank reconciliation R1 (mig 436): "Didn''t go through the bank" (B6). Deleting the row is Put it back. Service role only.';
COMMENT ON TABLE public.bank_saved_lines IS 'Bank reconciliation R1 (mig 436): lines the account holds outside any book: the first check''s still-outstanding items (picked or typed) and lines carried at Start next season. Service role only.';
COMMENT ON COLUMN public.bank_check_marks.line_key IS 'entry:{accounting_entries.id} | a settled coach register row id | payout:{po_id} | typed:{bank_saved_lines.id}.';
COMMENT ON COLUMN public.bank_checks.outstanding_snapshot IS 'JSON array of {key,date,direction,amountCents,label?}: what was still outstanding when marked checked (B10).';

COMMIT;
