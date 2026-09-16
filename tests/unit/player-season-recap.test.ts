/**
 * The recap's ONE rule, tested: a block it cannot fill from recorded data is ABSENT, not empty.
 *
 * Chunk D 3.2 goes to a parent, about their child, at the end of a season. Two failures are
 * equally serious and both are guarded here: telling a family something that did not happen,
 * and implying a coach neglected something because a feature they never used renders as a gap.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computePlayerSeasonRecap,
  isRecapEmpty,
  type PlayerSeasonRecapInput,
  type RecapTestInput,
} from '../../lib/player-season-recap.ts';
import { formatShortDate } from '../../lib/measurable-format.ts';

const NOTHING: PlayerSeasonRecapInput = {
  attendanceGames: { attended: 0, known: 0, recorded: 0 },
  attendancePractices: { attended: 0, known: 0, recorded: 0 },
  goals: [],
  tests: [],
  awards: [],
  playingTime: null,
};

const input = (patch: Partial<PlayerSeasonRecapInput>): PlayerSeasonRecapInput =>
  ({ ...NOTHING, ...patch });

/** Dates in expectations go through the ONE formatter the series module uses. */
const d = formatShortDate;

/* The tests as the reports read them (re-evaluation stage 4, G6): the definition decides what the
   line follows; the readings are every attempt. */
const sprint: RecapTestInput['def'] = {
  name: '60-yd sprint', kind: 'test', unit: 'seconds', aim: 'lower', headline: 'best',
  rangeFrom: null, rangeTo: null, method: null,
};
const changeup: RecapTestInput['def'] = {
  name: 'Changeup speed', kind: 'test', unit: 'mph', aim: 'range', headline: 'in_range',
  rangeFrom: 62, rangeTo: 68, method: null,
};
let seq = 0;
const reading = (value: number, recordedOn: string, sessionId: string | null, attemptNo = 1, unit = 'seconds') => ({
  id: `r${++seq}`, value, unit, recordedOn, createdAt: `${recordedOn}T12:00:${String(seq).padStart(2, '0')}Z`, sessionId, attemptNo,
});
const test = (def: RecapTestInput['def'], readings: RecapTestInput['readings']): RecapTestInput => ({ def, readings });

describe('degrades honestly — nothing recorded means nothing shown', () => {
  it('a coach who recorded nothing produces an entirely empty recap', () => {
    const r = computePlayerSeasonRecap(NOTHING);
    assert.equal(r.attendance, null);
    assert.equal(r.workedOn, null);
    assert.equal(r.awards, null);
    assert.equal(r.playingTime, null);
    assert.equal(isRecapEmpty(r), true);
  });

  it('no awards is ABSENT, never a zero', () => {
    const r = computePlayerSeasonRecap(input({
      attendanceGames: { attended: 5, known: 5, recorded: 5 },
    }));
    assert.equal(r.awards, null, 'an award block reading "0" implies the child earned none');
  });

  it('attendance rows that are all no-replies yield no percentage', () => {
    // 4 events recorded, every one unanswered: `known` is 0, and both 0% and 100% would lie.
    const r = computePlayerSeasonRecap(input({
      attendanceGames: { attended: 0, known: 0, recorded: 4 },
    }));
    assert.equal(r.attendance, null);
  });

  it('a genuine 0% is shown, because it is a fact', () => {
    const r = computePlayerSeasonRecap(input({
      attendanceGames: { attended: 0, known: 3, recorded: 3 },
    }));
    assert.equal(r.attendance?.pct, 0);
    assert.equal(r.attendance?.known, 3);
  });
});

describe('attendance', () => {
  it('combines games and practices, and keeps the split alongside', () => {
    const r = computePlayerSeasonRecap(input({
      attendanceGames: { attended: 9, known: 10, recorded: 12 },
      attendancePractices: { attended: 14, known: 15, recorded: 20 },
    }));
    assert.equal(r.attendance?.attended, 23);
    assert.equal(r.attendance?.known, 25);
    assert.equal(r.attendance?.pct, 92);
    assert.deepEqual(r.attendance?.games, { attended: 9, known: 10 });
    assert.deepEqual(r.attendance?.practices, { attended: 14, known: 15 });
  });

  it('omits a bucket with no known responses rather than showing 0/0', () => {
    const r = computePlayerSeasonRecap(input({
      attendanceGames: { attended: 4, known: 4, recorded: 4 },
      attendancePractices: { attended: 0, known: 0, recorded: 0 },
    }));
    assert.equal(r.attendance?.practices, null);
  });
});

describe('worked on this season — through the ONE series the chart and the handout read (stage 4, G6)', () => {
  it('a single result is a measurement, not a story', () => {
    const r = computePlayerSeasonRecap(input({
      tests: [test(sprint, [reading(8.2, '2026-04-02', 's1')])],
    }));
    assert.equal(r.workedOn, null, 'one result cannot state a change');
  });

  it('three attempts in ONE session are one result — and one result is no line', () => {
    const r = computePlayerSeasonRecap(input({
      tests: [test(sprint, [reading(8.2, '2026-04-02', 's1', 1), reading(8.1, '2026-04-02', 's1', 2), reading(8.3, '2026-04-02', 's1', 3)])],
    }));
    assert.equal(r.workedOn, null);
  });

  it('two bench-side attempts on the SAME day are one result too (correct by construction)', () => {
    const r = computePlayerSeasonRecap(input({
      tests: [test(sprint, [reading(8.2, '2026-04-02', null, 1), reading(8.1, '2026-04-02', null, 2)])],
    }));
    assert.equal(r.workedOn, null);
  });

  it('states the first result → the latest in the paper\'s words, the change as arithmetic in the unit, and a count of RESULTS', () => {
    const r = computePlayerSeasonRecap(input({
      tests: [test(sprint, [
        // The headline per session leads (best, lower is the aim) — not an arbitrary attempt.
        reading(8.62, '2026-05-06', null),
        reading(8.41, '2026-05-20', null),
        reading(8.31, '2026-06-10', 's3', 1), reading(8.24, '2026-06-10', 's3', 2),
        reading(8.28, '2026-09-15', 's4', 1),
      ])],
    }));
    const t = r.workedOn?.trends[0];
    assert.equal(t?.typeName, '60-yd sprint');
    assert.equal(t?.line, '8.62 → 8.28 seconds');
    assert.equal(t?.change, `0.34 seconds lower since ${d('2026-05-06')}`);
    assert.equal(t?.firstOn, '2026-05-06');
    assert.equal(t?.latestOn, '2026-09-15');
    assert.equal(t?.results, 4, 'four results — the session\'s two attempts are one');
    // The shape carries no "improved"/"direction" field at all — the change is words in the unit,
    // never a verdict (chart rule 4).
    assert.equal('improved' in (t as object), false);
    assert.equal('direction' in (t as object), false);
    assert.doesNotMatch(JSON.stringify(t), /faster|slower|better|worse/i);
  });

  it('a range test says attempts in range and "moved into the range" — never best, faster or slower', () => {
    const r = computePlayerSeasonRecap(input({
      tests: [test(changeup, [
        reading(60, '2026-05-27', 'c1', 1, 'mph'), reading(70, '2026-05-27', 'c1', 2, 'mph'), reading(61, '2026-05-27', 'c1', 3, 'mph'),
        reading(66, '2026-06-10', 'c2', 1, 'mph'), reading(70, '2026-06-10', 'c2', 2, 'mph'), reading(64, '2026-06-10', 'c2', 3, 'mph'),
      ])],
    }));
    const t = r.workedOn?.trends[0];
    assert.equal(t?.line, '2 of 3 in range');
    assert.equal(t?.change, `moved into the range since ${d('2026-05-27')} (0 of 3)`);
    assert.equal(t?.results, 2);
  });

  it('never merges two DIFFERENT tests that happen to share a name', () => {
    // A retired "Sprint" and a newly-created "Sprint" are two tests: type names are unique
    // only among ACTIVE types (the assembler groups by type id, so they arrive as two entries).
    // Splicing them would invent a season-long change from two unrelated measurements.
    const r = computePlayerSeasonRecap(input({
      tests: [
        test({ ...sprint, name: 'Sprint' }, [reading(60, '2026-04-02', null)]),
        test({ ...sprint, name: 'Sprint' }, [reading(1, '2026-06-20', null)]),
      ],
    }));
    assert.equal(r.workedOn, null, 'each test had one result — neither can state a change');
  });

  it('goals print by ONE rule: working and achieved with their status word; parked stays off the keepsake', () => {
    const r = computePlayerSeasonRecap(input({
      goals: [
        { focusArea: 'First touch', status: 'working' },
        { focusArea: 'Reads the pitcher', status: 'achieved' },
        { focusArea: 'Two-strike approach', status: 'parked' },
      ],
    }));
    assert.deepEqual(r.workedOn?.focusAreas, [
      { focusArea: 'First touch', status: 'working' },
      { focusArea: 'Reads the pitcher', status: 'achieved' },
    ]);
    const parkedOnly = computePlayerSeasonRecap(input({ goals: [{ focusArea: 'Two-strike approach', status: 'parked' }] }));
    assert.equal(parkedOnly.workedOn, null, 'a parked goal alone is nothing to print — the block is absent, not empty');
  });

  it('goals alone are enough for the block; results alone are too', () => {
    const goalsOnly = computePlayerSeasonRecap(input({
      goals: [{ focusArea: 'First touch', status: 'working' }],
    }));
    assert.equal(goalsOnly.workedOn?.focusAreas.length, 1);
    assert.deepEqual(goalsOnly.workedOn?.trends, []);

    const resultsOnly = computePlayerSeasonRecap(input({
      tests: [test(sprint, [reading(8.2, '2026-04-02', null), reading(7.6, '2026-06-20', null)])],
    }));
    assert.deepEqual(resultsOnly.workedOn?.focusAreas, []);
    assert.equal(resultsOnly.workedOn?.trends.length, 1);
  });

  it('carries no count of sessions and no "notes" — the old caption counted days and named notes that did not exist', () => {
    const r = computePlayerSeasonRecap(input({
      tests: [test(sprint, [reading(8.2, '2026-04-02', null), reading(7.6, '2026-06-20', null)])],
    }));
    assert.equal('sessionCount' in (r.workedOn as object), false);
    assert.doesNotMatch(JSON.stringify(r.workedOn), /readings?/i);
  });
});

describe('awards', () => {
  it('newest first, counted', () => {
    const r = computePlayerSeasonRecap(input({
      awards: [
        { name: 'Hustle', emoji: null, awardedAt: '2026-05-02' },
        { name: 'MVP', emoji: '🏆', awardedAt: '2026-07-19' },
        { name: 'Hustle', emoji: null, awardedAt: '2026-06-11' },
      ],
    }));
    assert.equal(r.awards?.count, 3);
    assert.equal(r.awards?.items[0].name, 'MVP');
    assert.equal(r.awards?.items[2].awardedAt, '2026-05-02');
  });
});

describe('playing time', () => {
  const team = [10, 12, 14, 16, 18]; // median 14

  it('is absent when no lineup was ever set — never a benched-looking zero', () => {
    const r = computePlayerSeasonRecap(input({
      playingTime: { fieldInnings: 0, benchInnings: 0, gamesWithLineup: 0, teamFieldInnings: [] },
    }));
    assert.equal(r.playingTime, null);
  });

  it('is absent for a player who never appeared in any lineup', () => {
    const r = computePlayerSeasonRecap(input({
      playingTime: { fieldInnings: 0, benchInnings: 0, gamesWithLineup: 8, teamFieldInnings: team },
    }));
    assert.equal(r.playingTime, null);
  });

  it('reads against the team median with a generous band', () => {
    const inBand = computePlayerSeasonRecap(input({
      playingTime: { fieldInnings: 14, benchInnings: 4, gamesWithLineup: 8, teamFieldInnings: team },
    }));
    assert.equal(inBand.playingTime?.band, 'in_band');

    // ±20% of 14 is 11.2 … 16.8 — 16 is still "in band" on purpose.
    const stillInBand = computePlayerSeasonRecap(input({
      playingTime: { fieldInnings: 16, benchInnings: 2, gamesWithLineup: 8, teamFieldInnings: team },
    }));
    assert.equal(stillInBand.playingTime?.band, 'in_band');

    const above = computePlayerSeasonRecap(input({
      playingTime: { fieldInnings: 24, benchInnings: 0, gamesWithLineup: 8, teamFieldInnings: team },
    }));
    assert.equal(above.playingTime?.band, 'above_band');

    const below = computePlayerSeasonRecap(input({
      playingTime: { fieldInnings: 4, benchInnings: 20, gamesWithLineup: 8, teamFieldInnings: team },
    }));
    assert.equal(below.playingTime?.band, 'below_band');
  });

  it('a bench-only player is shown, and reads below the band rather than vanishing', () => {
    const r = computePlayerSeasonRecap(input({
      playingTime: { fieldInnings: 0, benchInnings: 12, gamesWithLineup: 6, teamFieldInnings: team },
    }));
    assert.equal(r.playingTime?.band, 'below_band');
    assert.equal(r.playingTime?.fieldInnings, 0);
  });
});

describe('isRecapEmpty', () => {
  it('is false as soon as ONE block survives', () => {
    const r = computePlayerSeasonRecap(input({
      awards: [{ name: 'MVP', emoji: null, awardedAt: '2026-07-19' }],
    }));
    assert.equal(isRecapEmpty(r), false);
  });
});
