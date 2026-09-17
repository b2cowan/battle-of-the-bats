import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  blockToCircuitShape, circuitLine, circuitToBlock, countCircuitUses, fromDrillsLine, pointStationsAtDrills,
  tickRowsFor, validateCircuitInput, writtenStationsOf,
} from '../../lib/rep-circuits.ts';
import { blockForTemplate, planToTemplateShape, templateBlocksLine } from '../../lib/rep-plan-templates.ts';
import { copyPracticePlanForReuse, sanitizePracticePlan } from '../../lib/rep-practice-plan.ts';
import { stationToDrillInput } from '../../lib/rep-drills.ts';
import type { PracticePlanBlock, RepTeamDrill } from '../../lib/types.ts';

/** A library drill for the tick's tests — active, the team's own, bare unless said otherwise. */
const drill = (over: Partial<RepTeamDrill>): RepTeamDrill => ({
  id: 'd', orgId: 'o', teamId: 't', name: 'Drill', tags: [], usualMinutes: null, description: null, goal: null,
  coachingPoints: [], setup: null, equipment: [], equipmentTagIds: [], isActive: true, sortOrder: 0,
  createdBy: null, createdAt: '2026-09-17T00:00:00Z', ...over,
} as RepTeamDrill);

/**
 * Circuits — the third size of reusable thing (practices re-evaluation stage 4, owner ruling L9,
 * 2026-09-16). The rules worth a test each are the ones that fail SILENTLY:
 *   · a circuit carries NO PEOPLE — and no hand-arranged grid (D14), which names people by id;
 *   · placing one must PRESERVE every station's drill provenance (the template's rule);
 *   · the tick creates drills FIRST and the saved shape points the ticked STATIONS at them (by
 *     station id — a same-named twin is left as typed), never duplicating a drill the library holds;
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

describe('the tick — written stations as drills, created first, the ticked stations pointed at them', () => {
  it('writtenStationsOf: named, not drill-backed', () => {
    const names = writtenStationsOf(circuitBlock() as unknown as PracticePlanBlock).map(s => s.name);
    assert.deepEqual(names, ['Footwork ladder', 'Finishing']);
  });

  it('tickRowsFor: one row per distinct typed name; a same-name library drill is SHOWN on its row, not hidden (S2)', () => {
    const block = circuitBlock({ stations: [{ id: 's1', name: 'Ladder' }, { id: 's2', name: 'ladder' }, { id: 's3', name: 'Finishing' }, { id: 's4', name: 'Close control', drillId: 'd-close' }] }) as unknown as PracticePlanBlock;
    const rows = tickRowsFor(block, [drill({ id: 'd-fin', name: 'FINISHING ' }), drill({ id: 'd-old', name: 'Ladder', isActive: false })]);
    assert.deepEqual(rows.map(r => [r.station.id, r.existing?.id ?? null]), [['s1', null], ['s3', 'd-fin']],
      'the duplicate name shares the first row; the drill-placed station is not a row; a retired drill does not count as held');
  });

  it('tickRowsFor: when the team\'s own drill and a club-shared one share a name, the team\'s own is the match — whichever order the list carries them', () => {
    const block = circuitBlock({ stations: [{ id: 's1', name: 'Ladder' }, { id: 's2', name: 'Cones' }] }) as unknown as PracticePlanBlock;
    const club = drill({ id: 'd-club', name: 'Ladder', teamId: null });
    const own = drill({ id: 'd-own', name: 'ladder' });
    assert.equal(tickRowsFor(block, [club, own])[0].existing?.id, 'd-own');
    assert.equal(tickRowsFor(block, [own, club])[0].existing?.id, 'd-own');
    assert.equal(tickRowsFor(block, [club])[0].existing?.id, 'd-club', 'a club drill alone still matches');
  });

  it('fromDrillsLine (S3): null when every station was typed; names the drill-placed ones; "All N" when none was typed', () => {
    const typed = circuitBlock({ stations: [{ id: 's1', name: 'A' }, { id: 's2', name: 'B' }] }) as unknown as PracticePlanBlock;
    assert.equal(fromDrillsLine(typed), null);
    assert.equal(fromDrillsLine(circuitBlock() as unknown as PracticePlanBlock), 'Close control came from your drills and stays linked.');
    const three = circuitBlock({ stations: [
      { id: 's1', name: 'Footwork ladder', drillId: 'd1' }, { id: 's2', name: 'Close control', drillId: 'd2' },
      { id: 's3', name: 'Finishing', drillId: 'd3' }, { id: 's4', name: 'Turn and shoot' },
    ] }) as unknown as PracticePlanBlock;
    assert.equal(fromDrillsLine(three), 'Footwork ladder, Close control and Finishing came from your drills and stay linked.');
    const all = circuitBlock({ stations: [{ id: 's1', name: 'A', drillId: 'd1' }, { id: 's2', name: 'B', drillId: 'd2' }] }) as unknown as PracticePlanBlock;
    assert.equal(fromDrillsLine(all), 'All 2 stations came from your drills and stay linked.');
  });

  it('pointStationsAtDrills rebuilds a pointed station FROM the drill (its words, its tags, its id kept); others untouched', () => {
    const shape = blockToCircuitShape(circuitBlock());
    const pointed = pointStationsAtDrills(shape, new Map([
      ['s1', drill({ id: 'd-ladder', name: 'Footwork ladder', tags: [{ id: 't1', name: 'Skills' } as never], setup: 'THE DRILL SAYS one ladder', coachingPoints: ['Quick feet'] })],
      ['s3', drill({ id: 'd-fin', name: 'Finishing', description: 'From the top of the area' })],
    ]));
    const ladder = pointed.stations?.[0];
    assert.equal(ladder?.id, 's1', 'the station keeps its id');
    assert.equal(ladder?.drillId, 'd-ladder');
    assert.deepEqual(ladder?.drillTags, ['Skills']);
    assert.equal(ladder?.setup, 'THE DRILL SAYS one ladder', 'the drill\'s words, not tonight\'s under the same name');
    assert.deepEqual(ladder?.coachingPoints, ['Quick feet']);
    assert.equal(pointed.stations?.[1].drillId, 'd-close', 'an already drill-backed station is left alone');
    assert.equal(pointed.stations?.[1].description, 'From the drill');
    assert.equal(pointed.stations?.[2].drillId, 'd-fin');
    assert.equal(pointed.stations?.[2].description, 'From the top of the area');
    assert.equal(pointed.stations?.[2].drillTags, undefined);
    assert.equal(pointed.stations?.[2].equipment, undefined, 'the typed station\'s kit is not smuggled onto the drill');
  });

  it('pointStationsAtDrills leaves an unticked typed station exactly as typed — a station the map does not hold', () => {
    const shape = blockToCircuitShape(circuitBlock());
    const pointed = pointStationsAtDrills(shape, new Map([['s3', drill({ id: 'd-fin', name: 'Finishing' })]]));
    assert.equal(pointed.stations?.[0].drillId, undefined);
    assert.equal(pointed.stations?.[0].setup, 'Two ladders');
  });

  it('a same-named TWIN of a ticked row is left as typed — the link is by station, never by name (/review 2026-09-17)', () => {
    const shape = blockToCircuitShape(circuitBlock({ stations: [
      { id: 's1', name: 'Passing', setup: 'Pairs, ten metres' },
      { id: 's2', name: 'passing', setup: 'Threes, one touch — its OWN words' },
    ] }));
    const rows = tickRowsFor(shape, []);
    assert.equal(rows.length, 1, 'one row per name');
    const pointed = pointStationsAtDrills(shape, new Map([[rows[0].station.id, drill({ id: 'd-pass', name: 'Passing', setup: 'Pairs, ten metres' })]]));
    assert.equal(pointed.stations?.[0].drillId, 'd-pass');
    assert.equal(pointed.stations?.[1].drillId, undefined, 'the twin is not linked');
    assert.equal(pointed.stations?.[1].setup, 'Threes, one touch — its OWN words', 'and keeps its own words');
  });

  it('a station rebuilt from the drill it made keeps its kit ids — the round trip through stationToDrillInput', () => {
    const shape = blockToCircuitShape(circuitBlock({ stations: [
      { id: 's1', name: 'Ladder', equipmentTagIds: ['e1'], equipment: ['Ladder'] }, { id: 's2', name: 'Cones' },
    ] }));
    const input = stationToDrillInput(shape.stations![0]);
    const created = drill({ id: 'd-ladder', name: input.name, equipment: input.equipment ?? [], equipmentTagIds: input.equipmentTagIds ?? [] });
    const pointed = pointStationsAtDrills(shape, new Map([['s1', created]]));
    assert.deepEqual(pointed.stations?.[0].equipmentTagIds, ['e1']);
    assert.deepEqual(pointed.stations?.[0].equipment, ['Ladder']);
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
