import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays, addMonths, dateParts, formatFieldDate, inRange, isoDate, longDateLabel, monthGrid, normaliseTime,
  parseTypedDate, parseTypedTime, stepMinutesFrom, timeSteps, weekdayIndex,
} from '../../lib/date-field.ts';

/**
 * The shared date and time fields' arithmetic (plan docs/projects/active/THEMED_DATE_PICKER_PLAN.md). The point of
 * these is the WRONG-DAY bug class: every answer below must be the same in any time zone, so nothing here may go
 * through a local-time Date. The runner's own zone is whatever the machine's is; the checks hold in all of them.
 */
describe('date field — calendar strings', () => {
  it('reads and rebuilds a date without moving it', () => {
    assert.deepEqual(dateParts('2026-10-31'), { y: 2026, m: 9, d: 31 });
    assert.equal(isoDate(2026, 9, 31), '2026-10-31');
    assert.equal(dateParts('2026-02-30'), null);
    assert.equal(dateParts('2026-13-01'), null);
    assert.equal(dateParts(''), null);
  });

  it('keeps a four-digit year under 100 (the Date.UTC trap)', () => {
    assert.equal(isoDate(2, 0, 1), '0002-01-01');
    assert.equal(addDays('0002-01-01', 1), '0002-01-02');
  });

  it('steps days across month and year ends', () => {
    assert.equal(addDays('2026-10-31', 1), '2026-11-01');
    assert.equal(addDays('2026-01-01', -1), '2025-12-31');
    assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  });

  it('steps months and clamps a day the next month lacks', () => {
    assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
    assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
    assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
    assert.equal(addMonths('2026-10-25', -12), '2025-10-25');
  });

  it('draws a Monday-first grid of six weeks', () => {
    assert.equal(weekdayIndex('2026-10-26'), 0); // a Monday
    assert.equal(weekdayIndex('2026-10-25'), 6); // a Sunday
    const g = monthGrid(2026, 9);
    assert.equal(g.length, 42);
    assert.equal(g[0], '2026-09-28'); // Oct 1 2026 is a Thursday: the grid opens on the Monday before
    assert.equal(weekdayIndex(g[0]), 0);
    assert.ok(g.includes('2026-10-31'));
  });

  it('writes the house date', () => {
    assert.equal(formatFieldDate('2026-10-25'), 'Oct 25, 2026');
    assert.equal(formatFieldDate(''), '');
    assert.equal(longDateLabel('2026-10-25'), 'Sunday, October 25, 2026');
  });

  it('bounds a date by min and max as strings', () => {
    assert.ok(inRange('2026-10-25', '2026-10-01', '2026-10-31'));
    assert.ok(!inRange('2026-09-30', '2026-10-01'));
    assert.ok(!inRange('2026-11-01', undefined, '2026-10-31'));
  });
});

describe('date field — what a person types', () => {
  it('reads ISO and the house spelling', () => {
    assert.equal(parseTypedDate('2026-10-25', 2000), '2026-10-25');
    assert.equal(parseTypedDate('2026/10/5', 2000), '2026-10-05');
    assert.equal(parseTypedDate('Oct 25, 2026', 2000), '2026-10-25');
    assert.equal(parseTypedDate('october 25 2026', 2000), '2026-10-25');
    assert.equal(parseTypedDate('25 Oct 2026', 2000), '2026-10-25');
    assert.equal(parseTypedDate('Sept 3rd', 2027), '2027-09-03');
  });

  it('takes the hinted year when none is typed', () => {
    assert.equal(parseTypedDate('Oct 25', 2026), '2026-10-25');
  });

  it('refuses a numeric date it would have to guess', () => {
    assert.equal(parseTypedDate('5/6/2026', 2026), null);
    assert.equal(parseTypedDate('25/10/2026', 2026), '2026-10-25');
    assert.equal(parseTypedDate('10/25/2026', 2026), '2026-10-25');
  });

  it('refuses nonsense and impossible days', () => {
    assert.equal(parseTypedDate('Feb 30 2026', 2026), null);
    assert.equal(parseTypedDate('soon', 2026), null);
    assert.equal(parseTypedDate('Ju 4', 2026), null); // two letters names no month
    assert.equal(parseTypedDate('', 2026), null);
  });
});

describe('time field', () => {
  it('normalises a stored time', () => {
    assert.equal(normaliseTime('08:00'), '08:00');
    assert.equal(normaliseTime('20:30:00'), '20:30');
    assert.equal(normaliseTime('25:00'), null);
    assert.equal(normaliseTime(''), null);
  });

  it('reads what a person types', () => {
    assert.equal(parseTypedTime('8:30 p.m.'), '20:30');
    assert.equal(parseTypedTime('8:30pm'), '20:30');
    assert.equal(parseTypedTime('8pm'), '20:00');
    assert.equal(parseTypedTime('12 a.m.'), '00:00');
    assert.equal(parseTypedTime('12:15 pm'), '12:15');
    assert.equal(parseTypedTime('830'), '08:30');
    assert.equal(parseTypedTime('20:30'), '20:30');
    assert.equal(parseTypedTime('8'), '08:00');
    assert.equal(parseTypedTime('noon'), '12:00');
    assert.equal(parseTypedTime('13 pm'), null);
    assert.equal(parseTypedTime('8:75'), null);
    assert.equal(parseTypedTime('later'), null);
  });

  it('lists the day in steps, inside its bounds', () => {
    assert.equal(timeSteps(15).length, 96);
    assert.deepEqual(timeSteps(30, '08:00', '09:00'), ['08:00', '08:30', '09:00']);
    assert.equal(stepMinutesFrom(900), 15);
    assert.equal(stepMinutesFrom(300), 5);
    assert.equal(stepMinutesFrom(undefined), 15);
    assert.equal(stepMinutesFrom(1), 15);
  });
});
