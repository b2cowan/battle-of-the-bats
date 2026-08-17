/**
 * THE ROOT OF THE MONEY REPORT'S ARITHMETIC — which stamp dates which dollar.
 *
 * ⚠⚠ THIS FILE EXISTS BECAUSE THE REPORT's BUILD-BLOCKING CHECK CANNOT SEE IN HERE (`/review`
 * verification-integrity lens, 2026-08-17 — Critical). `scripts/check-money-report-arithmetic.mjs`
 * asserts that the statement, the Months grid and the cumulative chart land on one number. That was
 * strong evidence while the three were three independent walks of the database. The consolidation this
 * release shipped made them three readings of ONE list — so a mistake in `paidMovements` is now
 * invisible to it: all three feeds agree, on the wrong answer, and the check reports green. A July
 * balance charted in May would pass.
 *
 * So the two safeguards divide the work, and neither substitutes for the other:
 *   · `check-money-report-arithmetic.mjs` guards the PLUMBING — a kind of money that reaches only two
 *     of the three feeds.
 *   · this file guards the ROOT — that a movement carries the right amount on the right day.
 *
 * Every case below is a shape the database can actually hold. `deposit_amount + balance_amount ==
 * amount` is enforced by nothing (DATA_DICTIONARY, `rep_team_expenses` gotcha 2), so the awkward ones
 * are not hypothetical.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paidMovements, type PaidExpenseRow } from '../../lib/coach-expense-movements.ts';

/** Org noon, the convention every `*_paid_at` is written at — see `paidDayOf`. */
const noon = (day: string) => `${day}T16:00:00.000Z`;

const row = (over: Partial<PaidExpenseRow> = {}): PaidExpenseRow =>
  ({ id: 'e1', description: 'Diamond permits', expense_type: 'expense', amount: 240, ...over });

const payable = (over: Partial<PaidExpenseRow> = {}): PaidExpenseRow =>
  ({
    id: 'p1', description: 'Regional qualifier entry', expense_type: 'tournament_payable',
    amount: 900, deposit_amount: 300, balance_amount: 600, ...over,
  });

describe('paidMovements — a simple expense', () => {
  it('is one movement on the day it was paid', () => {
    const [mv, ...rest] = paidMovements(row({ expense_paid_at: noon('2026-05-14') }));
    assert.deepStrictEqual(rest, []);
    assert.deepStrictEqual(mv, {
      id: 'e1', description: 'Diamond permits', amount: 240, paidDate: '2026-05-14',
    });
  });

  it('is nothing at all while it is unpaid', () => {
    assert.deepStrictEqual(paidMovements(row({ expense_paid_at: null })), []);
  });

  it('ignores the deposit/balance columns entirely', () => {
    // The two-payment model is by `expense_type`, NOT by which columns happen to be populated
    // (DATA_DICTIONARY gotcha 2). A plain expense carrying stray split figures is still one payment.
    const mvs = paidMovements(row({
      expense_paid_at: noon('2026-05-14'),
      deposit_amount: 100, deposit_paid_at: noon('2026-01-01'),
      balance_amount: 140, balance_paid_at: noon('2026-02-01'),
    }));
    assert.strictEqual(mvs.length, 1);
    assert.strictEqual(mvs[0].amount, 240);
    assert.strictEqual(mvs[0].paidDate, '2026-05-14');
  });

  it('counts a cost a family fronted — it is still spending against the plan', () => {
    // ⚠ The deliberate difference from `paidLedgerLegs`, which EXCLUDES these because no team cash
    // moved. Both are right about their own question; see this module's header.
    const mvs = paidMovements(row({ expense_paid_at: noon('2026-05-14') }));
    assert.strictEqual(mvs.length, 1, 'an out-of-pocket cost must still reach the budget report');
  });
});

describe('paidMovements — a payable is TWO movements, and this is the whole point', () => {
  it('splits into the two months it was actually paid in', () => {
    const mvs = paidMovements(payable({
      deposit_paid_at: noon('2026-05-14'),
      balance_paid_at: noon('2026-07-09'),
    }));
    assert.deepStrictEqual(mvs, [
      { id: 'p1-deposit', description: 'Regional qualifier entry — deposit', amount: 300, paidDate: '2026-05-14' },
      { id: 'p1-balance', description: 'Regional qualifier entry — balance', amount: 600, paidDate: '2026-07-09' },
    ]);
  });

  it('⚠ NEVER merges them onto the earlier date — the defect this module was extracted to prevent', () => {
    const mvs = paidMovements(payable({
      deposit_paid_at: noon('2026-05-14'),
      balance_paid_at: noon('2026-07-09'),
    }));
    const may = mvs.filter(m => m.paidDate.startsWith('2026-05')).reduce((s, m) => s + m.amount, 0);
    const july = mvs.filter(m => m.paidDate.startsWith('2026-07')).reduce((s, m) => s + m.amount, 0);
    assert.strictEqual(may, 300, 'the whole payable collapsed into the deposit\'s month');
    assert.strictEqual(july, 600, 'the balance went missing from the month it was paid in');
  });

  it('is one movement when only the deposit has been paid', () => {
    const mvs = paidMovements(payable({ deposit_paid_at: noon('2026-05-14'), balance_paid_at: null }));
    assert.deepStrictEqual(mvs.map(m => [m.id, m.amount, m.paidDate]),
      [['p1-deposit', 300, '2026-05-14']]);
  });

  it('is one movement when only the BALANCE has been paid, out of order', () => {
    // Nothing enforces that a deposit is paid first, and the old "earliest paid date" rule made this
    // shape especially wrong.
    const mvs = paidMovements(payable({ deposit_paid_at: null, balance_paid_at: noon('2026-07-09') }));
    assert.deepStrictEqual(mvs.map(m => [m.id, m.amount, m.paidDate]),
      [['p1-balance', 600, '2026-07-09']]);
  });

  it('is nothing while neither half is paid', () => {
    assert.deepStrictEqual(paidMovements(payable()), []);
  });

  it('keeps both halves when they were paid on the SAME day', () => {
    const mvs = paidMovements(payable({
      deposit_paid_at: noon('2026-05-14'), balance_paid_at: noon('2026-05-14'),
    }));
    assert.strictEqual(mvs.length, 2, 'two payments on one day are still two payments');
    assert.strictEqual(mvs.reduce((s, m) => s + m.amount, 0), 900);
  });

  it('does NOT fall back to the full amount when a half\'s figure is missing', () => {
    // ⚠ The other deliberate difference from `paidLedgerLegs`, which DOES fall back — and whose own
    // dictionary entry warns that doing so "can post the full amount twice". A budget report must not
    // invent a figure the coach never entered.
    const mvs = paidMovements(payable({
      deposit_amount: null, deposit_paid_at: noon('2026-05-14'),
      balance_amount: 600, balance_paid_at: noon('2026-07-09'),
    }));
    assert.deepStrictEqual(mvs.map(m => m.id), ['p1-balance']);
    assert.strictEqual(mvs[0].amount, 600, 'the missing deposit figure leaked into the balance');
  });
});

describe('paidMovements — figures the database can hold but money cannot be', () => {
  it('treats a NEGATIVE half as nothing moved, not as a subtraction', () => {
    // Storable: no CHECK constrains these columns. The grid always dropped it; the statement used to
    // sum it in, so one screen reported two totals for one row. They share this rule now.
    const mvs = paidMovements(payable({
      deposit_amount: -50, deposit_paid_at: noon('2026-05-14'),
      balance_amount: 200, balance_paid_at: noon('2026-07-09'),
    }));
    assert.deepStrictEqual(mvs.map(m => [m.id, m.amount]), [['p1-balance', 200]]);
  });

  it('treats zero as nothing moved', () => {
    assert.deepStrictEqual(
      paidMovements(payable({ deposit_amount: 0, deposit_paid_at: noon('2026-05-14') })), []);
    assert.deepStrictEqual(
      paidMovements(row({ amount: 0, expense_paid_at: noon('2026-05-14') })), []);
  });

  it('never emits a negative or a non-finite amount, whatever it is handed', () => {
    for (const bad of [null, undefined, 0, -1, NaN, Infinity, -Infinity]) {
      const mvs = paidMovements(row({ amount: bad as number, expense_paid_at: noon('2026-05-14') }));
      assert.deepStrictEqual(mvs, [], `an amount of ${String(bad)} produced a movement`);
    }
  });

  it('a paid stamp with no amount produces nothing rather than a zero-dollar movement', () => {
    assert.deepStrictEqual(
      paidMovements(row({ amount: null, expense_paid_at: noon('2026-05-14') })), []);
  });
});

describe('paidMovements — the date is the coach\'s day, from any timezone', () => {
  it('reads the ORG-NOON stamp as its own calendar day', () => {
    // Org noon in Toronto is 16:00Z in summer and 17:00Z in winter. Both must slice to the same day
    // the coach chose — that is the whole reason the write side stores noon.
    assert.strictEqual(paidMovements(row({ expense_paid_at: '2026-07-09T16:00:00.000Z' }))[0].paidDate, '2026-07-09');
    assert.strictEqual(paidMovements(row({ expense_paid_at: '2026-01-09T17:00:00.000Z' }))[0].paidDate, '2026-01-09');
  });

  it('accepts a bare date, which is what a migrated or hand-written row can carry', () => {
    assert.strictEqual(paidMovements(row({ expense_paid_at: '2026-07-09' }))[0].paidDate, '2026-07-09');
  });

  it('carries the day only — never a time, which would break every month bucket', () => {
    const mv = paidMovements(row({ expense_paid_at: noon('2026-07-09') }))[0];
    assert.match(mv.paidDate, /^\d{4}-\d{2}-\d{2}$/);
  });
});
