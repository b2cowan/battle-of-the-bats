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
import { formatTime, formatTimeRange, joinWithAnd, pluralize } from './utils';
import { formatShortWeekdayDate, formatStoredDate, formatWeekRange } from './timezone';
import { fmt } from './coach-money-summary';
import { weekdayCount, weekdayPlural } from './permit-words';
import type { DraftMeasure, DraftStrategy, ShareWarning, SlotPattern } from './club-schedule-engine';
import type { ClosingRow, Installment } from './club-schedule-bill';
import { HAND_BACK_WORDS, type CreditMove } from './club-hand-back-words';

/** Cents said as money — the schedule's one spelling, on every screen and in every email. */
export const moneyCents = (cents: number) => fmt(cents / 100);

/** A sentence's first letter, capitalised. */
const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** [marketing] The words a screen and a reply read. */
export const SCHEDULE_WORDS = {
  draft: 'Draft',
  inReview: 'In review',
  changedSinceSent: 'Changed since sent',
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
  reviewStatement: (replyBy: string | null) =>
    `Each team’s coaches see their slots and their bill${replyBy ? `, and reply by ${formatShortWeekdayDate(replyBy)}` : ''}. Nothing is booked or billed yet. You finalize when you’re ready, whether or not every team has replied.`,
  changesStatement: (changedTeams: number, handedBack: string[]) =>
    `The changes reach ${pluralize(changedTeams, 'team')}’ schedules. Only those teams’ coaches are told${handedBack.length ? `; ${joinWithAnd(handedBack)} handed ${handedBack.length === 1 ? 'its slot' : 'their slots'} back ${handedBack.length === 1 ? 'itself' : 'themselves'}` : ''}. Nothing else on the schedule moves.`,
} as const;

/** [marketing] Why a send can't go, or a write was refused — one sentence each, the routes' `error`. */
export const SCHEDULE_REFUSALS = {
  plan: 'The club scheduler is part of League Plus and Club.',
  who: 'Only the club’s owner or an admin builds schedules.',
  nothingToSchedule: 'There are no rep teams with a season running to hand time to yet.',
  notFound: 'That schedule isn’t here any more. Reload the page.',
  changed: 'This schedule changed since you opened it. Reload it to see the change, then try again.',
  alreadyFinal: 'This schedule is already final. Its changes go with Send the changes.',
  notFinal: 'This schedule hasn’t been finalized yet, so there are no changes to send.',
  justSent: 'This schedule was just sent. Give it a minute before sending again.',
  finalDelete: 'A final schedule has practices on teams’ schedules and a bill, so it can’t be deleted.',
  noTime: 'Give the schedule its time first: a venue, its facilities, the days and the hours.',
  tooManySlots: (max: number) => `That is more than ${max.toLocaleString('en-CA')} slots. Shorten the dates or lengthen the slots.`,
  overlappingBlocks: 'Two rows of hours overlap on one facility. Each facility’s hour is handed out once.',
  teamTwice: (team: string) => `${team} would be in two slots at once.`,
  slotFull: (n: number) => `A slot holds ${pluralize(n, 'team')} at once.`,
  seasonClosed: (team: string) => `${team} has no season running, so it can’t be booked or billed. Start its winter season first, or untick it.`,
  billMoney: 'Only the people who hold the club’s Accounting can add a bill to a schedule.',
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
  billFinal: 'The bill went out at Finalize, and a bill’s terms never change. A change to the time is billed at Send the changes.',
  replyWords: 'Say what you’d like changed.',
  notInReview: 'This schedule isn’t waiting for a reply.',
  handBackNothing: 'Those practices aren’t the club’s, or they were already handed back.',
  /** Stage 11d: a practice already in an ask waiting for the club. */
  handBackAsked: 'This practice is in an ask waiting for the club. Withdraw the ask first.',
} as const;

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
  return `Leaves out the ${slots} ${list[0].name}’s ${what} holds`;
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
function weeklyDays(first: string, last: string): string[] {
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
 *  frees time the club has paid for — "$5,400.00 less than the permit’s $27,000.00: the 50 open slots. The club covers
 *  the rest."). */
export function closingRowLine(c: ClosingRow, openSlots = 0): string {
  if (c.kind === 'matches') return `Matches the permit’s ${moneyCents(c.permitCents)}: nothing left for the club to cover.`;
  if (c.kind === 'club_covers') {
    const open = openSlots > 0 ? ` the ${openSlots === 1 ? '1 open slot' : `${openSlots} open slots`}. The club covers the rest.` : ' the club covers the rest.';
    return `${moneyCents(c.differenceCents)} less than the permit’s ${moneyCents(c.permitCents)}:${open}`;
  }
  if (c.kind === 'more_than_permit') return `${moneyCents(c.differenceCents)} more than the permit’s ${moneyCents(c.permitCents)}.`;
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
} as const;
export type ScheduleUnreachableWhy = keyof typeof SCHEDULE_UNREACHABLE;

/** [marketing] specimen 9: "12U AA has a head coach invitation nobody has accepted yet. Its 36 slots go on its schedule; …" */
export function unreachableSentence(team: string, why: ScheduleUnreachableWhy, slots: number, kind: 'review' | 'final' | 'changes'): string {
  const what = kind === 'review'
    ? `Its ${pluralize(slots, 'slot')} wait for Finalize; nobody is emailed about them.`
    : kind === 'final'
      ? `Its ${pluralize(slots, 'slot')} go on its schedule; nobody is emailed about them.`
      : 'Its changes go on its schedule; nobody is emailed about them.';
  return `${team} ${SCHEDULE_UNREACHABLE[why]}. ${what} Name or chase its coach from its Coaches page.`;
}

// ── The emails (colleague mail, Ask 7) ───────────────────────────────────────────────────────────

export interface EmailWords {
  subject: string;
  greeting: string;
  paragraphs: string[];
  /** Bulleted lists, each with an optional heading line. */
  lists: { title: string | null; items: string[] }[];
  link: { label: string; path: string } | null;
  outro: string | null;
}

const firstNames = (names: readonly (string | null)[]) => {
  const firsts = names.map(n => (n ?? '').trim().split(/\s+/)[0]).filter(Boolean);
  return firsts.length ? `Hi ${joinWithAnd(firsts)},` : 'Hi,';
};

/** [marketing] What a team's coaches receive when the schedule is sent for review or final (specimens 9 and 14). */
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
    lists.push({ title: `The bill: ${billPhrase(p.bill.cents, p.bill.installments.length)}, for the time you got.`, items: p.bill.installments.map(paymentLine) });
  }
  if (p.kind === 'review') {
    return {
      subject: `${p.scheduleName}: ${p.teamName}’s ${p.bill ? 'slots and bill' : 'slots'}, for review`,
      greeting: firstNames(p.recipientNames),
      paragraphs: [`${p.orgName} proposes ${pluralize(p.slotCount, 'slot')} for ${p.teamName} at ${p.venueName}, ${range}:`],
      lists,
      link: { label: `Review it on ${p.teamName}’s Overview →`, path: p.link },
      outro: `Nothing is on your schedule${p.bill ? ' or your Club tab' : ''} until the club finalizes it.${p.replyBy ? ` Reply by ${formatShortWeekdayDate(p.replyBy)}: Looks good, or Ask for a change.` : ' Reply Looks good, or Ask for a change.'}`,
    };
  }
  return {
    subject: `${p.scheduleName}: ${p.teamName}’s slots`,
    greeting: firstNames(p.recipientNames),
    paragraphs: [
      `${p.orgName} has given ${p.teamName} ${pluralize(p.slotCount, 'slot')} at ${p.venueName}, ${range}:`,
    ],
    lists,
    link: { label: `Open ${p.teamName}’s schedule →`, path: p.link },
    outro: `They’re on ${p.teamName}’s schedule now. Your families see them there.${p.bill ? ' The bill is on your Money › Club tab.' : ''} If you won’t use a slot, hand it back from the practice on your schedule, and the club can give it to another team.`,
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

/** [marketing] What a team's coaches receive when the changes are sent (specimen 10), and the money it settles. */
export function changesEmail(p: {
  orgName: string; scheduleName: string; teamName: string; recipientNames: readonly (string | null)[];
  lines: string[]; billedCents: number | null;
  /** Stage 11d, Ask 8: time the club moved off the team — taken off what it owes, the rest owed back (never "ask for it"). */
  lost: { creditCents: number; payCents: number; moves: readonly CreditMove[] } | null;
  link: string;
}): EmailWords {
  const money2: string[] = [];
  if (p.billedCents) money2.push(`The time ${p.teamName} gained is billed: a correction of ${moneyCents(p.billedCents)} is on your Money › Club tab.`);
  if (p.lost && (p.lost.creditCents || p.lost.payCents)) money2.push(HAND_BACK_WORDS.lostEmail({ teamName: p.teamName, ...p.lost }));
  return {
    subject: `${p.scheduleName}: ${p.teamName}’s slots changed`,
    greeting: firstNames(p.recipientNames),
    paragraphs: [`${p.orgName} changed ${p.teamName}’s slots on ${p.scheduleName}:`],
    lists: [{ title: null, items: p.lines }],
    link: { label: `Open ${p.teamName}’s schedule →`, path: p.link },
    outro: [...money2, 'Everything else stays as it was.'].join(' '),
  };
}

// ── The notices ("Your club" for a coach; the builders') ─────────────────────────────────────────

/** [marketing] Each notice's title and body. */
export const SCHEDULE_NOTICES = {
  review: (p: { orgName: string; scheduleName: string; teamName: string; slots: number; billCents: number | null; replyBy: string | null }) => ({
    title: `${p.orgName} sent ${p.scheduleName} for review`,
    body: `${p.teamName} · ${pluralize(p.slots, 'slot')}${p.billCents ? ` and a ${moneyCents(p.billCents)} bill` : ''}.${p.replyBy ? ` Reply by ${formatShortWeekdayDate(p.replyBy)}.` : ''}`,
  }),
  final: (p: { scheduleName: string; teamName: string; slots: number }) => ({
    title: `${p.scheduleName} is on ${p.teamName}’s schedule`,
    body: `${pluralize(p.slots, 'practice')} from the club’s schedule.`,
  }),
  changes: (p: { scheduleName: string; teamName: string; changes: number }) => ({
    title: `${p.scheduleName} changed for ${p.teamName}`,
    body: `${pluralize(p.changes, 'change')} on ${p.teamName}’s schedule.`,
  }),
  bill: (p: { orgName: string; teamName: string; cents: number; scheduleName: string; first: Installment | null; payments: number }) => ({
    title: `${p.orgName} billed ${p.teamName} ${moneyCents(p.cents)}`,
    body: `For ${p.scheduleName} · ${pluralize(p.payments, 'payment')}${p.first ? `, the first ${fmt(p.first.amount)} due ${formatStoredDate(p.first.dueDate, { withYear: false })}` : ''}.`,
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
    body: `${p.scheduleName} · from ${formatShortWeekdayDate(p.first)}. The time is ${p.teamName}’s again.`,
  }),
} as const;

/** [marketing] The send log's row (specimen 9): "Changes · 2 teams, 4 people". A schedule tells the club's coaches only —
 *  never the venue (owner 2026-10-12, walk §300 W7: "this is between clubs and their coaches"). */
export function sendLogLine(p: { kind: 'review' | 'final' | 'changes'; teams: number; people: number }): string {
  const what = p.kind === 'review' ? 'For review' : p.kind === 'final' ? 'The whole schedule' : 'Changes';
  return `${what} · ${pluralize(p.teams, 'team')}, ${pluralize(p.people, 'person', 'people')}`;
}

// ── The screens (part B — hub specimens 4–15) ────────────────────────────────────────────────────

/** [marketing] "25 Sundays" on a one-weekday schedule — its DAYS, since a team can hold two slots a Sunday — else "36 slots". */
export const slotCountWords = (slots: number, days: number, oneWeekday: number | null) =>
  (oneWeekday ? weekdayCount(days, oneWeekday) : pluralize(slots, 'slot'));

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
  filledIn: (words: string) => `Filled in: ${words}`,
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
  minutes: (n: number) => `${n} min`,
  split: 'Split the time',
  splitEven: 'Evenly',
  splitPercent: 'By percentage',
  splitWeekly: 'A set number a week',
  // Each team's time (Stage 11c Ask 4): one dropdown beside Split the time, its sentence under it.
  timeMode: 'Each team’s time',
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
  teamsCount: (n: number) => pluralize(n, 'team'),
  aWeek: (n: number) => `${n} a week`,
  everyWeek: 'The shares hold every week, so no group takes its time early.',
  noSeason: (n: number) => `${pluralize(n, 'team')} ${n === 1 ? 'has' : 'have'} no season running`,
  tick: (team: string) => `Give ${team} time`,
  tickGroup: (group: string) => `Give every team in ${group} time`,
  groupFigure: (group: string, what: string) => `${group}’s ${what}`,
  rulesOn: (n: number) => `${n} on`,
  // Rules as sentences (Stage 11c Ask 6): only the rules the club added, each its sentence and a pencil; one Add a rule
  // menu for every kind; the three safeguards under Always.
  addRule: 'Add a rule',
  ruleKinds: {
    windows: { title: 'Start and finish times', line: 'Teams that start after, or finish by, a time' },
    daysOff: { title: 'A team’s day off', line: 'A date, or a day every week' },
    fieldsBy: { title: 'Facilities for a group', line: 'Facilities kept for some teams' },
    sharing: { title: 'Sharing a facility', line: 'Teams that share a facility, 2 or more at once' },
    caps: { title: 'At most, a day or a week', line: 'A cap on any one team’s slots' },
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
  maxDay: 'At most, a day',
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
  capDay: (n: number) => `At most ${n} a day`,
  capWeek: (n: number) => `At most ${n} a week`,
  capBoth: (day: number, week: number) => `At most ${day} a day and ${week} a week`,
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
  regenLead: 'The new settings make a new draft of the slots nobody has placed.',
  regenKept: (locked: number, moved: number) => {
    const parts = [locked ? `the ${pluralize(locked, 'slot')} you locked` : '', moved ? `the ${moved} you moved by hand` : ''].filter(Boolean);
    if (!parts.length) return '';
    const said = parts.join(' and ');
    return `${capFirst(said)} stay where they are.`;
  },
  regenNotSent: 'It hasn’t been sent, so no team is told.',
  regenSent: 'It has been sent: the change waits on its page until you send the changes.',
  regenKeep: 'Keep it',
  regenGo: 'Regenerate',
  notKept: (n: number) => `${pluralize(n, 'slot')} locked or moved by hand ${n === 1 ? 'isn’t' : 'aren’t'} in the new time, so ${n === 1 ? 'it goes' : 'they go'}.`,

  // The schedule's page (specimens 6–10, 14)
  back: 'Schedules',
  meta: (where: string, dates: string, teams: number) => `${where} · ${dates} · ${pluralize(teams, 'team')}`,
  metaSent: (where: string, dates: string, day: string, by: string | null) => `${where} · ${dates} · sent ${day}${by ? ` by ${by}` : ''}`,
  metaReview: (where: string, dates: string, day: string, by: string | null) => `${where} · ${dates} · sent for review ${day}${by ? ` by ${by}` : ''}`,
  viewGrid: 'Grid',
  viewTeam: 'By team',
  viewGroup: 'By group',
  facilityPill: 'Facility',
  teamPill: 'Team',
  everyFacility: 'Every facility',
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
  whichWeeks: (team: string, from: string, to: string) => `Move ${team}’s ${from} slot to ${to}:`,
  swapWeeks: (team: string, from: string, other: string) => `Swap ${team}’s ${from} slot with ${other}’s:`,
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
  changeTeam: 'Change team',
  nobody: 'Nobody (open)',
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
  teamSlotsTitle: (team: string) => `${team}’s slots`,
  // The bill (specimen 14 step 4)
  billTitle: 'Bill the teams',
  billFrom: 'Bill from',
  billFromHint: (planned: string, left: string) => `The permit’s budget line · ${planned} planned, ${left} left`,
  billFromOther: (planned: string, left: string) => `${planned} planned, ${left} left`,
  billNoLine: 'No budget line (off-plan)',
  billFor: 'Bill the teams for',
  billWhole: (amount: string) => `The time at the permit’s price · ${amount}`,
  billWholeTime: 'The time at the permit’s price',
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
  billFirstDue: 'From',
  billPaymentsHint: {
    one: 'One payment for all of the time',
    monthly: 'Each payment is the time that team gets in its month',
    two_months: 'Each payment is the time that team gets in its two months',
    dates: 'Each payment is the time that team gets up to the next date',
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
  staffNote: 'Head coach and staff with schedule access',
  teamSlots: (slots: number, days: number, oneWeekday: number | null) => slotCountWords(slots, days, oneWeekday),
  nobodyHead: (n: number) => `Nobody to send to · ${pluralize(n, 'team')}`,
  emailHint: 'Each team’s coaches get one email listing that team’s slots; a reply comes to you.',
  reviewHint: 'Each team’s coaches get one email with their slots and their bill; a reply comes to you.',
  changesHint: 'Each team’s coaches get one email listing what changed for that team; a reply comes to you.',
  lastSent: (day: string, by: string | null) => `Last sent ${day}${by ? ` by ${by}` : ''}.`,
  notSentYet: 'Not sent yet.',
  seeEmail: (who: string) => `See ${who}’s email`,
  sendTo: (n: number) => `Send to ${n}`,
  sendToCoaches: (n: number) => `Send to ${pluralize(n, 'coach', 'coaches')}`,
  sendToPeople: (n: number) => `Send to ${pluralize(n, 'person', 'people')}`,
  finalizeGo: (n: number) => `Finalize and send to ${n}`,
  sending: 'Sending…',
  billCorrections: 'Bill the corrections',
  // Stage 11d, Ask 8: one switch for both halves — a gain billed, a loss taken off what the team owes ("is owed $X back:
  // its coach asks for it" retired with build question B's owed-back).
  billCorrectionsOn: HAND_BACK_WORDS.billCorrectionsOn,
  billCorrectionsOff: HAND_BACK_WORDS.billCorrectionsOff,
  billedCorrection: (money: string) => `a correction of ${money}`,
  handedBackLine: (team: string, lines: string) => `${team} handed back ${lines} itself, so it isn’t emailed.`,
  previewFailed2: 'The preview didn’t load.',
  tryAgain: 'Try again',
  sentNotice: (people: number, teams: number, failed: number) =>
    `Sent to ${pluralize(people, 'person', 'people')} on ${pluralize(teams, 'team')}.${failed ? ` ${failed} couldn’t be delivered.` : ''}`,
  sentClash: (n: number) => `${pluralize(n, 'practice')} clash${n === 1 ? 'es' : ''} with another booking: the club calendar flags ${n === 1 ? 'it' : 'them'}.`,
  // Replies, Changed since sent
  inReviewHead: (replied: number, teams: number) => `In review · ${replied} of ${pluralize(teams, 'team')} replied`,
  looksGoodCount: (n: number) => `${n} said it looks good`,
  askedFor: (team: string, words: string) => `${team} asked for a change: “${words}”`,
  notReplied: (teams: string, many: boolean, replyBy: string | null) => `${teams} ${many ? 'haven’t' : 'hasn’t'} replied${replyBy ? ` (reply by ${replyBy})` : ''}`,
  changesHead: (n: number, day: string) => `${pluralize(n, 'change')} since you sent it on ${day}`,
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
  reviewCardTitle: (team: string) => `The club has a proposal for ${team}`,
  reviewCardBody: (schedule: string, slots: string, bill: string | null, replyBy: string | null) =>
    `${schedule}: ${slots}${bill ? ` and a ${bill} bill` : ''}.${replyBy ? ` Reply by ${replyBy}.` : ''}`,
  reviewCardAnswered: (answer: 'looks_good' | 'ask_for_change') => (answer === 'looks_good' ? 'You said it looks good.' : 'You asked for a change.'),
  reviewIt: 'Review it',
  changeAnswer: 'Change your answer',
  reviewEyebrow: 'Club proposal',
  reviewFrom: 'The club’s proposal',
  replyByWords: (day: string) => `reply by ${day}`,
  yourTime: 'Your time',
  yourBill: 'Your bill',
  yourShare: 'Your share',
  byTheTime: 'By the time you got',
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
