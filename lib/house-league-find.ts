/**
 * FIND A CHILD OR A PARENT (Club Tier Stage 13e-4 A + 13e-1 A, owner 2026-11-16; drawing tab 3). On House league's home, the
 * registrar types a child, a guardian or either email and reads, on one row per registration across every running season and
 * every Registrations view: the child, division, team, season, guardian, status and what is owing, then the team's next game
 * or practice. The row opens that registration. A miss offers "Search past seasons too".
 *
 * Pure: the words, the order and each row's facts, so the route and the tests read one shape. The match is Registrations' own
 * search (`matchesSearch`), the owing is THE one Still owing rule (`stillOwingCents` after `clearingShareCents`), and the next
 * line is the schedule's own pick (`teamNextBooking` over `seasonCalendar`) — nothing here re-derives any of them.
 * ⚖ Read-only, and gated exactly as Registrations is (`houseLeagueRefusal(ctx, 'read')`): the treasurer cannot read
 * Registrations, so this search is not theirs either (no side door).
 */
import type { LeagueRegistration } from './types';
import { feeState, formatLeagueMoney, isOwing, stillOwingCents, type LeagueMoneyLine, type LeagueMoneySeason } from './league-money';
import { clearingShareCents, type RegDebit } from './league-debits';
import type { SeasonBooking } from './league-season-calendar';
import { guardianName, playerName, regTab } from './house-league-registrations';
import { MONEY_PAGE_WORDS, REGS_WORDS } from './house-league-money-words';
import { formatTime, possessive } from './utils';
import { formatInOrgZone, utcToZonedInputs } from './timezone';

/** At most this many rows, then a "Show all" row (drawing tab 3 note 5). */
export const FIND_FIRST = 8;
/** "Show all" lists up to this many (a name two hundred children share is a typo, not a call). */
export const FIND_ALL = 100;
/** Fewer characters than this read nothing (one letter matches half the club). */
export const FIND_MIN = 2;

export const FIND_WORDS = {
  label: 'Find a child or a parent',
  scope: 'every season that’s running · every tab',
  scopePast: 'every season, past ones too',
  reading: 'Looking…',
  failed: 'We couldn’t search just now.',
  retry: 'Try again',
  noTeam: 'no team yet',
  miss: (q: string) => `No child or parent matches “${q}” in a season that’s running.`,
  missPast: (q: string) => `No child or parent matches “${q}” in any season.`,
  searchPast: 'Search past seasons too',
  /** Never promises more than "Show all" lists (FIND_ALL): past it, the button and the list's foot say so. */
  showAll: (n: number) => (n > FIND_ALL ? `Show the first ${FIND_ALL} of ${n}` : `Show all ${n}`),
  capped: (shown: number, n: number) => `Showing ${shown} of ${n}. Type more of the name to narrow it.`,
  owing: (amount: string) => `${amount} owing`,
  clearing: (amount: string) => `${amount} clearing`,
  paid: 'Paid',
  nothingYet: 'Nothing owed yet',
  /** "Reds’ next: Thu, Nov 26, 6:00 p.m. · Reds vs Blues · Kinsmen Park, Diamond B" */
  next: (team: string, when: string, who: string, where: string | null) =>
    `${possessive(team)} next: ${when} · ${who}${where ? ` · ${where}` : ''}`,
  /** The row's name — Money's Still owing row says the same ("Open Ava’s registration"). */
  rowAria: MONEY_PAGE_WORDS.openChild,
} as const;

/** One result row, as the screen draws it. */
export interface FindRow {
  id: string;
  seasonId: string;
  /** The season's name; `past` when it is finished (its rows say so by the name alone). */
  season: string;
  past: boolean;
  child: string;
  division: string | null;
  /** The team's name, or null when the child is on none yet ("no team yet", no next line). */
  team: string | null;
  guardian: string;
  email: string;
  status: string;
  /** What is owing, or null when the season is free or the registration ended. */
  money: string | null;
  /** The team's next game or practice, or null (no team, or nothing ahead). */
  next: string | null;
}

/** The registration's word for where it is: the Registrations view's own name, and the waitlist says the place. */
export function findStatus(r: Pick<LeagueRegistration, 'status' | 'waitlistPosition'>): string {
  const tab = regTab(r.status);
  const word = REGS_WORDS.tab[tab];
  return tab === 'waitlist' && r.waitlistPosition != null ? `${word} ${REGS_WORDS.waitingPosition(r.waitlistPosition)}` : word;
}

/** What the row says about money: THE one Still owing (after what is clearing), never a second sum. */
export function findMoney(
  r: LeagueRegistration, season: LeagueMoneySeason, lines: readonly LeagueMoneyLine[], today: string, debit: RegDebit | null,
): string | null {
  const fee = feeState(r, season, lines, today);
  const clearing = clearingShareCents(debit);
  const left = stillOwingCents(fee, clearing);
  if (left > 0) return FIND_WORDS.owing(formatLeagueMoney(left / 100));
  if (isOwing(fee)) return FIND_WORDS.clearing(formatLeagueMoney(Math.min(clearing / 100, fee.owing)));
  if (fee.kind === 'received') return FIND_WORDS.paid;
  if (fee.kind === 'review' || fee.kind === 'waitlist') return FIND_WORDS.nothingYet;
  return null;
}

/** "Thu, Nov 26, 6:00 p.m." in the org's zone (the clock through `formatTime`, the house style's one spelling). */
function findWhen(iso: string): string {
  return `${formatInOrgZone(iso, { weekday: 'short', month: 'short', day: 'numeric' })}, ${formatTime(utcToZonedInputs(iso).time)}`;
}

/** The next line's words from the schedule's own booking. The place is the club's venue and facility, or the typed place. */
export function findNextLine(team: string, b: SeasonBooking | null): string | null {
  if (!b || !b.startMs) return null;
  const w = b.where;
  const where = [w.venueName, w.facility].filter(Boolean).join(', ') || w.text || null;
  return FIND_WORDS.next(team, findWhen(new Date(b.startMs).toISOString()), b.who, where);
}

const BY_NAME = new Intl.Collator('en-CA', { sensitivity: 'base' });

/** The order: running seasons first (in the home page's own season order), then each season's children by name. */
export function findOrder<T extends { seasonRank: number; child: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.seasonRank - b.seasonRank || BY_NAME.compare(a.child, b.child));
}

/** The child's and guardian's names, as Registrations shows them. */
export const findNames = (r: LeagueRegistration) => ({ child: playerName(r), guardian: guardianName(r) });
