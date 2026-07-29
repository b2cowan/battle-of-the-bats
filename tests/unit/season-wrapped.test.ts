import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeSeasonWrapped,
  type SeasonWrappedInput,
  type WrappedGameInput,
} from '../../lib/season-wrapped.ts';

let day = 0;
function game(overrides: Partial<WrappedGameInput> = {}): WrappedGameInput {
  day += 1;
  return {
    eventType: 'league_game',
    startsAt: `2026-05-${String(day).padStart(2, '0')}T18:00:00Z`,
    status: 'scheduled',
    result: null,
    teamScore: null,
    opponentScore: null,
    opponent: 'Falcons',
    homeAway: 'home',
    ...overrides,
  };
}
function win(team = 5, opp = 2, overrides: Partial<WrappedGameInput> = {}) {
  return game({ result: 'win', teamScore: team, opponentScore: opp, ...overrides });
}
function loss(team = 2, opp = 5, overrides: Partial<WrappedGameInput> = {}) {
  return game({ result: 'loss', teamScore: team, opponentScore: opp, ...overrides });
}
function compute(partial: Partial<SeasonWrappedInput>) {
  return computeSeasonWrapped({
    events: [],
    attendance: [],
    awards: [],
    playerLabelById: {},
    reusedLineups: [],
    gamesWithLineup: 0,
    rosterCount: 12,
    ...partial,
  });
}

describe('computeSeasonWrapped — record (the canonical rule)', () => {
  it('counts league + tournament + legacy external_tournament; excludes scrimmage; skips unscored + cancelled', () => {
    day = 0;
    const w = compute({
      events: [
        win(),
        win(4, 3, { eventType: 'tournament_game' }),
        loss(1, 2, { eventType: 'external_tournament' }),
        win(9, 0, { eventType: 'scrimmage' }),                    // excluded: scrimmage
        game(),                                                    // excluded: no result
        win(3, 1, { status: 'cancelled' }),                        // excluded: cancelled
        game({ result: 'tie', teamScore: 2, opponentScore: 2 }),
      ],
    });
    assert.deepEqual(w.record, { wins: 2, losses: 1, ties: 1, games: 4 });
  });

  it('a no-games season still returns a card-worthy shape (roster only)', () => {
    const w = compute({ events: [], rosterCount: 9 });
    assert.equal(w.record.games, 0);
    assert.equal(w.longestStreak, null);
    assert.equal(w.closestGame, null);
    assert.equal(w.rosterCount, 9);
  });
});

describe('computeSeasonWrapped — longest streak', () => {
  it('finds the longest run of wins with its date range (ties break a streak)', () => {
    day = 0;
    const events = [
      win(), win(),
      loss(),
      win(), win(), win(),
      game({ result: 'tie', teamScore: 3, opponentScore: 3 }),
      win(),
    ];
    const w = compute({ events });
    assert.equal(w.longestStreak?.length, 3);
    assert.equal(w.longestStreak?.startsAt, events[3].startsAt);
    assert.equal(w.longestStreak?.endsAt, events[5].startsAt);
  });

  it('a 2-win streak is not a superlative — null under 3', () => {
    day = 0;
    const w = compute({ events: [win(), win(), loss(), loss()] });
    assert.equal(w.longestStreak, null);
  });
});

describe('computeSeasonWrapped — closest game', () => {
  it('picks the tightest decided margin, preferring the win on an equal margin', () => {
    day = 0;
    const events = [
      loss(2, 3),          // margin 1 (loss)
      win(4, 3),           // margin 1 (win) ← preferred
      win(9, 1),
      loss(0, 6),
    ];
    const w = compute({ events });
    assert.equal(w.closestGame?.result, 'win');
    assert.equal(w.closestGame?.teamScore, 4);
    assert.equal(w.closestGame?.margin, 1);
  });

  it('needs at least 4 decided games — a 3-game season gets no closest-game tile', () => {
    day = 0;
    const w = compute({ events: [win(), loss(), win(4, 3)] });
    assert.equal(w.closestGame, null);
  });
});

describe('computeSeasonWrapped — attendance / awards / lineup fact', () => {
  it('aggregates attendance across players over KNOWN responses only', () => {
    const w = compute({
      attendance: [
        { attended: 9, known: 10 },
        { attended: 5, known: 10 },
        { attended: 0, known: 0 },   // no data — contributes nothing
      ],
    });
    assert.deepEqual(w.attendanceRate, { pct: 70, known: 20 });
  });

  it('attendance is null with zero known responses', () => {
    const w = compute({ attendance: [{ attended: 0, known: 0 }] });
    assert.equal(w.attendanceRate, null);
  });

  it('names the top award-winner with their most frequent award type', () => {
    const w = compute({
      awards: [
        { playerId: 'p1', typeName: 'Hustle' },
        { playerId: 'p1', typeName: 'Hustle' },
        { playerId: 'p1', typeName: 'Game Ball' },
        { playerId: 'p2', typeName: 'Game Ball' },
      ],
      playerLabelById: { p1: 'Maya #7', p2: 'Jo #4' },
    });
    assert.equal(w.topAward?.playerLabel, 'Maya #7');
    assert.equal(w.topAward?.count, 3);
    assert.deepEqual(w.topAward?.tiedWith, []);
    assert.equal(w.topAward?.topTypeName, 'Hustle');
  });

  it('ties are named, never hidden — deterministic leader by label', () => {
    const w = compute({
      awards: [
        { playerId: 'p1', typeName: 'Hustle' },
        { playerId: 'p2', typeName: 'Game Ball' },
      ],
      playerLabelById: { p1: 'Maya #7', p2: 'Jo #4' },
    });
    assert.equal(w.topAward?.playerLabel, 'Jo #4');
    assert.deepEqual(w.topAward?.tiedWith, ['Maya #7']);
  });

  it('lineup fact requires a never-beaten reused lineup (≥3 uses, ≥2 scored wins, 0 losses)', () => {
    const hot = compute({
      reusedLineups: [
        { label: 'Amy, Bo, Cy', games: 4, scoredGames: 4, wins: 4, losses: 0, ties: 0 },
        { label: 'Cy, Bo, Amy', games: 3, scoredGames: 3, wins: 2, losses: 1, ties: 0 },
      ],
    });
    assert.equal(hot.lineupFact?.wins, 4);
    assert.equal(hot.lineupFact?.uses, 4);

    const cold = compute({
      reusedLineups: [{ label: 'X', games: 3, scoredGames: 3, wins: 2, losses: 1, ties: 0 }],
    });
    assert.equal(cold.lineupFact, null);
  });
});
