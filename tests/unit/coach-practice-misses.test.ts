import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computePracticeMisses,
  weekdayOfDay,
  PRACTICE_WINDOW,
  type PracticeAttendanceRecord,
} from '../../lib/coach-practice-misses.ts';

const PLAYERS = [
  { id: 'dev', name: 'Dev' },
  { id: 'maya', name: 'Maya' },
  { id: 'sam', name: 'Sam' },
];

/** Every Tuesday in July 2026 is the 7th, 14th, 21st, 28th. */
const TUESDAYS = ['2026-07-07', '2026-07-14', '2026-07-21', '2026-07-28'];
const THURSDAYS = ['2026-07-09', '2026-07-16'];

type Status = PracticeAttendanceRecord['status'];

function marks(day: string, byPlayer: Record<string, Status>, label = 'Practice'): PracticeAttendanceRecord[] {
  return Object.entries(byPlayer).map(([playerId, status]) => ({
    eventId: `ev-${day}`, day, label, playerId, status,
  }));
}

/** Dev misses all four Tuesdays; the others miss one apiece across six tracked practices. */
const SEASON: PracticeAttendanceRecord[] = [
  ...marks(TUESDAYS[0], { dev: 'absent', maya: 'attending', sam: 'attending' }, 'Tuesday practice'),
  ...marks(THURSDAYS[0], { dev: 'attending', maya: 'absent', sam: 'attending' }, 'Thursday practice'),
  ...marks(TUESDAYS[1], { dev: 'absent', maya: 'attending', sam: 'attending' }, 'Tuesday practice'),
  ...marks(THURSDAYS[1], { dev: 'attending', maya: 'attending', sam: 'absent' }, 'Thursday practice'),
  ...marks(TUESDAYS[2], { dev: 'absent', maya: 'attending', sam: 'attending' }, 'Tuesday practice'),
  ...marks(TUESDAYS[3], { dev: 'absent', maya: 'late', sam: 'attending' }, 'Tuesday practice'),
];

const run = (records = SEASON, players = PLAYERS, windowSize?: number) =>
  computePracticeMisses({ records, players, windowSize });

describe('weekdayOfDay', () => {
  it('reads the weekday from the calendar parts, not the runtime zone', () => {
    assert.equal(weekdayOfDay('2026-07-07'), 'Tuesday');
    assert.equal(weekdayOfDay('2026-07-09'), 'Thursday');
    assert.equal(weekdayOfDay('2026-08-02'), 'Sunday');
  });
  it('returns null for anything that is not a calendar day', () => {
    assert.equal(weekdayOfDay(''), null);
    assert.equal(weekdayOfDay('2026-07-07T10:00:00Z'), null);
  });
});

describe('computePracticeMisses', () => {
  it('reproduces the approved answer: Dev missed 4 of the last 6', () => {
    const r = run();
    assert.equal(r.rows[0].name, 'Dev');
    assert.equal(r.rows[0].missed, 4);
    assert.equal(r.windowPractices, 6);
    assert.equal(r.rows[0].known, 6);
  });

  it('spots that every absence fell on the same weekday', () => {
    assert.equal(run().rows[0].sameWeekday, 'Tuesday');
  });

  it('does not claim a weekday pattern from a single absence', () => {
    const r = run([...marks(TUESDAYS[0], { dev: 'absent' }), ...marks(THURSDAYS[0], { dev: 'attending' })]);
    assert.equal(r.rows[0].sameWeekday, null);
  });

  it('does not claim a pattern when absences fall on different weekdays', () => {
    const maya = run().rows.find(x => x.name === 'Maya');
    const sam = run().rows.find(x => x.name === 'Sam');
    assert.equal(maya?.missed, 1);
    assert.equal(sam?.missed, 1);
    assert.equal(maya?.sameWeekday, null);
  });

  it('supports the "everyone else" half of the sentence', () => {
    const r = run();
    const others = r.rows.slice(1);
    assert.ok(others.every(x => x.missed <= 1));
  });

  it('returns absences most recent first, with the words the receipt shows', () => {
    const dev = run().rows[0];
    assert.deepEqual(dev.absences.map(a => a.day), [...TUESDAYS].reverse());
    assert.equal(dev.absences[0].label, 'Tuesday practice');
  });

  // ── The rule that matters most ─────────────────────────────────────────────
  it('never counts a no-reply as a miss, and never as a known session', () => {
    const r = run([
      ...marks(TUESDAYS[0], { dev: 'unknown', maya: 'attending' }),
      ...marks(TUESDAYS[1], { dev: 'absent', maya: 'attending' }),
    ]);
    const dev = r.rows.find(x => x.name === 'Dev');
    assert.equal(dev?.missed, 1);
    assert.equal(dev?.known, 1, 'the unmarked practice counts for nothing, in either direction');
  });

  it('counts late as attended, not missed', () => {
    const r = run([...marks(TUESDAYS[0], { dev: 'late' })]);
    assert.equal(r.rows[0].missed, 0);
    assert.equal(r.rows[0].known, 1);
  });

  // ── The window ─────────────────────────────────────────────────────────────
  it('judges only the most recent practices', () => {
    const older = marks('2026-05-05', { dev: 'absent', maya: 'absent', sam: 'absent' });
    const r = run([...older, ...SEASON]);
    assert.equal(r.windowPractices, 6);
    assert.equal(r.rows[0].missed, 4, 'the May practice is outside the window');
  });

  it('honours a caller-supplied window size', () => {
    const r = run(SEASON, PLAYERS, 2);
    assert.equal(r.windowPractices, 2);
    // The two most recent are Jul 21 and Jul 28 — both Tuesdays Dev missed.
    assert.equal(r.rows[0].missed, 2);
  });

  it('gives a mid-season joiner their OWN denominator', () => {
    const withJoiner = [
      ...SEASON,
      ...marks(TUESDAYS[3], { late_joiner: 'absent' }, 'Tuesday practice'),
    ];
    const r = computePracticeMisses({
      records: withJoiner,
      players: [...PLAYERS, { id: 'late_joiner', name: 'Rae' }],
    });
    const rae = r.rows.find(x => x.name === 'Rae');
    assert.equal(rae?.missed, 1);
    assert.equal(rae?.known, 1, 'never described against practices held before they arrived');
    assert.equal(r.windowPractices, 6);
  });

  it('names the stretch it judged', () => {
    const r = run();
    assert.equal(r.windowFrom, TUESDAYS[0]);
    assert.equal(r.windowTo, TUESDAYS[3]);
  });

  // ── Sparse and empty ───────────────────────────────────────────────────────
  it('flags a thin sample as not yet reliable', () => {
    const r = run([...marks(TUESDAYS[0], { dev: 'absent', maya: 'attending', sam: 'attending' })]);
    assert.equal(r.windowPractices, 1);
    assert.equal(r.reliable, true, 'one tracked practice out of one is all there is to know');
    const r2 = computePracticeMisses({
      records: [...marks(TUESDAYS[0], { dev: 'absent' }), ...marks(TUESDAYS[1], { maya: 'attending' }),
                ...marks(TUESDAYS[2], { maya: 'attending' }), ...marks(THURSDAYS[0], { maya: 'attending' })],
      players: PLAYERS,
    });
    assert.equal(r2.rows[0].name, 'Dev');
    assert.equal(r2.reliable, false, 'Dev has one tracked session out of four practices');
  });

  it('includes players with a clean record, at the bottom', () => {
    const r = run();
    assert.equal(r.rows.length, 3);
    assert.ok(r.rows.some(x => x.name === 'Sam'));
  });

  it('ignores a mark for someone not on the roster', () => {
    const r = run([...marks(TUESDAYS[0], { ghost: 'absent', dev: 'attending' })]);
    assert.ok(r.rows.every(x => x.name !== 'ghost'));
    assert.equal(r.rows.filter(x => x.missed > 0).length, 0);
  });

  it('handles no records at all without throwing', () => {
    const r = run([]);
    assert.equal(r.windowPractices, 0);
    assert.equal(r.windowFrom, null);
    assert.equal(r.reliable, false);
    assert.ok(r.rows.every(x => x.missed === 0 && x.known === 0));
  });

  it('handles an empty roster without throwing', () => {
    const r = computePracticeMisses({ records: SEASON, players: [] });
    assert.deepEqual(r.rows, []);
    assert.equal(r.reliable, false);
  });

  it('breaks ties by tracked sessions, then name, so the order never wobbles', () => {
    const r = run([
      ...marks(TUESDAYS[0], { dev: 'absent', maya: 'absent', sam: 'attending' }),
      ...marks(TUESDAYS[1], { dev: 'attending', sam: 'attending' }),
    ]);
    assert.deepEqual(r.rows.map(x => x.name), ['Dev', 'Maya', 'Sam']);
  });

  it('defaults the window to the shared constant', () => {
    assert.equal(PRACTICE_WINDOW, 6);
    assert.equal(run().windowPractices, Math.min(PRACTICE_WINDOW, 6));
  });
});
