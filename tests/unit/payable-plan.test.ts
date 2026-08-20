/**
 * The pure decisions behind writing a commitment's PLAN (Payables Rebuild P2).
 *
 * `lib/payable-plan.ts` is what survived the bridge: the legacy modules that derived a plan FROM
 * the deposit/balance columns died when `Record a payment` made the new tables the source of
 * truth, but "how does a desired plan diff against what is stored" and "which descriptions could a
 * pre-mig-236 payment's ledger entry have been posted under" were never about the legacy columns.
 * The `planInstallmentWrites` cases here are ported from the bridge's own test file — the rules
 * they assert did not change, only the caller that states the desired plan.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  planInstallmentWrites, legacyEntryDescriptionsForPayment,
  composeTwoPieceInstallments, paymentRestatements,
  type StoredInstallment, type StoredPaymentForRestate,
} from '../../lib/payable-plan.ts';

describe('planInstallmentWrites — the plan, given what is stored', () => {
  const stored = (over: Partial<StoredInstallment> = {}): StoredInstallment =>
    ({ id: 'i1', installmentNumber: 1, amount: 300, dueDate: '2026-05-01', ...over });
  const none = () => false;

  it('writes nothing at all when the plan already agrees', () => {
    const w = planInstallmentWrites(
      [{ amount: 300, dueDate: '2026-05-01' }], [stored()], none);
    assert.deepStrictEqual(w, { insert: [], update: [], deleteIds: [] });
  });

  it('inserts a piece that has never existed — R1 on a brand new commitment', () => {
    const w = planInstallmentWrites(
      [{ amount: 300, dueDate: '2026-05-01' }], [], none);
    assert.deepStrictEqual(w.insert.map(i => i.installmentNumber), [1]);
  });

  it('numbers pieces by POSITION, so the form\'s order is the stored order', () => {
    const w = planInstallmentWrites(
      [{ amount: 300, dueDate: '2026-05-01' }, { amount: 600, dueDate: '2026-07-01' }],
      [stored()], none);
    assert.deepStrictEqual(w.insert, [{ installmentNumber: 2, amount: 600, dueDate: '2026-07-01' }]);
  });

  it('updates a piece whose amount or date moved', () => {
    const w = planInstallmentWrites(
      [{ amount: 350, dueDate: '2026-05-08' }], [stored()], none);
    assert.deepStrictEqual(w.update, [{ id: 'i1', amount: 350, dueDate: '2026-05-08' }]);
  });

  it('ignores a sub-cent difference rather than rewriting the row every save', () => {
    const w = planInstallmentWrites(
      [{ amount: 300.001, dueDate: '2026-05-01' }], [stored()], none);
    assert.deepStrictEqual(w.update, []);
  });

  it('removes a piece the plan no longer has — a coach un-splitting a payable', () => {
    const w = planInstallmentWrites(
      [{ amount: 900, dueDate: '2026-05-01' }],
      [stored(), stored({ id: 'i2', installmentNumber: 2, amount: 600, dueDate: '2026-07-01' })],
      none);
    assert.deepStrictEqual(w.deleteIds, ['i2']);
  });

  it('⚠ NEVER removes a piece with money standing on it', () => {
    /* The payment would fall back to the ordinary application rule and a settled half would read as
       unpaid for reasons nothing on screen explains. Leaving the piece is the visible, correctable
       state; removing it is the silent one. (The edit door REFUSES the save before it gets here —
       this is the backstop that makes the refusal a courtesy rather than the only defence.) */
    const w = planInstallmentWrites(
      [{ amount: 900, dueDate: '2026-05-01' }],
      [stored(), stored({ id: 'i2', installmentNumber: 2, amount: 600, dueDate: '2026-07-01' })],
      id => id === 'i2');
    assert.deepStrictEqual(w.deleteIds, []);
  });
});

describe('composeTwoPieceInstallments — what the deposit/balance editor MEANS', () => {
  it('two typed halves pass through as two pieces', () => {
    assert.deepStrictEqual(composeTwoPieceInstallments({
      total: 900, depositAmount: 300, depositDueDate: '2026-05-01',
      balanceAmount: 600, balanceDueDate: '2026-07-01', fallbackDueDate: '2026-04-02',
    }), [
      { amount: 300, dueDate: '2026-05-01' },
      { amount: 600, dueDate: '2026-07-01' },
    ]);
  });

  it('⚠ a BLANK half takes the remainder — "$600 split $200 / (blank)" means a $400 balance', () => {
    const plan = composeTwoPieceInstallments({
      total: 600, depositAmount: 200, depositDueDate: '2026-05-01',
      balanceDueDate: '2026-07-01', fallbackDueDate: '2026-04-02',
    });
    assert.deepStrictEqual(plan.map(p => p.amount), [200, 400]);
  });

  it('a half with an amount and no date takes the other half\'s date', () => {
    const plan = composeTwoPieceInstallments({
      total: 900, depositAmount: 300, balanceAmount: 600,
      balanceDueDate: '2026-07-01', fallbackDueDate: '2026-04-02',
    });
    assert.deepStrictEqual(plan.map(p => p.dueDate), ['2026-07-01', '2026-07-01']);
  });

  it('a remainder that works out to nothing still buys a row, never a zero piece (R1)', () => {
    const plan = composeTwoPieceInstallments({
      total: 300, depositAmount: 300, balanceDueDate: '2026-07-01', fallbackDueDate: '2026-04-02',
    });
    assert.strictEqual(plan.length, 2);
    assert.ok(plan.every(p => p.amount > 0));
  });

  it('rounds the remainder to the cent, so a third-of-a-bill split cannot fail its own column', () => {
    const plan = composeTwoPieceInstallments({
      total: 100, depositAmount: 33.33, balanceDueDate: '2026-07-01', fallbackDueDate: '2026-04-02',
    });
    assert.deepStrictEqual(plan.map(p => p.amount), [33.33, 66.67]);
  });

  it('an explicit ZERO half means "nothing recorded", exactly like blank', () => {
    // The bridge's own /review finding, carried forward: a $0 deposit typed against a $600 balance
    // must not clamp piece 1 to a cent and break R2.
    const plan = composeTwoPieceInstallments({
      total: 900, depositAmount: 0, balanceAmount: 600,
      balanceDueDate: '2026-07-01', fallbackDueDate: '2026-04-02',
    });
    assert.deepStrictEqual(plan.map(p => p.amount), [300, 600]);
  });
});

describe('paymentRestatements — when the 2026-08-16 "books follow the edit" ruling fires', () => {
  const piece = (over: Partial<StoredInstallment> = {}): StoredInstallment =>
    ({ id: 'i1', installmentNumber: 1, amount: 325, dueDate: '2026-05-01', ...over });
  const payment = (over: Partial<StoredPaymentForRestate> = {}): StoredPaymentForRestate =>
    ({ id: 'p1', amount: 325, paidDate: '2026-05-14', installmentNumber: null, ...over });

  it('the plain-cost case: one payment, one piece — the payment tracks the new total (§27 Part C)', () => {
    assert.deepStrictEqual(
      paymentRestatements([{ amount: 225, dueDate: '2026-05-01' }], [piece()], [payment()]),
      [{ paymentId: 'p1', newAmount: 225 }]);
  });

  it('the same case carries a paid-date correction with it', () => {
    assert.deepStrictEqual(
      paymentRestatements([{ amount: 325, dueDate: '2026-05-01' }], [piece()], [payment()], '2026-05-02'),
      [{ paymentId: 'p1', newPaidDate: '2026-05-02' }]);
  });

  it('⚠ a PART payment is left alone — it honestly says what moved, and the standing re-reads', () => {
    assert.deepStrictEqual(
      paymentRestatements([{ amount: 650, dueDate: '2026-05-01' }], [piece({ amount: 600 })],
        [payment({ amount: 200 })]),
      []);
  });

  it('a settled deposit/balance half tracks its piece when ONE targeted payment settled it', () => {
    const stored = [piece({ amount: 300 }), piece({ id: 'i2', installmentNumber: 2, amount: 600, dueDate: '2026-07-01' })];
    const paid = [payment({ amount: 300, installmentNumber: 1 })];
    assert.deepStrictEqual(
      paymentRestatements(
        [{ amount: 350, dueDate: '2026-05-01' }, { amount: 600, dueDate: '2026-07-01' }], stored, paid),
      [{ paymentId: 'p1', newAmount: 350 }]);
  });

  it('⚠ two payments on one piece is ambiguous — nothing is restated', () => {
    const stored = [piece({ amount: 300 }), piece({ id: 'i2', installmentNumber: 2, amount: 600, dueDate: '2026-07-01' })];
    const paid = [
      payment({ amount: 150, installmentNumber: 1 }),
      payment({ id: 'p2', amount: 150, installmentNumber: 1 }),
    ];
    assert.deepStrictEqual(
      paymentRestatements(
        [{ amount: 350, dueDate: '2026-05-01' }, { amount: 600, dueDate: '2026-07-01' }], stored, paid),
      []);
  });

  it('an unchanged figure restates nothing at all', () => {
    assert.deepStrictEqual(
      paymentRestatements([{ amount: 325, dueDate: '2026-06-01' }], [piece()], [payment()]),
      []);
  });
});

describe('legacyEntryDescriptionsForPayment — which description a pre-mig-236 entry was posted under', () => {
  const base = { expenseType: 'tournament_payable', description: 'Fall Showdown entry' };

  it('a plain cost posted the bare description', () => {
    assert.deepStrictEqual(
      legacyEntryDescriptionsForPayment({ ...base, expenseType: 'expense', source: 'manual', installmentNumber: 1 }),
      ['Fall Showdown entry']);
  });

  it('a payable\'s first piece posted with the Deposit suffix, its second with Balance', () => {
    assert.deepStrictEqual(
      legacyEntryDescriptionsForPayment({ ...base, source: 'migration_255', installmentNumber: 1 }),
      ['Fall Showdown entry — Deposit']);
    assert.deepStrictEqual(
      legacyEntryDescriptionsForPayment({ ...base, source: 'migration_255', installmentNumber: 2 }),
      ['Fall Showdown entry — Balance']);
  });

  it('⚠ a WRONG-DOOR payment posted the bare description, whatever piece it sits on', () => {
    /* A payable settled through `markExpensePaid` before 2026-08-16 posted its full amount under
       the plain description — that is precisely what made it invisible, and why the source column
       exists to find it again. */
    assert.deepStrictEqual(
      legacyEntryDescriptionsForPayment({ ...base, source: 'migration_255_wrong_door', installmentNumber: 1 }),
      ['Fall Showdown entry']);
  });

  it('the bridge\'s own source labels still pin the half down', () => {
    assert.deepStrictEqual(
      legacyEntryDescriptionsForPayment({ ...base, source: 'legacy_balance', installmentNumber: null }),
      ['Fall Showdown entry — Balance']);
  });

  it('⚠ nothing pinning the half down yields EVERY candidate — the caller\'s ambiguity refusal is the guard', () => {
    const candidates = legacyEntryDescriptionsForPayment({ ...base, source: 'manual', installmentNumber: null });
    assert.deepStrictEqual(candidates, [
      'Fall Showdown entry — Deposit',
      'Fall Showdown entry — Balance',
      'Fall Showdown entry',
    ]);
  });
});
