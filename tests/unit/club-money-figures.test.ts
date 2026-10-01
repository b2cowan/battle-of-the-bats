import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COMING_DUE_DAYS, bookBalance, bookWindow, clubBillChip, clubBillFigures, clubInstallmentDaysLate,
  clubInstallmentLeftTeamOn, clubInstallmentReceivedOn, clubInstallmentState, clubInstallmentWaitingOnClub,
  comingDueBand, remindsAbout, signedAmount, teamAccount, type BookLineFacts, type ClubInstallmentFacts,
} from '../../lib/club-money-figures.ts';
import { LEDGER_KIND_WORD, isSourcedLine, ledgerExportRows, lineType } from '../../lib/club-ledger.ts';

/**
 * Club Tier Stage 3a — the ONE definition of every club money figure (lib/club-money-figures.ts),
 * and the ledger's line rules (lib/club-ledger.ts). Each `it` names the ruling it pins.
 */

const TODAY = '2026-09-30';
const inst = (over: Partial<ClubInstallmentFacts> = {}): ClubInstallmentFacts => ({
  amount: 450, dueDate: '2026-10-15', paidAt: null, sentAt: null, sentOn: null, paidOn: null, ...over,
});

describe('an installment has ONE state, the same on both sides (Ask 1)', () => {
  it('received when the club has it; sent when the coach says so; overdue / upcoming otherwise', () => {
    assert.equal(clubInstallmentState(inst({ paidAt: '2026-09-28T15:00:00Z' }), TODAY), 'received');
    assert.equal(clubInstallmentState(inst({ sentAt: '2026-09-29T15:00:00Z', sentOn: '2026-09-29' }), TODAY), 'sent');
    assert.equal(clubInstallmentState(inst({ dueDate: '2026-09-15' }), TODAY), 'overdue');
    assert.equal(clubInstallmentState(inst({ dueDate: '2026-10-15' }), TODAY), 'upcoming');
  });
  it('due TODAY is not overdue (the house-day rule the Upcoming bills panel already had)', () => {
    assert.equal(clubInstallmentState(inst({ dueDate: TODAY }), TODAY), 'upcoming');
  });
  it('a SENT installment is never overdue, whatever its date — the club is the one who must act', () => {
    const late = inst({ dueDate: '2026-09-01', sentAt: '2026-09-29T15:00:00Z', sentOn: '2026-09-29' });
    assert.equal(clubInstallmentState(late, TODAY), 'sent');
    assert.equal(clubInstallmentDaysLate(late, TODAY), 0);
    assert.equal(comingDueBand(late, TODAY), 'sent');
    assert.equal(remindsAbout(late, TODAY), false, 'a reminder never chases money the team has sent');
  });
  it('received wins over sent (a confirmed payment keeps the coach\'s note as history)', () => {
    assert.equal(clubInstallmentState(inst({ paidAt: '2026-09-30T12:00:00Z', sentAt: '2026-09-29T12:00:00Z', sentOn: '2026-09-29' }), TODAY), 'received');
  });
  it('days late counts calendar days in the club\'s day', () => {
    assert.equal(clubInstallmentDaysLate(inst({ dueDate: '2026-09-15' }), TODAY), 15);
  });
});

describe('the coach\'s cash side of the same fact (ruled 2026-09-30, question 1)', () => {
  it('money left the team on the SENT day, whether or not the club has confirmed', () => {
    assert.equal(clubInstallmentLeftTeamOn(inst({ sentAt: '2026-09-29T23:30:00Z', sentOn: '2026-09-28' })), '2026-09-28');
    assert.equal(clubInstallmentWaitingOnClub(inst({ sentAt: '2026-09-29T23:30:00Z', sentOn: '2026-09-28' })), true);
  });
  it('a club-recorded payment left on the day the club recorded it came; a pre-3a one on its stamp', () => {
    assert.equal(clubInstallmentLeftTeamOn(inst({ paidAt: '2026-09-28T15:00:00Z', paidOn: '2026-09-25' })), '2026-09-25');
    // 2026-09-29T02:00Z is the evening of Sep 28 in Toronto — the club's day, never UTC.
    assert.equal(clubInstallmentLeftTeamOn(inst({ paidAt: '2026-09-29T02:00:00Z' })), '2026-09-28');
    assert.equal(clubInstallmentReceivedOn(inst({ paidAt: '2026-09-29T02:00:00Z' })), '2026-09-28');
  });
  it('nothing has left while it is unpaid and unsent', () => {
    assert.equal(clubInstallmentLeftTeamOn(inst()), null);
    assert.equal(clubInstallmentWaitingOnClub(inst()), false);
  });
});

describe('ONE definition per figure (S3A-05, C06, J4-019)', () => {
  const bill = [
    inst({ amount: 450, dueDate: '2026-08-15', paidAt: '2026-08-14T12:00:00Z' }),                     // received
    inst({ amount: 450, dueDate: '2026-09-15' }),                                                      // overdue
    inst({ amount: 300, dueDate: '2026-09-10', sentAt: '2026-09-29T12:00:00Z', sentOn: '2026-09-29' }), // sent
    inst({ amount: 360, dueDate: '2026-10-01' }),                                                      // due soon
    inst({ amount: 450, dueDate: '2026-10-15' }),                                                      // upcoming, outside 14 days? Oct 15 = 15 days
  ];
  const f = clubBillFigures(bill, TODAY);
  it('Collected = what the club RECEIVED; Outstanding = billed − collected (a sent one still owed)', () => {
    assert.equal(f.billed, 2010);
    assert.equal(f.collected, 450);
    assert.equal(f.outstanding, 1560);
  });
  it('Overdue, Sent and Due soon are each their own count and amount', () => {
    assert.deepEqual(f.overdue, { count: 1, amount: 450 });
    assert.deepEqual(f.sent, { count: 1, amount: 300 });
    assert.deepEqual(f.dueSoon, { count: 1, amount: 360 });
  });
  it(`the window is ${COMING_DUE_DAYS} days, inclusive`, () => {
    const edge = clubBillFigures([inst({ dueDate: '2026-10-14' }), inst({ dueDate: '2026-10-15' })], TODAY);
    assert.equal(edge.dueSoon.count, 1);
  });
  it('Next due = the earliest UPCOMING installment (never an overdue or sent one), same-day amounts summed', () => {
    assert.deepEqual(f.nextDue, { dueDate: '2026-10-01', amount: 360 });
    const twin = clubBillFigures([inst({ dueDate: '2026-10-01', amount: 100 }), inst({ dueDate: '2026-10-01', amount: 50 })], TODAY);
    assert.deepEqual(twin.nextDue, { dueDate: '2026-10-01', amount: 150 });
  });
  it('the chip says the one thing that matters, club-chasable first', () => {
    assert.equal(clubBillChip(f), 'overdue');
    assert.equal(clubBillChip(clubBillFigures([inst({ sentAt: 'x', sentOn: '2026-09-29' })], TODAY)), 'sent');
    assert.equal(clubBillChip(clubBillFigures([inst({ dueDate: '2026-10-05' })], TODAY)), 'due_soon');
    assert.equal(clubBillChip(clubBillFigures([inst({ dueDate: '2026-12-05' })], TODAY)), 'upcoming');
    assert.equal(clubBillChip(clubBillFigures([inst({ paidAt: 'x' })], TODAY)), 'paid_in_full');
  });
  it('sums in cents (no float drift across many installments)', () => {
    const many = Array.from({ length: 30 }, () => inst({ amount: 0.1, paidAt: 'x' }));
    assert.equal(clubBillFigures(many, TODAY).collected, 3);
  });
});

describe('a team\'s account with the club (Ask 5a)', () => {
  const account = teamAccount(
    [{
      splitId: 's1', allocationId: 'a1', allocationDescription: 'Diamond fees 2026', programYearId: 'py26',
      billedOn: '2026-08-01', amount: 1350,
      installments: [
        { ...inst({ amount: 450, dueDate: '2026-08-15', paidAt: '2026-08-14T12:00:00Z', paidOn: '2026-08-14' }), id: 'i1', installmentNumber: 1 },
        { ...inst({ amount: 450, dueDate: '2026-09-15', paidAt: '2026-09-28T12:00:00Z', paidOn: '2026-09-28' }), id: 'i2', installmentNumber: 2 },
        { ...inst({ amount: 450, dueDate: '2026-10-15' }), id: 'i3', installmentNumber: 3 },
      ],
    }],
    [
      { id: 'r1', programYearId: 'py26', requestType: 'charge_to_org', status: 'approved', amount: 120, description: 'Umpire clinic', decidedOn: '2026-09-05' },
      { id: 'r2', programYearId: 'py26', requestType: 'charge_to_org', status: 'reversed', amount: 500, description: 'Reversed', decidedOn: '2026-09-04' },
      { id: 'r3', programYearId: 'py26', requestType: 'payment_to_org', status: 'pending', amount: 80, description: 'Waiting', decidedOn: null },
    ],
    ['py26'],
    TODAY,
  );
  const rows = account.seasons[0].rows;
  it('Outstanding is a running figure, and paying the team never changes it', () => {
    assert.equal(account.outstanding, 450);
    assert.equal(account.outstanding, account.figures.outstanding, 'the statement closes on the figure');
    const paid = rows.find(r => r.kind === 'paid_to_team')!;
    const before = rows[rows.indexOf(paid) + 1];   // rows read newest first
    assert.equal(paid.outstanding, before.outstanding);
  });
  it('only DECIDED money is a row: a reversed or waiting request is not', () => {
    assert.equal(rows.filter(r => r.kind === 'paid_to_team').length, 1);
    assert.equal(account.paidToTeam, 120);
    assert.equal(rows.some(r => r.sourceId === 'r2' || r.sourceId === 'r3'), false);
  });
  it('a received row says how late it came; the statement reads newest first', () => {
    const late = rows.find(r => r.installmentId === 'i2')!;
    assert.equal(late.daysLate, 13);
    assert.ok(rows[0].date >= rows[rows.length - 1].date);
  });
});

describe('a book: one Balance, a true Starting balance, every row (C14)', () => {
  const line = (id: string, entryDate: string, amount: number, entryType: BookLineFacts['entryType'], status: BookLineFacts['status'] = 'posted'): BookLineFacts =>
    ({ id, entryDate, createdAt: `${entryDate}T12:00:00Z`, amount, entryType, status });
  const book = [
    line('a', '2026-08-01', 1000, 'income'),
    line('b', '2026-08-20', 200, 'expense'),
    line('c', '2026-09-03', 300, 'expense'),
    line('d', '2026-09-10', 450, 'transfer_in'),
    line('e', '2026-09-26', 640, 'expense', 'pending'),
    line('f', '2026-09-18', 240, 'expense', 'void'),
  ];
  it('the Balance is all-time, posted only (a pending cheque and a void move nothing)', () => {
    assert.equal(bookBalance(book), 950);
  });
  it('the window carries everything before it as the Starting balance', () => {
    const w = bookWindow(book, { from: '2026-09-01', to: '2026-09-30' });
    assert.equal(w.startingBalance, 800);
    assert.equal(w.endingBalance, 950);
    assert.equal(w.balance, 950);
    assert.deepEqual(w.counts, { posted: 2, pending: 1, void: 1 });
  });
  it('a pending line shows the balance before it; a void line shows none', () => {
    const w = bookWindow(book, { from: '2026-09-01' });
    assert.equal(w.rows.find(r => r.line.id === 'e')!.balance, 950);
    assert.equal(w.rows.find(r => r.line.id === 'f')!.balance, null);
  });
  it('rows run oldest first, whatever order they were read in', () => {
    const w = bookWindow([...book].reverse());
    assert.deepEqual(w.rows.map(r => r.line.id), ['a', 'b', 'c', 'd', 'f', 'e']);
  });
  it('walks past 1,000 rows (the silent cap it replaces) and its window balances still agree', () => {
    const big: BookLineFacts[] = Array.from({ length: 2500 }, (_, i) =>
      line(`x${String(i).padStart(5, '0')}`, `2026-0${1 + Math.floor(i / 400)}-1${i % 9}`, 1, i % 3 === 0 ? 'expense' : 'income'));
    const w = bookWindow(big, { from: '2026-04-01' });
    assert.equal(bookBalance(big), big.reduce((acc, l) => acc + (l.entryType === 'income' ? 1 : -1), 0));
    const inWindow = w.rows.reduce((acc, r) => acc + (r.line.entryType === 'income' ? 1 : -1), 0);
    assert.equal(w.startingBalance + inWindow, w.endingBalance);
    assert.equal(w.endingBalance, w.balance);
  });
  it('an empty window ends where it started', () => {
    const w = bookWindow(book, { from: '2027-01-01' });
    assert.equal(w.rows.length, 0);
    assert.equal(w.endingBalance, w.startingBalance);
  });
});

describe('the export: whole period, one signed Amount, voids kept and out of the totals (C14)', () => {
  const out = ledgerExportRows([
    { date: '2026-09-03', what: 'Insurance', detail: null, category: 'Insurance', type: 'expense', moneyIn: null, moneyOut: 3200, status: 'posted', recordedBy: 'Priya', voidReason: null },
    { date: '2026-09-10', what: 'Allocation received · 9U A', detail: 'E-Transfer 3307', category: 'Team allocations', type: 'team_allocations', moneyIn: 450, moneyOut: null, status: 'posted', recordedBy: 'Priya', voidReason: null },
    { date: '2026-09-18', what: 'Umpire clinic', detail: null, category: null, type: 'expense', moneyIn: null, moneyOut: 240, status: 'void', recordedBy: 'Priya', voidReason: 'Entered twice' },
    { date: '2026-09-26', what: 'Umpires', detail: 'Cheque 2230', category: 'Officials', type: 'expense', moneyIn: null, moneyOut: 640, status: 'pending', recordedBy: null, voidReason: null },
  ]);
  it('signs the amount: + in, − out', () => {
    assert.deepEqual(out.rows.map(r => r.amount), [-3200, 450, -240, -640]);
    assert.equal(signedAmount({ amount: 5, entryType: 'transfer_out' }), -5);
  });
  it('marks a void VOID with its reason and leaves it (and a pending line) out of the totals', () => {
    assert.equal(out.rows[2].status, 'VOID');
    assert.match(String(out.rows[2].detail), /Void: Entered twice/);
    assert.equal(out.rows[3].status, 'PENDING');
    assert.deepEqual(out.totals, { moneyIn: 450, moneyOut: 3200, net: -2750 });
  });
});

describe('a ledger line knows where it came from (C12, C14)', () => {
  it('the badge knows four kinds', () => {
    assert.deepEqual(Object.values(LEDGER_KIND_WORD), ['Club', 'Tournament', 'Team', 'House league']);
  });
  it('an allocation or a request line is its Type, by source and by the pre-3a key', () => {
    assert.equal(lineType({ entryType: 'transfer_in', category: 'Team allocations', sourceModule: 'rep_allocation_installment' }), 'team_allocations');
    assert.equal(lineType({ entryType: 'transfer_in', category: 'rep_allocation', sourceModule: null }), 'team_allocations');
    assert.equal(lineType({ entryType: 'transfer_out', category: 'team_charge_to_org', sourceModule: null }), 'team_support');
    assert.equal(lineType({ entryType: 'income', category: 'registration_fee', sourceModule: 'league_registration' }), 'house_league_fees');
    assert.equal(lineType({ entryType: 'transfer_out', category: 'Float', sourceModule: null }), 'transfer');
    assert.equal(lineType({ entryType: 'expense', category: 'Team allocations', sourceModule: null }), 'expense', 'a hand entry with a look-alike word is still a hand entry');
  });
  it('a line from an allocation, a request or a fee is changed only at its source', () => {
    assert.equal(isSourcedLine({ entryType: 'income', category: 'registration_fee', sourceModule: 'league_registration' }), true);
    assert.equal(isSourcedLine({ entryType: 'transfer_in', category: 'team_payment_to_org', sourceModule: null }), true);
    assert.equal(isSourcedLine({ entryType: 'transfer_in', category: 'Float', sourceModule: null }, true), true, 'named as an installment\'s link');
    assert.equal(isSourcedLine({ entryType: 'expense', category: 'Insurance', sourceModule: null }), false);
  });
});
