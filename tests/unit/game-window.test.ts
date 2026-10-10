import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MOVE_ALERT_URGENT_HOURS, changesOf, emptyGameForm, formOfGame, lengthOfBox, startsInUrgentLane, whenWhereChanged,
  type GameWindowForm,
} from '../../lib/game-window-form.ts';
import { placeOfWhere, samePlace, tournamentSourceLine, tournamentVenueOptions, whereOfGame } from '../../lib/tournament-where.ts';
import { EMPTY_WHERE } from '../../lib/where-field.ts';
import { GAME_WINDOW_WORDS as G, slotWords } from '../../lib/schedule-words.ts';
import { zonedWallClockToUtc } from '../../lib/timezone.ts';
import type { Game, Venue } from '../../lib/types.ts';

/**
 * Tournament admin redesign Stage 3, Part 3 — the game window (S2, A35, A36).
 * Before: three ways into a game and none of them was the game; the Edit Game window saved every field every time.
 * Now one window reads first, writes back only what changed, and holds a published game's move for ✓'s question.
 */

const VENUES = [
  { id: 'lions', name: 'Lions Park', address: '41 Lions Park Dr', facilities: [{ id: 'd2', name: 'Diamond 2' }, { id: 'd3', name: 'Diamond 3' }], sourceOrgVenueId: 'lib-1' },
  { id: 'cedar', name: 'Cedar Field', address: '', facilities: [], sourceOrgVenueId: null },
] as unknown as Venue[];

const g = (over: Partial<Game>): Game => ({
  id: 'g1', tournamentId: 't', divisionId: 'u11', homeTeamId: 'h', awayTeamId: 'a', date: '2026-10-09', time: '16:00:00',
  location: '', status: 'scheduled', isPlayoff: false, ...over,
}) as Game;

describe('a game reads into the form', () => {
  test('a picked venue and its diamond read back as the club field\'s pick', () => {
    const f = formOfGame(g({ venueId: 'lions', venueFacilityId: 'd2', location: 'Lions Park — Diamond 2' }), VENUES);
    assert.equal(f.where.source, 'club');
    assert.equal(f.where.location, 'Lions Park');
    assert.equal(f.where.fieldNumber, 'Diamond 2');
    assert.equal(f.where.orgVenueId, 'lions');
    assert.equal(f.where.orgVenueFacilityId, 'd2');
  });
  test('typed words read back as typed; nothing as nothing', () => {
    assert.equal(formOfGame(g({ location: 'Behind the school' }), VENUES).where.source, 'typed');
    assert.deepEqual(formOfGame(g({ location: '' }), VENUES).where, EMPTY_WHERE);
  });
  test('the start reads as HH:MM, and an empty length box means the chain decides', () => {
    const f = formOfGame(g({ durationMinutes: null }), VENUES);
    assert.equal(f.time, '16:00');
    assert.equal(f.durationMinutes, '');
    assert.equal(formOfGame(g({ durationMinutes: 120 }), VENUES).durationMinutes, '120');
  });
});

describe('the form writes back only what changed', () => {
  const saved = formOfGame(g({ venueId: 'lions', venueFacilityId: 'd2', notes: 'Bring the tarp' }), VENUES);
  const edit = (patch: Partial<GameWindowForm>) => ({ ...saved, ...patch });

  test('nothing changed sends nothing', () => {
    assert.deepEqual(changesOf(saved, saved, { whenWhere: true, playoff: false }), {});
  });
  test('a new start sends the start alone', () => {
    assert.deepEqual(changesOf(edit({ time: '17:30' }), saved, { whenWhere: true, playoff: false }), { time: '17:30' });
  });
  test('a held move (published, or refused) leaves day, start and place out — the rest still saves', () => {
    const f = edit({ time: '17:30', date: '2026-10-10', notes: 'Moved' });
    assert.deepEqual(changesOf(f, saved, { whenWhere: false, playoff: false }), { notes: 'Moved' });
  });
  test('a day and a start are changed, never emptied', () => {
    assert.deepEqual(changesOf(edit({ date: '', time: '' }), saved, { whenWhere: true, playoff: false }), {});
  });
  test('a new diamond sends the venue decision whole: ids picked, words derived by the server', () => {
    const f = edit({ where: { ...saved.where, fieldNumber: 'Diamond 3', orgVenueFacilityId: 'd3' } });
    assert.deepEqual(changesOf(f, saved, { whenWhere: true, playoff: false }), { venueId: 'lions', venueFacilityId: 'd3', location: null });
  });
  test('typed words send the words, joined the house way, and clear the ids', () => {
    const f = edit({ where: { ...EMPTY_WHERE, source: 'typed', location: 'Riverside', fieldNumber: 'Field 1' } });
    assert.deepEqual(changesOf(f, saved, { whenWhere: true, playoff: false }), { venueId: null, venueFacilityId: null, location: 'Riverside — Field 1' });
  });
  test('the length box: a number is the game\'s own length, emptied is the chain again', () => {
    assert.deepEqual(changesOf(edit({ durationMinutes: '75' }), saved, { whenWhere: true, playoff: false }), { durationMinutes: 75 });
    const own = { ...saved, durationMinutes: '120' };
    assert.deepEqual(changesOf(saved, own, { whenWhere: true, playoff: false }), { durationMinutes: null });
    assert.equal(lengthOfBox('900'), 600);
    assert.equal(lengthOfBox('0'), null);
    assert.equal(lengthOfBox('abc'), null);
  });
  test('notes trim, and an emptied note clears', () => {
    assert.deepEqual(changesOf(edit({ notes: '  Gate B  ' }), saved, { whenWhere: true, playoff: false }), { notes: 'Gate B' });
    assert.deepEqual(changesOf(edit({ notes: '' }), saved, { whenWhere: true, playoff: false }), { notes: null });
  });
  test('a playoff side sends its team and its slot together; a round-robin game never sends a placeholder', () => {
    const p = formOfGame(g({ isPlayoff: true, homeTeamId: '', homePlaceholder: 'Seed #1', awayTeamId: '', awayPlaceholder: 'Seed #4' }), VENUES);
    assert.deepEqual(changesOf({ ...p, homePlaceholder: 'Seed #2' }, p, { whenWhere: true, playoff: true }), { homeTeamId: null, homePlaceholder: 'Seed #2' });
    const r = formOfGame(g({ homePlaceholder: 'Pool A #1', homeSlotId: 's1' }), VENUES);
    assert.deepEqual(changesOf({ ...r, homeTeamId: 'x' }, r, { whenWhere: true, playoff: false }), { homeTeamId: 'x' });
  });
});

describe('a move is a change of day, start or place (A36)', () => {
  const saved = formOfGame(g({ venueId: 'lions', venueFacilityId: 'd2' }), VENUES);
  test('the length or the notes are not a move', () => {
    assert.equal(whenWhereChanged({ ...saved, durationMinutes: '120', notes: 'x' }, saved), false);
  });
  test('re-picking the same diamond is not a move', () => {
    assert.equal(whenWhereChanged({ ...saved, where: whereOfGame(g({ venueId: 'lions', venueFacilityId: 'd2' }), VENUES) }, saved), false);
    assert.equal(samePlace(saved.where, { ...saved.where, locationAddress: 'elsewhere' }), true);
  });
  test('a new day, start or diamond is', () => {
    assert.equal(whenWhereChanged({ ...saved, date: '2026-10-10' }, saved), true);
    assert.equal(whenWhereChanged({ ...saved, time: '09:00' }, saved), true);
    assert.equal(whenWhereChanged({ ...saved, where: { ...saved.where, orgVenueFacilityId: 'd3' } }, saved), true);
  });
});

describe('the question\'s two bodies follow the alerts\' own lanes', () => {
  const at = (date: string, time: string) => Date.parse(zonedWallClockToUtc(date, time)!);
  const now = at('2026-10-09', '12:00');
  test('a new start inside the next 6 hours is the urgent lane (told at the next sweep)', () => {
    assert.equal(startsInUrgentLane('2026-10-09', '17:30', now), true);
    assert.equal(startsInUrgentLane('2026-10-09', '18:00', now), true);
  });
  test('later than that waits for the quiet window; a start already past is not urgent', () => {
    assert.equal(startsInUrgentLane('2026-10-09', '18:01', now), false);
    assert.equal(startsInUrgentLane('2026-10-09', '11:00', now), false);
    assert.equal(startsInUrgentLane('', '', now), false);
  });
  test('the window\'s 6 hours are the sweep\'s 6 hours', () => {
    const src = readFileSync(new URL('../../lib/schedule-change-notices.ts', import.meta.url), 'utf8');
    assert.match(src, new RegExp(`const URGENT_WINDOW_HOURS = ${MOVE_ALERT_URGENT_HOURS};`));
  });
  test('the far body says 10 quiet minutes — the sweep\'s own quiet window', () => {
    const src = readFileSync(new URL('../../lib/schedule-change-notices.ts', import.meta.url), 'utf8');
    assert.match(src, /QUIET_WINDOW_MINUTES = 10\b/);
    assert.match(G.move.farBody('Storm', 'Mustangs'), /10 minutes/);
  });
});

describe('the tournament on the one Venue field', () => {
  test('its venues are the field\'s program venues, facilities in order', () => {
    const opts = tournamentVenueOptions(VENUES);
    assert.deepEqual(opts[0].facilities.map(f => f.name), ['Diamond 2', 'Diamond 3']);
    assert.equal(opts[1].address, null);
  });
  test('the quiet line says where a picked venue came from (specimen 7)', () => {
    const words = G.venueSource;
    assert.equal(tournamentSourceLine(whereOfGame(g({ venueId: 'lions' }), VENUES), VENUES, words), `${words.library} · 41 Lions Park Dr`);
    assert.equal(tournamentSourceLine(whereOfGame(g({ venueId: 'cedar' }), VENUES), VENUES, words), words.tournament);
    assert.equal(tournamentSourceLine(whereOfGame(g({ location: 'Typed' }), VENUES), VENUES, words), '');
  });
  test('nothing picked and nothing typed is no place', () => {
    assert.deepEqual(placeOfWhere(EMPTY_WHERE), { venueId: null, venueFacilityId: null, location: null });
  });
  test('Add game starts on the shown division, stage and day, at 9:00 a.m., nowhere yet', () => {
    const f = emptyGameForm('u13', 'playoff', '2026-10-10');
    assert.equal(f.divisionId, 'u13');
    assert.equal(f.stage, 'playoff');
    assert.equal(f.time, '09:00');
    assert.deepEqual(f.where, EMPTY_WHERE);
  });
});

describe('a bracket slot\'s words', () => {
  test('a seed reads "Seed 1" (the stored key keeps its #)', () => assert.equal(slotWords('Seed #1'), 'Seed 1'));
  test('a winner reads in the one slot wording', () => assert.equal(slotWords('Winner SF1'), 'Semifinal 1 winner'));
  test('nothing reads as nothing', () => assert.equal(slotWords(null), ''));
});

describe('the window wears what it promises', () => {
  const win = readFileSync(new URL('../../app/[orgSlug]/admin/tournaments/schedule/components/GameWindow.tsx', import.meta.url), 'utf8');
  test('a published game\'s move — and a refused one — is held; the rest autosaves', () => {
    assert.match(win, /const holdWhenWhere = published \|\| refused;/);
    assert.match(win, /changesOf\(f, s, \{ whenWhere: !holdWhenWhere/);
  });
  test('the refusal is the tournament\'s own overlap, checked before anything saves (A37)', () => {
    assert.match(win, /useOverlapLine\(/);
    const hook = readFileSync(new URL('../../app/[orgSlug]/admin/tournaments/schedule/components/useOverlapLine.tsx', import.meta.url), 'utf8');
    assert.match(hook, /checkVenueConflict\(/);
    assert.match(hook, /isRefusedOverlap\(conflict\)/);
    assert.match(win, /const \{ refused: overlaps, line: overlapLine \} = useOverlapLine\(/);
    // It holds only what THIS edit places (a legacy double-booking never traps ✓ over a notes edit).
    assert.match(win, /const refused = overlaps && \(creating \|\| movePending \|\| form\.durationMinutes !== saved\.durationMinutes\);/);
  });
  test('one score editor in the product: the window\'s Score is a door to Results', () => {
    assert.match(win, /ctx\.resultsHref\(game\.id\)/);
    assert.doesNotMatch(win, /submit-score|homeScore\s*:/);
  });
});
