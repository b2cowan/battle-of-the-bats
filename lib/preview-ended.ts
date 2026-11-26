/**
 * "This preview has ended" (Club Website Track P, Session P4; owner ruling T12, 2026-11-25; drawing Tx3So1rUqL6shn7CzM93Zr,
 * tab 7; /legal's Track P review, recommendation 7).
 *
 * A removed preview's old link — the club's own address, any page under it, and its claim page — says the preview has
 * ended for 90 days after the removal, then falls to the ordinary "We can't find that page". It is read from the preview's
 * record (`organization_previews`, which outlives the club on purpose), never from the deleted club.
 *
 * ⚖ It NEVER shows the meeting, who made it, or the logo (/legal finding 4: a page reachable by guessing a slug must not
 * confirm our pipeline beyond the club's own name, which the visitor already had in the link). Pure: no database here.
 */
import { FIELDLOGICHQ_CONTACT_EMAIL } from './fieldlogichq-contact';
import { formatShortWeekdayDate, orgDayKey } from './timezone';

/** How long the old link says "ended" before it is an ordinary not-found (T12). */
export const ENDED_SHOWN_DAYS = 90;

const DAY_MS = 86_400_000;

/** Does a removal at `removedAt` still show the ended page at `now`? Exactly 90 days of it, from the removal instant. */
export function endedPageShows(removedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!removedAt) return false;
  const at = new Date(removedAt).getTime();
  if (Number.isNaN(at)) return false;
  const age = now.getTime() - at; // utc-intentional: an instant window
  return age >= 0 && age < ENDED_SHOWN_DAYS * DAY_MS;
}

/**
 * "Thu, Jan 7, 2027": the day, in the club's zone, that a preview's stored instant falls on (its removal, its one email's
 * send), spelled as the removal date is (`removalDateLabel`). null when there is no readable instant.
 */
export function previewDayLabel(iso: string | null | undefined): string | null {
  const day = orgDayKey(iso);
  return day ? `${formatShortWeekdayDate(day)}, ${day.slice(0, 4)}` : null;
}

/** The ended page's words, /legal rec. 7 and the drawing's tab 7, word for word. One set for the club's address and the claim page. */
export const ENDED_WORDS = {
  eyebrow: 'Preview ended',
  title: 'This preview has ended',
  body: (club: string, removedOn: string | null) => removedOn
    ? `FieldLogicHQ prepared a preview site for ${club}. It was removed on ${removedOn}, and its pages, images and sample information were deleted.`
    : `FieldLogicHQ prepared a preview site for ${club}. It was removed, and its pages, images and sample information were deleted.`,
  help: `If you’re with the club, write to ${FIELDLOGICHQ_CONTACT_EMAIL} and we can make a new one.`,
  home: 'Go to Home',
  /** The page title (browser tab and link preview): the club's name stays, as the visitor arrived by its link. */
  pageTitle: (club: string) => `This preview has ended · ${club}`,
} as const;

export type EndedPreview = { name: string; removedOn: string | null };
