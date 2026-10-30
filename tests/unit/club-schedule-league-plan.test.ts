import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isEmptyLeagueStep, leagueFingerprint, leagueRows, planLeagueChanges,
  type LeaguePractice, type LeagueSlot, type LeagueSlotGame, type LeagueUse, type PracticeFace,
} from '../../lib/club-schedule-league-plan.ts';
import {
  LEAGUE_ADMIN_NOTICE, NO_LEAGUE_COUNTS, familyClose, familyPartOpening, familyRowLines, familySubject, leagueCoachEmail,
  leagueGamesLine, leagueGamesSub, leagueGroupLine, leagueRowLine, type LeaguePlace,
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
    assert.deepEqual(p.step, { uses: [], cancel: ['p1'], updates: [], games: { move: [], postpone: [], remove: [] } });
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
  const noGames = { move: [], postpone: [], remove: [] };
  it('is the same whatever the order, and changes when a practice is added', () => {
    const a = { uses: [{ from: 'x', to: 'y' }], cancel: ['1', '2'], updates: [], games: noGames };
    const b = { uses: [{ from: 'x', to: 'y' }], cancel: ['2', '1'], updates: [], games: noGames };
    assert.equal(leagueFingerprint(a), leagueFingerprint(b));
    assert.notEqual(leagueFingerprint(a), leagueFingerprint({ ...a, cancel: ['1', '2', '3'] }));
  });
  it('changes when a game\'s fate changes (9d-2b Part 5: a draft published since reads remove → postpone)', () => {
    const a = { uses: [], cancel: [], updates: [], games: { ...noGames, remove: ['g1'] } };
    assert.notEqual(leagueFingerprint(a), leagueFingerprint({ ...a, games: { ...noGames, postpone: ['g1'] } }));
    assert.notEqual(leagueFingerprint(a), leagueFingerprint({ ...a, games: noGames }));
  });
});

describe('a division\'s games follow the club\'s time (House League 9d-2b Part 5; 9d2·13, 9d2·16)', () => {
  const game = (id: string, slotId: string, day: string, start: string, end: string | null, o: Partial<LeagueSlotGame> = {}): LeagueSlotGame =>
    ({ id, seasonId: 'fall', divisionId: 'u12', slotId, startMs: ms(day, start), endMs: end ? ms(day, end) : null, status: 'scheduled', published: true, ...o });
  const gamesUse = (slotId: string) => use(slotId, { kind: 'games', divisionId: 'u12' });
  const planG = (slots: LeagueSlot[], uses: LeagueUse[], games: LeagueSlotGame[]) =>
    planLeagueChanges({ slots, uses, practices: [], games, nowMs: NOW, weekOfMs, locationOf: id => `Lakeshore Dome — ${id}` });
  const moved = [slot('a', '2026-11-08', '11:00', '14:00', { removed: true }), slot('a2', '2026-11-08', '12:30', '15:30', { facilityId: F3, isNew: true })];

  it('a published game moves by the slot\'s shift, at the new place, and is the club\'s change', () => {
    const p = planG(moved, [gamesUse('a')], [game('g1', 'a', '2026-11-08', '11:00', '12:30')]);
    assert.deepEqual(p.step.uses, [{ from: 'a', to: 'a2' }]);
    assert.deepEqual(p.step.games.move, [{
      gameId: 'g1', slotId: 'a2', scheduledAt: new Date(ms('2026-11-08', '12:30')).toISOString(),
      endsAt: new Date(ms('2026-11-08', '14:00')).toISOString(), location: 'Lakeshore Dome — a2',
    }]);
    assert.deepEqual(p.gameChanges.map(g => [g.kind, g.toSlotId]), [['moved', 'a2']]);
  });
  it('a game with no end moves by its start alone', () => {
    const p = planG(moved, [gamesUse('a')], [game('g1', 'a', '2026-11-08', '11:00', null)]);
    assert.equal(p.step.games.move[0].endsAt, null);
  });
  it('one that won\'t fit the new slot leaves it: published → Needs a new date, draft → off the draft', () => {
    const short = [slot('a', '2026-11-08', '11:00', '14:00', { removed: true }), slot('a2', '2026-11-08', '12:30', '14:00', { isNew: true })];
    const p = planG(short, [gamesUse('a')], [
      game('g1', 'a', '2026-11-08', '11:00', '12:30'), game('g2', 'a', '2026-11-08', '12:30', '14:00'),
    ]);
    assert.deepEqual(p.step.games.move.map(g => g.gameId), ['g1']);
    assert.deepEqual(p.step.games.postpone, ['g2']);
    const d = planG(short, [gamesUse('a')], [game('g2', 'a', '2026-11-08', '12:30', '14:00', { published: false })]);
    assert.deepEqual(d.step.games.remove, ['g2']);
  });
  it('time taken back: a published game needs a new date, a draft\'s comes off the draft (k5)', () => {
    const slots = [slot('thu', '2026-11-12', '18:00', '21:00', { houseLeague: false })];
    const p = planG(slots, [gamesUse('thu')], [
      game('g1', 'thu', '2026-11-12', '18:00', '19:30'), game('g2', 'thu', '2026-11-12', '19:30', '21:00', { divisionId: 'u9', published: false }),
    ]);
    assert.deepEqual(p.step.uses, []);
    assert.deepEqual(p.step.games.postpone, ['g1']);
    assert.deepEqual(p.step.games.remove, ['g2']);
    assert.deepEqual(p.gameChanges.map(g => g.kind).sort(), ['needsDate', 'removed']);
  });
  it('a played, started, cancelled or postponed game stays as it is', () => {
    const slots = [slot('thu', '2026-11-12', '18:00', '21:00', { houseLeague: false }), slot('old', '2026-10-29', '18:00', '21:00', { houseLeague: false })];
    const p = planG(slots, [gamesUse('thu'), gamesUse('old')], [
      game('done', 'thu', '2026-11-12', '18:00', '19:30', { status: 'completed' }),
      game('off', 'thu', '2026-11-12', '19:30', '21:00', { status: 'cancelled' }),
      game('pp', 'thu', '2026-11-12', '18:00', '19:30', { status: 'postponed' }),
      game('past', 'old', '2026-10-29', '18:00', '19:30'),
    ]);
    assert.ok(isEmptyLeagueStep(p.step));
    assert.deepEqual(p.gameChanges, []);
  });
  it('a game on time house league still holds is untouched, and a slot saved again at the same time and place writes nothing', () => {
    const held = planG([slot('a', '2026-11-08', '11:00', '14:00')], [gamesUse('a')], [game('g1', 'a', '2026-11-08', '11:00', '12:30')]);
    assert.ok(isEmptyLeagueStep(held.step));
    const again = [slot('a', '2026-11-08', '11:00', '14:00', { removed: true }), slot('a2', '2026-11-08', '11:00', '14:00', { isNew: true })];
    const p = planG(again, [gamesUse('a')], [game('g1', 'a', '2026-11-08', '11:00', '12:30')]);
    assert.deepEqual(p.step.uses, [{ from: 'a', to: 'a2' }]);
    assert.deepEqual(p.step.games.move, []);
    assert.deepEqual(p.gameChanges, []);
  });
  it('a game is never carried onto a PRACTICE use, nor another division\'s', () => {
    const p = planG(moved, [use('a', { kind: 'practices', divisionId: 'u12' })], [game('g1', 'a', '2026-11-08', '11:00', '12:30')]);
    assert.deepEqual(p.step.games.move, []);
    assert.deepEqual(p.step.games.postpone, ['g1']);
    const q = planG(moved, [use('a', { kind: 'games', divisionId: 'u9' })], [game('g1', 'a', '2026-11-08', '11:00', '12:30')]);
    assert.deepEqual(q.step.games.postpone, ['g1']);
  });
});

describe('the games words (9d-2b Part 5; h4 settled, the rest /marketing\'s)', () => {
  const was: PracticeFace = { day: '2026-11-15', weekday: 7, startClock: '11:00', endClock: '14:00', venueId: DOME, facilityId: F1 };
  const now: PracticeFace = { ...was, facilityId: F3 };
  it('time that moved reads as the settled row; time that went says so', () => {
    assert.equal(leagueGamesLine(was, now, placeOf), 'Sun, Nov 15: Field 1 → Field 3');
    assert.equal(leagueGamesLine(was, null, placeOf), 'Sun, Nov 15, 11:00 a.m. · Field 1: time taken back');
  });
  it('who tells families: the settled "2 games move. A league admin sends them …"; a draft tells nobody', () => {
    assert.equal(leagueGamesSub({ division: 'U9 Rookie', published: true, moved: 2, needsDate: 0, removed: 0 }),
      '2 games move. A league admin sends them to families from U9 Rookie’s Changes to send.');
    assert.equal(leagueGamesSub({ division: 'U12', published: true, moved: 0, needsDate: 1, removed: 0 }),
      '1 game moves to Needs a new date. A league admin sends it to families from U12’s Changes to send.');
    assert.equal(leagueGamesSub({ division: 'U9', published: false, moved: 0, needsDate: 0, removed: 3 }),
      '3 draft games come off the draft. Nobody is told: U9’s schedule isn’t published yet.');
  });
  it('the league admins\' notice names the games and where they wait', () => {
    const c = { ...NO_LEAGUE_COUNTS, gamesMoved: 2, gamesNeedDate: 1, gamesWaiting: 3 };
    assert.equal(LEAGUE_ADMIN_NOTICE.title('Summer field time', c), 'Summer field time changed house league’s game time');
    assert.equal(LEAGUE_ADMIN_NOTICE.body({ divisions: ['U12'], ...c }),
      'U12: 2 games moved and 1 game needs a new date. 3 games wait in Changes to send. Families hear once you send them.');
    assert.equal(LEAGUE_ADMIN_NOTICE.title('Summer field time', { ...NO_LEAGUE_COUNTS, moved: 1 }), 'Summer field time changed house league’s practices');
  });
  it('a draft-only move has no instruction to send families', () => {
    assert.equal(LEAGUE_ADMIN_NOTICE.body({ divisions: ['U12'], ...NO_LEAGUE_COUNTS, gamesMoved: 1 }),
      'U12: 1 game moved.');
  });
  it('the notice says which games moved and when, a few lines and then "and N more"', () => {
    const c = { ...NO_LEAGUE_COUNTS, gamesMoved: 1 };
    assert.equal(LEAGUE_ADMIN_NOTICE.body({ divisions: ['U11'], gameLines: ['U11: Sun, Nov 8: Field 2 → Field 4'], ...c }),
      'U11: 1 game moved.\n\nU11: Sun, Nov 8: Field 2 → Field 4');
    const many = Array.from({ length: 9 }, (_, i) => `U11: line ${i + 1}`);
    const lines = LEAGUE_ADMIN_NOTICE.body({ divisions: ['U11'], gameLines: many, ...c }).split('\n');
    assert.equal(lines.length, 9);
    assert.equal(lines[1], '');
    assert.equal(lines[8], 'and 3 more');
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
