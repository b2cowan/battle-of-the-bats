/**
 * A BILL LOWERED IS NOT A COLLECTION (owner rulings R1–R5, 2026-09-09) — the Player Dues band,
 * the Money Overview's **Bills settled** card, and the season identities that hold them to the
 * Statement.
 *
 * ⚠⚠ THE ONE WAY THIS RULING CAN BE GOT WRONG, and the reason this file exists: making a write-off
 * lower `Dues` while it is ALSO still reducing the balance. The same dollars are then counted
 * twice and every affected family's balance shifts — on figures coaches have chased families over.
 * The gate is that **no balance moves**, and it is asserted here on every case rather than argued
 * in a comment.
 *
 * ⚠ THE PER-FAMILY HALF OF THAT GATE LIVES NEXT DOOR, in `coach-dues-actual.test.ts`'s
 * `assertTiesToBalance`, which every case in that file runs. This file holds the cases the UAT
 * fixture cannot show — it carries a single $17.00 adjustment, on a family already in credit — and
 * the season-level identities.
 *
 * ⚠ THE FIGURES ARE THE UAT FIXTURE'S OWN where they can be, read from the records after the
 * 2026-09-09 re-seed, so a failure here is comparable against the rendered screen.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  duesActual, seasonDuesActual, seasonDuesBand, buildFamilyDuesInputs,
  type FamilyDuesActualInput, type DuesCreditInput, type SeasonDuesRecords,
} from '../../lib/coach-dues-actual.ts';
import { splitDuesLadder } from '../../lib/dues-payments.ts';

const credit = (
  kind: DuesCreditInput['kind'], amount: number,
  opts: { traced?: boolean; handedBack?: number } = {},
): DuesCreditInput => ({ kind, amount, traced: opts.traced ?? true, handedBack: opts.handedBack ?? 0 });

const cents = (n: number) => Math.round(n * 100);

/**
 * The band's identity, asserted on EVERY case below — a gate only one case has to pass is a gate
 * one edit away from being useless.
 *
 *     (dues − what came off the bill) − what the family contributed  ===  the balance they had
 *
 * The right-hand side is never recomputed from the left: it is the figure the dues screen already
 * renders and the one a coach has acted on.
 */
function assertNoBalanceMoves(input: FamilyDuesActualInput, label: string) {
  const r = duesActual(input);
  assert.equal(
    cents((input.dues - r.billLowered.total) - r.actual),
    cents(r.balance + (r.excluded - r.billLowered.total)),
    `${label}: the band must land on the balance, untraced credits aside`,
  );
  if (cents(r.untraced) === 0) {
    assert.equal(
      cents((input.dues - r.billLowered.total) - r.actual),
      cents(r.balance),
      `${label}: with nothing untraced the band closes on the balance exactly`,
    );
  }
  assert.equal(
    cents(r.billLowered.forgiven + r.billLowered.adjustment),
    cents(r.billLowered.total),
    `${label}: the two kinds must add to what came off the bill`,
  );
  assert.ok(
    r.billLowered.total >= 0 && r.billLowered.total <= r.writeOffs + 0.0001,
    `${label}: what came off the bill is a part of the write-offs, never more`,
  );
  return r;
}

describe('a bill lowered is not a collection', () => {
  it('an adjustment lowers the bill and is NOT collected', () => {
    const r = assertNoBalanceMoves({ dues: 700, cappedPaid: 500, credits: [credit('other', 17)] }, 'a typed adjustment');
    assert.equal(r.billLowered.adjustment, 17);
    assert.equal(r.billLowered.forgiven, 0);
    assert.equal(r.actual, 500);   // money only — the $17 is nowhere in it
    assert.equal(r.balance, 183);  // 700 − 17 − 500, exactly as before the ruling
  });

  it('⚠ BOTH KINDS, ONE RULE — a forgiven bill behaves exactly as an adjustment does', () => {
    const adj = assertNoBalanceMoves({ dues: 700, cappedPaid: 500, credits: [credit('other', 17)] }, 'adjustment');
    const forg = assertNoBalanceMoves({ dues: 700, cappedPaid: 500, credits: [credit('forgiven', 17)] }, 'forgiven');
    assert.equal(forg.actual, adj.actual);
    assert.equal(forg.balance, adj.balance);
    assert.equal(forg.billLowered.total, adj.billLowered.total);
    // Only the WORD differs, which is all the caption needs it for (R5).
    assert.equal(forg.billLowered.forgiven, 17);
    assert.equal(adj.billLowered.adjustment, 17);
  });

  it('a family forgiven in full owes nothing, and the team collected nothing from them', () => {
    const r = assertNoBalanceMoves({ dues: 900, cappedPaid: 0, credits: [credit('forgiven', 900)] }, 'forgiven in full');
    assert.equal(r.billLowered.total, 900);
    assert.equal(r.actual, 0);
    assert.equal(r.balance, 0);
    assert.equal(900 - r.billLowered.total, 0);  // a bill of nothing, never a negative bill
  });

  it('⚠ an adjustment LARGER than the remaining bill still moves no balance', () => {
    const r = assertNoBalanceMoves({ dues: 300, cappedPaid: 250, credits: [credit('other', 500)] }, 'adjustment over the bill');
    assert.equal(r.balance, -450);   // 300 − 500 − 250
    assert.equal(r.actual, 250);
    assert.equal(r.billLowered.total, 500);
  });

  it('⚠⚠ an adjustment on a family ALREADY IN CREDIT — the fixture’s own case', () => {
    /* Avery on the UAT team, read from the records: billed $700, sent $1,250, holding $198.15 of
       fundraising rebates, $380.00 of bills their family paid a vendor direct, the $550.00 their
       over-send became, and the $17.00 adjustment. Both `Dues` and `Collected` move; the balance
       does not. */
    const r = assertNoBalanceMoves({
      dues: 700, cappedPaid: 700,
      credits: [
        credit('fundraiser', 75.25), credit('reimbursement', 200), credit('fundraiser', 50),
        credit('reimbursement', 180), credit('fundraiser', 72.9),
        credit('overpayment', 550, { traced: false }), credit('other', 17, { traced: false }),
      ],
    }, 'Avery');
    assert.equal(r.billLowered.total, 17);
    assert.equal(r.balance, -1145.15);   // the figure the fixture renders, before and after
    assert.equal(r.actual, 1828.15);
  });

  it('⚠ a write-off partly HANDED BACK lowers the bill only by what still stands', () => {
    const r = assertNoBalanceMoves({
      dues: 700, cappedPaid: 0, credits: [credit('other', 100, { handedBack: 40 })],
    }, 'write-off partly repaid');
    assert.equal(r.billLowered.total, 60);   // standing, not issued
    assert.equal(r.balance, 640);
  });

  it('⚠ nothing comes off the bill when payouts have eaten the credits', () => {
    /* A family whose payouts exceed their credits has nothing reducing their bill, so nothing may
       come off it either — the clamp that keeps `Dues` and the balance in step. */
    const r = assertNoBalanceMoves({
      dues: 700, cappedPaid: 0,
      credits: [credit('forgiven', 100, { handedBack: 100 }), credit('other', 50, { handedBack: 50 })],
    }, 'everything handed back');
    assert.equal(r.billLowered.total, 0);
    assert.equal(r.balance, 700);
  });

  it('⚠ NO ADJUSTMENT AND NOTHING FORGIVEN — the caption has nothing to say (R5)', () => {
    const r = assertNoBalanceMoves({
      dues: 700, cappedPaid: 400, credits: [credit('fundraiser', 100)],
    }, 'an ordinary season');
    assert.equal(r.billLowered.total, 0);
    assert.equal(r.billLowered.forgiven, 0);
    assert.equal(r.billLowered.adjustment, 0);
  });
});

describe('the dues table still closes on the row it always did', () => {
  /* ⚠⚠ THE LADDER MOVES A WRITE-OFF OFF **BOTH** SIDES. `Dues` loses it and `Other credits` loses
     it, so the row reads as a smaller bill rather than as a credit somebody paid — and the balance
     the row closes on is untouched. Subtract it from `dues` alone and every affected family's
     balance moves by exactly that amount, which is the defect this asserts against. */
  const close = (L: ReturnType<typeof splitDuesLadder>) =>
    cents(L.dues - L.fundraising - L.otherCredits - L.paid + L.handedBack);

  it('the row closes on the same balance with the write-off moved as without it', () => {
    const base = {
      dues: 700, grossPayments: 500, cappedPaid: 500,
      creditsIssued: 117, fundraiserIssued: 100, overpaymentIssued: 0, paidOut: 0,
    };
    const before = splitDuesLadder(base);
    const after = splitDuesLadder({ ...base, billLowered: 17 });
    assert.equal(close(after), close(before), 'the balance the row closes on must not move');
    assert.equal(after.dues, 683);           // the bill, after the adjustment
    assert.equal(after.otherCredits, before.otherCredits - 17);
    assert.equal(after.fundraising, before.fundraising);
    assert.equal(after.paid, before.paid);
  });

  it('⚠ a write-off partly handed back leaves its returned half where `handedBack` cancels it', () => {
    const base = {
      dues: 700, grossPayments: 0, cappedPaid: 0,
      creditsIssued: 100, fundraiserIssued: 0, overpaymentIssued: 0, paidOut: 40,
    };
    const before = splitDuesLadder(base);
    const after = splitDuesLadder({ ...base, billLowered: 60 });
    assert.equal(close(after), close(before));
    assert.equal(after.dues, 640);
    assert.equal(after.otherCredits, 40);    // the half that went back
    assert.equal(after.handedBack, 40);
  });

  it('⚠ a stale figure can never drive the credits column negative or lift the bill', () => {
    const L = splitDuesLadder({
      dues: 700, grossPayments: 0, cappedPaid: 0,
      creditsIssued: 20, fundraiserIssued: 0, overpaymentIssued: 0, paidOut: 0,
      billLowered: 5000,
    });
    assert.equal(L.otherCredits, 0);
    assert.equal(L.dues, 680);               // clamped to the credits actually there
  });
});

describe('the season closes — the identities the two screens are held to', () => {
  const records: SeasonDuesRecords = {
    schedules: [
      { playerId: 'avery', total: 700 },
      { playerId: 'blake', total: 970.83 },
      { playerId: 'casey', total: 900 },
    ],
    payments: [
      { playerId: 'avery', amount: 1250 },
      { playerId: 'blake', amount: 692 },
      { playerId: 'casey', amount: 1200 },
    ],
    /* ⚠ Blake and Casey have both had money handed back — the case that makes these identities
       worth asserting, since a repaid credit must stop counting on BOTH sides at once. */
    payouts: [
      { playerId: 'blake', amount: 100 },
      { playerId: 'casey', amount: 300 },
    ],
    credits: [
      { playerId: 'avery', kind: 'fundraiser', amount: 75.25, traced: true },
      { playerId: 'avery', kind: 'reimbursement', amount: 200, traced: true },
      { playerId: 'avery', kind: 'fundraiser', amount: 50, traced: true },
      { playerId: 'avery', kind: 'reimbursement', amount: 180, traced: true },
      { playerId: 'avery', kind: 'fundraiser', amount: 72.9, traced: true },
      { playerId: 'avery', kind: 'overpayment', amount: 550, traced: false },
      { playerId: 'avery', kind: 'other', amount: 17, traced: false },
      { playerId: 'blake', kind: 'fundraiser', amount: 150, traced: true },
      { playerId: 'blake', kind: 'reimbursement', amount: 59.98, traced: true },
      { playerId: 'casey', kind: 'fundraiser', amount: 37.5, traced: true },
      { playerId: 'casey', kind: 'overpayment', amount: 300, traced: false },
    ],
  };

  it('⚠⚠ Dues − (Collected − owed back) = Balance owing — the band closes', () => {
    const b = seasonDuesBand(records);
    assert.equal(cents(b.duesNet - (b.contributed - b.owedBack)), cents(b.balanceOwing));
  });

  it('Dues − Balance owing = Bills settled — the Overview card ties to the band', () => {
    const b = seasonDuesBand(records);
    assert.equal(cents(b.duesNet - b.balanceOwing), cents(b.settled));
  });

  it('⚠⚠ Collected IS the Statement’s Player dues actual — two derivations, one number', () => {
    const b = seasonDuesBand(records);
    const statement = seasonDuesActual([...buildFamilyDuesInputs(records).values()]);
    assert.equal(cents(b.contributed), cents(statement));
  });

  it('the gross bill less what was written off it IS the bill the band shows', () => {
    const b = seasonDuesBand(records);
    assert.equal(cents(b.duesGross - b.billLowered.total), cents(b.duesNet));
    assert.equal(b.billLowered.adjustment, 17);
    assert.equal(b.billLowered.forgiven, 0);
  });

  it('⚠ Bills settled is capped FAMILY BY FAMILY, never season-wide', () => {
    /* One household overshooting may not settle another household's bill. Netted season-wide the
       card would read the season as further paid down than any family actually is. */
    const b = seasonDuesBand({
      schedules: [{ playerId: 'over', total: 100 }, { playerId: 'under', total: 100 }],
      payments: [{ playerId: 'over', amount: 300 }],
      payouts: [],
      credits: [{ playerId: 'over', kind: 'overpayment', amount: 200, traced: true }],
    });
    assert.equal(b.settled, 100);       // `over` settles its own bill and no more
    assert.equal(b.duesNet, 200);
    assert.equal(b.balanceOwing, 100);
    assert.equal(cents(b.settled + b.balanceOwing), cents(b.duesNet));
  });

  it('⚠ the bar can never pass 100% — what the rename to Bills settled exists to guarantee', () => {
    /* A team that fundraises hard: credits far beyond the bills. `Collected` runs past `Dues`
       (R2, deliberately) and `Bills settled` still cannot. */
    const b = seasonDuesBand({
      schedules: [{ playerId: 'p', total: 100 }],
      payments: [],
      payouts: [],
      credits: [{ playerId: 'p', kind: 'fundraiser', amount: 900, traced: true }],
    });
    assert.ok(b.contributed > b.duesNet, 'Collected is uncapped and may exceed the bill');
    assert.ok(b.settled <= b.duesNet, 'Bills settled may never exceed the bill');
    assert.equal(b.settled, 100);
  });

  it('⚠ a season with no dues at all is zero everywhere, not a division by nothing', () => {
    const b = seasonDuesBand({ schedules: [], payments: [], payouts: [], credits: [] });
    assert.equal(b.duesNet, 0);
    assert.equal(b.contributed, 0);
    assert.equal(b.settled, 0);
    assert.equal(b.balanceOwing, 0);
    assert.equal(b.billLowered.total, 0);
  });
});
