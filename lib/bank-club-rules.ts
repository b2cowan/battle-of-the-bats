/**
 * THE CLUB'S BANK ROUTES, DECIDED (Bank balance check BC1; plan §4, §7, §9 BC1). The pure half of every bank route: the
 * client sends INTENT (this date, this balance, these lines are not in the bank yet, this much cash); the server has read
 * the account (lib/bank-club-read.ts) and this file decides, with the engine (lib/bank-check.ts), exactly what a step
 * writes or refuses. No IO, so every rule is tested with fixtures (tests/unit/bank-club-routes.test.ts). The database
 * half is mig 447's functions, which hold the same rules again under the account's lock.
 *
 * ⚖ RULING 3: a check saves whether it matches or not. There is no $0.00 gate anywhere.
 * ⚖ RULE 6: the only figures taken from the client are the statement's balance and the cash figure. Your books, on its
 *   way and every waiting item's figures are the server's own read.
 * ⚖ ASK 1: nothing here writes money; cash is a number on the check.
 * ⚖ NO YEAR: nothing here reads or names a fiscal year or a season.
 */

import { checkingStartsOn, figureOfSaved, startBooks, typedCents, waitingOnStart, type CheckFigure, type SavedCheck, type WaitingItem } from './bank-check';
import { directionOfEntry, entryIdOf, isOnlineEntry, type ClubSavedCheck, type EntryRow, type OnItsWay } from './bank-club-map';
import { BANK_REFUSAL, type BankRefusalCode } from './bank-check-words';
import { toCents } from './coach-register';
import { isCalendarDate } from './timezone';
import { isUuid } from './utils';

export type Decision<T> = ({ ok: true } & T) | { ok: false; status: number; code: BankRefusalCode };
/** A refusal decision: the code names it, and its status is the code's one status (`STATUS_OF`), never typed again. */
export const no = (code: BankRefusalCode): { ok: false; status: number; code: BankRefusalCode } =>
  ({ ok: false, status: STATUS_OF[code], code });

/** Every refusal's HTTP status, ONE per code (a new code without one is a type error): not found 404, a bad request 400,
 *  everything else a conflict 409. */
export const STATUS_OF: Record<BankRefusalCode, number> = {
  account_not_found: 404, check_not_found: 404, book_not_found: 404, org_not_found: 404,
  bad_name: 400, bad_figures: 400, bad_kind: 400, bad_amount: 400, bad_date: 400, bad_item: 400, bad_start_item: 400, ends_in_future: 400,
  team_book: 409, name_taken: 409, changed: 409, start_exists: 409, start_after_checks: 409, no_start: 409,
  before_start: 409, start_has_checks: 409, not_counted_down: 409, not_counted_unlisted: 409,
  // A team's (BC6a, lib/bank-coach-rules.ts).
  before_season: 409, bad_team_item: 400,
};
export const statusOfRefusal = (code: BankRefusalCode): number => STATUS_OF[code];

/** A mig 447 step's `{ ok: false, code }` → a known code (an unknown one reads as `changed`: read again). */
export const refusalOfStep = (code: string | undefined): BankRefusalCode =>
  (code && code in BANK_REFUSAL ? code : 'changed') as BankRefusalCode;

/** A database error → a refusal code, or null for a real failure: mig 436's guard trigger, mig 447's raised refusals, a
 *  race on a unique index. */
export function refusalOfDbError(e: { message?: string; code?: string; details?: string } | null): BankRefusalCode | null {
  const msg = `${e?.message ?? ''} ${e?.details ?? ''}`;
  const raised = /bank_step_refused:(\w+)/.exec(msg)?.[1];
  if (raised && raised in BANK_REFUSAL) return raised as BankRefusalCode;
  if (/bank_book_is_team_book/.test(msg)) return 'team_book';
  if (/bank_book_other_club/.test(msg)) return 'book_not_found';
  if (/bank_book_not_club_account/.test(msg)) return 'account_not_found';
  if (e?.code === '23505' && /bank_accounts_club_name/.test(msg)) return 'name_taken';
  if (e?.code === '23505' && /bank_check_waiting_once/.test(msg)) return 'bad_item';
  // Two saves of one date racing past the step's own replace: the second reads again.
  if (e?.code === '23505' && /bank_checks_one_live_(per_date|start)/.test(msg)) return 'changed';
  return null;
}

// ── reading a request ────────────────────────────────────────────────────────────────────────

/** $100 million: past any club's statement, short of bigint and float trouble. */
const MAX_CENTS = 10_000_000_000;

/** Integer cents from the request (a statement balance may be negative: an overdrawn account). */
export function readCents(v: unknown, opts: { positive: boolean }): number | null {
  if (typeof v !== 'number' || !Number.isInteger(v) || Math.abs(v) > MAX_CENTS) return null;
  if (opts.positive && v <= 0) return null;
  return v;
}

/** The earliest statement a check takes: no bank statement of a club's books is older (0202-10-31 was once accepted as a start). */
export const EARLIEST_STATEMENT_DAY = '2000-01-01';

/** A real calendar day, YYYY-MM-DD, no earlier than `EARLIEST_STATEMENT_DAY` (ISO days compare as strings). */
export const readDay = (v: unknown): string | null => (typeof v === 'string' && isCalendarDate(v) && v >= EARLIEST_STATEMENT_DAY ? v : null);

/** The first `max` CHARACTERS of a text, never half of one (a UTF-16 cut can leave half an emoji). */
export const cutText = (t: string, max: number): string => { const chars = Array.from(t); return chars.length <= max ? t : chars.slice(0, max).join(''); };

export function readText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= max ? t : null;
}

/**
 * Find's search, by shape (BC3): `$12` or `12.50` is an amount only; all digits ("1234") is a cheque number as much as an
 * amount, so it searches both; anything else is words in the description. A statement's own thousands comma ("$1,250.00",
 * "1,250": groups of exactly three digits) is an amount (BC3a); a comma before exactly two final digits ("12,50") is a
 * DECIMAL comma (O4, BC3b). Anything shaped like an amount is read by the balance field's own parser (`typedCents`), so
 * the search and the field never disagree about what a number is.
 */
export type FindSearch =
  { kind: 'none' } | { kind: 'amount'; amount: number } | { kind: 'either'; amount: number; words: string } | { kind: 'words'; words: string };

export function pickerSearch(q: string): FindSearch {
  const words = q.trim().slice(0, 80);
  if (!words) return { kind: 'none' };
  if (/^\d{1,9}$/.test(words)) return { kind: 'either', amount: Number(words), words };
  const c = /^\$?[\d,.]+$/.test(words) ? typedCents(words, { positive: false }) : null;
  return c !== null ? { kind: 'amount', amount: c / 100 } : { kind: 'words', words };
}

/**
 * Does a line answer Find's search (BC3a)? An amount matches the line's own amount to the cent, in either direction; words
 * match the line's words or how it came ("Cheque 214", "E-Transfer"), any case. Nothing typed matches every line.
 */
export function lineMatches(search: FindSearch, line: { amountCents: number; label?: string | null; how?: string | null }): boolean {
  if (search.kind === 'none') return true;
  const byAmount = search.kind !== 'words' && Math.round(search.amount * 100) === line.amountCents;
  if (search.kind === 'amount') return byAmount;
  const w = search.words.toLowerCase();
  return byAmount || [line.label, line.how].some(t => !!t && t.toLowerCase().includes(w));
}

/** A book line as a waiting item, its figures the server's own read of the line (rule 6); null for one with no amount. */
function waitingItemOf(key: string, r: EntryRow): WaitingItem | null {
  const amountCents = toCents(r.amount);
  if (amountCents <= 0) return null;
  const label = r.description ? cutText(r.description.trim(), 200) : undefined;
  return { key, date: r.entry_date, direction: directionOfEntry(r), amountCents, ...(label ? { label } : {}) };
}

/** At most this many "Not in the bank yet" lines on one check (a team's too: lib/bank-coach-rules.ts). */
export const MAX_WAITING = 200;

/** The entry ids a save names as waiting (only `entry:{uuid}` keys are looked up; anything else is `bad_item` below). */
export function waitingIdsOf(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAX_WAITING + 1).map(k => (typeof k === 'string' ? entryIdOf(k) : null)).filter((x): x is string => !!x && isUuid(x));
}

// ── save a check (ruling 3, asks 1, 2, 7) ────────────────────────────────────────────────────

/** The date rules a save is refused by, before any figure is read. */
export type SaveRefusal = Extract<BankRefusalCode, 'ends_in_future' | 'start_exists' | 'start_after_checks' | 'no_start' | 'before_start'>;

/**
 * The ONE TypeScript copy of `bank_check_save`'s date rules, in its order (the step holds them again under the account's
 * lock): not after the club's today; a start is the account's only one (re-saved on its own date) and before every live
 * check; a check needs the start and comes after it (O2: the start owns its date). `asked` is the door the save comes
 * through (the setup route = a start, the checks route = a check); the screen asks what saving on a day would be.
 */
export function saveRefusal(i: { asked: 'start' | 'check'; date: string; today: string; checks: readonly Pick<SavedCheck, 'kind' | 'date'>[] }): SaveRefusal | null {
  if (i.date > i.today) return 'ends_in_future';
  const start = i.checks.find(c => c.kind === 'start');
  if (i.asked === 'start') {
    if (start && start.date !== i.date) return 'start_exists';
    if (i.checks.some(c => c.kind === 'check' && c.date <= i.date)) return 'start_after_checks';
    return null;
  }
  if (!start) return 'no_start';
  if (i.date <= start.date) return 'before_start';
  return null;
}

/** What the step needs from the server's read of the account on the statement's date. */
export interface SaveFacts {
  /** Your books on D (null for a start: solved from the bank). */
  booksCents: number | null;
  onItsWay: OnItsWay;
  /** The account's books now (the step refuses `changed` if they moved since). */
  bookIds: string[];
  /** The starting statement's date (null while there is none: a save then IS the start). */
  startDate: string | null;
  /** The live start's Waiting-at-the-start line keys (M3's exception, BC4a). */
  startWaiting: readonly string[];
}

/**
 * Decide a save whose date rules have passed (`saveRefusal`). The waiting keys are looked up in `entries` (read by id on
 * the server): each must be a POSTED line of the account's books dated on or before the statement and not one counted in
 * Stripe's on its way (it is in the figure already; when Stripe didn't answer, nothing is, so any line may wait).
 * ⚖ M3 (owner 2026-11-06): a CHECK's line must be dated AFTER the starting statement — the start already proved a line on
 *   or before its date was in the bank (one that cleared late is the start's own "Waiting at the start", Q2).
 * ⚖ M3's exception (owner 2026-11-06, BC4a): a line on the LIVE start's Waiting-at-the-start list may be a check's item
 *   although it is dated on or before the start ("Still waiting?" asks about it on a check dated before it cleared); any
 *   other pre-start line is still `bad_item`. The start under the lock (mig 449's `p_start_books`) refuses `changed` when
 *   the start's books moved since this read, which a line taken off does; it compares the books, not the keys (a line taken
 *   off and another of the same amount put on inside the same instant is not caught: the figures are the same, BC4a /review).
 */
export function savePlan(input: { kind: 'start' | 'check'; date: string; body: Record<string, unknown>; facts: SaveFacts;
  entries: readonly EntryRow[] }) {
  const { kind, date, body, facts } = input;
  const bankCents = readCents(body.bankCents, { positive: false });
  if (bankCents === null) return no('bad_figures');

  let cashCents: number | null = null;
  if (body.cashCents !== undefined && body.cashCents !== null && body.cashCents !== 0) {
    cashCents = readCents(body.cashCents, { positive: true });
    // Cash is a check's figure only (ask 1); the start is a date and a balance (ask 7).
    if (cashCents === null || kind === 'start') return no('bad_amount');
  }

  const keys = body.waiting ?? [];
  if (!Array.isArray(keys) || keys.length > MAX_WAITING) return no('bad_item');
  const byId = new Map(input.entries.map(r => [r.id, r]));
  const books = new Set(facts.bookIds);
  const onItsWay = new Set(facts.onItsWay.state === 'counted' ? facts.onItsWay.lines.map(l => l.key) : []);
  const onStart = new Set(facts.startWaiting);
  const waiting = new Map<string, WaitingItem>();
  for (const k of keys) {
    const id = typeof k === 'string' ? entryIdOf(k) : null;
    const r = id ? byId.get(id) : undefined;
    if (!r || r.status !== 'posted' || !books.has(r.ledger_id) || r.entry_date > date || onItsWay.has(k as string)) return no('bad_item');
    if (kind === 'check' && facts.startDate !== null && r.entry_date <= facts.startDate && !onStart.has(k as string)) return no('bad_item');
    const item = waitingItemOf(k as string, r);
    if (!item) return no('bad_item');
    waiting.set(item.key, item);
  }
  const items = [...waiting.values()];

  const onItsWayCents = facts.onItsWay.cents;
  const booksCents = kind === 'start' ? startBooks({ bankCents, onItsWayCents, waiting: items }) : facts.booksCents!;
  return { ok: true as const, args: { kind, date, bankCents, booksCents, onItsWayCents, cashCents, bookIds: facts.bookIds, waiting: items } };
}

// ── what the screens read ────────────────────────────────────────────────────────────────────

/** A saved check as the list and the opened window show it (tab 5): its own figures, the band from them, the result. */
export interface CheckView {
  id: string;
  kind: 'start' | 'check';
  date: string;
  bankCents: number;
  booksCents: number;
  onItsWayCents: number | null;
  cashCents: number | null;
  waiting: WaitingItem[];
  figure: CheckFigure;
  /** Ask 6: the books as they read now, when they differ (never on the start). */
  booksNowSayCents: number | null;
  /** Q2: the starting statement was corrected after this check was saved (the "Books now say" reason). */
  startCorrected: boolean;
  checkedBy: string | null;
  checkedAt: string;
}

export function checkView(c: ClubSavedCheck & { booksNowSayCents: number | null; startCorrected: boolean },
  nameOf: (id: string | null) => string | null): CheckView {
  return {
    id: c.id, kind: c.kind, date: c.date, bankCents: c.bankCents, booksCents: c.booksCents, onItsWayCents: c.onItsWayCents,
    cashCents: c.cashCents,
    // Who put a line on the start is a name on the screen, never an id (an item saved with its own check has none).
    waiting: c.waiting.map(w => (w.addedAt ? { ...w, addedBy: nameOf(w.addedBy ?? null) } : w)),
    figure: figureOfSaved(c), booksNowSayCents: c.booksNowSayCents, startCorrected: c.startCorrected,
    checkedBy: nameOf(c.createdBy), checkedAt: c.createdAt,
  };
}

// ── "Waiting at the start" (Q2): put a line on the starting statement, or take one off ───────────────────────────

/**
 * Decide a correction of the starting statement (Q2-A, owner 2026-11-05; mig 449's `bank_start_waiting` holds it again
 * under the account's lock). `add`: a line key the server read from the books by id (`entries`, with its transfer's other
 * half when it has one) — a POSTED line of the account's books dated ON OR BEFORE the start, not an online payment (the
 * start's on its way is Stripe's figure), not a transfer whose other half is in this account (it nets to nothing), not on
 * the start already. `remove`: a line key on the start now. The start's books move by exactly the item
 * (`waitingOnStart`): the step re-checks the same sum.
 */
export function startItemPlan(input: { body: Record<string, unknown>; start: ClubSavedCheck | null; bookIds: readonly string[];
  entries: readonly EntryRow[] }) {
  const { body, start } = input;
  const add = typeof body.add === 'string' ? body.add : null;
  const remove = typeof body.remove === 'string' ? body.remove : null;
  if ((add === null) === (remove === null)) return no('bad_item');
  if (!start) return no('no_start');
  const before = start.booksCents;
  if (remove !== null) {
    const item = start.waiting.find(w => w.key === remove);
    if (!item) return no('changed');
    return { ok: true as const, args: { startId: start.id, booksBefore: before, booksAfter: before - waitingOnStart(item), add: null, remove } };
  }
  const id = entryIdOf(add!);
  const byId = new Map(input.entries.map(r => [r.id, r]));
  const r = id ? byId.get(id) : undefined;
  const books = new Set(input.bookIds);
  // A line the start can't hold has its own sentence (`bad_start_item`): `bad_item`'s says "dated after your starting
  // statement", the opposite of this door's rule (BC3b /marketing).
  if (!r || r.status !== 'posted' || !books.has(r.ledger_id) || r.entry_date > start.date || isOnlineEntry(r)) return no('bad_start_item');
  const pair = r.linked_entry_id ? byId.get(r.linked_entry_id) : undefined;
  if (pair && books.has(pair.ledger_id)) return no('bad_start_item');
  if (start.waiting.some(w => w.key === add)) return no('bad_start_item');
  const item = waitingItemOf(add!, r);
  if (!item) return no('bad_start_item');
  return { ok: true as const, args: { startId: start.id, booksBefore: before, booksAfter: before + waitingOnStart(item), add: item, remove: null } };
}

/** The entry id a start correction adds (null for a removal, or a key that isn't a club line). */
export const startItemIdOf = (body: Record<string, unknown>): string | null => {
  const id = typeof body.add === 'string' ? entryIdOf(body.add) : null;
  return id && isUuid(id) ? id : null;
};

export interface CheckedThrough { id: string; date: string; result: 'matches' | 'off'; offByCents: number }

/** Ask 4: the account's "checked through" — its latest check's id, date and result (Matches / Off by $X); null before
 *  one. With `asOf`, the latest check dated on or before that day (BC5a: the fiscal-year close reads the year's last day).
 *  `checks` are oldest first (`readClubChecks`). */
export function checkedThrough(checks: readonly ClubSavedCheck[], asOf?: string): CheckedThrough | null {
  const last = checks.filter(c => c.kind === 'check' && (asOf === undefined || c.date <= asOf)).at(-1);
  if (!last) return null;
  const f = figureOfSaved(last);
  return { id: last.id, date: last.date, result: f.result, offByCents: f.offByCents };
}

/** A bank row of the fiscal-year close's "Still open" (BC5a, owner 2026-11-06 "Close row"): `unchecked` — no check on or
 *  before the year end, or the latest is before the year's last month; `off` — the latest by the year end is off. */
export type BankCloseRow =
  | { kind: 'unchecked'; lastChecked: string | null }
  | { kind: 'off'; lastChecked: string; checkId: string; offByCents: number };

/**
 * The close row for one account and a year ending `lastDay` (a month's last day: a fiscal year runs whole months), or null
 * when nothing is open. ⚖ No row when the account's bank checking began in or after the year's last month (the day
 * checking starts, `checkingStartsOn`: the start row holds the day before, so a statement starting on the 1st is that
 * month's — S1b /review), or has no start: that year was never in the checks' reach, so a row would ask the impossible.
 * Warns, never blocks (the close's own rule).
 */
export function bankCloseRow(checks: readonly ClubSavedCheck[], lastDay: string): BankCloseRow | null {
  const lastMonth = `${lastDay.slice(0, 8)}01`;
  const start = checks.find(c => c.kind === 'start');
  if (!start || checkingStartsOn(start.date) >= lastMonth) return null;
  const latest = checkedThrough(checks, lastDay);
  if (!latest || latest.date < lastMonth) return { kind: 'unchecked', lastChecked: latest?.date ?? null };
  return latest.result === 'off'
    ? { kind: 'off', lastChecked: latest.date, checkId: latest.id, offByCents: latest.offByCents }
    : null;
}
