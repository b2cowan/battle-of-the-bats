import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitSeriesByUnit, drawableSegment, unitSplitNote } from '../../lib/measurable-series.ts';
import { sessionMetricChips, sessionRows, sessionEnteredCount } from '../../lib/development-session-view.ts';
import { practiceTruth, PRACTICE_TRUTH_LABELS } from '../../lib/practice-truth.ts';
import { pastSeasonRefusal, PAST_SEASON_MESSAGE } from '../../lib/development-season-guard.ts';
import { sectionState } from '../../lib/report-section-state.ts';

/**
 * Development lifecycle Phase 0 — trust in existing records (COACH_DEVELOPMENT_LIFECYCLE_PLAN §4,
 * F01–F05). Each block below was written RED before its fix, per F21: nothing exercised this area
 * before, and every finding here was verified on the code, not hypothesised.
 */

const reading = (value: number, unit: string, recordedOn: string, createdAt = `${recordedOn}T12:00:00Z`) =>
  ({ value, unit, recordedOn, createdAt });

// ── F01 — a line never joins two units ───────────────────────────────────────────────────────────
describe('F01 — splitSeriesByUnit: a series breaks wherever the recorded unit changes', () => {
  it('one unit throughout is one segment, oldest → newest', () => {
    const segs = splitSeriesByUnit([
      reading(8.4, 'seconds', '2026-09-08'),
      reading(8.6, 'seconds', '2026-08-01'),
    ]);
    assert.equal(segs.length, 1);
    assert.deepEqual(segs[0].readings.map(r => r.value), [8.6, 8.4]);
  });

  it('mph then km/h is TWO segments — 50 and 80 are never one rising line', () => {
    const segs = splitSeriesByUnit([
      reading(50, 'mph', '2026-07-01'),
      reading(52, 'mph', '2026-07-15'),
      reading(80, 'km/h', '2026-08-01'),
      reading(84, 'km/h', '2026-08-15'),
    ]);
    assert.deepEqual(segs.map(s => [s.unit, s.readings.length]), [['mph', 2], ['km/h', 2]]);
  });

  it('a unit that changes and changes back splits at EVERY change, not by unit', () => {
    const segs = splitSeriesByUnit([
      reading(50, 'mph', '2026-07-01'),
      reading(80, 'km/h', '2026-07-15'),
      reading(52, 'mph', '2026-08-01'),
    ]);
    assert.deepEqual(segs.map(s => s.unit), ['mph', 'km/h', 'mph']);
  });

  it('case and whitespace differences in the unit are the same unit', () => {
    const segs = splitSeriesByUnit([reading(1, 'Seconds ', '2026-07-01'), reading(2, 'seconds', '2026-07-02')]);
    assert.equal(segs.length, 1);
  });

  it('the drawable segment is the CURRENT one — the latest reading’s unit — and the note names what is not drawn', () => {
    const segs = splitSeriesByUnit([
      reading(50, 'mph', '2026-07-01'),
      reading(52, 'mph', '2026-07-15'),
      reading(80, 'km/h', '2026-08-01'),
    ]);
    const drawable = drawableSegment(segs);
    assert.equal(drawable?.unit, 'km/h');
    assert.equal(drawable?.readings.length, 1);
    const note = unitSplitNote(segs);
    assert.ok(note && /2 earlier readings in mph/.test(note), note ?? '(no note)');
    assert.ok(/not drawn/.test(note!), 'the note must say the earlier readings are NOT drawn');
    assert.equal(unitSplitNote(splitSeriesByUnit([reading(1, 's', '2026-07-01')])), null);
  });

  it('every reading is kept — a split never drops one', () => {
    const rows = [reading(1, 'a', '2026-01-01'), reading(2, 'b', '2026-01-02'), reading(3, 'a', '2026-01-03')];
    const total = splitSeriesByUnit(rows).reduce((n, s) => n + s.readings.length, 0);
    assert.equal(total, rows.length);
  });

  it('the profile row draws through the split, never the raw values', () => {
    const src = readFileSync(join(process.cwd(), 'components', 'coaches', 'PlayerDevelopmentSection.tsx'), 'utf8');
    assert.match(src, /splitSeriesByUnit\(/, 'the profile must split a series by unit before drawing it');
    assert.doesNotMatch(src, /chronoValues/, 'the old unit-blind value list must be gone');
  });
});

// ── F02 — a session shows everything saved in it ─────────────────────────────────────────────────
const type = (id: string, isActive: boolean, sortOrder = 0) => ({ id, name: id, unit: 'u', isActive, sortOrder });
const entry = (playerId: string, measurableTypeId: string, id = `${playerId}:${measurableTypeId}`) =>
  ({ id, playerId, measurableTypeId });
const player = (id: string) => ({ id, playerFirstName: id, playerLastName: null, playerNumber: null });

describe('F02 — sessionMetricChips: retired tests with saved rows stay on the session', () => {
  it('active tests lead, in library order; a retired test appears only when this session holds a reading for it', () => {
    const chips = sessionMetricChips(
      [type('sprint', true, 2), type('throw', true, 1), type('shuttle', false), type('vertical', false)],
      [entry('p1', 'shuttle')],
    );
    assert.deepEqual(chips.map(c => [c.type.id, c.retired]), [['throw', false], ['sprint', false], ['shuttle', true]]);
  });

  it('a retired test with no rows in this session is not offered — new entry starts from the active list', () => {
    const chips = sessionMetricChips([type('sprint', true), type('shuttle', false)], []);
    assert.deepEqual(chips.map(c => c.type.id), ['sprint']);
  });
});

describe('F02 — sessionRows: an inactive participant keeps their row, read-only', () => {
  it('roster order first; a past participant with a reading for this test follows, flagged', () => {
    const rows = sessionRows(
      [player('a'), player('b')],
      [player('gone')],
      [entry('b', 'sprint'), entry('gone', 'sprint')],
      'sprint',
    );
    assert.deepEqual(rows.map(r => [r.player.id, !!r.entry, r.pastParticipant]), [
      ['a', false, false], ['b', true, false], ['gone', true, true],
    ]);
  });

  it('a past participant with NO reading for the selected test is not a row — nothing to review', () => {
    const rows = sessionRows([player('a')], [player('gone')], [entry('gone', 'throw')], 'sprint');
    assert.deepEqual(rows.map(r => r.player.id), ['a']);
  });

  it('the entered count counts CURRENT roster players, once each, never rows', () => {
    // Two rows for one player (attempts arrive in Phase 2) must still be ONE player.
    const n = sessionEnteredCount(
      [player('a'), player('b')],
      [entry('a', 'sprint', 'e1'), entry('a', 'sprint', 'e2'), entry('gone', 'sprint')],
      'sprint',
    );
    assert.equal(n, 1);
  });

  it('the session API sends the past participants and the screen reads through the view module', () => {
    const api = readFileSync(join(process.cwd(),
      'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'development', 'sessions', '[sessionId]', 'route.ts'), 'utf8');
    assert.match(api, /pastParticipants/, 'the session read must name the players who are no longer active but have a reading here');
    const page = readFileSync(join(process.cwd(),
      'app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'development', 'sessions', '[sessionId]', 'page.tsx'), 'utf8');
    assert.match(page, /sessionMetricChips\(/);
    assert.match(page, /sessionRows\(/);
    assert.doesNotMatch(page, /types\.filter\(t => t\.isActive\)/, 'the screen must not filter the session’s tests to active before drawing');
  });
});

// ── F03 — a practice is labelled by what the records support ─────────────────────────────────────
describe('F03 — practiceTruth: only a recap may describe what happened', () => {
  const now = new Date('2026-09-11T15:00:00Z');
  it('a plan in the future is an upcoming plan', () => {
    assert.equal(practiceTruth({ startsAt: '2026-09-15T22:00:00Z', practiceRecap: null }, now), 'upcoming');
  });
  it('a past practice with no recap is a past plan — the saved plan does not establish what happened', () => {
    assert.equal(practiceTruth({ startsAt: '2026-08-25T22:00:00Z', practiceRecap: null }, now), 'past-no-recap');
  });
  it('a recap is the evidence, whatever the date', () => {
    assert.equal(practiceTruth({ startsAt: '2026-09-08T22:00:00Z', practiceRecap: 'Went well.' }, now), 'recap');
  });
  it('a practice that started an hour ago is past, one that starts in an hour is upcoming — instants, never date slices', () => {
    assert.equal(practiceTruth({ startsAt: '2026-09-11T14:00:00Z', practiceRecap: null }, now), 'past-no-recap');
    assert.equal(practiceTruth({ startsAt: '2026-09-11T16:00:00Z', practiceRecap: null }, now), 'upcoming');
  });
  it('the three labels are the ones the mockup draws, and none says "run"', () => {
    assert.equal(PRACTICE_TRUTH_LABELS.upcoming.label, 'Upcoming plan');
    assert.equal(PRACTICE_TRUTH_LABELS['past-no-recap'].label, 'Past plan · no recap');
    assert.equal(PRACTICE_TRUTH_LABELS.recap.label, 'Recap recorded');
    for (const k of Object.keys(PRACTICE_TRUTH_LABELS) as (keyof typeof PRACTICE_TRUTH_LABELS)[]) {
      assert.doesNotMatch(PRACTICE_TRUTH_LABELS[k].label, /\brun\b/i);
    }
  });
  it('the report no longer heads the list "Practices you’ve run"', () => {
    const panel = readFileSync(join(process.cwd(),
      'app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'history', 'development', 'panel.tsx'), 'utf8');
    assert.doesNotMatch(panel, /Practices you(&apos;|’|')ve run/, 'the heading claimed the practice happened');
    assert.match(panel, /Practice review/);
    assert.match(panel, /PRACTICE_TRUTH_LABELS/);
  });
});

// ── F04 — edit and delete refuse a past-season row the way create does ───────────────────────────
describe('F04 — pastSeasonRefusal: one rule, every development write', () => {
  it('refuses a roster row from a season other than the assignment’s working one', () => {
    const r = pastSeasonRefusal({ programYearId: 'y2025' }, { programYearId: 'y2026' });
    assert.deepEqual(r, { status: 409, error: PAST_SEASON_MESSAGE });
  });
  it('lets the working season’s row through', () => {
    assert.equal(pastSeasonRefusal({ programYearId: 'y2026' }, { programYearId: 'y2026' }), null);
  });
  it('every goal and reading write route applies it — creates AND edit/delete', () => {
    const dev = join(process.cwd(), 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'roster', '[playerId]', 'development');
    for (const rel of ['goals/route.ts', 'goals/[goalId]/route.ts', 'measurables/route.ts', 'measurables/[entryId]/route.ts']) {
      const src = readFileSync(join(dev, rel), 'utf8');
      assert.match(src, /pastSeasonRefusal\(/, `${rel} must refuse a past-season row through the shared guard`);
    }
  });
});

// ── F05 — a report never reports a gap from an input that did not load ───────────────────────────
describe('F05 — sectionState: available · empty · incomplete · failed', () => {
  it('failed beats everything', () => {
    assert.equal(sectionState({ failed: true, truncated: true, count: 3 }), 'failed');
  });
  it('a truncated read is incomplete even with rows', () => {
    assert.equal(sectionState({ failed: false, truncated: true, count: 200 }), 'incomplete');
  });
  it('no rows and no trouble is empty; rows are available', () => {
    assert.equal(sectionState({ failed: false, truncated: false, count: 0 }), 'empty');
    assert.equal(sectionState({ failed: false, truncated: false, count: 1 }), 'available');
  });
  it('the board route no longer swallows the practice or tag read into an empty list', () => {
    const route = readFileSync(join(process.cwd(),
      'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'development', 'board', 'route.ts'), 'utf8');
    assert.doesNotMatch(route, /\.catch\(\(\) => \[\]\)/, 'a failed practice read must be carried as a state, not an empty list');
    assert.doesNotMatch(route, /\.catch\(\(\) => \(\{\} as Record/, 'a failed tag read must be carried as a state, not an empty map');
    assert.match(route, /practiceRead/);
    assert.match(route, /tagRead/);
  });
  it('the report renders the failed and incomplete states and withholds the finding on them', () => {
    const panel = readFileSync(join(process.cwd(),
      'app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'history', 'development', 'panel.tsx'), 'utf8');
    assert.match(panel, /practiceRead\.state === 'failed'/);
    assert.match(panel, /practiceRead\.state === 'incomplete'/);
    assert.match(panel, /tagRead\.state === 'failed'/);
  });
});
