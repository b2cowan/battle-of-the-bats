// Chunk C — schedule intelligence. Covers the four pure modules the chunk turns on:
// the recurrence generator/reconciler, the import parser + reviewer, arm care, and the
// wall-clock↔UTC conversion that every schedule write now goes through.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateWeeklyOccurrences, reviewRecurrenceOccurrences, dayOfWeekFor,
  MAX_RECURRENCE_OCCURRENCES,
} from '../../lib/coach-recurrence.ts';
import {
  parseScheduleDateCell, parseScheduleTimeCell, reviewScheduleRows,
  committableScheduleRows, buildScheduleTemplate, rowsFromSchedulePaste,
  type DraftScheduleRow, type ExistingScheduleEvent,
} from '../../lib/coach-schedule-import.ts';
import { parseEventTypeCell, parseHomeAwayCell } from '../../lib/coach-schedule-vocab.ts';
import { resolveArmCare, armCareCopy } from '../../lib/coach-arm-care.ts';
import { wallClockStringToUtc, zonedWallClockToUtc, utcToZonedInputs, orgDayKey } from '../../lib/timezone.ts';

// ── C0 · time truth ──────────────────────────────────────────────────────────

describe('wall-clock ⇄ UTC (C0)', () => {
  it('resolves a naive wall clock in the org zone, not as UTC', () => {
    // 6:00 PM Toronto in July (EDT, −4) is 22:00Z. Storing "18:00" raw was the whole defect:
    // it read back to the coach as 2:00 PM.
    assert.equal(wallClockStringToUtc('2026-07-08T18:00'), '2026-07-08T22:00:00.000Z');
  });

  it('passes an already-zoned value through untouched — no double conversion', () => {
    const zoned = '2026-07-08T22:00:00+00:00';
    assert.equal(wallClockStringToUtc(zoned), zoned);
    assert.equal(wallClockStringToUtc('2026-07-08T22:00:00.000Z'), '2026-07-08T22:00:00.000Z');
  });

  it('is DST-correct on both sides of the boundary', () => {
    // March: EST(−5) before the switch, EDT(−4) after.
    assert.equal(wallClockStringToUtc('2026-03-01T18:00'), '2026-03-01T23:00:00.000Z');
    assert.equal(wallClockStringToUtc('2026-07-01T18:00'), '2026-07-01T22:00:00.000Z');
    assert.equal(wallClockStringToUtc('2026-12-01T18:00'), '2026-12-01T23:00:00.000Z');
  });

  it('ROUND TRIPS — the exact failure a coach saw: open, save untouched, time unchanged', () => {
    const typed = '2026-09-08T18:00';
    for (let i = 0; i < 3; i++) {
      const stored = wallClockStringToUtc(typed)!;
      const { date, time } = utcToZonedInputs(stored);
      assert.equal(`${date}T${time}`, typed, 'a re-save must not shift the event');
    }
  });

  it('reads the calendar day in the org zone, not the UTC day', () => {
    // 9:00 PM Toronto is 01:00Z the NEXT date. The day a coach means is the local one.
    const stored = zonedWallClockToUtc('2026-07-08', '21:00')!;
    assert.equal(stored.slice(0, 10), '2026-07-09', 'sanity: the raw UTC slice IS the next day');
    assert.equal(orgDayKey(stored), '2026-07-08');
  });

  it('returns null for nothing and never invents a time', () => {
    assert.equal(wallClockStringToUtc(null), null);
    assert.equal(wallClockStringToUtc(''), null);
  });

  it('still recognises a naive value carrying seconds or fractional seconds', () => {
    // A value that has been through a Date-shaped round trip must not fall through the
    // already-zoned passthrough and get resolved as UTC.
    assert.equal(wallClockStringToUtc('2026-07-08T18:00:00'), '2026-07-08T22:00:00.000Z');
    assert.equal(wallClockStringToUtc('2026-07-08T18:00:00.000'), '2026-07-08T22:00:00.000Z');
  });
});

// ── C1 · recurrence ──────────────────────────────────────────────────────────

describe('weekly recurrence (P1 #6)', () => {
  const rule = { dayOfWeek: 2, startDate: '2026-09-08', endDate: '2026-11-24' }; // Tuesdays

  it('generates every matching date, inclusive of both ends', () => {
    const dates = generateWeeklyOccurrences(rule);
    assert.equal(dates.length, 12);
    assert.equal(dates[0], '2026-09-08');
    assert.equal(dates.at(-1), '2026-11-24');
    for (const d of dates) assert.equal(dayOfWeekFor(d), 2);
  });

  it('steps to the first matching day when the start date is not that weekday', () => {
    const dates = generateWeeklyOccurrences({ dayOfWeek: 6, startDate: '2026-09-08', endDate: '2026-09-30' });
    assert.equal(dates[0], '2026-09-12'); // the first Saturday on/after the 8th
  });

  it('crosses a DST boundary without dropping or duplicating a week', () => {
    // Nov 1 2026 is the fall-back Sunday; a Tuesday series must be unaffected.
    const dates = generateWeeklyOccurrences({ dayOfWeek: 2, startDate: '2026-10-20', endDate: '2026-11-17' });
    assert.deepEqual(dates, ['2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17']);
  });

  it('returns nothing for a malformed or inverted rule rather than guessing', () => {
    assert.deepEqual(generateWeeklyOccurrences({ dayOfWeek: 2, startDate: 'nope', endDate: '2026-11-24' }), []);
    assert.deepEqual(generateWeeklyOccurrences({ dayOfWeek: 9, startDate: '2026-09-08', endDate: '2026-11-24' }), []);
    assert.deepEqual(generateWeeklyOccurrences({ dayOfWeek: 2, startDate: '2026-11-24', endDate: '2026-09-08' }), []);
  });

  it('caps a runaway range instead of generating forever', () => {
    const dates = generateWeeklyOccurrences({ dayOfWeek: 2, startDate: '2026-01-06', endDate: '2036-01-06' });
    assert.equal(dates.length, MAX_RECURRENCE_OCCURRENCES);
  });

  it('THE FIX: each occurrence carries its OWN opponent', () => {
    const submitted = generateWeeklyOccurrences(rule).map((date, i) => ({ date, opponent: `Team ${i}` }));
    const reviewed = reviewRecurrenceOccurrences(rule, submitted);
    assert.equal(reviewed.accepted.length, 12);
    assert.equal(reviewed.accepted[0].opponent, 'Team 0');
    assert.equal(reviewed.accepted[11].opponent, 'Team 11');
    assert.equal(new Set(reviewed.accepted.map(o => o.opponent)).size, 12);
  });

  it('treats a generated-but-unsubmitted date as a deliberate removal (the bye week)', () => {
    const all = generateWeeklyOccurrences(rule);
    const submitted = all.filter(d => d !== '2026-09-29').map(date => ({ date }));
    const reviewed = reviewRecurrenceOccurrences(rule, submitted);
    assert.equal(reviewed.accepted.length, 11);
    assert.deepEqual(reviewed.removed, ['2026-09-29']);
    assert.deepEqual(reviewed.unknown, []);
  });

  it('REFUSES a date the rule cannot produce — never silently drops it', () => {
    const reviewed = reviewRecurrenceOccurrences(rule, [
      { date: '2026-09-08' },
      { date: '2026-09-09' }, // a Wednesday — not in this series
    ]);
    assert.deepEqual(reviewed.unknown, ['2026-09-09']);
  });

  it('refuses a duplicated date rather than writing the same day twice', () => {
    const reviewed = reviewRecurrenceOccurrences(rule, [{ date: '2026-09-08' }, { date: '2026-09-08' }]);
    assert.equal(reviewed.accepted.length, 1);
    assert.deepEqual(reviewed.unknown, ['2026-09-08']);
  });

  it('normalises a blank opponent to null rather than an empty string', () => {
    const reviewed = reviewRecurrenceOccurrences(rule, [{ date: '2026-09-08', opponent: '   ' }]);
    assert.equal(reviewed.accepted[0].opponent, null);
  });
});

// ── C2 · import parsing ──────────────────────────────────────────────────────

describe('schedule import — the parser never guesses (P1 #7)', () => {
  it('REFUSES an ambiguous slash date', () => {
    // April 3rd or March 4th? A schedule quietly a month wrong is worse than one that asked.
    assert.equal(parseScheduleDateCell('03/04/2026'), null);
    assert.equal(parseScheduleDateCell('3/4/26'), null);
  });

  it('accepts every form that is genuinely unambiguous', () => {
    assert.equal(parseScheduleDateCell('2026-04-03'), '2026-04-03');
    assert.equal(parseScheduleDateCell('2026/4/3'), '2026-04-03');
    assert.equal(parseScheduleDateCell('Sep 8, 2026'), '2026-09-08');
    assert.equal(parseScheduleDateCell('8 September 2026'), '2026-09-08');
    assert.equal(parseScheduleDateCell('2026-04-03T00:00:00Z'), '2026-04-03');
  });

  it('distinguishes empty from unreadable', () => {
    assert.equal(parseScheduleDateCell(''), '');
    assert.equal(parseScheduleDateCell('   '), '');
    assert.equal(parseScheduleDateCell('next tuesday'), null);
  });

  it('reads the times spreadsheets and coaches actually produce', () => {
    assert.equal(parseScheduleTimeCell('6:00 PM'), '18:00');
    assert.equal(parseScheduleTimeCell('6pm'), '18:00');
    assert.equal(parseScheduleTimeCell('6 p.m.'), '18:00');
    assert.equal(parseScheduleTimeCell('18:00'), '18:00');
    assert.equal(parseScheduleTimeCell('09:05'), '09:05');
    assert.equal(parseScheduleTimeCell('12:00 AM'), '00:00');
    assert.equal(parseScheduleTimeCell('12:00 PM'), '12:00');
    assert.equal(parseScheduleTimeCell(''), '');
    assert.equal(parseScheduleTimeCell('teatime'), null);
    assert.equal(parseScheduleTimeCell('25:00'), null);
  });

  it('reads the event-type vocabulary the export writes, and refuses the rest', () => {
    assert.equal(parseEventTypeCell('League Game'), 'league_game');
    assert.equal(parseEventTypeCell('league_game'), 'league_game');
    assert.equal(parseEventTypeCell('  practice '), 'practice');
    assert.equal(parseEventTypeCell('Game (Tournament)'), 'tournament_game');
    assert.equal(parseEventTypeCell('Bake sale'), null);
    assert.equal(parseHomeAwayCell('H'), 'home');
    assert.equal(parseHomeAwayCell('neutral'), 'neutral');
    assert.equal(parseHomeAwayCell('somewhere'), null);
  });

  it('reads a pasted block with a header row, in any column order', () => {
    const rows = rowsFromSchedulePaste(
      'Opponent\tDate\tTime\tEvent Type\nKanata Selects\t2026-09-12\t10:00 AM\tLeague Game',
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].opponent, 'Kanata Selects');
    assert.equal(rows[0].date, '2026-09-12');
    assert.equal(rows[0].eventType, 'League Game');
  });

  it('templates carry STRUCTURE and never a date, time or opponent', () => {
    for (const kind of ['games', 'practices'] as const) {
      const [headers, ...rows] = buildScheduleTemplate(kind);
      assert.ok(headers.includes('Date') && headers.includes('Opponent'));
      const typeIndex = headers.indexOf('Event Type');
      for (const row of rows) {
        row.forEach((cell, i) => {
          if (i === typeIndex) return; // the type word is structure — it says what the column is for
          assert.equal(cell, '', `template cell ${headers[i]} must ship empty`);
        });
      }
    }
  });
});

describe('schedule import — verdicts', () => {
  const base = (over: Partial<DraftScheduleRow>): DraftScheduleRow => ({
    rowNumber: 1, date: '2026-09-12', time: '10:00 AM', arrival: '', eventType: 'League Game',
    name: '', opponent: 'Kanata Selects', location: '', address: '', field: '', uniform: '',
    homeAway: '', ...over,
  });
  const mirrored: ExistingScheduleEvent = {
    id: 'mirror-1', eventType: 'tournament_game', day: '2026-10-03', time: '09:00',
    opponent: 'Ridgeway Royals', name: 'Riverdale Fall Classic', location: null, isMirrored: true,
  };
  const own: ExistingScheduleEvent = {
    id: 'own-1', eventType: 'league_game', day: '2026-09-15', time: '14:00',
    opponent: 'Barrhaven Blue', name: 'League Game vs Barrhaven Blue', location: null, isMirrored: false,
  };

  it('adds a row that matches nothing', () => {
    const [row] = reviewScheduleRows([base({})], []);
    assert.equal(row.outcome, 'add');
    assert.equal(row.resolved?.startsAt, '2026-09-12T10:00');
    assert.equal(row.resolved?.name, 'League Game vs Kanata Selects');
  });

  it('updates a same-day, same-opponent game and NAMES the old value', () => {
    const [row] = reviewScheduleRows(
      [base({ rowNumber: 2, date: '2026-09-15', time: '6:00 PM', opponent: 'Barrhaven Blue' })],
      [own],
    );
    assert.equal(row.outcome, 'update');
    assert.equal(row.matchedEventId, 'own-1');
    // The clock is spelled one way (owner + /marketing, 2026-08-26). The INPUT above is still
    // "6:00 PM" on purpose — a coach pastes whatever their spreadsheet produced, and the parser
    // must go on accepting it; only what we SHOW them changed.
    assert.match(row.reason!, /2:00 p\.m\./);
    assert.match(row.reason!, /6:00 p\.m\./);
    // ⚠ And it ends with ONE full stop. A formatted time already ends in a period, so appending
    // another produced "6:00 p.m.." — invisible everywhere except where a time lands last.
    assert.ok(!row.reason!.includes('..'), `doubled full stop: ${row.reason}`);
  });

  it('blocks an ambiguous date with a reason in the coach’s words', () => {
    const [row] = reviewScheduleRows([base({ date: '03/04/2026' })], []);
    assert.equal(row.outcome, 'blocked');
    assert.match(row.reason!, /can’t tell what date/i);
    assert.match(row.reason!, /2026-04-03/);
    assert.equal(row.resolved, undefined, 'a blocked row must carry nothing writable');
  });

  it('⚠ SURFACES a look-alike organizer game — never merges, never updates it', () => {
    const [row] = reviewScheduleRows(
      [base({ date: '2026-10-03', opponent: 'Ridgeway Royals' })],
      [mirrored],
    );
    assert.equal(row.outcome, 'organizer');
    assert.match(row.reason!, /Riverdale Fall Classic/);
    assert.equal(committableScheduleRows([row]).length, 0, 'an organizer row is never written');
  });

  it('"Keep both" turns the organizer row into a plain add — the coach’s call, remembered', () => {
    const [row] = reviewScheduleRows(
      [base({ date: '2026-10-03', opponent: 'Ridgeway Royals' })],
      [mirrored],
      { keepBothRowNumbers: [1] },
    );
    assert.equal(row.outcome, 'add');
  });

  it('refuses to import a tournament game outright', () => {
    const [row] = reviewScheduleRows([base({ eventType: 'Game (Tournament)' })], []);
    assert.equal(row.outcome, 'blocked');
    assert.match(row.reason!, /come from the tournament itself/i);
  });

  it('warns (never blocks) on a duplicate inside the pasted sheet', () => {
    const rows = reviewScheduleRows([base({ rowNumber: 1 }), base({ rowNumber: 2 })], []);
    assert.equal(rows[0].warning, undefined);
    assert.match(rows[1].warning!, /twice/);
    assert.equal(rows[1].outcome, 'add', 'a real double-header must still be importable');
  });

  it('does NOT flag a practice as the organizer’s game just because it shares the day', () => {
    // A tournament weekend must not be the one time a coach can't import their own practices.
    const [row] = reviewScheduleRows(
      [base({ date: '2026-10-03', eventType: 'Practice', opponent: '' })],
      [mirrored],
    );
    assert.equal(row.outcome, 'add');
  });

  it('warns on a date outside the season without blocking it', () => {
    const [row] = reviewScheduleRows([base({ date: '2027-01-01' })], [], {
      seasonStart: '2026-09-01', seasonEnd: '2026-11-30',
    });
    assert.match(row.warning!, /outside your season/);
    assert.equal(row.outcome, 'add');
  });
});

// ── C4 · arm care ────────────────────────────────────────────────────────────

describe('arm care (wow #2, D-C7)', () => {
  const players = [
    { id: 'maya', name: '#12 Maya R.', perGameCap: 4 },
    { id: 'priya', name: '#7 Priya S.', perGameCap: null },
  ];
  const input = (over: Partial<Parameters<typeof resolveArmCare>[0]>) => resolveArmCare({
    today: '2026-07-08', todayEventId: 'today', lineups: [], players,
    seasonCap: 3, pitcherPosition: 'P', ...over,
  });

  it('says nothing when the sport has no pitching role', () => {
    assert.deepEqual(input({ pitcherPosition: null }), []);
  });

  it('says nothing when today has no saved lineup — it reads lineups, not intentions', () => {
    assert.deepEqual(input({ lineups: [{ eventId: 'other', day: '2026-07-01', inningsByPlayer: { maya: 5 } }] }), []);
  });

  it('flags a pitcher over the cap THE COACH SET', () => {
    const out = input({ lineups: [{ eventId: 'today', day: '2026-07-08', inningsByPlayer: { maya: 5 } }] });
    assert.equal(out.length, 1);
    assert.equal(out[0].overCap, true);
    assert.equal(out[0].cap, 4);
  });

  it('falls back to the season default when a player has no cap of their own', () => {
    const out = input({ lineups: [{ eventId: 'today', day: '2026-07-08', inningsByPlayer: { priya: 4 } }] });
    assert.equal(out[0].cap, 3);
    assert.equal(out[0].overCap, true);
  });

  it('stays SILENT when no cap exists anywhere — it never invents a threshold', () => {
    const out = resolveArmCare({
      today: '2026-07-08', todayEventId: 'today',
      lineups: [{ eventId: 'today', day: '2026-07-08', inningsByPlayer: { priya: 9 } }],
      players: [{ id: 'priya', name: 'Priya', perGameCap: null }],
      seasonCap: null, pitcherPosition: 'P',
    });
    assert.deepEqual(out, [], 'no season innings ceiling exists in this product; do not imply one');
  });

  it('reports days since the last outing from saved lineups', () => {
    const out = input({
      lineups: [
        { eventId: 'today', day: '2026-07-08', inningsByPlayer: { maya: 2 } },
        { eventId: 'prior', day: '2026-07-06', inningsByPlayer: { maya: 3 } },
      ],
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].overCap, false);
    assert.equal(out[0].daysSinceLastOuting, 2);
    assert.equal(out[0].lastOutingInnings, 3);
  });

  it('CATCHES the double-header — the case it exists for', () => {
    // Two games in one day is exactly when a young arm gets overused. Counting only games on
    // EARLIER days would have made the warning silent in the situation that matters most.
    const out = input({
      lineups: [
        { eventId: 'today', day: '2026-07-08', inningsByPlayer: { maya: 3 } },
        { eventId: 'earlier-today', day: '2026-07-08', inningsByPlayer: { maya: 3 } },
      ],
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].overCap, true, '3 + 3 is over a cap of 4');
    assert.equal(out[0].daysSinceLastOuting, 0);
  });

  it('ignores a FUTURE lineup when working out the last outing', () => {
    const out = input({
      lineups: [
        { eventId: 'today', day: '2026-07-08', inningsByPlayer: { maya: 2 } },
        { eventId: 'later', day: '2026-07-20', inningsByPlayer: { maya: 3 } },
      ],
    });
    assert.deepEqual(out, [], 'a game that has not happened is not rest they did not get');
  });

  it('stays quiet about a well-rested pitcher inside their cap', () => {
    const out = input({
      lineups: [
        { eventId: 'today', day: '2026-07-08', inningsByPlayer: { maya: 2 } },
        { eventId: 'prior', day: '2026-06-01', inningsByPlayer: { maya: 3 } },
      ],
    });
    assert.deepEqual(out, [], 'a card that warns about nothing teaches the coach to ignore it');
  });

  it('ranks over-cap ahead of short rest', () => {
    const out = input({
      lineups: [
        { eventId: 'today', day: '2026-07-08', inningsByPlayer: { maya: 1, priya: 9 } },
        { eventId: 'prior', day: '2026-07-07', inningsByPlayer: { maya: 3 } },
      ],
    });
    assert.equal(out[0].playerId, 'priya');
    assert.equal(out[0].overCap, true);
  });

  it('speaks to the coach’s judgement and takes its period noun from the Sport Pack', () => {
    const [concern] = input({ lineups: [{ eventId: 'today', day: '2026-07-08', inningsByPlayer: { maya: 5 } }] });
    const copy = armCareCopy(concern, 'Innings');
    assert.match(copy.headline, /5 innings at pitcher/);
    assert.match(copy.detail, /Your cap for them is 4/);
    // Never a verdict, never an instruction.
    assert.doesNotMatch(`${copy.headline} ${copy.detail}`, /must|do not|cannot|should not/i);

    const quarters = armCareCopy(concern, 'Quarters');
    assert.match(quarters.headline, /5 quarters at pitcher/);
  });
});
