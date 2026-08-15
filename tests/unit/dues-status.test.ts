import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isNeverPaidPlayer, duesStatusLabel, hasPastDueInstallment } from '../../lib/dues-status.ts';

/**
 * Since mig 232 the predicate reads PAYMENT DOLLARS, never installment stamps — a family two
 * part-payments into an installment has every paidAt still null, and counting stamps told them
 * they had "paid nothing" (the project's founding defect). `paidAmount` is REQUIRED on the input
 * type so a caller can't forget it; these tests pin the dollar semantics.
 */
describe('isNeverPaidPlayer', () => {
  it('is true when a player owes installments and no payment dollars are recorded', () => {
    assert.equal(
      isNeverPaidPlayer({ outstanding: 1200, paidAmount: 0, installments: [{ paidAt: null }, { paidAt: null }] }),
      true,
    );
  });

  it('is false the moment ANY payment dollars exist — even a part-payment with every stamp null', () => {
    assert.equal(
      isNeverPaidPlayer({ outstanding: 1100, paidAmount: 100, installments: [{ paidAt: null }, { paidAt: null }] }),
      false,
    );
  });

  it('is false when fully paid', () => {
    assert.equal(
      isNeverPaidPlayer({ outstanding: 0, paidAmount: 1200, installments: [{ paidAt: '2026-07-01' }] }),
      false,
    );
  });

  it('is false when the player has no dues at all (no schedule, nothing owed)', () => {
    assert.equal(isNeverPaidPlayer({ outstanding: 0, paidAmount: 0, installments: [] }), false);
    assert.equal(isNeverPaidPlayer({ paidAmount: 0 }), false);
  });

  it('treats a positive outstanding balance with no installments as owing (never paid)', () => {
    assert.equal(isNeverPaidPlayer({ outstanding: 300, paidAmount: 0, installments: [] }), true);
  });

  it('tolerates a null installments field', () => {
    assert.equal(isNeverPaidPlayer({ outstanding: 300, paidAmount: 0, installments: null }), true);
    assert.equal(isNeverPaidPlayer({ outstanding: 0, paidAmount: 0, installments: null }), false);
  });

  it('ignores sub-cent noise in paidAmount', () => {
    assert.equal(isNeverPaidPlayer({ outstanding: 300, paidAmount: 0.004, installments: [] }), true);
  });

  it('stops chasing a family whose credits settled everything (leftToSend 0)', () => {
    // Owner model 2026-08-14: zero payments but fundraising covered the season — "you haven't
    // paid anything yet" would be both rude and wrong.
    assert.equal(
      isNeverPaidPlayer({ outstanding: 600, paidAmount: 0, leftToSend: 0, installments: [{ paidAt: null }] }),
      false,
    );
    // Credits covering only part of the season keep the family a (lowered) chase target.
    assert.equal(
      isNeverPaidPlayer({ outstanding: 600, paidAmount: 0, leftToSend: 450, installments: [{ paidAt: null }] }),
      true,
    );
  });
});

/* The dates the timing tests reason about. `tournamentToday()` is the org's calendar day, so a
   test that hard-coded "2026-01-01" would flip the day this file is run in a different month. */
const PAST   = '2020-01-01';
const FUTURE = '2099-01-01';

describe('duesStatusLabel — the terminal states (Paid stays cash)', () => {
  it('a balance cleared with credits doing part of the work reads Settled, never Fully paid', () => {
    // The pre-model embarrassment: export row "Paid $0.00 · Status Fully paid".
    assert.equal(
      duesStatusLabel({
        schedule: {}, paidAmount: 0, totalCredits: 600,
        leftToSend: 0, owedBack: 0, outstanding: 600,
      }),
      'Settled',
    );
  });
  it('cash covering everything stays Fully paid', () => {
    assert.equal(
      duesStatusLabel({
        schedule: {}, paidAmount: 600, totalCredits: 0,
        leftToSend: 0, owedBack: 0, outstanding: 0,
      }),
      'Fully paid',
    );
  });
  it('cash covered everything and the team holds their rebate: In credit', () => {
    assert.equal(
      duesStatusLabel({
        schedule: {}, paidAmount: 600, totalCredits: 125,
        leftToSend: 0, owedBack: 125, outstanding: 0,
      }),
      'In credit',
    );
  });
  it('a forgiveness larger than the debt evaporates — never In credit', () => {
    // forgiven $800 against $600 owing: leftToSend 0, owedBack 0 (forgiveness is never the
    // family's money), outstanding still 600 (credit-blind) → Settled, not In credit.
    assert.equal(
      duesStatusLabel({
        schedule: {}, paidAmount: 0, totalCredits: 800,
        leftToSend: 0, owedBack: 0, outstanding: 600,
      }),
      'Settled',
    );
  });
  it('a terminal state is never late, even with a long-past due date on the schedule', () => {
    assert.equal(
      duesStatusLabel({
        schedule: {}, paidAmount: 600, totalCredits: 0,
        leftToSend: 0, owedBack: 0, outstanding: 0,
        installments: [{ dueDate: PAST, paidAt: '2020-02-01T12:00:00Z', remainingAmount: 0 }],
      }),
      'Fully paid',
    );
  });
});

/**
 * ⚠ THE DEFECT THIS SET EXISTS FOR (owner, 2026-08-14): the label graded SEASON COMPLETION, so a
 * family paying every installment on the day it fell due and a family a month late both read
 * "Partial". The status column could not see time at all; the only hint that anyone was behind
 * was a "3 overdue" line under the whole table.
 */
describe('duesStatusLabel — is this family BEHIND? (the question every label now answers)', () => {
  const owing = {
    schedule: {}, paidAmount: 400, totalCredits: 0,
    leftToSend: 400, owedBack: 0, outstanding: 400,
  };

  it('paid everything that has fallen due, more to come: Up to date — NOT Partial', () => {
    assert.equal(
      duesStatusLabel({
        ...owing,
        installments: [
          { dueDate: PAST,   paidAt: '2020-01-02T12:00:00Z', remainingAmount: 0 },
          { dueDate: FUTURE, paidAt: null, remainingAmount: 400 },
        ],
      }),
      'Up to date',
    );
  });

  it('nothing paid but nothing due yet: Up to date — "Unpaid" cried wolf on a family owing nothing today', () => {
    assert.equal(
      duesStatusLabel({
        schedule: {}, paidAmount: 0, totalCredits: 0,
        leftToSend: 800, owedBack: 0, outstanding: 800,
        installments: [{ dueDate: FUTURE, paidAt: null, remainingAmount: 800 }],
      }),
      'Up to date',
    );
  });

  it('a bill past its date with money still asked for: Past due', () => {
    assert.equal(
      duesStatusLabel({
        ...owing,
        installments: [
          { dueDate: PAST,   paidAt: null, remainingAmount: 400 },
          { dueDate: FUTURE, paidAt: null, remainingAmount: 400 },
        ],
      }),
      'Past due',
    );
  });

  it('⚠ a LATE bill that credits settled is not late for anyone', () => {
    // Credits settle bills and paid_at deliberately never stamps a credit-covered row (Paid stays
    // cash) — so lateness must be judged on the REMAINDER, never the stamp.
    assert.equal(
      duesStatusLabel({
        ...owing,
        installments: [
          { dueDate: PAST,   paidAt: null, remainingAmount: 0 },
          { dueDate: FUTURE, paidAt: null, remainingAmount: 400 },
        ],
      }),
      'Up to date',
    );
  });

  it('keep_separate: an unapplied credit still leaves them behind on a late bill', () => {
    // The /review Critical, re-pinned: rollingBalance is 0 but every cash dollar is still owed.
    assert.equal(
      duesStatusLabel({
        schedule: {}, paidAmount: 0, totalCredits: 800,
        leftToSend: 800, owedBack: 800, outstanding: 800,
        installments: [{ dueDate: PAST, paidAt: null, remainingAmount: 800 }],
      }),
      'Past due',
    );
  });

  it('a schedule with no dated bills cannot be late', () => {
    assert.equal(duesStatusLabel({ ...owing, installments: [] }), 'Up to date');
    assert.equal(duesStatusLabel({ ...owing }), 'Up to date');
  });

  it('no schedule at all is Not set, whatever the figures say', () => {
    assert.equal(
      duesStatusLabel({ ...owing, schedule: null, installments: [{ dueDate: PAST, paidAt: null, remainingAmount: 400 }] }),
      'Not set',
    );
  });
});

describe('hasPastDueInstallment — the ONE predicate the status word and the footer count share', () => {
  it('is false for an empty or missing list', () => {
    assert.equal(hasPastDueInstallment([]), false);
    assert.equal(hasPastDueInstallment(null), false);
    assert.equal(hasPastDueInstallment(undefined), false);
  });
  it('ignores a paid bill however old', () => {
    assert.equal(hasPastDueInstallment([{ dueDate: PAST, paidAt: '2020-06-01T12:00:00Z' }]), false);
  });
  it('falls back to the face amount when no remainder is supplied', () => {
    assert.equal(hasPastDueInstallment([{ dueDate: PAST, paidAt: null, amount: 200 }]), true);
    assert.equal(hasPastDueInstallment([{ dueDate: PAST, paidAt: null, amount: 0 }]), false);
  });
  it('a bill with no due date is never late', () => {
    assert.equal(hasPastDueInstallment([{ dueDate: null, paidAt: null, remainingAmount: 200 }]), false);
  });
});
