import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  copyGrouping, copyPracticePlanForReuse, drawGroups, groupNames, groupingById, groupingShape, groupingUses, groupingWords,
  groupingsFromPractices, isPairSet, isPracticePlanEmpty, nextGroupingName, rotationInput, sanitizePracticePlan,
  settlePlanLevels, unplacedInSet, usedGroupingIds,
} from '../../lib/rep-practice-plan.ts';
import { planToTemplateShape, templateToPlan } from '../../lib/rep-plan-templates.ts';
import { buildPracticeSheet } from '../../lib/practice-sheet.ts';
import type { PracticeGrouping, PracticePlan } from '../../lib/types.ts';

/**
 * Groups at every level of a practice (owner rulings G1–G8, 2026-09-28 —
 * docs/projects/active/COACH_PRACTICE_GROUPS_PLAN.md). A set of groups belongs to the PRACTICE;
 * a block with no stations, a station that does not rotate and a circuit's rotation each point at
 * one. These pin the model's promises: the lift of a circuit saved the old way, the one-level law
 * with sets in it, pairs spoken as pairs, and the copies.
 */

const pairs = (id = 'tp', name = 'Throwing partners'): PracticeGrouping => ({
  id, name, groupSource: 'random',
  groups: [
    { id: `${id}-1`, name: 'Pair 1', playerIds: ['p1', 'p2'] },
    { id: `${id}-2`, name: 'Pair 2', playerIds: ['p3', 'p4'] },
  ],
});
const plan = (over: Partial<PracticePlan>): PracticePlan => ({ version: 1, blocks: [], ...over });
const setOf = (p: PracticePlan | null | undefined, i = 0) => groupingById(p?.groupings, p?.blocks[i]?.rotation?.groupingId);

describe('the lift — a circuit saved before sets existed reads forward (G3)', () => {
  const legacy = {
    blocks: [{
      id: 'circ', title: 'Skills circuit', duration: { minutes: 30 },
      stations: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      rotation: { intervalMinutes: 15, groupSource: 'random', groups: [{ id: 'g1', name: 'Group A', playerIds: ['p1'] }, { id: 'g2', name: 'Group B', playerIds: ['p2'] }] },
    }],
  };

  it('its groups become one of the practice\'s sets, named after the block, and the rotation points at it', () => {
    const p = sanitizePracticePlan(legacy)!;
    const set = setOf(p)!;
    assert.equal(set.id, 'circ-groups', 'an id derived from the block — the same on every read');
    assert.equal(set.name, 'Skills circuit groups');
    assert.equal(set.groupSource, 'random', 'the source the coach drew with travels');
    assert.deepEqual(set.groups.map(g => g.id), ['g1', 'g2'], 'the group ids a hand arrangement names are kept');
    assert.equal((p.blocks[0].rotation as unknown as Record<string, unknown>).groups, undefined, 'nothing is written the old way again');
  });

  it('is idempotent — the sanitiser runs on every read and every write', () => {
    const once = sanitizePracticePlan(legacy);
    assert.deepEqual(sanitizePracticePlan(JSON.parse(JSON.stringify(once))), once);
  });

  it('a stale rotation on a block that no longer rotates lands its people on the stations and leaves no set behind', () => {
    const p = sanitizePracticePlan({ blocks: [{ ...legacy.blocks[0], rotates: false }] })!;
    assert.deepEqual(p.blocks[0].stations?.map(s => s.playerIds), [['p1'], ['p2']]);
    assert.equal(p.groupings, undefined);
    assert.equal(p.blocks[0].rotation, undefined);
  });

  it('a rotation stored with no groups yet lifts nothing', () => {
    const p = sanitizePracticePlan({ blocks: [{ ...legacy.blocks[0], rotation: { intervalMinutes: 15, groups: [] } }] })!;
    assert.equal(p.groupings, undefined);
    assert.equal(p.blocks[0].rotation?.groupingId, undefined);
  });
});

describe('the one-level law with sets in it (owner ruling 2026-08-01, extended G1–G8)', () => {
  it('a pointer to a set that no longer exists points at nothing and goes', () => {
    const p = sanitizePracticePlan({ blocks: [{ id: 'w', title: 'Warm-up', duration: { minutes: 10 }, groupingId: 'gone' }] })!;
    assert.equal(p.blocks[0].groupingId, undefined);
  });

  it('a level holding names AND a set keeps the set — the set IS its people', () => {
    const p = sanitizePracticePlan({
      groupings: [pairs()],
      blocks: [{ id: 'w', title: 'Warm-up', duration: { minutes: 10 }, groupingId: 'tp', playerIds: ['p9'] }],
    })!;
    assert.equal(p.blocks[0].groupingId, 'tp');
    assert.equal(p.blocks[0].playerIds, undefined);
  });

  it('a block "in pairs" that gains ONE station keeps its pairs there (people move, never vanish — D8)', () => {
    const p = settlePlanLevels(plan({
      groupings: [pairs()],
      blocks: [{ id: 'w', title: 'Warm-up', duration: { minutes: 10 }, groupingId: 'tp', stations: [{ id: 's', name: 'Warm-up' }] }],
    }));
    assert.equal(p.blocks[0].groupingId, undefined);
    assert.equal(p.blocks[0].stations?.[0].groupingId, 'tp');
  });

  it('a block using a set that becomes a CIRCUIT hands the circuit the set whole', () => {
    const p = settlePlanLevels(plan({
      groupings: [pairs('cg', 'Circuit groups')],
      blocks: [{ id: 'c', title: 'Circuit', duration: { minutes: 30 }, groupingId: 'cg', stations: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }],
    }));
    assert.equal(p.blocks[0].rotation?.groupingId, 'cg');
    assert.equal(p.blocks[0].groupingId, undefined);
    assert.equal(p.groupings?.length, 1, 'no second set dealt');
  });

  it('rotating turns on with names on the stations → a NEW set dealt in stored order; the station\'s set, used by nothing now, leaves the list', () => {
    const p = settlePlanLevels(plan({
      groupings: [pairs()],
      blocks: [{
        id: 'c', title: 'Circuit', duration: { minutes: 30 },
        stations: [{ id: 'a', name: 'A', playerIds: ['p5', 'p6'] }, { id: 'b', name: 'B', groupingId: 'tp' }],
      }],
    }));
    const set = setOf(p)!;
    assert.equal(set.id, 'c-groups');
    assert.equal(set.name, 'Circuit groups');
    assert.deepEqual(set.groups.flatMap(g => g.playerIds), ['p5', 'p6', 'p1', 'p2', 'p3', 'p4']);
    assert.ok(p.blocks[0].stations?.every(s => s.playerIds === undefined && s.groupingId === undefined));
    assert.equal(groupingById(p.groupings, 'tp'), undefined, 'its players are in the circuit now — a set lasts as long as something uses it');
  });

  it('the last station goes: a set the COACH made comes home as the block\'s own — the pairs stay pairs', () => {
    const p = settlePlanLevels(plan({
      groupings: [pairs('cg', 'Circuit groups')],
      blocks: [{ id: 'c', title: 'Circuit', duration: { minutes: 30 }, rotation: { intervalMinutes: 15, groupingId: 'cg' } }],
    }));
    assert.equal(p.blocks[0].groupingId, 'cg');
    assert.equal(p.blocks[0].rotation, undefined);
  });

  it('…but a set the PLAN dealt dissolves back into names when nothing else uses it (an abandoned "+ Stations" leaves nothing)', () => {
    const dealt = { ...pairs('c-groups', 'Circuit groups') };
    const alone = settlePlanLevels(plan({
      groupings: [dealt],
      blocks: [{ id: 'c', title: 'Circuit', duration: { minutes: 30 }, rotation: { intervalMinutes: 15, groupingId: 'c-groups' } }],
    }));
    assert.deepEqual(alone.blocks[0].playerIds, ['p1', 'p2', 'p3', 'p4']);
    assert.equal(alone.groupings, undefined);

    const shared = settlePlanLevels(plan({
      groupings: [dealt],
      blocks: [
        { id: 'c', title: 'Circuit', duration: { minutes: 30 }, rotation: { intervalMinutes: 15, groupingId: 'c-groups' } },
        { id: 'w', title: 'Warm-up', duration: { minutes: 10 }, groupingId: 'c-groups' },
      ],
    }));
    assert.equal(shared.blocks[0].groupingId, 'c-groups', 'shared — it stays a set');
    assert.equal(shared.groupings?.length, 1);
  });

  it('a set lasts as long as something uses it — its last use leaving takes it off the list (owner, 2026-09-28)', () => {
    const used = plan({ groupings: [pairs()], blocks: [{ id: 'w', title: 'Warm-up', duration: { minutes: 10 }, groupingId: 'tp' }] });
    assert.equal(settlePlanLevels(used).groupings?.length, 1, 'used: it stays');
    const left = settlePlanLevels({ ...used, blocks: [{ ...used.blocks[0], groupingId: undefined }] });
    assert.equal(left.groupings, undefined, 'the block went back to the whole team: the set goes with its last use');
    const copyLeft = settlePlanLevels(plan({
      groupings: [pairs(), pairs('copy', 'Throwing partners (copy)')],
      blocks: [{ id: 'w', title: 'Warm-up', duration: { minutes: 10 }, groupingId: 'tp' }],
    }));
    assert.deepEqual(copyLeft.groupings?.map(s => s.name), ['Throwing partners'], 'a copy nothing uses does not linger');
  });

  it('…except a set made from the Groups list itself: it stands unused, and is ordinary once something uses it', () => {
    const standing = settlePlanLevels(plan({ groupings: [{ ...pairs(), standing: true }] }));
    assert.equal(standing.groupings?.[0].standing, true, 'made for the night, nothing uses it yet — it stays');
    const picked = settlePlanLevels({ ...standing, blocks: [{ id: 'w', title: 'Warm-up', duration: { minutes: 10 }, groupingId: 'tp' }] });
    assert.equal(picked.groupings?.[0].standing, undefined, 'a block picked it — it is ordinary now');
    const leftAgain = settlePlanLevels({ ...picked, blocks: [{ ...picked.blocks[0], groupingId: undefined }] });
    assert.equal(leftAgain.groupings, undefined, 'and leaves with its last use like any other');
  });

  it('settling twice changes nothing (the editor and the sanitiser both run it)', () => {
    const p = plan({
      groupings: [pairs()],
      blocks: [{
        id: 'c', title: 'Circuit', duration: { minutes: 30 },
        stations: [{ id: 'a', name: 'A', playerIds: ['p5'] }, { id: 'b', name: 'B', groupingId: 'tp' }],
      }],
    });
    const once = settlePlanLevels(p);
    assert.equal(settlePlanLevels(once), once, 'the same object back — nothing left to move');
  });

  it('a plan holding only a set made "for tonight" (from the Groups list) is not empty — it is stored', () => {
    const tonight = { ...pairs(), standing: true as const };
    assert.equal(isPracticePlanEmpty(plan({ groupings: [tonight] })), false);
    assert.ok(sanitizePracticePlan({ groupings: [tonight], blocks: [] })?.groupings?.length);
  });

  it('restricts a set\'s players — and who it is for — to the current roster', () => {
    const p = sanitizePracticePlan({ groupings: [{ ...pairs(), forPlayerIds: ['p1', 'gone'], standing: true }], blocks: [] }, new Set(['p1', 'p3']))!;
    assert.deepEqual(p.groupings![0].groups.map(g => g.playerIds), [['p1'], ['p3']]);
    assert.deepEqual(p.groupings![0].forPlayerIds, ['p1']);
  });
});

describe('pairs speak as pairs (G5)', () => {
  it('a draw of two a group names its groups "Pair 1", "Pair 2"', () => {
    const drawn = drawGroups(['a', 'b', 'c', 'd'], 'perGroup', 2, () => 0.5);
    assert.deepEqual(drawn.map(g => g.name), ['Pair 1', 'Pair 2']);
    assert.deepEqual(drawGroups(['a', 'b', 'c'], 'groups', 3, () => 0.5).map(g => g.name), ['Group A', 'Group B', 'Group C']);
  });

  it('a set is pairs when every group anyone is in holds two — an odd player out makes it groups, honestly', () => {
    assert.equal(isPairSet(pairs()), true);
    assert.equal(groupingShape(pairs()), '2 pairs');
    assert.deepEqual(groupingWords(pairs()), { one: 'pair', many: 'pairs', inWord: 'In pairs', notIn: 'Not in a pair' });
    const odd = { ...pairs(), groups: [...pairs().groups, { id: 'x', name: 'Pair 3', playerIds: ['p5'] }] };
    assert.equal(isPairSet(odd), false);
    assert.equal(groupingShape(odd), '3 groups');
  });

  it('a set MADE as pairs keeps saying pairs when hand moves leave it uneven — and says what is uneven (owner, 2026-09-28)', () => {
    const madeAsPairs = {
      draw: { mode: 'perGroup' as const, n: 2 },
      groups: [
        { id: 'a', name: 'Pair 1', playerIds: ['p1', 'p2', 'p3'] },
        { id: 'b', name: 'Pair 2', playerIds: ['p4', 'p5'] },
        { id: 'c', name: 'Pair 3', playerIds: ['p6'] },
      ],
    };
    assert.equal(isPairSet(madeAsPairs), true);
    assert.equal(groupingShape(madeAsPairs), '3 pairs · one of 3, one of 1');
    assert.equal(groupingWords(madeAsPairs).notIn, 'Not in a pair');
    const madeAsGroups = { ...madeAsPairs, draw: { mode: 'groups' as const, n: 3 } };
    assert.equal(groupingShape(madeAsGroups), '3 groups', 'a set made as groups stays groups');
  });

  it('an empty set reads by how it draws — a template\'s "in pairs"', () => {
    const shape = { groups: [], draw: { mode: 'perGroup' as const, n: 2 } };
    assert.equal(isPairSet(shape), true);
    assert.equal(groupingShape(shape), 'no pairs yet');
    assert.equal(groupingShape({ groups: [] }), 'no groups yet');
  });

  it('a pair reads "Avery & Gray"; a name the reader may not see is left out, never "&"-ed', () => {
    const names: Record<string, string> = { p1: 'Avery', p2: 'Gray' };
    assert.equal(groupNames(pairs().groups[0], id => names[id] ?? '', true), 'Avery & Gray');
    assert.equal(groupNames(pairs().groups[1], id => names[id] ?? '', true), '');
    assert.equal(groupNames({ id: 'g', name: 'A', playerIds: ['p1', 'p2', 'p9'] }, id => names[id] ?? '', false), 'Avery, Gray');
  });
});

describe('who a set is for, and where it is used', () => {
  const roster = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map(id => ({ id }));

  it('"Not in a pair" names the roster for a whole-team set, and only the chosen for a set made from chosen players', () => {
    assert.deepEqual(unplacedInSet(pairs(), roster).map(p => p.id), ['p5', 'p6']);
    assert.deepEqual(unplacedInSet({ ...pairs(), forPlayerIds: ['p1', 'p2', 'p3', 'p4'] }, roster), []);
  });

  it('names every place a set is used — a block, a separate station ("Block → Station"), a sole station as its block, a circuit', () => {
    const p = plan({
      groupings: [pairs(), pairs('bat', 'Batteries'), pairs('cg', 'Circuit groups')],
      blocks: [
        { id: 'w', title: 'Warm-up', duration: { minutes: 10 }, groupingId: 'tp' },
        { id: 'pt', title: 'Partner throwing', duration: { minutes: 15 }, stations: [{ id: 'sole', name: 'Partner throwing', groupingId: 'tp' }] },
        { id: 'wp', title: 'Warm up pitchers', rotates: false, duration: { minutes: 15 },
          stations: [{ id: 'bp', name: 'Bullpen', groupingId: 'bat' }, { id: 'lt', name: 'Long toss' }] },
        { id: 'sc', title: 'Skills circuit', duration: { minutes: 45 },
          stations: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], rotation: { intervalMinutes: 15, groupingId: 'cg' } },
      ],
    });
    const uses = groupingUses(p);
    assert.deepEqual(uses.get('tp')?.map(u => u.label), ['Warm-up', 'Partner throwing']);
    assert.deepEqual(uses.get('bat')?.map(u => u.label), ['Warm up pitchers → Bullpen']);
    assert.deepEqual(uses.get('cg')?.map(u => [u.label, u.rotates]), [['Skills circuit', true]]);
    assert.deepEqual([...usedGroupingIds(p)].sort(), ['bat', 'cg', 'tp']);
    assert.deepEqual(rotationInput(p.groupings, p.blocks[3])?.groups.map(g => g.id), ['cg-1', 'cg-2']);
  });

  it('a new set\'s name is never one already on the practice', () => {
    assert.equal(nextGroupingName([{ name: 'Pairs' }, { name: 'Pairs 2' }], 'Pairs'), 'Pairs 3');
    assert.equal(nextGroupingName(undefined, 'Groups'), 'Groups');
  });
});

describe('copies — a separate copy, another practice\'s set, a template (G1 · G6)', () => {
  let n = 0;
  const ids = () => `id-${++n}`;

  it('a copy has fresh ids for itself and every group, and leaves behind anyone off tonight\'s roster', () => {
    const copy = copyGrouping(pairs(), { name: 'Batteries', groupSource: 'previous', rosterIds: new Set(['p1', 'p2', 'p3']) }, ids);
    assert.notEqual(copy.id, 'tp');
    assert.ok(copy.groups.every(g => !g.id.startsWith('tp')));
    assert.deepEqual(copy.groups.map(g => g.playerIds), [['p1', 'p2'], ['p3']]);
    assert.equal(copy.groupSource, 'previous');
    assert.equal(copy.name, 'Batteries');
  });

  it('"From another practice" lists every set with anyone in it, newest practice first', () => {
    const list = groupingsFromPractices([
      { eventId: 'e1', name: 'Tue', startsAt: '2026-09-22T22:00:00Z', plan: plan({ groupings: [pairs()] }) },
      { eventId: 'e2', name: 'Thu', startsAt: '2026-09-24T22:00:00Z', plan: plan({ groupings: [pairs('bat', 'Batteries'), { id: 'e', name: 'Empty', groupSource: 'manual', groups: [] }] }) },
      { eventId: 'e3', name: 'No plan', startsAt: '2026-09-25T22:00:00Z', plan: null },
    ]);
    assert.deepEqual(list.map(l => `${l.eventId}:${l.set.name}`), ['e2:Batteries', 'e1:Throwing partners']);
  });

  it('copying a whole plan forward carries its sets, each pointer following its own set', () => {
    const src = plan({
      groupings: [pairs()],
      blocks: [{ id: 'w', title: 'Warm-up', duration: { minutes: 10 }, groupingId: 'tp' }],
    });
    const copy = copyPracticePlanForReuse(src, new Set(['p1', 'p2', 'p3', 'p4']), ids);
    assert.equal(copy.groupings?.length, 1);
    assert.notEqual(copy.groupings![0].id, 'tp');
    assert.equal(copy.blocks[0].groupingId, copy.groupings![0].id);
  });

  it('a TEMPLATE keeps each set\'s shape — its name and "in pairs" — and nobody in it; loading one repoints fresh sets', () => {
    const shape = planToTemplateShape(plan({
      groupings: [{ ...pairs(), forPlayerIds: ['p1'] }],
      blocks: [{ id: 'w', title: 'Warm-up', duration: { minutes: 10 }, groupingId: 'tp' }],
    }));
    const set = shape.groupings![0];
    assert.deepEqual(set.groups, []);
    assert.equal(set.forPlayerIds, undefined);
    assert.deepEqual(set.draw, { mode: 'perGroup', n: 2 }, 'a set drawn before `draw` existed still knows it was pairs');
    assert.equal(shape.blocks[0].groupingId, 'tp');
    const loaded = templateToPlan({ id: 't', name: 'Standard Tuesday', plan: shape }, ids);
    assert.notEqual(loaded.groupings![0].id, 'tp');
    assert.equal(loaded.blocks[0].groupingId, loaded.groupings![0].id);
  });
});

describe('the printed sheet names a set once (G8)', () => {
  const settings = {
    headerLine1: 'Club', showDateStamp: false, showPageNumbers: false, showBranding: false, orientation: 'portrait' as const,
    headerColor: '#1e293b', logoUrl: null,
  } as unknown as Parameters<typeof buildPracticeSheet>[0]['settings'];
  const roster = [
    { id: 'p1', playerFirstName: 'Avery', playerLastName: 'A', playerNumber: null },
    { id: 'p2', playerFirstName: 'Gray', playerLastName: 'G', playerNumber: null },
    { id: 'p3', playerFirstName: 'Casey', playerLastName: 'C', playerNumber: null },
    { id: 'p4', playerFirstName: 'Indigo', playerLastName: 'I', playerNumber: null },
  ];
  const sheet = buildPracticeSheet({
    plan: plan({
      groupings: [pairs()],
      blocks: [
        { id: 'w', title: 'Warm-up', duration: { minutes: 10 }, groupingId: 'tp' },
        { id: 'pt', title: 'Partner throwing', duration: { minutes: 15 }, groupingId: 'tp' },
      ],
    }),
    event: { startsAt: '2026-10-01T22:00:00Z', endsAt: null },
    teamName: 'Team', sport: 'baseball', roster, goals: [], canViewFocus: false,
    staffTags: [], equipmentTags: [], planTagIds: [], focusTags: [], settings,
  });

  it('says the set on each block\'s line, and prints the pairs under the FIRST block only', () => {
    assert.equal(sheet.blocks[0].players, 'In pairs, Throwing partners');
    assert.equal(sheet.blocks[1].players, 'In pairs, Throwing partners');
    assert.equal(sheet.blocks[0].rotation?.groups.length, 1, 'one line of pairs');
    assert.match(sheet.blocks[0].rotation!.groups[0].players, /&/);
    assert.equal(sheet.blocks[1].rotation, null, 'not repeated');
  });
});
