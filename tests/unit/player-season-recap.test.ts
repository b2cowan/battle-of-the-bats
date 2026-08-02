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
} from '../../lib/player-season-recap.ts';

const NOTHING: PlayerSeasonRecapInput = {
  attendanceGames: { attended: 0, known: 0, recorded: 0 },
  attendancePractices: { attended: 0, known: 0, recorded: 0 },
  goals: [],
  measurables: [],
  awards: [],
  playingTime: null,
};

const input = (patch: Partial<PlayerSeasonRecapInput>): PlayerSeasonRecapInput =>
  ({ ...NOTHING, ...patch });

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

describe('worked on this season', () => {
  it('a single reading is a measurement, not a trend', () => {
    const r = computePlayerSeasonRecap(input({
      measurables: [{ typeId: 't-sprint', typeName: 'Sprint', value: 8.2, unit: 's', recordedOn: '2026-04-02' }],
    }));
    assert.equal(r.workedOn, null, 'one reading cannot state a change');
  });

  it('two readings on the SAME day are a repeat, not a season of change', () => {
    const r = computePlayerSeasonRecap(input({
      measurables: [
        { typeId: 't-sprint', typeName: 'Sprint', value: 8.2, unit: 's', recordedOn: '2026-04-02' },
        { typeId: 't-sprint', typeName: 'Sprint', value: 8.1, unit: 's', recordedOn: '2026-04-02' },
      ],
    }));
    assert.equal(r.workedOn, null);
  });

  it('states first → latest as a fact, with no judgement of direction', () => {
    const r = computePlayerSeasonRecap(input({
      measurables: [
        { typeId: 't-sprint', typeName: 'Sprint', value: 7.6, unit: 's', recordedOn: '2026-06-20' },
        { typeId: 't-sprint', typeName: 'Sprint', value: 8.2, unit: 's', recordedOn: '2026-04-02' },
        { typeId: 't-sprint', typeName: 'Sprint', value: 7.9, unit: 's', recordedOn: '2026-05-11' },
      ],
    }));
    const t = r.workedOn?.trends[0];
    assert.equal(t?.firstValue, 8.2);
    assert.equal(t?.firstOn, '2026-04-02');
    assert.equal(t?.latestValue, 7.6);
    assert.equal(t?.latestOn, '2026-06-20');
    assert.equal(t?.readings, 3);
    // The shape carries no "improved"/"direction" field at all — the product cannot know
    // whether lower is better for a coach's own free-text unit.
    assert.equal('improved' in (t as object), false);
    assert.equal('direction' in (t as object), false);
  });

  it('DROPS a trend whose two ends were measured in different units', () => {
    // The coach edited the test's unit mid-season; each reading snapshots the unit it was
    // logged with. "30 → 110" is a unit conversion, not a change — and there is no honest way
    // to render it, so the absent-not-wrong rule applies.
    const r = computePlayerSeasonRecap(input({
      measurables: [
        { typeId: 't-throw', typeName: 'Throw', value: 30, unit: 'm', recordedOn: '2026-04-02' },
        { typeId: 't-throw', typeName: 'Throw', value: 110, unit: 'ft', recordedOn: '2026-06-02' },
      ],
    }));
    assert.equal(r.workedOn, null, 'a cross-unit comparison must never reach a family');
  });

  it('never merges two DIFFERENT tests that happen to share a name', () => {
    // A retired "Sprint" and a newly-created "Sprint" are two tests: type names are unique
    // only among ACTIVE types. Splicing them would invent a season-long change from two
    // unrelated measurements.
    const r = computePlayerSeasonRecap(input({
      measurables: [
        { typeId: 't-sprint-old', typeName: 'Sprint', value: 60, unit: 's', recordedOn: '2026-04-02' },
        { typeId: 't-sprint-new', typeName: 'Sprint', value: 1, unit: 's', recordedOn: '2026-06-20' },
      ],
    }));
    assert.equal(r.workedOn, null, 'each type had one reading — neither can state a change');
  });

  it('keeps the display name of the LATEST reading for a renamed test', () => {
    const r = computePlayerSeasonRecap(input({
      measurables: [
        { typeId: 't-1', typeName: '40m dash', value: 8.2, unit: 's', recordedOn: '2026-04-02' },
        { typeId: 't-1', typeName: '40m sprint', value: 7.6, unit: 's', recordedOn: '2026-06-20' },
      ],
    }));
    assert.equal(r.workedOn?.trends.length, 1, 'a rename is still one test');
    assert.equal(r.workedOn?.trends[0].typeName, '40m sprint');
  });

  it('goals alone are enough for the block; trends alone are too', () => {
    const goalsOnly = computePlayerSeasonRecap(input({
      goals: [{ focusArea: 'First touch', status: 'working' }],
    }));
    assert.equal(goalsOnly.workedOn?.focusAreas.length, 1);
    assert.deepEqual(goalsOnly.workedOn?.trends, []);

    const trendsOnly = computePlayerSeasonRecap(input({
      measurables: [
        { typeId: 't-sprint', typeName: 'Sprint', value: 8.2, unit: 's', recordedOn: '2026-04-02' },
        { typeId: 't-sprint', typeName: 'Sprint', value: 7.6, unit: 's', recordedOn: '2026-06-20' },
      ],
    }));
    assert.deepEqual(trendsOnly.workedOn?.focusAreas, []);
    assert.equal(trendsOnly.workedOn?.trends.length, 1);
  });

  it('counts distinct evaluation DATES, not readings', () => {
    const r = computePlayerSeasonRecap(input({
      measurables: [
        { typeId: 't-sprint', typeName: 'Sprint', value: 8.2, unit: 's', recordedOn: '2026-04-02' },
        { typeId: 't-throw', typeName: 'Throw', value: 30, unit: 'm', recordedOn: '2026-04-02' },
        { typeId: 't-sprint', typeName: 'Sprint', value: 7.6, unit: 's', recordedOn: '2026-06-20' },
      ],
    }));
    assert.equal(r.workedOn?.sessionCount, 2);
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
