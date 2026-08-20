/**
 * THE ROOT OF THE MONEY REPORT'S ARITHMETIC — which payment dates which dollar.
 *
 * ⚠⚠ THIS FILE EXISTS BECAUSE THE REPORT's BUILD-BLOCKING CHECK CANNOT SEE IN HERE (`/review`
 * verification-integrity lens, 2026-08-17 — Critical). `scripts/check-money-report-arithmetic.mjs`
 * asserts that the statement, the Months grid and the cumulative chart land on one number. That was
 * strong evidence while the three were three independent walks of the database. The consolidation of
 * 2026-08-17 made them three readings of ONE list — so a mistake in `paidMovements` is now invisible
 * to it: all three feeds agree, on the wrong answer, and the check reports green. A July balance
 * charted in May would pass.
 *
 * So the two safeguards divide the work, and neither substitutes for the other:
 *   · `check-money-report-arithmetic.mjs` guards the PLUMBING — a kind of money that reaches only two
 *     of the three feeds.
 *   · this file guards the ROOT — that a movement carries the right amount on the right day.
 *
 * ⚠⚠ REWRITTEN FOR THE PAYABLES REBUILD (P1, mig 255). The claim is the same and the inputs are not.
 * The old cases fed deposit/balance paid STAMPS and proved the two halves separated; a commitment can
 * now hold any number of payments, so the cases feed the payments themselves. **The awkward shapes
 * did not go away with the columns** — they moved. `amount > 0` is a database CHECK now, but a
 * payment landing on a piece that no longer exists, a cheque covering more than one piece, and money
 * beyond what was owed are all shapes the tables genuinely hold, and each has its case below.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paidMovements, type PaidExpenseRow } from '../../lib/coach-expense-movements.ts';
import {
  commitmentStanding, type PayableInstallment, type PayablePayment,
} from '../../lib/payable-standing.ts';

const exp: PaidExpenseRow = { id: 'e1', description: 'Diamond permits' };
const bill: PaidExpenseRow = { id: 'p1', description: 'Regional qualifier entry' };

const inst = (n: number, amount: number, dueDate: string, expenseId = 'p1'): PayableInstallment =>
  ({ id: `i${expenseId}-${n}`, expenseId, installmentNumber: n, amount, dueDate });

const pay = (
  id: string, amount: number, paidDate: string,
  installmentId: string | null = null, expenseId = 'p1',
): PayablePayment =>
  ({ id, expenseId, installmentId, amount, paidDate, method: null, note: null, accountingEntryId: null });

describe('paidMovements — a one-piece commitment (every plain cost is one)', () => {
  it('is one movement on the day it was paid, and takes no suffix', () => {
    const standing = commitmentStanding(
      [inst(1, 240, '2026-05-14', 'e1')],
      [pay('pay-1', 240, '2026-05-14', 'ie1-1', 'e1')],
    );
    const [mv, ...rest] = paidMovements(exp, standing);
    assert.deepStrictEqual(rest, []);
    assert.strictEqual(mv.amount, 240);
    assert.strictEqual(mv.paidDate, '2026-05-14');
    // ⚠ "Diamond permits — installment 1 of 1" is noise on a screen where most rows are one-piece.
    assert.strictEqual(mv.description, 'Diamond permits');
  });

  it('yields nothing at all when nothing has been paid — absent, never zero', () => {
    const standing = commitmentStanding([inst(1, 240, '2026-05-14', 'e1')], []);
    assert.deepStrictEqual(paidMovements(exp, standing), []);
  });

  it('yields nothing when the commitment has no standing at all', () => {
    // R1 makes this unreachable, but a money report that throws is worse than one showing a zero
    // somebody can report.
    assert.deepStrictEqual(paidMovements(exp, undefined), []);
  });

  it('carries an id naming the COMMITMENT, which is a payload contract', () => {
    /* `check-money-report-arithmetic.mjs` proves the fixture contains a commitment paid across two
       calendar months by grouping the drill-in's rows back to the record behind them. A bare payment
       id would make every payment its own record, and the check would fail reading like a seeding
       problem rather than a code one. */
    const standing = commitmentStanding(
      [inst(1, 240, '2026-05-14', 'e1')],
      [pay('pay-1', 240, '2026-05-14', 'ie1-1', 'e1')],
    );
    assert.ok(paidMovements(exp, standing)[0].id.startsWith('e1-'),
      'the movement id no longer names its commitment — see this test\'s comment');
  });
});

describe('paidMovements — a commitment paid in pieces is SEPARATE movements, and this is the point', () => {
  it('two payments in different months stay in their own months', () => {
    const standing = commitmentStanding(
      [inst(1, 300, '2026-05-01'), inst(2, 600, '2026-07-01')],
      [pay('d', 300, '2026-05-14', 'ip1-1'), pay('b', 600, '2026-07-09', 'ip1-2')],
    );
    const mvs = paidMovements(bill, standing);
    assert.deepStrictEqual(mvs.map(m => m.paidDate), ['2026-05-14', '2026-07-09']);
    assert.deepStrictEqual(mvs.map(m => m.amount), [300, 600]);
    /* ⚠⚠ THE DEFECT THIS ENTIRE MODULE EXISTS FOR: merged into one record dated by the earlier
       half, a July balance was charted in May by the cumulative chart AND by the statement's own
       expand-a-row schedule, and only the Months grid was right. */
    assert.notStrictEqual(mvs[0].paidDate.slice(0, 7), mvs[1].paidDate.slice(0, 7));
  });

  it('names each payment for the piece it settled', () => {
    const standing = commitmentStanding(
      [inst(1, 300, '2026-05-01'), inst(2, 600, '2026-07-01')],
      [pay('d', 300, '2026-05-14', 'ip1-1'), pay('b', 600, '2026-07-09', 'ip1-2')],
    );
    assert.deepStrictEqual(paidMovements(bill, standing).map(m => m.description), [
      'Regional qualifier entry — installment 1 of 2',
      'Regional qualifier entry — installment 2 of 2',
    ]);
  });

  it('a half-paid commitment contributes only what actually moved', () => {
    // ⚠ THE SHAPE THE OLD MODEL COULD NOT HOLD AT ALL: $200 handed over against a $600 bill. The
    // boolean per half forced it to be recorded as $600 paid or nothing, and coaches chose $600.
    const standing = commitmentStanding([inst(1, 600, '2026-05-01')], [pay('part', 200, '2026-05-14')]);
    const mvs = paidMovements(bill, standing);
    assert.deepStrictEqual(mvs.map(m => m.amount), [200]);
  });

  it('one cheque covering more than one piece is ONE movement, on its own day', () => {
    /* A coach handing over $700 that covers a full month and half the next made one payment. The
       standing spreads it across two pieces for what is OWED; the report must not invent two
       movements out of it, because only one amount left the account. */
    const standing = commitmentStanding(
      [inst(1, 400, '2026-05-01'), inst(2, 600, '2026-06-01')],
      [pay('cheque', 700, '2026-05-14')],
    );
    const mvs = paidMovements(bill, standing);
    assert.strictEqual(mvs.length, 1);
    assert.strictEqual(mvs[0].amount, 700);
    // Named for the earliest piece the money touched — the honest one-line answer.
    assert.strictEqual(mvs[0].description, 'Regional qualifier entry — installment 1 of 2');
  });

  it('three pieces read "of 3", so a monthly commitment does not pretend to be a deposit and a balance', () => {
    const standing = commitmentStanding(
      [inst(1, 100, '2026-05-01'), inst(2, 100, '2026-06-01'), inst(3, 100, '2026-07-01')],
      [pay('c', 100, '2026-07-02', 'ip1-3')],
    );
    assert.strictEqual(paidMovements(bill, standing)[0].description,
      'Regional qualifier entry — installment 3 of 3');
  });
});

describe('paidMovements — shapes the tables can hold and money should not be', () => {
  it('an OVER-payment is reported in full, because it genuinely left the account', () => {
    // ⚠ R6. Capping it here would make the report disagree with a bank statement, which is the
    // failure accepting over-payment exists to prevent.
    const standing = commitmentStanding([inst(1, 450, '2026-05-01')], [pay('over', 500, '2026-05-14')]);
    assert.deepStrictEqual(paidMovements(bill, standing).map(m => m.amount), [500]);
  });

  it('a payment whose target piece was deleted still counts, under the bare description', () => {
    const standing = commitmentStanding(
      [inst(1, 300, '2026-05-01')],
      [pay('orphan', 300, '2026-05-14', 'a-piece-that-is-gone')],
    );
    const mvs = paidMovements(bill, standing);
    assert.strictEqual(mvs.length, 1, 'money vanished from the report because its piece was removed');
    assert.strictEqual(mvs[0].amount, 300);
  });

  it('a payment against a commitment with NO pieces keeps its amount and its bare name', () => {
    const standing = commitmentStanding([], [pay('stray', 120, '2026-05-14')]);
    const mvs = paidMovements(bill, standing);
    assert.deepStrictEqual(mvs.map(m => m.amount), [120]);
    assert.strictEqual(mvs[0].description, 'Regional qualifier entry');
  });

  it('a non-finite amount is dropped rather than charted as NaN', () => {
    const standing = commitmentStanding(
      [inst(1, 300, '2026-05-01')],
      [pay('bad', Number('x'), '2026-05-14'), pay('good', 300, '2026-05-15')],
    );
    assert.deepStrictEqual(paidMovements(bill, standing).map(m => m.amount), [300]);
  });
});

describe('paidMovements — the date is the day the money moved, and nothing converts it', () => {
  it('passes through the stored calendar day untouched', () => {
    /* ⚠ `rep_payable_payments.paid_date` is a `date` column, so the org's own day is what arrives —
       there is no instant to reinterpret and no timezone to read into it. That is a real
       simplification over the `timestamptz` stamps this replaced, where a naive slice was correct
       only because every writer anchored the stamp at org noon. */
    const standing = commitmentStanding(
      [inst(1, 300, '2026-01-09')],
      [pay('winter', 300, '2026-01-09', 'ip1-1')],
    );
    assert.strictEqual(paidMovements(bill, standing)[0].paidDate, '2026-01-09');
  });

  it('orders movements oldest first, however they were entered', () => {
    const standing = commitmentStanding(
      [inst(1, 300, '2026-05-01'), inst(2, 600, '2026-07-01')],
      [pay('late', 600, '2026-07-09', 'ip1-2'), pay('early', 300, '2026-05-14', 'ip1-1')],
    );
    assert.deepStrictEqual(paidMovements(bill, standing).map(m => m.paidDate),
      ['2026-05-14', '2026-07-09']);
  });
});
