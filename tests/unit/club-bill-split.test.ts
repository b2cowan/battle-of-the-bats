import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { billSplits, followShare, shareCents } from '../../lib/club-bill-split.ts';

/**
 * Club Tier Stage 3c, Ask 6 — New allocation's split and schedule, chosen ONCE per bill (lib/club-bill-split.ts).
 * Every share and installment in cents, and the closing row adds up to the amount exactly.
 */

const team = (id: string, over: Record<string, unknown> = {}) => ({ teamId: id, programYearId: `py-${id}`, ...over });
const ok = <T extends { ok: boolean }>(r: T) => { assert.ok(r.ok, JSON.stringify(r)); return r as Extract<T, { ok: true }>; };
const code = (r: { ok: boolean }) => (r.ok ? null : (r as unknown as { body: { code: string } }).body.code);

describe('shareCents — leftover cents to the largest remainders, ties to the first rows', () => {
  it('$1,850.00 Evenly among 8 teams is $231.25 each (specimen 6)', () => {
    assert.deepEqual(shareCents(185000, Array(8).fill(1)), Array(8).fill(23125));
  });
  it('$100.00 among 3: 33.34, 33.33, 33.33 — the sum is the amount', () => {
    assert.deepEqual(shareCents(10000, [1, 1, 1]), [3334, 3333, 3333]);
  });
  it('by weight (sessions): proportional, adding up exactly', () => {
    const c = shareCents(100000, [3, 2, 2]);
    assert.equal(c.reduce((a, b) => a + b, 0), 100000);
    assert.deepEqual(c, [42857, 28572, 28571], 'the largest remainder takes the cent, a tie to the earlier row');
  });
});

// §283 W8 (owner, 2026-10-08): a team's own payments made at an Evenly share of $225.00 kept $112.50 + $112.50 when
// the split moved to By percentage (40% = $180.00), and the form could neither save nor say how to get out.
describe('followShare — a team’s own payments keep their shape as its share moves', () => {
  it('payments that added up to the old share redivide in the same proportions', () => {
    assert.deepEqual(followShare([11250, 11250], 22500, 18000), [9000, 9000]);
    assert.deepEqual(followShare([10000, 12500], 22500, 18000), [8000, 10000], 'an uneven split keeps its 4:5');
    const odd = followShare([10000, 10000, 10000], 30000, 10000)!;
    assert.equal(odd.reduce((a, b) => a + b, 0), 10000, 'to the cent');
    assert.deepEqual(odd, [3334, 3333, 3333], 'the leftover cent to the first, as shareCents');
  });
  it('payments mid-edit (not adding up) stay as typed; nothing moves when the share has not', () => {
    assert.equal(followShare([11250, 10000], 22500, 18000), null);
    assert.equal(followShare([11250, 11250], 22500, 22500), null);
    assert.equal(followShare([], 0, 18000), null);
  });
  it('a share with no figure yet (a percentage being retyped) leaves the payments as they were (/review)', () => {
    assert.equal(followShare([10000, 12500], 22500, 0), null);
  });
  it('payments of nothing, made before the share had a figure, divide evenly once it has one', () => {
    assert.deepEqual(followShare([0, 0, 0], 0, 18000), [6000, 6000, 6000]);
  });
  it('an even division stays even: its leftover cent is rounding, not a proportion (found replaying the walk)', () => {
    assert.deepEqual(followShare([2813, 2812], 5625, 45000), [22500, 22500], 'never $225.04 + $224.96');
    assert.deepEqual(followShare([2813, 2812], 5625, 45001), [22501, 22500], 'a new leftover cent to the first');
  });
});

describe('billSplits — the split and the schedule once per bill', () => {
  it('Evenly, two payments: each team\'s share spread over the dates ("115.63 + 115.62")', () => {
    const r = ok(billSplits({
      amount: 1850, split: { method: 'even' },
      schedule: { kind: 'installments', dueDates: ['2026-11-15', '2026-12-15'] },
      teams: Array.from({ length: 8 }, (_, i) => team(`t${i}`)),
    }));
    assert.equal(r.method, 'even');
    assert.deepEqual(r.splits[0].installments.map(i => i.amount), [115.63, 115.62]);
    assert.equal(r.splits[0].paymentSchedule, 'custom');
    assert.equal(r.splits.reduce((n, s) => n + Math.round(s.amount * 100), 0), 185000);
  });
  it('one payment: one installment on its date, a standard schedule', () => {
    const r = ok(billSplits({ amount: 300, split: { method: 'even' }, schedule: { kind: 'one', dueDate: '2026-11-15' }, teams: [team('a'), team('b')] }));
    assert.deepEqual(r.splits.map(s => [s.amount, s.installments.length, s.paymentSchedule]), [[150, 1, 'standard'], [150, 1, 'standard']]);
  });
  it('By amount: the shares must add up to the amount, and the refusal says the difference', () => {
    const r = billSplits({ amount: 500, split: { method: 'fixed' }, schedule: { kind: 'one', dueDate: '2026-11-15' }, teams: [team('a', { value: 200 }), team('b', { value: 250 })] });
    assert.equal(code(r), 'shares_dont_add_up');
    assert.equal((r as unknown as { body: { difference: number } }).body.difference, 50);
    ok(billSplits({ amount: 500, split: { method: 'fixed' }, schedule: { kind: 'one', dueDate: '2026-11-15' }, teams: [team('a', { value: 200 }), team('b', { value: 300 })] }));
  });
  it('By percentage: the percentages add up to 100', () => {
    assert.equal(code(billSplits({ amount: 500, split: { method: 'percentage' }, schedule: { kind: 'one', dueDate: '2026-11-15' }, teams: [team('a', { value: 60 }), team('b', { value: 30 })] })), 'percentages_dont_add_up');
    const r = ok(billSplits({ amount: 500, split: { method: 'percentage' }, schedule: { kind: 'one', dueDate: '2026-11-15' }, teams: [team('a', { value: 60 }), team('b', { value: 40 })] }));
    assert.deepEqual(r.splits.map(s => s.amount), [300, 200]);
  });
  it('33.33% three times is within a hundredth of 100; the refusal names the sum in hundredths', () => {
    const three = [team('a', { value: 33.33 }), team('b', { value: 33.33 }), team('c', { value: 33.33 })];
    const r = ok(billSplits({ amount: 300, split: { method: 'percentage' }, schedule: { kind: 'one', dueDate: '2026-11-15' }, teams: three }));
    assert.equal(r.splits.reduce((n, x) => n + Math.round(x.amount * 100), 0), 30000);
    const off = billSplits({ amount: 300, split: { method: 'percentage' }, schedule: { kind: 'one', dueDate: '2026-11-15' }, teams: [team('a', { value: 33.3 }), team('b', { value: 33.3 }), team('c', { value: 33.3 })] });
    assert.equal(code(off), 'percentages_dont_add_up');
    assert.match((off as unknown as { body: { error: string } }).body.error, /99\.9%/);
  });
  it('never a $0.00 payment: a share smaller than its number of dates is refused', () => {
    const r = billSplits({ amount: 0.02, split: { method: 'even' }, schedule: { kind: 'installments', dueDates: ['2026-11-01', '2026-12-01', '2027-01-01'] }, teams: [team('a')] });
    assert.equal(code(r), 'bad_installment');
  });
  it('a team\'s own installments must add up to its share', () => {
    const bad = billSplits({
      amount: 300, split: { method: 'even' }, schedule: { kind: 'one', dueDate: '2026-11-15' },
      teams: [team('a', { installments: [{ dueDate: '2026-11-15', amount: 100 }] }), team('b')],
    });
    assert.equal(code(bad), 'installments_dont_add_up');
    const good = ok(billSplits({
      amount: 300, split: { method: 'even' }, schedule: { kind: 'one', dueDate: '2026-11-15' },
      teams: [team('a', { installments: [{ dueDate: '2026-11-15', amount: 75 }, { dueDate: '2026-12-15', amount: 75 }] }), team('b')],
    }));
    assert.deepEqual(good.splits[0].installments.map(i => i.dueDate), ['2026-11-15', '2026-12-15']);
  });
  it('refuses: no teams, a team twice, no due date, an amount of nothing', () => {
    assert.equal(code(billSplits({ amount: 100, split: { method: 'even' }, schedule: { kind: 'one', dueDate: '2026-11-15' }, teams: [] })), 'splits_required');
    assert.equal(code(billSplits({ amount: 100, split: { method: 'even' }, schedule: { kind: 'one', dueDate: '2026-11-15' }, teams: [team('a'), team('a')] })), 'bad_split');
    assert.equal(code(billSplits({ amount: 100, split: { method: 'even' }, schedule: { kind: 'one' }, teams: [team('a')] })), 'bad_installment');
    assert.equal(code(billSplits({ amount: 0, split: { method: 'even' }, schedule: { kind: 'one', dueDate: '2026-11-15' }, teams: [team('a')] })), 'bad_total');
  });
});
