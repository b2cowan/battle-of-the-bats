import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  readMeasurableTypeInput,
  readGoalPatchInput,
  readMeasurableInput,
  readSessionPatchInput,
} from '../../lib/development-input.ts';

/**
 * F21 — the first unit tests over the development routes' contracts. The routes validated their
 * bodies inline, which is why nothing could exercise them; the readers now live in
 * `lib/development-input.ts` (one home, pure) and each route reads through them. These tests pin
 * the contract the profile, the session screen and the demo seed already depend on.
 */

const api = (...rel: string[]) => readFileSync(join(process.cwd(), 'app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', ...rel), 'utf8');

describe('readMeasurableTypeInput — a test needs a name and a unit', () => {
  it('trims both and accepts a full create', () => {
    assert.deepEqual(readMeasurableTypeInput({ name: ' 60-yd sprint ', unit: ' seconds ' }, 'create'),
      { fields: { name: '60-yd sprint', unit: 'seconds' } });
  });
  it('refuses a missing or over-long name (40) and unit (20), with the wording the screens show', () => {
    const noName = readMeasurableTypeInput({ unit: 's' }, 'create');
    assert.ok('error' in noName && /Name is required \(max 40/.test(noName.error));
    const longUnit = readMeasurableTypeInput({ name: 'x', unit: 'u'.repeat(21) }, 'create');
    assert.ok('error' in longUnit && /Unit is required \(max 20/.test(longUnit.error));
  });
  it('a patch may carry any subset, but never nothing, and isActive must be a boolean', () => {
    assert.deepEqual(readMeasurableTypeInput({ isActive: false }, 'patch'), { fields: { isActive: false } });
    assert.ok('error' in readMeasurableTypeInput({}, 'patch'));
    assert.ok('error' in readMeasurableTypeInput({ isActive: 'no' }, 'patch'));
    // A patch that names the unit still validates it — an empty unit cannot be patched in.
    assert.ok('error' in readMeasurableTypeInput({ unit: '' }, 'patch'));
  });
});

describe('readGoalPatchInput — status, focus, note and tag, any subset', () => {
  it('validates each present field and refuses an empty patch', () => {
    assert.deepEqual(readGoalPatchInput({ status: 'achieved' }), { fields: { status: 'achieved' } });
    assert.ok('error' in readGoalPatchInput({ status: 'done' }));
    assert.ok('error' in readGoalPatchInput({ focusArea: 'x'.repeat(81) }));
    assert.deepEqual(readGoalPatchInput({ note: '  ' }), { fields: { note: null } });
    assert.ok('error' in readGoalPatchInput({}));
  });
  it('a blank tag clears it — null means "the coach hasn’t said"', () => {
    assert.deepEqual(readGoalPatchInput({ tagId: ' ' }), { fields: { tagId: null } });
    assert.deepEqual(readGoalPatchInput({ tagId: 'tag1' }), { fields: { tagId: 'tag1' } });
  });
});

describe('readMeasurableInput — a reading is a number, a date and optionally a note', () => {
  it('accepts a whole reading', () => {
    const r = readMeasurableInput({ measurableTypeId: 't1', value: 8.42, recordedOn: '2026-09-08', note: ' turf ' });
    assert.deepEqual(r, { fields: { measurableTypeId: 't1', value: 8.42, recordedOn: '2026-09-08', note: 'turf', sessionId: null } });
  });
  it('a value is a finite number between 0 and 99,999 — never a string, never NaN, never a fabricated zero', () => {
    assert.ok('error' in readMeasurableInput({ measurableTypeId: 't1', value: '8.4', recordedOn: '2026-09-08' }));
    assert.ok('error' in readMeasurableInput({ measurableTypeId: 't1', value: -1, recordedOn: '2026-09-08' }));
    assert.ok('error' in readMeasurableInput({ measurableTypeId: 't1', recordedOn: '2026-09-08' }));
  });
  it('a fat-fingered year is refused', () => {
    assert.ok('error' in readMeasurableInput({ measurableTypeId: 't1', value: 1, recordedOn: '0202-09-08' }));
  });
  it('the session id must be a string when present', () => {
    assert.ok('error' in readMeasurableInput({ measurableTypeId: 't1', value: 1, recordedOn: '2026-09-08', sessionId: 5 }));
    const ok = readMeasurableInput({ measurableTypeId: 't1', value: 1, recordedOn: '2026-09-08', sessionId: 's1' });
    assert.ok('fields' in ok && ok.fields.sessionId === 's1');
  });
});

describe('readSessionPatchInput — date, note, event link', () => {
  it('validates the date and the note and refuses an empty patch', () => {
    assert.deepEqual(readSessionPatchInput({ sessionDate: '2026-09-08' }), { fields: { sessionDate: '2026-09-08' } });
    assert.ok('error' in readSessionPatchInput({ sessionDate: '2026-13-01' }));
    assert.ok('error' in readSessionPatchInput({ note: 'n'.repeat(201) }));
    assert.ok('error' in readSessionPatchInput({}));
  });
  it('the event link is a string id, or null to unlink — nothing else', () => {
    assert.deepEqual(readSessionPatchInput({ eventId: null }), { fields: { eventId: null } });
    assert.deepEqual(readSessionPatchInput({ eventId: 'ev1' }), { fields: { eventId: 'ev1' } });
    assert.ok('error' in readSessionPatchInput({ eventId: 7 }));
    assert.ok('error' in readSessionPatchInput({ eventId: '' }));
  });
});

describe('the routes read through the shared readers', () => {
  it('types, goals, readings and sessions', () => {
    assert.match(api('development', 'measurable-types', 'route.ts'), /readMeasurableTypeInput\(/);
    assert.match(api('development', 'measurable-types', '[typeId]', 'route.ts'), /readMeasurableTypeInput\(/);
    assert.match(api('roster', '[playerId]', 'development', 'goals', '[goalId]', 'route.ts'), /readGoalPatchInput\(/);
    assert.match(api('roster', '[playerId]', 'development', 'measurables', 'route.ts'), /readMeasurableInput\(/);
    assert.match(api('development', 'sessions', '[sessionId]', 'route.ts'), /readSessionPatchInput\(/);
  });
});

/**
 * The re-stamp (D10). A reading is stamped with the session's date when typed, so moving the
 * session MUST move its readings — before the session row moves, and put back if the move fails.
 * Pinned at source because the two writes are not in one transaction.
 */
describe('session PATCH — the re-stamp moves the readings before the session, and back on failure', () => {
  const src = api('development', 'sessions', '[sessionId]', 'route.ts');
  it('re-stamps before updating the session row', () => {
    const restamp = src.indexOf('await restampRepSessionMeasurables(sessionId, teamId, fields.sessionDate!)');
    const update = src.indexOf('await updateRepTeamEvaluationSession(');
    assert.ok(restamp > 0 && update > restamp, 'the readings must move first so a failure leaves both sides on the old date');
  });
  it('puts the readings back when the session row did not move', () => {
    assert.match(src, /if \(!session\) \{[\s\S]{0,400}restampRepSessionMeasurables\(sessionId, teamId, previousDate\)/);
  });
  it('the session is found INSIDE the working season — a finished season’s session is not addressable here', () => {
    assert.match(src, /getRepTeamEvaluationSession\(sessionId, teamId, programYear\.id\)/);
  });
});
