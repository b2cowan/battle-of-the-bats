/**
 * club-hand-back-words.ts — every sentence a hand-back that asks for money back says (Club Tier Stage 11d, part A;
 * hub K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stage 11d, specimens 1, 2, 4, 5, 6). The coach's tick and its line, the
 * practice's pill and what was asked, the club's Answer window and its three statements, Decline's window, Record
 * paying, the statement's Credit row, the bells. Client-safe, pure. Its own module so Stage 11c (which edits
 * club-schedule-words.ts beside this build) never shares a hunk with it. Part C (2026-10-16, hub C1–C4): the handed-back
 * practice's sentence (`handedBackSentence`), Take it back, the late ask, its Answer, and three bells — drafts for the
 * /marketing pass, with the /design review's D6–D8 as its notes.
 *
 * Copy status: the `/marketing` words pass ran 2026-10-13 (before the walks). The ratified drawn sentences stand; changed:
 * the coach's accepted chip ("Accepted · to be paid" — "the club pays it" read as already paid), Answer's both-ways rest (says
 * WHO has nothing left to pay), the quiet line (a budget line's name ends the sentence), the after-Accept notices (the
 * money the club owes, never "the team's $X"), the closed-year refusal, and the lapsed notice's description.
 */
import { formatTimeRange, joinWithAnd, pluralize, possessive } from './utils';
import { formatShortWeekdayDate, utcToZonedInputs } from './timezone';
import { fmt } from './coach-money-summary';
import { weekdayCount, weekdayOne, weekdayPlural } from './permit-words';
import type { HandedBackSlot } from './club-hand-back-reads';

const money = (cents: number) => fmt(cents / 100);
/** "Sun, Mar 7" without the weekday: "Mar 7". */
export const shortDay = (day: string) => formatShortWeekdayDate(day).replace(/^[A-Za-z]{3}, /, '');

/** A run of club days as its ends: "Feb 14 – Feb 28", or one day alone ("Sun, Feb 14 – Sun, Feb 28" with
 *  `formatShortWeekdayDate`). '' for none. */
export function dayRange(days: readonly string[], fmt: (day: string) => string = shortDay): string {
  if (!days.length) return '';
  const first = days[0], last = days[days.length - 1];
  return first === last ? fmt(first) : `${fmt(first)} – ${fmt(last)}`;
}

/** A practice's word without its number: "Sunday" · "Sundays" when they share one weekday, else "practice" · "practices". */
export function dayWord(weekday: number | null, many: boolean): string {
  return weekday == null ? (many ? 'practices' : 'practice') : many ? weekdayPlural(weekday) : weekdayOne(weekday);
}

/** What a set of practices is called: "4 Sundays" when they share one weekday, else "4 practices". */
export function practicesWord(count: number, weekday: number | null): string {
  return weekday == null ? pluralize(count, 'practice') : weekdayCount(count, weekday);
}

/** The practices a sentence names, said for their number: "the Sunday" · "the 4 Sundays", "this Sunday" · "these 4
 *  Sundays", "is" · "are", "stays" · "stay" — never "the 1 Sunday are open". */
export interface PracticesNamed { the: string; these: string; are: string; stay: string }
export function namePractices(count: number, weekday: number | null): PracticesNamed {
  if (count === 1) {
    const one = dayWord(weekday, false);
    return { the: `the ${one}`, these: `this ${one}`, are: 'is', stay: 'stays' };
  }
  const many = practicesWord(count, weekday);
  return { the: `the ${many}`, these: `these ${many}`, are: 'are', stay: 'stay' };
}
const cap = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

/**
 * Why a credit the club's own changes wrote, as the payment's note and the statement read it (owner, §308 W5 2026-10-16
 * — "Time moved at Send the changes" named the club's button, which a coach never sees): "Sun, Jan 10, moved by the
 * club" · "Sun, Jan 10, Jan 17 and Feb 7, moved by the club" · past four, "8 Sundays, Jan 10 – Feb 28, moved by the club".
 * Days are club days (YYYY-MM-DD). None — a share changed, not a practice — reads "Time moved by the club".
 */
export function movedByClubReason(days: readonly string[]): string {
  const sorted = [...new Set(days)].sort();
  if (!sorted.length) return 'Time moved by the club';
  // ISO weekdays (Sunday is 7), as `practicesWord` counts them.
  const weekdays = new Set(sorted.map(d => { const [y, m, n] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, n)).getUTCDay() || 7; }));
  const one = weekdays.size === 1 ? [...weekdays][0] : null;
  const what = sorted.length > 4
    ? `${practicesWord(sorted.length, one)}, ${shortDay(sorted[0])} – ${shortDay(sorted[sorted.length - 1])}`
    : one != null
      ? `${formatShortWeekdayDate(sorted[0]).split(', ')[0]}, ${joinWithAnd(sorted.map(shortDay))}`
      : joinWithAnd(sorted.map(formatShortWeekdayDate));
  return `${what}, moved by the club`;
}

/** One payment the credit lowered: "Its Feb 1 payment drops from $864.00 to $432.00" — dates are club days. */
export interface CreditMove { dueDate: string; fromCents: number; toCents: number }

/** What a credit did to the payments, after "takes $X off what 15U AA owes." — one sentence. */
export function creditMovesSentence(moves: readonly CreditMove[]): string {
  if (!moves.length) return '';
  const one = (m: CreditMove) => m.toCents === 0
    ? `its ${shortDay(m.dueDate)} payment of ${money(m.fromCents)} is covered`
    : `its ${shortDay(m.dueDate)} payment drops from ${money(m.fromCents)} to ${money(m.toCents)}`;
  const s = joinWithAnd([...moves].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(one));
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

/** */
export const HAND_BACK_WORDS = {
  // ── The coach asks (specimen 1) ──
  tick: (cents: number) => `Ask the club for ${money(cents)} back`,
  /** "4 Sundays at $108.00 each, what the club billed 15U AA for them. The club answers first: until it does, the
   *  practices stay yours." — "at … each" only when every practice costs the same. */
  tickLine: (p: { count: number; weekday: number | null; eachCents: number | null; teamName: string }) =>
    `${practicesWord(p.count, p.weekday)}${p.eachCents != null ? ` at ${money(p.eachCents)}${p.count === 1 ? '' : ' each'}` : ''}, what the club billed ${p.teamName} for ${p.count === 1 ? 'it' : 'them'}. The club answers first: until it does, ${p.count === 1 ? 'the practice stays' : 'the practices stay'} yours. You can also ask later, from the practice.`,
  askButton: 'Ask the club',
  asking: 'Asking…',
  askedNotice: (count: number) => `Your ask is with the club. Until it answers, the ${count === 1 ? 'practice stays' : 'practices stay'} yours.`,
  /** The request's name on both lists: "Hand back 4 Sundays". */
  requestName: (count: number, weekday: number | null) => `Hand back ${practicesWord(count, weekday)}`,

  // ── While the club decides (specimen 2) ──
  pill: 'Hand-back asked',
  /** The practice's end: "You asked the club on Oct 12 to hand back 4 practices, Mar 7 – Mar 28, with $432.00 back.
   *  It hasn't answered yet; until it does, they're yours." */
  askedLine: (p: { askedOn: string; count: number; first: string; last: string; cents: number }) =>
    `You asked the club on ${shortDay(p.askedOn)} to hand back ${pluralize(p.count, 'practice')}, ${p.first === p.last ? shortDay(p.first) : `${shortDay(p.first)} – ${shortDay(p.last)}`}, with ${money(p.cents)} back. It hasn’t answered yet; until it does, ${p.count === 1 ? 'it’s' : 'they’re'} yours.`,
  withdrawDoor: 'Withdraw the ask',
  withdrawQuestion: 'Withdraw your ask?',
  /** `late`: an ask made after the hand-back (part C) — its practices were already handed back. */
  withdrawWhat: (count: number, late = false) => `The ${count === 1 ? 'practice stays' : 'practices stay'} ${late ? 'handed back' : 'yours'}, and the club no longer sees the ask. You can ask again.`,
  withdrawKeep: 'Keep it',
  withdrawConfirm: 'Withdraw',
  withdrawing: 'Withdrawing…',
  withdrawnNotice: 'Your ask is withdrawn. The practices stay yours.',
  withdrawnLateNotice: 'Your ask is withdrawn. The practices stay handed back.',
  withdrawFailed: 'The ask couldn’t be withdrawn just now. Please try again.',

  // ── The coach's request row (Money › Club) ──
  statusAccepted: 'Accepted · to be paid',
  statusCredited: (on: string) => `Credited ${shortDay(on)}`,
  rowSub: (scheduleName: string, askedOn: string, askedBy: string | null) =>
    `${scheduleName} · asked ${shortDay(askedOn)}${askedBy ? ` by ${askedBy}` : ''}`,
  /** The mixed case on the coach's row: "$200.00 came off what you owe"; the club reads it of the team. */
  creditedPart: (cents: number) => `${money(cents)} came off what you owe`,
  creditedPartOf: (cents: number, teamName: string) => `${money(cents)} came off what ${teamName} owed`,
  toPayPart: (cents: number) => `${money(cents)} to pay`,

  // ── The club answers (specimen 4) ──
  answer: 'Answer',
  answerEyebrow: (scheduleName: string, askedOn: string) => `${scheduleName} · asked ${shortDay(askedOn)}`,
  answerTitle: (teamName: string, count: number, weekday: number | null) => `${teamName} asks to hand back ${practicesWord(count, weekday)}`,
  factSundays: (weekday: number | null) => (weekday == null ? 'Practices' : weekdayPlural(weekday)),
  factAskedBy: 'Asked by',
  factAsksFor: 'Asks for',
  asksFor: (cents: number) => `${money(cents)} back`,
  asksForHow: (p: { count: number; weekday: number | null; eachCents: number | null }) =>
    `${practicesWord(p.count, p.weekday)}${p.eachCents != null ? ` at ${money(p.eachCents)}${p.count === 1 ? '' : ' each'}` : ''}, what the club billed for ${p.count === 1 ? 'it' : 'them'}`,
  factBill: (teamName: string) => `${possessive(teamName)} bill`,
  /** "$2,700.00 · $972.00 paid · $1,728.00 still owed (Dec 1, Feb 1)". */
  billLine: (p: { billedCents: number; paidCents: number; owedCents: number; creditedCents: number; owedDates: string[] }) =>
    [money(p.billedCents), p.creditedCents ? `${money(p.creditedCents)} credited` : null, `${money(p.paidCents)} paid`,
      `${money(p.owedCents)} still owed${p.owedDates.length ? ` (${p.owedDates.map(shortDay).join(', ')})` : ''}`].filter(Boolean).join(' · '),
  /** The three statements of what Accept does (D2: "Accept opens …", the owner's "opening the time slot"). */
  // `late` (part C, C4): a late ask opens nothing, so its statement is "the built statement without its first half".
  statementOwes: (p: { what: PracticesNamed; teamName: string; cents: number; moves: readonly CreditMove[]; late?: boolean }) => ({
    lead: `Accept ${p.late ? '' : `opens ${p.what.the} and `}takes ${money(p.cents)} off what ${p.teamName} owes.`,
    rest: `${creditMovesSentence(p.moves)} Nothing more for you to do.`,
  }),
  statementPaid: (p: { what: PracticesNamed; teamName: string; cents: number; late?: boolean }) => ({
    lead: `${p.late ? '' : `Accept opens ${p.what.the}. `}${p.teamName} has paid its bill, so the club owes it ${money(p.cents)}.`,
    rest: 'It waits in Payment requests until you record paying it.',
  }),
  statementBoth: (p: { what: PracticesNamed; teamName: string; creditCents: number; payCents: number; late?: boolean }) => ({
    lead: `Accept ${p.late ? '' : `opens ${p.what.the}, `}takes ${money(p.creditCents)} off what ${p.teamName} still owes, and the club owes it the other ${money(p.payCents)}.`,
    rest: `${p.teamName} has nothing left to pay on it; the ${money(p.payCents)} waits in Payment requests until you record paying it.`,
  }),
  /** The quiet line: what the open time costs the club. */
  quietLine: (p: { what: PracticesNamed; cents: number; lineName: string | null }) =>
    `Unless another team takes ${p.what.these}, the club recovers ${money(p.cents)} less of the permit’s cost${p.lineName ? ` on ${p.lineName}` : ''}.`,
  answerFoot: (teamName: string) => `${possessive(teamName)} coaches are told either way.`,
  declineDoor: 'Decline…',
  accept: 'Accept',
  accepting: 'Accepting…',
  /** A builder who can't move club money reads the ask, never Answer. */
  answeredBySomeoneElse: 'Someone who holds the club’s Accounting answers it.',
  acceptedOwes: (teamName: string, what: PracticesNamed, cents: number) => `Accepted. ${cap(what.the)} ${what.are} open and ${money(cents)} came off what ${teamName} owes. Their coaches are told.`,
  acceptedPaid: (teamName: string, what: PracticesNamed, cents: number) => `Accepted. ${cap(what.the)} ${what.are} open, and the ${money(cents)} the club owes ${teamName} waits in Payment requests until you record paying it. Their coaches are told.`,
  acceptedBoth: (teamName: string, what: PracticesNamed, creditCents: number, payCents: number) => `Accepted. ${cap(what.the)} ${what.are} open, ${money(creditCents)} came off what ${teamName} owes, and the other ${money(payCents)} the club owes it waits in Payment requests. Their coaches are told.`,
  acceptFailed: 'The ask couldn’t be answered just now. Please try again.',

  // ── Decline (specimen 4) ──
  declineTitle: (teamName: string) => `Decline ${possessive(teamName)} hand-back?`,
  declineField: 'Why (optional)',
  declinePlaceholder: 'For example: nobody else can use March',
  declineHint: (what: PracticesNamed, teamName: string) => `The coach reads this. ${cap(what.the)} ${what.stay} ${possessive(teamName)}.`,
  /** A late ask's (part C): the practices were handed back already, so declining keeps only the money. */
  declineHintLate: 'The coach reads this. The practices stay handed back.',
  declineKeep: 'Keep it waiting',
  declineConfirm: 'Decline',
  declining: 'Declining…',
  declined: (teamName: string, what: PracticesNamed) => `Declined. ${cap(what.the)} ${what.stay} ${possessive(teamName)}, and their coaches are told.`,
  declinedLate: (teamName: string) => `Declined. ${possessive(teamName)} coaches are told.`,
  declineFailed: 'The ask couldn’t be declined just now. Please try again.',

  // ── After (specimen 5) ──
  credited: 'Credited',
  /** The Credited figure's line when a bill has more than one credit (each keeps its own reason on its payment's note). */
  creditsCount: (n: number) => `${n} credits`,
  /** The Credited figure's line for one credit the club's own changes wrote — its payment's note names the days, so the
   *  line under the figure never says it twice (owner, §308 W5 2026-10-16). */
  creditedByClub: 'Moved by the club',
  creditedSub: (what: string) => `${what} handed back`,
  /** The bill window's payment row: "$864.00 less a $432.00 credit"; its note "Credit Oct 14: 4 Sundays handed back". */
  lessCredit: (fromCents: number, creditCents: number) => `${money(fromCents)} less a ${money(creditCents)} credit`,
  creditNote: (on: string, reason: string) => `Credit ${shortDay(on)}: ${reason}`,
  /** The statement's Credit row: "Credit · Winter dome · Sundays" over "4 Sundays handed back, accepted by Morgan Ellis". */
  creditEntry: (allocation: string) => `Credit · ${allocation}`,
  creditEntrySub: (p: { reason: string; by: string | null; source: 'hand_back' | 'changes' }) =>
    `${p.reason}${p.by ? `, ${p.source === 'hand_back' ? 'accepted' : 'sent'} by ${p.by}` : ''}`,
  /** The credit's reason, as the statement and the bill read it. */
  reasonHandBack: (count: number, weekday: number | null) => `${practicesWord(count, weekday)} handed back`,
  reasonChanges: movedByClubReason,
  /** Payment requests' state for an accepted request: "Accepted Oct 14 · to pay". */
  acceptedToPay: (on: string) => `Accepted ${shortDay(on)} · to pay`,
  /** D6: the Approve window titled for what is left to do. */
  recordPayingTitle: (teamName: string, cents: number) => `Record paying ${teamName} ${money(cents)}`,
  recordPayingButton: (cents: number) => `Record ${money(cents)} paid`,
  recordPayingEyebrow: (on: string) => `Payment request · accepted ${shortDay(on)}`,
  recordedPaying: (teamName: string, cents: number) => `${money(cents)} to ${teamName} is recorded. Their coaches are told.`,

  // ── Refusals (the routes' `error`) ──
  refuse: {
    noMoney: 'Only someone who can use the team’s money can ask the club for money back.',
    notBilled: 'The club didn’t bill your team for this time, so there’s nothing to ask back.',
    changed: 'Those practices changed since you opened this. Close it and try again.',
    nothing: 'There’s nothing to ask back for those practices.',
    overRoom: (cents: number) => `That’s more than your team still has to ask back from this schedule (${money(cents)}).`,
    answered: 'This ask was already answered.',
    lapsed: 'No practice in this ask is still to come, so there’s nothing left to hand back.',
    stale: 'None of these practices is the team’s to hand back any more. Decline it, or let the coach withdraw it.',
    notFound: 'That ask isn’t here any more. Reload the page.',
    yearClosed: (yearName: string | null) => `The bill counts in ${yearName ? `the ${yearName} fiscal year, which is closed` : 'a closed fiscal year'}, so its payments can’t change. Reopen that year to accept.`,
    answerTheAsk: 'This request is a hand-back. Answer it with Accept or Decline.',
    withdrawWithAsk: 'This request is a hand-back. Withdraw it from the practice, or with Withdraw the ask.',
    editAsk: 'A hand-back’s request is worked out from its practices, so it can’t be changed.',
    // Part C
    takeBackNothing: 'Those practices can’t come back now: the club may have given the time away, or money was asked for them.',
    lateNothing: 'There’s nothing left to ask the club for on these practices.',
    lateAsked: 'The club has already been asked for this money.',
    lateStale: 'Nothing in this ask is still owed to the team: its practices came back to it, or its bill has nothing left to give back. Decline it, or let the coach withdraw it.',
    noSchedule: 'Only someone who can change the team’s schedule can take practices back.',
  },

  // ── The club's own changes (specimen 6; Ask 8) ──
  /** The request a send raises for time it moved off a team that had paid. */
  lostRequestName: (scheduleName: string) => `Time moved · ${scheduleName}`,
  /** The send window's money line for a team that lost time (D7: plain, as the built lines): "$108.00 comes off what
   *  15U AA owes: its Feb 1 payment." */
  lostLine: (p: { teamName: string; creditCents: number; payCents: number; moves: readonly CreditMove[] }) => {
    const which = p.moves.length ? joinWithAnd([...p.moves].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map(m => shortDay(m.dueDate))) : '';
    const its = which ? `its ${which} payment${p.moves.length > 1 ? 's' : ''}` : '';
    if (p.creditCents && !p.payCents) return `${money(p.creditCents)} comes off what ${p.teamName} owes${its ? `: ${its}` : ''}.`;
    if (p.payCents && !p.creditCents) return `${p.teamName} has paid, so the club owes it ${money(p.payCents)}: it waits in Payment requests.`;
    return `${money(p.creditCents)} comes off what ${p.teamName} owes${its ? ` (${its})` : ''}, and the club owes it the other ${money(p.payCents)}.`;
  },
  /** The same, in the changes email to the team's coaches. */
  lostEmail: (p: { teamName: string; creditCents: number; payCents: number; moves: readonly CreditMove[] }) => [
    p.creditCents ? `The time ${p.teamName} no longer has comes off what it owes the club: ${money(p.creditCents)}. ${creditMovesSentence(p.moves)}` : null,
    p.payCents ? `${p.teamName} had already paid for ${p.creditCents ? 'the rest of it' : 'it'}, so the club owes it ${money(p.payCents)} and will record paying it.` : null,
  ].filter(Boolean).join(' '),
  /** Bill the corrections' line, now both halves (Ask 8). */
  billCorrectionsOn: 'A team that gained time gets a small bill for it, and a team that lost time has it taken off what it owes, on the same budget line.',
  billCorrectionsOff: 'Off: the time gained is never billed and the time lost never credited. The next changes are measured from here.',

  // ── Bells (the notices) ──
  /** `cents` null: the same notice for a builder who can't move club money — never the figure (a money read). */
  bellAsked: (p: { teamName: string; count: number; cents: number | null; scheduleName: string; first: string; last: string }) => ({
    title: `${p.teamName} asks to hand back ${pluralize(p.count, 'practice')}${p.cents == null ? ', with money back' : `, with ${money(p.cents)} back`}`,
    body: `${p.scheduleName}: ${p.first === p.last ? formatShortWeekdayDate(p.first) : `${formatShortWeekdayDate(p.first)} – ${formatShortWeekdayDate(p.last)}`}. ${p.count === 1 ? 'The practice stays' : 'The practices stay'} ${possessive(p.teamName)} until someone who holds the club’s Accounting answers.`,
  }),
  bellWithdrawn: (p: { teamName: string; count: number; scheduleName: string }) => ({
    title: `${p.teamName} withdrew its hand-back`,
    body: `${p.scheduleName}: ${namePractices(p.count, null).the} ${namePractices(p.count, null).stay} ${possessive(p.teamName)}.`,
  }),
  bellAccepted: (p: { scheduleName: string; count: number; creditCents: number; payCents: number; teamName: string; moves: readonly CreditMove[] }) => ({
    title: 'The club accepted your hand-back',
    body: [
      `${p.scheduleName}: ${pluralize(p.count, 'practice')} handed back.`,
      p.creditCents ? `${money(p.creditCents)} came off what ${p.teamName} owes. ${creditMovesSentence(p.moves)}` : null,
      p.payCents ? `The club owes ${p.teamName} ${money(p.payCents)} and will record paying it.` : null,
    ].filter(Boolean).join(' '),
  }),
  bellDeclined: (p: { scheduleName: string; count: number; reason: string | null }) => ({
    title: 'The club declined your hand-back',
    body: `${p.scheduleName}: ${namePractices(p.count, null).the} ${namePractices(p.count, null).stay} yours.${p.reason ? ` “${p.reason}”` : ''}`,
  }),
  bellLapsed: (p: { scheduleName: string; count: number }) => ({
    title: 'Your hand-back ask closed',
    body: `${p.scheduleName}: no practice in it is still to come, so the club can’t hand ${p.count === 1 ? 'it' : 'them'} back now. Nothing changed.`,
  }),

  // ── Part C: a hand-back the coach can change (hub Stage 11d, C1–C4; Asks 10–14). Drafts for /marketing. ──
  /** The not-on pill beside a struck title (Ask 14) is SCHEDULE_COACH_WORDS.handedBack / STATE_WORDS.cancelled; the
   *  amber waiting pill a late ask puts at the row's end (C1, D8: "Hand-back asked" would be false — the practices are
   *  already handed back). */
  moneyAskedPill: 'Money asked',
  takeBackDoor: 'Take it back',
  /** The practice's end while a late ask waits (C2): "You asked the club on Oct 18 for $432.00 back for the 4 practices you
   *  handed back on Oct 16. It hasn’t answered yet." */
  lateAskedLine: (p: { askedOn: string; cents: number; count: number; on: string }) =>
    `You asked the club on ${shortDay(p.askedOn)} for ${money(p.cents)} back for ${p.count === 1 ? 'the practice' : `the ${p.count} practices`} you handed back on ${shortDay(p.on)}. It hasn’t answered yet.`,

  // Take back which practices? (C3, Ask 11)
  takeBackQuestion: 'Take back which practices?',
  takeBackLead: 'They come back to your schedule and are back on for your families. The club’s schedulers are told.',
  /** "Feb 21 went to another team, so 2 can come back." — said only when some of the hand-back can't. */
  takeBackLeft: (p: { taken: readonly string[]; removed: readonly string[]; can: number }) => {
    const parts = [
      p.taken.length ? `${joinWithAnd(p.taken.map(shortDay))} went to another team` : null,
      p.removed.length ? `${joinWithAnd(p.removed.map(shortDay))} came off the club’s schedule` : null,
    ].filter(Boolean);
    return parts.length ? `${joinWithAnd(parts as string[])}, so ${p.can} can come back.` : '';
  },
  takeBackKeep: 'Keep it handed back',
  takeBackConfirm: 'Take it back',
  takingBack: 'Taking it back…',
  takenBackNotice: (n: number) => `${n === 1 ? 'The practice is' : `${n} practices are`} back on your schedule, and your families see ${n === 1 ? 'it' : 'them'} again.`,
  takeBackFailed: 'That couldn’t be taken back just now. Please try again.',

  // Ask the club for money back? (C3, Ask 12)
  lateQuestion: 'Ask the club for money back?',
  lateLead: (on: string, count: number) =>
    `You handed ${count === 1 ? 'this practice' : 'these practices'} back on ${shortDay(on)} without asking for money. ${count === 1 ? 'Its' : 'Their'} time is already open; this asks only for the money.`,
  factPractices: 'Practices',
  /** "4 Sundays at $108.00 each, what the club billed 15U AA for them" — the tick's line without its waiting clause. */
  lateAsksForHow: (p: { count: number; weekday: number | null; eachCents: number | null; teamName: string }) =>
    `${practicesWord(p.count, p.weekday)}${p.eachCents != null ? ` at ${money(p.eachCents)}${p.count === 1 ? '' : ' each'}` : ''}, what the club billed ${p.teamName} for ${p.count === 1 ? 'it' : 'them'}`,
  lateCancel: 'Cancel',
  lateLoading: 'Loading what the club billed…',
  lateAskedNotice: 'Your ask is with the club. Whatever it answers, the practices stay handed back.',
  lateFailed: 'Your ask couldn’t be sent just now. Please try again.',
  /** The request's name on both lists: "4 Sundays handed back" (the credit's own reason, `reasonHandBack`). */
  lateRequestName: (count: number, weekday: number | null) => `${practicesWord(count, weekday)} handed back`,

  // The club answers a late ask (C4)
  answerTitleLate: (teamName: string, count: number, weekday: number | null) => `${teamName} asks for money back for ${practicesWord(count, weekday)}`,
  factHandedBack: 'Handed back',
  timeOpen: 'Their time is already open.',
  /** D3: the quiet line counts only the Sundays still open; this says how many of the ask went to another team. */
  quietGone: (n: number, weekday: number | null) => `${n} other ${dayWord(weekday, n !== 1)} already went to another team.`,
  acceptedLateOwes: (teamName: string, cents: number) => `Accepted. ${money(cents)} came off what ${teamName} owes. Their coaches are told.`,
  acceptedLatePaid: (teamName: string, cents: number) => `Accepted. The ${money(cents)} the club owes ${teamName} waits in Payment requests until you record paying it. Their coaches are told.`,
  acceptedLateBoth: (teamName: string, creditCents: number, payCents: number) => `Accepted. ${money(creditCents)} came off what ${teamName} owes, and the other ${money(payCents)} the club owes it waits in Payment requests. Their coaches are told.`,

  // Bells (C4)
  bellAskedLate: (p: { teamName: string; count: number; cents: number | null; scheduleName: string; first: string; last: string }) => ({
    title: `${p.teamName} asks for ${p.cents == null ? 'money' : money(p.cents)} back for ${pluralize(p.count, 'practice')} it handed back`,
    body: `${p.scheduleName}: ${dayRange([p.first, p.last], formatShortWeekdayDate)}. Their time is already open; only the money waits for someone who holds the club’s Accounting.`,
  }),
  bellWithdrawnLate: (p: { teamName: string; count: number; scheduleName: string }) => ({
    title: `${p.teamName} withdrew its ask for money back`,
    body: `${p.scheduleName}: ${namePractices(p.count, null).the} ${namePractices(p.count, null).stay} handed back.`,
  }),
  bellAcceptedLate: (p: { scheduleName: string; count: number; creditCents: number; payCents: number; teamName: string; moves: readonly CreditMove[] }) => ({
    title: 'The club accepted your ask for money back',
    body: [
      `${p.scheduleName}: ${pluralize(p.count, 'practice')} you handed back.`,
      p.creditCents ? `${money(p.creditCents)} came off what ${p.teamName} owes. ${creditMovesSentence(p.moves)}` : null,
      p.payCents ? `The club owes ${p.teamName} ${money(p.payCents)} and will record paying it.` : null,
    ].filter(Boolean).join(' '),
  }),
  bellDeclinedLate: (p: { scheduleName: string; count: number; reason: string | null }) => ({
    title: 'The club declined your ask for money back',
    body: `${p.scheduleName}: ${namePractices(p.count, null).the} ${namePractices(p.count, null).stay} handed back.${p.reason ? ` “${p.reason}”` : ''}`,
  }),
  /** Ask 13: to the team's people who can use its money, when someone who can't handed back time the club billed. */
  bellUnasked: (p: { name: string; count: number; scheduleName: string; first: string; cents: number }) => ({
    title: `${p.name} handed back ${pluralize(p.count, 'practice')} without asking for money`,
    body: `${p.scheduleName} · from ${formatShortWeekdayDate(p.first)}. The club billed ${money(p.cents)} for ${p.count === 1 ? 'it' : 'them'}: you can ask for it back from the practice.`,
  }),

  // ── The schedule's page (part B, specimen 3 — Asks 3, 4; /design D1, D4, D5) ──
  /** The callout's head (drawn): "15U AA asks to hand back 4 Sundays, with $432.00 back". `cents` null: a reader who
   *  can't move club money reads it without the figure, as part A's bell leaves it out. */
  calloutHead: (p: AskWords) => `${p.teamName} asks to hand back ${practicesWord(p.count, p.weekday)}, with ${back(p.cents)} back`,
  /** A late ask (part C) — the money only; its Sundays are already open: "15U AA asks for $432.00 back for 4 Sundays it
   *  handed back" (the late bell's own words). */
  calloutHeadLate: (p: AskWords) => `${p.teamName} asks for ${back(p.cents)} back for ${practicesWord(p.count, p.weekday)} it handed back`,
  /** Past six Sundays, the callout lists six and says how many more. */
  calloutMore: (n: number, weekday: number | null) => `and ${n} more ${dayWord(weekday, n !== 1)}`,
  /** Drawn: "Asked by Sam Whitford on Oct 12. The Sundays stay 15U AA’s until you answer." `youAnswer` false (a reader who
   *  can't move club money): "…until someone who holds the club’s Accounting answers." — part A's bell sentence; the
   *  drawn "until you answer" beside "Someone else answers it" said two things (/marketing 2026-10-16). */
  calloutTail: (p: AskWords & { askedBy: string | null; askedOn: string }, youAnswer: boolean) =>
    `${askedBy(p)} The ${dayWord(p.weekday, p.count !== 1)} ${p.count === 1 ? 'stays' : 'stay'} ${possessive(p.teamName)} until ${youAnswer ? 'you answer' : 'someone who holds the club’s Accounting answers'}.`,
  /** A late ask's: who asked, that the time is already open (C4's "Handed back" row), and what an answer moves — only the
   *  money (/marketing 2026-10-16; the reader who can't answer reads part C's late bell words). */
  calloutTailLate: (p: AskWords & { askedBy: string | null; askedOn: string; handedBackOn: string | null }, youAnswer: boolean) =>
    `${askedBy(p)} ${p.teamName} handed ${p.count === 1 ? 'it' : 'them'} back${p.handedBackOn ? ` on ${shortDay(p.handedBackOn)}` : ''}: ${p.count === 1 ? 'its' : 'their'} time is already open, and ${youAnswer ? 'your answer moves only the money' : 'only the money waits for someone who holds the club’s Accounting'}.`,
  /** The slot window's Hand-back asked row (D1): "15U AA asked on Oct 12 to hand back this Sunday and 3 others, with $432.00
   *  back." — the team named, so a shared slot says which of its teams asked. */
  slotAsked: (p: AskWords & { askedOn: string }) => {
    const one = `this ${dayWord(p.weekday, false)}`;
    return `${p.teamName} asked on ${shortDay(p.askedOn)} to hand back ${p.count > 1 ? `${one} and ${pluralize(p.count - 1, 'other')}` : one}, with ${back(p.cents)} back.`;
  },
  /** The bell's door (D5) when its ask is no longer waiting: the page opens on its own, with this said once. */
  doorStale: 'That ask isn’t waiting any more: it was answered, its coach withdrew it, or its Sundays have passed.',
  /** Fair shares' note (D4): a team that handed time back with no money settled still pays its bill — said beside the
   *  table, with the figure the Bill column reads. `billMoved`: money already came off the team's bill for OTHER Sundays
   *  (an accepted ask, a club move), so "its bill stays" would be false — "it still pays for them ($2,268.00 in all)"
   *  instead (/marketing 2026-10-16: "they stay in what it pays" was a hard read). */
  keptNote: (p: { teamName: string; count: number; weekday: number | null; cents: number; asked: 'none' | 'waiting' | 'declined'; billMoved: boolean }) => {
    const why = { none: ' without asking for money', waiting: ' and asks for money back', declined: ', and the club declined its ask for money back' }[p.asked];
    const stays = p.billMoved ? `it still pays for ${p.count === 1 ? 'it' : 'them'} (${money(p.cents)} in all)` : `its bill stays ${money(p.cents)}`;
    return `${p.teamName} handed back ${practicesWord(p.count, p.weekday)}${why}: ${stays}${p.asked === 'waiting' ? ' until you answer' : ''}.`;
  },
} as const;

/** What the schedule page's ask words read off an ask (Stage 11d part B) — a `ScheduleAsk` is one. */
interface AskWords { teamName: string; count: number; weekday: number | null; cents: number | null }
/** The figure, or "money" for a reader who can't move club money. */
function back(cents: number | null): string { return cents == null ? 'money' : money(cents); }
/** "Asked by Sam Whitford on Oct 12." */
function askedBy(p: { askedBy: string | null; askedOn: string }): string { return `Asked by ${p.askedBy ?? 'a coach'} on ${shortDay(p.askedOn)}.`; }

/**
 * THE HANDED-BACK PRACTICE'S SENTENCE (C2 — "the status is said once, here; the row says Handed back"): when it was
 * handed back and with how many others, then the one clause that is true now — families see it as cancelled and it can
 * come back; the time went to another team (or off the schedule); the club settled the money; it declined a late ask.
 * A coach who can't use the team's money hears who can ask (Ask 13). A WAITING late ask is `lateAskedLine`, under the
 * amber pill, instead. Days are club days (YYYY-MM-DD).
 */
export function handedBackSentence(p: {
  kind: 'landed' | 'asked'; on: string; days: readonly string[]; thisDay: string; slot: HandedBackSlot; canTakeBack: boolean;
  late: { state: 'waiting' | 'accepted' | 'declined'; closedOn: string | null; cents: number; reason: string | null } | null;
  settled: { on: string; creditedCents: number; toPayCents: number } | null;
  askCents: number | null; canMoney: boolean; teamName: string;
}): string {
  const others = p.days.filter(d => d !== p.thisDay);
  const withOthers = others.length ? `, with ${pluralize(others.length, 'other')}` : '';
  // When it was handed back, and with how many others — never with its full stop (the clause after it decides).
  const lead = `You handed this practice back on ${shortDay(p.on)}${withOthers}`;
  const them = p.days.length === 1 ? 'it' : 'them';
  if (p.kind === 'asked' && p.settled) {
    // An ask with its tick, accepted: the club's answer was the hand-back — one sentence, its date once.
    const { creditedCents: c, toPayCents: t, on } = p.settled;
    const what = c && t ? `it took ${money(c)} off what ${p.teamName} owes for ${them}, and owes it the other ${money(t)}`
      : c ? `it took ${money(c)} off what ${p.teamName} owes for ${them}`
      : `it owes ${p.teamName} ${money(t)} for ${them}`;
    return `The club accepted your hand-back of this practice${others.length ? ` and ${pluralize(others.length, 'other')}` : ''} on ${shortDay(on)}: ${what}.`;
  }
  if (p.settled) {
    const { creditedCents: c, toPayCents: t, on } = p.settled;
    const settledWords = c && t ? `The club took ${money(c)} off what ${p.teamName} owes for ${them} on ${shortDay(on)}, and owes it the other ${money(t)}.`
      : c ? `The club took ${money(c)} off what ${p.teamName} owes for ${them} on ${shortDay(on)}.`
      : `The club accepted: it owes ${p.teamName} ${money(t)} for ${them}.`;
    return `${lead}. ${settledWords}`;
  }
  const head = p.slot === 'taken' ? `${lead}. The club has given this time to another team, so it can’t come back to you.`
    : p.slot === 'removed' ? `${lead}. The club has taken this time off its schedule, so it can’t come back to you.`
    : p.slot === 'returned' ? `${lead}. The club is giving this time back to ${p.teamName}: it’s back on your schedule when the club sends its changes.`
    : p.canTakeBack ? `${lead}${others.length ? ` (${dayRange(others)})` : ''}. Your families see it as cancelled. Until the club gives the time to another team, you can take it back.`
    : `${lead}. Your families see it as cancelled.`;
  const tail = p.late?.state === 'declined'
    ? `The club declined your ask for ${money(p.late.cents)} back${p.late.closedOn ? ` on ${shortDay(p.late.closedOn)}` : ''}${p.late.reason ? `: “${p.late.reason}”` : '.'}`
    : !p.late && !p.canMoney && p.askCents
      ? `${possessive(p.teamName)} money people can ask the club for the ${money(p.askCents)} ${p.days.length === 1 ? 'this practice costs' : `these ${p.days.length} practices cost`}.`
      : '';
  return tail ? `${head} ${tail}` : head;
}

/** The Answer's quiet line — what the open time costs the club (D3 for a late ask: only the Sundays still open, and how
 *  many of it went to another team; none open, no line). */
export function answerQuietLine(p: {
  what: PracticesNamed; cents: number; weekday: number | null; lineName: string | null;
  late: { openCount: number; openCents: number; goneCount: number } | null;
}): string | null {
  const W = HAND_BACK_WORDS;
  if (!p.late) return p.cents > 0 ? W.quietLine({ what: p.what, cents: p.cents, lineName: p.lineName }) : null;
  if (!p.late.openCount) return null;
  const line = W.quietLine({ what: namePractices(p.late.openCount, p.weekday), cents: p.late.openCents, lineName: p.lineName });
  return p.late.goneCount ? `${line} ${W.quietGone(p.late.goneCount, p.weekday)}` : line;
}

/** What Accept does — the one of the three statements that is true (Ask 5): off what the team owes, the club
 *  owes it, or both. A LATE ask (part C, C4: "the built statement without its first half") opens nothing, so its
 *  statement is the money only. */
export function acceptStatement(p: { what: PracticesNamed; teamName: string; creditCents: number; payCents: number; moves: readonly CreditMove[]; late?: boolean }) {
  const W = HAND_BACK_WORDS;
  if (p.payCents === 0) return W.statementOwes({ what: p.what, teamName: p.teamName, cents: p.creditCents, moves: p.moves, late: p.late });
  if (p.creditCents === 0) return W.statementPaid({ what: p.what, teamName: p.teamName, cents: p.payCents, late: p.late });
  return W.statementBoth(p);
}

/** The page's sentence once Accept has landed — the same three ways (a late ask's: the money only). */
export function acceptedNotice(p: { teamName: string; what: PracticesNamed; creditCents: number; payCents: number; late?: boolean }): string {
  const W = HAND_BACK_WORDS;
  if (p.late) {
    if (p.payCents === 0) return W.acceptedLateOwes(p.teamName, p.creditCents);
    if (p.creditCents === 0) return W.acceptedLatePaid(p.teamName, p.payCents);
    return W.acceptedLateBoth(p.teamName, p.creditCents, p.payCents);
  }
  if (p.payCents === 0) return W.acceptedOwes(p.teamName, p.what, p.creditCents);
  if (p.creditCents === 0) return W.acceptedPaid(p.teamName, p.what, p.payCents);
  return W.acceptedBoth(p.teamName, p.what, p.creditCents, p.payCents);
}

/** "Mar 7, 14, 21 and 28 · 9:30–11:00 a.m. · Field 1" — one line when every Sunday shares its time and place (the
 *  club's Answer and the coach's late ask read their Sundays the same way). */
export function sundaysLine(sundays: readonly { day: string; startsAt: string; endsAt: string; place: string }[]): string {
  if (!sundays.length) return '—';
  const clock = (s: (typeof sundays)[number]) => formatTimeRange(utcToZonedInputs(s.startsAt).time, utcToZonedInputs(s.endsAt).time);
  const days: string[] = [];
  let month = '';
  for (const s of sundays) {
    const [m, d] = shortDay(s.day).split(' ');
    days.push(m === month ? d : `${m} ${d}`);
    month = m;
  }
  const one = new Set(sundays.map(s => `${clock(s)}|${s.place}`)).size === 1;
  return one ? [joinWithAnd(days), clock(sundays[0]), sundays[0].place].filter(Boolean).join(' · ')
    : sundays.map(s => [shortDay(s.day), clock(s), s.place].filter(Boolean).join(' · ')).join('; ');
}
