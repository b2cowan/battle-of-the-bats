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
 * THE UAT FIXTURE, CONDENSED TO THE FAMILIES THAT CARRY EACH KIND — the figures a coach actually
 * reads behind the Player dues row on the Statement.
 *
 * ⚠ ONE COPY, AND THAT IS THE POINT. It was typed out three times before `/simplify` looked
 * (2026-09-10), each copy asserting the same $3,665.65 total. This fixture tracks REAL records on the
 * UAT team, so it moves when they do — and a corrected copy sitting beside two stale ones leaves two
 * tests proving a season that no longer exists, failing later as a puzzle rather than a statement.
 */
const UAT_CONDENSED: FamilyDuesActualInput[] = [
  // Avery: sent $1,250.00 on a $700.00 bill, $380.00 owed back, $198.15 raised.
  { dues: 700, cappedPaid: 700, credits: [credit('overpayment', 550), credit('reimbursement', 380), credit('fundraiser', 198.15)] },
  // Casey: sent $1,200.00 on $900.00 and had the $300.00 excess returned.
  { dues: 900, cappedPaid: 900, credits: [credit('overpayment', 300, { handedBack: 300 }), credit('fundraiser', 37.5)] },
  // Kai: paid a $700.00 team bill, $200.00 from a drive, no cash.
  { dues: 970.83, cappedPaid: 0, credits: [credit('reimbursement', 700), credit('fundraiser', 200)] },
];

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
    /* ⚠ THREE, AND STILL THREE SINCE `cashHandedBack` JOINED `parts` (2026-09-10). That fourth field
       is a reader for the Months view's bridge, not a part of this figure — money handed back is
       absent from the total rather than subtracted from it, which is what lets three lines reach it
       instead of four nearly reaching it. Adding it here would assert the opposite of the ruling. */
    `${label}: the three parts must sum to actual (cashHandedBack is a fourth reader, not a fourth part)`,
  );

  /* ⚠⚠ THE PLAYER DUES BAND'S OWN IDENTITY (owner R1/R2, 2026-09-09 — "a bill lowered is not a
     collection"), asserted on EVERY case for the same reason as the one above.

     THE ONE WAY THIS RULING CAN BE GOT WRONG is to make a write-off lower `Dues` while it is ALSO
     still reducing the balance — the same dollars counted twice, and every affected family's
     balance shifts. This line is what makes that impossible to ship quietly: the band's two figures
     must land on the balance the family already had, and nothing else. */
  assert.equal(
    Math.round(((input.dues - r.billLowered.total) - r.actual) * 100),
    Math.round((r.balance + (r.excluded - r.billLowered.total)) * 100),
    `${label}: (dues − billLowered) − actual must equal the balance, untraced credits aside`,
  );
  /* And with no untraced credit — the state of both databases since R7 closed that door — the
     band closes EXACTLY on the balance, with nothing set aside. */
  if (Math.round(r.untraced * 100) === 0) {
    assert.equal(
      Math.round(((input.dues - r.billLowered.total) - r.actual) * 100),
      Math.round(r.balance * 100),
      `${label}: with nothing untraced the band must close on the balance exactly`,
    );
  }
  assert.equal(
    Math.round((r.billLowered.forgiven + r.billLowered.adjustment) * 100),
    Math.round(r.billLowered.total * 100),
    `${label}: the two kinds must add to what came off the bill`,
  );
  // Never more than the write-offs there actually were, and never negative.
  assert.ok(
    r.billLowered.total >= 0 && r.billLowered.total <= r.writeOffs + 0.0001,
    `${label}: what came off the bill must be a part of the write-offs, not more`,
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
    // Avery 1,828.15 + Casey 937.50 + Kai 900.00
    assert.equal(seasonDuesActual(UAT_CONDENSED), 3665.65);
  });

  it('adds in cents, so a season of awkward thirds does not drift', () => {
    const third = { dues: 970.83, cappedPaid: 0, credits: [credit('fundraiser', 323.61)] };
    assert.equal(seasonDuesActual([third, third, third]), 970.83);
  });

  it('breaks into the three lines the door shows, and they reach the figure', () => {
    const p = seasonDuesParts(UAT_CONDENSED);
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

/**
 * EVERY PAID-OUT DOLLAR LANDS ON SOME CREDIT (owner question, 2026-09-09).
 *
 * ⚠⚠ THE BALANCE A COACH CHASES FAMILIES ON IS DERIVED IN TWO PLACES, and they agree only while the
 * allocation accounts for the whole payout total. `lib/db.ts` and the dues route both render
 * `Math.max(0, creditsIssued − paidOut)` over ALL credits at the family level; `duesActual` derives
 * its balance from what the allocator actually placed. Drop a dollar and the two part — the §148
 * shape, and the reason this block asserts the SHIPPED formula rather than trusting the module.
 *
 * ⚠ NO STALE DATA IS REQUIRED, which is what makes it worth a block of its own. The season
 * settlement writes paybacks with no links BY DESIGN, so "settle a season, then hand the family the
 * rest" reaches it on a season with no history at all.
 */
describe('the report accounts for every dollar handed back', () => {
  /** The figure the dues screen renders. Restated here ON PURPOSE — it is the OTHER derivation,
   *  and a test that reached for this module's own answer would agree with itself. */
  const shippedBalance = (dues: number, credits: readonly { amount: number }[], paidOut: number) =>
    Math.round((dues - Math.max(0, credits.reduce((s, c) => s + c.amount, 0) - paidOut)) * 100) / 100;

  const family = (
    dues: number,
    credits: Parameters<typeof buildFamilyDuesInputs>[0]['credits'],
    payouts: number[],
  ) => {
    const f = buildFamilyDuesInputs({
      schedules: [{ playerId: 'p', total: dues }],
      payments: [],
      payouts: payouts.map(amount => ({ playerId: 'p', amount })),
      credits,
    }).get('p')!;
    const r = assertTiesToBalance(f, 'accounted');
    assert.equal(
      r.balance,
      shippedBalance(dues, credits, payouts.reduce((s, n) => s + n, 0)),
      'the Statement balance must equal the one the dues screen renders',
    );
    return { f, r };
  };

  it('⚠⚠ settle the season, then pay the family the rest — no legacy data anywhere', () => {
    /* The family raised $300.00. The settlement handed them $100.00 and named no debt (it never
       does). The coach later paid back the remaining $200.00, which DID name its debt — so that
       credit now carries a PARTIAL link, a row that could not exist before the Pay-out sheet
       learned to settle a remainder. The old rule skipped any credit carrying a link, so the
       settlement's $100.00 had nowhere to go: balance $900.00 against the dues screen's $1,000.00,
       and a family who had every credit returned still reading as having contributed $100.00. */
    const { f, r } = family(1000, [
      { playerId: 'p', kind: 'fundraiser', amount: 300, traced: true, paidBack: 200 },
    ], [100, 200]);
    assert.equal(f.credits[0].handedBack, 300, 'all $300.00 came back, not just the linked $200.00');
    assert.equal(r.actual, 0, 'every credit was returned, so nothing was contributed');
  });

  it('a part-linked credit takes the remainder up to its room, and the rest spills on', () => {
    const { f } = family(1000, [
      { playerId: 'p', kind: 'fundraiser', amount: 300, traced: true, paidBack: 250 },
      { playerId: 'p', kind: 'fundraiser', amount: 100, traced: true },
    ], [400]);
    assert.deepEqual(f.credits.map(c => c.handedBack), [300, 100]);
  });
});

/**
 * A WRITE-OFF IS NOT MONEY THE TEAM CAN HAND BACK, ON EITHER SCREEN (owner question, 2026-09-09).
 *
 * ⚠⚠ IT USED TO CHANGE THE SEASON'S DUES ACTUAL BY DATE ORDER ALONE. Cash handed back can only have
 * come out of money the family was owed — never out of forgiveness — but the report let a write-off
 * absorb it, and because forgiveness flows through the CLAMPED `excluded` term rather than a
 * symmetric pot, the figure moved with it: the same family, the same money, read $200.00 with the
 * write-off dated older than their rebate and $100.00 with it dated newer. The module header's claim
 * that the allocation "only moves money between kinds, never the total" was false wherever a
 * forgiven credit was in play.
 */
describe('a write-off cannot absorb a payback while a real credit has room', () => {
  const forgivenFirst = [
    { playerId: 'p', kind: 'forgiven' as const, amount: 100, traced: true },
    { playerId: 'p', kind: 'fundraiser' as const, amount: 200, traced: true },
  ];
  const rebateFirst = [forgivenFirst[1], forgivenFirst[0]];
  const run = (credits: typeof forgivenFirst) => duesActual(
    buildFamilyDuesInputs({
      schedules: [{ playerId: 'p', total: 1000 }],
      payments: [], payouts: [{ playerId: 'p', amount: 100 }],
      credits,
    }).get('p')!,
  );

  it('⚠⚠ the answer does not depend on which was dated first', () => {
    assert.equal(run(forgivenFirst).actual, 100);
    assert.equal(run(rebateFirst).actual, 100);
  });

  it('the payback comes off the rebate, and the write-off is still standing', () => {
    const r = run(forgivenFirst);
    assert.equal(r.parts.fundraisingCredited, 100, 'the rebate is worth $100.00 now, not $200.00');
    assert.equal(r.writeOffs, 100, 'the forgiveness was never handed back, so it still stands');
  });

  it('⚠ but it DOES take the tail, or the balance identity breaks', () => {
    /* The one case forgiveness must absorb: more paid out than the payable credits can hold. The
       settlement pays a family's share of the SURPLUS too, which is not a credit at all, so this is
       reachable. Every dollar has to land somewhere or the two balances part. */
    const f = buildFamilyDuesInputs({
      schedules: [{ playerId: 'p', total: 1000 }],
      payments: [], payouts: [{ playerId: 'p', amount: 100 }],
      credits: [
        { playerId: 'p', kind: 'forgiven', amount: 100, traced: true },
        { playerId: 'p', kind: 'fundraiser', amount: 50, traced: true },
      ],
    }).get('p')!;
    assert.deepEqual(f.credits.map(c => c.handedBack), [50, 50], 'the write-off took what was left');
    const r = assertTiesToBalance(f, 'tail');
    assert.equal(r.balance, 950, 'and it equals the balance the dues screen renders');
  });
});

/**
 * THE BRIDGE FROM THE MONTHS VIEW'S CASH TO THE STATEMENT'S CONTRIBUTION (owner ruling 2026-09-10).
 *
 * ⚠⚠ THE PART THIS PROVES IS THE MIDDLE LINE, and it exists because the obvious way to get it is
 * wrong. `cash − cashKept` produces the same number on every ordinary season and is NOT the same
 * fact: it also swallows a payment from a family with no dues schedule and an overshoot never
 * written up as an overpayment credit, and a bridge whose middle line carries a specific label over
 * a residual is worse than no bridge — it looks like a proof.
 *
 * ⚠ ONLY THE FAMILY'S OWN MONEY. A payback drawn against a fundraiser or reimbursement credit has
 * already reduced that credit's standing amount, so counting it here too would take the same dollars
 * off twice — the double-count this module's header exists to warn about.
 */
describe('the dues cash bridge', () => {
  it('counts a payback against the family\'s OWN money, and no other kind', () => {
    const own = duesActual({
      dues: 900, cappedPaid: 900,
      credits: [credit('overpayment', 300, { handedBack: 300 })],
    });
    assert.equal(own.parts.cashHandedBack, 300, 'their own $300 went back to them');

    const raised = duesActual({
      dues: 900, cappedPaid: 900,
      credits: [credit('fundraiser', 300, { handedBack: 300 })],
    });
    assert.equal(raised.parts.cashHandedBack, 0,
      'a drive share handed back is already off `fundraisingCredited` — counting it here pays it twice');
    assert.equal(raised.parts.fundraisingCredited, 0);
  });

  it('never reports more of a family\'s own cash returned than the credit ever held', () => {
    /* The module's own contract: every exclusion tolerates a payback recorded larger than its
       credit (see the fundraiser case at "a credit is revenue only while it is standing"). This is
       the same tolerance on the one figure the bridge subtracts — unclamped, a $175 payback on a $100
       overpayment credit would report $175 of own cash returned, and the walk would miss by $75. */
    const r = duesActual({
      dues: 500, cappedPaid: 0,
      credits: [credit('overpayment', 100, { handedBack: 175 })],
    });
    assert.equal(r.parts.cashKept, 0, 'nothing of their own is still held');
    assert.equal(r.parts.cashHandedBack, 100, 'capped at the $100 that was ever their own money');
    assertTiesToBalance({ dues: 500, cappedPaid: 0, credits: [credit('overpayment', 100, { handedBack: 175 })] }, 'over-refunded own money');
  });

  /* ⚠ "cashHandedBack is no part of `actual`" HAS NO CASE OF ITS OWN, on purpose. `assertTiesToBalance`
     asserts the three-parts identity on EVERY input this file gives it, so a case here would re-prove
     on one family what is already held on fifteen — and the weaker gate is the one that would be
     believed if the two ever disagreed. The claim lives in that helper's assertion message. */

  it('walks the UAT shape from gross cash to what families contributed', () => {
    /* GROSS dues cash — what the Months view totals. It is the capped payments plus every overshoot,
       which is exactly what an overpayment credit records. */
    const grossCash = 700 + 900 + 0 + 550 + 300;
    assert.equal(grossCash, 2450);

    const p = seasonDuesParts(UAT_CONDENSED);
    assert.equal(p.cashHandedBack, 300, 'only Casey had their own money back');
    assert.equal(
      grossCash - p.cashHandedBack + p.familyPaidCosts + p.fundraisingCredited,
      p.actual,
      'the bridge must close to the cent, or the screen refuses to draw it',
    );
    assert.equal(p.actual, 3665.65);
  });
});
