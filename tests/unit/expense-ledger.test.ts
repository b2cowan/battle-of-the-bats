import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { paidLedgerLegs, ledgerReversalPreview, paidOnDate, whyPaidDateIsRefused, asMoneyAmount } from '../../lib/expense-ledger.ts';
import type { RepTeamExpense } from '../../lib/types.ts';
import { orgDayAsStoredInstant, orgDayKey } from '../../lib/timezone.ts';

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

describe('paidOnDate — when a record last posted money', () => {
  /**
   * ⚖ THIS SUITE REPLACED THE FIGURE-LOCK TESTS (owner ruling 2026-08-16). They asserted that a
   * paid amount could not change; that rule is retired, because the books now follow a correction
   * instead of forbidding it. What survives is the much smaller question the form still asks —
   * WHEN did this post — which drives the sentence warning that an edit will move the books.
   */
  test('nothing has posted before anything is paid', () => {
    assert.equal(paidOnDate(expense()), null);
  });

  test('a paid expense reports its stamp', () => {
    assert.equal(paidOnDate(expense({ expensePaidAt: '2026-08-05T16:00:00Z' })), '2026-08-05T16:00:00Z');
  });

  test('it prefers the most decisive stamp a payable carries', () => {
    const p = payable({ depositPaidAt: '2026-05-07T16:00:00Z', balancePaidAt: '2026-07-01T16:00:00Z' });
    assert.equal(paidOnDate(p), '2026-07-01T16:00:00Z', 'the later half is the one that finished it');
  });

  test('a part-paid payable still reports the half that did post', () => {
    assert.equal(paidOnDate(payable({ depositPaidAt: '2026-05-07T16:00:00Z' })), '2026-05-07T16:00:00Z');
  });

  test('no record, no stamp — the add form has nothing to warn about', () => {
    assert.equal(paidOnDate(null), null);
  });
});;

/**
 * WHEN THE MONEY MOVED (2026-08-16) — the guard behind the date defect.
 *
 * Until this shipped, nothing on the money form ever asked. A cost recorded as "already paid"
 * arrived with no paid stamp at all, which meant $0 on Budget vs. Actual, no row in any month, and
 * no cash movement — and the only remedy stamped `now()`, so a bill settled last month landed in
 * this month's column permanently. Every door that records a payment now runs these two rules.
 */
describe('whyPaidDateIsRefused', () => {
  const TODAY = '2026-08-16';

  test('a past date is what this exists to allow — the whole point is back-dating', () => {
    assert.equal(whyPaidDateIsRefused('2026-07-04', TODAY), null);
  });

  test("the org's own today is allowed, and it is the default every caller sends", () => {
    assert.equal(whyPaidDateIsRefused(TODAY, TODAY), null);
  });

  test('tomorrow is refused, and the sentence names the right instrument', () => {
    const refusal = whyPaidDateIsRefused('2026-08-17', TODAY);
    assert.ok(refusal, 'a payment that has not happened must not be recordable as one');
    assert.match(refusal!, /payable/i, 'it has to point at the thing that DOES model a future payment');
  });

  test('⚠ the boundary is the ORG day, not a UTC instant', () => {
    // A Toronto club marking a bill paid at 8pm is still on today's date while UTC has rolled over.
    // Callers pass `tournamentToday()`; this asserts the comparison respects whatever they pass
    // rather than reaching for a clock of its own.
    assert.equal(whyPaidDateIsRefused('2026-08-16', '2026-08-16'), null);
    assert.ok(whyPaidDateIsRefused('2026-08-16', '2026-08-15'), 'ahead of the caller’s today is still ahead');
  });

  test('a year boundary compares as a date, not as text that happens to sort', () => {
    assert.equal(whyPaidDateIsRefused('2025-12-31', '2026-01-01'), null);
    assert.ok(whyPaidDateIsRefused('2026-01-02', '2026-01-01'));
  });

  test('anything that is not a plain calendar date is refused before it reaches the books', () => {
    for (const bad of [null, undefined, '', 'yesterday', '2026-8-16', '16/08/2026', 20260816,
                       '2026-08-16T12:00:00Z']) {
      assert.ok(whyPaidDateIsRefused(bad, TODAY), `${String(bad)} must not pass`);
    }
  });
});

/**
 * ⚠⚠ A CHOSEN DAY, STORED AS AN INSTANT — the off-by-one that back-dating opened up.
 *
 * `expense_paid_at` is a timestamptz, and every screen turns it back into a day through the ORG's
 * clock. Write the bare `2026-07-04` and Postgres reads UTC midnight, which is still July 3rd in
 * Toronto: the coach picks the 4th and the row reports the 3rd. Nothing throws, the month is
 * usually still right, and it would have survived review — so it is pinned here instead.
 */
describe('orgDayAsStoredInstant', () => {
  test('the stored instant reads back as the SAME day the coach picked', () => {
    for (const day of ['2026-07-04', '2026-01-01', '2026-12-31', '2026-03-08', '2026-11-01']) {
      const stamp = orgDayAsStoredInstant(day);
      assert.ok(stamp, `${day} must convert`);
      assert.equal(orgDayKey(stamp!), day, `${day} came back as ${orgDayKey(stamp!)}`);
    }
  });

  test('the bare date this replaces would have read back a day EARLY', () => {
    // The bug, asserted so nobody "simplifies" the helper away again.
    assert.equal(orgDayKey('2026-07-04T00:00:00.000Z'), '2026-07-03');
  });

  test('it survives both DST switchovers, where a naive hour offset would not', () => {
    for (const day of ['2026-03-08', '2026-11-01']) {
      assert.equal(orgDayKey(orgDayAsStoredInstant(day)!), day);
    }
  });
});

/**
 * ⚠⚠ MONEY IS DOLLARS-AND-CENTS, and "positive" was not the same thing (/review, 2026-08-16).
 *
 * Both money doors accepted any number above zero, so `0.004` was a valid cost. The reimbursement
 * credit an out-of-pocket cost creates is skipped below half a cent — so a coach typing `.04` for
 * `$4.00` produced a record saying a family had paid it with no debt to that family written
 * anywhere, silently. That record then satisfied the precondition for the worst failure in this
 * area: a later amount correction updating nothing and reporting success.
 */
describe('asMoneyAmount', () => {
  test('ordinary money passes through, rounded to the cent', () => {
    assert.equal(asMoneyAmount(325), 325);
    assert.equal(asMoneyAmount('1234.56'), 1234.56);
    assert.equal(asMoneyAmount(0.01), 0.01);
  });

  test('⚠ a figure that rounds below a cent is NOT money', () => {
    for (const sub of [0.004, 0.0049, 0.001, 0]) {
      assert.equal(asMoneyAmount(sub), null, `${sub} must be refused`);
    }
  });

  test('a half-cent rounds up rather than vanishing', () => {
    assert.equal(asMoneyAmount(0.005), 0.01);
    assert.equal(asMoneyAmount(10.005), 10.01);
  });

  test('float tails are rounded away, so the row and the credit hold ONE number', () => {
    // 0.1 + 0.2 is the classic; a cost, its ledger entry and a family's credit must not disagree
    // in the fourteenth decimal place and then round differently on three screens.
    assert.equal(asMoneyAmount(0.1 + 0.2), 0.3);
  });

  test('negatives and nonsense are refused', () => {
    for (const bad of [-5, 'abc', null, undefined, NaN, Infinity, {}]) {
      assert.equal(asMoneyAmount(bad), null, `${String(bad)} must be refused`);
    }
  });
});
