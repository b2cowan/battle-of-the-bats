import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DRILL_MINUTES,
  collectDrillCategories,
  detachStationFromDrill,
  drillToStation,
  sortDrillsForPicker,
  stationIsFromDrill,
  stationToDrillInput,
  validateDrillInput,
} from '../../lib/rep-drills.ts';
import { countDrillUses, collectImportableDrills } from '../../lib/rep-drill-usage.ts';
import { resolveStationTeaching, sanitizePracticePlan } from '../../lib/rep-practice-plan.ts';
import type { RepTeamDrill } from '../../lib/types.ts';

function drill(over: Partial<RepTeamDrill> = {}): RepTeamDrill {
  return {
    id: 'd1', orgId: 'o1', teamId: 't1', name: 'Front toss', category: 'Hitting',
    usualMinutes: 12, description: 'Feeder kneels behind the screen.', goal: 'Hands inside the ball.',
    coachingPoints: ['Choke up', 'Widen the stance'], setup: 'Screen at 45°', equipment: ['Screen', 'Balls'],
    isActive: true, sortOrder: 0, createdBy: null, createdAt: '', updatedAt: '', ...over,
  };
}

describe('drill input validation', () => {
  it('requires a name — a drill is created by a deliberate submit, not autosave', () => {
    assert.ok('error' in validateDrillInput({ name: '   ' }));
    assert.ok('error' in validateDrillInput({}));
    assert.ok('error' in validateDrillInput(null));
  });

  it('accepts a name alone — everything else is optional', () => {
    const r = validateDrillInput({ name: 'Warm-up' });
    assert.ok('drill' in r);
    assert.equal(r.drill.name, 'Warm-up');
    assert.equal(r.drill.category, null);
    assert.equal(r.drill.usualMinutes, null);
  });

  it('rejects an out-of-range usual length rather than silently dropping it', () => {
    assert.ok('error' in validateDrillInput({ name: 'X', usualMinutes: 0 }));
    assert.ok('error' in validateDrillInput({ name: 'X', usualMinutes: MAX_DRILL_MINUTES + 1 }));
    assert.ok('error' in validateDrillInput({ name: 'X', usualMinutes: -5 }));
    // Blank means "not set", which is different from "invalid".
    const blank = validateDrillInput({ name: 'X', usualMinutes: '' });
    assert.ok('drill' in blank && blank.drill.usualMinutes === null);
  });

  it('de-duplicates equipment and coaching points case-insensitively', () => {
    const r = validateDrillInput({ name: 'X', equipment: ['Balls', 'balls', 'Net'], coachingPoints: ['a', 'A'] });
    assert.ok('drill' in r);
    assert.deepEqual(r.drill.equipment, ['Balls', 'Net']);
    assert.deepEqual(r.drill.coachingPoints, ['a']);
  });

  it('there is no "count" field anywhere on a drill (owner ruling 2026-08-01)', () => {
    const r = validateDrillInput({ name: 'X', count: 3 });
    assert.ok('drill' in r);
    assert.ok(!('count' in r.drill));
  });
});

describe('a picked drill brings the shape, empty of people (D20)', () => {
  it('copies every word and carries NO people', () => {
    const s = drillToStation(drill(), () => 's1');
    assert.equal(s.name, 'Front toss');
    assert.equal(s.description, 'Feeder kneels behind the screen.');
    assert.equal(s.goal, 'Hands inside the ball.');
    assert.deepEqual(s.coachingPoints, ['Choke up', 'Widen the stance']);
    assert.equal(s.setup, 'Screen at 45°');
    assert.deepEqual(s.equipment, ['Screen', 'Balls']);
    // The invariant that keeps "people live at exactly one level" intact.
    assert.equal(s.staff, undefined);
    assert.equal(s.playerIds, undefined);
    // And never a note — "just for tonight" must not travel in either direction.
    assert.equal(s.note, undefined);
  });

  it('carries provenance and a category SNAPSHOT, not a live reference', () => {
    const s = drillToStation(drill(), () => 's1');
    assert.equal(s.drillId, 'd1');
    assert.equal(s.drillCategory, 'Hitting');
    assert.ok(stationIsFromDrill(s));
  });

  it('mutating the drill afterwards cannot reach a station already placed', () => {
    const d = drill();
    const s = drillToStation(d, () => 's1');
    d.coachingPoints.push('Shorter stride');
    d.equipment.push('Tee');
    assert.deepEqual(s.coachingPoints, ['Choke up', 'Widen the stance']);
    assert.deepEqual(s.equipment, ['Screen', 'Balls']);
  });

  it('omits fields the drill does not have rather than writing empty strings', () => {
    const s = drillToStation(drill({ description: null, goal: null, setup: null, coachingPoints: [], equipment: [], category: null }), () => 's1');
    assert.ok(!('description' in s));
    assert.ok(!('goal' in s));
    assert.ok(!('setup' in s));
    assert.ok(!('coachingPoints' in s));
    assert.ok(!('equipment' in s));
    assert.ok(!('drillCategory' in s));
  });
});

describe('detaching — "Edit just for this practice"', () => {
  it('keeps every word and drops ONLY the identity', () => {
    const s = drillToStation(drill(), () => 's1');
    const d = detachStationFromDrill({ ...s, staff: ['Craig'], note: 'tonight' });
    assert.equal(d.name, 'Front toss');
    assert.equal(d.description, 'Feeder kneels behind the screen.');
    assert.deepEqual(d.coachingPoints, ['Choke up', 'Widen the stance']);
    assert.deepEqual(d.staff, ['Craig']);
    assert.equal(d.note, 'tonight');
    // The point of the whole read-only rule: this is no longer that drill.
    assert.equal(d.drillId, undefined);
    assert.equal(d.drillCategory, undefined);
    assert.equal(stationIsFromDrill(d), false);
  });

  it('does not mutate the station it was given', () => {
    const s = drillToStation(drill(), () => 's1');
    detachStationFromDrill(s);
    assert.equal(s.drillId, 'd1');
  });
});

describe('promotion (D18) drops the people, keeps the shape', () => {
  it('carries the teaching and refuses to carry the practice', () => {
    const input = stationToDrillInput({
      id: 's1', name: 'Short hops', description: 'Roll short hops', goal: 'Stay low',
      coachingPoints: ['soft hands'], setup: 'Two lines', equipment: ['Balls'],
      staff: ['Adam'], playerIds: ['p1', 'p2'], note: 'only 8 tonight',
    }, ' Fielding ');
    assert.equal(input.name, 'Short hops');
    assert.equal(input.category, 'Fielding');
    assert.equal(input.description, 'Roll short hops');
    assert.deepEqual(input.equipment, ['Balls']);
    assert.ok(!('staff' in input));
    assert.ok(!('playerIds' in input));
    assert.ok(!('note' in input));
  });

  it('an empty category is null, not an empty string', () => {
    assert.equal(stationToDrillInput({ id: 's', name: 'X' }, '   ').category, null);
    assert.equal(stationToDrillInput({ id: 's', name: 'X' }).category, null);
  });
});

describe('ordering and categories', () => {
  it('shared club drills lead, then the team’s own, each A–Z — and NEVER by use', () => {
    const sorted = sortDrillsForPicker([
      { name: 'Zebra', teamId: 't1' },
      { name: 'Apple', teamId: 't1' },
      { name: 'Yak', teamId: null },
      { name: 'Bee', teamId: null },
    ]);
    assert.deepEqual(sorted.map(d => d.name), ['Bee', 'Yak', 'Apple', 'Zebra']);
  });

  it('collects distinct categories in first-seen order, ignoring case and blanks', () => {
    assert.deepEqual(
      collectDrillCategories([
        { category: 'Hitting' }, { category: 'hitting' }, { category: null },
        { category: '  ' }, { category: 'Fielding' },
      ]),
      ['Hitting', 'Fielding'],
    );
  });
});

describe('use counts — a fact about a DRILL, never about a child', () => {
  const planWith = (stations: unknown[]) => sanitizePracticePlan({
    blocks: [{ title: 'B', duration: { minutes: 20 }, rotates: false, stations }],
  });

  it('counts stations still attached to their drill', () => {
    const counts = countDrillUses([
      planWith([{ name: 'a', drillId: 'd1' }, { name: 'b', drillId: 'd2' }]),
      planWith([{ name: 'c', drillId: 'd1' }]),
    ]);
    assert.equal(counts.get('d1'), 2);
    assert.equal(counts.get('d2'), 1);
  });

  it('a DETACHED station stops counting — it is no longer that drill', () => {
    const counts = countDrillUses([planWith([{ name: 'a' }, { name: 'b', drillId: 'd1' }])]);
    assert.equal(counts.get('d1'), 1);
    assert.equal(counts.size, 1);
  });

  it('tolerates null plans and plans with no stations', () => {
    assert.equal(countDrillUses([null, planWith([])]).size, 0);
  });
});

describe('importing from a past season', () => {
  const plan = (stations: unknown[]) => sanitizePracticePlan({
    blocks: [{ title: 'B', duration: { minutes: 20 }, rotates: false, stations }],
  });

  it('de-duplicates by name and keeps the MOST RECENT wording', () => {
    const rows = collectImportableDrills([
      { plan: plan([{ name: 'Front toss', description: 'old words' }]), startsAt: '2025-05-01T00:00:00Z' },
      { plan: plan([{ name: 'front toss', description: 'newer words' }]), startsAt: '2025-08-01T00:00:00Z' },
    ], []);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].drill.name, 'front toss');
    assert.equal(rows[0].drill.description, 'newer words');
    assert.equal(rows[0].planCount, 2);
    assert.equal(rows[0].lastPlannedAt, '2025-08-01T00:00:00Z');
  });

  it('skips stations that already came from a drill — importing those is a duplicate loop', () => {
    const rows = collectImportableDrills(
      [{ plan: plan([{ name: 'From library', drillId: 'd1' }, { name: 'Typed' }]), startsAt: '2025-05-01T00:00:00Z' }],
      [],
    );
    assert.deepEqual(rows.map(r => r.drill.name), ['Typed']);
  });

  it('flags what is already in the library rather than hiding it', () => {
    const rows = collectImportableDrills(
      [{ plan: plan([{ name: 'Front toss' }, { name: 'Ladder' }]), startsAt: '2025-05-01T00:00:00Z' }],
      ['  FRONT TOSS '],
    );
    const byName = new Map(rows.map(r => [r.drill.name, r]));
    assert.equal(byName.get('Front toss')?.alreadyInLibrary, true);
    assert.equal(byName.get('Ladder')?.alreadyInLibrary, false);
    // Shown, not removed.
    assert.equal(rows.length, 2);
  });

  it('NEVER infers a category from the words — that guess is forbidden (§4)', () => {
    const rows = collectImportableDrills(
      [{ plan: plan([{ name: 'Hitting off a tee' }]), startsAt: '2025-05-01T00:00:00Z' }],
      [],
    );
    assert.equal(rows[0].drill.category, null);
  });

  it('ignores unnamed stations', () => {
    const rows = collectImportableDrills(
      [{ plan: plan([{ setup: 'something' }]), startsAt: '2025-05-01T00:00:00Z' }],
      [],
    );
    assert.equal(rows.length, 0);
  });
});

describe('station teaching resolves against the block — FALL BACK, NEVER REPLACE', () => {
  it('a pre-Phase-2 plan (block-level teaching, no station teaching) still reads', () => {
    const t = resolveStationTeaching(
      { coachingPoints: undefined },
      { description: 'block does', goal: 'block watches', coachingPoints: ['block point'] },
    );
    assert.equal(t.description, 'block does');
    assert.equal(t.goal, 'block watches');
    assert.deepEqual(t.coachingPoints, ['block point']);
  });

  it('the station wins when it has its own words', () => {
    const t = resolveStationTeaching(
      { description: 'station does', goal: 'station watches', coachingPoints: ['station point'] },
      { description: 'block does', goal: 'block watches', coachingPoints: ['block point'] },
    );
    assert.equal(t.description, 'station does');
    assert.equal(t.goal, 'station watches');
    assert.deepEqual(t.coachingPoints, ['station point']);
  });

  it('an EMPTY station points list does not blank out the block’s', () => {
    const t = resolveStationTeaching({ coachingPoints: [] }, { coachingPoints: ['block point'] });
    assert.deepEqual(t.coachingPoints, ['block point']);
  });

  it('mixes: a station may override one field and inherit another', () => {
    const t = resolveStationTeaching({ goal: 'station watches' }, { description: 'block does', goal: 'block watches' });
    assert.equal(t.description, 'block does');
    assert.equal(t.goal, 'station watches');
  });

  it('both empty is empty, not a crash', () => {
    const t = resolveStationTeaching({}, {});
    assert.equal(t.description, undefined);
    assert.equal(t.goal, undefined);
    assert.deepEqual(t.coachingPoints, []);
  });
});

describe('the plan sanitiser round-trips the new station fields', () => {
  it('keeps description, goal and provenance, and stays IDEMPOTENT', () => {
    const raw = {
      blocks: [{
        title: 'B', duration: { minutes: 20 }, rotates: false,
        stations: [{ name: 'Front toss', description: 'doing', goal: 'watching', drillId: 'd1', drillCategory: 'Hitting' }],
      }],
    };
    const once = sanitizePracticePlan(raw);
    const twice = sanitizePracticePlan(once);
    assert.deepEqual(twice, once);
    const s = once?.blocks[0].stations?.[0];
    assert.equal(s?.description, 'doing');
    assert.equal(s?.goal, 'watching');
    assert.equal(s?.drillId, 'd1');
    assert.equal(s?.drillCategory, 'Hitting');
  });

  it('a rotating block still strips station players — a drill cannot smuggle people in', () => {
    const p = sanitizePracticePlan({
      blocks: [{
        title: 'B', duration: { minutes: 20 },
        stations: [{ name: 'A', drillId: 'd1', playerIds: ['p1'] }, { name: 'B', playerIds: ['p2'] }],
        rotation: { intervalMinutes: 10, groups: [{ name: 'Group A', playerIds: ['p1'] }], groupSource: 'manual' },
      }],
    });
    for (const s of p?.blocks[0].stations ?? []) assert.equal(s.playerIds, undefined);
  });
});
