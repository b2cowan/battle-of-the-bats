import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildBoardSummary, buildClubPlan, buildClubReport, fileClubLine, loopIndex, planYears,
  statementExportRows, boardTeamsExportRows, allocationInYear,
  FROM_THE_TEAMS_ID, NOT_FILED_ID, ON_REQUEST_ID, TEAM_SUPPORT_WORD_IDS,
  type ClubAllocationFacts, type ClubBook, type ClubBookLineFacts, type ClubPlanLineFacts, type ClubRequestFacts,
  type ClubReport,
} from '../../lib/club-budget-report.ts';
import { fileLine, ledgerCategory } from '../../lib/club-ledger.ts';
import {
  lineAllocated, notAllocated, openingBalance, clubCashOnHand, waitingOnYou, headroom, otherBooksMovement,
} from '../../lib/club-money-figures.ts';

/**
 * Club Tier Stage 3b — the club's year, assembled (lib/club-budget-report.ts) over the definitions
 * (lib/club-money-figures.ts). Each `it` names the ruling it pins (owner, 2026-10-06, Asks 1–5).
 */

const TODAY = '2026-09-30';
const YEAR = 2026;
const DIAMOND = { categoryId: 'cat-fields', categoryName: 'Field & facilities', itemId: 'item-diamond', itemName: 'Diamond permits' };
const INSURANCE = { categoryId: 'cat-ins', categoryName: 'Insurance', itemId: 'item-ins', itemName: 'Club insurance' };
const EVENTS = { categoryId: 'cat-events', categoryName: 'Events', itemId: 'item-banquet', itemName: 'Year-end banquet deposit' };
const SPONSOR = { categoryId: 'cat-sponsor', categoryName: 'Sponsorship', itemId: 'item-sponsor', itemName: 'Club sponsors' };

function planLine(id: string, word: typeof DIAMOND, total: number, over: Partial<ClubPlanLineFacts> = {}): ClubPlanLineFacts {
  return {
    id, ...word, direction: 'out', totalAmount: total, description: word.itemName, notes: null,
    sortOrder: 0, updatedAt: '2026-01-05T12:00:00Z', periods: [], ...over,
  };
}

let n = 0;
function line(over: Partial<ClubBookLineFacts>): ClubBookLineFacts {
  n++;
  return {
    id: `line-${n}`, ledgerId: 'general', bookKind: 'org', bookName: 'General', entryDate: '2026-05-01',
    description: 'A line', amount: 100, entryType: 'expense', status: 'posted', category: null,
    sourceModule: null, sourceEntityId: null, linkedEntryId: null, partnerKind: null,
    budgetCategoryId: null, budgetCategoryName: null, budgetItemId: null, budgetItemName: null, ...over,
  };
}
const filed = (w: typeof DIAMOND) => ({ budgetCategoryId: w.categoryId, budgetCategoryName: w.categoryName, budgetItemId: w.itemId, budgetItemName: w.itemName });

function allocation(id: string, over: Partial<ClubAllocationFacts> & { shares?: number[]; due?: string; paid?: boolean[] } = {}): ClubAllocationFacts {
  const shares = over.shares ?? [600, 600];
  return {
    id, description: `Allocation ${id}`, createdOn: '2026-03-01', sourceBudgetLineId: 'line-diamond', lineYear: YEAR,
    splits: shares.map((amount, i) => ({
      id: `${id}-s${i}`, teamId: `team-${i}`, teamName: `Team ${i}`, amount,
      installments: [{
        id: `${id}-i${i}`, installmentNumber: 1, amount, dueDate: over.due ?? '2026-05-15',
        paidAt: over.paid?.[i] ? '2026-05-10T12:00:00Z' : null, paidOn: over.paid?.[i] ? '2026-05-10' : null,
        sentAt: null, sentOn: null, accountingEntryId: over.paid?.[i] ? `${id}-team-half-${i}` : null,
      }],
    })),
    ...over,
  };
}

const books: ClubBook[] = [
  { id: 'general', kind: 'org', name: 'General', balance: 5000 },
  { id: 'harvest', kind: 'tournament', name: 'Harvest Classic', balance: 1440 },
];

function report(over: Partial<Parameters<typeof buildClubReport>[0]> = {}): ClubReport {
  // The pending caption reads every date; by default, the pending lines among the year's.
  const pendingLines = (over.bookLines ?? []).filter(l => l.status === 'pending');
  return buildClubReport({
    year: YEAR, today: TODAY,
    lines: [planLine('line-diamond', DIAMOND, 14000)],
    allocations: [], requests: [], bookLines: [], pendingLines, books, openingBalance: 4000,
    categoryOrder: { 'cat-fields': 2, 'cat-ins': 7, 'cat-events': 6, 'cat-sponsor': 10, [TEAM_SUPPORT_WORD_IDS.categoryId]: 11 },
    ...over,
  });
}

const statementRow = (r: ClubReport, side: 'revenue' | 'expenses', categoryId: string, itemId: string | null) =>
  r.statement[side].categories.find(c => c.categoryId === categoryId)?.items.find(i => i.itemId === itemId);

describe('an Actual is matched to the plan by WORD (Ask 4a — the coach\'s rule, not a line)', () => {
  it('a line filed under a planned word is that line\'s Actual', () => {
    const r = report({ bookLines: [line({ amount: 5300, ...filed(DIAMOND) }), line({ amount: 5250, ...filed(DIAMOND) })] });
    const row = statementRow(r, 'expenses', DIAMOND.categoryId, DIAMOND.itemId)!;
    assert.equal(row.budgeted, 14000);
    assert.equal(row.actual, 10550);
    assert.equal(row.inPlan, true);
    assert.equal(row.variance, 3450, 'under plan on a cost is good news, positive');
  });
  it('a word the year\'s plan has no line for is off-plan, and so is a line filed to no word ("Not filed")', () => {
    const r = report({ bookLines: [line({ amount: 500, ...filed(EVENTS) }), line({ amount: 180 })] });
    assert.equal(statementRow(r, 'expenses', EVENTS.categoryId, EVENTS.itemId)!.inPlan, false);
    const notFiled = r.statement.expenses.categories.find(c => c.categoryId === NOT_FILED_ID)!;
    assert.equal(notFiled.categoryName, 'Not filed');
    assert.equal(notFiled.actual, 180);
    assert.equal(r.band.offPlan, 680, 'Off-plan = the off-plan words + Not filed');
  });
  it('"Not filed" closes the Expenses band; the library\'s order before it', () => {
    const r = report({ bookLines: [line({ amount: 180 }), line({ amount: 500, ...filed(EVENTS) }), line({ amount: 100, ...filed(INSURANCE) })] });
    const ids = r.statement.expenses.categories.map(c => c.categoryId);
    assert.equal(ids[ids.length - 1], NOT_FILED_ID);
    assert.ok(ids.indexOf(DIAMOND.categoryId) < ids.indexOf(EVENTS.categoryId) && ids.indexOf(EVENTS.categoryId) < ids.indexOf(INSURANCE.categoryId));
  });
});

describe('the money loop\'s own lines file themselves, never by a word (Ask 4a)', () => {
  const alloc = allocation('a1', { shares: [600, 600], paid: [true, false] });
  const toClub: ClubRequestFacts = { id: 'req-in', teamId: 'team-0', teamName: 'Team 0', requestType: 'payment_to_org', status: 'approved', amount: 430, description: 'Gate share', createdOn: '2026-06-01', accountingEntryId: 'req-in-team-half' };
  const toTeam: ClubRequestFacts = { id: 'req-out', teamId: 'team-1', teamName: 'Team 1', requestType: 'charge_to_org', status: 'approved', amount: 420, description: 'Provincials', createdOn: '2026-08-01', accountingEntryId: 'req-out-club-half' };
  const received = line({ id: 'recv', amount: 600, entryType: 'transfer_in', category: 'rep_allocation', sourceModule: 'rep_allocation_installment', sourceEntityId: 'a1-i0', partnerKind: 'team', ...filed(DIAMOND) });
  const oldReceived = line({ id: 'recv-old', amount: 600, entryType: 'transfer_in', category: 'rep_allocation', linkedEntryId: 'a1-team-half-0', partnerKind: 'team' });
  const onRequest = line({ id: 'onreq', amount: 430, entryType: 'transfer_in', category: 'team_payment_to_org', sourceModule: 'rep_payment_request', sourceEntityId: 'req-in', partnerKind: 'team' });
  const paidToTeam = line({ id: 'req-out-club-half', amount: 420, entryType: 'transfer_out', category: 'team_charge_to_org', partnerKind: 'team' });

  it('an allocation received is "From the teams", under its allocation — even if a word rode along', () => {
    const f = fileClubLine(received, loopIndex([alloc], []));
    assert.deepEqual([f.filing.categoryId, f.filing.itemId, f.source?.kind], [FROM_THE_TEAMS_ID, 'a1', 'allocation']);
  });
  it('a line written before 3a finds its installment through the team half it is linked to', () => {
    const f = fileClubLine(oldReceived, loopIndex([alloc], []));
    assert.equal(f.filing.itemId, 'a1');
  });
  it('money received on request is "From the teams › On request"; a request paid to a team is "Team support › Paid to teams on request"', () => {
    const idx = loopIndex([], [toClub, toTeam]);
    const on = fileClubLine(onRequest, idx).filing;
    assert.deepEqual([on.categoryId, on.itemId], [FROM_THE_TEAMS_ID, ON_REQUEST_ID]);
    const out = fileClubLine(paidToTeam, idx);
    assert.deepEqual([out.filing.categoryId, out.filing.itemId, out.source?.kind], [TEAM_SUPPORT_WORD_IDS.categoryId, TEAM_SUPPORT_WORD_IDS.itemId, 'request']);
  });
  it('the Statement counts each loop line once: From the teams = received + on request; Team support = paid to teams', () => {
    const r = report({ allocations: [alloc], requests: [toClub, toTeam], bookLines: [received, onRequest, paidToTeam] });
    const fromTeams = r.statement.revenue.categories.find(c => c.categoryId === FROM_THE_TEAMS_ID)!;
    assert.equal(fromTeams.actual, 1030);
    assert.equal(statementRow(r, 'revenue', FROM_THE_TEAMS_ID, 'a1')!.budgeted, 1200, 'Budgeted = the allocation drawn from the year\'s line');
    assert.equal(statementRow(r, 'expenses', TEAM_SUPPORT_WORD_IDS.categoryId, TEAM_SUPPORT_WORD_IDS.itemId)!.actual, 420);
    assert.equal(r.lineSources.recv.kind, 'allocation');
    assert.equal(r.band.collected.amount, r.statement.revenue.actual, 'the band\'s Collected IS Total revenue\'s Actual');
    assert.equal(r.band.spent.amount, r.statement.expenses.actual, 'Spent IS Total expenses\' Actual');
  });
  it('From the teams is revenue, so it is never off-plan; a request paid to a team with no plan line is', () => {
    const r = report({ allocations: [alloc], requests: [toTeam], bookLines: [received, paidToTeam] });
    assert.equal(r.band.offPlan, 420);
  });
});

describe('what counts: posted on the Club books, a transfer between the club\'s own books is not money', () => {
  it('pending and void lines count nowhere in Actual or Spent', () => {
    const r = report({ bookLines: [line({ amount: 640, status: 'pending', ...filed(DIAMOND) }), line({ amount: 99, status: 'void', ...filed(DIAMOND) })] });
    assert.equal(r.band.spent.amount, 0);
    assert.equal(r.pending.moneyOut, 640, 'a pending cheque is the caption under Cash on hand');
  });
  it('a transfer to the tournament\'s book moves nothing; a transfer to a team\'s book is spending (Not filed when made by hand)', () => {
    const own = line({ amount: 300, entryType: 'transfer_out', partnerKind: 'tournament' });
    const toTeam = line({ amount: 250, entryType: 'transfer_out', partnerKind: 'team' });
    const r = report({ bookLines: [own, toTeam] });
    assert.equal(r.band.spent.amount, 250);
  });
  it('a tournament\'s or the house league\'s book is never in the Statement (Stages 7 and 9)', () => {
    const r = report({ bookLines: [line({ amount: 1440, entryType: 'income', bookKind: 'tournament', ledgerId: 'harvest', bookName: 'Harvest' })] });
    assert.equal(r.band.collected.amount, 0);
  });
});

describe('the plan: Allocated, Not allocated, From the teams (C11, Ask 4b)', () => {
  const lines = [planLine('line-diamond', DIAMOND, 14000), planLine('line-sponsor', SPONSOR, 5000, { direction: 'in' })];
  const a1 = allocation('a1', { shares: [6075, 6075], paid: [true, true] });
  const a2 = allocation('a2', { shares: [925, 925] });
  it('a line carries any number of allocations; Allocated is every one\'s shares added up', () => {
    assert.equal(lineAllocated('line-diamond', [a1, a2].map(a => ({ sourceBudgetLineId: a.sourceBudgetLineId, splits: a.splits }))), 14000);
    const plan = buildClubPlan({ year: YEAR, today: TODAY, lines, allocations: [a1, a2], categoryOrder: {}, openingBalance: 0 });
    const row = plan.expenses.categories[0].lines[0];
    assert.deepEqual([row.allocated, row.notAllocated, row.collected, row.allocations.length], [14000, 0, 12150, 2]);
  });
  it('Not allocated is Planned − Allocated, never below zero (a line billed above its total before the floor reads $0)', () => {
    assert.equal(notAllocated(14000, 12150), 1850);
    assert.equal(notAllocated(6000, 6750), 0);
  });
  it('From the teams is never stored: it is the year\'s allocations, dated by their installments, and a money-in line bills nobody', () => {
    const plan = buildClubPlan({ year: YEAR, today: TODAY, lines, allocations: [a1], categoryOrder: {}, openingBalance: 21762 });
    assert.equal(plan.revenue.fromTheTeams.planned, 12150);
    assert.deepEqual(plan.revenue.fromTheTeams.periods.map(p => p.date), ['2026-05-15', '2026-05-15']);
    const sponsor = plan.revenue.categories[0].lines[0];
    assert.equal(sponsor.allocated, null, 'a revenue line has no Allocated');
    assert.equal(plan.revenue.total, 17150);
    assert.equal(plan.closingBalance, 21762 + 17150 - 14000, 'the plan closes on opening + net');
  });
  it('By period: the coach\'s grid fed the plan; From the teams lands on its due months', () => {
    const plan = buildClubPlan({ year: YEAR, today: TODAY, lines, allocations: [a1], categoryOrder: {}, openingBalance: 0 });
    const may = plan.periodGrid.months.indexOf('2026-05');
    assert.equal(plan.periodGrid.revenue.totals.cells[may].budget, 12150);
    assert.equal(plan.periodGrid.balance.ending, plan.closingBalance);
  });
});

describe('a team outside the reader\'s groups is counted, never named (B11, as 3a\'s reads; found by /review)', () => {
  const lines = [planLine('line-diamond', DIAMOND, 14000)];
  const a1 = allocation('a1', { shares: [600, 600] });
  const scope = new Set(['team-0']);
  it('the plan: an allocation names only the reader\'s teams and counts the rest; its figures stay the club\'s', () => {
    const plan = buildClubPlan({ year: YEAR, today: TODAY, lines, allocations: [a1], categoryOrder: {}, openingBalance: 0, scope });
    const row = plan.expenses.categories[0].lines[0];
    assert.deepEqual([row.allocations[0].teamNames, row.allocations[0].otherTeams, row.allocated], [['Team 0'], 1, 1200]);
  });
  it('Scheduled: the other team\'s installment and request are there in the figures, without its name or its words', () => {
    const asked: ClubRequestFacts = { id: 'w9', teamId: 'team-1', teamName: 'Team 1', requestType: 'charge_to_org', status: 'pending', amount: 80, description: 'Hotel in Barrie', createdOn: TODAY, accountingEntryId: null };
    const r2 = report({ lines, allocations: [a1], requests: [asked], scope });
    const items = Object.values(r2.months.cellDetails).flat();
    assert.ok(items.some(d => d.description === 'Allocation a1 · Team 0'));
    assert.ok(items.some(d => d.description === 'Allocation a1 · A team outside your groups'));
    assert.ok(!items.some(d => /Team 1|Hotel in Barrie/.test(d.description)), 'never the name, never the request\'s own words');
    assert.equal(r2.months.revenueGrid.totals.total.scheduled, 1200, 'the figures are the club\'s');
  });
});

describe('the year rule', () => {
  it('an allocation belongs to its line\'s year; one with no line to the year its first installment falls due', () => {
    assert.equal(allocationInYear(allocation('x', { lineYear: 2025 }), 2025), true);
    assert.equal(allocationInYear(allocation('y', { sourceBudgetLineId: null, lineYear: null, due: '2027-02-01' }), 2027), true);
  });
  it('the Year pill offers every year with a line, this year, and always the next — never two ahead', () => {
    assert.deepEqual(planYears([2025], TODAY), [2027, 2026, 2025]);
    assert.deepEqual(planYears([], '2026-01-02'), [2027, 2026]);
  });
});

describe('Months (Ask 5): every column opens + nets = closes; Cash closes this month on Cash on hand', () => {
  const lines = [planLine('line-diamond', DIAMOND, 14000, { periods: [{ label: 'Apr', date: '2026-04-15', amount: 7000, sortOrder: 0 }, { label: 'Jun', date: '2026-06-15', amount: 7000, sortOrder: 1 }] })];
  const a1 = allocation('a1', { shares: [600, 600], paid: [true, false], due: '2026-03-15' });
  const bookLines = [
    line({ amount: 5300, entryDate: '2026-04-14', ...filed(DIAMOND) }),
    line({ id: 'recv', amount: 600, entryDate: '2026-05-10', entryType: 'transfer_in', category: 'rep_allocation', sourceModule: 'rep_allocation_installment', sourceEntityId: 'a1-i0', partnerKind: 'team' }),
    line({ amount: 1440, entryDate: '2026-08-20', entryType: 'income', bookKind: 'tournament', ledgerId: 'harvest', bookName: 'Harvest' }),
    line({ amount: 200, entryDate: '2026-08-21', entryType: 'transfer_out', bookKind: 'tournament', ledgerId: 'harvest', partnerKind: 'org' }),
    line({ amount: 200, entryDate: '2026-08-21', entryType: 'transfer_in', partnerKind: 'tournament' }),
    line({ amount: 640, entryDate: '2026-09-30', status: 'pending', ...filed(DIAMOND) }),
  ];
  // Every book the club owns, today: 4000 opening − 5300 + 600 + 1440 = 740 (the transfer moved nothing in total).
  const cash = [{ id: 'general', kind: 'org', name: 'General', balance: -700 }, { id: 'harvest', kind: 'tournament', name: 'Harvest', balance: 1440 }];
  const r = report({ lines, allocations: [a1], bookLines, books: cash, openingBalance: 4000 });

  for (const lens of ['budget', 'scheduled', 'actual'] as const) {
    it(`${lens}: opening + net = closing in every month, and each month opens on the last one's close`, () => {
      const rows = r.months.balances[lens].rows;
      rows.forEach((row, i) => {
        assert.equal(Math.round((row.opening + row.net) * 100), Math.round(row.running * 100), `${lens} ${row.month}`);
        if (i > 0) assert.equal(row.opening, rows[i - 1].running);
      });
    });
  }
  it('Cash: this month\'s closing equals Cash on hand to the cent, with the other books\' row in the balance', () => {
    const sept = r.months.balances.actual.rows.find(x => x.month === '2026-09')!;
    assert.equal(r.months.cashOnHand, 740);
    assert.equal(sept.running, r.months.cashOnHand);
    const aug = r.months.otherBooks.actual.find(x => x.month === '2026-08')!;
    assert.deepEqual([aug.moneyIn, aug.moneyOut], [1440, 0], 'the other books\' row: the tournament took in $1,440; the transfer between the club\'s books is left out');
  });
  it('Scheduled: an overdue installment stays in its due month and still counts (the coach\'s rule); a pending cheque by its date; it opens on today\'s cash', () => {
    const march = r.months.months.indexOf('2026-03');
    assert.equal(r.months.revenueGrid.totals.cells[march].scheduled, 600, 'Team 1\'s unpaid March installment');
    const sept = r.months.months.indexOf('2026-09');
    assert.equal(r.months.monthGrid.totals.cells[sept].scheduled, 640);
    assert.equal(r.months.balances.scheduled.opening, r.months.cashOnHand);
  });
  it('Scheduled is by DUE DATE in the year: last year\'s bill still owed this spring is this spring\'s money (found by /review)', () => {
    const old = allocation('old', { shares: [300], lineYear: 2025, sourceBudgetLineId: 'line-2025', due: '2026-04-01' });
    const done = allocation('done', { shares: [400], due: '2025-11-01' });
    const r2 = report({ allocations: [old, done] });
    const april = r2.months.months.indexOf('2026-04');
    assert.equal(r2.months.revenueGrid.totals.cells[april].scheduled, 300, 'a 2025 allocation\'s April 2026 installment');
    assert.equal(r2.months.revenueGrid.totals.total.scheduled, 300, 'an installment due last year stays in its own month, outside this year');
  });
  it('the pending caption is TODAY\'s — any date — and a pending transfer between the club\'s own books is not waiting money (found by /review)', () => {
    const r2 = report({
      pendingLines: [
        line({ amount: 75, entryDate: '2025-12-20', status: 'pending', ...filed(DIAMOND) }),
        line({ amount: 30, entryDate: '2026-02-02', status: 'pending', entryType: 'transfer_out', partnerKind: 'tournament' }),
      ],
    });
    assert.deepEqual([r2.pending.count, r2.pending.moneyOut], [1, 75]);
    assert.equal(r2.months.monthGrid.totals.total.scheduled, 0, 'Scheduled still reads only the year\'s dates');
  });
  it('the opening balance is worked out from the books — every club-owned book\'s posted lines before Jan 1 — never a team\'s', () => {
    assert.equal(openingBalance([
      { kind: 'org', postedIn: 30000, postedOut: 9000 },
      { kind: 'tournament', postedIn: 800, postedOut: 38 },
      { kind: 'team', postedIn: 99999, postedOut: 0 },
    ]), 21762);
  });
  it('the other books\' row reads posted lines on Pending under Scheduled, and never a Club book or a transfer between books', () => {
    const lines2 = [
      { amount: 50, entryType: 'income' as const, status: 'pending' as const, bookKind: 'league_season', partnerKind: null },
      { amount: 70, entryType: 'expense' as const, status: 'posted' as const, bookKind: 'org', partnerKind: null },
      { amount: 90, entryType: 'transfer_in' as const, status: 'posted' as const, bookKind: 'tournament', partnerKind: 'org' },
    ];
    assert.deepEqual(otherBooksMovement(lines2, 'actual'), { moneyIn: 0, moneyOut: 0 });
    assert.deepEqual(otherBooksMovement(lines2, 'scheduled'), { moneyIn: 50, moneyOut: 0 });
  });
});

describe('the board summary reads Budget vs. Actual, never computes it again (Ask 1)', () => {
  const a1 = allocation('a1', { shares: [600, 600], paid: [true, false], due: '2026-03-15' });
  const r = report({ allocations: [a1], bookLines: [line({ amount: 5000, ...filed(DIAMOND) })] });
  const waiting: ClubRequestFacts[] = [
    { id: 'w1', teamId: 'team-0', teamName: 'Team 0', requestType: 'payment_to_org', status: 'pending', amount: 100, description: 'x', createdOn: TODAY, accountingEntryId: null },
    { id: 'w2', teamId: 'team-1', teamName: 'Team 1', requestType: 'charge_to_org', status: 'pending', amount: 455, description: 'y', createdOn: TODAY, accountingEntryId: null },
  ];
  const s = buildBoardSummary({
    report: r, allocations: [a1], requests: waiting.map((w, i) => ({ ...w, holdingPayout: i === 1 })), books,
    teams: [{ teamId: 'team-0', teamName: 'Team 0', groupName: null, isArchived: false }, { teamId: 'team-1', teamName: 'Team 1', groupName: null, isArchived: false }],
    teamCash: [{ teamId: 'team-0', cash: 1200, season: null }, { teamId: 'team-1', cash: -80, season: null }],
  });
  it('the year against the budget is the report\'s own figures', () => {
    assert.equal(s.againstBudget.expenses.actual, r.statement.expenses.actual);
    assert.equal(s.againstBudget.headroom, headroom(r.statement.expenses.budgeted, r.band.spent.amount));
    assert.equal(s.againstBudget.offPlan, r.band.offPlan);
  });
  it('position: Cash on hand is every book the club owns; Owed by the teams is Outstanding with the overdue; Waiting on you is both directions', () => {
    assert.equal(s.position.cashOnHand, clubCashOnHand(books));
    assert.deepEqual([s.position.owedByTheTeams.amount, s.position.owedByTheTeams.overdue.count], [600, 1]);
    assert.deepEqual(s.position.waitingOnYou, { ...waitingOnYou(waiting), holdingPayout: 1 });
  });
  it('the teams\' cash is its own total, never in a club figure; the team that needs the club comes first', () => {
    assert.equal(s.teamsCash.total, 1120);
    assert.equal(s.position.cashOnHand, 6440, 'the teams\' cash is not in Cash on hand');
    assert.equal(s.teams[0].teamId, 'team-1', 'overdue first');
    const exported = boardTeamsExportRows(s);
    assert.equal(exported[exported.length - 2].cash, null, 'the closing row leaves the teams\' cash blank');
    assert.equal(exported[exported.length - 1].cash, 1120);
  });
});

describe('the Ledger\'s filing and the exports', () => {
  const base = {
    category: null, sourceModule: null, partnerKind: null,
    budgetCategoryId: null, budgetCategoryName: null, budgetItemId: null, budgetItemName: null,
  };
  const insured = { budgetCategoryId: 'c', budgetCategoryName: 'Insurance', budgetItemId: 'i', budgetItemName: 'Club insurance' };
  it('fileLine — ONE rule: the loop by its source, a typed line by its word or "Not filed", a transfer between the club\'s own books and a fee nowhere', () => {
    assert.equal(fileLine({ ...base, entryType: 'transfer_in', category: 'rep_allocation' })!.categoryId, FROM_THE_TEAMS_ID);
    assert.equal(fileLine({ ...base, entryType: 'transfer_out', category: 'team_charge_to_org' })!.categoryId, TEAM_SUPPORT_WORD_IDS.categoryId);
    assert.equal(fileLine({ ...base, entryType: 'expense' })!.categoryId, NOT_FILED_ID);
    assert.equal(fileLine({ ...base, entryType: 'expense', ...insured })!.categoryName, 'Insurance');
    assert.equal(fileLine({ ...base, entryType: 'transfer_out', partnerKind: 'tournament' }), null, 'between the club\'s own books: filed nowhere');
    assert.equal(fileLine({ ...base, entryType: 'transfer_out', partnerKind: 'team' })!.categoryId, NOT_FILED_ID, 'a hand transfer to a team\'s book is Not filed');
    assert.equal(fileLine({ ...base, entryType: 'income', sourceModule: 'league_registration' }), null, 'a house-league fee is filed nowhere');
  });
  it('ledgerCategory: the Ledger\'s column and its filter read that rule — a team\'s book keeps the coaches\' words', () => {
    assert.equal(ledgerCategory({ ...base, entryType: 'expense', ...insured }, 'org'), 'Insurance');
    assert.equal(ledgerCategory({ ...base, entryType: 'transfer_out', partnerKind: 'org' }, 'tournament'), null);
    assert.equal(ledgerCategory({ ...base, entryType: 'expense', category: 'Jerseys', ...insured }, 'team'), 'Jerseys', 'never the club\'s to file');
  });
  it('the Statement export: an off-plan line\'s Budgeted is blank, each band closes on its total, the net last', () => {
    const r = report({ bookLines: [line({ amount: 500, ...filed(EVENTS) })] });
    const rows = statementExportRows(r);
    assert.equal(rows.find(x => x.line === EVENTS.itemName)!.budgeted, null);
    assert.equal(rows[rows.length - 1].category, 'Net for 2026');
    assert.ok(rows.some(x => x.category === 'Total expenses'));
  });
});
