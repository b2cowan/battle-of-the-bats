import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBook,
  applyDateRange,
  cashOnHandCents,
  balanceIsMeaningful,
  matchesFilter,
  toDollars,
  type RegisterRow,
} from '../../lib/coach-register';

/**
 * The register's arithmetic — the one claim the whole screen rests on.
 *
 * ⚠ THE TEST THAT MATTERS IS `the balance at Today IS the cash`. Everything else here exists to stop
 * one of the ways that claim can be broken without looking broken: a row counted twice, a row's
 * balance being the balance BEFORE it, an out-of-pocket cost moving money it never moved, an overdue
 * row moving money that never moved either, a projection leaking into the settled close, or a date
 * range hiding money that's still outstanding.
 */

function row(over: Partial<RegisterRow> & { id: string }): RegisterRow {
  return {
    date: '2026-05-01',
    kind: 'expense',
    description: 'A thing',
    categoryName: null,
    itemName: null,
    moneyOut: 0,
    moneyIn: 0,
    scheduled: false,
    overdueDays: null,
    movesCash: true,
    open: null,
    recordPayment: null,
    sourceLabel: null,
    detail: null,
    ...over,
  };
}

describe('the register — the balance IS Cash on hand, decomposed', () => {
  const season: RegisterRow[] = [
    row({ id: 'dues-1',    date: '2026-04-02', kind: 'dues',   moneyIn: 1200 }),
    row({ id: 'rent',      date: '2026-04-10', kind: 'expense', moneyOut: 450 }),
    row({ id: 'raffle',    date: '2026-04-20', kind: 'fundraising', moneyIn: 800 }),
    row({ id: 'entry-fee', date: '2026-05-01', kind: 'expense', moneyOut: 1300 }),
    row({ id: 'refund',    date: '2026-05-14', kind: 'refund',  moneyIn: 400 }),
  ];

  /**
   * A SEASON THAT WAS HANDED MONEY (mig 262, owner ruling 2026-08-23).
   *
   * ⚠ THE CARRY IS NOT A ROW AND MUST NEVER BECOME ONE. It has no kind, so it would answer to no
   * filter; it has no date, so it would answer to no window; and it moved on a day this season
   * cannot see. It is where the walk STARTS — which is why every assertion below is about a
   * balance rather than about a row.
   */
  describe('an opening balance carried from the season before', () => {
    it('every balance, the close and the projection all start from it', () => {
      const book = buildBook(season, 500);
      assert.equal(book.opening, 500);
      assert.equal(book.book[0].balance, 500 + 1200, 'the first row builds ON the carry');
      assert.equal(book.cashOnHand, 500 + 1200 - 450 + 800 - 1300 + 400);
      assert.equal(book.book.length, season.length, 'the carry did not become a row');
    });

    it('is the same arithmetic money-summary runs, to the cent', () => {
      /* ⚠ THE PAIR THAT CANNOT BE ALLOWED TO DISAGREE. `/register` sums rows and `money-summary`
         sums category totals; an opening balance reaching one and not the other is a difference in
         DOLLARS with both figures still looking plausible. */
      assert.equal(
        toDollars(cashOnHandCents(season, 50_000)),
        buildBook(season, 500).cashOnHand,
      );
    });

    it('a season that carried nothing is unchanged', () => {
      assert.equal(buildBook(season).opening, 0);
      assert.equal(buildBook(season).cashOnHand, buildBook(season, 0).cashOnHand);
    });

    it('an overdue row before the first settled one carries the opening balance, not zero', () => {
      const book = buildBook([
        row({ id: 'late-bill', date: '2026-03-01', moneyOut: 300, scheduled: true, overdueDays: 40 }),
        row({ id: 'dues-1', date: '2026-04-02', kind: 'dues', moneyIn: 1200 }),
      ], 500);
      // It shows the real cash that existed immediately before it — which, first on the page, is
      // the carry. It never advances the balance itself; no cash moved.
      assert.equal(book.book[0].balance, 500);
      assert.equal(book.cashOnHand, 500 + 1200);
    });

    it('the whole-season window OPENS on the carry, and a narrowed one does not', () => {
      const book = buildBook(season, 500);
      const whole = applyDateRange(book.book, '2026-01-01', '2026-12-31', 500);
      assert.equal(whole.startingBalance, 500);
      assert.equal(whole.isSeasonOpening, true, 'nothing precedes the window — this IS the opening');

      const later = applyDateRange(book.book, '2026-05-01', '2026-12-31', 500);
      assert.equal(later.startingBalance, 500 + 1200 - 450 + 800, 'an ordinary starting balance');
      assert.equal(later.isSeasonOpening, false);
    });
  });

  it('the whole book reads oldest to newest, top to bottom', () => {
    const book = buildBook(season);
    assert.equal(book.cashOnHand, 1200 - 450 + 800 - 1300 + 400);
    // Oldest first: the closing balance is the LAST row a coach reads, not the first.
    assert.equal(book.book[0].id, 'dues-1');
    assert.equal(book.book.at(-1)!.id, 'refund');
    assert.equal(book.book.at(-1)!.balance, book.cashOnHand);
    assert.equal(book.todayIndex, season.length, 'nothing scheduled, so Today sits at the very end');
  });

  it('each row carries the balance AFTER it, reading down — not the row above it', () => {
    const book = buildBook(season);
    const byId = new Map(book.book.map(r => [r.id, r.balance]));
    assert.equal(byId.get('dues-1'), 1200);
    assert.equal(byId.get('rent'), 750);
    assert.equal(byId.get('raffle'), 1550);
    assert.equal(byId.get('entry-fee'), 250);
    assert.equal(byId.get('refund'), 650);
  });

  it('⚠⚠ an out-of-pocket cost sits on the book and does NOT move the balance', () => {
    const withOutOfPocket = [
      ...season,
      row({ id: 'bats', date: '2026-05-20', kind: 'expense', moneyOut: 325, movesCash: false }),
    ];
    const book = buildBook(withOutOfPocket);
    // The season spent it; the team's cash did not.
    assert.equal(book.cashOnHand, 650, 'no team cash moved, so cash on hand cannot change');
    const bats = book.book.find(r => r.id === 'bats')!;
    assert.equal(bats.moneyOut, 325, 'the amount is still shown — it is a real expense');
    assert.equal(bats.balance, 650, 'the balance stands still beside it');
  });

  it('a projection never reaches the settled close', () => {
    const book = buildBook([
      ...season,
      row({ id: 'due-1', date: '2026-06-01', kind: 'expense', moneyOut: 500, scheduled: true }),
      row({ id: 'inst-2', date: '2026-06-15', kind: 'dues', moneyIn: 300, scheduled: true }),
    ]);
    assert.equal(book.cashOnHand, 650, 'cash is what has MOVED');
    assert.equal(book.projectedBalance, 450, 'and the projection continues on from it');
    assert.equal(book.todayIndex, season.length, 'Today sits right after the settled history');
    // Soonest first among the future rows, sitting after Today.
    const future = book.book.slice(book.todayIndex).map(r => r.id);
    assert.deepEqual(future, ['due-1', 'inst-2']);
    assert.equal(book.book[book.todayIndex].balance, 150);
    assert.equal(book.book[book.todayIndex + 1].balance, 450);
  });

  it('a dateless future row sorts to the end rather than vanishing', () => {
    const book = buildBook([
      row({ id: 'unpaid', date: null, kind: 'expense', moneyOut: 90, scheduled: true }),
      row({ id: 'soon',   date: '2026-06-01', kind: 'expense', moneyOut: 10, scheduled: true }),
    ]);
    assert.deepEqual(book.book.map(r => r.id), ['soon', 'unpaid']);
  });

  it('nothing scheduled means no projection to state', () => {
    assert.equal(buildBook(season).projectedBalance, null);
  });

  it('the cash figure is computed in whole cents', () => {
    const pennies = [
      row({ id: 'a', kind: 'income', moneyIn: 0.1 }),
      row({ id: 'b', kind: 'income', moneyIn: 0.2 }),
    ];
    // 0.1 + 0.2 in floats is 0.30000000000000004, which would print a cash figure a hair off the
    // one money-summary reports — and the register's whole claim is that the two are equal.
    assert.equal(toDollars(cashOnHandCents(pennies)), 0.3);
  });

  describe('⚠⚠ overdue rows — reading-order follow-up to P3', () => {
    it('sits at its TRUE date, interleaved with settled history, and never moves the balance', () => {
      const book = buildBook([
        ...season,
        // Due 04-15 — between rent (04-10) and raffle (04-20) — 30 days overdue, say.
        row({ id: 'late-fee', date: '2026-04-15', kind: 'club', moneyOut: 60, scheduled: true, overdueDays: 30 }),
      ]);
      const ids = book.book.map(r => r.id);
      assert.deepEqual(ids, ['dues-1', 'rent', 'late-fee', 'raffle', 'entry-fee', 'refund']);
      const late = book.book.find(r => r.id === 'late-fee')!;
      assert.equal(late.balance, 750, 'carries forward whatever real cash existed at that point — rent’s balance, unchanged');
      assert.equal(book.book.find(r => r.id === 'raffle')!.balance, 1550, 'the row after it is unaffected — real accumulation skips the overdue row entirely');
      assert.equal(book.cashOnHand, 1200 - 450 + 800 - 1300 + 400, 'the overdue $60 never enters cash on hand');
    });

    it('an overdue row older than every settled row still lands correctly, at $0', () => {
      const book = buildBook([
        row({ id: 'ancient', date: '2026-01-01', kind: 'dues', moneyIn: 100, scheduled: true, overdueDays: 120 }),
        row({ id: 'first-cost', date: '2026-02-01', kind: 'expense', moneyOut: 40 }),
      ]);
      assert.deepEqual(book.book.map(r => r.id), ['ancient', 'first-cost']);
      assert.equal(book.book[0].balance, 0, 'nothing had moved yet when this was due');
      assert.equal(book.book[1].balance, -40);
    });

    it('overdueDays null on a scheduled row with a future date keeps it in the forward projection, not interleaved', () => {
      const book = buildBook([
        ...season,
        row({ id: 'not-due-yet', date: '2026-05-10', kind: 'expense', moneyOut: 20, scheduled: true, overdueDays: null }),
      ]);
      assert.equal(book.todayIndex, season.length);
      assert.equal(book.book.at(-1)!.id, 'not-due-yet', 'projected, sitting after Today, not interleaved into the settled past');
    });
  });
});

describe('the register — the date range is a REAL window (real-data fix)', () => {
  const rows: RegisterRow[] = [
    row({ id: 'old-1', date: '2026-01-05', moneyOut: 100 }),
    // Overdue but still hidden by the range — the earlier version of this function exempted
    // every unsettled row, which made a "Jul–Sep" range show rows from March. The panel's Overdue
    // count (computed independently, before this function runs) is the actual safety net now.
    row({ id: 'overdue-old', date: '2026-01-12', scheduled: true, overdueDays: 15, moneyOut: 15 }),
    row({ id: 'old-2', date: '2026-01-20', moneyIn: 50 }),
    row({ id: 'in-range', date: '2026-02-10', moneyOut: 30 }),
    row({ id: 'future', date: '2026-03-01', scheduled: true, overdueDays: null, moneyIn: 200 }),
    // No due date at all — exempt for a different reason: there's nothing to compare to a window,
    // and the register's standing rule is that an undated row never vanishes.
    row({ id: 'undated', date: null, scheduled: true, overdueDays: null, moneyOut: 10 }),
  ];

  it('hides EVERY dated row outside the window, settled or not — overdue included', () => {
    const book = buildBook(rows);
    const { rows: visible } = applyDateRange(book.book, '2026-02-01', '2026-02-28');
    const ids = visible.map(r => r.id);
    assert.ok(ids.includes('in-range'));
    assert.ok(!ids.includes('old-1') && !ids.includes('old-2'), 'settled rows outside the range are hidden');
    assert.ok(!ids.includes('overdue-old'), 'overdue is no longer exempt — the range means the range');
    assert.ok(!ids.includes('future'), 'future is no longer exempt either');
  });

  it('an undated row is exempt — there is no date to compare, not a special case for this control', () => {
    const book = buildBook(rows);
    const { rows: visible } = applyDateRange(book.book, '2026-02-01', '2026-02-28');
    assert.ok(visible.map(r => r.id).includes('undated'));
  });

  it('every visible balance is still the true cumulative total — narrowing hides rows, not arithmetic', () => {
    const book = buildBook(rows);
    const { rows: visible } = applyDateRange(book.book, '2026-02-01', '2026-02-28');
    const inRange = visible.find(r => r.id === 'in-range')!;
    // Same balance it would show with the range wide open — the range didn't touch the sum.
    const fullBook = buildBook(rows).book;
    assert.equal(inRange.balance, fullBook.find(r => r.id === 'in-range')!.balance);
  });

  it('starting balance is the true cumulative total right before the window opens', () => {
    const book = buildBook(rows);
    const { startingBalance } = applyDateRange(book.book, '2026-02-01', '2026-02-28');
    // old-2 (01-20) is the last row before Feb 1 — its own balance IS the starting balance.
    // old-1 (-100) then overdue-old (carried, no change) then old-2 (+50) = -50.
    assert.equal(startingBalance, -50);
  });

  it('a window opening before any history starts at zero', () => {
    const book = buildBook(rows);
    const { startingBalance } = applyDateRange(book.book, '2025-01-01', '2025-01-31');
    assert.equal(startingBalance, 0);
  });

  it('a row dated AFTER the window does not affect the starting balance', () => {
    const book = buildBook(rows);
    // future (03-01) is after this window's end, not before its start — must not leak in.
    const { startingBalance } = applyDateRange(book.book, '2026-02-01', '2026-02-28');
    assert.equal(startingBalance, -50, 'unchanged whether or not later rows exist');
  });
});

describe('the register — filters, and when a balance may be shown', () => {
  it('the type filter narrows to one kind, and All keeps everything', () => {
    const expense = row({ id: 'e', kind: 'expense' });
    const dues = row({ id: 'd', kind: 'dues' });
    assert.ok(matchesFilter(expense, 'all') && matchesFilter(dues, 'all'));
    assert.ok(matchesFilter(expense, 'expense'));
    assert.ok(!matchesFilter(dues, 'expense'));
  });

  it('⚠⚠ any TYPE narrowing at all takes the Balance column away', () => {
    assert.ok(balanceIsMeaningful('all', ''), 'the whole book: the balance is the team position');
    assert.ok(!balanceIsMeaningful('expense', ''), 'a running balance over one kind is not cash');
    assert.ok(!balanceIsMeaningful('all', 'item-1'), 'nor is one over a single item');
  });
});
