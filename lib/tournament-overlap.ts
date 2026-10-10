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
import { checkVenueConflict, resolveGameTiming, timeToMinutes, minutesToTime, toConflictGame, type ConflictGame, type ConflictResult } from './schedule-conflict.ts';
import { bracketGameLabel } from './playoff-bracket.ts';
import { formatTime, formatTimeRange } from './utils.ts';
import { GAME_WINDOW_WORDS as G, slotWords } from './schedule-words.ts';

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

/** Refused: an overlap on a known surface. A typed-name match and a short buffer are not refusals. */
export function isRefusedOverlap(c: ConflictResult | null | undefined): boolean {
  return !!c && c.kind === 'overlap' && c.matchedOn !== 'text';
}

/**
 * The first refused overlap a set of proposed placements makes, or null. `existing` is the tournament's games as they
 * stand; a proposed game with an existing id replaces that game, and `removedIds` leave the pool (a generator's
 * replaced games, a bracket editor's dropped games).
 */
export function findRefusedOverlap(params: {
  proposed: readonly OverlapGame[];
  existing: readonly OverlapGame[];
  divisions: Division[];
  tournament: Tournament | null | undefined;
  removedIds?: Iterable<string>;
}): { game: OverlapGame; conflict: ConflictResult } | null {
  const leaving = new Set([...(params.removedIds ?? []), ...params.proposed.map(p => p.id)]);
  const pool: OverlapGame[] = params.existing.filter(g => !leaving.has(g.id));
  for (const p of params.proposed) {
    if (p.status === 'cancelled') continue; // a cancelled game holds no diamond (and frees the one it had)
    const conflict = checkVenueConflict({ proposedGame: p, allGames: pool, divisions: params.divisions, tournament: params.tournament });
    if (conflict && isRefusedOverlap(conflict)) return { game: p, conflict };
    pool.push(p);
  }
  return null;
}

const teamWords = (name: string | null | undefined, placeholder: string | null | undefined) =>
  name?.trim() || slotWords(placeholder) || 'TBD';

/** The other game, named the way the schedule names a game: "the U11 final", or "Storm vs Mustangs". */
export function overlapOtherName(other: OverlapGame, divisions: readonly Division[]): string {
  const division = divisions.find(d => d.id === other.divisionId)?.name ?? '';
  if (other.isPlayoff && other.bracketCode) return G.playoffGame(division, bracketGameLabel(other.bracketCode));
  return G.vs(teamWords(other.awayName, other.awayPlaceholder), teamWords(other.homeName, other.homePlaceholder));
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
