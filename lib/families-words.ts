/**
 * THE FAMILIES AREA'S WORDS (Club Tier Stage 5a) — every new string the message window, the family file and today's
 * family page say, in one place, so /marketing reviews exactly these and a screen never hand-types a second spelling.
 * Drafted as the hub drew them (K4MPu4ni53Ct7yrDcmWJd9 v116 → Stage 5, P4 and P5), then /marketing (2026-10-17): the cap
 * says "in the last 24 hours" (it is a rolling day — "today" was untrue), the opted-out reason names its subject, the
 * export's menu line no longer says "Everything" (the file names what it does not hold). Pure: imported by the screens,
 * the routes and the PDF.
 */
import { formatStoredDate, orgDayKey, tournamentToday, utcToZonedInputs } from './timezone';
import { formatTime, joinWithAnd, pluralize, possessive } from './utils';

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
  /** The window's ask in this window's own words (One Window Stage 2: Keep writing and Discard are the one window's). */
  discardAsk: 'Close without sending? What you typed won’t be kept.',
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
  /** Named by its job, not its format (owner 2026-10-18): the file for a request to move the data elsewhere. */
  structured: 'For a data transfer',
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

/** Duplicates (P3, Stage 5b): each proposal's reason in words, the reviewer's keeper, one sentence of consequences. */
export const FAMILY_DUPLICATE_WORDS = {
  emailChanged: (child: string, where: 'rep_roster_players' | 'rep_tryout_registrations' | 'league_registrations' | 'family_links', at: string) => {
    const row = where === 'rep_roster_players' ? 'roster row'
      : where === 'rep_tryout_registrations' ? 'tryout application'
      : where === 'league_registrations' ? 'registration' : 'family portal invitation';
    return `An email changed on ${possessive(child)} ${row}, ${day(at)}`;
  },
  lede: 'Records that may be one parent. Nothing merges until you choose.',
  /** The proposal's reason, in words (S5-07: "surname+phone" was a code). */
  reason: (kinds: readonly ('phone' | 'child' | 'email_changed')[], child: string | null, records: number) => {
    const many = records > 2 ? `${records} records with the same surname` : 'Same surname';
    const phone = kinds.includes('phone'); const kid = kinds.includes('child');
    if (phone && kid) return `${many}, phone number and child${child ? ` (${child})` : ''}`;
    if (phone) return `${many} and phone number`;
    return `${many} and the same child${child ? ` (${child})` : ''}`;
  },
  keep: 'Keep this record',
  email: 'Email',
  phone: 'Phone',
  children: 'Children',
  clubEmail: 'Club email',
  on: 'On',
  optedOut: 'Opted out',
  none: 'None',
  noneSince: (at: string) => `None since ${formatStoredDate(at, { withYear: false })}`,
  /** One sentence: what becomes former, that the children don't change, that an opt-out holds. */
  consequence: (keeper: string, formerAddresses: readonly string[], anyChildren: boolean) => {
    const former = formerAddresses.length === 1
      ? `${formerAddresses[0]} becomes a former address and stays searchable`
      : `${joinWithAnd(formerAddresses)} become former addresses and stay searchable`;
    const kids = anyChildren ? '; every child’s records stay as they are' : '';
    return `Merging keeps ${keeper}. ${former}${kids}; an opt-out on any of these records stays.`;
  },
  merge: (keeper: string) => `Merge into ${keeper}`,
  notSame: 'Not the same person',
  /** The confirm (Ask 8: no undo — the confirm, the sharper rule and the reviewer's keeper make a wrong merge rarer). */
  confirmTitle: (others: readonly string[], keeper: string) =>
    `Merge ${others.length === 1 ? others[0] : `${others.length} records`} into ${keeper}?`,
  confirmBody: 'The records become one parent. A merge can’t be undone.',
  confirmYes: 'Merge',
  cancel: 'Cancel',
  merging: 'Merging…',
  merged: (keeper: string) => `Merged into ${keeper}.`,
  keptApart: 'Kept apart. They won’t be proposed again.',
  emptyTitle: 'Nothing to review',
  emptyBody: 'Records appear here when they share a surname and a first name or its initial, and a phone number or the same '
    + 'child, or when a guardian’s email was changed on a child’s row. Records you mark not the same person don’t come back.',
  notProposed: 'These records aren’t proposed as one parent any more. The list has been refreshed.',
  partMerged: (done: number, of: number) => `${done} of ${of} records merged; the rest couldn’t be. They stay on this list.`,
  failed: 'That didn’t go through. Please try again.',
  loadFailed: 'We couldn’t load the duplicates.',
} as const;

/** The Families page (P1, Stage 5b): the tabs, the Show pill, the list, the no-family list. */
export const FAMILY_LIST_WORDS = {
  title: 'Families',
  tabDuplicates: 'Duplicates',
  lede: (families: number) => pluralize(families, 'family', 'families'),
  noFamilyCount: (children: number) => `${pluralize(children, 'child', 'children')} ${children === 1 ? 'has' : 'have'} no family on file`,
  show: 'Show',
  search: 'Search families',
  searchChildren: 'Search children',
  questions: {
    nofamily: 'No family on file',
    owes: 'Owes money',
    forms: 'Missing forms',
    consent: 'No consent on file',
    notback: 'Not back this season',
    all: 'All families',
  },
  colFamily: 'Family',
  colChildren: 'Children',
  colBalance: 'Balance',
  colChased: 'Chased',
  colChild: 'Child',
  colWhy: 'Why',
  open: (name: string) => `Open ${name}`,
  feeNotPaid: 'Fee not paid',
  feeNotPaidInline: 'fee not paid',
  never: 'Never',
  reminded: (at: string) => `Reminded ${formatStoredDate(at, { withYear: false })}`,
  notTracked: 'Not tracked',
  andMore: (n: number) => `and ${n} more`,
  whyNoEmail: 'No guardian named',
  whyUnattached: 'Guardian address unusable',
  /** One line above the list (Ask 4): who can add a rep child's guardian. */
  whoAdds: 'Only a team’s coaches can add a guardian to a rep roster.',
  askCoaches: 'Ask the coaches',
  emptyNoFamilyTitle: 'Every child names a family',
  emptyNoFamilyBody: 'A child appears here when their roster row or registration names no guardian, or an address that can’t be emailed.',
  emptyListTitle: 'Nobody in this list',
  emptyListBody: 'A family appears here when there is something to do about them.',
  emptySearchTitle: (list: string) => `No match in ${list}`,
  searchAll: 'Search all families',
  emptyBookTitle: 'No families yet',
  emptyBookBody: 'Families appear as rosters and registrations name guardians.',
  loadMore: (shown: number, of: number) => `Show more · ${shown} of ${of} shown`,
  loadFailed: 'We couldn’t load the families.',
} as const;

/** The family's record (P2, Stage 5b): a window over the list that reads, with Previous · Next. */
export const FAMILY_RECORD_WORDS = {
  eyebrowNoList: 'Families',
  guardianOf: (n: number) => `Guardian of ${pluralize(n, 'child', 'children')}`,
  messageShort: 'Message',
  dues: 'Dues',
  paid: 'Paid',
  balance: 'Balance',
  /** What the band's Dues covers: "2 children · 2026", "1 child · house league", or both — "2 rep · 1 house league". */
  duesCaption: (rep: number, league: number, years: readonly number[]) => {
    const yrs = years.length ? ` · ${years.join(', ')}` : '';
    if (rep && league) return `${rep} rep · ${league} house league${yrs}`;
    if (league) return `${pluralize(league, 'child', 'children')} · house league`;
    return `${pluralize(rep, 'child', 'children')}${yrs}`;
  },
  /** The band's Paid caption: the team books' payments, then the house-league fees marked paid. */
  paymentsCaption: (n: number, fees: number) =>
    fees ? (n ? `${pluralize(n, 'payment')} · ${pluralize(fees, 'fee')}` : pluralize(fees, 'fee')) : pluralize(n, 'payment'),
  nobodyOwes: 'Nothing owed',
  children: 'Children',
  colChild: 'Child',
  colWhere: 'Team or season',
  colDues: 'Dues',
  colPaid: 'Paid',
  colBalance: 'Balance',
  houseLeague: 'house league',
  noFee: 'No fee this season',
  noDues: 'No dues set for this child',
  notBack: (where: string) => `${where} · not back this season`,
  /** A ladder term under a child, only when not zero (the coach's dues ladder). */
  ladderLine: (label: string, amount: string) => `${label} ${amount}`,
  contact: 'Contact',
  email: 'Email',
  formerEmail: 'Former email',
  formerUntil: (email: string, at: string) => `${email} · until ${formatStoredDate(at)}`,
  phone: 'Phone',
  notOnFile: 'Not on file',
  clubEmail: 'Club email',
  on: 'On',
  optedOut: 'Opted out',
  /** The one place an opt-out under a former address keeps its line (Ask 6: a reader can't infer it). */
  optedOutVia: (email: string) => `Opted out under a former address, ${email}, and honoured for the current one`,
  otherGuardian: 'Other guardian',
  namedOnLabel: 'Named on',
  /** "Morgan’s and Riley’s roster rows, Milan’s registration" — where the details are typed, and so changed. */
  namedOn: (rows: readonly { childFirstName: string; source: 'rep_roster' | 'league' }[]) => {
    const list = joinWithAnd;
    const roster = [...new Set(rows.filter(r => r.source === 'rep_roster').map(r => possessive(r.childFirstName)))];
    const league = [...new Set(rows.filter(r => r.source === 'league').map(r => possessive(r.childFirstName)))];
    return [
      roster.length ? `${list(roster)} roster ${roster.length === 1 ? 'row' : 'rows'}` : '',
      league.length ? `${list(league)} ${league.length === 1 ? 'registration' : 'registrations'}` : '',
    ].filter(Boolean).join(', ');
  },
  forms: 'Forms and consent',
  colForm: 'Form',
  colState: 'State',
  onFile: 'On file',
  missing: 'Missing',
  consent: 'Consent',
  consentNone: 'None on file',
  consentLine: (basis: string, at: string) => `${basis === 'league_registration' ? 'House league waiver' : basis.replace(/_/g, ' ')} · ${formatStoredDate(at)}`,
  history: 'History',
  historyNone: 'Nothing recorded yet.',
  showAll: (n: number) => `Show all ${n}`,
  showFewer: 'Show fewer',
  notFound: 'This family isn’t in your club’s records any more.',
  loadFailed: 'We couldn’t load this family.',
  noun: 'family',
} as const;

/** Ask the coaches (P1, Stage 5b, Ask 4): the one club send window, to each team's head coach. */
export const FAMILY_COACH_ASK_WORDS = {
  eyebrow: 'Families',
  title: 'Ask the coaches',
  statement: 'Emails each team’s head coach the names of their players with no guardian email the club can use, and where to add one. Replies come to you.',
  colTeam: 'Team',
  colCoach: 'Head coach',
  colPlayers: 'Players named',
  nobody: 'Nobody to send to',
  noHeadCoach: 'No head coach',
  invitationOpen: 'Head coach invitation not yet accepted',
  onlyYou: 'You are the head coach',
  seeEmail: (team: string) => `See ${possessive(team)} email`,
  lastSent: 'Last sent',
  lastSentValue: (at: string, by: string | null) => (by ? `${day(at)} by ${by}` : day(at)),
  never: 'Never',
  cancel: 'Cancel',
  done: 'Done',
  send: (coaches: number) => `Send to ${pluralize(coaches, 'coach', 'coaches')}`,
  sending: 'Sending…',
  sent: (coaches: number) => `Sent to ${pluralize(coaches, 'coach', 'coaches')}.`,
  notDelivered: (n: number) => `${n} couldn’t be delivered.`,
  justSent: 'This was just sent. Check Last sent before sending it again.',
  nothing: 'Every child on a rep roster names a family now, so there’s nobody to ask.',
  nobodyReachable: 'None of these teams has a head coach to send to.',
  failed: 'The emails couldn’t be sent. Please try again in a few minutes.',
  loadFailed: 'We couldn’t load who this would reach.',
  /** The coach's email. */
  emailSubject: (team: string) => `${team}: guardian emails needed`,
  emailGreeting: (name: string | null) => (name ? `Hi ${name},` : 'Hi,'),
  emailLead: (org: string, team: string, n: number) =>
    `${org} needs a guardian’s email for ${pluralize(n, 'player')} on ${team}: there isn’t one on file, or the one on file can’t be used. Only the team’s coaches can add it: open your Roster, open the player, and add their guardian’s name and email.`,
  emailListTitle: 'Players who need a guardian email',
  emailLink: 'Open your Roster',
  emailOutro: (sender: string) => `Reply to this email to reach ${sender}.`,
  /** The coach's "Your club" bell. */
  bellTitle: 'Your club needs guardian emails',
  bellBody: (team: string, n: number) => `${pluralize(n, 'player')} on ${team} ${n === 1 ? 'needs' : 'need'} a guardian’s email. Add ${n === 1 ? 'it' : 'them'} on your Roster.`,
} as const;

/** The Members grant (Ask 12): Families is never given to a member limited to a group of teams. */
export const FAMILIES_GRANT_REFUSAL =
  'Families can’t be given to a member limited to some teams: a family’s record spans every team its children play on.';

/** The Members screen's "what they can open" row for a member limited to some teams (Ask 12, drawn in 5b): why
 *  Families is not theirs to be given, said where the row is. */
export const FAMILIES_LIMITED_ROW = 'Can’t be given to a member limited to some teams: a family’s record spans every team its children play on.';
