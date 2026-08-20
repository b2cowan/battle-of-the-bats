/**
 * THE COPIER THAT KEEPS THE BOOKS FROM MOVING (Payables Rebuild P1, mig 255).
 *
 * ⚠⚠ WHY THIS DESERVES ITS OWN TEST FILE RATHER THAN A COUPLE OF CASES SOMEWHERE. P1 moves every
 * money READER onto `rep_payable_installments` / `rep_payable_payments` while the forms still write
 * deposit/balance/expense_paid_at. `lib/payable-legacy-plan.ts` is the join between those two facts,
 * and it must agree with migration 255's backfill **exactly** — because a record made before the
 * migration and an identical one made after it have to read the same on every screen. If the two
 * ever disagreed, a commitment's payment schedule would depend on the day it was created, which is
 * the sort of defect that is found months later by a coach and never by a test.
 *
 * So each case below names the branch of migration 255 it mirrors. Two deliberately DIVERGE, and
 * both say so and say why: dropping a record of money that left a team's account is the worse error.
 *
 * ⚠ Every shape here is one the database genuinely holds. `deposit_amount + balance_amount == amount`
 * is enforced by nothing — no CHECK, no app validation (DATA_DICTIONARY, `rep_team_expenses` gotcha
 * 2) — so the awkward ones are live data, not hypotheticals.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  legacyInstallmentPlan, legacyPayments, planInstallmentWrites, planPaymentWrites,
  type LegacyCommitmentRow, type LegacyPayment, type StoredInstallment, type StoredPayment,
} from '../../lib/payable-legacy-plan.ts';

/** Org noon, the convention every `*_paid_at` on this table is written at. */
const noon = (day: string) => `${day}T16:00:00.000Z`;

const base: LegacyCommitmentRow = {
  expenseType: 'expense',
  amount: 240,
  expensePaidAt: null,
  depositAmount: null, depositDueDate: null, depositPaidAt: null,
  balanceAmount: null, balanceDueDate: null, balancePaidAt: null,
  accountingEntryId: null, depositEntryId: null, balanceEntryId: null,
  createdAt: noon('2026-04-02'),
};
const cost = (over: Partial<LegacyCommitmentRow> = {}): LegacyCommitmentRow => ({ ...base, ...over });
const bill = (over: Partial<LegacyCommitmentRow> = {}): LegacyCommitmentRow =>
  ({ ...base, expenseType: 'tournament_payable', amount: 900, ...over });

describe('legacyInstallmentPlan — R1: every commitment gets at least one piece', () => {
  it('a plain cost is ONE piece, dated when the money moved (migration case 3)', () => {
    assert.deepStrictEqual(legacyInstallmentPlan(cost({ expensePaidAt: noon('2026-05-14') })), [
      { installmentNumber: 1, amount: 240, dueDate: '2026-05-14' },
    ]);
  });

  it('an unpaid plain cost falls back to the day it was recorded', () => {
    assert.deepStrictEqual(legacyInstallmentPlan(cost()), [
      { installmentNumber: 1, amount: 240, dueDate: '2026-04-02' },
    ]);
  });

  it('a commitment with a real split is TWO pieces (migration case 1)', () => {
    const plan = legacyInstallmentPlan(bill({
      depositAmount: 300, depositDueDate: '2026-05-01',
      balanceAmount: 600, balanceDueDate: '2026-07-01',
    }));
    assert.deepStrictEqual(plan, [
      { installmentNumber: 1, amount: 300, dueDate: '2026-05-01' },
      { installmentNumber: 2, amount: 600, dueDate: '2026-07-01' },
    ]);
  });

  it('a half with a DATE and no amount takes the remainder', () => {
    const plan = legacyInstallmentPlan(bill({
      depositAmount: 300, depositDueDate: '2026-05-01', balanceDueDate: '2026-07-01',
    }));
    assert.deepStrictEqual(plan.map(p => p.amount), [300, 600]);
  });

  it('a half with an AMOUNT and no date takes the other half\'s date', () => {
    const plan = legacyInstallmentPlan(bill({
      depositAmount: 300, balanceAmount: 600, balanceDueDate: '2026-07-01',
    }));
    assert.deepStrictEqual(plan.map(p => p.dueDate), ['2026-07-01', '2026-07-01']);
  });

  it('a commitment with NO split is one piece (migration case 2)', () => {
    assert.deepStrictEqual(legacyInstallmentPlan(bill({ depositDueDate: '2026-06-01' })), [
      { installmentNumber: 1, amount: 900, dueDate: '2026-06-01' },
    ]);
  });

  it('⚠ THE OLD "NO SCHEDULE" RECORD gets a date, which is the entire point of R1', () => {
    /* A payable with an amount and no due date at all was invisible to the payment schedule, absent
       from the Overview's next-30 panel, and had no Mark paid control anywhere. It could not be
       fixed because it could not be found. It now appears, dated the day it was recorded — expected,
       and called out in QA §64 Part A so the walk does not read it as a defect. */
    assert.deepStrictEqual(legacyInstallmentPlan(bill()), [
      { installmentNumber: 1, amount: 900, dueDate: '2026-04-02' },
    ]);
  });

  it('a remainder that works out to nothing still buys a row, never a zero-amount one', () => {
    // `amount` carries a CHECK (amount > 0), so a piece computed as $0 would fail the insert and a
    // commitment would end up with no plan at all — the state R1 exists to make impossible.
    const plan = legacyInstallmentPlan(bill({
      amount: 300, depositAmount: 300, balanceDueDate: '2026-07-01',
    }));
    assert.strictEqual(plan.length, 2);
    assert.ok(plan.every(p => p.amount > 0), 'a piece was computed as zero or negative');
  });

  it('rounds to the cent, so a third-of-a-bill split cannot fail its own column', () => {
    const plan = legacyInstallmentPlan(bill({
      amount: 100, depositAmount: 33.333, balanceDueDate: '2026-07-01',
    }));
    assert.deepStrictEqual(plan.map(p => p.amount), [33.33, 66.67]);
  });
});

describe('legacyPayments — money that already moved, never money moving again', () => {
  const split = {
    depositAmount: 300, depositDueDate: '2026-05-01',
    balanceAmount: 600, balanceDueDate: '2026-07-01',
  };

  it('a settled half becomes one payment CARRYING its existing ledger entry (cases 4 and 5)', () => {
    /* ⚠⚠ THE WHOLE ACCEPTANCE TEST OF P1 IS IN THIS ASSERTION. The entry is carried, never
       recreated — so this is a new way to READ money that already left the account, not a second
       time it left. Writing a new entry here would double a team's spending. */
    const row = bill({
      ...split,
      depositPaidAt: noon('2026-05-14'), depositEntryId: 'entry-dep',
      balancePaidAt: noon('2026-07-09'), balanceEntryId: 'entry-bal',
    });
    assert.deepStrictEqual(legacyPayments(row, legacyInstallmentPlan(row)), [
      { half: 'deposit', installmentNumber: 1, amount: 300, paidDate: '2026-05-14', accountingEntryId: 'entry-dep' },
      { half: 'balance', installmentNumber: 2, amount: 600, paidDate: '2026-07-09', accountingEntryId: 'entry-bal' },
    ]);
  });

  it('a half paid before mig 236 still becomes a payment, with a null entry', () => {
    // The money DID move and the coach must see it. The existing description-matching reversal path
    // continues to serve those records until they are deleted.
    const row = bill({ ...split, depositPaidAt: noon('2026-05-14') });
    const [p] = legacyPayments(row, legacyInstallmentPlan(row));
    assert.strictEqual(p.accountingEntryId, null);
    assert.strictEqual(p.amount, 300);
  });

  it('an out-of-pocket cost IS a payment, and carries no ledger entry (case 6)', () => {
    /* ⚠ A family's money moved and the team's did not, so no cash entry was ever posted (mig 234).
       It is still real spending against the plan — Budget vs. Actual counts it — which is why it is
       a payment at all. A "tidy-up" that COALESCEd the entry id to something non-null would credit
       the team for spending it never did. */
    const row = cost({ expensePaidAt: noon('2026-05-14') });
    assert.deepStrictEqual(legacyPayments(row, legacyInstallmentPlan(row)), [
      { half: 'expense', installmentNumber: 1, amount: 240, paidDate: '2026-05-14', accountingEntryId: null },
    ]);
  });

  it('nothing settled yields nothing — absent, never a zero payment', () => {
    const row = bill(split);
    assert.deepStrictEqual(legacyPayments(row, legacyInstallmentPlan(row)), []);
  });

  it('⚠⚠ THE INVISIBLE MONEY: a payable carrying expense_paid_at is surfaced, not skipped (case 7)', () => {
    /* Such a record could only have been settled through `markExpensePaid` before that hole was
       closed on 2026-08-16. A ledger entry was posted for its FULL amount under the plain
       description, and `paidLedgerLegs` reads only the two half-stamps for a payable — so it has
       been on the books and invisible ever since. Skipping it here would lose it again. */
    const row = bill({ expensePaidAt: noon('2026-03-01'), accountingEntryId: 'entry-wrong-door' });
    const payments = legacyPayments(row, legacyInstallmentPlan(row));
    assert.deepStrictEqual(payments.map(p => p.half), ['wrong_door']);
    assert.strictEqual(payments[0].accountingEntryId, 'entry-wrong-door');
  });

  it('a DOUBLE-POSTED record reads as over-paid, which is the correct outcome', () => {
    // R6 accepts over-payment and the screen states it — so a commitment charged twice now READS as
    // charged twice, for the first time since it happened. Reconciled by hand, never by dropping a
    // payment row, which would hide the entry again with nothing left pointing at it.
    const row = bill({
      ...split,
      depositPaidAt: noon('2026-05-14'), depositEntryId: 'entry-dep',
      expensePaidAt: noon('2026-03-01'), accountingEntryId: 'entry-wrong-door',
    });
    const payments = legacyPayments(row, legacyInstallmentPlan(row));
    assert.deepStrictEqual(payments.map(p => p.half), ['deposit', 'wrong_door']);
    assert.strictEqual(payments.reduce((s, p) => s + p.amount, 0), 1200,
      'the record was posted twice and the total must say so — 900 would hide it again');
  });

  it('⚠ DIVERGES FROM THE MIGRATION: a balance with no second piece lands on the first', () => {
    /* Migration 255 joined strictly on `installment_number = 2`, so a payable carrying
       `balance_paid_at` with no balance amount OR date at all had its payment silently dropped. Dev
       carries none of these (the migration's verification found zero orphaned entries), so the two
       agree on all live data — but losing the record of money that left the account is the worse of
       the two errors, so this keeps it. */
    const row = bill({ depositDueDate: '2026-06-01', balancePaidAt: noon('2026-07-09') });
    const plan = legacyInstallmentPlan(row);
    assert.strictEqual(plan.length, 1);
    assert.deepStrictEqual(legacyPayments(row, plan).map(p => p.installmentNumber), [1]);
  });

  it('a half with no amount of its own posts the commitment\'s total, exactly as the ledger did', () => {
    // `markDepositPaid` posts the payable's TOTAL when the half carries no amount, and records that
    // figure on the row. The payment has to read back exactly what went out.
    const row = bill({ depositDueDate: '2026-06-01', depositPaidAt: noon('2026-06-01') });
    assert.deepStrictEqual(legacyPayments(row, legacyInstallmentPlan(row)).map(p => p.amount), [900]);
  });
});

describe('the two together — the acceptance test in miniature', () => {
  it('a split commitment fully settled reads as paid in full, to the cent', () => {
    const row = bill({
      depositAmount: 300, depositDueDate: '2026-05-01', depositPaidAt: noon('2026-05-14'),
      balanceAmount: 600, balanceDueDate: '2026-07-01', balancePaidAt: noon('2026-07-09'),
    });
    const plan = legacyInstallmentPlan(row);
    const payments = legacyPayments(row, plan);
    assert.strictEqual(
      plan.reduce((s, p) => s + p.amount, 0),
      payments.reduce((s, p) => s + p.amount, 0),
      'the plan and what was paid disagree — the books would move',
    );
  });

  it('the plan always sums to the commitment\'s stored amount when the halves are honest', () => {
    const row = bill({
      depositAmount: 300, depositDueDate: '2026-05-01',
      balanceAmount: 600, balanceDueDate: '2026-07-01',
    });
    assert.strictEqual(legacyInstallmentPlan(row).reduce((s, p) => s + p.amount, 0), row.amount);
  });
});

/**
 * ⚠⚠ THE HALF THAT DECIDES WHAT TO WRITE, tested apart from writing it — because FOUR callers share
 * it and only one of them is the app. `reconcileCommitmentRecords` (lib/db.ts) runs on every save;
 * the demo seed, the UAT fixture and the QA-day fixture write `rep_team_expenses` with their own
 * client and call `scripts/lib/backfill-commitment-records.mjs` instead. Copying the rule into the
 * seeders was the obvious fix and the wrong one: the QA fixture is what §64 is walked against, so a
 * drifted copy would make the acceptance test agree with a bug.
 */
describe('planInstallmentWrites — the plan, given what is stored', () => {
  const stored = (over: Partial<StoredInstallment> = {}): StoredInstallment =>
    ({ id: 'i1', installmentNumber: 1, amount: 300, dueDate: '2026-05-01', ...over });
  const none = () => false;

  it('writes nothing at all when the plan already agrees', () => {
    const w = planInstallmentWrites(
      [{ installmentNumber: 1, amount: 300, dueDate: '2026-05-01' }], [stored()], none);
    assert.deepStrictEqual(w, { insert: [], update: [], deleteIds: [] });
  });

  it('inserts a piece that has never existed — R1 on a brand new commitment', () => {
    const w = planInstallmentWrites(
      [{ installmentNumber: 1, amount: 300, dueDate: '2026-05-01' }], [], none);
    assert.deepStrictEqual(w.insert.map(i => i.installmentNumber), [1]);
  });

  it('updates a piece whose amount or date moved', () => {
    const w = planInstallmentWrites(
      [{ installmentNumber: 1, amount: 350, dueDate: '2026-05-08' }], [stored()], none);
    assert.deepStrictEqual(w.update, [{ id: 'i1', amount: 350, dueDate: '2026-05-08' }]);
  });

  it('ignores a sub-cent difference rather than rewriting the row every save', () => {
    const w = planInstallmentWrites(
      [{ installmentNumber: 1, amount: 300.001, dueDate: '2026-05-01' }], [stored()], none);
    assert.deepStrictEqual(w.update, []);
  });

  it('removes a piece the plan no longer has — a coach un-splitting a payable', () => {
    const w = planInstallmentWrites(
      [{ installmentNumber: 1, amount: 900, dueDate: '2026-05-01' }],
      [stored(), stored({ id: 'i2', installmentNumber: 2, amount: 600, dueDate: '2026-07-01' })],
      none);
    assert.deepStrictEqual(w.deleteIds, ['i2']);
  });

  it('⚠ NEVER removes a piece with money standing on it', () => {
    /* The payment would fall back to the ordinary application rule and a settled half would read as
       unpaid for reasons nothing on screen explains. Leaving the piece is the visible, correctable
       state; removing it is the silent one. */
    const w = planInstallmentWrites(
      [{ installmentNumber: 1, amount: 900, dueDate: '2026-05-01' }],
      [stored(), stored({ id: 'i2', installmentNumber: 2, amount: 600, dueDate: '2026-07-01' })],
      id => id === 'i2');
    assert.deepStrictEqual(w.deleteIds, []);
  });
});

describe('planPaymentWrites — what happened, given what is stored', () => {
  const want = (over: Partial<LegacyPayment> = {}): LegacyPayment => ({
    half: 'deposit', installmentNumber: 1, amount: 300, paidDate: '2026-05-14',
    accountingEntryId: 'entry-dep', ...over,
  });
  const stored = (over: Partial<StoredPayment> = {}): StoredPayment => ({
    id: 'p1', installmentId: 'i1', amount: 300, paidDate: '2026-05-14',
    accountingEntryId: 'entry-dep', ...over,
  });
  const ids = new Map([[1, 'i1'], [2, 'i2']]);

  it('writes nothing when the payment is already recorded', () => {
    const w = planPaymentWrites([want()], [stored()], ids);
    assert.deepStrictEqual(w, { insert: [], update: [] });
  });

  it('inserts a newly settled half — this is what MARK PAID actually writes', () => {
    const w = planPaymentWrites([want()], [], ids);
    assert.strictEqual(w.insert.length, 1);
    assert.strictEqual(w.insert[0].installmentId, 'i1');
    assert.strictEqual(w.insert[0].accountingEntryId, 'entry-dep');
  });

  it('claims a stored row by its LEDGER ENTRY even when the day moved under it', () => {
    // An entry belongs to exactly one payment, so this is the exact match and it comes first.
    const w = planPaymentWrites(
      [want({ paidDate: '2026-06-02' })],
      [stored({ installmentId: null, paidDate: '2026-05-14' })],
      ids);
    assert.deepStrictEqual(w.insert, []);
    assert.deepStrictEqual(w.update, [{ id: 'p1', patch: { paidDate: '2026-06-02', installmentId: 'i1' } }]);
  });

  it('claims a PRE-MIG-236 row, which has no entry to match on, by its piece and day', () => {
    const w = planPaymentWrites(
      [want({ accountingEntryId: null, amount: 325 })],
      [stored({ accountingEntryId: null })],
      ids);
    assert.deepStrictEqual(w.update, [{ id: 'p1', patch: { amount: 325 } }]);
  });

  it('⚠ FILLS THE LEDGER LINK IN, and never clears one', () => {
    /* A null on a stored row means "paid before mig 236 recorded one" or "a family paid it out of
       pocket". Overwriting a recorded id with a null takes away the only thing that lets an undo
       reverse by its own entry (R5). */
    const filled = planPaymentWrites([want()], [stored({ accountingEntryId: null })], ids);
    assert.deepStrictEqual(filled.update, [{ id: 'p1', patch: { accountingEntryId: 'entry-dep' } }]);

    const kept = planPaymentWrites([want({ accountingEntryId: null })], [stored()], ids);
    assert.deepStrictEqual(kept.update, [], 'a recorded ledger link was about to be cleared');
  });

  it('⚠⚠ NEVER DELETES. An unclaimed payment is left where a person can see it', () => {
    // Nothing in P1 can un-pay a half, so a stored payment with no column behind it means something
    // unexpected happened — and silently removing the record of money leaving a team's account is
    // the one tidiness not worth having.
    const w = planPaymentWrites([], [stored()], ids);
    assert.deepStrictEqual(w, { insert: [], update: [] });
  });

  it('does not let two desired payments claim the same stored row', () => {
    const w = planPaymentWrites(
      [want(), want({ half: 'wrong_door', accountingEntryId: null, amount: 900 })],
      [stored()],
      ids);
    assert.strictEqual(w.insert.length, 1, 'a double-posted record collapsed into one payment');
    assert.strictEqual(w.insert[0].amount, 900);
  });
});
