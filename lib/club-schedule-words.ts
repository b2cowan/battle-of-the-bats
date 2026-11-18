/**
 * club-schedule-words.ts — every sentence the club scheduler says, in one place (Club Tier Stage 11a; hub
 * K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stages 10 + 11, specimens 4–15). The drafts' measures, the refusals, a coach's club
 * practice, the coaches' emails, the notices and the send log all speak through here, so one
 * schedule reads the same words wherever it is seen. Client-safe, pure.
 *
 * ⚠ "FROM THE CLUB" ALREADY MEANS MONEY (P11-03, Ask 16): the coach's Money › Club tab says it of money the club pays. A
 * practice says "From {schedule} · the club's schedule"; a review says "The club's proposal" — never "From the club".
 *
 * Copy status: DRAFTS, written to the drawings. `/marketing` words them in part B, before the walks (the build prompt's
 * A5 "Words"); every `[marketing]` tag below is open until then.
 */
import { formatTime, formatTimeRange, joinWithAnd, pluralize, possessive } from './utils';
import { daysBetweenDateStrings, formatShortWeekdayDate, formatStoredDate, formatWeekRange } from './timezone';
import { fmt } from './coach-money-summary';
import { PERMIT_WORDS, hoursWords, weekdayCount, weekdayOne, weekdayPlural, weekdaysWords } from './permit-words';
import { weekdayOf } from './permit-time';
import type { DraftMeasure, DraftStrategy, ShareWarning, SlotPattern } from './club-schedule-engine';
import type { ClosingRow, Installment, PriceMode } from './club-schedule-bill';
import type { SendKind } from './club-schedule-send';
import { HAND_BACK_WORDS, type CreditMove } from './club-hand-back-words';
import { FACT_LABELS, factRow, noticeFacts } from './notification-facts';

/** Cents said as money — the schedule's one spelling, on every screen and in every email. */
export const moneyCents = (cents: number) => fmt(cents / 100);

/** A sentence's first letter, capitalised. */
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** [marketing] The words a screen and a reply read. */
export const SCHEDULE_WORDS = {
  draft: 'Draft',
  inReview: 'In review',
  changedSinceSent: 'Changed since sent',
  final: 'Final',
  // Stage 11c Ask 5: the same each week ranks Best overall · Another mix · Youngest earliest; Moved around ranks three
  // mixes that all move. "Prime time rotated" retired in both.
  strategy: { best: 'Best overall', youngest: 'Youngest earliest', mix: 'Another mix', third: 'A third mix' } satisfies Record<DraftStrategy, string>,
  /** The coach's practice (Ask 16): the mirror's construction. */
  sourceLine: (schedule: string) => `From ${schedule} · the club’s schedule`,
  onlyTheClub: 'Only the club can move or remove this practice.',
  handBackDoor: 'Hand back this practice',
  handBackQuestion: 'Hand back which practices?',
  // Stage 11d part C (C3, Ask 10): every handed-back practice stays, and families see it as Cancelled — "stop seeing it"
  // was true only of the untouched ones the hand-back used to delete.
  handBackWhat: 'The club can give the time to another team. Your families see it as cancelled. Until the club gives it away, you can take it back.',
  handBackScopes: { one: 'This practice only', remaining: 'This & future', all: 'All practices' },
  saveStatement: (name: string) =>
    `Saving keeps ${name} as a draft. Nothing reaches a team until you send it. On its page you can read every week, export it, change these settings and adjust it by hand.`,
  finalStatement: (slots: number, teams: number) =>
    `Sending makes ${pluralize(slots, 'slot')} real bookings: on ${pluralize(teams, 'team')}’ schedules, on the club calendar and in the clash check. Families see their team’s slots on the team’s schedule. Nothing is emailed to a family.`,
  // [marketing] Owner 2026-11-13: the bill goes only to the coaches who can open Money.
  reviewStatement: (replyBy: string | null) =>
    `Each team’s coaches see their slots, and the ones who can open Money see the bill too.${replyBy ? ` Replies are due by ${formatShortWeekdayDate(replyBy)}.` : ''} Nothing is booked or billed yet. You finalize when you’re ready, whether or not every team has replied.`,
  /** A final schedule's first bill, made later: it bills and tells coaches, and books nothing. */
  lateBillStatement: (teams: number, total: string) =>
    `The bill goes to ${pluralize(teams, 'team')}, ${total} in all. Each team’s share lands on its Money › Club tab, with its payments, and its coaches who can open Money are emailed the bill; replies come to you. The schedule stays final and nothing on a team’s schedule changes.`,
  // [marketing] Stage 11b Part 5: house-league teams' practices, and their families, join the statement ("Only those teams'
  // coaches are told" was untrue once families of a house-league team hear too, 9d2·2).
  // [marketing] House League 9d-2b Part 5: a house-league division's games join it (9d2·13) — families hear about those
  // from the league admin's send, never from this one.
  changesStatement: (changedTeams: number, handedBack: string[], leagueTeams = 0, leagueDivisions = 0) => {
    const reach = [
      changedTeams || (!leagueTeams && !leagueDivisions) ? `${possessive(pluralize(changedTeams, 'team'))} schedules` : '',
      leagueTeams ? `${possessive(pluralize(leagueTeams, 'house-league team'))} practices` : '',
      leagueDivisions ? `${possessive(pluralize(leagueDivisions, 'house-league division'))} games` : '',
    ].filter(Boolean);
    const admins = leagueDivisions ? `the ${possessive(leagueDivisions === 1 ? 'division' : 'divisions')} league admins` : '';
    const told = leagueTeams
      ? `Their coaches are told, and so are the ${possessive(leagueTeams === 1 ? 'house-league team' : 'house-league teams')} families${admins ? ` and ${admins}` : ''}`
      : changedTeams || !leagueDivisions
        ? admins ? `Those ${possessive('teams')} coaches are told, and so are ${admins}` : 'Only those teams’ coaches are told'
        : 'Their league admins are told, and families hear from them';
    return `The changes reach ${joinWithAnd(reach)}. ${told}${handedBack.length ? `; ${joinWithAnd(handedBack)} handed ${handedBack.length === 1 ? 'its slot' : 'their slots'} back ${handedBack.length === 1 ? 'itself' : 'themselves'}` : ''}. Nothing else on the schedule moves.`;
  },
} as const;

/** [marketing] Why a send can't go, or a write was refused — one sentence each, the routes' `error`. */
/** A piece of house league's time, as every screen names it (Stage 11b copy, k2): "U12 games", "U12 practice time". */
export const houseLeagueUse = (division: string, kind: 'games' | 'practices') =>
  (kind === 'games' ? `${division} games` : `${division} practice time`);

export const SCHEDULE_REFUSALS = {
  plan: 'The club scheduler is part of League Plus and Club.',
  who: 'Only the club’s owner or an admin builds schedules.',
  nothingToSchedule: 'There are no rep teams with a season running to hand time to yet.',
  nothingToScheduleLeague: 'There are no rep teams or house-league seasons running to hand time to yet.',
  repTeamsClosed: 'This schedule gives time to rep teams, and your access doesn’t include Rep teams. An owner or an admin with Rep teams can change it.',
  slotBoth: 'A slot is held by rep teams or by house league, never both.',
  ruleNamesHouseLeague: 'A rule names house league. Its league admins divide its time, so take house league out of the rule.',
  notFound: 'That schedule isn’t here any more. Reload the page.',
  changed: 'This schedule changed since you opened it. Reload it to see the change, then try again.',
  alreadyFinal: 'This schedule is already final. Its changes go with Send the changes.',
  notFinal: 'This schedule hasn’t been finalized yet, so there are no changes to send.',
  justSent: 'This schedule was just sent. Give it a minute before sending again.',
  finalDelete: 'A final schedule has practices on teams’ schedules and a bill, so it can’t be deleted.',
  noTime: 'Give the schedule its time first: a venue, its facilities, the days and the hours.',
  /** Taking off the permit that is the schedule's only time, when nothing would stay (owner ruling 2026-11-17, walk §532 call C3).
   *  The screen already hides the door; this is for a direct call and the 400 body. */
  lastPermit: 'This permit is the only time on the schedule, so it can’t be taken off. Add other time first.',
  /** Add time: the form HAS time, but the schedule (or another part) already holds every place it cuts — the sentence says
   *  that, never "give it time first" (owner question 2026-11-17: "isn't this data right above it?"). */
  partTimeAllHeld: 'The schedule already uses all of this time. Choose other days, hours or dates.',
  /** Find the time reads the form's own rows; a form past the 40-row limit can't be read (it couldn't be saved either). */
  findTooManyRows: 'The schedule has more than 40 rows of hours, so the free time can’t be read. Combine some rows first.',
  tooManySlots: (max: number) => `That is more than ${max.toLocaleString('en-CA')} slots. Shorten the dates or lengthen the slots.`,
  overlappingBlocks: 'Two rows of hours overlap on one facility. Each facility’s hour is handed out once.',
  teamTwice: (team: string) => `${team} would be in two slots at once.`,
  slotFull: (n: number) => `A slot holds ${pluralize(n, 'team')} at once.`,
  seasonClosed: (team: string) => `${team} has no season running, so it can’t be booked or billed. Start its winter season first, or untick it.`,
  billMoney: 'Only the people who hold the club’s Accounting can add a bill to a schedule.',
  /** A change that takes time from a team credits it, which is money too: a sender without Money turns the switch off instead. */
  creditMoney: 'Only the people who hold the club’s Accounting can credit a team for time it lost. Ask one of them to send these changes, or turn off “Bill the corrections”: the changes go out, but the team isn’t credited for the time it lost.',
  billNoPrice: 'Type what the teams pay: no permit prices this time.',
  billNoTime: 'Hand out some time before billing it.',
  billYearClosed: 'The bill would count in a closed fiscal year. Pick an open year’s budget line, or later payment dates.',
  overLine: (left: number) => `The budget line has ${fmt(left)} left to allocate. Raise the line, bill a part of the cost, or bill from another line.`,
  noTeamsMatch: 'Nothing on that list can be sent any more. Reload the preview.',
  placeGone: 'A venue or facility in this schedule isn’t in the Venue library any more. Reload and pick it again.',
  teamGone: 'A team in this schedule isn’t the club’s any more. Reload the page.',
  scheduleValue: 'A figure in this schedule is out of range. Check its dates, times and settings.',
  permitGone: 'That permit isn’t in the Venue library any more.',
  lineGone: 'That budget line isn’t the club’s any more. Pick the bill’s line again.',
  notACostLine: 'That budget line is money coming in. Bill from a cost line.',
  notSaved: 'We couldn’t save that just now. Try again.',
  /** Marking a part free (owner 2026-11-17, walk §538 call C2): only a SENT part with no bill has a row to clear. */
  dismissNotHere: 'That part has a bill, or has not been sent yet, so there is nothing to mark free.',
  billFinal: 'The bill went out at Finalize, and a bill’s terms never change. A change to the time is billed at Send the changes.',
  /** A final schedule's first bill, made later ("Send the bill"): what stops it, in words. */
  billAgain: 'Fill in the bill again.',
  billNotFinal: 'This schedule isn’t final yet: its bill goes out with Finalize.',
  billAlready: 'This schedule has already been billed. A bill’s terms never change; a change to the time is billed at Send the changes.',
  billChangesWaiting: 'This schedule has changes waiting to be sent. Send the changes first, so the bill prices the time the teams were told of.',
  billAsksWaiting: 'A team’s ask to hand time back is waiting for an answer. Answer it first, so the bill is made with it settled.',
  replyWords: 'Say what you’d like changed.',
  notInReview: 'This schedule isn’t waiting for a reply.',
  handBackNothing: 'Those practices aren’t the club’s, or they were already handed back.',
  /** Stage 11d: a practice already in an ask waiting for the club. */
  handBackAsked: 'This practice is in an ask waiting for the club. Withdraw the ask first.',
} as const;

// ── The permit's pulled dates, said one way (13c Session C — the schedule page's row, its warning and Take … off) ──
/** "Sat, Dec 5 and Sat, Dec 12 are dates off". */
const datesOffClause = (days: readonly string[]) => `${joinWithAnd(days.map(formatShortWeekdayDate))} ${days.length === 1 ? 'is a date off' : 'are dates off'}`;
/** "Dec 5 and Dec 12". */
const shortDays = (days: readonly string[]) => joinWithAnd(days.map(d => formatStoredDate(d, { withYear: false })));
const thoseDays = (n: number) => (n === 1 ? 'that day' : 'those days');

// ── A draft's measures (specimen 5) ──────────────────────────────────────────────────────────────

/** [marketing] A draft card's lines, in the order the drawing reads them — ONE line per measure (the card pairs each line
 *  with its measure by place). `nameOf` names a team; `groupNameOf` a group (a whole group's sharing rule). */
export function measureLines(measures: readonly DraftMeasure[], nameOf: (teamId: string) => string, groupNameOf: (groupId: string) => string = () => 'A group'): string[] {
  const out: string[] = [];
  for (const m of measures) {
    if (m.kind === 'shares') {
      if (m.short.length) {
        out.push(m.short.length === 1
          ? `${nameOf(m.short[0].teamId)} is ${m.short[0].short} short of its share`
          : `${pluralize(m.short.length, 'team')} short: ${joinWithAnd(m.short.map(s => `${nameOf(s.teamId)} by ${s.short}`))}`);
      } else out.push(m.sameCount != null ? `Every team gets ${pluralize(m.sameCount, 'slot')}` : 'Every team gets its share');
    } else if (m.kind === 'sharing') {
      out.push(m.rules.map(r => `${sharingWho(r, nameOf, groupNameOf)} share a facility: ${facilityPart(r.atOnce)} each`).join('; '));
    } else if (m.kind === 'prime') {
      const range = m.min === m.max ? `${m.min}` : `${m.min}–${m.max}`;
      if (m.lowTeamId && m.max - m.min > 1) out.push(`Prime time ${range}: ${nameOf(m.lowTeamId)} gets ${m.min}`);
      else out.push(`Prime time ${range} each${m.rotated ? ', taken in turn' : ''}`);
    } else if (m.kind === 'nights') {
      out.push(m.same ? 'Each team on the same nights every week' : 'Nights change week to week');
    } else if (m.kind === 'early') {
      const range = m.min === m.max ? `${m.min}` : m.max - m.min === 1 ? `${m.min} or ${m.max}` : `${m.min} to ${m.max}`;
      out.push(m.even ? `Early and late taken in turn: ${range} early ${m.max === 1 ? 'start' : 'starts'} each`
        : `Early and late not taken evenly: ${m.lowTeamId ? nameOf(m.lowTeamId) : 'one team'} is furthest off`);
    } else if (m.kind === 'facilities') {
      out.push(m.turned ? 'Facilities taken in turn, within each team’s rules' : 'Some teams kept to one facility');
    } else if (m.kind === 'held') {
      out.push(heldLine(m.count, m.owners.length === 1 ? [{ name: m.owners[0], kind: m.what }] : m.owners));
    } else if (m.kind === 'youngest') {
      const names = m.teamIds.map(nameOf);
      const who = names.length > 2 ? `${names[0]} to ${names[names.length - 1]}` : joinWithAnd(names);
      out.push(`${who} never after ${formatTime(m.latestStart)}`);
    } else if (m.kind === 'open') {
      out.push(`${pluralize(m.count, 'slot')} left open`);
    }
  }
  return out;
}

// ── Sharing a facility, in words (Stage 11c — specimen 2) ─────────────────────────────────────────

/** "9U AA and 11U AA" · "The Junior teams" · "The Junior teams and 15U AA" — who a sharing rule names. */
export function sharingWho(rule: { teamIds: readonly string[]; groupIds: readonly string[] }, nameOf: (teamId: string) => string, groupNameOf: (groupId: string) => string): string {
  const parts = [...rule.groupIds.map(g => `the ${groupNameOf(g)} teams`), ...rule.teamIds.map(nameOf)];
  return capFirst(joinWithAnd(parts));
}

/** "half a facility" · "a third of a facility" · "a quarter of a facility" — what each team's part of a shared slot is. */
export const facilityPart = (atOnce: number) => (atOnce <= 2 ? 'half a facility' : atOnce === 3 ? 'a third of a facility' : 'a quarter of a facility');

/** [marketing] A sharing rule's sentence: "9U AA and 11U AA share a facility, 2 at once" — and, said in the closing row
 *  without its number, why slots are left open: "9U AA and 11U AA share a facility". */
export const sharingSentence = (who: string, atOnce: number | null) => `${who} share a facility${atOnce ? `, ${atOnce} at once` : ''}`;

/** "Leaves out the 2 slots 13U AAA's tryout day holds" — what the books already hold. */
export function heldLine(count: number, owners: readonly { name: string; kind?: string | null }[] | readonly string[]): string {
  const list = (owners as readonly (string | { name: string; kind?: string | null })[]).map(o => (typeof o === 'string' ? { name: o, kind: null } : o));
  const slots = pluralize(count, 'slot');
  if (list.length !== 1) return `Leaves out the ${slots} bookings already hold`;
  const what = list[0].kind === 'tryout' ? 'tryout day' : list[0].kind === 'game' ? 'game' : list[0].kind === 'practice' ? 'practice' : 'booking';
  return `Leaves out the ${slots} ${possessive(list[0].name)} ${what} holds`;
}

/** [marketing] "A weekly cap of 3 holds Senior to about 41%" — a rule that stops a share being met. */
export function warningLine(w: ShareWarning, nameOfGroup: (groupId: string | null, teamIds: string[]) => string): string {
  return `A weekly cap of ${w.cap} holds ${nameOfGroup(w.groupId, w.teamIds)} to about ${w.percent}%`;
}

// ── A team's slots as a pattern (Ask 7: the email; the review card) ───────────────────────────────

/**
 * [marketing] "Sundays, 8:00–9:30 a.m. · Field 2, Oct 4 – Mar 28, not Dec 27" — one line per weekday, time and place. A
 * pattern on one date reads as that date ("Thu, Feb 18, 8:00–9:00 p.m. · Lane 2"). The "not" dates are the weekday's
 * dates inside the run that the pattern skips (a date off, a week moved); more than three are counted.
 */
export function patternLine(p: SlotPattern, place: string, allDays?: readonly string[]): string {
  const time = formatTimeRange(p.startClock, p.endClock);
  const days = [...p.days].sort();
  if (days.length === 1) return `${formatShortWeekdayDate(days[0])}, ${time} · ${place}`;
  const first = days[0], last = days[days.length - 1];
  const missing = (allDays ?? weeklyDays(first, last)).filter(d => d >= first && d <= last && !days.includes(d));
  const not = missing.length === 0 ? ''
    : missing.length <= 3 ? `, not ${joinWithAnd(missing.map(d => formatStoredDate(d, { withYear: false })))}`
    : `, not on ${missing.length} of those weeks`;
  return `${weekdayPlural(p.weekday)}, ${time} · ${place}, ${formatWeekRange(first, last, false)}${not}`;
}

/** Every date a week apart from `first` to `last` (the run a weekly pattern spans). */
export function weeklyDays(first: string, last: string): string[] {
  const out: string[] = [];
  const d = new Date(`${first}T12:00:00Z`);
  for (let i = 0; i < 80; i++) {
    const day = d.toISOString().slice(0, 10);
    if (day > last) break;
    out.push(day);
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}

/** A slot's place, as the email and the log say it: "Lane 1", or the venue when it has no facilities. */
export const placeWords = (venue: string, facility: string | null) => facility ?? venue;

// ── The bill, in words (specimen 14) ─────────────────────────────────────────────────────────────

/** [marketing] The closing row under Bill the teams — naming the open time when slots are left open (Stage 11c: sharing
 *  frees time the club has paid for — "$5,400.00 less than the permit’s $27,000.00: the 50 open slots."). */
export function closingRowLine(c: ClosingRow, openSlots = 0, permits = 1): string {
  // Several permits (Session C): the closing row compares with what they cost together — "the permits’".
  const whose = permits > 1 ? 'the permits’' : 'the permit’s';
  if (c.kind === 'matches') return `Matches ${whose} ${moneyCents(c.permitCents)}: nothing left for the club to cover.`;
  if (c.kind === 'club_covers') {
    // No verdict on who pays the rest: the open time may be handed out in another schedule and billed there.
    const open = openSlots > 0 ? `: the ${openSlots === 1 ? '1 open slot' : `${openSlots} open slots`}.` : '.';
    return `${moneyCents(c.differenceCents)} less than ${whose} ${moneyCents(c.permitCents)}${open}`;
  }
  if (c.kind === 'more_than_permit') return `${moneyCents(c.differenceCents)} more than ${whose} ${moneyCents(c.permitCents)}.`;
  return 'No permit cost to compare it with.';
}

/** [marketing] "$2,700.00 in 3 payments" — a team's bill in one phrase. */
export const billPhrase = (cents: number, payments: number) => `${moneyCents(cents)} in ${pluralize(payments, 'payment')}`;

/** [marketing] "Oct 1 · $972.00" — a payment, as the email and the review card list it. */
export const paymentLine = (i: Installment) => `${formatStoredDate(i.dueDate, { withYear: false })} · ${fmt(i.amount)}`;

// ── Who can't be reached (the reminders' words, for a schedule) ──────────────────────────────────

export const SCHEDULE_UNREACHABLE = {
  no_head_coach: 'has no head coach',
  invitation_unanswered: 'has a head coach invitation nobody has accepted yet',
  only_you: 'has nobody with schedule access but you',
  // [marketing] Owner 2026-11-13: an active head coach with no address used to read "has no head coach", which was false.
  head_coach_no_email: 'has a head coach with no email address on file',
} as const;
export type ScheduleUnreachableWhy = keyof typeof SCHEDULE_UNREACHABLE;

/** [marketing] A late bill goes only to the people who can open Money (owner 2026-11-13), so its `only_you` says so. */
const UNREACHABLE_BILL_ONLY_YOU = 'has nobody with Money access but you';

/** [marketing] Under a Finalize / Send the changes team that is emailed its slots but has nobody who can open Money:
 *  "15U AAA’s bill goes on its Money › Club tab; nobody with Money access is emailed about it." (owner 2026-11-13) */
export const billNotToldSentence = (team: string, creditOnly = false) =>
  `${possessive(team)} ${creditOnly ? 'credit' : 'bill'} goes on its Money › Club tab; nobody with Money access is emailed about it.`;

/** [marketing] specimen 9: "12U AA has a head coach invitation nobody has accepted yet. Its 36 slots go on its schedule; …" */
export function unreachableSentence(team: string, why: ScheduleUnreachableWhy, slots: number, kind: SendKind): string {
  const what = kind === 'review'
    ? `Its ${pluralize(slots, 'slot')} wait for Finalize; nobody is emailed about them.`
    : kind === 'final'
      ? `Its ${pluralize(slots, 'slot')} go on its schedule; nobody is emailed about them.`
      : kind === 'bill'
        ? 'Its bill goes on its Money › Club tab; nobody is emailed about it.'
        : 'Its changes go on its schedule; nobody is emailed about them.';
  const reason = why === 'only_you' && kind === 'bill' ? UNREACHABLE_BILL_ONLY_YOU : SCHEDULE_UNREACHABLE[why];
  return `${team} ${reason}. ${what} Name or chase its coach from its Coaches page.`;
}

// ── The emails (colleague mail, Ask 7) ───────────────────────────────────────────────────────────

export interface EmailWords {
  subject: string;
  greeting: string;
  paragraphs: string[];
  /** Bulleted lists, each with an optional heading line. */
  lists: { title: string | null; items: string[] }[];
  link: { label: string; path: string } | null;
  /** A second way on, after the first (Families' hand-off: Record it, then Not received — Club Tier Stage 5c). */
  alsoLink?: { label: string; path: string } | null;
  outro: string | null;
  /** A small last line (the house-league coach's "Times in Eastern time.", Stage 11b Part 5). */
  foot?: string | null;
}

const firstNames = (names: readonly (string | null)[]) => {
  const firsts = names.map(n => (n ?? '').trim().split(/\s+/)[0]).filter(Boolean);
  return firsts.length ? `Hi ${joinWithAnd(firsts)},` : 'Hi,';
};

/** [marketing] A team's bill as an email's list: its total and payments, then each payment. */
const billList = (bill: { cents: number; installments: Installment[] }): EmailWords['lists'][number] =>
  ({ title: `The bill: ${billPhrase(bill.cents, bill.installments.length)}, for the time your team got.`, items: bill.installments.map(paymentLine) });

/** [marketing] What a team's coaches receive when the schedule is sent for review or final (specimens 9 and 14). */
/** The review email's last sentence (with its leading space): the head coach's way to answer the club's proposal. */
export const reviewReplyLine = (replyBy: string | null) =>
  replyBy ? ` Reply by ${formatShortWeekdayDate(replyBy)}: Looks good, or Ask for a change.` : ' Reply Looks good, or Ask for a change.';

/**
 * The review email for someone who is NOT the team's head coach (owner 2026-11-14, Q-E): only the head coach answers the
 * club's proposal, and the card to answer on is theirs alone, so an Assistant or Helper reads the same email without the
 * reply sentence and without the "Review it" link to a card they can't see. Nothing else changes, and no new words.
 */
export function withoutReviewReply(w: EmailWords, replyBy: string | null): EmailWords {
  const line = reviewReplyLine(replyBy);
  return { ...w, link: null, outro: w.outro?.endsWith(line) ? w.outro.slice(0, -line.length) : w.outro };
}

export function teamEmail(p: {
  kind: 'review' | 'final';
  orgName: string;
  scheduleName: string;
  teamName: string;
  venueName: string;
  recipientNames: readonly (string | null)[];
  slotCount: number;
  firstDay: string;
  lastDay: string;
  patterns: string[];
  bill: { cents: number; installments: Installment[] } | null;
  replyBy: string | null;
  link: string;
}): EmailWords {
  const range = `from ${formatShortWeekdayDate(p.firstDay)} to ${formatShortWeekdayDate(p.lastDay)}, ${p.lastDay.slice(0, 4)}`;
  const lists: EmailWords['lists'] = [{ title: null, items: p.patterns }];
  if (p.bill) {
    lists.push(billList(p.bill));
  }
  if (p.kind === 'review') {
    return {
      subject: `${p.scheduleName}: ${possessive(p.teamName)} ${p.bill ? 'slots and bill' : 'slots'}, for review`,
      greeting: firstNames(p.recipientNames),
      paragraphs: [`${p.orgName} proposes ${pluralize(p.slotCount, 'slot')} for ${p.teamName} at ${p.venueName}, ${range}:`],
      lists,
      link: { label: `Review it on ${possessive(p.teamName)} Overview →`, path: p.link },
      outro: `Nothing is on your schedule${p.bill ? ' or your Club tab' : ''} until the club finalizes it.${reviewReplyLine(p.replyBy)}`,
    };
  }
  return {
    subject: `${p.scheduleName}: ${possessive(p.teamName)} slots`,
    greeting: firstNames(p.recipientNames),
    paragraphs: [
      `${p.orgName} has given ${p.teamName} ${pluralize(p.slotCount, 'slot')} at ${p.venueName}, ${range}:`,
    ],
    lists,
    link: { label: `Open ${possessive(p.teamName)} schedule →`, path: p.link },
    outro: `They’re on ${possessive(p.teamName)} schedule now. Your families see them there.${p.bill ? ' The bill is on your Money › Club tab.' : ''} If you won’t use a slot, hand it back from the practice on your schedule, and the club can give it to another team.`,
  };
}

/** [marketing] What a team's coaches receive when a finalized schedule's bill is sent later: the bill alone — their slots
 *  were told at Finalize. */
export function billEmail(p: {
  orgName: string; scheduleName: string; teamName: string; recipientNames: readonly (string | null)[];
  bill: { cents: number; installments: Installment[] }; link: string;
}): EmailWords {
  return {
    subject: `${p.scheduleName}: ${possessive(p.teamName)} bill`,
    greeting: firstNames(p.recipientNames),
    paragraphs: [`${p.orgName} has billed ${p.teamName} for the time it got on ${p.scheduleName}.`],
    lists: [billList(p.bill)],
    link: { label: `Open ${possessive(p.teamName)} Money › Club tab →`, path: p.link },
    outro: 'The bill is on your Money › Club tab, with each payment. Your slots stay as they were. Questions about the bill? Reply to this email; it goes to the person at the club who sent it.',
  };
}

/** One team's change, as the email, the preview and the log say it. */
export type TeamChange =
  | { kind: 'moved'; fromStartMs: number; fromPlace: string; toStartMs: number; toEndMs: number; toPlace: string }
  | { kind: 'gains'; startMs: number; endMs: number; place: string }
  | { kind: 'loses'; startMs: number; endMs: number; place: string }
  | { kind: 'handed_back'; startMs: number; endMs: number; place: string };

const at = (ms: number, clockOf: (ms: number) => { day: string; time: string }) => {
  const c = clockOf(ms);
  return `${formatShortWeekdayDate(c.day)}, ${formatTime(c.time)}`;
};

/** [marketing] "Mon, Jan 11, 7:00 p.m. · Lane 2 → Tue, Jan 12, 8:00 p.m. · Lane 2" — specimen 10's change lines. */
export function changeLine(c: TeamChange, clockOf: (ms: number) => { day: string; time: string }): string {
  if (c.kind === 'moved') return `${at(c.fromStartMs, clockOf)} · ${c.fromPlace} → ${at(c.toStartMs, clockOf)} · ${c.toPlace}`;
  if (c.kind === 'gains') return `Gains ${at(c.startMs, clockOf)} · ${c.place}`;
  if (c.kind === 'handed_back') return `Handed back ${at(c.startMs, clockOf)} · ${c.place}`;
  return `No longer ${at(c.startMs, clockOf)} · ${c.place}`;
}

/**
 * ⚖ A TEAM'S CHANGES ARE SAID AS GROUPS, NEVER ONE LINE PER DATE (owner 2026-11-17, artifact YLos6rKun1mA612uRsChsG,
 * asks 1–7 ruled as recommended): the Needs attention row, the Send the changes window and the coaches' email all read
 * these. A run collapses ONLY when every change in it is the same change — the same kind, start time and place, and for a
 * move the same new time, place and number of days moved (ask 1). Anything else stays a group of one, which is the
 * change's own line. Groups read soonest first (ask 3).
 */
export interface ChangeGroup {
  /** null: a line said elsewhere and carried as-is (house league's rows, a division's games). */
  kind: TeamChange['kind'] | null;
  /** How many changes it holds. */
  count: number;
  /** "Gains 17 practices" — or, for a group of one, the change's own line ("No longer Thu, Dec 3, 6:00 p.m. · Diamond A"). */
  head: string;
  /** "Tue and Thu · 7:00 p.m. · Diamond 1 · Dec 3 – Jan 28"; null for a group of one. */
  pattern: string | null;
  /** Every date, one row per month ({ month: 'Dec', days: '3 · 8 · 10' }); empty for a group of one. */
  months: { month: string; days: string }[];
  /** The first club day it touches (YYYY-MM-DD). */
  firstDay: string;
}

/** A run's head ("Gains 17 practices") and the one-line total's word for it ("17 gained") — /marketing settled 2026-11-17. */
const GROUP_WORDS: Record<TeamChange['kind'], { head: (n: number) => string; total: string }> = {
  gains: { head: n => `Gains ${pluralize(n, 'practice')}`, total: 'gained' },
  // /marketing 2026-11-17: "lost", not "taken off" — that already means a permit taken off, or money off what a team owes.
  loses: { head: n => `Loses ${pluralize(n, 'practice')}`, total: 'lost' },
  moved: { head: n => `Moves ${pluralize(n, 'practice')}`, total: 'moved' },
  handed_back: { head: n => `Handed back ${pluralize(n, 'practice')}`, total: 'handed back' },
};

/** A run's dates, one row per month, in order. */
function monthRows(days: readonly string[]): { month: string; days: string }[] {
  const rows: { key: string; month: string; days: number[] }[] = [];
  for (const d of days) {
    const key = d.slice(0, 7);
    const last = rows[rows.length - 1];
    if (last && last.key === key) last.days.push(Number(d.slice(8, 10)));
    else rows.push({ key, month: formatStoredDate(d, { withYear: false }).split(' ')[0], days: [Number(d.slice(8, 10))] });
  }
  return rows.map(r => ({ month: r.month, days: r.days.join(' · ') }));
}

/** The soonest day a run touches: a move to an earlier day touches its new day first. */
const soonest = (first: string, toDays: readonly string[]) => [first, ...toDays].sort()[0];

/** One team's changes as groups, soonest first. */
export function changeGroups(list: readonly TeamChange[], clockOf: (ms: number) => { day: string; time: string }): ChangeGroup[] {
  const runs = new Map<string, { kind: TeamChange['kind']; changes: TeamChange[]; days: string[]; toDays: string[] }>();
  for (const c of list) {
    const from = clockOf(c.kind === 'moved' ? c.fromStartMs : c.startMs);
    let key: string;
    let toDay = '';
    if (c.kind === 'moved') {
      const to = clockOf(c.toStartMs);
      toDay = to.day;
      key = JSON.stringify(['moved', from.time, c.fromPlace, to.time, c.toPlace, daysBetweenDateStrings(from.day, to.day)]);
    } else key = JSON.stringify([c.kind, from.time, c.place]);
    const run = runs.get(key) ?? runs.set(key, { kind: c.kind, changes: [], days: [], toDays: [] }).get(key)!;
    run.changes.push(c);
    run.days.push(from.day);
    if (toDay) run.toDays.push(toDay);
  }
  const groups: ChangeGroup[] = [];
  for (const run of runs.values()) {
    const order = run.days.map((d, i) => i).sort((a, b) => run.days[a].localeCompare(run.days[b]));
    const days = order.map(i => run.days[i]);
    const first = run.changes[order[0]];
    if (run.changes.length === 1) {
      groups.push({ kind: run.kind, count: 1, head: `${changeLine(first, clockOf)}`, pattern: null, months: [], firstDay: soonest(days[0], run.toDays) });
      continue;
    }
    const range = formatWeekRange(days[0], days[days.length - 1], false);
    const weekdays = weekdaysWords(days.map(weekdayOf));
    let pattern: string;
    if (first.kind === 'moved') {
      const fromClock = formatTime(clockOf(first.fromStartMs).time), toClock = formatTime(clockOf(first.toStartMs).time);
      const toWeekdays = weekdaysWords(run.toDays.map(weekdayOf));
      const sameDay = weekdays === toWeekdays, samePlace = first.fromPlace === first.toPlace;
      const was = `${weekdays}, ${fromClock}${samePlace || !first.fromPlace ? '' : ` · ${first.fromPlace}`}`;
      const now = `${sameDay ? '' : `${toWeekdays}, `}${toClock}${first.toPlace ? ` · ${first.toPlace}` : ''}`;
      // The dates a run lists are the ones it moves FROM (the shift is the same for every one); say so.
      pattern = `${was} → ${now} · was ${range}`;
    } else {
      pattern = [weekdays, formatTime(clockOf(first.startMs).time), first.place, range].filter(Boolean).join(' · ');
    }
    groups.push({ kind: run.kind, count: run.changes.length, head: GROUP_WORDS[run.kind].head(run.changes.length), pattern, months: monthRows(days), firstDay: soonest(days[0], run.toDays) });
  }
  return groups.sort((a, b) => a.firstDay.localeCompare(b.firstDay));
}

/** A part's groups name the added time they came from ("Time added Nov 17") once each, never after every date. */
export function labelGroup(g: ChangeGroup, label: string): ChangeGroup {
  return g.pattern ? { ...g, pattern: `${g.pattern} · ${label}` } : { ...g, head: `${g.head} · ${label}` };
}

/** One team's changes as the Needs attention row reads them. */
export interface ChangeTeam { teamId: string; teamName: string; groups: ChangeGroup[] }

/** Soonest first; a carried line (no date of its own) after the dated ones. */
const byFirstDay = (a: { firstDay: string }, b: { firstDay: string }) => {
  // Plain code-unit order: localeCompare sorts punctuation before digits, which put the undated line first.
  const x = a.firstDay || '9999', y = b.firstDay || '9999';
  return x < y ? -1 : x > y ? 1 : 0;
};

/** The schedule's own changes and each part's, one entry per team (a team two members change reads once), its groups and
 *  the teams soonest first (ask 3). */
export function mergeChangeTeams(list: readonly { teamId: string; teamName: string; groups: readonly ChangeGroup[] }[]): ChangeTeam[] {
  const by = new Map<string, ChangeTeam>();
  for (const t of list) {
    const team = by.get(t.teamId) ?? by.set(t.teamId, { teamId: t.teamId, teamName: t.teamName, groups: [] }).get(t.teamId)!;
    team.groups.push(...t.groups);
  }
  const teams = [...by.values()].filter(t => t.groups.length);
  for (const t of teams) t.groups.sort(byFirstDay);
  return teams.sort((a, b) => byFirstDay(a.groups[0], b.groups[0]));
}

/** Lines already said elsewhere (house league's rows, a division's games), carried as groups of one. */
export function linesAsGroups(lines: readonly string[]): ChangeGroup[] {
  return lines.map(head => ({ kind: null, count: 1, head, pattern: null, months: [], firstDay: '' }));
}

/** How many changes the groups hold — the headline's count ("36 changes since you sent it"). */
export const changeCount = (teams: readonly { groups: readonly ChangeGroup[] }[]) =>
  teams.reduce((n, t) => n + t.groups.reduce((m, g) => m + g.count, 0), 0);

/** The one-line total under the headline: "2 teams · 35 practices gained, 1 lost" (/marketing settled 2026-11-17). */
export function changesTotal(teams: readonly { groups: readonly ChangeGroup[] }[]): string {
  const by = new Map<TeamChange['kind'] | null, number>();
  for (const t of teams) for (const g of t.groups) by.set(g.kind, (by.get(g.kind) ?? 0) + g.count);
  const order: TeamChange['kind'][] = ['gains', 'moved', 'loses', 'handed_back'];
  const parts = order.filter(k => by.get(k)).map((k, i) => `${i === 0 ? pluralize(by.get(k)!, 'practice') : by.get(k)} ${GROUP_WORDS[k].total}`);
  const other = by.get(null);
  if (other) parts.push(parts.length ? `${other} other ${other === 1 ? 'change' : 'changes'}` : pluralize(other, 'change'));
  return `${pluralize(teams.length, 'team')} · ${parts.join(', ')}`;
}

/** A team's groups as the email's lists (ask 7): a run is a titled list of its dates, a month to an item (an email has no
 *  Show dates, and a coach may copy the dates into a calendar); groups of one gather in an untitled list, in order. */
export function changeGroupLists(groups: readonly ChangeGroup[]): { title: string | null; items: string[] }[] {
  const lists: { title: string | null; items: string[] }[] = [];
  for (const g of groups) {
    if (g.pattern) { lists.push({ title: `${g.head}: ${g.pattern}`, items: g.months.map(m => `${g.kind === 'moved' ? 'Was ' : ''}${m.month} ${m.days}`) }); continue; }
    const last = lists[lists.length - 1];
    if (last && last.title === null) last.items.push(g.head);
    else lists.push({ title: null, items: [g.head] });
  }
  return lists;
}

/** [marketing] What a team's coaches receive when the changes are sent (specimen 10), and the money it settles. */
export function changesEmail(p: {
  orgName: string; scheduleName: string; teamName: string; recipientNames: readonly (string | null)[];
  lines: string[];
  /** The lines as groups (owner 2026-11-17, ask 7): when given, the email lists these instead of a line per date. */
  groups?: readonly ChangeGroup[];
  billedCents: number | null;
  /** Stage 11d, Ask 8: time the club moved off the team — taken off what it owes, the rest owed back (never "ask for it"). */
  lost: { creditCents: number; payCents: number; moves: readonly CreditMove[] } | null;
  /** Phase 8 (Session 3): each added part's bill of its own, made by this send — listed after the changes, each saying why it
   *  is separate (the build prompt's /legal light check, owed at the Close: a second bill email for one schedule says why). */
  partBills?: readonly { name: string; cents: number; installments: Installment[] }[];
  link: string;
}): EmailWords {
  const money2: string[] = [];
  if (p.billedCents) money2.push(`The time ${p.teamName} gained is billed: a correction of ${moneyCents(p.billedCents)} is on your Money › Club tab.`);
  if (p.lost && (p.lost.creditCents || p.lost.payCents)) money2.push(HAND_BACK_WORDS.lostEmail({ teamName: p.teamName, ...p.lost }));
  const partBills = p.partBills ?? [];
  if (partBills.length) money2.push(PART_WORDS.emailBillsOutro(partBills.length));
  return {
    subject: `${p.scheduleName}: ${possessive(p.teamName)} slots changed`,
    greeting: firstNames(p.recipientNames),
    paragraphs: [`${p.orgName} changed ${possessive(p.teamName)} slots on ${p.scheduleName}:`],
    lists: [...(p.groups?.length ? changeGroupLists(p.groups) : [{ title: null, items: p.lines }]), ...partBills.map(b => ({ title: PART_WORDS.emailBillTitle(b.name, billPhrase(b.cents, b.installments.length)), items: b.installments.map(paymentLine) }))],
    link: { label: `Open ${possessive(p.teamName)} schedule →`, path: p.link },
    outro: [...money2, 'Everything else stays as it was.'].join(' '),
  };
}

// ── The notices ("Your club" for a coach; the builders') ─────────────────────────────────────────

/** [marketing] Each notice's title and body. */
export const SCHEDULE_NOTICES = {
  /** The body was already one line; the opened notice reads Team · Slots · Bill (people who can open Money) · Reply by
   *  (the head coach, who answers), then the head coach's next step (Notifications read at a glance, Stage 2). */
  review: (p: { orgName: string; scheduleName: string; teamName: string; slots: number; billCents: number | null; replyBy: string | null }) => ({
    title: `${p.orgName} sent ${p.scheduleName} for review`,
    body: `${p.teamName} · ${pluralize(p.slots, 'slot')}${p.billCents ? ` and a ${moneyCents(p.billCents)} bill` : ''}.${p.replyBy ? ` Reply by ${formatShortWeekdayDate(p.replyBy)}.` : ''}`,
    facts: noticeFacts([
      factRow(FACT_LABELS.team, p.teamName),
      factRow(FACT_LABELS.slots, String(p.slots)),
      factRow(FACT_LABELS.bill, p.billCents ? moneyCents(p.billCents) : null, { lead: true }),
      factRow(FACT_LABELS.replyBy, p.replyBy ? formatShortWeekdayDate(p.replyBy) : null, { lead: true }),
    ], p.replyBy ? 'Say it looks good, or ask for a change.' : null),
  }),
  final: (p: { scheduleName: string; teamName: string; slots: number }) => ({
    title: `${p.scheduleName} is on ${possessive(p.teamName)} schedule`,
    body: `${pluralize(p.slots, 'practice')} from the club’s schedule.`,
  }),
  changes: (p: { scheduleName: string; teamName: string; changes: number }) => ({
    title: `${p.scheduleName} changed for ${p.teamName}`,
    body: `${pluralize(p.changes, 'change')} on ${possessive(p.teamName)} schedule.`,
  }),
  /** The body was already one line; the opened notice reads Bill · Schedule · Payments · First due (Stage 2). */
  bill: (p: { orgName: string; teamName: string; cents: number; scheduleName: string; first: Installment | null; payments: number }) => ({
    title: `${p.orgName} billed ${p.teamName} ${moneyCents(p.cents)}`,
    body: `For ${p.scheduleName} · ${pluralize(p.payments, 'payment')}${p.first ? `, the first ${fmt(p.first.amount)} due ${formatStoredDate(p.first.dueDate, { withYear: false })}` : ''}.`,
    facts: noticeFacts([
      factRow(FACT_LABELS.bill, moneyCents(p.cents), { lead: true }),
      factRow(FACT_LABELS.schedule, p.scheduleName),
      factRow(FACT_LABELS.payments, String(p.payments)),
      factRow(FACT_LABELS.firstDue, p.first ? fmt(p.first.amount) : null, { lead: true, detail: p.first ? formatStoredDate(p.first.dueDate, { withYear: false }) : '' }),
    ]),
  }),
  reply: (p: { teamName: string; scheduleName: string; answer: 'looks_good' | 'ask_for_change'; words: string | null }) => ({
    title: p.answer === 'looks_good' ? `${p.teamName} replied: Looks good` : `${p.teamName} asked for a change`,
    body: p.answer === 'looks_good' ? p.scheduleName : `${p.scheduleName}: “${(p.words ?? '').slice(0, 200)}”`,
  }),
  handedBack: (p: { teamName: string; scheduleName: string; practices: number; first: string }) => ({
    title: `${p.teamName} handed back ${pluralize(p.practices, 'practice')}`,
    body: `${p.scheduleName} · from ${formatShortWeekdayDate(p.first)}. The time is open for another team.`,
  }),
  /** Stage 11d part C (Ask 11, C4): the twin of `handedBack` — a team took its time back. */
  takenBack: (p: { teamName: string; scheduleName: string; practices: number; first: string }) => ({
    title: `${p.teamName} took back ${pluralize(p.practices, 'practice')}`,
    body: `${p.scheduleName} · from ${formatShortWeekdayDate(p.first)}. The time is ${possessive(p.teamName)} again.`,
  }),
} as const;

/** [marketing] The send log's row (specimen 9): "Changes · 2 teams, 4 people". A schedule tells the club's coaches only —
 *  never the venue (owner 2026-10-12, walk §300 W7: "this is between clubs and their coaches"). */
export function sendLogLine(p: { kind: SendKind; teams: number; people: number }): string {
  const what = p.kind === 'review' ? 'For review' : p.kind === 'final' ? 'The whole schedule' : p.kind === 'bill' ? 'The bill' : 'Changes';
  return `${what} · ${pluralize(p.teams, 'team')}, ${pluralize(p.people, 'person', 'people')}`;
}

// ── The screens (part B — hub specimens 4–15) ────────────────────────────────────────────────────

/** [marketing] "25 Sundays" on a one-weekday schedule — its DAYS, since a team can hold two slots a Sunday — else "36 slots". */
export const slotCountWords = (slots: number, days: number, oneWeekday: number | null) =>
  (oneWeekday ? weekdayCount(days, oneWeekday) : pluralize(slots, 'slot'));

const GAME_CHANGES_HINT = 'Families hear about game changes when a league admin sends them.';

/**
 * [marketing] Every word the scheduler's screens draw — the list, New schedule, the schedule's page, its windows. Drafts,
 * written to the drawings; `/marketing` words them before the walks.
 */
export const SCHEDULE_SCREEN_WORDS = {
  // The list (specimen 4)
  title: 'Schedules',
  lede: 'The club’s time, handed out to its teams. Each schedule is kept, to change it or to start next year’s from it.',
  newButton: 'New schedule',
  cols: { schedule: 'Schedule', dates: 'Dates', teams: 'Teams', handedOut: 'Handed out', lastSent: 'Last sent' },
  bands: { in_use: 'In use now', coming_up: 'Coming up', ended: 'Ended' },
  open: (n: number) => `${n} open`,
  notSent: 'Not sent',
  sentBy: (day: string, by: string | null) => (by ? `${day} by ${by}` : day),
  phoneSent: (day: string, by: string | null) => (by ? `Sent ${day} by ${by}` : `Sent ${day}`),
  phoneTeams: (teams: number, handedOut: number) => `${pluralize(teams, 'team')} · ${handedOut} handed out`,
  emptyTitle: 'No schedules yet',
  emptyBody: 'A schedule hands the club’s time to its teams: a dome’s winter nights, a town’s field permit. Start one with New schedule.',
  loadFailed: 'The schedules didn’t load.',
  pageFailed: 'This schedule didn’t load.',

  // New schedule, step 1 (specimens 4 and 14 step 3)
  newTitle: 'New schedule',
  step1: 'Step 1 of 2 · settings',
  step2: (name: string) => `Step 2 of 2 · drafts for ${name}`,
  sectionTime: 'The time',
  sectionWho: 'Who, and how much',
  sectionRules: 'Rules',
  name: 'Name',
  namePlaceholder: 'For example: Winter dome 2026–27',
  // Two choices, not one "Start from" (owner, 2026-10-12): the permit is a LINK the schedule keeps (its page, its price),
  // last year's schedule a copy — and a club in its second year wants both. The permit is a field beside Name; the copy is
  // how the window OPENS (owner, 2026-10-13 — decision sheet https://claude.ai/artifact/1eReDtSsJLkLNAunzRredf).
  permit: 'Permit',
  noPermit: 'No permit',
  permitHint: 'Fills in the venue, facilities, dates, hours and dates off from the permit.',
  copySchedule: 'Copy a schedule',
  openingLead: 'Copy a schedule, or start blank.',
  openingLeadPermit: 'Copy a schedule, or start from the permit.',
  copyLead: 'A copy brings its time, teams, shares and rules, a year on.',
  copyLeadPermit: (permit: string) => `A copy brings its teams, shares and rules, a year on. The time comes from the permit, ${permit}.`,
  or: 'or',
  startBlank: 'Start blank',
  startFromPermit: 'Start from the permit',
  copiedFrom: (name: string) => `Step 1 of 2 · settings · copied from ${name}`,
  copyFailed: 'That schedule couldn’t be read. Try again.',
  // ── A schedule on several permits, Session A (drawing CLUB_SCHEDULE_SEVERAL_PERMITS_DRAWINGS.html, tab 1; owner rulings
  //    2026-11-14, N1–N4 A). Settled by /marketing 2026-11-16 (the project's Close). ──
  /** The tick-list field beside Name: every permit the club holds, each with its issuer and dates under its name. */
  permits: 'Permits',
  /** The field with nothing ticked (dimmed). */
  noPermitTyped: 'No permit: type the time below',
  /** Under the field, while a permit is ticked. */
  permitsHint: 'Each permit brings its own time and dates off. Untick one to take its time off again.',
  /** Under the field, on a copied schedule before a permit is ticked (N3 A). */
  permitReplacesCopy: 'Picking a permit replaces the copied time. The teams, their shares and the rules stay.',
  /** Under the field, just after a permit is unticked (/ux 1): its rows and dates off came off, edits and all. */
  permitCameOff: (permit: string, rows: number, datesOff: number) => {
    const what = [pluralize(rows, 'row'), datesOff ? (datesOff === 1 ? 'its date off' : `its ${datesOff} dates off`) : ''].filter(Boolean);
    return `${possessive(permit)} ${joinWithAnd(what)} came off. Ticking it again brings back the permit’s time, not your changes to it.`;
  },
  /** A permit's option in the list: its second line. */
  permitOption: (issuer: string | null, dates: string) => [issuer, dates].filter(Boolean).join(' · '),
  /** A card of rows: its permit, its issuer, its dates. */
  permitCard: (issuer: string | null, dates: string) => [issuer, dates].filter(Boolean).join(' · '),
  /** The card of rows copied from last year, before a permit replaces them (drawing, frame "copy"). */
  copiedCard: (name: string) => `Copied from ${name}, a year on`,
  /** The card of rows typed here, with no permit. */
  typedCard: 'Typed here',
  /** Under a row's place, when it came from no permit. */
  rowNoPermit: 'No permit',
  /** Under To, while the picker set the dates over several permits (drawing note 4). */
  datesWidened: (permits: number) => (permits === 2 ? 'Widened to cover both permits' : 'Widened to cover every permit'),
  /** Under To, after a permit came off and the dates went back to what is left. */
  datesBackTo: (permit: string) => `Back to ${possessive(permit)} dates`,
  /** Two ticked permits holding the same park at the same hour (/ux 8; Add time's statement, tab 3): the evenings stay
   *  on the permit already ticked. "Tue, May 25 and Thu, May 27 at Kinsmen Park are on this schedule already, from
   *  Milton spring 2027." */
  overlapLead: (days: string, many: boolean, park: string, permit: string) =>
    `${days} at ${park} ${many ? 'are' : 'is'} on this schedule already, from ${permit}.`,
  overlapDays: (shown: readonly string[], more: number) =>
    (more > 0 ? `${shown.join(', ')} and ${more} more ${more === 1 ? 'day' : 'days'}` : joinWithAnd(shown)),
  overlapTail: (startsOn: string | null) =>
    `They stay where they are, priced by that permit.${startsOn ? ` The new time starts ${startsOn}.` : ''}`,
  // ── Add time and taking a permit off (Session E; drawing tab 3; owner rulings S1 A, P10 A, P11 A, P9 B). Settled by /marketing
  //    2026-11-16 (the project's Close). ──
  /** Tools › first item (S1 A: beside Settings…, never inside it). */
  toolAddTime: 'Add time…',
  /** Phase 8 ruling 2: on a final schedule only, and what it makes is a part of its own (its words: PART_WORDS). */
  toolAddTimeHint: 'More time, for the teams you choose, on a bill of its own. Nothing already on the schedule moves.',
  addTitle: 'Add time',
  addStep1: 'Step 1 of 2 · the new time',
  addStep2: 'Step 2 of 2 · drafts for the new time',
  /** Generate can't go yet: nothing new is ticked or found. */
  addNeedTime: 'Tick a permit, or find the time, to add time.',
  addGenerate: 'Generate drafts for the new time',
  addBack: 'Back to the new time',
  /** Step 2's statement: "6 new practices, Jun 1 – Jun 29". */
  addDraftsLead: (practices: number, dates: string) => `${pluralize(practices, 'new practice')}, ${dates}`,
  addDraftsRest: (permits: string, others: number) =>
    `${permits ? `From ${permits}. ` : ''}The other ${pluralize(others, 'practice')} ${others === 1 ? 'stays' : 'stay'} exactly where ${others === 1 ? 'it' : 'they'} ${others === 1 ? 'was sent' : 'were sent'}.`,
  addColTeam: 'Team',
  addColNew: 'New',
  addColHours: 'Hours',
  addTeamsTotal: (teams: number) => pluralize(teams, 'team'),
  /** A ticked team the new time gives nothing. */
  addNothingFor: (team: string) => `${team} gets none of the new time: the schedule already holds it then, or it is booked.`,
  /** The draft gives no team anything (/ux 5): only Back. */
  addNothingNew: (permits: number) => (permits > 1 ? 'These permits give no team a practice.' : 'This permit gives no team a practice.'),
  addNothingNewRest: 'The schedule already holds that time, or it is booked. Go back to choose other time, or cancel.',
  /** Settings… › a permit's card: the door to take it off (P11 A). */
  takeOffDoor: 'Take it off…',
  takeOffLabel: (permit: string) => `Take ${permit} off`,
  takeOffTitle: (permit: string) => `Take ${permit} off?`,
  takeOffFuture: (practices: number, day: string, teams: string) => (practices
    ? `Its ${pluralize(practices, 'practice')} from today (${day}) on come off: ${teams}.`
    : `It has no practice from today (${day}) on, so no team loses one.`),
  takeOffPast: (practices: number) => `The ${pluralize(practices, 'practice')} played before today stay on the schedule, and so does what the teams were billed for them.`,
  takeOffSend: 'The change waits in Changed since sent. Send the changes tells the coaches and shows what each team is credited for that time.',
  takeOffDraft: (slots: number) => `Its rows and ${pluralize(slots, 'slot')} come off this schedule. Nothing else on it moves.`,
  takeOffEdits: 'Other changes you’ve made in Settings… but not kept are left out of this.',
  takeOffGo: 'Take it off',
  takeOffBack: 'Back',
  permitTakenOff: (permit: string, name: string) => `${permit} is taken off ${name}.`,
  // ── Find the time (Session D; drawing tab 2; owner rulings N1 A, P4 A, P7 A, P7b A). Settled by /marketing 2026-11-16:
  //    "Where" and "Town" (the plan's venue-or-issuer filter) and "Another time" (its extra ranges) were not drawn. ──
  /** The door under the Permits field (N1 A: a door, not an entry in the tick list). */
  findDoor: 'Find the time across every permit',
  findTitle: 'Find the time',
  /** The finder's subtitle: what "free" means (/design: moved here from the list). */
  findIdentity: 'Every facility the club holds on a permit. Free means nothing is booked there and no other schedule’s draft holds it.',
  findShortest: 'Shortest time',
  findShortestHint: 'A day counts when this much is free',
  findDaysHint: 'Every day the permits hold',
  findAnyTime: 'Any time',
  findAnotherTime: 'Another time',
  findRemoveTime: (n: number) => `Remove time ${n}`,
  findKind: 'Kind',
  findWhere: 'Where',
  findTown: 'Town',
  findLoading: 'Finding the time…',
  findFailed: 'The free time didn’t load. Try again.',
  /** Both dates are needed to look; with one cleared the list on screen is the last answer, not this one. */
  findNeedDates: 'Pick the first and last day to look in.',
  /** The list's count line: "4 facilities the club holds in these dates · 128 hours free". */
  findCount: (places: number, minutes: number) => `${pluralize(places, 'facility', 'facilities')} the club holds in these dates · ${hoursWords(minutes)} free`,
  findHeadPlace: 'Facility',
  findHeadPermit: 'Permit',
  findHeadFree: 'Free',
  /** "18 evenings free of 24" — evenings when every stretch starts at 5:00 p.m. or later, else days. */
  findFreeOf: (free: number, held: number, evening: boolean) => `${pluralize(free, evening ? 'evening' : 'day', evening ? 'evenings' : 'days')} free of ${held}`,
  /** "Tue and Thu 6:00–8:00 p.m. · 36 hours". */
  findPattern: (stretches: readonly string[], minutes: number) => `${stretches.join(' · ')} · ${hoursWords(minutes)}`,
  findStretch: (days: string, start: string, end: string) => `${days} ${formatTimeRange(start, end)}`,
  /** P7 A: "4 held by a draft (Spring house league 2027)". */
  findDraftHeld: (days: number, drafts: readonly string[]) => `${days} held by ${drafts.length > 1 ? 'drafts' : 'a draft'} (${joinWithAnd(drafts)})`,
  /** P4 A: "Tue, May 25 and Thu, May 27 are on both". */
  findShared: (days: string, many: boolean) => `${days} ${many ? 'are' : 'is'} on both permits`,
  findPricedBy: (permit: string) => `Priced by ${permit}`,
  findPricedByLabel: 'The permit that prices those days',
  findFootNone: 'Tick the time to bring into the schedule.',
  findFootSome: 'Each comes in as a row of hours tied to its permit, within the dates above.',
  findAdd: (n: number) => (n ? `Add ${n} to the schedule` : 'Add to the schedule'),
  findBack: 'Back',
  /** Nothing found (drawing, frame "Nothing found"): said by the days when the days are what narrowed it. */
  findNoneDays: (days: string, from: string, to: string) => `Nothing the club holds is free on ${days} from ${from} to ${to}.`,
  findNoneFilters: (from: string, to: string) => `Nothing the club holds is free in these filters from ${from} to ${to}.`,
  findHeldDays: (days: string) => `The permits hold time on ${days} in these dates.`,
  findClearDays: 'Clear the days',
  findClearFilters: 'Clear the filters',
  findWiden: 'Widen the dates',
  /** The club holds no permit in the dates (/ux 4). */
  findNoPermit: (from: string, to: string) => `The club holds no permit between ${from} and ${to}.`,
  findAddPermit: 'Add a permit',
  /** Under the Permits field after found time came in (drawing, frame "picked"). */
  foundHint: 'Found in Find the time. Tick a permit to bring all of its time.',
  /** On a found row's card (P7b A): "4 Thursdays on Diamond B are held by the draft Spring house league 2027." */
  foundDraftNote: (days: string, many: boolean, place: string, drafts: readonly string[]) =>
    `${days} on ${place} ${many ? 'are' : 'is'} held by the ${drafts.length > 1 ? 'drafts' : 'draft'} ${joinWithAnd(drafts)}.`,
  /** The drafts step (P7b A, "warns on them like a clash"): slots on found time another draft holds. */
  foundDraftWarning: (slots: number, drafts: readonly string[]) =>
    `${pluralize(slots, 'slot')} ${slots === 1 ? 'is' : 'are'} given on days the ${drafts.length > 1 ? 'drafts' : 'draft'} ${joinWithAnd(drafts)} ${drafts.length > 1 ? 'hold' : 'holds'} there`,
  venue: 'Venue',
  chooseVenue: 'Choose a venue',
  facilities: 'Facilities',
  all: 'All',
  none: 'None',
  from: 'From',
  to: 'To',
  days: 'Days',
  chooseDays: 'Choose the days',
  until: 'Until',
  addHours: 'Add hours',
  removeHours: (n: number) => `Remove hours ${n}`,
  slotLength: 'Slot length',
  slotLengthHint: 'Each team’s time on a facility',
  changeover: 'Changeover',
  changeoverHint: 'Between slots on one facility',
  changeoverNone: 'None',
  datesOff: 'Dates off',
  addDateOff: 'Add a date off',
  dateOffWhy: 'Why (optional)',
  removeDateOff: (day: string) => `Remove the date off ${day}`,
  /** A date off's parks (a schedule on several permits, Session B; N4 A — the drawing's words; settled by /marketing 2026-11-16). */
  dateOffAppliesTo: 'Applies to',
  allVenues: 'All venues',
  /** The line under a permit's date off: where it came from (drawing, dates off, note 2). */
  dateOffFrom: (permit: string) => `From ${permit}`,
  minutes: (n: number) => `${n} min`,
  split: 'Split the time',
  splitEven: 'Evenly',
  splitPercent: 'By percentage',
  splitWeekly: 'A set number a week',
  // Each team's time (Stage 11c Ask 4): one dropdown beside Split the time, its sentence under it.
  timeMode: 'Each team’s time',
  practicesPerDay: 'Practices per team, per day',
  practicesPerDayHint: 'One prevents back-to-back sessions in generated drafts; some slots may stay open.',
  /** Stage 13 fix-now 3 (owner 2026-11-06): when the setting is what leaves slots open, the hint says how many, in place of
   *  "some slots may stay open" — "One prevents … drafts. At 1 a day, 7 teams can use 175 of the 450 slots." */
  practicesPerDayWhy: 'One prevents back-to-back sessions in generated drafts.',
  practicesPerDayCanUse: (perDay: number, teams: number, canUse: number, slots: number) =>
    `At ${perDay} a day, ${pluralize(teams, 'team')} can use ${canUse} of the ${slots} slots.`,
  practicesPerDayChoice: (n: number) => `${pluralize(n, 'practice')}`,
  practicesPerDayNoLimit: 'No daily limit',
  timeSame: 'The same each week',
  timeMoved: 'Moved around',
  timeSameHint: 'Each team keeps its facility and start time week to week, so families can plan around it.',
  timeMovedHint: 'Early and late starts and the facilities taken in turn, so no team always has the first slot. Each team keeps its days.',
  // Prime time, whole, in Who and how much (Stage 11c Ask 5): its hours, and how it is shared beside them.
  primeShare: 'How it’s shared',
  primeSame: 'Shared the same way',
  primeEven: 'Shared evenly by team',
  primeSameHint: (group: string, percent: string) => `${group} gets ${percent}% of the prime-time slots too`,
  primeSameHintPlain: 'Each group gets its share of the prime-time slots too',
  primeEvenHint: 'Every team the same prime time, whatever its share',
  colTeam: 'Team',
  colWeek: 'A week',
  colShare: 'Share',
  colSlots: 'Slots',
  each: 'each',
  notInGroup: 'Not in a group',
  // House league as a whole (Stage 11b — HOUSE_LEAGUE_STAGE9D2_11B_COPY.md, k1): one row, never by division.
  programs: 'Programs',
  houseLeagueWhole: 'Its league admins divide it among divisions and teams.',
  houseLeagueShare: 'Its league admins divide its share.',
  houseLeagueWholeHint: 'All of it goes to house league, so there are no drafts to choose from.',
  houseLeagueShareHint: 'The drafts place house league’s slots like a team’s. Its league admins divide them after you send.',
  houseLeagueFoot: (hours: number, facilities: number, range: string) =>
    `House league gets ${pluralize(hours, 'hour')} a week across ${pluralize(facilities, 'facility', 'facilities')}, ${range}. Its league admins can divide it right away.`,
  giveToHouseLeague: 'Give it to house league',
  teamsCount: (n: number) => pluralize(n, 'team'),
  aWeek: (n: number) => `${n} a week`,
  everyWeek: 'The shares hold every week, so no group takes its time early.',
  noSeason: (n: number) => `${pluralize(n, 'team')} ${n === 1 ? 'has' : 'have'} no season running`,
  tick: (team: string) => `Give ${team} time`,
  tickGroup: (group: string) => `Give every team in ${group} time`,
  groupFigure: (group: string, what: string) => `${possessive(group)} ${what}`,
  rulesOn: (n: number) => `${n} on`,
  // Rules as sentences (Stage 11c Ask 6): only the rules the club added, each its sentence and a pencil; one Add a rule
  // menu for every kind; the three safeguards under Always.
  addRule: 'Add a rule',
  ruleKinds: {
    windows: { title: 'Start and finish times', line: 'Teams that start after, or finish by, a time' },
    daysOff: { title: 'A team’s day off', line: 'A date, or a day every week' },
    fieldsBy: { title: 'Facilities for a group', line: 'Facilities kept for some teams' },
    sharing: { title: 'Sharing a facility', line: 'Teams that share a facility, 2 or more at once' },
    weekCap: { title: 'At most, a week', line: 'A weekly cap on any one team’s slots' },
  },
  always: 'Always',
  editRule: (sentence: string) => `Change this rule: ${sentence}`,
  ruleDone: 'Done',
  ruleTeams: 'Teams',
  chooseTeams: 'Choose the teams',
  ruleStartAfter: 'Start after',
  ruleFinishBy: 'Finish by',
  ruleTeam: 'Team',
  chooseTeam: 'Choose a team',
  ruleOff: 'Off',
  aDate: 'A date',
  every: (weekday: string) => `Every ${weekday}`,
  ruleNote: 'Why (optional)',
  maxWeek: 'At most, a week',
  noCap: 'No limit',
  capWords: (n: number) => `${pluralize(n, 'slot')} a team`,
  prime: 'Prime time',
  primeHint: 'The hours every team wants',
  primeNone: 'None',
  fieldsFacilities: 'Facilities',
  fieldsOnlyFor: 'Only for',
  chooseWho: 'Choose who',
  sharingAtOnce: 'At once',
  sharingHint: 'These teams are paired whenever a partner is free; every other team keeps a facility to itself. A shared slot is half a facility: half the hours toward a share, half the cost on the bill.',
  sharingHalf: (names: string, many: boolean) => `${names} ${many ? 'are half facilities, so they’re' : 'is a half facility, so it’s'} never shared.`,
  avoidGameDays: 'Never on a team’s game day',
  avoidGameDaysSub: 'Read from each team’s whole schedule, away games included',
  avoidBookings: 'Never over a booking already on the books',
  avoidBookingsSub: 'The clash check’s bookings: other teams, house league, tryout days, tournaments',
  noBackToBack: 'No back-to-back days for a team',
  removeRule: 'Remove this rule',
  ruleUnfinished: 'Finish this rule, or remove it.',
  ruleIdle: 'not in use: none of its teams is ticked',
  finishBy: (teams: string, time: string) => `${teams} finish by ${time}`,
  startAfterWords: (teams: string, time: string) => `${teams} start after ${time}`,
  startBetween: (teams: string, after: string, by: string) => `${teams} start after ${after} and finish by ${by}`,
  dayOffDate: (team: string, day: string) => `${team} off ${day}`,
  dayOffWeekly: (team: string, weekday: string) => `${team} off every ${weekday}`,
  fieldsOnly: (facilities: string, who: string) => `${facilities} only for ${who}`,
  capWeek: (n: number) => `At most ${n} a week`,
  generate: 'Generate drafts',
  generating: 'Generating…',
  cancel: 'Cancel',
  needName: 'Name the schedule.',
  needVenue: 'Choose the venue.',
  needFacility: 'Choose at least one facility.',
  needDates: 'Give the schedule its first and last day.',
  needHours: 'Give each row of hours its days, a start and a later end.',
  needTeams: 'Tick at least one team.',
  needFigures: 'Give each ticked team its figure.',
  over100: (over: string) => `The shares add up to more than 100%: take ${over}% off a group or a team.`,
  previewFailed: 'What this time holds couldn’t be worked out just now.',
  loadingInputs: 'Loading the club’s teams and places…',
  inputsFailed: 'The club’s teams and places didn’t load. Close this and try again.',

  // Step 2 (specimen 5)
  threeMore: 'Three more drafts',
  byTeam: 'By team',
  byDay: 'By day',
  draftExportHolds: (label: string, slots: number) => `${label} · a draft · ${pluralize(slots, 'slot')}`,
  scheduleExportHolds: (name: string, slots: number, draft: boolean) => `${name}${draft ? ' · a draft' : ''} · ${pluralize(slots, 'slot')}`,
  pdfHint: 'By facility and week, to print',
  rowSlots: (n: number) => pluralize(n, 'slot'),
  rowPrime: (n: number) => `${n} prime`,
  openSlot: 'Open',
  statementBullets: (handedOut: number, slots: number, teams: number, open: number, held: number) => [
    `Hands out ${handedOut} of the ${slots} slots to ${pluralize(teams, 'team')}`,
    open ? `Leaves ${open} open` : 'Leaves nothing open',
    ...(held ? [`Leaves out the ${pluralize(held, 'slot')} a booking already holds`] : []),
  ],
  backToSettings: 'Back to settings',
  saveLead: (name: string) => `Saving keeps ${name} as a draft. Nothing reaches a team until you send it.`,
  saveRest: 'On its page you can read every week, export it, change these settings and adjust it by hand.',
  keepLead: 'Keeping this draft replaces the slots nobody placed by hand.',
  saveDraft: 'Save as a draft',
  saving: 'Saving…',
  settingsBack: 'Settings',
  keepDraft: 'Keep this draft',
  regenTitle: (name: string) => `Regenerate ${name}?`,
  regenLead: 'The draft you picked replaces every slot nobody placed by hand.',
  /** On a sent schedule (P10 A): nothing before today moves, said where the admin decides, with the count. */
  regenLeadSent: 'The draft you picked replaces every slot from today on, except the ones someone placed by hand.',
  regenPast: (practices: number) => `The ${pluralize(practices, 'practice')} before today ${practices === 1 ? 'stays as it was' : 'stay as they were'} sent.`,
  regenKept: (locked: number, moved: number) => {
    const parts = [locked ? `the ${pluralize(locked, 'slot')} you locked` : '', moved ? `the ${moved} you moved by hand` : ''].filter(Boolean);
    if (!parts.length) return '';
    const said = parts.join(' and ');
    return `${capFirst(said)} ${locked + moved === 1 ? 'stays where it is' : 'stay where they are'}.`;
  },
  regenNotSent: 'It hasn’t been sent, so no team is told.',
  regenSent: 'It has already been sent, so no team is told until you send the changes from its page.',
  regenKeep: 'Keep it',
  // The regenerate question's way out. Not "Keep it": the button that opened this question is "Keep this draft",
  // so "Keep it" read as the opposite of what it does (owner, 2026-11-13).
  regenBack: 'Go back',
  regenGo: 'Regenerate',
  notKept: (n: number) => `${pluralize(n, 'slot')} locked or moved by hand ${n === 1 ? 'isn’t' : 'aren’t'} in the new time, so ${n === 1 ? 'it goes' : 'they go'}.`,

  // The schedule's page (specimens 6–10, 14)
  back: 'Schedules',
  meta: (where: string, dates: string, teams: number) => `${where} · ${dates} · ${pluralize(teams, 'team')}`,
  metaSent: (where: string, dates: string, day: string, by: string | null) => `${where} · ${dates} · sent ${day}${by ? ` by ${by}` : ''}`,
  metaReview: (where: string, dates: string, day: string, by: string | null) => `${where} · ${dates} · sent for review ${day}${by ? ` by ${by}` : ''}`,
  viewOverview: 'Overview',
  viewGrid: 'Grid',
  viewTeam: 'By team',
  viewGroup: 'By group',
  facilityPill: 'Facility',
  groupPill: 'Group',
  teamPill: 'Team',
  everyFacility: 'Every facility',
  everyGroup: 'Every group',
  everyTeam: 'Every team',
  tools: 'Tools',
  toolSettings: 'Settings…',
  toolSettingsHint: 'The time, the teams and their shares, the rules',
  toolRegenerate: 'Regenerate the unlocked slots…',
  /** What the week's tools reach: "this week", or a one-weekday schedule's dates on screen ("these Sundays", Ask 27). */
  scopeWeek: 'this week',
  scopeDates: (weekday: number) => `these ${weekdayPlural(weekday)}`,
  toolLockWeek: (scope: string) => `Lock ${scope}`,
  toolClearWeek: (scope: string) => `Clear ${scope}…`,
  nothingToLock: (scope: string) => `Nothing ${scope} needs a lock: every slot is locked or open.`,
  toolSendLog: 'Send log',
  /** The same Tools row once every slot the week holds is locked: it undoes what Lock this week did. */
  toolUnlockWeek: (scope: string) => `Unlock ${scope}`,
  toolDelete: 'Delete this draft…',
  send: 'Send',
  sendChanges: 'Send the changes',
  finalize: 'Finalize and send',
  facilityHead: 'Facility',
  noTime: '—',
  handedBackSlot: (team: string) => `Open · handed back by ${team}`,
  locked: 'Locked',
  fairTitle: 'Fair shares',
  /** Fair shares B (Sidebar Strip & Grid Width, Stage 1 — ratified 2026-10-12): the team table's card under the grid,
   *  and the band's door that scrolls to it. */
  fairTeamsTitle: 'Fair shares by team',
  tileHandedOut: 'Handed out',
  tileOpen: 'Open',
  tileShort: 'Short',
  tileClashes: 'Clashes',
  tileBill: 'The bill',
  /** The Bill tile's figure on a final schedule with no bill: the permit's price is not a bill (owner ruling 2026-11-14). */
  tileNotBilled: 'Not billed',
  ofSlots: (a: number, b: number) => `${a} of ${b}`,
  colThisWeek: 'A week',
  colPrimeTime: 'Prime time',
  colGroup: 'Group',
  colTeams: 'Teams',
  regenerated: (name: string) => `${name} regenerated`,
  regeneratedNotRenamed: (name: string) => `${name} regenerated. Its new name didn’t save: rename it again from Settings.`,
  colAll: 'All',
  colPrime: 'Prime',
  colHours: 'Hours',
  colBill: 'Bill',
  // Fair shares, Stage 11c: Hours where there is no prime time; Early and Fields when teams move around.
  colEarly: 'Early',
  /** The schedule's own facility word, plural: "Fields" at the dome, "Lanes" at the lanes, else "Facilities". */
  colFacilities: (noun: string) => capFirst(noun),
  sharedCount: (all: number, shared: number) => (shared >= all ? `${all} shared` : shared ? `${all} · ${shared} shared` : String(all)),
  hoursNote: (hours: string | null) => (hours
    ? `A shared slot and a half field each count half a facility, so every team has ${hours} hours.`
    : 'A shared slot and a half field each count half a facility.'),
  movedNote: 'Moved around: early and late taken in turn, and the facilities each team’s rules allow.',
  slotShared: 'shared',
  shareWith: 'Share with',
  addTeam: (team: string) => `Add ${team}`,
  takeOff: (team: string) => `Take ${team} off`,
  primeNote: (prime: string, same: boolean) => `Prime time: ${prime.charAt(0).toLowerCase()}${prime.slice(1)}${same ? ', shared the same way' : ''}.`,
  heldNote: (n: number) => `${n === 2 ? 'Two slots' : n === 1 ? 'One slot' : `${n} slots`} a booking already holds ${n === 1 ? 'is' : 'are'} left out.`,
  clashLine: (when: string, place: string, owner: string) => `${when} · ${place}: ${owner} holds it.`,
  /** [marketing] Past a few clashes, one line per kind of booking (a draft laid over a schedule already on the books listed
   *  71, owner 2026-10-13): "70 slots clash with practices already booked for 14U AA, 9U AA and 6 more." The last line
   *  says where the rest is: the grid marks each clashing slot. */
  clashGroupLines: (groups: readonly { kind: string | null; count: number; owners: readonly string[] }[]) => groups.map((g, i) => {
    const one = g.count === 1;
    const what = g.kind === 'tryout' ? (one ? 'a tryout day' : 'tryout days') : g.kind === 'game' ? (one ? 'a game' : 'games')
      : g.kind === 'practice' ? (one ? 'a practice' : 'practices') : (one ? 'a booking' : 'bookings');
    const who = g.owners.length <= 3 ? joinWithAnd(g.owners) : `${g.owners.slice(0, 2).join(', ')} and ${g.owners.length - 2} more`;
    const tail = i === groups.length - 1 ? ' Each is marked on the grid.' : '';
    return `${pluralize(g.count, 'slot')} ${one ? 'clashes' : 'clash'} with ${what} already booked for ${who}.${tail}`;
  }),
  shortLine: (team: string, n: number, scope: string) => `${team} is ${n} short ${scope}.`,
  billDoor: (payments: number) => `The bill · ${pluralize(payments, 'payment')}`,
  billTeamsDoor: 'Bill the teams',

  // ── The page is the path (Club Tier 13c Session C, C4 = A; drawing CLUB_TIER_STAGE13C_DRAWINGS.html, the schedule page) ──
  /** [marketing] The top line's door: "From the permit {name} ›" before the place, the dates and who sent it. */
  metaFrom: 'From the permit',
  /** Several permits behind the rows (settled by /marketing 2026-11-16; a schedule on several permits, tab 6): "From the permits A › and B ›". */
  metaFromMany: 'From the permits',
  /** [marketing] The drafts step, only while a draft is short and the per-day setting is why (hub tab 13, Change 3 — the
   *  safety net beside fix-now 3's hint): "7 teams short: 47 of 450 slots handed out. The rules allow 1 practice a team a
   *  day, and Lakeshore Dome has 18 places a Sunday for 7 teams." Then a door back to the setting. */
  draftsShortWhy: (short: number, handed: number, seats: number, perDay: number, place: string, perWeek: number, weekday: number | null, teams: number) =>
    `${pluralize(short, 'team')} short: ${handed} of ${seats} slots handed out. The rules allow ${pluralize(perDay, 'practice')} a team a day, and ${place} has ${pluralize(perWeek, 'place')} a ${weekday ? weekdayOne(weekday) : 'week'} for ${pluralize(teams, 'team')}.`,
  draftsShortDoor: 'Change the rules',
  /** The place in that sentence when the form has no venue name to give. */
  thisPlace: 'this time',
  /** The Bill tile opens Fair shares and the bill — the window's title; "Fair shares" for a reader without the bill. */
  fairBillTitle: 'Fair shares and the bill',
  /** [marketing] Needs attention's row while the permit's dates off still hold this schedule's slots (C2 = A). */
  outsideChip: PERMIT_WORDS.outside,
  /** `permit`: named once a schedule's rows come from more than one permit, each its own row (Session B: "Thu, May 13 is a
   *  date off on Milton spring 2027"). */
  outsideHead: (days: readonly string[], permit: string | null = null) => `${datesOffClause(days)} on ${permit ?? 'the permit'}`,
  /** "6 practices on this schedule sit on those days: 14U AA, 15U AA and 13U AAA, both Saturdays." `when` is said only
   *  when every team named is on every one of two or more days of one weekday ("both Saturdays", "all 3 Saturdays"). */
  outsidePractices: (n: number, teams: readonly string[], days: number, when: string | null, at: string | null = null) =>
    `${pluralize(n, 'practice')} on this schedule ${n === 1 ? 'sits' : 'sit'} on ${thoseDays(days)}${at ? ` at ${at}` : ''}: ${joinWithAnd([...teams])}${when ? `, ${when}` : ''}.`,
  outsideSlots: (n: number, days: number) => `${pluralize(n, 'slot')} of this schedule ${n === 1 ? 'is' : 'are'} on ${thoseDays(days)}.`,
  outsideBoth: (weekday: number, days: number) => `${days === 2 ? 'both' : `all ${days}`} ${weekdayPlural(weekday)}`,
  outsideTeamsHave: (one: boolean) => (one ? 'The team still has it.' : 'The teams still have them.'),
  /** "2 house-league games on Dec 5 are for the league admins to move." */
  outsideLeague: (what: string, many: boolean, days: readonly string[]) =>
    `${what} on ${shortDays(days)} ${many ? 'are' : 'is'} for the league admins to move.`,
  outsideSeeThem: 'See them',
  /** The row's one ask: the days into the schedule's own Dates off, then today's Regenerate. */
  /** `at`: the permit's parks, said once the schedule uses more than one ("Take May 13 off Kinsmen Park", Session B, P5 A). */
  takeDaysOff: (days: readonly string[], at: string | null = null) => `Take ${shortDays(days)} off${at ? ` ${at}` : ''}`,
  /** The warnings' first line, its lead in bold. */
  outsideWarnLead: (days: readonly string[]) => `${PERMIT_WORDS.outside}: ${datesOffClause(days)}`,
  outsideWarnTail: (permit: string) => ` on ${permit}.`,
  /** "Different on a date": a pulled day's own row. */
  /** A permit's date off closes every facility at ITS parks; on a schedule over several parks the row names them. */
  outsideDayPlace: (at?: string | null) => (at ? `every facility at ${at}` : 'every facility'),
  outsideDayLine: (n: number) => `${PERMIT_WORDS.outside} · ${pluralize(n, 'slot')} still on it`,
  whichWeeks: (team: string, from: string, to: string) => `Move ${possessive(team)} ${from} slot to ${to}:`,
  swapWeeks: (team: string, from: string, other: string) => `Swap ${possessive(team)} ${from} slot with ${possessive(other)}:`,
  thisWeek: 'This week only',
  laterWeeks: 'This & later weeks',
  everyWeekScope: 'Every week',
  weeksSpan: (range: string, n: number) => `${range} · ${pluralize(n, 'slot')}`,
  moved: (team: string, to: string, range: string | null) => `${team} moved to ${to}${range ? `, ${range}` : ''}`,
  swapped: (a: string, b: string) => `${a} and ${b} swapped`,
  cleared: (n: number) => `${pluralize(n, 'slot')} cleared`,
  lockedWeek: (n: number) => `${pluralize(n, 'slot')} locked`,
  unlocked: 'Unlocked: regenerating can move it again',
  teamChanged: (team: string | null, when: string) => (team ? `${team} has ${when}` : `${when} is open`),
  undo: 'Undo',
  unlockedWeek: (n: number) => (n === 1 ? 'Unlocked: regenerating can move it again' : `${pluralize(n, 'slot')} unlocked: regenerating can move them again`),
  undone: 'Put back as it was',
  skipped: (n: number, why: string) => `${pluralize(n, 'week')} didn’t move: ${why}.`,
  skippedWhy: {
    not_theirs: 'the team isn’t in that slot that week',
    no_slot: 'there is no slot there that week',
    full: 'that week’s slot is full',
    already_there: 'the team is already in that slot that week',
  },
  slotEyebrow: (name: string) => `${name} · a slot`,
  slotTeam: 'Team',
  slotTeams: 'Teams',
  slotPrime: 'Prime time',
  slotHeld: 'Held by',
  yes: 'Yes',
  no: 'No',
  // "Change team" became "Give it to" (Stage 11b copy): the list holds House league, which is not a team.
  changeTeam: 'Give it to',
  nobody: 'Nobody (open)',
  repTeams: 'Rep teams',
  heldByHouseLeague: 'House league',
  repSlotReads: 'A rep team holds this time. An owner or an admin can give it to house league.',
  // The club takes time back (k5, 9d2·16 — the practices half (11b) and the games half (9d-2b Part 5)).
  // One slot (the settled repeating form is k5's "Give every Thursday at 6:00 p.m. on {facility} to {team}?"; the window's
  // identity line already names the facility). Settled by /marketing 2026-10-27 (HOUSE_LEAGUE_STAGE9D2_11B_COPY.md).
  takeBackTitle: (day: string, start: string, to: string) => `Give ${day} at ${start} to ${to}?`,
  takeBackClearTitle: (day: string, start: string) => `Clear ${day} at ${start}?`,
  takeBackPractices: (teams: string[]) =>
    `House league uses this time: the ${joinWithAnd(teams.map(possessive))} practices. Their coaches and families are told when you send the changes.`,
  /** k5's games (9d2·16). Published, settled ("House league uses this time: 12 published U12 games, from Thu, Jun 3."; one
   *  slot has one date, so no "from", as the practices' one-slot line); a draft's is [marketing]. A slot is one division's
   *  game time, so its games are all published or all draft. */
  takeBackGames: (division: string, count: number, published: boolean) => published
    ? `House league uses this time: ${pluralize(count, `published ${division} game`)}. When you send the changes, these games move to Needs a new date in ${possessive(division)} Changes to send. Families keep the old dates until a league admin gives new ones and sends. Games already played stay; draft games come off the draft.`
    : `House league uses this time: ${pluralize(count, `draft ${division} game`)}. When you send the changes, ${count === 1 ? 'it comes' : 'they come'} off the draft. Nobody has been told about ${count === 1 ? 'it' : 'them'}.`,
  // k5's foot, settled: "U12's league admins are told then." returns now that Send the changes tells them (Part 5).
  takeBackWait: (division: string | null) =>
    `Nothing changes until you send the changes.${division ? ` ${possessive(division)} league admins are told then.` : ''}`,
  giveItTo: (to: string) => `Give it to ${to}`,
  lockSlot: 'Lock this slot',
  unlockSlot: 'Unlock this slot',
  swapWith: 'Swap with…',
  clearSlot: 'Clear this slot',
  slotRepeats: (weekday: string, time: string, range: string) => `Every ${weekday} at ${time}, ${range}`,
  swapTitle: 'Swap with which slot?',
  swapHint: 'A slot this week. The question after it asks which weeks.',
  clearWeekTitle: (range: string, dates: boolean) => (dates ? `Clear ${range}?` : `Clear the week of ${range}?`),
  clearWeekBody: (n: number, scope: string) => `${pluralize(n, 'slot')} ${scope} become${n === 1 ? 's' : ''} open. Locked slots stay. Undo takes it back.`,
  clearWeekGo: (scope: string) => `Clear ${scope}`,
  deleteTitle: (name: string) => `Delete ${name}?`,
  deleteBody: 'The draft and its slots go. Nothing reached a team, so nobody is told.',
  deleteReview: 'It was sent for review: its coaches’ replies go with it. Nothing was booked or billed.',
  deleteGo: 'Delete this draft',
  deleted: (name: string) => `${name} deleted`,
  colNights: 'Days',
  bandGroup: (group: string, teams: number, slots: number) => `${group} · ${pluralize(teams, 'team')} · ${pluralize(slots, 'slot')}`,
  hours: (h: number) => `${Math.round(h * 10) / 10} h`,
  teamSlotsTitle: (team: string) => `${possessive(team)} slots`,
  // The bill (specimen 14 step 4)
  billTitle: 'Bill the teams',
  billFrom: 'Bill from',
  billFromHint: (planned: string, left: string) => `The permit’s budget line · ${planned} planned, ${left} left`,
  billFromOther: (planned: string, left: string) => `${planned} planned, ${left} left`,
  /** The "Bill from" dropdown's no-line row: the name, then what it means on the line beneath. */
  billNoLineName: 'No budget line',
  billNoLineSub: 'Off-plan: no line’s budget is used',
  billFor: 'Bill the teams for',
  billWhole: (amount: string) => `The time at the permit’s price · ${amount}`,
  // ── A schedule on several permits, Session C (drawing tab 5 "Price the time"; settled by /marketing 2026-11-16) ──
  billWholePermits: (amount: string) => `The time at the permits’ prices · ${amount}`,
  billPrice: 'Price the time',
  billPriceEach: 'Each permit’s price',
  billPriceOne: 'One rate for all',
  /** "Milton spring $60.00 a full field, an hour · Halton Hills $90.00" */
  billPriceEachHint: (permits: readonly { name: string; hour: string }[]) =>
    permits.map((x, i) => (i === 0 ? `${x.name} ${x.hour} a full field, an hour` : `${x.name} ${x.hour}`)).join(' · '),
  /** "$450.00 over 6 h of full fields: $75.00 a full field, an hour, wherever the team played" */
  billPriceOneHint: (total: string, hours: string, rate: string) => `${total} over ${hours} of full fields: ${rate} a full field, an hour, wherever the team played`,
  billSplitHintEach: 'Each field at its permit’s price; a half field at half of it',
  billSplitHintOne: 'Each field at the one rate; a half field at half of it',
  billSplitPartEach: 'The amount, shared by what each team’s time costs at its permit’s price',
  billSplitPartOne: 'The amount, shared by the hours each team got',
  /** N6 A: "Bill from" starts on the line of the permit with the most priced time, and says so. */
  billFromMost: (permit: string, planned: string, left: string) => `${possessive(permit)} budget line, the permit with the most time · ${planned} planned, ${left} left`,
  /** A team's caption with its hours by permit: "2 slots · 1 h Milton spring + 1 h Halton Hills". */
  billTeamByPermit: (slots: number, parts: readonly string[]) => `${slots === 1 ? '1 slot' : `${slots} slots`} · ${parts.join(' + ')}`,
  /** The read-only view once the bill is made (P9 B item 5): the terms it keeps, and any permit billed later at its own price. */
  billKeptEach: (list: string) => `Priced at each permit’s price: ${list}.`,
  billKeptOne: (rate: string) => `Priced at one rate for all: ${rate} a full field, an hour.`,
  billKeptLater: (list: string) => `Time added after the bill was made, priced at its own permit’s price and kept that way: ${list}.`,
  billPart: 'A part of it',
  billPartHint: 'Or a part of it, when the club covers some',
  billNoPermitHint: 'No permit prices this time: type what the teams pay.',
  billAmount: 'Amount',
  billSplit: 'Split',
  billSplitTime: 'By the time each team got',
  billSplitHint: (full: string, half: string | null) => `Each field at the permit’s price: a full field ${full} an hour${half ? `, a half field ${half}` : ''}`,
  billSplitHintPlain: 'Each team’s share of the amount, by the hours it got',
  billPayments: 'Payments',
  billOne: 'One payment',
  billMonthly: 'Monthly',
  billTwoMonths: 'Every two months',
  billDates: 'Dates I choose',
  billFirstDue: 'First payment due',
  /** What the Payments choice comes to, said plainly under it: how many payments, and when the first falls due. */
  billPaymentsCount: (plan: 'one' | 'monthly' | 'two_months' | 'dates', payments: number, first: string | null): string => {
    if (!payments) return '';
    if (plan === 'dates') return payments === 1 ? 'One payment, on that date.' : `${payments} payments, on the dates you chose.`;
    if (!first) return '';
    if (plan === 'one' || payments === 1) {
      return plan === 'one' ? `One payment, due ${first}.` : `One payment, due ${first}. The schedule ends before the next one would fall due.`;
    }
    return `${payments} payments: the first due ${first}, then ${plan === 'monthly' ? 'every month' : 'every two months'}.`;
  },
  billAddDate: 'Add a date',
  billTeamCaption: (full: number, half: number, shared: number, other: number, hours: number) => {
    const parts = [full ? `${full} full` : '', half ? `${half} half` : '', shared ? `${shared} shared` : '', other ? `${other} more` : ''].filter(Boolean);
    // One kind says it whole (specimen 2's bill, Stage 11c): "50 shared slots", "50 half-field slots".
    const slots = parts.length > 1 ? parts.join(' + ')
      : full ? `${full} full-field slots` : half ? `${half} half-field slots` : shared ? `${shared} shared slots` : parts.join('');
    return `${slots} · ${Math.round(hours * 10) / 10} h`;
  },
  billStatementLead: 'The bill goes to the teams with the schedule.',
  billStatement: (payments: number, word: string | null) =>
    `Nothing is billed until you finalize. Then each team’s share arrives on its Money › Club tab with its ${payments === 1 ? 'payment' : `${payments} payments`}${word ? `, filed under ${word} where the team’s budget has it` : ''}.`,
  billAdd: 'Add the bill to the schedule',
  billSave: 'Save the bill',
  billRemove: 'Take the bill off the schedule',
  billAdded: 'The bill rides with the schedule until you finalize',
  billRemoved: 'The bill is off the schedule',
  billNeedFirst: 'Pick the first payment’s date.',
  billNeedDates: 'Pick the payment dates.',
  billNeedAmount: 'Type what the teams pay.',
  billNoTimeYet: 'Hand out some time before billing it.',
  billLoading: 'Loading the budget lines…',
  // A finalized schedule's bill, made later (13c — the schedule stays final; the bill is its own send)
  billLateLead: 'This schedule was finalized without a bill.',
  billLateStatement: (payments: number, word: string | null) =>
    `The schedule stays as it is. Sending the bill puts each team’s share on its Money › Club tab with its ${payments === 1 ? 'payment' : `${payments} payments`}${word ? `, filed under ${word} where the team’s budget has it` : ''}, and tells its coaches.`,
  billLateGo: 'Review the bill',
  billLateNote: 'This schedule was finalized without a bill, so these figures are the time at the permit’s price, not a bill. Bill the teams makes one without reopening the schedule.',
  billSendTitle: 'Send the bill',
  billSendGo: (n: number) => `Send the bill to ${pluralize(n, 'person', 'people')}`,
  // [marketing] Owner 2026-11-13: only the coaches who can open Money are emailed the bill.
  billSendHint: 'Every team here is billed. Each team’s coaches who can open Money get one email with that team’s bill, and unticking a team only skips its email; a reply comes to you. The schedule stays final.',
  billSentNotice: (people: number, teams: number, failed: number) =>
    `Billed ${pluralize(teams, 'team')}. Emailed ${pluralize(people, 'person', 'people')}.${failed ? ` ${failed} couldn’t be delivered.` : ''}`,
  // Send (specimens 9, 10, 14 step 5)
  sendTitle: 'Send the schedule',
  reviewTitle: 'Send for review',
  finalizeTitle: 'Finalize and send',
  changesTitle: 'Send the changes',
  sendHow: 'Send',
  sendReview: 'For review first',
  sendFinal: 'Final now',
  sendReviewHint: 'Or “Final now”, which books and bills at once',
  sendFinalHint: 'Or “For review first”: the coaches see it and reply; nothing is booked or billed yet',
  replyBy: 'Reply by',
  whoTold: (people: number) => `Who is told · ${pluralize(people, 'coach', 'coaches')}`,
  whoReviews: (teams: number, people: number) => `Who reviews · ${pluralize(teams, 'team')}, ${pluralize(people, 'coach', 'coaches')}`,
  whoChanges: (people: number) => `Who is told · ${pluralize(people, 'person', 'people')}`,
  whoChangesGamesOnly: 'Who is told · league admins',
  staffNote: 'Head coach and staff with schedule access',
  teamSlots: (slots: number, days: number, oneWeekday: number | null) => slotCountWords(slots, days, oneWeekday),
  nobodyHead: (n: number) => `Nobody to send to · ${pluralize(n, 'team')}`,
  emailHint: 'Each team’s coaches get one email listing that team’s slots; a reply comes to you.',
  // [marketing] Owner 2026-11-13: the bill goes only to the coaches who can open Money.
  reviewHint: 'Each team’s coaches get one email with their slots, and the bill too if they can open Money; a reply comes to you.',
  changesHint: 'Each team’s coaches get one email listing what changed for that team; a reply comes to you.',
  // Stage 11b Part 5 (h4, settled): the sentence changesHint gains when house league is in the send.
  changesHintLeague: `A house-league team’s families get one email too. ${GAME_CHANGES_HINT}`,
  /** 9d-2b Part 5: only a division's games in the send — its second sentence alone (no house-league family hears here). */
  changesHintLeagueGames: GAME_CHANGES_HINT,
  lastSent: (day: string, by: string | null) => `Last sent ${day}${by ? ` by ${by}` : ''}.`,
  notSentYet: 'Not sent yet.',
  seeEmail: (who: string) => `See ${possessive(who)} email`,
  // [marketing] Owner 2026-11-13: a team where some coaches can't open Money — they get the same email without the bill.
  // (The team's row no longer names them; only this door to the plain email remains.)
  // Owner 2026-11-13: a team's row names its head coach only; the rest of the staff is a small count under it.
  alsoTold: (n: number) => `+ ${n} more ${n === 1 ? 'coach' : 'coaches'} on the team`,
  seePlainEmail: (who: string) => `See the email ${who} gets, without the bill`,
  /** /design 2026-11-13: beside the door above, the first door says it is the one with the bill. */
  seeMoneyEmail: (who: string) => `See ${possessive(who)} email, with the bill`,
  /** The heading over the teams whose bill reaches nobody who can open Money (as `nobodyHead` heads the unreachable). */
  billNotToldHead: (n: number) => `Bill not emailed · ${pluralize(n, 'team')}`,
  sendTo: (n: number) => `Send to ${n}`,
  sendToCoaches: (n: number) => `Send to ${pluralize(n, 'coach', 'coaches')}`,
  sendToPeople: (n: number) => `Send to ${pluralize(n, 'person', 'people')}`,
  sendToLeagueAdmins: 'Send to league admins',
  finalizeGo: (n: number) => `Finalize and send to ${n}`,
  sending: 'Sending…',
  billCorrections: 'Bill the corrections',
  // Stage 11d, Ask 8: one switch for both halves — a gain billed, a loss taken off what the team owes ("is owed $X back:
  // its coach asks for it" retired with build question B's owed-back).
  billCorrectionsOn: HAND_BACK_WORDS.billCorrectionsOn,
  billCorrectionsOff: HAND_BACK_WORDS.billCorrectionsOff,
  /** P9 B (several permits, Session C): time on a permit that was not behind the bill is billed at that permit's own price,
   *  kept from now on. "Time on Georgetown summer is billed at that permit’s own price, $120.00 a full field, an hour, and
   *  kept at that price from now on." Settled by /marketing 2026-11-16. */
  billNewPermitPrice: (permits: readonly { name: string; hour: string }[]) => permits.length === 1
    ? `Time on ${permits[0].name} is billed at that permit’s own price, ${permits[0].hour} a full field, an hour, and kept at that price from now on. Time already billed keeps its price.`
    : `Time on ${joinWithAnd(permits.map(x => `${x.name} (${x.hour} a full field, an hour)`))} is billed at each permit’s own price, and kept at those prices from now on. Time already billed keeps its price.`,
  billedCorrection: (money: string) => `a correction of ${money}`,
  handedBackLine: (team: string, lines: string) => `${team} handed back ${lines} itself, so it isn’t emailed.`,
  previewFailed2: 'The preview didn’t load.',
  tryAgain: 'Try again',
  sentNotice: (people: number, teams: number, failed: number) =>
    `Sent to ${pluralize(people, 'person', 'people')} on ${pluralize(teams, 'team')}.${failed ? ` ${failed} couldn’t be delivered.` : ''}`,
  sentNoticeGamesOnly: 'Sent. The league admins are told.',
  sentClash: (n: number) => `${pluralize(n, 'practice')} clash${n === 1 ? 'es' : ''} with another booking: the club calendar flags ${n === 1 ? 'it' : 'them'}.`,
  // Replies, Changed since sent
  inReviewHead: (replied: number, teams: number) => `In review · ${replied} of ${pluralize(teams, 'team')} replied`,
  looksGoodCount: (n: number) => `${n} said it looks good`,
  askedFor: (team: string, words: string) => `${team} asked for a change: “${words}”`,
  notReplied: (teams: string, many: boolean, replyBy: string | null) => `${teams} ${many ? 'haven’t' : 'hasn’t'} replied${replyBy ? ` (reply by ${replyBy})` : ''}`,
  changesHead: (n: number, day: string) => `${pluralize(n, 'change')} since you sent it on ${day}`,
  /** The closed list's door, as it read before the groups (owner 2026-11-17: the list starts closed). */
  allChanges: (n: number) => `All ${pluralize(n, 'change')}`,
  /** A run of changes opens to its dates (owner 2026-11-17). */
  showDates: 'Show dates',
  /** Above a move run's dates: they are the dates it moves from. */
  movedDates: 'The dates they move from',
  hideDates: 'Hide dates',
  /** More than three teams changed: the rest fold, as the hand-back asks do (ask 3). */
  moreTeams: (n: number) => `Show ${pluralize(n, 'more team', 'more teams')}`,
  fewerTeams: 'Show fewer teams',
  changesTail: 'The teams still have what you sent them. Send the changes to put these on their schedules and tell their coaches.',
  changesNone: 'The changes since the last send put things back as they were: nothing waits to be sent.',
  changeTeamLine: (team: string, line: string) => `${team} · ${line}`,
  // The send log
  sendLogTitle: 'Send log',
  sendLogEmpty: 'Nothing has been sent yet.',
  sendLogSub: (when: string, by: string | null, teams: string) => `${when}${by ? ` by ${by}` : ''}${teams ? ` · ${teams}` : ''}`,
  // A phone reads one day at a time (owner, 2026-10-12, §300): only the dates the schedule has slots on. The tournament's
  // Day words, one spelling (lib/schedule-words.ts).
  phoneDay: 'Day',
  phoneDayLabel: (day: string, today: string) => (day === today ? `Today · ${formatShortWeekdayDate(day)}` : formatShortWeekdayDate(day)),
  phoneDayCaption: (slots: number, open: number) => `${pluralize(slots, 'slot')}${open ? ` · ${open} open` : ''}`,
  previousDay: 'Previous day',
  nextDay: 'Next day',
  chooseDay: 'Choose a day',
} as const;

/** [marketing] The coach's side (specimens 11, 14): the review card and its window, Hand back, the Budget's callout. */
export const SCHEDULE_COACH_WORDS = {
  sourceLead: 'From',
  sourceTail: '· the club’s schedule',
  handedBack: 'Handed back',
  formFromClub: 'The club’s schedule',
  formFromClubHint: (schedule: string) => `Time and place come from ${schedule}. Only the club can move or remove this practice.`,
  formYourPlan: 'Your practice plan',
  // The proposals' rows in the Overview's tail (owner 2026-11-14, Overview drawings A1–A6): one row per proposal under
  // a label that counts what still needs a reply. Never "From the club" (Money says that of money the club pays).
  proposalsLabel: (n: number) => (n === 1 ? 'The club’s proposal' : 'The club’s proposals'),
  proposalsWaiting: (waiting: number, total: number) =>
    waiting === 0 ? 'Answered · waiting for the club' : total === 1 ? 'Waiting on your reply' : `${waiting} waiting on your reply`,
  proposalHolds: (slots: string, bill: string | null) => (bill ? `${slots} · ${bill} bill` : slots),
  proposalReplyBy: (day: string) => `Reply by ${day}`,
  proposalReplyLate: (day: string) => `Your reply was due ${day}`,
  proposalAnswered: (answer: 'looks_good' | 'ask_for_change') => (answer === 'looks_good' ? 'You said it looks good' : 'You asked for a change'),
  reviewEyebrow: 'Club proposal',
  reviewFrom: 'The club’s proposal',
  replyByWords: (day: string) => `reply by ${day}`,
  yourTime: 'Your time',
  yourBill: 'Your bill',
  yourShare: 'Your share',
  byTheTime: 'By the time you got',
  /** Several permits (Session C): with more than one price behind the time, which way the club priced it (drawing, coach note 2). */
  byTheTimePriced: (mode: PriceMode) => (mode === 'one_rate' ? 'By the time you got, at one rate for every team' : 'By the time you got, at each permit’s price'),
  payments: 'Payments',
  paymentCovers: (slots: number, days: number, months: string, oneWeekday: number | null) => `Your ${slotCountWords(slots, days, oneWeekday)} in ${months}`,
  nothingYet: 'Nothing is on your schedule or your Money › Club tab until the club finalizes it.',
  nothingYetNoBill: 'Nothing is on your schedule until the club finalizes it.',
  askForChange: 'Ask for a change',
  looksGood: 'Looks good',
  askWhat: 'What would you like changed?',
  askPlaceholder: 'Could we have 9:30 a.m. instead of 8:00 a.m.?',
  askSend: 'Send to the club',
  thanksGood: 'Sent: the club sees that it looks good.',
  thanksAsked: 'Sent: the club sees what you asked for.',
  replyFailed: 'Your answer couldn’t be sent. Check your connection and try again.',
  handBackAll: (range: string, n: number) => `${range} · ${pluralize(n, 'practice')}`,
  keepIt: 'Keep it',
  handBack: 'Hand back',
  handingBack: 'Handing back…',
  handedBackNotice: (n: number) => `${pluralize(n, 'practice')} handed back. The club can give the time to another team.`,
  handBackFailed: 'That couldn’t be handed back just now. Please try again.',
  /** The series question's one loading line (Hand back, Take it back — the 2026-10-12 "one loading line" ruling). */
  loadingPractices: 'Loading the practices…',
  budgetCallTitle: (team: string, money: string, word: string) => `The club billed ${team} ${money} for ${word}`,
  budgetCallBody: (plan: string) => `Your plan says ${plan} for it. Use the club’s figure, or keep your own if you rent more time yourself.`,
  budgetUse: (money: string) => `Use ${money}`,
  budgetKeep: 'Keep mine',
  budgetLineBill: (schedule: string, money: string, payments: string) => `The club’s bill: ${schedule} · ${money} in ${payments}`,
  budgetCellBill: (money: string) => `the club’s bill ${money}`,
  budgetWas: (money: string) => `was your ${money}`,
} as const;

// ── Time added as its own part (Phase 8, Session 1 — drawing tab 4; every line to /marketing at the Close) ───────────────

/** [marketing] An added part of a final schedule (plan Phase 8): its line under the page's meta line, the Part filter, the
 *  slot window's Part row, Needs attention's unbilled note, and the refusals that keep a practice on its own part's bill. */
export const PART_WORDS = {
  /** The line under the page's first line, after the part's name and its permits' doors: "Thu, Dec 10 · 14U AA · not sent yet". */
  metaRest: (dates: string, teams: string, sentOn: string | null) => `${dates} · ${teams} · ${sentOn ? `sent ${sentOn}` : 'not sent yet'}`,
  /** Three added parts read as one door that opens the Part filter: "Time added Nov 16 and 2 more ›". */
  metaMore: (label: string, more: number) => `${label} and ${more} more`,
  /** The part's teams on its line: "14U AA", "14U AA and 15U AA", "4 teams". */
  metaTeams: (names: readonly string[]) => (names.length === 0 ? 'no teams yet' : names.length <= 2 ? joinWithAnd([...names]) : `${names.length} teams`),
  partPill: 'Part',
  everyPart: 'Every part',
  slotPart: 'Part',
  /** Needs attention's change row, for a part with no bill yet (drawing tab 4, note 2). */
  notBilledYet: (label: string) => `${label} isn’t billed yet. You can bill it when you send the changes.`,
  /** A drop onto another part's practice: it would cross bills. */
  moveAcrossParts: 'That practice is on another part’s bill, so a team can’t move there. Give it from that part’s own practices.',
  /** Give it to a team that isn't in the part (the server's refusal; the window lists only the part's teams). */
  teamNotInPart: (label: string) => `Only the teams in ${label} can be given its time.`,
  /** The rest of the family holds that team then (a part's practice, or the schedule it was added to). */
  teamTwiceInFamily: (team: string, where: string) => `${team} already has a practice then, in ${where}.`,

  // ── Add time makes a part (Session 2 — drawing tabs 2 and 3; owner rulings 1, 2, 6, 7) ──
  /** The part's name: the date it was added (ruling 1). "… (2)" is added by `partLabelFor` for a second the same day. */
  label: (day: string) => `Time added ${day}`,
  /** Settings… on a draft or in review: the Permits picker's hint (drawing tab 2, note 2). */
  settingsPermitsHint: 'Each permit brings its own time and dates off. Untick one to take its time off again.',
  /** Add time's Permits hint (tab 3, note 1): every permit is offered. */
  permitsHint: 'Any permit the club holds. One already on this schedule brings only the time the schedule doesn’t use.',
  /** The read-only field where New schedule's Name sits (tab 3, note 2). */
  shownAs: 'Shown on the schedule as',
  shownAsHint: (parent: string) => `A part of ${parent}, with its own teams and bill`,
  /** A permit already on the schedule: its card says the time the schedule uses, which the new part leaves out (ruling 7). */
  permitUsed: (parent: string, uses: string, until: string) => `${parent} already uses ${uses}, to ${until}. That time is left out.`,
  /** Under From: why it starts where it does. */
  fromToday: (parent: string) => `Not before today: ${parent} has been sent.`,
  fromAfterUse: (parent: string) => `Starts the day after ${possessive(parent)} time on this permit ends.`,
  /** Under To: the permit's own run, or how far the schedule now reaches on its page. */
  toPermit: (permit: string, dates: string) => `${permit} runs ${dates}.`,
  toWidens: (parent: string, until: string) => `${parent} now runs to ${until}.`,
  /** Dates off (tab 3, note 4). */
  datesOffOwn: 'Dates off here are this time’s only.',
  /** The team table (tab 3, note 5). */
  teamNotOnParent: (parent: string) => `Not on ${parent} yet`,
  teamsHint: 'Starts with nobody ticked. The teams you tick share only this time.',
  /** The promise, said where it is made (tab 3, note 6). */
  promiseLead: (parent: string) => `This time is its own part of ${parent}. Nothing already on the schedule moves.`,
  promiseRest: 'Its practices stay on this time and with these teams, even when you regenerate. They wait in Changed since sent until you send the changes, and you choose then how to bill them, on a bill of their own.',
  /** Kept: the page's notice. */
  kept: (label: string) => `${label} is on the schedule. The coaches aren’t told until you send the changes.`,
  /** Refusals, said before the database's own. */
  fromBeforeToday: (parent: string) => `The new time can’t start before today: ${parent} has been sent.`,
  addToDraft: 'Time is added to a final schedule. On a draft, use Settings… to change its time.',
  addToPart: 'Add time to the schedule itself, not to a part of it.',
  wholeToHouseLeague: 'Added time goes to the teams you tick. Give a whole permit to house league from New schedule.',

  // ── Time added as its own part: sending it and its bill (Session 3 — drawing tabs 4 and 5; owner rulings 4 and 5) ──
  /** Send the changes: the bill line's heading, per unsent part (tab 5, note 2). */
  billLineHead: (label: string) => `${label} · its bill`,
  notBilled: 'Not billed',
  /** A reader without the club's Accounting: a bill is set on the part; its figure is for people with Accounting only. ("Bill set", not "Billed": nothing has gone to the teams until the send.) */
  billedNoFigure: 'Bill set',
  /** "1.5 hours of Halton Hills evenings for 14U AA". */
  billLineTime: (hours: string, permits: readonly string[], teams: readonly string[]) =>
    `${hours} of ${permits.length ? joinWithAnd([...permits]) : 'the time'} for ${PART_WORDS.metaTeams(teams)}`,
  /** "$135.00 · 14U AA · one payment, due Dec 1". */
  billLineSet: (total: string, teams: readonly string[], payments: number, firstDue: string | null) =>
    `${total} · ${PART_WORDS.metaTeams(teams)} · ${payments === 1 ? `one payment${firstDue ? `, due ${firstDue}` : ''}` : `${payments} payments${firstDue ? `, the first due ${firstDue}` : ''}`}`,
  billIt: 'Bill it…',
  billChange: 'Change…',
  /** Tab 5, note 3: the corrections switch is the schedule's own time's. */
  correctionsOnlyOwn: (parent: string) => `“Bill the corrections” appears only when a change touches ${possessive(parent)} own time.`,
  /** Bill the teams, for an added part (tab 5): the statement. */
  billPartLead: (label: string) => `A bill of its own, for ${label}.`,
  billPartRest: (name: string, parent: string) =>
    `It goes to the team when you send the changes and arrives on its Money › Club tab as “${name}”. ${possessive(parent)} bill and its payments stay as they are.`,
  /** The coach's email: each part's bill, listed under the changes, and why it is separate (/legal light check). */
  emailBillTitle: (name: string, phrase: string) => `A separate bill, ${name}: ${phrase}.`,
  emailBillsOutro: (bills: number) => (bills === 1
    ? 'The added time is billed on its own, so it is a separate charge on your Money › Club tab. Nothing already billed changes.'
    : 'Each part of the added time is billed on its own, as separate charges on your Money › Club tab. Nothing already billed changes.'),
  /** Needs attention: a part sent without a bill (the shipped final-not-billed path offers Review the bill). */
  sentNotBilled: (label: string) => `${label} was sent without a bill. You can bill the teams whenever you’re ready; its practices stay as they are.`,
  sentNotBilledChip: 'Not billed',
  /** The row's second button (owner 2026-11-17, walk §538 call C2): the club sent this part free on purpose. */
  sentFree: 'It’s free',
  sentFreeSaid: (label: string) => `Noted: ${label} stays free. To bill it later, use Tools › Bill ${label}…`,
  /** Tools, for a part marked free (the review's undo): the way back to billing it. */
  toolBillFree: (label: string) => `Bill ${label}…`,
  toolBillFreeHint: 'You sent it free. Bill it now if that changes.',
  /** Send the changes, for a reader without the club's Accounting, under a part whose bill is set (owner 2026-11-17, walk §538 call C4). */
  billNeedsAccounting: 'Someone with the club’s Accounting sends this one.',
  /** Regenerate and Settings… on a schedule with parts ask which part first (tab 4, ruling 4). */
  whichRegenTitle: 'Regenerate which part?',
  whichSettingsTitle: 'Settings for which part?',
  whichPart: 'Part',
  whichRegenHint: (chosen: string, others: readonly string[]) =>
    `Each part keeps its own time and teams. The draft you pick replaces ${possessive(chosen)} slots from today on, except the ones someone placed by hand. ${joinWithAnd([...others])} ${others.length === 1 ? 'stays' : 'stay'} exactly as ${others.length === 1 ? 'it is' : 'they are'}.`,
  whichSettingsHint: (label: string, summary: string) => `${label}: ${summary}.`,
  whichBack: 'Go back',
  whichRegenGo: 'Choose a draft',
  whichSettingsGo: 'Open its settings',
  /** Taking an added part's only permit off removes the part (tab 4, Settings… note). */
  takeOffPartTitle: (label: string) => `Take “${label}” off?`,
  takeOffPartDraft: (practices: number) => `Its ${pluralize(practices, 'practice')} go. Nobody has been told about them, and nothing else on the schedule moves.`,
  takeOffPartLeaves: (label: string) => `After you send the changes, “${label}” leaves the schedule. Its bill and what was sent stay on record.`,
  partTakenOff: (label: string) => `${label} is off the schedule.`,
  /** A family send that is refused part-way: said after "Sent to …", with the refusal in the middle (it tells only what landed). */
  sentPartWay: (refusal: string) => `Only part of it went out. ${refusal} The rest is still waiting to be sent.`,
} as const;
