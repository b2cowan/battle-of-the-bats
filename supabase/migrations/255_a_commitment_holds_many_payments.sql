-- ---------------------------------------------------------------
-- Migration 255 — a commitment holds many payments (Payables Rebuild, P1)
--
-- Owner approval 2026-08-19 from mockups (artifact da11c0eb). Plan:
-- docs/projects/active/COACH_PAYABLES_REBUILD_PLAN.md. Owner QA §64.
--
-- ⚠⚠ THE ORIGIN IS WORTH RECORDING, because it is the argument for the shape.
-- The owner walked QA §27 — "correcting a money record" — on 2026-08-19 and it
-- PASSED CLEAN. Everything that section checks, the product does correctly. He
-- then found four things the product cannot do AT ALL, none of which a checklist
-- of existing behaviour could have surfaced:
--
--   1. You cannot pay PART of a commitment. Unless a deposit/balance split was
--      set up BEFORE any money moved, the only control is "Mark paid", and it
--      means paid in full. A $600 entry where the club takes $200 today has
--      nowhere to go.
--   2. Mark paid CANNOT BE UNDONE. There is no un-settle action anywhere in the
--      product. A mis-tap posts real money out of the books and the only
--      correction is deleting the whole commitment — which also destroys the
--      other half's dates.
--   3. A paid row on the payment Schedule is a DEAD END, while the same record
--      is fully editable from Commitments. (The 2026-08-16 no-read-only ruling
--      is honoured; the DOOR was missing.)
--   4. Nothing repeats. A monthly dome block can only be entered by pasting
--      rows through the importer.
--
-- All four are one root cause: money going OUT carries a single boolean per
-- half, and the deposit/balance pair was the only concession to the fact that
-- money arrives in pieces. This migration replaces that with the shape money-IN
-- has used since migration 232 — a PLAN, and separately the PAYMENTS recorded
-- against it. `rep_player_dues_installments` + `rep_dues_payments` on one side,
-- these two tables on the other. One vocabulary across the Money tab.
--
-- ⚠⚠ THIS MIGRATION MUST NOT MOVE THE BOOKS BY ONE CENT. It re-expresses
-- settled money; it does not re-post it. Every backfilled payment CARRIES the
-- accounting entry its half already created (deposit_entry_id /
-- balance_entry_id / accounting_entry_id) rather than creating a new one. No
-- row is written to accounting_entries here. §64 Part A is exactly this test:
-- cash on hand, Budget vs. Actual and the next-30 figure identical to the cent.
--
-- ⚠ THE OLD COLUMNS ARE NOT DROPPED HERE. deposit_*/balance_*/expense_paid_at
-- stay in place and keep being written by the existing code until every reader
-- has moved (P1 §6 lists ~20 of them). Dropping them is a LATER migration, once
-- the drift check proves nothing reads them. A drop in this migration would
-- make the "books did not move" test unfalsifiable, because there would be
-- nothing left to compare against.
-- ---------------------------------------------------------------

BEGIN;

-- ── The plan ───────────────────────────────────────────────────────────────
--
-- ⚠ R1: EVERY COMMITMENT HAS AT LEAST ONE INSTALLMENT. The one-payment case is
-- a one-installment commitment, which is what permanently kills the current
-- "No schedule" state — a payable with an amount but no due date, invisible to
-- the payment schedule, absent from Due next / Next 30 days, and with no Mark
-- paid control anywhere. That state stops being representable rather than
-- staying representable and being warned about (the payables panel carries a
-- comment block today whose only job is to explain it).
--
-- ⚠ R2: the commitment's TOTAL is the sum of its installments. Derived, never
-- separately typed. `rep_team_expenses.amount` survives P1 as the legacy column
-- and is reconciled against this sum by the P1 verification, not trusted.
CREATE TABLE rep_payable_installments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The commitment. CASCADE: an installment has no meaning without it, and
  -- deleting a commitment already reverses its money by its own path.
  expense_id          uuid NOT NULL REFERENCES rep_team_expenses(id) ON DELETE CASCADE,
  -- Denormalised for the same reason every other rep_* money table carries
  -- them: every read is scoped by org+team before it is scoped by anything
  -- else, and a join to reach the scope is a join that can be forgotten.
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id             uuid NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  program_year_id     uuid NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,

  -- 1-based, contiguous within a commitment. Renumbered on insert/remove so the
  -- coach-facing "Installment 3 of 6" is read straight off the row rather than
  -- computed from an ordering that a later date edit could silently change.
  installment_number  integer NOT NULL CHECK (installment_number >= 1),
  amount              numeric(12,2) NOT NULL CHECK (amount > 0),
  due_date            date NOT NULL,

  -- ⚠⚠ NO paid_at COLUMN, DELIBERATELY, AND THIS IS THE WHOLE POINT OF THE
  -- MIGRATION. "Settled" is not a fact stored here — it is what you get when
  -- the payments applied to this installment sum to its amount. Storing a flag
  -- beside the payments is how a boolean and a total start disagreeing, which
  -- is the class of bug the dues side already learned (mig 232: paid_at is a
  -- PROJECTION, never the source). R4 — settled means paid IN FULL; anything
  -- short is PARTLY PAID and counts as UNPAID everywhere: filters, the bulk
  -- edit scopes, the schedule, the Overview's next-30 panel.

  source              text NOT NULL DEFAULT 'manual',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rep_payable_installments_number_key UNIQUE (expense_id, installment_number)
);

CREATE INDEX rep_payable_installments_expense_idx
  ON rep_payable_installments (expense_id, installment_number);
-- The payment schedule and the Overview's next-30 read by team and date.
CREATE INDEX rep_payable_installments_team_due_idx
  ON rep_payable_installments (team_id, due_date);
CREATE INDEX rep_payable_installments_year_idx
  ON rep_payable_installments (program_year_id);

ALTER TABLE rep_payable_installments ENABLE ROW LEVEL SECURITY;


-- ── What actually happened ─────────────────────────────────────────────────
--
-- ⚠ R3: A PAYMENT IS RECORDED AGAINST THE COMMITMENT, NOT AGAINST AN
-- INSTALLMENT. A coach handing over one $700 cheque covering a full month and
-- half the next must not be asked to do that arithmetic — the application rule
-- (oldest unpaid first, spilling forward) lives in code and is re-derived, so a
-- later edit to an installment's amount re-applies rather than stranding money
-- against a figure that no longer exists.
--
-- `installment_id` is the coach's OVERRIDE — "this payment was for March" —
-- and is null for the ordinary case. It is a hint to the application rule, not
-- a second source of truth about what is settled.
--
-- ⚠⚠ R5: UNDO IS DELETING ONE OF THESE ROWS, and the books reverse by exactly
-- this row's amount, reading `accounting_entry_id`. NEVER by matching on
-- description — migration 236 exists because editable descriptions made that
-- guess unsafe, and this table is the first money-out record that has never had
-- to guess.
CREATE TABLE rep_payable_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id          uuid NOT NULL REFERENCES rep_team_expenses(id) ON DELETE CASCADE,
  org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id             uuid NOT NULL REFERENCES rep_teams(id) ON DELETE CASCADE,
  program_year_id     uuid NOT NULL REFERENCES rep_program_years(id) ON DELETE CASCADE,

  -- The coach's override of the application rule. SET NULL, not CASCADE: losing
  -- the hint must never delete the record of money that left the account.
  installment_id      uuid REFERENCES rep_payable_installments(id) ON DELETE SET NULL,

  -- ⚠ R6: OVER-PAYMENT IS ACCEPTED, NOT REFUSED. There is deliberately no CHECK
  -- tying the sum of payments to the commitment's total. The money genuinely
  -- left the account; refusing to record it teaches coaches to type a figure
  -- that is not what happened, which is how a book stops matching a statement.
  -- The screen SAYS "$50 over"; the database does not argue with reality.
  amount              numeric(12,2) NOT NULL CHECK (amount > 0),
  paid_date           date NOT NULL,
  method              text,
  note                text,

  -- The ledger row this payment posted. ⚠ NULL is legitimate and means "no team
  -- cash moved" — an out-of-pocket cost a family paid, which creates a credit
  -- the team owes that household and never posts a cash entry (mig 234, owner
  -- Call 5). Reversing an entry that was never written would credit the team
  -- for spending it never did.
  accounting_entry_id uuid REFERENCES accounting_entries(id) ON DELETE SET NULL,

  source              text NOT NULL DEFAULT 'manual',
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rep_payable_payments_expense_idx
  ON rep_payable_payments (expense_id, paid_date);
CREATE INDEX rep_payable_payments_installment_idx
  ON rep_payable_payments (installment_id);
-- Budget vs. Actual → Months files a cost by the date it was PAID.
CREATE INDEX rep_payable_payments_team_date_idx
  ON rep_payable_payments (team_id, paid_date);
CREATE INDEX rep_payable_payments_year_idx
  ON rep_payable_payments (program_year_id);
CREATE INDEX rep_payable_payments_entry_idx
  ON rep_payable_payments (accounting_entry_id);

ALTER TABLE rep_payable_payments ENABLE ROW LEVEL SECURITY;


-- ── Backfill: every existing commitment, re-expressed ──────────────────────
--
-- ⚠⚠ READ THE SHAPES BEFORE CHANGING ANY OF THIS. `rep_team_expenses` holds
-- two different kinds of record under one table, and they backfill differently:
--
--   * expense_type = 'tournament_payable' — a COMMITMENT. Carries the
--     deposit/balance pair. Its due dates live in deposit_due_date /
--     balance_due_date, and an UN-SPLIT commitment stores its one due date as
--     the DEPOSIT half with no balance (the convention the payables form and
--     the bulk importer have both always used).
--   * anything else — an ordinary cost, already-happened by definition. It has
--     expense_paid_at and no schedule at all.
--
-- Both become "a commitment with installments and payments", because the whole
-- point is that there is now one shape. An ordinary cost is a one-installment
-- commitment that was paid the day it was recorded.

-- ── 1 · Payables WITH a real deposit/balance split ─────────────────────────
-- Two installments. A half with a due date but no amount takes the remainder,
-- and a half with an amount but no date takes the other half's date — both
-- states exist in live data and neither may drop a row (R1).
INSERT INTO rep_payable_installments
  (expense_id, org_id, team_id, program_year_id, installment_number, amount, due_date, source)
SELECT
  e.id, e.org_id, e.team_id, e.program_year_id,
  1,
  COALESCE(e.deposit_amount, GREATEST(e.amount - COALESCE(e.balance_amount, 0), 0.01)),
  COALESCE(e.deposit_due_date, e.balance_due_date, e.created_at::date),
  'migration_255'
FROM rep_team_expenses e
WHERE e.expense_type = 'tournament_payable'
  AND (e.balance_amount IS NOT NULL OR e.balance_due_date IS NOT NULL);

INSERT INTO rep_payable_installments
  (expense_id, org_id, team_id, program_year_id, installment_number, amount, due_date, source)
SELECT
  e.id, e.org_id, e.team_id, e.program_year_id,
  2,
  COALESCE(e.balance_amount, GREATEST(e.amount - COALESCE(e.deposit_amount, 0), 0.01)),
  COALESCE(e.balance_due_date, e.deposit_due_date, e.created_at::date),
  'migration_255'
FROM rep_team_expenses e
WHERE e.expense_type = 'tournament_payable'
  AND (e.balance_amount IS NOT NULL OR e.balance_due_date IS NOT NULL);

-- ── 2 · Payables with NO split — one installment ───────────────────────────
-- ⚠ This is where the "No schedule" records get their date. A commitment with
-- an amount and no due date at all was invisible to every schedule surface;
-- COALESCE to created_at gives it one, which is the point of R1. It will now
-- appear on the payment schedule — expected, and called out in §64 Part A so
-- the walk does not read it as a defect.
INSERT INTO rep_payable_installments
  (expense_id, org_id, team_id, program_year_id, installment_number, amount, due_date, source)
SELECT
  e.id, e.org_id, e.team_id, e.program_year_id,
  1,
  COALESCE(NULLIF(e.deposit_amount, 0), e.amount),
  COALESCE(e.deposit_due_date, e.created_at::date),
  'migration_255'
FROM rep_team_expenses e
WHERE e.expense_type = 'tournament_payable'
  AND e.balance_amount IS NULL
  AND e.balance_due_date IS NULL;

-- ── 3 · Ordinary costs — one installment, dated when it was paid ───────────
INSERT INTO rep_payable_installments
  (expense_id, org_id, team_id, program_year_id, installment_number, amount, due_date, source)
SELECT
  e.id, e.org_id, e.team_id, e.program_year_id,
  1, e.amount,
  COALESCE(e.expense_paid_at::date, e.created_at::date),
  'migration_255'
FROM rep_team_expenses e
WHERE e.expense_type <> 'tournament_payable';

-- ── 4 · Settled deposits become payments, CARRYING their ledger entry ──────
-- ⚠⚠ `deposit_entry_id` is carried, never recreated. Where it is null the half
-- was paid before migration 236 and the link was never recorded; the payment
-- row is still written (the money DID move and the coach must see it) with a
-- null entry, and the existing description-matching reversal path continues to
-- serve those records until they are settled or deleted. Writing a NEW
-- accounting entry here would double the team's spending.
INSERT INTO rep_payable_payments
  (expense_id, org_id, team_id, program_year_id, installment_id, amount, paid_date,
   method, accounting_entry_id, source, created_by)
SELECT
  e.id, e.org_id, e.team_id, e.program_year_id,
  i.id,
  COALESCE(e.deposit_amount, e.amount),
  e.deposit_paid_at::date,
  e.payment_method,
  e.deposit_entry_id,
  'migration_255',
  e.created_by
FROM rep_team_expenses e
JOIN rep_payable_installments i
  ON i.expense_id = e.id AND i.installment_number = 1
WHERE e.expense_type = 'tournament_payable'
  AND e.deposit_paid_at IS NOT NULL;

-- ── 5 · Settled balances become payments ───────────────────────────────────
INSERT INTO rep_payable_payments
  (expense_id, org_id, team_id, program_year_id, installment_id, amount, paid_date,
   method, accounting_entry_id, source, created_by)
SELECT
  e.id, e.org_id, e.team_id, e.program_year_id,
  i.id,
  COALESCE(e.balance_amount, e.amount),
  e.balance_paid_at::date,
  e.payment_method,
  e.balance_entry_id,
  'migration_255',
  e.created_by
FROM rep_team_expenses e
JOIN rep_payable_installments i
  ON i.expense_id = e.id AND i.installment_number = 2
WHERE e.expense_type = 'tournament_payable'
  AND e.balance_paid_at IS NOT NULL;

-- ── 6 · Settled ordinary costs become payments ─────────────────────────────
-- ⚠ An out-of-pocket cost (paid_by_player_id set) is INCLUDED — a payment
-- happened, a family made it — but carries a NULL accounting entry, because no
-- team cash entry was ever posted for it. `accounting_entry_id` on the expense
-- is null for those records already, so this SELECT is correct as written; the
-- rule is restated here because a future "tidy-up" that COALESCEs it to
-- something non-null would credit the team for money it never spent.
INSERT INTO rep_payable_payments
  (expense_id, org_id, team_id, program_year_id, installment_id, amount, paid_date,
   method, accounting_entry_id, source, created_by)
SELECT
  e.id, e.org_id, e.team_id, e.program_year_id,
  i.id, e.amount, e.expense_paid_at::date,
  e.payment_method,
  e.accounting_entry_id,
  'migration_255',
  e.created_by
FROM rep_team_expenses e
JOIN rep_payable_installments i
  ON i.expense_id = e.id AND i.installment_number = 1
WHERE e.expense_type <> 'tournament_payable'
  AND e.expense_paid_at IS NOT NULL;

-- ── 7 · ⚠⚠ THE INVISIBLE MONEY — payables settled through the wrong door ───
--
-- A payable CANNOT be settled through `markExpensePaid` today: the route
-- refuses it. That guard was added on 2026-08-16 and its own comment records
-- that the hole was PRE-EXISTING, so records that went through it before that
-- date still exist. What such a record looks like:
--
--   * a ledger entry was posted for the payable's FULL amount, under the plain
--     description (no "— Deposit" / "— Balance" suffix), and
--   * `paidLedgerLegs` reads ONLY the deposit and balance stamps for a payable,
--     so that entry is invisible to every screen. Both halves could still be
--     marked paid afterwards, posting the same money a second and third time,
--     and deleting the record reversed $0 while the entry stayed on the books
--     forever with nothing able to find it.
--
-- ⚠ SKIPPING THESE WOULD LOSE THEM AGAIN. The money is on the books; a model
-- that cannot see it is how it stayed hidden in the first place. So the payment
-- is written, carrying its entry, under its own `source` so it can be found.
--
-- ⚠⚠ WHERE A RECORD WAS DOUBLE-POSTED THIS DELIBERATELY PRODUCES AN
-- OVER-PAYMENT, and that is the correct outcome, not a bug to smooth over.
-- R6 accepts over-payment and the screen states it — so a commitment that was
-- charged twice now READS as charged twice, for the first time since it
-- happened. Reconcile these by hand from the query at the foot of this file
-- before P1 is called done; do NOT "fix" them by dropping rows here, which
-- would restore exactly the invisibility this case exists to end.
INSERT INTO rep_payable_payments
  (expense_id, org_id, team_id, program_year_id, installment_id, amount, paid_date,
   method, accounting_entry_id, source, created_by)
SELECT
  e.id, e.org_id, e.team_id, e.program_year_id,
  i.id, e.amount, e.expense_paid_at::date,
  e.payment_method,
  e.accounting_entry_id,
  'migration_255_wrong_door',
  e.created_by
FROM rep_team_expenses e
JOIN rep_payable_installments i
  ON i.expense_id = e.id AND i.installment_number = 1
WHERE e.expense_type = 'tournament_payable'
  AND e.expense_paid_at IS NOT NULL;

COMMIT;

-- ---------------------------------------------------------------
-- Verification — run these after applying. §64 Part A is the human half of the
-- same test; these three are the machine half and all must return zero rows.
--
-- 1 · EVERY commitment has at least one installment (R1):
--
--   SELECT e.id, e.description
--     FROM rep_team_expenses e
--     LEFT JOIN rep_payable_installments i ON i.expense_id = e.id
--    WHERE i.id IS NULL;
--
-- 2 · Installment totals reconcile with the legacy amount (R2). A row here is
--     not automatically a defect — a payable whose halves never summed to its
--     total is pre-existing bad data this migration surfaces rather than
--     creates — but every row must be LOOKED AT before P1 is called done:
--
--   SELECT e.id, e.description, e.amount, SUM(i.amount) AS installments
--     FROM rep_team_expenses e
--     JOIN rep_payable_installments i ON i.expense_id = e.id
--    GROUP BY e.id, e.description, e.amount
--   HAVING ABS(e.amount - SUM(i.amount)) > 0.005;
--
-- 3 · ⚠⚠ THE BOOKS DID NOT MOVE. Every ledger entry the old columns pointed at
--     is carried by exactly one payment, and no payment invented one:
--
--   SELECT 'orphaned entry' AS problem, e.id
--     FROM rep_team_expenses e
--    WHERE e.deposit_entry_id IS NOT NULL
--      AND NOT EXISTS (SELECT 1 FROM rep_payable_payments p
--                       WHERE p.accounting_entry_id = e.deposit_entry_id)
--   UNION ALL
--   SELECT 'orphaned entry', e.id
--     FROM rep_team_expenses e
--    WHERE e.balance_entry_id IS NOT NULL
--      AND NOT EXISTS (SELECT 1 FROM rep_payable_payments p
--                       WHERE p.accounting_entry_id = e.balance_entry_id)
--   UNION ALL
--   SELECT 'duplicated entry', p.accounting_entry_id
--     FROM rep_payable_payments p
--    WHERE p.accounting_entry_id IS NOT NULL
--    GROUP BY p.accounting_entry_id
--   HAVING COUNT(*) > 1;
--
-- 4 · ⚠⚠ THE WRONG-DOOR RECORDS (backfill case 7). Every row here is a payable
--     that was settled through `markExpensePaid` before that hole was closed on
--     2026-08-16, and its money has been on the books and invisible ever since.
--     THIS QUERY IS THE FIRST TIME THEY CAN BE SEEN. Expected to be empty or
--     near-empty; each row is reconciled BY HAND, not by deleting the payment:
--
--   SELECT e.id, e.description, e.amount,
--          SUM(p.amount) AS recorded,
--          COUNT(*) FILTER (WHERE p.source = 'migration_255_wrong_door') AS wrong_door
--     FROM rep_team_expenses e
--     JOIN rep_payable_payments p ON p.expense_id = e.id
--    WHERE EXISTS (SELECT 1 FROM rep_payable_payments w
--                   WHERE w.expense_id = e.id
--                     AND w.source = 'migration_255_wrong_door')
--    GROUP BY e.id, e.description, e.amount;
--
--     A row whose `recorded` exceeds `amount` was posted more than once. The
--     over-payment is REAL and is now visible; fix it by removing the duplicate
--     LEDGER entry through the ordinary undo path once P2 ships, which reverses
--     the books properly — never by deleting the payment row here, which would
--     hide the entry again with nothing left pointing at it.
-- ---------------------------------------------------------------
