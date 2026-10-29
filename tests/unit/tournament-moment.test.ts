import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tournamentMoment, type TournamentMomentInput } from '../../lib/tournament-moment.ts';
import type { Division, Game } from '../../lib/types.ts';

/**
 * WHICH MOMENT THE OVERVIEW ANSWERS (Public tournament pages, Stage 2, plan §5). The helper's `finished` must be today's
 * Overview `isFinished`, exactly (the guard at the foot holds the old body's expression still, so the two cannot drift
 * while both stand); the moment and its flags are the new frame's.
 */

const DIV = { id: 'd1', name: 'U13' } as Division;
let n = 0;
const game = (over: Partial<Game>): Game => ({
  id: `g${++n}`, divisionId: 'd1', date: '2026-10-24', time: '09:00', status: 'scheduled', isPlayoff: false,
  homeTeamId: 'a', awayTeamId: 'b', homeScore: null, awayScore: null, ...over,
} as Game);
const played = (over: Partial<Game> = {}) => game({ status: 'completed', homeScore: 5, awayScore: 3, ...over });
const decidedFinal = (over: Partial<Game> = {}) => played({ isPlayoff: true, bracketCode: 'FIN', date: '2026-10-25', ...over });

// The event runs Sat 24 – Sun 25 October 2026.
const at = (today: string, over: Partial<TournamentMomentInput> = {}): TournamentMomentInput => ({
  tournament: { status: 'active', startDate: '2026-10-24', endDate: '2026-10-25', championsCrownedAt: null },
  today, games: [], divisions: [DIV], scheduleWithheld: false, registrationOpen: false, ...over,
});

describe('the moment, and today\'s finished rule exactly', () => {
  it('completed by the organizer: after, whatever the games say', () => {
    const s = tournamentMoment(at('2026-10-24', { tournament: { status: 'completed', startDate: '2026-10-24', endDate: '2026-10-25' }, games: [game({})] }));
    assert.equal(s.finished, true);
    assert.equal(s.moment, 'after');
  });
  it('completed wins even while a schedule is withheld', () => {
    assert.equal(tournamentMoment(at('2026-10-24', { tournament: { status: 'completed' }, scheduleWithheld: true })).finished, true);
  });
  it('bracket decided and nothing left to play: after, on the day', () => {
    const s = tournamentMoment(at('2026-10-25', { games: [played(), decidedFinal()] }));
    assert.equal(s.finished, true);
    assert.equal(s.moment, 'after');
  });
  it('bracket decided but a game rescheduled after the final: still game day', () => {
    const s = tournamentMoment(at('2026-10-25', { games: [game({ date: '2026-10-25', time: '18:00' }), decidedFinal()] }));
    assert.equal(s.finished, false);
    assert.equal(s.moment, 'gameDay');
  });
  it('a submitted (unconfirmed) game does not hold it open — only a scheduled one does', () => {
    const submitted = played({ status: 'submitted' });
    assert.equal(tournamentMoment(at('2026-10-25', { games: [submitted, decidedFinal()] })).finished, true);
  });
  it('round robin played out ON its last day: after that day, not the next', () => {
    assert.equal(tournamentMoment(at('2026-10-25', { games: [played(), played({ status: 'forfeit' })] })).finished, true);
  });
  it('no start date: games on or before today make it game day (live games are never behind a Register card); none, before', () => {
    const noStart = { status: 'active', startDate: null, endDate: null };
    assert.equal(tournamentMoment(at('2026-10-24', { tournament: noStart, games: [game({ date: '2026-10-24' })] })).moment, 'gameDay');
    assert.equal(tournamentMoment(at('2026-10-24', { tournament: noStart, games: [game({ date: '2026-10-30' })] })).moment, 'before');
    assert.equal(tournamentMoment(at('2026-10-24', { tournament: noStart })).moment, 'before');
  });
  it('round robin played out before its last day: still game day', () => {
    const s = tournamentMoment(at('2026-10-24', { games: [played()] }));
    assert.equal(s.finished, false);
    assert.equal(s.moment, 'gameDay');
  });
  it('a withheld schedule is never finished on the divisions it shows (D1)', () => {
    const s = tournamentMoment(at('2026-10-25', { games: [played(), decidedFinal()], scheduleWithheld: true }));
    assert.equal(s.finished, false);
    assert.equal(s.scheduleWithheld, true);
    assert.equal(tournamentMoment(at('2026-10-26', { games: [played()], scheduleWithheld: true })).finished, false);
  });
  it('the crowned stamp alone does not finish the page (it is the band\'s word, not the body\'s rule)', () => {
    const s = tournamentMoment(at('2026-10-25', {
      tournament: { status: 'active', startDate: '2026-10-24', endDate: '2026-10-25', championsCrownedAt: '2026-10-25T21:00:00Z' },
      games: [game({ isPlayoff: true, bracketCode: 'FIN', date: '2026-10-25' })], // the final re-opened after the stamp
    }));
    assert.equal(s.championCrowned, true);
    assert.equal(s.finished, false);
    assert.equal(s.moment, 'gameDay');
  });
  it('before the start: before; no start date yet: before', () => {
    assert.equal(tournamentMoment(at('2026-10-20')).moment, 'before');
    assert.equal(tournamentMoment(at('2026-10-20', { tournament: { status: 'active' } })).moment, 'before');
  });
  it('inside the dates with nothing played: game day', () => {
    const s = tournamentMoment(at('2026-10-24', { games: [game({}), game({ date: '2026-10-25' })] }));
    assert.equal(s.moment, 'gameDay');
    assert.equal(s.gamesToday, true);
  });
  it('past its dates with games still unscored: game day, never a Register card', () => {
    const s = tournamentMoment(at('2026-10-27', { games: [game({})], registrationOpen: true }));
    assert.equal(s.moment, 'gameDay');
    assert.equal(s.registrationOpen, false);
  });
});

describe('the flags', () => {
  it('registration open counts only before the event', () => {
    assert.equal(tournamentMoment(at('2026-10-20', { registrationOpen: true })).registrationOpen, true);
    assert.equal(tournamentMoment(at('2026-10-24', { registrationOpen: true })).registrationOpen, false);
  });
  it('games today: a cancelled game does not count', () => {
    assert.equal(tournamentMoment(at('2026-10-24', { games: [game({ status: 'cancelled' })] })).gamesToday, false);
    assert.equal(tournamentMoment(at('2026-10-23', { games: [game({})] })).gamesToday, false);
  });
  it('the bracket is set: playoffs exist, the event has started, every pool game played or cancelled, not finished', () => {
    const pool = played({ date: '2026-10-24' });
    const semi = game({ isPlayoff: true, bracketCode: 'SF1', date: '2026-10-25' });
    assert.equal(tournamentMoment(at('2026-10-25', { games: [pool, semi] })).bracketSet, true);
    assert.equal(tournamentMoment(at('2026-10-25', { games: [game({ status: 'cancelled' }), semi] })).bracketSet, true);
    // a pre-built bracket before the event, a pool game still to play, a forfeit pool game (today's rule: not played), no bracket, finished
    assert.equal(tournamentMoment(at('2026-10-20', { games: [pool, semi] })).bracketSet, false);
    assert.equal(tournamentMoment(at('2026-10-25', { games: [game({}), semi] })).bracketSet, false);
    assert.equal(tournamentMoment(at('2026-10-25', { games: [game({ status: 'forfeit' }), semi] })).bracketSet, false);
    assert.equal(tournamentMoment(at('2026-10-25', { games: [pool] })).bracketSet, false);
    assert.equal(tournamentMoment(at('2026-10-25', { games: [pool, decidedFinal()] })).bracketSet, false);
  });
});
