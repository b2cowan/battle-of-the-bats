/**
 * COMMUNICATIONS' WORDS — one home (Tournament admin redesign Stage 2, 2026-09-30). The words are
 * `/marketing`'s (confirmed 2026-09-30); the placement is the owner's ruling (hub Stage 2 tab, C1 · C2).
 * Plain strings and small functions only — no React — so a route, a unit test and the help content
 * can read the same word.
 */

/** The plan a Communications lock names (the Facts doc's spelling). */
export const COMMS_LOCK_PLAN = 'Tournament Plus';

/** The Tournament plan's lock lines (padlock · words · the plan's chip; opening Plan & billing). */
export const COMMS_LOCK = {
  /** A site post can show under several divisions on Tournament Plus (F43). */
  showUnder: 'Show under chosen divisions',
  /** The email picker (A14). */
  chooseTeams: 'Choose teams by division, status or payment',
  /** Push to fans' phones (`fan_score_alerts`). */
  pushFans: 'Buzz fans who turned on alerts',
} as const;

/** An email's record, when the send did not keep its list (sent before mig 314). */
export const RECIPIENTS_NOT_KEPT = 'The list of who it reached wasn’t kept for this email.';

/** The list (C1). */
export const COMMS_WORDS = {
  lensAll: 'All',
  lensSite: 'On the site',
  lensEmail: 'Emailed',
  removedBand: 'Removed from the site',
  empty: 'Nothing sent yet. A message can go to the public site, to your teams by email, or both.',
  newMessage: 'New message',
  onSite: 'On the site',
  onSitePinned: 'On the site, pinned',
  emailedTo: (n: number | null) => (n != null ? `Emailed to ${n}` : 'Emailed'),
  failed: (n: number) => `${n} failed`,
  removedOn: (date: string) => `removed ${date}`,
  // The desk table.
  colDate: 'Date',
  colMessage: 'Message',
  colWhere: 'Where it went',
  colReached: 'Reached',
  whereSite: (pinned: boolean) => (pinned ? 'Site (pinned)' : 'Site'),
  whereEmail: 'Email',
  reached: (delivered: number, total: number) => `${delivered} of ${total}`,
} as const;

/** The composer (C2). */
export const COMPOSER_WORDS = {
  startFrom: 'Start from',
  blank: 'A blank message',
  title: 'Title',
  message: 'Message',
  whereItGoes: 'Where it goes',
  postSite: 'Post to the public site',
  postSiteHint: 'On the tournament’s News page',
  pin: 'Pin it at the top',
  pinHint: 'While the event is live, it also shows at the top of the public schedule.',
  showUnder: 'Show under',
  allDivisions: 'All divisions',
  emailTeams: 'Email the teams',
  emailTeamsHint: 'To each team’s coach',
  emailAcceptedHint: 'To each accepted team’s coach',
  teams: 'Teams',
  division: 'Division',
  payment: 'Payment',
  push: 'Push to fans’ phones',
  pushHint: 'Fans who turned on alerts for this event',
  /** Push ticks the site post on — today's reason, kept (/review 2026-09-30). */
  pushPostsToo: 'Also posts to the site, so the notification opens the full message.',
  noMatch: 'No teams match these choices.',
  cancel: 'Cancel',
  sending: 'Sending…',
  saveChanges: 'Save changes',
  noOneToEmail: 'No one to email',
} as const;

/** The email picker's choices (A14) — the send's own targeting, never a second rule. "All except
 *  rejected" reaches accepted, waitlisted and waiting teams and NEVER a rejected one (F42's edge). */
export const TEAM_CHOICES = [
  { value: 'accepted', label: 'Accepted', statuses: ['accepted'], phrase: 'every accepted team' },
  { value: 'waitlist', label: 'Waitlisted', statuses: ['waitlist'], phrase: 'every waitlisted team' },
  { value: 'pending', label: 'Waiting for a decision', statuses: ['pending'], phrase: 'every team waiting for a decision' },
  { value: 'active', label: 'All except rejected', statuses: ['accepted', 'waitlist', 'pending'], phrase: 'every team except rejected' },
] as const;
export const PAYMENT_CHOICES = [
  { value: 'any', label: 'Any', statuses: [] as string[], phrase: '' },
  { value: 'owes', label: 'Owes', statuses: ['pending'], phrase: ' that still owes' },
  { value: 'paid', label: 'Paid', statuses: ['paid'], phrase: ' paid in full' },
] as const;

/** The live count line under the picker: "18 teams · every accepted team, all divisions". */
export function recipientCountLine(n: number, teamPhrase: string, paymentPhrase: string, division: string | null, choosing = true): string {
  // "No teams match" answers a choice; the Tournament plan chooses nothing, so it says the count.
  if (n === 0 && choosing) return COMPOSER_WORDS.noMatch;
  return `${n} team${n === 1 ? '' : 's'} · ${teamPhrase}${paymentPhrase}${division === null ? '' : `, ${division}`}`;
}

/** The send button says what it will do, and the number it will reach. */
export function sendLabel(site: boolean, email: boolean, push: boolean, n: number | null): string {
  // The number, when the count is in; while it is still being read, the words without it.
  const count = n != null ? ` ${n}` : '';
  if (email && n === 0) return COMPOSER_WORDS.noOneToEmail;
  if (site && email && push) return `Post, email${count} and push`;
  if (site && email) return `Post and email${count}`;
  if (site && push) return 'Post and push';
  if (email) return n != null ? `Email ${n} team${n === 1 ? '' : 's'}` : 'Email the teams';
  return 'Post to the site';
}
