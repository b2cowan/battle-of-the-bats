import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { readCode } from './_source-code.ts';
import { filterSummary } from '../../lib/filter-summary.ts';
import { ledgerOptionCounts, type LineStatus, type LineType } from '../../lib/club-ledger.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A FILTER'S COUNT SITS AT ITS ROW'S END; A NARROWED PILL NAMES ITS CHOICES (Filter Counts, owner
 * rulings D1–D6, 2026-10-05 — hub https://claude.ai/artifact/EFWMUeiC3sLkn4CQaBqzrw, plan
 * docs/projects/active/FILTER_COUNTS_PLAN.md).
 *
 *   D1 — a count is the option's `count`, drawn at the row's end; never written into its label.
 *   D2 — a narrowed pill names up to three choices, else "N selected".
 *   D3 — the pill and the phone sheet's row read ONE function.
 *   D4 — the practice library's Tags follows.
 *   D5 — every count is what ticking that choice would list (the club's too), and the club's "All" means all.
 *   D6 — the coach's Type reads "Every type".
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const OPTIONS = [
  { id: 'a', label: 'Actual' }, { id: 'o', label: 'Overdue' }, { id: 's', label: 'Scheduled' }, { id: 'x', label: 'Extra' },
];

describe('D2 — what a multi-choice filter says it is set to', () => {
  it('nothing ticked reads the all word', () => {
    assert.equal(filterSummary(OPTIONS, new Set(), 'All'), 'All');
  });
  it('one, two or three ticked read their names in list order', () => {
    assert.equal(filterSummary(OPTIONS, new Set(['a']), 'All'), 'Actual');
    assert.equal(filterSummary(OPTIONS, new Set(['s', 'a']), 'All'), 'Actual, Scheduled');
    assert.equal(filterSummary(OPTIONS, new Set(['a', 'o', 's']), 'All'), 'Actual, Overdue, Scheduled');
  });
  it('four or more read "N selected"', () => {
    assert.equal(filterSummary(OPTIONS, new Set(['a', 'o', 's', 'x']), 'All'), '4 selected');
  });
  it('a selection holding an option no longer offered never reads as unfiltered', () => {
    assert.equal(filterSummary(OPTIONS, new Set(['gone']), 'All'), '1 selected');
    assert.equal(filterSummary(OPTIONS, new Set(['a', 'gone']), 'All'), '2 selected');
  });
});

describe('D1 + D3 + D4 — the count beside the name, one wording for the pill and the sheet row', () => {
  const pill = readCode('components/coaches/MultiSelectDropdown.tsx');
  it('the pill and the row both read filterSummary; nothing strips a count back off a label', () => {
    assert.match(pill, /const summary = filterSummary\(options, selected, allLabel\);/);
    assert.match(pill, /<FilterSheetRow name=\{label\} value=\{summary\}/);
    assert.doesNotMatch(pill, /bareLabel/);
  });
  // Every file that uses the pill, found by walking the app — a new filter screen is covered the day it lands.
  const callers = ['app', 'components']
    .flatMap(root => readdirSync(root, { recursive: true }).map(f => `${root}/${String(f).replace(/\\/g, '/')}`))
    .filter(f => f.endsWith('.tsx') && !f.endsWith('/MultiSelectDropdown.tsx'))
    .filter(f => readCode(f).includes('<MultiSelectDropdown'));
  it('finds the pill\'s callers (the walk is not empty)', () => {
    assert.ok(callers.length >= 5, callers.join(', '));
  });
  for (const file of callers) {
    it(`${file.split('/').slice(-2).join('/')} writes no count into an option's label`, () => {
      assert.doesNotMatch(readCode(file), /label: `[^`]*\(\$\{[^`]*\}\)`/, 'a "Name (n)" label is back — pass `count` instead');
    });
  }
  it('the counts the Ledgers and the library show ride `count`', () => {
    const coach = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx');
    assert.match(coach, /label: REGISTER_STATUS_LABEL\[id\], count: statusCounts\[id\]/);
    assert.match(coach, /label: PAYABLE_STATUS_LABEL\[id\], count: payStatusCounts\[id\]/);
    assert.match(coach, /label: t\.name,\s*count: counts\.get\(t\.id\) \?\? 0/);
    const lib = readCode('components/coaches/LibraryRow.tsx');
    assert.match(lib, /label: t\.name, count: counts\.get\(t\.id\) \?\? 0/);
    assert.match(lib, /label: 'No tags', count: untagged/);
  });
});

describe('D5 — the club Ledger counts what ticking a choice would list, and All means all', () => {
  const row = (status: LineStatus, type: LineType, category: string | null = null) => ({ status, type, category, item: null });
  // The live defect: seven expenses in the window, two of them voided — "Expenses (7)" listed five.
  const rows = [
    row('posted', 'expense', 'Equipment'), row('posted', 'expense', 'Equipment'), row('posted', 'expense', 'Facilities'),
    row('pending', 'expense', 'Officials'), row('posted', 'expense', 'Facilities'),
    row('void', 'expense', 'Equipment'), row('void', 'expense', 'Facilities'),
    row('posted', 'income', null), row('void', 'transfer', null),
  ];
  const REST = new Set<LineStatus>(['posted', 'pending']);
  const ALL = new Set<LineStatus>(['posted', 'pending', 'void']);

  it('at rest a Type counts only the lines Status shows — Expenses lists 5, not 7', () => {
    const c = ledgerOptionCounts(rows, { status: REST, types: null, categories: null, items: null });
    assert.equal(c.type.expense, 5);
    assert.equal(c.type.income, 1);
    assert.equal(c.type.transfer, undefined, 'a voided transfer is not counted while Void is hidden');
  });
  it('with Void shown the voided lines count toward their Type', () => {
    const c = ledgerOptionCounts(rows, { status: ALL, types: null, categories: null, items: null });
    assert.equal(c.type.expense, 7);
    assert.equal(c.type.transfer, 1);
  });
  it('a Status counts the lines the Type and Category filters admit', () => {
    const c = ledgerOptionCounts(rows, { status: REST, types: new Set<LineType>(['expense']), categories: null, items: null });
    assert.deepEqual(c.status, { posted: 4, pending: 1, void: 2 });
    const f = ledgerOptionCounts(rows, { status: REST, types: null, categories: new Set(['Facilities']), items: null });
    assert.deepEqual(f.status, { posted: 2, void: 1 });
    assert.equal(f.type.expense, 2);
  });
  it('an Item narrows the counts as a Category does, and a line with no item is never in one (owner 2026-10-07)', () => {
    const withItems = [
      { status: 'posted' as LineStatus, type: 'expense' as LineType, category: 'Facilities', item: 'Diamond permits' },
      { status: 'posted' as LineStatus, type: 'expense' as LineType, category: 'Facilities', item: 'Practice balls' },
      { status: 'pending' as LineStatus, type: 'expense' as LineType, category: 'Facilities', item: 'Diamond permits' },
      { status: 'posted' as LineStatus, type: 'transfer' as LineType, category: null, item: null },
    ];
    const c = ledgerOptionCounts(withItems, { status: REST, types: null, categories: null, items: new Set(['Diamond permits']) });
    assert.deepEqual(c.status, { posted: 1, pending: 1 });
    assert.deepEqual(c.type, { expense: 2 });
  });
  it('the page reads the per-choice numbers, keeps the census for the export, and lets All mean all three', () => {
    const page = readCode('app/[orgSlug]/admin/accounting/ledger/page.tsx');
    assert.match(page, /const STATUS_ALL: ReadonlySet<string> = new Set\(STATUS_ORDER\);/);
    assert.match(page, /const statuses = pickedStatuses\.size \? pickedStatuses : STATUS_ALL;/);
    assert.doesNotMatch(page, /next\.size \? next : new Set\(STATUS_REST\)/, 'an empty pick must not snap back to rest');
    assert.match(page, /count: optionCounts\?\.type\?\.\[t\] \?\? 0/);
    assert.match(page, /count: optionCounts\?\.status\?\.\[s\] \?\? 0/);
    assert.match(page, /total=\{\(counts\?\.status\.posted \?\? 0\) \+ \(counts\?\.status\.pending \?\? 0\) \+ \(counts\?\.status\.void \?\? 0\)\}/,
      'the export menu still says every entry in the period');
    const read = readCode('lib/club-ledger-read.ts');
    assert.match(read, /optionCounts: ledgerOptionCounts\(/);
  });
});

describe('D6 — one word for a filter at rest', () => {
  it('the coach\'s Type reads "Every type", as the club\'s does', () => {
    const coach = readCode('app/[orgSlug]/coaches/teams/[teamId]/accounting/expenses/panel.tsx');
    assert.match(coach, /label="Type"[\s\S]{0,400}allLabel="Every type"/);
    assert.match(readCode('app/[orgSlug]/admin/accounting/ledger/page.tsx'), /label="Type"[^\n]*allLabel="Every type"/);
  });
});
