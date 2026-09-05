/**
 * **ONE MONTH GRID — the Budget tab's by-period view and Budget vs. Actual's months view answer
 * the same questions the same way** (owner ruling 2026-09-04, QA §133).
 *
 * WHY THIS FILE EXISTS. The two grids spread one season across months and had drifted into two
 * different tables, one tab apart. The owner found it by reading them side by side:
 *
 *   · the undated column was called **Unscheduled** on one and **No date yet** on the other, and
 *     sat LAST on one and FIRST on the other;
 *   · the Budget tab grouped months under a YEAR BAND while the statement spelled `Mar '26` into
 *     every heading — two answers to "which year is this column?";
 *   · the statement windowed twelve months with a stepper and the Budget tab drew every column it
 *     had, which is fine at the ten a normal plan produces and unusable at twenty-four.
 *
 * ⚠⚠ **AND THE NAME HALF WAS LOSING MONEY, WHICH IS WHY THIS IS A GUARD AND NOT A STYLE NOTE.**
 * The by-period EXPORT wrote `Unscheduled` as a column heading and the importer's aliases have
 * never contained that word — so a plan exported from that screen and read back dropped every
 * undated amount, silently, with the row still arriving and simply carrying no figure. On the
 * owner's own plan that was $4,750 of costs and $1,950 of income out of $13,600. Nothing failed,
 * nothing warned, and the totals a coach would check were computed from what survived.
 *
 * ⚠ **THE BAND'S SPANS HAVE NO VISUAL TELL.** A year band is a row of `colSpan` cells above the
 * headings it describes. Get the arithmetic wrong — a leading blank of 1 where the undated column
 * needs 2 — and every year silently shifts one column while the table still renders perfectly.
 * There is no error, no overflow, no clipped cell: just a grid quietly labelling October as the
 * wrong year. `monthYearBands` is where that arithmetic lives for BOTH grids, so its spans are
 * asserted to cover the window exactly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  monthYearBands, formatMonthBare, periodRangeLabel, MONTH_WINDOW,
} from '../../lib/coach-budget-months';
import { buildPeriodView, UNSCHEDULED } from '../../lib/coach-budget-periods-view';
import { budgetPeriodGridColumns } from '../../lib/coach-money-exports';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const line = (over: Partial<Parameters<typeof buildPeriodView>[0][number]> = {}) => ({
  id: 'l1', description: 'Dome Time', itemId: 'i1', itemName: 'Dome Time',
  categoryName: 'Facilities', lineKind: 'cost' as const, totalAmount: 5200,
  periods: [] as Array<{ periodDate: string | null; amount: number }>,
  ...over,
});

// ── the band arithmetic ──────────────────────────────────────────────────────
test('a year band covers its window exactly — never one column more or fewer', () => {
  const cases: Array<[string, string[]]> = [
    ['one year',            ['2026-01', '2026-02', '2026-03']],
    ['crossing New Year',   ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02']],
    ['a full twelve',       Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`)],
    ['three years',         ['2025-12', '2026-06', '2027-01']],
    ['a single column',     ['2026-07']],
  ];
  for (const [what, months] of cases) {
    const bands = monthYearBands(months as never);
    const covered = bands.reduce((s, b) => s + b.span, 0);
    assert.equal(covered, months.length,
      `The ${what} band row covers ${covered} columns for ${months.length} months. This is the `
      + 'defect with no visual tell: the table still renders, and every year sits over the wrong '
      + 'columns.');
    // Consecutive runs, never the same year twice — two adjacent bands reading "2026" then "2026"
    // would draw a hairline through the middle of one year.
    const years = bands.map(b => b.year);
    assert.equal(new Set(years).size, years.length, `${what}: a year is banded twice`);
  }
});

test('the band never claims a column that is outside time', () => {
  /* `monthYearBands` is handed the DATED columns only. Handing it the undated column would give
     "unscheduled" a year of "unsc", and the band would then be one wider than the months it
     describes — shifting every heading after it. */
  const bands = monthYearBands(['2026-01', '2026-02'] as never);
  assert.equal(bands.reduce((s, b) => s + b.span, 0), 2);
  assert.ok(!bands.some(b => b.year === UNSCHEDULED.slice(0, 4)),
    'the undated column reached the band builder');
});

// ── the undated column ───────────────────────────────────────────────────────
test('the undated column is called "No date yet" and it leads', () => {
  const view = buildPeriodView([line({ periods: [{ periodDate: null, amount: 5200 }] })], 'months');
  const undated = view.columns.filter(c => c.unscheduled);
  assert.equal(undated.length, 1, 'exactly one undated column');
  assert.equal(undated[0].label, 'No date yet',
    'The undated column has been renamed. It was "Unscheduled" until 2026-09-04, which no import '
    + 'alias matched — see this file\'s header for what that cost.');
  assert.equal(view.columns[0].unscheduled, true,
    'The undated column no longer leads. Owner ruling 2026-09-04: it comes first on BOTH grids, '
    + 'because that is where Budget vs. Actual has always put it.');
});

test('the export heading matches the screen, and it is a word the importer knows', () => {
  const view = buildPeriodView([
    line({ periods: [{ periodDate: null, amount: 3200 }] }),
    line({ id: 'l2', description: 'Umpire Fees', itemId: 'i2', itemName: 'Umpire Fees', totalAmount: 300,
      periods: [{ periodDate: '2026-04-01', amount: 300 }] }),
  ], 'months');
  const labels = budgetPeriodGridColumns(view).map(c => c.label);
  assert.equal(labels[1], 'No date yet',
    'The export heading drifted from the screen again. These two must move together — the heading '
    + 'is what the importer reads back.');

  /* ⚠ THE ROUND TRIP, ASSERTED AGAINST THE IMPORTER'S OWN ALIAS LIST rather than a copy of it.
     The export writes a heading; the importer matches headings case-insensitively against
     ALIASES.undated. If those two ever disagree again, undated money leaves the file in silence. */
  const importer = read('lib/coach-budget-import.ts');
  const aliases = /undated:\s*\[([^\]]*)\]/.exec(importer)?.[1] ?? '';
  assert.ok(aliases.includes(`'${labels[1].toLowerCase()}'`),
    `The by-period export writes "${labels[1]}" and the importer's undated aliases are [${aliases}]. `
    + 'A heading the importer does not know does not fail an import — it drops every undated '
    + 'amount and hands back rows that look present.');
  assert.ok(aliases.includes(`'unscheduled'`),
    'The OLD heading was dropped from the aliases. Spreadsheets exported before 2026-09-04 say '
    + '"Unscheduled" and are still sitting on coaches\' machines; this alias is what makes those '
    + 'files import correctly, and it is not tidy-up to remove.');
});

// ── the window ───────────────────────────────────────────────────────────────
test('both grids read one window size and one wording for it', () => {
  assert.equal(MONTH_WINDOW, 12);
  const grid = read('components/coaches/MoneyMonthGrid.tsx');
  assert.ok(/export \{ MONTH_WINDOW \}/.test(grid),
    'MoneyMonthGrid is defining its own MONTH_WINDOW again. It re-exports the lib\'s so the two '
    + 'grids cannot show a season a different number of months at a time.');
  for (const [what, src] of [
    ['the Budget tab', read('app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx')],
    ['Budget vs. Actual', read('app/[orgSlug]/coaches/teams/[teamId]/accounting/budget-vs-actual/panel.tsx')],
  ] as const) {
    assert.ok(src.includes('periodRangeLabel('),
      `${what}'s pager is wording its own range again. One wording, both grids — they name the `
      + 'same kind of window one tab apart.');
    assert.ok(src.includes('<ColumnPager'),
      `${what} is hand-rolling a pager. ColumnPager is the shared control; a copy per panel is how `
      + 'the budget and bva header CSS forked before.');
  }
});

test('the window says its own name, and says the year once when one year covers it', () => {
  assert.equal(periodRangeLabel(['2026-01', '2026-10']), 'Jan – Oct 2026');
  assert.equal(periodRangeLabel(['2026-03', '2027-02']), 'Mar 2026 – Feb 2027');
  assert.equal(periodRangeLabel(['2026-07']), 'Jul 2026');
  assert.equal(periodRangeLabel([]), '');
  // A quarter key must not be read as a month — otherwise a quarters window would print "May".
  assert.equal(periodRangeLabel(['2027-Q2', '2027-Q4']), 'Q2 – Q4 2027');
});

test('a bare month heading is only ever paired with a band', () => {
  assert.equal(formatMonthBare('2026-03' as never), 'Mar');
  /* ⚠ THE PAIR IS THE POINT. A bare month with no band over it is a column that does not say which
     year it is — the exact defect the band was introduced to fix, arrived at from the other side.
     Both files that call one must call the other. */
  for (const [what, path] of [
    ['Budget vs. Actual', 'components/coaches/MoneyMonthGrid.tsx'],
    ['the Budget tab', 'app/[orgSlug]/coaches/teams/[teamId]/accounting/budget/panel.tsx'],
  ] as const) {
    const src = read(path);
    const bare = src.includes('formatMonthBare(') || src.includes('MONTH_SHORT[');
    const band = src.includes('monthYearBands(') || src.includes('yearBands');
    assert.equal(bare && !band, false,
      `${what} prints bare month headings with no year band above them. A column that cannot say `
      + 'its own year is worse than a heading that repeats it.');
  }
});
