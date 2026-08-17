import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBook,
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
 * balance being the balance BEFORE it, an out-of-pocket cost moving money it never moved, or a
 * projection leaking into the settled close.
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
    movesCash: true,
    open: null,
    markPaid: null,
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

  it('the last settled row carries the season cash, and every row is one of its movements', () => {
    const book = buildBook(season);
    assert.equal(book.cashOnHand, 1200 - 450 + 800 - 1300 + 400);
    // Newest first, so the closing balance is the FIRST row a coach reads.
    assert.equal(book.settled[0].id, 'refund');
    assert.equal(book.settled[0].balance, book.cashOnHand);
    assert.equal(book.settled.at(-1)!.id, 'dues-1');
  });

  it('each row carries the balance AFTER it, not before', () => {
    const book = buildBook(season);
    const byId = new Map(book.settled.map(r => [r.id, r.balance]));
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
    const bats = book.settled.find(r => r.id === 'bats')!;
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
    // Soonest first inside the scheduled block (plan §4.1).
    assert.deepEqual(book.scheduled.map(r => r.id), ['due-1', 'inst-2']);
    assert.equal(book.scheduled[0].balance, 150);
    assert.equal(book.scheduled[1].balance, 450);
  });

  it('a dateless row sorts to the end of its block rather than vanishing', () => {
    const book = buildBook([
      row({ id: 'unpaid', date: null, kind: 'expense', moneyOut: 90, scheduled: true }),
      row({ id: 'soon',   date: '2026-06-01', kind: 'expense', moneyOut: 10, scheduled: true }),
    ]);
    assert.deepEqual(book.scheduled.map(r => r.id), ['soon', 'unpaid']);
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
});

describe('the register — filters, and when a balance may be shown', () => {
  it('the type filter narrows to one kind, and All keeps everything', () => {
    const expense = row({ id: 'e', kind: 'expense' });
    const dues = row({ id: 'd', kind: 'dues' });
    assert.ok(matchesFilter(expense, 'all') && matchesFilter(dues, 'all'));
    assert.ok(matchesFilter(expense, 'expense'));
    assert.ok(!matchesFilter(dues, 'expense'));
  });

  it('⚠⚠ any narrowing at all takes the Balance column away', () => {
    assert.ok(balanceIsMeaningful('all', ''), 'the whole book: the balance is the team position');
    assert.ok(!balanceIsMeaningful('expense', ''), 'a running balance over one kind is not cash');
    assert.ok(!balanceIsMeaningful('all', 'item-1'), 'nor is one over a single item');
  });
});
