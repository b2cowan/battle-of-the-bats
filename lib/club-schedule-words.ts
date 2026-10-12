/**
 * club-schedule-words.ts — every sentence the club scheduler says, in one place (Club Tier Stage 11a; hub
 * K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stages 10 + 11, specimens 4–15). The drafts' measures, the refusals, a coach's club
 * practice, the emails (a coach's, the bookings contact's), the notices and the send log all speak through here, so one
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
import { weekdayPlural } from './permit-words';
import type { DraftMeasure, DraftStrategy, ShareWarning, SlotPattern } from './club-schedule-engine';
import type { ClosingRow, Installment } from './club-schedule-bill';

const money = (cents: number) => fmt(cents / 100);

/** [marketing] The words a screen and a reply read. */
export const SCHEDULE_WORDS = {
  draft: 'Draft',
  inReview: 'In review',
  changedSinceSent: 'Changed since sent',
  strategy: { best: 'Best overall', rotate: 'Prime time rotated', youngest: 'Youngest earliest', mix: 'Another mix' } satisfies Record<DraftStrategy, string>,
  /** The coach's practice (Ask 16): the mirror's construction. */
  sourceLine: (schedule: string) => `From ${schedule} · the club’s schedule`,
  onlyTheClub: 'Only the club can move or remove this practice.',
  handBackDoor: 'Hand back this practice',
  handBackQuestion: 'Hand back which practices?',
  handBackWhat: 'The club can give the time to another team. Your families stop seeing it.',
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
} as const;

// ── A draft's measures (specimen 5) ──────────────────────────────────────────────────────────────

/** [marketing] A draft card's lines, in the order the drawing reads them. `nameOf` names a team. */
export function measureLines(measures: readonly DraftMeasure[], nameOf: (teamId: string) => string): string[] {
  const out: string[] = [];
  for (const m of measures) {
    if (m.kind === 'shares') {
      if (m.short.length) {
        out.push(m.short.length === 1
          ? `${nameOf(m.short[0].teamId)} is ${m.short[0].short} short of its share`
          : `${pluralize(m.short.length, 'team')} short: ${joinWithAnd(m.short.map(s => `${nameOf(s.teamId)} by ${s.short}`))}`);
      } else out.push(m.sameCount != null ? `Every team gets ${pluralize(m.sameCount, 'slot')}` : 'Every team gets its share');
    } else if (m.kind === 'prime') {
      const range = m.min === m.max ? `${m.min}` : `${m.min}–${m.max}`;
      if (m.lowTeamId && m.max - m.min > 1) out.push(`Prime time ${range}: ${nameOf(m.lowTeamId)} gets ${m.min}`);
      else out.push(`Prime time ${range} each${m.rotated ? ', rotated weekly' : ''}`);
    } else if (m.kind === 'nights') {
      out.push(m.same ? 'Each team on the same nights every week' : 'Nights change week to week');
    } else if (m.kind === 'held') {
      out.push(heldLine(m.count, m.owners.length === 1 ? [{ name: m.owners[0], kind: m.what }] : m.owners));
    } else if (m.kind === 'youngest') {
      const names = m.teamIds.map(nameOf);
      const who = names.length > 2 ? `${names[0]} to ${names[names.length - 1]}` : joinWithAnd(names);
      out.push(`${who} never after ${formatTime(m.latestStart)}`);
    }
  }
  return out;
}

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

/** [marketing] The closing row under Bill the teams. */
export function closingRowLine(c: ClosingRow): string {
  if (c.kind === 'matches') return `Matches the permit’s ${money(c.permitCents)}: nothing left for the club to cover.`;
  if (c.kind === 'club_covers') return `${money(c.differenceCents)} less than the permit’s ${money(c.permitCents)}: the club covers the rest.`;
  if (c.kind === 'more_than_permit') return `${money(c.differenceCents)} more than the permit’s ${money(c.permitCents)}.`;
  return 'No permit cost to compare it with.';
}

/** [marketing] "$2,700.00 in 3 payments" — a team's bill in one phrase. */
export const billPhrase = (cents: number, payments: number) => `${money(cents)} in ${pluralize(payments, 'payment')}`;

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
  lines: string[]; billedCents: number | null; owedBackCents: number | null; link: string;
}): EmailWords {
  const money2: string[] = [];
  if (p.billedCents) money2.push(`The time ${p.teamName} gained is billed: a correction of ${money(p.billedCents)} is on your Money › Club tab.`);
  if (p.owedBackCents) money2.push(`${p.teamName} is owed ${money(p.owedBackCents)} back for the time it no longer has: ask the club for it on Money › Club.`);
  return {
    subject: `${p.scheduleName}: ${p.teamName}’s slots changed`,
    greeting: firstNames(p.recipientNames),
    paragraphs: [`${p.orgName} changed ${p.teamName}’s slots on ${p.scheduleName}:`],
    lists: [{ title: null, items: p.lines }],
    link: { label: `Open ${p.teamName}’s schedule →`, path: p.link },
    outro: [...money2, 'Everything else stays as it was.'].join(' '),
  };
}

/** [marketing] The venue's bookings contact: the whole schedule by facility, in the email's body (no attachment, P11-08). */
export function bookingsEmail(p: {
  kind: 'final' | 'changes'; orgName: string; scheduleName: string; venueName: string; senderName: string;
  byFacility: { place: string; lines: string[] }[];
}): EmailWords {
  return {
    subject: p.kind === 'final' ? `${p.orgName}: ${p.scheduleName} at ${p.venueName}` : `${p.orgName}: changes to ${p.scheduleName} at ${p.venueName}`,
    greeting: 'Hello,',
    paragraphs: [p.kind === 'final'
      ? `Here is ${p.orgName}’s schedule for its time at ${p.venueName}, by ${p.byFacility.length === 1 ? 'facility' : 'facility and time'}.`
      : `${p.orgName} changed its schedule at ${p.venueName}. The changes, by facility:`],
    lists: p.byFacility.map(f => ({ title: f.place, items: f.lines })),
    link: null,
    outro: `Questions about it go to ${p.senderName}: reply to this email.`,
  };
}

// ── The notices ("Your club" for a coach; the builders') ─────────────────────────────────────────

/** [marketing] Each notice's title and body. */
export const SCHEDULE_NOTICES = {
  review: (p: { orgName: string; scheduleName: string; teamName: string; slots: number; billCents: number | null; replyBy: string | null }) => ({
    title: `${p.orgName} sent ${p.scheduleName} for review`,
    body: `${p.teamName} · ${pluralize(p.slots, 'slot')}${p.billCents ? ` and a ${money(p.billCents)} bill` : ''}.${p.replyBy ? ` Reply by ${formatShortWeekdayDate(p.replyBy)}.` : ''}`,
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
    title: `${p.orgName} billed ${p.teamName} ${money(p.cents)}`,
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
} as const;

/** [marketing] The send log's row (specimen 9): "Changes · 2 teams, 4 people" / "The whole schedule · 7 teams, 14 people and the dome". */
export function sendLogLine(p: { kind: 'review' | 'final' | 'changes'; teams: number; people: number; bookings: boolean; venueName: string | null }): string {
  const what = p.kind === 'review' ? 'For review' : p.kind === 'final' ? 'The whole schedule' : 'Changes';
  const who = `${pluralize(p.teams, 'team')}, ${pluralize(p.people, 'person', 'people')}`;
  return `${what} · ${who}${p.bookings ? ` and ${p.venueName ?? 'the venue'}` : ''}`;
}
