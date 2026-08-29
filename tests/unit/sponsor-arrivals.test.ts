/**
 * ARRIVALS ACCRUE, AND ROUNDING NEVER STRANDS A CENT — pinned as arithmetic (mig 268, owner
 * rulings Q12 + Q16, sponsorship lifecycle Phase B).
 *
 * Why this is arithmetic and not convention: the same numbers drive the family's real
 * rep_dues_credits rows, the arrival's rebate_amount, the payout-floor projections, and the
 * "still to come" figure the treasurer chases against. Two cheques of $250 against a $500
 * pledge with a $75 share must credit $37.50 + $37.50 — not $37.50 + $37.49, and never $75
 * twice. The true-up rule (the arrival that reaches the pledge takes the remainder) is what
 * makes the last cent land, and it is the first thing a refactor would silently lose.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  accrueArrival,
  deriveAllArrivalCredits,
  creditPlanProblem,
  stillToCome,
  type CreditPlanShare,
} from '../../lib/sponsor-arrivals.ts';

const pct = (playerId: string, value: number): CreditPlanShare => ({ playerId, value, unit: 'percent' });
const dollars = (playerId: string, value: number): CreditPlanShare => ({ playerId, value, unit: 'amount' });

describe('accrueArrival — percent shares', () => {
  it('earns pct × each arrival, arrival by arrival', () => {
    const [a1, a2] = deriveAllArrivalCredits({
      plan: [pct('riley', 15)], pledged: 500, arrivalAmounts: [250, 250],
    });
    assert.deepEqual(a1, [{ playerId: 'riley', credit: 37.5 }]);
    assert.deepEqual(a2, [{ playerId: 'riley', credit: 37.5 }]);
  });

  it('keeps earning past the pledge — 15% of everything that arrives', () => {
    const rounds = deriveAllArrivalCredits({
      plan: [pct('riley', 15)], pledged: 500, arrivalAmounts: [500, 100],
    });
    assert.deepEqual(rounds[1], [{ playerId: 'riley', credit: 15 }]);
  });
});

describe('accrueArrival — dollar shares', () => {
  it('fills proportionally and trues up on the arrival that reaches the pledge', () => {
    const rounds = deriveAllArrivalCredits({
      plan: [dollars('avery', 75)], pledged: 500, arrivalAmounts: [200, 300],
    });
    assert.deepEqual(rounds[0], [{ playerId: 'avery', credit: 30 }]);   // 75 × 200/500
    assert.deepEqual(rounds[1], [{ playerId: 'avery', credit: 45 }]);   // the remainder, exactly
  });

  it('rounding never strands a cent — awkward splits still sum to the share', () => {
    const rounds = deriveAllArrivalCredits({
      plan: [dollars('avery', 75)], pledged: 500, arrivalAmounts: [333.33, 166.67],
    });
    const total = rounds.flat().reduce((s, r) => s + r.credit, 0);
    assert.equal(Math.round(total * 100), 7500);
  });

  it('earns nothing more once trued up', () => {
    const rounds = deriveAllArrivalCredits({
      plan: [dollars('avery', 75)], pledged: 500, arrivalAmounts: [500, 100],
    });
    assert.deepEqual(rounds[0], [{ playerId: 'avery', credit: 75 }]);
    assert.deepEqual(rounds[1], []); // over-pledge arrival: dollar share is done
  });

  it('with no pledge, lands as fast as money arrives, never past the share', () => {
    const rounds = deriveAllArrivalCredits({
      plan: [dollars('avery', 75)], pledged: null, arrivalAmounts: [50, 100],
    });
    assert.deepEqual(rounds[0], [{ playerId: 'avery', credit: 50 }]); // capped at the arrival
    assert.deepEqual(rounds[1], [{ playerId: 'avery', credit: 25 }]); // the rest, not $75 again
  });
});

describe('accrueArrival — mixed multi-family plans (Q16)', () => {
  it('one arrival funds several families at once', () => {
    const shares = accrueArrival({
      plan: [pct('riley', 10), dollars('avery', 25)],
      pledged: 500, arrivalAmount: 500, priorArrivalsTotal: 0, priorAccrued: new Map(),
    });
    assert.deepEqual(shares, [
      { playerId: 'riley', credit: 50 },
      { playerId: 'avery', credit: 25 },
    ]);
  });

  it('replay is deterministic — re-deriving reproduces every credit exactly', () => {
    const plan = [pct('riley', 15), dollars('avery', 60)];
    const once = deriveAllArrivalCredits({ plan, pledged: 400, arrivalAmounts: [150, 150, 100] });
    const twice = deriveAllArrivalCredits({ plan, pledged: 400, arrivalAmounts: [150, 150, 100] });
    assert.deepEqual(once, twice);
    const averyTotal = once.flat().filter(s => s.playerId === 'avery').reduce((s, r) => s + r.credit, 0);
    assert.equal(Math.round(averyTotal * 100), 6000); // the dollar share lands exactly
  });
});

describe('creditPlanProblem — the Q16 cap', () => {
  it('refuses shares that add up past the sponsorship', () => {
    const problem = creditPlanProblem([dollars('riley', 300), pct('avery', 50)], 500);
    assert.equal(problem, 'The family credits add up to $550.00 — more than the $500.00 sponsorship.');
  });

  it('accepts a plan that exactly fits', () => {
    assert.equal(creditPlanProblem([dollars('riley', 250), pct('avery', 50)], 500), null);
  });

  it('refuses a family credited twice', () => {
    assert.match(creditPlanProblem([dollars('riley', 10), pct('riley', 5)], 500) ?? '', /once/);
  });
});

describe('stillToCome', () => {
  it('is pledged minus arrived, floored at zero', () => {
    assert.equal(stillToCome(500, 250), 250);
    assert.equal(stillToCome(500, 600), 0);
    assert.equal(stillToCome(null, 250), 0);
  });
});
