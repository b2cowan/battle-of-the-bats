import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildAgainstLastYear, buildYearEndReport, compareSpans, holdsBooks, scopeCloseSnapshot, type CloseSnapshot } from '../../lib/club-year-compare.ts';
import { EARLIER_BILLS_PREFIX, type ClubAllocationFacts, type ClubBookLineFacts, type ClubReport } from '../../lib/club-budget-report.ts';
import { EARLIER_YEARS_BILLS_WORD, OUTSIDE_YOUR_GROUPS_WORD } from '../../lib/club-money-words.ts';
import { fiscalYearName, fiscalYearOf, type FiscalSetting, type FiscalYearRow } from '../../lib/club-fiscal-year.ts';

/**
 * Club Tier Stage 3c, Ask 8c — Compare › Against last year, and the year-end report (lib/club-year-compare.ts).
 * A closed year against the year before reads two whole years; the open year reads to today against the year
 * before to the same day; a short year compares the same months.
 */

const SEP: FiscalSetting = { firstMonth: 9, rows: [] };
const THIS = fiscalYearOf('2026-10-07', SEP);   // 2026–27
const LAST = fiscalYearOf('2025-10-07', SEP);   // 2025–26
const row = (first: string, last: string, over: Partial<FiscalYearRow> = {}): FiscalYearRow => ({
  id: `row-${first}`, name: fiscalYearName(first, last), firstDay: first, lastDay: last,
  closedAt: null, closedBy: null, closingBalance: null, ...over,
});

describe('compareSpans — what is compared with what', () => {
  it('a closed year against the year before: two whole years', () => {
    const before = fiscalYearOf('2024-10-01', SEP);
    assert.deepEqual(compareSpans(LAST, before, '2026-10-07'), {
      thisSpan: { from: '2025-09-01', to: '2026-08-31' }, lastSpan: { from: '2024-09-01', to: '2025-08-31' },
    });
  });
  it('the open year: to today, against the year before to the same day', () => {
    assert.deepEqual(compareSpans(THIS, LAST, '2026-10-07'), {
      thisSpan: { from: '2026-09-01', to: '2026-10-07' }, lastSpan: { from: '2025-09-01', to: '2025-10-07' },
    });
  });
  it('a year that has not begun compares nothing', () => {
    assert.equal(compareSpans(THIS, LAST, '2026-08-31'), null);
  });
  it('a SHORT year against the twelve before it: the same months (January–August against January–August)', () => {
    const s: FiscalSetting = { firstMonth: 9, rows: [row('2026-01-01', '2026-12-31'), row('2027-01-01', '2027-08-31')] };
    const short = fiscalYearOf('2027-05-01', s), before = fiscalYearOf('2026-05-01', s);
    assert.deepEqual(compareSpans(short, before, '2027-10-01'), {
      thisSpan: { from: '2027-01-01', to: '2027-08-31' }, lastSpan: { from: '2026-01-01', to: '2026-08-31' },
    });
  });
  it('the year after a short year: only the months both hold — January to August against the short year whole', () => {
    const s: FiscalSetting = { firstMonth: 9, rows: [row('2026-01-01', '2026-12-31'), row('2027-01-01', '2027-08-31')] };
    const after = fiscalYearOf('2027-10-01', s), short = fiscalYearOf('2027-05-01', s);
    assert.deepEqual(compareSpans(after, short, '2028-09-30'), {
      thisSpan: { from: '2028-01-01', to: '2028-08-31' }, lastSpan: { from: '2027-01-01', to: '2027-08-31' },
    });
    assert.deepEqual(compareSpans(after, short, '2028-03-15'), {
      thisSpan: { from: '2028-01-01', to: '2028-03-15' }, lastSpan: { from: '2027-01-01', to: '2027-03-15' },
    }, 'to today, against the same day a year earlier');
    assert.equal(compareSpans(after, short, '2027-11-01'), null, 'September to December has no same months in the short year');
  });
  it('a SHORT June–August year before twelve months: June to August against it, never twelve against three', () => {
    const s: FiscalSetting = { firstMonth: 9, rows: [row('2025-06-01', '2026-05-31'), row('2026-06-01', '2026-08-31')] };
    const year = fiscalYearOf('2027-03-15', s), short = fiscalYearOf('2026-07-01', s);
    assert.deepEqual(compareSpans(year, short, '2027-09-30'), {
      thisSpan: { from: '2027-06-01', to: '2027-08-31' }, lastSpan: { from: '2026-06-01', to: '2026-08-31' },
    });
    assert.equal(compareSpans(year, short, '2027-03-15'), null);
  });
});

let n = 0;
function line(over: Partial<ClubBookLineFacts>): ClubBookLineFacts {
  n++;
  return {
    id: `line-${n}`, ledgerId: 'general', bookKind: 'org', bookName: 'General', entryDate: '2026-09-15',
    description: 'A line', amount: 100, entryType: 'expense', status: 'posted', category: null,
    sourceModule: null, sourceEntityId: null, linkedEntryId: null, partnerKind: null,
    budgetCategoryId: null, budgetCategoryName: null, budgetItemId: null, budgetItemName: null, ...over,
  };
}
const DIAMOND = { budgetCategoryId: 'cat-fields', budgetCategoryName: 'Field & facilities', budgetItemId: 'item-diamond', budgetItemName: 'Diamond permits' };
const received = (installmentId: string, amount: number, entryDate: string) => line({
  amount, entryDate, entryType: 'transfer_in', category: 'rep_allocation', sourceModule: 'rep_allocation_installment',
  sourceEntityId: installmentId, partnerKind: 'team',
});
function bill(id: string, lineYearKey: string): ClubAllocationFacts {
  return {
    id, description: `Bill ${id}`, createdOn: `${lineYearKey.slice(0, 4)}-10-01`, sourceBudgetLineId: `line-${id}`, lineYearKey,
    splits: [{ id: `${id}-s`, teamId: 't', teamName: '12U A', amount: 500, installments: [{
      id: `${id}-i`, installmentNumber: 1, amount: 500, dueDate: `${lineYearKey.slice(0, 4)}-11-15`,
      paidAt: null, paidOn: null, sentAt: null, sentOn: null, accountingEntryId: null,
    }] }],
  };
}

describe('buildAgainstLastYear — this year\'s Actual beside last year\'s, filed by the one rule', () => {
  const spans = compareSpans(THIS, LAST, '2026-10-07')!;
  const out = buildAgainstLastYear({
    year: THIS, before: LAST, spans, setting: SEP, requests: [],
    allocations: [bill('old', LAST.key), bill('new', THIS.key)],
    thisLines: [
      line({ amount: 300, entryDate: '2026-09-15', ...DIAMOND }),
      line({ amount: 50, entryDate: '2026-10-08', ...DIAMOND }),                       // after today: outside the span
      line({ amount: 75, entryDate: '2026-09-20', status: 'pending', ...DIAMOND }),    // pending counts nowhere
      received('old-i', 200, '2026-09-20'),                                            // last year's bill, paid this year
      received('new-i', 100, '2026-09-25'),
    ],
    lastLines: [
      line({ amount: 250, entryDate: '2025-09-10', ...DIAMOND }),
      line({ amount: 999, entryDate: '2025-11-01', ...DIAMOND }),                      // past the same day last year
    ],
    statementOrder: { revenue: [], expenses: [] },
  });

  it('names the year before and the spans compared', () => {
    assert.deepEqual(out.lastYear, { key: LAST.key, name: '2025–26' });
    assert.deepEqual(out.lastSpan, { from: '2025-09-01', to: '2025-10-07' });
  });
  it('a category: this year, last year and the change (this − last), item by item', () => {
    assert.deepEqual([out.expenses.thisYear, out.expenses.lastYear, out.expenses.change], [300, 250, 50]);
    const diamond = out.expenses.categories.find(c => c.categoryId === 'cat-fields')!;
    assert.deepEqual(diamond.items.map(i => [i.itemName, i.thisYear, i.lastYear, i.change]), [['Diamond permits', 300, 250, 50]]);
  });
  it('an EARLIER year\'s bill paid in the year is one row, whichever year planned it; this year\'s own bill is its own', () => {
    const items = out.revenue.categories.flatMap(c => c.items);
    const earlier = items.find(i => i.itemId === EARLIER_BILLS_PREFIX);
    assert.ok(earlier, 'the earlier-years row');
    assert.deepEqual([earlier!.itemName, earlier!.thisYear], [EARLIER_YEARS_BILLS_WORD, 200]);
    assert.ok(items.some(i => i.itemId !== EARLIER_BILLS_PREFIX && i.thisYear === 100), 'this year\'s bill files as itself');
    assert.equal(out.revenue.thisYear, 300);
  });
  it('the net, both years, and its change', () => {
    assert.deepEqual(out.net, { thisYear: 0, lastYear: -250, change: 250 });
  });
  it('"offered when the year before has books": only what counts, in the span', () => {
    assert.equal(holdsBooks([line({ entryDate: '2025-09-10' })], spans.lastSpan), true);
    assert.equal(holdsBooks([line({ entryDate: '2025-09-10', status: 'pending' })], spans.lastSpan), false);
    assert.equal(holdsBooks([line({ entryDate: '2025-12-10' })], spans.lastSpan), false);
  });
});

describe('buildYearEndReport — read only from locked figures (specimen 5)', () => {
  const snapshot: CloseSnapshot = {
    installments: { count: 2, amount: 480, overdue: 1, sent: 0, upcoming: 1 },
    requests: { count: 0, amount: 0 }, unfiled: { count: 0, amount: 0 }, pending: { count: 1, amount: 60 },
    teams: [{ teamId: 't', teamName: '12U A', billed: 1000, collected: 520, owed: 480 }],
    totals: { billed: 1000, collected: 520, owed: 480 },
  };
  const statement = { revenue: { actual: 9000, categories: [] }, expenses: { actual: 7940, categories: [] } } as unknown as ClubReport['statement'];
  const closedSetting: FiscalSetting = {
    firstMonth: 9, rows: [row('2025-09-01', '2026-08-31', { closedAt: '2026-10-07T12:00:00Z', closedBy: 'u1', closingBalance: 16940 })],
  };
  const closed = fiscalYearOf('2026-03-01', closedSetting);
  const input = {
    closedByName: 'Pat Treasurer', opening: 15880, report: { statement }, againstLastYear: null,
    books: [{ id: 'g', name: 'General', kind: 'org', atStart: 12000.1, atEnd: 13000.2 }, { id: 'b', name: 'Bank', kind: 'org_named', atStart: 3880, atEnd: 3940 }],
    snapshot, nextYear: fiscalYearOf('2026-10-07', closedSetting),
  };

  it('the year at a glance closes on the stored closing, never a figure worked out again', () => {
    const r = buildYearEndReport({ ...input, year: closed });
    assert.deepEqual(r.atAGlance, { opening: 15880, revenue: 9000, expenses: 7940, net: 1060, closing: 16940 });
    assert.deepEqual(r.booksTotal, { atStart: 15880.1, atEnd: 16940.2 });
    assert.deepEqual([r.carried.nextYear.name, r.carried.closing, r.carried.stillOpen.installments.count], ['2026–27', 16940, 2]);
    assert.deepEqual(r.teamsTotal, { billed: 1000, collected: 520, owed: 480 });
  });
  it('B11: a group-scoped reader sees their teams named and every other team counted as one row, never named', () => {
    const club: CloseSnapshot = {
      ...snapshot,
      teams: [
        { teamId: 'mine', teamName: '12U A', billed: 1000, collected: 520, owed: 480 },
        { teamId: 'x', teamName: '16U Girls', billed: 600, collected: 600, owed: 0 },
        { teamId: 'y', teamName: '10U A', billed: 400.25, collected: 0, owed: 400.25 },
      ],
      totals: { billed: 2000.25, collected: 1120, owed: 880.25 },
      installmentTeams: ['12U A', '10U A'], requestTeams: ['16U Girls', 'A team gone since'],
    };
    const ids = new Map([['12U A', ['mine']], ['16U Girls', ['x']], ['10U A', ['y']]]);
    const seen = scopeCloseSnapshot(club, new Set(['mine']), ids);
    assert.deepEqual(seen.teams.map(t => [t.teamName, t.billed, t.collected, t.owed]), [
      ['12U A', 1000, 520, 480], [OUTSIDE_YOUR_GROUPS_WORD, 1000.25, 600, 400.25],
    ]);
    assert.deepEqual(seen.totals, club.totals, 'the club\'s totals stay the club\'s');
    assert.deepEqual(seen.installmentTeams, ['12U A', OUTSIDE_YOUR_GROUPS_WORD]);
    assert.deepEqual(seen.requestTeams, [OUTSIDE_YOUR_GROUPS_WORD], 'a name the reader cannot place is never shown');
    assert.equal(scopeCloseSnapshot(club, null, ids), club, 'an unscoped reader sees the whole record');
  });
  it('an open year has no year-end report', () => {
    assert.throws(() => buildYearEndReport({ ...input, year: fiscalYearOf('2026-10-07', closedSetting) }), /CLOSED year/);
  });
});
