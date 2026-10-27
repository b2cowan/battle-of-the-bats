import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isEmptyLeagueStep, leagueFingerprint, leagueRows, planLeagueChanges,
  type LeaguePractice, type LeagueSlot, type LeagueUse, type PracticeFace,
} from '../../lib/club-schedule-league-plan.ts';
import {
  familyClose, familyPartOpening, familyRowLines, familySubject, leagueCoachEmail, leagueGroupLine, leagueRowLine, type LeaguePlace,
} from '../../lib/club-schedule-league-words.ts';
import { mondayOfDay, utcToZonedInputs, zonedWallClockToUtc } from '../../lib/timezone.ts';
import { weekdayOf } from '../../lib/permit-time.ts';

/**
 * SEND THE CHANGES, HOUSE LEAGUE'S HALF (Club Tier Stage 11b Part 5; frames h4, k5; rulings 9d2·2, 9d2·16): what the club's
 * edits do to house-league practices when it sends — a use follows its moved time and its practices move by the slot's
 * shift; time taken back or cleared cancels them; a practice already held is never touched — and how the window and the
 * two emails say it.
 */

const ms = (day: string, time: string) => Date.parse(zonedWallClockToUtc(day, time)!);
const weekOfMs = (t: number) => mondayOfDay(utcToZonedInputs(new Date(t).toISOString()).date);
const NOW = ms('2026-11-01', '09:00');
const DOME = 'v-dome', F1 = 'f-1', F3 = 'f-3';

const slot = (id: string, day: string, start: string, end: string, o: Partial<LeagueSlot> = {}): LeagueSlot =>
  ({ id, startMs: ms(day, start), endMs: ms(day, end), venueId: DOME, facilityId: F1, removed: false, houseLeague: true, isNew: false, ...o });
const use = (slotId: string, o: Partial<LeagueUse> = {}): LeagueUse => ({ slotId, seasonId: 'fall', divisionId: 'u9', kind: 'practices', ...o });
const practice = (id: string, teamId: string, slotId: string, day: string, start: string, end: string, o: Partial<LeaguePractice> = {}): LeaguePractice =>
  ({ id, teamId, seasonId: 'fall', divisionId: 'u9', slotId, startMs: ms(day, start), endMs: ms(day, end), cancelled: false, ...o });

function plan(slots: LeagueSlot[], uses: LeagueUse[], practices: LeaguePractice[]) {
  return planLeagueChanges({ slots, uses, practices, nowMs: NOW, weekOfMs, locationOf: id => `Lakeshore Dome — ${id}` });
}

const places = new Map([[F1, 'Field 1'], [F3, 'Field 3']]);
const placeOf = (f: PracticeFace): LeaguePlace => ({ venue: f.venueId === DOME ? 'Lakeshore Dome' : 'Riverside Park', facility: f.facilityId ? places.get(f.facilityId) ?? null : null });
function facesFor(slots: LeagueSlot[]) {
  const byId = new Map(slots.map(s => [s.id, s]));
  return (t: number, end: number, slotId: string): PracticeFace => {
    const z = utcToZonedInputs(new Date(t).toISOString());
    return { day: z.date, weekday: weekdayOf(z.date), startClock: z.time, endClock: utcToZonedInputs(new Date(end).toISOString()).time, venueId: byId.get(slotId)!.venueId, facilityId: byId.get(slotId)!.facilityId };
  };
}

describe('a practice moves with its slot (h4)', () => {
  // The club moved Sunday's house-league slot from Field 1 at 11:00 to Field 3 at 12:30: the save soft-removed the old
  // slot (its use waiting on it) and made a new one house league holds with no use yet.
  const slots = [
    slot('a', '2026-11-08', '11:00', '14:00', { removed: true }),
    slot('a2', '2026-11-08', '12:30', '15:30', { facilityId: F3, isNew: true }),
  ];
  const uses = [use('a')];
  const practices = [practice('p1', 'reds', 'a', '2026-11-08', '11:00', '12:30'), practice('p2', 'blues', 'a', '2026-11-08', '12:30', '14:00')];
  const p = plan(slots, uses, practices);

  it('carries the use to where the time moved, first', () => {
    assert.deepEqual(p.step.uses, [{ from: 'a', to: 'a2' }]);
  });
  it('moves each practice by the slot\'s shift, keeping its length, at the new slot\'s place', () => {
    const reds = p.step.updates.find(u => u.practiceId === 'p1')!;
    assert.equal(reds.slotId, 'a2');
    assert.equal(Date.parse(reds.scheduledAt), ms('2026-11-08', '12:30'));
    assert.equal(Date.parse(reds.endsAt), ms('2026-11-08', '14:00'));
    assert.equal(reds.location, 'Lakeshore Dome — a2');
    assert.deepEqual(p.step.cancel, []);
  });
  it('says it as h4\'s row: only what changed', () => {
    const rows = leagueRows(p.changes, facesFor(slots), []);
    const reds = rows.find(r => r.teamId === 'reds')!;
    assert.equal(leagueRowLine(reds, placeOf), 'Sun, Nov 8: Field 1 → Field 3, 11:00 a.m. → 12:30 p.m.');
  });
});

describe('a weekly move reads as one row, "from" only when it runs to the end', () => {
  const weeks = ['2026-11-08', '2026-11-15', '2026-11-22'];
  const slots = weeks.flatMap((d, i) => [slot(`o${i}`, d, '11:00', '14:00'), slot(`n${i}`, d, '12:30', '15:30', { facilityId: F3, isNew: true })]);
  const practices = weeks.map((d, i) => practice(`p${i}`, 'reds', `o${i}`, d, '11:00', '12:30'));
  const uses = weeks.map((_, i) => use(`o${i}`));

  it('every Sunday moved: "Sundays from Nov 8"', () => {
    const s = slots.map(x => (x.id.startsWith('o') ? { ...x, removed: true } : x));
    const p = plan(s, uses, practices);
    const rows = leagueRows(p.changes, facesFor(s), []);
    assert.equal(rows.length, 1);
    assert.equal(leagueRowLine(rows[0], placeOf), 'Sundays from Nov 8: Field 1 → Field 3, 11:00 a.m. → 12:30 p.m.');
  });
  it('the last Sunday stays: a range, never "from" (a family must not read Nov 22 as moved)', () => {
    const s = slots.map(x => (x.id.startsWith('o') && x.id !== 'o2' ? { ...x, removed: true } : x)).filter(x => x.id !== 'n2');
    const p = plan(s, uses, practices);
    const stays = [{ teamId: 'reds', face: facesFor(s)(ms('2026-11-22', '11:00'), ms('2026-11-22', '12:30'), 'o2') }];
    const rows = leagueRows(p.changes, facesFor(s), stays);
    assert.equal(leagueRowLine(rows[0], placeOf), 'Sundays, Nov 8 – 15: Field 1 → Field 3, 11:00 a.m. → 12:30 p.m.');
  });
});

describe('time house league loses (k5, 9d2·16)', () => {
  it('taken back for a rep team, nothing gained that week: its practices are cancelled (older undivided time never takes them)', () => {
    const slots = [slot('b', '2026-11-12', '18:00', '21:00', { houseLeague: false }), slot('free', '2026-11-13', '18:00', '21:00')];
    const p = plan(slots, [use('b')], [practice('p1', 'reds', 'b', '2026-11-12', '18:00', '19:00')]);
    assert.deepEqual(p.step.uses, []);
    assert.deepEqual(p.step.cancel, ['p1']);
    assert.equal(p.changes[0].kind, 'cancelled');
    const rows = leagueRows(p.changes, facesFor(slots), []);
    assert.equal(leagueRowLine(rows[0], placeOf), 'Thu, Nov 12, 6:00 p.m. · Field 1: cancelled');
  });
  it('a hand drag on the grid (a holder swap: the old slot opens, the new one becomes house league’s) is a MOVE', () => {
    const slots = [slot('tue', '2026-11-10', '18:00', '21:00', { houseLeague: false }), slot('thu', '2026-11-12', '18:00', '21:00', { isNew: true })];
    const p = plan(slots, [use('tue')], [practice('p1', 'reds', 'tue', '2026-11-10', '18:00', '19:00')]);
    assert.deepEqual(p.step.uses, [{ from: 'tue', to: 'thu' }]);
    assert.equal(Date.parse(p.step.updates[0].scheduledAt), ms('2026-11-12', '18:00'));
    assert.deepEqual(p.step.cancel, []);
    const rows = leagueRows(p.changes, facesFor(slots), []);
    assert.equal(leagueRowLine(rows[0], placeOf), 'Tue, Nov 10 → Thu, Nov 12');
  });
  it('a slot cleared from the schedule, nothing in its week: cancelled', () => {
    const slots = [slot('c', '2026-11-12', '18:00', '21:00', { removed: true })];
    const p = plan(slots, [use('c')], [practice('p1', 'reds', 'c', '2026-11-12', '18:00', '19:00')]);
    assert.deepEqual(p.step, { uses: [], cancel: ['p1'], updates: [] });
  });
  it('a moved slot too short for a practice: the use still carries, that practice is cancelled (never a refused move)', () => {
    const slots = [slot('a', '2026-11-08', '11:00', '14:00', { removed: true }), slot('a2', '2026-11-08', '12:30', '14:00', { isNew: true })];
    const p = plan(slots, [use('a')], [practice('p1', 'reds', 'a', '2026-11-08', '11:00', '12:30'), practice('p2', 'blues', 'a', '2026-11-08', '12:30', '14:00')]);
    assert.deepEqual(p.step.uses, [{ from: 'a', to: 'a2' }]);
    assert.deepEqual(p.step.updates.map(u => u.practiceId), ['p1']);
    assert.deepEqual(p.step.cancel, ['p2']);
  });
  it('a game use carried: a practice on it is never moved onto it', () => {
    const slots = [slot('a', '2026-11-08', '11:00', '14:00', { removed: true }), slot('a2', '2026-11-08', '12:30', '15:30', { isNew: true })];
    const p = plan(slots, [use('a', { kind: 'games' })], [practice('p1', 'reds', 'a', '2026-11-08', '11:00', '12:30')]);
    assert.deepEqual(p.step.uses, [{ from: 'a', to: 'a2' }]);
    assert.deepEqual(p.step.cancel, ['p1']);
  });
});

describe('the /review of Part 5', () => {
  it('a use never pairs with OLDER time not given yet — only with a slot made since the last send', () => {
    // Sun's slot moved to Fri; an old undivided Tuesday in the same week sorts first, and must not take the division.
    const slots = [
      slot('a', '2026-11-08', '11:00', '14:00', { removed: true }),
      slot('tue', '2026-11-03', '10:00', '13:00'),
      slot('fri', '2026-11-06', '11:00', '14:00', { isNew: true }),
    ];
    const p = plan(slots, [use('a')], [practice('p1', 'reds', 'a', '2026-11-08', '11:00', '12:30')]);
    assert.deepEqual(p.step.uses, [{ from: 'a', to: 'fri' }]);
    assert.equal(p.step.updates[0].slotId, 'fri');
  });
  it('nearest first: a Thursday taken back never takes the Sunday that Sunday’s own slot moved to', () => {
    const slots = [
      slot('thu', '2026-11-12', '18:00', '21:00', { houseLeague: false }),
      slot('sun', '2026-11-15', '11:00', '14:00', { removed: true }),
      slot('sun2', '2026-11-15', '12:30', '15:30', { facilityId: F3, isNew: true }),
    ];
    const p = plan(slots, [use('thu'), use('sun')], [
      practice('pt', 'reds', 'thu', '2026-11-12', '18:00', '19:00'), practice('ps', 'reds', 'sun', '2026-11-15', '11:00', '12:30'),
    ]);
    assert.deepEqual(p.step.uses, [{ from: 'sun', to: 'sun2' }]);
    assert.deepEqual(p.step.cancel, ['pt']);
    assert.deepEqual(p.step.updates.map(u => u.practiceId), ['ps']);
  });
  it('a slot replaced at the same time and place: the practice follows the slot, and nobody is told', () => {
    const slots = [slot('a', '2026-11-08', '11:00', '14:00', { removed: true }), slot('a2', '2026-11-08', '11:00', '13:00', { isNew: true })];
    const p = plan(slots, [use('a')], [practice('p1', 'reds', 'a', '2026-11-08', '11:00', '12:30')]);
    assert.deepEqual(p.step.updates.map(u => u.practiceId), ['p1']);
    assert.deepEqual(p.changes, []);
  });
  it('a practice with no end runs to its slot\'s end, and moves with it rather than being cancelled', () => {
    const slots = [slot('a', '2026-11-08', '11:00', '12:00', { removed: true }), slot('a2', '2026-11-08', '12:00', '13:00', { isNew: true })];
    const p = plan(slots, [use('a')], [practice('p1', 'reds', 'a', '2026-11-08', '11:00', '12:00', { endMs: null })]);
    assert.equal(Date.parse(p.step.updates[0].endsAt), ms('2026-11-08', '13:00'));
    assert.equal(p.changes[0].kind, 'moved');
  });
});

describe('what the send leaves alone', () => {
  it('a practice already held is untouched (the step clears its link)', () => {
    const slots = [slot('old', '2026-10-25', '11:00', '14:00', { removed: true })];
    const p = plan(slots, [use('old')], [practice('p1', 'reds', 'old', '2026-10-25', '11:00', '12:30')]);
    assert.deepEqual(p.step.cancel, []);
    assert.deepEqual(p.changes, []);
  });
  it('a practice on time house league still holds, and a cancelled one, are untouched', () => {
    const slots = [slot('a', '2026-11-08', '11:00', '14:00'), slot('gone', '2026-11-09', '11:00', '14:00', { removed: true })];
    const p = plan(slots, [use('a')], [practice('p1', 'reds', 'a', '2026-11-08', '11:00', '12:30'), practice('p2', 'reds', 'gone', '2026-11-09', '11:00', '12:30', { cancelled: true })]);
    assert.ok(isEmptyLeagueStep(p.step));
    assert.deepEqual(p.changes, []);
  });
  it('nothing house-league in the send: an empty step, and the rep send unchanged', () => {
    const p = plan([slot('r', '2026-11-08', '11:00', '14:00', { houseLeague: false })], [], []);
    assert.ok(isEmptyLeagueStep(p.step));
  });
});

describe('the plan\'s fingerprint (what the owner saw)', () => {
  it('is the same whatever the order, and changes when a practice is added', () => {
    const a = { uses: [{ from: 'x', to: 'y' }], cancel: ['1', '2'], updates: [] };
    const b = { uses: [{ from: 'x', to: 'y' }], cancel: ['2', '1'], updates: [] };
    assert.equal(leagueFingerprint(a), leagueFingerprint(b));
    assert.notEqual(leagueFingerprint(a), leagueFingerprint({ ...a, cancel: ['1', '2', '3'] }));
  });
});

describe('the words (h4, settled; a cancel is /marketing\'s)', () => {
  const was: PracticeFace = { day: '2026-11-08', weekday: 7, startClock: '11:00', endClock: '12:30', venueId: DOME, facilityId: F1 };
  const now: PracticeFace = { day: '2026-11-08', weekday: 7, startClock: '12:30', endClock: '14:00', venueId: DOME, facilityId: F3 };
  const moved = { teamId: 'reds', kind: 'moved' as const, days: ['2026-11-08', '2026-11-15'], throughEnd: true, was, now };

  it('the group line: "House league · U9 Rookie · 2 coaches and 11 families"', () => {
    assert.equal(leagueGroupLine('U9 Rookie', 2, 11), 'House league · U9 Rookie · 2 coaches and 11 families');
    assert.equal(leagueGroupLine('U9 Rookie', 1, 1), 'House league · U9 Rookie · 1 coach and 1 family');
  });
  it('the families\' Now / Was: Now in full, Was only what changed', () => {
    assert.deepEqual(familyRowLines(moved, placeOf), [
      'Now: Sundays, 12:30–2:00 p.m. · Lakeshore Dome · Field 3',
      'Was: Sundays, 11:00 a.m.–12:30 p.m. · Field 1',
    ]);
  });
  it('a cancel, in the families\' email', () => {
    assert.deepEqual(familyRowLines({ ...moved, kind: 'cancelled', now: null, days: ['2026-11-08'] }, placeOf),
      ['Cancelled: Sun, Nov 8, 11:00 a.m.–12:30 p.m. · Lakeshore Dome · Field 1']);
  });
  it('one subject per household: one team, or several', () => {
    assert.equal(familySubject(['Reds']), 'Reds’ practices changed');
    assert.equal(familySubject(['Reds', 'Blues', 'Reds']), 'Practices changed for Reds and Blues');
    assert.equal(familyPartOpening('UAT Rep Club', 'Sam', 'Reds', '2026-11-08'), 'UAT Rep Club changed Sam’s practices with Reds, from Sun, Nov 8:');
    assert.equal(familyClose(['Reds']), 'Questions? Ask Reds’ coach.');
    assert.equal(familyClose(['Reds', 'Blues']), 'Questions? Ask the Reds or Blues coach.');
    assert.equal(familyClose(['Reds', 'Blues', 'Greens']), 'Questions? Ask the Reds, Blues, or Greens coach.');
  });
  it('the house-league coach\'s email: the rep coach\'s shape, its link the team page, the zone once', () => {
    const e = leagueCoachEmail({ orgName: 'UAT Rep Club', scheduleName: 'Winter dome', teamName: 'Reds', recipientNames: ['Pat Lee'], lines: ['x'], familiesTold: true, link: '/o/league/s/team/t', zoneSentence: 'Times in Eastern time.' });
    assert.equal(e.subject, 'Winter dome: Reds’ practices changed');
    assert.equal(e.paragraphs[0], 'UAT Rep Club changed Reds’ practices on Winter dome:');
    assert.equal(e.link?.label, 'Open Reds’ team page →');
    assert.equal(e.outro, 'Your families get this change too. Everything else stays as it was.');
    assert.equal(e.foot, 'Times in Eastern time.');
    const none = leagueCoachEmail({ orgName: 'C', scheduleName: 'S', teamName: 'Reds', recipientNames: [], lines: [], familiesTold: false, link: '/', zoneSentence: '' });
    assert.equal(none.outro, 'Everything else stays as it was.');
  });
});
