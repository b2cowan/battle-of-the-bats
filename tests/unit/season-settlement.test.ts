/**
 * The season settlement sheet (lib/season-settlement.ts) — pinned behaviours:
 *
 *  - the owner's own five scenarios, on his own numbers (plan §4.4), including the two the old
 *    calculator got wrong: the pot is $1,525 (not $90, and not $1,575 — rebates were never income
 *    to remove), and $200 forgiven drops that family out of the split at $169.44 to nine;
 *  - debt joins the pot and a family's share cancels most of it (Call 7);
 *  - a departed player keeps their own money and takes no share (Call 8);
 *  - a shortfall states itself and shares NOTHING (Call 9);
 *  - hold-back cannot reach owed-back money;
 *  - paying one family does NOT move anyone else's share — the failure that would make every
 *    number an opinion that changed while the coach worked down the list;
 *  - and the promise the whole sheet rests on, under a seeded pseudo-random storm of rosters:
 *      Σ refunds + what stays with the team + hold-back = the cash the team holds.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deriveSettlement,
  solveEvenLevel,
  type SettlementParticipant,
} from '../../lib/season-settlement';

/** The review team's cash, verified against the live fixture (plan §2). */
const U15_CASH = {
  duesReceived: 6050,       // UNCAPPED — the $50 overpayment physically arrived
  fundraisingRaised: 2500,  // the FULL amount raised: the books receive all of it
  orgFunding: 0,
  cashOut: 6350,
  payoutsTotal: 0,
  holdBack: 0,
};

/** The ten families' owed-back money: $675 in total, nothing applied, nothing paid out. */
const U15_OWED = [0, 0, 15, 30, 45, 60, 75, 155, 125, 170];

function player(over: Partial<SettlementParticipant> & { playerId: string }): SettlementParticipant {
  return {
    onRoster: true,
    creditsIssued: over.owedBack ?? 0,
    owedBack: 0,
    leftToSend: 0,
    forgiven: 0,
    paidOut: 0,
    choice: 'even',
    ...over,
  };
}

function u15Players(over: Array<Partial<SettlementParticipant>> = []): SettlementParticipant[] {
  return U15_OWED.map((owed, i) =>
    player({ playerId: `p${i}`, owedBack: owed, creditsIssued: owed, ...(over[i] ?? {}) }));
}

const cents = (n: number) => Math.round(n * 100);

describe('the pot derives, and shows its work', () => {
  it('the review team: $2,200 held, $675 owed, $1,525 to share', () => {
    const s = deriveSettlement({ cash: U15_CASH, participants: u15Players() });
    assert.equal(s.pot.cashHeld, 2200);
    assert.equal(s.pot.owedBack, 675);
    assert.equal(s.pot.surplus, 1525);
    // ⚠ NOT $90 (the old calculator subtracted the rebates a second time) and NOT $1,575 (the
    // figure that had the team's 75% share taken out of income it never lost).
    assert.equal(s.rows[0].cashShare, 152.5);
    assert.equal(s.totals.refund, 2200);
  });

  it('every row re-adds to the pot, to the cent', () => {
    const s = deriveSettlement({ cash: U15_CASH, participants: u15Players() });
    assert.equal(s.totals.owedBack, 675);
    assert.equal(s.totals.cashShare, 1525);
    assert.equal(s.unallocated, 0);
    assert.equal(s.awaitingCash, 0);
  });

  it('a hold-back comes out of the surplus and is capped there', () => {
    const s = deriveSettlement({
      cash: { ...U15_CASH, holdBack: 500 },
      participants: u15Players(),
    });
    assert.equal(s.pot.holdBack, 500);
    assert.equal(s.pot.surplus, 1025);
    assert.equal(s.rows[0].cashShare, 102.5);
    assert.equal(s.totals.refund, 1700); // 2,200 held − 500 kept back
  });

  it('hold-back can never reach the money the team owes families', () => {
    const s = deriveSettlement({
      cash: { ...U15_CASH, holdBack: 99999 },
      participants: u15Players(),
    });
    assert.equal(s.pot.holdBackCap, 1525);
    assert.equal(s.pot.holdBack, 1525, 'clamped at the surplus — never into the $675 owed');
    assert.equal(s.totals.owedBack, 675, 'still owed in full');
    assert.equal(s.totals.refund, 675);
  });
});

describe('the owner’s five scenarios (plan §4.4)', () => {
  it('1 — no debts, no forgiveness: $152.50 each', () => {
    const s = deriveSettlement({ cash: U15_CASH, participants: u15Players() });
    for (const r of s.rows) assert.equal(r.cashShare, 152.5);
  });

  it('2 — a family owes $200: the pot grows, shares rise, their share cancels most of the debt', () => {
    const s = deriveSettlement({
      cash: U15_CASH,
      participants: u15Players([{}, {}, {}, {}, {}, {}, {}, {}, {}, { leftToSend: 200 }]),
    });
    assert.equal(s.pot.expectedIn, 200);
    assert.equal(s.pot.surplus, 1725);
    assert.equal(s.rows[0].cashShare, 172.5);
    // Wynn owes $200, is owed $170, takes a $172.50 share ⇒ $142.50 back to them.
    assert.equal(s.rows[9].refund, 142.5);
  });

  it('2b — a family who owes and is owed nothing nets NEGATIVE: still owes, never a payout', () => {
    const s = deriveSettlement({
      cash: U15_CASH,
      participants: [
        ...u15Players(),
        player({ playerId: 'zeb', leftToSend: 200 }),
      ],
    });
    assert.equal(s.pot.surplus, 1725);
    const zeb = s.rows.find(r => r.playerId === 'zeb')!;
    // $1,725 over eleven takers is $156.81 with nine cents left over, which land on the last row.
    assert.equal(s.rows[0].cashShare, 156.81);
    assert.equal(zeb.cashShare, 156.9);
    assert.ok(zeb.refund < 0, 'a negative refund is a debt, shown as "still owes"');
    assert.equal(zeb.refund, -43.1);
    // ⚠ THE CASH-TIMING CONSEQUENCE, surfaced rather than discovered at the bank: the cheques
    // total more than the team is holding until that family pays.
    assert.equal(s.awaitingCash, 43.1);
  });

  it('3 — $20 forgiven: they still get a cheque, just a smaller one', () => {
    const s = deriveSettlement({
      cash: U15_CASH,
      participants: u15Players([{}, {}, {}, {}, {}, {}, {}, {}, {}, { forgiven: 20 }]),
    });
    assert.equal(s.rows[0].cashShare, 154.5, 'everyone else rises to $154.50');
    assert.equal(s.rows[9].cashShare, 134.5, 'their $20 is part of their $154.50');
    assert.equal(s.rows[9].benefit, 154.5);
    assert.equal(s.totals.cashShare, 1525, 'the surplus is fully distributed');
  });

  it('4 — $200 forgiven: more than a share, so they drop out and nine take $169.44', () => {
    const s = deriveSettlement({
      cash: U15_CASH,
      participants: u15Players([{}, {}, {}, {}, {}, {}, {}, {}, {}, { forgiven: 200 }]),
    });
    assert.equal(s.rows[9].cashShare, 0, 'no cash at all — the forgiveness was their share');
    assert.equal(s.rows[0].cashShare, 169.44);
    // The pennies that don't divide land on the LAST row, so the total still reads $1,525.00.
    assert.equal(s.rows[8].cashShare, 169.48);
    assert.equal(s.totals.cashShare, 1525);
  });

  it('5 — a family declines: $169.44 to nine, and they still receive their own $125', () => {
    const s = deriveSettlement({
      cash: U15_CASH,
      participants: u15Players([{}, {}, {}, {}, {}, {}, {}, {}, { choice: 'none' }]),
    });
    const vera = s.rows[8];
    assert.equal(vera.cashShare, 0);
    assert.equal(vera.owedBack, 125);
    assert.equal(vera.refund, 125, 'owed-back money is never touched by a distribution choice');
    assert.equal(s.rows[0].cashShare, 169.44);
    assert.equal(s.totals.cashShare, 1525, 'the declined share raised the others — never stranded');
    assert.equal(s.unallocated, 0);
  });
});

describe('hand-set amounts (owner Call 10)', () => {
  it('a set amount comes off the top and the rest redistributes immediately', () => {
    const s = deriveSettlement({
      cash: U15_CASH,
      participants: u15Players([{ choice: 'fixed', fixedAmount: 400 }]),
    });
    assert.equal(s.rows[0].cashShare, 400);
    // $1,125 over the other nine.
    assert.equal(s.rows[1].cashShare, 125);
    assert.equal(s.totals.cashShare, 1525);
    assert.equal(s.unallocated, 0, 'the sheet is never left holding a remainder');
  });

  it('a set amount replaces the SHARE and never the owed-back money', () => {
    const s = deriveSettlement({
      cash: U15_CASH,
      participants: u15Players([{}, {}, {}, {}, {}, {}, {}, {}, { choice: 'fixed', fixedAmount: 0 }]),
    });
    assert.equal(s.rows[8].cashShare, 0);
    assert.equal(s.rows[8].refund, 125, 'their own $125 is still theirs');
  });

  it('set amounts beyond the pot are clamped — the rows can never promise more than it holds', () => {
    const s = deriveSettlement({
      cash: U15_CASH,
      participants: u15Players([{ choice: 'fixed', fixedAmount: 9999 }]),
    });
    assert.equal(s.rows[0].cashShare, 1525);
    assert.equal(s.totals.cashShare, 1525);
  });

  it('everyone declining leaves the surplus with the team, and says so', () => {
    const s = deriveSettlement({
      cash: U15_CASH,
      participants: u15Players().map(p => ({ ...p, choice: 'none' as const })),
    });
    assert.equal(s.totals.cashShare, 0);
    assert.equal(s.unallocated, 1525);
    assert.equal(s.totals.refund, 675, 'only the families’ own money goes out');
  });
});

describe('a departed player (owner Call 8)', () => {
  it('keeps their own money and takes no share, raising everyone else’s', () => {
    const s = deriveSettlement({
      cash: U15_CASH,
      participants: u15Players([{}, {}, {}, {}, {}, {}, {}, {}, {}, { onRoster: false }]),
    });
    const gone = s.rows[9];
    assert.equal(gone.cashShare, 0);
    assert.equal(gone.owedBack, 170);
    assert.equal(gone.refund, 170, 'owed-back follows whoever earned it');
    assert.equal(s.rows[0].cashShare, 169.44, 'nine shares, never a stranded tenth');
    assert.equal(s.totals.cashShare, 1525);
  });
});

describe('a shortfall states itself (owner Call 9)', () => {
  it('shares nothing and pro-rates nothing', () => {
    const s = deriveSettlement({
      cash: { ...U15_CASH, cashOut: 8175 }, // cash held $375 against $675 owed
      participants: u15Players(),
    });
    assert.equal(s.pot.cashHeld, 375);
    assert.equal(s.pot.shortfall, 300);
    assert.equal(s.pot.surplus, 0);
    assert.equal(s.totals.cashShare, 0);
    // Every family's earned rebate is still promised IN FULL — nothing is quietly shrunk.
    assert.equal(s.totals.refund, 675);
    assert.equal(s.awaitingCash, 300, 'the cheques exceed the cash, and the sheet says so');
  });
});

describe('paying a family out', () => {
  it('does NOT move anyone else’s share, and the paid row stops asking', () => {
    const before = deriveSettlement({ cash: U15_CASH, participants: u15Players() });
    assert.equal(before.rows[7].refund, 307.5); // $155 owed back + $152.50 share

    // The same world, after that family is handed their whole $307.50.
    const after = deriveSettlement({
      cash: { ...U15_CASH, payoutsTotal: 307.5 },
      participants: u15Players([{}, {}, {}, {}, {}, {}, {},
        { owedBack: 0, creditsIssued: 155, paidOut: 307.5 }]),
    });
    assert.equal(after.pot.cashHeld, 1892.5, 'the cash really did leave');
    assert.equal(after.pot.sharePaid, 152.5, 'the share portion is added back to the pot');
    assert.equal(after.pot.surplus, 1525, '⚠ unchanged — nobody else’s number moved');
    assert.equal(after.rows[0].cashShare, 152.5);
    assert.equal(after.rows[7].refund, 0);
    assert.equal(after.rows[7].settled, true);
    assert.equal(after.totals.refund, 1892.5, 'the rows still re-add to the cash on hand');
  });

  it('⚠ settling the WHOLE team leaves every row at zero, not owing money back', () => {
    // The defect this pins: paying everyone can take more cash out than the team is holding
    // (a forward-looking split spends money still owed BY a family — the sheet warns about it).
    // Asking "is the team short of what it owes families?" against the raw bank balance then
    // flipped to YES, collapsed every share to nothing, and turned all ten families the coach
    // had just paid into families who suddenly owed the money back. The pot is measured BEFORE
    // distribution, so it survives its own settlement.
    const before = deriveSettlement({ cash: U15_CASH, participants: u15Players() });
    const paid = before.rows.map(r => r.refund);
    const after = deriveSettlement({
      cash: { ...U15_CASH, payoutsTotal: before.totals.payable },
      participants: u15Players().map((p, i) => ({
        ...p,
        owedBack: 0,                       // their credits went out with the cheque
        paidOut: paid[i],
      })),
    });
    assert.equal(after.pot.shortfall, 0, 'a settled team is not a team in debt');
    assert.equal(after.pot.surplus, 1525, 'the pot still reads what there was to share');
    for (const r of after.rows) {
      assert.equal(r.refund, 0, `${r.playerId} should be square, not owed or owing`);
      assert.equal(r.settled, true);
    }
    assert.equal(after.totals.payable, 0, 'nothing left to pay');
  });

  it('paying only OWED-BACK money leaves the surplus untouched', () => {
    const s = deriveSettlement({
      cash: { ...U15_CASH, payoutsTotal: 155 },
      participants: u15Players([{}, {}, {}, {}, {}, {}, {},
        { owedBack: 0, creditsIssued: 155, paidOut: 155 }]),
    });
    assert.equal(s.pot.sharePaid, 0);
    assert.equal(s.pot.surplus, 1525);
    assert.equal(s.rows[7].refund, 152.5, 'their share is still to come');
  });
});

describe('the water-filling level', () => {
  it('one player takes the lot', () => {
    assert.equal(solveEvenLevel([0], 15250), 15250);
  });
  it('everyone already settled above the level takes nothing', () => {
    assert.equal(solveEvenLevel([100000, 100000], 0), 0);
  });
  it('an empty roster has no level', () => {
    assert.equal(solveEvenLevel([], 15250), 0);
  });
  it('a zero pool is a zero level', () => {
    assert.equal(solveEvenLevel([0, 0, 0], 0), 0);
  });
});

describe('degenerate worlds stay honest', () => {
  it('no participants at all', () => {
    const s = deriveSettlement({ cash: U15_CASH, participants: [] });
    assert.equal(s.rows.length, 0);
    assert.equal(s.totals.refund, 0);
    assert.equal(s.unallocated, 2200, 'nothing to distribute it to — it stays with the team');
  });

  it('a season with no money at all', () => {
    const s = deriveSettlement({
      cash: { duesReceived: 0, fundraisingRaised: 0, orgFunding: 0, cashOut: 0, payoutsTotal: 0, holdBack: 0 },
      participants: [player({ playerId: 'a' })],
    });
    assert.equal(s.pot.surplus, 0);
    assert.equal(s.totals.refund, 0);
    assert.equal(s.awaitingCash, 0);
  });

  it('everyone forgiven more than the pot: nobody takes cash, nothing is lost', () => {
    const s = deriveSettlement({
      cash: U15_CASH,
      participants: u15Players().map(p => ({ ...p, forgiven: 1000 })),
    });
    assert.equal(s.totals.cashShare, 1525, 'the level rises above every settled amount');
    for (const r of s.rows) assert.equal(r.cashShare, 152.5);
  });
});

// ── The promise, under a storm ───────────────────────────────────────────────────────────────
// A property test rather than more examples: the identity has to hold for worlds nobody thought
// to write down. Seeded so a failure is reproducible.
describe('Σ refunds + what stays with the team + hold-back = the cash the team holds', () => {
  it('holds across 500 randomised rosters', () => {
    let seed = 987654321;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const money = (max: number) => Math.round(rnd() * max * 100) / 100;

    for (let run = 0; run < 500; run++) {
      const n = 1 + Math.floor(rnd() * 12);
      const participants: SettlementParticipant[] = [];
      for (let i = 0; i < n; i++) {
        const creditsIssued = money(300);
        const paidOut = rnd() < 0.25 ? Math.min(creditsIssued + money(200), 99999) : 0;
        const owedBack = Math.max(0, Math.round((creditsIssued - paidOut) * 100) / 100);
        const choiceRoll = rnd();
        participants.push({
          playerId: `p${i}`,
          onRoster: rnd() > 0.15,
          creditsIssued,
          owedBack,
          leftToSend: rnd() < 0.3 ? money(400) : 0,
          forgiven: rnd() < 0.2 ? money(300) : 0,
          paidOut,
          choice: choiceRoll < 0.1 ? 'none' : choiceRoll < 0.2 ? 'fixed' : 'even',
          fixedAmount: money(300),
        });
      }
      const cash = {
        duesReceived: money(9000),
        fundraisingRaised: money(4000),
        orgFunding: rnd() < 0.2 ? money(1000) : 0,
        cashOut: money(9000),
        payoutsTotal: Math.round(participants.reduce((s, p) => s + p.paidOut * 100, 0)) / 100,
        holdBack: rnd() < 0.3 ? money(800) : 0,
      };
      const s = deriveSettlement({ cash, participants });

      const lhs = cents(s.totals.refund) + cents(s.unallocated) + cents(s.pot.holdBack);
      if (s.pot.shortfall > 0) {
        // In a shortfall nothing is shared, so the sheet deliberately does NOT balance to the
        // cash — it is stating a debt. What must still hold: it promises no share money at all.
        assert.equal(s.totals.cashShare, 0, `run ${run}: a shortfall shared something`);
        continue;
      }
      assert.equal(
        lhs,
        cents(s.pot.cashHeld),
        `run ${run}: rows ${s.totals.refund} + kept ${s.unallocated} + held back ${s.pot.holdBack} ≠ cash ${s.pot.cashHeld}`,
      );
      // And the total is always the sum of the rows — never a second, unclamped arithmetic.
      const rowSum = s.rows.reduce((acc, r) => acc + cents(r.refund), 0);
      assert.equal(rowSum, cents(s.totals.refund), `run ${run}: the total is not the sum of its rows`);
    }
  });
});
