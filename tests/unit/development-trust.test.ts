import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chronological, sameUnit } from '../../lib/measurable-series.ts';
import { sessionMetricChips, sessionRows, sessionScopeCounts, defaultSessionChip } from '../../lib/development-session-view.ts';
import { practiceTruth, PRACTICE_TRUTH_LABELS } from '../../lib/practice-truth.ts';
import { pastSeasonRefusal, PAST_SEASON_MESSAGE } from '../../lib/development-season-guard.ts';
import { sectionState } from '../../lib/report-section-state.ts';

/**
 * Development lifecycle Phase 0 — trust in existing records (COACH_DEVELOPMENT_LIFECYCLE_PLAN §4,
 * F01–F05). Each block below was written RED before its fix, per F21: nothing exercised this area
 * before, and every finding here was verified on the code, not hypothesised.
 *
 * F01 (a line never joins two units) is now held one level up: the UNIT IS FIXED once a result
 * exists (owner, 2026-09-15 — `unitIsFixed`, tests/unit/development-definitions.test.ts), so one
 * test never holds two units and there is no split to draw. What remains here is the order a line
 * is drawn in and the one spelling of "the same unit".
 */

const reading = (value: number, unit: string, recordedOn: string, createdAt = `${recordedOn}T12:00:00Z`) =>
  ({ value, unit, recordedOn, createdAt });

// ── F01 — the order a line is drawn in ───────────────────────────────────────────────────────────
describe('F01 — chronological: oldest → newest, same-day rows in the order they were typed', () => {
  it('sorts by the recorded date, then entry time', () => {
    const rows = chronological([
      reading(8.4, 'seconds', '2026-09-08'),
      reading(8.6, 'seconds', '2026-08-01'),
      reading(8.5, 'seconds', '2026-08-01', '2026-08-01T09:00:00Z'),
    ]);
    assert.deepEqual(rows.map(r => r.value), [8.5, 8.6, 8.4]);
  });

  it('case and whitespace differences in the unit are the same unit; "s" and "seconds" are not', () => {
    assert.equal(sameUnit('Seconds ', 'seconds'), true);
    assert.equal(sameUnit('s', 'seconds'), false);
  });
});

// ── F02 — a session shows everything saved in it ─────────────────────────────────────────────────
const type = (id: string, isActive: boolean, sortOrder = 0) => ({ id, name: id, unit: 'u', isActive, sortOrder });
const entry = (playerId: string, measurableTypeId: string, id = `${playerId}:${measurableTypeId}`) =>
  ({ id, playerId, measurableTypeId, attemptNo: 1 });
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
    assert.deepEqual(rows.map(r => [r.player.id, r.entries.length > 0, r.pastParticipant]), [
      ['a', false, false], ['b', true, false], ['gone', true, true],
    ]);
  });

  it('a past participant with NO reading for the selected test is not a row — nothing to review', () => {
    const rows = sessionRows([player('a')], [player('gone')], [entry('gone', 'throw')], 'sprint');
    assert.deepEqual(rows.map(r => r.player.id), ['a']);
  });

  it('the entered count counts CURRENT roster players, once each, never rows', () => {
    // Two rows for one player (attempts, Phase 2) must still be ONE player; a departed player's
    // reading is listed but never counted.
    const rows = sessionRows(
      [player('a'), player('b')], [player('gone')],
      [entry('a', 'sprint', 'e1'), entry('a', 'sprint', 'e2'), entry('gone', 'sprint')],
      'sprint',
    );
    assert.deepEqual(sessionScopeCounts(rows, null), { scoped: false, recorded: 1, notAssessed: 0, notRecorded: 1, total: 2 });
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
  it('a past practice with no recap is a past plan, and its row carries ONE sentence (owner ruling 2026-09-12)', () => {
    assert.equal(practiceTruth({ startsAt: '2026-08-25T22:00:00Z', practiceRecap: null }, now), 'past-no-recap');
    assert.equal(PRACTICE_TRUTH_LABELS['past-no-recap'].meta, null, 'the second line was cut on the Phase 0 walk');
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
    // Phase 2 (2026-09-13): the per-player routes may stand on the ONE shared resolver, which
    // applies the guard once for all of them — so the resolver is checked, and a route proves
    // itself either inline or by calling it.
    const resolver = readFileSync(join(process.cwd(), 'lib', 'development-player-route.ts'), 'utf8');
    assert.match(resolver, /pastSeasonRefusal\(player, assignment\)/, 'the shared resolver must refuse a past-season row');
    const dev = join(process.cwd(), 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'roster', '[playerId]', 'development');
    for (const rel of ['goals/route.ts', 'goals/[goalId]/route.ts', 'measurables/route.ts', 'measurables/[entryId]/route.ts',
      'goals/[goalId]/reviews/route.ts', 'observations/route.ts', 'observations/[observationId]/route.ts']) {
      const src = readFileSync(join(dev, rel), 'utf8');
      assert.ok(/pastSeasonRefusal\(/.test(src) || /resolveDevelopmentPlayerContext\(/.test(src),
        `${rel} must refuse a past-season row through the shared guard`);
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

// ── /review 2026-09-12 follow-ups ────────────────────────────────────────────────────────────────
describe('review follow-ups — where a session opens', () => {
  it('a session opens on the first test it holds rows for — a retired one included — else the first active test', () => {
    const chips = sessionMetricChips([type('sprint', true, 1), type('throw', true, 2), type('shuttle', false)], [entry('p1', 'shuttle')]);
    assert.equal(defaultSessionChip(chips)?.type.id, 'shuttle');
    assert.equal(defaultSessionChip(sessionMetricChips([type('sprint', true, 1), type('throw', true, 2)], []))?.type.id, 'sprint');
    assert.equal(defaultSessionChip(sessionMetricChips([type('sprint', true, 1), type('throw', true, 2)], [entry('p1', 'throw')]))?.type.id, 'throw');
    assert.equal(defaultSessionChip([]), null);
  });
});
