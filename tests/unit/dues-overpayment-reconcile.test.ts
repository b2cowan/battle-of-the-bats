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
import { planOverpaymentReconcile, splitDuesLadder, duesLadderTotals } from '../../lib/dues-payments.ts';
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

  /* ⚠⚠ THE FOLD RUNS ON EVERY PASS, NOT ONLY THE ONE THAT CREATES (owner, QA §148 walk 2026-09-06).
     Consolidation used to live inside the grow branch, so repair was one-directional: rows written
     before the 2026-09-01 rule — Avery's $58.33 + $491.67 — survived every reduction and every
     no-op reconcile, because neither branch ever looked at them. Two halves of one true $550.00,
     and only the SUM tied to anything on the screen. */
  it('a no-change pass FOLDS leftover engine rows — the pair heals without any dollars moving', () => {
    const p = planOverpaymentReconcile(
      [engineRow('newer', 58.33), engineRow('older', 491.67)], 1250, 700, { consolidate: true },
    );
    assert.equal(p.create, 0);
    assert.equal(p.reduced, 0, 'a fold moves dollars between rows — it never removes any');
    assert.deepEqual(p.topUp, { id: 'newer', newAmount: 550 });
    assert.deepEqual(p.remove, ['older']);
    assert.equal(p.trim, null);
  });

  it('a SHRINK folds what survives it, and the trimmed row folds at its NEW amount', () => {
    // carried 700, trueExcess 550 → 150 comes off: 'a' (100) goes whole, 'b' trims 491.67 → 441.67.
    // What survives — the trimmed 'b' and the untouched 'c' — then folds into one row.
    const p = planOverpaymentReconcile(
      [engineRow('a', 100), engineRow('b', 491.67), engineRow('c', 108.33)], 1250, 700, { consolidate: true },
    );
    assert.equal(p.reduced, 150);
    // ⚠ 441.67 + 108.33, NOT 491.67 + 108.33 — folding the stale figure would hand back the very
    // dollars the reduction just took off, re-creating the double-count through the repair.
    assert.deepEqual(p.topUp, { id: 'b', newAmount: 550 });
    assert.deepEqual(p.remove, ['a', 'c']);
    assert.equal(p.trim, null, 'the top-up states the whole figure, so it subsumes the trim');
  });

  it('one engine row is left alone — a fold with nothing to fold writes nothing', () => {
    const p = planOverpaymentReconcile([engineRow('only', 550)], 1250, 700, { consolidate: true });
    assert.deepEqual(p, { create: 0, topUp: null, remove: [], trim: null, reduced: 0 });
  });

  it('the record-time path still never folds — a receipt’s credit rides its payment', () => {
    const p = planOverpaymentReconcile(
      [engineRow('newer', 58.33), engineRow('older', 491.67)], 1250, 700, { consolidate: false },
    );
    assert.deepEqual(p, { create: 0, topUp: null, remove: [], trim: null, reduced: 0 });
  });

  /* ⚠ FOUND BY REVIEW (2026-09-07, Critical): the newest overpayment row is coach-typed, so the
     shrink trims IT, and the two engine rows beneath it still fold. The first cut nulled the trim
     whenever a fold happened, so that row was never written — stale amount, overstated credits. */
  it('a shrink that trims a coach-typed row ABOVE two engine rows keeps the trim and still folds the pair', () => {
    // carried 100 + 300 + 200 = 600 against a true excess of 550 → $50 comes off the newest (coach) row.
    const p = planOverpaymentReconcile(
      [{ id: 'coach', amount: 100, creditType: 'overpayment' }, engineRow('e1', 300), engineRow('e2', 200)],
      1250, 700, { consolidate: true },
    );
    assert.equal(p.reduced, 50);
    assert.deepEqual(p.trim, { id: 'coach', amount: 50 }, 'the trim is on a row the fold does not touch — it must survive');
    assert.deepEqual(p.topUp, { id: 'e1', newAmount: 500 }, 'the two engine rows fold at their own amounts');
    assert.deepEqual(p.remove, ['e2']);
    // What stands afterwards: 50 + 500 = 550 = the true excess.
  });

  it('a fold never swallows a coach-typed overpayment credit', () => {
    const p = planOverpaymentReconcile(
      [engineRow('newer', 58.33), { id: 'manual', amount: 150, creditType: 'overpayment' }, engineRow('older', 341.67)],
      1250, 700, { consolidate: true },
    );
    // The manual row is COUNTED (400 + 150 = 550) but stays its own row with its own date and bin.
    assert.deepEqual(p.topUp, { id: 'newer', newAmount: 400 });
    assert.deepEqual(p.remove, ['older']);
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

/* ⚠⚠ THE LADDER'S ONE PROMISE: it equals the balance the screen ALREADY SHOWED. Every case below
   asserts that, not a hand-typed expected figure — a test that restates the implementation proves
   nothing about the invariant §148 was built around and this change must not break. The twelve
   families are the QA fixture, read off the rendered dues table on 2026-09-07. */
/* ⚠ THE QA FIXTURE'S TWELVE FAMILIES, read off the rendered dues table on 2026-09-07 — MODULE
   SCOPE because two suites below need them: the per-row ladder and the roster totals under it.
   It is the one roster in this repo carrying every awkward case at once, which is why both the
   row invariant and the footer invariant are worth asserting against exactly these numbers.
   name, dues, fundraiser, other-kinds, overpayment, gross payments, payouts */
const FIXTURE: Array<[string, number, number, number, number, number, number]> = [
  // Overpaid, no payout: $550 of her own money sits inside Paid, not Credits.
  ['Avery',    700.00, 198.15, 380.00, 550.00, 1250.00,   0],
  // The payout case that started this: $150 raised, $100 handed back.
  ['Blake',    970.83, 150.00, 126.98,      0,  625.00, 100],
  // Overpaid AND fully refunded — the row whose Paid reads $900 today against $1,200 sent.
  ['Casey',    900.00,  37.50,      0, 300.00, 1200.00, 300],
  ['Devon',    970.83,  27.00,      0,      0,       0,   0],
  ['Emerson',  970.83,      0,      0,      0,       0,   0],
  ['Frankie',  970.83,  40.00,      0,      0,       0,   0],
  ['Gray',     970.83, 125.00,      0,      0,       0,   0],
  ['Harper',   970.83,      0,      0,      0,       0,   0],
  ['Indigo',   970.83,      0, 240.00,      0,       0,   0],
  ['Jules',    970.83, 125.00,      0,      0,       0,   0],
  // Mostly a bat the family fronted — Other credits, not fundraising.
  ['Kai',      970.83, 200.00, 700.00,      0,       0,   0],
  ['Logan',    970.83, 300.00,      0,      0,       0, 200],
];

describe('splitDuesLadder — the ladder lands on the balance the screen already had (2026-09-07)', () => {
  /** The balance every dues surface computes today: dues − (credits issued − paid out) − capped paid. */
  const todaysBalance = (f: {
    dues: number; creditsIssued: number; paidOut: number; grossPayments: number;
  }) => Math.round((f.dues - (f.creditsIssued - f.paidOut) - Math.min(f.grossPayments, f.dues)) * 100) / 100;

  const ladderOf = (f: {
    dues: number; creditsIssued: number; fundraiserIssued: number; overpaymentIssued: number;
    paidOut: number; grossPayments: number;
  }) => splitDuesLadder({ ...f, cappedPaid: Math.min(f.grossPayments, f.dues) });

  const sums = (l: ReturnType<typeof splitDuesLadder>) =>
    Math.round((l.dues - l.fundraising - l.otherCredits - l.paid + l.handedBack) * 100) / 100;

  for (const [name, dues, fundraiserIssued, otherKinds, overpaymentIssued, grossPayments, paidOut] of FIXTURE) {
    it(`${name}: the five figures land on the balance the screen showed`, () => {
      const creditsIssued = Math.round((fundraiserIssued + otherKinds + overpaymentIssued) * 100) / 100;
      const f = { dues, creditsIssued, fundraiserIssued, overpaymentIssued, paidOut, grossPayments };
      assert.equal(sums(ladderOf(f)), todaysBalance(f));
    });
  }

  it('GROSS, not netted — the two figures the old columns were hiding', () => {
    // Blake: the whole reason the ladder exists. `Credits ($176.98)` concealed a $150 rebate with
    // $100 already taken home; `Fundraising` must say what he RAISED, with the refund beside it.
    const blake = ladderOf({ dues: 970.83, creditsIssued: 276.98, fundraiserIssued: 150, overpaymentIssued: 0, paidOut: 100, grossPayments: 625 });
    assert.equal(blake.fundraising, 150, 'raised, not what survives the refund');
    assert.equal(blake.handedBack, 100);
    // Casey sent $1,200. §148 ruled Paid shows what the family actually sent; today it reads $900.
    const casey = ladderOf({ dues: 900, creditsIssued: 337.5, fundraiserIssued: 37.5, overpaymentIssued: 300, paidOut: 300, grossPayments: 1200 });
    assert.equal(casey.paid, 1200, 'what they sent, not what survives the refund');
    assert.equal(casey.handedBack, 300);
    assert.equal(casey.otherCredits, 0, 'their own $300 is inside Paid, never a credit');
  });

  it('the family’s own money never appears as a credit — Avery’s $550 is inside Paid', () => {
    const l = ladderOf({ dues: 700, creditsIssued: 1128.15, fundraiserIssued: 198.15, overpaymentIssued: 550, paidOut: 0, grossPayments: 1250 });
    assert.equal(l.paid, 1250);
    assert.equal(l.fundraising, 198.15);
    assert.equal(l.otherCredits, 380, 'the two costs her family fronted, and nothing else');
    assert.equal(sums(l), -1128.15);
  });

  /* ⚠ THE CLAMP, WHICH IS THE ONE PIECE OF THIS THAT IS NOT OBVIOUS. A coach can hand-add a credit
     and pick `Overpayment` as its kind, and no payment stands behind it. Subtracting the raw
     overpayment total would push the ladder's balance ABOVE the real one by that amount. */
  it('a coach-typed overpayment credit falls into Other credits and the ladder still ties', () => {
    // Avery's real state plus a $60 credit a coach typed and marked as an overpayment.
    const f = { dues: 700, creditsIssued: 1188.15, fundraiserIssued: 198.15, overpaymentIssued: 610, paidOut: 0, grossPayments: 1250 };
    const l = ladderOf(f);
    assert.equal(l.paid, 1250, 'still only what the payments say');
    assert.equal(l.otherCredits, 440, 'the $380 fronted costs plus the $60 a coach asserted');
    assert.equal(l.ownMoney, 550, 'only what the payments stand behind — never the $60');
    assert.equal(sums(l), todaysBalance(f));
  });

  /* ⚠ THE CASE THAT BROKE THE FIRST CUT. An overpayment credit with NO payment link — Umar's, which
     predates linking — on a family who really did send $50 over. A rule that decided own money by
     the link filed it as coach-typed and the ladder came out $50 wrong. Own money is the CLAMP. */
  it('Umar: an unlinked overpayment credit the payments stand behind is still the family’s own money', () => {
    const f = { dues: 600, creditsIssued: 50, fundraiserIssued: 0, overpaymentIssued: 50, paidOut: 0, grossPayments: 650 };
    const l = ladderOf(f);
    assert.equal(l.ownMoney, 50, 'the excess stands behind it, link or no link');
    assert.equal(l.otherCredits, 0, 'so it is not a credit somebody else gave them');
    assert.equal(l.paid, 650);
    assert.equal(sums(l), todaysBalance(f));
    assert.equal(sums(l), -50);
  });

  it('no schedule, no money: five zeros rather than a NaN', () => {
    const l = splitDuesLadder({ dues: 0, grossPayments: 0, cappedPaid: 0, creditsIssued: 0, fundraiserIssued: 0, overpaymentIssued: 0, paidOut: 0 });
    assert.deepEqual(l, { dues: 0, fundraising: 0, otherCredits: 0, paid: 0, handedBack: 0, ownMoney: 0 });
  });

  it('cents survive the split — thirds of a bill do not leak a fractional cent', () => {
    const f = { dues: 970.83, creditsIssued: 126.98, fundraiserIssued: 0, overpaymentIssued: 0, paidOut: 0, grossPayments: 323.61 };
    const l = ladderOf(f);
    assert.equal(l.otherCredits, 126.98);
    assert.equal(sums(l), todaysBalance(f));
  });
});

/* ⚠⚠ THE FOOTER'S ONE PROMISE, and it is the row's whole reason to exist (QA §151): the six
   columns close on the balance beside them for a WHOLE ROSTER, not just a family. That follows
   from `splitDuesLadder` by linearity — which is exactly the kind of "obviously true" step that
   stops being true the day someone reaches for floats, drops a rung, or decides the total should
   be re-derived from the five figures instead of summed from the rows. Every case asserts the
   invariant, never a typed figure.

   ⚠ THE FIXTURE IS THE SAME TWELVE FAMILIES as the ladder suite above, deliberately: it is the
   one roster in this repo that carries every awkward case at once — an overpayment with a full
   refund, a fundraiser rebate, a coach-typed credit, and families who have sent nothing. */
describe('duesLadderTotals — the ladder closes across the roster, not just the row (2026-09-07)', () => {
  const ladderOf = (f: {
    dues: number; creditsIssued: number; fundraiserIssued: number; overpaymentIssued: number;
    paidOut: number; grossPayments: number;
  }) => splitDuesLadder({ ...f, cappedPaid: Math.min(f.grossPayments, f.dues) });

  const rowOf = ([, dues, fundraiserIssued, otherKinds, overpaymentIssued, grossPayments, paidOut]:
    [string, number, number, number, number, number, number]) => {
    const creditsIssued = Math.round((fundraiserIssued + otherKinds + overpaymentIssued) * 100) / 100;
    const f = { dues, creditsIssued, fundraiserIssued, overpaymentIssued, paidOut, grossPayments };
    return {
      ladder: ladderOf(f),
      // The balance every dues surface computes today — the figure the footer sums, never re-derives.
      balance: Math.round((dues - (creditsIssued - paidOut) - Math.min(grossPayments, dues)) * 100) / 100,
    };
  };

  /** Dues − Fundraising − Other credits − Paid + Handed back, as a coach reads across the footer. */
  const closes = (t: ReturnType<typeof duesLadderTotals>) =>
    Math.round((t.dues - t.fundraising - t.otherCredits - t.paid + t.handedBack) * 100) / 100;

  const ROSTER = FIXTURE.map(rowOf);

  it('the whole roster: reading across the totals lands on the total balance', () => {
    const t = duesLadderTotals(ROSTER);
    assert.equal(closes(t), t.balance);
    assert.equal(t.players, 12);
  });

  /* ⚠ THE FILTER IS THE POINT, not a bonus case. This footer totals what is ON SCREEN — a coach
     can narrow the list to "Past due" or "In credit" — so an invariant that only held over the
     full roster would be no invariant at all. Every contiguous slice is checked, because a bug
     that cancels out across twelve families is exactly the one a single whole-roster assertion
     lets through. */
  it('every filtered slice closes too — the footer follows the Showing pill', () => {
    for (let from = 0; from < ROSTER.length; from += 1) {
      for (let to = from; to <= ROSTER.length; to += 1) {
        const slice = ROSTER.slice(from, to);
        const t = duesLadderTotals(slice);
        assert.equal(closes(t), t.balance, `rows ${from}–${to} do not close`);
        assert.equal(t.players, slice.length);
      }
    }
  });

  it('an empty list totals to zero rather than NaN — the Showing pill can empty the table', () => {
    const t = duesLadderTotals([]);
    assert.deepEqual(
      [t.dues, t.fundraising, t.otherCredits, t.paid, t.handedBack, t.balance, t.players],
      [0, 0, 0, 0, 0, 0, 0],
    );
  });

  /* ⚠⚠ THE TWO GAPS THE BAND'S CAPTIONS EXPLAIN, pinned so nobody "fixes" them into agreement.
     The footer is GROSS and the band is capped; the footer is NET and the band counts only debts.
     If a later change makes either pair equal, one of the two surfaces has started answering the
     other's question and the screen has lost the fact it was showing. */
  it('Paid exceeds the band’s Collected by exactly the money families sent over their bills', () => {
    const t = duesLadderTotals(ROSTER);
    // What the band shows: payments capped at each family's own bill.
    const collected = Math.round(FIXTURE.reduce(
      (sum, [, dues, , , , grossPayments]) => sum + Math.min(grossPayments, dues) * 100, 0,
    )) / 100;
    const sentOver = Math.round(FIXTURE.reduce(
      (sum, [, dues, , , , grossPayments]) => sum + Math.max(0, grossPayments - dues) * 100, 0,
    )) / 100;
    assert.ok(sentOver > 0, 'fixture must contain an overpayment or this proves nothing');
    assert.equal(Math.round((t.paid - collected) * 100) / 100, sentOver);
  });

  it('Balance falls short of the band’s Balance owing by exactly the money owed back', () => {
    const t = duesLadderTotals(ROSTER);
    const owing = Math.round(ROSTER.reduce((s, r) => s + Math.max(0, r.balance) * 100, 0)) / 100;
    const owedBack = Math.round(ROSTER.reduce((s, r) => s + Math.max(0, -r.balance) * 100, 0)) / 100;
    assert.ok(owedBack > 0, 'fixture must contain a family in credit or this proves nothing');
    assert.equal(Math.round((owing - t.balance) * 100) / 100, owedBack);
  });
});
