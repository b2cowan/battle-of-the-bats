import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { pinLeagueRefund, pinTeamRefund } from '../../lib/online-refund-pinning.ts';

/**
 * Club Tier Stage 12c Part 3 — a refund made in Stripe records itself whenever it can be pinned (plan §0g ruling 5, §0j
 * ask 4). Stripe's amount is a fact; this decides whose it was and what part is the processing fee given back.
 */
describe('a house-league refund made in Stripe', () => {
  const one = [{ itemId: 'a', leftCents: 15000, feeCents: 675 }];
  const two = [{ itemId: 'a', leftCents: 15000, feeCents: 600 }, { itemId: 'b', leftCents: 15000, feeCents: 600 }];
  it('on a one-child payment, any amount: against the fee first, the rest is the processing fee given back', () => {
    assert.deepEqual(pinLeagueRefund(one, 5000), { kind: 'record', plan: [{ itemId: 'a', base: 5000, fee: 0 }] });
    assert.deepEqual(pinLeagueRefund(one, 15000), { kind: 'record', plan: [{ itemId: 'a', base: 15000, fee: 0 }] });
    assert.deepEqual(pinLeagueRefund(one, 15675), { kind: 'record', plan: [{ itemId: 'a', base: 15000, fee: 675 }] });
    assert.deepEqual(pinLeagueRefund(one, 15200), { kind: 'record', plan: [{ itemId: 'a', base: 15000, fee: 200 }] }, 'above the fee');
  });
  it('more than is left matches nothing we recorded', () => {
    assert.deepEqual(pinLeagueRefund(one, 15676), { kind: 'unmatched' });
    assert.deepEqual(pinLeagueRefund([{ itemId: 'a', leftCents: 0, feeCents: 0 }], 100), { kind: 'unmatched' });
  });
  it('on a payment for two children: the whole of what is left records itself, with or without the fee', () => {
    assert.deepEqual(pinLeagueRefund(two, 31200), { kind: 'record', plan: [{ itemId: 'a', base: 15000, fee: 600 }, { itemId: 'b', base: 15000, fee: 600 }] });
    assert.deepEqual(pinLeagueRefund(two, 30000), { kind: 'record', plan: [{ itemId: 'a', base: 15000, fee: 0 }, { itemId: 'b', base: 15000, fee: 0 }] });
  });
  it('a part refund on two children asks "whose was it?"; above everything matches nothing', () => {
    assert.deepEqual(pinLeagueRefund(two, 5000), { kind: 'whose' });
    assert.deepEqual(pinLeagueRefund(two, 31201), { kind: 'unmatched' });
  });
  it('a child already refunded in full is no longer on the payment for this question', () => {
    const oneLeft = [{ itemId: 'a', leftCents: 0, feeCents: 0 }, { itemId: 'b', leftCents: 15000, feeCents: 0 }];
    assert.deepEqual(pinLeagueRefund(oneLeft, 4000), { kind: 'record', plan: [{ itemId: 'b', base: 4000, fee: 0 }] });
  });
});

describe('a team refund made in Stripe', () => {
  const pay = { baseCents: 10000, wholeCents: 10500, usedCents: 0, landed: true };
  it('the whole untouched payment is the full refund (fee included)', () => {
    assert.deepEqual(pinTeamRefund(pay, 10500), { kind: 'whole' });
  });
  it('up to what is left of the base is a part refund, never the fee', () => {
    assert.deepEqual(pinTeamRefund(pay, 4000), { kind: 'part', base: 4000 });
    assert.deepEqual(pinTeamRefund({ ...pay, usedCents: 4000 }, 6000), { kind: 'part', base: 6000 });
    assert.deepEqual(pinTeamRefund({ ...pay, usedCents: 4000 }, 6500), { kind: 'unmatched' });
  });
  it('a payment not in the team’s record yet matches nothing (it is recorded when it lands)', () => {
    assert.deepEqual(pinTeamRefund({ ...pay, landed: false }, 4000), { kind: 'unmatched' });
  });
});

describe('the wiring', () => {
  const src = readCode('lib/online-payment-landing.ts');
  it('every row of one Stripe refund is settled (a split refund is a row per child), not just the first', () => {
    const fn = /export async function applyRefundEvent[\s\S]*?\n}\n/.exec(src)?.[0] ?? '';
    assert.ok(fn.includes('for (const row of rows)'), 'loops every row of the refund');
    assert.ok(!/\.limit\(1\)\.maybeSingle\(\)/.test(fn), 'no single-row read of a Stripe refund');
  });
  it('a payment that lands records the refunds made in Stripe before it (events out of order)', () => {
    assert.equal(src.match(/reconcileDashboardRefunds\(/g)?.length, 3, 'defined once, called from both landings');
  });
  it('a team part refund never lands through the full-refund function', () => {
    assert.ok(/if \(rRow\?\.part_refund\)[\s\S]*?bookTeamRefund/.test(src));
  });
});
