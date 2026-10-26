/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * WHAT THE REGISTRATIONS SCREEN DECIDES, AS PURE FUNCTIONS (Club Tier Stage 9b-2, Part 3; copy HOUSE_LEAGUE_STAGE9B2_COPY.md
 * §1, §2, §6). The screen draws; this module answers: which tab a registration is on, what its Fee cell says, which actions
 * its row and the member's rights allow, which bulk actions a tab offers, how a batch's refusals are grouped into one
 * sentence, and what a division has room for. No fetch, no React, no date read from the clock: `today` is the club's day
 * the server sent, so the same inputs read the same on every screen and in the test.
 *
 * Money is read ONE way: `feeState` (lib/league-money.ts). This module only words its answer.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import type { LeagueRegistration, LeagueRegistrationStatus } from './types';
import {
  feeState, formatLeagueMoney, isOwing, lastPayment, receivedOf,
  type FeeState, type LeagueMoneyLine,
} from './league-money';
import { leaguePrice, registrationOwes, type LeaguePrice } from './league-price';
import { formatStoredDate, orgDayKey } from './timezone';
import { BULK_WORDS, CARD_REFUND_WORDS, END_WORDS, REGS_WORDS, MONEY_REFUSAL, REG_RECORD_WORDS, paymentMethodWord } from './house-league-money-words';
import { clockOf, isBank, isShown, newestFirst, refundBase, refundState, refundTarget, type CardRefund } from './league-card-refunds';
import { leagueUnrecordedWhy } from './online-payment-words';

// ── What the screen reads ───────────────────────────────────────────────────────────────────────

/** A price changed on a registration (a correction, or a move that repriced it). */
export interface PriceChange {
  registrationId: string;
  kind: 'corrected' | 'moved';
  oldAmount: number | null;
  newAmount: number;
  reason: string | null;
  changedAt: string;
  /** The refund line a correction below what was paid wrote (12c: matched to its card refund, if it went to the card). */
  refundEntryId?: string | null;
}

/** The season facts the screen needs (the season GET, narrowed). */
export interface RegsSeason {
  id: string;
  name: string;
  status: string;
  registrationFee: number | null;
  owingAmberDays: number;
  autoPromoteWaitlist: boolean;
  autoApproveUnderCapacity: boolean;
  earlyBirdUntil: string | null;
}

/** A division as the season GET returns it, with the counts the room is worked out from. */
export interface RegsDivision {
  id: string;
  name: string;
  capacity: number | null;
  price: number | null;
  earlyPrice: number | null;
  /** Children holding a spot (accepted, or accepted and paid). */
  heldCount: number;
  waitlistCount: number;
}

/** Everything the registrations GET returns. */
export interface RegsRead {
  registrations: LeagueRegistration[];
  money: Record<string, LeagueMoneyLine[]>;
  priceChanges: PriceChange[];
  /** The club's day. */
  today: string;
  /** 12b: the club takes card payments, so owing rows can be emailed their pay link. */
  payLinks?: boolean;
  /** 12b: card payments that couldn't go on a registration, by registration (the refund door). */
  unrecordedCard?: Record<string, { itemId: string; amount: number }[]>;
  /** 12b: booked card refunds Stripe returned, by registration ("sent another way"). */
  returnedRefunds?: Record<string, { refundId: string; amount: number }[]>;
  /** 12c: every card refund, by registration (the Fee cell, the record's "To the card" block, the history). */
  cardRefunds?: Record<string, CardRefund[]>;
}

// ── Words about a person and a day ──────────────────────────────────────────────────────────────

export const playerName = (r: Pick<LeagueRegistration, 'playerFirstName' | 'playerLastName'>) =>
  `${r.playerFirstName} ${r.playerLastName}`.trim();

export const guardianName = (r: Pick<LeagueRegistration, 'guardianFirstName' | 'guardianLastName'>) =>
  `${r.guardianFirstName} ${r.guardianLastName}`.trim();

/** "Oct 24"; "Oct 24, 2025" only when the year is not the club's current year (copy §0). */
export function regDay(value: string | null | undefined, today: string): string {
  if (!value) return '—';
  const day = value.length > 10 ? orgDayKey(value) : value;
  return formatStoredDate(day, { withYear: day.slice(0, 4) !== today.slice(0, 4) });
}

/** A reason shown in a cell is clipped; the whole one is in the row's record. */
export function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** A method as a short word on a staff line: the label, or nothing when it was not recorded. */
const how = (m: string | null | undefined) => (m ? paymentMethodWord(m) : null);
/** How a payment arrived, and a card payment's receipt after it (12b copy §5: "Online, card · receipt 1043"). */
const howOf = (l: { method: string | null; receiptNo?: number | null }) => {
  const word = how(l.method);
  return word && l.receiptNo ? `${word} · ${REGS_WORDS.fee.receipt(l.receiptNo)}` : word;
};

// ── The tabs ────────────────────────────────────────────────────────────────────────────────────

export type RegTab = 'review' | 'active' | 'waitlist' | 'ended';
export const REG_TABS: readonly RegTab[] = ['review', 'active', 'waitlist', 'ended'];

export function regTab(status: LeagueRegistrationStatus): RegTab {
  return status === 'pending_review' ? 'review'
    : status === 'active' ? 'active'
      : status === 'waitlisted' ? 'waitlist'
        : 'ended';
}

export const isRegTab = (v: string | null | undefined): v is RegTab => !!v && (REG_TABS as readonly string[]).includes(v);

/** A registration that can still change (not declined or withdrawn). */
export const isOpenReg = (r: Pick<LeagueRegistration, 'status'>) => r.status !== 'declined' && r.status !== 'withdrawn';

/** The Ended tab says which ending it was (a release is stored as Withdrawn with a mark). */
export function endedKind(r: Pick<LeagueRegistration, 'status' | 'spotReleased'>): 'declined' | 'withdrawn' | 'released' {
  return r.status === 'declined' ? 'declined' : r.spotReleased ? 'released' : 'withdrawn';
}

// ── The Fee cell ────────────────────────────────────────────────────────────────────────────────

export interface FeeCellParts {
  kind: FeeState['kind'];
  /** The primary line, or null (an ended registration with nothing paid has no fee line). */
  primary: string | null;
  sub: string | null;
  /** Green when received, amber only when late, else the plain ink. */
  tone: 'good' | 'warn' | 'plain';
  /** 12c: a card refund the card's bank sent back — the amber pill in place of the primary line, and the desk's door
   *  ("Record the refund sent another way"). */
  alert: { text: string; aria: string; refundId: string } | null;
  /** The dotted third line: a price correction (its card refund when it went to the card), or a card refund that never
   *  entered the book. `refundId` makes a failed correction refund the same door as the pill. */
  third: { text: string; tip: string; tone: 'plain' | 'warn'; refundId: string | null } | null;
  state: FeeState;
}

export function feeCell(
  reg: LeagueRegistration,
  season: Pick<RegsSeason, 'registrationFee' | 'owingAmberDays'>,
  lines: readonly LeagueMoneyLine[],
  today: string,
  changes: readonly PriceChange[],
  cardRefunds: readonly CardRefund[] = [],
): FeeCellParts {
  const state = feeState(reg, season, lines, today);
  const F = REGS_WORDS.fee;
  const C = CARD_REFUND_WORDS.cell;
  const money = formatLeagueMoney;
  let primary: string | null = null;
  let sub: string | null = null;
  let tone: FeeCellParts['tone'] = 'plain';

  switch (state.kind) {
    case 'free': primary = F.free; break;
    case 'review':
      primary = F.nothingOwed; sub = F.onceAccepted(money(state.price)); break;
    case 'waitlist': primary = F.nothingOwed; break;
    case 'owing':
      if (state.acceptedDay == null || state.days == null) { primary = F.owing(money(state.owing)); break; }
      if (state.days === 0) { primary = F.owing(money(state.owing)); sub = F.acceptedToday; break; }
      primary = F.owingDays(money(state.owing), state.days);
      sub = F.accepted(regDay(state.acceptedDay, today));
      if (state.late) tone = 'warn';
      break;
    case 'part':
      primary = F.part(money(state.received), money(state.owing));
      sub = F.lastReceived(regDay(state.last.day, today), howOf(state.last));
      break;
    case 'received':
      primary = F.received(money(state.received));
      sub = state.last ? F.on(regDay(state.last.day, today), howOf(state.last)) : null;
      tone = 'good';
      break;
    case 'refunded':
      primary = F.refunded(money(state.refunded));
      sub = F.on(regDay(state.last.day, today), howOf(state.last));
      break;
    case 'kept':
      // 12c words §1: a part refund with the rest kept names both; the reason moves to the record.
      if (state.refunded && state.lastRefund) {
        primary = C.keptAndRefunded(money(state.kept), money(state.refunded));
        sub = F.on(regDay(state.lastRefund.day, today), howOf(state.lastRefund));
        break;
      }
      primary = F.kept(money(state.kept));
      sub = state.reason ? clip(state.reason, 60) : null;
      break;
    case 'endedNone': break;
  }
  // 12b copy §5: an owing row the desk emailed the pay link reads when it was sent.
  if (state.kind === 'owing' && reg.payLinkSentAt) sub = F.linkSent(regDay(reg.payLinkSentAt.slice(0, 10), today));

  // ── 12c: a refund to the card is on the registration (words §1). A club with no card refund reads today's cell. ──
  const refunds = newestFirst(cardRefunds.filter(isShown));
  const byEntry = new Map(refunds.filter(r => r.entryId).map(r => [r.entryId as string, r]));
  /** What the second line says after the day: "$156.75 to the card", "· pending", "· made in Stripe". */
  const cardHow = (r: CardRefund) => {
    const s = refundState(r);
    if (s === 'anotherWay') return C.sentAnotherWay;
    const to = C.toTarget(money(r.amount), isBank(r));
    return s === 'pending' ? `${to} · ${C.pending}` : r.origin === 'stripe_dashboard' ? `${to} · ${C.madeInStripe}` : to;
  };
  const cardDay = (r: CardRefund, bookDay: string | null) =>
    regDay(refundState(r) === 'anotherWay' ? r.succeededAt : bookDay ?? r.succeededAt ?? r.createdAt, today);
  const failedSub = (r: CardRefund) => C.failedSub(C.toTarget(money(r.amount), isBank(r)), regDay(r.failedAt ?? r.createdAt, today));

  // The latest refund line on the second line, when it went to the card.
  const lastOut = state.kind === 'refunded' ? state.last : state.kind === 'kept' ? state.lastRefund ?? null : null;
  const onCard = lastOut ? byEntry.get(lastOut.id) : undefined;
  if (onCard && lastOut) sub = F.on(cardDay(onCard, lastOut.day), cardHow(onCard));

  // A correction whose difference went to the card reads the card's state on the third line.
  const latest = changes
    .filter(c => c.kind === 'corrected')
    .sort((a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt))
    .at(-1);
  const correctionCard = latest?.refundEntryId ? byEntry.get(latest.refundEntryId) : undefined;

  // A refund the card sent back (not one a correction's third line already carries) is the amber pill.
  const failed = refunds.find(r => refundState(r) === 'failed' && r !== correctionCard);
  let alert: FeeCellParts['alert'] = null;
  if (failed) {
    alert = { text: C.failed(isBank(failed)), aria: C.failedAria(isBank(failed)), refundId: failed.id };
    primary = null;
    sub = failedSub(failed);
    tone = 'plain';
  }

  // A card payment that never went on the registration, refunded: on the row anyway (words §1, "Never in the book").
  const neverBooked = refunds.filter(r => !r.inBook && !r.entryId);
  const nb = neverBooked[0];
  if (nb && state.kind === 'endedNone' && !alert) {
    primary = F.refunded(money(refundBase(nb)));
    sub = F.on(cardDay(nb, null), cardHow(nb));
  }

  let third: FeeCellParts['third'] = null;
  if (latest && correctionCard) {
    const s = refundState(correctionCard);
    const amount = money(refundBase(correctionCard));
    const bank = isBank(correctionCard);
    third = {
      text: s === 'failed' ? C.correctedFailed(amount, bank) : s === 'pending' ? C.correctedPending(amount, bank) : C.corrected(amount, bank),
      tip: C.correctedTip(latest.oldAmount != null ? money(latest.oldAmount) : '—', money(latest.newAmount), regDay(latest.changedAt, today),
        latest.reason ?? '', amount, cardDay(correctionCard, null), bank),
      tone: s === 'failed' ? 'warn' : 'plain',
      refundId: s === 'failed' ? correctionCard.id : null,
    };
  } else if (nb) {
    const paid = nb.paidAt ?? nb.createdAt;
    const back = nb.succeededAt ?? nb.createdAt;
    third = {
      text: C.neverBooked[nb.landError ?? ''] ?? C.neverBooked.other,
      tip: C.neverBookedTip(regDay(paid, today), clockOf(paid), leagueUnrecordedWhy(nb.landError ?? ''), regDay(back, today), clockOf(back), isBank(nb)),
      tone: 'plain', refundId: null,
    };
  } else if (latest) {
    third = {
      text: F.corrected(clip(latest.reason ?? '', 50)),
      tip: F.correctedTip(latest.oldAmount != null ? money(latest.oldAmount) : '—', money(latest.newAmount), regDay(latest.changedAt, today), latest.reason ?? ''),
      tone: 'plain', refundId: null,
    };
  }

  return { kind: state.kind, primary, sub, tone, alert, third, state };
}

/** The phone row's detail line: division · fee line · fee sub-line (copy §1.3). */
export function phoneDetail(division: string | null, team: string | null, fee: FeeCellParts): string {
  return [division, team, fee.alert?.text ?? fee.primary, fee.sub].filter(Boolean).join(' · ');
}

// ── Who can do what to a row ────────────────────────────────────────────────────────────────────

export interface RegRights {
  /** Work registrations (approve, waitlist, decline, withdraw, add). Off on a finished season. */
  register: boolean;
  /** Take fees, undo, correct a price. Open on a finished season. */
  takeFees: boolean;
  /** Move a child to another division (the runner roles; the registrar does not see it). */
  run: boolean;
  email: boolean;
  /** 12b: the club takes card payments, so an owing row can be emailed its pay link (the desk's, with takeFees). */
  payLinks?: boolean;
}

export type RowActionKey =
  | 'approve' | 'markReceived' | 'promote' | 'move' | 'correct' | 'release' | 'withdraw' | 'decline' | 'email' | 'undo' | 'waitlist'
  | 'payLink' | 'refundCard' | 'refundAnotherWay';

/** The ⋯ menu's order (copy §1.5). */
const MENU_ORDER: readonly RowActionKey[] = [
  'approve', 'markReceived', 'payLink', 'move', 'correct', 'release', 'withdraw', 'decline', 'email', 'undo', 'waitlist', 'promote',
];

/**
 * What a row offers: the ONE primary the tab names, and `all` — every action the row and the member's rights allow, in the
 * menu's order (the phone's sheet lists them all; a desk menu leaves the primary out). An item the row cannot use is not
 * drawn: absent beats disabled.
 */
export function rowActions(
  reg: LeagueRegistration,
  fee: FeeState,
  lines: readonly LeagueMoneyLine[],
  rights: RegRights,
): { primary: RowActionKey | null; all: RowActionKey[] } {
  const has = new Set<RowActionKey>();
  const owing = isOwing(fee);
  const latest = lastPayment(lines);
  const paidSomething = latest != null;
  if (reg.status === 'pending_review') {
    if (rights.register) { has.add('approve'); has.add('decline'); has.add('waitlist'); }
    if (rights.run) has.add('move');
  } else if (reg.status === 'active') {
    if (rights.takeFees && owing) has.add('markReceived');
    if (rights.takeFees && owing && rights.payLinks) has.add('payLink');
    if (rights.run) has.add('move');
    if (rights.takeFees && (owing || fee.kind === 'received')) has.add('correct');
    if (rights.register && owing) has.add('release');
    if (rights.register) { has.add('withdraw'); has.add('decline'); has.add('waitlist'); }
    // A card payment really arrived: it comes off only by a refund, never Undo (12b, drawings m4; the writer refuses it too).
    if (rights.takeFees && paidSomething && latest.method !== 'online_card') has.add('undo');
  } else if (reg.status === 'waitlisted') {
    if (rights.register) { has.add('promote'); has.add('decline'); }
    if (rights.run) has.add('move');
  }
  if (rights.email) has.add('email');
  const primary: RowActionKey | null = has.has('approve') ? 'approve'
    : has.has('markReceived') ? 'markReceived'
      : has.has('promote') ? 'promote'
        : null;
  return { primary, all: MENU_ORDER.filter(k => has.has(k)) };
}

export type BulkKey = 'approve' | 'promote' | 'waitlist' | 'markReceived' | 'move' | 'email' | 'payLink';

/** The bulk actions a tab can use, in the bar's order (copy §2). Decline and Withdraw are one at a time. */
export function bulkActions(tab: RegTab, rights: RegRights, charges: boolean): BulkKey[] {
  const out: BulkKey[] = [];
  if (tab === 'review' && rights.register) out.push('approve');
  if (tab === 'waitlist' && rights.register) out.push('promote');
  // On Active the lead — the worded action on a phone's dock, the first button on a desk's bar — is Mark received.
  if (tab === 'active' && rights.takeFees && charges) out.push('markReceived');
  // 12b: owing families emailed their pay link, one email per family, while the club takes card payments.
  if (tab === 'active' && rights.takeFees && charges && rights.payLinks) out.push('payLink');
  if ((tab === 'review' || tab === 'active') && rights.register) out.push('waitlist');
  if (tab !== 'ended' && rights.run) out.push('move');
  if (rights.email) out.push('email');
  return out;
}

// ── Narrowing the list ──────────────────────────────────────────────────────────────────────────

export function matchesSearch(r: LeagueRegistration, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [playerName(r), guardianName(r), r.guardianEmail].some(s => s.toLowerCase().includes(q));
}

/** The Fee filter: several picks widen it (any of them). */
export function matchesFee(fee: FeeState, picks: ReadonlySet<string>): boolean {
  if (picks.size === 0) return true;
  return (picks.has('owing') && isOwing(fee))
    || (picks.has('received') && fee.kind === 'received')
    || (picks.has('refunded') && fee.kind === 'refunded');
}

// ── The Filter's three groups (owner, 2026-10-26: Team · Fee · Flags) ─────────────────────────────

export type RegFilterGroup = 'team' | 'fee' | 'flags';
export type RegFilterPicks = Readonly<Record<RegFilterGroup, ReadonlySet<string>>>;
export type RegFlag = 'asked' | 'late' | 'noPayLink' | 'notes';
/** The Team group's first row: a child on no team. Any other Team key is a team's id. */
export const NOT_PLACED = 'notPlaced';
export const NO_PICKS: RegFilterPicks = { team: new Set(), fee: new Set(), flags: new Set() };

/**
 * What the Filter offers on a tab. Team is the Active tab's (nobody in review or waiting is on a team), and lists the teams
 * only once a division is picked — every age group has its own Blue Jays. Fee and the two money flags need a season that
 * charges; "Pay link not sent" also needs the club to take cards. A group with no options is absent.
 */
export function regFilterOffer(tab: RegTab, o: { charges: boolean; payLinks: boolean; teamIds: readonly string[] }): Record<RegFilterGroup, string[]> {
  return {
    team: tab === 'active' ? [NOT_PLACED, ...o.teamIds] : [],
    fee: o.charges ? ['owing', 'received', ...(tab === 'ended' ? ['refunded'] : [])] : [],
    flags: [
      ...(tab !== 'ended' ? ['asked'] : []),
      ...(tab === 'active' && o.charges ? ['late'] : []),
      ...(tab === 'active' && o.charges && o.payLinks ? ['noPayLink'] : []),
      ...(tab !== 'ended' ? ['notes'] : []),
    ],
  };
}

/** A row's flags. "Late" is the row's own amber (owing, past the season's days); a pay link counts once it was ever sent. */
export function regFlags(r: LeagueRegistration, fee: FeeState): Set<RegFlag> {
  const f = new Set<RegFlag>();
  if (isOpenReg(r) && r.withdrawRequestedAt) f.add('asked');
  if (fee.kind === 'owing' && fee.late) f.add('late');
  if (isOwing(fee) && !r.payLinkSentAt) f.add('noPayLink');
  if (r.playerNotes?.trim()) f.add('notes');
  return f;
}

/** One group's test on one row. Several picks in a group widen it (any of them); no picks admit everything. */
export function matchesGroup(group: RegFilterGroup, picks: ReadonlySet<string>, r: LeagueRegistration, fee: FeeState): boolean {
  if (picks.size === 0) return true;
  if (group === 'fee') return matchesFee(fee, picks);
  if (group === 'team') return picks.has(r.teamId ?? NOT_PLACED);
  const flags = regFlags(r, fee);
  return [...picks].some(k => flags.has(k as RegFlag));
}

/** Every group but `except` (the counts' base: what ticking a choice would list, given the OTHER groups' ticks). */
export function matchesPicks(picks: RegFilterPicks, r: LeagueRegistration, fee: FeeState, except?: RegFilterGroup): boolean {
  return (['team', 'fee', 'flags'] as const).every(g => g === except || matchesGroup(g, picks[g], r, fee));
}

/** Each offered choice's count: the rows ticking it would list, given the other groups' ticks (Filter Counts D5). */
export function regFilterCounts(
  rows: readonly LeagueRegistration[], stateOf: (r: LeagueRegistration) => FeeState, picks: RegFilterPicks,
  offer: Record<RegFilterGroup, readonly string[]>,
): Record<RegFilterGroup, Map<string, number>> {
  const out = { team: new Map<string, number>(), fee: new Map<string, number>(), flags: new Map<string, number>() };
  for (const g of ['team', 'fee', 'flags'] as const) {
    for (const k of offer[g]) out[g].set(k, 0);
    for (const r of rows) {
      const fee = stateOf(r);
      if (!matchesPicks(picks, r, fee, g)) continue;
      for (const k of offer[g]) if (matchesGroup(g, new Set([k]), r, fee)) out[g].set(k, out[g].get(k)! + 1);
    }
  }
  return out;
}

/** The first child waiting in a division (the one an ended spot moves up), by their place in line. */
export function firstWaiting(regs: readonly LeagueRegistration[], divisionId: string | null, exceptId?: string): LeagueRegistration | null {
  if (!divisionId) return null;
  return regs
    .filter(r => r.status === 'waitlisted' && r.divisionId === divisionId && r.id !== exceptId)
    .sort((a, b) => (a.waitlistPosition ?? 9999) - (b.waitlistPosition ?? 9999))[0] ?? null;
}

// ── Room and price in a division ────────────────────────────────────────────────────────────────

/** Spots left, or null where the division has no limit. */
export function spotsLeft(d: Pick<RegsDivision, 'capacity' | 'heldCount'>): number | null {
  return d.capacity == null ? null : Math.max(0, d.capacity - d.heldCount);
}

/**
 * What a sign-up on `day` (a plain YYYY-MM-DD) would pay in `division`. For a child already signed up, pass the day they
 * signed up (`orgDayKey(reg.registeredAt)`): an early bird still applies.
 */
export function priceOn(
  division: Pick<RegsDivision, 'price' | 'earlyPrice'>,
  season: Pick<RegsSeason, 'registrationFee' | 'earlyBirdUntil'>,
  day: string,
): LeaguePrice | null {
  return leaguePrice({ price: division.price, earlyPrice: division.earlyPrice }, season, day);
}

/** The price a registration owes now (its recorded one, else the season's); 0 when there is none. */
export const owesNow = (reg: Pick<LeagueRegistration, 'feeAmount'>, season: Pick<RegsSeason, 'registrationFee'>) =>
  registrationOwes(reg, season) ?? 0;

/** Does the season charge anything at all? A free season has no Fee column and no Fee filter. */
export function seasonHasFees(season: Pick<RegsSeason, 'registrationFee'>, divisions: readonly Pick<RegsDivision, 'price'>[]): boolean {
  if (divisions.length === 0) return (season.registrationFee ?? 0) > 0;
  return divisions.some(d => ((d.price ?? season.registrationFee) ?? 0) > 0);
}

// ── A batch: the refusals grouped into one sentence ─────────────────────────────────────────────

export type BulkVerb = 'approve' | 'promote' | 'waitlist' | 'markReceived' | 'move';

/** A refusal as the PATCH route answers it. */
export interface Refusal { status: number; code: string | null; error: string }

export type WhyKey = 'full' | 'received' | 'free' | 'notAccepted' | 'noDivision' | 'ended' | 'same' | 'other';
export interface Why { key: WhyKey; /** The division named (full, same). */ division?: string; /** The server's own words (other). */ error?: string }

/** Why one row stayed, from the route's refusal (copy §2.2). `free` says the fee had nothing to receive. */
export function whyOf(refusal: Refusal, ctx: { division: string | null; free: boolean }): Why {
  switch (refusal.code) {
    case 'division_full': return { key: 'full', division: ctx.division ?? undefined };
    case 'ended': return { key: 'ended' };
    case 'not_accepted': return { key: 'notAccepted' };
    case 'already_received': return { key: ctx.free ? 'free' : 'received' };
    default:
      if (refusal.status === 422) return { key: 'noDivision' };
      return { key: 'other', error: refusal.error };
  }
}

export interface WhyTally { key: WhyKey; count: number; divisions: string[]; error?: string }

/** The reasons, counted: one entry per reason (and per distinct server sentence). */
export function tallyWhy(whys: readonly Why[]): WhyTally[] {
  const out = new Map<string, WhyTally>();
  for (const w of whys) {
    const id = w.key === 'other' ? `other:${w.error}` : w.key === 'same' ? `same:${w.division}` : w.key;
    const at = out.get(id) ?? { key: w.key, count: 0, divisions: [], error: w.error };
    at.count += 1;
    if (w.division && !at.divisions.includes(w.division)) at.divisions.push(w.division);
    out.set(id, at);
  }
  return [...out.values()];
}

/** "Division A is full" · "2 are full in Division C; 1 was already received". */
export function reasonsLine(tally: readonly WhyTally[]): string {
  const W = BULK_WORDS.why;
  const several = tally.length > 1;
  const counted = (t: WhyTally, phrase: string) => (several ? W.counted(t.count, phrase) : phrase);
  return tally.map(t => {
    switch (t.key) {
      case 'full': return several ? W.fullN(t.count, t.divisions) : W.full(t.divisions.length ? t.divisions : ['The division']);
      case 'received': return counted(t, W.received);
      case 'free': return counted(t, W.free);
      case 'notAccepted': return counted(t, W.notAccepted);
      case 'noDivision': return counted(t, W.noDivision);
      case 'ended': return counted(t, W.ended);
      case 'same': return counted(t, W.sameDivision(t.divisions[0] ?? 'that division'));
      default: {
        const said = (t.error ?? 'refused').replace(/\.$/, '');
        return several ? W.counted(t.count, `refused: ${said}`) : said;
      }
    }
  }).join('; ');
}

/** The result line of a batch, and whether it stays until dismissed (a partial result names a decision). */
export function bulkResult(p: {
  verb: BulkVerb;
  ok: number;
  tally: readonly WhyTally[];
  /** Move: the destination, and the paid children who kept their price. */
  division?: string;
  kept?: number;
}): { text: string; partial: boolean; failed: number } {
  const failed = p.tally.reduce((n, t) => n + t.count, 0);
  const D = BULK_WORDS.done;
  const why = reasonsLine(p.tally);
  let text: string;
  if (p.verb === 'move') {
    // Move names the destination, and says so when paid children kept their price.
    const to = p.division ?? '';
    text = failed ? D.move.partial(p.ok, to, failed, why) : D.move.clean(p.ok, to);
    if (p.kept) text += ` ${D.move.kept(p.kept)}`;
  } else {
    // The four status-like verbs word a clean and a partial result the same way.
    const said = D[p.verb];
    text = failed ? said.partial(p.ok, failed, why) : said.clean(p.ok);
  }
  return { text, partial: failed > 0 || (p.kept ?? 0) > 0, failed };
}

// ── The registration's record: its history, oldest facts to newest ──────────────────────────────

export interface HistoryItem { at: number; day: string; text: string }

/** Everything that happened to one registration, newest first: from the sign-up, the book's lines and the price history. */
export function registrationHistory(
  reg: LeagueRegistration,
  lines: readonly LeagueMoneyLine[],
  changes: readonly PriceChange[],
  today: string,
  cardRefunds: readonly CardRefund[] = [],
): HistoryItem[] {
  const H = REG_RECORD_WORDS.timeline;
  const CH = CARD_REFUND_WORDS.history;
  const money = formatLeagueMoney;
  const items: HistoryItem[] = [];
  const add = (iso: string | null | undefined, text: string, day?: string) => {
    if (!iso) return;
    items.push({ at: Date.parse(iso), day: regDay(day ?? iso, today), text });
  };
  // 12c words §2: a refund to the card keeps the book's figure first and adds the card's.
  const refunds = cardRefunds.filter(isShown);
  const byEntry = new Map(refunds.filter(r => r.entryId).map(r => [r.entryId as string, r]));
  add(reg.registeredAt, reg.source === 'admin_manual' ? H.byHand : H.registered);
  if (reg.acceptedAt) add(reg.acceptedAt, H.accepted);
  for (const l of lines) {
    if (l.status === 'void') { add(l.createdAt, H.voided(money(l.amount)), l.day); continue; }
    if (l.status !== 'posted') continue;
    const card = l.dir === 'out' ? byEntry.get(l.id) : undefined;
    if (card) {
      const [booked, amount, to, bank] = [money(l.amount), money(card.amount), refundTarget(card), isBank(card)];
      const s = refundState(card);
      add(l.createdAt, s === 'pending' ? CH.pending(booked, amount, to)
        : card.origin === 'stripe_dashboard' ? CH.stripe(booked, amount, to)
          : card.succeededAt && s === 'refunded' ? CH.reached(booked, amount, to, bank) : CH.refund(booked, amount, to), l.day);
      continue;
    }
    add(l.createdAt, l.dir === 'in' ? H.received(money(l.amount), how(l.method)) : H.refund(money(l.amount), how(l.method)), l.day);
  }
  for (const r of refunds) {
    if (!r.entryId && !r.inBook) add(r.succeededAt ?? r.createdAt, CH.neverBooked(money(r.amount), refundTarget(r)));
    if (r.failedAt) add(r.failedAt, CH.failed(money(r.amount), refundTarget(r), isBank(r)));
    if (r.sentAnotherWay) add(r.succeededAt, CH.anotherWay(money(r.amount)));
  }
  for (const c of changes) {
    add(c.changedAt, c.kind === 'corrected'
      ? H.corrected(c.oldAmount != null ? money(c.oldAmount) : '—', money(c.newAmount), c.reason ?? '')
      : H.moved(c.oldAmount != null ? money(c.oldAmount) : '—', money(c.newAmount)));
  }
  if (reg.endedAt && !isOpenReg(reg)) {
    add(reg.endedAt, H.ended[endedKind(reg)]);
    if (reg.endMoney === 'kept') add(reg.endedAt, H.kept(money(receivedOf(lines)), reg.endMoneyReason ?? ''));
  }
  return items.sort((a, b) => b.at - a.at);
}

// ── The ending window's first-waiting line ──────────────────────────────────────────────────────

/**
 * What an ending says about the waitlist (copy §4.3): the next child's name when the season moves the waitlist up on its
 * own and the ended child held a spot; the manual line when someone waits and the season does not; nothing otherwise.
 */
export function endWaitlistLine(
  reg: LeagueRegistration,
  regs: readonly LeagueRegistration[],
  autoPromote: boolean,
): string | null {
  const heldASpot = reg.status === 'active' || reg.status === 'pending_review';
  if (!heldASpot) return null;
  const next = firstWaiting(regs, reg.divisionId, reg.id);
  if (!next) return null;
  return autoPromote ? END_WORDS.waitlistNext(next.playerFirstName) : END_WORDS.waitlistManual;
}

/**
 * The refusal for a refund's date (an ending's refund, or a price lowered on a paid registration), or null when it stands:
 * a date, not after today, not before the payment it returns. The same words the route refuses with.
 */
export function refundDayError(day: string, today: string, lastPaymentDay: string | null): string | null {
  if (!day) return MONEY_REFUSAL.date;
  if (day > today) return MONEY_REFUSAL.futureRefund;
  if (lastPaymentDay && day < lastPaymentDay) return MONEY_REFUSAL.beforePayment;
  return null;
}

/** The refusal for the date a fee was received (a date, not after today), or null when it stands. */
export function receiveDayError(day: string, today: string): string | null {
  if (!day) return MONEY_REFUSAL.date;
  if (day > today) return MONEY_REFUSAL.futurePayment;
  return null;
}

/** A typed price in dollars: 0 or more, at most two decimals, at most $100,000 — or null (the route's own rule). */
export function parsePrice(text: string): number | null {
  const t = text.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n <= 100000 ? Math.round(n * 100) / 100 : null;
}
