/**
 * club-hand-back-words.ts — every sentence a hand-back that asks for money back says (Club Tier Stage 11d, part A;
 * hub K4MPu4ni53Ct7yrDcmWJd9 → Mockups → Stage 11d, specimens 1, 2, 4, 5, 6). The coach's tick and its line, the
 * practice's pill and what was asked, the club's Answer window and its three statements, Decline's window, Record
 * paying, the statement's Credit row, the bells. Client-safe, pure. Its own module so Stage 11c (which edits
 * club-schedule-words.ts beside this build) never shares a hunk with it.
 *
 * Copy status: the `/marketing` words pass ran 2026-10-13 (before the walks). The ratified drawn sentences stand; changed:
 * the coach's accepted chip ("Accepted · to be paid" — "the club pays it" read as already paid), Answer's both-ways rest (says
 * WHO has nothing left to pay), the quiet line (a budget line's name ends the sentence), the after-Accept notices (the
 * money the club owes, never "the team's $X"), the closed-year refusal, and the lapsed notice's description.
 */
import { joinWithAnd, pluralize } from './utils';
import { formatShortWeekdayDate } from './timezone';
import { fmt } from './coach-money-summary';
import { weekdayCount, weekdayOne, weekdayPlural } from './permit-words';

const money = (cents: number) => fmt(cents / 100);
/** "Sun, Mar 7" without the weekday: "Mar 7". */
export const shortDay = (day: string) => formatShortWeekdayDate(day).replace(/^[A-Za-z]{3}, /, '');

/** What a set of practices is called: "4 Sundays" when they share one weekday, else "4 practices". */
export function practicesWord(count: number, weekday: number | null): string {
  return weekday == null ? pluralize(count, 'practice') : weekdayCount(count, weekday);
}

/** The practices a sentence names, said for their number: "the Sunday" · "the 4 Sundays", "this Sunday" · "these 4
 *  Sundays", "is" · "are", "stays" · "stay" — never "the 1 Sunday are open". */
export interface PracticesNamed { the: string; these: string; are: string; stay: string }
export function namePractices(count: number, weekday: number | null): PracticesNamed {
  if (count === 1) {
    const one = weekday == null ? 'practice' : weekdayOne(weekday);
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
    `${practicesWord(p.count, p.weekday)}${p.eachCents != null ? ` at ${money(p.eachCents)}${p.count === 1 ? '' : ' each'}` : ''}, what the club billed ${p.teamName} for ${p.count === 1 ? 'it' : 'them'}. The club answers first: until it does, ${p.count === 1 ? 'the practice stays' : 'the practices stay'} yours.`,
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
  withdrawWhat: (count: number) => `The ${count === 1 ? 'practice stays' : 'practices stay'} yours, and the club no longer sees the ask. You can ask again.`,
  withdrawKeep: 'Keep it',
  withdrawConfirm: 'Withdraw',
  withdrawing: 'Withdrawing…',
  withdrawnNotice: 'Your ask is withdrawn. The practices stay yours.',
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
  factBill: (teamName: string) => `${teamName}’s bill`,
  /** "$2,700.00 · $972.00 paid · $1,728.00 still owed (Dec 1, Feb 1)". */
  billLine: (p: { billedCents: number; paidCents: number; owedCents: number; creditedCents: number; owedDates: string[] }) =>
    [money(p.billedCents), p.creditedCents ? `${money(p.creditedCents)} credited` : null, `${money(p.paidCents)} paid`,
      `${money(p.owedCents)} still owed${p.owedDates.length ? ` (${p.owedDates.map(shortDay).join(', ')})` : ''}`].filter(Boolean).join(' · '),
  /** The three statements of what Accept does (D2: "Accept opens …", the owner's "opening the time slot"). */
  statementOwes: (p: { what: PracticesNamed; teamName: string; cents: number; moves: readonly CreditMove[] }) => ({
    lead: `Accept opens ${p.what.the} and takes ${money(p.cents)} off what ${p.teamName} owes.`,
    rest: `${creditMovesSentence(p.moves)} Nothing more for you to do.`,
  }),
  statementPaid: (p: { what: PracticesNamed; teamName: string; cents: number }) => ({
    lead: `Accept opens ${p.what.the}. ${p.teamName} has paid its bill, so the club owes it ${money(p.cents)}.`,
    rest: 'It waits in Payment requests until you record paying it.',
  }),
  statementBoth: (p: { what: PracticesNamed; teamName: string; creditCents: number; payCents: number }) => ({
    lead: `Accept opens ${p.what.the}, takes ${money(p.creditCents)} off what ${p.teamName} still owes, and the club owes it the other ${money(p.payCents)}.`,
    rest: `${p.teamName} has nothing left to pay on it; the ${money(p.payCents)} waits in Payment requests until you record paying it.`,
  }),
  /** The quiet line: what the open time costs the club. */
  quietLine: (p: { what: PracticesNamed; cents: number; lineName: string | null }) =>
    `Unless another team takes ${p.what.these}, the club recovers ${money(p.cents)} less of the permit’s cost${p.lineName ? ` on ${p.lineName}` : ''}.`,
  answerFoot: (teamName: string) => `${teamName}’s coaches are told either way.`,
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
  declineTitle: (teamName: string) => `Decline ${teamName}’s hand-back?`,
  declineField: 'Why (optional)',
  declinePlaceholder: 'For example: nobody else can use March',
  declineHint: (what: PracticesNamed, teamName: string) => `The coach reads this. ${cap(what.the)} ${what.stay} ${teamName}’s.`,
  declineKeep: 'Keep it waiting',
  declineConfirm: 'Decline',
  declining: 'Declining…',
  declined: (teamName: string, what: PracticesNamed) => `Declined. ${cap(what.the)} ${what.stay} ${teamName}’s, and their coaches are told.`,
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
    body: `${p.scheduleName}: ${p.first === p.last ? formatShortWeekdayDate(p.first) : `${formatShortWeekdayDate(p.first)} – ${formatShortWeekdayDate(p.last)}`}. ${p.count === 1 ? 'The practice stays' : 'The practices stay'} ${p.teamName}’s until someone who holds the club’s Accounting answers.`,
  }),
  bellWithdrawn: (p: { teamName: string; count: number; scheduleName: string }) => ({
    title: `${p.teamName} withdrew its hand-back`,
    body: `${p.scheduleName}: ${namePractices(p.count, null).the} ${namePractices(p.count, null).stay} ${p.teamName}’s.`,
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
} as const;

/** What Accept does — the one of the three statements that is true (Ask 5): off what the team owes, the club
 *  owes it, or both. */
export function acceptStatement(p: { what: PracticesNamed; teamName: string; creditCents: number; payCents: number; moves: readonly CreditMove[] }) {
  const W = HAND_BACK_WORDS;
  if (p.payCents === 0) return W.statementOwes({ what: p.what, teamName: p.teamName, cents: p.creditCents, moves: p.moves });
  if (p.creditCents === 0) return W.statementPaid({ what: p.what, teamName: p.teamName, cents: p.payCents });
  return W.statementBoth(p);
}

/** The page's sentence once Accept has landed — the same three ways. */
export function acceptedNotice(p: { teamName: string; what: PracticesNamed; creditCents: number; payCents: number }): string {
  const W = HAND_BACK_WORDS;
  if (p.payCents === 0) return W.acceptedOwes(p.teamName, p.what, p.creditCents);
  if (p.creditCents === 0) return W.acceptedPaid(p.teamName, p.what, p.payCents);
  return W.acceptedBoth(p.teamName, p.what, p.creditCents, p.payCents);
}
