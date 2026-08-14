import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isNeverPaidPlayer, duesStatusLabel } from '../../lib/dues-status.ts';

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

describe('duesStatusLabel — Settled vs Fully paid (Paid stays cash)', () => {
  it('a balance cleared with credits doing part of the work reads Settled, never Fully paid', () => {
    // The pre-model embarrassment: export row "Paid $0.00 · Status Fully paid".
    assert.equal(
      duesStatusLabel({ schedule: {}, rollingBalance: 0, paidAmount: 0, totalCredits: 600 }),
      'Settled',
    );
  });
  it('cash covering everything stays Fully paid', () => {
    assert.equal(
      duesStatusLabel({ schedule: {}, rollingBalance: 0, paidAmount: 600, totalCredits: 0 }),
      'Fully paid',
    );
  });
  it('cash + credits overshooting reads In credit, as before', () => {
    assert.equal(
      duesStatusLabel({ schedule: {}, rollingBalance: -50, paidAmount: 600, totalCredits: 50 }),
      'In credit',
    );
  });
});

describe('duesStatusLabel — mode-aware path (the /review Critical)', () => {
  // keep_separate: an $800 credit sits OFF the bills. rollingBalance is 0, but the family
  // still owes every cash dollar — the mode-blind branch called this "Settled".
  it('keep_separate: unapplied credit does NOT read Settled while cash is still owed', () => {
    assert.equal(
      duesStatusLabel({
        schedule: {}, rollingBalance: 0, paidAmount: 0, totalCredits: 800,
        leftToSend: 800, owedBack: 800, outstanding: 800,
      }),
      'Unpaid',
    );
  });
  it('credits genuinely applied and nothing left to send reads Settled', () => {
    assert.equal(
      duesStatusLabel({
        schedule: {}, rollingBalance: 0, paidAmount: 0, totalCredits: 800,
        leftToSend: 0, owedBack: 0, outstanding: 800,
      }),
      'Settled',
    );
  });
  it('cash covered everything and the team holds their rebate: In credit', () => {
    assert.equal(
      duesStatusLabel({
        schedule: {}, rollingBalance: -125, paidAmount: 600, totalCredits: 125,
        leftToSend: 0, owedBack: 125, outstanding: 0,
      }),
      'In credit',
    );
  });
  it('cash covered everything, no credits: Fully paid', () => {
    assert.equal(
      duesStatusLabel({
        schedule: {}, rollingBalance: 0, paidAmount: 600, totalCredits: 0,
        leftToSend: 0, owedBack: 0, outstanding: 0,
      }),
      'Fully paid',
    );
  });
  it('partly applied credits with a remainder to send reads Partial', () => {
    assert.equal(
      duesStatusLabel({
        schedule: {}, rollingBalance: 300, paidAmount: 0, totalCredits: 500,
        leftToSend: 300, owedBack: 0, outstanding: 800,
      }),
      'Partial',
    );
  });
  it('a forgiveness larger than the debt evaporates — never In credit', () => {
    // forgiven $800 against $600 owing: leftToSend 0, owedBack 0 (forgiveness is never the
    // family's money), outstanding still 600 (credit-blind) → Settled, not In credit.
    assert.equal(
      duesStatusLabel({
        schedule: {}, rollingBalance: -200, paidAmount: 0, totalCredits: 800,
        leftToSend: 0, owedBack: 0, outstanding: 600,
      }),
      'Settled',
    );
  });
});
