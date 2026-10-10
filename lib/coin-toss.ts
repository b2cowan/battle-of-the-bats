/**
 * THE COIN TOSS THAT IS STILL OWED (Tournament admin redesign Stage 3, S7 / A43, ruled 2026-10-09).
 *
 * When "Coin toss" decides a tie, the standings engine flags the tied group (`needsCoinToss`, `coinTossGroupKey` —
 * lib/tie-breakers.ts) until the organizer records a finishing order. This reads those flags into what the screens
 * say: which teams, which places they are tied for, and which playoff games wait on it. ONE reading for every place
 * that says it — the schedule's Bracket view, Results' "Needs you" and the dashboard's nudge — so the three can never
 * name a different tie. It ranks with the engine itself (`computeTournamentStandings`); it never ranks on its own.
 *
 * A place is what a playoff slot reads: a "Seed #N" slot takes the division table's Nth team, an "Nth Pool X" slot
 * the pool table's Nth team — read by `parseStandingsSlot`, the grammar `resolveAndFillPlayoffSeeds` (lib/db.ts)
 * fills the bracket by.
 *
 * Pure: no React, no reads.
 */
import { computeTournamentStandings, resolveTieBreakers, type StandingsGameInput, type StandingsTeamInput } from './tie-breakers.ts';
import type { PlayoffConfig, TournamentSettings } from './types';
import { formatPoolName } from './utils.ts';
import { parseStandingsSlot, samePoolName } from './playoff-bracket.ts';

export interface CoinTossDivision {
  id: string;
  name: string;
  playoffConfig?: PlayoffConfig;
  pools?: { id: string; name: string }[];
}

export interface CoinTossGame extends StandingsGameInput {
  id: string;
  bracketCode?: string | null;
  homePlaceholder?: string | null;
  awayPlaceholder?: string | null;
}

export interface PendingToss {
  divisionId: string;
  divisionName: string;
  /** The engine's key for this tied set (`coinTossKey`) — what the record action stores the order under. */
  groupKey: string;
  /** The tied teams, in the order the table shows them today. */
  teams: { id: string; name: string }[];
  /** The places they are tied for, best first (2 and 3) — division-wide seeds, or places in `pool`. */
  places: number[];
  /** The pool those places are in, as the product names a pool ("A Pool"), when the bracket reads the pool's table
   *  (a "2nd Pool A" slot); null for seeds. */
  pool: string | null;
  /** The playoff games still to play whose slots wait on it ("Semifinal 2"), in bracket order. */
  waits: { gameId: string; bracketCode: string }[];
}

const STARTED = new Set(['submitted', 'completed', 'forfeit', 'cancelled']);

/** Every coin toss still owed in the tournament, by division in the order given. */
export function pendingCoinTosses(input: {
  divisions: readonly CoinTossDivision[];
  teams: readonly StandingsTeamInput[];
  games: readonly CoinTossGame[];
  settings?: TournamentSettings | null;
}): PendingToss[] {
  const settings = input.settings ?? undefined;
  const out: PendingToss[] = [];
  for (const d of input.divisions) {
    // The cheap guard the dashboard always made: the engine only flags a tie when the toss is one of its breakers.
    if (!resolveTieBreakers(d.playoffConfig, settings).includes('coin')) continue;
    const rows = computeTournamentStandings(d.id, [...input.teams], [...input.games], d.playoffConfig, settings);
    const keys = [...new Set(rows.filter(r => r.needsCoinToss && r.coinTossGroupKey).map(r => r.coinTossGroupKey as string))];
    if (keys.length === 0) continue;
    const playoffGames = input.games.filter(g => g.isPlayoff && g.divisionId === d.id && !STARTED.has(g.status ?? ''));
    for (const key of keys) {
      const tied = rows.filter(r => r.coinTossGroupKey === key);
      const seeds = tied.map(r => rows.indexOf(r) + 1);
      // A pool's places, when every tied team is in the same pool of a division with pools.
      const poolId = tied[0].poolId;
      const pool = poolId && tied.every(r => r.poolId === poolId) ? d.pools?.find(p => p.id === poolId) ?? null : null;
      const poolRows = pool ? rows.filter(r => r.poolId === pool.id) : [];
      const poolPlaces = pool ? tied.map(r => poolRows.indexOf(r) + 1) : [];

      const waitsOnPool = (ph: string | null | undefined) => {
        const slot = parseStandingsSlot(ph);
        return slot?.kind === 'pool' && !!pool && samePoolName(slot.pool, pool.name) && poolPlaces.includes(slot.place);
      };
      const waitsOnSeed = (ph: string | null | undefined) => {
        const slot = parseStandingsSlot(ph);
        return slot?.kind === 'seed' && seeds.includes(slot.place);
      };
      const slots = (g: CoinTossGame) => [g.homePlaceholder, g.awayPlaceholder];
      const byPool = playoffGames.filter(g => slots(g).some(waitsOnPool));
      const bySeed = playoffGames.filter(g => slots(g).some(waitsOnSeed));
      // The bracket says which table it reads: pool slots when it names them, the division's seeds otherwise.
      const readsPool = byPool.length > 0 && bySeed.length === 0;
      const waits = (readsPool ? byPool : bySeed)
        .map(g => ({ gameId: g.id, bracketCode: g.bracketCode ?? '' }))
        .sort((a, b) => a.bracketCode.localeCompare(b.bracketCode));
      out.push({
        divisionId: d.id,
        divisionName: d.name,
        groupKey: key,
        teams: tied.map(r => ({ id: r.teamId, name: r.teamName })),
        places: readsPool ? poolPlaces : seeds,
        pool: readsPool && pool ? formatPoolName(pool.name) : null,
        waits,
      });
    }
  }
  return out;
}

/** The ids of the games waiting on any of these tosses. */
export function gamesWaitingOnToss(tosses: readonly PendingToss[]): Set<string> {
  return new Set(tosses.flatMap(t => t.waits.map(w => w.gameId)));
}
