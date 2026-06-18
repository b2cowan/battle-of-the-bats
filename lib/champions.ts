/**
 * lib/champions.ts
 * Shared champion derivation for fan-facing surfaces (J6-052/J6-025). A division's
 * champion is the winner of its decided bracket final — grand-final reset (GF2) >
 * grand final (GF) > single-elim/placement final (FIN), in that priority. Mirrors
 * the logic the OG image already uses so every surface agrees on who won.
 */
import type { Game, Division } from '@/lib/types';

export interface ChampionInfo {
  division: string;
  champion: string;
  runnerUp: string | null;
}

/** A bracket final is "decided" once it's scored with a clear winner and both sides
 *  filled. Includes 'forfeit' — a forfeited final records scores (winner FORFEIT_SCORE,
 *  loser 0) and is terminal, so finalizing a forfeit must not drop the champion. */
export function isDecided(g?: Game): boolean {
  return !!g
    && (g.status === 'completed' || g.status === 'submitted' || g.status === 'forfeit')
    && g.homeScore != null && g.awayScore != null && g.homeScore !== g.awayScore
    && !!g.homeTeamId && !!g.awayTeamId;
}

/** The decided final for a division (GF2 → GF → FIN priority), or undefined. */
export function decidedFinalFor(games: Game[], divisionId: string): Game | undefined {
  const pg = games.filter(g => g.isPlayoff && g.divisionId === divisionId);
  const byCode = (code: string) => pg.find(g => (g.bracketCode ?? '').toUpperCase() === code);
  return [byCode('GF2'), byCode('GF'), byCode('FIN')].find(isDecided);
}

/** Derive champions per division from decided bracket finals. Divisions without a
 *  decided final are omitted. `teams` only needs id + name. */
export function deriveChampions(
  games: Game[],
  teams: Array<{ id: string; name: string }>,
  divisions: Division[],
): ChampionInfo[] {
  const teamName = (id?: string | null) => (id ? teams.find(t => t.id === id)?.name ?? null : null);
  const result: ChampionInfo[] = [];
  for (const div of divisions) {
    const finalG = decidedFinalFor(games, div.id);
    if (!finalG) continue;
    const champId = (finalG.homeScore ?? 0) > (finalG.awayScore ?? 0) ? finalG.homeTeamId : finalG.awayTeamId;
    const loserId = champId === finalG.homeTeamId ? finalG.awayTeamId : finalG.homeTeamId;
    const champion = teamName(champId);
    if (champion) result.push({ division: div.name, champion, runnerUp: teamName(loserId) });
  }
  return result;
}
