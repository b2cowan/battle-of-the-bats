/**
 * THE FAMILIES AREA'S WORDS (Club Tier Stage 5a) — every new string the message window, the family file and today's
 * family page say, in one place, so /marketing reviews exactly these and a screen never hand-types a second spelling.
 * Drafted as the hub drew them (K4MPu4ni53Ct7yrDcmWJd9 v116 → Stage 5, P4 and P5), then /marketing (2026-10-17): the cap
 * says "in the last 24 hours" (it is a rolling day — "today" was untrue), the opted-out reason names its subject, the
 * export's menu line no longer says "Everything" (the file names what it does not hold). Pure: imported by the screens,
 * the routes and the PDF.
 */
import { formatStoredDate, orgDayKey, tournamentToday, utcToZonedInputs } from './timezone';
import { formatTime, pluralize, possessive } from './utils';

/** ⚠ Three messages for one family in any rolling 24 hours (Ask 9). The SAME number is `v_cap` in
 *  family_message_claim (mig 334) — tests/unit/families-stage5a-guard.test.ts holds the two equal. */
export const FAMILY_MESSAGE_CAP = 3;

/** Why a family is receiving a "Message this family" email — completes "Sent by {club} because …" in the envelope. */
export const FAMILY_MESSAGE_REASON = 'your family is registered with this organization';

/** "Oct 14, 2026" for a stored instant, in the club's time zone. */
const day = (iso: string) => formatStoredDate(iso);
/** "2:14 p.m." for a stored instant, in the club's time zone — through the one clock formatter. */
const clock = (iso: string) => formatTime(utcToZonedInputs(iso).time);

/** When the next message can go, said as the time it opens (a rolling day can open later today, not only tomorrow). */
function whenNext(nextAt: string | null): string {
  if (!nextAt) return 'later';
  const when = clock(nextAt);
  return orgDayKey(nextAt) === tournamentToday() ? `at ${when}` : `tomorrow at ${when}`;
}

export const FAMILY_MESSAGE_WORDS = {
  door: 'Message this family',
  title: 'Message this family',
  /** What sending does, in one statement (the send window's head). */
  statement: (orgName: string) => `Emails this family from ${orgName}, with an unsubscribe link. Replies come to you.`,
  to: 'To',
  lastMessaged: 'Last messaged',
  lastMessagedValue: (at: string, by: string | null) => (by ? `${day(at)} by ${by}` : day(at)),
  neverMessaged: 'Not messaged from here yet',
  /** A guardian the message will not reach, listed under To with why. */
  optedOutGuardian: 'Opted out of club email, so this won’t reach them',
  noAddress: 'No email on file',
  subject: 'Subject',
  message: 'Message',
  seeEmail: 'See the email',
  cancel: 'Cancel',
  discardAsk: 'Close without sending? What you typed won’t be kept.',
  keepWriting: 'Keep writing',
  discard: 'Discard',
  sending: 'Sending…',
  send: (n: number) => `Send to ${pluralize(n, 'guardian')}`,
  sent: (sent: number, of: number) => `Sent to ${sent} of ${pluralize(of, 'guardian')}.`,
  sentNoneDelivered: 'This didn’t reach anyone, so it doesn’t count toward the three a day. Please try again.',
  failed: 'The message couldn’t be sent. Please try again.',
  /** The press reached the server but no answer came back: it may have gone. Say so, rather than inviting a second. */
  unknown: 'We couldn’t tell whether this went out. Check “Last messaged” above before you send it again.',
  needSubject: 'Add a subject.',
  needMessage: 'Write a message.',
  tooLong: 'The subject can be up to 200 characters, and the message up to 5,000.',
  previewFailed: 'This family’s details didn’t load.',
  tryAgain: 'Try again',
  /** On the page, where the door was: the family cannot be reached at all. */
  optedOutReason: 'This family has opted out of club email, so they can’t be messaged from here.',
  /** On the page, where the door was: today's three are spent. */
  capReason: (nextAt: string | null) => `${FAMILY_MESSAGE_CAP} messages from here in the last 24 hours. The next can go ${whenNext(nextAt)}.`,
  /** In the window's foot, in Send's place (amber, the count first — the 10-12 ruling): a send that lost a race. */
  capRace: (nextAt: string | null) =>
    `${FAMILY_MESSAGE_CAP} messages to this family in the last 24 hours, so this one wasn’t sent. It can go ${whenNext(nextAt)}.`,
  /** The window's foot when the whole family has opted out since it opened. */
  optedOutRace: 'This family has opted out of club email, so this wasn’t sent.',
} as const;

/** The family file (P5): the export menu, the PDF's statement and its foot. */
export const FAMILY_FILE_WORDS = {
  menuHolds: 'The club’s records about this family',
  pdf: 'PDF',
  structured: 'Structured file',
  structuredHint: 'JSON',
  title: (name: string) => `Family file · ${name}`,
  exportedOn: (at: string) => `Exported ${day(at)}, ${clock(at)}`,
  exportedBy: (name: string | null) => (name ? `by ${name}` : ''),
  holdsHead: 'What this file holds',
  notHead: 'Not in this file.',
  notBody: 'Coaching records (evaluations, development notes, attendance, statistics, lineups) are kept by each team. '
    + 'Ask the team’s head coach, or the club, for those.',
  foot: (orgName: string, name: string, at: string) =>
    `Everything ${orgName} holds in its family records about ${name}, as of ${day(at)}.`,
  failed: 'The family file couldn’t be made. Please try again.',
  none: 'None on file',
} as const;

/** Today's family page (5a: data and words only — 5b redraws the screen). */
export const FAMILY_PAGE_WORDS = {
  children: (n: number) => pluralize(n, 'child', 'children'),
  dues: 'Dues',
  fundraising: 'Fundraising',
  otherCredits: 'Other credits',
  paid: 'Paid',
  handedBack: 'Handed back',
  balance: 'Balance',
  repBalance: 'Rep dues balance',
  noMoney: 'No dues or registration fees on record this season.',
  leaguePaid: (paid: boolean) => (paid ? 'Paid' : 'Not paid'),
  leagueFeeOf: (fee: string) => `fee ${fee}`,
  linkOnly: 'Invited to the family portal',
  payment: (amount: string, child: string) => `Payment ${amount} · ${child}`,
} as const;

/** The duplicate queue's second card (E02): an edited email emptied a person. */
export const FAMILY_DUPLICATE_WORDS = {
  emailChanged: (child: string, where: 'rep_roster_players' | 'rep_tryout_registrations' | 'league_registrations' | 'family_links', at: string) => {
    const row = where === 'rep_roster_players' ? 'roster row'
      : where === 'rep_tryout_registrations' ? 'tryout application'
      : where === 'league_registrations' ? 'registration' : 'family portal invitation';
    return `An email changed on ${possessive(child)} ${row}, ${day(at)}`;
  },
} as const;

/** The Members grant (Ask 12): Families is never given to a member limited to a group of teams. */
export const FAMILIES_GRANT_REFUSAL =
  'Families can’t be given to a member limited to some teams: a family’s record spans every team its children play on.';
