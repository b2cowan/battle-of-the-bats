/**
 * THE TOURNAMENT'S OWN OVERLAP RULE (Tournament admin redesign Stage 3, A37 — S6-03). Pure: the schedule's screens and
 * every writer on the server read the same rule and say it in the same words.
 *
 *   · REFUSED: two games of one tournament on one KNOWN surface — a picked diamond, a venue with no diamond set on one
 *     side, a temporary lane — for any part of the chain's length (A39). Every door refuses it and so does the server.
 *   · WARNED: two games whose TYPED place names match — the field says a typed place isn't checked (house league's
 *     rule, and the import's: a matching spelling is not proof of one diamond). A gap shorter than the buffer warns too.
 *   · NEVER HERE: another of the club's programs on the diamond — Club Tier 6a's amber line, which never refuses.
 *
 * A batch (a generator's draft, a rain delay, the bracket editor's save) is checked in order against the games it
 * does not touch and against its own earlier games, so two games of one draft can't share a diamond either.
 */
import type { Division, Game, Tournament } from './types';
import { checkPlacedConflict, resolveGameTiming, timeToMinutes, minutesToTime, toConflictGame, toPlacedGame, type ConflictGame, type ConflictResult, type PlacedGame } from './schedule-conflict.ts';
import { bracketGameLabel } from './playoff-bracket.ts';
import { formatTime, formatTimeRange } from './utils.ts';
import { GAME_WINDOW_WORDS as G, teamOrSlotWords } from './schedule-words.ts';

/** A game as the rule and its words read it: the conflict shape, plus what names it in a sentence. */
export interface OverlapGame extends ConflictGame {
  isPlayoff?: boolean | null;
  bracketCode?: string | null;
  homeName?: string | null;
  awayName?: string | null;
  homePlaceholder?: string | null;
  awayPlaceholder?: string | null;
}

/** A screen's game as the rule reads it, with its teams' names for the sentence. */
export function overlapGameOf(
  g: Pick<Game, 'id' | 'date' | 'time' | 'status' | 'venueId' | 'venueFacilityId' | 'scheduleFacilityLaneId' | 'scheduleFacilityLaneLabel'
    | 'location' | 'divisionId' | 'durationMinutes' | 'isPlayoff' | 'bracketCode' | 'homeTeamId' | 'awayTeamId' | 'homePlaceholder' | 'awayPlaceholder'>,
  teamName: (id: string | null | undefined) => string | null | undefined,
): OverlapGame {
  return {
    ...toConflictGame(g),
    isPlayoff: g.isPlayoff ?? false,
    bracketCode: g.bracketCode ?? null,
    homeName: teamName(g.homeTeamId) ?? null,
    awayName: teamName(g.awayTeamId) ?? null,
    homePlaceholder: g.homePlaceholder ?? null,
    awayPlaceholder: g.awayPlaceholder ?? null,
  };
}

/** Every game as the check reads it, the teams named by one lookup — the timeline's pool and the game window's. */
export function overlapPool(
  games: readonly Parameters<typeof overlapGameOf>[0][],
  teams: readonly { id: string; name: string }[],
): OverlapGame[] {
  const names = new Map(teams.map(t => [t.id, t.name]));
  return games.map(g => overlapGameOf(g, id => (id ? names.get(id) : null)));
}

/** Refused: an overlap on a known surface. A typed-name match and a short buffer are not refusals. */
export function isRefusedOverlap(c: ConflictResult | null | undefined): boolean {
  return !!c && c.kind === 'overlap' && c.matchedOn !== 'text';
}

interface OverlapWalk {
  proposed: readonly OverlapGame[];
  /** The tournament's games as they stand; a proposed game with an existing id replaces that game. */
  existing: readonly OverlapGame[];
  divisions: Division[];
  tournament: Tournament | null | undefined;
  /** Games the same write deletes (a generator's replaced games, a bracket editor's dropped games): they leave the pool. */
  removedIds?: Iterable<string>;
}

/**
 * THE walk (A37's one home): each proposed game in order, against the games as they stand plus the proposed games
 * before it — every placement resolved once. `firstOnly` stops at the first refusal (a writer needs one).
 */
function walkRefusals(params: OverlapWalk, firstOnly: boolean): { game: OverlapGame; conflict: ConflictResult }[] {
  const leaving = new Set([...(params.removedIds ?? []), ...params.proposed.map(p => p.id)]);
  const pool: PlacedGame[] = params.existing.filter(g => !leaving.has(g.id)).map(toPlacedGame);
  const out: { game: OverlapGame; conflict: ConflictResult }[] = [];
  for (const p of params.proposed) {
    if (p.status === 'cancelled') continue; // a cancelled game holds no diamond (and frees the one it had)
    const placed = toPlacedGame(p);
    const conflict = checkPlacedConflict(placed, pool, params.divisions, params.tournament);
    if (conflict && isRefusedOverlap(conflict)) {
      out.push({ game: p, conflict });
      if (firstOnly) break;
    }
    pool.push(placed);
  }
  return out;
}

/** The first refused overlap a set of proposed placements makes, or null — what a writer refuses. */
export function findRefusedOverlap(params: OverlapWalk): { game: OverlapGame; conflict: ConflictResult } | null {
  return walkRefusals(params, true)[0] ?? null;
}

/**
 * EVERY refused overlap a batch makes, by proposed game — the rain delay marks each row it would put on a taken
 * diamond (S5), where a writer needs only the first. The same walk as `findRefusedOverlap`.
 */
export function refusedOverlapsById(params: OverlapWalk): Map<string, ConflictResult> {
  return new Map(walkRefusals(params, false).map(r => [r.game.id, r.conflict]));
}

/** The other game, named the way the schedule names a game: "the U11 final", or "Storm vs Mustangs". */
export function overlapOtherName(other: OverlapGame, divisions: readonly Division[]): string {
  const division = divisions.find(d => d.id === other.divisionId)?.name ?? '';
  if (other.isPlayoff && other.bracketCode) return G.playoffGame(division, bracketGameLabel(other.bracketCode));
  return G.vs(teamOrSlotWords(other.awayName, other.awayPlaceholder), teamOrSlotWords(other.homeName, other.homePlaceholder));
}

/** The other game's time, start to end by the chain ("4:00–5:15 p.m."), and its end alone ("5:15 p.m."). */
export function overlapOtherTimes(other: ConflictGame, divisions: readonly Division[], tournament: Tournament | null | undefined): { range: string; end: string } {
  const start = (other.startTime ?? '').slice(0, 5);
  const minutes = resolveGameTiming(divisions.find(d => d.id === other.divisionId), tournament, other.durationMinutes).durationMinutes;
  const startMin = timeToMinutes(start);
  const end = Number.isFinite(startMin) ? minutesToTime(startMin + minutes) : '';
  return { range: formatTimeRange(start, end), end: formatTime(end) };
}

/**
 * The red line under the field, and the server's refusal: "Diamond 2 already has the U11 final, 4:00–5:15 p.m. Two
 * games in this tournament can't share a diamond: change the time or the diamond." `field` is the surface's own words.
 */
export function overlapRefusalWords(
  conflict: ConflictResult,
  ctx: { field: string; noun: string; divisions: readonly Division[]; tournament: Tournament | null | undefined },
): { lead: string; rest: string } {
  const other = conflict.conflictingGame as OverlapGame;
  return G.refusal(ctx.field, overlapOtherName(other, ctx.divisions), overlapOtherTimes(other, ctx.divisions, ctx.tournament).range, ctx.noun.toLowerCase());
}
