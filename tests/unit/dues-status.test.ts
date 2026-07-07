import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isNeverPaidPlayer } from '../../lib/dues-status.ts';

describe('isNeverPaidPlayer', () => {
  it('is true when a player owes installments and none are paid', () => {
    assert.equal(
      isNeverPaidPlayer({ outstanding: 1200, installments: [{ paidAt: null }, { paidAt: null }] }),
      true,
    );
  });

  it('is false once any installment is paid (partial payers are not "never paid")', () => {
    assert.equal(
      isNeverPaidPlayer({ outstanding: 600, installments: [{ paidAt: '2026-07-01' }, { paidAt: null }] }),
      false,
    );
  });

  it('is false when every installment is paid', () => {
    assert.equal(
      isNeverPaidPlayer({ outstanding: 0, installments: [{ paidAt: '2026-07-01' }] }),
      false,
    );
  });

  it('is false when the player has no dues at all (no schedule, nothing owed)', () => {
    assert.equal(isNeverPaidPlayer({ outstanding: 0, installments: [] }), false);
    assert.equal(isNeverPaidPlayer({}), false);
  });

  it('treats a positive outstanding balance with no installments as owing (never paid)', () => {
    assert.equal(isNeverPaidPlayer({ outstanding: 300, installments: [] }), true);
  });

  it('tolerates a null installments field', () => {
    assert.equal(isNeverPaidPlayer({ outstanding: 300, installments: null }), true);
    assert.equal(isNeverPaidPlayer({ outstanding: 0, installments: null }), false);
  });
});
