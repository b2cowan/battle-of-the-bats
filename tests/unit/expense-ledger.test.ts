import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { paidLedgerLegs, ledgerReversalPreview, lockedFields } from '../../lib/expense-ledger.ts';
import type { RepTeamExpense } from '../../lib/types.ts';

/**
 * These three functions decide what a coach is TOLD before deleting something, what the server then
 * gives back, and which figures a paid record still lets them change. Two readers each, on both
 * sides of the wire — so the cases that matter are the disagreements that would be invisible.
 */

function expense(over: Partial<RepTeamExpense> = {}): RepTeamExpense {
  return {
    id: 'e1',
    programYearId: 'py1',
    teamId: 't1',
    orgId: 'o1',
    expenseType: 'expense',
    description: 'Team pizza night',
    category: 'Events',
    amount: 120,
    expensePaidAt: null,
    depositAmount: null,
    depositDueDate: null,
    depositPaidAt: null,
    balanceAmount: null,
    balanceDueDate: null,
    balancePaidAt: null,
    eventId: null,
    notes: null,
    paymentMethod: null,
    payeeId: null,
    payeePayer: null,
    paidByPlayerId: null,
    accountingEntryId: null,
    depositEntryId: null,
    balanceEntryId: null,
    createdBy: null,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...over,
  } as RepTeamExpense;
}

const payable = (over: Partial<RepTeamExpense> = {}) =>
  expense({ expenseType: 'tournament_payable', description: 'Spring tournament entries', amount: 1300, ...over });

describe('what a record has posted to the books', () => {
  test('an unpaid expense has posted nothing', () => {
    assert.deepEqual(paidLedgerLegs(expense()), []);
    assert.equal(ledgerReversalPreview(expense()).amount, 0);
  });

  test('a paid expense posts its full amount, and carries its recorded entry', () => {
    const e = expense({ expensePaidAt: '2026-08-05T12:00:00Z', accountingEntryId: 'entry-1' });
    const legs = paidLedgerLegs(e);
    assert.equal(legs.length, 1);
    assert.equal(legs[0].amount, 120);
    assert.equal(legs[0].entryId, 'entry-1');
    assert.equal(legs[0].entryDescription, 'Team pizza night');
  });

  test('⚠ AN OUT-OF-POCKET EXPENSE POSTS NOTHING, even though it is marked paid', () => {
    // A family's money moved, not the team's — no cash entry was ever written. Reversing one would
    // credit the team for spending it never did.
    const e = expense({ expensePaidAt: '2026-08-05T12:00:00Z', paidByPlayerId: 'player-1' });
    assert.deepEqual(paidLedgerLegs(e), []);
    assert.equal(ledgerReversalPreview(e).amount, 0);
  });

  test('an out-of-pocket expense still reports the family debt separately from the money', () => {
    const e = expense({ expensePaidAt: '2026-08-05T12:00:00Z', paidByPlayerId: 'player-1' });
    const preview = ledgerReversalPreview(e);
    assert.equal(preview.owesFamily, true, 'the credit disappearing must be sayable on its own');
    assert.equal(preview.amount, 0, 'and must never be folded into a dollar figure coming back');
  });

  test('a part-paid payable posts only the half that settled', () => {
    const p = payable({
      depositAmount: 300, depositPaidAt: '2026-05-07T12:00:00Z', depositEntryId: 'entry-d',
      balanceAmount: 1000,
    });
    const legs = paidLedgerLegs(p);
    assert.equal(legs.length, 1);
    assert.equal(legs[0].half, 'deposit');
    assert.equal(legs[0].amount, 300);
    assert.equal(legs[0].entryDescription, 'Spring tournament entries — Deposit');
    assert.equal(ledgerReversalPreview(p).amount, 300);
  });

  test('a fully-paid payable posts both halves, and the preview sums them', () => {
    const p = payable({
      depositAmount: 300, depositPaidAt: '2026-05-07T12:00:00Z',
      balanceAmount: 1000, balancePaidAt: '2026-07-01T12:00:00Z',
    });
    const preview = ledgerReversalPreview(p);
    assert.equal(preview.legs, 2);
    assert.equal(preview.amount, 1300);
  });

  test('a half with no amount recorded falls back to the total, not to zero', () => {
    // Marking paid posts `depositAmount ?? amount`, so the reversal has to agree or it gives back
    // nothing for a payable that was never split.
    const p = payable({ depositPaidAt: '2026-05-07T12:00:00Z' });
    assert.equal(paidLedgerLegs(p)[0].amount, 1300);
  });

  test('a row paid before the link existed reports a null entry id, not an absent leg', () => {
    const e = expense({ expensePaidAt: '2026-01-01T12:00:00Z', accountingEntryId: null });
    const legs = paidLedgerLegs(e);
    assert.equal(legs.length, 1, 'it still posted money and still needs reversing');
    assert.equal(legs[0].entryId, null, 'the caller must know to fall back to matching');
  });

  test('sums stay exact to the cent', () => {
    const p = payable({
      amount: 0.3, depositAmount: 0.1, depositPaidAt: 'x', balanceAmount: 0.2, balancePaidAt: 'y',
    });
    assert.equal(ledgerReversalPreview(p).amount, 0.3);
  });
});

describe('which figures a saved record still lets you change', () => {
  test('nothing is locked before anything is paid', () => {
    const l = lockedFields(expense());
    assert.equal(l.amount, false);
    assert.equal(l.paidOn, null);
  });

  test('a paid expense locks its amount and says when', () => {
    const l = lockedFields(expense({ expensePaidAt: '2026-08-05T12:00:00Z' }));
    assert.equal(l.amount, true);
    assert.equal(l.paidOn, '2026-08-05T12:00:00Z');
  });

  test('⚠ A PART-PAID PAYABLE KEEPS ITS OPEN HALF EDITABLE', () => {
    // Freezing the whole row because the deposit settled would strand the coach on exactly the
    // commitment they still have to manage.
    const l = lockedFields(payable({ depositPaidAt: '2026-05-07T12:00:00Z' }));
    assert.equal(l.deposit, true);
    assert.equal(l.balance, false);
    assert.equal(l.amount, false, 'the total is not locked while a half is still open');
  });

  test('a payable locks its total only once BOTH halves have paid', () => {
    const l = lockedFields(payable({
      depositPaidAt: '2026-05-07T12:00:00Z', balancePaidAt: '2026-07-01T12:00:00Z',
    }));
    assert.equal(l.amount, true);
  });

  test('an out-of-pocket expense locks its amount like any other paid record', () => {
    // It posts no ledger entry, but the figure still drives the family's credit — editing it would
    // leave the debt disagreeing with the cost.
    const l = lockedFields(expense({ expensePaidAt: '2026-08-05T12:00:00Z', paidByPlayerId: 'p1' }));
    assert.equal(l.amount, true);
  });

  test('paidOn prefers the most decisive stamp available', () => {
    const l = lockedFields(payable({ depositPaidAt: '2026-05-07T00:00:00Z', balancePaidAt: '2026-07-01T00:00:00Z' }));
    assert.equal(l.paidOn, '2026-07-01T00:00:00Z', 'the later half is the one that finished it');
  });

  test('no record means no locks — the add form is never gated', () => {
    assert.deepEqual(lockedFields(null), { amount: false, deposit: false, balance: false, paidOn: null });
  });
});
