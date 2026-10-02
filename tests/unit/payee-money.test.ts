import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { payeeMoneyByPayee } from '../../lib/payee-money.ts';
import { expensePayeeName } from '../../lib/expense-payee.ts';
import type { RegisterBookRow } from '../../lib/coach-register.ts';

/**
 * A payee's money this season (Ledger Parity round 3, D9 + D9a) — read from the Ledger's own rows, so the
 * Payees window and the Ledger can never disagree about one payment — and the name a bill's payee reads as
 * (D9b): the listed payee as it is named NOW, the typed text only for a payee never chosen from the list.
 */
const row = (over: Partial<RegisterBookRow> & { id: string }): RegisterBookRow => ({
  date: '2026-09-01', kind: 'expense', description: 'x', categoryName: null, itemName: null,
  moneyOut: 0, moneyIn: 0, scheduled: false, overdueDays: null, movesCash: true, balance: 0,
  ...over,
} as RegisterBookRow);

describe('payeeMoneyByPayee', () => {
  const book = [
    row({ id: 'a', date: '2026-09-12', moneyOut: 275 }),                                   // paid, Milton
    row({ id: 'b', date: '2026-09-25', moneyOut: 275, scheduled: true, overdueDays: 7 }),  // overdue, Milton
    row({ id: 'c', date: '2026-10-23', moneyOut: 275, scheduled: true }),                  // due, Milton
    row({ id: 'd', date: '2026-09-04', moneyOut: 350 }),                                   // paid, Ace
    row({ id: 'e', date: '2026-09-20', moneyIn: 50, kind: 'refund' }),                     // a refund FROM Ace
    row({ id: 'f', date: '2026-09-30', moneyOut: 99 }),                                    // names no payee
  ];
  const payeeOf = (r: RegisterBookRow) => ({ a: 'milton', b: 'milton', c: 'milton', d: 'ace', e: 'ace' } as Record<string, string>)[r.id] ?? null;
  const money = payeeMoneyByPayee(book, payeeOf);

  it('splits what happened from what is still to come, per payee', () => {
    const m = money.get('milton')!;
    assert.equal(m.paid, 275);
    assert.equal(m.toPay, 550);
    assert.equal(m.overdue, true);
    assert.equal(m.lastPaid, '2026-09-12');
    assert.deepEqual(m.nextDue, { date: '2026-09-25', amount: 275 }, 'the overdue installment is next, by its date');
    assert.deepEqual(m.rows.map(r => r.id), ['a', 'b', 'c'], 'the payee’s rows, in the book’s order');
  });

  it('money in never counts as paid (only a bill names a payee; a stray money-in row is ignored by the figures)', () => {
    const m = money.get('ace')!;
    assert.equal(m.paid, 350);
    assert.equal(m.toPay, 0);
    assert.equal(m.nextDue, null);
    assert.equal(m.lastPaid, '2026-09-04', 'a refund is not a payment');
  });

  it('a family-fronted payment still counts as paid to the payee (the team’s cash did not move; the payee was paid)', () => {
    const fronted = payeeMoneyByPayee([row({ id: 'x', moneyOut: 180, movesCash: false } as Partial<RegisterBookRow> & { id: string })], () => 'umpires').get('umpires')!;
    assert.equal(fronted.paid, 180);
  });

  it('a row naming no listed payee belongs to nobody; a payee with no rows is absent', () => {
    assert.equal(money.size, 2);
    assert.equal(money.get('nobody'), undefined);
  });

  it('adds in cents — three 0.1s are 0.3', () => {
    const m = payeeMoneyByPayee([0.1, 0.1, 0.1].map((n, i) => row({ id: `r${i}`, moneyOut: n })), () => 'p').get('p')!;
    assert.equal(m.paid, 0.3);
  });
});

describe('expensePayeeName', () => {
  it('the listed payee as it is named now wins over the text typed when the bill was entered', () => {
    assert.equal(expensePayeeName({ payeeId: 'p', payeeName: 'Town of Milton', payeePayer: 'Milton, Town of' }), 'Town of Milton');
  });
  it('a listed payee with no text beside it still has a name (the empty Payee field D9b found)', () => {
    assert.equal(expensePayeeName({ payeeId: 'p', payeeName: 'Milton, Town of', payeePayer: null }), 'Milton, Town of');
  });
  it('a one-time payee is its text; nothing is nothing', () => {
    assert.equal(expensePayeeName({ payeeId: null, payeeName: null, payeePayer: 'Corner store' }), 'Corner store');
    assert.equal(expensePayeeName({ payeeId: null, payeeName: null, payeePayer: null }), null);
  });
  it('a read that did not embed the name falls back to the text rather than going blank', () => {
    assert.equal(expensePayeeName({ payeeId: 'p', payeePayer: 'Milton, Town of' }), 'Milton, Town of');
  });
});
