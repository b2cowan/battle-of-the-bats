import type { Team, Game, PlayoffConfig, TournamentSettings } from './types';

/**
 * Shared tie-breaker vocabulary for tournament standings + playoff seeding.
 *
 * Single source of truth for the breaker union, display labels, defaults, and
 * validation — imported by the standings engine (lib/db.ts), both config UIs
 * (Event Settings + Divisions), the shared <TieBreakerEditor>, the standings
 * display, and the admin API validators. Keep this in sync nowhere else.
 *
 * Breakers:
 *  - h2h  Head-to-Head   (auto-skipped when 3+ teams are tied)
 *  - rd   Run Diff       (uses the per-game-capped value when a cap is set)
 *  - rf   Runs For
 *  - ra   Runs Against
 *  - coin Coin Toss      (TERMINAL — can't be computed; resolved by an
 *                         admin-recorded result. Anything ordered after it is
 *                         never reached. See coinTossKey + PlayoffConfig.coinTossResults.)
 */

export type TieBreaker = 'h2h' | 'rf' | 'ra' | 'rd' | 'coin';

/** Every selectable breaker, in the canonical "add" order. */
export const ALL_TIE_BREAKERS: readonly TieBreaker[] = ['h2h', 'rd', 'rf', 'ra', 'coin'];

/** The legacy default order applied when nothing is configured. */
export const DEFAULT_TIE_BREAKERS: readonly TieBreaker[] = ['h2h', 'rd', 'rf', 'ra'];

export const BREAKER_LABELS: Record<TieBreaker, string> = {
  h2h: 'Head-to-Head',
  rd: 'Run Diff',
  rf: 'Runs For',
  ra: 'Runs Against',
  coin: 'Coin Toss',
};

/** Short descriptions for the editor's "add" chips / tooltips. */
export const BREAKER_DESCRIPTIONS: Record<TieBreaker, string> = {
  h2h: 'Winner of the game(s) between the tied teams (skipped if 3+ are tied)',
  rd: 'Higher run differential (capped per game when a cap is set)',
  rf: 'More total runs scored',
  ra: 'Fewer total runs allowed',
  coin: 'Final tie-breaker — organizer records the coin-toss winner',
};

const VALID = new Set<string>(ALL_TIE_BREAKERS);

export function isTieBreaker(v: unknown): v is TieBreaker {
  return typeof v === 'string' && VALID.has(v);
}

/**
 * Coerce stored/posted data into a valid, de-duplicated breaker list.
 * Allows a SUBSET (organizers can remove breakers) and preserves order.
 * Falls back to the default order only when nothing valid remains (guard ≥1).
 */
export function normalizeTieBreakers(values: unknown): TieBreaker[] {
  if (!Array.isArray(values)) return [...DEFAULT_TIE_BREAKERS];
  const seen = new Set<string>();
  const out: TieBreaker[] = [];
  for (const v of values) {
    if (isTieBreaker(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  if (out.length === 0) return [...DEFAULT_TIE_BREAKERS];
  // Coin Toss is terminal — always force it to the last slot so the engine, editor,
  // and every standings display agree, regardless of how the value was stored.
  if (out.includes('coin')) return [...out.filter(b => b !== 'coin'), 'coin'];
  return out;
}

/** Breakers not currently in the active list (the editor's "add" options). */
export function availableTieBreakers(active: TieBreaker[]): TieBreaker[] {
  const set = new Set(active);
  return ALL_TIE_BREAKERS.filter(b => !set.has(b));
}

export const MAX_RUN_DIFF_CAP = 99;

/**
 * Normalize a "max run differential per game" cap.
 * Returns a positive integer (1–99) or null = no cap.
 * 0, negative, empty, and non-numeric all mean "no cap".
 */
export function clampRunDiffCap(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0) return null;
  return Math.min(i, MAX_RUN_DIFF_CAP);
}

/**
 * Apply a run-diff cap to a single game's differential (winner perspective).
 * cap=null → uncapped. A 14-0 game with cap 7 → +7.
 */
export function cappedGameDiff(diff: number, cap: number | null): number {
  if (cap === null || cap <= 0) return diff;
  return Math.max(-cap, Math.min(cap, diff));
}

/**
 * Stable key for a tied group's recorded coin-toss order.
 * Keyed by the SORTED set of tied team ids, so the result auto-invalidates
 * if the tied set later changes (e.g. a score correction breaks the tie).
 */
export function coinTossKey(teamIds: string[]): string {
  return [...teamIds].sort().join('|');
}

export interface DivisionStandingRow {
  teamId: string;
  teamName: string;
  poolId?: string;
  gp: number;
  w: number;
  l: number;
  t: number;
  pts: number;
  rf: number;
  ra: number;
  /** Run differential — sum of per-game-capped diffs (== rf - ra when no cap). */
  rd: number;
  /** True uncapped run differential (rf - ra), kept for reference. */
  rdRaw: number;
  /** Active run-diff-per-game cap (null = none). */
  runDiffCap: number | null;
  /** Set when 'coin' is the deciding breaker for this team's tied group and no result is recorded. */
  needsCoinToss: boolean;
  coinTossGroupKey: string | null;
  hasPendingGame: boolean;
}

/**
 * Pure round-robin standings + tie-break ranking for ONE division. Filters the
 * supplied teams/games by division (+ accepted / completed|submitted / non-playoff)
 * then ranks them. Lives here (no runtime imports) so the tie-break engine is
 * unit-testable without DB access, and so callers that already hold the
 * tournament's teams+games (e.g. the admin dashboard) can rank every division
 * without re-querying. lib/db.ts re-exports this for existing import sites.
 */
export function computeTournamentStandings(
  divisionId: string,
  teams: Team[],
  games: Game[],
  config?: PlayoffConfig,
  tournamentSettings?: TournamentSettings,
): DivisionStandingRow[] {
  const groupTeams = teams.filter(t => t.divisionId === divisionId && t.status === 'accepted');
  const groupGames = games.filter(g =>
    g.divisionId === divisionId &&
    (g.status === 'completed' || g.status === 'submitted') &&
    !g.isPlayoff
  );

  // Max run-differential-per-game cap: division override → tournament default → none.
  // Caps the RD column ONLY (rf/ra stay raw totals), per product decision 2026-06-10.
  const runDiffCap = clampRunDiffCap(config?.maxRunDiffPerGame ?? tournamentSettings?.max_run_diff_per_game ?? null);

  const teamStats = groupTeams.map(t => {
    const teamGames = groupGames.filter(g => g.homeTeamId === t.id || g.awayTeamId === t.id);
    let wins = 0, losses = 0, ties = 0, rf = 0, ra = 0, cappedRd = 0;

    teamGames.forEach(g => {
      const isHome = g.homeTeamId === t.id;
      const tScore = isHome ? (g.homeScore || 0) : (g.awayScore || 0);
      const oScore = isHome ? (g.awayScore || 0) : (g.homeScore || 0);

      rf += tScore;
      ra += oScore;
      cappedRd += cappedGameDiff(tScore - oScore, runDiffCap);
      if (tScore > oScore) wins++;
      else if (tScore < oScore) losses++;
      else ties++;
    });

    return {
      teamId: t.id,
      teamName: t.name,
      poolId: t.poolId,
      gp: teamGames.length,
      w: wins,
      l: losses,
      t: ties,
      pts: (wins * 2) + ties,
      rf,
      ra,
      // rd = sum of per-game-capped diffs (equals rf - ra when no cap). Drives the
      // 'rd' breaker AND the displayed RD column. rdRaw keeps the true uncapped value.
      rd: cappedRd,
      rdRaw: rf - ra,
      runDiffCap,
      // Set by the 'coin' breaker when a tied group has no recorded coin-toss result.
      needsCoinToss: false,
      coinTossGroupKey: null as string | null,
      hasPendingGame: teamGames.some(g => g.status === 'submitted'),
    };
  });

  // Tie-breaker priority: division playoffConfig → tournament settings → default.
  // normalizeTieBreakers allows a subset (organizer can remove breakers) + 'coin'.
  const breakers = normalizeTieBreakers(config?.tieBreakers || tournamentSettings?.tie_breakers);
  // Admin-recorded coin-toss results (per-division), keyed by the sorted tied set.
  const coinTossResults: Record<string, string[]> = config?.coinTossResults || {};

  function breakTies(tiedTeams: any[], breakerIndex: number): any[] {
    if (tiedTeams.length <= 1 || breakerIndex >= breakers.length) return tiedTeams;

    const breaker = breakers[breakerIndex];

    // Coin Toss is TERMINAL and admin-resolved — it can't be computed, so it never
    // recurses to a later breaker. If the organizer has recorded a finishing order
    // for this exact tied set, apply it; otherwise flag the group so the admin can
    // record one. Anything ordered after 'coin' is intentionally never reached.
    if (breaker === 'coin') {
      const key = coinTossKey(tiedTeams.map(t => t.teamId));
      const recordedOrder = coinTossResults[key];
      if (Array.isArray(recordedOrder) && recordedOrder.length > 0) {
        const rank = new Map(recordedOrder.map((id, idx) => [id, idx]));
        return [...tiedTeams].sort((a, b) =>
          (rank.has(a.teamId) ? rank.get(a.teamId)! : Number.MAX_SAFE_INTEGER) -
          (rank.has(b.teamId) ? rank.get(b.teamId)! : Number.MAX_SAFE_INTEGER)
        );
      }
      tiedTeams.forEach(t => { t.needsCoinToss = true; t.coinTossGroupKey = key; });
      return tiedTeams;
    }

    // Skip H2H if 3+ teams are tied
    if (breaker === 'h2h' && tiedTeams.length >= 3) {
      return breakTies(tiedTeams, breakerIndex + 1);
    }

    const sorted = [...tiedTeams];
    if (breaker === 'h2h') {
      // Compare the two teams directly
      const t1 = tiedTeams[0];
      const t2 = tiedTeams[1];
      const h2hGames = groupGames.filter(g =>
        (g.homeTeamId === t1.teamId && g.awayTeamId === t2.teamId) ||
        (g.homeTeamId === t2.teamId && g.awayTeamId === t1.teamId)
      );
      let t1Wins = 0, t2Wins = 0;
      h2hGames.forEach(g => {
        const t1Score = g.homeTeamId === t1.teamId ? (g.homeScore || 0) : (g.awayScore || 0);
        const t2Score = g.homeTeamId === t2.teamId ? (g.homeScore || 0) : (g.awayScore || 0);
        if (t1Score > t2Score) t1Wins++;
        else if (t2Score > t1Score) t2Wins++;
      });
      if (t1Wins !== t2Wins) {
        return t1Wins > t2Wins ? [t1, t2] : [t2, t1];
      }
      // Indecisive head-to-head (tied or never played) → fall through to the next
      // breaker on the whole group rather than freezing the current order.
      return breakTies(tiedTeams, breakerIndex + 1);
    } else if (breaker === 'rf') {
      sorted.sort((a, b) => b.rf - a.rf);
    } else if (breaker === 'ra') {
      sorted.sort((a, b) => a.ra - b.ra);
    } else if (breaker === 'rd') {
      sorted.sort((a, b) => b.rd - a.rd);
    }

    // After sorting by current breaker, group them again if still tied
    const results: any[] = [];
    let i = 0;
    while (i < sorted.length) {
      const current = sorted[i];
      const subGroup = [current];
      let j = i + 1;
      while (j < sorted.length) {
        const next = sorted[j];
        // Only rf/ra/rd reach the grouping loop — h2h and coin always return earlier,
        // so breaker is narrowed to 'rf' | 'ra' | 'rd' here (the final branch is 'rd').
        const stillTied =
          breaker === 'rf' ? next.rf === current.rf :
          breaker === 'ra' ? next.ra === current.ra :
          next.rd === current.rd;
        if (stillTied) {
          subGroup.push(next);
          j++;
        } else break;
      }

      if (subGroup.length > 1) {
        results.push(...breakTies(subGroup, breakerIndex + 1));
      } else {
        results.push(current);
      }
      i = j;
    }
    return results;
  }

  // Initial sort by Points
  const byPoints: Record<number, any[]> = {};
  teamStats.forEach(s => {
    if (!byPoints[s.pts]) byPoints[s.pts] = [];
    byPoints[s.pts].push(s);
  });

  const finalStandings: DivisionStandingRow[] = [];
  Object.keys(byPoints).sort((a, b) => Number(b) - Number(a)).forEach(pts => {
    finalStandings.push(...breakTies(byPoints[Number(pts)], 0));
  });

  return finalStandings;
}
