/**
 * HOW THE ORGANIZER'S BRACKET READS (Tournament admin redesign Stage 3, S6 / A38, ruled 2026-10-09).
 *
 * The public bracket already says who played, the score, who won and the champion; the organizer's printed only the
 * slots' words ("Seed #4", "Winner SF2") even after a game was decided. This is the reading the admin's Bracket view
 * draws — at a desk as the diagram's cards, on a phone as round bands — and it decides NOTHING of its own:
 *   - who won a game is the champion rule's `isDecided` (lib/champions.ts): scored with a clear winner, both sides
 *     named — the rule the finished board and the public champions page crown by, applied to every game;
 *   - the champion is the finished board's (`championFinish`, lib/event-recap.ts), worded by its sentence
 *     (`FINISH_WORDS.caption`): one sentence in two places;
 *   - a slot reads in the admin's one slot wording (`slotWords`: "Seed 1", "Semifinal 1 winner").
 * A forfeit's recorded score is nominal (the finished board never shows it): the side wins, no numbers.
 *
 * Pure: no React, no reads.
 */
import type { Division, Game } from './types';
import { isDecided } from './champions.ts';
import { championFinish } from './event-recap.ts';
import { FINISH_WORDS } from './after-event-words.ts';
import { slotWords, teamOrSlotWords } from './schedule-words.ts';
import { NIL_TEAM_ID } from './schedule-change-classify.ts';

const isReal = (id?: string | null) => !!id && id !== NIL_TEAM_ID;

export interface BracketSide {
  /** The team once it is known; the slot's words while it is a slot ("Seed 2", "Semifinal 1 winner"). */
  name: string;
  /** Under a known team, the slot it came from — its seed, or the game it won ("Seed 1", "Semifinal 1 winner"). */
  slot: string | null;
  /** The side's score once played; null before, and for a forfeit (nominal). */
  score: number | null;
  won: boolean;
  known: boolean;
}

type TeamRef = { id: string; name: string };

function side(g: Game, which: 'home' | 'away', teams: readonly TeamRef[], winnerId: string | null): BracketSide {
  const id = which === 'home' ? g.homeTeamId : g.awayTeamId;
  const placeholder = which === 'home' ? g.homePlaceholder : g.awayPlaceholder;
  const team = isReal(id) ? teams.find(t => t.id === id) : undefined;
  const slot = slotWords(placeholder);
  const played = g.status === 'completed' || g.status === 'submitted';
  const score = which === 'home' ? g.homeScore : g.awayScore;
  return {
    name: teamOrSlotWords(team?.name, placeholder),
    slot: team && slot ? slot : null,
    score: played && score != null ? score : null,
    won: !!winnerId && winnerId === id,
    known: !!team,
  };
}

/** A game's two sides. A bracket lists the HOME side on top — the higher seed, as the public bracket draws it (the day's
 *  and Results' rows read away first; the bracket is its own reading). */
export function bracketSides(g: Game, teams: readonly TeamRef[]): { away: BracketSide; home: BracketSide } {
  const winnerId = isDecided(g) ? ((g.homeScore ?? 0) > (g.awayScore ?? 0) ? g.homeTeamId : g.awayTeamId) : null;
  return { away: side(g, 'away', teams, winnerId), home: side(g, 'home', teams, winnerId) };
}

/** A game with a result in (played, waiting on review, or forfeited) — a round band's "2 of 2 played". */
const isPlayedBracketGame = (g: Pick<Game, 'status'>) =>
  g.status === 'completed' || g.status === 'submitted' || g.status === 'forfeit';

export const playedCount = (games: readonly Pick<Game, 'status'>[]) => games.filter(isPlayedBracketGame).length;

export type BracketChampion =
  | { kind: 'decided'; team: string; caption: string }
  /** The final is still to play: "Decided by the final", and its two teams once both are known. */
  | { kind: 'waiting'; either: [string, string] | null };

/** The final a bracket ends in — a double elimination's grand final, else the championship final (never a 3rd-place
 *  game, never the if-necessary reset). Undefined when the bracket has none: then it shows no champion (Stage 4). */
function finalOf(groupGames: readonly Game[]): Game | undefined {
  const code = (g: Game) => (g.bracketCode ?? '').toUpperCase();
  const live = groupGames.filter(g => g.status !== 'cancelled');
  return live.find(g => code(g) === 'GF') ?? live.find(g => code(g) === 'FIN');
}

/**
 * The champion card at the bracket's end, for the division's TOP bracket only (a tiered division's champion is its
 * top tier's — the finished board's P1). Null for a lower tier and for a bracket with no final.
 */
export function bracketChampion(
  division: Pick<Division, 'id' | 'name'>,
  divisionGames: readonly Game[],
  groupGames: readonly Game[],
  teams: readonly TeamRef[],
  isTopGroup: boolean,
): BracketChampion | null {
  if (!isTopGroup) return null;
  const final = finalOf(groupGames);
  if (!final) return null;
  const teamName = (id?: string | null) => (isReal(id) ? teams.find(t => t.id === id)?.name ?? null : null);
  const finish = championFinish(division, divisionGames, teamName);
  if (finish) return { kind: 'decided', team: finish.teamName, caption: FINISH_WORDS.caption(finish) };
  const away = teamName(final.awayTeamId);
  const home = teamName(final.homeTeamId);
  return { kind: 'waiting', either: away && home ? [away, home] : null };
}
