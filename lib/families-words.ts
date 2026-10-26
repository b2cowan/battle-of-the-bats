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
import { HANDOFF_ACTIONS } from './notification-view';
import type { FamilyListKey } from './families-lists';

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
/** Whether a stored instant falls in the club's current year (a log says the year only when it is not this one). */
const inThisYear = (iso: string) => orgDayKey(iso).slice(0, 4) === tournamentToday().slice(0, 4);

/** A sentence ends once: a clock time already ends in its own period ("1:42 p.m."). */
const closed = (s: string) => (s.endsWith('.') ? s : `${s}.`);

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
  capReason: (nextAt: string | null) => closed(`${FAMILY_MESSAGE_CAP} messages from here in the last 24 hours. The next can go ${whenNext(nextAt)}`),
  /** In the window's foot, in Send's place (amber, the count first — the 10-12 ruling): a send that lost a race. */
  capRace: (nextAt: string | null) =>
    closed(`${FAMILY_MESSAGE_CAP} messages to this family in the last 24 hours, so this one wasn’t sent. It can go ${whenNext(nextAt)}`),
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
  notBody: 'Coaching records (evaluations, development notes, a coach’s pinned note about a player, attendance, statistics, lineups) are kept by each team. '
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

/** ⚠ Three Email families sends per CLUB in any rolling 24 hours (Stage 7c, Ask 7 A; owner 2026-10-22, Put to the owner
 *  2: Email families sends only — a one-household message never counts toward it). The SAME number is `v_cap` in
 *  family_email_claim (mig 347) — tests/unit/families-email.test.ts holds the two equal. */
export const CLUB_EMAIL_CAP = 3;

/** A row of the Emails tab still "sending" this long after it began stopped partway (the server died mid-send): it reads
 *  "Stopped at x of y" (owner 2026-10-22, Put to the owner 4 — no Resume; a resend is a new send). A send of a few
 *  hundred families takes seconds, so a quarter of an hour is never a send still going. */
export const CLUB_EMAIL_STOPPED_AFTER_MS = 15 * 60 * 1000;

/**
 * EMAIL FAMILIES and the EMAILS TAB (Club Tier Stage 7c — Asks 6, 7; drawings 4 and 5). Drafts as drawn, for /marketing's
 * pass on exactly these. ⚠ Never the word "Messages" (the chat pause's E2 owns it); the unit is "families" everywhere.
 */
/** The log's To for a send to everyone — the head coach copy's wording reads it too, so the two cannot drift. */
const AUDIENCE_EVERY = 'Every family';

export const FAMILY_EMAIL_WORDS = {
  door: 'Email families',
  /** On a Families list (Owes money …): the same window with that list chosen. */
  doorThese: 'Email these families',
  title: 'Email families',
  eyebrow: 'Families',
  statement: 'Sends one email to each family you choose, from the club, with your address to reply to. A family that opted out of club email is skipped.',
  who: 'Who',
  every: 'Every family',
  everySub: (rep: boolean, league: boolean) => (rep && league ? 'Rep teams and house league, each family once' : 'Each family once'),
  teams: 'Some rep teams',
  teamsSub: 'Pick the teams',
  season: 'A house league season',
  seasonLabel: 'Season',
  /** Families from one of the Families tab's lists (Owes money …): the same names as the Show pill. */
  list: 'Families from a list',
  listSub: 'The same lists as on Families',
  listLabel: 'List',
  count: (n: number) => pluralize(n, 'family', 'families'),
  copyCoaches: (n: number) => `Copy each team’s head coach · ${pluralize(n, 'coach', 'coaches')}, as colleagues`,
  subject: 'Subject',
  message: 'Message',
  nobodyLead: 'Nobody to send to:',
  noFamily: (n: number) => `${pluralize(n, 'child', 'children')} ${n === 1 ? 'has' : 'have'} no family on file.`,
  showThem: 'Show them',
  seeEmail: 'See the email',
  lastSent: 'Last sent',
  lastSentValue: (at: string, by: string | null, subject: string, families: number) =>
    `${formatStoredDate(at, { withYear: !inThisYear(at) })}${by ? ` by ${by}` : ''} · “${subject}” · ${pluralize(families, 'family', 'families')}`,
  neverSent: 'Not sent from here yet',
  /** The foot's sentence, left of the buttons: who it reaches, then who it won't. */
  reach: (n: number, optedOut: number) =>
    `${pluralize(n, 'family', 'families')} ${n === 1 ? 'gets' : 'get'} it.${optedOut > 0 ? ` ${optedOut} opted out and won’t.` : ''}`,
  youNotCounted: 'You are not counted.',
  cancel: 'Cancel',
  send: (n: number) => `Send to ${n}`,
  sending: 'Sending…',
  sent: (reached: number, of: number) => `Sent. Reached ${reached} of ${pluralize(of, 'family', 'families')}.`,
  coachesCopied: (n: number) => `${pluralize(n, 'head coach', 'head coaches')} copied.`,
  capReason: (nextAt: string | null) =>
    `${closed(`Your club has sent ${CLUB_EMAIL_CAP} emails to families in the last 24 hours. The next can go ${whenNext(nextAt)}`)} Each house league season has its own ${CLUB_EMAIL_CAP}: pick one under Who to email its families.`,
  justSent: 'This was just sent. Check Last sent before sending it again.',
  changed: (n: number) => `Who this reaches changed while you were writing: it now goes to ${pluralize(n, 'family', 'families')}. Check it and send again.`,
  nobodyOptedOut: 'Every family you picked opted out of club email, so nobody would get it.',
  nobodyAtAll: 'There are no families to send to yet.',
  pickTeams: 'Pick at least one team.',
  pickSeason: 'Pick a season.',
  needSubject: 'Add a subject.',
  needMessage: 'Write a message.',
  tooLong: 'The subject can be up to 200 characters, and the message up to 5,000.',
  failed: 'The email couldn’t be sent. Please try again.',
  sentNoneDelivered: `This didn’t reach any family, so it doesn’t count toward the club’s ${CLUB_EMAIL_CAP}. Please try again.`,
  unknown: 'We couldn’t tell whether this went out. Check the Emails tab before you send it again.',
  loadFailed: 'We couldn’t load who this would reach.',
  tryAgain: 'Try again',
  /** Who it went to, in words — the log's To. */
  audienceEvery: AUDIENCE_EVERY,
  audienceTeams: (names: readonly string[]) => names.join(' · '),
  audienceList: (list: FamilyListKey) => `Families · ${FAMILY_LIST_WORDS.questions[list]}`,
  /** The head coach's colleague copy (house mail, never the family envelope). */
  coachSubject: (subject: string) => `Copy: ${subject}`,
  coachGreeting: (name: string | null) => (name ? `Hi ${name},` : 'Hi,'),
  coachLead: (org: string, audience: string, families: number) =>
    `A copy of the email ${org} sent to ${audience === AUDIENCE_EVERY ? 'every family' : `the families on ${audience}`} (${families} reached). You’re getting it as a head coach. Families don’t see this note.`,
  coachOutro: (sender: string) => `Reply to this email to reach ${sender}.`,
} as const;

/** The Emails tab (drawing 5): every email the club sent from Families, newest first. Nothing here is editable. */
export const FAMILY_EMAILS_TAB_WORDS = {
  tab: 'Emails',
  lede: (n: number) => `${pluralize(n, 'email')} sent from Families`,
  colSent: 'Sent',
  colSubject: 'Subject',
  colTo: 'To',
  colBy: 'By',
  colReached: 'Reached',
  reached: (reached: number, of: number) => `${reached} of ${of}`,
  sending: 'Sending…',
  stopped: (reached: number, of: number) => `Stopped at ${reached} of ${of}`,
  /** The log row's status chip for a send that stopped partway (its figures follow, as for any send). */
  stoppedChip: 'Stopped',
  /** A one-household message (Stage 5a) keeps its date and sender, never its words or a count. */
  oneFamily: '1 family',
  oneFamilySubject: 'A message to this family',
  // This year's emails are "Oct 22 · 1:44 p.m." (drawing 5); an earlier year keeps its year.
  sentAt: (at: string) => `${formatStoredDate(at, { withYear: !inThisYear(at) })} · ${clock(at)}`,
  emptyTitle: 'No emails yet',
  emptyBody: 'Emails sent from Families are listed here: to every family, some teams, a season, a list or one family.',
  loadFailed: 'We couldn’t load the emails.',
  showMore: 'Show more',
  open: (subject: string) => `Open ${subject}`,
  /** The row's window: the email as sent and its counts — never a list of families (owner 2026-10-22). */
  factSent: 'Sent',
  factBy: 'By',
  factTo: 'To',
  factGoingTo: 'Going to',
  factReached: 'Reached',
  factOptedOut: 'Opted out',
  factFailed: 'Didn’t go',
  factCoaches: 'Head coaches copied',
  reachedNote: 'Reached counts the families whose email the mail service accepted. An email that bounces later isn’t shown here.',
  stoppedNote: 'This send stopped partway. The families it hadn’t reached yet didn’t get it; send it again to reach them.',
  oneFamilyNote: 'A message to one family keeps its date and who sent it, never its words.',
} as const;

/** Why a family is receiving a house-league season's email — completes "Sent by {club} because …" (9d1·11). */
export const seasonEmailReason = (season: string) => `your family is registered in ${season}`;

/** "the Kim family"; two or three named, "the Rossi and Nguyen families"; more (or a family with no name) are counted,
 *  never named. */
export function familiesNamed(names: readonly (string | null)[]): string | null {
  const known = names.map(n => n?.trim()).filter((n): n is string => !!n);
  if (known.length === 0 || known.length > 3 || known.length !== names.length) return null;
  return known.length === 1 ? `the ${known[0]} family` : `the ${joinWithAnd(known)} families`;
}

/** Whose allowance an email counts toward: a season's own three, or the club's (9d1·6, 9d1·12). `here`: said on the
 *  season's own door ("This season"). */
export type AllowanceOwner = { kind: 'club' } | { kind: 'season'; name: string; here: boolean };

/**
 * THE ALLOWANCE IN WORDS (9d1·8, 9d1·12; /marketing 2026-10-26, HOUSE_LEAGUE_STAGE9D1_COPY.md settlement 1). A rolling
 * 24 hours has no "today": the line counts what was SENT in the last 24 hours, the way the club's refusal always has.
 */
export const ALLOWANCE_WORDS = {
  /** The window's foot, after the reach sentence. */
  foot: (owner: AllowanceOwner, used: number) => {
    const who = owner.kind === 'club' ? 'The club' : owner.here ? 'This season' : owner.name;
    return used === 0
      ? `${who} can send ${CLUB_EMAIL_CAP} emails in any 24 hours.`
      : `${who} has sent ${used} of its ${CLUB_EMAIL_CAP} emails in the last 24 hours.`;
  },
  /** The season page's subtitle, after "{Season} · " (the phone drops the season name). */
  subtitle: (used: number, nextAt: string | null) =>
    used === 0 ? `up to ${CLUB_EMAIL_CAP} emails in any 24 hours`
      : used >= CLUB_EMAIL_CAP ? `${CLUB_EMAIL_CAP} of ${CLUB_EMAIL_CAP} emails sent in the last 24 hours; the next can go ${whenNext(nextAt)}`
        : `${used} of ${CLUB_EMAIL_CAP} emails sent in the last 24 hours`,
} as const;

/**
 * A HOUSE-LEAGUE SEASON EMAILS ITS FAMILIES (Club Tier Stage 9d-1 — owner 9d1·1–12, 2026-10-26; the words settled by
 * /marketing, HOUSE_LEAGUE_STAGE9D1_COPY.md). The club's window and engine; these are the words only a season says.
 * "emails", never "sends", on a screen.
 */
export const SEASON_EMAIL_WORDS = {
  everyone: 'Everyone in the season',
  everyoneSub: 'Families with an active child, each once',
  everyoneCount: (families: number, children: number) => `${pluralize(families, 'family', 'families')} · ${pluralize(children, 'child', 'children')}`,
  division: 'A division',
  teams: 'A team',
  teamsSub: 'Teams in a published division',
  status: 'By status',
  statusSub: 'Active, to review, waitlist or ended',
  pickSub: 'Pick one or more',
  statusNames: { active: 'Active', review: 'To review', waitlist: 'Waitlist', ended: 'Ended' } as const,
  chip: (name: string, n: number) => `${name} · ${n}`,
  teamHint: 'Families with an active child on the team.',
  copyCoaches: (teams: number, coaches: number) =>
    `${teams === 1 ? 'Copy the team’s coaches' : 'Copy each team’s coaches'} · ${pluralize(coaches, 'coach', 'coaches')}`,
  copyCoachesSub: 'They get a copy as colleagues and aren’t counted as families.',
  unpublished: (division: string) => `${possessive(division)} teams aren’t published yet, so they aren’t listed. Families hear their teams when you publish them on Teams & draft.`,
  noneUnpublished: 'No team is published yet. Families hear their teams when you publish them on Teams & draft.',
  goTeams: 'Go to Teams & draft',
  pickDivision: 'Pick a division.',
  pickTeam: 'Pick a team.',
  pickStatus: 'Pick a status.',
  pickFamilies: 'Tick at least one family on Registrations.',
  subjectPlaceholder: 'e.g. Picture day is Saturday',
  statement: (season: string) => `Sends one email to each family you choose in ${season}, from the club, with your address to reply to. A family that opted out of club email is skipped.`,
  statementPhone: 'One email to each family you choose in this season, from the club. Families who opted out are skipped.',
  /** The foot's reach: families, then children (a season counts both). */
  reach: (families: number, children: number) =>
    `${pluralize(families, 'family', 'families')} ${families === 1 ? 'gets' : 'get'} it (${pluralize(children, 'child', 'children')}).`,
  optedOut: (n: number, named: string | null) =>
    `${n} opted out of club email and won’t${named ? `: ${named}` : ''}.`,
  /** One family (9d1·5). */
  oneTitle: 'Message this family',
  oneFamily: (name: string | null) => (name ? `The ${name} family` : 'This family'),
  oneTo: (address: string) => `Sends to ${address}. A message to one family doesn’t count toward the season’s ${CLUB_EMAIL_CAP}.`,
  twoChildrenOneFamily: (children: number) =>
    `You ticked ${children} children of one family, so this is a message to that family. It doesn’t count toward the season’s ${CLUB_EMAIL_CAP}.`,
  oneCap: (name: string | null, nextAt: string | null) =>
    closed(`${name ? `The ${name} family` : 'This family'} has had ${FAMILY_MESSAGE_CAP} messages from the club in the last 24 hours. The next can go ${whenNext(nextAt)}`),
  /** Ticked families. */
  tickedTitle: (n: number) => `Email ${pluralize(n, 'family', 'families')}`,
  tickedLead: (n: number) => `The ${pluralize(n, 'family', 'families')} you ticked`,
  tickedMore: (n: number) => `and ${n} more`,
  /** The history's To for ticked families. */
  audienceTicked: (n: number) => `${n} ticked ${n === 1 ? 'family' : 'families'}`,
  /** Refusals (the window opens on them; Send is absent). */
  capReason: (season: string, nextAt: string | null) =>
    `${closed(`${season} has sent its ${CLUB_EMAIL_CAP} emails to families in the last 24 hours. The next can go ${whenNext(nextAt)}`)} Automatic notices and a message to one family still go.`,
  capReasonPhone: (nextAt: string | null) =>
    closed(`This season has sent its ${CLUB_EMAIL_CAP} emails in the last 24 hours. The next can go ${whenNext(nextAt)}`),
  counting: 'Counting who this reaches…',
  /** Results. */
  sent: (reached: number, of: number) => `Sent. Reached ${reached} of ${pluralize(of, 'family', 'families')}.`,
  missed: (n: number, named: string | null) =>
    named ? `${n} couldn’t be sent: ${named}. Check their addresses on Registrations.` : `${n} couldn’t be sent. Check their addresses on Registrations.`,
  openEmail: 'Open the email',
  sentNoneDelivered: `This didn’t reach any family, so it doesn’t count toward the season’s ${CLUB_EMAIL_CAP}. Please try again.`,
  unknown: 'We couldn’t tell whether this went out. Check Last sent before you send it again.',
  coachesCopied: (n: number) => `${pluralize(n, 'coach', 'coaches')} copied.`,
  oneSent: (name: string | null) => `Sent to ${name ? `the ${name} family` : 'the family'}. It doesn’t count toward the season’s ${CLUB_EMAIL_CAP}.`,
  oneFailed: (name: string | null, address: string, child: string) =>
    `This didn’t reach ${name ? `the ${name} family` : 'the family'}. Check ${address} on ${possessive(child)} registration, then try again. Your message is still here.`,
  oneOptedOut: (name: string | null) => `${name ? `The ${name} family` : 'This family'} opted out of club email, so nobody would get it.`,
  noAddress: (n: number) => `Nobody to send to: the ${pluralize(n, 'child', 'children')} picked ${n === 1 ? 'has' : 'have'} no family email on file.`,
  pageNote: (season: string, reached: number, of: number) =>
    `${season}: reached ${reached} of ${pluralize(of, 'family', 'families')}.${of > reached ? ` ${of - reached} didn’t get it.` : ''}`,
  /** A stopped email (9d1·10). */
  stoppedNote: (n: number) => `This email stopped partway. ${pluralize(n, 'family', 'families')} it hadn’t reached didn’t get it.`,
  resend: (n: number) => `Send to the ${n} it missed`,
  resendNote: (owner: 'season' | 'club') => `Sending to the families it missed doesn’t count toward the ${owner === 'season' ? 'season’s' : 'club’s'} ${CLUB_EMAIL_CAP}.`,
  resent: (n: number, reached: number, of: number) => `Sent to the ${n} it missed. Reached ${reached} of ${pluralize(of, 'family', 'families')}.`,
  notStopped: 'This email isn’t stopped, so there’s nothing to send again.',
  /** The coach's colleague copy (9d1·9). */
  coachLead: (org: string, audience: string, families: number) =>
    `A copy of the email ${org} sent to the families on ${audience} (${families} reached). You’re getting it as a coach. Families don’t see this note.`,
} as const;

/** The Members grant (Ask 12): Families is never given to a member limited to a group of teams. */
export const FAMILIES_GRANT_REFUSAL =
  'Families can’t be given to a member limited to some teams: a family’s record spans every team its children play on.';

/** The Members screen's "what they can open" row for a member limited to some teams (Ask 12, drawn in 5b): why
 *  Families is not theirs to be given, said where the row is. */
export const FAMILIES_LIMITED_ROW = 'Can’t be given to a member limited to some teams: a family’s record spans every team its children play on.';

/**
 * RECORD A PAYMENT (Club Tier Stage 5c, P2 — Asks 26–28; hub K4MPu4ni53Ct7yrDcmWJd9 v121). The club records only its own
 * money (a house-league fee, now) and HANDS a rep payment to the team's head coach, whose own Record money writes it. The
 * drawing's words, for /marketing's pass on exactly these. Who is told is said ONCE, in the foot's sentence (/design D2).
 */
export const FAMILY_PAYMENT_WORDS = {
  door: 'Record a payment',
  doorShort: 'Record payment',
  title: 'Record a payment',
  statement: 'A payment the club received, put where it belongs: a house-league fee in the club’s books now, rep dues with the team, whose head coach records them.',
  amount: 'Amount received',
  placed: 'Placed',
  leftToPlace: 'Left to place',
  placedCaption: (n: number) => pluralize(n, 'child', 'children'),
  linesLabel: 'Where the payment goes',
  /** A house-league line: "Summer 2026 · U11 · house league · Fee $150.00" (on a phone, "House league · Fee $150.00"). */
  leagueWhat: (where: string, fee: string, short: boolean) => (short ? `House league · Fee ${fee}` : `${where} · house league · Fee ${fee}`),
  /** A rep line: "Fixture Falcons U13 · 2026 · Balance $100.00" (on a phone, without the year). */
  repWhat: (team: string, year: number | null, balance: string, short: boolean) =>
    `${team}${year && !short ? ` · ${year}` : ''} · Balance ${balance}`,
  /** After a rep line's balance when part of it is already with the coach. */
  alreadySent: (amount: string) => `${amount} already sent to the coach`,
  wholeFee: 'Whole fee',
  wholeFeeLabel: (child: string) => `${possessive(child)} whole fee`,
  repAmountLabel: (child: string) => `Amount for ${child}`,
  leagueGoes: 'In the club’s books, now',
  /** "To Pat Moreau, the head coach, to record" (on a phone, "To Pat Moreau, to record"). */
  repGoes: (coaches: readonly string[], short: boolean) =>
    short ? `To ${joinWithAnd(coaches)}, to record`
      : `To ${joinWithAnd(coaches)}, the head ${coaches.length === 1 ? 'coach' : 'coaches'}, to record`,
  /** A line that cannot go: its reason in quiet ink, no input (Ask 28). */
  reasonClosed: (team: string) => `${possessive(team)} season is closed, so its book takes no payment here. Speak to the coach.`,
  reasonNoHead: (team: string) => `${team} has no head coach to send it to.`,
  reasonOnlyYou: (team: string) => `You are ${possessive(team)} head coach: record it on the team’s Player dues.`,
  reasonNoFeePermission: 'Only the owner, a club admin, a league admin or a league registrar marks a house-league fee paid.',
  /** More than a child owes: explained, not refused. */
  over: (extra: string, child: string) => `That is ${extra} more than ${child} owes. The team’s book turns it into a credit when the coach records it.`,
  date: 'Date received',
  dateFuture: 'A payment can’t be received after today.',
  how: 'How',
  note: 'Note',
  /** Under Note: where it goes, and that the family never sees it. */
  noteHint: (repChildren: readonly string[]) => repChildren.length
    ? `Goes to the coach with ${joinWithAnd(repChildren.map(possessive))} ${repChildren.length === 1 ? 'payment' : 'payments'}. The family never sees it, and nothing is sent to them.`
    : 'The family never sees it, and nothing is sent to them.',
  /** The foot's sentence, child by child: "Records Milan’s fee. Sends Riley’s $100.00 to Pat Moreau." */
  footFee: (child: string) => `Records ${possessive(child)} fee.`,
  footSend: (child: string, amount: string, coaches: readonly string[]) => `Sends ${possessive(child)} ${amount} to ${joinWithAnd(coaches)}.`,
  /** The standing reasons in the act's place. */
  leftReason: (left: string) => `Place the last ${left}, or change the amount received.`,
  overPlaced: (over: string) => `You placed ${over} more than was received. Change a line or the amount received.`,
  nothingYet: 'Type the amount received, then place it on a child.',
  actRecordAndSend: 'Record and send',
  actRecord: 'Record',
  actSend: (coaches: number) => (coaches === 1 ? 'Send to the coach' : 'Send to the coaches'),
  working: 'Recording…',
  cancel: 'Cancel',
  /** The record's notice afterwards: what was done, child by child. */
  done: (fees: readonly string[], sends: readonly { child: string; amount: string; coaches: readonly string[] }[]) => [
    ...fees.map(c => `Recorded ${possessive(c)} fee.`),
    ...sends.map(s => `Sent ${possessive(s.child)} ${s.amount} to ${joinWithAnd(s.coaches)}.`),
  ].join(' '),
  /** Refusals the server returns. */
  changed: 'Something changed since this window opened. Close it and open it again.',
  justSent: 'This was just sent. Check the record before sending it again.',
  partly: (done: string) => `${done} The rest wasn’t recorded or sent. Please try again.`,
  failed: 'The payment couldn’t be recorded. Please try again.',
  /** On the record. */
  chipSent: 'Sent to coach',
  chipNotReceived: 'Not received',
  /** History. */
  historySent: (amount: string, child: string, coaches: readonly string[], by: string | null) =>
    `Sent ${amount} for ${child} to ${coaches.length ? joinWithAnd(coaches) : 'the head coach'}${by ? ` · by ${by}` : ''}`,
  historyRecorded: (amount: string, child: string, by: string | null) => `${possessive(child)} ${amount} recorded by ${by ?? 'the coach'}`,
  historyNotReceived: (amount: string, child: string, by: string | null) => `${by ?? 'The coach'} said ${possessive(child)} ${amount} never reached the team`,
} as const;

/**
 * THE HEAD COACH'S SIDE OF A HAND-OFF (Ask 28): a "Your club" bell and an email with Record it and Not received; Record it
 * opens the coach's own Record money, filled in. The only coach-side change in 5c.
 */
export const FAMILY_HANDOFF_COACH_WORDS = {
  bellTitle: (amount: string, child: string) => `The club received ${amount} for ${child}`,
  bellBody: (method: string | null, receivedDay: string) => `${method ? `${method}, ${receivedDay}` : `Received ${receivedDay}`}. Record it in the team’s book when it reaches you.`,
  /** The email's two links say what the bell's two buttons say (lib/notification-view.ts, one spelling). */
  recordIt: HANDOFF_ACTIONS.recordIt,
  notReceived: HANDOFF_ACTIONS.notReceived,
  /** The note Record money opens with. */
  coachNote: (sender: string, note: string | null) => `Received by the club (${sender})${note ? `: ${note}` : ''}`,
  /** The quiet line under "A family paid their dues — Riley Reyes". */
  lockDetail: (owes: string | null, sentDay: string) => (owes ? `Owes ${owes} · sent by the club · ${sentDay}` : `Sent by the club · ${sentDay}`),
  /** The coach's email. */
  emailSubject: (team: string, child: string) => `${team}: the club received a payment for ${child}`,
  emailLead: (org: string, amount: string, child: string, method: string | null, receivedDay: string) =>
    `${org} received ${amount} for ${child}${method ? `: ${method.toLowerCase()}, ${receivedDay}` : ` on ${receivedDay}`}.`,
  emailNote: (note: string) => `Note from the club: “${note}”`,
  emailAsk: 'Record it in the team’s book when the money reaches you. If it never does, use Not received to tell the club.',
  emailOutro: (sender: string) => `Reply to this email to reach ${sender}.`,
  /** Not received, asked once (the bell's link and the email's). */
  askTitle: 'Not received?',
  askBody: (amount: string, child: string) => `Tell the club that ${possessive(child)} ${amount} never reached the team? Nothing is recorded, and the person who sent it on is told.`,
  askAct: 'Not received',
  askCancel: 'Cancel',
  /** When the link is opened after the payment was answered. */
  alreadyRecorded: 'This payment is already recorded.',
  alreadyNotReceived: 'The club was already told this payment never arrived.',
  gone: 'The club’s record of this payment is gone.',
  wrongSeason: 'This payment was for a season that is closed.',
  saidNotReceived: 'The club was told it never arrived.',
  failed: 'That couldn’t be saved. Please try again.',
  /** The club person who sent it hears a Not received (their bell). */
  adminTitle: (coach: string, child: string, amount: string) => `${coach} says ${possessive(child)} ${amount} never arrived`,
  adminBody: (team: string, method: string | null, receivedDay: string) =>
    `${possessive(team)} head coach says the payment you sent (${method ? `${method.toLowerCase()}, ` : ''}${receivedDay}) never reached the team. Nothing was recorded.`,
  /** A coach's save that names a hand-off which no longer waits. */
  refusedAnswered: 'The club’s payment was already answered: recorded, or marked not received.',
  refusedOther: 'That payment from the club isn’t for this player.',
} as const;

/**
 * A FAMILY'S NOTES (Club Tier Stage 5c, P3 — Ask 29): a signed, dated list after Children. The once-line and the hint are
 * /marketing's to polish.
 */
export const FAMILY_NOTE_WORDS = {
  heading: 'Notes',
  add: 'Add a note',
  once: 'Staff only. The family never sees them here; a family’s file includes them.',
  none: 'No notes yet.',
  addTitle: 'Add a note',
  field: 'Note',
  hint: 'Only people who can open Families see it. A family’s file includes it.',
  save: 'Save note',
  saving: 'Saving…',
  cancel: 'Cancel',
  eyebrow: (family: string) => `${family} · note`,
  signed: (author: string | null, at: string, editedAt: string | null) =>
    `${author ?? 'A former member'} · ${day(at)}${editedAt ? ` · edited ${day(editedAt)}` : ''}`,
  edit: 'Edit note',
  done: 'Done editing',
  delete: 'Delete note',
  deleteTitle: 'Delete this note?',
  deleteAsk: 'It can’t be brought back. The record keeps who deleted it and when, never the words.',
  deleting: 'Deleting…',
  deleteYes: 'Delete note',
  deleteNo: 'Keep it',
  tooLong: (max: number) => `A note can be up to ${max.toLocaleString('en-CA')} characters.`,
  empty: 'Type the note first.',
  deleted: 'Note deleted.',
  failed: 'The note couldn’t be saved. Please try again.',
  deleteFailed: 'The note couldn’t be deleted. Please try again.',
  notYours: 'Only the person who wrote a note can change it.',
  notAllowedDelete: 'Only the person who wrote a note, or the club’s owner, can delete it.',
  gone: 'This note was deleted.',
  openNote: (date: string) => `Open the note from ${date}`,
} as const;

/** A note's length limit — the coach's pinned note's; the SAME number is mig 338's CHECK on family_notes.body. */
export const FAMILY_NOTE_MAX = 1000;

/** Why a note's words cannot be saved, or null — the server and both note windows ask this one rule. */
export const noteProblem = (text: string): string | null =>
  !text.trim() ? FAMILY_NOTE_WORDS.empty : text.trim().length > FAMILY_NOTE_MAX ? FAMILY_NOTE_WORDS.tooLong(FAMILY_NOTE_MAX) : null;
