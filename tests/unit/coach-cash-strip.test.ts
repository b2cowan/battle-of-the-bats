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
import { PAYOUT_CATEGORY_ID, PAYOUT_CATEGORY_NAME } from '../../lib/coach-budget-months.ts';

/**
 * A cash-out record's non-money half — the id, the words behind the figure and where it files.
 *
 * ⚠ THE PLACEMENT IS DELIBERATELY THE SAME ON EVERY FIXTURE ROW unless a test says otherwise. What
 * this module decides is WHICH record is cash, WHEN, and in WHICH DIRECTION; where it files is the
 * caller's answer, carried through unread. Varying it per row would make these tests look like they
 * were checking placement, which would be a lie about what is guarded.
 */
const outRec = (amount: number) => ({
  id: `rec-${amount}`,
  description: `Record ${amount}`,
  amount,
  place: { categoryId: 'cat-1', categoryName: 'Facilities', itemId: 'item-1' },
});

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
        { amount: 200, receivedDate: '2025-10-20', kind: 'money_back' as const },
      ],
      realisedEntries: [
        { amountRaised: 640, receivedDate: '2025-10-18', createdAt: '2025-11-01T14:00:00Z', kind: 'fundraiser' as const },
      ],
      clubRequests: [
        { ...outRec(180), isReimbursement: true, reviewedAt: '2025-11-05T15:00:00Z', createdAt: '2025-11-01T15:00:00Z' },
        { ...outRec(95), isReimbursement: false, reviewedAt: '2025-11-06T15:00:00Z', createdAt: '2025-11-02T15:00:00Z' },
      ],
      expensePayments: [
        { ...outRec(1200), paidDate: '2025-09-10', familyPaidDirect: false },
      ],
      duesPayouts: [{ id: 'payout-150', amount: 150, paidDate: '2025-11-14' }],
      clubInstallments: [{ ...outRec(300), paidAt: '2025-09-20T18:00:00Z' }],
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

  /* ⚠⚠ 'DROPPED' IS NOT THE SAME AS 'FORGOTTEN' (2026-08-24). The Statement counts these and cash
     cannot, and the STATEMENT now explains that gap to a coach — from this list. If the exclusion
     ever stops reporting itself, the bridge on screen silently loses a line and stops adding up,
     while every other figure in this module stays correct. */
  it('REPORTS what it excluded, so the Statement can explain its own gap', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      expensePayments: [
        { ...outRec(599), paidDate: '2026-07-02', familyPaidDirect: true },
        { ...outRec(61), paidDate: '2026-08-09', familyPaidDirect: true },
        { ...outRec(300), paidDate: '2026-06-01', familyPaidDirect: false },
      ],
    });
    assert.deepEqual(strip.excluded.map(e => e.amount).sort((a, b) => a - b), [61, 599]);
    // It carries the words and the filing, because the bridge names WHICH costs, not just how much.
    assert.equal(strip.excluded[0].description, 'Record 599');
    assert.equal(strip.excluded[0].place.categoryName, 'Facilities');
    assert.equal(strip.excluded[0].date, '2026-07-02');
    // And it stayed out of the cash the band actually shows.
    assert.deepEqual(strip.out, { '2026-06': 300 });
  });

  it('excludes nothing when no family paid a vendor directly', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      expensePayments: [{ ...outRec(300), paidDate: '2026-06-01', familyPaidDirect: false }],
    });
    assert.deepEqual(strip.excluded, []);
  });
  it('drops a family-paid-direct cost — spending on the report, never team cash', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      expensePayments: [
        { ...outRec(250), paidDate: '2025-10-08', familyPaidDirect: true },
        { ...outRec(100), paidDate: '2025-10-09', familyPaidDirect: false },
      ],
    });
    assert.deepEqual(strip.out, { '2025-10': 100 });
  });

  it('dates a drive by the day the money arrived, falling back to the recording day (mig 261)', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      realisedEntries: [
        // Knows its arrival day → that month, even though it was recorded much later.
        { amountRaised: 300, receivedDate: '2025-08-30', createdAt: '2025-10-01T12:00:00Z', kind: 'fundraiser' as const },
        // Legacy row (and every sponsor today): the recording day, as the register does.
        { amountRaised: 750, receivedDate: null, createdAt: '2025-11-03T12:00:00Z', kind: 'fundraiser' as const },
      ],
    });
    assert.deepEqual(strip.in, { '2025-08': 300, '2025-11': 750 });
  });

  it('settles a club request on the day it was DECIDED, not filed', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      clubRequests: [
        { ...outRec(400), isReimbursement: false, reviewedAt: '2025-12-02T12:00:00Z', createdAt: '2025-11-20T12:00:00Z' },
        // Never reviewed (defensive: an approved row should always carry the stamp) → filing day.
        { ...outRec(60), isReimbursement: true, reviewedAt: null, createdAt: '2025-11-21T12:00:00Z' },
      ],
    });
    assert.deepEqual(strip.out, { '2025-12': 400 });
    assert.deepEqual(strip.in, { '2025-11': 60 });
  });

  it('counts only PAID club installments — an unpaid one is a projection, not cash', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      clubInstallments: [
        { ...outRec(300), paidAt: '2025-09-20T18:00:00Z' },
        { ...outRec(300), paidAt: null },
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
      duesPayouts: [{ id: 'payout-50', amount: 50, paidDate: null }],
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

/**
 * THE REVENUE BAND'S GROUPING (Option D, owner ruling 2026-08-23).
 *
 * ⚠ EVERY ONE OF THESE IS A ROUTING DECISION A GUARD CANNOT MAKE. `check:money-report` holds the
 * bands equal to the register, but the register carries a fundraising row's NAME and not its kind —
 * so it cannot tell a bottle drive from a sponsor cheque, and it deliberately sums the two groups
 * together. Which of the five groups a dollar lands in is pinned HERE and nowhere else.
 */
describe('buildActualCashStrip — the revenue band', () => {
  const groups = (strip: ReturnType<typeof buildActualCashStrip>) => {
    const by: Record<string, number> = {};
    for (const e of strip.revenue) by[e.group] = Math.round(((by[e.group] ?? 0) + e.amount) * 100) / 100;
    return by;
  };

  it('routes each source to its own group — and money back is REVENUE, never a smaller cost', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayments: [{ amount: 2400, receivedDate: '2025-09-04' }],
      moneyInRecords: [
        { amount: 500, receivedDate: '2025-09-05', kind: 'income' },
        { amount: 200, receivedDate: '2025-10-20', kind: 'money_back' },
      ],
      realisedEntries: [
        { amountRaised: 640, receivedDate: '2025-10-18', createdAt: '2025-10-18T12:00:00Z', kind: 'fundraiser' },
        { amountRaised: 750, receivedDate: '2025-11-03', createdAt: '2025-11-03T12:00:00Z', kind: 'sponsor' },
      ],
      // The club repaying a cost is the same species of arrival as a vendor refunding one.
      clubRequests: [{ ...outRec(180), isReimbursement: true, reviewedAt: '2025-11-05T15:00:00Z', createdAt: '2025-11-01T15:00:00Z' }],
    });
    assert.deepEqual(groups(strip), {
      dues: 2400,
      other: 500,
      moneyback: 200 + 180,
      fundraising: 640,
      sponsorship: 750,
    });
  });

  it('a drive and a sponsor are two groups, not one “fundraising” figure', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      realisedEntries: [
        { amountRaised: 100, receivedDate: '2025-09-01', createdAt: '2025-09-01T12:00:00Z', kind: 'fundraiser' },
        { amountRaised: 250, receivedDate: '2025-09-02', createdAt: '2025-09-02T12:00:00Z', kind: 'sponsor' },
      ],
    });
    assert.deepEqual(groups(strip), { fundraising: 100, sponsorship: 250 });
  });

  it('an outgoing club request is a COST filed where the request was filed, never negative revenue', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      clubRequests: [{ ...outRec(400), isReimbursement: false, reviewedAt: '2025-12-02T12:00:00Z', createdAt: '2025-11-20T12:00:00Z' }],
    });
    assert.deepEqual(strip.revenue, []);
    assert.equal(strip.expenses.length, 1);
    assert.equal(strip.expenses[0].place.categoryName, 'Facilities');
  });
});

/**
 * THE EXPENSES BAND — placement carried through, and money paid back to a family in its own group.
 */
describe('buildActualCashStrip — the expenses band', () => {
  it('files a payout under its own group rather than a budget category it never had', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      expensePayments: [{ ...outRec(1200), paidDate: '2025-09-10', familyPaidDirect: false }],
      duesPayouts: [{ id: 'dues-payout-1', amount: 150, paidDate: '2025-11-14' }],
    });
    const payout = strip.expenses.find(e => e.id === 'dues-payout-1');
    assert.ok(payout, 'the payout never reached the expenses band');
    assert.equal(payout!.place.categoryId, PAYOUT_CATEGORY_ID);
    assert.equal(payout!.place.categoryName, PAYOUT_CATEGORY_NAME);
    assert.equal(payout!.place.itemId, null);
  });

  /* ⚠ THE ORDER IS A DISPLAY RULE WITH A REAL CONSEQUENCE: the month grid orders categories it
     learns from events by FIRST APPEARANCE, so a payout emitted early would sit among the team's
     real spending categories instead of at the foot of the band, where it is drawn. */
  it('emits payouts LAST so “Paid back to families” lands at the foot of the band', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayouts: [{ id: 'dues-payout-1', amount: 150, paidDate: '2025-09-01' }],
      expensePayments: [{ ...outRec(80), paidDate: '2025-12-01', familyPaidDirect: false }],
    });
    assert.deepEqual(strip.expenses.map(e => e.place.categoryName), ['Facilities', PAYOUT_CATEGORY_NAME]);
  });

  it('carries the id and the words a drill-in shows behind a figure', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      expensePayments: [{
        id: 'exp-1-payment-9', description: 'Dome rental — payment 2 of 3', amount: 400,
        place: { categoryId: 'cat-2', categoryName: 'Facilities', itemId: 'item-9' },
        paidDate: '2025-10-02', familyPaidDirect: false,
      }],
    });
    assert.deepEqual(strip.expenses[0], {
      id: 'exp-1-payment-9', description: 'Dome rental — payment 2 of 3', amount: 400,
      place: { categoryId: 'cat-2', categoryName: 'Facilities', itemId: 'item-9' },
      date: '2025-10-02',
    });
  });

  /* ⚠⚠ THE COARSE MAPS ARE A PROJECTION OF THE EVENTS, NOT A SECOND WALK. This is the property the
     module's header promises and the one thing that could silently stop being true: a stream added
     to the events and not to the maps (or the reverse) is precisely how payouts and drive money
     went missing from the strip for weeks. */
  it('in/out are exactly the events summed — one walk, two grains', () => {
    const strip = buildActualCashStrip({
      ...empty(),
      duesPayments: [{ amount: 2400, receivedDate: '2025-09-04' }],
      moneyInRecords: [{ amount: 200, receivedDate: '2025-09-20', kind: 'money_back' }],
      realisedEntries: [{ amountRaised: 640, receivedDate: '2025-10-18', createdAt: '2025-10-18T12:00:00Z', kind: 'sponsor' }],
      expensePayments: [{ ...outRec(1200), paidDate: '2025-09-10', familyPaidDirect: false }],
      duesPayouts: [{ id: 'dues-payout-1', amount: 150, paidDate: '2025-10-14' }],
    });
    const bucket = (events: Array<{ date: string | null; amount: number }>) => {
      const by: Record<string, number> = {};
      for (const e of events) {
        if (!e.date) continue;
        const m = e.date.slice(0, 7);
        by[m] = Math.round(((by[m] ?? 0) + e.amount) * 100) / 100;
      }
      return by;
    };
    assert.deepEqual(strip.in, bucket(strip.revenue));
    assert.deepEqual(strip.out, bucket(strip.expenses));
  });
});
