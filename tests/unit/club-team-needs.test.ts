import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { earlierYearLines, owedRows, teamNeedsYou, teamsByGroup, type NeedsYouRequestFacts } from '../../lib/club-team-needs.ts';
import { OUTSIDE_YOUR_GROUPS_WORD } from '../../lib/club-money-words.ts';
import { requestAskedAmount } from '../../lib/club-money-figures.ts';
import type { RepAllocationInstallment } from '../../lib/types.ts';

/**
 * Club Accounting · Teams (owner, ruled 2026-10-16) — a team's "Needs you" (Ask 5) and the Teams table's earlier year's
 * line (Ask 8 + correction C2), run over the one reading of "still owed" (`owedRows`). Pure: no database.
 */

const TODAY = '2026-10-16';

let n = 0;
function inst(over: Partial<RepAllocationInstallment> & { dueDate: string; amount: number }): RepAllocationInstallment {
  n++;
  return {
    id: `i-${n}`, splitId: 's', installmentNumber: 1, credited: 0, paidAt: null, paidOn: null, paidBy: null, paidMethod: null,
    paidReference: null, sentAt: null, sentOn: null, sentBy: null, sentMethod: null, sentReference: null,
    undoneAt: null, undoneBy: null, undoneReason: null, accountingEntryId: null, ...over,
  } as RepAllocationInstallment;
}

/** One team ("11U AA"), two bills: Diamond fees (three payments) and Winter dome (one), plus a team outside the reader's groups. */
function loop() {
  const diamond = [
    inst({ installmentNumber: 1, amount: 450, dueDate: '2026-08-23' }),                                             // late
    inst({ installmentNumber: 2, amount: 450, dueDate: '2026-09-22', sentAt: '2026-09-22T12:00:00Z', sentOn: '2026-09-22' }), // sent
    inst({ installmentNumber: 3, amount: 450, dueDate: '2026-10-22' }),                                              // upcoming
  ];
  const dome = [
    inst({ installmentNumber: 1, amount: 1458, dueDate: '2026-10-01' }),                                            // late
    inst({ installmentNumber: 2, amount: 1458, dueDate: '2026-09-01', paidAt: '2026-09-02T12:00:00Z', paidOn: '2026-09-02' }), // received
    inst({ installmentNumber: 3, amount: 1458, dueDate: '2026-09-15', credited: 1458 }),                            // credited whole
  ];
  const permit = [inst({ installmentNumber: 2, amount: 600, dueDate: '2025-07-15' })];                              // a closed year's, late
  const other = [inst({ installmentNumber: 1, amount: 99, dueDate: '2026-08-01' })];
  return {
    teams: new Map([
      ['t11', { id: 't11', name: '11U AA', groupId: null, groupName: 'Junior', isArchived: false }],
      ['t99', { id: 't99', name: 'Senior Secret', groupId: null, groupName: 'Senior', isArchived: false }],
    ]),
    splits: [
      { id: 'sd', allocationId: 'diamond', teamId: 't11', programYearId: 'py', amount: 1350, paymentSchedule: 'x', installments: diamond },
      { id: 'sw', allocationId: 'dome', teamId: 't11', programYearId: 'py', amount: 4374, paymentSchedule: 'x', installments: dome },
      { id: 'sp', allocationId: 'permit', teamId: 't11', programYearId: 'py0', amount: 1200, paymentSchedule: 'x', installments: permit },
      { id: 'so', allocationId: 'diamond', teamId: 't99', programYearId: 'py9', amount: 99, paymentSchedule: 'x', installments: other },
    ],
  };
}
const ALLOCATIONS = [
  { id: 'diamond', description: 'Diamond fees 2026 (city fields)' },
  { id: 'dome', description: 'Winter dome · Sundays' },
  { id: 'permit', description: 'Permit share 2025–26' },
];
const CLOSED = { key: '2025-09-01', name: '2025–26' };

describe('owedRows — the one reading of "still owed"', () => {
  const rows = owedRows(loop(), ALLOCATIONS, () => true, TODAY, null);
  it('received and credited-whole are never owed; late, sent and upcoming are', () => {
    const t11 = rows.filter(r => r.teamId === 't11');
    assert.deepEqual(t11.map(r => [r.allocationDescription, r.installmentNumber, r.state]).sort(), [
      ['Diamond fees 2026 (city fields)', 1, 'overdue'],
      ['Diamond fees 2026 (city fields)', 2, 'sent'],
      ['Diamond fees 2026 (city fields)', 3, 'upcoming'],
      ['Permit share 2025–26', 2, 'overdue'],
      ['Winter dome · Sundays', 1, 'overdue'],
    ].sort());
  });
  it('days late are the server\'s count (Aug 23 → Oct 16 is 54); a part-credited payment owes what is left', () => {
    const late = rows.find(r => r.teamId === 't11' && r.allocationDescription.startsWith('Diamond') && r.state === 'overdue')!;
    assert.equal(late.daysLate, 54);
    const l = loop();
    l.splits[1].installments[0] = { ...l.splits[1].installments[0], credited: 458 };
    assert.equal(owedRows(l, ALLOCATIONS, () => true, TODAY, null).find(r => r.splitId === 'sw')!.amount, 1000);
  });
  it('B11 — a team outside the reader\'s groups is counted, never named', () => {
    const scoped = owedRows(loop(), ALLOCATIONS, () => true, TODAY, new Set(['t11']));
    const outside = scoped.filter(r => r.teamId === 't99');
    assert.equal(outside.length, 1);
    assert.equal(outside[0].teamName, OUTSIDE_YOUR_GROUPS_WORD);
    assert.ok(!scoped.some(r => r.teamName === 'Senior Secret'));
  });
  it('the year filter keeps only the bills it is asked about (the close question, the closed years)', () => {
    assert.deepEqual(owedRows(loop(), ALLOCATIONS, a => a.id === 'permit', TODAY, null).map(r => r.allocationId), ['permit']);
  });
});

describe('a team\'s Needs you (Ask 5)', () => {
  const owed = owedRows(loop(), ALLOCATIONS, () => true, TODAY, null).filter(r => r.teamId === 't11');
  const requests: NeedsYouRequestFacts[] = [
    { id: 'r-late', status: 'pending', description: 'Tournament refund — the club’s share', amount: 180, filedOn: '2026-09-25', askedBy: 'Priya Nair', holdingPayout: true, closedYear: null },
    { id: 'r-old', status: 'accepted', description: 'Hand back 4 Sundays', amount: 40, filedOn: '2025-08-01', askedBy: null, holdingPayout: false, closedYear: CLOSED },
    { id: 'r-done', status: 'approved', description: 'Paid long ago', amount: 500, filedOn: '2026-05-01', askedBy: 'X', holdingPayout: false, closedYear: null },
    { id: 'r-no', status: 'denied', description: 'Declined', amount: 70, filedOn: '2026-06-01', askedBy: 'X', holdingPayout: false, closedYear: null },
  ];
  const needs = teamNeedsYou({ owed, closedYearOf: id => (id === 'permit' ? CLOSED : null), requests });

  it('late (oldest first), then sent, then requests waiting on the club (oldest first) — nothing upcoming, nothing decided', () => {
    assert.deepEqual(needs.rows.map(r => r.kind === 'request' ? `request:${r.key}` : `${r.kind}:${r.allocationDescription}`), [
      'late:Permit share 2025–26', 'late:Diamond fees 2026 (city fields)', 'late:Winter dome · Sundays',
      'sent:Diamond fees 2026 (city fields)',
      'request:r-old', 'request:r-late',
    ]);
  });
  it('its count and total are the rows\' own, in cents', () => {
    assert.equal(needs.count, 6);
    assert.equal(needs.amount, 600 + 450 + 1458 + 450 + 40 + 180);
  });
  it('a closed year\'s row says so — the bill by its year rule, the request by the year it was filed in', () => {
    const permit = needs.rows.find(r => r.kind === 'late' && r.allocationDescription.startsWith('Permit'))!;
    assert.deepEqual(permit.closedYear, CLOSED);
    assert.equal(needs.rows.find(r => r.kind === 'late' && r.allocationDescription.startsWith('Winter'))!.closedYear, null);
    assert.deepEqual(needs.rows.find(r => r.key === 'r-old')!.closedYear, CLOSED);
  });
  it('a request holding up the team\'s payout carries it; each row carries its door', () => {
    const r = needs.rows.find(x => x.key === 'r-late')!;
    assert.equal(r.kind === 'request' && r.holdingPayout, true);
    assert.deepEqual(r.door, { request: 'r-late' });
    const bill = needs.rows.find(x => x.kind === 'sent')!;
    assert.deepEqual(bill.door, { bill: { allocationId: 'diamond', splitId: 'sd' } });
  });
  it('nothing waits → nothing to show (the card is absent)', () => {
    const none = teamNeedsYou({ owed: owed.filter(o => o.state === 'upcoming'), closedYearOf: () => null, requests: requests.slice(2) });
    assert.deepEqual([none.count, none.amount, none.rows.length], [0, 0, 0]);
  });
});

describe('the Teams table\'s earlier year\'s line (Ask 8 + C2 — any earlier year, closed or not, owner 2026-10-16)', () => {
  const y24 = { key: '2024-09-01', name: '2024–25' };
  const y25 = { key: '2025-09-01', name: '2025–26' };
  const y26 = { key: '2026-09-01', name: '2026–27' };
  const due = (dueDate: string, amount: number, over: Partial<RepAllocationInstallment> = {}) => inst({ dueDate, amount, ...over });
  const bills = [
    { year: y25, teamId: 'a', installments: [due('2026-07-15', 600), due('2026-06-15', 600, { paidAt: '2026-06-10T12:00:00Z', paidOn: '2026-06-10' })] },
    { year: y25, teamId: 'b', installments: [due('2026-11-01', 300), due('2026-08-01', 300, { sentAt: '2026-08-01T12:00:00Z', sentOn: '2026-08-01' })] },
    { year: y24, teamId: 'c', installments: [due('2026-12-01', 100)] },
    { year: y25, teamId: 'c', installments: [due('2026-08-15', 50), due('2026-08-20', 70, { credited: 70 })] },
    { year: y26, teamId: 'd', installments: [due('2026-10-01', 999)] },
  ];
  const lines = earlierYearLines(bills, y26.key, TODAY);
  it('red and "overdue" while any of it is late; quiet otherwise; received and credited-whole money is not owed', () => {
    assert.deepEqual(lines.get('a'), [{ yearKey: y25.key, yearName: '2025–26', amount: 600, late: true }]);
    assert.deepEqual(lines.get('b'), [{ yearKey: y25.key, yearName: '2025–26', amount: 600, late: false }], 'sent is owed, not late');
  });
  it('one line per earlier year, oldest first', () => {
    assert.deepEqual(lines.get('c')!.map(l => [l.yearName, l.amount, l.late]), [['2024–25', 100, false], ['2025–26', 50, true]]);
  });
  it('never the year on screen, nor a later one — picking 2025–26 on the Year pill shows its money in the row, not twice', () => {
    assert.equal(lines.has('d'), false);
    assert.equal(earlierYearLines(bills, y25.key, TODAY).has('a'), false);
    assert.equal(earlierYearLines(bills, y25.key, TODAY).has('d'), false, 'a later year is no earlier year');
  });
  it('the board summary carries each team\'s lines, from its own allocations — the year rule, closed or not, no new read', () => {
    const report = readFileSync('lib/club-budget-report.ts', 'utf8');
    assert.match(report, /const earlier = earlierYearLines\(allocations\.flatMap\(a => \{\s*const y = fiscalYearOf\(allocationYearKey\(a, input\.setting\), input\.setting\);/);
    assert.match(report, /earlier: earlier\.get\(t\.teamId\) \?\? \[\],/);
  });
});

describe('one group order for the Teams table and the Team pill (Asks 1 and 2)', () => {
  it('groups by name, "No group" last; teams by name with numbers in order', () => {
    const t = (teamName: string, groupName: string | null) => ({ teamName, groupName });
    const groups = teamsByGroup([t('UAT Test Team', null), t('14U AA', 'Senior'), t('11U AA', 'Junior'), t('9U AA', 'Junior'), t('Ace', null)]);
    assert.deepEqual(groups.map(g => [g.group, g.teams.map(x => x.teamName)]), [
      ['Junior', ['9U AA', '11U AA']], ['Senior', ['14U AA']], [null, ['Ace', 'UAT Test Team']],
    ]);
  });
});

describe('what a request asks for now — one rule for Payment requests and Needs you (/review 2026-10-16)', () => {
  it('a WAITING hand-back ask reads its live figure; anything else, its stored amount', () => {
    assert.equal(requestAskedAmount(216, { state: 'waiting', cents: 10800 }), 108, 'a Sunday that started left the ask');
    assert.equal(requestAskedAmount(216, { state: 'accepted', cents: 10800 }), 216);
    assert.equal(requestAskedAmount(180, null), 180, 'an ordinary request');
  });
  it('both reads ask the one rule', () => {
    assert.match(readFileSync('app/api/admin/accounting/payment-requests/route.ts', 'utf8'), /amount: requestAskedAmount\(x\.amount, ask\),/);
    assert.match(readFileSync('lib/club-money-reads.ts', 'utf8'), /amount: requestAskedAmount\(Number\(r\.amount\), r\.club_hand_back_id \? asks\.get\(r\.club_hand_back_id\) : null\),/);
  });
  it('a bill\'s year reads its FIRST payment across every team it bills (the database lock\'s rule), not this team\'s alone', () => {
    const reads = readFileSync('lib/club-money-reads.ts', 'utf8');
    assert.match(reads, /\.from\('rep_allocation_splits'\)\.select\('allocation_id, rep_allocation_installments \( due_date \)'\)/);
    assert.match(reads, /const firstDueDate = firstDue\.get\(id\) \?\? null;/);
  });
});
