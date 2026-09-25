import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { composeICSFromInstants } from '../../lib/export/ics.ts';
import {
  coachScheduleCalendarEntries,
  coachScheduleSheetRows,
  houseLeagueCalendarEntries,
  type CoachCalendarEvent,
  type HouseLeagueCalendarGame,
} from '../../lib/export/schedule-calendar.ts';
import { readCode } from './_source-code.ts';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * A CALENDAR ENTRY IS THE EVENT'S OWN TIME (the Schedule deep dive, defects D-1 and D-2, owner
 * ruling 2026-09-25: "fix now").
 *
 *   D-1 The coach Schedule's .ics took its DATE from `startsAt.slice(0, 10)` — the universal day —
 *       and its clock from the device, then wrote the pair as a device-local time; the house-league
 *       admin's took the same universal day beside the org's clock. Every event whose universal
 *       date differs from its local one (8 p.m. and later in summer, 7 p.m. in winter) landed a day
 *       late. The spreadsheets' Date column read the same universal day.
 *   D-2 A cancelled event went into the coach's calendar CONFIRMED. (The house-league export always
 *       passed it; its case below guards that the move kept it, not a defect it had.)
 *
 * ⚠ ZONE-FREE BY CONSTRUCTION, AND RUN THAT WAY. Every assertion below is on a UTC instant
 * (`DTSTART:…Z`) or an org-zone string, so it holds whatever `TZ` the runner has. The defect lived
 * in the DEVICE'S zone, so this file is also run under two of them when it changes:
 *   TZ=America/Toronto   node --import ./tests/ts-resolver.mjs --test tests/unit/schedule-calendar-export.test.ts
 *   TZ=America/Vancouver node --import ./tests/ts-resolver.mjs --test tests/unit/schedule-calendar-export.test.ts
 * ══════════════════════════════════════════════════════════════════════════════════════════
 */

/** Mon 21 Sep 2026, 10:45 p.m. in Toronto — the universal date is already the 22nd. */
const EVENING = '2026-09-22T02:45:00.000Z';
const EVENING_END = '2026-09-22T04:45:00.000Z';

function ev(over: Partial<CoachCalendarEvent> = {}): CoachCalendarEvent {
  return {
    id: 'ev-1', name: 'vs Ridgeview', eventType: 'league_game', isScrimmage: false,
    opponent: 'Ridgeview', homeAway: 'home', startsAt: EVENING, endsAt: EVENING_END,
    arrivalTime: null, uniform: null, description: null, location: 'UAT Fields',
    locationAddress: null, fieldNumber: null, status: 'scheduled',
    ...over,
  } as CoachCalendarEvent;
}

async function compose(entries: Parameters<typeof composeICSFromInstants>[0]): Promise<string> {
  const ics = await composeICSFromInstants(entries, 'Test schedule');
  assert.ok(ics, 'the calendar composes');
  return ics.replace(/\r\n/g, '\n');
}

describe('the coach Schedule calendar export (D-1, D-2)', () => {
  it('an evening event keeps its own instant, so it lands on its org-local day', async () => {
    const ics = await compose(coachScheduleCalendarEntries([ev()], 'baseball'));
    // The stored instant, verbatim: a calendar in Toronto reads it as Mon 21 Sep, 10:45 p.m. The
    // defect wrote a LOCAL Tue 22 Sep, 10:45 p.m., which in Toronto is 2026-09-23T02:45Z.
    assert.match(ics, /^DTSTART:20260922T024500Z$/m);
    assert.match(ics, /^DTEND:20260922T044500Z$/m, 'the real end time rides the entry');
    assert.doesNotMatch(ics, /20260923T/, 'never the next day');
  });

  it('a cancelled event goes out CANCELLED; a scheduled one CONFIRMED', async () => {
    const ics = await compose(coachScheduleCalendarEntries([
      ev({ id: 'a', status: 'cancelled' }),
      ev({ id: 'b' }),
    ], 'baseball'));
    const blocks = ics.split('BEGIN:VEVENT').slice(1);
    const byUid = (uid: string) => blocks.find(b => b.includes(`UID:${uid}@`)) ?? '';
    assert.match(byUid('a'), /STATUS:CANCELLED/);
    assert.match(byUid('b'), /STATUS:CONFIRMED/);
  });

  it('no end time falls back to the two hours it always wrote', async () => {
    const ics = await compose(coachScheduleCalendarEntries([ev({ endsAt: null })], 'baseball'));
    assert.match(ics, /^DURATION:PT2H$/m);
  });

  it('an event with no start is left out rather than written at a guessed time', () => {
    assert.equal(coachScheduleCalendarEntries([ev({ startsAt: null as unknown as string })], 'baseball').length, 0);
  });

  it('keeps the game-day detail: arrival and uniform lead the description, the diamond joins the place', () => {
    const [entry] = coachScheduleCalendarEntries([ev({
      arrivalTime: '18:30', uniform: 'Home whites', description: 'Bring water',
      fieldNumber: '3', locationAddress: '1 Park Rd',
    })], 'baseball');
    assert.equal(entry.description, 'Arrive by 6:30 p.m.\nUniform: Home whites\n\nBring water');
    assert.match(entry.location ?? '', /^UAT Fields · .*3, 1 Park Rd$/);
  });

  it('the title is the list\'s own — the opponent is added only when the name does not carry it', () => {
    const [named, custom, away] = coachScheduleCalendarEntries([
      ev({ id: '1' }),
      ev({ id: '2', name: 'Semi-final', opponent: 'Lions' }),
      ev({ id: '3', name: '@ Fairhaven', opponent: 'Fairhaven', homeAway: 'away' }),
    ], 'baseball');
    assert.equal(named.title, 'vs Ridgeview', 'never "vs Ridgeview vs Ridgeview"');
    assert.equal(custom.title, 'Semi-final · vs Lions');
    assert.equal(away.title, '@ Fairhaven', 'never "@ Fairhaven vs Fairhaven"');
  });
});

describe('the coach Schedule spreadsheet rows (D-1)', () => {
  it('the Date column is the org-local day and the Time column the org-local clock', () => {
    const [row] = coachScheduleSheetRows([ev()]);
    assert.equal(row.date, '2026-09-21');
    assert.equal(row.time, '10:45 p.m.');
  });
});

describe('the house-league admin calendar export (D-1 widened, D-2)', () => {
  const game = (over: Partial<HouseLeagueCalendarGame> = {}): HouseLeagueCalendarGame => ({
    id: 'g-1', homeTeamId: 'h', awayTeamId: 'a',
    // Thu 9 Jul 2026, 8:30 p.m. in Toronto — the universal date is the 10th.
    scheduledAt: '2026-07-10T00:30:00.000Z', endsAt: null,
    location: 'Riverside Park', status: 'scheduled',
    ...over,
  });
  const names: Record<string, string> = { h: 'Lions', a: 'Tigers' };

  it('writes the instant, so the evening game lands on its own day', async () => {
    const ics = await compose(houseLeagueCalendarEntries([game()], id => names[id]));
    assert.match(ics, /^DTSTART:20260710T003000Z$/m);
    assert.match(ics, /^SUMMARY:Lions vs Tigers$/m);
  });

  it('a cancelled game goes out CANCELLED', async () => {
    const ics = await compose(houseLeagueCalendarEntries([game({ status: 'cancelled' })], id => names[id]));
    assert.match(ics, /STATUS:CANCELLED/);
  });

  it('a real end time is written when the game has one', async () => {
    const ics = await compose(houseLeagueCalendarEntries([game({ endsAt: '2026-07-10T02:00:00.000Z' })], id => names[id]));
    assert.match(ics, /^DTEND:20260710T020000Z$/m);
  });
});

describe('neither schedule export slices an instant for its day again', () => {
  const COACH = 'app/[orgSlug]/coaches/teams/[teamId]/schedule/page.tsx';
  const HL = 'app/[orgSlug]/admin/house-league/seasons/[seasonId]/schedule/page.tsx';
  // A STORED event's or game's instant (`e.` / `g.`) — the edit forms' own `form.startsAt` is a
  // local `datetime-local` string, where slicing the date IS the local day.
  const UNIVERSAL_DAY = /\b[eg]\.(startsAt|scheduledAt)!?\.slice\(0,\s*10\)/;
  for (const file of [COACH, HL]) {
    it(file, () => {
      const code = readCode(file);
      assert.ok(!UNIVERSAL_DAY.test(code), `${file} reads a universal date off an instant`);
      assert.ok(!/toTimeString\(\)/.test(code), `${file} reads a device clock`);
      assert.ok(!/\bdownloadICS\b/.test(code), `${file} uses the local-date download — an instant goes through downloadICSFromInstants`);
      assert.ok(/downloadICSFromInstants\(/.test(code), `${file} exports through downloadICSFromInstants`);
    });
  }
});
