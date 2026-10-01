/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB MONEY — ONE DEFINITION PER FIGURE (Club Tier Stage 3a; S3A-05, C06, J4-019, plan §4C
 * "The same figure, computed differently").
 *
 * "Collected" had four definitions on the club side and "overdue" had two, and one of the overdue
 * readers could never count one (C06). Every club surface that shows Collected, Outstanding,
 * Overdue, Next due, Sent or a book's Balance asks THIS module, and
 * `tests/unit/club-money-one-definition-guard.test.ts` fails the build when one stops doing so.
 * `scripts/check-club-money-arithmetic.mjs` recomputes these figures from rows by an independent
 * walk and fails when the two disagree.
 *
 * ⚖ THE STATE OF AN INSTALLMENT (Ask 1, owner 2026-09-30) — one answer, both sides:
 *   · received — the club has it (`paidAt`). The one moment the club's ledger is written.
 *   · sent     — the coach says the team sent it (`sentAt`); the club has not confirmed. Writes no
 *                ledger line. It is NOT overdue whatever its date: the team did its part, and the
 *                one who must act is the club.
 *   · overdue  — neither, and its due date has passed in the club's day (`isInstallmentOverdue`,
 *                the rule the Upcoming bills panel already got right; due TODAY is not overdue).
 *   · upcoming — neither, not yet due.
 *
 * ⚖ THE FIGURES:
 *   · Collected   = what the club has RECEIVED. Approved requests are not allocation money and are
 *                   not in it (3b's board summary adds them in their own line).
 *   · Outstanding = billed − collected. A "sent" installment is still outstanding: the club does not
 *                   have it yet (the coach's own bill says the same — Paid / Left mean "the club has it").
 *   · Overdue     = the overdue installments (count + amount).
 *   · Sent        = sent and waiting for the club (count + amount).
 *   · Due soon    = upcoming within the next COMING_DUE_DAYS (14 — the Overview brief's own window,
 *                   so the brief's count and Coming due's band agree).
 *   · Next due    = the earliest upcoming installment (today or later). Overdue and sent ones are
 *                   their own figures, never "next".
 *   · A book's Balance = posted money in − posted money out, ALL-TIME (one scope, so two screens can
 *                   never print two balances for one book — C14). Pending and void move nothing.
 *
 * Pure and client-safe: no database, no server imports. Money is summed in CENTS.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { isInstallmentOverdue } from './dues-status';
import { addCalendarDays, daysBetweenDateStrings, orgDayKey } from './timezone';
import { toCents as cents, toDollars as dollars } from './coach-register';

/** The window Coming due, the Overview brief and the reminders all use. One number, three surfaces. */
export const COMING_DUE_DAYS = 14;

/** A list of amounts, summed in cents — the one way the club money code adds dollars up. */
export function sumMoney(xs: readonly { amount: number }[]): number {
  return dollars(xs.reduce((acc, x) => acc + cents(x.amount), 0));
}

// ── Installments ──────────────────────────────────────────────────────────────────────────────

/** The facts every figure reads. A full `RepAllocationInstallment` satisfies it. */
export interface ClubInstallmentFacts {
  amount: number;
  dueDate: string;
  paidAt: string | null;
  /** Optional so a pre-3a reader shape still type-checks; absent reads as "never sent". */
  sentAt?: string | null;
  sentOn?: string | null;
  paidOn?: string | null;
}

export type ClubInstallmentState = 'received' | 'sent' | 'overdue' | 'upcoming';

/** Where the money is — the only facts the cash side reads (no amount or due date needed). */
type MoneyWhereabouts = Pick<ClubInstallmentFacts, 'paidAt' | 'sentAt' | 'sentOn' | 'paidOn'>;

export function clubInstallmentState(i: Pick<ClubInstallmentFacts, 'dueDate' | 'paidAt' | 'sentAt'>, today: string): ClubInstallmentState {
  if (i.paidAt) return 'received';
  if (i.sentAt) return 'sent';
  return isInstallmentOverdue(i.dueDate, null, today) ? 'overdue' : 'upcoming';
}

/** Days past due for an overdue installment (0 when it is not overdue). */
export function clubInstallmentDaysLate(i: Pick<ClubInstallmentFacts, 'dueDate' | 'paidAt' | 'sentAt'>, today: string): number {
  return clubInstallmentState(i, today) === 'overdue' ? daysBetweenDateStrings(i.dueDate, today) : 0;
}

/** The day the club received it: what the club recorded (`paidOn`), else the club day of the stamp. */
export function clubInstallmentReceivedOn(i: Pick<ClubInstallmentFacts, 'paidAt' | 'paidOn'>): string | null {
  if (!i.paidAt) return null;
  return i.paidOn ?? orgDayKey(i.paidAt);
}

/**
 * ⚖ THE COACH'S SIDE OF THE SAME FACT (ruled 2026-09-30, question 1): the team's money LEFT its bank
 * the day the coach sent it, whether or not the club has confirmed. So the coach's Cash on hand,
 * Ledger, settlement pot and cash band count a sent installment as money out on its sent date, and a
 * received one on the day it went (the sent day when the coach said so, else the day the club
 * recorded it came, else the day it was stamped — every pre-3a row, unchanged).
 *
 * Returns null while the money is still in the team's account. ONE function, because five coach
 * readers must agree to the cent (`check:register` holds two of them to it).
 */
export function clubInstallmentLeftTeamOn(i: MoneyWhereabouts): string | null {
  if (i.sentAt) return i.sentOn ?? orgDayKey(i.sentAt);
  if (i.paidAt) return i.paidOn ?? orgDayKey(i.paidAt);
  return null;
}

/** The coach's chip for money that has left the team and not reached the club. */
export function clubInstallmentWaitingOnClub(i: Pick<ClubInstallmentFacts, 'paidAt' | 'sentAt'>): boolean {
  return !i.paidAt && !!i.sentAt;
}

export interface CountAndAmount { count: number; amount: number }

export interface ClubBillFigures {
  /** What the installments add up to. */
  billed: number;
  collected: number;
  outstanding: number;
  overdue: CountAndAmount;
  sent: CountAndAmount;
  dueSoon: CountAndAmount;
  nextDue: { dueDate: string; amount: number } | null;
  /** The earliest overdue due date (for "N days late" on a whole bill). */
  oldestOverdueDate: string | null;
  installmentCount: number;
  /** How many the club has received. */
  receivedCount: number;
  paidInFull: boolean;
}

export function clubBillFigures(
  installments: readonly ClubInstallmentFacts[],
  today: string,
  windowDays: number = COMING_DUE_DAYS,
): ClubBillFigures {
  const windowEnd = addCalendarDays(today, windowDays);
  let billed = 0, collected = 0, receivedCount = 0;
  const overdue = { count: 0, c: 0 }, sent = { count: 0, c: 0 }, dueSoon = { count: 0, c: 0 };
  let next: { dueDate: string; c: number } | null = null;
  let oldestOverdue: string | null = null;

  for (const i of installments) {
    const c = cents(i.amount);
    billed += c;
    const state = clubInstallmentState(i, today);
    if (state === 'received') { collected += c; receivedCount++; continue; }
    if (state === 'sent') { sent.count++; sent.c += c; continue; }
    if (state === 'overdue') {
      overdue.count++; overdue.c += c;
      if (!oldestOverdue || i.dueDate < oldestOverdue) oldestOverdue = i.dueDate;
      continue;
    }
    if (i.dueDate <= windowEnd) { dueSoon.count++; dueSoon.c += c; }
    if (!next || i.dueDate < next.dueDate) next = { dueDate: i.dueDate, c };
    else if (i.dueDate === next.dueDate) next.c += c;
  }

  return {
    billed: dollars(billed),
    collected: dollars(collected),
    outstanding: dollars(billed - collected),
    overdue: { count: overdue.count, amount: dollars(overdue.c) },
    sent: { count: sent.count, amount: dollars(sent.c) },
    dueSoon: { count: dueSoon.count, amount: dollars(dueSoon.c) },
    nextDue: next ? { dueDate: next.dueDate, amount: dollars(next.c) } : null,
    oldestOverdueDate: oldestOverdue,
    installmentCount: installments.length,
    receivedCount,
    paidInFull: installments.length > 0 && billed === collected,
  };
}

/**
 * The one chip an allocation (or a team's bill) carries, in priority order — something only the
 * club can chase first: Overdue · Sent (waiting on the club) · Due (within the window) · Upcoming ·
 * Paid in full. Nothing billed reads 'upcoming' with no date.
 */
export type ClubBillChip = 'overdue' | 'sent' | 'due_soon' | 'upcoming' | 'paid_in_full';

export function clubBillChip(f: ClubBillFigures): ClubBillChip {
  if (f.paidInFull) return 'paid_in_full';
  if (f.overdue.count > 0) return 'overdue';
  if (f.sent.count > 0) return 'sent';
  if (f.dueSoon.count > 0) return 'due_soon';
  return 'upcoming';
}

/** Coming due (specimen 2): which band an installment sits in, or none. */
export type ComingDueBand = 'overdue' | 'sent' | 'due_soon';

export function comingDueBand(
  i: Pick<ClubInstallmentFacts, 'dueDate' | 'paidAt' | 'sentAt'>,
  today: string,
  windowDays: number = COMING_DUE_DAYS,
): ComingDueBand | null {
  const state = clubInstallmentState(i, today);
  if (state === 'overdue') return 'overdue';
  if (state === 'sent') return 'sent';
  if (state === 'upcoming' && i.dueDate <= addCalendarDays(today, windowDays)) return 'due_soon';
  return null;
}

/** Reminders remind about the overdue and the due-soon — never what the team has already sent. */
export function remindsAbout(i: Pick<ClubInstallmentFacts, 'dueDate' | 'paidAt' | 'sentAt'>, today: string): boolean {
  const band = comingDueBand(i, today);
  return band === 'overdue' || band === 'due_soon';
}

// ── A team's account with the club (Ask 5a) ───────────────────────────────────────────────────

export interface AccountBill {
  splitId: string;
  allocationId: string;
  allocationDescription: string;
  programYearId: string;
  /** The day the club billed it (the allocation's creation, in the club's day). */
  billedOn: string;
  amount: number;
  installments: (ClubInstallmentFacts & {
    id: string;
    installmentNumber: number;
    paidMethod?: string | null;
    paidReference?: string | null;
    paidBy?: string | null;
  })[];
}

export interface AccountRequest {
  id: string;
  programYearId: string;
  requestType: 'payment_to_org' | 'charge_to_org';
  status: string;
  amount: number;
  description: string;
  /** The day the money moved on approval (`paidOn`), else the club day of `reviewedAt`. */
  decidedOn: string | null;
  paidMethod?: string | null;
  moneyInMeaning?: string | null;
}

export type AccountRowKind = 'billed' | 'received' | 'paid_to_team' | 'received_on_request';

export interface AccountRow {
  kind: AccountRowKind;
  date: string;
  /** The bill or request this row belongs to. */
  sourceId: string;
  /** A bill's allocation, so the statement's row opens it (Club Tier Stage 3a session 2). */
  allocationId?: string;
  installmentId?: string;
  description: string;
  installmentNumber?: number;
  installmentCount?: number;
  billed: number;
  collected: number;
  paidToTeam: number;
  /** Money the team paid the club on a To-club request: received, but not against a bill. */
  receivedOnRequest: number;
  /** The running figure, after this row (chronological). Paying the team never changes it. */
  outstanding: number;
  paidMethod?: string | null;
  paidReference?: string | null;
  recordedBy?: string | null;
  daysLate?: number;
  moneyInMeaning?: string | null;
}

export interface AccountSeason {
  programYearId: string;
  rows: AccountRow[];
}

export interface TeamAccount {
  /** Newest season first; within a season, newest row first (the statement's reading order). */
  seasons: AccountSeason[];
  figures: ClubBillFigures;
  paidToTeam: number;
  paidToTeamCount: number;
  receivedOnRequest: number;
  /** The figure the statement closes on — equals `figures.outstanding`, by construction. */
  outstanding: number;
}

/**
 * The team's account with the club, from the club's own records (allocations, installments,
 * requests). Never reads a ledger: the team's book is the coaches' (D1), and a line-by-line read of
 * it would put every family's dues payment in front of the club.
 *
 * Only DECIDED money is a row: an approved request (a reversed one moved no money, and its two lines
 * are void), a received installment, a bill. Pending requests and sent installments are the
 * figures' business, not the statement's.
 */
export function teamAccount(
  bills: readonly AccountBill[],
  requests: readonly AccountRequest[],
  seasonOrder: readonly string[],
  today: string,
): TeamAccount {
  type Draft = { row: Omit<AccountRow, 'outstanding'>; seq: number; programYearId: string };
  const drafts: Draft[] = [];
  const blank = { billed: 0, collected: 0, paidToTeam: 0, receivedOnRequest: 0 };
  const add = (programYearId: string, row: Omit<AccountRow, 'outstanding'>) =>
    drafts.push({ row, seq: drafts.length, programYearId });

  for (const b of bills) {
    const count = b.installments.length;
    add(b.programYearId, {
      ...blank, kind: 'billed', date: b.billedOn, sourceId: b.splitId, allocationId: b.allocationId, description: b.allocationDescription,
      installmentCount: count, billed: b.amount,
    });
    for (const i of b.installments) {
      const on = clubInstallmentReceivedOn(i);
      if (!on) continue;
      add(b.programYearId, {
        ...blank, kind: 'received', date: on, sourceId: b.splitId, allocationId: b.allocationId, installmentId: i.id,
        description: b.allocationDescription, installmentNumber: i.installmentNumber, installmentCount: count,
        collected: i.amount, paidMethod: i.paidMethod ?? null, paidReference: i.paidReference ?? null,
        recordedBy: i.paidBy ?? null, daysLate: i.dueDate < on ? daysBetweenDateStrings(i.dueDate, on) : 0,
      });
    }
  }
  for (const r of requests) {
    if (r.status !== 'approved' || !r.decidedOn) continue;
    const toTeam = r.requestType === 'charge_to_org';
    add(r.programYearId, {
      ...blank, kind: toTeam ? 'paid_to_team' : 'received_on_request', date: r.decidedOn, sourceId: r.id,
      description: r.description, paidToTeam: toTeam ? r.amount : 0, receivedOnRequest: toTeam ? 0 : r.amount,
      paidMethod: r.paidMethod ?? null, moneyInMeaning: r.moneyInMeaning ?? null,
    });
  }

  // Chronological for the running figure; a bill sorts before money received the same day.
  const rank: Record<AccountRowKind, number> = { billed: 0, received: 1, received_on_request: 2, paid_to_team: 3 };
  drafts.sort((a, b) => a.row.date.localeCompare(b.row.date) || rank[a.row.kind] - rank[b.row.kind] || a.seq - b.seq);

  let running = 0, paidToTeamC = 0, paidToTeamCount = 0, onRequestC = 0;
  const bySeason = new Map<string, AccountRow[]>();
  for (const { row, programYearId } of drafts) {
    running += cents(row.billed) - cents(row.collected);
    if (row.paidToTeam) { paidToTeamC += cents(row.paidToTeam); paidToTeamCount++; }
    if (row.receivedOnRequest) onRequestC += cents(row.receivedOnRequest);
    const list = bySeason.get(programYearId) ?? [];
    list.push({ ...row, outstanding: dollars(running) });
    bySeason.set(programYearId, list);
  }

  const order = [...seasonOrder, ...[...bySeason.keys()].filter(k => !seasonOrder.includes(k))];
  const seasons: AccountSeason[] = order
    .filter(id => bySeason.has(id))
    .map(id => ({ programYearId: id, rows: [...bySeason.get(id)!].reverse() }));

  const figures = clubBillFigures(bills.flatMap(b => b.installments), today);
  return {
    seasons,
    figures,
    paidToTeam: dollars(paidToTeamC),
    paidToTeamCount,
    receivedOnRequest: dollars(onRequestC),
    outstanding: dollars(running),
  };
}

// ── A ledger book ─────────────────────────────────────────────────────────────────────────────

export interface BookLineFacts {
  id: string;
  entryDate: string;
  createdAt: string;
  amount: number;
  entryType: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  status: 'posted' | 'pending' | 'void';
}

const isMoneyIn = (l: Pick<BookLineFacts, 'entryType'>) =>
  l.entryType === 'income' || l.entryType === 'transfer_in';

type BookMovement = Pick<BookLineFacts, 'amount' | 'entryType' | 'status'>;

/** What a line does to the book's balance, in cents: only POSTED lines move it. */
function bookMovementCents(l: BookMovement): number {
  if (l.status !== 'posted') return 0;
  return isMoneyIn(l) ? cents(l.amount) : -cents(l.amount);
}

/** The book's Balance — posted in − posted out, all-time. */
export function bookBalance(lines: readonly BookMovement[]): number {
  return dollars(lines.reduce((acc, l) => acc + bookMovementCents(l), 0));
}

/** Oldest first: by date, then by when it was recorded, then id (a total order, so pages are stable). */
function compareBookLines(a: BookLineFacts, b: BookLineFacts): number {
  return a.entryDate.localeCompare(b.entryDate)
    || a.createdAt.localeCompare(b.createdAt)
    || a.id.localeCompare(b.id);
}

export interface BookRow<T extends BookLineFacts> {
  line: T;
  /** The posted balance after this line. A pending line carries the balance before it (it moved
   *  nothing — the screen prints it faint); a void line carries null (it counts nowhere). */
  balance: number | null;
}

export interface BookWindow<T extends BookLineFacts> {
  /** Everything posted before the window — the Starting balance line. */
  startingBalance: number;
  /** The posted balance at the window's end — the Ending balance line. */
  endingBalance: number;
  /** The book's all-time Balance. */
  balance: number;
  /** The window's rows (every status), oldest first, each with its running balance. */
  rows: BookRow<T>[];
  /** What is in the window before Status narrows it (the coach's Status counts). */
  counts: { posted: number; pending: number; void: number };
}

/**
 * Walk the WHOLE book once (every row, no cap — the caller pages through the database), and return
 * the window's rows with a running balance that is true from the first row. `from`/`to` are
 * inclusive `YYYY-MM-DD`; either may be omitted.
 */
export function bookWindow<T extends BookLineFacts>(
  allLines: readonly T[],
  window: { from?: string | null; to?: string | null } = {},
): BookWindow<T> {
  const sorted = [...allLines].sort(compareBookLines);
  let running = 0, starting = 0, ending = 0;
  const rows: BookRow<T>[] = [];
  const counts = { posted: 0, pending: 0, void: 0 };

  for (const line of sorted) {
    const before = window.from && line.entryDate < window.from;
    const after = window.to && line.entryDate > window.to;
    running += bookMovementCents(line);
    if (before) { starting = running; continue; }
    if (after) continue;
    counts[line.status]++;
    rows.push({ line, balance: line.status === 'void' ? null : dollars(running) });
    ending = running;
  }
  if (rows.length === 0) ending = starting;

  return {
    startingBalance: dollars(starting),
    endingBalance: dollars(ending),
    balance: dollars(running),
    rows,
    counts,
  };
}

/** One export row's signed amount: + money in, − money out. A void line is marked and totals 0. */
export function signedAmount(l: Pick<BookLineFacts, 'amount' | 'entryType'>): number {
  return isMoneyIn(l) ? l.amount : -l.amount;
}
