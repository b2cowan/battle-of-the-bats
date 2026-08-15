/**
 * The By-installment view's derivations (lib/dues-installment-view.ts).
 *
 * What these pin, beyond arithmetic:
 *  - "Due next" is past-due remainders + the NEXT upcoming remainder only — never the season
 *    balance, and never reduced by credits (credits live against rollingBalance).
 *  - An installment due TODAY is "next", not past due — matching isInstallmentOverdue's
 *    strictly-before rule, so this figure and the ⚠ flags can never disagree about one row.
 *  - Columns join on installment NUMBER and survive ragged, hand-edited schedules.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildInstallmentColumns,
  dueNextForPlayer,
  daysUntil,
  type ViewableInstallment,
} from '../../lib/dues-installment-view';
import { allocateDuesPayments } from '../../lib/dues-payments';

const TODAY = '2026-08-14';

let seq = 0;
function inst(installmentNumber: number, amount: number, dueDate: string, paidAt: string | null = null): ViewableInstallment {
  return { id: `i${++seq}`, installmentNumber, amount, dueDate, paidAt };
}

/** Coverage the way the product computes it — through the real allocator, never hand-built. */
function covered(installments: ViewableInstallment[], paidDollars: number) {
  return allocateDuesPayments(
    installments,
    paidDollars > 0 ? [{ id: 'p1', amount: paidDollars, receivedDate: '2026-06-01' }] : [],
  ).coverage;
}

describe('dueNextForPlayer', () => {
  const schedule = [inst(1, 200, '2026-06-01'), inst(2, 200, '2026-07-15'), inst(3, 200, '2026-09-01')];

  it('on-track player owes exactly the next upcoming remainder', () => {
    const d = dueNextForPlayer(schedule, covered(schedule, 400), TODAY)!;
    assert.deepEqual(d, { amount: 200, pastDue: 0, nextAmount: 200, nextDueDate: '2026-09-01', allSettled: false });
  });

  it('a part-paid past-due installment contributes its REMAINDER, plus the next one', () => {
    const d = dueNextForPlayer(schedule, covered(schedule, 320), TODAY)!;
    assert.equal(d.pastDue, 80);
    assert.equal(d.nextAmount, 200);
    assert.equal(d.amount, 280);
  });

  it('multiple past-due installments all count; only ONE upcoming does', () => {
    const d = dueNextForPlayer(schedule, covered(schedule, 0), TODAY)!;
    assert.equal(d.pastDue, 400);
    assert.equal(d.nextAmount, 200);
    assert.equal(d.nextDueDate, '2026-09-01');
    assert.equal(d.amount, 600);
  });

  it('an installment due TODAY is next, not past due', () => {
    const s = [inst(1, 150, TODAY)];
    const d = dueNextForPlayer(s, covered(s, 0), TODAY)!;
    assert.equal(d.pastDue, 0);
    assert.equal(d.nextAmount, 150);
    assert.equal(d.nextDueDate, TODAY);
  });

  it('two installments due the SAME day are one obligation — both count as next', () => {
    const s = [inst(1, 150, '2026-09-01'), inst(2, 250, '2026-09-01'), inst(3, 200, '2026-10-01')];
    const d = dueNextForPlayer(s, covered(s, 0), TODAY)!;
    assert.equal(d.nextAmount, 400);
    assert.equal(d.nextDueDate, '2026-09-01');
    assert.equal(d.amount, 400);
  });

  it('fully covered schedule reads settled with nothing to chase', () => {
    const d = dueNextForPlayer(schedule, covered(schedule, 600), TODAY)!;
    assert.deepEqual(d, { amount: 0, pastDue: 0, nextAmount: 0, nextDueDate: null, allSettled: true });
  });

  it('no installments means null — nothing can be due', () => {
    assert.equal(dueNextForPlayer([], [], TODAY), null);
  });

  it('cents survive: $66.66 + $66.66 + $66.68 against $100 paid', () => {
    const s = [inst(1, 66.66, '2026-06-01'), inst(2, 66.66, '2026-07-15'), inst(3, 66.68, '2026-09-01')];
    const d = dueNextForPlayer(s, covered(s, 100), TODAY)!;
    assert.equal(d.pastDue, 33.32);
    assert.equal(d.nextAmount, 66.68);
    assert.equal(d.amount, 100);
  });
});

describe('buildInstallmentColumns', () => {
  it('uniform team: one column per number carrying the shared date and team totals', () => {
    const a = [inst(1, 200, '2026-06-01'), inst(2, 200, '2026-09-01')];
    const b = [inst(1, 200, '2026-06-01'), inst(2, 200, '2026-09-01')];
    const cols = buildInstallmentColumns(
      [
        { installments: a, coverage: covered(a, 400) }, // fully paid
        { installments: b, coverage: covered(b, 120) }, // part-paid on #1
      ],
      TODAY,
    );
    assert.equal(cols.length, 2);
    assert.deepEqual(cols[0], {
      installmentNumber: 1, commonDueDate: '2026-06-01', dueDateVaries: false,
      commonAmount: 200, amountVaries: false,
      assessed: 400, collected: 320, remaining: 80, creditApplied: 0, playerCount: 2, paidCount: 1, behindCount: 1,
    });
    // Player one's $400 covers BOTH their installments — the future column already holds $200.
    assert.deepEqual(cols[1], {
      installmentNumber: 2, commonDueDate: '2026-09-01', dueDateVaries: false,
      commonAmount: 200, amountVaries: false,
      assessed: 400, collected: 200, remaining: 200, creditApplied: 0, playerCount: 2, paidCount: 1, behindCount: 0,
    });
  });

  /**
   * ⚠ The heading speaks for the team; a hand-edited schedule must speak for itself.
   *
   * Since the grid stopped printing the amount in every cell (owner ruling 2026-08-14) the COLUMN
   * HEADING carries it — which is only safe while the column can tell the difference between "the
   * whole team pays $200" and "most of them do". Get this wrong and a player on a reduced
   * instalment silently reads as owing the team's figure.
   */
  it('the column knows the team amount, and knows when there ISN\'T one', () => {
    const a = [inst(1, 200, '2026-06-01')];
    const b = [inst(1, 200, '2026-06-01')];
    const c = [inst(1, 120, '2026-06-01')]; // a reduced schedule
    const uniform = buildInstallmentColumns(
      [{ installments: a, coverage: [] }, { installments: b, coverage: [] }],
      TODAY,
    );
    assert.equal(uniform[0].commonAmount, 200);
    assert.equal(uniform[0].amountVaries, false);

    const mixed = buildInstallmentColumns(
      [{ installments: a, coverage: [] }, { installments: b, coverage: [] }, { installments: c, coverage: [] }],
      TODAY,
    );
    // The MODE, not the mean and not the first row: two players share $200, one does not.
    assert.equal(mixed[0].commonAmount, 200);
    assert.equal(mixed[0].amountVaries, true);
  });

  it('ties break to the LARGEST amount — a heading never understates the ask', () => {
    const a = [inst(1, 150, '2026-06-01')];
    const b = [inst(1, 250, '2026-06-01')];
    const cols = buildInstallmentColumns(
      [{ installments: a, coverage: [] }, { installments: b, coverage: [] }],
      TODAY,
    );
    assert.equal(cols[0].commonAmount, 250);
    assert.equal(cols[0].amountVaries, true);
  });

  it('credits meet the bills: net remainders drive the column, and paid stays cash', () => {
    // A $200 bill with $150 of fundraising applied: remaining is the NET $50 (the reminder
    // figure), creditApplied surfaces the earning, and paidCount does NOT move — Paid is cash.
    const s = [inst(1, 200, '2026-06-01')];
    const cols = buildInstallmentColumns(
      [{
        installments: s.map(i => ({ ...i, remainingAmount: 50, creditApplied: 150 })),
        coverage: covered(s, 0),
      }],
      TODAY,
    );
    assert.deepEqual(
      [cols[0].remaining, cols[0].creditApplied, cols[0].collected, cols[0].paidCount, cols[0].behindCount],
      [50, 150, 0, 0, 1],
    );
    // Fully covered by fundraising: nothing remains, nobody is behind, still zero paidCount.
    const cols2 = buildInstallmentColumns(
      [{
        installments: s.map(i => ({ ...i, remainingAmount: 0, creditApplied: 200 })),
        coverage: covered(s, 0),
      }],
      TODAY,
    );
    assert.deepEqual(
      [cols2[0].remaining, cols2[0].creditApplied, cols2[0].paidCount, cols2[0].behindCount],
      [0, 200, 0, 0],
    );
  });

  it('dueNext reads the net remainder when the installment carries one', () => {
    const s = [inst(1, 200, '2026-06-01'), inst(2, 200, '2026-09-01')];
    const d = dueNextForPlayer(
      s.map((i, idx) => ({ ...i, remainingAmount: idx === 0 ? 200 : 50, creditApplied: idx === 0 ? 0 : 150 })),
      covered(s, 0),
      TODAY,
    )!;
    // #1 past due at its full $200; #2 upcoming asks only the net $50.
    assert.deepEqual([d.pastDue, d.nextAmount, d.amount], [200, 50, 250]);
    // A schedule fully settled by credits reads allSettled — reminders and chase cards stop.
    const settled = dueNextForPlayer(
      s.map(i => ({ ...i, remainingAmount: 0, creditApplied: 200 })),
      covered(s, 0),
      TODAY,
    )!;
    assert.equal(settled.allSettled, true);
    assert.equal(settled.amount, 0);
  });

  it('ragged schedules: columns run to the widest schedule, playerCount tells the truth', () => {
    const short = [inst(1, 300, '2026-06-01')];
    const long = [inst(1, 100, '2026-06-01'), inst(2, 100, '2026-07-01'), inst(3, 100, '2026-08-01')];
    const cols = buildInstallmentColumns(
      [
        { installments: short, coverage: covered(short, 0) },
        { installments: long, coverage: covered(long, 0) },
      ],
      TODAY,
    );
    assert.deepEqual(cols.map(c => [c.installmentNumber, c.playerCount, c.assessed]), [[1, 2, 400], [2, 1, 100], [3, 1, 100]]);
  });

  it('hand-edited date: the majority date wins the header and the varies flag raises', () => {
    const usual1 = [inst(1, 100, '2026-09-01')];
    const usual2 = [inst(1, 100, '2026-09-01')];
    const edited = [inst(1, 100, '2026-09-15')];
    const cols = buildInstallmentColumns(
      [usual1, usual2, edited].map(i => ({ installments: i, coverage: covered(i, 0) })),
      TODAY,
    );
    assert.equal(cols[0].commonDueDate, '2026-09-01');
    assert.equal(cols[0].dueDateVaries, true);
  });

  it('a date tie breaks to the earliest — a deterministic header, never an arbitrary one', () => {
    const a = [inst(1, 100, '2026-09-15')];
    const b = [inst(1, 100, '2026-09-01')];
    const cols = buildInstallmentColumns(
      [a, b].map(i => ({ installments: i, coverage: covered(i, 0) })),
      TODAY,
    );
    assert.equal(cols[0].commonDueDate, '2026-09-01');
  });

  it('behind counts by each player\'s OWN date, not the column header', () => {
    // Header will read Sep 1 (majority, future) — but the edited player was due Jul 1 and is behind.
    const usual1 = [inst(1, 100, '2026-09-01')];
    const usual2 = [inst(1, 100, '2026-09-01')];
    const edited = [inst(1, 100, '2026-07-01')];
    const cols = buildInstallmentColumns(
      [usual1, usual2, edited].map(i => ({ installments: i, coverage: covered(i, 0) })),
      TODAY,
    );
    assert.equal(cols[0].commonDueDate, '2026-09-01');
    assert.equal(cols[0].behindCount, 1);
  });

  it('players without schedules contribute nothing and columns still build', () => {
    const s = [inst(1, 250, '2026-09-01')];
    const cols = buildInstallmentColumns(
      [{ installments: [], coverage: [] }, { installments: s, coverage: covered(s, 250) }],
      TODAY,
    );
    assert.equal(cols.length, 1);
    assert.deepEqual([cols[0].playerCount, cols[0].paidCount, cols[0].remaining], [1, 1, 0]);
  });

  it('no schedules at all: no columns, not a crash', () => {
    assert.deepEqual(buildInstallmentColumns([{ installments: [], coverage: [] }], TODAY), []);
  });
});

describe('daysUntil', () => {
  it('counts forward, backward, and zero', () => {
    assert.equal(daysUntil('2026-09-01', TODAY), 18);
    assert.equal(daysUntil(TODAY, TODAY), 0);
    assert.equal(daysUntil('2026-08-13', TODAY), -1);
  });
  it('crosses a month boundary without drama', () => {
    assert.equal(daysUntil('2026-09-14', TODAY), 31);
  });
});
