/**
 * THE CLUB'S BANK CHECK, READ — the pure half (Bank balance check BC1; plan docs/projects/active/BANK_RECONCILIATION_PLAN.md
 * §4, §7, §9 BC1's build calls). The server read (`lib/bank-club-read.ts`) hands in rows; this turns them into the
 * engine's inputs (lib/bank-check.ts). No IO, client-safe, so every rule here is tested with fixtures.
 *
 * ⚖ RULE 1: a club's FIRST account is its oldest live `owner_kind='club'` account, never "the oldest live account" (a team
 *   account moved in with a standalone team, mig 437, can be older). Every club book with no `bank_account_books` row
 *   belongs to it.
 * ⚖ RULE 6: every engine input is the server's. Nothing here takes a client's figure.
 * ⚖ NO YEAR: nothing here reads or names a fiscal year or a season.
 */

import { newestFirst, signed, type BankDirection, type BankLine, type SavedCheck, type WaitingItem } from './bank-check';
import { toCents } from './coach-register';
import type { PayoutRow } from './online-payouts';
import { addCalendarDays } from './timezone';

// ── accounts and books ───────────────────────────────────────────────────────────────────────

export interface BankAccountRow {
  id: string;
  name: string;
  owner_kind: 'club' | 'team';
  created_at: string;
  archived_at: string | null;
}

export interface ClubBook { id: string; name: string; entityType: string; entityId: string | null }

export interface BookMoveRow { ledger_id: string; bank_account_id: string }

/** The club's live accounts, oldest first (team accounts never: rule 1). */
export function liveClubAccounts(rows: readonly BankAccountRow[]): BankAccountRow[] {
  return rows.filter(r => r.owner_kind === 'club' && !r.archived_at)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Which account holds each club book: its `bank_account_books` row when that names a live club account, else the first
 * account. With no account at all, every book is unplaced (the "never done this" state).
 */
export function placeBooks(accounts: readonly BankAccountRow[], books: readonly ClubBook[], moves: readonly BookMoveRow[]): {
  accountOfBook: Map<string, string>;
  booksOf: Map<string, ClubBook[]>;
  unplaced: ClubBook[];
} {
  const live = liveClubAccounts(accounts);
  const first = live[0] ?? null;
  const liveIds = new Set(live.map(a => a.id));
  const movedTo = new Map(moves.filter(m => liveIds.has(m.bank_account_id)).map(m => [m.ledger_id, m.bank_account_id]));
  const accountOfBook = new Map<string, string>();
  const booksOf = new Map<string, ClubBook[]>(live.map(a => [a.id, []]));
  if (!first) return { accountOfBook, booksOf, unplaced: [...books] };
  for (const b of books) {
    const acct = movedTo.get(b.id) ?? first.id;
    accountOfBook.set(b.id, acct);
    booksOf.get(acct)!.push(b);
  }
  return { accountOfBook, booksOf, unplaced: [] };
}

/** The books a check counts, as `bank_check_save` compares them: distinct ids, sorted (uuid text order). */
export const bookIdsOf = (books: readonly { id: string }[]): string[] => [...new Set(books.map(b => b.id))].sort();

// ── book lines ───────────────────────────────────────────────────────────────────────────────

export interface EntryRow {
  id: string;
  ledger_id: string;
  entry_date: string;
  description: string;
  amount: number | string;
  entry_type: 'income' | 'expense' | 'transfer_in' | 'transfer_out';
  status: 'posted' | 'pending' | 'void';
  linked_entry_id: string | null;
  payment_method: string | null;
}

/** The columns an `EntryRow` is read with (one copy for every bank reader). */
export const ENTRY_SELECT = 'id, ledger_id, entry_date, description, amount, entry_type, status, linked_entry_id, payment_method';

/** Money in or out of the book: the one place an entry type becomes a direction (the amount is always positive). */
export const directionOfEntry = (row: Pick<EntryRow, 'entry_type'>): BankDirection =>
  row.entry_type === 'income' || row.entry_type === 'transfer_in' ? 'in' : 'out';

export const entryKey = (id: string) => `entry:${id}`;
/** The entry id inside an `entry:` key, or null for any other kind of key. */
export const entryIdOf = (key: string): string | null => (key.startsWith('entry:') ? key.slice(6) : null);

/** A club-book line as the engine reads it. A transfer half names its other half, so both halves in this account net to
 *  nothing in the suspects (the books figure, a SQL sum, nets them by itself). */
export function entryToBankLine(row: EntryRow): BankLine {
  const isTransfer = row.entry_type === 'transfer_in' || row.entry_type === 'transfer_out';
  return {
    key: entryKey(row.id), date: row.entry_date, direction: directionOfEntry(row), amountCents: toCents(row.amount),
    label: row.description,
    transferPairKey: isTransfer && row.linked_entry_id ? entryKey(row.linked_entry_id) : null,
  };
}

/** An online-payment book line (BC1 build call): every receipt, processing cost and refund line Stripe moves carries one
 *  of these (verified on dev 2026-11-05). */
export const ONLINE_METHODS = ['online_card', 'online_bank'] as const;
export const isOnlineEntry = (row: Pick<EntryRow, 'payment_method'>): boolean =>
  (ONLINE_METHODS as readonly string[]).includes(row.payment_method ?? '');

// ── the bank tables ──────────────────────────────────────────────────────────────────────────

export interface CheckRow {
  id: string;
  bank_account_id: string;
  kind: 'start' | 'check';
  statement_end_date: string;
  statement_ending_balance_cents: number | string;
  books_cents: number | string;
  on_its_way_cents: number | string | null;
  cash_not_deposited_cents: number | string | null;
  book_ids: string[] | null;
  created_by: string | null;
  created_at: string;
}
/** The columns a `CheckRow` is read with. */
export const CHECK_SELECT = 'id, bank_account_id, kind, statement_end_date, statement_ending_balance_cents, books_cents, '
  + 'on_its_way_cents, cash_not_deposited_cents, book_ids, created_by, created_at';

export interface WaitingRow {
  check_id: string; line_key: string; line_date: string; label: string | null; amount_cents: number | string;
  direction: BankDirection; at_start: boolean;
}
export const WAITING_SELECT = 'check_id, line_key, line_date, label, amount_cents, direction, at_start';

/** A saved check with the facts the list shows beside its figures. */
export interface ClubSavedCheck extends SavedCheck {
  bookIds: string[];
  createdBy: string | null;
  createdAt: string;
}

const centsOrNull = (v: number | string | null): number | null => (v === null ? null : Number(v));

/** Live checks with their waiting items, oldest first. */
export function savedChecksOf(rows: readonly CheckRow[], waiting: readonly WaitingRow[]): ClubSavedCheck[] {
  const itemsOf = new Map<string, WaitingItem[]>();
  for (const w of waiting) {
    const item: WaitingItem = {
      key: w.line_key, date: w.line_date, direction: w.direction, amountCents: Number(w.amount_cents),
      ...(w.label ? { label: w.label } : {}), ...(w.at_start ? { atStart: true } : {}),
    };
    const list = itemsOf.get(w.check_id);
    if (list) list.push(item); else itemsOf.set(w.check_id, [item]);
  }
  return [...rows].sort((a, b) => (a.statement_end_date < b.statement_end_date ? -1 : a.statement_end_date > b.statement_end_date ? 1 : 0))
    .map(r => ({
      id: r.id, kind: r.kind, date: r.statement_end_date, bankCents: Number(r.statement_ending_balance_cents),
      booksCents: Number(r.books_cents), onItsWayCents: centsOrNull(r.on_its_way_cents),
      cashCents: centsOrNull(r.cash_not_deposited_cents),
      waiting: (itemsOf.get(r.id) ?? []).sort((a, b) => newestFirst(b, a)),
      bookIds: [...(r.book_ids ?? [])].sort(), createdBy: r.created_by, createdAt: r.created_at,
    }));
}

/**
 * "Your books on D" for a club check (P5, plan §4): the start's books + the posted movement of `bookIds` after the start
 * through D. `through` is `bank_books_through` for those books (all-time through each date), so the movement is
 * through(D) − through(start date): a line on or before the start never counts, wherever it sits.
 */
export function clubBooksOnDate(i: { startBooksCents: number; throughD: number; throughStart: number }): number {
  return i.startBooksCents + i.throughD - i.throughStart;
}

// ── Stripe "on its way" (ask 8, plan §4, O6) ─────────────────────────────────────────────────

/** Lines landed more than this many days before D are taken as paid out (Stripe's schedules are daily to weekly). */
export const ON_ITS_WAY_DAYS = 30;

/** The first day an online line can still be on its way on D: D − 30 days, exclusive (the window is (D − 30, D]). */
export const onItsWayFloor = (date: string): string => addCalendarDays(date, -ON_ITS_WAY_DAYS);

/** The figure a check saves for on its way is `OnItsWay.cents`: NULL = not counted, 0 = none. */

/** The fields of a Payouts-tab row the bank check reads (type-only import: erased, so this file stays client-safe). */
export type PayoutRowLike = Pick<PayoutRow, 'id' | 'arrives' | 'status' | 'contents' | 'lines'>;

export interface OnItsWayLine {
  key: string;
  date: string;
  label: string;
  direction: BankDirection;
  amountCents: number;
  bookId: string;
  /** Card or bank debit (the line's payment method). */
  rail: 'card' | 'bank';
  /** The arrival day of the payout holding it, when Stripe has put it in one. */
  paysOutOn: string | null;
}

export type OnItsWay =
  /** No online payments here (switched off, no Stripe account): no line at all. */
  | { state: 'none'; cents: 0; lines: [] }
  | { state: 'counted'; cents: number; lines: OnItsWayLine[]; paysOutOn: string | null }
  /** Stripe didn't answer, or a payout in the window lists no lines (manual / still matching, O6): left out. */
  | { state: 'not_counted'; reason: 'stripe_down' | 'unlisted'; cents: null; lines: OnItsWayLine[] };


/**
 * Online-payment book lines in the account's books dated in (D − 30, D], minus every line inside a payout that arrived
 * on or before D and did not fail. Not counted when any payout arriving in [D − 30, D] that did not fail lists no lines
 * (manual, or Stripe still matching it): its lines can't be told apart. Signed net (processing lines and refunds out), so
 * it is what will land.
 */
export function onItsWay(i: { date: string; online: readonly EntryRow[]; payouts: readonly PayoutRowLike[] }): Exclude<OnItsWay, { state: 'none' }> {
  const floor = onItsWayFloor(i.date);
  const landedBy = new Map<string, string>(); // entry id → arrival day of a payout that did not fail
  let unlisted = false;
  for (const p of i.payouts) {
    if (p.status === 'failed' || !p.arrives) continue;
    if (p.arrives >= floor && p.arrives <= i.date && p.contents !== 'listed') unlisted = true;
    for (const l of p.lines) for (const id of l.entryIds ?? []) {
      const had = landedBy.get(id);
      if (!had || p.arrives < had) landedBy.set(id, p.arrives);
    }
  }
  const lines: OnItsWayLine[] = [];
  for (const r of i.online) {
    if (r.status !== 'posted' || !isOnlineEntry(r) || r.entry_date <= floor || r.entry_date > i.date) continue;
    const arrives = landedBy.get(r.id) ?? null;
    if (arrives && arrives <= i.date) continue;
    lines.push({
      key: entryKey(r.id), date: r.entry_date, label: r.description, direction: directionOfEntry(r), amountCents: toCents(r.amount),
      bookId: r.ledger_id, rail: r.payment_method === 'online_bank' ? 'bank' : 'card', paysOutOn: arrives,
    });
  }
  lines.sort(newestFirst);
  if (unlisted) return { state: 'not_counted', reason: 'unlisted', cents: null, lines };
  const cents = lines.reduce((n, l) => n + signed(l.direction, l.amountCents), 0);
  // "Stripe pays them out {date}": the day the last of them lands, when every one is in a payout.
  const paysOutOn = lines.length && lines.every(l => l.paysOutOn)
    ? lines.reduce((m, l) => (l.paysOutOn! > m ? l.paysOutOn! : m), '') : null;
  return { state: 'counted', cents, lines, paysOutOn };
}
