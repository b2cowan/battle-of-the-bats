/**
 * THE STRIP'S OWN ROOT — which dollar is cash, in which month, in which direction.
 *
 * Same division of labour as `coach-expense-movements.test.ts`: `check:money-report` proves the
 * strip AGREES with the register month-by-month, but two surfaces agreeing on a wrong rule is
 * exactly what that script cannot see (both would apply it). Each inclusion/dating rule the strip
 * carries is pinned here individually, against the register's documented behaviour.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildActualCashStrip, type CashStripInputs } from '../../lib/coach-cash-strip.ts';

const empty = (): CashStripInputs => ({
  duesPayments: [],
  moneyInRecords: [],
  realisedEntries: [],
  clubRequests: [],
  expensePayments: [],
  duesPayouts: [],
  clubInstallments: [],
});

describe('buildActualCashStrip', () => {
  it('buckets every stream by the month the money moved, both directions, gross', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayments: [
        { amount: 2400, receivedDate: '2025-09-04' },
        { amount: 1600, receivedDate: '2025-10-12' },
      ],
      moneyInRecords: [
        // Both kinds are cash in — money back is netted by the REPORT, never by cash.
        { amount: 200, receivedDate: '2025-10-20' },
      ],
      realisedEntries: [
        { amountRaised: 640, receivedDate: '2025-10-18', createdAt: '2025-11-01T14:00:00Z' },
      ],
      clubRequests: [
        { amount: 180, isReimbursement: true, reviewedAt: '2025-11-05T15:00:00Z', createdAt: '2025-11-01T15:00:00Z' },
        { amount: 95, isReimbursement: false, reviewedAt: '2025-11-06T15:00:00Z', createdAt: '2025-11-02T15:00:00Z' },
      ],
      expensePayments: [
        { amount: 1200, paidDate: '2025-09-10', familyPaidDirect: false },
      ],
      duesPayouts: [{ amount: 150, paidDate: '2025-11-14' }],
      clubInstallments: [{ amount: 300, paidAt: '2025-09-20T18:00:00Z' }],
    });

    assert.deepEqual(strip.in, {
      '2025-09': 2400,
      '2025-10': 1600 + 200 + 640,
      '2025-11': 180,
    });
    assert.deepEqual(strip.out, {
      '2025-09': 1200 + 300,
      '2025-11': 150 + 95,
    });
  });

  it('drops a family-paid-direct cost — spending on the report, never team cash', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      expensePayments: [
        { amount: 250, paidDate: '2025-10-08', familyPaidDirect: true },
        { amount: 100, paidDate: '2025-10-09', familyPaidDirect: false },
      ],
    });
    assert.deepEqual(strip.out, { '2025-10': 100 });
  });

  it('dates a drive by the day the money arrived, falling back to the recording day (mig 261)', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      realisedEntries: [
        // Knows its arrival day → that month, even though it was recorded much later.
        { amountRaised: 300, receivedDate: '2025-08-30', createdAt: '2025-10-01T12:00:00Z' },
        // Legacy row (and every sponsor today): the recording day, as the register does.
        { amountRaised: 750, receivedDate: null, createdAt: '2025-11-03T12:00:00Z' },
      ],
    });
    assert.deepEqual(strip.in, { '2025-08': 300, '2025-11': 750 });
  });

  it('settles a club request on the day it was DECIDED, not filed', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      clubRequests: [
        { amount: 400, isReimbursement: false, reviewedAt: '2025-12-02T12:00:00Z', createdAt: '2025-11-20T12:00:00Z' },
        // Never reviewed (defensive: an approved row should always carry the stamp) → filing day.
        { amount: 60, isReimbursement: true, reviewedAt: null, createdAt: '2025-11-21T12:00:00Z' },
      ],
    });
    assert.deepEqual(strip.out, { '2025-12': 400 });
    assert.deepEqual(strip.in, { '2025-11': 60 });
  });

  it('counts only PAID club installments — an unpaid one is a projection, not cash', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      clubInstallments: [
        { amount: 300, paidAt: '2025-09-20T18:00:00Z' },
        { amount: 300, paidAt: null },
      ],
    });
    assert.deepEqual(strip.out, { '2025-09': 300 });
  });

  it('reports every dated cash day so the grid can grow a column for it (Exhibit C ruling)', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayments: [{ amount: 1050, receivedDate: '2025-08-14' }],
    });
    assert.deepEqual(strip.dates, ['2025-08-14']);
    assert.deepEqual(strip.in, { '2025-08': 1050 });
  });

  it('drops undated and zero amounts without inventing a month', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayments: [
        { amount: 100, receivedDate: null },
        { amount: 0, receivedDate: '2025-09-01' },
      ],
      duesPayouts: [{ amount: 50, paidDate: null }],
    });
    assert.deepEqual(strip.in, {});
    assert.deepEqual(strip.out, {});
    assert.deepEqual(strip.dates, []);
  });

  it('sums to the cent within a month (floating amounts round once per add)', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayments: [
        { amount: 0.1, receivedDate: '2025-09-01' },
        { amount: 0.2, receivedDate: '2025-09-02' },
      ],
    });
    assert.deepEqual(strip.in, { '2025-09': 0.3 });
  });
});
