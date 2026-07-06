import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeTieBreakers,
  clampRunDiffCap,
  cappedGameDiff,
  coinTossKey,
  availableTieBreakers,
  computeTournamentStandings,
  DEFAULT_TIE_BREAKERS,
} from '../../lib/tie-breakers.ts';

// ── helpers ─────────────────────────────────────────────────────────────────

function team(name: string, overrides: Record<string, unknown> = {}) {
  return { id: name.toLowerCase(), name, divisionId: 'D1', status: 'accepted', poolId: undefined, ...overrides } as any;
}

let gameSeq = 0;
function game(home: string, away: string, hs: number, as: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `g${gameSeq++}`,
    divisionId: 'D1',
    homeTeamId: home.toLowerCase(),
    awayTeamId: away.toLowerCase(),
    homeScore: hs,
    awayScore: as,
    status: 'completed',
    isPlayoff: false,
    ...overrides,
  } as any;
}

function rank(rows: { teamId: string }[]): string[] {
  return rows.map(r => r.teamId);
}

// ── normalizeTieBreakers ─────────────────────────────────────────────────────

describe('normalizeTieBreakers', () => {
  it('keeps a valid full order', () => {
    assert.deepEqual(normalizeTieBreakers(['h2h', 'rd', 'rf', 'ra']), ['h2h', 'rd', 'rf', 'ra']);
  });
  it('allows a subset (organizer removed breakers)', () => {
    assert.deepEqual(normalizeTieBreakers(['rd', 'rf']), ['rd', 'rf']);
  });
  it('accepts the coin breaker but always pins it last (terminal)', () => {
    assert.deepEqual(normalizeTieBreakers(['h2h', 'coin', 'rd']), ['h2h', 'rd', 'coin']);
    assert.deepEqual(normalizeTieBreakers(['coin', 'rf']), ['rf', 'coin']);
  });
  it('drops invalid values and de-dupes, preserving order', () => {
    assert.deepEqual(normalizeTieBreakers(['rd', 'bogus', 'rd', 'rf']), ['rd', 'rf']);
  });
  it('falls back to default when empty / non-array / all-invalid', () => {
    assert.deepEqual(normalizeTieBreakers([]), [...DEFAULT_TIE_BREAKERS]);
    assert.deepEqual(normalizeTieBreakers(undefined), [...DEFAULT_TIE_BREAKERS]);
    assert.deepEqual(normalizeTieBreakers(['nope']), [...DEFAULT_TIE_BREAKERS]);
  });
});

// ── clampRunDiffCap ──────────────────────────────────────────────────────────

describe('clampRunDiffCap', () => {
  it('returns null for blank / zero / negative / non-numeric', () => {
    assert.equal(clampRunDiffCap(''), null);
    assert.equal(clampRunDiffCap(0), null);
    assert.equal(clampRunDiffCap(-3), null);
    assert.equal(clampRunDiffCap('abc'), null);
    assert.equal(clampRunDiffCap(null), null);
    assert.equal(clampRunDiffCap(undefined), null);
  });
  it('returns the integer cap for positive values', () => {
    assert.equal(clampRunDiffCap(7), 7);
    assert.equal(clampRunDiffCap('7'), 7);
    assert.equal(clampRunDiffCap(5.9), 5);
  });
  it('clamps to the 99 ceiling', () => {
    assert.equal(clampRunDiffCap(200), 99);
  });
});

// ── cappedGameDiff ───────────────────────────────────────────────────────────

describe('cappedGameDiff', () => {
  it('caps a blowout to the cap (14-0, cap 7 → +7)', () => {
    assert.equal(cappedGameDiff(14, 7), 7);
    assert.equal(cappedGameDiff(-14, 7), -7);
  });
  it('leaves within-cap diffs untouched', () => {
    assert.equal(cappedGameDiff(3, 7), 3);
    assert.equal(cappedGameDiff(-3, 7), -3);
  });
  it('is a no-op when cap is null/0', () => {
    assert.equal(cappedGameDiff(14, null), 14);
    assert.equal(cappedGameDiff(14, 0), 14);
  });
});

// ── coinTossKey ──────────────────────────────────────────────────────────────

describe('coinTossKey', () => {
  it('is order-independent (sorted set)', () => {
    assert.equal(coinTossKey(['b', 'a']), coinTossKey(['a', 'b']));
    assert.equal(coinTossKey(['a', 'b']), 'a|b');
  });
});

// ── availableTieBreakers ─────────────────────────────────────────────────────

describe('availableTieBreakers', () => {
  it('returns the breakers not already active', () => {
    assert.deepEqual(availableTieBreakers(['h2h', 'rd', 'rf', 'ra']), ['coin']);
    assert.deepEqual(availableTieBreakers(['rd']).sort(), ['coin', 'h2h', 'ra', 'rf']);
  });
});

// ── computeTournamentStandings: run-diff cap ─────────────────────────────────

describe('computeTournamentStandings — run-diff cap', () => {
  // Two teams play once: Hawks 14, Eagles 0.
  const teams = [team('Hawks'), team('Eagles')];
  const games = [game('Hawks', 'Eagles', 14, 0)];

  it('uncapped: RD reflects the true margin and equals RF - RA', () => {
    const rows = computeTournamentStandings('D1', teams, games);
    const hawks = rows.find(r => r.teamId === 'hawks')!;
    assert.equal(hawks.rf, 14);
    assert.equal(hawks.ra, 0);
    assert.equal(hawks.rd, 14);
    assert.equal(hawks.rdRaw, 14);
  });

  it('capped at 7: RD is +7/-7 but RF/RA keep the real totals', () => {
    const cap = { max_run_diff_per_game: 7 } as any;
    const rows = computeTournamentStandings('D1', teams, games, undefined, cap);
    const hawks = rows.find(r => r.teamId === 'hawks')!;
    const eagles = rows.find(r => r.teamId === 'eagles')!;
    assert.equal(hawks.rf, 14, 'RF stays real');
    assert.equal(hawks.ra, 0, 'RA stays real');
    assert.equal(hawks.rd, 7, 'RD capped to +7');
    assert.equal(hawks.rdRaw, 14, 'rdRaw keeps the uncapped value');
    assert.equal(eagles.rd, -7, 'loser RD capped to -7');
    assert.equal(hawks.runDiffCap, 7);
  });

  it('division override beats the tournament default', () => {
    const settings = { max_run_diff_per_game: 7 } as any;
    const config = { maxRunDiffPerGame: 3 } as any;
    const rows = computeTournamentStandings('D1', teams, games, config, settings);
    assert.equal(rows.find(r => r.teamId === 'hawks')!.rd, 3);
  });
});

// ── computeTournamentStandings — forfeit (J1-091) ────────────────────────────

describe('computeTournamentStandings — forfeit exclusion', () => {
  // A forfeit records a nominal win for the present team. The win/loss must
  // count, but the invented margin must NOT enter RF/RA/RD — otherwise a no-show
  // would swing the run-diff tie-breaker that decides playoff seeding.
  it('counts the forfeit as a W/L but excludes its score from RF/RA/RD', () => {
    const teams = [team('Hawks'), team('Eagles')];
    // Hawks present, Eagles no-show → status 'forfeit', nominal 1-0.
    const games = [game('Hawks', 'Eagles', 1, 0, { status: 'forfeit' })];
    const rows = computeTournamentStandings('D1', teams, games);
    const hawks = rows.find(r => r.teamId === 'hawks')!;
    const eagles = rows.find(r => r.teamId === 'eagles')!;

    assert.equal(hawks.w, 1, 'forfeit win counts');
    assert.equal(hawks.l, 0);
    assert.equal(eagles.l, 1, 'no-show takes the loss');
    assert.equal(hawks.gp, 1, 'forfeit counts as a game played');

    assert.equal(hawks.rf, 0, 'forfeit RF excluded');
    assert.equal(hawks.ra, 0, 'forfeit RA excluded');
    assert.equal(hawks.rd, 0, 'forfeit RD excluded');
    assert.equal(hawks.rdRaw, 0, 'forfeit excluded from rdRaw too');
    assert.equal(eagles.rf, 0);
    assert.equal(eagles.ra, 0);
  });

  it('a forfeit does not swing run-diff seeding between two 1-0 teams', () => {
    // Hawks and Falcons each have one win. Hawks won a real blowout (10-0);
    // Falcons won by forfeit. Hawks must rank ahead on RD — the forfeit margin
    // must contribute nothing, so Falcons' RD stays 0 regardless of the nominal.
    const teams = [team('Hawks'), team('Falcons'), team('Eagles'), team('Doves')];
    const games = [
      game('Hawks', 'Eagles', 10, 0),                       // real win
      game('Falcons', 'Doves', 1, 0, { status: 'forfeit' }), // forfeit win
    ];
    const rows = computeTournamentStandings('D1', teams, games);
    const hawks = rows.find(r => r.teamId === 'hawks')!;
    const falcons = rows.find(r => r.teamId === 'falcons')!;

    assert.equal(hawks.w, 1);
    assert.equal(falcons.w, 1);
    assert.equal(falcons.rd, 0, 'forfeit contributes no run-diff');
    assert.equal(hawks.rd, 10, 'real win keeps its margin');
    // Hawks ranks ahead of Falcons (more RD), so the forfeit did not inflate seeding.
    const hawksIdx = rows.findIndex(r => r.teamId === 'hawks');
    const falconsIdx = rows.findIndex(r => r.teamId === 'falcons');
    assert.ok(hawksIdx < falconsIdx, 'Hawks (real blowout) seeds above Falcons (forfeit)');
  });

  it('includes forfeit games in standings alongside completed/submitted', () => {
    // A team with one completed win and one forfeit win = 2 GP, 2 W.
    const teams = [team('Hawks'), team('Eagles'), team('Doves')];
    const games = [
      game('Hawks', 'Eagles', 5, 3),                        // completed
      game('Hawks', 'Doves', 1, 0, { status: 'forfeit' }),  // forfeit
    ];
    const rows = computeTournamentStandings('D1', teams, games);
    const hawks = rows.find(r => r.teamId === 'hawks')!;
    assert.equal(hawks.gp, 2);
    assert.equal(hawks.w, 2);
    assert.equal(hawks.rf, 5, 'only the completed game contributes RF');
    assert.equal(hawks.ra, 3, 'only the completed game contributes RA');
  });
});

// ── computeTournamentStandings — coin toss ───────────────────────────────────

describe('computeTournamentStandings — coin toss', () => {
  // A and B each beat C, and tie each other → A & B dead-even after H2H/RD/RF/RA.
  // Build a perfectly symmetric two-team tie at the top.
  function tiedTeams() {
    return [team('Alpha'), team('Bravo')];
  }
  // Alpha & Bravo tie 5-5 head-to-head → identical W/L/T/RF/RA/RD.
  const games = [game('Alpha', 'Bravo', 5, 5)];

  it('flags needsCoinToss when coin is the deciding breaker and no result recorded', () => {
    const config = { tieBreakers: ['h2h', 'coin'] } as any;
    const rows = computeTournamentStandings('D1', tiedTeams(), games, config);
    assert.ok(rows.every(r => r.needsCoinToss), 'both tied teams flagged');
    const key = coinTossKey(['alpha', 'bravo']);
    assert.ok(rows.every(r => r.coinTossGroupKey === key));
  });

  it('applies a recorded coin-toss order and clears the flag', () => {
    const key = coinTossKey(['alpha', 'bravo']);
    const config = { tieBreakers: ['h2h', 'coin'], coinTossResults: { [key]: ['bravo', 'alpha'] } } as any;
    const rows = computeTournamentStandings('D1', tiedTeams(), games, config);
    assert.deepEqual(rank(rows), ['bravo', 'alpha'], 'ordered by recorded result');
    assert.ok(rows.every(r => !r.needsCoinToss), 'flag cleared once recorded');
  });

  it('does not flag a coin toss when an earlier breaker separates the teams', () => {
    // Alpha wins H2H 6-2 → resolved before coin is reached.
    const decisive = [game('Alpha', 'Bravo', 6, 2)];
    const config = { tieBreakers: ['h2h', 'coin'] } as any;
    const rows = computeTournamentStandings('D1', tiedTeams(), decisive, config);
    assert.deepEqual(rank(rows), ['alpha', 'bravo']);
    assert.ok(rows.every(r => !r.needsCoinToss));
  });

  it('pins coin last even if configured earlier, and flags an unbroken tie', () => {
    // ['coin','rd'] normalizes to ['rd','coin']; rd ties (5-5 → 0 each) so coin still decides → flagged.
    const config = { tieBreakers: ['coin', 'rd'] } as any;
    const rows = computeTournamentStandings('D1', tiedTeams(), games, config);
    assert.ok(rows.every(r => r.needsCoinToss));
  });

  it('does NOT flag a coin toss while the deciding game is still scheduled (pre-event)', () => {
    // Same symmetric pair, but their game hasn't been played → every team is 0–0
    // "tied", which must NOT surface a coin toss before the round-robin runs.
    const scheduled = [game('Alpha', 'Bravo', 0, 0, { status: 'scheduled' })];
    const config = { tieBreakers: ['h2h', 'coin'] } as any;
    const rows = computeTournamentStandings('D1', tiedTeams(), scheduled, config);
    assert.ok(rows.every(r => !r.needsCoinToss), 'no coin toss until games are played');
    assert.ok(rows.every(r => r.coinTossGroupKey === null));
  });

  it('does NOT flag a coin toss when the division has no games at all', () => {
    const config = { tieBreakers: ['h2h', 'coin'] } as any;
    const rows = computeTournamentStandings('D1', tiedTeams(), [], config);
    assert.ok(rows.every(r => !r.needsCoinToss));
  });

  it('holds the coin toss if a tied team still has another game scheduled', () => {
    // Alpha & Bravo tie 5-5 (played) → level at the top, but Bravo still has an
    // unplayed game, so the tie could still break on the field → not flagged yet.
    const three = [team('Alpha'), team('Bravo'), team('Charlie')];
    const gs = [
      game('Alpha', 'Bravo', 5, 5),                              // played, ties the pair
      game('Bravo', 'Charlie', 0, 0, { status: 'scheduled' }),   // Bravo isn't done
    ];
    const config = { tieBreakers: ['h2h', 'coin'] } as any;
    const rows = computeTournamentStandings('D1', three, gs, config);
    assert.ok(rows.every(r => !r.needsCoinToss), 'unsettled tie is not flagged');
  });
});

describe('computeTournamentStandings — coin toss, 3+ teams', () => {
  // A, B, C each tie each other 3-3 → all identical (pts/rd/rf/ra), H2H auto-skipped for 3+.
  function threeTeams() {
    return [team('Alpha'), team('Bravo'), team('Charlie')];
  }
  const games = [
    game('Alpha', 'Bravo', 3, 3),
    game('Alpha', 'Charlie', 3, 3),
    game('Bravo', 'Charlie', 3, 3),
  ];
  const fullOrder = { tieBreakers: ['h2h', 'rd', 'rf', 'ra', 'coin'] } as any;

  it('flags all three teams under one coin-toss group when every breaker ties', () => {
    const rows = computeTournamentStandings('D1', threeTeams(), games, fullOrder);
    assert.equal(rows.length, 3);
    assert.ok(rows.every(r => r.needsCoinToss), 'all three flagged');
    const key = coinTossKey(['alpha', 'bravo', 'charlie']);
    assert.ok(rows.every(r => r.coinTossGroupKey === key), 'single shared group key');
  });

  it('applies a recorded 3-team finishing order and clears the flag', () => {
    const key = coinTossKey(['alpha', 'bravo', 'charlie']);
    const config = { ...fullOrder, coinTossResults: { [key]: ['charlie', 'alpha', 'bravo'] } } as any;
    const rows = computeTournamentStandings('D1', threeTeams(), games, config);
    assert.deepEqual(rank(rows), ['charlie', 'alpha', 'bravo']);
    assert.ok(rows.every(r => !r.needsCoinToss));
  });

  it('only coin-flags the teams still tied after rd separates one of three', () => {
    // Charlie loses both → fewer points; Alpha & Bravo tie at the top and need the coin.
    const split = [
      game('Alpha', 'Bravo', 4, 4),
      game('Alpha', 'Charlie', 8, 0),
      game('Bravo', 'Charlie', 8, 0),
    ];
    const rows = computeTournamentStandings('D1', threeTeams(), split, fullOrder);
    const charlie = rows.find(r => r.teamId === 'charlie')!;
    assert.equal(charlie.needsCoinToss, false, 'separated team is not flagged');
    const flagged = rows.filter(r => r.needsCoinToss).map(r => r.teamId).sort();
    assert.deepEqual(flagged, ['alpha', 'bravo'], 'only the still-tied pair is flagged');
  });
});
