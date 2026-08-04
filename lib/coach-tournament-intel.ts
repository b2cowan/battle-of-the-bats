/**
 * lib/coach-tournament-intel.ts
 * Opponent Scouting Book P3 — "Their tournament so far", the moat block. Pure logic, no I/O
 * (unit tests: tests/unit/coach-tournament-intel.test.ts).
 *
 * For a MIRRORED tournament game, assemble the opponent's OTHER results in that SAME
 * tournament from organizer-side data the platform already hosts. Strictly the public
 * story — what that tournament's own standings and schedule pages already publish, and
 * nothing more. Two rulings bind:
 *
 *  ⚠ SAME tournament only (plan §9 Q4, owner 2026-08-04). The opponent's results in OTHER
 *    platform tournaments are cross-event profiling of a team and need an explicit owner
 *    comfort ruling first — do not widen this read "while you're in here".
 *  ⚠ Results and standings only — never opposing rosters, never people. The payload carries
 *    team names, scores and schedule labels and nothing else; the no-names unit test pins
 *    the exact key set so a new field is a deliberate decision, not a drift.
 *
 * Reveal rules are the mirrored-chip's own (CoachScheduleTournamentGame — do not re-derive):
 *  - the tournament is publicly visible (active|completed) — a draft has no public pages,
 *    so it has no "public results" to echo;
 *  - the opponent's division has a PUBLISHED schedule;
 *  - team names resolve from ACCEPTED teams only (else the game's placeholder, else TBD).
 */
import {
  computeTournamentStandings,
  type StandingsGameInput,
  type StandingsTeamInput,
} from './tie-breakers';
import type { TournamentSettings } from './types';

export interface IntelDivisionInput {
  id: string;
  scheduleVisibility?: 'unpublished' | 'published';
  playoffConfig?: Parameters<typeof computeTournamentStandings>[3];
  pools?: { id: string; name: string }[];
}

/** The organizer-side game slice this block reads (domain `Game` satisfies it structurally). */
export interface IntelGameInput extends StandingsGameInput {
  id: string;
  /** 'YYYY-MM-DD' — the tournament's wall clock, exactly as its public schedule shows it. */
  date?: string | null;
  /** 'HH:MM' */
  time?: string | null;
  homePlaceholder?: string | null;
  awayPlaceholder?: string | null;
}

export interface OpponentTournamentIntelGame {
  gameId: string;
  result: 'win' | 'loss' | 'tie';
  theirScore: number;
  otherScore: number;
  otherTeamName: string;
  gameDate: string | null;
  gameTime: string | null;
  isPlayoff: boolean;
  /** A forfeit's scoreline is a nominal margin, not a played game — the row says so, because
   *  its scores are deliberately excluded from the unit totals shown beneath it. */
  isForfeit: boolean;
}

export interface OpponentTournamentIntel {
  tournamentName: string;
  opponentTeamName: string;
  /** Their played games in THIS tournament, oldest first — the game vs us excluded. */
  results: OpponentTournamentIntelGame[];
  /** score.unit totals over the shown results. Forfeits count as results but not here —
   *  the nominal forfeit margin is invented, exactly as the standings engine treats it. */
  unitFor: number;
  unitAgainst: number;
  standing: {
    rank: number;
    groupSize: number;
    /** Pool display name; null = ranked over the whole division. */
    poolName: string | null;
  } | null;
}

/** A result is a game that produced one: finalized, forfeited, or score submitted. */
const RESULT_STATUSES = new Set(['completed', 'submitted', 'forfeit']);

export function assembleOpponentTournamentIntel(opts: {
  /** The mirrored game the coach is looking at — excluded ("their OTHER results"). */
  sourceGameId: string;
  /** The opponent's organizer-side registration (`teams.id`) in this tournament. */
  opponentTeamId: string;
  tournamentName: string;
  tournamentStatus: string;
  tournamentSettings?: TournamentSettings;
  divisions: IntelDivisionInput[];
  teams: StandingsTeamInput[];
  games: IntelGameInput[];
}): OpponentTournamentIntel | null {
  const { sourceGameId, opponentTeamId, divisions, teams, games } = opts;
  if (opts.tournamentStatus !== 'active' && opts.tournamentStatus !== 'completed') return null;

  const opponent = teams.find(t => t.id === opponentTeamId);
  if (!opponent || opponent.status !== 'accepted') return null;
  const division = divisions.find(d => d.id === opponent.divisionId);
  if (!division || division.scheduleVisibility !== 'published') return null;

  const acceptedNameById = new Map(
    teams.filter(t => t.status === 'accepted').map(t => [t.id, t.name] as const),
  );

  // ⚠ PER-GAME division check, not just the opponent's current one. A team can be moved
  // between divisions mid-tournament, and its old games keep their old `divisionId` — a game
  // filed under a division whose schedule was never published must not surface here, however
  // the roster shuffles. The reveal rule is about the GAME's division, so it is enforced there.
  const publishedDivisionIds = new Set(
    divisions.filter(d => d.scheduleVisibility === 'published').map(d => d.id),
  );

  const theirGames = games
    .filter(g =>
      g.id !== sourceGameId &&
      (g.homeTeamId === opponentTeamId || g.awayTeamId === opponentTeamId) &&
      publishedDivisionIds.has(g.divisionId) &&
      RESULT_STATUSES.has(g.status ?? '') &&
      g.homeScore != null && g.awayScore != null,
    )
    .sort((a, b) => `${a.date ?? ''}T${a.time ?? ''}`.localeCompare(`${b.date ?? ''}T${b.time ?? ''}`));

  // No results yet = no block. A standing at 0-0 says nothing, and an empty "so far" card
  // would be noise on every first game of the weekend.
  if (theirGames.length === 0) return null;

  let unitFor = 0;
  let unitAgainst = 0;
  const results: OpponentTournamentIntelGame[] = theirGames.map(g => {
    const isHome = g.homeTeamId === opponentTeamId;
    const theirScore = (isHome ? g.homeScore : g.awayScore) as number;
    const otherScore = (isHome ? g.awayScore : g.homeScore) as number;
    if (g.status !== 'forfeit') {
      unitFor += theirScore;
      unitAgainst += otherScore;
    }
    const otherId = isHome ? g.awayTeamId : g.homeTeamId;
    return {
      gameId: g.id,
      result: theirScore > otherScore ? 'win' : theirScore < otherScore ? 'loss' : 'tie',
      theirScore,
      otherScore,
      otherTeamName:
        (otherId ? acceptedNameById.get(otherId) : undefined)
          ?? (isHome ? g.awayPlaceholder : g.homePlaceholder)
          ?? 'TBD',
      gameDate: g.date ?? null,
      gameTime: g.time ?? null,
      isPlayoff: Boolean(g.isPlayoff),
      isForfeit: g.status === 'forfeit',
    };
  });

  // Standing comes from THE tie-break engine, never a local re-compute (J6-032's lesson),
  // ranked within the opponent's pool when pools exist — matching the public standings table.
  const ranked = computeTournamentStandings(
    division.id, teams, games, division.playoffConfig, opts.tournamentSettings,
  );
  const group = opponent.poolId ? ranked.filter(r => r.poolId === opponent.poolId) : ranked;
  const idx = group.findIndex(r => r.teamId === opponentTeamId);
  const row = idx >= 0 ? group[idx] : null;
  const standing = row && row.gp > 0
    ? {
        rank: idx + 1,
        groupSize: group.length,
        poolName:
          (opponent.poolId ? division.pools?.find(p => p.id === opponent.poolId)?.name : null)
            ?? null,
      }
    : null;

  return {
    tournamentName: opts.tournamentName,
    opponentTeamName: opponent.name,
    results,
    unitFor,
    unitAgainst,
    standing,
  };
}
