import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clubBillFigures, clubInstallmentDue, clubInstallmentState, comingDueBand, creditApplication, lineAllocated, remindsAbout,
  requestWaitsOnClub, teamAccount, waitingOnYou, type AccountBill, type ClubInstallmentFacts,
} from '../../lib/club-money-figures.ts';
import { slotFigure } from '../../lib/club-schedule-bill.ts';
import { HAND_BACK_WORDS as H, creditMovesSentence, namePractices } from '../../lib/club-hand-back-words.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 11d, PART A — A HAND-BACK THAT ASKS FOR MONEY BACK: THE DRAWINGS' NUMBERS (hub
 * K4MPu4ni53Ct7yrDcmWJd9 → Stage 11d). The dome (walk §300): a Sunday is 90 minutes of a full field at the permit's
 * $72.00 an hour — the schedule's rate is 120 cents a full-field minute — so a Sunday is $108.00 and 15U AA's four March
 * Sundays are $432.00. 15U AA was billed $2,700.00: Oct 1 $972.00 · Dec 1 $864.00 · Feb 1 $864.00.
 *
 * Every case asserts PER PAYMENT as well as the totals — two mistakes in opposite directions hide each other in a total
 * (Coach Money credits, 2026-09-07).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const TODAY = '2026-10-14';
type Inst = ClubInstallmentFacts & { id: string; installmentNumber: number };
const bill = (over: Partial<Record<'oct' | 'dec' | 'feb', Partial<Inst>>> = {}): Inst[] => [
  { id: 'oct', installmentNumber: 1, amount: 972, credited: 0, dueDate: '2026-10-01', paidAt: null, sentAt: null, ...over.oct },
  { id: 'dec', installmentNumber: 2, amount: 864, credited: 0, dueDate: '2026-12-01', paidAt: null, sentAt: null, ...over.dec },
  { id: 'feb', installmentNumber: 3, amount: 864, credited: 0, dueDate: '2027-02-01', paidAt: null, sentAt: null, ...over.feb },
];
const PAID = { paidAt: '2026-10-13T15:00:00Z', paidOn: '2026-10-13' };
/** The application, written onto the payments as the database step writes it (`club_credit_apply`). */
const applied = (insts: Inst[], figure: number): Inst[] => {
  const { parts } = creditApplication(insts, figure);
  return insts.map(i => ({ ...i, credited: i.credited + (parts.find(p => p.installmentId === i.id)?.amount ?? 0) }));
};

describe('the figure (Ask 1): the Sundays at what the club billed for each', () => {
  it('a Sunday is $108.00: 90 minutes × a full field × 120 cents a minute', () => {
    assert.deepEqual(slotFigure({ startMs: 0, endMs: 90 * 60_000, weight: 1, teams: 1, scale: 120 }), { pricedMinutes: 90, cents: 10_800 });
  });
  it('four March Sundays are $432.00', () => {
    const one = slotFigure({ startMs: 0, endMs: 90 * 60_000, weight: 1, teams: 1, scale: 120 }).cents;
    assert.equal(one * 4, 43_200);
  });
  it('a shared slot asks for the team\'s half (Stage 11c: a shared slot counts half)', () => {
    assert.equal(slotFigure({ startMs: 0, endMs: 90 * 60_000, weight: 1, teams: 2, scale: 120 }).cents, 5_400);
  });
  it('a half facility, and a schedule that billed nothing', () => {
    assert.equal(slotFigure({ startMs: 0, endMs: 90 * 60_000, weight: 0.5, teams: 1, scale: 120 }).cents, 5_400);
    assert.equal(slotFigure({ startMs: 0, endMs: 90 * 60_000, weight: 1, teams: 1, scale: null }).cents, 0);
  });
});

describe('Accept while the team still owes (Ask 5): off its latest payment first, nothing else to do', () => {
  const before = bill({ oct: PAID });
  const app = creditApplication(before, 432);
  it('$432.00 comes off Feb 1 alone — $864.00 → $432.00; Dec 1 untouched; nothing to pay', () => {
    assert.deepEqual(app.parts, [{ installmentId: 'feb', amount: 432 }]);
    assert.equal(app.credited, 432);
    assert.equal(app.toPay, 0);
    const after = applied(before, 432);
    assert.equal(clubInstallmentDue(after[2]), 432);
    assert.equal(clubInstallmentDue(after[1]), 864);
    assert.equal(clubInstallmentDue(after[0]), 972);
  });
  it('the bill reads Billed $2,700.00 · Credited $432.00 · Paid $972.00 · Left $1,296.00 · Next due Dec 1 $864.00', () => {
    const f = clubBillFigures(applied(before, 432), TODAY);
    assert.equal(f.billed, 2700);
    assert.equal(f.credited, 432);
    assert.equal(f.collected, 972);
    assert.equal(f.outstanding, 1296);
    assert.deepEqual(f.nextDue, { dueDate: '2026-12-01', amount: 864 });
  });
  it('the statement words it exactly as drawn (D2: "Accept opens …")', () => {
    const w = H.statementOwes({ what: namePractices(4, 7), teamName: '15U AA', cents: 43_200, moves: [{ dueDate: '2027-02-01', fromCents: 86_400, toCents: 43_200 }] });
    assert.equal(w.lead, 'Accept opens the 4 Sundays and takes $432.00 off what 15U AA owes.');
    assert.equal(w.rest, 'Its Feb 1 payment drops from $864.00 to $432.00. Nothing more for you to do.');
  });
  it('a credit that covers a whole payment reaches the next one back', () => {
    const app2 = creditApplication(before, 1000);
    assert.deepEqual(app2.parts, [{ installmentId: 'feb', amount: 864 }, { installmentId: 'dec', amount: 136 }]);
    assert.equal(creditMovesSentence([{ dueDate: '2027-02-01', fromCents: 86_400, toCents: 0 }, { dueDate: '2026-12-01', fromCents: 86_400, toCents: 72_800 }]),
      'Its Dec 1 payment drops from $864.00 to $728.00 and its Feb 1 payment of $864.00 is covered.');
  });
});

describe('Accept after the team paid all $2,700.00 (Ask 5): a request to pay, no credit', () => {
  const app = creditApplication(bill({ oct: PAID, dec: PAID, feb: PAID }), 432);
  it('nothing comes off; the club owes $432.00', () => {
    assert.deepEqual(app.parts, []);
    assert.equal(app.credited, 0);
    assert.equal(app.toPay, 432);
  });
  it('the statement says the club owes it, waiting in Payment requests', () => {
    const w = H.statementPaid({ what: namePractices(4, 7), teamName: '15U AA', cents: 43_200 });
    assert.equal(w.lead, 'Accept opens the 4 Sundays. 15U AA has paid its bill, so the club owes it $432.00.');
    assert.equal(w.rest, 'It waits in Payment requests until you record paying it.');
  });
});

describe('Accept when the team owes $200.00 (Ask 5): both at once — never owing less than nothing', () => {
  const owing200: Inst[] = [
    { id: 'a', installmentNumber: 1, amount: 2500, credited: 0, dueDate: '2026-10-01', paidAt: PAID.paidAt, sentAt: null },
    { id: 'b', installmentNumber: 2, amount: 200, credited: 0, dueDate: '2027-02-01', paidAt: null, sentAt: null },
  ];
  const app = creditApplication(owing200, 432);
  it('$200.00 credited, $232.00 to pay', () => {
    assert.deepEqual(app.parts, [{ installmentId: 'b', amount: 200 }]);
    assert.equal(app.credited, 200);
    assert.equal(app.toPay, 232);
    const f = clubBillFigures(applied(owing200, 432), TODAY);
    assert.equal(f.outstanding, 0);
    assert.equal(f.paidInFull, true);
  });
  it('the statement says both', () => {
    const w = H.statementBoth({ what: namePractices(4, 7), teamName: '15U AA', creditCents: 20_000, payCents: 23_200 });
    assert.equal(w.lead, 'Accept opens the 4 Sundays, takes $200.00 off what 15U AA still owes, and the club owes it the other $232.00.');
    assert.equal(w.rest, '15U AA has nothing left to pay on it; the $232.00 waits in Payment requests until you record paying it.');
  });
});

describe('a SENT payment counts as paid for a credit (the build\'s reading — said in the hand-off)', () => {
  it('Feb 1 sent, Dec 1 owed: the $432.00 comes off Dec 1, never the money on its way', () => {
    const app = creditApplication(bill({ oct: PAID, feb: { sentAt: '2026-10-13T15:00:00Z', sentOn: '2026-10-13' } }), 432);
    assert.deepEqual(app.parts, [{ installmentId: 'dec', amount: 432 }]);
  });
  it('everything sent or paid: the whole figure is a request to pay', () => {
    const sent = { sentAt: '2026-10-13T15:00:00Z', sentOn: '2026-10-13' };
    const app = creditApplication(bill({ oct: PAID, dec: sent, feb: sent }), 432);
    assert.equal(app.credited, 0);
    assert.equal(app.toPay, 432);
  });
});

describe('a payment a credit covers WHOLE reads Credited (Ask 6)', () => {
  const covered = applied(bill({ oct: PAID }), 864)[2];
  it('its state is credited: never overdue, never reminded, never next', () => {
    assert.equal(clubInstallmentState(covered, '2027-03-01'), 'credited');
    assert.equal(comingDueBand(covered, '2027-03-01'), null);
    assert.equal(remindsAbout(covered, '2027-01-25'), false);
    assert.equal(clubBillFigures([covered], '2027-03-01').overdue.count, 0);
  });
  it('a payment it LOWERS is reminded at its new amount', () => {
    const lowered = applied(bill({ oct: PAID }), 432)[2];
    assert.equal(remindsAbout(lowered, '2027-01-25'), true);
    assert.equal(clubInstallmentDue(lowered), 432);
  });
});

describe('the team\'s statement (Ask 6): a Credit row of its own, the Billed row untouched', () => {
  const insts = applied(bill({ oct: PAID }), 432);
  const account = teamAccount([{
    splitId: 'split-15u', allocationId: 'alloc-dome', allocationDescription: 'Winter dome · Sundays', programYearId: 'py',
    billedOn: '2026-10-12', amount: 2700,
    installments: insts as AccountBill['installments'],
    credits: [{ id: 'cr-1', on: '2026-10-14', amount: 432, description: '4 Sundays handed back', by: 'u-morgan', source: 'hand_back' }],
  }], [], ['py'], TODAY);
  const rows = account.seasons[0].rows.slice().reverse();
  it('Billed $2,700.00 · Received $972.00 · Credit −$432.00 — Outstanding $1,296.00', () => {
    assert.deepEqual(rows.map(r => r.kind), ['billed', 'received', 'credit']);
    assert.equal(rows[0].billed, 2700);
    assert.equal(rows[1].collected, 972);
    assert.equal(rows[2].credited, 432);
    assert.equal(rows[2].date, '2026-10-14');
    assert.equal(rows[2].creditReason, '4 Sundays handed back');
    assert.equal(rows[2].outstanding, 1296);
    assert.equal(account.outstanding, 1296);
  });
  it('the statement closes on the figures\' Outstanding, by construction', () => {
    assert.equal(account.outstanding, account.figures.outstanding);
  });
  it('its words: "Credit · Winter dome · Sundays" over "4 Sundays handed back, accepted by Morgan Ellis"', () => {
    assert.equal(H.creditEntry('Winter dome · Sundays'), 'Credit · Winter dome · Sundays');
    assert.equal(H.creditEntrySub({ reason: '4 Sundays handed back', by: 'Morgan Ellis', source: 'hand_back' }), '4 Sundays handed back, accepted by Morgan Ellis');
  });
  it('a payment received after a credit lowered it collects its due', () => {
    const received = { ...insts[2], ...PAID };
    const f = clubBillFigures([insts[0], insts[1], received], TODAY);
    assert.equal(f.collected, 972 + 432);
    assert.equal(f.outstanding, 864);
  });
});

describe('every figure that reads a bill reads billed less credited (Ask 6)', () => {
  it('a line\'s Allocated nets its credits (Not allocated grows by the open time)', () => {
    assert.equal(lineAllocated('dome', [{ sourceBudgetLineId: 'dome', splits: [{ amount: 2700, credited: 432 }, { amount: 2700, credited: 0 }] }]), 4968);
  });
  it('waiting on the club: unanswered or accepted-to-pay; Credited is closed', () => {
    assert.equal(requestWaitsOnClub('pending'), true);
    assert.equal(requestWaitsOnClub('accepted'), true);
    assert.equal(requestWaitsOnClub('credited'), false);
    assert.equal(requestWaitsOnClub('approved'), false);
    assert.deepEqual(waitingOnYou([{ status: 'pending', amount: 260 }, { status: 'accepted', amount: 432 }, { status: 'credited', amount: 432 }]), { count: 2, amount: 692 });
  });
});

describe('the words, as drawn', () => {
  it('one practice reads as one — never "the 1 Sunday are open" (words pass, 2026-10-13)', () => {
    const one = namePractices(1, 7);
    assert.equal(H.statementPaid({ what: one, teamName: '15U AA', cents: 10_800 }).lead, 'Accept opens the Sunday. 15U AA has paid its bill, so the club owes it $108.00.');
    assert.equal(H.quietLine({ what: one, cents: 10_800, lineName: null }), 'Unless another team takes this Sunday, the club recovers $108.00 less of the permit’s cost.');
    assert.equal(H.declined('15U AA', one), 'Declined. The Sunday stays 15U AA’s, and their coaches are told.');
    assert.equal(H.acceptedOwes('15U AA', namePractices(4, 7), 43_200), 'Accepted. The 4 Sundays are open and $432.00 came off what 15U AA owes. Their coaches are told.');
  });
  it('the tick and its line (specimen 1)', () => {
    assert.equal(H.tick(43_200), 'Ask the club for $432.00 back');
    assert.equal(H.tickLine({ count: 4, weekday: 7, eachCents: 10_800, teamName: '15U AA' }),
      '4 Sundays at $108.00 each, what the club billed 15U AA for them. The club answers first: until it does, the practices stay yours.');
    assert.equal(H.requestName(4, 7), 'Hand back 4 Sundays');
  });
  it('what was asked, at the practice\'s end (specimen 2)', () => {
    assert.equal(H.askedLine({ askedOn: '2026-10-12', count: 4, first: '2027-03-07', last: '2027-03-28', cents: 43_200 }),
      'You asked the club on Oct 12 to hand back 4 practices, Mar 7 – Mar 28, with $432.00 back. It hasn’t answered yet; until it does, they’re yours.');
  });
  it('the paid bill row (specimen 5) and Record paying (D6)', () => {
    assert.equal(H.lessCredit(86_400, 43_200), '$864.00 less a $432.00 credit');
    assert.equal(H.creditNote('2026-10-14', '4 Sundays handed back'), 'Credit Oct 14: 4 Sundays handed back');
    assert.equal(H.recordPayingTitle('15U AA', 43_200), 'Record paying 15U AA $432.00');
    assert.equal(H.recordPayingButton(43_200), 'Record $432.00 paid');
    assert.equal(H.acceptedToPay('2026-10-14'), 'Accepted Oct 14 · to pay');
  });
  it('Send the changes credits the team that lost a Sunday off its Feb 1 (specimen 6; D7 plain)', () => {
    assert.equal(H.lostLine({ teamName: '15U AA', creditCents: 10_800, payCents: 0, moves: [{ dueDate: '2027-02-01', fromCents: 86_400, toCents: 75_600 }] }),
      '$108.00 comes off what 15U AA owes: its Feb 1 payment.');
    assert.equal(H.billCorrectionsOn, 'A team that gained time gets a small bill for it, and a team that lost time has it taken off what it owes, on the same budget line.');
  });
  it('a credit the club\'s changes wrote names its Sundays, never the club\'s button (owner, §308 W5 2026-10-16)', () => {
    assert.equal(H.reasonChanges(['2027-01-10']), 'Sun, Jan 10, moved by the club');
    assert.equal(H.reasonChanges(['2027-02-07', '2027-01-10', '2027-01-17', '2027-01-10']), 'Sun, Jan 10, Jan 17 and Feb 7, moved by the club');
    assert.equal(H.reasonChanges(['2027-01-09', '2027-01-10']), 'Sat, Jan 9 and Sun, Jan 10, moved by the club');
    assert.equal(H.reasonChanges(['2027-01-10', '2027-01-17', '2027-01-24', '2027-01-31', '2027-02-07', '2027-02-28']),
      '6 Sundays, Jan 10 – Feb 28, moved by the club');
    assert.equal(H.reasonChanges([]), 'Time moved by the club');
    assert.equal(H.creditNote('2026-10-16', H.reasonChanges(['2027-01-10'])), 'Credit Oct 16: Sun, Jan 10, moved by the club');
    assert.equal(H.creditEntrySub({ reason: H.reasonChanges(['2027-01-10']), by: 'Morgan Ellis', source: 'changes' }),
      'Sun, Jan 10, moved by the club, sent by Morgan Ellis');
    assert.equal(H.creditedByClub, 'Moved by the club');
  });
});
