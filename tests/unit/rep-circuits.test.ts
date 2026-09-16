import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blockToCircuitShape, circuitLine, circuitToBlock, countCircuitUses, pointStationsAtDrills,
  stationsToPromote, validateCircuitInput, writtenStationsOf,
} from '../../lib/rep-circuits.ts';
import { blockForTemplate, planToTemplateShape, templateBlocksLine } from '../../lib/rep-plan-templates.ts';
import { copyPracticePlanForReuse, sanitizePracticePlan } from '../../lib/rep-practice-plan.ts';
import type { PracticePlanBlock } from '../../lib/types.ts';

/**
 * Circuits — the third size of reusable thing (practices re-evaluation stage 4, owner ruling L9,
 * 2026-09-16). The rules worth a test each are the ones that fail SILENTLY:
 *   · a circuit carries NO PEOPLE — and no hand-arranged grid (D14), which names people by id;
 *   · placing one must PRESERVE every station's drill provenance (the template's rule);
 *   · the tick creates drills FIRST and the saved shape points at them by NAME, never duplicating
 *     a drill the library already holds;
 *   · the count says PLANS, once per plan, however many times a circuit sits in one.
 */

const seq = () => { let n = 0; return () => `id-${++n}`; };

const circuitBlock = (over: Record<string, unknown> = {}) => ({
  id: 'b1', title: 'Skills circuit', duration: { minutes: 45 },
  description: 'Three stations.', goal: 'Everyone gets a turn.',
  staff: ['Coach Bob'], staffTagIds: ['st1'], playerIds: ['p1'],
  stations: [
    { id: 's1', name: 'Footwork ladder', setup: 'Two ladders', coachingPoints: ['Short steps'], staff: ['Bob'], note: 'pairs tonight', playerIds: ['p1'] },
    { id: 's2', name: 'Close control', drillId: 'd-close', drillTags: ['Skills'], description: 'From the drill' },
    { id: 's3', name: 'Finishing', equipment: ['Bibs'] },
  ],
  rotation: {
    intervalMinutes: 15, groupSource: 'random',
    groups: [{ id: 'g1', name: 'A', playerIds: ['p1'] }, { id: 'g2', name: 'B', playerIds: ['p2'] }],
    arrangement: { stationIds: ['s1', 's2', 's3'], groupIds: ['g1', 'g2'], rounds: 3, placements: [{ g1: 's2', g2: 's1' }] },
  },
  ...over,
});

describe('blockToCircuitShape — sanitised, then emptied of people', () => {
  it('strips staff, players, groups, tonight\'s notes and the arrangement; keeps the stations, the clock and the kit', () => {
    const shape = blockToCircuitShape(circuitBlock());
    assert.equal(shape.title, 'Skills circuit');
    assert.equal(shape.duration.minutes, 45);
    assert.equal(shape.staff, undefined);
    assert.equal(shape.staffTagIds, undefined);
    assert.equal(shape.playerIds, undefined);
    assert.equal(shape.stations?.length, 3);
    assert.equal(shape.stations?.[0].staff, undefined);
    assert.equal(shape.stations?.[0].note, undefined);
    assert.equal(shape.stations?.[0].playerIds, undefined);
    assert.equal(shape.stations?.[0].setup, 'Two ladders');
    assert.deepEqual(shape.stations?.[2].equipment, ['Bibs']);
    assert.equal(shape.rotation?.intervalMinutes, 15);
    assert.deepEqual(shape.rotation?.groups, []);
    assert.equal(shape.rotation?.arrangement, undefined, 'a hand-arranged grid names groups that are gone');
    assert.equal(shape.rotation?.groupSource, 'manual', 'the practice deals its own draw');
  });

  it('PRESERVES a station\'s drillId and drillTags — stripping them breaks every drill\'s count', () => {
    const shape = blockToCircuitShape(circuitBlock());
    assert.equal(shape.stations?.[1].drillId, 'd-close');
    assert.deepEqual(shape.stations?.[1].drillTags, ['Skills']);
  });

  it('drops circuitId/circuitName — a circuit saved from a placed circuit is a NEW circuit', () => {
    const shape = blockToCircuitShape(circuitBlock({ circuitId: 'old', circuitName: 'Old' }));
    assert.equal(shape.circuitId, undefined);
    assert.equal(shape.circuitName, undefined);
  });

  it('a rest-of-practice length becomes no length — not a promise a circuit can keep', () => {
    const shape = blockToCircuitShape(circuitBlock({ duration: { minutes: null, restOfPractice: true } }));
    assert.deepEqual(shape.duration, { minutes: null });
  });

  it('is idempotent and tolerates junk', () => {
    const once = blockToCircuitShape(circuitBlock());
    assert.deepEqual(blockToCircuitShape(once), once);
    assert.equal(blockToCircuitShape(null).title, '');
    assert.equal(blockToCircuitShape('x').stations, undefined);
  });
});

describe('circuitToBlock — placed: fresh ids, provenance, empty groups, fully editable', () => {
  it('mints new ids, titles the block by the circuit, stamps circuitId + circuitName, empties the groups', () => {
    const circuit = { id: 'c1', name: 'Tee stations', block: blockToCircuitShape(circuitBlock()) };
    const block = circuitToBlock(circuit, seq());
    assert.equal(block.id, 'id-1');
    assert.equal(block.title, 'Tee stations');
    assert.equal(block.circuitId, 'c1');
    assert.equal(block.circuitName, 'Tee stations');
    assert.deepEqual(block.stations?.map(s => s.id), ['id-2', 'id-3', 'id-4']);
    assert.deepEqual(block.rotation?.groups, []);
    assert.equal(block.rotation?.intervalMinutes, 15);
    // The drill rule inside it holds.
    assert.equal(block.stations?.[1].drillId, 'd-close');
  });

  it('the placed block survives the plan sanitiser with its provenance (the two keys are whitelisted)', () => {
    const block = circuitToBlock({ id: 'c1', name: 'Tee stations', block: blockToCircuitShape(circuitBlock()) }, seq());
    const plan = sanitizePracticePlan({ blocks: [block] });
    assert.equal(plan?.blocks[0].circuitId, 'c1');
    assert.equal(plan?.blocks[0].circuitName, 'Tee stations');
  });

  it('a template saved from that plan KEEPS the block\'s circuitId (as it keeps drillIds); a copied practice DROPS it', () => {
    const block = circuitToBlock({ id: 'c1', name: 'Tee stations', block: blockToCircuitShape(circuitBlock()) }, seq());
    const plan = sanitizePracticePlan({ blocks: [block] })!;
    assert.equal(planToTemplateShape(plan).blocks[0].circuitId, 'c1');
    assert.equal(copyPracticePlanForReuse(plan, new Set(), seq()).blocks[0].circuitId, undefined);
  });
});

describe('the tick — written stations as drills, created first, pointed at by name', () => {
  it('writtenStationsOf: named, not drill-backed', () => {
    const names = writtenStationsOf(circuitBlock() as unknown as PracticePlanBlock).map(s => s.name);
    assert.deepEqual(names, ['Footwork ladder', 'Finishing']);
  });

  it('stationsToPromote skips a same-name library drill (case-insensitively) and a duplicate name', () => {
    const block = circuitBlock({ stations: [{ id: 's1', name: 'Ladder' }, { id: 's2', name: 'ladder' }, { id: 's3', name: 'Finishing' }] }) as unknown as PracticePlanBlock;
    assert.deepEqual(stationsToPromote(block, ['FINISHING ']).map(s => s.name), ['Ladder']);
  });

  it('pointStationsAtDrills rewrites drillId by NAME and snapshots the tag names; others untouched', () => {
    const shape = blockToCircuitShape(circuitBlock());
    const pointed = pointStationsAtDrills(shape, new Map([
      ['footwork ladder', { id: 'd-ladder', tagNames: ['Skills'] }],
      ['finishing', { id: 'd-fin', tagNames: [] }],
    ]));
    assert.equal(pointed.stations?.[0].drillId, 'd-ladder');
    assert.deepEqual(pointed.stations?.[0].drillTags, ['Skills']);
    assert.equal(pointed.stations?.[1].drillId, 'd-close', 'an already drill-backed station is left alone');
    assert.equal(pointed.stations?.[2].drillId, 'd-fin');
    assert.equal(pointed.stations?.[2].drillTags, undefined);
  });
});

describe('countCircuitUses — plans, once per plan', () => {
  it('counts a plan once however many blocks carry the id, and keeps the newest date', () => {
    const plan = (ids: (string | undefined)[]) => sanitizePracticePlan({
      blocks: ids.map((circuitId, i) => ({ title: `B${i}`, duration: { minutes: 10 }, ...(circuitId ? { circuitId } : {}) })),
    });
    const uses = countCircuitUses([
      { plan: plan(['c1', 'c1']), startsAt: '2026-05-01T00:00:00Z' },
      { plan: plan(['c1', 'c2']), startsAt: '2026-06-01T00:00:00Z' },
      { plan: plan([undefined]), startsAt: '2026-07-01T00:00:00Z' },
      { plan: null, startsAt: null },
    ]);
    assert.equal(uses.get('c1')?.planCount, 2);
    assert.equal(uses.get('c1')?.lastPlannedAt, '2026-06-01T00:00:00Z');
    assert.equal(uses.get('c2')?.planCount, 1);
    assert.equal(uses.size, 2);
  });
});

describe('the rows\' lines', () => {
  it('circuitLine: the stations\' names then how it rotates; empty when nothing is written', () => {
    assert.equal(circuitLine(blockToCircuitShape(circuitBlock())), 'Footwork ladder · Close control · Finishing · rotates every 15 min');
    assert.equal(circuitLine({ stations: [{ id: 'a', name: 'One' }, { id: 'b', name: '' }], rotates: false }), 'One · Station 2');
    assert.equal(circuitLine({ stations: [] }), '');
  });

  it('templateBlocksLine: the blocks\' titles, an untitled one numbered', () => {
    assert.equal(templateBlocksLine({ blocks: [{ id: 'a', title: 'Warm-up', duration: { minutes: 5 } }, { id: 'b', title: ' ', duration: { minutes: 5 } }] }), 'Warm-up · Block 2');
    assert.equal(templateBlocksLine({ blocks: [] }), '');
  });

  it('blockForTemplate strips a hand-arranged grid with the groups it names', () => {
    const stripped = blockForTemplate(sanitizePracticePlan({ blocks: [circuitBlock()] })!.blocks[0]);
    assert.equal(stripped.rotation?.arrangement, undefined);
    assert.deepEqual(stripped.rotation?.groups, []);
  });
});

describe('validateCircuitInput', () => {
  it('requires a name; an absent block means "not editing the shape"', () => {
    assert.ok('error' in validateCircuitInput({ name: ' ' }));
    const r = validateCircuitInput({ name: 'Tee stations' });
    assert.ok('circuit' in r);
    assert.equal(r.circuit.block, undefined);
    const r2 = validateCircuitInput({ name: 'Tee stations', block: circuitBlock() });
    assert.ok('circuit' in r2 && r2.circuit.block?.playerIds === undefined);
  });
});
