import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ledgerReversalPreview, whyPaidDateIsRefused, asMoneyAmount, isRealCalendarDate, parseInstallmentPlan, tooManyInstallments } from '../../lib/expense-ledger.ts';
import { commitmentStanding, type PayableInstallment, type PayablePayment } from '../../lib/payable-standing.ts';
import { orgDayAsStoredInstant, orgDayKey } from '../../lib/timezone.ts';

/**
 * What a coach is TOLD before deleting something has to agree with what the server then gives
 * back — the confirmation and the reversal read the same payments, so the cases that matter are
 * the disagreements that would be invisible.
 *
 * ⚖ The `paidLedgerLegs` / `paidOnDate` suites died with the legacy paid stamps (Payables Rebuild
 * P2): what posted to the books is the commitment's own payments now, and the preview reads the
 * standing every screen already holds.
 */

const inst = (over: Partial<PayableInstallment> = {}): PayableInstallment => ({
  id: 'i1', expenseId: 'e1', installmentNumber: 1, amount: 120, dueDate: '2026-05-01', ...over,
});
const pay = (over: Partial<PayablePayment> = {}): PayablePayment => ({
  id: 'p1', expenseId: 'e1', installmentId: null, amount: 120, paidDate: '2026-05-14',
  method: null, note: null, accountingEntryId: 'entry-1', ...over,
});

describe('ledgerReversalPreview — what deleting would put back on the books', () => {
  test('an unpaid commitment has posted nothing', () => {
    const standing = commitmentStanding([inst()], []);
    assert.deepEqual(ledgerReversalPreview(standing, null), { amount: 0, legs: 0, owesFamily: false, owedByFamily: [] });
  });

  test('a paid record quotes exactly its payments, however many', () => {
    const standing = commitmentStanding(
      [inst({ amount: 900 })],
      [pay({ amount: 300 }), pay({ id: 'p2', amount: 600, paidDate: '2026-07-09' })]);
    const preview = ledgerReversalPreview(standing, null);
    assert.equal(preview.amount, 900);
    assert.equal(preview.legs, 2);
  });

  test('⚠ a PART-PAID commitment quotes what was ACTUALLY paid, never the total (§27 Part D)', () => {
    const standing = commitmentStanding([inst({ amount: 600 })], [pay({ amount: 200 })]);
    assert.equal(ledgerReversalPreview(standing, null).amount, 200);
  });

  test('⚠ AN OUT-OF-POCKET EXPENSE COMES BACK AS ZERO CASH, and the family debt is said apart', () => {
    // A family's money moved, not the team's — no cash entry was ever written. Reversing one would
    // credit the team for spending it never did; the credit disappearing must be sayable on its own.
    const standing = commitmentStanding([inst()], [pay({ accountingEntryId: null })]);
    const preview = ledgerReversalPreview(standing, 'player-1');
    assert.equal(preview.amount, 0, 'must never be folded into a dollar figure coming back');
    assert.equal(preview.legs, 0);
    assert.equal(preview.owesFamily, true);
  });

  test('no standing yet (a row still loading) previews as nothing rather than throwing', () => {
    assert.deepEqual(ledgerReversalPreview(undefined, null), { amount: 0, legs: 0, owesFamily: false, owedByFamily: [] });
  });

  test('sums stay exact to the cent', () => {
    const standing = commitmentStanding(
      [inst({ amount: 0.3 })],
      [pay({ amount: 0.1 }), pay({ id: 'p2', amount: 0.2 })]);
    assert.equal(ledgerReversalPreview(standing, null).amount, 0.3);
  });

  /* ── P4 (mig 267): one bill, two kinds of payment ───────────────────────────────────────────
     The whole reason this preview stopped asking the COST who paid. The cases below are the ones
     the old cost-level answer got wrong by real money in a confirmation a coach acts on. */

  test('⚠⚠ a PARTLY FRONTED bill gives back only the TEAM’s payments', () => {
    // The owner's case: $600 entry, a parent pays the $200 deposit direct, the team pays $400.
    const standing = commitmentStanding(
      [inst({ amount: 200 }), inst({ id: 'i2', installmentNumber: 2, amount: 400, dueDate: '2026-06-01' })],
      [
        pay({ id: 'p1', amount: 200, accountingEntryId: null, paidByPlayerId: 'avery' }),
        pay({ id: 'p2', amount: 400, paidDate: '2026-06-10' }),
      ]);
    const preview = ledgerReversalPreview(standing, null);
    assert.equal(preview.amount, 400, 'the fronted $200 never left the team’s account');
    assert.equal(preview.legs, 1);
    assert.equal(preview.owesFamily, true, 'a household IS owed here even though the cost names nobody');
  });

  test('⚠ the cost-level answer still claims every payment on it', () => {
    // mig 234's whole-cost mechanism is the ONE-household case of the same rule, unchanged.
    const standing = commitmentStanding(
      [inst({ amount: 300 })],
      [pay({ amount: 180, accountingEntryId: null }), pay({ id: 'p2', amount: 120, accountingEntryId: null })]);
    const preview = ledgerReversalPreview(standing, 'avery');
    assert.equal(preview.amount, 0);
    assert.equal(preview.legs, 0);
    assert.equal(preview.owesFamily, true);
  });

  test('two households fronting one cost are both counted out of the cash figure', () => {
    const standing = commitmentStanding(
      [inst({ amount: 500 })],
      [
        pay({ id: 'p1', amount: 200, accountingEntryId: null, paidByPlayerId: 'avery' }),
        pay({ id: 'p2', amount: 150, accountingEntryId: null, paidByPlayerId: 'blake', paidDate: '2026-05-20' }),
        pay({ id: 'p3', amount: 150, paidDate: '2026-05-28' }),
      ]);
    assert.equal(ledgerReversalPreview(standing, null).amount, 150);
  });

  /* ── WHOSE CREDIT GOES — owner ruling 2026-08-27 ────────────────────────────────────────────
     The delete still goes through; it stops being silent. "A family paid this out of pocket" was
     true and unactionable — a coach could not tell WHO was about to lose WHAT. */

  test('⚠⚠ it names each household and what they lose, summed per family', () => {
    const standing = commitmentStanding(
      [inst({ amount: 500 })],
      [
        pay({ id: 'p1', amount: 200, accountingEntryId: null, paidByPlayerId: 'avery' }),
        // A SECOND payment from the SAME family is ONE debt, not two lines.
        pay({ id: 'p2', amount: 50, accountingEntryId: null, paidByPlayerId: 'avery', paidDate: '2026-05-18' }),
        pay({ id: 'p3', amount: 150, accountingEntryId: null, paidByPlayerId: 'blake', paidDate: '2026-05-20' }),
        pay({ id: 'p4', amount: 100, paidDate: '2026-05-28' }),
      ]);
    const preview = ledgerReversalPreview(standing, null);
    assert.deepEqual(preview.owedByFamily, [
      { playerId: 'avery', amount: 250 },
      { playerId: 'blake', amount: 150 },
    ]);
    assert.equal(preview.amount, 100, 'and only the team’s own payment comes back as cash');
  });

  test('a whole cost fronted at COST level names that household too', () => {
    const standing = commitmentStanding([inst({ amount: 180 })], [pay({ amount: 180, accountingEntryId: null })]);
    assert.deepEqual(ledgerReversalPreview(standing, 'avery').owedByFamily, [{ playerId: 'avery', amount: 180 }]);
  });

  test('a cost the team paid for entirely names nobody', () => {
    const standing = commitmentStanding([inst({ amount: 180 })], [pay({ amount: 180 })]);
    const preview = ledgerReversalPreview(standing, null);
    assert.deepEqual(preview.owedByFamily, []);
    assert.equal(preview.owesFamily, false, 'so the confirmation says nothing about a family at all');
  });
});

describe('parseInstallmentPlan — the one validator behind every door that stores a plan', () => {
  test('a valid plan passes with rounded amounts', () => {
    assert.deepEqual(parseInstallmentPlan([{ amount: 200, dueDate: '2026-09-01' }, { amount: 400.005, dueDate: '2026-10-01' }]),
      { plan: [{ amount: 200, dueDate: '2026-09-01' }, { amount: 400.01, dueDate: '2026-10-01' }] });
  });

  test('an empty, sub-cent, or dateless plan is refused with a coach sentence', () => {
    for (const bad of [[], [{ amount: 0, dueDate: '2026-09-01' }], [{ amount: 100 }], [{ amount: 100, dueDate: '2026-02-30' }], 'nope']) {
      const out = parseInstallmentPlan(bad as unknown);
      assert.ok('error' in out, `${JSON.stringify(bad)} must be refused`);
    }
  });

  test('⚖ A LONGER PLAN IS ACCEPTED — the two-piece cap lifted with the editor (P4)', () => {
    // The cap existed only because the edit form was a deposit/balance two-field editor: a longer
    // plan created through the API would be silently truncated the first time a coach saved an
    // unrelated rename. That form is a 1..n list now, so the reason has gone.
    const out = parseInstallmentPlan(
      Array.from({ length: 6 }, (_, at) => ({ amount: 450, dueDate: `2026-0${at + 1}-01` })));
    assert.ok('plan' in out);
    assert.equal((out as { plan: unknown[] }).plan.length, 6);
  });

  test('⚠ THE SERIES CEILING REPLACES IT, and refuses in the generator\'s own sentence', () => {
    const out = parseInstallmentPlan(
      Array.from({ length: 25 }, () => ({ amount: 10, dueDate: '2026-09-01' })));
    assert.ok('error' in out);
    // The same sentence the schedule builder shows before the coach ever commits — one wording,
    // whichever door the over-long run came through.
    assert.equal((out as { error: string }).error, tooManyInstallments(25));
    assert.match((out as { error: string }).error, /two full seasons/);
  });

  test('⚠ a MULTI-row plan names the row at fault — "check all twelve" is not an answer', () => {
    const dated = (n: number) => Array.from({ length: n }, (_, at) => ({ amount: 450, dueDate: `2026-0${at + 1}-01` }));
    const noDate = dated(3); (noDate[2] as { dueDate?: unknown }).dueDate = '';
    assert.match((parseInstallmentPlan(noDate) as { error: string }).error, /Payment 3 has no due date/);
    const noAmount = dated(3); noAmount[1].amount = 0;
    assert.match((parseInstallmentPlan(noAmount) as { error: string }).error, /Payment 2 needs an amount/);
  });

  test('⚠ a ONE-row plan keeps the plain sentence — "payment 1" would be noise', () => {
    // ⚠ These two sentences are what the SCHEDULE EDITOR shows as well: it calls this validator
    // rather than re-deriving the rules, after the two hand-written copies drifted apart in wording
    // (`/simplify`, 2026-08-20). A stale tab reaching the route must be told what the form says.
    assert.match((parseInstallmentPlan([{ amount: 450 }]) as { error: string }).error,
      /never reaches your payment schedule/);
    assert.match((parseInstallmentPlan([{ amount: 0, dueDate: '2026-09-01' }]) as { error: string }).error,
      /at least \$0\.01/);
  });

  test('exactly the ceiling is fine — it is a limit, not a warning', () => {
    const out = parseInstallmentPlan(
      Array.from({ length: 24 }, () => ({ amount: 10, dueDate: '2026-09-01' })));
    assert.ok('plan' in out);
  });
});

describe('isRealCalendarDate — the shape is not the date', () => {
  test('real days pass', () => {
    for (const day of ['2026-07-04', '2026-01-01', '2026-12-31', '2028-02-29']) {
      assert.ok(isRealCalendarDate(day), `${day} is a real day`);
    }
  });

  test('⚠ days the calendar does not have are refused, not rolled into the next month', () => {
    for (const bad of ['2026-02-30', '2026-00-15', '2026-13-01', '2026-04-31', '2027-02-29']) {
      assert.ok(!isRealCalendarDate(bad), `${bad} must be refused`);
    }
  });

  test('anything that is not a bare YYYY-MM-DD is refused', () => {
    for (const bad of [null, undefined, '', '2026-8-16', '16/08/2026', '2026-08-16T12:00:00Z', 20260816]) {
      assert.ok(!isRealCalendarDate(bad), `${String(bad)} must be refused`);
    }
  });
});

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
