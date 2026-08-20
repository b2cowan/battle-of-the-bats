/**
 * What a commitment's OLD columns say its plan and its payments are — migration 255's backfill,
 * expressed as code so the app can keep saying the same thing after the migration ran once.
 *
 * ⚠⚠ THIS MODULE IS TRANSITIONAL AND IS MEANT TO BE DELETED (Payables Rebuild, end of P2). It
 * exists because P1 moves every READER onto `rep_payable_installments` / `rep_payable_payments`
 * while the deposit/balance columns are still the thing the FORMS write. Without it, a payable
 * created the day after P1 ships would have no installment at all: invisible on the payment
 * schedule, absent from Budget vs. Actual's Scheduled column, uncounted by the Overview's next-30
 * panel, and impossible to mark paid. R1 ("every commitment has at least one installment") would be
 * true of every record the migration touched and false of every record made since.
 *
 * So P1's writers call this after every expense write and make the new tables say exactly what the
 * old columns say. It is the SAME arithmetic as the migration, deliberately — if the two ever
 * disagreed, a record's schedule would depend on whether it was created before or after a Tuesday.
 *
 * ⚠ ONE-WAY, ALWAYS. The old columns are the source, the new rows are the copy. P2 turns that round
 * — the form starts writing installments and payments directly — and this file goes with it. Do not
 * grow it a reverse direction in the meantime: two writers on one fact is the thing the whole
 * project exists to stop.
 *
 * Pure: no IO, no Date, no timezone library. See `paidDay` for why the date handling is a slice.
 */

/** The columns this reads. A subset of `RepTeamExpense`, named so a caller cannot pass the wrong row. */
export interface LegacyCommitmentRow {
  expenseType: 'expense' | 'tournament_payable';
  amount: number;
  expensePaidAt: string | null;
  depositAmount: number | null;
  depositDueDate: string | null;
  depositPaidAt: string | null;
  balanceAmount: number | null;
  balanceDueDate: string | null;
  balancePaidAt: string | null;
  accountingEntryId: string | null;
  depositEntryId: string | null;
  balanceEntryId: string | null;
  createdAt: string;
}

/** One piece of the plan the old columns describe. */
export interface LegacyInstallment {
  installmentNumber: number;
  amount: number;
  /** `YYYY-MM-DD`. Never null — R1's whole point is that a dateless commitment stops existing. */
  dueDate: string;
}

/** One movement of money the old columns record, and which piece of the plan it was for. */
export interface LegacyPayment {
  /** Which of the old columns this came from. The stable key a re-write matches an existing row on. */
  half: 'deposit' | 'balance' | 'expense' | 'wrong_door';
  /** The piece it is recorded against. 1-based, and always a piece the plan above actually has. */
  installmentNumber: number;
  amount: number;
  /** `YYYY-MM-DD`, the coach's own day. */
  paidDate: string;
  /** ⚠ NULL IS LEGITIMATE — an out-of-pocket cost, or a record settled before mig 236 linked one. */
  accountingEntryId: string | null;
}

/**
 * The day a `*_paid_at` stamp fell on, in the COACH's calendar.
 *
 * ⚠⚠ A NAIVE SLICE, AND THAT IS CORRECT — the same call, for the same reason, as `paidDayOf` in
 * `lib/coach-expense-movements.ts`. Every `*_paid_at` on `rep_team_expenses` is written at ORG NOON
 * (`orgDayAsStoredInstant`) precisely so this slice lands on the coach's own day: twelve hours from
 * either midnight, which no timezone this platform serves can cross. Converting it "properly" here
 * would make this module impure and would move dates that are already right.
 */
function paidDay(stamp: string): string {
  return stamp.slice(0, 10);
}

/** A stored amount that is really an amount. Zero and null both mean "this half carries nothing". */
function positive(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

/** The floor the migration used, so a remainder that works out to nothing still buys a row (R1). */
const MIN = 0.01;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The plan the old columns describe — 1 or 2 pieces, never zero.
 *
 * The three shapes, exactly as migration 255 backfilled them:
 *   · a payable with a REAL split (a balance amount or a balance due date) → two pieces. A half with
 *     a date and no amount takes the remainder; a half with an amount and no date takes the other
 *     half's date. Both states exist in live data and neither may drop a piece.
 *   · a payable with no split → one piece. ⚠ This is where the old "No schedule" record gets its
 *     date: a commitment with an amount and no due date at all was invisible to every schedule
 *     surface, and falling back to the day it was created is what makes R1 true of it.
 *   · anything else → one piece, dated when the money moved, or when it was recorded if it has not.
 */
export function legacyInstallmentPlan(e: LegacyCommitmentRow): LegacyInstallment[] {
  const createdDay = paidDay(e.createdAt);

  if (e.expenseType !== 'tournament_payable') {
    return [{
      installmentNumber: 1,
      amount: Math.max(round2(e.amount), MIN),
      dueDate: e.expensePaidAt ? paidDay(e.expensePaidAt) : createdDay,
    }];
  }

  const split = e.balanceAmount !== null || e.balanceDueDate !== null;
  if (!split) {
    return [{
      installmentNumber: 1,
      amount: Math.max(round2(positive(e.depositAmount) ?? e.amount), MIN),
      dueDate: e.depositDueDate ?? createdDay,
    }];
  }

  /* ⚠ DIVERGES FROM THE MIGRATION ON ONE INPUT, DELIBERATELY (`/review`, correctness lens,
     2026-08-19): a half stored as an explicit **0** takes the remainder here, where migration 255's
     `COALESCE` treated 0 as a real figure and clamped the piece to a cent. A $900 bill saved with a
     $0 deposit and a $600 balance planned as `$0.01 + $600` — short of its own total, breaking R2,
     and understating that piece everywhere it is scheduled. Zero and null both mean "nothing
     recorded for this half", which is already how the no-split branch and `legacyPayments` read them.
     ⚠ It changes no existing record: dev carries none of this shape, and the create door has no
     `> 0` validation, so the shape is reachable going FORWARD — which is the half that matters,
     because this function runs on every save and not only on the one-time backfill. */
  const depositHalf = positive(e.depositAmount);
  const balanceHalf = positive(e.balanceAmount);
  return [
    {
      installmentNumber: 1,
      amount: Math.max(round2(depositHalf ?? (e.amount - (balanceHalf ?? 0))), MIN),
      dueDate: e.depositDueDate ?? e.balanceDueDate ?? createdDay,
    },
    {
      installmentNumber: 2,
      amount: Math.max(round2(balanceHalf ?? (e.amount - (depositHalf ?? 0))), MIN),
      dueDate: e.balanceDueDate ?? e.depositDueDate ?? createdDay,
    },
  ];
}

/**
 * The payments the old columns record — one per settled half, each carrying the ledger entry that
 * half already created.
 *
 * ⚠⚠ THE ENTRY IS CARRIED, NEVER INVENTED. That is what makes "the books do not move" true: no
 * accounting entry is written on this path, so a payment is a NEW WAY TO READ money that already
 * left the account, not a second time it left.
 *
 * ⚠ `wrong_door` — a PAYABLE carrying `expense_paid_at`. It could only have been settled through
 * `markExpensePaid` before that hole was closed on 2026-08-16, and the money has been on the books
 * and invisible ever since (`paidLedgerLegs` reads only the two half-stamps for a payable). It is
 * emitted rather than skipped for the same reason migration 255 emitted it: a model that cannot see
 * the money is how it stayed hidden. Where the record was ALSO double-posted this produces a
 * genuine over-payment, which R6 accepts and the screen states.
 *
 * ⚠ A BALANCE ON A COMMITMENT WITH NO SECOND PIECE lands on the first one. Migration 255 joined
 * strictly on `installment_number = 2` and so dropped such a payment; this does not, because losing
 * a record of money that left the account is the worse of the two errors. Dev carries none of these
 * (the migration's own verification found zero orphaned entries), so the two agree on all live data.
 */
export function legacyPayments(e: LegacyCommitmentRow, plan: LegacyInstallment[]): LegacyPayment[] {
  const last = plan.length;
  const out: LegacyPayment[] = [];

  if (e.expenseType === 'tournament_payable') {
    if (e.depositPaidAt) {
      out.push({
        half: 'deposit',
        installmentNumber: 1,
        amount: round2(positive(e.depositAmount) ?? e.amount),
        paidDate: paidDay(e.depositPaidAt),
        accountingEntryId: e.depositEntryId,
      });
    }
    if (e.balancePaidAt) {
      out.push({
        half: 'balance',
        installmentNumber: Math.min(2, last),
        amount: round2(positive(e.balanceAmount) ?? e.amount),
        paidDate: paidDay(e.balancePaidAt),
        accountingEntryId: e.balanceEntryId,
      });
    }
    if (e.expensePaidAt) {
      out.push({
        half: 'wrong_door',
        installmentNumber: 1,
        amount: round2(e.amount),
        paidDate: paidDay(e.expensePaidAt),
        accountingEntryId: e.accountingEntryId,
      });
    }
    return out.filter(p => p.amount > 0);
  }

  if (e.expensePaidAt) {
    out.push({
      half: 'expense',
      installmentNumber: 1,
      amount: round2(e.amount),
      paidDate: paidDay(e.expensePaidAt),
      /* ⚠ NULL FOR AN OUT-OF-POCKET COST, and that is the point: a family's money moved and the
         team's did not, so no cash entry was ever posted (mig 234). The column is already null on
         those rows, so nothing special-cases it here — but a future "tidy-up" that COALESCEd it to
         something non-null would credit the team for spending it never did. */
      accountingEntryId: e.accountingEntryId,
    });
  }
  return out.filter(p => p.amount > 0);
}

/* ── Deciding what to write, apart from writing it ────────────────────────────────────────────
   ⚠⚠ THIS HALF IS PURE BECAUSE FOUR CALLERS NEED IT AND ONLY ONE OF THEM IS THE APP.
   `reconcileCommitmentRecords` (lib/db.ts) runs on every create and update; the demo seed, the UAT
   fixture and the QA-day fixture all write `rep_team_expenses` DIRECTLY with their own Supabase
   client, so none of them can call it. A commitment those seeders make with no installment is
   invisible to every money screen — which would mean a demo world with no money in it, and a
   `check:money-report` run reporting the fixture as lacking the very shape it was seeded to carry.

   Copying the rule into the seeders would have been the obvious fix and the wrong one: the QA
   fixture is what the owner walks §64 against, so a drifted copy would make the acceptance test
   agree with a bug. The DECISION lives here, unit-tested; each caller supplies only its own I/O. */

/** An installment as it is currently stored. */
export interface StoredInstallment {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
}

/** A payment as it is currently stored. */
export interface StoredPayment {
  id: string;
  installmentId: string | null;
  amount: number;
  paidDate: string;
  accountingEntryId: string | null;
}

export interface InstallmentWrites {
  insert: LegacyInstallment[];
  update: Array<{ id: string; amount: number; dueDate: string }>;
  /** ⚠ Only pieces nothing has been paid against — see below. */
  deleteIds: string[];
}

/**
 * What the plan needs, given what is stored.
 *
 * ⚠ A PIECE WITH MONEY ON IT IS NEVER DELETED, even when the legacy columns no longer describe it
 * (a coach removing a payable's split). The payment would fall back to the ordinary application rule
 * and a settled half would read as unpaid for reasons nothing on screen explains. Leaving the piece
 * is the visible, correctable state; removing it is the silent one.
 */
export function planInstallmentWrites(
  desired: readonly LegacyInstallment[],
  stored: readonly StoredInstallment[],
  hasPaymentOn: (installmentId: string) => boolean,
): InstallmentWrites {
  const byNumber = new Map(stored.map(i => [i.installmentNumber, i]));
  const writes: InstallmentWrites = { insert: [], update: [], deleteIds: [] };

  for (const want of desired) {
    const have = byNumber.get(want.installmentNumber);
    if (!have) { writes.insert.push(want); continue; }
    if (Math.abs(have.amount - want.amount) > 0.005 || have.dueDate !== want.dueDate) {
      writes.update.push({ id: have.id, amount: want.amount, dueDate: want.dueDate });
    }
  }
  for (const have of stored) {
    if (desired.some(w => w.installmentNumber === have.installmentNumber)) continue;
    if (hasPaymentOn(have.id)) continue;
    writes.deleteIds.push(have.id);
  }
  return writes;
}

export interface PaymentWrites {
  insert: Array<LegacyPayment & { installmentId: string | null }>;
  update: Array<{
    id: string;
    patch: Partial<{ amount: number; paidDate: string; installmentId: string | null; accountingEntryId: string }>;
  }>;
}

/**
 * Match a desired payment to one already stored, in strict order of confidence.
 *
 * 1 · The LEDGER ENTRY. Exact: an entry belongs to exactly one payment, and migration 255 carried
 *     the id from the very column this desired payment was derived from.
 * 2 · The piece it was recorded against, plus the day. Covers anything settled before mig 236
 *     recorded an entry id at all, which is the whole reason step 1 can come up empty.
 * 3 · The piece alone — an amount or date correction that moved the day out from under step 2.
 */
function claim(
  want: LegacyPayment,
  installmentId: string | null,
  pool: StoredPayment[],
): StoredPayment | undefined {
  if (want.accountingEntryId) {
    const byEntry = pool.find(p => p.accountingEntryId === want.accountingEntryId);
    if (byEntry) return byEntry;
  }
  return pool.find(p => p.installmentId === installmentId && p.paidDate === want.paidDate)
    ?? pool.find(p => p.installmentId === installmentId);
}

/**
 * What the payments need, given what is stored.
 *
 * ⚠⚠ IT NEVER DELETES. Nothing in P1 can un-pay a half, so a stored payment with no legacy column
 * behind it means something unexpected happened — and silently removing the record of money leaving
 * a team's account is the one tidiness not worth having. An unclaimed row is left where a person can
 * see it.
 *
 * ⚠ THE LEDGER LINK IS ONLY EVER FILLED IN, never cleared. A null on a stored row means "paid before
 * mig 236 recorded one" or "a family paid it out of pocket"; overwriting a recorded id with a null
 * would take away the only thing that lets an undo reverse by its own entry (R5).
 *
 * @param installmentIdByNumber the piece ids AFTER any inserts above have been applied.
 */
export function planPaymentWrites(
  desired: readonly LegacyPayment[],
  stored: readonly StoredPayment[],
  installmentIdByNumber: ReadonlyMap<number, string>,
): PaymentWrites {
  const pool = [...stored];
  const writes: PaymentWrites = { insert: [], update: [] };

  for (const want of desired) {
    const installmentId = installmentIdByNumber.get(want.installmentNumber) ?? null;
    const have = claim(want, installmentId, pool);
    if (!have) { writes.insert.push({ ...want, installmentId }); continue; }
    pool.splice(pool.indexOf(have), 1);

    const patch: PaymentWrites['update'][number]['patch'] = {};
    if (Math.abs(have.amount - want.amount) > 0.005) patch.amount = want.amount;
    if (have.paidDate !== want.paidDate) patch.paidDate = want.paidDate;
    if (have.installmentId !== installmentId) patch.installmentId = installmentId;
    if (want.accountingEntryId && have.accountingEntryId !== want.accountingEntryId) {
      patch.accountingEntryId = want.accountingEntryId;
    }
    if (Object.keys(patch).length > 0) writes.update.push({ id: have.id, patch });
  }
  return writes;
}
