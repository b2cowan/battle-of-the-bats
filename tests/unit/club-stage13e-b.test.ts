import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import {
  buildClubReport, NOT_FILED_ID, TEAM_SUPPORT_WORD_IDS,
  type ClubAllocationFacts, type ClubBookLineFacts, type ClubPlanLineFacts,
} from '../../lib/club-budget-report.ts';
import { offPlan, offPlanLines } from '../../lib/club-money-figures.ts';
import { carriedByTeam, carriedIn, type YearBill } from '../../lib/club-team-needs.ts';
import {
  CARRIED_WORDS, OFF_PLAN_WORDS, OWED_TO_THE_CLUB_WORDS, SUMMARY_WORDS, installmentsDueWords,
} from '../../lib/club-money-words.ts';
import { owedToTheClub } from '../../lib/club-band-view.ts';
import { clubStatementNotes } from '../../lib/club-money-reports.ts';
import { bookLedgerHref, ledgerOpensAllTime } from '../../lib/club-ledger.ts';
import { fiscalYearOf, type FiscalSetting } from '../../lib/club-fiscal-year.ts';

/**
 * Club Tier Stage 13e, Session B — the money screens (build prompt CLUB_TIER_STAGE13E_BUILD_PROMPT.md; drawing tabs 4, 5
 * and 6). Off-plan opens its lines and adds up to the tile (B1), the Not filed note's Ledger door (B2), the figures that
 * say which they are (B4, ask 13e-6 A), what an every-year Outstanding includes (B5, 13e-7 A), the Installments line (B6),
 * and the book's door on All time (B7, 13e-5 A). Every change is words or a door: no figure's arithmetic moves.
 */
const SEP: FiscalSetting = { firstMonth: 9, rows: [] };
const TODAY = '2026-11-16';
const YEAR = fiscalYearOf(TODAY, SEP); // 2026–27
const LAST = fiscalYearOf('2026-03-01', SEP); // 2025–26

const FACILITIES = { categoryId: 'cat-fac', categoryName: 'Facilities', itemId: 'item-diamond', itemName: 'Diamond permits' };
const EQUIPMENT = { categoryId: 'cat-fac', categoryName: 'Facilities', itemId: 'item-equip', itemName: 'Field Equipment' };
const PAID_TO_TEAMS = { categoryId: TEAM_SUPPORT_WORD_IDS.categoryId, categoryName: 'Team support', itemId: TEAM_SUPPORT_WORD_IDS.itemId, itemName: 'Paid to teams on request' };

const planLine = (id: string, w: typeof FACILITIES, total: number): ClubPlanLineFacts => ({
  id, ...w, direction: 'out', totalAmount: total, description: w.itemName, notes: null, sortOrder: 0, updatedAt: '2026-09-05T12:00:00Z', periods: [],
});
let n = 0;
const line = (over: Partial<ClubBookLineFacts>): ClubBookLineFacts => ({
  id: `line-${++n}`, ledgerId: 'general', bookKind: 'org', bookName: 'General', entryDate: '2026-10-02', description: 'A line', amount: 100,
  entryType: 'expense', status: 'posted', category: null, sourceModule: null, sourceEntityId: null, linkedEntryId: null, partnerKind: null,
  budgetCategoryId: null, budgetCategoryName: null, budgetItemId: null, budgetItemName: null, ...over,
});
const filed = (w: typeof FACILITIES) => ({ budgetCategoryId: w.categoryId, budgetCategoryName: w.categoryName, budgetItemId: w.itemId, budgetItemName: w.itemName });

describe('B1 · Off-plan opens its lines, and they add up to the tile', () => {
  // The copy's three kinds: a word the plan has no line for inside a planned category (Field Equipment under Facilities),
  // a category the plan has nothing in (Team support › Paid to teams on request), and spending filed under no word.
  const r = buildClubReport({
    year: YEAR, setting: SEP, today: TODAY,
    lines: [planLine('line-diamond', FACILITIES, 36000)],
    allocations: [], requests: [], pendingLines: [], books: [{ id: 'general', kind: 'org', name: 'General', balance: 2870 }], openingBalance: 0,
    bookLines: [
      line({ amount: 3050, ...filed(FACILITIES) }),
      line({ amount: 1200, ...filed(EQUIPMENT) }),
      line({ amount: 120, ...filed(PAID_TO_TEAMS) }),
      line({ amount: 2000, description: 'Diamond permits — spring block' }),
      line({ amount: 340, description: 'Practice balls', entryDate: '2026-11-04' }),
    ],
    categoryOrder: { 'cat-fac': 2, [TEAM_SUPPORT_WORD_IDS.categoryId]: 11 },
  });
  const rows = offPlanLines(r.statement.expenses.categories);

  it('one row per line nobody budgeted, Not filed last, summing to the tile to the cent', () => {
    assert.equal(r.band.offPlan, 3660);
    assert.deepEqual(rows.map(x => [x.item.itemName || x.category.categoryName, x.category.categoryName, x.item.actual]), [
      ['Field Equipment', 'Facilities', 1200],
      ['Paid to teams on request', 'Team support', 120],
      [rows[2].item.itemName || 'Not filed', 'Not filed', 2340],
    ]);
    assert.equal(rows[2].category.categoryId, NOT_FILED_ID);
    assert.equal(Math.round(rows.reduce((c, x) => c + Math.round(x.item.actual * 100), 0)) / 100, r.band.offPlan, 'the window adds up to the tile');
    assert.equal(offPlan(r.statement.expenses.categories.flatMap(c => c.items)), r.band.offPlan, 'the one test, over the statement the window reads');
  });
  it('a planned line is never in it, and a zero line adds nothing and is not a row', () => {
    assert.ok(!rows.some(x => x.item.itemId === FACILITIES.itemId));
    const withZero = offPlanLines([{ items: [{ inPlan: false, actual: 0 }, { inPlan: false, actual: 5 }, { inPlan: true, actual: 9 }] }]);
    assert.equal(withZero.length, 1);
  });
  it('the window’s words', () => {
    assert.equal(OFF_PLAN_WORDS.eyebrow('2026–27'), 'Off-plan · 2026–27');
    assert.equal(OFF_PLAN_WORDS.title(3660), '$3,660.00 nobody budgeted');
    assert.equal(`Facilities${OFF_PLAN_WORDS.notPlannedMore}`, 'Facilities · not planned');
    assert.equal(`${OFF_PLAN_WORDS.notFiled}${OFF_PLAN_WORDS.notFiledMore}`, 'No budget word yet · file them on the Ledger');
  });
  it('the Not filed row stops saying "file" on a closed year; the list comes back when an Actual window closes', () => {
    assert.match(readCode('components/admin/kit/club/money/OffPlanWindow.tsx'), /\{!locked && <span[^>]*>\{OFF_PLAN_WORDS\.notFiledMore\}/);
    const page = readCode('app/[orgSlug]/admin/accounting/budget-vs-actual/page.tsx');
    assert.match(page, /locked=\{read\.year\.locked\}/);
    assert.match(page, /offPlanOpen && !behind/);
  });
});

describe('B2 · the Not filed note ends with its Ledger door', () => {
  const base = { basis: 'season' as const, revenueUnder: null, owedByTheTeams: null, pending: null, notFiled: true };
  const text = (locked: boolean) => clubStatementNotes({ ...base, yearLocked: locked }).find(x => x.id === 'club-not-filed')!.segments;
  it('the drawing’s words, the door a screen-only control', () => {
    const open = text(false);
    assert.equal(open.map(s => s.text).join(''), 'Not filed is spending with no budget word yet. It counts as off-plan. File them on the Ledger');
    const door = open.find(s => s.control === 'ledger-not-filed')!;
    assert.equal(door.screenOnly, true, 'a file carries the sentence, not the link');
    assert.equal(text(true).find(s => s.control)!.text, 'See them on the Ledger', 'a closed year’s lines are locked');
  });
  it('the door is the Actual window’s own address over Not filed', () => {
    const page = readCode('app/[orgSlug]/admin/accounting/budget-vs-actual/page.tsx');
    assert.match(page, /ledgerLinesHref\(\{ categoryName: notFiledCat\.categoryName, itemName: null,/);
    assert.match(readCode('components/admin/kit/club/money/StatementBehindWindow.tsx'), /const ledgerHref = ledgerLinesHref\(/);
  });
});

describe('B4 · figures that say which they are (13e-6 A)', () => {
  it('Revenue’s caption names its year; Balance today; today, not at the close', () => {
    const inc = { leagueFees: 2355, tournaments: [{ name: 'Harbourtown Invitational 2026', amount: 1440 }] };
    assert.equal(OWED_TO_THE_CLUB_WORDS.revenueIncludes(inc, '2026–27'), '2026–27 includes house league fees $2,355.00 · Harbourtown Invitational 2026 $1,440.00');
    assert.equal(OWED_TO_THE_CLUB_WORDS.balanceToday, 'Balance today');
    assert.equal(SUMMARY_WORDS.notAtClose('2026-11-16'), 'today, Nov 16, not at the close');
  });
  it('the Overview: the year on the caption, the closed year said, the open year’s report carries "includes"', () => {
    const ov = readCode('app/[orgSlug]/admin/accounting/page.tsx');
    assert.match(ov, /OWED_TO_THE_CLUB_WORDS\.revenueIncludes\(a\.revenueIncludes, summary\.year\.name\)/);
    assert.match(ov, /owedFigure\(p, league, leagueFailed, summary\.year\.closed \? summary\.today : null\)/);
    assert.match(ov, /\{OWED_TO_THE_CLUB_WORDS\.balanceToday\}/);
    assert.match(ov, /on request\$\{includes \? `; \$\{includes\}` : ''\}\)/, 'the board report’s year line');
    assert.match(ov, /what it includes`, OWED_TO_THE_CLUB_WORDS\.revenueParts\(a\.revenueIncludes\)/, 'the PDF’s opening block');
    assert.equal(OWED_TO_THE_CLUB_WORDS.revenueParts({ leagueFees: 0, tournaments: [] }), null);
    assert.doesNotMatch(readCode('lib/club-money-reports.ts'), /revenueIncludes/, 'the closed year’s year-end file waits (its own item)');
  });
});

describe('B5 · an every-year Outstanding says what it includes (13e-7 A)', () => {
  const alloc = (id: string, yearKey: string, team: string, amount: number, due: string, paid = false): ClubAllocationFacts => ({
    id, description: id, createdOn: due, sourceBudgetLineId: `line-${id}`, lineYearKey: yearKey,
    splits: [{ id: `${id}-s`, teamId: team, teamName: team, amount, credited: 0, installments: [{
      id: `${id}-i`, installmentNumber: 1, amount, credited: 0, dueDate: due, paidAt: paid ? '2026-01-02T12:00:00Z' : null, paidOn: paid ? '2026-01-02' : null,
      sentAt: null, sentOn: null, accountingEntryId: null,
    }] }],
  });
  const allocations = [
    alloc('this-year', YEAR.key, '13U', 3300, '2026-12-01'),
    alloc('last-year', LAST.key, '13U', 600, '2026-06-01'),
    alloc('last-year-paid', LAST.key, '13U', 900, '2026-05-01', true),
    alloc('14u-last', LAST.key, '14U', 600, '2026-06-01'),
  ];
  const bills: YearBill[] = allocations.flatMap(a => {
    const y = fiscalYearOf(a.lineYearKey!, SEP);
    return a.splits.map(sp => ({ year: { key: y.key, name: y.name }, teamId: sp.teamId, installments: sp.installments }));
  });
  it('against TODAY’s year, Accounting › Teams’ own split: what is owed on an earlier year’s bills', () => {
    const c = carriedByTeam(bills, YEAR.key, TODAY);
    assert.deepEqual(c.get('13U'), { amount: 600, yearName: '2025–26' });
    assert.deepEqual(c.get('14U'), { amount: 600, yearName: '2025–26' });
    assert.equal(carriedByTeam(bills, LAST.key, TODAY).size, 0, 'against the earlier year itself, nothing is carried');
    assert.equal(carriedIn([]), null, 'no caption when nothing is carried');
    assert.equal(carriedIn([{ yearName: '2024–25', amount: 100 }, { yearName: '2025–26', amount: 200 }])!.yearName, null, 'several years');
  });
  it('the words: Rep Teams and the account band; the Overview’s teams half', () => {
    assert.equal(CARRIED_WORDS.includes({ amount: 600, yearName: '2025–26' }), 'includes $600.00 from 2025–26');
    assert.equal(CARRIED_WORDS.includes({ amount: 800, yearName: null }), 'includes $800.00 from earlier years');
    const both = owedToTheClub({ teams: { amount: 10950, overdue: 3450 }, league: { amount: 1740, players: 12 } },
      { players: true, carried: { amount: 1200, yearName: '2025–26' } });
    assert.equal(both.caption, 'teams $10,950.00 ($3,450.00 overdue, $1,200.00 of it from 2025–26) · house league $1,740.00 (12 players)');
    assert.equal(both.total, 12690, 'the figure is unchanged — the one shared sum');
    assert.equal(owedToTheClub({ teams: { amount: 600, overdue: 0 } }, { carried: { amount: 600, yearName: '2025–26' } }).caption, 'teams $600.00 ($600.00 of it from 2025–26)');
    const closed = owedToTheClub({ teams: { amount: 10950, overdue: 3450 }, league: { amount: 1740, players: 12 } },
      { players: true, carried: { amount: 1200, yearName: '2025–26' }, halvesOnly: true });
    assert.equal(closed.caption, 'teams $10,950.00 · house league $1,740.00', 'a closed year: the halves, nothing in brackets');
    assert.equal(closed.overdue, 3450, 'the figure function still reports the facts');
  });
  it('Rep Teams, the account band and the Overview read it; Accounting › Teams is unchanged', () => {
    const route = readCode('app/api/admin/accounting/teams/route.ts');
    assert.match(route, /searchParams\.get\('carried'\) !== '1'/, 'only Rep Teams asks for it');
    assert.match(route, /carriedByTeam\(\s*yearBills\(loop, await allocationYears\(/);
    assert.match(readCode('app/[orgSlug]/admin/rep-teams/page.tsx'), /\/api\/admin\/accounting\/teams\?carried=1&/);
    // One year rule for Rep Teams and a team's account: both read allocationYears.
    assert.match(readCode('lib/club-money-reads.ts'), /allocationYears\(orgId, loop, setting, owingBills\)/);
    assert.match(readCode('app/[orgSlug]/admin/rep-teams/page.tsx'), /\{m\.carried && <span className=\{`\$\{repKit\.cellSub\} \$\{repKit\.dim\}`\}>\{CARRIED_WORDS\.includes\(m\.carried\)\}/);
    assert.match(readCode('app/[orgSlug]/admin/accounting/teams/[teamId]/page.tsx'), /\{read\.carried && <> · \{CARRIED_WORDS\.includes\(read\.carried\)\}<\/>\}/);
    assert.match(readCode('lib/club-budget-report.ts'), /carried: carriedIn\(\[\.\.\.earlierYearLines\(bills, todayYearKey, today\)\.values\(\)\]\.flat\(\)\)/);
    assert.doesNotMatch(readCode('components/admin/kit/club/money/TeamsTable.tsx'), /CARRIED_WORDS|carried/);
    // D1: words on a figure the club already reads — no door into a coach's own book.
    assert.doesNotMatch(readCode('app/[orgSlug]/admin/rep-teams/page.tsx'), /coaches\/teams\/[^'"`]*accounting/);
  });
});

describe('B6 · Installments due: overdue first, inside the count', () => {
  it('the four states', () => {
    assert.deepEqual(installmentsDueWords(12, 7), { overdue: '7 overdue', rest: '5 more in the next 14 days' });
    assert.deepEqual(installmentsDueWords(5, 0), { overdue: null, rest: 'in the next 14 days' });
    assert.deepEqual(installmentsDueWords(7, 7), { overdue: '7 overdue', rest: null });
    assert.deepEqual(installmentsDueWords(0, 0), { overdue: null, rest: 'none in the next 14 days' });
  });
  it('the hub draws it, red first', () => {
    const hub = readCode('components/admin/kit/club/ClubHubKit.tsx');
    assert.match(hub, /installmentsDueWords\(n, b\.detail\.installmentsDue\?\.overdue \?\? 0\)/);
    assert.match(hub, /<span className=\{moneyKit\.owedLate\}>\{w\.overdue\}<\/span>/);
  });
});

describe('B7 · a tournament’s or a season’s book opens the Ledger on All time (13e-5 A)', () => {
  it('only an event’s book; the General book keeps This month', () => {
    assert.equal(bookLedgerHref('/c/admin/accounting', 'b1', 'tournament'), '/c/admin/accounting/ledger?book=b1&date=all');
    assert.equal(bookLedgerHref('/c/admin/accounting', 'b2', 'league_season'), '/c/admin/accounting/ledger?book=b2&date=all');
    assert.equal(bookLedgerHref('/c/admin/accounting', 'b3', 'org'), '/c/admin/accounting/ledger?book=b3');
  });
  it('the two doors carry it; the Ledger reads it; its default and the Book pill stay This month', () => {
    assert.match(readCode('app/[orgSlug]/admin/accounting/page.tsx'), /const bookHref = \(b: \{ id: string; kind: string \}\) => bookLedgerHref\(base, b\.id, b\.kind\);/);
    assert.match(readCode('app/[orgSlug]/admin/tournaments/dashboard/page.tsx'), /bookLedgerHref\(`\/\$\{currentOrg\.slug\}\/admin\/accounting`, visibleStats\.clubBook\.ledgerId, 'tournament'\)/);
    const ledger = readCode('app/[orgSlug]/admin/accounting/ledger/page.tsx');
    assert.match(ledger, /if \(ledgerOpensAllTime\(search\)\) \{/);
    assert.match(ledger, /resolveDateRangePreset\('thisMonth', today, bounds\)/, 'the default is This month');
    assert.match(ledger, /restQuiet restSelectionId="thisMonth"/);
    assert.match(ledger, /router\.replace\(`\$\{base\}\/ledger\?book=\$\{id\}`\)/, 'picking a book sets no range');
    assert.equal(ledgerOpensAllTime(new URLSearchParams('book=b1&date=all')), true);
    assert.equal(ledgerOpensAllTime(new URLSearchParams('book=b1')), false);
  });
});
