import { joinWithAnd as nameList, possessive, pluralize } from './utils';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * TEAM-CHANGE EMAILS AFTER PUBLISHING, IN THEIR OWN WORDS (House League; HOUSE_LEAGUE_TEAM_CHANGE_EMAILS_PLAN.md, TC·1 to
 * TC·8; the approved drawings, tabs 1 to 6). The Teams screen's banner, the Review window, the Don't email question, the
 * pills, the history lines and the email, as functions of their facts. Staff counts say "families"; the email says
 * "children" (house-league words canon). Client-safe. PROVISIONAL until a /marketing pass (the practice window's precedent).
 * The clock is built with formatTime() by the caller and arrives here as text.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const familiesN = (n: number) => pluralize(n, 'family', 'families');
const emailsN = (n: number) => pluralize(n, 'email', 'emails');
const childrenN = (n: number) => pluralize(n, 'child', 'children');

/** The banner under the published notice (drawing tab 1). */
export const TC_BANNER = {
  title: (families: number) =>
    `${families} ${families === 1 ? 'family hasn’t' : 'families haven’t'} been told about team changes.`,
  sub: (families: number, children: number) =>
    `Their status page${families === 1 ? '' : 's'} and the family app already show the new team${children === 1 ? '' : 's'}.`,
  review: 'Review and email',
  skip: 'Don’t email',
  /** Replaces publish.after once a division is published (tab 4). */
  quiet: 'Moving a player doesn’t email anyone. You choose when families are told. There is no unpublish.',
} as const;

/** The chip on a child's row (tab 1). */
export const TC_CHIP = { notTold: 'Not told', place: 'New', move: 'Moved' } as const;

/** What a screen reader hears for the division picker's amber count (the picker's default words say "to review"). */
export const TC_PICKER = {
  waiting: (families: number) => `${familiesN(families)} not told`,
  waitingElsewhere: 'Families not told in another division',
} as const;

/** The Review and email window (tab 2). */
export const TC_WINDOW = {
  title: (families: number) => `Email ${familiesN(families)} about team changes?`,
  sub: 'Each family gets one email with what changed for their children.',
  /** In footerStart, never footer (the foot-text guard). */
  footStart: (families: number) => `One email per family · ${emailsN(families)}`,
  allOff: 'Every family is switched off. Nothing will be sent.',
  send: (families: number) => `Send to ${familiesN(families)}`,
  cancel: 'Cancel',
  working: 'Sending…',
  skipOne: 'Don’t email this family',
  emailOne: 'Email this family',
  offNote: (teams: number) => `Not emailed. Their status page still shows the team${teams === 1 ? '' : 's'}.`,
  /** One child's line: "Ava Kidd" then a chip, then the team, or "Cardinals → Jays" when moved. */
  childMoved: (from: string, to: string) => `${from} → ${to}`,
  seeExample: 'See an example email',
  back: 'Back to the list',
  exampleTitle: 'Example email',
  quiet: (family: string, children: readonly string[], team: string) =>
    `Nothing to send to the ${family} family: ${nameList(children)} moved and came back to ${team}, the team they were last told.`,
  noEmail: (children: number) => `${childrenN(children)} ${children === 1 ? 'has' : 'have'} no email address on file.`,
  seeThem: 'See them',
  noEmailNote: 'They are marked as told when you send or choose not to email.',
  noEmailTitle: (children: number) => `${childrenN(children)} with no email address`,
  noEmailHint: 'Nobody can be written to for these children. Add an address on their registration, then they join the next list.',
  nobody: 'Nobody is waiting to be told.',
  loading: 'Loading the families…',
  loadFailed: 'The list didn’t load. Close this and try again.',
  close: 'Close',
  phoneTitle: (families: number) => `Email ${familiesN(families)}?`,
  phoneSub: 'Each family gets one email with what changed.',
  phoneFoot: (emails: number) => emailsN(emails),
  exampleTo: 'The parent of each child below',
  changed: 'The list changed. Review again.',
} as const;

/** The Don't email question (tab 3). The confirm button repeats the opener's verb. */
export const TC_SKIP = {
  title: (families: number) => `Don’t email ${familiesN(families)}?`,
  body: 'Their status pages and the family app already show the new teams. Nobody is emailed about these changes. This is saved in Email families. You can still email any family later from their registration with Send again.',
  confirm: 'Don’t email',
} as const;

/** The screen's own notice pill after sending or skipping (TC·8). */
export const TC_PILL = {
  emailed: (families: number, time: string) => `Emailed ${familiesN(families)} at ${time}`,
  skipped: (families: number) => `Not emailing ${familiesN(families)}. Saved in Email families.`,
  mixed: (sent: number, skipped: number, time: string) =>
    `Emailed ${familiesN(sent)} at ${time}. Not emailing ${familiesN(skipped)}.`,
} as const;

/** The season's Email families history line (always "by {name}" in the log's own column). */
export const TC_HISTORY = {
  subject: (division: string | null) => (division ? `Team changes: ${division}` : 'Team changes'),
  /** "2 emailed, 1 not emailed" / "3 families emailed" / "Not emailed (2 families)". */
  summary: (sent: number, skipped: number) => {
    if (skipped === 0) return `${familiesN(sent)} emailed`;
    if (sent === 0) return `Not emailed (${familiesN(skipped)})`;
    return `${sent} emailed, ${skipped} not emailed`;
  },
  body: (division: string | null, skipped: number) =>
    `${division ? possessive(division) : 'The'} families were asked about team changes after the teams were published.${skipped > 0 ? ` ${familiesN(skipped)} chose not to be emailed; their status pages still show the teams.` : ''} Their status pages always show their current teams.`,
} as const;

/** The email itself (tab 5). */
export const TC_MAIL = {
  subject: (firstNames: readonly string[], season: string) => `Team changes for ${nameList(firstNames)} · ${season}`,
  heading: 'Team changes',
  lead: (division: string) => `Here is what changed for your children in ${division}.`,
  childTitle: (child: string, team: string) => `${child}: ${team}`,
  newTeam: 'New team',
  movedFrom: (team: string) => `Moved from ${team}`,
  coach: (names: readonly string[]) =>
    names.length === 0 ? 'Coach to be announced' : `${names.length === 1 ? 'Coach' : 'Coaches'} ${nameList(names)}`,
  close: 'Their status page always shows their current teams.',
} as const;
