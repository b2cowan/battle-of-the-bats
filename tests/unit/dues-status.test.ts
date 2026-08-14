import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isNeverPaidPlayer } from '../../lib/dues-status.ts';

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
});
