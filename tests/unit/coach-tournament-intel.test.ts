/**
 * "Their tournament so far" — pure-logic tests (lib/coach-tournament-intel.ts, Scouting Book P3).
 * The load-bearing claims: the block assembles ONLY for a revealed, same-tournament read
 * (published division, accepted opponent, public tournament); the game vs us is excluded;
 * names resolve from accepted teams only; forfeits count as results but never as unit totals;
 * the standing ranks within the opponent's pool; and the payload's key set is PINNED so a
 * roster/name field can never drift in unnoticed.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assembleOpponentTournamentIntel,
  type IntelDivisionInput,
  type IntelGameInput,
} from '../../lib/coach-tournament-intel.ts';
import type { StandingsTeamInput } from '../../lib/tie-breakers.ts';

const OPP = 'reg-thunder';
const US = 'reg-bats';
const SOURCE_GAME = 'g-vs-us';

function team(over: Partial<StandingsTeamInput> & { id: string }): StandingsTeamInput {
  return { name: over.id, divisionId: 'div-1', status: 'accepted', poolId: 'pool-b', ...over };
}

function g(over: Partial<IntelGameInput> & { id: string }): IntelGameInput {
  return {
    divisionId: 'div-1',
    status: 'completed',
    isPlayoff: false,
    homeTeamId: OPP,
    awayTeamId: 'reg-gators',
    homeScore: 8,
    awayScore: 1,
    date: '2026-07-18',
    time: '09:00',
    ...over,
  };
}

const division: IntelDivisionInput = {
  id: 'div-1',
  scheduleVisibility: 'published',
  pools: [{ id: 'pool-b', name: 'Pool B' }],
};

function baseOpts(over?: Partial<Parameters<typeof assembleOpponentTournamentIntel>[0]>) {
  return {
    sourceGameId: SOURCE_GAME,
    opponentTeamId: OPP,
    tournamentName: 'Summer Classic',
    tournamentStatus: 'active',
    divisions: [division],
    teams: [
      team({ id: OPP, name: 'Oakville Thunder' }),
      team({ id: US, name: 'Milton Bats' }),
      team({ id: 'reg-gators', name: 'Georgetown Gators' }),
      team({ id: 'reg-breeze', name: 'Burlington Breeze' }),
    ],
    games: [
      g({ id: 'g1', awayTeamId: 'reg-gators', homeScore: 8, awayScore: 1, time: '09:00' }),
      g({ id: 'g2', homeTeamId: 'reg-breeze', awayTeamId: OPP, homeScore: 3, awayScore: 2, time: '12:15' }),
      // The game against US — a result, but never part of "their OTHER results".
      g({ id: SOURCE_GAME, awayTeamId: US, homeScore: 5, awayScore: 4, time: '15:30' }),
      // Unplayed — no scores, no result, never shown.
      g({ id: 'g-future', awayTeamId: 'reg-gators', status: 'scheduled', homeScore: null, awayScore: null, time: '17:00' }),
    ],
    ...over,
  };
}

describe('assembleOpponentTournamentIntel — presence rules', () => {
  it('assembles results for a mirrored game in a public tournament', () => {
    const intel = assembleOpponentTournamentIntel(baseOpts());
    assert.ok(intel);
    assert.equal(intel!.opponentTeamName, 'Oakville Thunder');
    assert.equal(intel!.tournamentName, 'Summer Classic');
    assert.deepEqual(intel!.results.map(r => r.gameId), ['g1', 'g2']); // oldest first, source + unplayed excluded
    assert.deepEqual(intel!.results.map(r => r.result), ['win', 'loss']);
    assert.equal(intel!.results[1].theirScore, 2); // away side resolved from THEIR perspective
    assert.equal(intel!.results[1].otherScore, 3);
  });

  it('is absent for a draft tournament — no public pages means no "public results" to echo', () => {
    assert.equal(assembleOpponentTournamentIntel(baseOpts({ tournamentStatus: 'draft' })), null);
  });

  it('is absent when the opponent’s division schedule is not published', () => {
    const unpublished = { ...division, scheduleVisibility: 'unpublished' as const };
    assert.equal(assembleOpponentTournamentIntel(baseOpts({ divisions: [unpublished] })), null);
  });

  it('is absent when the opponent registration is not an accepted team', () => {
    const opts = baseOpts();
    opts.teams = opts.teams.map(t => (t.id === OPP ? { ...t, status: 'pending' } : t));
    assert.equal(assembleOpponentTournamentIntel(opts), null);
  });

  it('is absent when they have no OTHER results yet — an empty "so far" card is noise', () => {
    const opts = baseOpts();
    opts.games = opts.games.filter(game => game.id === SOURCE_GAME || game.id === 'g-future');
    assert.equal(assembleOpponentTournamentIntel(opts), null);
  });
});

describe('assembleOpponentTournamentIntel — reveal + tally rules', () => {
  it('resolves names from ACCEPTED teams only, falling back to the placeholder', () => {
    const opts = baseOpts();
    opts.teams = opts.teams.map(t => (t.id === 'reg-gators' ? { ...t, status: 'pending' } : t));
    opts.games = opts.games.map(game =>
      game.id === 'g1' ? { ...game, awayPlaceholder: 'Winner SF1' } : game);
    const intel = assembleOpponentTournamentIntel(opts);
    assert.equal(intel!.results[0].otherTeamName, 'Winner SF1');
  });

  it('counts a forfeit as a result but not toward the unit totals (the margin is invented)', () => {
    const opts = baseOpts();
    opts.games = opts.games.map(game =>
      game.id === 'g2' ? { ...game, status: 'forfeit', homeScore: 7, awayScore: 0 } : game);
    const intel = assembleOpponentTournamentIntel(opts);
    assert.deepEqual(intel!.results.map(r => r.result), ['win', 'loss']);
    assert.equal(intel!.unitFor, 8);      // g1 only
    assert.equal(intel!.unitAgainst, 1);
    // The row is FLAGGED so the UI can explain why its scoreline is missing from the totals.
    assert.deepEqual(intel!.results.map(r => r.isForfeit), [false, true]);
  });

  it('excludes a game filed under an UNPUBLISHED division, even for a published-division opponent', () => {
    // A team moved between divisions keeps its old games under the old division id — a game
    // from a never-published division must not surface however the roster shuffles.
    const opts = baseOpts();
    opts.divisions = [division, { id: 'div-hidden', scheduleVisibility: 'unpublished' as const }];
    opts.games = opts.games.map(game =>
      game.id === 'g2' ? { ...game, divisionId: 'div-hidden' } : game);
    const intel = assembleOpponentTournamentIntel(opts);
    assert.deepEqual(intel!.results.map(r => r.gameId), ['g1']);
  });

  it('ranks the opponent within THEIR pool, wearing the pool’s display name', () => {
    const intel = assembleOpponentTournamentIntel(baseOpts());
    assert.ok(intel!.standing);
    assert.equal(intel!.standing!.poolName, 'Pool B');
    assert.ok(intel!.standing!.rank >= 1 && intel!.standing!.rank <= intel!.standing!.groupSize);
  });

  it('ranks over the whole division when the opponent has no pool', () => {
    const opts = baseOpts();
    opts.teams = opts.teams.map(t => ({ ...t, poolId: null }));
    const intel = assembleOpponentTournamentIntel(opts);
    assert.equal(intel!.standing!.poolName, null);
    assert.equal(intel!.standing!.groupSize, 4);
  });
});

/**
 * ⚠ THE NO-NAMES CONTRACT, PINNED. The intel payload is public scoreboard data: team names,
 * scores, schedule labels, a standing. Nothing about people — no opposing rosters, no player
 * names, no coach names — may ever ride along. A new key failing this test is the decision
 * point, exactly like the write-guard's route lists: edit the expectation ONLY with a ruling.
 */
describe('assembleOpponentTournamentIntel — payload key set', () => {
  it('carries exactly the pinned keys and nothing more', () => {
    const intel = assembleOpponentTournamentIntel(baseOpts())!;
    assert.deepEqual(Object.keys(intel).sort(), [
      'opponentTeamName', 'results', 'standing', 'tournamentName', 'unitAgainst', 'unitFor',
    ]);
    for (const row of intel.results) {
      assert.deepEqual(Object.keys(row).sort(), [
        'gameDate', 'gameId', 'gameTime', 'isForfeit', 'isPlayoff', 'otherScore',
        'otherTeamName', 'result', 'theirScore',
      ]);
    }
    assert.deepEqual(Object.keys(intel.standing!).sort(), ['groupSize', 'poolName', 'rank']);
  });
});
