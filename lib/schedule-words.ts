/**
 * THE SCHEDULE'S SAVE WORDS — one home (Tournament admin redesign, Stage 3 defects pass A45, 2026-10-09).
 *
 * The defects pass changed what three things DO, and their old sentences became false:
 *   - the generator's save no longer "permanently clears" a division — it replaces only games still to play and
 *     keeps everything else (F70), in one step that either all happens or none of it does (P1);
 *   - a save the server refuses now says so instead of snapping the game back in silence (F71);
 *   - the Publish window's game-day reminder sentence shows only when the reminder will really be scheduled (F73).
 * The words are `/marketing`'s (2026-10-09); the placement is the pass's. Plain strings and small functions only —
 * no React — so the games route, the screens and a unit test read the same sentence.
 *
 * ⚠ A generator save tells NO ONE (it records no schedule change). Nothing here may say or imply teams are told.
 */

import { pluralize as count } from './utils.ts';

export interface DraftSaveCounts {
  division: string;
  /** The draft's new games. */
  added: number;
  /** The division's round-robin games still to play (scheduled, not kept) the save removes. */
  replaced: number;
  /** Every game the save leaves alone: results, cancelled, kept, and playoff games. */
  kept: number;
  /** Slot-based drafts save placeholders, not teams, and say so in their own words. */
  slotBased: boolean;
  /** The division's schedule is on the public page, so the new games show there as soon as they save. */
  published: boolean;
}

/** The generator's save question (the "Commit Schedule?" window). */
export function draftSaveQuestion(c: DraftSaveCounts): string {
  const sentences: string[] = [];
  if (c.added === 0 && c.replaced === 0) return 'There is nothing to save.';
  if (c.added === 0) {
    sentences.push(`This will remove ${count(c.replaced, 'game still to play', 'games still to play')} from ${c.division}. There are no new games to add.`);
  } else {
    const what = c.slotBased ? 'a slot-based schedule' : count(c.added, 'new game', 'new games');
    const replace = c.replaced > 0 ? ` and replace ${count(c.replaced, 'game still to play', 'games still to play')}` : '';
    sentences.push(`This will save ${what} for ${c.division}${replace}.`);
  }
  if (c.kept > 0) sentences.push(`${count(c.kept, 'game stays as it is', 'games stay as they are')}.`);
  if (c.published && c.added > 0) {
    sentences.push(`${c.division} is published, so the new games show on the public schedule right away. No one is notified.`);
  }
  return sentences.join(' ');
}

/** The label of the readout above the generator's form AND of the preview's summary band — one word for both. */
export const DRAFT_SAVE_LABEL = 'On save';

/** The one-line readout above the generator's form, shown when the division already has games. */
export function draftSaveReadout(kept: number, replaced: number): string {
  const keeps = `Keeps ${count(kept, 'game', 'games')}.`;
  return replaced > 0
    ? `${keeps} Replaces ${count(replaced, 'game still to play', 'games still to play')}.`
    : `${keeps} Nothing to replace.`;
}

/** The preview's summary band: after DRAFT_SAVE_LABEL, the three counts' words (kept · replaced · new). */
export const DRAFT_SAVE_BAND = { kept: 'kept', replaced: 'replaced', added: 'new' } as const;

/**
 * The schedule list's Keep / Release tooltips on a ROUND-ROBIN game (a draft never replaces a kept one). Playoff rows
 * keep their own words: the playoff window still has its "Build from current" mode.
 */
export const KEEP_WORDS = {
  keptBadge: 'Kept. A new draft will not replace this game.',
  keep: 'Keep this game. Saving a new draft will leave it where it is.',
  release: 'Release this game. The next draft can replace it if it is still to play.',
} as const;

/** The one-step save's replies (the games route; shown in the generator's error band, the draft still on screen). */
export const DRAFT_SAVE_FAILED = {
  /** A game the draft replaces was scored, kept or removed since the draft was made. Nothing was written. */
  scheduleChanged: 'A game in this draft has changed since it was made. Nothing was saved. Generate the draft again.',
  /** Anything else. The save is one transaction, so nothing was written. */
  other: 'Something went wrong. Nothing was saved and the schedule is as it was. Try again.',
} as const;

/** Titles of the schedule page's message window when the server refuses a write (F71). */
export const SCHEDULE_REFUSAL_TITLE = {
  saveGame: 'Could not save game',
  cancelGame: 'Could not cancel game',
  reinstateGame: 'Could not reinstate game',
  keepGame: 'Could not keep game',
  releaseGame: 'Could not release game',
  unpublish: 'Could not unpublish schedule',
  unpublishAll: 'Could not unpublish schedules',
} as const;

export const SCHEDULE_REFUSAL = {
  /** A game write refused with no usable reason, or a server error. */
  gameFallback: 'The game was not changed. Try again.',
  /** A division write (unpublish, close registration) refused with no usable reason, or a server error. */
  divisionFallback: 'Nothing was changed. Try again.',
  /** "Unpublish all" sends one request per division, so it can partly succeed — then "Nothing was changed" is
   *  false. The window lists the divisions still published above this. */
  partialFallback: 'Try again.',
  /** The server's bare permission refusal ("Forbidden"): this person's role cannot change the schedule. */
  noPermission: 'Your role cannot change the schedule. Ask an organizer who can.',
} as const;

/**
 * What a refused write says: the server's own reason when it has one, otherwise our words. A server error's text is
 * never shown (it can be a raw database message), and the bare tokens `Forbidden` / `Unauthorized` are not reasons.
 */
export function refusalReason(
  status: number,
  error: unknown,
  fallback: string = SCHEDULE_REFUSAL.gameFallback,
): string {
  const text = typeof error === 'string' ? error.trim() : '';
  if (status === 403 && (!text || text === 'Forbidden')) return SCHEDULE_REFUSAL.noPermission;
  if (status >= 500 || !text || text === 'Unauthorized' || text === 'Forbidden') return fallback;
  return text;
}

/** Read a refused reply's reason (the body may not be JSON). */
export async function readRefusal(res: Response, fallback?: string): Promise<string> {
  const body = await res.json().catch(() => ({})) as { error?: unknown };
  return refusalReason(res.status, body?.error, fallback);
}

/**
 * The Publish window's reminder sentence (F73) — shown ONLY when `willScheduleGameDayReminder` says the publish
 * will schedule it (lib/schedule-publish-rules.ts, the route's own conditions).
 */
export const GAME_DAY_REMINDER_SENTENCE =
  'Each accepted team with a contact email also gets a game-day reminder the evening before its first game. If that time has already passed when you publish, that team gets none.';
