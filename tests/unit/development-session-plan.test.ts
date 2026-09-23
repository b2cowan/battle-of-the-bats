import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readSessionPatchInput, readSessionCreateInput, MAX_ATTEMPTS } from '../../lib/development-input.ts';
import { describeAttempts } from '../../lib/measurable-series.ts';
import { recordMeaning } from '../../lib/measurable-definition.ts';
import {
  sessionRows, sessionScopeCounts, chipProgress, chipProgressByType, accountedCellKeys, scopeCompleteness, sessionState, plannedAttempts, attemptBoxes,
  lastPlannedCounts, lastPlanMetricIds, lastRunDates, scopeSummary, sessionReview, sessionMetricChips, defaultSessionChip, sessionTitle,
} from '../../lib/development-session-view.ts';
import type { RepTeamMeasurableType } from '../../lib/types.ts';

/**
 * Development lifecycle re-evaluation — stage 2 · Session (owner rulings C1–C10, 2026-09-15):
 * attempts are planned on the SESSION per test (C1), the plan is a floor never a ceiling (C2), the
 * chips are the scope (C3), the list's state is derived (C5), one counting rule for the grid's
 * foot, the review, the list and the Overview (C8 housekeeping — the live skill defect), a partial
 * row is a result and a dropped test keeps its results by default (C9), a session at a practice
 * takes the practice's date (C10); the plan is a list you BUILD — tonight starts as last time, and
 * the add field's captions say when each metric last ran (C11, raised on the built sheet).
 */

const P = (id: string) => ({ id });
const T = (id: string, over: Partial<RepTeamMeasurableType> = {}): RepTeamMeasurableType => ({
  id, orgId: 'o', teamId: 't', name: id, kind: 'test', unit: 'seconds', aim: 'lower', rangeFrom: null, rangeTo: null,
  method: null, attemptsPerSession: 1, headline: 'best', descriptors: [], sortOrder: 0, isActive: true,
  createdBy: null, createdAt: '', updatedAt: '', ...over,
});
const E = (playerId: string, measurableTypeId: string, attemptNo = 1) => ({ id: `${playerId}-${measurableTypeId}-${attemptNo}`, playerId, measurableTypeId, attemptNo });
const M = (playerId: string, measurableTypeId: string, reason: string | null = null) => ({ id: `na-${playerId}-${measurableTypeId}`, sessionId: 's', playerId, measurableTypeId, reason, createdBy: null, createdAt: '' });
const O = (playerId: string, measurableTypeId: string) => ({ playerId, measurableTypeId });
const lower = { aim: 'lower' as const, headline: 'best' as const, rangeFrom: null, rangeTo: null };

// ── the ONE counting rule ────────────────────────────────────────────────────────────────────────
describe('one counting rule — a result OR an observation is a record; not assessed is accounted for; nothing is nothing', () => {
  const roster = [P('avery'), P('blake'), P('casey'), P('devon'), P('emerson')];
  const scope = { scopeMetricIds: ['sprint', 'feet'], scopePlayerIds: ['avery', 'blake', 'casey', 'devon'] };
  const entries = [E('devon', 'sprint', 1), E('devon', 'sprint', 2), E('avery', 'sprint'), E('emerson', 'sprint')];
  const marks = [M('casey', 'sprint', 'absent')];
  const observations = [O('devon', 'feet')];

  it("a skill's observation is a recorded row on the grid — the foot no longer says 0 while the review says 1", () => {
    const rows = sessionRows(roster, [], entries, 'feet', { scopePlayerIds: scope.scopePlayerIds, notAssessed: marks, observations });
    const c = sessionScopeCounts(rows, scope.scopePlayerIds);
    assert.deepEqual(c, { scoped: true, recorded: 1, notAssessed: 0, notRecorded: 3, total: 4 });
    assert.equal(rows.find(r => r.player.id === 'devon')?.recorded, true);
  });
  it('the sessions reader counts by the SAME rule: an in-scope cell holding a result, a mark or an observation is accounted for', () => {
    const accounted = accountedCellKeys(entries, marks, observations);
    const done = scopeCompleteness(scope, accounted, new Set(roster.map(p => p.id)));
    // sprint: devon, avery recorded; casey marked; blake nothing → 1. feet: devon observed; 3 nothing → 3.
    assert.deepEqual(done, { unrecorded: 4, total: 8 });
    // The grid's per-metric counts add up to the same 4.
    const sprint = sessionScopeCounts(sessionRows(roster, [], entries, 'sprint', { scopePlayerIds: scope.scopePlayerIds, notAssessed: marks, observations }), scope.scopePlayerIds);
    const feet = sessionScopeCounts(sessionRows(roster, [], entries, 'feet', { scopePlayerIds: scope.scopePlayerIds, notAssessed: marks, observations }), scope.scopePlayerIds);
    assert.equal(sprint.notRecorded + feet.notRecorded, done!.unrecorded);
  });
  it('a scoped player who has since left the active roster is listed but never counted', () => {
    const done = scopeCompleteness(scope, accountedCellKeys(entries, marks, observations), new Set(['avery', 'blake', 'casey']));
    // sprint: blake nothing → 1; feet: avery, blake, casey nothing → 3. Devon's cells are not counted.
    assert.deepEqual(done, { unrecorded: 4, total: 6 });
  });
  it('no scope → nothing to count against', () => {
    assert.equal(scopeCompleteness({ scopeMetricIds: null, scopePlayerIds: null }, new Set(), new Set()), null);
  });
  it("a chip's done-count is recorded + not assessed of those counted (C3) — 'sprint · 3 of 4'", () => {
    const rows = sessionRows(roster, [], entries, 'sprint', { scopePlayerIds: scope.scopePlayerIds, notAssessed: marks, observations });
    assert.deepEqual(chipProgress(sessionScopeCounts(rows, scope.scopePlayerIds)), { done: 3, total: 4 });
    // The one-pass version the page draws every chip from agrees with the per-metric rows, planned or not.
    const byType = chipProgressByType(scope, ['sprint', 'feet'], roster, entries, marks, observations);
    assert.deepEqual(byType.get('sprint'), { done: 3, total: 4 });
    assert.deepEqual(byType.get('feet'), { done: 1, total: 4 });
    const legacy = chipProgressByType({ scopePlayerIds: null }, ['sprint'], roster, entries, marks, observations);
    const legacyRows = sessionRows(roster, [], entries, 'sprint', { notAssessed: marks, observations });
    assert.deepEqual(legacy.get('sprint'), { done: sessionScopeCounts(legacyRows, null).recorded, total: 5 }, 'no plan: recorded of the roster — a mark is not an entry');
  });
  it("the list's state is derived from the reader's counts (C5): unfinished while a cell holds nothing", () => {
    assert.equal(sessionState({ unrecordedCount: 4, scopeCellCount: 8 }), 'unfinished');
    assert.equal(sessionState({ unrecordedCount: 0, scopeCellCount: 8 }), 'complete');
    assert.equal(sessionState({ unrecordedCount: null, scopeCellCount: null }), null);
  });
  it('a one-attempt row of a two-attempt plan is RECORDED, never unfinished (C9)', () => {
    const rows = sessionRows([P('avery')], [], [E('avery', 'sprint', 1)], 'sprint', { scopePlayerIds: ['avery'] });
    assert.equal(sessionScopeCounts(rows, ['avery']).recorded, 1);
  });
});

// ── the count per test (C1) and the "+" (C2) ─────────────────────────────────────────────────────
describe('attempts are planned on the session, per test — a floor, never a ceiling', () => {
  it('plannedAttempts reads the session map; null on a pre-count session or an unplanned test', () => {
    assert.equal(plannedAttempts({ scopeAttempts: { sprint: 2 } }, 'sprint'), 2);
    assert.equal(plannedAttempts({ scopeAttempts: { sprint: 2 } }, 'throw'), null);
    assert.equal(plannedAttempts({ scopeAttempts: null }, 'sprint'), null);
    assert.equal(plannedAttempts({ scopeAttempts: { sprint: 9 } }, 'sprint'), MAX_ATTEMPTS, 'never more than the reader allows');
  });
  it('the boxes: the plan, never fewer than saved, plus the "+" — capped at five', () => {
    assert.deepEqual(attemptBoxes({ planned: 2, savedMax: 0, extra: 0 }), { boxes: 2, canAddMore: true });
    assert.deepEqual(attemptBoxes({ planned: 2, savedMax: 0, extra: 1 }), { boxes: 3, canAddMore: true }, 'Devon ran a third');
    assert.deepEqual(attemptBoxes({ planned: 1, savedMax: 3, extra: 0 }), { boxes: 3, canAddMore: true }, 'a lowered plan never hides a saved attempt');
    assert.deepEqual(attemptBoxes({ planned: 2, savedMax: 0, extra: 9 }), { boxes: 5, canAddMore: false }, 'five is the most any row takes');
    assert.deepEqual(attemptBoxes({ planned: null, savedMax: 0, extra: 0 }), { boxes: 1, canAddMore: true }, 'a pre-count session claims what was recorded — one box to start');
    assert.deepEqual(attemptBoxes({ planned: null, savedMax: 2, extra: 0 }), { boxes: 2, canAddMore: true });
  });
  it('the live read-back reads the SESSION\'s plan — and claims nothing on a pre-count session', () => {
    assert.equal(describeAttempts([8.5], lower, 2), '8.5 · 1 of 2 run');
    assert.equal(describeAttempts([8.5], lower, null), '8.5', 'no "of N run" without a plan');
    assert.equal(describeAttempts([8.5, 8.4], lower, null), 'Best of 2 attempts · 8.5 · 8.4 · average 8.45');
    assert.equal(describeAttempts([8.5, 8.4, 8.3], lower, 2), 'Best of 3 attempts · 8.5 · 8.4 · 8.3 · average 8.4', 'more than planned is never "over"');
  });
  it('the pre-fill: last time\'s count, else the definition\'s stored count, else one; a skill has none', () => {
    const types = [T('sprint', { attemptsPerSession: 2 }), T('throw', { attemptsPerSession: 4 }), T('new'), T('feet', { kind: 'skill', unit: null })];
    const sessions: { scopeAttempts: Record<string, number> | null }[] = [{ scopeAttempts: { sprint: 3 } }, { scopeAttempts: { sprint: 2, throw: 1 } }]; // newest first
    assert.deepEqual(lastPlannedCounts(sessions, types), { sprint: 3, throw: 1, new: 1 });
    assert.deepEqual(lastPlannedCounts([], types), { sprint: 2, throw: 4, new: 1 });
  });
  it('tonight starts as last time (C11): the newest stated plan, minus what has since retired; the whole library (null) with nothing to copy', () => {
    const offered = [T('sprint'), T('throw'), T('feet', { kind: 'skill', unit: null })];
    const S = (ids: string[] | null) => ({ scopeMetricIds: ids });
    assert.deepEqual(lastPlanMetricIds([S(['sprint', 'feet']), S(['throw'])], offered), ['sprint', 'feet'], 'the newest plan, in its own order');
    assert.deepEqual(lastPlanMetricIds([S(null), S(['throw', 'gone'])], offered), ['throw'], 'a pre-plan session is skipped; a retired test cannot be on tonight\'s plan');
    assert.equal(lastPlanMetricIds([S(null)], offered), null, 'no plan ever stated → the whole library');
    assert.equal(lastPlanMetricIds([S(['gone'])], offered), null, 'a last plan made only of retired tests says nothing usable → the whole library');
    assert.equal(lastPlanMetricIds([], offered), null);
  });
  it('the add field\'s captions (C11): the date a metric was last on a plan, null for never', () => {
    const types = [T('sprint'), T('throw'), T('bat')];
    const sessions = [
      { sessionDate: '2026-08-26', scopeMetricIds: ['sprint'] },
      { sessionDate: '2026-06-10', scopeMetricIds: ['sprint', 'throw'] },
      { sessionDate: '2026-05-06', scopeMetricIds: null }, // before plans existed — states nothing
    ];
    assert.deepEqual(lastRunDates(sessions, types), { sprint: '2026-08-26', throw: '2026-06-10', bat: null });
    assert.deepEqual(lastRunDates([], types), { sprint: null, throw: null, bat: null });
  });
  it('the definition no longer decides how many attempts — its meaning line says the headline only when it is not the aim\'s default', () => {
    assert.equal(recordMeaning(T('sprint', { attemptsPerSession: 1 })), 'lower is the aim');
    assert.equal(recordMeaning(T('sprint', { attemptsPerSession: 3 })), 'lower is the aim');
    assert.equal(recordMeaning(T('sprint', { headline: 'average' })), 'lower is the aim · average of attempts');
    assert.equal(recordMeaning(T('legacy', { aim: 'record', headline: 'last' })), 'record only');
  });
});

// ── the readers: the counts ride the plan; a dropped test's results are kept unless said ────────
describe('the session readers carry the count per test and the keep-or-delete answer', () => {
  const ids = { a: '11111111-1111-4111-8111-111111111111', b: '22222222-2222-4222-8222-222222222222', p: '33333333-3333-4333-8333-333333333333' };
  it('a plan with counts: every key in the plan, every value 1..5', () => {
    const r = readSessionPatchInput({ scope: { metricIds: [ids.a, ids.b], playerIds: [ids.p], attempts: { [ids.a]: 2 } } });
    assert.ok('fields' in r);
    assert.deepEqual(r.fields.scope, { metricIds: [ids.a, ids.b], playerIds: [ids.p], attempts: { [ids.a]: 2 } });
    assert.ok('error' in readSessionPatchInput({ scope: { metricIds: [ids.a], playerIds: [ids.p], attempts: { [ids.b]: 2 } } }), 'a count for a test not in the plan');
    assert.ok('error' in readSessionPatchInput({ scope: { metricIds: [ids.a], playerIds: [ids.p], attempts: { [ids.a]: 6 } } }), 'six');
    assert.ok('error' in readSessionPatchInput({ scope: { metricIds: [ids.a], playerIds: [ids.p], attempts: { [ids.a]: 0 } } }), 'zero');
    assert.ok('error' in readSessionPatchInput({ scope: { metricIds: [ids.a], playerIds: [ids.p], attempts: [2] } }), 'a list is not a map');
    // A plan of skills alone sends an empty map — stored as null, one meaning for "no count claimed".
    const skillsOnly = readSessionPatchInput({ scope: { metricIds: [ids.a], playerIds: [ids.p], attempts: {} } });
    assert.ok('fields' in skillsOnly && skillsOnly.fields.scope?.attempts === null, 'an empty count map reads as null');
  });
  it('no counts = no count claimed (a pre-count client, a pre-count session)', () => {
    const r = readSessionCreateInput({ sessionDate: '2026-06-10', scope: { metricIds: [ids.a], playerIds: [ids.p] } });
    assert.ok('fields' in r);
    assert.equal(r.fields.scope?.attempts, null);
  });
  it('dropResultsFor rides a plan change, names only tests OUTSIDE the new plan, and is refused alone', () => {
    const ok = readSessionPatchInput({ scope: { metricIds: [ids.a], playerIds: [ids.p] }, dropResultsFor: [ids.b] });
    assert.ok('fields' in ok && ok.fields.dropResultsFor?.length === 1);
    assert.ok('error' in readSessionPatchInput({ scope: { metricIds: [ids.a], playerIds: [ids.p] }, dropResultsFor: [ids.a] }), 'still in the plan');
    assert.ok('error' in readSessionPatchInput({ dropResultsFor: [ids.b] }), 'without a plan change');
  });
});

// ── the plan's sentence, the title, the chips ───────────────────────────────────────────────────
describe('one builder for the plan\'s sentence, one for the session\'s name, and the chips as the scope', () => {
  const types = [T('sprint'), T('throw'), T('feet', { kind: 'skill', unit: null })];
  it('"5 players · 2 tests · 1 skill" — one word per kind; null with no plan', () => {
    assert.equal(scopeSummary({ scopeMetricIds: ['sprint', 'throw', 'feet'], scopePlayerIds: ['1', '2', '3', '4', '5'] }, types), '5 players · 2 tests · 1 skill');
    assert.equal(scopeSummary({ scopeMetricIds: ['sprint'], scopePlayerIds: ['1'] }, types), '1 player · 1 test');
    assert.equal(scopeSummary({ scopeMetricIds: ['feet'], scopePlayerIds: ['1', '2'] }, types), '2 players · 1 skill');
    assert.equal(scopeSummary({ scopeMetricIds: null, scopePlayerIds: null }, types), null);
  });
  it('the title is the list row\'s text', () => {
    assert.match(sessionTitle({ sessionDate: '2026-06-10', note: 'Phase 2 probe' }), /Jun.*10.*— Phase 2 probe$/);
    assert.doesNotMatch(sessionTitle({ sessionDate: '2026-06-10', note: null }), /—/);
  });
  it('the chips are the scope, then what was recorded outside it (flagged), then the retired with rows', () => {
    const lib = [T('sprint', { sortOrder: 0 }), T('throw', { sortOrder: 1 }), T('old', { sortOrder: 2, isActive: false }), T('feet', { sortOrder: 3, kind: 'skill', unit: null })];
    const chips = sessionMetricChips(lib, [E('x', 'throw'), E('x', 'old')], [], ['sprint', 'feet']);
    assert.deepEqual(chips.map(c => [c.type.id, c.outsideScope, c.retired]), [['sprint', false, false], ['feet', false, false], ['throw', true, false], ['old', false, true]]);
    assert.equal(defaultSessionChip(chips, true)?.type.id, 'sprint', 'a session with a plan opens on its plan');
    assert.equal(defaultSessionChip(chips, false)?.type.id, 'throw', 'a session with no plan opens on its own work');
    // No plan: every active chip, as before.
    assert.deepEqual(sessionMetricChips(lib, [], [], null).map(c => c.type.id), ['sprint', 'throw', 'feet']);
  });
});

// ── the review (C8, C9): names, not counts ──────────────────────────────────────────────────────
describe('sessionReview — a row per test with the counts and the NAMES', () => {
  const roster = [P('avery'), P('blake'), P('casey'), P('devon'), P('emerson'), P('frankie')];
  const types = [T('sprint', { sortOrder: 0 }), T('throw', { sortOrder: 1 }), T('feet', { sortOrder: 2, kind: 'skill', unit: null }), T('old', { sortOrder: 3, isActive: false })];
  const session = { scopeMetricIds: ['sprint', 'throw', 'feet'], scopePlayerIds: ['avery', 'blake', 'casey', 'devon', 'frankie'], scopeAttempts: { sprint: 2, throw: 1 } };
  const entries = [E('devon', 'sprint', 1), E('devon', 'sprint', 2), E('devon', 'sprint', 3), E('avery', 'sprint', 1), E('emerson', 'sprint', 1), E('devon', 'old', 1)];
  const review = sessionReview({
    session, types, roster, pastParticipants: [], entries, notAssessed: [M('casey', 'sprint', 'absent')], observations: [O('devon', 'feet')],
    name: p => p.id[0].toUpperCase() + p.id.slice(1),
  });
  it('the sprint: 2 recorded · 1 not assessed · 2 not recorded, and the names with their reasons', () => {
    const r = review.find(x => x.type.id === 'sprint')!;
    assert.deepEqual([r.counts.recorded, r.counts.notAssessed, r.counts.notRecorded], [2, 1, 2]);
    /* The two actionable lists carry the player id the review's mark is written against, so they
       are compared by their rendered LABEL; "fewer" is a glance and stays plain strings. */
    assert.deepEqual(r.names.notRecorded, [{ id: 'blake', label: 'Blake' }, { id: 'frankie', label: 'Frankie' }]);
    assert.deepEqual(r.names.notAssessed, [{ id: 'casey', label: 'Casey — absent' }]);
    assert.deepEqual(r.names.fewer, ['Avery (1 of 2)']);
    assert.equal(r.droppable, false);
  });
  it('a test with nothing recorded is droppable (C9); a skill counts its observation; a retired test says so', () => {
    const t = review.find(x => x.type.id === 'throw')!;
    assert.equal(t.droppable, true);
    assert.deepEqual(t.names.notRecorded.map(p => p.label), ['Avery', 'Blake', 'Casey', 'Devon', 'Frankie']);
    assert.ok(t.names.notRecorded.every(p => !!p.id), 'the review names carry the id the mark is written against');
    assert.deepEqual(t.names.fewer, [], 'a one-attempt plan never reports fewer');
    const f = review.find(x => x.type.id === 'feet')!;
    assert.equal(f.counts.recorded, 1);
    const o = review.find(x => x.type.id === 'old')!;
    assert.equal(o.retired, true);
  });
  it('more than planned is never reported; a pre-count session reports no "fewer than planned"', () => {
    const d = review.find(x => x.type.id === 'sprint')!;
    assert.ok(!d.names.fewer.some(n => n.startsWith('Devon')));
    const pre = sessionReview({ session: { ...session, scopeAttempts: null }, types, roster, pastParticipants: [], entries, notAssessed: [], observations: [], name: p => p.id });
    assert.deepEqual(pre.find(x => x.type.id === 'sprint')!.names.fewer, []);
  });
});
