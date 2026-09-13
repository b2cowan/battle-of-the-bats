import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  readMeasurableInput, readMeasurableCorrectionInput, readSessionCreateInput, readSessionPatchInput,
  readNotAssessedInput, readObservationInput, readGoalReviewInput, readGoalPatchInput, readGoalExtrasInput,
} from '../../lib/development-input.ts';
import {
  groupBySession, latestSessionResult, sessionHeadline, describeHeadline, describeAttempts, headlineLabel, headlineMethod, type AttemptReading,
} from '../../lib/measurable-series.ts';
import {
  sessionRows, sessionScopeCounts, rowState, scopeSentence, orderEventsByAnchor,
} from '../../lib/development-session-view.ts';
import { originSentence, goalTimeline } from '../../lib/development-goal-history.ts';
import type { RepDevelopmentGoalReview, RepPlayerObservation } from '../../lib/types.ts';

/**
 * Development lifecycle Phase 2 — record and review both kinds (plan §7 recording contracts, §9
 * corrections, §16 rulings: every attempt is recorded; the range aim; F08 reviews are events; F19
 * status required, never prose; "Not assessed" is a state, never a value; ⚠ rows are never people).
 */

const lower = { aim: 'lower' as const, headline: 'best' as const, rangeFrom: null, rangeTo: null };
const range = { aim: 'range' as const, headline: 'in_range' as const, rangeFrom: 62, rangeTo: 68 };

// ── the readers ──────────────────────────────────────────────────────────────────────────────────
describe('readMeasurableInput — an attempt number rides a session reading', () => {
  it('defaults to attempt 1 and accepts 1..5 with a session', () => {
    const r1 = readMeasurableInput({ measurableTypeId: 't', value: 8.1, recordedOn: '2026-09-08', sessionId: 's' });
    assert.ok('fields' in r1 && r1.fields.attemptNo === 1);
    const r3 = readMeasurableInput({ measurableTypeId: 't', value: 8.1, recordedOn: '2026-09-08', sessionId: 's', attemptNo: 3 });
    assert.ok('fields' in r3 && r3.fields.attemptNo === 3);
  });
  it('refuses 0, 6, a fraction and a string — a blank attempt was not run, never attempt 0', () => {
    for (const bad of [0, 6, 1.5, '2']) {
      assert.ok('error' in readMeasurableInput({ measurableTypeId: 't', value: 8.1, recordedOn: '2026-09-08', sessionId: 's', attemptNo: bad }));
    }
  });
  it('a single reading (no session) is always attempt 1 — a second attempt needs a session to belong to', () => {
    assert.ok('error' in readMeasurableInput({ measurableTypeId: 't', value: 8.1, recordedOn: '2026-09-08', attemptNo: 2 }));
    const r = readMeasurableInput({ measurableTypeId: 't', value: 8.1, recordedOn: '2026-09-08', attemptNo: 1 });
    assert.ok('fields' in r && r.fields.attemptNo === 1 && r.fields.sessionId === null);
  });
});

describe('readMeasurableCorrectionInput — only the value (and the note) can be corrected', () => {
  it('takes a number in range and an optional note', () => {
    const r = readMeasurableCorrectionInput({ value: 8.05, note: ' re-timed ' });
    assert.deepEqual('fields' in r && r.fields, { value: 8.05, note: 're-timed' });
  });
  it('refuses a blank, a string and a value out of range — a correction is never a fabricated zero', () => {
    assert.ok('error' in readMeasurableCorrectionInput({}));
    assert.ok('error' in readMeasurableCorrectionInput({ value: '8' }));
    assert.ok('error' in readMeasurableCorrectionInput({ value: -1 }));
  });
});

describe('readSessionCreateInput — Start session asks for the scope first', () => {
  it('a date alone still creates a session (no scope — counts run against the roster)', () => {
    const r = readSessionCreateInput({ sessionDate: '2026-09-11' });
    assert.ok('fields' in r && r.fields.scope === null && r.fields.eventId === null);
  });
  it('a scope is both lists — at least one metric and one player', () => {
    const r = readSessionCreateInput({ sessionDate: '2026-09-11', note: 'Autumn', eventId: 'ev', scope: { metricIds: ['m1', 'm2'], playerIds: ['p1'] } });
    assert.ok('fields' in r);
    assert.deepEqual(r.fields.scope, { metricIds: ['m1', 'm2'], playerIds: ['p1'] });
    assert.equal(r.fields.eventId, 'ev');
    assert.ok('error' in readSessionCreateInput({ sessionDate: '2026-09-11', scope: { metricIds: [], playerIds: ['p1'] } }));
    assert.ok('error' in readSessionCreateInput({ sessionDate: '2026-09-11', scope: { metricIds: ['m1'], playerIds: [] } }));
    assert.ok('error' in readSessionCreateInput({ sessionDate: '2026-09-11', scope: { metricIds: ['m1'] } }));
  });
  it('dedupes ids and refuses a non-id', () => {
    const r = readSessionCreateInput({ sessionDate: '2026-09-11', scope: { metricIds: ['m1', 'm1'], playerIds: ['p1'] } });
    assert.ok('fields' in r && r.fields.scope?.metricIds.length === 1);
    assert.ok('error' in readSessionCreateInput({ sessionDate: '2026-09-11', scope: { metricIds: [42], playerIds: ['p1'] } }));
  });
  it('the patch reader accepts a whole scope ("Change scope") and nothing else about it', () => {
    const r = readSessionPatchInput({ scope: { metricIds: ['m1'], playerIds: ['p1', 'p2'] } });
    assert.ok('fields' in r && r.fields.scope?.playerIds.length === 2);
    assert.ok('error' in readSessionPatchInput({ scope: { metricIds: ['m1'] } }));
  });
});

describe('readNotAssessedInput — a state with a neutral reason, never a value', () => {
  it('names the player and the metric; the reason is optional and short', () => {
    const r = readNotAssessedInput({ playerId: 'p', measurableTypeId: 'm', reason: ' absent ' });
    assert.deepEqual('fields' in r && r.fields, { playerId: 'p', measurableTypeId: 'm', reason: 'absent' });
    assert.ok('fields' in readNotAssessedInput({ playerId: 'p', measurableTypeId: 'm' }));
    assert.ok('error' in readNotAssessedInput({ measurableTypeId: 'm' }));
    assert.ok('error' in readNotAssessedInput({ playerId: 'p', measurableTypeId: 'm', reason: 'x'.repeat(121) }));
  });
});

describe('readObservationInput — what was seen, in a stated setting', () => {
  it('create: a skill, a date, and a note OR a descriptor (at least one)', () => {
    const r = readObservationInput({ measurableTypeId: 'skill', observedOn: '2026-09-08', descriptor: 'With a reminder' }, 'create');
    assert.ok('fields' in r && r.fields.note === null && r.fields.descriptor === 'With a reminder');
    const r2 = readObservationInput({ measurableTypeId: 'skill', observedOn: '2026-09-08', note: 'Settled feet after one cue.', goalId: 'g', sessionId: 's' }, 'create');
    assert.ok('fields' in r2 && r2.fields.goalId === 'g' && r2.fields.sessionId === 's');
    assert.ok('error' in readObservationInput({ measurableTypeId: 'skill', observedOn: '2026-09-08' }, 'create'));
    assert.ok('error' in readObservationInput({ measurableTypeId: 'skill', observedOn: '2026-09-08', note: '   ' }, 'create'));
    assert.ok('error' in readObservationInput({ observedOn: '2026-09-08', note: 'x' }, 'create'));
    assert.ok('error' in readObservationInput({ measurableTypeId: 'skill', observedOn: '9-8', note: 'x' }, 'create'));
  });
  it('patch: any subset, never the skill, never nothing', () => {
    const r = readObservationInput({ note: 'Better.' }, 'patch');
    assert.ok('fields' in r && r.fields.note === 'Better.');
    assert.ok('error' in readObservationInput({}, 'patch'));
    assert.ok('error' in readObservationInput({ measurableTypeId: 'other' }, 'patch'));
    const clear = readObservationInput({ goalId: null }, 'patch');
    assert.ok('fields' in clear && clear.fields.goalId === null);
  });
});

describe('readGoalReviewInput — a status, never prose (F19); a dated event that stands', () => {
  it('status is the required choice; note, next review and evidence are optional', () => {
    const r = readGoalReviewInput({ status: 'achieved', reviewedOn: '2026-09-11' });
    assert.ok('fields' in r);
    assert.equal(r.fields.status, 'achieved');
    assert.equal(r.fields.note, null);
    assert.equal(r.fields.nextReviewOn, null);
    assert.deepEqual(r.fields.evidenceMeasurableIds, []);
    const full = readGoalReviewInput({
      status: 'working', reviewedOn: '2026-09-11', note: ' one cue ', nextReviewOn: '2026-09-22',
      evidenceMeasurableIds: ['r1'], evidenceObservationIds: ['o1', 'o1'],
    });
    assert.ok('fields' in full);
    assert.equal(full.fields.nextReviewOn, '2026-09-22');
    assert.deepEqual(full.fields.evidenceObservationIds, ['o1']);
  });
  it('refuses a missing status, an unknown status, a bad date and a fat-fingered year', () => {
    assert.ok('error' in readGoalReviewInput({ reviewedOn: '2026-09-11' }));
    assert.ok('error' in readGoalReviewInput({ status: 'done', reviewedOn: '2026-09-11' }));
    assert.ok('error' in readGoalReviewInput({ status: 'working', reviewedOn: 'today' }));
    assert.ok('error' in readGoalReviewInput({ status: 'working', reviewedOn: '2026-09-11', nextReviewOn: '0226-09-22' }));
  });
});

describe('the goal gains success and a review date, on add and on edit', () => {
  it('extras: success ≤ 280, review date valid; both optional', () => {
    const r = readGoalExtrasInput({ success: ' sets feet without a cue ', reviewOn: '2026-09-22' });
    assert.deepEqual('fields' in r && r.fields, { success: 'sets feet without a cue', reviewOn: '2026-09-22' });
    const none = readGoalExtrasInput({});
    assert.deepEqual('fields' in none && none.fields, {});
    assert.ok('error' in readGoalExtrasInput({ success: 'x'.repeat(281) }));
    assert.ok('error' in readGoalExtrasInput({ reviewOn: 'next week' }));
  });
  it('the patch reader carries them and clears them with null', () => {
    const r = readGoalPatchInput({ success: null, reviewOn: null });
    assert.deepEqual('fields' in r && r.fields, { success: null, reviewOn: null });
  });
});

// ── the ONE home for the headline: rows per session ──────────────────────────────────────────────
const reading = (id: string, value: number, recordedOn: string, sessionId: string | null, attemptNo = 1, unit = 'seconds'): AttemptReading => ({
  id, value, unit, recordedOn, createdAt: `${recordedOn}T12:00:0${attemptNo}Z`, sessionId, attemptNo,
});

describe('groupBySession — one row per session, every attempt listed, the headline computed', () => {
  it('groups a session\'s attempts (in attempt order), and each single reading is its own row', () => {
    const rows = groupBySession([
      reading('c', 8.2, '2026-09-08', 's2', 3), reading('a', 8.12, '2026-09-08', 's2', 1), reading('b', 8.05, '2026-09-08', 's2', 2),
      reading('x', 8.4, '2026-08-04', null),
      reading('y', 8.31, '2026-08-18', 's1', 1),
    ], lower);
    assert.deepEqual(rows.map(r => [r.sessionId, r.attempts.map(a => a.id), r.headline]), [
      ['s2', ['a', 'b', 'c'], 8.05],
      ['s1', ['y'], 8.31],
      [null, ['x'], 8.4],
    ]);
    assert.equal(rows[0].average, 8.123);
    assert.equal(rows[0].value, 8.05, 'a session row satisfies SeriesReading with its headline as the value, so the line follows the headline');
  });
  it('a range test leads with attempts in range and draws its AVERAGE on the line — never a "best"', () => {
    const [row] = groupBySession([reading('a', 66, '2026-09-08', 's', 1, 'mph'), reading('b', 70, '2026-09-08', 's', 2, 'mph'), reading('c', 64, '2026-09-08', 's', 3, 'mph')], range);
    assert.equal(row.headline, 2);
    assert.equal(row.value, row.average);
    assert.equal(row.readBack, '2 of 3 in range · 66 (in) · 70 (+2) · 64 (in)');
  });
  it('three sprints in one session are ONE row, never three — and the latest result is that row', () => {
    const rows = groupBySession([reading('a', 8.12, '2026-09-08', 's', 1), reading('b', 8.05, '2026-09-08', 's', 2), reading('c', 8.2, '2026-09-08', 's', 3)], lower);
    assert.equal(rows.length, 1);
    const latest = latestSessionResult(rows);
    assert.equal(latest?.headline, 8.05);
    assert.equal(latest?.recordedOn, '2026-09-08');
  });
  it('a legacy reading is attempt 1 of 1 and reads as one attempt', () => {
    const [row] = groupBySession([reading('a', 8.4, '2026-08-04', 's')], lower);
    assert.equal(row.readBack, 'One attempt');
    assert.equal(sessionHeadline([8.4], lower), 8.4);
    assert.equal(describeHeadline([8.4], lower), 'One attempt');
  });
  // /review 2026-09-13: a range test's row read "2 of 3 in range · 2 of 3 in range" — the label
  // and the method were the same sentence glued twice. The method half has ONE home.
  it('the method beside the headline: "best of 3 attempts · avg …" for a test, NOTHING for a range test or one attempt', () => {
    const [sprint] = groupBySession([reading('a', 8.12, '2026-09-08', 's', 1), reading('b', 8.05, '2026-09-08', 's', 2), reading('c', 8.2, '2026-09-08', 's', 3)], lower);
    assert.equal(headlineLabel(sprint, lower), '8.05 seconds');
    assert.equal(headlineMethod(sprint, lower), 'best of 3 attempts · avg 8.123');
    const [band] = groupBySession([reading('a', 66, '2026-09-08', 's', 1, 'mph'), reading('b', 70, '2026-09-08', 's', 2, 'mph'), reading('c', 64, '2026-09-08', 's', 3, 'mph')], range);
    assert.equal(headlineLabel(band, range), '2 of 3 in range');
    assert.equal(headlineMethod(band, range), null, 'the range headline already says how it was read');
    const [one] = groupBySession([reading('a', 8.4, '2026-08-04', 's')], lower);
    assert.equal(headlineMethod(one, lower), null);
  });
});

// ── the session screen: rows, states, counts ─────────────────────────────────────────────────────
const player = (id: string) => ({ id });
const entry = (playerId: string, measurableTypeId: string, id = `${playerId}-${measurableTypeId}`, attemptNo = 1) => ({ id, playerId, measurableTypeId, attemptNo });
const mark = (playerId: string, measurableTypeId: string) => ({ id: `na-${playerId}`, sessionId: 's', playerId, measurableTypeId, reason: null, createdBy: null, createdAt: '' });

describe('sessionRows — one row per player with EVERY attempt, in attempt order', () => {
  it('collects a player\'s attempts and keeps roster order', () => {
    const rows = sessionRows([player('a'), player('b')], [], [entry('a', 'sprint', 'e3', 3), entry('a', 'sprint', 'e1', 1)], 'sprint');
    assert.deepEqual(rows.map(r => [r.player.id, r.entries.map(e => e.id)]), [['a', ['e1', 'e3']], ['b', []]]);
  });
  it('carries the not-assessed mark for this metric on the row', () => {
    const rows = sessionRows([player('a')], [], [], 'sprint', { notAssessed: [mark('a', 'sprint'), mark('a', 'throw')] });
    assert.equal(rows[0].notAssessed?.measurableTypeId, 'sprint');
  });
  it('with a scope: scoped players show; an unscoped player shows only if something was recorded for them, flagged', () => {
    const rows = sessionRows([player('a'), player('b'), player('c')], [], [entry('c', 'sprint')], 'sprint', { scopePlayerIds: ['a'] });
    assert.deepEqual(rows.map(r => [r.player.id, r.inScope]), [['a', true], ['c', false]]);
  });
});

describe('sessionScopeCounts — never a zero invented, never rows counted as people', () => {
  it('no scope: "N of M entered" against the active roster (Phase 0)', () => {
    const rows = sessionRows([player('a'), player('b'), player('c')], [player('gone')], [entry('a', 'sprint', 'e1', 1), entry('a', 'sprint', 'e2', 2), entry('gone', 'sprint')], 'sprint');
    const c = sessionScopeCounts(rows, null);
    assert.deepEqual(c, { scoped: false, recorded: 1, notAssessed: 0, notRecorded: 2, total: 3 });
    assert.equal(scopeSentence(c), '1 of 3 entered');
  });
  it('a scoped session counts recorded · not assessed · not recorded of those in scope', () => {
    const rows = sessionRows([player('a'), player('b'), player('c'), player('d')], [], [entry('a', 'sprint', 'e1', 1), entry('a', 'sprint', 'e2', 2), entry('d', 'sprint')], 'sprint',
      { scopePlayerIds: ['a', 'b', 'c'], notAssessed: [mark('b', 'sprint')] });
    const c = sessionScopeCounts(rows, ['a', 'b', 'c']);
    assert.deepEqual(c, { scoped: true, recorded: 1, notAssessed: 1, notRecorded: 1, total: 3 });
    assert.equal(scopeSentence(c), '1 recorded · 1 not assessed · 1 not recorded — of 3 in scope');
  });
  it('the live read-back under the fields says how many of the expected attempts were run', () => {
    assert.equal(describeAttempts([8.5], lower, 2), '8.5 · 1 of 2 run');
    assert.equal(describeAttempts([66], range, 3), '66 (in) · 1 of 3 run');
    assert.equal(describeAttempts([8.5, 8.4], lower, 3), 'Best of 2 attempts · 8.5 · 8.4 · average 8.45 · 2 of 3 run');
    assert.equal(describeAttempts([8.5, 8.4], lower, 2), 'Best of 2 attempts · 8.5 · 8.4 · average 8.45');
    assert.equal(describeAttempts([8.4], lower, 1), 'One attempt');
  });
  it('"Taken at" options: practices first, then nearest the chosen date — one rule for the picker and the scope step', () => {
    const ordered = orderEventsByAnchor([
      { id: 'g', eventType: 'league_game', startsAt: '2026-09-09T22:00:00Z' },
      { id: 'p2', eventType: 'practice', startsAt: '2026-09-20T22:00:00Z' },
      { id: 'p1', eventType: 'practice', startsAt: '2026-09-10T22:00:00Z' },
    ], '2026-09-11');
    assert.deepEqual(ordered.map(e => e.id), ['p1', 'p2', 'g']);
  });
});

describe('rowState — Saved · Saving · Not saved — retry · Not recorded · Not assessed', () => {
  it('derives one state per row, in priority order', () => {
    assert.equal(rowState({ hasEntries: false, notAssessed: false, saving: false, error: false }), 'not_recorded');
    assert.equal(rowState({ hasEntries: false, notAssessed: true, saving: false, error: false }), 'not_assessed');
    assert.equal(rowState({ hasEntries: true, notAssessed: false, saving: false, error: false }), 'saved');
    assert.equal(rowState({ hasEntries: true, notAssessed: false, saving: true, error: false }), 'saving');
    assert.equal(rowState({ hasEntries: true, notAssessed: false, saving: false, error: true }), 'error', 'a failed value survives on screen beside its error');
  });
});

// ── the goal's history: dated events, never overwritten ──────────────────────────────────────────
describe('goalTimeline — set → observed → reviewed, dated, with an author; origin only when recorded', () => {
  const review = (id: string, reviewedOn: string, status: 'working' | 'achieved' | 'parked', note: string | null = null): RepDevelopmentGoalReview => ({
    id, goalId: 'g', playerId: 'p', reviewedOn, status, note, nextReviewOn: null,
    evidenceMeasurableIds: [], evidenceObservationIds: [], createdBy: 'u2', createdAt: `${reviewedOn}T10:00:00Z`,
  });
  const obs = (id: string, observedOn: string, goalId: string | null): RepPlayerObservation => ({
    id, orgId: 'o', teamId: 't', playerId: 'p', measurableTypeId: 'skill', observedOn, note: 'One cue was enough.', descriptor: 'With a reminder',
    goalId, sessionId: null, createdBy: 'u1', createdAt: `${observedOn}T10:00:00Z`, updatedAt: `${observedOn}T10:00:00Z`,
  });
  it('names the origin only from the record — a legacy goal has no origin line', () => {
    assert.equal(originSentence('coach'), 'Set with the player');
    assert.equal(originSentence('carried'), 'Carried from a previous season');
    assert.equal(originSentence('tryout'), 'Seeded from the tryout');
    assert.equal(originSentence(null), null);
  });
  it('lists the set event, the linked observations and every review, newest first, nothing overwritten', () => {
    const goal = { id: 'g', createdAt: '2026-08-18T10:00:00Z', createdBy: 'u1', origin: 'coach' as const };
    const events = goalTimeline(goal, [review('r2', '2026-09-11', 'achieved'), review('r1', '2026-08-25', 'working', 'One cue.')], [obs('o1', '2026-09-08', 'g'), obs('o2', '2026-09-09', null)]);
    assert.deepEqual(events.map(e => [e.kind, e.on, e.by]), [
      ['review', '2026-09-11', 'u2'], ['observation', '2026-09-08', 'u1'], ['review', '2026-08-25', 'u2'], ['set', '2026-08-18', 'u1'],
    ]);
    assert.equal(events.find(e => e.kind === 'review' && e.on === '2026-09-11')?.title, 'Reviewed · Achieved');
    assert.equal(events.find(e => e.kind === 'set')?.title, 'Set with the player');
  });
});

// ── the source guards ────────────────────────────────────────────────────────────────────────────
describe('the surfaces read through the one home', () => {
  const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');
  it('the session screen, the profile section, the board and the PDF path all call groupBySession — no second attempt reader', () => {
    const section = read('components', 'coaches', 'PlayerDevelopmentSection.tsx');
    assert.match(section, /groupBySession\(/);
    const board = read('app', 'api', 'coaches', '[orgSlug]', 'teams', '[teamId]', 'development', 'board', 'route.ts');
    assert.match(board, /latestSessionResult\(|groupBySession\(/, 'the Players view\'s latest-per-test is the HEADLINE of the latest session, not the last row');
    const session = read('app', '[orgSlug]', 'coaches', 'teams', '[teamId]', 'development', 'sessions', '[sessionId]', 'page.tsx');
    assert.match(session, /sessionScopeCounts\(/);
    const grid = read('components', 'coaches', 'SessionRecordGrid.tsx');
    assert.match(grid, /rowState\(/, 'the per-row state machine has ONE home — the grid reads it, never re-derives it');
    assert.doesNotMatch(session, /['"]not_recorded['"]|['"]not_assessed['"]/, 'the page never spells a row state itself');
    assert.doesNotMatch(section, /Log a measurable/, 'F20 — the profile says "Record a result"');
    assert.match(read('lib', 'marketing-shots.ts'), /Record a result/, 'the marketing-shot harness follows the label in the same commit');
  });
});
