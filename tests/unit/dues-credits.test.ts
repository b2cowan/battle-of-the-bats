/**
 * The credit half of the money model (lib/dues-credits.ts) — pinned behaviours:
 *
 *  - cash always claims a bill before a credit does (the self-correcting rule);
 *  - last_first eats the schedule from the far end and cascades (mockup §3);
 *  - keep_separate applies nothing except forgiveness;
 *  - forgiveness spends before the family's own money and is outside the identity;
 *  - paying out a credit puts the bills back up (mockup §5);
 *  - and the three-state identity — issued = applied + paidOut + owedBack — holds for every
 *    player under a seeded pseudo-random storm of schedules, payments, credits and payouts.
 *
 * Coverage is built through the REAL payment allocator, never hand-written, so these tests
 * exercise the actual cash-first seam and not a fixture's opinion of it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allocateDuesPayments, type AllocatableInstallment, type AllocatablePayment } from '../../lib/dues-payments';
import {
  applyCreditsToBills,
  creditsTotal,
  totalsByPlayer,
  normalizeCreditApplicationMode,
  sortCreditsForApplication,
  payoutCeiling,
  deriveDuesPosition,
  type ApplicableCredit,
} from '../../lib/dues-credits';

let seq = 0;
function inst(installmentNumber: number, amount: number, paidAt: string | null = null): AllocatableInstallment {
  return { id: `i${installmentNumber}`, installmentNumber, amount, paidAt };
}
function pay(amount: number, receivedDate = '2026-01-01'): AllocatablePayment {
  return { id: `p${++seq}`, amount, receivedDate };
}
function credit(amount: number, over: Partial<ApplicableCredit> = {}): ApplicableCredit {
  return {
    id: over.id ?? `c${++seq}`,
    amount,
    creditType: over.creditType ?? 'fundraiser',
    creditDate: over.creditDate ?? '2026-02-01',
    createdAt: over.createdAt ?? null,
    description: over.description ?? null,
  };
}

/** Riley's schedule from the binding mockup: 4 × $800, #1–#2 paid in cash. */
function rileyCoverage(payments = [pay(800, '2025-09-30'), pay(800, '2025-11-30')]) {
  const installments = [inst(1, 800), inst(2, 800), inst(3, 800), inst(4, 800)];
  return allocateDuesPayments(installments, payments).coverage;
}

describe('creditsTotal / totalsByPlayer', () => {
  it('sums in cents, never floats', () => {
    assert.equal(creditsTotal([{ amount: 0.1 }, { amount: 0.2 }]), 0.3);
  });

  it('groups by player like paymentsTotalByPlayer', () => {
    const m = totalsByPlayer([
      { playerId: 'a', amount: 10.1 },
      { playerId: 'a', amount: 0.2 },
      { playerId: 'b', amount: 5 },
    ]);
    assert.equal(m.get('a'), 10.3);
    assert.equal(m.get('b'), 5);
    assert.equal(m.get('missing'), undefined);
  });
});

describe('normalizeCreditApplicationMode', () => {
  it('passes real modes through and defaults everything else', () => {
    assert.equal(normalizeCreditApplicationMode('next_first'), 'next_first');
    assert.equal(normalizeCreditApplicationMode('keep_separate'), 'keep_separate');
    assert.equal(normalizeCreditApplicationMode('nonsense'), 'last_first');
    assert.equal(normalizeCreditApplicationMode(null), 'last_first');
  });
});

describe('applyCreditsToBills — the mockup walkthroughs', () => {
  it('§1: $500 lands on the LAST bill; #3 keeps asking for $800', () => {
    const pos = applyCreditsToBills({
      coverage: rileyCoverage(),
      credits: [credit(500, { description: 'Fundraiser rebate — Bottle Drive' })],
      mode: 'last_first',
    });
    const [i1, i2, i3, i4] = pos.perInstallment;
    assert.equal(i1.toSend, 0);
    assert.equal(i2.toSend, 0);
    assert.equal(i3.toSend, 800);
    assert.equal(i3.creditApplied, 0);
    assert.equal(i4.creditApplied, 500);
    assert.equal(i4.toSend, 300);
    assert.equal(i4.settled, false);
    assert.equal(i4.sources[0].description, 'Fundraiser rebate — Bottle Drive');
    assert.equal(pos.applied, 500);
    assert.equal(pos.owedBack, 0);
    assert.equal(pos.leftToSend, 1100);
  });

  it('§3: a $900 credit finishes the last bill then cascades to the one before', () => {
    const pos = applyCreditsToBills({
      coverage: rileyCoverage(),
      credits: [credit(900)],
      mode: 'last_first',
    });
    const [, , i3, i4] = pos.perInstallment;
    assert.equal(i4.creditApplied, 800);
    assert.equal(i4.toSend, 0);
    assert.equal(i4.settled, true);
    assert.equal(i3.creditApplied, 100);
    assert.equal(i3.toSend, 700);
    assert.equal(pos.applied, 900);
    assert.equal(pos.leftToSend, 700);
  });

  it('cash claims first: a family fully paid in cash frees the credit to owed-back', () => {
    const pos = applyCreditsToBills({
      coverage: rileyCoverage([pay(3200, '2026-03-01')]),
      credits: [credit(500)],
      mode: 'last_first',
    });
    assert.equal(pos.applied, 0);
    assert.equal(pos.owedBack, 500);
    assert.equal(pos.leftToSend, 0);
    assert.ok(pos.perInstallment.every(i => i.settled));
  });

  it('next_first gives relief to the next bill due instead of the far end', () => {
    const pos = applyCreditsToBills({
      coverage: rileyCoverage(),
      credits: [credit(500)],
      mode: 'next_first',
    });
    const [, , i3, i4] = pos.perInstallment;
    assert.equal(i3.creditApplied, 500);
    assert.equal(i3.toSend, 300);
    assert.equal(i4.creditApplied, 0);
    assert.equal(i4.toSend, 800);
  });

  it('keep_separate: every non-forgiven dollar is owed back from birth', () => {
    const pos = applyCreditsToBills({
      coverage: rileyCoverage(),
      credits: [credit(500)],
      mode: 'keep_separate',
    });
    assert.equal(pos.applied, 0);
    assert.equal(pos.owedBack, 500);
    assert.equal(pos.perInstallment[3].toSend, 800);
  });

  it('forgiveness lowers bills even under keep_separate, and is never owed back', () => {
    const pos = applyCreditsToBills({
      coverage: rileyCoverage(),
      credits: [credit(300, { creditType: 'forgiven' })],
      mode: 'keep_separate',
    });
    assert.equal(pos.forgivenIssued, 300);
    assert.equal(pos.forgivenApplied, 300);
    assert.equal(pos.owedBack, 0);
    // With no application direction chosen (keep_separate), forgiveness relieves the MOST
    // IMMINENT debt first — the bill reminders are actually chasing — not the far end.
    assert.equal(pos.perInstallment[2].toSend, 500);
    assert.equal(pos.perInstallment[3].toSend, 800);
  });

  it('forgiveness spends BEFORE the family\'s own credits, protecting their cash', () => {
    // $150 left on the schedule. Forgiven $200 + fundraiser $100: the forgiveness must cancel
    // the debt so the family\'s earned $100 stays owed back — the other order costs them cash.
    const coverage = allocateDuesPayments(
      [inst(1, 100, '2026-01-05'), inst(2, 150)],
      [pay(100, '2026-01-05')],
    ).coverage;
    const pos = applyCreditsToBills({
      coverage,
      credits: [credit(100, { creditType: 'fundraiser' }), credit(200, { creditType: 'forgiven' })],
      mode: 'last_first',
    });
    assert.equal(pos.forgivenApplied, 150);
    assert.equal(pos.applied, 0);
    assert.equal(pos.owedBack, 100);
    // The forgiveness larger than the debt simply evaporates — nothing owes it to anyone.
    assert.equal(pos.forgivenIssued, 200);
  });

  it('§5: paying out the rebate puts the bill back up to $800', () => {
    const pos = applyCreditsToBills({
      coverage: rileyCoverage(),
      credits: [credit(500)],
      paidOut: 500,
      mode: 'last_first',
    });
    assert.equal(pos.applied, 0);
    assert.equal(pos.paidOut, 500);
    assert.equal(pos.owedBack, 0);
    assert.equal(pos.perInstallment[3].toSend, 800);
  });

  it('a partial payout leaves the remainder covering bills', () => {
    const pos = applyCreditsToBills({
      coverage: rileyCoverage(),
      credits: [credit(500)],
      paidOut: 200,
      mode: 'last_first',
    });
    assert.equal(pos.paidOut, 200);
    assert.equal(pos.applied, 300);
    assert.equal(pos.owedBack, 0);
    assert.equal(pos.perInstallment[3].toSend, 500);
  });

  it('an overpayment credit only exists once everything is covered, so it applies nowhere', () => {
    const pos = applyCreditsToBills({
      coverage: rileyCoverage([pay(3250, '2026-03-01')]),
      credits: [credit(50, { creditType: 'overpayment' })],
      mode: 'last_first',
    });
    assert.equal(pos.applied, 0);
    assert.equal(pos.owedBack, 50);
  });

  it('part-paid and partly-earned compose on one bill', () => {
    // #4 has $200 of cash on it, then $500 of fundraising: "$100 to send of $800".
    const coverage = rileyCoverage([pay(800, '2025-09-30'), pay(800, '2025-11-30'), pay(800, '2026-01-31'), pay(200, '2026-02-15')]);
    const pos = applyCreditsToBills({ coverage, credits: [credit(500)], mode: 'last_first' });
    const i4 = pos.perInstallment[3];
    assert.equal(i4.cashRemaining, 600);
    assert.equal(i4.creditApplied, 500);
    assert.equal(i4.toSend, 100);
  });

  it('credits spend oldest-first and attribution follows', () => {
    const older = credit(300, { id: 'older', creditDate: '2026-01-10', description: 'Bottle Drive' });
    const newer = credit(300, { id: 'newer', creditDate: '2026-03-10', description: 'Cookie Dough' });
    const pos = applyCreditsToBills({
      coverage: rileyCoverage(),
      credits: [newer, older],
      mode: 'last_first',
    });
    const i4 = pos.perInstallment[3];
    assert.deepEqual(i4.sources.map(s => s.creditId), ['older', 'newer']);
    assert.equal(i4.sources[0].amount, 300);
    assert.equal(i4.sources[1].amount, 300);
  });
});

describe('deriveDuesPosition — the assembly seam Pass 2 wires payouts into', () => {
  const schedule = [inst(1, 800), inst(2, 800), inst(3, 800), inst(4, 800)];

  it('paying out a rebate puts the bill back up, end to end', () => {
    const before = deriveDuesPosition({
      installments: schedule,
      payments: [pay(800, '2025-09-30'), pay(800, '2025-11-30')],
      credits: [credit(500)],
      mode: 'last_first',
    });
    assert.equal(before.toSendById.get('i4'), 300);

    const after = deriveDuesPosition({
      installments: schedule,
      payments: [pay(800, '2025-09-30'), pay(800, '2025-11-30')],
      credits: [credit(500)],
      paidOut: 500,
      mode: 'last_first',
    });
    assert.equal(after.toSendById.get('i4'), 800);
    assert.equal(after.position.owedBack, 0);
    assert.equal(after.position.paidOut, 500);
  });

  it('a PARTIAL payout leaves the remainder covering bills', () => {
    const { toSendById, position } = deriveDuesPosition({
      installments: schedule,
      payments: [pay(800, '2025-09-30'), pay(800, '2025-11-30')],
      credits: [credit(500)],
      paidOut: 200,
      mode: 'last_first',
    });
    assert.equal(toSendById.get('i4'), 500);
    assert.equal(position.applied, 300);
    assert.equal(position.paidOut, 200);
    assert.equal(position.owedBack, 0);
  });

  it('the identity still holds once money has gone out', () => {
    const { position } = deriveDuesPosition({
      installments: schedule,
      payments: [pay(3200, '2026-03-01')],
      credits: [credit(500)],
      paidOut: 175,
      mode: 'last_first',
    });
    assert.equal(
      Math.round((position.applied + position.paidOut + position.owedBack) * 100) / 100,
      500,
    );
    assert.equal(position.owedBack, 325);
  });
});

describe('payoutCeiling — what may be handed back right now', () => {
  it('is credits issued minus what already went out', () => {
    assert.equal(
      payoutCeiling([{ amount: 500, creditType: 'fundraiser' }], [{ amount: 200 }]),
      300,
    );
  });

  it('EXCLUDES forgiveness — debt relief is never the family\'s money to be handed', () => {
    // The rule the whole model rests on: paying out a forgiven balance would hand a family
    // cash for a debt the team already cancelled.
    assert.equal(
      payoutCeiling([{ amount: 600, creditType: 'forgiven' }], []),
      0,
    );
    assert.equal(
      payoutCeiling(
        [{ amount: 600, creditType: 'forgiven' }, { amount: 125, creditType: 'fundraiser' }],
        [],
      ),
      125,
    );
  });

  it('never goes negative when payouts somehow exceed credits', () => {
    assert.equal(payoutCeiling([{ amount: 100, creditType: 'other' }], [{ amount: 250 }]), 0);
  });

  it('sums in cents', () => {
    assert.equal(
      payoutCeiling([{ amount: 0.1, creditType: 'other' }, { amount: 0.2, creditType: 'other' }], []),
      0.3,
    );
  });

  it('is the ONE definition the refund sheet sums — per player, then totalled', () => {
    // The /review 2026-08-14 Critical: the season-end sheet clamped each ROW at zero but built
    // its TOTAL from unclamped figures, so one family's over-payout silently cancelled another
    // family's real credit inside the shared pool. Summing the per-player definition is the fix,
    // and this pins the property that makes it safe: the total can never be less than any part.
    const world = [
      { credits: [{ amount: 500, creditType: 'fundraiser' }], payouts: [{ amount: 500 }] }, // fully paid out
      { credits: [{ amount: 500, creditType: 'fundraiser' }], payouts: [] },                // still owed
      { credits: [{ amount: 600, creditType: 'forgiven' }], payouts: [] },                   // never owed
      { credits: [], payouts: [{ amount: 500 }] },                                            // credit deleted under a payout
    ];
    const perPlayer = world.map(w => payoutCeiling(w.credits, w.payouts));
    assert.deepEqual(perPlayer, [0, 500, 0, 0]);
    const total = perPlayer.reduce((s, v) => s + v, 0);
    assert.equal(total, 500, 'only the one genuinely-unsettled credit counts toward the pool');
  });
});

describe('sortCreditsForApplication', () => {
  it('forgiveness first, then by date, createdAt, id', () => {
    const a = credit(1, { id: 'a', creditDate: '2026-02-01' });
    const b = credit(1, { id: 'b', creditDate: '2026-01-01' });
    const f = credit(1, { id: 'f', creditDate: '2026-12-01', creditType: 'forgiven' });
    assert.deepEqual(sortCreditsForApplication([a, b, f]).map(c => c.id), ['f', 'b', 'a']);
  });
});

describe('the three-state identity — issued = applied + paidOut + owedBack', () => {
  // Deterministic LCG so the storm is reproducible; Math.random in a test is a flake generator.
  let state = 42;
  const rnd = () => (state = (state * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const cents = (n: number) => Math.round(n * 100) / 100;

  it('holds for every player under 500 randomised scenarios, in every mode', () => {
    for (let run = 0; run < 500; run++) {
      const nInst = 1 + Math.floor(rnd() * 6);
      const installments = Array.from({ length: nInst }, (_, i) =>
        inst(i + 1, cents(50 + rnd() * 400)));
      const total = installments.reduce((s, i) => s + i.amount, 0);
      const payments = Array.from({ length: Math.floor(rnd() * 4) }, () =>
        pay(cents(rnd() * total * 0.6), `2026-0${1 + Math.floor(rnd() * 8)}-10`));
      const credits = Array.from({ length: Math.floor(rnd() * 4) }, () =>
        credit(cents(rnd() * total * 0.5), {
          creditType: (['fundraiser', 'contribution', 'overpayment', 'other', 'reimbursement', 'forgiven'] as const)[Math.floor(rnd() * 6)],
          creditDate: `2026-0${1 + Math.floor(rnd() * 8)}-15`,
        }));
      const issued = creditsTotal(credits.filter(c => c.creditType !== 'forgiven'));
      const paidOut = cents(rnd() * issued);
      const mode = (['last_first', 'next_first', 'keep_separate'] as const)[Math.floor(rnd() * 3)];

      const coverage = allocateDuesPayments(installments, payments).coverage;
      const pos = applyCreditsToBills({ coverage, credits, paidOut, mode });

      assert.equal(
        cents(pos.applied + pos.paidOut + pos.owedBack),
        cents(issued),
        `identity broke on run ${run} (mode ${mode}): ${pos.applied} + ${pos.paidOut} + ${pos.owedBack} != ${issued}`,
      );
      // toSend can never be negative, and never exceeds the cash remainder.
      for (const i of pos.perInstallment) {
        assert.ok(i.toSend >= 0);
        assert.ok(i.toSend <= i.cashRemaining + 1e-9);
      }
      // leftToSend re-adds from the rows exactly.
      assert.equal(
        cents(pos.perInstallment.reduce((s, i) => s + i.toSend, 0)),
        cents(pos.leftToSend),
      );
    }
  });
});
