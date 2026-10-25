import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { leaguePrice, registrationOwes, seasonCharges, seasonPriceRange } from '../../lib/league-price.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 9b-1, PART 1: THE ONE PRICE RULE (owner Q2 · 9b·2, 2026-10-24; "record the price at sign-up",
 * 2026-10-25). The division's own price, else the season's; the early amount on or before the season's early-bird day,
 * read as the club's day; a registration owes what it recorded, else the season's price.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const season = { registrationFee: 165, earlyBirdUntil: '2026-06-30' };

describe('leaguePrice', () => {
  it('a division with its own price charges it; without one, the season’s', () => {
    assert.equal(leaguePrice({ price: 175, earlyPrice: null }, season, '2026-07-01')!.amount, 175);
    assert.equal(leaguePrice({ price: null, earlyPrice: null }, season, '2026-07-01')!.amount, 165);
  });

  it('the early amount applies on the early-bird day itself, not the day after', () => {
    const div = { price: 165, earlyPrice: 145 };
    assert.deepEqual(leaguePrice(div, season, '2026-06-30'), { amount: 145, early: true, regular: 165, earlyEnded: false });
    assert.deepEqual(leaguePrice(div, season, '2026-07-01'), { amount: 165, early: false, regular: 165, earlyEnded: true });
    assert.equal(leaguePrice(div, season, '2026-05-01')!.amount, 145);
  });

  it('the club’s day is compared as written: a stored "…T23:30:00Z" early-bird value still means Jun 30', () => {
    const div = { price: 165, earlyPrice: 145 };
    assert.equal(leaguePrice(div, { ...season, earlyBirdUntil: '2026-06-30T23:30:00Z' }, '2026-06-30')!.early, true);
    assert.equal(leaguePrice(div, season, '2026-06-30T23:59:00Z')!.early, true);
  });

  it('no early-bird date, or no early amount on the division, means no early bird and nothing "ended"', () => {
    assert.deepEqual(leaguePrice({ price: 165, earlyPrice: 145 }, { ...season, earlyBirdUntil: null }, '2026-05-01'),
      { amount: 165, early: false, regular: 165, earlyEnded: false });
    assert.deepEqual(leaguePrice({ price: 165, earlyPrice: null }, season, '2026-05-01'),
      { amount: 165, early: false, regular: 165, earlyEnded: false });
  });

  it('a free season is a price of $0, not a missing one', () => {
    assert.equal(leaguePrice({ price: null, earlyPrice: null }, { registrationFee: 0, earlyBirdUntil: null }, '2026-05-01')!.amount, 0);
  });

  it('no price anywhere is null (the checklist’s "Prices" is not done)', () => {
    assert.equal(leaguePrice({ price: null, earlyPrice: null }, { registrationFee: null, earlyBirdUntil: null }, '2026-05-01'), null);
  });
});

describe('registrationOwes', () => {
  it('a recorded amount wins, even when the season price changed since', () => {
    assert.equal(registrationOwes({ feeAmount: 145 }, { registrationFee: 175 }), 145);
    assert.equal(registrationOwes({ feeAmount: 0 }, { registrationFee: 175 }), 0);
  });
  it('a registration from before mig 361 owes the season’s price', () => {
    assert.equal(registrationOwes({ feeAmount: null }, { registrationFee: 165 }), 165);
    assert.equal(registrationOwes({ feeAmount: null }, { registrationFee: null }), null);
  });
});

describe('season price facts', () => {
  it('the range reads every division’s own price or the season’s', () => {
    assert.deepEqual(seasonPriceRange([{ price: 175, earlyPrice: null }, { price: null, earlyPrice: null }], season), { low: 165, high: 175 });
    assert.equal(seasonPriceRange([{ price: null, earlyPrice: null }], { registrationFee: null }), null);
    assert.equal(seasonPriceRange([], season), null);
  });
  it('a season charges when any price is above $0', () => {
    assert.equal(seasonCharges([{ price: 0, earlyPrice: null }], { registrationFee: 0 }), false);
    assert.equal(seasonCharges([{ price: 0, earlyPrice: null }, { price: null, earlyPrice: null }], { registrationFee: 50 }), true);
    assert.equal(seasonCharges([], { registrationFee: null }), false);
  });
});
