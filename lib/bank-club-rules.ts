/**
 * THE CLUB'S BANK ROUTES, DECIDED (Bank reconciliation R2b; build prompt BANK_RECONCILIATION_R2_BUILD_PROMPT.md chunk
 * R2b). The pure half of every bank route: the client sends INTENT (tick this key, keep that one out, mark it checked);
 * the server has read the account (lib/bank-club-read.ts) and this file decides, with the engine (lib/bank-check.ts),
 * exactly which rows a step writes or refuses. No IO, so every rule is tested with fixtures
 * (tests/unit/bank-club-routes.test.ts). The database half is mig 439's functions.
 *
 * ⚖ RULE 3 (R1 review): a payout tick and its members' ticks are written and removed TOGETHER (`tickPlan`).
 * ⚖ RULE 4: Mark checked (again) REPLACES the statement's ticks with `snapshotForMarking(...).marks` (`markPlan`).
 * ⚖ RULE 6: nothing here takes a figure from the client except the statement's own figures and a typed fee/interest
 *   amount — the Difference is always recomputed here before anything is marked checked.
 * ⚖ NO YEAR (B3, B10): nothing here reads or names a fiscal year or a season.
 */

import {
  canMarkChecked, canMarkCheckedAgain, canUndo, evaluateCheck, orderedChecks, payoutTickMarks, snapshotForMarking,
  type BankAccountState, type BankDirection, type BankMark, type CheckEvaluation, type SavedLine, type TickRow,
} from './bank-check';
import { directionOfEntry, entryIdOf, nameGap, type EntryRow, type PayoutGapFacts } from './bank-club-map';
import { BANK_REFUSAL, type BankRefusalCode } from './bank-check-words';
import { toCents } from './coach-register';
import { isCalendarDate } from './timezone';

export type Decision<T> = ({ ok: true } & T) | { ok: false; status: number; code: BankRefusalCode };
/** A refusal decision: the code names it, and its status is the code's one status (`STATUS_OF`), never typed again. */
export const no = (code: BankRefusalCode): { ok: false; status: number; code: BankRefusalCode } =>
  ({ ok: false, status: STATUS_OF[code], code });

/** Every refusal's HTTP status, ONE per code (a new code without one is a type error; every refusal reads it here): not
 *  found 404, a bad request 400, the Difference 422, Stripe unreadable 503, everything else a conflict 409. */
export const STATUS_OF: Record<BankRefusalCode, number> = {
  account_not_found: 404, check_not_found: 404, book_not_found: 404, org_not_found: 404,
  bad_name: 400, bad_start: 400, bad_item: 400, bad_amount: 400, bad_date: 400, bad_kind: 400, bad_figures: 400,
  reason_required: 400, ends_in_future: 400, starts_in_future: 400, item_not_in_books: 400, not_a_line: 400,
  not_zero: 422, payouts_unavailable: 503,
  team_book: 409, book_not_in_account: 409, name_taken: 409, statements_exist: 409, not_set_up: 409, one_is_open: 409,
  ends_too_early: 409, ends_out_of_order: 409, checked_figures_fixed: 409, later_checked: 409, not_open: 409,
  not_outstanding: 409, earlier_open: 409, not_checked: 409, nothing_changed: 409, not_latest: 409, changed: 409,
  ticked_elsewhere: 409, no_processing_gap: 409, gap_not_a_fee: 409, payout_line_missing: 409, dispute_figure_differs: 409,
};
export const statusOfRefusal = (code: BankRefusalCode): number => STATUS_OF[code];

/** A mig 439 step's `{ ok: false, code }` → a known code (an unknown one reads as `changed`: read again). */
export const refusalOfStep = (code: string | undefined): BankRefusalCode =>
  (code && code in BANK_REFUSAL ? code : 'changed') as BankRefusalCode;

/** A database error → a refusal code, or null for a real failure: mig 436's guard trigger, mig 439's raised refusals, a
 *  race on a unique index. */
export function refusalOfDbError(e: { message?: string; code?: string; details?: string } | null): BankRefusalCode | null {
  const msg = `${e?.message ?? ''} ${e?.details ?? ''}`;
  const raised = /bank_step_refused:(\w+)/.exec(msg)?.[1];
  if (raised && raised in BANK_REFUSAL) return raised as BankRefusalCode;
  if (/bank_book_is_team_book/.test(msg)) return 'team_book';
  if (/bank_book_other_club/.test(msg)) return 'book_not_found';
  if (/bank_book_not_club_account/.test(msg)) return 'account_not_found';
  if (e?.code === '23505' && /bank_accounts_club_name/.test(msg)) return 'name_taken';
  if (e?.code === '23505' && /bank_checks_one_per_end_date/.test(msg)) return 'ends_too_early';
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

/** A real calendar day, YYYY-MM-DD. */
export const readDay = (v: unknown): string | null => (typeof v === 'string' && isCalendarDate(v) ? v : null);

export function readText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= max ? t : null;
}

const readDirection = (v: unknown): BankDirection | null => (v === 'in' || v === 'out' ? v : null);

/**
 * C1's picker search, by shape: `$12` or `12.50` is an amount only; all digits ("1234") is a cheque number as much as an
 * amount, so it searches both; anything else is words in the description. (R2b review: "1234" found no cheque.)
 */
export function pickerSearch(q: string):
  { kind: 'none' } | { kind: 'amount'; amount: number } | { kind: 'either'; amount: number; words: string } | { kind: 'words'; words: string } {
  const words = q.trim().slice(0, 80);
  if (!words) return { kind: 'none' };
  if (/^\d{1,9}$/.test(words)) return { kind: 'either', amount: Number(words), words };
  if (/^\$?\d{1,9}(\.\d{1,2})?$/.test(words)) return { kind: 'amount', amount: Number(words.replace('$', '')) };
  return { kind: 'words', words };
}

// ── the starting point (C1, Ask 3) ───────────────────────────────────────────────────────────

export interface OpeningPicked { key: string; date: string; direction: BankDirection; amountCents: number; description: string | null }
export interface OpeningTyped { date: string; direction: BankDirection; amountCents: number; description: string }

/**
 * The items still outstanding on the starting date. Picked items are named by key only; their figures come from the
 * book (rule 6) and each must be a POSTED line of one of the account's books dated on or before the starting date.
 * A typed item is a line the books don't have: the database mints its key (rule 5) — the client never sends one.
 */
export function openingPlan(input: {
  openingDate: string; pickedKeys: unknown; typed: unknown; rows: readonly EntryRow[]; books: ReadonlySet<string>;
}): Decision<{ picked: OpeningPicked[]; typed: OpeningTyped[] }> {
  const keys = input.pickedKeys ?? [];
  const typed = input.typed ?? [];
  if (!Array.isArray(keys) || !Array.isArray(typed) || keys.length + typed.length > 500) return no('bad_item');
  const byId = new Map(input.rows.map(r => [r.id, r]));
  const picked: OpeningPicked[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    const id = typeof k === 'string' ? entryIdOf(k) : null;
    const r = id ? byId.get(id) : undefined;
    if (!r || r.status !== 'posted' || !input.books.has(r.ledger_id) || r.entry_date > input.openingDate) {
      return no('item_not_in_books');
    }
    if (seen.has(k as string)) continue;
    seen.add(k as string);
    picked.push({
      key: k as string, date: r.entry_date, amountCents: toCents(r.amount),
      direction: directionOfEntry(r),
      description: r.description?.trim().slice(0, 200) || null,
    });
  }
  const out: OpeningTyped[] = [];
  for (const t of typed) {
    const o = (t ?? {}) as Record<string, unknown>;
    const date = readDay(o.date);
    const direction = readDirection(o.direction);
    const amountCents = readCents(o.amountCents, { positive: true });
    const description = readText(o.description, 200);
    if (!date || !direction || amountCents === null || !description || date > input.openingDate) return no('bad_item');
    out.push({ date, direction, amountCents, description });
  }
  return { ok: true, picked, typed: out };
}

// ── a statement ──────────────────────────────────────────────────────────────────────────────

/** The statement the request names, open (ticks, kept out and lines are only changed on an open statement). */
function openCheck(state: BankAccountState, checkId: string): Decision<object> {
  const c = state.checks.find(x => x.id === checkId);
  if (!c) return no('check_not_found');
  if (c.status !== 'open') return no('not_open');
  return { ok: true };
}

const marksOn = (state: BankAccountState, checkId: string) => state.marks.filter(m => m.checkId === checkId);

/**
 * Tick or untick one row of an open statement. Ticking needs the row to be outstanding on it now; a payout writes its
 * own tick and every member's (rule 3); a line keeps no payout link (a member ticked on its own while Stripe is down
 * stays its own tick when the payout comes back). Unticking a payout, or a member a payout tick stamped, removes the
 * payout's whole group. Ticking what is already ticked, or unticking what isn't, is a no-op (a double tap): both lists empty.
 */
export function tickPlan(state: BankAccountState, checkId: string, key: string, tick: boolean): Decision<{
  insert: BankMark[]; remove: string[];
}> {
  const open = openCheck(state, checkId);
  if (!open.ok) return open;
  const ev = evaluateCheck(state, checkId);
  const isTicked = ev.ticked.some(r => r.key === key);
  if (tick) {
    if (isTicked) return { ok: true, insert: [], remove: [] };
    const row = ev.outstanding.find(r => r.key === key);
    if (!row) return no('not_outstanding');
    if (row.kind === 'payout') {
      const marked = new Set(state.marks.map(m => m.key));
      return { ok: true, insert: payoutTickMarks(state, checkId, key).filter(m => !marked.has(m.key)), remove: [] };
    }
    return { ok: true, insert: [{ key, checkId, date: row.date, direction: row.direction, amountCents: row.amountCents }], remove: [] };
  }
  if (!isTicked) return { ok: true, insert: [], remove: [] };
  const mine = marksOn(state, checkId);
  const mark = mine.find(m => m.key === key);
  const group = key.startsWith('payout:') ? key : mark?.payoutKey ?? null;
  if (!group) return { ok: true, insert: [], remove: [key] };
  return { ok: true, insert: [], remove: mine.filter(m => m.key === group || m.payoutKey === group).map(m => m.key) };
}

/** "Didn't go through the bank" (B6) on a line outstanding on an open statement, and "Put it back". A payout never. */
export function keptOutPlan(state: BankAccountState, checkId: string, key: string, keptOut: boolean): Decision<{ noop: boolean }> {
  const open = openCheck(state, checkId);
  if (!open.ok) return open;
  if (key.startsWith('payout:')) return no('not_a_line');
  const ev = evaluateCheck(state, checkId);
  if (keptOut) {
    if (ev.keptOut.some(r => r.key === key)) return { ok: true, noop: true };
    // Only a line inside this statement's window can be kept out: the engine lists a kept-out line only there, so an older
    // outstanding one (a starting-point item, a back-dated line) would vanish from every list with nothing to put back.
    const row = ev.outstanding.find(r => r.key === key && r.kind === 'line');
    if (!row || row.date <= ev.startDate || row.date > ev.statementEndDate) return no('not_outstanding');
    return { ok: true, noop: false };
  }
  return { ok: true, noop: !(state.exclusions ?? []).includes(key) };
}

/**
 * Mark checked (B5) / Mark checked again (Ask 11): the engine says yes at $0.00 — recomputed HERE from the server's own
 * read, never the client's — and gives the complete set of ticks the statement keeps (rule 4) and its outstanding list
 * (B10). `seen` is what was ticked when this was decided: mig 439 refuses `changed` if a tick moved since.
 */
export function markPlan(state: BankAccountState, checkId: string, again: boolean): Decision<{
  seen: string[]; outstandingSnapshot: SavedLine[]; marks: BankMark[];
}> {
  const c = state.checks.find(x => x.id === checkId);
  if (!c) return no('check_not_found');
  const can = again ? canMarkCheckedAgain(state, checkId) : canMarkChecked(state, checkId);
  if (!can.ok) {
    const code = can.reason as BankRefusalCode;
    return no(code);
  }
  const { outstandingSnapshot, marks } = snapshotForMarking(state, checkId);
  return { ok: true, seen: marksOn(state, checkId).map(m => m.key), outstandingSnapshot, marks };
}

/** Undo (B4, Ask 9): the latest checked statement only; the reason is required. */
export function undoPlan(state: BankAccountState, checkId: string, reason: unknown): Decision<{ reason: string }> {
  const c = state.checks.find(x => x.id === checkId);
  if (!c) return no('check_not_found');
  if (!canUndo(state, checkId).ok) return no('not_latest');
  const r = readText(reason, 500);
  if (!r) return no('reason_required');
  return { ok: true, reason: r };
}

// ── a payout's gap (P4, Ask 7) ───────────────────────────────────────────────────────────────

export interface PayoutGapView {
  key: string;
  depositCents: number;
  bookCents: number;
  gapCents: number;
  /** Named by reason (never "payment processing" by default). */
  disputesHeld: PayoutGapFacts['disputesHeld'];
  disputeHeldCents: number;
  disputeReturnedCents: number;
  notOursCents: number;
  stripeFeeCents: number;
  otherCents: number;
  /** Book lines Stripe names in this payout that the book side here lacks (voided, or in another account's book). */
  missingMembers: number;
  /** `withheld === null`, spelled out for the screen. */
  offerPaymentProcessing: boolean;
  processingCents: number;
  /** Why "Add it as payment processing" is not offered (null when it is) — THE decision; the offer follows from it. The
   *  screen's explanation of a missing button and the add-line route's refusal read the same reason. */
  withheld: PayoutWithheld | null;
}

/** The four reasons the payment-processing offer is withheld (R2b review). */
export type PayoutWithheld = Extract<BankRefusalCode,
  'no_processing_gap' | 'gap_not_a_fee' | 'payout_line_missing' | 'dispute_figure_differs'>;

/** Offered (null) only when the gap is a fee Stripe kept (`nameGap`), every line Stripe names is in this payout's book
 *  side, and a held dispute's stored figure agrees with Stripe's net. Otherwise the reason, in the order a treasurer can
 *  act on it: a payout line not here (whatever the gap reads, that line is what's wrong); nothing to add; a fee that
 *  would be offered but for a dispute's figures disagreeing; else the gap isn't a fee. */
function withheldReason(v: { gapCents: number; feeOffered: boolean; missingMembers: number; heldAgrees: boolean }): PayoutWithheld | null {
  if (v.feeOffered && v.missingMembers === 0 && v.heldAgrees) return null;
  if (v.missingMembers > 0) return 'payout_line_missing';
  if (v.gapCents === 0) return 'no_processing_gap';
  if (v.feeOffered) return 'dispute_figure_differs';
  return 'gap_not_a_fee';
}

/**
 * The gap of each payout row (ticked or not) named by reason, and whether "Add it as payment processing" is offered.
 * Decided against the ENGINE's own book side (R2a left this for R2b): `nameGap` reads Stripe's lines, which count a lost
 * dispute as booked even when its book line was voided or sits in a moved book — so the offer stands only when every
 * member Stripe names is in this payout's book side, and a held dispute's stored figure agrees with Stripe's own net.
 */
export function payoutGapViews(ev: CheckEvaluation, facts: Record<string, PayoutGapFacts>,
  members: Record<string, string[]>): Record<string, PayoutGapView> {
  const out: Record<string, PayoutGapView> = {};
  for (const r of [...ev.ticked, ...ev.outstanding]) {
    if (r.kind !== 'payout') continue;
    const f = facts[r.key];
    const g = nameGap(r.gapCents, f);
    const posted = new Set(r.members.map(m => m.key));
    const missingMembers = (members[r.key] ?? []).filter(k => !posted.has(k)).length;
    const withheld = withheldReason({
      gapCents: r.gapCents, feeOffered: g.offerPaymentProcessing, missingMembers,
      heldAgrees: !f || f.disputeHeldCents === f.disputeNetCents,
    });
    out[r.key] = {
      key: r.key, depositCents: r.direction === 'in' ? r.amountCents : -r.amountCents, bookCents: r.bookCents,
      gapCents: r.gapCents, disputesHeld: f?.disputesHeld ?? [], disputeHeldCents: g.disputeHeldCents,
      disputeReturnedCents: g.disputeReturnedCents, notOursCents: g.notOursCents, stripeFeeCents: g.stripeFeeCents,
      otherCents: g.otherCents, missingMembers, withheld, offerPaymentProcessing: withheld === null,
      processingCents: withheld === null ? g.processingCents : 0,
    };
  }
  return out;
}

// ── what the screens read ────────────────────────────────────────────────────────────────────

export interface BankCheckEvent { checkId: string; kind: 'checked' | 'undone' | 'checked_again'; at: string; byName: string | null; reason: string | null }

export interface BankCheckSummary {
  id: string;
  statementEndDate: string;
  statementEndingBalanceCents: number;
  status: 'open' | 'checked';
  startDate: string;
  startingBalanceCents: number;
  tickedCount: number;
  outstandingCount: number;
  outstandingInCents: number;
  outstandingOutCents: number;
  changedSinceCount: number;
  differenceCents: number;
  /** The latest Mark checked / checked again, and the latest Undo (the list after an undo, C4). */
  checked: { at: string; byName: string | null } | null;
  undone: { at: string; byName: string | null; reason: string | null } | null;
  can: { markChecked: boolean; markCheckedAgain: boolean; undo: boolean; refigure: boolean };
}

/** Every statement of the account, newest first, with what each list row shows (C4, C5). */
export function checkSummaries(state: BankAccountState, events: readonly BankCheckEvent[]): BankCheckSummary[] {
  if (!state.setup) return [];
  const ordered = orderedChecks(state);
  const lastOf = (checkId: string, kinds: BankCheckEvent['kind'][]) => {
    let last: BankCheckEvent | null = null;
    for (const e of events) if (e.checkId === checkId && kinds.includes(e.kind) && (!last || e.at > last.at)) last = e;
    return last;
  };
  return ordered.map((c, i) => {
    const ev = evaluateCheck(state, c.id);
    const later = ordered.slice(i + 1);
    const checked = lastOf(c.id, ['checked', 'checked_again']);
    const undone = lastOf(c.id, ['undone']);
    return {
      id: c.id, statementEndDate: c.statementEndDate, statementEndingBalanceCents: c.statementEndingBalanceCents,
      status: c.status, startDate: ev.startDate, startingBalanceCents: ev.startingBalanceCents,
      tickedCount: ev.ticked.length, outstandingCount: ev.outstanding.length,
      outstandingInCents: ev.outstandingInCents, outstandingOutCents: ev.outstandingOutCents,
      changedSinceCount: ev.changedSince.length, differenceCents: ev.differenceCents,
      checked: checked ? { at: checked.at, byName: checked.byName } : null,
      // Shown only while it is what the statement is now (an undo the statement has since been re-checked after is history).
      undone: undone && c.status === 'open' && (!checked || undone.at > checked.at)
        ? { at: undone.at, byName: undone.byName, reason: undone.reason } : null,
      can: {
        markChecked: canMarkChecked(state, c.id).ok,
        markCheckedAgain: canMarkCheckedAgain(state, c.id).ok,
        undo: canUndo(state, c.id).ok,
        refigure: c.status === 'open' && later.every(l => l.status === 'open'),
      },
    };
  }).reverse();
}

/** The account's "checked through" (B9): the latest checked statement's end, and whether it changed since. */
export function checkedThrough(summaries: readonly BankCheckSummary[]): { date: string; changedSince: boolean } | null {
  const latest = summaries.find(s => s.status === 'checked');
  return latest ? { date: latest.statementEndDate, changedSince: latest.changedSinceCount > 0 } : null;
}

/** The statement the screen opens on: the one asked for, else the open one (oldest first), else the latest. */
export function checkToShow(state: BankAccountState, asked: string | null): string | null {
  if (asked && state.checks.some(c => c.id === asked)) return asked;
  const ordered = orderedChecks(state);
  return ordered.find(c => c.status === 'open')?.id ?? ordered.at(-1)?.id ?? null;
}

/** The key's book name, for the tick list's Book column (a typed or saved line has none). */
export function bookNames(rows: readonly TickRow[], lineBooks: Record<string, string>, names: ReadonlyMap<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (key: string) => { const b = lineBooks[key]; const n = b ? names.get(b) : undefined; if (n) out[key] = n; };
  for (const r of rows) {
    add(r.key);
    if (r.kind === 'payout') for (const m of r.members) add(m.key);
  }
  return out;
}
