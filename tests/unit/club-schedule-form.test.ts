import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readScheduleSettings } from '../../lib/club-schedule-settings.ts';
import { ruleIsWhole, settingsDraftOf, settingsOf } from '../../lib/club-schedule-form.ts';

/**
 * NEW SCHEDULE'S FORM, ROUND TRIP (Club Tier Stage 11c, ratified 2026-10-12 — the build prompt's gate "a settings round
 * trip (form → parse → form) loses nothing"): what Settings… opens is exactly what was saved, every rule kind included.
 */

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [A, B, C, D, E] = [1, 2, 3, 4, 5].map(id);
const FIELD = id(90), GROUP = id(80);

const saved = {
  v: 2, slotMinutes: 90, changeoverMinutes: 10, teamIds: [A, B, C, D],
  split: { method: 'weekly', values: { [A]: 1, [B]: 1, [C]: 2, [D]: 2 } },
  timeMode: 'moved',
  prime: { weekdays: [1, 2, 3, 4, 5], start: '18:00', end: '20:00', share: 'even' },
  rules: {
    windows: [{ teamIds: [C], startAfter: null, startBy: null, finishBy: '20:00' }, { teamIds: [D], startAfter: '17:00', startBy: null, finishBy: '21:00' }],
    maxPerDay: 1, maxPerWeek: 3, avoidGameDays: true, avoidBookings: false, noBackToBack: true,
    daysOff: [{ teamId: D, date: '2026-12-20', weekday: null, note: 'Away at a tournament' }, { teamId: C, date: null, weekday: 2, note: null }],
    fieldsBy: [{ facilityIds: [FIELD], groupIds: [GROUP], teamIds: [] }],
    sharing: [{ teamIds: [C, D], groupIds: [], atOnce: 2 }],
  },
};

describe('New schedule: form → settings → form loses nothing (Stage 11c)', () => {
  const read = readScheduleSettings(saved);
  it('the saved shape reads', () => assert.equal(read.ok, true));
  const value = read.ok ? read.value : null!;
  const running = new Set([A, B, C, D, E]);
  it('every value comes back exactly through the window', () => {
    const draft = settingsDraftOf(value, running);
    const again = readScheduleSettings(settingsOf(draft, value.teamIds));
    assert.ok(again.ok);
    assert.deepEqual(again.ok && again.value, value);
  });
  it('the window holds each rule as one row, whole', () => {
    const draft = settingsDraftOf(value, running);
    assert.equal(draft.sharing.length, 1);
    assert.deepEqual(draft.sharing[0].who, [`t:${C}`, `t:${D}`]);
    assert.equal(draft.timeMode, 'moved');
    assert.ok(draft.windows.every(ruleIsWhole.windows) && draft.daysOff.every(ruleIsWhole.daysOff)
      && draft.fieldsBy.every(ruleIsWhole.fieldsBy) && draft.sharing.every(ruleIsWhole.sharing));
  });
  it('a team whose season ended leaves every rule it was in — its sharing rule too', () => {
    const draft = settingsDraftOf(value, new Set([A, B, C]));
    assert.deepEqual(draft.ticked, [A, B, C]);
    assert.deepEqual(draft.sharing[0].who, [`t:${C}`]);
    assert.equal(draft.windows.length, 1, 'D’s start-time rule goes with it');
    assert.equal(draft.daysOff.length, 1);
  });
  it('a rule opened and left half-filled is not sent', () => {
    const draft = settingsDraftOf(value, running);
    const out = settingsOf({ ...draft, sharing: [...draft.sharing, { key: 'new', who: [], atOnce: 2 }] }, value.teamIds);
    assert.equal(out.rules.sharing.length, 1);
  });
});
