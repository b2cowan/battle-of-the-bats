import { pluralize } from './utils';
import { formatShortWeekdayDate } from './timezone';

/**
 * RAINOUT (House League 9e-2; rulings 9e·10 to 9e·14, plan HOUSE_LEAGUE_STAGE9_PLAN.md §0i; mig 427) — what is left of it
 * since Club Website Stage 2 (Session 2B retired the one-season Rainout window; Session 2C retired its pure plan, used
 * only by its own tests). The schedule's "Rainout" button now opens Close a place (K15). This file keeps:
 *   · the held Rainout's banner and Put all back — an old Rainout made with "Email the families now" unticked can still
 *     be waiting in Changes to send, and a closed place's failed send waits there too (K5: it retries, never goes back);
 *   · the words, types and helpers Close a place shares with it: the send's per-division answer, the short division name,
 *     the families' line and its limit.
 */

export type RainVerb = 'postponed' | 'cancelled';

/** One division's send, as the press and the held sheet's Send answer it (`sendRainout`). */
export interface RainSendDivision {
  divisionId: string;
  name: string;
  /** told = sent now; already = someone sent these first (nothing more went); failed = refused or broke, still held. */
  outcome: 'told' | 'already' | 'failed';
  /** Families the send emailed (told only; Changes to send's "Sent to N families"). */
  emails: number;
  /** Families it was sent to that it didn't reach (told only): the season's Email families history sends them again. */
  missed: number;
  /** The rainout's games in this division (the result's "its 3 postponements"). */
  games: number;
}

/** A held rainout Put all back would still restore: the banner at the top of Changes to send. */
export interface WaitingRainout {
  id: string; day: string; verb: RainVerb; games: number; divisionIds: string[];
  /** A closed place's record (Club Website Stage 2): its banner retries the send and offers no Put all back. */
  closure?: boolean;
}


const gamesWord = (n: number) => pluralize(n, 'game');

export const shortDivision = (name: string) => name.replace(/\s+division$/i, '').trim() || name;

export const RAIN_WORDS = {
  button: 'Rainout',
  errFinished: (season: string) => `${season} has finished, so games can’t be called off.`,
  /** The held Rainout (11.3): Put all back. */
  back: (n: number) => `Put all ${n} back`,
  /** The banner at the top of Changes to send, while Put all back still works. */
  banner: (day: string, n: number, verb: RainVerb) =>
    `Rainout on ${formatShortWeekdayDate(day)}: ${gamesWord(n)} ${verb}, waiting to be sent.`,
  backTitle: (n: number) => `Put all ${gamesWord(n)} back?`,
  backBody: 'They return to the schedule at their old times. Nobody was told, so nobody is told now.',
  backKeep: (verb: RainVerb) => `Keep them ${verb}`,
  backDone: (n: number) => `${gamesWord(n)} put back. Nothing was sent.`,
  backRefused: 'A game changed since, so nothing was put back. You can undo them one at a time in Changes to send.',
  backGone: 'These changes were already sent, so they can’t be put back.',
  /** A closed place's games (Club Website Stage 2, K5): the site already says it is closed, so they go out, never back. */
  backClosure: 'These games are from a closed place, so they can’t be put back. Send them, or give each a new date.',
  /** The banner's line for a closed place whose send failed. */
  bannerClosure: (day: string, n: number, verb: RainVerb) =>
    `A closed place on ${formatShortWeekdayDate(day)}: ${gamesWord(n)} ${verb}, waiting to be sent.`,
};

/** The line's limit (9e·14), the press's and the database's. */
export const RAIN_LINE_MAX = 120;

/** One line, as typed: runs of spaces and line breaks become one space; the ends are trimmed. Null when empty. */
export function rainLine(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const line = raw.replace(/\s+/g, ' ').trim();
  return line || null;
}
