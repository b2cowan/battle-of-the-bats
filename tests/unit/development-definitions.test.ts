import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isMeasuredTest, headlineOptionsFor, defaultHeadlineFor, recordMeaning, aimSentence, definitionChange,
  previewChange, KIND_LABELS, AIM_LABELS, HEADLINE_LABELS,
} from '../../lib/measurable-definition.ts';
import { sessionHeadline, attemptAgainstRange, describeHeadline } from '../../lib/measurable-series.ts';
import { readMeasurableTypeInput, applyDefinitionPatch, RETIRED_EDIT_MESSAGE } from '../../lib/development-input.ts';
import type { RepTeamMeasurableType } from '../../lib/types.ts';

/**
 * Development lifecycle Phase 1 — a metric is DEFINED once (plan §7; owner rulings §16: every
 * attempt is recorded, the range aim is kept, "Metrics"; ruling 3: rename keeps the series, a unit
 * or method change on a test with readings starts a successor). These pin the definition's
 * contracts before any screen draws them.
 */

const base: RepTeamMeasurableType = {
  id: 't1', orgId: 'o', teamId: 'tm', name: '60-yd sprint', kind: 'test', unit: 'seconds',
  aim: 'lower', rangeFrom: null, rangeTo: null, method: 'Standing start, same course.',
  attemptsPerSession: 3, headline: 'best', descriptors: [], replacedById: null,
  sortOrder: 0, isActive: true, createdBy: null, createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
};
const def = (over: Partial<RepTeamMeasurableType>): RepTeamMeasurableType => ({ ...base, ...over });

describe('the vocabulary — one word per kind, aim and headline', () => {
  it('names every value exactly once', () => {
    assert.deepEqual(Object.keys(KIND_LABELS).sort(), ['skill', 'test']);
    assert.deepEqual(Object.keys(AIM_LABELS).sort(), ['higher', 'lower', 'range', 'record']);
    assert.deepEqual(Object.keys(HEADLINE_LABELS).sort(), ['average', 'best', 'in_range', 'last']);
    // One word per kind (re-evaluation stage 1, B1): the adjective's job is done by the sentence beneath the choice.
    assert.equal(KIND_LABELS.test, 'Test');
    assert.equal(KIND_LABELS.skill, 'Skill');
  });

  it('a range test never offers "best"; a directional test never offers "in range"; record-only has no best', () => {
    assert.deepEqual(headlineOptionsFor('range'), ['in_range', 'average', 'last']);
    assert.deepEqual(headlineOptionsFor('lower'), ['best', 'average', 'last']);
    assert.deepEqual(headlineOptionsFor('higher'), ['best', 'average', 'last']);
    assert.deepEqual(headlineOptionsFor('record'), ['average', 'last']);
    assert.equal(defaultHeadlineFor('lower'), 'best');
    assert.equal(defaultHeadlineFor('range'), 'in_range');
    assert.equal(defaultHeadlineFor('record'), 'last');
  });

  it('a measured test is a test WITH a unit; a skill is not', () => {
    assert.equal(isMeasuredTest(base), true);
    assert.equal(isMeasuredTest(def({ kind: 'skill', unit: null, aim: 'record', headline: 'last' })), false);
  });
});

describe('what a record means — the Metrics tab column (the unit is said once, beside the name — stage 1, B3)', () => {
  it('a legacy test says record only — the method is the coach\'s note, never a claim on the row (owner, 2026-09-14)', () => {
    const legacy = def({ aim: 'record', method: null, headline: 'last', attemptsPerSession: 1 });
    assert.equal(recordMeaning(legacy), 'record only');
    assert.equal(recordMeaning(def({ method: null })), 'lower is the aim');
  });
  it('a defined test names its aim and, when its headline is not the aim\'s default, how it is read (the count is the session\'s fact — stage 2, C1); a range test keeps the unit inside the band', () => {
    assert.equal(recordMeaning(base), 'lower is the aim');
    assert.equal(recordMeaning(def({ headline: 'average' })), 'lower is the aim · average of attempts');
    assert.equal(recordMeaning(def({ attemptsPerSession: 1 })), 'lower is the aim');
    assert.equal(recordMeaning(def({ unit: 'mph', aim: 'range', rangeFrom: 62, rangeTo: 68, headline: 'in_range' })), 'aim: 62–68 mph');
    assert.equal(recordMeaning(def({ unit: 'mph', aim: 'range', rangeFrom: 62, rangeTo: 68, headline: 'average' })), 'aim: 62–68 mph · average of attempts');
    assert.equal(aimSentence(def({ unit: 'mph', aim: 'range', rangeFrom: 62, rangeTo: 68, headline: 'in_range' })), 'aim: 62–68 mph');
  });
  it('a skill says what it records and how many descriptors it offers', () => {
    const skill = def({ kind: 'skill', unit: null, aim: 'record', headline: 'last', descriptors: ['With support', 'With a reminder', 'Independently'] });
    assert.equal(recordMeaning(skill), 'what you saw · 3 descriptors');
    assert.equal(recordMeaning(def({ kind: 'skill', unit: null, aim: 'record', headline: 'last' })), 'what you saw');
  });
});

describe('the preview runs the way the aim runs (B4)', () => {
  it('a lower aim falls, a higher aim rises, and the change is the same size either way; a range or record-only aim has no change example', () => {
    assert.deepEqual(previewChange('lower'), { from: 8.4, to: 8.05, delta: 0.35, word: 'lower' });
    assert.deepEqual(previewChange('higher'), { from: 8.05, to: 8.4, delta: 0.35, word: 'higher' });
    assert.equal(previewChange('range'), null);
    assert.equal(previewChange('record'), null);
  });
});

describe('the headline — ONE computation the rows, the preview, the chart and the handout read', () => {
  const lower = { aim: 'lower' as const, headline: 'best' as const, rangeFrom: null, rangeTo: null };
  it('best follows the aim: lowest time, highest speed', () => {
    assert.equal(sessionHeadline([8.12, 8.05, 8.2], lower), 8.05);
    assert.equal(sessionHeadline([48, 51, 50], { ...lower, aim: 'higher' }), 51);
  });
  it('average and last are arithmetic; an empty session has no headline', () => {
    assert.equal(sessionHeadline([8.12, 8.05, 8.2], { ...lower, headline: 'average' }), 8.123);
    assert.equal(sessionHeadline([8.12, 8.05, 8.2], { ...lower, headline: 'last' }), 8.2);
    assert.equal(sessionHeadline([], lower), null);
  });
  it('a range test counts attempts in the band, and each attempt reads in / +n / −n', () => {
    const range = { aim: 'range' as const, headline: 'in_range' as const, rangeFrom: 62, rangeTo: 68 };
    assert.equal(sessionHeadline([61, 64, 70], range), 1);
    assert.deepEqual(attemptAgainstRange(64, 62, 68), { inRange: true, delta: 0 });
    assert.deepEqual(attemptAgainstRange(70, 62, 68), { inRange: false, delta: 2 });
    assert.deepEqual(attemptAgainstRange(61, 62, 68), { inRange: false, delta: -1 });
    // A range test never has a "best" — asked for one anyway, it answers the ruled headline instead.
    assert.equal(sessionHeadline([61, 64, 70], { ...range, headline: 'best' as never }), 1);
  });
  it('describes itself the way the editor preview and a Results row read it back', () => {
    assert.equal(describeHeadline([8.12, 8.05, 8.2], lower), 'Best of 3 attempts · 8.12 · 8.05 · 8.2 · average 8.123');
    assert.equal(describeHeadline([8.12], lower), 'One attempt');
    const range = { aim: 'range' as const, headline: 'in_range' as const, rangeFrom: 62, rangeTo: 68 };
    assert.equal(describeHeadline([61, 64, 70], range), '1 of 3 in range · 61 (−1) · 64 (in) · 70 (+2)');
    // A range test with no edges yet never reads "Best of" — it says what is missing.
    assert.equal(describeHeadline([61, 64, 70], { ...range, rangeFrom: null, rangeTo: null }), '3 attempts · set From and To to read them against the range');
  });
});

describe('readMeasurableTypeInput — a definition, whole', () => {
  it('a bare name + unit still creates (the session chip’s quick add): a record-only test, no method, one attempt, headline last', () => {
    assert.deepEqual(readMeasurableTypeInput({ name: ' Throw speed ', unit: ' mph ' }, 'create'), {
      fields: {
        kind: 'test', name: 'Throw speed', unit: 'mph', aim: 'record', rangeFrom: null, rangeTo: null,
        method: null, attemptsPerSession: 1, headline: 'last', descriptors: [],
      },
    });
  });
  it('a full test definition round-trips, with the headline defaulting to best for a directional aim', () => {
    const r = readMeasurableTypeInput({ name: '60-yd sprint', unit: 'seconds', aim: 'lower', method: ' Standing start. ', attemptsPerSession: 3 }, 'create');
    assert.ok('fields' in r);
    assert.equal(r.fields.aim, 'lower');
    assert.equal(r.fields.method, 'Standing start.');
    assert.equal(r.fields.attemptsPerSession, 3);
    assert.equal(r.fields.headline, 'best');
  });
  it('a range test needs both edges in order, and cannot lead with best', () => {
    assert.ok('error' in readMeasurableTypeInput({ name: 'Changeup', unit: 'mph', aim: 'range' }, 'create'));
    assert.ok('error' in readMeasurableTypeInput({ name: 'Changeup', unit: 'mph', aim: 'range', rangeFrom: 68, rangeTo: 62 }, 'create'));
    assert.ok('error' in readMeasurableTypeInput({ name: 'Changeup', unit: 'mph', aim: 'range', rangeFrom: 62, rangeTo: 68, headline: 'best' }, 'create'));
    const ok = readMeasurableTypeInput({ name: 'Changeup', unit: 'mph', aim: 'range', rangeFrom: 62, rangeTo: 68 }, 'create');
    assert.ok('fields' in ok && ok.fields.headline === 'in_range' && ok.fields.rangeFrom === 62);
    // A non-range test refuses range edges and "in range".
    assert.ok('error' in readMeasurableTypeInput({ name: 'x', unit: 's', aim: 'lower', rangeFrom: 1, rangeTo: 2 }, 'create'));
    assert.ok('error' in readMeasurableTypeInput({ name: 'x', unit: 's', aim: 'lower', headline: 'in_range' }, 'create'));
    // Record only has no direction, so no best.
    assert.ok('error' in readMeasurableTypeInput({ name: 'x', unit: 's', aim: 'record', headline: 'best' }, 'create'));
  });
  it('a skill takes descriptors and no unit; a test takes a unit and no descriptors', () => {
    const skill = readMeasurableTypeInput({ kind: 'skill', name: 'Sets feet before throwing', descriptors: [' With support ', 'With a reminder', '', 'Independently'] }, 'create');
    assert.ok('fields' in skill);
    assert.equal(skill.fields.unit, null);
    assert.deepEqual(skill.fields.descriptors, ['With support', 'With a reminder', 'Independently']);
    assert.equal(skill.fields.headline, 'last');
    assert.ok('error' in readMeasurableTypeInput({ kind: 'skill', name: 'x', unit: 'seconds' }, 'create'));
    assert.ok('error' in readMeasurableTypeInput({ kind: 'test', name: 'x', unit: 's', descriptors: ['a'] }, 'create'));
    assert.ok('error' in readMeasurableTypeInput({ kind: 'skill', name: 'x', descriptors: Array.from({ length: 11 }, (_, i) => `d${i}`) }, 'create'));
    assert.ok('error' in readMeasurableTypeInput({ kind: 'skill', name: 'x', descriptors: ['d'.repeat(61)] }, 'create'));
    assert.ok('error' in readMeasurableTypeInput({ kind: 'nonsense', name: 'x' }, 'create'));
  });
  it('bounds: attempts 1–5, method ≤ 600, name ≤ 40, unit ≤ 20', () => {
    assert.ok('error' in readMeasurableTypeInput({ name: 'x', unit: 's', attemptsPerSession: 6 }, 'create'));
    assert.ok('error' in readMeasurableTypeInput({ name: 'x', unit: 's', attemptsPerSession: 0 }, 'create'));
    assert.ok('error' in readMeasurableTypeInput({ name: 'x', unit: 's', attemptsPerSession: 2.5 }, 'create'));
    assert.ok('error' in readMeasurableTypeInput({ name: 'x', unit: 's', method: 'm'.repeat(601) }, 'create'));
    assert.ok('error' in readMeasurableTypeInput({ name: 'x'.repeat(41), unit: 's' }, 'create'));
  });
  it('a patch takes any subset but never the kind, and never nothing', () => {
    assert.deepEqual(readMeasurableTypeInput({ isActive: false }, 'patch'), { fields: { isActive: false } });
    assert.deepEqual(readMeasurableTypeInput({ method: '  ' }, 'patch'), { fields: { method: null } });
    assert.ok('error' in readMeasurableTypeInput({ kind: 'skill' }, 'patch'));
    assert.ok('error' in readMeasurableTypeInput({}, 'patch'));
    assert.ok('error' in readMeasurableTypeInput({ unit: '' }, 'patch'));
  });
});

describe('changing a definition later (ruling 3) — the successor rule', () => {
  it('a rename keeps the series, readings or not', () => {
    assert.deepEqual(definitionChange(base, { name: '60-yard sprint' }, true), { kind: 'keep' });
  });
  it('a unit change on a test WITH readings starts a successor; without readings it is just an edit', () => {
    assert.deepEqual(definitionChange(base, { unit: 's' }, true), { kind: 'successor' });
    assert.deepEqual(definitionChange(base, { unit: 's' }, false), { kind: 'keep' });
    // "Seconds" is the same unit as "seconds" — no successor for a spelling.
    assert.deepEqual(definitionChange(base, { unit: ' Seconds ' }, true), { kind: 'keep' });
  });
  it('the method never starts a successor (owner, 2026-09-14) — writing, changing or erasing it keeps the series', () => {
    assert.deepEqual(definitionChange(base, { method: 'Flying start.' }, true), { kind: 'keep' });
    assert.deepEqual(definitionChange(base, { method: null }, true), { kind: 'keep' });
    const legacy = def({ method: null, aim: 'record', headline: 'last' });
    assert.deepEqual(definitionChange(legacy, { method: 'Standing start.' }, true), { kind: 'keep' });
    // With the unit, only the unit is the reason.
    assert.deepEqual(definitionChange(base, { unit: 's', method: 'Flying start.' }, true), { kind: 'successor' });
  });
  it('aim, range, attempts, headline and descriptors never start a successor', () => {
    assert.deepEqual(definitionChange(base, { aim: 'higher', attemptsPerSession: 5, headline: 'average' }, true), { kind: 'keep' });
  });
});

describe('applyDefinitionPatch — the merged definition stays valid, and the successor rule is answered', () => {
  it('merges and re-validates: a range aim without edges is refused on the merged shape', () => {
    const r = applyDefinitionPatch(base, { aim: 'range' }, false);
    assert.ok('error' in r);
    const ok = applyDefinitionPatch(base, { aim: 'range', rangeFrom: 7, rangeTo: 9, headline: 'in_range' }, false);
    assert.ok('next' in ok && ok.next.aim === 'range' && ok.change.kind === 'keep');
  });
  it('moving to a range aim re-points a "best" headline to the ruled one rather than refusing', () => {
    const r = applyDefinitionPatch(base, { aim: 'range', rangeFrom: 7, rangeTo: 9 }, false);
    assert.ok('next' in r && r.next.headline === 'in_range');
    const back = applyDefinitionPatch(def({ aim: 'range', rangeFrom: 7, rangeTo: 9, headline: 'in_range' }), { aim: 'lower' }, false);
    assert.ok('next' in back && back.next.headline === 'best' && back.next.rangeFrom === null);
  });
  it('a unit change with readings answers "successor" with the merged next definition', () => {
    const r = applyDefinitionPatch(base, { unit: 's' }, true);
    assert.ok('next' in r && r.change.kind === 'successor' && r.next.unit === 's' && r.next.name === base.name);
  });
  it('retire and restore ride through untouched; restoring a REPLACED definition is refused', () => {
    const retire = applyDefinitionPatch(base, { isActive: false }, true);
    assert.ok('next' in retire && retire.next.isActive === false && retire.change.kind === 'keep');
    const replaced = def({ isActive: false, replacedById: 't2' });
    assert.ok('error' in applyDefinitionPatch(replaced, { isActive: true }, true));
  });
  it('a RETIRED definition is a record (B12): only its name and its retired flag may change — the server holds it, not just the sheet', () => {
    const retired = def({ isActive: false });
    const rename = applyDefinitionPatch(retired, { name: '60-yd sprint (hand-timed)' }, true);
    assert.ok('next' in rename && rename.next.name === '60-yd sprint (hand-timed)' && rename.next.isActive === false);
    assert.ok('next' in applyDefinitionPatch(retired, { isActive: true }, true));
    for (const fields of [{ aim: 'higher' as const }, { headline: 'average' as const }, { attemptsPerSession: 3 }, { method: 'Flying start.' }, { unit: 'ms' }, { descriptors: ['x'] }]) {
      const r = applyDefinitionPatch(retired, fields, true);
      assert.ok('error' in r && r.error === RETIRED_EDIT_MESSAGE, JSON.stringify(fields));
    }
  });
});
