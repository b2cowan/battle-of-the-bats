import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  derivedPeriodLabel, resolvedPeriodLabel, blankPeriod, nextPeriodDate,
  fillSeasonPeriods, inferSplitMode, readDate, monthDate, quarterDate, quarterOf,
  splitYears, type PeriodDraft, type PeriodSplitMode,
} from '../../lib/coach-budget-period-modes.ts';

function p(date: string, label = '', amount = ''): PeriodDraft {
  return { date, label, amount };
}

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

  it('offers the season year and the one after it', () => {
    assert.deepEqual(splitYears(2027), [2027, 2028]);
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
  it('anchors month and quarter splits on the season year, and dates on nothing', () => {
    assert.equal(blankPeriod('months', 2027).date, '2027-01-01');
    assert.equal(blankPeriod('quarters', 2027).date, '2027-01-01');
    assert.equal(blankPeriod('dates', 2027).date, '');
    assert.equal(blankPeriod('names', 2027).date, '');
    assert.equal(blankPeriod('months', 2027).amount, '');
    assert.equal(blankPeriod('months', 2027).label, '');
  });
});

describe('add period advances on its own', () => {
  it('walks the months so twelve taps build a year', () => {
    let rows: PeriodDraft[] = [blankPeriod('months', 2027)];
    const seen = [rows[0].date];
    for (let i = 0; i < 11; i++) {
      rows = [...rows, p(nextPeriodDate('months', rows, 2027))];
      seen.push(rows[rows.length - 1].date);
    }
    assert.equal(seen.length, 12);
    assert.equal(seen[0], '2027-01-01');
    assert.equal(seen[11], '2027-12-01');
    assert.equal(new Set(seen).size, 12, 'every month is distinct');
  });

  it('walks quarters three months at a time', () => {
    const rows = [p('2027-01-01')];
    assert.equal(nextPeriodDate('quarters', rows, 2027), '2027-04-01');
    assert.equal(nextPeriodDate('quarters', [p('2027-10-01')], 2027), '2028-01-01');
  });

  it('rolls December into the following January', () => {
    assert.equal(nextPeriodDate('months', [p('2027-12-01')], 2027), '2028-01-01');
  });

  it('stops advancing rather than leaving the picker range', () => {
    assert.equal(nextPeriodDate('months', [p('2028-12-01')], 2027), '2028-12-01');
    assert.equal(nextPeriodDate('quarters', [p('2028-10-01')], 2027), '2028-10-01');
  });

  it('starts at January when there is nothing to advance from', () => {
    assert.equal(nextPeriodDate('months', [], 2027), '2027-01-01');
    assert.equal(nextPeriodDate('months', [p('')], 2027), '2027-01-01');
  });

  it('has nothing to say in date and name modes', () => {
    assert.equal(nextPeriodDate('dates', [p('2027-03-14')], 2027), '');
    assert.equal(nextPeriodDate('names', [], 2027), '');
  });
});

describe('fill the season', () => {
  it('adds every month the line does not already cover, in calendar order', () => {
    const filled = fillSeasonPeriods('months', [p('2027-06-01', '', '500')], 2027);
    assert.equal(filled.length, 12);
    assert.deepEqual(filled.map(r => r.date.slice(5, 7)),
      ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
    // The row that was already there keeps its amount.
    assert.equal(filled.find(r => r.date === '2027-06-01')!.amount, '500');
  });

  it('adds four quarters', () => {
    const filled = fillSeasonPeriods('quarters', [], 2027);
    assert.deepEqual(filled.map(r => r.date), ['2027-01-01', '2027-04-01', '2027-07-01', '2027-10-01']);
  });

  it('is a no-op once the season is covered', () => {
    const full = fillSeasonPeriods('months', [], 2027);
    assert.equal(fillSeasonPeriods('months', full, 2027), full, 'same array back — nothing added');
  });

  it('ignores rows in another year when deciding what is missing', () => {
    const filled = fillSeasonPeriods('quarters', [p('2028-01-01')], 2027);
    assert.equal(filled.length, 5);
  });

  it('leaves undated rows at the end', () => {
    const filled = fillSeasonPeriods('months', [p('', 'Deposit', '100')], 2027);
    assert.equal(filled.length, 13);
    assert.equal(filled[12].label, 'Deposit');
  });

  it('does nothing in date and name modes', () => {
    const rows = [p('2027-03-14')];
    assert.equal(fillSeasonPeriods('dates', rows, 2027), rows);
    assert.equal(fillSeasonPeriods('names', rows, 2027), rows);
  });
});

describe('reopening a saved line', () => {
  it('reads twelve 1st-of-months as a month split', () => {
    const rows = fillSeasonPeriods('months', [], 2027)
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
    const twelve = fillSeasonPeriods('months', [], 2027);
    assert.equal(twelve.length, 12);

    const afterSwitch = [blankPeriod('quarters', 2027)];
    assert.equal(afterSwitch.length, 1);
    assert.equal(afterSwitch[0].date, '2027-01-01');
    assert.equal(afterSwitch[0].amount, '');

    const backToMonths = [blankPeriod('months', 2027)];
    assert.equal(backToMonths.length, 1);
    const januaries = backToMonths.filter(r => r.date.slice(5, 7) === '01');
    assert.equal(januaries.length, 1);
  });
});
