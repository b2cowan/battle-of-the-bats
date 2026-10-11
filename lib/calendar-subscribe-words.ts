/**
 * lib/calendar-subscribe-words.ts — EVERY WORD THE SUBSCRIBE DOORS SAY (Club Tier Stage 6d, B5 — the hub's Words-tagged
 * sentences, specimens 1–3). One home, so the coach's window, the phone's Calendar drawer and the public team page's
 * sheet can't say one thing two ways, and so `/marketing` signs off one file. Client-safe, pure.
 *
 * ⚠ The feed's own word ("Cancelled · " leading a cancelled entry's title) lives with the feed recipe
 * (`lib/export/team-feed-words.ts`, CANCELLED_LEAD).
 *
 * ⚠ HONEST ABOUT TIME. The calendar app decides when to check; Google can take up to a day. Never "instantly", never
 * "live", never "real time" — a feed is never how an urgent change reaches anyone (the owner's cost ruling).
 *
 * ✓ SIGNED OFF BY /marketing 2026-10-11 (6d build, B5): every word below as drafted, including the two the hub did not
 * draw — `readOn` (a plain fact beside "Read by your calendar today", the house day spelling, no nudge) and `copied`
 * (the button's own word, past tense, for two seconds). "Stays current" and "kept up to date" are the only freshness
 * claims, and every surface carrying one also carries the how-often sentence.
 */
import { formatShortWeekdayDate } from './timezone';

export const SUBSCRIBE_WORDS = {
  /** The desk Export dialog's row, under the hairline after the three files. */
  exportRow: 'Subscribe in your calendar app',
  /** The phone's calendar mark opens a menu headed with this small-capitals label. */
  drawerLabel: 'Calendar',
  drawerSubscribe: 'Subscribe on this phone',
  drawerSubscribeLine: 'Stays current',
  drawerDownload: 'Download a copy (.ics)',
  drawerDownloadLine: 'Today’s schedule only',

  /** The window's title at a desk, and the phone sheet's. */
  windowTitle: 'Subscribe in your calendar app',
  sheetTitle: 'Subscribe on this phone',
  lead: (team: string) => `${team}’s schedule in your own calendar, kept up to date.`,

  copy: 'Copy',
  copyLink: 'Copy the link',
  copied: 'Copied',
  linkLabel: 'Your calendar link',

  whatsInHead: 'What’s in it',
  /** A coach's: what their Schedule shows. `tryouts` only for a coach who runs them. */
  whatsInCoach: (tryouts: boolean) =>
    `This season’s games, practices, tournaments and team events${tryouts ? ', and the tryout days you run' : ''}, with arrival, uniform and notes. Cancelled events stay, marked.`,
  seasonLine: 'When the season closes, its events leave your calendar.',

  howOftenHead: 'How often',
  howOften: 'Your calendar app checks on its own schedule: usually within a few hours; Google Calendar can take up to a day.',

  yourLinkHead: 'Your link',
  yourLinkCoach: 'Yours alone; anyone with it can read this schedule. It stops if you leave the team.',

  yourCalendarHead: 'Your calendar',
  neverRead: 'Not read by a calendar yet.',
  readToday: 'Read by your calendar today.',
  /** Not drawn on the hub — a read before today. Drafted at build (a calendar app that last read days ago is the sign
   *  something stopped); `/marketing` to sign off. */
  readOn: (day: string) => `Last read by your calendar on ${formatShortWeekdayDate(day)}.`,
  newUnread: 'The new link hasn’t been read yet.',

  reset: 'Reset the link',
  resetTitle: 'Reset your calendar link?',
  resetBody: (team: string) =>
    `The calendar you added it to stops updating, and ${team}’s events leave it the next time it checks. Subscribe again with the new link.`,
  resetCancel: 'Cancel',
  resetDone: 'New link made',

  /** The public team page (specimen 3). */
  publicButton: 'Subscribe',
  publicTitle: 'Subscribe to this schedule',
  publicLead: 'Add it to your calendar once; it stays up to date.',
  publicLine: 'Your calendar app checks on its own schedule: usually within a few hours; Google Calendar can take up to a day. Cancelled events stay, marked.',

  loading: 'Getting your link…',
  close: 'Close',
} as const;

/** What the window's "Your calendar" line says, from the last read the server reports (the club's clock decides today). */
export function lastReadWords(lastReadOn: string | null, today: string, justReset = false): string {
  if (justReset) return SUBSCRIBE_WORDS.newUnread;
  if (!lastReadOn) return SUBSCRIBE_WORDS.neverRead;
  return lastReadOn >= today ? SUBSCRIBE_WORDS.readToday : SUBSCRIBE_WORDS.readOn(lastReadOn);
}
