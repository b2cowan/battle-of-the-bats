/**
 * The one-family schedule editor's sentences (owner direction 2026-09-01, "installments only").
 * Every figure the form shows comes from these — pinned so the screen and the rule cannot drift.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  commonScheduleTotal, installmentSumC, teamComparison, scheduleEditConsequence,
} from '../../lib/dues-schedule-edit.ts';

describe('commonScheduleTotal — the total the most players share', () => {
  it('picks the mode', () => {
    assert.equal(commonScheduleTotal([600, 600, 700, 600, 450]), 600);
  });
  it('breaks a tie on the lower total, deterministically', () => {
    assert.equal(commonScheduleTotal([700, 600]), 600);
    assert.equal(commonScheduleTotal([600, 700]), 600);
  });
  it('is null when nobody else has a schedule (or only zero-dollar ones)', () => {
    assert.equal(commonScheduleTotal([]), null);
    assert.equal(commonScheduleTotal([0]), null);
  });
  it('compares in cents', () => {
    assert.equal(commonScheduleTotal([0.1 + 0.2, 0.3]), 0.3);
  });
});

describe('teamComparison — the line under the rows', () => {
  const rows = [{ amount: '250' }, { amount: '250' }, { amount: '200' }];
  it('sums typed rows in cents, blank rows counting as zero', () => {
    assert.equal(installmentSumC([{ amount: '0.1' }, { amount: '0.2' }, { amount: '' }]), 30);
  });
  it('matches the team', () => {
    assert.deepEqual(teamComparison(rows, 700), { state: 'match', sum: 700, team: 700 });
  });
  it('differs by the signed difference', () => {
    assert.deepEqual(teamComparison(rows, 600), { state: 'differs', sum: 700, team: 600, diff: 100 });
    assert.deepEqual(teamComparison(rows, 800), { state: 'differs', sum: 700, team: 800, diff: -100 });
  });
  it('has nothing to compare against when nobody else has dues', () => {
    assert.deepEqual(teamComparison(rows, null), { state: 'none', sum: 700 });
  });
});

describe('scheduleEditConsequence — what saving does to money already paid', () => {
  it('says nothing when nothing has been paid', () => {
    assert.equal(scheduleEditConsequence({ rows: [{ amount: '100' }], removedPaid: 0, paymentsTotal: 0, paidOut: 0 }), null);
  });
  it('says nothing when paid money is untouched', () => {
    const rows = [{ amount: '250', paid: 250 }, { amount: '250', paid: 100 }, { amount: '200', paid: 0 }];
    assert.equal(scheduleEditConsequence({ rows, removedPaid: 0, paymentsTotal: 350, paidOut: 0 }), null);
  });
  it('lowering a paid installment slides the excess forward', () => {
    const rows = [{ amount: '150', paid: 250 }, { amount: '250', paid: 100 }, { amount: '300', paid: 0 }];
    assert.deepEqual(scheduleEditConsequence({ rows, removedPaid: 0, paymentsTotal: 350, paidOut: 0 }), { kind: 'slides', amount: 100 });
  });
  it('removing a paid installment slides ALL of its money forward', () => {
    const rows = [{ amount: '400', paid: 100 }, { amount: '300', paid: 0 }];
    assert.deepEqual(scheduleEditConsequence({ rows, removedPaid: 250, paymentsTotal: 350, paidOut: 0 }), { kind: 'slides', amount: 250 });
  });
  it('a total below what has been paid becomes an overpayment credit — naming what was already handed back', () => {
    const rows = [{ amount: '200', paid: 250 }, { amount: '100', paid: 250 }];
    assert.deepEqual(
      scheduleEditConsequence({ rows, removedPaid: 0, paymentsTotal: 800, paidOut: 200 }),
      { kind: 'credit', paid: 800, total: 300, credit: 500, handedBack: 200 },
    );
  });
  it('the credit case wins over the slide case — one sentence, the bigger fact', () => {
    const rows = [{ amount: '100', paid: 250 }];
    const c = scheduleEditConsequence({ rows, removedPaid: 0, paymentsTotal: 250, paidOut: 0 });
    assert.equal(c?.kind, 'credit');
  });
});
