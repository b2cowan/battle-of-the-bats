/**
 * THE CLUB'S BANK CHECK, READ (Bank reconciliation R2a; plan docs/projects/active/BANK_RECONCILIATION_PLAN.md §7 R2,
 * build prompt BANK_RECONCILIATION_R2_BUILD_PROMPT.md chunk R2a). The pure half: the server read
 * (`lib/bank-club-read.ts`) hands in rows, this turns them into the engine's `BankAccountState` (lib/bank-check.ts).
 * No IO, client-safe, so every rule here is tested with fixtures.
 *
 * ⚖ RULE 1 (R1 review): a club's FIRST account is its oldest live `owner_kind='club'` account, never "the oldest live
 *   account" (a team account moved in with a standalone team, mig 437, can be older). Every club book with no
 *   `bank_account_books` row belongs to it.
 * ⚖ RULE 6: every engine input is the server's. Nothing here takes a client's figure.
 * ⚖ NO YEAR (B3, B10): nothing here reads or names a fiscal year or a season.
 */

import type {
  BankCheckRecord, BankDirection, BankLine, BankMark, BankPayout, OpeningItem, SavedLine, StampedChange,
} from './bank-check';
import { toCents } from './coach-register';
import type { PayoutRow } from './online-payouts';

// ── accounts and books ───────────────────────────────────────────────────────────────────────

export interface BankAccountRow {
  id: string;
  name: string;
  owner_kind: 'club' | 'team';
  created_at: string;
  archived_at: string | null;
  opening_date: string | null;
  opening_balance_cents: number | string | null;
  set_up_at: string | null;
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
}

export const entryKey = (id: string) => `entry:${id}`;
export const payoutKey = (id: string) => `payout:${id}`;
/** The entry id inside an `entry:` key, or null for any other kind of key. */
export const entryIdOf = (key: string): string | null => (key.startsWith('entry:') ? key.slice(6) : null);

/** A club-book line as the engine reads it. Direction from `entry_type` (amount is always positive); a transfer half
 *  names its other half, so both halves in this account are left out automatically (B6). */
export function entryToBankLine(row: EntryRow, payoutOf: ReadonlyMap<string, string>): BankLine {
  const direction: BankDirection = row.entry_type === 'income' || row.entry_type === 'transfer_in' ? 'in' : 'out';
  const isTransfer = row.entry_type === 'transfer_in' || row.entry_type === 'transfer_out';
  return {
    key: entryKey(row.id), date: row.entry_date, direction, amountCents: toCents(row.amount), status: row.status,
    label: row.description,
    transferPairKey: isTransfer && row.linked_entry_id ? entryKey(row.linked_entry_id) : null,
    payoutKey: payoutOf.get(row.id) ?? null,
  };
}

// ── the bank tables ──────────────────────────────────────────────────────────────────────────

export interface CheckRow {
  id: string;
  statement_end_date: string;
  statement_ending_balance_cents: number | string;
  status: 'open' | 'checked';
  outstanding_snapshot: SavedLine[] | null;
}
export interface AddedLineRow { check_id: string; line_key: string }
export interface MarkRow {
  check_id: string; line_key: string; line_date: string; direction: BankDirection; amount_cents: number | string; payout_key: string | null;
}
export interface SavedLineRow {
  kind: 'opening_picked' | 'opening_typed' | 'carried';
  line_key: string; line_date: string; direction: BankDirection; amount_cents: number | string; description: string | null;
}
export interface ChangeRow {
  check_id: string; line_key: string; removed: boolean; changed_by: string | null; changed_at: string; cleared_at: string | null;
}

/** Statements with the lines added from each (Ask 8). A snapshot is only read from a CHECKED statement (gotcha 6:
 *  Undo leaves a stale one behind). */
export function checkRecords(checks: readonly CheckRow[], added: readonly AddedLineRow[]): BankCheckRecord[] {
  const addedBy = new Map<string, string[]>();
  for (const a of added) { const list = addedBy.get(a.check_id); if (list) list.push(a.line_key); else addedBy.set(a.check_id, [a.line_key]); }
  return checks.map(c => ({
    id: c.id, statementEndDate: c.statement_end_date, statementEndingBalanceCents: Number(c.statement_ending_balance_cents),
    status: c.status, addedLineKeys: addedBy.get(c.id) ?? [],
    outstandingSnapshot: c.status === 'checked' ? (c.outstanding_snapshot ?? []) : null,
  }));
}

export function marksOf(rows: readonly MarkRow[]): BankMark[] {
  return rows.map(m => ({
    key: m.line_key, checkId: m.check_id, date: m.line_date, direction: m.direction, amountCents: Number(m.amount_cents),
    ...(m.payout_key ? { payoutKey: m.payout_key } : {}),
  }));
}

/** Rule 5's mirror: the table's `opening_picked` / `opening_typed` are the engine's `picked` / `typed`. */
export function savedOf(rows: readonly SavedLineRow[]): { openingItems: OpeningItem[]; carried: SavedLine[] } {
  const openingItems: OpeningItem[] = [];
  const carried: SavedLine[] = [];
  for (const r of rows) {
    const line: SavedLine = {
      key: r.line_key, date: r.line_date, direction: r.direction, amountCents: Number(r.amount_cents),
      ...(r.description ? { label: r.description } : {}),
    };
    if (r.kind === 'carried') carried.push(line);
    else openingItems.push({ ...line, kind: r.kind === 'opening_typed' ? 'typed' : 'picked' });
  }
  return { openingItems, carried };
}

/** Open (uncleared) changes only: "Mark checked again" clears them (Ask 11). */
export function stampsOf(rows: readonly ChangeRow[]): StampedChange[] {
  return rows.filter(r => !r.cleared_at).map(r => ({
    key: r.line_key, checkId: r.check_id, changedBy: r.changed_by, changedAt: r.changed_at, ...(r.removed ? { removed: true } : {}),
  }));
}

/** Every key a list or a mark of this account names: the book lines behind them are read by id whatever their date,
 *  so "changed since" and an old line the book still reads are seen. */
export function keysNamed(input: {
  marks: readonly BankMark[]; checks: readonly BankCheckRecord[]; openingItems: readonly OpeningItem[];
  carried: readonly SavedLine[]; stamps: readonly StampedChange[];
}): string[] {
  const keys = new Set<string>();
  for (const m of input.marks) keys.add(m.key);
  for (const c of input.checks) {
    for (const s of c.outstandingSnapshot ?? []) keys.add(s.key);
    for (const k of c.addedLineKeys ?? []) keys.add(k);
  }
  for (const o of input.openingItems) keys.add(o.key);
  for (const s of input.carried) keys.add(s.key);
  for (const s of input.stamps) keys.add(s.key);
  return [...keys];
}

/** The first arrival day the Stripe read asks for: the last CHECKED statement's end (an older unticked payout is kept
 *  line by line in that statement's saved list), else the account's starting date. */
export function payoutFloor(openingDate: string, checks: readonly BankCheckRecord[]): string {
  let floor = openingDate;
  for (const c of checks) if (c.status === 'checked' && c.statementEndDate > floor) floor = c.statementEndDate;
  return floor;
}

// ── Stripe payouts ───────────────────────────────────────────────────────────────────────────

/** The fields of a Payouts-tab row the bank check reads (type-only import: erased, so this file stays client-safe). */
export type PayoutRowLike = Pick<PayoutRow, 'id' | 'arrives' | 'status' | 'contents' | 'amount' | 'lines'>;

/** Why a payout's deposit and its book side differ, by reason (P4, plan Open questions; never "payment processing" by
 *  default). Signed cents, as each moves the deposit. */
export interface PayoutGapFacts {
  /** Card disputes in this payout whose loss is not booked: Stripe took the amount and its fee at once ("Dispute held"),
   *  named from OUR stored amount + fee. Negative. */
  disputesHeld: { disputeId: string; amountCents: number; feeCents: number }[];
  disputeHeldCents: number;
  /** A dispute's money Stripe gave back that no book line records (won before any loss was booked). */
  disputeReturnedCents: number;
  /** Stripe activity with no record of ours: "Not from FieldLogicHQ". */
  notOursCents: number;
  /** A Stripe fee taken from the club's Stripe balance that no book line records (12d-1 ruling 5): a real cost, so it
   *  IS offered as a "Payment processing" line — named first as what it is. */
  stripeFeeCents: number;
}

export interface BankPayoutsRead {
  /** Automatic payouts Stripe has finished matching, that went or are going to the bank. */
  payouts: BankPayout[];
  /** Entry id → the payout it rode in. An entry belongs to one payout (the oldest that names it). */
  payoutOf: Map<string, string>;
  /** Payout key → the entry ids it names. */
  membersOf: Map<string, string[]>;
  facts: Record<string, PayoutGapFacts>;
}

/**
 * The Payouts read, as the bank check needs it (plan R2: never a second Stripe reader). A manual payout (Stripe lists
 * no lines for it), one still being matched, or one that did not arrive is NOT passed: their lines tick by hand.
 */
export function payoutsForBank(rows: readonly PayoutRowLike[]): BankPayoutsRead {
  const usable = rows.filter(r => r.contents === 'listed' && r.status !== 'failed' && !!r.arrives)
    .sort((a, b) => (a.arrives! < b.arrives! ? -1 : a.arrives! > b.arrives! ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const payouts: BankPayout[] = [];
  const payoutOf = new Map<string, string>();
  const membersOf = new Map<string, string[]>();
  const facts: Record<string, PayoutGapFacts> = {};
  for (const r of usable) {
    const key = payoutKey(r.id);
    payouts.push({ key, arrivalDate: r.arrives!, amountCents: toCents(r.amount) });
    const members: string[] = [];
    const f: PayoutGapFacts = { disputesHeld: [], disputeHeldCents: 0, disputeReturnedCents: 0, notOursCents: 0, stripeFeeCents: 0 };
    for (const l of r.lines) {
      for (const id of l.entryIds ?? []) {
        if (payoutOf.has(id)) continue;
        payoutOf.set(id, key);
        members.push(id);
      }
      const unbooked = (l.entryIds ?? []).length === 0;
      const cents = toCents(l.amount);
      if (l.kind === 'not_ours') f.notOursCents += cents;
      else if (l.kind === 'stripe_fee' && unbooked) f.stripeFeeCents += cents;
      else if (l.kind === 'dispute' && l.dispute && unbooked) {
        // Named from OUR stored amount and fee (P4), never "payment processing".
        f.disputesHeld.push({ disputeId: l.dispute.id, amountCents: l.dispute.amountCents, feeCents: l.dispute.feeCents });
        f.disputeHeldCents -= l.dispute.amountCents + l.dispute.feeCents;
      } else if (l.kind === 'dispute_won' && l.dispute && unbooked) f.disputeReturnedCents += cents;
    }
    membersOf.set(key, members);
    facts[key] = f;
  }
  return { payouts, payoutOf, membersOf, facts };
}

/**
 * Which account a payout belongs to: the account whose books hold its book lines (the first account when it holds any of
 * them — a payout lands in one bank account), or the first account when none of its lines is in a club book. (A payout a
 * mark names stays where it was ticked: `assembleAccount` decides that before asking.)
 */
export function accountOfPayout(input: {
  members: readonly string[]; ledgerOf: ReadonlyMap<string, string>; accountOfBook: ReadonlyMap<string, string>;
  firstAccountId: string;
}): string {
  const count = new Map<string, number>();
  for (const id of input.members) {
    const ledger = input.ledgerOf.get(id);
    const acct = ledger ? input.accountOfBook.get(ledger) : undefined;
    if (acct) count.set(acct, (count.get(acct) ?? 0) + 1);
  }
  if (count.size === 0 || count.has(input.firstAccountId)) return input.firstAccountId;
  return [...count].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
}

/**
 * A payout's gap, by reason (P4). `otherCents` is what the named reasons don't explain. "Add it as payment processing"
 * (Ask 7) is offered for the Stripe fees plus that remainder when together they are money OUT, and `processingCents` is
 * that amount (positive, the line's size) — a held dispute and Stripe activity not ours are never part of it, and money
 * in is never a fee.
 */
export function nameGap(gapCents: number, facts: PayoutGapFacts | undefined): {
  disputeHeldCents: number; disputeReturnedCents: number; notOursCents: number; stripeFeeCents: number; otherCents: number;
  offerPaymentProcessing: boolean; processingCents: number;
} {
  const f = facts ?? { disputesHeld: [], disputeHeldCents: 0, disputeReturnedCents: 0, notOursCents: 0, stripeFeeCents: 0 };
  const otherCents = gapCents - f.disputeHeldCents - f.disputeReturnedCents - f.notOursCents - f.stripeFeeCents;
  const fee = f.stripeFeeCents + otherCents;
  return {
    disputeHeldCents: f.disputeHeldCents, disputeReturnedCents: f.disputeReturnedCents, notOursCents: f.notOursCents,
    stripeFeeCents: f.stripeFeeCents, otherCents, offerPaymentProcessing: fee < 0, processingCents: fee < 0 ? -fee : 0,
  };
}

/**
 * Steps 3–4 of the read: which payouts and which lines are THIS account's.
 * - A payout belongs to the account its book lines sit in (`accountOfPayout`); one ticked on another account stays there.
 * - A line is this account's when its book is, or when a mark of this account names it (a ticked line stays on its old
 *   account's checks when its book moves, Ask 13).
 * - A line read by id whose book now sits in ANOTHER account moved away with its book: it is returned in `movedAway`, so
 *   the caller adds it to `claimedElsewhere` and no saved copy of it lingers here either.
 */
export function assembleAccount(input: {
  accountId: string; firstAccountId: string; ownBooks: ReadonlySet<string>; accountOfBook: ReadonlyMap<string, string>;
  rows: readonly EntryRow[]; marks: readonly BankMark[]; bank: BankPayoutsRead; payoutsTickedElsewhere: ReadonlySet<string>;
}): { lines: BankLine[]; payouts: BankPayout[]; movedAway: string[]; payoutGaps: Record<string, PayoutGapFacts> } {
  const ledgerOf = new Map(input.rows.map(r => [r.id, r.ledger_id]));
  const markedKeys = new Set(input.marks.map(m => m.key));
  const payouts = input.bank.payouts.filter(p => {
    if (markedKeys.has(p.key)) return true;
    if (input.payoutsTickedElsewhere.has(p.key)) return false;
    return accountOfPayout({ members: input.bank.membersOf.get(p.key) ?? [], ledgerOf, accountOfBook: input.accountOfBook,
      firstAccountId: input.firstAccountId }) === input.accountId;
  });
  const passed = new Set(payouts.map(p => p.key));
  const payoutOfHere = new Map([...input.bank.payoutOf].filter(([, k]) => passed.has(k)));
  const lines: BankLine[] = [];
  const movedAway: string[] = [];
  for (const r of input.rows) {
    const key = entryKey(r.id);
    if (input.ownBooks.has(r.ledger_id) || markedKeys.has(key)) lines.push(entryToBankLine(r, payoutOfHere));
    else if (input.accountOfBook.has(r.ledger_id)) movedAway.push(key);
  }
  const payoutGaps: Record<string, PayoutGapFacts> = {};
  for (const k of passed) payoutGaps[k] = input.bank.facts[k];
  return { lines, payouts, movedAway, payoutGaps };
}

