import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creditApplication, schedulePaysCents, type ClubInstallmentFacts } from '../../lib/club-money-figures.ts';
import { askSundayLine, askedSlots, fairBill, type ScheduleAsk, type ScheduleView } from '../../lib/club-schedule-view.ts';
import { HAND_BACK_WORDS as H } from '../../lib/club-hand-back-words.ts';
import { moneyCents } from '../../lib/club-schedule-words.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 11d, PART B — THE SCHEDULE'S PAGE: THE DRAWINGS' NUMBERS (hub K4MPu4ni53Ct7yrDcmWJd9 → Stage 11d,
 * specimen 3 "The club sees it", `#s11d-club-page` and `#s11d-club-plain`; /design D1, D4). The dome: a Sunday is $108.00
 * (90 minutes of a full field at $72.00 an hour); 15U AA was billed $2,700.00 — Oct 1 $972.00 · Dec 1 $864.00 · Feb 1
 * $864.00 — and asks for its four March Sundays, $432.00 back. Ten teams: Senior three at $2,700.00, Junior four at
 * $4,050.00, UAT Test Team $2,700.00 — $27,000.00.
 *
 *   · FAIR SHARES' BILL once the bill is made is what the team PAYS (the Not-drawn row, read whole): a plain hand-back
 *     $2,700.00 (⚠ the frame printed $2,268.00 beside its own note's $2,700.00 — S11D-05 itself; the build reads the
 *     Not-drawn row); an accepted ask $2,268.00 whichever way it settled; a club move the loser $108.00 less.
 *   · THE RINGED SUNDAYS (D1): a waiting ask's live Sundays; a late ask rings none (its time is already open).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

type Inst = ClubInstallmentFacts & { id: string; installmentNumber: number };
const PAID = { paidAt: '2026-10-13T15:00:00Z', paidOn: '2026-10-13' };
const bill = (over: Partial<Record<'oct' | 'dec' | 'feb', Partial<Inst>>> = {}): Inst[] => [
  { id: 'oct', installmentNumber: 1, amount: 972, credited: 0, dueDate: '2026-10-01', paidAt: null, sentAt: null, ...over.oct },
  { id: 'dec', installmentNumber: 2, amount: 864, credited: 0, dueDate: '2026-12-01', paidAt: null, sentAt: null, ...over.dec },
  { id: 'feb', installmentNumber: 3, amount: 864, credited: 0, dueDate: '2027-02-01', paidAt: null, sentAt: null, ...over.feb },
];
/** A credit written onto the payments as the database step writes it (`club_credit_apply`), and what is left to pay. */
const settle = (insts: Inst[], figure: number) => {
  const app = creditApplication(insts, figure);
  return { insts: insts.map(i => ({ ...i, credited: i.credited + (app.parts.find(p => p.installmentId === i.id)?.amount ?? 0) })), toPay: app.toPay, credited: app.credited };
};
/** The ask's request after Accept, as `club_hand_back_accept` leaves it: `credited` when nothing is left to pay, else
 *  `accepted` for what the club owes (later `approved` when it records paying). */
const requestAfter = (s: { toPay: number; credited: number }, paid = false) => (s.toPay === 0
  ? { status: 'credited', amount: s.credited }
  : { status: paid ? 'approved' : 'accepted', amount: s.toPay });

describe('Fair shares’ Bill once the bill is made: what the team pays, as Money › Club reads it (Not drawn: Fair shares; D4)', () => {
  it('a plain hand-back asks for nothing: 15U AA’s Bill stays $2,700.00 (not the frame’s $2,268.00)', () => {
    assert.equal(schedulePaysCents(bill({ oct: PAID }), []), 270_000);
  });
  it('an accepted ask while 15U AA owes: $432.00 off its Feb 1 payment — $2,268.00', () => {
    const s = settle(bill({ oct: PAID }), 432);
    assert.equal(s.credited, 432);
    assert.equal(s.toPay, 0);
    assert.equal(schedulePaysCents(s.insts, [requestAfter(s)]), 226_800, 'a credited request moved no money: the credit already says it');
  });
  it('an accepted ask after 15U AA paid all of it: the club owes $432.00 — $2,268.00, waiting or recorded paid', () => {
    const s = settle(bill({ oct: PAID, dec: PAID, feb: PAID }), 432);
    assert.equal(s.credited, 0);
    assert.equal(s.toPay, 432);
    assert.equal(schedulePaysCents(s.insts, [requestAfter(s)]), 226_800, 'accepted, still to pay');
    assert.equal(schedulePaysCents(s.insts, [requestAfter(s, true)]), 226_800, 'recorded paid');
  });
  it('a club move at Send the changes: the team that lost a Sunday pays $108.00 less, owing or paid', () => {
    const owing = settle(bill({ oct: PAID }), 108);
    assert.equal(schedulePaysCents(owing.insts, [requestAfter(owing)]), 259_200);
    const paid = settle(bill({ oct: PAID, dec: PAID, feb: PAID }), 108);
    assert.equal(schedulePaysCents(paid.insts, [requestAfter(paid)]), 259_200);
  });
  it('a waiting, declined or withdrawn ask changes nothing', () => {
    for (const status of ['pending', 'denied', 'withdrawn']) assert.equal(schedulePaysCents(bill(), [{ status, amount: 432 }]), 270_000, status);
  });
  it('a correction billed for time gained adds to it (its own bill in the pool)', () => {
    const correction: Inst = { id: 'c', installmentNumber: 1, amount: 108, credited: 0, dueDate: '2027-02-01', paidAt: null, sentAt: null };
    assert.equal(schedulePaysCents([...bill(), correction], []), 280_800);
  });
});

/** The dome's ten teams, as the page reads them once the bill is made (`pays`). */
const DOME: Record<string, number> = {
  'u14aa': 270_000, 'u15aa': 270_000, 'u15aaa': 270_000,
  'u9aa': 405_000, 'u11aa': 405_000, 'u12aa': 405_000, 'u13aaa': 405_000, 'uat': 270_000,
};
const view = (over: Partial<Pick<ScheduleView, 'pays' | 'bill' | 'pricing' | 'slots' | 'teamOrder'>>) =>
  ({ pays: null, bill: null, pricing: null, slots: [], teamOrder: [], ...over }) as Pick<ScheduleView, 'pays' | 'bill' | 'pricing' | 'slots' | 'teamOrder'>;
const total = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

describe('the panel’s total follows its rows (the band’s The bill)', () => {
  it('a plain hand-back: $27,000.00 — the frame drew $26,568.00', () => {
    const m = fairBill(view({ pays: { ...DOME } }));
    assert.equal(m.get('u15aa'), 270_000);
    assert.equal(moneyCents(total(m)), '$27,000.00');
  });
  it('an accepted ask: $26,568.00, 15U AA $2,268.00', () => {
    const m = fairBill(view({ pays: { ...DOME, u15aa: 226_800 } }));
    assert.equal(moneyCents(m.get('u15aa')!), '$2,268.00');
    assert.equal(moneyCents(total(m)), '$26,568.00');
  });
  it('before Finalize the column is the bill riding with the schedule, never the money side', () => {
    const riding = { teams: [{ teamId: 'u15aa', cents: 270_000, pricedHours: 37.5, installments: [] }] } as unknown as ScheduleView['bill'];
    assert.deepEqual([...fairBill(view({ bill: riding }))], [['u15aa', 270_000]]);
    assert.equal(fairBill(view({})).size, 0, 'a reader without money reads no Bill');
  });
});

const ask = (over: Partial<ScheduleAsk>): ScheduleAsk => ({
  id: 'a1', teamId: 'u15aa', teamName: '15U AA', late: false, askedOn: '2026-10-12', handedBackOn: null, askedBy: 'Sam Whitford',
  cents: 43_200, count: 4, weekday: 7,
  sundays: ['2027-03-07', '2027-03-14', '2027-03-21', '2027-03-28'].map((d, i) => ({ slotId: `s${i + 1}`, startsAt: `${d}T${i === 0 ? '14' : '13'}:30:00Z`, venueId: 'dome', facilityId: 'f1' })),
  ...over,
});

describe('the ask on the schedule’s page (specimen 3; D1)', () => {
  it('its Sundays are ringed, a late ask’s are not (their time is already open), and a slot two asks reach reads the older', () => {
    const late = ask({ id: 'late', late: true, askedOn: '2026-10-10', sundays: [{ slotId: 'x', startsAt: '2027-02-07T14:30:00Z', venueId: 'dome', facilityId: 'f1' }] });
    const other = ask({ id: 'a2', teamId: 'u11aa', teamName: '11U AA', askedOn: '2026-10-14', sundays: [{ slotId: 's1', startsAt: '2027-03-07T14:30:00Z', venueId: 'dome', facilityId: 'f1' }] });
    const ringed = askedSlots([other, ask({}), late]);
    assert.deepEqual([...ringed.keys()].sort(), ['s1', 's2', 's3', 's4']);
    assert.equal(ringed.get('s1')!.id, 'a1', 'the older ask');
    assert.equal(ringed.has('x'), false);
  });
  it('the callout reads as drawn', () => {
    const places = [{ venueId: 'dome', venueName: 'Lakeshore Dome', facilities: [{ id: 'f1', name: 'Field 1' }] }];
    const a = ask({});
    assert.equal(H.calloutHead(a), '15U AA asks to hand back 4 Sundays, with $432.00 back');
    assert.deepEqual(a.sundays.map(s => askSundayLine(s, places)),
      ['Sun, Mar 7, 9:30 a.m. · Field 1', 'Sun, Mar 14, 9:30 a.m. · Field 1', 'Sun, Mar 21, 9:30 a.m. · Field 1', 'Sun, Mar 28, 9:30 a.m. · Field 1']);
    assert.equal(H.calloutTail(a, true), 'Asked by Sam Whitford on Oct 12. The Sundays stay 15U AA’s until you answer.');
  });
  it('without the club’s Accounting the figure is left out (part A’s bell leaves it out the same way)', () => {
    assert.equal(H.calloutHead(ask({ cents: null })), '15U AA asks to hand back 4 Sundays, with money back');
    // Never "until you answer" beside "someone else answers it" (/marketing 2026-10-16): part A's bell sentence.
    assert.equal(H.calloutTail(ask({ cents: null }), false), 'Asked by Sam Whitford on Oct 12. The Sundays stay 15U AA’s until someone who holds the club’s Accounting answers.');
  });
  it('a late ask reads the money only, and says its time is already open', () => {
    const a = ask({ late: true, askedOn: '2026-10-18', handedBackOn: '2026-10-16' });
    assert.equal(H.calloutHeadLate(a), '15U AA asks for $432.00 back for 4 Sundays it handed back');
    assert.equal(H.calloutTailLate(a, true), 'Asked by Sam Whitford on Oct 18. 15U AA handed them back on Oct 16: their time is already open, and your answer moves only the money.');
    assert.equal(H.calloutTailLate(a, false), 'Asked by Sam Whitford on Oct 18. 15U AA handed them back on Oct 16: their time is already open, and only the money waits for someone who holds the club’s Accounting.');
  });
  it('the slot window names which team asked', () => {
    assert.equal(H.slotAsked(ask({})), '15U AA asked on Oct 12 to hand back this Sunday and 3 others, with $432.00 back.');
  });
  it('Fair shares’ note (D4), as drawn', () => {
    assert.equal(H.keptNote({ teamName: '15U AA', count: 4, weekday: 7, cents: 270_000, asked: 'none', billMoved: false }),
      '15U AA handed back 4 Sundays without asking for money: its bill stays $2,700.00.');
    // Money already came off for other Sundays (dev's 15U AA: an accepted ask, then 6 Sundays without money): never "stays".
    assert.equal(H.keptNote({ teamName: '15U AA', count: 6, weekday: 7, cents: 226_800, asked: 'none', billMoved: true }),
      '15U AA handed back 6 Sundays without asking for money: it still pays for them ($2,268.00 in all).');
  });
});
