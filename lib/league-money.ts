/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * A HOUSE-LEAGUE REGISTRATION'S MONEY, READ ONE WAY (Club Tier Stage 9b-2; plan §2 "Paid is its own fact, read through one
 * function", §0e).
 *
 * The book is the truth: every payment is a line in, every refund its own line out (mig 368, `club_league_money`). This
 * module turns a registration, its season and its lines into the two things every screen shows — the Fee cell's state and
 * the season's band — so Registrations, the Money page, the Overview tiles and the family's record can never disagree.
 *
 *   - What a child owes is the price FIXED on the registration (`registrationOwes`), and only once accepted (Q1).
 *   - Received is posted money in, less posted money out. A voided line (Undo) counts nowhere.
 *   - "Owing N days" counts from the accepted-at fact in the club's day; a registration accepted before that fact existed
 *     has no day count and never turns amber (§0e — no date is invented).
 *
 * Pure: no I/O, safe on the client. Tested in tests/unit/league-money.test.ts.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { registrationOwes } from './league-price';
import { daysBetweenDateStrings, orgDayKey } from './timezone';

/** One book line of one registration (accounting_entries with source 'league_registration'). */
export interface LeagueMoneyLine {
  id: string;
  regId: string;
  /** 'in' = a payment received; 'out' = a refund. */
  dir: 'in' | 'out';
  amount: number;
  /** The club's day the money moved (YYYY-MM-DD). */
  day: string;
  method: string | null;
  status: 'posted' | 'pending' | 'void';
  /** A refund's reason, a void's reason. */
  note: string | null;
  createdAt: string;
}

export interface LeagueMoneyReg {
  id: string;
  status: 'pending_review' | 'active' | 'waitlisted' | 'declined' | 'withdrawn';
  feeAmount: number | null;
  acceptedAt: string | null;
  endedAt: string | null;
  spotReleased: boolean;
  endMoney: 'refunded' | 'kept' | null;
  endMoneyReason: string | null;
}

export interface LeagueMoneySeason { registrationFee: number | null; owingAmberDays: number }

export type FeeState =
  | { kind: 'free' }
  | { kind: 'review'; price: number }
  | { kind: 'waitlist' }
  | { kind: 'owing'; owing: number; price: number; acceptedDay: string | null; days: number | null; late: boolean }
  | { kind: 'part'; received: number; owing: number; last: LeagueMoneyLine }
  | { kind: 'received'; received: number; last: LeagueMoneyLine | null }
  | { kind: 'refunded'; refunded: number; last: LeagueMoneyLine }
  | { kind: 'kept'; kept: number; reason: string }
  | { kind: 'endedNone' };

const cents = (n: number) => Math.round(n * 100);
const dollars = (c: number) => c / 100;

/** "$150", "$150.50", "$1,200"; a negative reads "−$150" (a real minus, before the sign). Copy §0. */
export function formatLeagueMoney(n: number): string {
  const c = cents(n);
  const whole = c % 100 === 0;
  const s = (Math.abs(c) / 100).toLocaleString('en-CA', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
  return `${c < 0 ? '−' : ''}$${s}`;
}

/** Posted money in, less posted money out, in dollars (cent-exact). */
export function receivedOf(lines: readonly LeagueMoneyLine[]): number {
  let c = 0;
  for (const l of lines) if (l.status === 'posted') c += l.dir === 'in' ? cents(l.amount) : -cents(l.amount);
  return dollars(c);
}

/** Posted money given back, in dollars (cent-exact). */
export function refundedOf(lines: readonly LeagueMoneyLine[]): number {
  let c = 0;
  for (const l of lines) if (l.status === 'posted' && l.dir === 'out') c += cents(l.amount);
  return dollars(c);
}

const latest = (lines: readonly LeagueMoneyLine[], dir: 'in' | 'out') =>
  lines.filter(l => l.status === 'posted' && l.dir === dir)
    .sort((a, b) => (a.day === b.day ? a.createdAt.localeCompare(b.createdAt) : a.day.localeCompare(b.day)))
    .at(-1) ?? null;

/** The latest payment received (posted), for the "Oct 24 · E-Transfer" sub-line and the ending window's sentence. */
export const lastPayment = (lines: readonly LeagueMoneyLine[]) => latest(lines, 'in');
/** The latest refund (posted). */
export const lastRefund = (lines: readonly LeagueMoneyLine[]) => latest(lines, 'out');

/** What this registration's fee cell says. `today` is the club's day (`tournamentToday()`). */
export function feeState(
  reg: LeagueMoneyReg,
  season: LeagueMoneySeason,
  lines: readonly LeagueMoneyLine[],
  today: string,
): FeeState {
  const price = registrationOwes(reg, season) ?? 0;
  const got = receivedOf(lines);
  if (reg.status === 'declined' || reg.status === 'withdrawn') {
    if (reg.endMoney === 'kept' && got > 0) return { kind: 'kept', kept: got, reason: reg.endMoneyReason ?? '' };
    const refund = lastRefund(lines);
    if (refund) {
      return { kind: 'refunded', refunded: refundedOf(lines), last: refund };
    }
    if (got > 0) return { kind: 'kept', kept: got, reason: reg.endMoneyReason ?? '' };
    return { kind: 'endedNone' };
  }
  if (price <= 0 && got <= 0) return { kind: 'free' };
  if (reg.status === 'waitlisted') return { kind: 'waitlist' };
  if (reg.status === 'pending_review') return { kind: 'review', price };
  const owing = dollars(Math.max(0, cents(price) - cents(got)));
  if (owing <= 0) return { kind: 'received', received: got, last: lastPayment(lines) };
  if (got > 0) return { kind: 'part', received: got, owing, last: lastPayment(lines)! };
  const acceptedDay = reg.acceptedAt ? orgDayKey(reg.acceptedAt) : null;
  const days = acceptedDay ? Math.max(0, daysBetweenDateStrings(acceptedDay, today)) : null;
  return { kind: 'owing', owing, price, acceptedDay, days, late: days != null && days >= season.owingAmberDays };
}

/** Is this registration owing (the Paid / Owing filter's "Owing")? */
export const isOwing = (s: FeeState): s is Extract<FeeState, { kind: 'owing' | 'part' }> => s.kind === 'owing' || s.kind === 'part';

export interface SeasonMoney {
  /** The price fixed on each accepted registration. */
  owed: number;
  owedPlayers: number;
  /** Posted in, less posted out, across every registration (a fee the club kept on an ended one included). */
  received: number;
  receivedPlayers: number;
  /** Money given back. */
  refunded: number;
  /** What accepted registrations still owe, player by player. */
  owing: number;
  owingPlayers: number;
}

/** The season's band: Owed · Received (net of refunds) · Still owing. */
export function seasonMoney(
  regs: readonly LeagueMoneyReg[],
  season: LeagueMoneySeason,
  linesByReg: ReadonlyMap<string, readonly LeagueMoneyLine[]>,
): SeasonMoney {
  let owed = 0, owedPlayers = 0, received = 0, receivedPlayers = 0, refunded = 0, owing = 0, owingPlayers = 0;
  for (const reg of regs) {
    const lines = linesByReg.get(reg.id) ?? [];
    const got = cents(receivedOf(lines));
    received += got;
    if (got > 0) receivedPlayers += 1;
    refunded += cents(refundedOf(lines));
    if (reg.status !== 'active') continue;
    const price = cents(registrationOwes(reg, season) ?? 0);
    if (price <= 0) continue;
    owed += price; owedPlayers += 1;
    if (price - got > 0) { owing += price - got; owingPlayers += 1; }
  }
  return {
    owed: dollars(owed), owedPlayers, received: dollars(received), receivedPlayers,
    refunded: dollars(refunded), owing: dollars(owing), owingPlayers,
  };
}
