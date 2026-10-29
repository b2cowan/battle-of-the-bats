/**
 * A "BILLS YOU OWE" ROW SAYS WHAT THE BILL ASKS NOW (owner 2026-10-29, Milton Bats' six-month dues plan: every
 * row read the whole balance). The row's figure and the Amount a pick pre-fills are one answer — held here.
 * Mockup: https://claude.ai/artifact/WaD9ofpFKxefGMVVGBAuoR
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nextPayment } from '../../lib/bill-next-payment.ts';
import type { AppliedInstallment } from '../../lib/payable-standing.ts';

const piece = (n: number, dueDate: string, amount: number, applied = 0): AppliedInstallment => ({
  id: `i${n}`,
  installmentNumber: n,
  dueDate,
  amount,
  applied,
  remaining: Math.max(0, Math.round((amount - applied) * 100) / 100),
  state: applied >= amount ? 'settled' : applied > 0 ? 'partly_paid' : 'unpaid',
}) as AppliedInstallment;

const TODAY = '2026-10-29';

describe('nextPayment — what a bill asks of the coach right now', () => {
  it('nothing late: the soonest unsettled piece and its date, never the whole balance', () => {
    const plan = [piece(1, '2026-11-15', 350), piece(2, '2026-12-15', 350), piece(3, '2027-01-15', 350)];
    assert.deepEqual(nextPayment(plan, TODAY), { amount: 350, line: 'due Nov 15', late: false, left: false });
  });
  it('settled pieces are skipped, whatever order the plan arrives in', () => {
    const plan = [piece(3, '2027-01-15', 350), piece(1, '2026-09-15', 350, 350), piece(2, '2026-11-15', 350)];
    assert.equal(nextPayment(plan, TODAY)?.line, 'due Nov 15');
  });
  it('one piece late: its date and how late, in the club bill window’s words, and it is the verdict', () => {
    const plan = [piece(1, '2026-10-15', 385), piece(2, '2026-11-15', 385)];
    assert.deepEqual(nextPayment(plan, TODAY), { amount: 385, line: 'Oct 15 · 14 days late', late: true, left: false });
  });
  it('two or more late: they add up in cents, and the line says how many and since when', () => {
    const plan = [piece(1, '2026-10-01', 350.1), piece(2, '2026-10-15', 350.2), piece(3, '2026-11-15', 350)];
    assert.deepEqual(nextPayment(plan, TODAY), { amount: 700.3, line: '2 late · since Oct 1', late: true, left: false });
  });
  it('a piece due TODAY is not late', () => {
    assert.equal(nextPayment([piece(1, TODAY, 100)], TODAY)?.late, false);
  });
  it('a part-paid next piece asks only what is left on it, and says so', () => {
    const plan = [piece(1, '2026-11-15', 400, 187.6), piece(2, '2026-12-15', 400)];
    assert.deepEqual(nextPayment(plan, TODAY), { amount: 212.4, line: 'due Nov 15', late: false, left: true });
  });
  it('a bill with nothing unsettled asks nothing — the caller falls back to its own balance', () => {
    assert.equal(nextPayment([piece(1, '2026-09-15', 350, 350)], TODAY), null);
    assert.equal(nextPayment([], TODAY), null);
  });
});
