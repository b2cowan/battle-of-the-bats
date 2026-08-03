import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countTemplateUses,
  planToTemplateShape,
  templateShapeLabel,
  templateToPlan,
  templateUseLabel,
  validatePlanTemplateInput,
} from '../../lib/rep-plan-templates.ts';
import { sanitizePracticePlan } from '../../lib/rep-practice-plan.ts';
import type { PracticePlan } from '../../lib/types.ts';

/**
 * Plan templates — Practice Plans Phase 3.
 *
 * The two rules worth a test each are the ones that fail SILENTLY in production:
 *   · a template must carry NO PEOPLE, and
 *   · loading one must PRESERVE every station's drill provenance.
 * Strip the second by accident and every drill's "In 8 plans" quietly becomes wrong, with nothing
 * erroring anywhere. That is exactly the shape of bug a unit test is worth paying for.
 */

const seq = () => { let n = 0; return () => `id-${++n}`; };

function planWith(overrides: Record<string, unknown> = {}): PracticePlan {
  return sanitizePracticePlan({
    goal: 'Hitting night',
    blocks: [{
      title: 'Stations', duration: { minutes: 30 },
      staff: ['Dana'],
      stations: [
        {
          id: 's1', name: 'Four-corner tee work', drillId: 'drill-1', drillTags: ['Hitting'],
          description: 'Four tees at the corners.', goal: 'Front shoulder closed.',
          coachingPoints: ['Weight back'], setup: 'Four tees', equipment: ['tees'],
          staff: ['Dana'], note: 'only three tees tonight',
        },
        { id: 's2', name: 'Short-hop reps', staff: ['Sam'], rotationNote: 'swap halfway' },
      ],
      rotation: {
        intervalMinutes: 10,
        groupSource: 'random',
        groups: [{ id: 'g1', name: 'Group A', playerIds: ['p1', 'p2'] }],
      },
    }],
    ...overrides,
  })!;
}

describe('planToTemplateShape — a template carries the shape and the teaching, never the people', () => {
  const shape = planToTemplateShape(planWith());
  const block = shape.blocks[0];
  const drillStation = block.stations![0];

  it('drops staff at every level', () => {
    assert.equal(block.staff, undefined);
    assert.equal(drillStation.staff, undefined);
    assert.equal(block.stations![1].staff, undefined);
  });

  it('drops players and the rotation GROUPS but keeps the rotation SHAPE', () => {
    assert.equal(block.playerIds, undefined);
    assert.deepEqual(block.rotation?.groups, []);
    // How often groups move is part of how the practice runs, and is worth saving.
    assert.equal(block.rotation?.intervalMinutes, 10);
    assert.equal(block.rotation?.groupSource, 'manual', 'a template has drawn nothing');
  });

  it('drops "just for tonight" — the one field that must never travel in either direction', () => {
    assert.equal(drillStation.note, undefined);
    assert.equal(block.stations![1].rotationNote, undefined);
  });

  it('⚠ KEEPS every station’s drill provenance', () => {
    // Stripping this is the silent-breakage path: every drill-backed station in a loaded template
    // would arrive editable and every drill's count would quietly go wrong, with nothing erroring.
    assert.equal(drillStation.drillId, 'drill-1');
    assert.deepEqual(drillStation.drillTags, ['Hitting']);
  });

  it('keeps the teaching, which is the whole point of saving one', () => {
    assert.equal(drillStation.description, 'Four tees at the corners.');
    assert.equal(drillStation.goal, 'Front shoulder closed.');
    assert.deepEqual(drillStation.coachingPoints, ['Weight back']);
    assert.equal(drillStation.setup, 'Four tees');
    assert.deepEqual(drillStation.equipment, ['tees']);
  });

  it('drops a template reference — a template saved from a templated plan is a new template', () => {
    const nested = planToTemplateShape({ ...planWith(), templateId: 't-old', templateName: 'Old' });
    assert.equal(nested.templateId, undefined);
    assert.equal(nested.templateName, undefined);
  });

  it('tolerates junk, returning an empty shape rather than throwing', () => {
    assert.deepEqual(planToTemplateShape(null).blocks, []);
    assert.deepEqual(planToTemplateShape('nonsense').blocks, []);
  });
});

describe('templateToPlan — copy-on-load, fully editable, provenance stamped', () => {
  const template = { id: 't-1', name: 'Standard Tuesday', plan: planWith() };
  const plan = templateToPlan(template, seq());

  it('stamps the template id AND snapshots its name', () => {
    assert.equal(plan.templateId, 't-1');
    // Snapshotted so the provenance line keeps reading after a rename or a retire, with no
    // dependency on the template table — the same reason drillTags snapshots names.
    assert.equal(plan.templateName, 'Standard Tuesday');
  });

  it('mints FRESH ids for every block, station and group', () => {
    const ids = [plan.blocks[0].id, ...plan.blocks[0].stations!.map(s => s.id)];
    assert.equal(new Set(ids).size, ids.length, 'no id repeats');
    assert.ok(ids.every(id => id.startsWith('id-')), 'every id came from the supplied minter');
  });

  it('⚠ PRESERVES each station’s drillId through the load', () => {
    assert.equal(plan.blocks[0].stations![0].drillId, 'drill-1');
    assert.deepEqual(plan.blocks[0].stations![0].drillTags, ['Hitting']);
  });

  it('carries no people, so a template can never smuggle a departed player into October', () => {
    assert.equal(plan.blocks[0].staff, undefined);
    assert.equal(plan.blocks[0].playerIds, undefined);
    assert.deepEqual(plan.blocks[0].rotation?.groups, []);
    assert.equal(plan.blocks[0].stations![0].note, undefined);
  });
});

describe('countTemplateUses — PLANS started, never practices run', () => {
  it('counts plans per template and keeps the NEWEST date whatever order it walks', () => {
    const of = (templateId: string): PracticePlan =>
      ({ version: 1, templateId, blocks: [] });
    // Deliberately ascending, to prove "last planned" isn't just "the last row seen".
    const uses = countTemplateUses([
      { plan: of('t1'), startsAt: '2026-05-01T00:00:00Z' },
      { plan: of('t1'), startsAt: '2026-07-22T00:00:00Z' },
      { plan: of('t1'), startsAt: '2026-06-10T00:00:00Z' },
      { plan: of('t2'), startsAt: '2026-04-01T00:00:00Z' },
      { plan: null, startsAt: '2026-04-02T00:00:00Z' },
      { plan: { version: 1, blocks: [] }, startsAt: '2026-04-03T00:00:00Z' },
    ]);
    assert.equal(uses.get('t1')?.planCount, 3);
    assert.equal(uses.get('t1')?.lastPlannedAt, '2026-07-22T00:00:00Z');
    assert.equal(uses.get('t2')?.planCount, 1);
    assert.equal(uses.get('t3'), undefined, 'a template nothing started is simply absent');
  });

  it('tolerates a plan with no date', () => {
    const uses = countTemplateUses([{ plan: { version: 1, templateId: 't1', blocks: [] }, startsAt: null }]);
    assert.equal(uses.get('t1')?.planCount, 1);
    assert.equal(uses.get('t1')?.lastPlannedAt, null);
  });
});

describe('the vocabulary — "Started N plans", never "used N×"', () => {
  it('writes zero out in words, so an unused template never reads as a failing score', () => {
    assert.equal(templateUseLabel(0), 'Not started a plan yet');
    assert.equal(templateUseLabel(1), 'Started 1 plan');
    assert.equal(templateUseLabel(8), 'Started 8 plans');
  });

  it('never says "used", "ran" or "did" anywhere in the label', () => {
    for (const n of [0, 1, 8]) {
      assert.doesNotMatch(templateUseLabel(n), /\bused\b|\bran\b|\bdid\b|×/i);
    }
  });

  it('describes a shape from the blocks themselves — no second source of truth', () => {
    assert.equal(templateShapeLabel(planWith()), '30 min · 1 block');
    assert.equal(templateShapeLabel({ version: 1, blocks: [] }), '0 blocks');
    // "Rest of practice" is unbounded by definition and contributes nothing (D13).
    const openEnded = sanitizePracticePlan({
      blocks: [{ title: 'A', duration: { restOfPractice: true } }],
    })!;
    assert.equal(templateShapeLabel(openEnded), '1 block');
  });
});

describe('validatePlanTemplateInput', () => {
  it('rejects an empty name — an explicit submit, unlike the autosaving plan editor', () => {
    assert.deepEqual(validatePlanTemplateInput({ name: '   ' }), { error: 'Give the template a name.' });
    assert.deepEqual(validatePlanTemplateInput(null), { error: 'Invalid template.' });
  });

  it('leaves the shape ALONE when the key is absent, so a rename cannot blank a template', () => {
    const parsed = validatePlanTemplateInput({ name: 'Standard Tuesday' });
    assert.ok('template' in parsed);
    assert.equal(parsed.template.plan, undefined);
  });

  it('empties any supplied shape of people on the way in', () => {
    const parsed = validatePlanTemplateInput({ name: 'T', plan: planWith() });
    assert.ok('template' in parsed);
    assert.equal(parsed.template.plan!.blocks[0].staff, undefined);
    assert.deepEqual(parsed.template.plan!.blocks[0].rotation?.groups, []);
  });

  it('drops tag ids that are not uuids, so nothing malformed reaches a PostgREST filter', () => {
    const parsed = validatePlanTemplateInput({
      name: 'T',
      tagIds: ['3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'not-a-uuid', 'a,b'],
    });
    assert.ok('template' in parsed);
    assert.deepEqual(parsed.template.tagIds, ['3f2504e0-4f89-41d3-9a0c-0305e82c3301']);
  });
});
