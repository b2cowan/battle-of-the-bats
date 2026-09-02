/**
 * The bulk dues run's exceptions, pinned (Exceptions First — owner rulings 2026-09-01).
 *
 * ⚠ WHY THIS SUITE MATTERS MORE THAN A NORMAL DERIVATION SUITE: `planRosterDuesRun` is now read
 * by TWO surfaces that must agree — the preview a coach approves, and the write route that
 * carries it out. A drift between them does not look like a bug on screen; it looks like the
 * coach protecting three families and a different three being flattened. So the shape comparison
 * (`describeExistingSchedules`) is pinned here on its own, including the case that made it exist:
 * a roster whose rows ALL read `source = 'manual'` after a routine season rollover, where the
 * right answer is that nobody is hand-set.
 *
 * The three scenarios from the approved mockup (artifact 4f742ce0) are driven end to end — the
 * fresh roster, the mid-season roster with a payment, a hand-set plan and a payout-floor refusal,
 * and the roster whose dates move.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  describeExistingSchedules, playersWithDateChange, planRosterDuesRun,
  type ExistingInstallmentRow,
} from '../../lib/dues-bulk-run.ts';

const row = (playerId: string, n: number, amount: number, dueDate: string): ExistingInstallmentRow =>
  ({ playerId, installmentNumber: n, amount, dueDate });

const roster = (...ids: string[]) => ids.map(id => ({ id, name: id.toUpperCase() }));

describe('describeExistingSchedules — who differs from the rest of the roster', () => {
  it('a uniform roster flags NOBODY, however its rows were born', () => {
    // The season-rollover case: every row would read source='manual', and naming the whole roster
    // as hand-set would let one click apply a team-wide date fix to nobody.
    const rows = ['a', 'b', 'c'].map(id => row(id, 1, 500, '2026-10-10'));
    const verdict = describeExistingSchedules(rows);
    assert.deepEqual([...verdict.handSetPlayerIds], []);
    assert.equal(verdict.hasExistingDues, true);
  });

  it('names the player whose AMOUNTS differ, and the one whose DATES differ', () => {
    const rows = [
      row('a', 1, 500, '2026-10-10'),
      row('b', 1, 500, '2026-10-10'),
      row('c', 1, 500, '2026-10-10'),
      row('odd-amount', 1, 325, '2026-10-10'),
      row('odd-date',   1, 500, '2026-11-01'),
    ];
    const verdict = describeExistingSchedules(rows);
    assert.deepEqual([...verdict.handSetPlayerIds].sort(), ['odd-amount', 'odd-date']);
  });

  it('a player split into two installments differs from a roster paying in one', () => {
    const rows = [
      row('a', 1, 600, '2026-10-10'),
      row('b', 1, 600, '2026-10-10'),
      row('split', 1, 300, '2026-10-10'),
      row('split', 2, 300, '2026-12-10'),
    ];
    const verdict = describeExistingSchedules(rows);
    assert.deepEqual([...verdict.handSetPlayerIds], ['split']);
    assert.deepEqual(verdict.summaryByPlayer.get('split'), { total: 600, dateCount: 2 });
  });

  it('summarises each existing plan in cents, so a three-way split does not read $599.99', () => {
    const rows = [
      row('a', 1, 333.33, '2026-10-10'), row('a', 2, 333.33, '2026-11-10'), row('a', 3, 333.34, '2026-12-10'),
    ];
    assert.deepEqual(describeExistingSchedules(rows).summaryByPlayer.get('a'), { total: 1000, dateCount: 3 });
  });

  it('an empty season has no dues and nobody hand-set', () => {
    const verdict = describeExistingSchedules([]);
    assert.equal(verdict.hasExistingDues, false);
    assert.equal(verdict.handSetPlayerIds.size, 0);
  });

  it('ties break on the shape string, so the answer does not depend on row order', () => {
    const forward = [row('a', 1, 100, '2026-10-10'), row('b', 1, 200, '2026-10-10')];
    const reverse = [...forward].reverse();
    assert.deepEqual(
      [...describeExistingSchedules(forward).handSetPlayerIds],
      [...describeExistingSchedules(reverse).handSetPlayerIds],
    );
  });
});

describe('playersWithDateChange — whose family gets told a new date', () => {
  it('names only the players holding a date the run does not write', () => {
    const rows = [row('stays', 1, 500, '2026-10-10'), row('moves', 1, 500, '2026-09-01')];
    assert.deepEqual([...playersWithDateChange(rows, ['2026-10-10'])], ['moves']);
  });

  it('an EMPTY proposal moves nobody — it would otherwise match nothing and name everyone', () => {
    const rows = [row('a', 1, 500, '2026-10-10'), row('b', 1, 500, '2026-10-10')];
    assert.deepEqual([...playersWithDateChange(rows, [])], []);
  });
});

describe('planRosterDuesRun — the three shapes a roster can be in', () => {
  const empty = new Map<string, never[]>();

  it('a FRESH roster has no exceptions at all — the screen is one sentence', () => {
    const plan = planRosterDuesRun({
      players: roster('a', 'b', 'c'),
      newScheduleTotal: 1000,
      newDueDates: ['2026-10-10'],
      existingRows: [],
      paymentTotals: new Map(),
      creditsByPlayer: empty,
      payoutsByPlayer: empty,
    });
    assert.deepEqual(plan.exceptions, []);
    assert.deepEqual(plan.blockedPlayerIds, []);
    assert.deepEqual(plan.handSetPlayerIds, []);
    assert.deepEqual(plan.dateChangePlayerIds, []);
    assert.equal(plan.hasExistingDues, false);
  });

  it('MID-SEASON: a payment re-applies, an overpayment is credited, a hand-set plan is named, a payout refuses', () => {
    const existingRows = [
      row('paid',    1, 800, '2026-09-01'),
      row('over',    1, 800, '2026-09-01'),
      row('handset', 1, 325, '2026-09-01'),
      row('handset', 2, 325, '2026-11-01'),
      row('payout',  1, 800, '2026-09-01'),
      row('plain',   1, 800, '2026-09-01'),
    ];
    const plan = planRosterDuesRun({
      players: roster('paid', 'over', 'handset', 'payout', 'plain'),
      newScheduleTotal: 1000,
      newDueDates: ['2026-10-10'],
      existingRows,
      paymentTotals: new Map([['paid', 400], ['over', 1200], ['payout', 1200]]),
      creditsByPlayer: new Map([
        // The family that was handed cash is standing on this credit — raising their total to
        // $1,000 shrinks it to $200, below the $400 already paid out. Refused.
        ['payout', [{ id: 'c1', amount: 400, creditType: 'overpayment', consolidatable: true }]],
      ]),
      payoutsByPlayer: new Map([['payout', [{ amount: 400 }]]]),
    });

    const byId = new Map(plan.exceptions.map(e => [e.playerId, e]));
    // Nobody without money or a hand-set plan earns a row — that is the whole point.
    assert.deepEqual([...byId.keys()].sort(), ['handset', 'over', 'paid', 'payout']);

    assert.equal(byId.get('paid')!.tone, 'plain');
    assert.equal(byId.get('paid')!.paymentsTotal, 400);
    assert.equal(byId.get('paid')!.creditCreated, 0, '$400 against a $1,000 plan creates no credit');

    assert.equal(byId.get('over')!.tone, 'plain');
    assert.equal(byId.get('over')!.creditCreated, 200, '$1,200 paid against $1,000 due');

    assert.equal(byId.get('handset')!.tone, 'warn');
    assert.deepEqual(byId.get('handset')!.handSet, { total: 650, dateCount: 2 });

    const blocked = byId.get('payout')!;
    assert.equal(blocked.tone, 'blocked');
    assert.equal(blocked.paidOut, 400);
    assert.equal(blocked.creditCreated, 0, 'a refused family is not written, so nothing is credited');
    assert.deepEqual(plan.blockedPlayerIds, ['payout']);
    assert.deepEqual(plan.handSetPlayerIds, ['handset']);

    // Every existing row sat on 2026-09-01; the run writes 2026-10-10.
    assert.equal(plan.dateChangePlayerIds.length, 5);
  });

  it('BLOCKED OUTRANKS HAND-SET — a refused family is described as refused, once', () => {
    const plan = planRosterDuesRun({
      players: roster('both', 'other', 'third'),
      newScheduleTotal: 1000,
      newDueDates: ['2026-10-10'],
      // 'other' and 'third' share the roster's shape, so only 'both' differs.
      existingRows: [row('both', 1, 325, '2026-10-10'), row('other', 1, 800, '2026-10-10'), row('third', 1, 800, '2026-10-10')],
      paymentTotals: new Map([['both', 1200]]),
      creditsByPlayer: new Map([['both', [{ id: 'c1', amount: 400, creditType: 'overpayment', consolidatable: true }]]]),
      payoutsByPlayer: new Map([['both', [{ amount: 400 }]]]),
    });
    assert.equal(plan.exceptions.length, 1);
    assert.equal(plan.exceptions[0].tone, 'blocked');
    // Still listed as hand-set: the two lists are independent, and the screen counts the union
    // once rather than adding "kept" to "refused".
    assert.deepEqual(plan.handSetPlayerIds, ['both']);
    assert.deepEqual(plan.blockedPlayerIds, ['both']);
  });

  it('a family whose payout is still covered after the change is NOT refused', () => {
    const plan = planRosterDuesRun({
      players: roster('safe'),
      newScheduleTotal: 500,
      newDueDates: ['2026-10-10'],
      existingRows: [],
      paymentTotals: new Map([['safe', 1200]]),
      creditsByPlayer: new Map([['safe', [{ id: 'c1', amount: 700, creditType: 'overpayment', consolidatable: true }]]]),
      payoutsByPlayer: new Map([['safe', [{ amount: 400 }]]]),
    });
    assert.deepEqual(plan.blockedPlayerIds, []);
    assert.equal(plan.exceptions[0].tone, 'plain');
  });

  it('a player who has LEFT the roster is never named — this run cannot touch them', () => {
    const plan = planRosterDuesRun({
      players: roster('active', 'active2'),
      newScheduleTotal: 1000,
      newDueDates: ['2026-10-10'],
      // The departed player keeps their installment rows — that is the season's record — and
      // their shape differs from the roster's, so they are hand-set by the comparison. The plan
      // must still never name them: offering to "keep" a schedule this run cannot touch is a
      // decision about nobody.
      existingRows: [
        row('active',  1, 500, '2026-09-01'),
        row('active2', 1, 500, '2026-09-01'),
        row('departed', 1, 250, '2026-09-01'),
      ],
      paymentTotals: new Map([['departed', 250]]),
      creditsByPlayer: new Map(),
      payoutsByPlayer: new Map(),
    });
    assert.deepEqual(plan.exceptions.map(e => e.playerId), []);
    assert.deepEqual(plan.handSetPlayerIds, [], 'the departed player is hand-set but off the roster');
    assert.deepEqual(plan.dateChangePlayerIds.sort(), ['active', 'active2']);
  });

  it('two players, two different schedules: one is named hand-set, deterministically', () => {
    /* ⚠ PINNED BECAUSE IT LOOKS ARBITRARY AND IS NOT. "The roster's common schedule" is the shape
       the most players share, and on a two-player roster with two shapes both counts are 1 — the
       tie breaks on the shape STRING so the same player is named on every run rather than the
       answer following row order. Inherited unchanged from the write route's own comparison; a
       coach on a two-player team is offered a keep either way, which is harmless. */
    const rows = [row('a', 1, 100, '2026-10-10'), row('b', 1, 200, '2026-10-10')];
    const first  = describeExistingSchedules(rows).handSetPlayerIds;
    const second = describeExistingSchedules([...rows].reverse()).handSetPlayerIds;
    assert.equal(first.size, 1);
    assert.deepEqual([...first], [...second]);
  });

  it('the credit figure is the RECONCILE PLANNER’s, so a standing engine credit tops up rather than doubling', () => {
    // $1,200 paid, dues already lowered once to $800 (a $400 engine credit stands). Lowering to
    // $600 must show $200 of NEW credit, never a second $600.
    const plan = planRosterDuesRun({
      players: roster('p'),
      newScheduleTotal: 600,
      newDueDates: ['2026-10-10'],
      existingRows: [],
      paymentTotals: new Map([['p', 1200]]),
      creditsByPlayer: new Map([['p', [{ id: 'c1', amount: 400, creditType: 'overpayment', consolidatable: true }]]]),
      payoutsByPlayer: new Map(),
    });
    assert.equal(plan.exceptions[0].creditCreated, 200);
  });

  it('RAISING dues back past what a family sent creates nothing — the stale credit is clawed back', () => {
    const plan = planRosterDuesRun({
      players: roster('p'),
      newScheduleTotal: 1500,
      newDueDates: ['2026-10-10'],
      existingRows: [],
      paymentTotals: new Map([['p', 1200]]),
      creditsByPlayer: new Map([['p', [{ id: 'c1', amount: 400, creditType: 'overpayment', consolidatable: true }]]]),
      payoutsByPlayer: new Map(),
    });
    assert.equal(plan.exceptions[0].creditCreated, 0);
  });

  it('a NON-overpayment credit is never counted toward the automatic one (credits stay credits)', () => {
    const plan = planRosterDuesRun({
      players: roster('p'),
      newScheduleTotal: 800,
      newDueDates: ['2026-10-10'],
      existingRows: [],
      paymentTotals: new Map([['p', 1000]]),
      creditsByPlayer: new Map([['p', [{ id: 'f1', amount: 500, creditType: 'fundraiser' }]]]),
      payoutsByPlayer: new Map(),
    });
    assert.equal(plan.exceptions[0].creditCreated, 200, 'the $500 fundraiser credit is untouched and uncounted');
  });
});
