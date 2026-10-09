/**
 * ONE CLOCK FOR EVERY WEEK AND MONTH GROUPING (Club Tier Stage 6b, Ask 8 — S6-12). Three schedules filed a booking
 * under a week by the DEVICE's clock (the coach's schedule, house league's admin schedule) or the SERVER's (the public
 * league schedule, a server page: UTC on the host), so a Sunday game after 8 p.m. Eastern filed into the next week.
 * Each now reads the org-zone day first (`lib/timezone.ts`). The device is set to a far zone below so a regression
 * to the device clock fails here, not on a family's phone.
 */
process.env.TZ = 'Pacific/Auckland';

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { mondayOfDay, orgMonthKey, orgWeekKey } from '../../lib/timezone.ts';
import { monthKey } from '../../lib/coach-schedule-view.ts';

// Sunday Nov 1, 2026, 9:30 p.m. Eastern (EST — daylight saving ended at 2 a.m. that morning) = Nov 2, 02:30 UTC.
const SUNDAY_930_EST = '2026-11-02T02:30:00Z';
// Sunday Oct 18, 2026, 9:30 p.m. Eastern (EDT) = Oct 19, 01:30 UTC.
const SUNDAY_930_EDT = '2026-10-19T01:30:00Z';

describe('the org-zone week and month keys', () => {
  it('files a Sunday 9:30 p.m. game in its own week (Monday Oct 26), never the next', () => {
    assert.equal(orgWeekKey(SUNDAY_930_EST), '2026-10-26');
    assert.equal(orgWeekKey(SUNDAY_930_EDT), '2026-10-12');
  });

  it('files a game on Monday at 12:30 a.m. Eastern in the new week', () => {
    assert.equal(orgWeekKey('2026-11-02T05:30:00Z'), '2026-11-02');
  });

  it('names the month by the org-zone day (Oct 31, 11:30 p.m. Eastern is October)', () => {
    assert.equal(orgMonthKey('2026-11-01T03:30:00Z'), '2026-10');
  });

  it('Monday of a calendar date is pure arithmetic: Sunday belongs to the week before it', () => {
    assert.equal(mondayOfDay('2026-11-08'), '2026-11-02');
    assert.equal(mondayOfDay('2026-11-02'), '2026-11-02');
    assert.equal(mondayOfDay('2026-01-01'), '2025-12-29');
  });

  it('an empty instant has no week', () => {
    assert.equal(orgWeekKey(null), '');
    assert.equal(orgMonthKey(undefined), '');
  });
});

describe("the coach schedule's keys", () => {
  it('an event instant files its month by its org day', () => {
    assert.equal(monthKey('2026-11-01T03:30:00Z'), '2026-10');
  });

  it("the page's cursor — a calendar date — takes its Monday directly, never through a clock", () => {
    const src = readFileSync(new URL('../../app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx', import.meta.url), 'utf8');
    assert.match(src, /const curWeek\s+= mondayOfDay\(cursorDate\)/);
    assert.doesNotMatch(src, /weekKey\(cursorDate/);
  });
});

describe('every week grouping reads the org-zone key (no device or server clock left)', () => {
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  const files = [
    'app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx',
    'app/[orgSlug]/league/[seasonSlug]/schedule/page.tsx',
  ];
  for (const f of files) {
    it(`${f} groups by orgWeekKey`, () => {
      const src = read(f);
      assert.match(src, /orgWeekKey\(/, 'its week key reads the org zone');
      assert.doesNotMatch(src, /function weekKey[\s\S]{0,200}getDay\(\)/, 'no device- or server-clock week key');
    });
  }

  it("the coach schedule's week view keys its days from calendar parts, as Month does", () => {
    const src = read('components/coaches/ScheduleCalendarViews.tsx');
    const week = src.slice(src.indexOf('export function ScheduleWeekView'), src.indexOf('export function ScheduleMonthView'));
    assert.doesNotMatch(week, /toISOString\(\)\.slice\(0, 10\)/, 'a locally-built midnight read in UTC names the wrong day');
  });
});
