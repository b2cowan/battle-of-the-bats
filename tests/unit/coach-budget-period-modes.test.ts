import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  derivedPeriodLabel, resolvedPeriodLabel, blankPeriod, nextPeriodDate,
  fillSeasonPeriods, inferSplitMode, readDate, monthDate, quarterDate, quarterOf,
  splitWindow, splitPickerYears, SPLIT_WINDOW_MONTHS, evenShares, isEvenWithinRounding, refitSplit,
  type PeriodDraft, type PeriodSplitMode,
} from '../../lib/coach-budget-period-modes.ts';
import { MAX_MONTH_COLUMNS } from '../../lib/coach-budget-months.ts';

function p(date: string, label = '', amount = ''): PeriodDraft {
  return { date, label, amount };
}

/** A 2027 season opened partway through its own year — the January rule, which is the whole of
 *  what the pickers offered before the opened month counted. */
const IN_YEAR = splitWindow(2027, '2027-06-15');
/** A 2027 season opened in September 2026 to run winter training — the owner's own team, and
 *  the case that could not budget a dollar before January (ruling 2026-09-21). */
const EARLY = splitWindow(2027, '2026-09-03');

describe('reading dates', () => {
  it('parses a real date and rejects everything else', () => {
    assert.deepEqual(readDate('2027-04-01'), { year: 2027, month: 3, day: 1 });
    assert.equal(readDate(''), null);
    assert.equal(readDate(null), null);
    assert.equal(readDate('2027-04'), null);
    assert.equal(readDate('2027-13-01'), null);
    assert.equal(readDate('2027-04-00'), null);
  });

  it('builds month and quarter anchors', () => {
    assert.equal(monthDate(2027, 0), '2027-01-01');
    assert.equal(monthDate(2027, 11), '2027-12-01');
    assert.equal(quarterDate(2027, 0), '2027-01-01');
    assert.equal(quarterDate(2027, 3), '2027-10-01');
    assert.equal(quarterOf(0), 0);
    assert.equal(quarterOf(5), 1);
    assert.equal(quarterOf(11), 3);
  });

});

describe('the window a period can be dated in', () => {
  it('runs two years from January for a season opened in its own year', () => {
    assert.deepEqual(IN_YEAR, { first: '2027-01', last: '2028-12' });
    assert.equal(SPLIT_WINDOW_MONTHS, MAX_MONTH_COLUMNS, 'the by-period view\'s own column cap');
  });

  it('starts when the season was opened, when that is earlier than its January', () => {
    assert.deepEqual(EARLY, { first: '2026-09', last: '2028-08' });
  });

  it('does not lose the season\'s own year to a late opening', () => {
    // A coach who signed up in June still lays out January to May — the literal "two years from
    // opening" would have taken those months away from them.
    assert.deepEqual(splitWindow(2027, '2027-06-15'), { first: '2027-01', last: '2028-12' });
    assert.deepEqual(splitWindow(2027, '2028-02-01'), { first: '2027-01', last: '2028-12' });
  });

  it('never ends before the season\'s own December', () => {
    // A year set up far ahead is offered in full, even past twenty-four months.
    assert.deepEqual(splitWindow(2028, '2026-03-10'), { first: '2026-03', last: '2028-12' });
  });

  it('falls back to the January rule when the opened day is missing or malformed', () => {
    assert.deepEqual(splitWindow(2027, null), IN_YEAR);
    assert.deepEqual(splitWindow(2027, undefined), IN_YEAR);
    assert.deepEqual(splitWindow(2027, 'soon'), IN_YEAR);
    assert.deepEqual(splitWindow(2027, '2026-13-01'), IN_YEAR);
  });

  it('accepts a month key as well as a day', () => {
    assert.deepEqual(splitWindow(2027, '2026-09'), EARLY);
  });

  it('groups the months of the window by year for the pickers', () => {
    assert.deepEqual(splitPickerYears(IN_YEAR, 'months'), [
      { year: 2027, slots: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      { year: 2028, slots: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    ]);
    assert.deepEqual(splitPickerYears(EARLY, 'months'), [
      { year: 2026, slots: [8, 9, 10, 11] },
      { year: 2027, slots: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      { year: 2028, slots: [0, 1, 2, 3, 4, 5, 6, 7] },
    ]);
  });

  it('also offers a month the line already holds, inside the window or not', () => {
    // A line saved under the old year-pair rule past this window's edge, or imported with an
    // explicit year, reopens showing the month it holds rather than the browser's first option.
    assert.deepEqual(splitPickerYears(EARLY, 'months', [p('2028-11-01'), p('2025-06-01'), p('')]), [
      { year: 2025, slots: [5] },
      { year: 2026, slots: [8, 9, 10, 11] },
      { year: 2027, slots: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      { year: 2028, slots: [0, 1, 2, 3, 4, 5, 6, 7, 10] },
    ]);
    // A held month inside the window is not offered twice; a quarter is offered once for any day in it.
    assert.deepEqual(splitPickerYears(EARLY, 'months', [p('2027-03-01')]), splitPickerYears(EARLY, 'months'));
    assert.deepEqual(splitPickerYears(EARLY, 'quarters', [p('2028-11-15')]), [
      { year: 2026, slots: [2, 3] },
      { year: 2027, slots: [0, 1, 2, 3] },
      { year: 2028, slots: [0, 1, 2, 3] },
    ]);
  });

  it('offers a quarter when any of its months is in the window', () => {
    assert.deepEqual(splitPickerYears(IN_YEAR, 'quarters'), [
      { year: 2027, slots: [0, 1, 2, 3] },
      { year: 2028, slots: [0, 1, 2, 3] },
    ]);
    // September opens inside Q3, so Q3 2026 is on offer; August 2028 closes inside Q3 2028.
    assert.deepEqual(splitPickerYears(EARLY, 'quarters'), [
      { year: 2026, slots: [2, 3] },
      { year: 2027, slots: [0, 1, 2, 3] },
      { year: 2028, slots: [0, 1, 2] },
    ]);
  });
});

describe('derived period names', () => {
  it('names a month, a quarter and an exact date', () => {
    assert.equal(derivedPeriodLabel('months', p('2027-04-01'), 0), 'Apr 2027');
    assert.equal(derivedPeriodLabel('quarters', p('2027-04-01'), 0), 'Q2 2027');
    assert.equal(derivedPeriodLabel('dates', p('2027-03-14'), 0), 'Mar 14, 2027');
  });

  it('reads a date on the 1st as the month it opens', () => {
    assert.equal(derivedPeriodLabel('dates', p('2027-03-01'), 0), 'Mar 2027');
  });

  it('falls back to the position when there is nothing to derive from', () => {
    assert.equal(derivedPeriodLabel('names', p(''), 0), 'Period 1');
    assert.equal(derivedPeriodLabel('names', p(''), 4), 'Period 5');
    // A dateless row in a dated mode is still nameable — nothing may block a save.
    assert.equal(derivedPeriodLabel('months', p(''), 1), 'Period 2');
  });

  it('resolves to what the coach typed when they typed something', () => {
    assert.equal(resolvedPeriodLabel('months', p('2027-04-01', 'Spring tournament'), 0), 'Spring tournament');
    assert.equal(resolvedPeriodLabel('months', p('2027-04-01', '   '), 0), 'Apr 2027');
    assert.equal(resolvedPeriodLabel('months', p('2027-04-01', ''), 0), 'Apr 2027');
  });

  it('never resolves to a blank — the stored column is NOT NULL', () => {
    const modes: PeriodSplitMode[] = ['months', 'quarters', 'dates', 'names'];
    for (const mode of modes) {
      for (const draft of [p(''), p('2027-04-01'), p('', '  ')]) {
        assert.ok(resolvedPeriodLabel(mode, draft, 0).length > 0, `${mode} produced a blank label`);
      }
    }
  });
});

describe('the first period', () => {
  it('anchors month and quarter splits on the window\'s first month, and dates on nothing', () => {
    assert.equal(blankPeriod('months', IN_YEAR).date, '2027-01-01');
    assert.equal(blankPeriod('quarters', IN_YEAR).date, '2027-01-01');
    assert.equal(blankPeriod('dates', IN_YEAR).date, '');
    assert.equal(blankPeriod('names', IN_YEAR).date, '');
    assert.equal(blankPeriod('months', IN_YEAR).amount, '');
    assert.equal(blankPeriod('months', IN_YEAR).label, '');
  });

  it('starts a season opened in September in September — and its quarters in Q3', () => {
    assert.equal(blankPeriod('months', EARLY).date, '2026-09-01');
    assert.equal(blankPeriod('quarters', EARLY).date, '2026-07-01');
  });
});

describe('add period advances on its own', () => {
  it('walks the months so twelve taps build a year', () => {
    let rows: PeriodDraft[] = [blankPeriod('months', IN_YEAR)];
    const seen = [rows[0].date];
    for (let i = 0; i < 11; i++) {
      rows = [...rows, p(nextPeriodDate('months', rows, IN_YEAR))];
      seen.push(rows[rows.length - 1].date);
    }
    assert.equal(seen.length, 12);
    assert.equal(seen[0], '2027-01-01');
    assert.equal(seen[11], '2027-12-01');
    assert.equal(new Set(seen).size, 12, 'every month is distinct');
  });

  it('walks quarters three months at a time', () => {
    const rows = [p('2027-01-01')];
    assert.equal(nextPeriodDate('quarters', rows, IN_YEAR), '2027-04-01');
    assert.equal(nextPeriodDate('quarters', [p('2027-10-01')], IN_YEAR), '2028-01-01');
  });

  it('rolls December into the following January', () => {
    assert.equal(nextPeriodDate('months', [p('2027-12-01')], IN_YEAR), '2028-01-01');
  });

  it('stops advancing rather than leaving the picker range', () => {
    assert.equal(nextPeriodDate('months', [p('2028-12-01')], IN_YEAR), '2028-12-01');
    assert.equal(nextPeriodDate('quarters', [p('2028-10-01')], IN_YEAR), '2028-10-01');
    // An early-opened season's window closes in August: the last month repeats, and the last
    // quarter is the one August sits in.
    assert.equal(nextPeriodDate('months', [p('2028-08-01')], EARLY), '2028-08-01');
    assert.equal(nextPeriodDate('quarters', [p('2028-07-01')], EARLY), '2028-07-01');
  });

  it('starts where the window does when there is nothing to advance from', () => {
    assert.equal(nextPeriodDate('months', [], IN_YEAR), '2027-01-01');
    assert.equal(nextPeriodDate('months', [p('')], IN_YEAR), '2027-01-01');
    assert.equal(nextPeriodDate('months', [], EARLY), '2026-09-01');
    assert.equal(nextPeriodDate('quarters', [], EARLY), '2026-07-01');
  });

  it('has nothing to say in date and name modes', () => {
    assert.equal(nextPeriodDate('dates', [p('2027-03-14')], IN_YEAR), '');
    assert.equal(nextPeriodDate('names', [], IN_YEAR), '');
  });
});

describe('fill the season', () => {
  it('adds every month the line does not already cover, in calendar order', () => {
    const filled = fillSeasonPeriods('months', [p('2027-06-01', '', '500')], IN_YEAR);
    assert.equal(filled.length, 12);
    assert.deepEqual(filled.map(r => r.date.slice(5, 7)),
      ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
    // The row that was already there keeps its amount.
    assert.equal(filled.find(r => r.date === '2027-06-01')!.amount, '500');
  });

  it('adds four quarters', () => {
    const filled = fillSeasonPeriods('quarters', [], IN_YEAR);
    assert.deepEqual(filled.map(r => r.date), ['2027-01-01', '2027-04-01', '2027-07-01', '2027-10-01']);
  });

  it('lays out the year that BEGINS when the season was opened', () => {
    // September to August for the owner's team — the months it was opened early for, not the
    // calendar year that starts four months in.
    const months = fillSeasonPeriods('months', [], EARLY);
    assert.deepEqual(months.map(r => r.date.slice(0, 7)), [
      '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02',
      '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08',
    ]);
    const quarters = fillSeasonPeriods('quarters', [], EARLY);
    assert.deepEqual(quarters.map(r => r.date), ['2026-07-01', '2026-10-01', '2027-01-01', '2027-04-01']);
  });

  it('is a no-op once the season is covered', () => {
    const full = fillSeasonPeriods('months', [], IN_YEAR);
    assert.equal(fillSeasonPeriods('months', full, IN_YEAR), full, 'same array back — nothing added');
    const early = fillSeasonPeriods('months', [], EARLY);
    assert.equal(fillSeasonPeriods('months', early, EARLY), early);
  });

  it('ignores rows outside the season when deciding what is missing', () => {
    const filled = fillSeasonPeriods('quarters', [p('2028-01-01')], IN_YEAR);
    assert.equal(filled.length, 5);
    // A December 2026 row on the early team IS in its season, and is not added twice.
    assert.equal(fillSeasonPeriods('months', [p('2026-12-01')], EARLY).length, 12);
  });

  it('leaves undated rows at the end', () => {
    const filled = fillSeasonPeriods('months', [p('', 'Deposit', '100')], IN_YEAR);
    assert.equal(filled.length, 13);
    assert.equal(filled[12].label, 'Deposit');
  });

  it('does nothing in date and name modes', () => {
    const rows = [p('2027-03-14')];
    assert.equal(fillSeasonPeriods('dates', rows, IN_YEAR), rows);
    assert.equal(fillSeasonPeriods('names', rows, IN_YEAR), rows);
  });
});

describe('reopening a saved line', () => {
  it('reads twelve 1st-of-months as a month split', () => {
    const rows = fillSeasonPeriods('months', [], IN_YEAR)
      .map((r, i) => p(r.date, derivedPeriodLabel('months', r, i)));
    assert.equal(inferSplitMode(rows), 'months');
  });

  it('reads quarter starts as quarters ONLY when the labels agree', () => {
    const dates = ['2027-01-01', '2027-04-01', '2027-07-01', '2027-10-01'];
    const quarters = dates.map((d, i) => p(d, `Q${i + 1} 2027`));
    assert.equal(inferSplitMode(quarters), 'quarters');

    // Same dates, month names — a coach who budgets Jan/Apr/Jul/Oct monthly is not budgeting
    // quarterly, and re-opening in the wrong mode would rename their periods.
    const monthly = dates.map((d, i) => p(d, derivedPeriodLabel('months', p(d), i)));
    assert.equal(inferSplitMode(monthly), 'months');
  });

  it('reads any non-1st date as an explicit date split', () => {
    assert.equal(inferSplitMode([p('2027-02-14'), p('2027-06-06')]), 'dates');
    assert.equal(inferSplitMode([p('2027-02-01'), p('2027-06-06')]), 'dates');
  });

  it('reads an undated period as a names-only split', () => {
    assert.equal(inferSplitMode([p('', 'Deposit'), p('', 'Balance')]), 'names');
    // One undated row is enough — the split cannot be a calendar.
    assert.equal(inferSplitMode([p('2027-02-01'), p('', 'Balance')]), 'names');
  });

  it('defaults an empty line to months', () => {
    assert.equal(inferSplitMode([]), 'months');
  });

  it('round-trips every mode it can name', () => {
    const cases: Array<[PeriodSplitMode, PeriodDraft[]]> = [
      ['months',   [p('2027-01-01'), p('2027-02-01')]],
      ['quarters', [p('2027-01-01', 'Q1 2027'), p('2027-04-01', 'Q2 2027')]],
      ['dates',    [p('2027-03-14'), p('2027-09-02')]],
      ['names',    [p('', 'Deposit'), p('', 'Balance')]],
    ];
    for (const [mode, rows] of cases) {
      const saved = rows.map((r, i) => p(r.date, resolvedPeriodLabel(mode, r, i)));
      assert.equal(inferSplitMode(saved), mode, `${mode} did not survive a save/reopen`);
    }
  });
});

describe('the three-Januaries defect (mode change must RESET, never convert)', () => {
  it('is unreachable because nothing here converts one shape into another', () => {
    // The v1 mockup mapped each of twelve months onto a quarter, then back — piling three rows
    // into each quarter and producing three Januaries, three Aprils and so on. The ruling is that
    // a mode change starts over, so the only thing this module offers for a new mode is ONE blank
    // period. Pinned so a future "helpful" converter has to delete this test to exist.
    const twelve = fillSeasonPeriods('months', [], IN_YEAR);
    assert.equal(twelve.length, 12);

    const afterSwitch = [blankPeriod('quarters', IN_YEAR)];
    assert.equal(afterSwitch.length, 1);
    assert.equal(afterSwitch[0].date, '2027-01-01');
    assert.equal(afterSwitch[0].amount, '');

    const backToMonths = [blankPeriod('months', IN_YEAR)];
    assert.equal(backToMonths.length, 1);
    const januaries = backToMonths.filter(r => r.date.slice(5, 7) === '01');
    assert.equal(januaries.length, 1);
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
   The amounts in the rows (owner QA §133, 2026-09-04)
   ───────────────────────────────────────────────────────────────────────────── */

/** Every split has to add to its total EXACTLY — the sum check the coach meets is ±$0.02, but a
 *  penny of slop that survives a save becomes a penny the report cannot explain. */
const sumOf = (values: number[]) => values.reduce((s, v) => s + v, 0);
function assertAddsUp(values: number[], total: number) {
  assert.equal(Math.round(sumOf(values) * 100), Math.round(total * 100));
}

describe('splitting evenly', () => {
  it('puts $6,000 across three months in $2,000 increments', () => {
    assert.deepEqual(evenShares(6000, 3), [2000, 2000, 2000]);
  });

  it('gives the leftover cents to the last row, and still adds up', () => {
    assert.deepEqual(evenShares(5200, 3), [1733.33, 1733.33, 1733.34]);
    assertAddsUp(evenShares(5200, 3), 5200);
    assert.deepEqual(evenShares(100, 3), [33.33, 33.33, 33.34]);
    assertAddsUp(evenShares(100, 3), 100);
  });

  it('works in percent too — the mode the form shares this with', () => {
    assert.deepEqual(evenShares(100, 4), [25, 25, 25, 25]);
    assertAddsUp(evenShares(100, 3), 100);
    assertAddsUp(evenShares(100, 7), 100);
  });

  /* ⚠ THE OLD ARITHMETIC LOST A CENT HERE. `Math.floor((5.85 / 3) * 100) / 100` is 1.94, not 1.95,
     because 5.85/3*100 is 194.99999999999997 in binary floating point — so two rows were a cent
     light and the last row silently absorbed both. Whole cents throughout is the fix. */
  it('does not lose a cent to floating point on a value a coach really types', () => {
    assert.deepEqual(evenShares(5.85, 3), [1.95, 1.95, 1.95]);
    assert.deepEqual(evenShares(0.03, 3), [0.01, 0.01, 0.01]);
  });

  it('hands a single period the whole amount, and nothing an empty split', () => {
    assert.deepEqual(evenShares(1234.56, 1), [1234.56]);
    assert.deepEqual(evenShares(1000, 0), []);
  });
});

describe('telling a shape from rounding', () => {
  it('calls a coach\u2019s whole-dollar thirds even — the case that started this', () => {
    assert.equal(isEvenWithinRounding([1733, 1733, 1734]), true);   // $5,200 / 3
    assert.equal(isEvenWithinRounding([33, 33, 34]), true);         // $100 / 3, dollar floor
    assert.equal(isEvenWithinRounding([1733.33, 1733.33, 1733.34]), true);
  });

  /* ⚠⚠ THE RULE THAT PROTECTS A COACH'S REAL NUMBER (/review, 2026-09-04). The first version of
     this test asserted the OPPOSITE — that a previously-botched refit is recognised as even and
     heals itself — and buying that convenience cost a percentage-of-the-row tolerance which
     flattened deliberate splits on any large line. Rounding noise has a fixed size; it is never a
     fraction of the total. The trade is stated in `isEvenWithinRounding`. */
  it('will NOT flatten a deliberate split that happens to be nearly even', () => {
    // $250 apart on a $100,000 line: 0.25%, and unmistakably a decision somebody made.
    assert.equal(isEvenWithinRounding([50125, 49875]), false);
    assert.deepEqual(refitSplit([50125, 49875], 110000), [55137.5, 54862.5]);
    // And at a size a real team budget reaches.
    assert.equal(isEvenWithinRounding([3010, 2995, 2995]), false);
  });

  it('does not pretend an already-botched split is even — Split evenly is the fix for that', () => {
    assert.equal(isEvenWithinRounding([1999.62, 1999.62, 2000.76]), false);
    assert.deepEqual(evenShares(6000, 3), [2000, 2000, 2000]);
  });

  /* Whole-dollar rounding on a long split is legitimately several dollars adrift end to end,
     because the last row carries the entire remainder — 10,000 across 7 is 1428 six times and
     1432 once. A flat "within a dollar" test would have called that a deliberate shape. */
  it('recognises its own output as even, however long the split', () => {
    assert.equal(isEvenWithinRounding([1428, 1428, 1428, 1428, 1428, 1428, 1432]), true);
    assert.deepEqual(refitSplit([1428, 1428, 1428, 1428, 1428, 1428, 1432], 14000), evenShares(14000, 7));
    const long = evenShares(5000, 106);
    assert.equal(isEvenWithinRounding(long), true);
    assert.deepEqual(refitSplit(long, 5750), evenShares(5750, 106));
  });

  /* ⚠ The banner's one-tap fix must never be a SILENT no-op (/review): rows that add to nothing
     have no shape to keep, so they come back as an even split rather than unchanged. */
  it('fills blank rows evenly instead of handing them back untouched', () => {
    assert.deepEqual(refitSplit([0, 0, 0], 6000), [2000, 2000, 2000]);
    assert.deepEqual(refitSplit([0], 5200), [5200]);
  });

  it('leaves a deliberate shape alone', () => {
    assert.equal(isEvenWithinRounding([2000, 3200]), false);        // deposit + balance
    assert.equal(isEvenWithinRounding([1000, 2000, 2200]), false);
    assert.equal(isEvenWithinRounding([10000, 10000, 10090]), false); // 0.9% apart on a big line
  });

  it('treats one row, and only one row, as even by definition', () => {
    assert.equal(isEvenWithinRounding([5200]), true);
    assert.equal(isEvenWithinRounding([]), true);
    assert.equal(isEvenWithinRounding([0, 0]), false);              // nothing to be even about
  });
});

describe('refitting a split onto a new total', () => {
  /* The owner-reported defect, verbatim: a $5,200 line split 1733 / 1733 / 1734, retotalled to
     $6,000. It used to come back 1999.62 / 1999.62 / 2000.76. */
  it('puts an even split back evenly instead of preserving its rounding', () => {
    assert.deepEqual(refitSplit([1733, 1733, 1734], 6000), [2000, 2000, 2000]);
    assert.deepEqual(refitSplit([1733, 1733, 1734], 5200), [1733.33, 1733.33, 1733.34]);
  });

  it('keeps a real shape in proportion', () => {
    // A $2,000 deposit against a $3,200 balance stays 5/13 and 8/13 of whatever the total becomes.
    const refit = refitSplit([2000, 3200], 6000);
    assert.deepEqual(refit, [2307.69, 3692.31]);
    assertAddsUp(refit, 6000);
    assert.deepEqual(refitSplit([1000, 2000, 3200], 12400), [2000, 4000, 6400]);
  });

  it('always adds to the new total to the cent', () => {
    for (const [values, total] of [
      [[1733, 1733, 1734], 6000],
      [[2000, 3200], 5000.55],
      [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], 10000],
      [[100, 250, 33.33, 0.01], 999.99],
    ] as [number[], number][]) {
      assertAddsUp(refitSplit(values, total), total);
    }
  });

  /* ⚠ The leftover cents used to land ENTIRELY on the last row, which on a long split of a small
     total could push that row to zero or below — blocking the save with a different complaint than
     the one the coach came in with. */
  it('never drives a row negative handing out the leftover cents', () => {
    const refit = refitSplit([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1000], 0.24);
    assert.ok(refit.every(v => v >= 0), `a row went negative: ${refit.join(', ')}`);
    assertAddsUp(refit, 0.24);
  });

  it('leaves the rows alone when there is nothing to refit onto', () => {
    assert.deepEqual(refitSplit([1733, 1733, 1734], 0), [1733, 1733, 1734]);
    assert.deepEqual(refitSplit([], 6000), []);
  });
});
