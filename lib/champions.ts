/**
 * lib/champions.ts
 * Shared champion derivation for fan-facing surfaces (J6-052/J6-025). A division's
 * champion is the winner of its decided bracket final — grand-final reset (GF2) >
 * grand final (GF) > single-elim/placement final (FIN), in that priority. Mirrors
 * the logic the OG image already uses so every surface agrees on who won.
 *
 * TIER-AWARE: a division can carry multiple brackets (tiers — e.g. Tier 1 championship +
 * Tier 2 consolation — or per-pool brackets), which share final codes. `groupGamesByBracketId`
 * orders those groups top-tier-first (Tier 1 < Tier 2, Gold < Silver), so the *division*
 * champion is the TOP tier's final winner — never an arbitrary lower-tier/consolation final.
 */
import type { Game, Division } from '@/lib/types';
import { groupGamesByBracketId } from '@/lib/playoff-bracket';

export interface ChampionInfo {
  division: string;
  champion: string;
  runnerUp: string | null;
}

/** A per-tier champion row — one per decided bracket group within a division. Used by the
 *  /champions recap page, which lists every tier's winner (Tier 1 headlined as THE champion,
 *  lower tiers shown as crowned tier winners beneath). */
export interface TierChampion {
  division: string;
  /** Tier/bracket-group name (e.g. "Tier 1", "Gold"); null when the division has a single bracket. */
  tierLabel: string | null;
  /** True for the top tier (the overall division championship). */
  isTopTier: boolean;
  champion: string;
  runnerUp: string | null;
  championScore: number | null;
  runnerUpScore: number | null;
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

/** The decided final within a single bracket group (GF2 → GF → FIN priority), or undefined. */
function decidedFinalOfGroup(groupGames: Game[]): Game | undefined {
  const byCode = (code: string) => groupGames.find(g => (g.bracketCode ?? '').toUpperCase() === code);
  return [byCode('GF2'), byCode('GF'), byCode('FIN')].find(isDecided);
}

/** The decided championship final for a division — the TOP tier's final (tier-aware).
 *  Tiered/per-pool brackets share final codes, so we group by bracket and read the
 *  first (top) group; returns undefined if the top tier's final isn't decided yet. */
export function decidedFinalFor(games: Game[], divisionId: string): Game | undefined {
  const pg = games.filter(g => g.isPlayoff && g.divisionId === divisionId);
  if (pg.length === 0) return undefined;
  const groups = groupGamesByBracketId(pg);
  return groups.length > 0 ? decidedFinalOfGroup(groups[0].games) : undefined;
}

/** Derive champions per division from decided TOP-tier bracket finals. Divisions without a
 *  decided top-tier final are omitted. `teams` only needs id + name. */
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

/** Derive a winner for EVERY decided bracket tier/group across all divisions, ordered
 *  division-then-top-tier-first. Used by the /champions recap page to celebrate each tier
 *  (Tier 1 flagged `isTopTier` as THE champion). A single-bracket division yields one row
 *  with `tierLabel: null`. */
export function deriveTierChampions(
  games: Game[],
  teams: Array<{ id: string; name: string }>,
  divisions: Division[],
): TierChampion[] {
  const teamName = (id?: string | null) => (id ? teams.find(t => t.id === id)?.name ?? null : null);
  const out: TierChampion[] = [];
  for (const div of divisions) {
    const pg = games.filter(g => g.isPlayoff && g.divisionId === div.id);
    if (pg.length === 0) continue;
    const groups = groupGamesByBracketId(pg);
    const multi = groups.length > 1;
    groups.forEach((grp, i) => {
      const finalG = decidedFinalOfGroup(grp.games);
      if (!finalG) return;
      const homeWon = (finalG.homeScore ?? 0) > (finalG.awayScore ?? 0);
      const champId = homeWon ? finalG.homeTeamId : finalG.awayTeamId;
      const loserId = homeWon ? finalG.awayTeamId : finalG.homeTeamId;
      const champion = teamName(champId);
      if (!champion) return;
      out.push({
        division: div.name,
        tierLabel: multi ? (grp.label ?? `Bracket ${i + 1}`) : null,
        isTopTier: i === 0,
        champion,
        runnerUp: teamName(loserId),
        championScore: homeWon ? (finalG.homeScore ?? null) : (finalG.awayScore ?? null),
        runnerUpScore: homeWon ? (finalG.awayScore ?? null) : (finalG.homeScore ?? null),
      });
    });
  }
  return out;
}

/**
 * True once the WHOLE tournament's playoffs are complete: it has ≥1 playoff game, every
 * playoff game is terminal (`completed`/`forfeit`/`cancelled` — no `scheduled`/`submitted`
 * game still pending), and at least one division has a decided championship final. This is
 * the live signal (independent of any manual "completed" status flag) that drives the home
 * Champions hero takeover, the /champions recap page, and the one-time "Champions crowned"
 * announcement. The double-elim if-necessary reset (GF2) auto-cancels when unneeded, so it
 * never blocks completion; a tie-stalled elimination game stays `scheduled` and correctly does.
 */
export function isTournamentPlayoffsComplete(games: Game[], divisions: Division[]): boolean {
  const playoffGames = games.filter(g => g.isPlayoff);
  if (playoffGames.length === 0) return false;
  const allTerminal = playoffGames.every(
    g => g.status === 'completed' || g.status === 'forfeit' || g.status === 'cancelled',
  );
  if (!allTerminal) return false;
  return divisions.some(d => decidedFinalFor(games, d.id) != null);
}
