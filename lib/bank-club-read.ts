import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { getClubOwnedLedgers } from './db';
import { onlinePaymentsOn } from './online-payments-switch';
import { readPayouts } from './online-payouts';
import type { BankAccountState } from './bank-check';
import {
  assembleAccount, checkRecords, entryIdOf, keysNamed, liveClubAccounts, marksOf,
  payoutFloor, payoutsForBank, placeBooks, savedOf, stampsOf,
  type AddedLineRow, type BankAccountRow, type BookMoveRow, type ChangeRow, type CheckRow, type ClubBook, type EntryRow,
  type MarkRow, type PayoutGapFacts, type SavedLineRow,
} from './bank-club-map';

/**
 * THE CLUB'S BANK READER (Bank reconciliation R2a; build prompt chunk R2a, rules 1 and 6). One read turns "this club's
 * bank account" into the engine's `BankAccountState` (lib/bank-check.ts) — everything R2b's routes and R2c's screens
 * stand on. Server only; the client never supplies a line, a payout or a figure (rule 6).
 *
 * BOUNDED READS (never all-time, never a year parameter): the account's books from its starting date on; plus, BY ID,
 * every line a mark, a checked statement's saved list, the carried list, an opening item, an added line or a stamped
 * change names, whatever its date; plus a payout's own book lines. Stripe is read from the last checked statement's end
 * (lib/online-payouts.ts, the Payouts reader, never a second one); a failed read is `payoutsUnavailable`, never a throw.
 */

const ENTRY_SELECT = 'id, ledger_id, entry_date, description, amount, entry_type, status, linked_entry_id';

export interface ClubBankAccount {
  id: string;
  name: string;
  isFirst: boolean;
  /** null until the first check's starting point is set (C1). */
  setup: { openingDate: string; openingBalanceCents: number } | null;
  books: ClubBook[];
}

export interface ClubBankAccounts {
  /** The club has never set up an account: C1's "never done this" state; every club book is unplaced. */
  never: boolean;
  accounts: ClubBankAccount[];
  unplacedBooks: ClubBook[];
  /** Book id → the account holding it (every club book once an account exists). */
  accountOfBook: Map<string, string>;
}

export interface ClubBankRead {
  account: ClubBankAccount;
  state: BankAccountState;
  /** Stripe did not answer: no payouts were passed, so their lines read one by one (the engine's fallback). */
  payoutsUnavailable: boolean;
  /** Per payout key passed: what its gap is made of, by reason (P4). */
  payoutGaps: Record<string, PayoutGapFacts>;
}

/** The club's accounts and which books each holds (rule 1: the first is the oldest live CLUB account). */
export async function readClubBankAccounts(orgId: string): Promise<ClubBankAccounts> {
  const [acctRes, books] = await Promise.all([
    supabaseAdmin.from('bank_accounts')
      .select('id, name, owner_kind, created_at, archived_at, opening_date, opening_balance_cents, set_up_at')
      .eq('org_id', orgId).eq('owner_kind', 'club').is('archived_at', null),
    getClubOwnedLedgers(orgId),
  ]);
  if (acctRes.error) throw acctRes.error;
  const rows = liveClubAccounts((acctRes.data ?? []) as BankAccountRow[]);
  const moves = await fetchAllIn<BookMoveRow>(books.map(b => b.id), (c, a, b) =>
    supabaseAdmin.from('bank_account_books').select('ledger_id, bank_account_id').in('ledger_id', c).order('ledger_id').range(a, b));
  const placed = placeBooks(rows, books, moves);
  return {
    never: rows.length === 0,
    accounts: rows.map((r, i) => ({
      id: r.id, name: r.name, isFirst: i === 0,
      setup: r.opening_date ? { openingDate: r.opening_date, openingBalanceCents: Number(r.opening_balance_cents) } : null,
      books: placed.booksOf.get(r.id) ?? [],
    })),
    unplacedBooks: placed.unplaced,
    accountOfBook: placed.accountOfBook,
  };
}

/** Entry rows by id (chunked), any ledger: the caller decides which belong. */
async function entriesById(ids: readonly string[]): Promise<EntryRow[]> {
  return fetchAllIn<EntryRow>(ids, (c, a, b) =>
    supabaseAdmin.from('accounting_entries').select(ENTRY_SELECT).in('id', c).order('id').range(a, b));
}

/** The club's Stripe payouts from `from` to today, with the book lines behind each; `unavailable` when Stripe didn't answer. */
async function readClubPayouts(orgId: string, from: string, today: string) {
  if (!onlinePaymentsOn()) return { rows: [], unavailable: false };
  const { data: acct, error } = await supabaseAdmin.from('org_payment_accounts')
    .select('stripe_account_id, livemode').eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  if (!acct?.stripe_account_id) return { rows: [], unavailable: false };
  try {
    const read = await readPayouts({
      orgId, accountId: acct.stripe_account_id as string, livemode: !!acct.livemode, from, to: today, withEntries: true,
    });
    return { rows: read.payouts, unavailable: false };
  } catch (err) {
    console.error('[bank-club-read] the Stripe payouts read failed; payouts are left out:', err);
    return { rows: [], unavailable: true };
  }
}

/**
 * One account's whole state, ready for `evaluateCheck`. Null when the account is not one of this club's live club
 * accounts (the route answers 404). `today` is the club's day (the Stripe read's end): R2b's routes derive it on the server
 * (rule 6), never from the request.
 */
export async function readClubBankAccount(orgId: string, accountId: string, opts: { today: string }): Promise<ClubBankRead | null> {
  const all = await readClubBankAccounts(orgId);
  const account = all.accounts.find(a => a.id === accountId);
  if (!account) return null;
  const first = all.accounts.find(a => a.isFirst)!;
  const otherAccountIds = all.accounts.filter(a => a.id !== accountId).map(a => a.id);

  // The bounded line read (the account's books from its starting date on) needs only the account, so it rides in the first
  // batch. The floor is the starting date, NOT the last checked end: a line back-dated into a checked month is outstanding
  // on the next check (B4) and a moved-in book's older unticked lines are this account's (Ask 13); book lines carry no
  // trustworthy "last changed" stamp to find either another way.
  const ownBooks = new Set(account.books.map(b => b.id));
  const [checkRows, markRows, exclusionRows, savedRows, windowRows] = await Promise.all([
    fetchAll<CheckRow>((a, b) => supabaseAdmin.from('bank_checks')
      .select('id, statement_end_date, statement_ending_balance_cents, status, outstanding_snapshot')
      .eq('bank_account_id', accountId).order('statement_end_date').range(a, b)),
    fetchAll<MarkRow>((a, b) => supabaseAdmin.from('bank_check_marks')
      .select('check_id, line_key, line_date, direction, amount_cents, payout_key')
      .eq('bank_account_id', accountId).order('line_key').order('check_id').range(a, b)),
    fetchAll<{ line_key: string }>((a, b) => supabaseAdmin.from('bank_line_exclusions')
      .select('line_key').eq('bank_account_id', accountId).order('line_key').range(a, b)),
    fetchAll<SavedLineRow>((a, b) => supabaseAdmin.from('bank_saved_lines')
      .select('kind, line_key, line_date, direction, amount_cents, description')
      .eq('bank_account_id', accountId).order('line_key').order('kind').range(a, b)),
    account.setup ? fetchAllIn<EntryRow>([...ownBooks], (c, a, b) =>
      supabaseAdmin.from('accounting_entries').select(ENTRY_SELECT).in('ledger_id', c).gt('entry_date', account.setup!.openingDate)
        .order('entry_date').order('id').range(a, b)) : Promise.resolve<EntryRow[]>([]),
  ]);
  const checkIds = checkRows.map(c => c.id);
  // Stripe needs only the statements' dates and states, so it starts with the two reads that follow, not after them.
  const stripeFrom = account.setup ? payoutFloor(account.setup.openingDate, checkRecords(checkRows, [])) : '';
  const payoutReading = account.setup ? readClubPayouts(orgId, stripeFrom, opts.today) : null;
  payoutReading?.catch(() => undefined); // awaited below; this only keeps an early failure of the two reads from leaving it unhandled
  const [addedRows, changeRows] = await Promise.all([
    fetchAllIn<AddedLineRow>(checkIds, (c, a, b) =>
      supabaseAdmin.from('bank_check_added_lines').select('check_id, line_key').in('check_id', c).order('line_key').order('check_id').range(a, b)),
    fetchAllIn<ChangeRow>(checkIds, (c, a, b) =>
      supabaseAdmin.from('bank_check_changes').select('check_id, line_key, removed, changed_by, changed_at, cleared_at')
        .in('check_id', c).is('cleared_at', null).order('changed_at').order('id').range(a, b)),
  ]);

  const checks = checkRecords(checkRows, addedRows);
  const marks = marksOf(markRows);
  const { openingItems, carried } = savedOf(savedRows);
  const stampedChanges = stampsOf(changeRows);
  const exclusions = exclusionRows.map(r => r.line_key);

  const base: BankAccountState = {
    setup: account.setup, lines: [], payouts: [], openingItems, checks, marks, exclusions, carried, stampedChanges,
    claimedElsewhere: [],
  };
  // Not set up yet (C1): no starting point means no line belongs to a check yet.
  if (!account.setup) return { account, state: base, payoutsUnavailable: false, payoutGaps: {} };

  // 1. The window read above, and every line the account names, by id.
  const rows = new Map(windowRows.map(r => [r.id, r]));
  const named = keysNamed({ marks, checks, openingItems, carried, stamps: stampedChanges });
  const namedIds = named.map(entryIdOf).filter((x): x is string => !!x && !rows.has(x));

  // 2. Stripe (started above, from the last checked statement's end); then any payout member line not read yet, by id.
  const payoutRead = await payoutReading!;
  const bank = payoutsForBank(payoutRead.rows);
  const memberIds = [...bank.payoutOf.keys()].filter(id => !rows.has(id));
  for (const r of await entriesById([...namedIds, ...memberIds])) rows.set(r.id, r);

  // 3–4. Which payouts and lines are this account's (pure: `assembleAccount`).
  const markedKeys = new Set(marks.map(m => m.key));
  const marksOnOthers = async (keys: string[]): Promise<string[]> => otherAccountIds.length === 0 ? [] :
    (await fetchAllIn<{ line_key: string }>(keys, (c, a, b) => supabaseAdmin.from('bank_check_marks').select('line_key')
      .in('bank_account_id', otherAccountIds).in('line_key', c).order('line_key').order('bank_account_id').range(a, b))).map(r => r.line_key);
  const otherMarkedPayouts = new Set(await marksOnOthers(bank.payouts.map(p => p.key).filter(k => !markedKeys.has(k))));
  const { lines, payouts, movedAway, payoutGaps } = assembleAccount({
    accountId, firstAccountId: first.id, ownBooks, accountOfBook: all.accountOfBook, rows: [...rows.values()], marks, bank,
    payoutsTickedElsewhere: otherMarkedPayouts,
  });

  // 5. Lines ticked on the club's OTHER accounts (Ask 13): only those this account could show. (The payouts passed here
  // are by construction not ticked elsewhere: `assembleAccount` dropped those.)
  const tickedElsewhere = await marksOnOthers(lines.map(l => l.key).filter(k => !markedKeys.has(k)));

  return {
    account,
    state: { ...base, lines, payouts, claimedElsewhere: [...new Set([...tickedElsewhere, ...movedAway])] },
    payoutsUnavailable: payoutRead.unavailable,
    payoutGaps,
  };
}
