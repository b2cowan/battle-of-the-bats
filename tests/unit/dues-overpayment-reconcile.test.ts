/**
 * The overpayment reconcile's WHOLE decision, pinned (QA §123 Phase A).
 *
 * ⚠ WHY THIS FILE EXISTS BESIDE dues-payments-allocation.test.ts: that suite exercises
 * `strandedExcess` with the already-credited total handed in BY HAND — so the pure arithmetic was
 * green while the executor's query fed it the wrong total for two weeks. The executor selected
 * `payment_id IS NOT NULL`, while the credits it writes on a schedule change are deliberately
 * standalone (`payment_id: null`): it could not see its own work. Lowering a paid-up family's
 * dues twice stacked a second credit on the first, and restoring the total left the stale credit
 * standing. The fix moved the SELECTION into `planOverpaymentReconcile`, so the decision the
 * query used to make silently is what this suite drives — with the full mixed credit set a real
 * player holds, exactly as the store returns it (newest first).
 *
 * Both owner-prompt sequences are pinned end to end, and so is the Phase A2 projection that
 * asks the payout floor BEFORE the schedule write.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planOverpaymentReconcile } from '../../lib/dues-payments.ts';
import { projectScheduleTotalChange, payoutFloorViolation } from '../../lib/dues-credit-guards.ts';

/** Newest first, like the executor's `order('created_at', { ascending: false })`. */
const credit = (id: string, amount: number, creditType = 'overpayment') => ({ id, amount, creditType });

describe('planOverpaymentReconcile — the reconcile counts the credits it writes', () => {
  it('sequence 1 (the doubled credit): paid $1,200 · lower to $800 → $400 · lower to $600 tops up $200, never a second $600', () => {
    // First lower: no credits yet → create the full excess.
    const first = planOverpaymentReconcile([], 1200, 800);
    assert.deepEqual(first, { create: 400, topUp: null, remove: [], trim: null, reduced: 0 });

    // Second lower: the $400 it just wrote is STANDALONE (payment_id null). The defect was that
    // the old query could not see it and created $600 more — $1,000 of credit for a $600 truth.
    const second = planOverpaymentReconcile([credit('c1', 400)], 1200, 600);
    assert.equal(second.create, 200, 'tops up to the $600 truth — never re-credits the $400 it already wrote');
    assert.deepEqual(second.remove, []);
    assert.equal(second.trim, null);
  });

  it('sequence 2 (the stale credit): paid $1,200 · lower to $800 → $400 · restore to $1,200 removes it', () => {
    const plan = planOverpaymentReconcile([credit('c1', 400)], 1200, 1200);
    assert.deepEqual(plan, { create: 0, topUp: null, remove: ['c1'], trim: null, reduced: 400 },
      'the old query saw no linked credits, found nothing to reduce, and the stale $400 stood');
  });

  it('reduces newest-first ACROSS the whole set — linked and standalone alike — trimming the one it only partly reaches', () => {
    // c2 (newest, standalone) is swallowed whole; c1 (older, imagine payment-linked — the planner
    // rightly cannot tell) is trimmed. Which rows ride a payment matters to the DELETE mechanics
    // (CASCADE vs standalone), never to the arithmetic.
    const plan = planOverpaymentReconcile([credit('c2', 200), credit('c1', 400)], 1200, 1100);
    assert.equal(plan.create, 0);
    assert.deepEqual(plan.remove, ['c2']);
    assert.deepEqual(plan.trim, { id: 'c1', amount: 100 });
    assert.equal(plan.reduced, 500);
  });

  it('credits stay credits: manual, fundraiser, forgiven and reimbursement rows are never counted and never touched', () => {
    const mixed = [
      credit('f1', 300, 'fundraiser'),
      credit('m1', 250, 'contribution'),
      credit('g1', 150, 'forgiven'),
      credit('c1', 400),
    ];
    // Restore to full: only the overpayment row goes.
    const restore = planOverpaymentReconcile(mixed, 1200, 1200);
    assert.deepEqual(restore.remove, ['c1']);
    assert.equal(restore.trim, null);
    // At the truth already: nothing moves, whatever the other credits total.
    const settled = planOverpaymentReconcile(mixed, 1200, 800);
    assert.deepEqual(settled, { create: 0, topUp: null, remove: [], trim: null, reduced: 0 });
  });

  it('a no-schedule-change reconcile with mixed credits still tops up against ALL overpayment rows', () => {
    // Record-time path: a linked $50 exists from an earlier receipt, a standalone $400 from a
    // schedule change. New truth $500 → create $50, not $450.
    const plan = planOverpaymentReconcile([credit('c2', 400), credit('c1', 50)], 1700, 1200);
    assert.equal(plan.create, 50);
  });

  it('cents: 0.1 + 0.2-style inputs neither leak fractional cents nor churn', () => {
    assert.deepEqual(planOverpaymentReconcile([credit('c1', 0.1)], 0.3, 0.2),
      { create: 0, topUp: null, remove: [], trim: null, reduced: 0 });
    assert.equal(planOverpaymentReconcile([], 0.3, 0.1).create, 0.2);
  });
});

describe('consolidation — the schedule-change credit is ONE row per season (owner, 2026-09-01)', () => {
  const engineRow = (id: string, amount: number) => ({ ...credit(id, amount), consolidatable: true });

  it('a later lower TOPS UP the engine row instead of appending a sibling', () => {
    const plan = planOverpaymentReconcile([engineRow('c1', 400)], 1200, 600, { consolidate: true });
    assert.deepEqual(plan, { create: 200, topUp: { id: 'c1', newAmount: 600 }, remove: [], trim: null, reduced: 0 });
  });

  it('the first lower still creates the row — there is nothing to top up yet', () => {
    const plan = planOverpaymentReconcile([], 1200, 800, { consolidate: true });
    assert.deepEqual(plan, { create: 400, topUp: null, remove: [], trim: null, reduced: 0 });
  });

  it('record-time NEVER consolidates — a receipt’s credit rides its payment (CASCADE removes it together)', () => {
    const plan = planOverpaymentReconcile([engineRow('c1', 400)], 1700, 1200);
    assert.equal(plan.create, 100);
    assert.equal(plan.topUp, null);
  });

  it('a coach-typed overpayment credit is COUNTED but never written into', () => {
    // Same shape as the engine's row, but not consolidatable (different description) — the
    // "credits stay credits" boundary for hand-typed rows.
    const plan = planOverpaymentReconcile([credit('m1', 400)], 1200, 600, { consolidate: true });
    assert.equal(plan.create, 200);
    assert.equal(plan.topUp, null);
  });

  it('several engine rows (a race, or history) MERGE into the newest on the grow path — one row per season is enforced, not assumed', () => {
    const rows = [engineRow('c2', 200), engineRow('c1', 400)];
    // trueExcess 700 − carried 600 → create 100; the host absorbs BOTH engine rows plus it.
    const up = planOverpaymentReconcile(rows, 1200, 500, { consolidate: true });
    assert.equal(up.create, 100);
    assert.deepEqual(up.topUp, { id: 'c2', newAmount: 700 });
    assert.deepEqual(up.remove, ['c1']);
    // The extras' dollars MOVE, never leave — reduced reports no shrink.
    assert.equal(up.reduced, 0);
    const drain = planOverpaymentReconcile(rows, 1200, 1200, { consolidate: true });
    assert.deepEqual(drain.remove, ['c2', 'c1']);
    assert.equal(drain.reduced, 600);
  });

  it('the merge never touches a coach-typed overpayment credit riding among the engine rows', () => {
    const rows = [engineRow('c3', 200), { id: 'manual', amount: 150, creditType: 'overpayment' }, engineRow('c1', 400)];
    const up = planOverpaymentReconcile(rows, 1400, 500, { consolidate: true });
    // carried 750, trueExcess 900 → create 150; hosts are c3+c1 only — manual is counted, never merged.
    assert.deepEqual(up.topUp, { id: 'c3', newAmount: 750 });
    assert.deepEqual(up.remove, ['c1']);
  });
});

describe('projectScheduleTotalChange — the schedule doors ask the payout floor pre-flight (Phase A2)', () => {
  const payouts = [{ amount: 400 }];

  it('raising a paid-out family’s total to the full amount breaks the floor', () => {
    const projected = projectScheduleTotalChange({
      familyCredits: [credit('c1', 400), credit('f1', 300, 'fundraiser')],
      paymentsTotal: 1200,
      newScheduleTotal: 1200,
    });
    // The overpayment credit the payout stood on projects away; only the fundraiser credit is
    // left to cover the $400 already handed over in cash.
    assert.deepEqual(projected, [{ amount: 300, creditType: 'fundraiser' }]);
    assert.deepEqual(payoutFloorViolation(projected, payouts), { paidOut: 400 });
  });

  it('a total that keeps enough excess passes', () => {
    const projected = projectScheduleTotalChange({
      familyCredits: [credit('c1', 400), credit('f1', 300, 'fundraiser')],
      paymentsTotal: 1200,
      newScheduleTotal: 800,
    });
    assert.deepEqual(projected, [
      { amount: 300, creditType: 'fundraiser' },
      { amount: 400, creditType: 'overpayment' },
    ]);
    assert.equal(payoutFloorViolation(projected, payouts), null);
  });

  it('composes with the forgiveness exclusion: a forgiven balance never covers a payout', () => {
    const projected = projectScheduleTotalChange({
      familyCredits: [credit('g1', 500, 'forgiven'), credit('c1', 400)],
      paymentsTotal: 1200,
      newScheduleTotal: 1200,
    });
    // The forgiven $500 survives the projection but the CEILING excludes it — a forgiven balance
    // was never the family's money to be handed back (lib/dues-credits.ts payoutCeiling).
    assert.deepEqual(payoutFloorViolation(projected, payouts), { paidOut: 400 });
  });

  it('lowering a total only grows the credit — the floor cannot be reached from that side', () => {
    const projected = projectScheduleTotalChange({
      familyCredits: [credit('c1', 400)],
      paymentsTotal: 1200,
      newScheduleTotal: 600,
    });
    assert.equal(payoutFloorViolation(projected, payouts), null);
  });
});
