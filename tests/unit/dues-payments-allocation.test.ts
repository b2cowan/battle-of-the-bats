/**
 * The dues payment allocation contract (mig 232 / COACH_DUES_PAYMENT_RECORD_PLAN.md).
 *
 * Pins the three properties every dues surface now leans on:
 *  1. Money spreads oldest-first and part-covers the next installment (the $100-a-month family).
 *  2. STAMPED-FIRST coverage — the mig-232 backfill must be a zero-visible-change event even when
 *     a coach had stamped #2 paid while #1 was open. This is the one that looks like a
 *     simplification target; the test is here so it fails loudly instead.
 *  3. Cents arithmetic + the overpayment/cap pair: the excess becomes a credit exactly once.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allocateDuesPayments,
  coverageOrder,
  duesPaidAmount,
  overpaymentExcess,
  strandedExcess,
  paymentsTotalByPlayer,
  sortPaymentsForAllocation,
} from '../../lib/dues-payments.ts';

const inst = (n: number, amount: number, paidAt: string | null = null) =>
  ({ id: `i${n}`, installmentNumber: n, amount, paidAt });
const pay = (id: string, amount: number, receivedDate: string, createdAt?: string) =>
  ({ id, amount, receivedDate, createdAt: createdAt ?? null });

describe('allocateDuesPayments', () => {
  it('spreads oldest-first and part-covers the next installment ($100/month vs $300 quarters)', () => {
    const installments = [inst(1, 300), inst(2, 300), inst(3, 300), inst(4, 300)];
    const payments = [pay('a', 100, '2026-09-14'), pay('b', 100, '2026-10-12')];
    const { coverage, totalAllocated, unallocated } = allocateDuesPayments(installments, payments);
    assert.equal(totalAllocated, 200);
    assert.equal(unallocated, 0);
    assert.deepEqual(coverage.map(c => [c.installmentNumber, c.allocated, c.covered]), [
      [1, 200, false], [2, 0, false], [3, 0, false], [4, 0, false],
    ]);
    assert.equal(coverage[0].completedOn, null);
  });

  it('marks an installment covered by the payment that completes it, dated that payment', () => {
    const installments = [inst(1, 300), inst(2, 300)];
    const payments = [pay('a', 100, '2026-09-14'), pay('b', 250, '2026-10-12')];
    const { coverage } = allocateDuesPayments(installments, payments);
    assert.equal(coverage[0].covered, true);
    assert.equal(coverage[0].completedOn, '2026-10-12');
    assert.equal(coverage[1].allocated, 50);
    assert.equal(coverage[1].covered, false);
  });

  it('STAMPED-FIRST: an out-of-order legacy stamp keeps its coverage after the backfill', () => {
    // Coach had stamped #2 paid while #1 was in dispute; backfill created one $300 payment.
    const installments = [inst(1, 300), inst(2, 300, '2026-07-01T15:00:00Z'), inst(3, 300)];
    const payments = [pay('m', 300, '2026-07-01')];
    const { coverage } = allocateDuesPayments(installments, payments);
    const byNumber = Object.fromEntries(coverage.map(c => [c.installmentNumber, c]));
    assert.equal(byNumber[2].covered, true, 'the stamped installment keeps its paid state');
    assert.equal(byNumber[1].covered, false, 'the disputed installment stays open');
    assert.equal(byNumber[1].allocated, 0);
  });

  it('new money then flows to the OPEN installments in number order, not past the stamp', () => {
    const installments = [inst(1, 300), inst(2, 300, '2026-07-01T15:00:00Z'), inst(3, 300)];
    const payments = [pay('m', 300, '2026-07-01'), pay('n', 100, '2026-09-01')];
    const { coverage } = allocateDuesPayments(installments, payments);
    const byNumber = Object.fromEntries(coverage.map(c => [c.installmentNumber, c]));
    assert.equal(byNumber[1].allocated, 100, 'the new $100 lands on open #1, not #3');
    assert.equal(byNumber[3].allocated, 0);
  });

  it('degrades to plain number order when nothing is stamped', () => {
    const order = coverageOrder([inst(3, 1), inst(1, 1), inst(2, 1)]);
    assert.deepEqual(order.map(i => i.installmentNumber), [1, 2, 3]);
  });

  it('reports unallocated dollars beyond every installment', () => {
    const installments = [inst(1, 300)];
    const payments = [pay('a', 350, '2026-09-14')];
    const { totalAllocated, unallocated } = allocateDuesPayments(installments, payments);
    assert.equal(totalAllocated, 300);
    assert.equal(unallocated, 50);
  });

  it('cents arithmetic: three 33.33 payments against a 99.99 installment cover it exactly', () => {
    const installments = [inst(1, 99.99)];
    const payments = [pay('a', 33.33, '2026-09-01'), pay('b', 33.33, '2026-09-02'), pay('c', 33.33, '2026-09-03')];
    const { coverage, unallocated } = allocateDuesPayments(installments, payments);
    assert.equal(coverage[0].covered, true);
    assert.equal(coverage[0].completedOn, '2026-09-03');
    assert.equal(unallocated, 0);
  });

  it('sorts same-day payments by recorded instant, then id', () => {
    const sorted = sortPaymentsForAllocation([
      pay('b', 1, '2026-09-01', '2026-09-01T12:00:00Z'),
      pay('a', 1, '2026-09-01', '2026-09-01T09:00:00Z'),
    ]);
    assert.deepEqual(sorted.map(p => p.id), ['a', 'b']);
  });
});

describe('duesPaidAmount / overpaymentExcess — the cap-and-credit pair', () => {
  it('caps the dues-facing Paid at the schedule total', () => {
    assert.equal(duesPaidAmount(1250, 1200), 1200);
    assert.equal(duesPaidAmount(200, 1200), 200);
  });

  it('the excess of a new payment is exactly what the cap excludes', () => {
    // $450 remaining, $500 arrives → $50 credit; paid caps at total; nothing counted twice.
    assert.equal(overpaymentExcess(1200, 750, 500), 50);
    assert.equal(duesPaidAmount(750 + 500, 1200), 1200);
  });

  it('no excess while the schedule still has room', () => {
    assert.equal(overpaymentExcess(1200, 200, 100), 0);
  });

  it('a payment against an already-overpaid schedule is excess in full', () => {
    assert.equal(overpaymentExcess(1200, 1200, 40), 40);
  });

  it('cents: 0.1 + 0.2 style inputs do not leak fractional cents', () => {
    assert.equal(overpaymentExcess(0.3, 0.1, 0.2), 0);
    assert.equal(overpaymentExcess(0.3, 0.2, 0.2), 0.1);
  });

  it('coverage carries each installment remainder (the ONE remainder definition)', () => {
    const { coverage } = allocateDuesPayments(
      [inst(1, 300), inst(2, 300)],
      [pay('a', 100, '2026-09-14')],
    );
    assert.deepEqual(coverage.map(c => [c.installmentNumber, c.remaining]), [[1, 200], [2, 300]]);
  });

  it('strandedExcess is symmetric raw material: create when dues drop, nothing when they rise', () => {
    // Dues lowered below money received → the uncredited part becomes a credit.
    assert.equal(strandedExcess(500, 300, 0), 200);
    assert.equal(strandedExcess(500, 300, 150), 50);
    // Dues raised back past the money → no NEW credit; the reconcile's reduce side
    // (linkedTotal − strandedExcess(p, s, 0)) claws the stale one back.
    assert.equal(strandedExcess(1250, 1400, 0), 0);
    // Review Critical 1's worked example: linked $50 credit, dues raised 1200→1400 —
    // the stale amount to remove is exactly the linked total.
    assert.equal(Math.round((50 - strandedExcess(1250, 1400, 0)) * 100) / 100, 50);
  });

  it('paymentsTotalByPlayer groups in cents', () => {
    const totals = paymentsTotalByPlayer([
      { playerId: 'a', amount: 0.1 },
      { playerId: 'a', amount: 0.2 },
      { playerId: 'b', amount: 300 },
    ]);
    assert.equal(totals.get('a'), 0.3);
    assert.equal(totals.get('b'), 300);
  });
});
