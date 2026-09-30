import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hasFirstGameStarted, isGameDay, PHASE_LABEL, resolvePhase } from '../../lib/tournament-phase.ts';
import { GAME_STATE_WORD, PENDING_FORFEIT, gameWhen } from '../../lib/game-day-words.ts';
import { formatShortWeekdayDate } from '../../lib/timezone.ts';

/**
 * Tournament admin redesign Stage 1 (2026-09-29).
 *
 * G1 — ONE game-day rule, read by the dashboard's API AND the admin tournaments list that feeds the
 * event header's chip. Before, the header read the dates alone and said "Open" on the days after an
 * event while the board below it said game day.
 *
 * G2/G4 — a game-day row names the DAY when it isn't today (an overdue Friday game read "1:00 p.m."
 * on a Sunday phone, F03), through the product's formatters only.
 *
 * G5 — one word per game state.
 */

const NOW = { date: '2026-06-13', time: '13:05' };

describe('the first game has started', () => {
  test('a submitted or final score counts, whenever the game was due', () => {
    assert.equal(hasFirstGameStarted([{ status: 'submitted', date: '2026-06-20', time: '09:00' }], NOW), true);
    assert.equal(hasFirstGameStarted([{ status: 'completed', date: null, time: null }], NOW), true);
  });
  test('a scheduled game counts once its start has passed — a past day, or earlier today', () => {
    assert.equal(hasFirstGameStarted([{ status: 'scheduled', date: '2026-06-12', time: '18:00' }], NOW), true);
    assert.equal(hasFirstGameStarted([{ status: 'scheduled', date: '2026-06-13', time: '13:00' }], NOW), true);
    assert.equal(hasFirstGameStarted([{ status: 'scheduled', date: '2026-06-13', time: '14:00' }], NOW), false);
    assert.equal(hasFirstGameStarted([{ status: 'scheduled', date: '2026-06-13', time: null }], NOW), false);
  });
  test('a cancelled game never starts an event', () => {
    assert.equal(hasFirstGameStarted([{ status: 'cancelled', date: '2026-06-01', time: '09:00' }], NOW), false);
    assert.equal(hasFirstGameStarted([], NOW), false);
  });
});

describe('game day — the dates, or the first game having started', () => {
  test('inside the dates', () => {
    assert.equal(isGameDay({ startDate: '2026-06-12', endDate: '2026-06-14', firstGameStarted: false, today: '2026-06-13' }), true);
  });
  test('after the last day, still game day while its games have started (the header used to say Open here)', () => {
    assert.equal(isGameDay({ startDate: '2026-06-12', endDate: '2026-06-14', firstGameStarted: true, today: '2026-09-29' }), true);
    assert.equal(resolvePhase({ status: 'active', isGameDay: true }), 'gameday');
    assert.equal(PHASE_LABEL.gameday, 'Game day');
  });
  test('before the first date with nothing played is not game day', () => {
    assert.equal(isGameDay({ startDate: '2026-06-12', endDate: '2026-06-14', firstGameStarted: false, today: '2026-06-01' }), false);
  });
});

describe('a game-day row says the day only when it is not today', () => {
  test('the short weekday form', () => {
    assert.equal(formatShortWeekdayDate('2026-06-12'), 'Fri, Jun 12');
    assert.equal(formatShortWeekdayDate('2026-06-14'), 'Sun, Jun 14');
  });
  test('another day: the day, then the clock in the house spelling', () => {
    assert.equal(gameWhen('2026-06-12', '13:00:00', '2026-06-14'), 'Fri, Jun 12 · 1:00 p.m.');
    assert.equal(gameWhen('2026-06-12', '08:30', '2026-06-14'), 'Fri, Jun 12 · 8:30 a.m.');
  });
  test('today: the clock alone', () => {
    assert.equal(gameWhen('2026-06-14', '16:00', '2026-06-14'), '4:00 p.m.');
  });
  test('a day with no time, and a game with neither', () => {
    assert.equal(gameWhen('2026-06-12', null, '2026-06-14'), 'Fri, Jun 12');
    assert.equal(gameWhen(null, null, '2026-06-14'), '');
  });
});

describe('one word per game state (G5, /marketing 2026-09-29)', () => {
  test('the five words, and "Pending Review" exactly as the product spells it', () => {
    assert.deepEqual(
      [GAME_STATE_WORD.needsScore, GAME_STATE_WORD.pendingReview, GAME_STATE_WORD.final, GAME_STATE_WORD.forfeit, GAME_STATE_WORD.tie],
      ['Needs a score', 'Pending Review', 'Final', 'Forfeit', 'Tie'],
    );
  });
  test('a pending forfeit is the two words, never a third', () => {
    assert.equal(PENDING_FORFEIT, 'Forfeit · Pending Review');
  });
});
