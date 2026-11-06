import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { fetchAll, fetchAllIn } from './supabase-paging';
import { getClubOwnedLedgers, resolvePersonNamer } from './db';
import { onlinePaymentsOn } from './online-payments-switch';
import { readPayouts } from './online-payouts';
import { booksNowSay, stillWaitingOn, suspectsSince, suspectsStart, type BankLine, type WaitingItem } from './bank-check';
import {
  CHECK_SELECT, ENTRY_SELECT, ONLINE_METHODS, WAITING_SELECT, beforeStartLines, beforeStartWindow, bookIdsOf, clubBooksOnDate,
  entryToBankLine, isOnlineEntry,
  liveClubAccounts, onItsWay, onItsWayFloor, placeBooks, savedChecksOf,
  type BankAccountRow, type BookMoveRow, type CheckRow, type ClubBook, type ClubSavedCheck, type EntryRow, type OnItsWay,
  type PayoutRowLike, type WaitingRow,
} from './bank-club-map';
import { checkedThrough, saveRefusal, type SaveRefusal } from './bank-club-rules';

/**
 * THE CLUB'S BANK READER (Bank balance check BC1; plan §4, §7, §9 BC1). Server only; the client never supplies a line, a
 * payout or a figure (rule 6). One account's read is: its books (placed now), its live saved checks with their waiting
 * items and "Books now say" (re-figured over each check's OWN books, Q3/O1), every account's latest check (the pill), and
 * — for a statement date D — Your books on D, Stripe on its way, the suspects since the last match and the latest earlier
 * check's items ("Still waiting?").
 *
 * BOUNDED READS, never a year parameter: the club's live checks are ONE query (their items embedded), read beside the
 * accounts; the books through a set of dates is ONE SQL pass (`bank_books_through`, mig 447); the suspects are the
 * account's posted lines after the last match through D; on its way reads the 30 days before D and the club's Payouts
 * reader (lib/online-payouts.ts, never a second Stripe reader; a failure is *not counted*, never a throw).
 */

interface ClubBankAccount {
  id: string;
  name: string;
  isFirst: boolean;
  books: ClubBook[];
}

interface ClubBankAccounts {
  /** The club has never added an account: the "never done this" state; every club book is unplaced. */
  never: boolean;
  accounts: ClubBankAccount[];
  unplacedBooks: ClubBook[];
  /** Book id → the account holding it (every club book once an account exists). */
  accountOfBook: Map<string, string>;
}

/** The club's accounts and which books each holds (rule 1: the first is the oldest live CLUB account). */
export async function readClubBankAccounts(orgId: string): Promise<ClubBankAccounts> {
  const [acctRes, books] = await Promise.all([
    supabaseAdmin.from('bank_accounts').select('id, name, owner_kind, created_at, archived_at')
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
    accounts: rows.map((r, i) => ({ id: r.id, name: r.name, isFirst: i === 0, books: placed.booksOf.get(r.id) ?? [] })),
    unplacedBooks: placed.unplaced,
    accountOfBook: placed.accountOfBook,
  };
}

/** Every LIVE check of the club's live club accounts, with its waiting items, oldest first per account — one query (the
 *  items embedded), so it needs no account id and runs beside the accounts read. */
export async function readClubChecks(orgId: string): Promise<Map<string, ClubSavedCheck[]>> {
  const rows = await fetchAll<CheckRow & { bank_check_waiting: Omit<WaitingRow, 'check_id'>[] }>((a, b) => supabaseAdmin.from('bank_checks')
    .select(`${CHECK_SELECT}, bank_check_waiting(${WAITING_SELECT}), bank_accounts!inner(org_id)`)
    .eq('bank_accounts.org_id', orgId).eq('bank_accounts.owner_kind', 'club').is('bank_accounts.archived_at', null)
    .is('deleted_at', null).order('bank_account_id').order('statement_end_date').order('id').range(a, b));
  const byAccount = new Map<string, { checks: CheckRow[]; waiting: WaitingRow[] }>();
  for (const r of rows) {
    const g = byAccount.get(r.bank_account_id) ?? { checks: [], waiting: [] };
    g.checks.push(r);
    for (const w of r.bank_check_waiting ?? []) g.waiting.push({ ...w, check_id: r.id });
    byAccount.set(r.bank_account_id, g);
  }
  return new Map([...byAccount].map(([id, g]) => [id, savedChecksOf(g.checks, g.waiting)]));
}

/** `bank_books_through`: posted in − posted out of these books, all-time through each date, in one pass (mig 447). */
async function booksThrough(bookIds: readonly string[], dates: readonly string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const asked = [...new Set(dates)];
  if (asked.length === 0) return out;
  if (bookIds.length > 0) {
    const { data, error } = await supabaseAdmin.rpc('bank_books_through', { p_ledgers: [...bookIds], p_dates: asked });
    if (error) throw error;
    for (const r of (data ?? []) as { through_date: string; net_cents: number | string }[]) out.set(r.through_date, Number(r.net_cents));
  }
  for (const d of asked) if (!out.has(d)) out.set(d, 0);
  return out;
}

/** "Your books on D" for each date over these books (P5): the start's books + their movement after the start through D.
 *  The one home of that sum for both the saved list (each check's own books, Q3) and the day's figure (the books now). */
async function booksOnDates(start: ClubSavedCheck, bookIds: readonly string[], dates: readonly string[]): Promise<Map<string, number>> {
  const through = await booksThrough(bookIds, [start.date, ...dates]);
  return new Map(dates.map(d => [d, clubBooksOnDate({ startBooksCents: start.booksCents, throughD: through.get(d)!, throughStart: through.get(start.date)! })]));
}

/** The club's Stripe payouts arriving from `from` to `today`, with the book lines behind each. `none` when the club has no
 *  Stripe account; `unavailable` when Stripe didn't answer. */
async function readClubPayouts(orgId: string, from: string, today: string):
  Promise<{ kind: 'none' } | { kind: 'unavailable' } | { kind: 'read'; rows: PayoutRowLike[] }> {
  const { data: acct, error } = await supabaseAdmin.from('org_payment_accounts')
    .select('stripe_account_id, livemode').eq('org_id', orgId).maybeSingle();
  if (error) throw error;
  if (!acct?.stripe_account_id) return { kind: 'none' };
  try {
    const read = await readPayouts({
      orgId, accountId: acct.stripe_account_id as string, livemode: !!acct.livemode, from, to: today, withEntries: true,
    });
    return { kind: 'read', rows: read.payouts };
  } catch (err) {
    console.error('[bank-club-read] the Stripe payouts read failed; on its way is not counted:', err);
    return { kind: 'unavailable' };
  }
}

/**
 * Stripe "on its way" on D for these books (plan §4, ask 8): the online lines of the 30 days before D, less those inside a
 * payout that arrived by D. `today` is the club's day (the Payouts read reaches past D for the "pays them out" day). With
 * online payments switched off there is no line at all, and nothing is read.
 */
async function readOnItsWay(orgId: string, bookIds: readonly string[], date: string, today: string): Promise<OnItsWay> {
  if (!onlinePaymentsOn()) return { state: 'none', cents: 0, lines: [] };
  const floor = onItsWayFloor(date);
  const [payouts, online] = await Promise.all([
    readClubPayouts(orgId, floor, today),
    fetchAllIn<EntryRow>([...bookIds], (c, a, b) => supabaseAdmin.from('accounting_entries').select(ENTRY_SELECT)
      .in('ledger_id', c).eq('status', 'posted').in('payment_method', [...ONLINE_METHODS])
      .gt('entry_date', floor).lte('entry_date', date).order('entry_date').order('id').range(a, b)),
  ]);
  if (payouts.kind === 'none') return { state: 'none', cents: 0, lines: [] };
  const figured = onItsWay({ date, online, payouts: payouts.kind === 'read' ? payouts.rows : [] });
  if (payouts.kind === 'unavailable') return { state: 'not_counted', reason: 'stripe_down', cents: null, lines: figured.lines };
  return figured;
}

/** A suspect as Find lists it: the engine's line, its book, whether it is an online payment, and how it came (the
 *  ledger's own phrase — "Cheque 214", "E-Transfer", `online_card` — worded by the screen; BC3a). */
type SuspectLine = BankLine & { bookId: string; online: boolean; method: string | null };

/** Posted lines of these books dated after `after` through `to` (the suspects' window), as the engine reads them. */
async function linesBetween(bookIds: readonly string[], after: string, to: string): Promise<SuspectLine[]> {
  const rows = await fetchAllIn<EntryRow>([...bookIds], (c, a, b) => supabaseAdmin.from('accounting_entries').select(ENTRY_SELECT)
    .in('ledger_id', c).eq('status', 'posted').gt('entry_date', after).lte('entry_date', to)
    .order('entry_date').order('id').range(a, b));
  return rows.map(r => ({ ...entryToBankLine(r), bookId: r.ledger_id, online: isOnlineEntry(r), method: r.payment_method?.trim() || null }));
}

/** A saved check as the list shows it: its own figures, and "Books now say" re-figured over its own books (O1). */
export interface ClubCheckView extends ClubSavedCheck {
  /** Ask 6: the books as they read now, when they differ from the saved figure; never on the start. */
  booksNowSayCents: number | null;
  /** Q2: a line was put on (or taken off) the starting statement after this check was saved — why the books now differ. */
  startCorrected: boolean;
}

/**
 * Ask 6 + Q3: re-figure every saved check's books as they read now — the start's books AS THEY READ NOW + the movement of
 * the check's OWN `book_ids` since the start. One SQL call per distinct book list (a move between accounts is the only
 * thing that makes two).
 * ⚖ M2 (BC1 review, closed BC3b): the start's books ARE its items as they are now — `bank_start_waiting` (mig 449) moves
 *   the start's `books_cents` by exactly each item it attaches or takes off, so a line marked "Waiting at the start" shows
 *   on every saved later check as "Books now say $X" (ruling "Q2 + ask 6"), and its figures stay as they were.
 */
async function withBooksNow(checks: readonly ClubSavedCheck[]): Promise<ClubCheckView[]> {
  const start = checks.find(c => c.kind === 'start');
  const groups = new Map<string, ClubSavedCheck[]>();
  for (const c of checks) {
    if (c.kind !== 'check') continue;
    const k = c.bookIds.join(',');
    const g = groups.get(k);
    if (g) g.push(c); else groups.set(k, [c]);
  }
  const nowOf = new Map<string, number>();
  if (start) {
    await Promise.all([...groups.values()].map(async g => {
      const books = await booksOnDates(start, g[0].bookIds, g.map(c => c.date));
      for (const c of g) nowOf.set(c.id, books.get(c.date)!);
    }));
  }
  // The start moved after a check was saved: it was corrected (a line put on or taken off, mig 450's `corrected_at`: a
  // line taken off leaves no row of its own), or it was saved again after it. Either way the start's reason, not the
  // ledger's (BC3b /review).
  const startMoved = [start?.correctedAt, start?.createdAt].filter((t): t is string => !!t);
  return checks.map(c => ({
    ...c,
    booksNowSayCents: nowOf.has(c.id) ? booksNowSay(c.booksCents, nowOf.get(c.id)!) : null,
    startCorrected: c.kind === 'check' && startMoved.some(t => t > c.createdAt),
  }));
}

/** At most this many suspects go to the screen (the hints look through the most recent 400: lib/bank-check.ts). */
const SUSPECT_CAP = 1000;

/** The figure for a statement date D (no bank balance: the screen types it and the engine figures the band). */
export interface ClubFigureForDate {
  date: string;
  /** What saving on this date writes: the starting statement, or a check. */
  kind: 'start' | 'check';
  /** Why a save on this date would be refused (the screen says it before Save; the save step refuses the same). */
  refused: SaveRefusal | null;
  /** Your books on D; null for a start (its books are the bank balance solved: `startBooks`). */
  booksCents: number | null;
  onItsWay: OnItsWay;
  /** Ask 3: lines since the last match (since the start on a first check), newest first, at most SUSPECT_CAP. */
  suspects: { since: string; sinceMatch: boolean; total: number; lines: SuspectLine[] };
  /** Ask 2: the latest earlier check's "Not in the bank yet" items, asked "Still waiting?" (BC3 asks), and the start's
   *  Waiting-at-the-start lines as the chain's first link (BC4a, `stillWaitingOn`), each marked `atStart`. */
  stillWaiting: WaitingItem[];
  /** Q2 look-back (owner 2026-11-06): on a check within six months of the start, the account's lines of the 60 days before
   *  the start that could be "Waiting at the start" (`beforeStartLines`); null past six months. The screen offers them only
   *  while the check is off. */
  beforeStart: { after: string; through: string; lines: SuspectLine[] } | null;
  /** The live check of this date a save would replace ("Check this statement again"). */
  replaces: string | null;
}

/**
 * The facts a save on D stands on, read fresh (the save step and the screen's figure share it; rule 6). `kind` is the
 * door a save comes through; the screen's read leaves it out and gets what saving on that day would be (a start when
 * there is none yet, or on the start's own date). The save path skips the suspects (`suspects: false`).
 */
export async function figureForDate(orgId: string, account: ClubBankAccount, checks: readonly ClubSavedCheck[], date: string,
  today: string, opts: { kind?: 'start' | 'check'; suspects?: boolean } = {}): Promise<ClubFigureForDate> {
  const bookIds = bookIdsOf(account.books);
  const start = checks.find(c => c.kind === 'start') ?? null;
  const kind = opts.kind ?? (!start || start.date === date ? 'start' : 'check');
  const refused = saveRefusal({ asked: kind, date, today, checks });
  const replaces = checks.find(c => c.date === date)?.id ?? null;
  const noSuspects = { since: date, sinceMatch: false, total: 0, lines: [] };

  if (kind === 'start' || !start || refused) {
    return { date, kind, refused, booksCents: null, onItsWay: await readOnItsWay(orgId, bookIds, date, today), suspects: noSuspects,
      stillWaiting: [], beforeStart: null, replaces };
  }
  const { since } = suspectsStart(checks, date, start.date);
  const look = opts.suspects === false ? null : beforeStartWindow(start.date, date);
  const [books, oiw, window, before] = await Promise.all([
    booksOnDates(start, bookIds, [date]),
    readOnItsWay(orgId, bookIds, date, today),
    opts.suspects === false ? Promise.resolve<SuspectLine[]>([]) : linesBetween(bookIds, since, date),
    look ? linesBetween(bookIds, look.after, look.through) : Promise.resolve<SuspectLine[]>([]),
  ]);
  const s = suspectsSince({ lines: window, checks, date, startDate: start.date });
  return {
    date, kind, refused, booksCents: books.get(date)!, onItsWay: oiw,
    suspects: { since: s.since, sinceMatch: s.sinceMatch, total: s.lines.length, lines: s.lines.slice(0, SUSPECT_CAP) },
    stillWaiting: stillWaitingOn(checks, date),
    beforeStart: look ? { ...look, lines: beforeStartLines(before, start).slice(0, SUSPECT_CAP) } : null,
    replaces,
  };
}

/**
 * One account: its books, live checks with "Books now say", every account's latest check, the names of who checked, and
 * (with `date`) the figure for that day. Null when the account is not one of this club's live club accounts (the route
 * answers 404). `today` is the club's day, the server's (rule 6), never the request's.
 */
export async function readClubBankAccount(orgId: string, accountId: string, opts: { today: string; date?: string | null; asked?: 'start' | 'check' }) {
  const [all, byAccount] = await Promise.all([readClubBankAccounts(orgId), readClubChecks(orgId)]);
  const account = all.accounts.find(a => a.id === accountId);
  if (!account) return null;
  const saved = byAccount.get(accountId) ?? [];
  const [checks, figure, nameOf] = await Promise.all([
    withBooksNow(saved),
    opts.date ? figureForDate(orgId, account, saved, opts.date, opts.today, { kind: opts.asked }) : Promise.resolve(null),
    resolvePersonNamer(orgId, [...saved.map(c => c.createdBy), ...saved.flatMap(c => c.waiting.map(w => w.addedBy ?? null))]),
  ]);
  const latest = new Map(all.accounts.map(a => [a.id, checkedThrough(byAccount.get(a.id) ?? [])]));
  return { account, all, checks, latest, figure, nameOf };
}

/** Lines of the books by id (a waiting item's figures come from the books: rule 6). */
export async function entriesById(ids: readonly string[]): Promise<EntryRow[]> {
  return fetchAllIn<EntryRow>([...ids], (c, a, b) =>
    supabaseAdmin.from('accounting_entries').select(ENTRY_SELECT).in('id', c).order('id').range(a, b));
}
