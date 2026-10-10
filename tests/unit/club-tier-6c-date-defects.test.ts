import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, describe, it } from 'node:test';
import { addCalendarMonths, formatEventDateRange, formatShortWeekdayDate, mondayOfDay } from '../../lib/timezone.ts';
import { chosenDayAfterStep, stepScheduleCursor } from '../../lib/coach-schedule-view.ts';
import {
  addHoursToWallInput, basicEventWhen, basicScheduleSortKey, instantToWallInput, nextHourWallInput, wallInputToInstant,
} from '../../lib/basic-coach-schedule-view.ts';

/**
 * CLUB TIER STAGE 6c · PART A — the three date defects (Ask 17, "fix now", before Oct 29), pinned under three device
 * clocks: one far east of UTC (Auckland, where a device-midnight read falls a day short), one west of the club's
 * (Vancouver, where a bare date read as UTC falls a day early) and the club's own (Toronto). Every helper below is
 * supposed to be blind to the device's zone; running each case under all three is what proves it.
 *
 *   C6-01 the coach's date arrows step the calendar, never a clock (Oct 31 › used to open December).
 *   C6-02 the Overview's live tournament card and its next-date lines read stored dates as calendar dates.
 *   C6-03 the free portal's schedule reads and writes the club's clock, never the device's.
 */
const ZONES = ['Pacific/Auckland', 'America/Vancouver', 'America/Toronto'];

for (const tz of ZONES) {
  describe(`under a device clock in ${tz}`, () => {
    before(() => { process.env.TZ = tz; });

    describe('C6-01 — a month step keeps the day, clamped, and never skips a month', () => {
      it('Oct 31 › is November (it used to open December)', () => {
        assert.equal(stepScheduleCursor('month', '2026-10-31', 1), '2026-11-30');
      });
      it('Jan 31 › is February, in a common year and a leap year', () => {
        assert.equal(stepScheduleCursor('month', '2027-01-31', 1), '2027-02-28');
        assert.equal(stepScheduleCursor('month', '2028-01-31', 1), '2028-02-29');
      });
      it('Mar 31 ‹ is February (it used to be a dead press)', () => {
        assert.equal(stepScheduleCursor('month', '2027-03-31', -1), '2027-02-28');
      });
      it('a day the next month has stays put: Oct 10 › is Nov 10', () => {
        assert.equal(stepScheduleCursor('month', '2026-10-10', 1), '2026-11-10');
      });
      it('across a year, forward and back: twelve presses each way pass every month once', () => {
        let c = '2026-10-31';
        const months: string[] = [];
        for (let i = 0; i < 12; i++) { c = stepScheduleCursor('month', c, 1); months.push(c.slice(0, 7)); }
        assert.deepEqual(months, [
          '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04',
          '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10',
        ]);
        const back: string[] = [];
        for (let i = 0; i < 12; i++) { c = stepScheduleCursor('month', c, -1); back.push(c.slice(0, 7)); }
        assert.deepEqual(back, [
          '2027-09', '2027-08', '2027-07', '2027-06', '2027-05', '2027-04',
          '2027-03', '2027-02', '2027-01', '2026-12', '2026-11', '2026-10',
        ]);
      });
      it('the clamp is the one helper: Dec 31 › is Jan 31 of the next year', () => {
        assert.equal(addCalendarMonths('2026-12-31', 1), '2027-01-31');
        assert.equal(addCalendarMonths('2027-01-15', -1), '2026-12-15');
      });
    });

    describe('C6-01 — a week step lands on the next Monday, five presses in a row', () => {
      it('from Sat Oct 10, five › presses read the five following weeks, each from its Monday', () => {
        let c = '2026-10-10';
        const mondays: string[] = [];
        for (let i = 0; i < 5; i++) { c = stepScheduleCursor('week', c, 1); mondays.push(mondayOfDay(c)); }
        assert.deepEqual(mondays, ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
      });
      it('back across the end of daylight saving (Nov 1) is still exactly a week', () => {
        assert.equal(stepScheduleCursor('week', '2026-11-04', -1), '2026-10-28');
      });
    });

    describe('C6-01 — the phone Month’s chosen day stays on the grid', () => {
      it('a week step inside the month keeps the chosen day', () => {
        assert.equal(chosenDayAfterStep('week', '2026-10-17', '2026-10-13', '2026-10-10'), '2026-10-13');
      });
      it('a week step into another month takes today when today is there, else the cursor’s day', () => {
        assert.equal(chosenDayAfterStep('week', '2026-11-03', '2026-10-27', '2026-11-01'), '2026-11-01');
        assert.equal(chosenDayAfterStep('week', '2026-11-03', '2026-10-27', '2026-10-10'), '2026-11-03');
      });
      it('a month step takes today in today’s month, else the month’s first day (as built)', () => {
        assert.equal(chosenDayAfterStep('month', '2026-10-10', '2026-09-01', '2026-10-10'), '2026-10-10');
        assert.equal(chosenDayAfterStep('month', '2026-11-30', '2026-10-10', '2026-10-10'), '2026-11-01');
      });
    });

    describe('C6-02 — the Overview reads a tournament’s stored dates as calendar dates', () => {
      it('the live card says “Oct 10–12, 2026” for Oct 10–12 (it said “Oct 9 - Oct 11”)', () => {
        assert.equal(formatEventDateRange('2026-10-10', '2026-10-12', true), 'Oct 10–12, 2026');
      });
      it('a one-day event reads its own day', () => {
        assert.equal(formatEventDateRange('2026-10-10', '2026-10-10', true), 'Oct 10, 2026');
      });
      it('the Tournaments tile and the quiet-week card name the stored day', () => {
        assert.equal(formatShortWeekdayDate('2026-10-10'), 'Sat, Oct 10');
      });
    });

    describe('C6-03 — the free portal reads and writes the club’s clock', () => {
      // 8:00 p.m. Eastern (EDT) on Sat Oct 10 = Oct 11, 00:00 UTC — already Sunday afternoon in Auckland.
      const EIGHT_PM = '2026-10-11T00:00:00.000Z';
      it('an event at 8:00 p.m. reads 8:00 p.m. on its own day, whatever the device', () => {
        assert.equal(basicEventWhen(EIGHT_PM, null), 'Sat, Oct 10 · 8:00 p.m.');
      });
      it('a range on one day says the period once', () => {
        assert.equal(basicEventWhen('2026-10-10T22:00:00.000Z', EIGHT_PM), 'Sat, Oct 10 · 6:00–8:00 p.m.');
      });
      it('a range into the next day names both days', () => {
        assert.equal(
          basicEventWhen('2026-10-11T02:00:00.000Z', '2026-10-11T05:00:00.000Z'),
          'Sat, Oct 10 · 10:00 p.m. – Sun, Oct 11 · 1:00 a.m.',
        );
      });
      it('the form shows the club’s wall clock and saves it back to the same instant', () => {
        assert.equal(instantToWallInput(EIGHT_PM), '2026-10-10T20:00');
        assert.equal(wallInputToInstant('2026-10-10T20:00'), EIGHT_PM);
        assert.equal(wallInputToInstant(''), null);
      });
      it('a new event starts on the club’s next hour, and the end follows two hours on, across midnight', () => {
        assert.equal(nextHourWallInput(new Date('2026-10-10T23:22:00Z')), '2026-10-10T20:00');
        assert.equal(addHoursToWallInput('2026-10-10T23:00', 2), '2026-10-11T01:00');
      });
      it('the list sorts on the instant; an unscheduled game sorts last', () => {
        assert.ok(basicScheduleSortKey('2026-10-10T22:00:00.000Z') < basicScheduleSortKey(EIGHT_PM));
        assert.equal(basicScheduleSortKey(null), Number.POSITIVE_INFINITY);
        // A naive wall clock is the CLUB's, not the device's.
        assert.equal(basicScheduleSortKey('2026-10-10T20:00'), Date.parse(EIGHT_PM));
      });
    });
  });
}

describe('the three sites no longer read a clock (source guards)', () => {
  const read = (p: string) => readFileSync(p, 'utf8');

  it('the coach’s arrows step through the shared helper, named for a screen reader', () => {
    const page = read('app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx');
    const nav = page.slice(page.indexOf('function navigate('), page.indexOf('const curMonth'));
    assert.match(nav, /stepScheduleCursor\(/);
    assert.doesNotMatch(nav, /setMonth|setDate|toISOString|new Date\(/);
    const views = read('components/coaches/ScheduleCalendarViews.tsx');
    assert.match(views, /'Previous month' : 'Previous week'/, 'the shared date row names its arrows');
    assert.match(views, /'Next month' : 'Next week'/);
  });

  it('the live tournament card and the Overview read no device midnight', () => {
    const card = read('components/coaches/CoachLiveEventCard.tsx');
    assert.doesNotMatch(card, /new Date\(/);
    assert.match(card, /formatEventDateRange\(/);
    const overview = read('app/[orgSlug]/coaches/teams/[teamId]/page.tsx');
    assert.doesNotMatch(overview, /nextDate\}T00:00:00/);
  });

  it('the free portal’s editor formats nothing on the device’s clock', () => {
    const editor = read('components/coaches/ScheduleEditor.tsx');
    assert.doesNotMatch(editor, /toLocale(Date|Time)?String|getHours|getFullYear|new Date\(form\./);
  });
});
