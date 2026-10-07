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
import { fiscalYearOf, type FiscalSetting, type FiscalYear } from './club-fiscal-year';

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

/**
 * ⚖ WHICH SEASON'S CASH READS A CLUB INSTALLMENT (Club Tier Stage 3c, S3C-11 — owner 2026-10-07, call 1). A payment
 * counts in the season RUNNING WHEN IT WAS RECORDED (`carriedByProgramYearId`, kept by mig 318's trigger on every
 * writer), whatever day was typed; money still the team's belongs to its BILL's season (the forward view: still
 * owed). A payment carried by nobody (recorded while the team had no running season) is in no season's cash until
 * the next season to run carries it. Every coach cash read asks this through `getSeasonClubBills`
 * (lib/coach-club-bills.ts).
 */
export function seasonReadsClubInstallment(
  i: MoneyWhereabouts & { carriedByProgramYearId?: string | null },
  billSeasonId: string,
  seasonId: string,
): boolean {
  return clubInstallmentLeftTeamOn(i) !== null ? i.carriedByProgramYearId === seasonId : billSeasonId === seasonId;
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

/**
 * COMING DUE'S WINDOW (S3W3 round 2, owner 2026-10-05): the Due filter on Allocations › Coming due. Overdue,
 * Sent and the 14-day band never move with it — the 14 days are the Overview's own count, and an owed payment
 * never drops out of sight for a date choice. A wider window only adds a "Later" band at the foot, out of the
 * groups due AFTER the 14 days: through `today + 30` for Next 30 days, all of them for Rest of the season.
 * Counted the way `comingDue` counts every band — a team's installment each — so its words and the export agree.
 */
export type ComingDueWindow = 'soon' | 'month' | 'season';
export const COMING_DUE_MONTH_DAYS = 30;

/** The last day a window reaches, inclusive (as the 14 days include the 14th): null = the rest of the season. */
export function comingDueWindowEnd(today: string, window: ComingDueWindow): string | null {
  if (window === 'season') return null;
  return addCalendarDays(today, window === 'month' ? COMING_DUE_MONTH_DAYS : COMING_DUE_DAYS);
}

export function comingDueLater<G extends { dueDate: string; amount: number; teams: readonly unknown[] }>(
  later: readonly G[],
  today: string,
  window: ComingDueWindow,
): { groups: G[]; count: number; amount: number; through: string | null } {
  const end = comingDueWindowEnd(today, window);
  const groups = window === 'soon' ? [] : later.filter(g => end == null || g.dueDate <= end);
  return { groups, count: groups.reduce((n, g) => n + g.teams.length, 0), amount: sumMoney(groups), through: window === 'month' ? end : null };
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
  /** The day the club billed it (the allocation's creation, in the club's day). The statement prints the
   *  earliest of this, the first due date and the first payment (`teamAccount`). */
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
    // A bill is dated by the EARLIEST of its creation, its first due date and its first payment, so it
    // always reads before the money received against it: an allocation entered after its payments
    // (a treasurer catching up the books) had dipped the running figure into a credit (/design 2026-10-01).
    const receivedOns = b.installments.map(i => clubInstallmentReceivedOn(i)).filter((d): d is string => !!d);
    const billDate = [b.billedOn, ...b.installments.map(i => i.dueDate), ...receivedOns]
      .filter(Boolean).sort()[0] ?? b.billedOn;
    add(b.programYearId, {
      ...blank, kind: 'billed', date: billDate, sourceId: b.splitId, allocationId: b.allocationId, description: b.allocationDescription,
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

/** Money in on a book: income, or the receiving half of a transfer. The one test every club reader uses. */
export const isMoneyIn = (l: Pick<BookLineFacts, 'entryType'>) =>
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

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * CLUB TIER STAGE 3b — THE PLAN, THE YEAR AND THE CLUB'S BOOKS (owner rulings 2026-10-06, Asks 1–5).
 *
 * Every figure the Budget, Budget vs. Actual and the board summary print, each with the ONE sentence
 * the hub's "One definition per figure" table gives it (the doc comment is that sentence). The
 * assembly — which rows feed which figure — is lib/club-budget-report.ts; it asks these functions
 * and never sums a figure for itself. `scripts/check-club-money-arithmetic.mjs` recomputes them from
 * rows by an independent walk.
 *
 * ⚖ "Collected" carries TWO scopes, on purpose (Ask 2): two functions with two names, never one
 * function with a flag. The loop's Collected is `clubBillFigures(...).collected` above (Allocations,
 * a team's account, the Budget's column). The band's Collected is `bandCollected` below (Total
 * revenue's Actual on Budget vs. Actual).
 * ══════════════════════════════════════════════════════════════════════════════════════════════ */

/** The kinds of book the CLUB owns. A team's book is the coaches' (D1) and is never one of them. */
export type ClubBookKind = 'org' | 'tournament' | 'league_season';
export const CLUB_OWNED_BOOK_KINDS: readonly ClubBookKind[] = ['org', 'tournament', 'league_season'];

/** Is this a book the club owns (Club, Tournament, House league) — never a team's. */
export function isClubOwnedBook(kind: string): kind is ClubBookKind {
  return (CLUB_OWNED_BOOK_KINDS as readonly string[]).includes(kind);
}

/**
 * The Club books: the General ledger and any book the club opened by name. Actual, Spent, Off-plan
 * and the band's Collected read these; a tournament's and the house league's books keep their own
 * money until Stages 7 and 9 decide how it joins the budget.
 */
export function isClubBook(kind: string): boolean {
  return kind === 'org';
}

// ── The year rule (Club Tier Stage 3c: the FISCAL year — lib/club-fiscal-year.ts) ───────────────

/**
 * THE YEAR RULE. An allocation belongs to the fiscal year of the line it was drawn from, and one made
 * without a line to the fiscal year its first installment falls due in. A year's Allocated, Collected and
 * Outstanding read the same allocations. A ledger line belongs to the fiscal year its date falls in. The
 * year is the club's fiscal year (`fiscalYearOf`: its first month and its rows), never worked out by hand —
 * `tests/unit/club-money-one-definition-guard.test.ts` refuses a by-hand year in the club's money files.
 * Returns the year's KEY (its first day).
 */
export function allocationYear(
  a: { lineYearKey: string | null; firstDueDate: string | null; createdOn: string },
  setting: FiscalSetting,
): string {
  if (a.lineYearKey != null) return a.lineYearKey;
  return fiscalYearOf(a.firstDueDate ?? a.createdOn, setting).key;
}

/** The ledger half of the year rule, and the year a page opens on: the fiscal year a day falls in. */
export function clubYearOf(day: string, setting: FiscalSetting): FiscalYear {
  return fiscalYearOf(day, setting);
}

/** A fiscal year's first and last day (inclusive). */
export function clubYearSpan(year: Pick<FiscalYear, 'firstDay' | 'lastDay'>): { first: string; last: string } {
  return { first: year.firstDay, last: year.lastDay };
}

/**
 * THE CARRY (Ask 4). A year whose predecessor is CLOSED opens on that stored closing, locked — a line
 * backdated into the closed year can't move it (the lock refuses the line). Otherwise the opening is worked
 * out from the books, as 3b's `openingBalance` does. `check:club-money-arithmetic` proves opening(next) =
 * closing(closed) to the cent.
 */
export function carriedOpening(predecessorClosing: number | null, fromTheBooks: number): number {
  return predecessorClosing ?? fromTheBooks;
}

// ── The plan ─────────────────────────────────────────────────────────────────────────────────

/**
 * PLANNED. What a budget line plans for the year: its amount. A band's total is the sum of its lines.
 * One word (category and item) carries one line, so planning a word already on the plan adds to its
 * line.
 */
export function planned(lines: readonly { totalAmount: number }[]): number {
  return sumMoney(lines.map(l => ({ amount: l.totalAmount })));
}

/**
 * ALLOCATED. What the club billed its teams from a line: the teams' shares of every allocation drawn
 * from that line, added up. A line can carry any number of allocations.
 */
export function lineAllocated(
  lineId: string,
  allocations: readonly { sourceBudgetLineId: string | null; splits: readonly { amount: number }[] }[],
): number {
  let c = 0;
  for (const a of allocations) {
    if (a.sourceBudgetLineId !== lineId) continue;
    for (const s of a.splits) c += cents(s.amount);
  }
  return dollars(c);
}

/**
 * NOT ALLOCATED. Planned − Allocated on a cost line: the part the club pays itself unless it
 * allocates it later. Never below zero, because a line can't be planned below what is allocated.
 * (A line billed above its total before that rule existed reads zero here, never a negative.)
 */
export function notAllocated(plannedAmount: number, allocated: number): number {
  return dollars(Math.max(0, cents(plannedAmount) - cents(allocated)));
}

// ── The books, for a year ─────────────────────────────────────────────────────────────────────

/** A posted or pending line on a book the club owns, as the year's report reads it. */
export interface ClubBookMovementFacts {
  amount: number;
  entryType: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  status: 'posted' | 'pending' | 'void';
  /** For a transfer: the kind of book its other half sits on (null when that half can't be found). */
  partnerKind?: string | null;
}

/**
 * Which way a line moves the CLUB's money — or that it moves none of it.
 *   · 'in' / 'out'   — money in or out.
 *   · 'own_transfer' — a transfer between two books the club owns: it moves nothing in total, so it
 *                      is not revenue and not spending, and the balance across every book is untouched.
 *   · null           — void (counts nowhere).
 * A transfer to or from a TEAM's book is money in or out (that is the money loop). Pending is still
 * classified; whether it counts is the reader's lens (Cash counts posted, Scheduled counts pending).
 */
export function clubMovement(l: ClubBookMovementFacts): 'in' | 'out' | 'own_transfer' | null {
  if (l.status === 'void') return null;
  const transfer = l.entryType === 'transfer_in' || l.entryType === 'transfer_out';
  if (transfer && l.partnerKind && isClubOwnedBook(l.partnerKind)) return 'own_transfer';
  return isMoneyIn(l) ? 'in' : 'out';
}

/**
 * ACTUAL. For a line: posted lines in the year on the club's Club books (the General ledger and any
 * book it opened by name) that carry the line's budget word, money out for a cost and money in for
 * income. Pending and void lines count nowhere. A line written by the money loop files itself: an
 * allocation received under "From the teams", a request paid to a team under "Team support", money
 * received on request under "From the teams, on request".
 *
 * (Which word a line carries — its own, or its source's — is lib/club-budget-report.ts `fileLine`.
 * This is the rule for WHETHER it counts.)
 */
export function countsAsActual(l: ClubBookMovementFacts & { bookKind: string }): boolean {
  if (l.status !== 'posted' || !isClubBook(l.bookKind)) return false;
  const m = clubMovement(l);
  return m === 'in' || m === 'out';
}

/**
 * SPENT. The Actual of Total expenses: every posted money-out line in the year on the club's Club
 * books, on the plan or off it, money paid to teams on request included. A transfer between the
 * club's own books is not spending. A tournament's and the house league's books keep their own
 * money until Stages 7 and 9 decide how it joins the budget.
 */
export function spent(lines: readonly (ClubBookMovementFacts & { bookKind: string })[]): number {
  let c = 0;
  for (const l of lines) if (countsAsActual(l) && clubMovement(l) === 'out') c += cents(l.amount);
  return dollars(c);
}

/**
 * COLLECTED — the BAND's scope (Budget vs. Actual). The Actual of Total revenue: every money-in line
 * posted in the year on the club's Club books, received allocations included. (The LOOP's Collected —
 * what the club has received against allocations — is `clubBillFigures(...).collected`; two scopes,
 * two functions, by Ask 2.)
 */
export function bandCollected(lines: readonly (ClubBookMovementFacts & { bookKind: string })[]): number {
  let c = 0;
  for (const l of lines) if (countsAsActual(l) && clubMovement(l) === 'in') c += cents(l.amount);
  return dollars(c);
}

/**
 * OFF-PLAN. Spending on a word the year's plan has no line for, plus spending filed to no word yet
 * ("Not filed"). The coach's "nobody budgeted this". Hidden at zero.
 */
export function offPlan(expenseRows: readonly { inPlan: boolean; actual: number }[]): number {
  let c = 0;
  for (const r of expenseRows) if (!r.inPlan) c += cents(r.actual);
  return dollars(c);
}

/**
 * HEADROOM — one: planned expenses − Spent, for the year. Said once, on the summary. Budget vs.
 * Actual says the same thing as "Spent $X of $Y planned", as the coach's band does since Headroom
 * left it (2026-10-01).
 */
export function headroom(plannedExpenses: number, spentAmount: number): number {
  return dollars(cents(plannedExpenses) - cents(spentAmount));
}

/** NET FOR THE YEAR. Total revenue − Total expenses, planned and actual. The coach's "Season net", in
 *  the club's unit. */
export function netForYear(totalRevenue: number, totalExpenses: number): number {
  return dollars(cents(totalRevenue) - cents(totalExpenses));
}

/** One book's sums, as `club_book_totals` (mig 317) returns them: one SQL aggregate per book set. */
export interface BookTotals {
  ledgerId: string;
  /** Posted money in / out inside the window asked for. */
  postedIn: number;
  postedOut: number;
  /** The all-time Balance — `bookBalance`'s definition, summed in SQL. */
  balance: number;
}

/**
 * CASH ON HAND · THE CLUB'S. The Balance of every book the club owns (Club, Tournament and House
 * league kinds) added up: posted, whole history, as of today. Never a team's book. A pending cheque
 * doesn't move it; it is a caption.
 */
export function clubCashOnHand(books: readonly { kind: string; balance: number }[]): number {
  let c = 0;
  for (const b of books) if (isClubOwnedBook(b.kind)) c += cents(b.balance);
  return dollars(c);
}

/**
 * OPENING BALANCE. What every book the club owns held at the start of the fiscal year's first day: the
 * posted lines dated before it, added up. Worked out from the books, never typed (a coach's season
 * carries a typed opening because its records start fresh; the club's books never do). Once the year
 * before is CLOSED, the opening is that year's stored closing instead (`carriedOpening`) — and the two
 * agree, because the lock refuses any line dated into the closed year.
 *
 * Takes each club-owned book's totals for the window that ENDS the day before the year's first day.
 */
export function openingBalance(totalsBeforeFirstDay: readonly { kind: string; postedIn: number; postedOut: number }[]): number {
  let c = 0;
  for (const t of totalsBeforeFirstDay) {
    if (!isClubOwnedBook(t.kind)) continue;
    c += cents(t.postedIn) - cents(t.postedOut);
  }
  return dollars(c);
}

/**
 * CLOSING BALANCE. Opening balance + the net, every book the club owns. On the Budget, the plan's:
 * the year's Total revenue − Total expenses added to the opening. On Months, each month's opening +
 * its net; under Cash, this month closes on Cash on hand to the cent.
 */
export function closingBalance(opening: number, net: number): number {
  return dollars(cents(opening) + cents(net));
}

/**
 * THE CLUB'S OTHER BOOKS. On Months: what a tournament's or the house league's book took in or paid
 * on its own in the month, transfers between the club's books left out. One row, so a month's
 * balance covers every book while the statement above it reads the Club books. It leaves when
 * Stages 7 and 9 bring those books into the budget.
 *
 * Returns the money in and out separately (the month's net is in − out), for the lens asked:
 * 'actual' counts posted lines, 'scheduled' pending ones.
 */
export function otherBooksMovement(
  lines: readonly (ClubBookMovementFacts & { bookKind: string })[],
  lens: 'actual' | 'scheduled',
): { moneyIn: number; moneyOut: number } {
  let inC = 0, outC = 0;
  const want = lens === 'actual' ? 'posted' : 'pending';
  for (const l of lines) {
    if (l.status !== want || !isClubOwnedBook(l.bookKind) || isClubBook(l.bookKind)) continue;
    const m = clubMovement(l);
    if (m === 'in') inC += cents(l.amount);
    else if (m === 'out') outC += cents(l.amount);
  }
  return { moneyIn: dollars(inC), moneyOut: dollars(outC) };
}

// ── Where the club stands today (the board summary) ──────────────────────────────────────────

/**
 * OWED BY THE TEAMS. Outstanding across every team, as of today. Its caption says how much is overdue
 * and how much is sent and waiting for the club. (3a's Outstanding — billed − collected, across every
 * year — over every installment the club has billed.)
 */
export function owedByTheTeams(installments: readonly ClubInstallmentFacts[], today: string): {
  amount: number; overdue: CountAndAmount; sent: CountAndAmount;
} {
  const f = clubBillFigures(installments, today);
  return { amount: f.outstanding, overdue: f.overdue, sent: f.sent };
}

/**
 * WAITING ON YOU. Requests still waiting for the club's answer: their count and their total, both
 * directions together ("how much is waiting on me", not a balance).
 */
export function waitingOnYou(requests: readonly { status: string; amount: number }[]): CountAndAmount {
  let count = 0, c = 0;
  for (const r of requests) {
    if (r.status !== 'pending') continue;
    count++;
    c += cents(r.amount);
  }
  return { count, amount: dollars(c) };
}

/**
 * CASH ON HAND · HELD BY THE TEAM. The coach's own Cash on hand for the team's live season: the figure
 * the coach's Money shows, read when the page loads and never stored by the club. A team with no live
 * season shows its last season's closing figure and that season's close date. Labelled "held by the
 * team", never added into a club figure, and totalled only in its own band.
 *
 * (Read through the coach's own function — lib/club-team-cash.ts. This is the one place it is added
 * up, and only for its own band.)
 */
export interface TeamCashHeld {
  teamId: string;
  /** Null when the team has never had a season to read. */
  cash: number | null;
  season: { id: string; name: string; live: boolean; closedOn: string | null } | null;
}

export function teamsCashTotal(teams: readonly TeamCashHeld[]): number {
  return sumMoney(teams.map(t => ({ amount: t.cash ?? 0 })));
}
