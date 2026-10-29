/**
 * lib/public-game-row.ts — WHAT A GAME SAYS on the public tournament pages' shared parts (Public tournament pages
 * Stage 2; hub "The end state", plan §5). Pure, so tests/unit/public-game-row.test.ts pins the words; the parts
 * (components/public/PublicGameRow.tsx, PublicLiveCard.tsx) only draw them.
 *
 *   · the GAME ROW — Up next and Latest results now, the Schedule in Stage 3: a scheduled face ("5:00 p.m." over
 *     "Today", both teams, "U13 · Diamond 4") and a finished face ("Final" over "Oct 27", the winner first and bold,
 *     both scores);
 *   · the LIVE NOW CARD — one per game in play: both teams with the score, "No score yet" before anyone has entered one
 *     (Stage 0 · D2, never an invented 0–0), the division and field, and Directions.
 *
 * The caller resolves names and the context line (round or division · field) with the page's own helpers; these only
 * decide order, face and words. Teams read visitor first, then home — today's live rows' order.
 */
import { formatTime } from './utils';
import { formatShortWeekdayDate, formatStoredDate } from './timezone';
import { hasNoScoreYet, NO_SCORE_YET, type PublicGameState } from './game-status';
import { fanSlotLabel } from './playoff-bracket';
import type { Game } from './types';

type RowGame = Pick<Game, 'id' | 'date' | 'time' | 'status' | 'homeScore' | 'awayScore' | 'homeTeamId' | 'awayTeamId'>
  & Partial<Pick<Game, 'homePlaceholder' | 'awayPlaceholder'>>;

/** "Winner SF2" (bracket shorthand) reads as jargon in a matchup; "Winner of SF2" reads as English (A9). */
export function friendlyPlaceholder(placeholder: string | null | undefined): string {
  if (!placeholder) return 'TBD';
  return placeholder.replace(/^(Winner|Loser)\s+(?!of\b)/i, '$1 of ');
}

/** The new pages' words for a bracket slot (Stage 3, owner 2026-10-28): the bracket's own — "Semifinal 1 winner" — so the
 *  game leads and a cut-off name can't hide the number (the 2026-07-17 ruling, `fanSlotLabel`). The old Overview keeps
 *  `friendlyPlaceholder`'s "Winner of SF2" until Stage 8. */
export function fanPlaceholder(placeholder: string | null | undefined): string {
  if (!placeholder) return 'TBD';
  return fanSlotLabel(placeholder.replace(/^(Winner|Loser)\s+of\s+/i, '$1 '));
}

/** Both sides' names: the team's, else the bracket's placeholder said as English (`slot` picks the words). */
export function gameSideNames(
  game: RowGame,
  teamName: (id: string) => string,
  slot: (placeholder: string | null | undefined) => string = friendlyPlaceholder,
): { away: string; home: string } {
  return {
    away: game.awayTeamId ? teamName(game.awayTeamId) : slot(game.awayPlaceholder),
    home: game.homeTeamId ? teamName(game.homeTeamId) : slot(game.homePlaceholder),
  };
}

export interface GameRowSide {
  name: string;
  /** Finished face only. */
  score: number | null;
  /** Finished face only: the winner is bold, the loser soft; a tie is neither. */
  result: 'win' | 'lose' | null;
}

export interface GameRowView {
  id: string;
  face: 'scheduled' | 'final';
  /** "5:00 p.m." on a scheduled game, "Final" on a finished one. */
  head: string;
  /** Under it: "Today" or "Wed, Oct 28" (scheduled), "Oct 27" (finished). */
  when: string | null;
  sides: [GameRowSide, GameRowSide];
  /** "U13 · Diamond 4" — the scheduled face only (a result says who won, not where). */
  sub: string | null;
  /** A cancelled game keeps the scheduled face (its time, its teams) and says so; nothing else sets this. */
  cancelled: boolean;
  /** "Pool A" — a pool-play row in a division with several pools; the caller resolves it, null elsewhere. */
  poolTag: string | null;
}

/** What the Schedule needs and the Overview did not (Stage 3). All optional: with none the row reads as it did. */
export interface GameRowExtra {
  /** The game's one public state (`publicGameState`, lib/game-status.ts). Without it the row goes by `status` alone:
   *  completed and forfeit are final, a submitted score is not. */
  state?: PublicGameState;
  /** A playoff game's round ("Semifinal"): it replaces "Today" / the date under the time. */
  round?: string | null;
  poolTag?: string | null;
}

const isFinal = (g: Pick<Game, 'status'>) => g.status === 'completed' || g.status === 'forfeit';

/** A game as the row says it. `context` is the caller's "round or division · field"; `today` the club's YYYY-MM-DD. */
export function gameRowView(
  game: RowGame,
  names: { away: string; home: string },
  context: string,
  today: string,
  extra: GameRowExtra = {},
): GameRowView {
  const { state, round = null, poolTag = null } = extra;
  const finished = state ? state === 'final' || state === 'unofficial' : isFinal(game);
  if (finished && game.homeScore != null && game.awayScore != null) {
    const away: GameRowSide = { name: names.away, score: game.awayScore, result: null };
    const home: GameRowSide = { name: names.home, score: game.homeScore, result: null };
    if (away.score !== home.score) {
      const [w, l] = away.score! > home.score! ? [away, home] : [home, away];
      w.result = 'win';
      l.result = 'lose';
    }
    // The winner reads first (the drawing's Latest results); a tie keeps visitor, home.
    const sides: [GameRowSide, GameRowSide] = home.result === 'win' ? [home, away] : [away, home];
    return {
      id: game.id, face: 'final', head: state === 'unofficial' ? 'Unofficial' : 'Final',
      when: game.date ? formatStoredDate(game.date, { withYear: false }) : null, sides, sub: null, cancelled: false, poolTag,
    };
  }
  return {
    id: game.id,
    face: 'scheduled',
    head: game.time ? formatTime(game.time) : 'TBD',
    when: round || (!game.date ? null : game.date === today ? 'Today' : formatShortWeekdayDate(game.date)),
    sides: [{ name: names.away, score: null, result: null }, { name: names.home, score: null, result: null }],
    sub: context || null,
    cancelled: state === 'cancelled',
    poolTag,
  };
}

export interface LiveCardSide {
  name: string;
  score: number | null;
  /** Behind on the scoreboard: drawn soft. Level, or no score yet: neither side is. */
  trailing: boolean;
}

export interface LiveCardView {
  id: string;
  sides: [LiveCardSide, LiveCardSide];
  /** "No score yet" (Stage 0 · D2) when nobody has entered one; otherwise null and both scores show. */
  noScore: string | null;
  /** "Championship · Diamond 2" / "U13 · Diamond 4": the round or division, then the field. */
  context: string;
  /** The field's name alone, for Directions' spoken name ("Directions to Diamond 4"); null when none is set. */
  field: string | null;
  /** A maps link to the field's address, or null when the field has none. */
  directionsHref: string | null;
}

/** A game in play as the Live now card says it. Free of Overview assumptions: the Schedule's live game reuses it.
 *  `label` is the round (a playoff game) or the division; `field` the venue label (`resolveGameVenueLabel`). */
export function liveCardView(
  game: RowGame,
  names: { away: string; home: string },
  label: string,
  field: string | null,
  directionsHref: string | null,
): LiveCardView {
  const noScore = hasNoScoreYet(game);
  const a = noScore ? null : game.awayScore ?? 0;
  const h = noScore ? null : game.homeScore ?? 0;
  return {
    id: game.id,
    sides: [
      { name: names.away, score: a, trailing: a != null && h != null && a < h },
      { name: names.home, score: h, trailing: a != null && h != null && h < a },
    ],
    noScore: noScore ? NO_SCORE_YET : null,
    context: [label, field].filter(Boolean).join(' · '),
    field: field || null,
    directionsHref,
  };
}
