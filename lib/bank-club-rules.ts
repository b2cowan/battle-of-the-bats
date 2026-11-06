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

import { figureOfSaved, startBooks, type CheckFigure, type SavedCheck, type WaitingItem } from './bank-check';
import { directionOfEntry, entryIdOf, type ClubSavedCheck, type EntryRow, type OnItsWay } from './bank-club-map';
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
  bad_name: 400, bad_figures: 400, bad_kind: 400, bad_amount: 400, bad_date: 400, bad_item: 400, ends_in_future: 400,
  team_book: 409, name_taken: 409, changed: 409, start_exists: 409, start_after_checks: 409, no_start: 409,
  before_start: 409, start_has_checks: 409, not_counted_down: 409, not_counted_unlisted: 409,
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
 * amount, so it searches both; anything else is words in the description.
 */
export function pickerSearch(q: string):
  { kind: 'none' } | { kind: 'amount'; amount: number } | { kind: 'either'; amount: number; words: string } | { kind: 'words'; words: string } {
  const words = q.trim().slice(0, 80);
  if (!words) return { kind: 'none' };
  if (/^\d{1,9}$/.test(words)) return { kind: 'either', amount: Number(words), words };
  if (/^\$?\d{1,9}(\.\d{1,2})?$/.test(words)) return { kind: 'amount', amount: Number(words.replace('$', '')) };
  return { kind: 'words', words };
}

/** At most this many "Not in the bank yet" lines on one check. */
const MAX_WAITING = 200;

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
}

/**
 * Decide a save whose date rules have passed (`saveRefusal`). The waiting keys are looked up in `entries` (read by id on
 * the server): each must be a POSTED line of the account's books dated on or before the statement and not one counted in
 * Stripe's on its way (it is in the figure already; when Stripe didn't answer, nothing is, so any line may wait).
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
  const waiting = new Map<string, WaitingItem>();
  for (const k of keys) {
    const id = typeof k === 'string' ? entryIdOf(k) : null;
    const r = id ? byId.get(id) : undefined;
    if (!r || r.status !== 'posted' || !books.has(r.ledger_id) || r.entry_date > date || onItsWay.has(k as string)) return no('bad_item');
    const amountCents = toCents(r.amount);
    if (amountCents <= 0) return no('bad_item');
    const label = r.description ? cutText(r.description.trim(), 200) : undefined;
    waiting.set(k as string, { key: k as string, date: r.entry_date, direction: directionOfEntry(r), amountCents, ...(label ? { label } : {}) });
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
  checkedBy: string | null;
  checkedAt: string;
}

export function checkView(c: ClubSavedCheck & { booksNowSayCents: number | null }, nameOf: (id: string | null) => string | null): CheckView {
  return {
    id: c.id, kind: c.kind, date: c.date, bankCents: c.bankCents, booksCents: c.booksCents, onItsWayCents: c.onItsWayCents,
    cashCents: c.cashCents, waiting: [...c.waiting], figure: figureOfSaved(c), booksNowSayCents: c.booksNowSayCents,
    checkedBy: nameOf(c.createdBy), checkedAt: c.createdAt,
  };
}

/** Ask 4: the account's "checked through" — its latest check's date and result (Matches / Off by $X); null before one. */
export function checkedThrough(checks: readonly ClubSavedCheck[]): { date: string; result: 'matches' | 'off'; offByCents: number } | null {
  const last = checks.filter(c => c.kind === 'check').at(-1);
  if (!last) return null;
  const f = figureOfSaved(last);
  return { date: last.date, result: f.result, offByCents: f.offByCents };
}
