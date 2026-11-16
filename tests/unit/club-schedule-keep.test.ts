import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cutSlots, type ScheduleBlock, type ScheduleTime, type Slot } from '../../lib/club-schedule-engine.ts';
import { defaultSettings } from '../../lib/club-schedule-settings.ts';
import {
  addedTime, blockHolds, pastPractices, pinnedSlots, slotsWithPinned, timeKeeping, type KeepChange, type KeepSlot,
} from '../../lib/club-schedule-keep.ts';
import { readSource } from './_source-code.ts';

/**
 * GUARD 4 OF THE SEVERAL-PERMITS BUILD (Session E; owner rulings S1 A, P10 A, P11 A): what a change to a schedule that
 * exists keeps EXACTLY as it is. On a sent schedule, Regenerate, Add time and "Take … off" never move a slot before today;
 * Add time cuts only the new rows; taking a permit off removes only that permit's slots (from today on, once sent).
 */

const K = 'venue-kinsmen', P = 'venue-prospect';
const FAC = new Map([[K, ['ka', 'kb']], [P, ['pa']]]);
const A = 'permit-milton', B = 'permit-halton', C = 'permit-june';
const TODAY = '2027-04-01'; // a Thursday
const settings = defaultSettings();

const row = (id: string, venueId: string, facilityIds: string[], weekdays: number[], permitId: string | null, more: Partial<ScheduleBlock> = {}): ScheduleBlock =>
  ({ id, venueId, facilityIds, weekdays, startTime: '18:00', endTime: '20:00', fromDate: null, untilDate: null, permitId, ...more });
const ROWS = [row('row-a', K, ['ka'], [2, 4], A), row('row-b', P, ['pa'], [1], B)];
const STORED_TIME = { startsOn: '2027-03-01', endsOn: '2027-04-30', blocks: ROWS, blockIds: ROWS.map(b => b.id), datesOff: [] };
const cut = (t: ScheduleTime) => cutSlots(t, { slotMinutes: 60, changeoverMinutes: 0, prime: null, venueFacilities: FAC });
/** The schedule as it was sent: every slot of its time, the teams taking turns. */
const STORED: KeepSlot[] = cut(STORED_TIME).map((s, i) => ({
  key: s.key, venueId: s.venueId, facilityId: s.facilityId, blockId: STORED_TIME.blockIds[s.blockIndex], permitId: s.permitId ?? null,
  startsAt: new Date(s.startMs).toISOString(), endsAt: new Date(s.endMs).toISOString(),
  teamIds: [i % 2 ? 't13' : 't11'], locked: false, movedByHand: false, removed: false,
}));
const PAST = STORED.filter(s => cut(STORED_TIME).find(x => x.key === s.key)!.day < TODAY);
const keepFor = (asked: ScheduleTime & { blockIds: (string | null)[] }, change: KeepChange, final: boolean) => {
  const stored = pinnedSlots(STORED, change, { final, today: TODAY });
  const k = timeKeeping(asked, STORED_TIME, stored, {
    settings, weightOf: () => 1, venueFacilities: FAC, pastFrom: final ? TODAY : null,
    freshBlocks: change.kind === 'add' ? 'new' : change.kind === 'take_off' ? 'none' : 'all',
  });
  return { k, stored, slots: slotsWithPinned(cut(k.time), k, FAC) };
};
const keyOf = (s: { key: string }) => s.key;
const asOf = (time: ScheduleTime, ids: (string | null)[]) => ({ ...time, blockIds: ids });

describe('which stored slots a change keeps exactly (pinnedSlots)', () => {
  it('a regenerate of a draft keeps nothing by day (the locked and moved stay Ask 19’s)', () => {
    assert.deepEqual(pinnedSlots(STORED, { kind: 'regenerate' }, { final: false, today: TODAY }), []);
  });
  it('a regenerate of a sent schedule keeps every slot before today, locked or not (P10 A)', () => {
    assert.ok(PAST.length > 0 && PAST.length < STORED.length);
    assert.deepEqual(pinnedSlots(STORED, { kind: 'regenerate' }, { final: true, today: TODAY }).map(keyOf), PAST.map(keyOf));
  });
  it('Add time keeps every slot on the schedule (S1 A)', () => {
    assert.equal(pinnedSlots(STORED, { kind: 'add' }, { final: true, today: TODAY }).length, STORED.length);
  });
  it('a slot already removed and waiting for Send the changes is not kept', () => {
    const gone = STORED.map((s, i) => (i === 0 ? { ...s, removed: true } : s));
    assert.equal(pinnedSlots(gone, { kind: 'add' }, { final: true, today: TODAY }).length, STORED.length - 1);
  });
});

describe('a sent schedule regenerated: nothing before today moves (F1, P10 A)', () => {
  it('the same time: every past slot is in the cut exactly, nothing new before today, and no row comes back', () => {
    const { k, slots } = keepFor(asOf(STORED_TIME, [null, null]), { kind: 'regenerate' }, true);
    assert.equal(k.time.blocks.length, 2);
    for (const s of PAST) assert.ok(slots.some(x => x.key === s.key), `kept ${s.key}`);
    // Every slot before today is a kept one: none is cut fresh.
    const past = new Set(PAST.map(keyOf));
    assert.ok(slots.filter(s => s.day < TODAY).every(s => past.has(s.key)));
    // And from today on the time is cut as asked.
    assert.ok(slots.some(s => s.day >= TODAY));
  });
  it('Tuesdays and Thursdays become Wednesdays and Thursdays: the played Tuesdays stay on their old row, ending yesterday', () => {
    const asked = asOf({ ...STORED_TIME, blocks: [row('n1', K, ['ka'], [3, 4], A), ROWS[1]] }, [null, null]);
    const { k, slots } = keepFor(asked, { kind: 'regenerate' }, true);
    const back = k.time.blocks.find(b => b.untilDate === '2027-03-31');
    assert.ok(back, 'the stored Tue/Thu row comes back, ending yesterday');
    assert.deepEqual(back!.weekdays, [2, 4]);
    // Its stored id goes with it, so the slots on it keep their row.
    assert.equal(k.time.blockIds[k.time.blocks.indexOf(back!)], 'row-a');
    // The new Wed/Thu row overlaps it on Thursdays, so it starts today.
    assert.equal(k.time.blocks[0].fromDate, TODAY);
    // Every played practice is exactly where it was, on a row that holds it.
    for (const s of PAST) {
      const kept = k.pinned.find(x => x.key === s.key)!;
      assert.ok(blockHolds(k.time.blocks[kept.blockIndex], kept, k.time), `row holds ${s.key}`);
      assert.ok(slots.some(x => x.key === s.key));
    }
    assert.ok(!slots.some(s => s.day < TODAY && s.weekday === 3), 'no Wednesday before today');
    assert.ok(slots.some(s => s.day >= TODAY && s.weekday === 3), 'Wednesdays from today on');
  });
  it('a row taken out by hand keeps its past: it comes back ending yesterday', () => {
    const asked = asOf({ ...STORED_TIME, blocks: [ROWS[0]] }, [null]);
    const { k, slots } = keepFor(asked, { kind: 'regenerate' }, true);
    const back = k.time.blocks.find(b => b.permitId === B);
    assert.equal(back?.untilDate, '2027-03-31');
    for (const s of PAST.filter(x => x.permitId === B)) assert.ok(slots.some(x => x.key === s.key));
    assert.ok(!slots.some(s => s.permitId === B && s.day >= TODAY));
  });
  it('a past date off taken now ("Take … off") leaves the practice played that day where it is', () => {
    const day = cut(STORED_TIME).find(s => s.day < TODAY)!.day;
    const asked = asOf({ ...STORED_TIME, datesOff: [{ day, note: null, venueIds: [] }] }, [null, null]);
    const { slots } = keepFor(asked, { kind: 'regenerate' }, true);
    assert.ok(PAST.filter(s => slots.find(x => x.key === s.key)?.day === day).length > 0);
  });
  it('the regenerate question counts the practices before today that stay', () => {
    const { k, stored } = keepFor(asOf(STORED_TIME, [null, null]), { kind: 'regenerate' }, true);
    assert.equal(pastPractices({ ...k, stored }), PAST.length);
    const open = stored.map((s, i) => (i === 0 ? { ...s, teamIds: [] } : s));
    assert.equal(pastPractices({ ...k, stored: open }), PAST.length - 1);
  });
});

describe('Add time: only the new rows are cut (S1 A)', () => {
  const june = row('', K, ['kb'], [2, 4], C, { fromDate: '2027-03-15', untilDate: '2027-05-31' });
  const added = (final: boolean) => keepFor(addedTime(STORED_TIME, { endsOn: '2027-05-31', blocks: [june], datesOff: [] }), { kind: 'add' }, final);
  it('every slot already on the schedule is in the cut exactly; the new ones come only from the new row', () => {
    const { k, slots } = added(false);
    assert.equal(k.time.endsOn, '2027-05-31');
    assert.equal(k.time.startsOn, STORED_TIME.startsOn);
    for (const s of STORED) assert.ok(slots.some(x => x.key === s.key), `kept ${s.key}`);
    const old = new Set(STORED.map(keyOf));
    const fresh = slots.filter(s => !old.has(s.key));
    assert.ok(fresh.length > 0);
    assert.ok(fresh.every(s => s.facilityId === 'kb' && s.permitId === C));
    // Kinsmen's Diamond A after Apr 30 is not new time: the schedule's own row is never cut again.
    assert.ok(!fresh.some(s => s.facilityId === 'ka'));
  });
  it('on a sent schedule the new row gives nothing before today', () => {
    const { slots } = added(true);
    const old = new Set(STORED.map(keyOf));
    assert.ok(slots.filter(s => !old.has(s.key)).every(s => s.day >= TODAY));
  });
  it('the schedule’s rows keep their ids; the new ones have none', () => {
    const { k } = added(true);
    assert.deepEqual(k.time.blockIds, ['row-a', 'row-b', null]);
  });
  it('the end widens for the new rows only: a row that ran to the old last day stops there', () => {
    const t = addedTime(STORED_TIME, { endsOn: '2027-05-31', blocks: [june], datesOff: [] });
    assert.deepEqual(t.blocks.slice(0, 2).map(b => b.untilDate), ['2027-04-30', '2027-04-30']);
    const same = addedTime(STORED_TIME, { endsOn: '2027-04-10', blocks: [june], datesOff: [] });
    assert.equal(same.endsOn, '2027-04-30');
    assert.deepEqual(same.blocks.slice(0, 2).map(b => b.untilDate), [null, null]);
  });
  it('a new row overlapping a kept slot on its facility gives no slot there', () => {
    const same = row('', K, ['ka'], [2], C, { startTime: '18:30', endTime: '19:30', fromDate: '2027-03-01', untilDate: '2027-04-30' });
    const t = addedTime(STORED_TIME, { endsOn: '2027-04-30', blocks: [same], datesOff: [] });
    const stored = pinnedSlots(STORED, { kind: 'add' }, { final: false, today: TODAY });
    const k = timeKeeping(t, STORED_TIME, stored, { settings, weightOf: () => 1, venueFacilities: FAC, pastFrom: null, freshBlocks: 'new' });
    // (The cut is asked of the new row alone here: two rows holding one evening are refused before this, by checkTime.)
    const fresh = cut({ ...k.time, blocks: [k.time.blocks[2]] }).map((s): Slot => ({ ...s, blockIndex: 2 }));
    assert.equal(slotsWithPinned(fresh, k, FAC).filter(s => s.permitId === C).length, 0);
  });
  it('the dates off join one per day: All venues stays all; named parks unite', () => {
    const t = addedTime({ ...STORED_TIME, datesOff: [{ day: '2027-04-05', note: 'Easter', venueIds: [] }, { day: '2027-04-06', note: null, venueIds: [P] }] },
      { endsOn: '2027-04-30', blocks: [june], datesOff: [{ day: '2027-04-05', note: null, venueIds: [K] }, { day: '2027-04-06', note: null, venueIds: [K] }, { day: '2027-04-07', note: 'x', venueIds: [K] }] });
    assert.deepEqual(t.datesOff, [
      { day: '2027-04-05', note: 'Easter', venueIds: [] },
      { day: '2027-04-06', note: null, venueIds: [P, K] },
      { day: '2027-04-07', note: 'x', venueIds: [K] },
    ]);
  });
});

describe('taking a permit off (P11 A)', () => {
  const without = asOf({ ...STORED_TIME, blocks: [ROWS[0]] }, ['row-a']);
  it('a draft: its slots and rows come off; nothing else moves; nothing is cut fresh', () => {
    const { k, slots } = keepFor(without, { kind: 'take_off', permitId: B }, false);
    assert.equal(k.time.blocks.length, 1);
    assert.deepEqual(slots.map(keyOf).sort(), STORED.filter(s => s.permitId !== B).map(keyOf).sort());
  });
  it('a sent schedule: its practices from today on come off; the played ones stay, on its row ending yesterday', () => {
    const { k, slots } = keepFor(without, { kind: 'take_off', permitId: B }, true);
    const want = STORED.filter(s => s.permitId !== B || PAST.includes(s)).map(keyOf).sort();
    assert.deepEqual(slots.map(keyOf).sort(), want);
    const back = k.time.blocks.find(b => b.permitId === B)!;
    assert.equal(back.untilDate, '2027-03-31');
    assert.equal(k.time.blockIds[k.time.blocks.indexOf(back)], 'row-b');
  });
});

describe('the routes ask the rule (source guard)', () => {
  it('every save and preview of a schedule’s time goes through keepingFor', () => {
    const gen = readSource('app/api/admin/schedules/generate/route.ts');
    assert.match(gen, /keepingFor\(loaded, askedTime, \{ kind: adding \? 'add' : 'regenerate' \}/);
    const one = readSource('app/api/admin/schedules/[scheduleId]/route.ts');
    // One save for the time (`keepTime`), asked by regenerate, add_time and take_permit_off.
    assert.equal(one.match(/draftToSave\(/g)?.length, 1);
    assert.match(one, /keepingFor\(loaded, asked\.time, change/);
    for (const kind of ["{ kind: 'regenerate' }", "{ kind: 'add' }", "{ kind: 'take_off', permitId }"]) assert.ok(one.includes(`keepTime(asked.value, ${kind}`), kind);
  });
});
