/**
 * WHAT A FAMILY CONTRIBUTED (lib/coach-dues-actual.ts) — the Season spending reading of dues.
 *
 * The arithmetic is a sum, so these tests are not really about the addition. They pin the rulings a
 * later tidy-up would reverse without any figure looking wrong, and they hold the two derivations
 * equal on every case:
 *
 *   1. **A credit is revenue only while it is STILL STANDING** (R3/R4). Money handed back stops
 *      counting, whichever pot it came out of.
 *   2. **And only if real money stands behind it** (R6/R7). A kind that claims money is an
 *      assertion; the record that made it is the proof. A write-off is not revenue — a coach who
 *      forgives part of a bill did not receive anything, and the season really does collect less.
 *   3. **The overpayment credit is the family's OWN money** and must not be counted as someone
 *      else's — but it is exactly what turns the capped paid figure back into what the family sent,
 *      which is why it is added and not skipped.
 *   4. **`actual` and the BALANCE are two ways to one number.** Every case below asserts
 *      `actual === dues − balance − excluded`. The balance is what coaches have chased
 *      families on; §148 shipped a defect for one round by pairing a narrowed column with a balance
 *      built from a different pair, and only the rendered screen caught it. Here it cannot happen
 *      quietly.
 *
 * ⚠ THE FIGURES ARE THE UAT FIXTURE'S OWN, read from the records 2026-09-07, so a failure here is
 * comparable against the rendered report rather than against an invented team.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  duesActual, seasonDuesActual, seasonDuesParts, creditIsRevenue, allocatePayouts, buildFamilyDuesInputs,
  settledPerCredit,
  type FamilyDuesActualInput, type DuesCreditInput,
} from '../../lib/coach-dues-actual.ts';
/* ⚠ THE SAVE'S CEILING, IMPORTED RATHER THAN RESTATED. The whole defect this block guards was two
   modules disagreeing about one figure; a test that hand-rolls the ceiling would agree with
   whichever side it copied and prove nothing. */
import { payoutCeiling } from '../../lib/dues-credits.ts';

/** A credit, with the two flags spelled out at every call site so no case reads as a default. */
const credit = (
  kind: DuesCreditInput['kind'], amount: number,
  opts: { traced?: boolean; handedBack?: number } = {},
): DuesCreditInput => ({
  kind, amount,
  traced: opts.traced ?? true,
  handedBack: opts.handedBack ?? 0,
});

/**
 * The identity that makes this module trustworthy, asserted on EVERY case rather than in one test
 * of its own — a gate that only one case has to pass is a gate one edit away from being useless.
 */
function assertTiesToBalance(input: FamilyDuesActualInput, label: string) {
  const r = duesActual(input);
  assert.equal(
    Math.round(r.actual * 100),
    Math.round((input.dues - r.balance - r.excluded) * 100),
    `${label}: actual must equal dues − balance − excluded`,
  );
  // ⚠ A family can never be shown as having contributed less than the cash they sent and kept.
  assert.ok(r.actual >= 0, `${label}: actual must never go negative`);
  /* ⚠⚠ THE DOOR'S LINES MUST ADD UP TO THE FIGURE THAT OPENED IT. The panel behind the dues figure
     shows exactly these three; a coach who opens it and finds they do not reach the number is worse
     off than one who was never offered the door. Asserted on EVERY case, not once. */
  assert.equal(
    Math.round((r.parts.cashKept + r.parts.familyPaidCosts + r.parts.fundraisingCredited) * 100),
    Math.round(r.actual * 100),
    `${label}: the three parts must sum to actual`,
  );
  return r;
}

/* ── The twelve families of the UAT fixture ─────────────────────────────────────────────────── */

describe('duesActual — the UAT fixture, family by family', () => {
  it('Kai: billed $970.83, a $200 rebate and a $700 bill their family paid — contributed $900.00', () => {
    const r = assertTiesToBalance({
      dues: 970.83, cappedPaid: 0,
      credits: [credit('fundraiser', 200), credit('reimbursement', 700)],
    }, 'Kai');
    assert.equal(r.actual, 900);
    // The row the whole project started from: $70.83 short, not $970.83.
    assert.equal(r.balance, 70.83);
  });

  it('Avery: sent $1,250.00 against a $700.00 bill — the overpayment credit restores the gross', () => {
    const r = assertTiesToBalance({
      dues: 700, cappedPaid: 700,
      credits: [
        credit('fundraiser', 198.15),
        credit('reimbursement', 380),
        credit('overpayment', 550),
      ],
    }, 'Avery');
    // $1,250.00 sent + $578.15 from others.
    assert.equal(r.actual, 1828.15);
    assert.equal(r.balance, -1128.15);
  });

  it('Casey: sent $1,200.00 on a $900.00 bill and had $300.00 back — contributed $900.00 net', () => {
    const r = assertTiesToBalance({
      dues: 900, cappedPaid: 900,
      credits: [
        credit('fundraiser', 37.5),
        credit('overpayment', 300, { handedBack: 300 }),
      ],
    }, 'Casey');
    // R4, in the owner's words: "their net contribution to the team."
    assert.equal(r.actual, 937.5);
    assert.equal(r.balance, -37.5);
  });

  it('Logan: a $300.00 rebate with $200.00 taken in cash — only the $100.00 still standing counts', () => {
    const r = assertTiesToBalance({
      dues: 970.83, cappedPaid: 0,
      credits: [credit('fundraiser', 300, { handedBack: 200 })],
    }, 'Logan');
    assert.equal(r.actual, 100);
    assert.equal(r.balance, 870.83);
  });

  it('Emerson: nothing paid, nothing credited — contributed nothing, owes the lot', () => {
    const r = assertTiesToBalance({ dues: 970.83, cappedPaid: 0, credits: [] }, 'Emerson');
    assert.equal(r.actual, 0);
    assert.equal(r.balance, 970.83);
  });
});

/* ── The rulings ───────────────────────────────────────────────────────────────────────────── */

describe('a credit is revenue only while it is standing', () => {
  it('a rebate handed back in full counts for nothing', () => {
    const r = assertTiesToBalance({
      dues: 500, cappedPaid: 0,
      credits: [credit('fundraiser', 150, { handedBack: 150 })],
    }, 'fully refunded');
    assert.equal(r.actual, 0);
    assert.equal(r.balance, 500);
  });

  it('a payout larger than its credit cannot push the figure negative', () => {
    const r = assertTiesToBalance({
      dues: 500, cappedPaid: 0,
      credits: [credit('fundraiser', 100, { handedBack: 175 })],
    }, 'over-refunded');
    assert.equal(r.actual, 0);
    assert.equal(r.balance, 500);
  });
});

describe('a write-off is not revenue (R7 consequence)', () => {
  it('forgiveness reduces the bill and contributes nothing — the season really does collect less', () => {
    const r = assertTiesToBalance({
      dues: 970.83, cappedPaid: 0,
      credits: [credit('forgiven', 150)],
    }, 'forgiven');
    assert.equal(r.actual, 0);
    assert.equal(r.writeOffs, 150);
    // ⚠ The balance still falls — the family owes less. The two screens differ BY EXACTLY the
    //   write-off, which is the qualification on the twelve-of-twelve gate.
    assert.equal(r.balance, 820.83);
  });

  it('an `other` adjustment behaves the same way', () => {
    const r = assertTiesToBalance({
      dues: 400, cappedPaid: 0, credits: [credit('other', 75)],
    }, 'other');
    assert.equal(r.actual, 0);
    assert.equal(r.writeOffs, 75);
  });

  it('a write-off already handed back is excluded ONCE, not twice', () => {
    // Both the payout and the write-off exclusion reach for the same dollars; only standing
    // dollars may be excluded, or the figure is reduced twice by one event.
    const r = assertTiesToBalance({
      dues: 400, cappedPaid: 0,
      credits: [credit('other', 75, { handedBack: 75 })],
    }, 'refunded write-off');
    assert.equal(r.actual, 0);
    assert.equal(r.excluded, 0);
    assert.equal(r.balance, 400);
  });
});

describe('an untraced credit claims money that may not exist (R6/R7)', () => {
  it('a hand-typed fundraiser credit reduces the bill but is not revenue', () => {
    // Blake's real $150.00 on the fixture — the only hand-typed fundraiser credit on either database.
    const r = assertTiesToBalance({
      dues: 970.83, cappedPaid: 0,
      credits: [credit('fundraiser', 150, { traced: false })],
    }, 'hand-typed');
    assert.equal(r.actual, 0);
    assert.equal(r.untraced, 150);
    assert.equal(r.balance, 820.83);
  });

  it('the same amount, traced to a drive, IS revenue', () => {
    const r = assertTiesToBalance({
      dues: 970.83, cappedPaid: 0,
      credits: [credit('fundraiser', 150, { traced: true })],
    }, 'traced');
    assert.equal(r.actual, 150);
    assert.equal(r.untraced, 0);
    assert.equal(r.balance, 820.83);
  });

  it('creditIsRevenue needs BOTH halves — the kind and the record', () => {
    assert.equal(creditIsRevenue({ kind: 'reimbursement', traced: true }), true);
    assert.equal(creditIsRevenue({ kind: 'reimbursement', traced: false }), false);
    assert.equal(creditIsRevenue({ kind: 'forgiven', traced: true }), false);
    // ⚠ An overpayment is the family's OWN money, never "from someone else".
    assert.equal(creditIsRevenue({ kind: 'overpayment', traced: true }), false);
  });
});

describe('a payback lands on the family\'s OWN money first', () => {
  /* ⚠⚠ THIS WAS A REAL DEFECT FOR ONE RUN, caught on the live fixture rather than here. The first
     cut walked the credits oldest-first — but the shipped dues screen assumes the opposite and says
     so at the line, because the case that occurs is an overpayment auto-converted to a credit and
     later handed back. Casey's rebate is dated 2026-08-20 and their overpayment 2026-09-01, so
     oldest-first ate the rebate. The TOTAL was right either way; the panel would have told a coach
     $37.50 of their cash was fundraising while the dues screen told them the reverse. */
  it('Casey: the $300.00 returned comes off their overpayment, not their older rebate', () => {
    const credits = allocatePayouts([
      { kind: 'fundraiser', amount: 37.5, traced: true },   // older
      { kind: 'overpayment', amount: 300, traced: false },  // newer, but their own money
    ], 300);
    assert.equal(credits[0].handedBack, 0, 'the rebate must be untouched');
    assert.equal(credits[1].handedBack, 300, 'the overpayment absorbs the refund');

    const r = duesActual({ dues: 900, cappedPaid: 900, credits });
    assert.equal(r.actual, 937.5);
    assert.equal(r.parts.cashKept, 900);              // not 937.50
    assert.equal(r.parts.fundraisingCredited, 37.5);  // not 0
  });

  it('a refund larger than their own money spills onto the rest, oldest first', () => {
    const credits = allocatePayouts([
      { kind: 'fundraiser', amount: 100, traced: true },
      { kind: 'reimbursement', amount: 80, traced: true },
      { kind: 'overpayment', amount: 50, traced: false },
    ], 130);
    assert.equal(credits[2].handedBack, 50);  // own money first
    assert.equal(credits[0].handedBack, 80);  // then the oldest of the rest
    assert.equal(credits[1].handedBack, 0);
  });

  it('never hands back more than a credit holds', () => {
    const credits = allocatePayouts([{ kind: 'fundraiser', amount: 40, traced: true }], 999);
    assert.equal(credits[0].handedBack, 40);
  });
});

describe('a recorded link beats the assumption (mig 281)', () => {
  const family = (credits: Parameters<typeof buildFamilyDuesInputs>[0]['credits']) =>
    buildFamilyDuesInputs({
      schedules: [{ playerId: 'p', total: 1000 }],
      payments: [], payouts: [{ playerId: 'p', amount: 100 }],
      credits,
    }).get('p')!;

  it('⚠ a credit that SAYS what was paid back is not re-guessed', () => {
    /* Casey's shape, but with the payback recorded. Own-money-first would take the $100 off the
       overpayment; the record says it came off the rebate, and the record wins. */
    const f = family([
      { playerId: 'p', kind: 'fundraiser', amount: 150, traced: true, paidBack: 100 },
      { playerId: 'p', kind: 'overpayment', amount: 300, traced: false },
    ]);
    assert.equal(f.credits[0].handedBack, 100, 'the rebate carries what the record says');
    assert.equal(f.credits[1].handedBack, 0, 'the overpayment is untouched');
  });

  it('⚠⚠ the same dollars are not taken twice — only UNNAMED payback money is assumed', () => {
    /* The family-level payout total is $100 and a credit already accounts for all of it. Handing
       the whole $100 to the assumption as well would settle $200 of credits against $100 of cash. */
    const f = family([
      { playerId: 'p', kind: 'fundraiser', amount: 150, traced: true, paidBack: 100 },
      { playerId: 'p', kind: 'reimbursement', amount: 80, traced: true },
    ]);
    assert.equal(f.credits[0].handedBack, 100);
    assert.equal(f.credits[1].handedBack, 0, 'nothing is left for the assumption to place');
  });

  it('a legacy payout with nothing recorded still falls to the assumption', () => {
    const f = family([
      { playerId: 'p', kind: 'fundraiser', amount: 150, traced: true },
      { playerId: 'p', kind: 'overpayment', amount: 300, traced: false },
    ]);
    // Own money first — the shipped dues screen's rule.
    assert.equal(f.credits[0].handedBack, 0);
    assert.equal(f.credits[1].handedBack, 100);
  });

  it('a mix: what the record does not explain is placed by the assumption', () => {
    const f = buildFamilyDuesInputs({
      schedules: [{ playerId: 'p', total: 1000 }],
      payments: [], payouts: [{ playerId: 'p', amount: 250 }],
      credits: [
        { playerId: 'p', kind: 'fundraiser', amount: 150, traced: true, paidBack: 100 },
        { playerId: 'p', kind: 'overpayment', amount: 300, traced: false },
      ],
    }).get('p')!;
    assert.equal(f.credits[0].handedBack, 100, 'the recorded part');
    assert.equal(f.credits[1].handedBack, 150, 'the remaining $150 the record does not explain');
  });

  it('⚠ the credits come back in the caller’s order, not the allocator’s', () => {
    // The allocator walks own-money first; the per-kind figures behind the dues figure are summed
    // off these rows, and every other reader is promised oldest-first.
    const f = family([
      { playerId: 'p', kind: 'fundraiser', amount: 150, traced: true },
      { playerId: 'p', kind: 'overpayment', amount: 300, traced: false },
    ]);
    assert.equal(f.credits[0].kind, 'fundraiser');
    assert.equal(f.credits[1].kind, 'overpayment');
  });
});

describe('review findings, 2026-09-07 — the two ways the door stopped adding up', () => {
  it('⚠⚠ a recorded payback larger than its own credit is CLAMPED, or parts stop tying to actual', () => {
    /* FOUND BY REVIEW, not by these tests. `duesActual` sums the panel's three parts from PER-CREDIT
       standing amounts but derives `actual` from a FAMILY-level clamp — they agree only while no
       single credit has more handed back than it holds. `allocatePayouts` guarantees that; the
       recorded-fact path took `paidBack` straight through and bypassed it. The panel then reported
       $110.00 behind a figure of $80.00.
       ⚠ Reachable without a bug elsewhere: nothing caps the cumulative linked amount per credit,
       and a credit can be edited down after a payback already pointed at it. */
    const f = buildFamilyDuesInputs({
      schedules: [{ playerId: 'p', total: 100 }],
      payments: [{ playerId: 'p', amount: 50 }],
      payouts: [],
      credits: [
        { playerId: 'p', kind: 'fundraiser', amount: 20, traced: true, paidBack: 50 },
        { playerId: 'p', kind: 'fundraiser', amount: 60, traced: true },
      ],
    }).get('p')!;
    assert.equal(f.credits[0].handedBack, 20, 'clamped to the credit it points at');
    const r = assertTiesToBalance(f, 'over-recorded payback');
    assert.equal(r.actual, 110);
  });

  it('⚠ the same credit object twice keeps its allocation — pairing is positional, not by identity', () => {
    /* A Map keyed on the credit object collapsed two occurrences of one reference and kept only the
       last write, so a real $40.00 payout vanished from the model entirely. Today's only caller
       builds fresh objects and could not fire it — but a pure function must not depend on its
       caller's allocation habits. */
    const dup = { playerId: 'p', kind: 'fundraiser' as const, amount: 50, traced: true };
    const f = buildFamilyDuesInputs({
      schedules: [{ playerId: 'p', total: 200 }],
      payments: [], payouts: [{ playerId: 'p', amount: 40 }],
      credits: [dup, { playerId: 'p', kind: 'reimbursement', amount: 30, traced: true }, dup],
    }).get('p')!;
    assert.equal(
      f.credits.reduce((s, c) => s + c.handedBack, 0), 40,
      'the payout must survive the duplicate reference',
    );
  });
});

describe('the season total', () => {
  it('is the sum of the families, never a second derivation', () => {
    const families: FamilyDuesActualInput[] = [
      { dues: 970.83, cappedPaid: 0, credits: [credit('fundraiser', 200), credit('reimbursement', 700)] },
      { dues: 700, cappedPaid: 700, credits: [credit('fundraiser', 198.15), credit('reimbursement', 380), credit('overpayment', 550)] },
      { dues: 900, cappedPaid: 900, credits: [credit('fundraiser', 37.5), credit('overpayment', 300, { handedBack: 300 })] },
    ];
    // 900.00 + 1,828.15 + 937.50
    assert.equal(seasonDuesActual(families), 3665.65);
  });

  it('adds in cents, so a season of awkward thirds does not drift', () => {
    const third = { dues: 970.83, cappedPaid: 0, credits: [credit('fundraiser', 323.61)] };
    assert.equal(seasonDuesActual([third, third, third]), 970.83);
  });

  it('breaks into the three lines the door shows, and they reach the figure', () => {
    /* The UAT fixture's own shape, condensed to the families that carry each kind — the figures a
       coach will actually read behind $5,007.63 on the Statement. */
    const families: FamilyDuesActualInput[] = [
      // Avery: sent $1,250.00 on a $700.00 bill, $380.00 owed back, $198.15 raised.
      { dues: 700, cappedPaid: 700, credits: [credit('overpayment', 550), credit('reimbursement', 380), credit('fundraiser', 198.15)] },
      // Casey: sent $1,200.00 on $900.00 and had the $300.00 excess returned.
      { dues: 900, cappedPaid: 900, credits: [credit('overpayment', 300, { handedBack: 300 }), credit('fundraiser', 37.5)] },
      // Kai: paid a $700.00 team bill, $200.00 from a drive, no cash.
      { dues: 970.83, cappedPaid: 0, credits: [credit('reimbursement', 700), credit('fundraiser', 200)] },
    ];
    const p = seasonDuesParts(families);
    assert.equal(p.cashKept, 2150);            // $700 + $900 capped, plus Avery's $550 still held
    assert.equal(p.familyPaidCosts, 1080);     // $380 + $700
    assert.equal(p.fundraisingCredited, 435.65); // $198.15 + $37.50 + $200
    assert.equal(p.actual, 3665.65);
    assert.equal(p.cashKept + p.familyPaidCosts + p.fundraisingCredited, p.actual);
  });

  it('money handed back is in none of the three lines, and the total falls with it', () => {
    const before = seasonDuesParts([{ dues: 500, cappedPaid: 0, credits: [credit('fundraiser', 150)] }]);
    const after = seasonDuesParts([{ dues: 500, cappedPaid: 0, credits: [credit('fundraiser', 150, { handedBack: 150 })] }]);
    assert.equal(before.fundraisingCredited, 150);
    assert.equal(after.fundraisingCredited, 0);
    assert.equal(after.actual, 0);
  });
});

/**
 * WHAT A TICK-LIST MAY OFFER (`settledPerCredit`) — the Pay out sheet's half of the payback rule.
 *
 * ⚠⚠ ONE INVARIANT RULES THIS WHOLE BLOCK: **the standing amounts this hands the sheet must never
 * add up to more than the save's ceiling** (`payoutCeiling` — payable credits minus every payout).
 * The two are computed in different modules from different inputs, and when they disagree the
 * coach meets a button that refuses every time it is pressed. So every case below asserts the
 * invariant as well as the figure, and `assertOffersFitCeiling` is deliberately the last line of
 * each: a case that pins a number but not the invariant is how the first cut passed review.
 *
 * ⚠ THE SHAPE IS THE ONE THAT SHIPPED BROKEN (found on the UAT fixture 2026-09-09). Logan's family:
 * a $300.00 sponsorship share, one $200.00 payback recorded before mig 281 that says nothing about
 * what it settled. The sheet offered $100.00, the save valued the same credit at $300.00, and the
 * ceiling refused it — leaving that family's real $100.00 unreturnable through any door.
 */
describe('the tick-list can never offer more than the ceiling allows', () => {
  const offered = (
    credits: Parameters<typeof settledPerCredit>[0],
    paidOut: number,
  ): number[] => {
    const settled = settledPerCredit(credits, paidOut);
    // What the sheet shows on each row, and what the save re-derives for the same tick.
    return credits.map((c, i) => Math.round((c.amount - settled[i]) * 100) / 100);
  };

  /** The gate: what a coach may tick, against what the write will accept. */
  const assertOffersFitCeiling = (
    credits: Parameters<typeof settledPerCredit>[0],
    paidOut: number,
  ) => {
    const payable = offered(credits, paidOut)
      .filter((_, i) => credits[i].kind !== 'forgiven')
      .reduce((s, n) => s + n, 0);
    const ceiling = payoutCeiling(
      credits.map(c => ({ amount: c.amount, creditType: c.kind })),
      [{ amount: paidOut }],
    );
    assert.ok(
      Math.round(payable * 100) <= Math.round(ceiling * 100),
      `the sheet offers ${payable} but the save allows ${ceiling}`,
    );
  };

  it('⚠⚠ Logan: a legacy payback takes the credit it touched down to what is really left', () => {
    const credits = [{ kind: 'fundraiser' as const, amount: 300, linkedPaidBack: 0, creditDate: '2026-08-28' }];
    assert.deepEqual(offered(credits, 200), [100], 'the row reads $100.00, not $300.00');
    assertOffersFitCeiling(credits, 200);
  });

  it('⚠ the order is the RULE’S, not the caller’s — newest-first in, same answer out', () => {
    /* The dues route holds its credits newest-first; the report holds them oldest-first. Both must
       name the same credit, or one screen says a coach’s own money came back and the other says
       their rebate did. */
    const oldest = { kind: 'fundraiser' as const, amount: 150, linkedPaidBack: 0, creditDate: '2026-08-01' };
    const newest = { kind: 'fundraiser' as const, amount: 150, linkedPaidBack: 0, creditDate: '2026-09-01' };
    assert.deepEqual(settledPerCredit([oldest, newest], 100), [100, 0], 'oldest first');
    assert.deepEqual(settledPerCredit([newest, oldest], 100), [0, 100], 'and still oldest first');
    assertOffersFitCeiling([oldest, newest], 100);
    assertOffersFitCeiling([newest, oldest], 100);
  });

  it('own money comes back first, whatever order the credits arrive in', () => {
    const rebate = { kind: 'fundraiser' as const, amount: 150, linkedPaidBack: 0, creditDate: '2026-08-20' };
    const own = { kind: 'overpayment' as const, amount: 300, linkedPaidBack: 0, creditDate: '2026-09-01' };
    // Casey's shape: oldest-first alone would eat the rebate — the shipped dues screen says the
    // family's own money goes back first, and it does even though it is the NEWER credit.
    assert.deepEqual(settledPerCredit([own, rebate], 100), [100, 0]);
    assert.deepEqual(settledPerCredit([rebate, own], 100), [0, 100]);
    assertOffersFitCeiling([own, rebate], 100);
    assertOffersFitCeiling([rebate, own], 100);
  });

  it('⚠ a forgiven balance absorbs nothing — it is not the family’s money to hand back', () => {
    /* The ceiling excludes write-offs. If one could soak up a legacy payback, the payable credit
       beside it would read fuller than the save allows — the dead end in a second costume. */
    const credits = [
      { kind: 'forgiven' as const, amount: 100, linkedPaidBack: 0, creditDate: '2026-08-01' },
      { kind: 'fundraiser' as const, amount: 200, linkedPaidBack: 0, creditDate: '2026-08-15' },
    ];
    assert.deepEqual(offered(credits, 100), [100, 100], 'the payback came off the rebate');
    assertOffersFitCeiling(credits, 100);
  });

  it('⚠ a credit its own links already settled cannot swallow legacy money too', () => {
    /* Capacity is what is STANDING. Letting a settled credit take the remainder and then clamping
       it threw those dollars away, and the next credit read fully standing. */
    const credits = [
      { kind: 'fundraiser' as const, amount: 300, linkedPaidBack: 300, creditDate: '2026-08-01' },
      { kind: 'fundraiser' as const, amount: 100, linkedPaidBack: 0, creditDate: '2026-08-15' },
    ];
    assert.deepEqual(offered(credits, 400), [0, 0], 'both are spent');
    assertOffersFitCeiling(credits, 400);
  });

  it('a part-linked credit takes only what it has room for, and the rest spills on', () => {
    const credits = [
      { kind: 'fundraiser' as const, amount: 300, linkedPaidBack: 250, creditDate: '2026-08-01' },
      { kind: 'fundraiser' as const, amount: 100, linkedPaidBack: 0, creditDate: '2026-08-15' },
    ];
    assert.deepEqual(offered(credits, 400), [0, 0]);
    assertOffersFitCeiling(credits, 400);
  });

  it('nothing paid back leaves every credit whole', () => {
    const credits = [
      { kind: 'fundraiser' as const, amount: 300, linkedPaidBack: 0, creditDate: '2026-08-01' },
      { kind: 'overpayment' as const, amount: 50, linkedPaidBack: 0, creditDate: '2026-08-15' },
    ];
    assert.deepEqual(offered(credits, 0), [300, 50]);
    assertOffersFitCeiling(credits, 0);
  });

  it('a payback larger than the credits leaves nothing standing and no negative', () => {
    const credits = [{ kind: 'fundraiser' as const, amount: 100, linkedPaidBack: 0, creditDate: '2026-08-01' }];
    assert.deepEqual(offered(credits, 250), [0]);
    assertOffersFitCeiling(credits, 250);
  });

  it('two credits dated the same day fall back on when they were created', () => {
    const a = { kind: 'fundraiser' as const, amount: 100, linkedPaidBack: 0, creditDate: '2026-08-01', createdAt: '2026-08-01T10:00:00Z' };
    const b = { kind: 'fundraiser' as const, amount: 100, linkedPaidBack: 0, creditDate: '2026-08-01', createdAt: '2026-08-01T18:00:00Z' };
    assert.deepEqual(settledPerCredit([b, a], 100), [0, 100], 'the earlier one was consumed');
    assertOffersFitCeiling([b, a], 100);
  });

  it('⚠ a link bigger than its own credit is clamped, and does not turn into a negative', () => {
    /* Reachable without a bug elsewhere: a credit can be edited DOWN after a payback already
       pointed at it, and nothing caps the cumulative linked amount per credit. */
    const credits = [{ kind: 'fundraiser' as const, amount: 100, linkedPaidBack: 400, creditDate: '2026-08-01' }];
    assert.deepEqual(settledPerCredit(credits, 400), [100], 'settled can never exceed the credit');
    assert.deepEqual(offered(credits, 400), [0]);
    assertOffersFitCeiling(credits, 400);
  });

  it('two overpayments come back oldest first, not array first', () => {
    const newer = { kind: 'overpayment' as const, amount: 100, linkedPaidBack: 0, creditDate: '2026-09-01' };
    const older = { kind: 'overpayment' as const, amount: 100, linkedPaidBack: 0, creditDate: '2026-08-01' };
    assert.deepEqual(settledPerCredit([newer, older], 100), [0, 100]);
    assertOffersFitCeiling([newer, older], 100);
  });

  it('a payback beyond every payable credit empties them all and stops at zero', () => {
    const credits = [
      { kind: 'fundraiser' as const, amount: 200, linkedPaidBack: 0, creditDate: '2026-08-01' },
      { kind: 'overpayment' as const, amount: 100, linkedPaidBack: 0, creditDate: '2026-08-15' },
    ];
    assert.deepEqual(offered(credits, 900), [0, 0]);
    assertOffersFitCeiling(credits, 900);
  });

  it('no credits at all is not an error', () => {
    assert.deepEqual(settledPerCredit([], 250), []);
  });
});
