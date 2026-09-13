/**
 * The write-off invariant (lib/dues-credit-guards.ts) — write-offs never exceed the bill, from
 * either door. Pinned behaviours:
 *
 *  THE ADJUSTMENT CEILING (owner ruling 2026-09-11, corrected 2026-09-12 — "the adjustment is to
 *  the total dues … regardless of how much they have paid"):
 *  - a new Adjustment may not exceed what is LEFT OF THE BILL: Σ installments − write-offs already
 *    standing against it (`other` + `forgiven`);
 *  - payments do NOT shrink it — a family who paid all $600 can still have $600 written off (the
 *    excess becomes a credit owed back, ≤ what they sent because the bill cannot go below zero);
 *  - money-backed credits (fundraiser, sponsor, reimbursement, overpayment) do NOT shrink it — they
 *    are not write-offs;
 *  - the team's credit mode plays no part — `keep_separate` is no longer a hard $0;
 *  - editing an existing Adjustment is judged against the room it would have if it did not exist
 *    (its own amount is excluded, never double-counted against itself);
 *  - a player with no installments at all has nothing to adjust — ceiling $0.
 *
 *  THE MIRROR (F04, 2026-09-12): a schedule may not be LOWERED beneath the write-offs already
 *  standing against it; a raise can never trip it.
 *
 * The payout floor (`payoutFloorViolation`) already has coverage through its callers
 * (dues-overpayment-reconcile.test.ts, sponsor-credit-floor.test.ts).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  adjustmentCeiling, adjustmentCeilingViolation, adjustmentCeilingMessage,
  writeOffCeilingViolation, writeOffCeilingMessage, standingWriteOffs,
} from '../../lib/dues-credit-guards';

let seq = 0;
function inst(amount: number) {
  return { id: `i${++seq}`, amount };
}
function credit(amount: number, creditType = 'other') {
  return { id: `c${++seq}`, amount, creditType };
}

describe('adjustmentCeiling — the bill, not the balance', () => {
  it('is the whole bill when nothing has been written off', () => {
    assert.equal(adjustmentCeiling({ installments: [inst(300), inst(300)], credits: [] }), 600);
  });

  it('ignores payments entirely — a fully paid bill can still be written off in full', () => {
    // No payments in the signature at all: a route cannot accidentally feed them in.
    assert.equal(adjustmentCeiling({ installments: [inst(300), inst(300)], credits: [] }), 600);
  });

  it('is NOT shrunk by a money-backed credit — a fundraiser share is not a write-off', () => {
    const ceiling = adjustmentCeiling({
      installments: [inst(300), inst(300)],
      credits: [credit(200, 'fundraiser'), credit(50, 'overpayment'), credit(25, 'reimbursement')],
    });
    assert.equal(ceiling, 600);
  });

  it('is shrunk by every write-off already standing — Adjustments AND forgiveness', () => {
    const ceiling = adjustmentCeiling({
      installments: [inst(300), inst(300)],
      credits: [credit(150, 'other'), credit(100, 'forgiven')],
    });
    assert.equal(ceiling, 350);
  });

  it('has no mode: there is no keep_separate branch left to return $0', () => {
    // The signature carries no `mode` — the compiler is the test. This pins the arithmetic side.
    assert.equal(adjustmentCeiling({ installments: [inst(300)], credits: [] }), 300);
  });

  it('is $0 with no installments at all — nothing to adjust', () => {
    assert.equal(adjustmentCeiling({ installments: [], credits: [] }), 0);
  });

  it('never goes negative when the bill is already written off past itself (pre-guard data)', () => {
    assert.equal(adjustmentCeiling({ installments: [inst(300)], credits: [credit(600)] }), 0);
  });

  it('editing must exclude the credit being edited, or it is wrongly counted against itself', () => {
    const installments = [inst(300), inst(300)];
    const existing = credit(150);
    const correctCeiling = adjustmentCeiling({
      installments, credits: [existing].filter(c => c.id !== existing.id),
    });
    assert.equal(correctCeiling, 600);
    const forgotToExclude = adjustmentCeiling({ installments, credits: [existing] });
    assert.equal(forgotToExclude, 450);
  });

  it('is cents-exact — three thirds of a dollar do not drift', () => {
    const ceiling = adjustmentCeiling({
      installments: [inst(0.1), inst(0.2)],
      credits: [credit(0.1), credit(0.1)],
    });
    assert.equal(ceiling, 0.1);
  });
});

describe('adjustmentCeilingViolation', () => {
  it('refuses an amount over the ceiling and reports it', () => {
    assert.deepEqual(adjustmentCeilingViolation(500, { installments: [inst(300)], credits: [] }), { ceiling: 300 });
  });

  it('allows an amount at or under the ceiling', () => {
    assert.equal(adjustmentCeilingViolation(300, { installments: [inst(300)], credits: [] }), null);
  });

  it('reports what is LEFT of the bill after earlier write-offs, not the gross bill', () => {
    assert.deepEqual(
      adjustmentCeilingViolation(900, { installments: [inst(900)], credits: [credit(17)] }),
      { ceiling: 883 },
    );
  });
});

describe('adjustmentCeilingMessage', () => {
  it('names what is left of the bill', () => {
    assert.equal(
      adjustmentCeilingMessage(883),
      'An Adjustment can’t lower this bill by more than what’s left of it — $883.00.',
    );
  });
  it('says so when nothing is left', () => {
    assert.match(adjustmentCeilingMessage(0), /already been written off in full/);
  });
});

describe('writeOffCeilingViolation — the mirror, on the schedule doors', () => {
  it('refuses a schedule lowered beneath its standing write-offs', () => {
    assert.deepEqual(writeOffCeilingViolation(300, [credit(600)]), { writtenOff: 600 });
  });

  it('counts forgiveness as a write-off too', () => {
    assert.deepEqual(writeOffCeilingViolation(300, [credit(200, 'other'), credit(200, 'forgiven')]), { writtenOff: 400 });
  });

  it('ignores money-backed credits — only write-offs can pull a bill under', () => {
    assert.equal(writeOffCeilingViolation(300, [credit(900, 'fundraiser'), credit(900, 'overpayment')]), null);
  });

  it('allows a schedule exactly equal to its write-offs', () => {
    assert.equal(writeOffCeilingViolation(600, [credit(600)]), null);
  });

  it('a raise can never trip it', () => {
    assert.equal(writeOffCeilingViolation(1200, [credit(600)]), null);
  });

  it('allows any total when nothing is written off', () => {
    assert.equal(writeOffCeilingViolation(0.01, []), null);
  });

  it('speaks the one sentence, with both figures', () => {
    assert.equal(
      writeOffCeilingMessage(600, 300),
      'This family has $600.00 written off — a $300.00 bill would be less than that. Lower or remove the adjustment first.',
    );
  });
});

describe('standingWriteOffs', () => {
  it('sums other + forgiven and nothing else, in cents', () => {
    assert.equal(standingWriteOffs([credit(0.1), credit(0.2, 'forgiven'), credit(99, 'fundraiser')]), 0.3);
  });
});
