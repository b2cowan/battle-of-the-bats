/**
 * lib/playoff-standings.ts
 * Final 1..N ranking for a full-placement bracket, derived from the games.
 *
 * Every team in a placement bracket ends at exactly one "terminal" landing spot
 * (a Winner/Loser ref that no later game consumes). The number of terminals is N,
 * and `placementPlaces(N)` maps each terminal ref to its place. We resolve each
 * ref to a team via the actual game results. Undecided games leave that place TBD.
 */

import type { Game, PublicTeam } from '@/lib/types';
import { placementPlaces } from '@/lib/playoff-bracket';

export interface PlacementStandingRow {
  place: number;
  teamId: string | null;
  teamName: string | null; // null while the deciding game is undecided
}

function decidedWinnerLoser(g: Game): { winner: string | null; loser: string | null } {
  if (g.homeScore == null || g.awayScore == null || g.homeScore === g.awayScore) {
    return { winner: null, loser: null };
  }
  if (g.status !== 'completed' && g.status !== 'submitted') return { winner: null, loser: null };
  const homeWin = g.homeScore > g.awayScore;
  return {
    winner: (homeWin ? g.homeTeamId : g.awayTeamId) ?? null,
    loser: (homeWin ? g.awayTeamId : g.homeTeamId) ?? null,
  };
}

/**
 * Compute the placement ranking from a division's playoff games. Returns rows
 * ordered by place (1..N), with `teamName` null for places whose deciding game
 * is not yet final. Returns [] when there is no resolvable bracket.
 */
export function computePlacementStandings(games: Game[], teams: PublicTeam[]): PlacementStandingRow[] {
  const playoff = games.filter(g => g.isPlayoff && g.bracketCode);
  if (playoff.length === 0) return [];

  const byCode = new Map(playoff.map(g => [g.bracketCode as string, g]));
  const referenced = new Set<string>();
  for (const g of playoff) {
    if (g.homePlaceholder) referenced.add(g.homePlaceholder);
    if (g.awayPlaceholder) referenced.add(g.awayPlaceholder);
  }

  // Terminal landing spots — Winner/Loser refs no later game consumes. Count = N.
  const terminals: string[] = [];
  for (const g of playoff) {
    const w = `Winner ${g.bracketCode}`;
    const l = `Loser ${g.bracketCode}`;
    if (!referenced.has(w)) terminals.push(w);
    if (!referenced.has(l)) terminals.push(l);
  }
  const n = terminals.length;
  if (n < 2) return [];

  const placeByRef = placementPlaces(n);
  if (placeByRef.size !== n) return []; // codes don't line up with a placement bracket

  const resolve = (ref: string): string | null => {
    const m = ref.match(/^(Winner|Loser) (.+)$/);
    if (!m) return null;
    const g = byCode.get(m[2]);
    if (!g) return null;
    const { winner, loser } = decidedWinnerLoser(g);
    return m[1] === 'Winner' ? winner : loser;
  };

  return [...placeByRef.entries()]
    .map(([ref, place]) => {
      const teamId = resolve(ref);
      const team = teamId ? teams.find(t => t.id === teamId) : null;
      return { place, teamId: teamId ?? null, teamName: team?.name ?? null };
    })
    .sort((a, b) => a.place - b.place);
}
