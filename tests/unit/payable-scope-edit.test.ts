import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { commitmentStanding, type PayableInstallment, type PayablePayment } from '../../lib/payable-standing.ts';
import {
  planScopedInstallmentEdit, planScopedInstallmentDelete, describeScopedOutcome, whyPlanStrandsPaidMoney,
} from '../../lib/payable-scope-edit.ts';
import { planInstallmentWrites, paymentRestatements } from '../../lib/payable-plan.ts';

/**
 * S1–S8 — the load-bearing rules of the repeating-cost feature (Payables Rebuild P4, plan §4.3).
 *
 * The plan's own risk table says these are "cheap to state and expensive to get right across
 * paid/unpaid combinations", and its mitigation is that each gets a unit test rather than only a QA
 * step. So each case below is named for the rule it holds, and the fixture is the one §64 Part E
 * walks: six monthly payments of $450, the first two settled.
 */

/** The 1st of the month, `at` months on from September 2026 — Sep, Oct, Nov, Dec, Jan, Feb. */
function monthly(at: number): string {
  const m = 9 + at;
  return m <= 12 ? `2026-${String(m).padStart(2, '0')}-01` : `2027-${String(m - 12).padStart(2, '0')}-01`;
}

/** Six monthly $450 payments starting 1 September, `settled` of them paid in full. */
function series(settled: number, extra: PayablePayment[] = []) {
  const installments: PayableInstallment[] = Array.from({ length: 6 }, (_, at) => ({
    id: `i${at + 1}`,
    expenseId: 'e1',
    installmentNumber: at + 1,
    amount: 450,
    dueDate: monthly(at),
  }));
  const payments: PayablePayment[] = Array.from({ length: settled }, (_, at) => ({
    id: `p${at + 1}`,
    expenseId: 'e1',
    installmentId: `i${at + 1}`,
    amount: 450,
    paidDate: monthly(at).replace(/-01$/, '-02'),
    method: 'E-transfer',
    note: null,
    accountingEntryId: `ae${at + 1}`,
  }));
  return commitmentStanding(installments, [...payments, ...extra]);
}

describe('S1 — a bulk scope never touches settled money', () => {
  test('"this and later" from payment 4 leaves the two settled ones exactly as they were', () => {
    const standing = series(2);
    const out = planScopedInstallmentEdit(standing, 'i4', 'this_and_later', { amount: 500 });
    assert.deepEqual(out.touched, [4, 5, 6]);
    assert.equal(out.plan[0].amount, 450);
    assert.equal(out.plan[1].amount, 450);
    assert.equal(out.refusal, null);
  });

  test('"all unpaid" reaches payment 3 — EARLIER than the one being edited — and still not 1 or 2', () => {
    const standing = series(2);
    const out = planScopedInstallmentEdit(standing, 'i4', 'all_unpaid', { amount: 500 });
    assert.deepEqual(out.touched, [3, 4, 5, 6]);
    assert.equal(out.plan[0].amount, 450);
    assert.equal(out.plan[1].amount, 450);
  });
});

describe('S2 — a settled installment is EDITABLE under "this payment only" (owner ruling 2026-08-16)', () => {
  test('the settled piece changes, and nothing else does', () => {
    const standing = series(2);
    const out = planScopedInstallmentEdit(standing, 'i1', 'this', { amount: 400 });
    assert.deepEqual(out.touched, [1]);
    assert.equal(out.plan[0].amount, 400);
    assert.equal(out.plan[1].amount, 450);
  });

  test('⚠⚠ it is NOT refused — locking it would reverse the ruling and un-do QA §27 Part C', () => {
    const standing = series(2);
    // Lowered below what was paid on it, with five later payments for the excess to reach.
    const out = planScopedInstallmentEdit(standing, 'i1', 'this', { amount: 100 });
    assert.equal(out.refusal, null);
    assert.equal(out.plan[0].amount, 100);
  });

  test('the target is included in "this and later" even when it is settled', () => {
    const standing = series(2);
    const out = planScopedInstallmentEdit(standing, 'i2', 'this_and_later', { amount: 500 });
    assert.deepEqual(out.touched, [2, 3, 4, 5, 6]);
    assert.equal(out.plan[0].amount, 450, 'payment 1 is settled and out of scope');
  });
});

describe('S3 / R4 — partly paid counts as UNPAID and is reachable by a bulk scope', () => {
  test('a part-paid payment 3 is changed by "all unpaid"', () => {
    const standing = series(2, [{
      id: 'p9', expenseId: 'e1', installmentId: 'i3', amount: 100, paidDate: '2026-11-02',
      method: 'Cash', note: null, accountingEntryId: 'ae9',
    }]);
    assert.equal(standing.installments.find(i => i.id === 'i3')!.state, 'partly_paid');
    const out = planScopedInstallmentEdit(standing, 'i5', 'all_unpaid', { amount: 500 });
    assert.ok(out.touched.includes(3), 'partly paid is unpaid — it must be in scope');
  });
});

describe('S5 — a bulk date change SHIFTS, it does not SET', () => {
  test('moving payment 3 from the 1st to the 8th moves 4, 5 and 6 by seven days each', () => {
    const standing = series(2);
    const out = planScopedInstallmentEdit(standing, 'i3', 'this_and_later', { dueDate: '2026-11-08' });
    assert.equal(out.plan[2].dueDate, '2026-11-08');
    assert.equal(out.plan[3].dueDate, '2026-12-08');
    assert.equal(out.plan[4].dueDate, '2027-01-08');
    assert.equal(out.plan[5].dueDate, '2027-02-08');
  });

  test('"this payment only" sets the one date and leaves the rest of the series alone', () => {
    const standing = series(2);
    const out = planScopedInstallmentEdit(standing, 'i3', 'this', { dueDate: '2026-11-20' });
    assert.equal(out.plan[2].dueDate, '2026-11-20');
    assert.equal(out.plan[3].dueDate, '2026-12-01');
  });

  test('a shift backwards moves the later payments backwards too', () => {
    const standing = series(0);
    const out = planScopedInstallmentEdit(standing, 'i2', 'this_and_later', { dueDate: '2026-09-25' });
    assert.equal(out.plan[1].dueDate, '2026-09-25');
    // Payment 2 moved back six days, so payment 3 moves back six days too — 1 Nov → 26 Oct.
    assert.equal(out.plan[2].dueDate, '2026-10-26');
  });
});

describe('S6 — lowering below what is applied rolls the excess forward, and names every piece it reached', () => {
  test('the excess reaches the next unpaid payment, and the sentence names it', () => {
    const standing = series(2);
    const out = planScopedInstallmentEdit(standing, 'i2', 'this', { amount: 200 });
    assert.equal(out.refusal, null, 'there are four later payments to absorb it');
    assert.deepEqual(out.rolledForwardTo, [3], '$250 freed off payment 2 lands on payment 3');
    assert.match(describeScopedOutcome(out, 'change')!, /now counts towards payment 3/);
  });

  test('⚠ it names EVERY payment it touched, not just the next one', () => {
    // One $2,700 cheque covering the whole series; then payment 1 drops to $50.
    const standing = commitmentStanding(
      Array.from({ length: 3 }, (_, at) => ({
        id: `i${at + 1}`, expenseId: 'e1', installmentNumber: at + 1, amount: 300,
        dueDate: monthly(at),
      })),
      [{ id: 'p1', expenseId: 'e1', installmentId: null, amount: 600, paidDate: '2026-09-02',
         method: null, note: null, accountingEntryId: 'ae1' }],
    );
    // $600 currently fills pieces 1 and 2. Lowering piece 1 to $50 frees $250, which fills the
    // rest of piece 2 and spills into piece 3.
    const out = planScopedInstallmentEdit(standing, 'i1', 'this', { amount: 50 });
    assert.deepEqual(out.rolledForwardTo, [3], 'piece 2 was already full; piece 3 is the one that gains');
    assert.equal(out.refusal, null);
  });

  test('⚠⚠ BLOCKED when there is nowhere for the money to go — and the message names the figure', () => {
    const standing = series(6); // every payment settled: no room anywhere
    const out = planScopedInstallmentEdit(standing, 'i6', 'this', { amount: 100 });
    assert.ok(out.refusal, 'lowering the last settled payment would manufacture an over-payment');
    assert.match(out.refusal!, /\$350\.00/);
    assert.match(out.refusal!, /over-paid/);
  });

  test('the only installment on a one-piece bill has nowhere to roll to either', () => {
    const standing = commitmentStanding(
      [{ id: 'i1', expenseId: 'e1', installmentNumber: 1, amount: 600, dueDate: '2026-09-01' }],
      [{ id: 'p1', expenseId: 'e1', installmentId: 'i1', amount: 600, paidDate: '2026-09-02',
         method: null, note: null, accountingEntryId: 'ae1' }],
    );
    const out = planScopedInstallmentEdit(standing, 'i1', 'this', { amount: 400 });
    assert.match(out.refusal!, /\$200\.00/);
  });

  test('an over-payment that ALREADY exists is not re-refused by an unrelated edit', () => {
    const standing = series(6, [{
      id: 'pX', expenseId: 'e1', installmentId: null, amount: 100, paidDate: '2027-03-01',
      method: null, note: null, accountingEntryId: 'aeX',
    }]);
    assert.equal(standing.over, 100);
    const out = planScopedInstallmentEdit(standing, 'i6', 'this', { dueDate: '2027-02-15' });
    assert.equal(out.refusal, null, 'a date move does not make the existing over-payment worse');
  });
});

describe('S7 — deleting an installment, and where its money lands', () => {
  test('"this and later" removes 5 and 6 and skips the settled ones', () => {
    const standing = series(2);
    const out = planScopedInstallmentDelete(standing, 'i5', 'this_and_later');
    assert.deepEqual(out.touched, [5, 6]);
    assert.equal(out.plan.length, 4);
    assert.equal(out.refusal, null);
  });

  test('a part-paid piece can be deleted and its money re-applies to what is left', () => {
    const standing = series(2, [{
      id: 'p9', expenseId: 'e1', installmentId: 'i3', amount: 100, paidDate: '2026-11-02',
      method: null, note: null, accountingEntryId: 'ae9',
    }]);
    const out = planScopedInstallmentDelete(standing, 'i3', 'this');
    assert.equal(out.plan.length, 5);
    assert.deepEqual(out.rolledForwardTo, [3], 'the $100 lands on what is now payment 3');
    assert.equal(out.refusal, null);
  });

  test('the surviving rows are renumbered contiguously, in date order', () => {
    const standing = series(0);
    const out = planScopedInstallmentDelete(standing, 'i2', 'this');
    assert.deepEqual(out.plan.map(p => p.dueDate),
      ['2026-09-01', '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01']);
  });

  test('⚠ deleting every piece is refused — R1, a commitment always has a schedule', () => {
    const standing = series(0);
    const out = planScopedInstallmentDelete(standing, 'i1', 'all_unpaid');
    assert.match(out.refusal!, /at least one scheduled payment/);
  });

  test('⚠ a delete that would strand paid money is blocked with the figure', () => {
    const standing = series(6);
    const out = planScopedInstallmentDelete(standing, 'i6', 'this');
    assert.match(out.refusal!, /\$450\.00/);
  });
});

describe('whyPlanStrandsPaidMoney — can this plan be written AS STATED?', () => {
  /**
   * ⚠⚠ THE REGRESSION THIS PINS (`/review`, 2026-08-20). `planInstallmentWrites` deliberately
   * refuses to DELETE a piece a payment is aimed at, so the payment is never orphaned — but
   * `updateRepTeamExpense` writes the row's `amount` as the sum of the DESIRED plan. Drop such a
   * piece and the commitment ends up saying it is worth $600 while its schedule still holds $1,000
   * of pieces: R2 broken, silently, with no screen able to explain the gap.
   *
   * The old positional guard caught this by accident. Replacing it with the over-payment outcome
   * test ALONE lost it — the outcome is fine in this case, which is exactly why it slipped through.
   */
  test('⚠ the legitimate delete the OLD positional guard refused is allowed', () => {
    // Six unpaid pieces, payment aimed at piece 1. Dropping the LAST row touches nothing paid —
    // the old guard refused this whenever the last row happened to carry money.
    const standing = series(1);
    const plan = standing.installments
      .sort((a, b) => a.installmentNumber - b.installmentNumber)
      .slice(0, 5)
      .map(i => ({ id: i.id, amount: i.amount, dueDate: i.dueDate }));
    assert.equal(whyPlanStrandsPaidMoney(standing, plan), null);
  });

  test('⚠ it does NOT refuse a removal just because a payment is aimed at the removed row', () => {
    // The row really is deleted now, and the FK releases the override (ON DELETE SET NULL), so the
    // payment re-pours from the earliest unfilled piece — S7 working, not a case to refuse.
    const standing = series(1);
    const kept = standing.installments
      .sort((a, b) => a.installmentNumber - b.installmentNumber)
      .slice(1)
      .map(i => ({ id: i.id, amount: i.amount, dueDate: i.dueDate }));
    assert.equal(whyPlanStrandsPaidMoney(standing, kept), null);
  });

  test('a shrink that would strand money is still refused by the outcome test', () => {
    const standing = series(6);
    const plan = [{ amount: 450, dueDate: '2026-09-01' }];
    assert.match(whyPlanStrandsPaidMoney(standing, plan)!, /over-paid|cannot be removed/);
  });

  test('a GROWING plan is fine, and does not read past the stored pieces', () => {
    const standing = series(2);
    const plan = [...Array(8)].map((_, at) => ({ amount: 450, dueDate: `2027-0${(at % 9) + 1}-01` }));
    assert.equal(whyPlanStrandsPaidMoney(standing, plan), null);
  });
});

/**
 * ⚠⚠ THE MONEY DEFECT THREE REVIEW LENSES FOUND INDEPENDENTLY (2026-08-20), pinned end-to-end
 * against the REAL write functions rather than against a model of them.
 *
 * `planInstallmentWrites` used to match a desired plan to stored rows by POSITION. Remove a
 * non-trailing piece and every row below slides up: the physical row that carried a settled $200
 * deposit gets rewritten to hold the $400 balance, while the payment recorded against it still
 * points at that same row. The bill then says the balance is paid and the deposit is not — and
 * `paymentRestatements` sees a payment whose amount matches the row's OLD figure, calls it "the
 * payment that settled this piece", and restates it to $400, moving the team's books by $200 under
 * a sentence that only promised to remove a row.
 *
 * The fix is that a plan being EDITED names its rows (`PlanPiece.id`), so a row is matched to
 * itself. These tests fail loudly if that identity is ever dropped again.
 */
describe('⚠⚠ removing a NON-TRAILING piece must move the right row, not shuffle content', () => {
  const stored = [
    { id: 'a', installmentNumber: 1, amount: 200, dueDate: '2026-09-01' },
    { id: 'b', installmentNumber: 2, amount: 400, dueDate: '2026-10-01' },
  ];
  /** The $200 deposit, settled, recorded against row `a` from its own row (so it is TARGETED). */
  const paidDeposit = [{ id: 'p1', amount: 200, paidDate: '2026-09-02', installmentNumber: 1 }];

  test('the DELETED row is the one the coach removed — not a later one rewritten in its place', () => {
    // The coach removes the deposit. The surviving balance names itself.
    const desired = [{ id: 'b', amount: 400, dueDate: '2026-10-01' }];
    const writes = planInstallmentWrites(desired, stored, id => id === 'a');
    assert.deepEqual(writes.deleteIds, ['a'], 'row a is what was removed, so row a is what goes');
    assert.deepEqual(writes.update, [{ id: 'b', installmentNumber: 1, amount: 400, dueDate: '2026-10-01' }],
      'row b keeps its own content and simply becomes number 1');
    assert.deepEqual(writes.insert, []);
  });

  test('⚠⚠ and the settled payment is NOT restated — this is the $200 that became $400', () => {
    const desired = [{ id: 'b', amount: 400, dueDate: '2026-10-01' }];
    assert.deepEqual(paymentRestatements(desired, stored, paidDeposit), [],
      'nothing about row b changed, so no payment tracks anything');
  });

  test('the same edit WITHOUT identity is the defect, and is what the old code did', () => {
    // Kept as the counter-example: positional matching rewrites row `a` to hold the balance and
    // restates the deposit's payment to $400. If this ever stops being true, the fix has been
    // rendered pointless and the identity-carrying path above is dead code.
    const desired = [{ amount: 400, dueDate: '2026-10-01' }];
    const writes = planInstallmentWrites(desired, stored, id => id === 'a');
    assert.deepEqual(writes.update, [{ id: 'a', amount: 400, dueDate: '2026-10-01' }]);
    assert.deepEqual(paymentRestatements(desired, stored, paidDeposit),
      [{ paymentId: 'p1', newAmount: 400 }]);
  });

  test('editing a named row in place still moves the books — the 2026-08-16 ruling is intact', () => {
    // Row a is settled at $200 and the coach corrects it to $250. It IS the piece being edited, so
    // its payment tracks it. Identity must not turn the ruling off.
    const desired = [{ id: 'a', amount: 250, dueDate: '2026-09-01' }, { id: 'b', amount: 400, dueDate: '2026-10-01' }];
    assert.deepEqual(paymentRestatements(desired, stored, paidDeposit),
      [{ paymentId: 'p1', newAmount: 250 }]);
  });

  test('a row the commitment does not own is treated as NEW, never as a licence to rewrite', () => {
    const desired = [{ id: 'a', amount: 200, dueDate: '2026-09-01' },
                     { id: 'someone-elses-row', amount: 999, dueDate: '2026-11-01' }];
    const writes = planInstallmentWrites(desired, stored, () => false);
    assert.deepEqual(writes.insert, [{ installmentNumber: 2, amount: 999, dueDate: '2026-11-01' }]);
    assert.deepEqual(writes.deleteIds, ['b'], 'row b was not named, so it is removed');
  });

  test('a CREATE (no ids anywhere) keeps the positional rule untouched', () => {
    const writes = planInstallmentWrites(
      [{ amount: 100, dueDate: '2026-09-01' }, { amount: 100, dueDate: '2026-10-01' }], [], () => false);
    assert.equal(writes.insert.length, 2);
    assert.deepEqual(writes.deleteIds, []);
  });
});

describe('the sentence a coach reads', () => {
  test('one payment, nothing moving, reads plainly', () => {
    const standing = series(0);
    const out = planScopedInstallmentEdit(standing, 'i4', 'this', { amount: 500 });
    assert.equal(describeScopedOutcome(out, 'change'), 'This will change payment 4.');
  });

  test('several payments are counted as well as listed', () => {
    const standing = series(2);
    const out = planScopedInstallmentEdit(standing, 'i4', 'this_and_later', { amount: 500 });
    assert.equal(describeScopedOutcome(out, 'change'),
      'This will change payments 4, 5 and 6 — 3 payments.');
  });

  test('a delete says remove', () => {
    const standing = series(2);
    const out = planScopedInstallmentDelete(standing, 'i6', 'this');
    assert.equal(describeScopedOutcome(out, 'remove'), 'This will remove payment 6.');
  });

  test('a change that reaches nothing says nothing', () => {
    const standing = series(0);
    const out = planScopedInstallmentEdit(standing, 'i4', 'this', {});
    assert.equal(describeScopedOutcome(out, 'change'), null);
  });
});

describe('a target that is not on this bill', () => {
  test('is refused rather than silently rewriting the plan', () => {
    const standing = series(2);
    assert.match(planScopedInstallmentEdit(standing, 'nope', 'this', { amount: 1 }).refusal!, /not part of this bill/);
    assert.match(planScopedInstallmentDelete(standing, 'nope', 'this').refusal!, /not part of this bill/);
  });
});
