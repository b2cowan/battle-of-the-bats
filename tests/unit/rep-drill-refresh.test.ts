import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  blockUsesDrill,
  detachStationFromDrill,
  drillToStation,
  libraryNameMatch,
  refreshBlockFromDrill,
  refreshPlanFromDrill,
  refreshStationFromDrill,
} from '../../lib/rep-drills.ts';
import type { PracticePlan, PracticePlanBlock, PracticeStation, RepTeamDrill, RepTeamTag } from '../../lib/types.ts';

/**
 * Saving a drill re-copies it into what has not happened yet (owner ruling D3, 2026-10-02): the
 * pure half of that walk. Which practices count as "not happened yet" is the server walk's query;
 * these pin what happens INSIDE a plan once it has been chosen.
 */

function tag(id: string, name: string): RepTeamTag {
  return { id, orgId: 'o1', teamId: 't1', kind: 'focus', name, createdBy: null, createdAt: '', updatedAt: '' };
}

function drill(over: Partial<RepTeamDrill> = {}): RepTeamDrill {
  return {
    id: 'd1', orgId: 'o1', teamId: 't1', name: 'Partner throwing', tags: [tag('tg1', 'Throwing')],
    usualMinutes: 15, description: 'Stable base, longer distance.', goal: 'Glove-side elbow up',
    coachingPoints: ['Step through', 'Finish to the target', 'Call the ball'], setup: 'Two lines, 20 feet',
    equipment: ['Balls', 'Cones'], equipmentTagIds: [],
    isActive: true, sortOrder: 0, createdBy: null, createdAt: '', updatedAt: '', ...over,
  };
}

const updated = drill({
  description: 'Stable base, shorter distance.', coachingPoints: ['Step through', 'Finish to the target', 'Feet set', 'Call the ball'],
  equipment: ['Balls'], tags: [tag('tg1', 'Throwing'), tag('tg2', 'Warm-up')],
});

/** A linked station as a practice holds it: the drill half, plus the practice's own people and note. */
function linked(id = 's1'): PracticeStation {
  return { ...drillToStation(drill(), () => id), staffTagIds: ['st1'], playerIds: ['p1', 'p2'], note: 'Short throws only tonight', rotationNote: 'Start at the fence' };
}

function block(stations: PracticeStation[], title = 'Partner throwing'): PracticePlanBlock {
  return { id: 'b1', title, duration: { minutes: 20 }, stations };
}

describe('a linked station takes the drill again — the drill half replaced, the practice half kept', () => {
  it('replaces every word, the tag snapshot and the kit with the drill’s', () => {
    const next = refreshStationFromDrill(linked(), updated);
    assert.equal(next.description, 'Stable base, shorter distance.');
    assert.deepEqual(next.coachingPoints, ['Step through', 'Finish to the target', 'Feet set', 'Call the ball']);
    assert.deepEqual(next.equipment, ['Balls']);
    assert.deepEqual(next.drillTags, ['Throwing', 'Warm-up']);
    assert.equal(next.drillId, 'd1');
  });

  it('keeps the station id, who runs it, who is at it, the rotation note and just-for-tonight', () => {
    const next = refreshStationFromDrill(linked('keep-me'), updated);
    assert.equal(next.id, 'keep-me');
    assert.deepEqual(next.staffTagIds, ['st1']);
    assert.deepEqual(next.playerIds, ['p1', 'p2']);
    assert.equal(next.rotationNote, 'Start at the fence');
    assert.equal(next.note, 'Short throws only tonight');
  });

  it('a field the drill no longer has leaves the station too — wholesale, never merged', () => {
    const next = refreshStationFromDrill(linked(), drill({ setup: null, coachingPoints: [], equipment: [], tags: [] }));
    assert.equal(next.setup, undefined);
    assert.equal(next.coachingPoints, undefined);
    assert.equal(next.equipment, undefined);
    assert.equal(next.drillTags, undefined);
  });

  it('relinks a detached station — a station saved back over its drill is that drill again', () => {
    const detached = { ...detachStationFromDrill(linked()), description: 'Stable base, shorter distance.' };
    const next = refreshStationFromDrill(detached, updated);
    assert.equal(next.drillId, 'd1');
    assert.deepEqual(next.playerIds, ['p1', 'p2']);
  });
});

describe('a block and a plan — only stations still linked to THIS drill move', () => {
  it('leaves a station "edited just for this practice" exactly as the coach wrote it', () => {
    const mine = { ...detachStationFromDrill(linked('s2')), description: 'My own version' };
    const r = refreshBlockFromDrill(block([linked('s1'), mine]), updated);
    assert.equal(r.changed, true);
    assert.equal(r.block.stations![0].description, 'Stable base, shorter distance.');
    assert.equal(r.block.stations![1], mine);
  });

  it('leaves a station from ANOTHER drill alone', () => {
    const other = drillToStation(drill({ id: 'd2', name: 'Long toss' }), () => 's9');
    const r = refreshBlockFromDrill(block([other], 'Long toss'), updated);
    assert.equal(r.changed, false);
    assert.equal(r.block.stations![0], other);
  });

  it('reports no change — and hands back the same object — when the plan already carries this version', () => {
    const plan: PracticePlan = { version: 1, blocks: [block([refreshStationFromDrill(linked(), updated)])] };
    const r = refreshPlanFromDrill(plan, updated);
    assert.equal(r.changed, false);
    assert.equal(r.plan, plan);
  });

  it('walks every block of a plan', () => {
    const plan: PracticePlan = { version: 1, blocks: [block([linked('s1')]), { ...block([linked('s2')]), id: 'b2' }] };
    const r = refreshPlanFromDrill(plan, updated);
    assert.equal(r.changed, true);
    assert.ok(r.plan.blocks.every(b => b.stations![0].description === 'Stable base, shorter distance.'));
    assert.equal(plan.blocks[0].stations![0].description, 'Stable base, longer distance.', 'the input plan is not mutated');
  });

  it('a renamed drill retitles a block that still wears its old name, and only that', () => {
    const renamed = drill({ name: 'Partner throws' });
    assert.equal(refreshBlockFromDrill(block([linked()]), renamed, 'Partner throwing').block.title, 'Partner throws');
    assert.equal(refreshBlockFromDrill(block([linked()], 'Warm-up throws'), renamed, 'Partner throwing').block.title, 'Warm-up throws');
    // A circuit of stations is titled by the coach, never by one of its drills.
    assert.equal(refreshBlockFromDrill(block([linked('s1'), linked('s2')]), renamed, 'Partner throwing').block.title, 'Partner throwing');
  });

  it('says whether a block still uses the drill', () => {
    assert.equal(blockUsesDrill(block([linked()]), 'd1'), true);
    assert.equal(blockUsesDrill(block([detachStationFromDrill(linked())]), 'd1'), false);
    assert.equal(blockUsesDrill({ stations: undefined }, 'd1'), false);
  });
});

describe('the name decides — the database’s own rule', () => {
  const items = [{ name: 'Hitting night', isActive: true }, { name: 'Rain-day gym', isActive: false }];

  it('matches capitals and outer spaces aside', () => {
    assert.equal(libraryNameMatch(items, '  hitting NIGHT ')?.name, 'Hitting night');
  });

  it('ignores a retired item — its name is free to reuse', () => {
    assert.equal(libraryNameMatch(items, 'Rain-day gym'), null);
  });

  it('an item with no active flag counts as active, and an empty name matches nothing', () => {
    assert.equal(libraryNameMatch([{ name: 'Tuesday basics' }], 'tuesday basics')?.name, 'Tuesday basics');
    assert.equal(libraryNameMatch(items, '   '), null);
  });
});
