/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE BANK CHECK — ONE ENGINE FOR BOTH PORTALS: A BALANCE, NOT A TICK-OFF (Bank balance check BC1; plan
 * docs/projects/active/BANK_RECONCILIATION_PLAN.md §4, owner rulings 1 and 3 + drawing asks 1–10 and Q1–Q3, 2026-11-05).
 *
 * A treasurer (club) or a coach with money write (team) types a bank statement's DATE and BALANCE. Every book line on or
 * before that date counts by itself; nobody ticks a line. The screen shows The bank says · Should be in the bank ·
 * Difference, and a check SAVES whether it matches or reads "Off by $X" (ruling 3: no $0.00 gate anywhere).
 *
 *   The bank says          = the typed statement balance on D
 *   Your books on D        = club: the start's books + the account's posted movement after the start through D
 *                            coach: the season opening + settled cash-moving rows dated ≤ D (`coachBooksOnDate`)
 *   On its way (club)      = online-payment book lines on or before D not paid out by D (NULL = not counted)
 *   Not in the bank yet    = this check's items: a money-OUT item ADDS its amount, a money-IN item SUBTRACTS it
 *   Cash not deposited yet = one optional typed figure (subtracts)
 *   Should be in the bank  = books − on its way + out items − in items − cash
 *   Difference             = bank − should be  →  0 "Matches", else "Off by $|d|" with the direction in words
 *
 * ⚖ THE DIFFERENCE IS NEVER STORED (BC1 build call 2026-11-05). A saved check keeps the bank, books, on-its-way and cash
 *   figures and its waiting items; this file figures the rest every read. "Matched when saved" = that figure is 0.
 * ⚖ SAVED FIGURES NEVER CHANGE (ask 6). "Books now say $X" compares a saved books figure with the books as they read now.
 * ⚖ NOTHING HERE WRITES MONEY (ask 1). Cash is a number on the check.
 * ⚖ NOTHING HERE IS KEYED TO A YEAR: no fiscal year, no season; dates are ISO days compared as strings.
 *
 * THE LINE KEY (a waiting item's `line_key`, mig 447): `entry:{accounting_entries.id}` (club); a settled coach register
 * row's own id (BC6). Pure and client-safe: integer cents, no IO, no Date.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

import { cashOnHandCents, type CashMovement } from './coach-register';
import { addCalendarDays } from './timezone';

export type BankDirection = 'in' | 'out';

/**
 * ⚖ THE CLUB'S START IS A STATEMENT'S OPENING BALANCE (owner 2026-11-08). The treasurer types the FIRST statement they
 * want to check: the day it starts and its opening balance, then checks that same statement. A start row still stores
 * the day whose END its balance stood at (every rule here: the books move strictly after it), so the card stores the day
 * before the one typed, and every screen that names the start shows the day checking starts. These two are the only
 * place that day moves; no stored row changes meaning, so starts saved before the ruling read correctly too.
 */
export const startDateFor = (firstDay: string): string => addCalendarDays(firstDay, -1);
export const checkingStartsOn = (startDate: string): string => addCalendarDays(startDate, 1);

/** A book line as its source reads it now (posted / settled only: a pending or void line never reaches the engine). */
export interface BankLine {
  key: string;
  /** YYYY-MM-DD */
  date: string;
  direction: BankDirection;
  /** > 0, integer cents. */
  amountCents: number;
  label?: string;
  /** Club transfer half: the OTHER half's key. Both halves in this account net to nothing (P5). */
  transferPairKey?: string | null;
}

/** A "Not in the bank yet" item: the line as it was when the check was saved (`bank_check_waiting`). */
export interface WaitingItem {
  key: string;
  date: string;
  direction: BankDirection;
  amountCents: number;
  label?: string;
  /** Q2: an item of the starting statement ("Waiting at the start"). */
  atStart?: boolean;
  /** Q2: attached to the start AFTER the start was saved — when (ISO timestamp), and by whom (mig 449). */
  addedAt?: string;
  addedBy?: string | null;
}

/** Money in is +, money out is −. */
export const signed = (direction: BankDirection, cents: number) => (direction === 'in' ? cents : -cents);

function assertCents(n: number, what: string): void {
  if (!Number.isInteger(n)) throw new Error(`bank-check: ${what} must be integer cents, got ${n}`);
}

/**
 * A typed dollar amount → integer cents, or null when it isn't one. Reads every form a treasurer types or copies from a
 * statement: "5402.10", "$5,402.10", "-12.40", "−12.40" (the typographic minus) and the bracket form the product itself
 * prints for an overdraft, "($50.00)" (BC1 review). `positive` demands more than zero (cash); a balance may be zero or
 * below. Lives with the engine so it is tested without a screen.
 * ⚖ THE COMMA (O4, BC3b): a comma before exactly two final digits is a DECIMAL comma ("12,50" = $12.50, as a French
 *   keyboard types it) — it can't be a thousands comma, which always has three digits after it. Every other comma must be
 *   a thousands comma in groups of three ("1,250", "$5,402.10"); anything else ("12,5", "1,2,3", "12,50.10") is not an
 *   amount, never a guess.
 */
export function typedCents(text: string, opts: { positive: boolean }): number | null {
  let t = text.replace(/[$\s]/g, '').replace(/^−/, '-');
  let negative = false;
  const bracket = /^\((.*)\)$/.exec(t);
  if (bracket) { t = bracket[1]; negative = true; }
  if (/^-?\d+,\d{2}$/.test(t)) t = t.replace(',', '.');
  else if (t.includes(',')) {
    if (!/^-?\d{1,3}(,\d{3})+(\.\d{0,2})?$/.test(t)) return null;
    t = t.replace(/,/g, '');
  }
  if (!/^-?\d+(\.\d{0,2})?$/.test(t)) return null;
  if (negative && t.startsWith('-')) return null;
  const c = Math.round(Number(t) * 100) * (negative ? -1 : 1);
  if (!Number.isSafeInteger(c) || Math.abs(c) > 99_999_999_999) return null;
  if (opts.positive && c <= 0) return null;
  return c === 0 ? 0 : c;
}

/** Newest first, then key (a stable order for every list the screen shows). */
export const newestFirst = (a: { date: string; key: string }, b: { date: string; key: string }) =>
  a.date > b.date ? -1 : a.date < b.date ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

/** Σ out-items and Σ in-items. */
function waitingSums(waiting: readonly WaitingItem[]): { outCents: number; inCents: number } {
  let outCents = 0, inCents = 0;
  for (const w of waiting) {
    assertCents(w.amountCents, `waiting item ${w.key}`);
    if (w.direction === 'out') outCents += w.amountCents; else inCents += w.amountCents;
  }
  return { outCents, inCents };
}

// ── the figure ───────────────────────────────────────────────────────────────────────────────

export interface CheckInputs {
  /** The bank says (signed: an overdrawn statement is negative). */
  bankCents: number;
  /** Your books on D. */
  booksCents: number;
  /** Online payments on their way; null = not counted (Stripe didn't answer, or a payout listed no lines). */
  onItsWayCents: number | null;
  waiting: readonly WaitingItem[];
  /** Cash not deposited yet; null or 0 = none. */
  cashCents: number | null;
}

export interface CheckFigure {
  bankCents: number;
  booksCents: number;
  onItsWayCents: number | null;
  waitingOutCents: number;
  waitingInCents: number;
  cashCents: number;
  shouldBeCents: number;
  /** bank − should be. */
  differenceCents: number;
  result: 'matches' | 'off';
  /** |difference|. */
  offByCents: number;
  /** "The bank shows $X more than your books." / "… less than …"; null when it matches. */
  direction: 'bank_more' | 'bank_less' | null;
}

/** The band of one check: Should be in the bank, the Difference, the result and its direction (plan §4). */
export function figureCheck(i: CheckInputs): CheckFigure {
  assertCents(i.bankCents, 'bank balance');
  assertCents(i.booksCents, 'books');
  if (i.onItsWayCents !== null) assertCents(i.onItsWayCents, 'on its way');
  const cashCents = i.cashCents ?? 0;
  assertCents(cashCents, 'cash');
  const { outCents, inCents } = waitingSums(i.waiting);
  const shouldBeCents = i.booksCents - (i.onItsWayCents ?? 0) + outCents - inCents - cashCents;
  const differenceCents = i.bankCents - shouldBeCents;
  return {
    bankCents: i.bankCents, booksCents: i.booksCents, onItsWayCents: i.onItsWayCents,
    waitingOutCents: outCents, waitingInCents: inCents, cashCents, shouldBeCents, differenceCents,
    result: differenceCents === 0 ? 'matches' : 'off',
    offByCents: Math.abs(differenceCents),
    direction: differenceCents > 0 ? 'bank_more' : differenceCents < 0 ? 'bank_less' : null,
  };
}

/**
 * The starting statement's books (ask 7): the §4 formula solved for the books with the difference at 0, whole —
 * bank − Σ out-items + Σ in-items + on its way at the start (BC1 build call: without Stripe on its way, a club taking card
 * payments would start with its in-transit money missing and every later check read "Off by" that amount for good).
 */
export function startBooks(i: { bankCents: number; onItsWayCents: number | null; waiting: readonly WaitingItem[] }): number {
  assertCents(i.bankCents, 'bank balance');
  for (const w of i.waiting) assertCents(w.amountCents, `waiting item ${w.key}`);
  // Each item moves the start its own line's way (`waitingOnStart`, the one home of that sign).
  return i.bankCents + i.waiting.reduce((t, w) => t + waitingOnStart(w), 0) + (i.onItsWayCents ?? 0);
}

// ── saved checks ─────────────────────────────────────────────────────────────────────────────

/** A saved check, as the engine reads it (the bank_checks row and its waiting items). */
export interface SavedCheck {
  id: string;
  kind: 'start' | 'check';
  date: string;
  bankCents: number;
  booksCents: number;
  onItsWayCents: number | null;
  cashCents: number | null;
  waiting: readonly WaitingItem[];
}

/** A saved check's figure, from its own saved figures (never re-read from the books). */
export const figureOfSaved = (c: SavedCheck): CheckFigure =>
  figureCheck({ bankCents: c.bankCents, booksCents: c.booksCents, onItsWayCents: c.onItsWayCents, waiting: c.waiting, cashCents: c.cashCents });

/** On a check, online payments on their way come OFF the books: they haven't reached the bank (the §4 formula's term). */
export const onItsWayOnCheck = (onItsWayCents: number): number => -onItsWayCents;

/** On a check, a Not-in-the-bank-yet item moves the total the other way from its line: a money-out line (a cheque not
 *  cashed) is still in the bank, so it ADDS back; a money-in line (a deposit not landed) comes off (the §4 formula's term). */
export const waitingOnCheck = (w: Pick<WaitingItem, 'direction' | 'amountCents'>): number => -signed(w.direction, w.amountCents);

/** On the START, a waiting item moves the books its own line's way (`startBooks` solved): a money-out line (a cheque the
 *  bank hadn't cashed yet) comes OFF the bank's balance, a money-in line goes on. The one home of that sign: "Waiting at
 *  the start" moves the start's books by exactly this (Q2; mig 449's `bank_start_waiting` re-checks it). */
export const waitingOnStart = (w: Pick<WaitingItem, 'direction' | 'amountCents'>): number => signed(w.direction, w.amountCents);

/** One line of a saved check's sums and the signed amount it moved the total by (`null`: on its way, not counted). */
export type SavedTerm =
  | { kind: 'base' | 'cash'; key: string; cents: number }
  | { kind: 'onItsWay'; key: string; cents: number | null }
  | { kind: 'waiting'; key: string; cents: number; item: WaitingItem };

/**
 * A saved check's sums, line by line, each signed the way it moved the total (BC2b, the opened check), so the screen only
 * formats. A check is `figureCheck` written out: books · on its way (−) · each waiting item (an out-item +, an in-item −) ·
 * cash (−) = Should have been in the bank. The start is `startBooks` written out: bank · on its way (+) · each waiting item
 * (out −, in +) = the books it starts from. A zero on-its-way and zero cash are left out; a not-counted one stays (the
 * screen says "not counted"). `totalCents` is the saved figure itself, never the terms re-added.
 */
export function savedTerms(c: SavedCheck): { terms: SavedTerm[]; totalCents: number } {
  const start = c.kind === 'start';
  const terms: SavedTerm[] = [{ kind: 'base', key: 'base', cents: start ? c.bankCents : c.booksCents }];
  if (c.onItsWayCents === null) terms.push({ kind: 'onItsWay', key: 'onItsWay', cents: null });
  else if (c.onItsWayCents !== 0) {
    terms.push({ kind: 'onItsWay', key: 'onItsWay', cents: start ? c.onItsWayCents : onItsWayOnCheck(c.onItsWayCents) });
  }
  for (const w of c.waiting) {
    // An out-item (a cheque not cashed yet) is still in the bank: added back on a check, taken off the bank at the start.
    terms.push({ kind: 'waiting', key: `w-${w.key}`, cents: start ? waitingOnStart(w) : waitingOnCheck(w), item: w });
  }
  if (!start && c.cashCents) terms.push({ kind: 'cash', key: 'cash', cents: -c.cashCents });
  return { terms, totalCents: start ? c.booksCents : figureOfSaved(c).shouldBeCents };
}

/**
 * THE PRINTED REPORT's sum (BC5b, owner "Report order"): the same saved check, written BANK FIRST as an association's
 * monthly form runs — the bank's balance · each Not-in-the-bank-yet item (a money-in line +, a cheque −) · online payments
 * on their way (+, or not counted) · cash (+) = what the books should say, beside the books themselves. It is `figureCheck`
 * solved the other way: books + difference (so the gap between this total and the books is the screen's own Off by). The
 * items move the bank their own line's way (`waitingOnStart`, the one home of that sign). A zero on-its-way and zero cash
 * are left out; a not-counted one stays. `totalCents` comes from the saved figure, never the terms re-added. A check only:
 * a starting statement has no result and no report.
 */
export function reportTerms(c: SavedCheck): { terms: SavedTerm[]; totalCents: number } {
  if (c.kind !== 'check') throw new Error('bank-check: a report is figured from a check, never the starting statement');
  const terms: SavedTerm[] = [{ kind: 'base', key: 'base', cents: c.bankCents }];
  for (const w of c.waiting) terms.push({ kind: 'waiting', key: `w-${w.key}`, cents: waitingOnStart(w), item: w });
  if (c.onItsWayCents === null) terms.push({ kind: 'onItsWay', key: 'onItsWay', cents: null });
  else if (c.onItsWayCents !== 0) terms.push({ kind: 'onItsWay', key: 'onItsWay', cents: c.onItsWayCents });
  if (c.cashCents) terms.push({ kind: 'cash', key: 'cash', cents: c.cashCents });
  const f = figureOfSaved(c);
  return { terms, totalCents: f.booksCents + f.differenceCents };
}

/**
 * The report's "Your books" line (BC5b, owner "Report extras"): the starting point and the book movement since, from the
 * SAVED figures — the start's books and this check's books. Null (the line is left off) when there is no start, the start
 * isn't before this check, or the start was corrected after this check was saved: its books are no longer the ones this
 * check was figured from, and the "Books now say" note explains that case.
 */
export function startingPoint(check: Pick<SavedCheck, 'kind' | 'date' | 'booksCents'>,
  start: Pick<SavedCheck, 'kind' | 'date' | 'booksCents'> | null, startCorrected: boolean): { date: string; cents: number; sinceCents: number } | null {
  if (check.kind !== 'check' || !start || start.kind !== 'start' || start.date >= check.date || startCorrected) return null;
  return { date: start.date, cents: start.booksCents, sinceCents: check.booksCents - start.booksCents };
}

/** Ask 3's "matched": matched WHEN SAVED. A later "Books now say" doesn't un-match it. A start is a starting point, not a
 *  match. */
export const matchedWhenSaved = (c: SavedCheck): boolean => c.kind === 'check' && figureOfSaved(c).differenceCents === 0;

/** Ask 6: "Books now say $X" — X when the books as they read now differ from the saved figure, else null. */
export const booksNowSay = (savedBooksCents: number, nowBooksCents: number): number | null =>
  nowBooksCents === savedBooksCents ? null : nowBooksCents;

/** The latest live check dated before D (ask 2: the next check asks "Still waiting?" from its items). */
export function latestBefore<T extends { date: string }>(checks: readonly T[], date: string): T | null {
  let last: T | null = null;
  for (const c of checks) if (c.date < date && (!last || c.date > last.date)) last = c;
  return last;
}

/**
 * Ask 2 + "Start item re-check" (owner 2026-11-06, BC4a): what a check dated D asks "Still waiting?" about.
 *   · the latest earlier check's own items (ask 2), less a line dated on or before the start that is no longer on the
 *     start's list (taken off: the save would refuse it, M3);
 *   · each of the start's Waiting-at-the-start lines, the start being the chain's FIRST LINK: asked unless the latest
 *     earlier check saved AFTER the line went on the start answered it without keeping it (No, or it matched without it).
 *     A check saved before then never saw the question and doesn't count. (A line saved with the start itself went on
 *     when the start was saved.)
 * Every line of the start's list comes back marked `atStart` (the screen may say so; the sentence stays the same). The
 * check on which a line is put on the start doesn't ask about it: the screen drops it there (it has just said it cleared).
 * Timestamps compare as the database writes them (one format), as `startCorrected` does.
 */
export function stillWaitingOn<C extends { kind: 'start' | 'check'; date: string; createdAt: string; waiting: readonly WaitingItem[] }>(
  checks: readonly C[], date: string): WaitingItem[] {
  const start = checks.find(c => c.kind === 'start') ?? null;
  const earlier = checks.filter(c => c.kind === 'check' && c.date < date);
  const onStart = new Map((start?.waiting ?? []).map(w => [w.key, w]));
  const asked = new Map<string, WaitingItem>();
  for (const w of latestBefore(earlier, date)?.waiting ?? []) {
    if (onStart.has(w.key)) asked.set(w.key, { ...w, atStart: true });
    else if (!start || w.date > start.date) asked.set(w.key, w);
  }
  for (const s of onStart.values()) {
    if (asked.has(s.key)) continue;
    const wentOn = s.addedAt ?? start!.createdAt;
    const answered = latestBefore(earlier.filter(c => c.createdAt > wentOn), date);
    if (!answered || answered.waiting.some(w => w.key === s.key)) {
      asked.set(s.key, { key: s.key, date: s.date, direction: s.direction, amountCents: s.amountCents,
        ...(s.label ? { label: s.label } : {}), atStart: true });
    }
  }
  return [...asked.values()];
}

// ── suspects (ask 3) ─────────────────────────────────────────────────────────────────────────

/**
 * Ask 3: the lines since the latest check that MATCHED when saved and dated before D — since the start (`startDate`: the
 * club's starting statement, the coach's season start) when none has. Dated after that day and on or before D, newest
 * first. A transfer between two books of this account nets to nothing, so both of its halves are left out.
 */
export function suspectsSince<L extends BankLine>(i: {
  lines: readonly L[]; checks: readonly SavedCheck[]; date: string; startDate: string;
}): { since: string; sinceMatch: boolean; lines: L[] } {
  const { since, sinceMatch } = suspectsStart(i.checks, i.date, i.startDate);
  const lines = withoutInnerTransfers(i.lines.filter(l => l.date > since && l.date <= i.date)).sort(newestFirst);
  return { since, sinceMatch, lines };
}

/** A transfer between two books of one account nets to nothing in it: both halves leave a list holding both (Find's
 *  suspects, the look-back before the start). */
export function withoutInnerTransfers<L extends Pick<BankLine, 'key' | 'transferPairKey'>>(lines: readonly L[]): L[] {
  const keys = new Set(lines.map(l => l.key));
  return lines.filter(l => !(l.transferPairKey && keys.has(l.transferPairKey)));
}

/** Ask 3's anchor alone: the day the suspects start after (the latest check before D that matched when saved, else the
 *  start), so a reader can bound its read of the lines before it has them. */
export function suspectsStart(checks: readonly SavedCheck[], date: string, startDate: string): { since: string; sinceMatch: boolean } {
  const matched = latestBefore(checks.filter(matchedWhenSaved), date);
  const sinceMatch = !!matched && matched.date > startDate;
  return { since: sinceMatch ? matched!.date : startDate, sinceMatch };
}

// ── the hints (drawing tab 3), bounded ───────────────────────────────────────────────────────

/** The most recent lines the hints look through (plan §4: O(n²) on 400 is ~160k steps, well under 50 ms). */
export const HINT_CAP = 400;
/** At most this many "These {2|3} add up to $X" combinations. */
export const MAX_COMBOS = 3;
/** A hard stop on the pair/triple walk (plan §4 budgets ~160k steps), so a list of identical amounts can't run away. */
const STEP_LIMIT = 200_000;

export interface Hints {
  /** |difference|; 0 = nothing to find. */
  targetCents: number;
  /** One line of exactly |difference|, either direction, nearest-dated first ("Exactly $X"). */
  exact: BankLine[];
  /** One line of |difference| ÷ 2 ("entered the wrong way round?"); empty unless the difference is an even number of cents. */
  half: BankLine[];
  /** Two or three lines in the same direction that add up to |difference|, nearest-dated first, at most `MAX_COMBOS`. */
  combos: BankLine[][];
  /** The candidates were more than `HINT_CAP`; only the most recent were looked through. */
  capped: boolean;
}

/** A combination, its lines newest first, with its place worked out once. */
interface Combo { lines: BankLine[]; newest: string; oldest: string }

const comboOf = (lines: BankLine[]): Combo => {
  const sorted = lines.sort(newestFirst);
  return { lines: sorted, newest: sorted[0].date, oldest: sorted[sorted.length - 1].date };
};

/** A combination's place: nearest-dated first means its newest line first, then its oldest, then its keys. */
function comboOrder(a: Combo, b: Combo): number {
  if (a.newest !== b.newest) return a.newest > b.newest ? -1 : 1;
  if (a.oldest !== b.oldest) return a.oldest > b.oldest ? -1 : 1;
  for (let i = 0; i < Math.min(a.lines.length, b.lines.length); i++) {
    if (a.lines[i].key !== b.lines[i].key) return a.lines[i].key < b.lines[i].key ? -1 : 1;
  }
  return a.lines.length - b.lines.length;
}

/**
 * "Find the $X" (plan §4, drawing tab 3): candidates are the suspects minus lines already Not in the bank yet (the caller
 * passes them). Exact → half (even cents only) → two or three lines adding up to it, same direction, by sort + two
 * pointers. Bounded: the most recent `HINT_CAP` candidates, at most `MAX_COMBOS` combinations kept.
 */
export function findHints(differenceCents: number, candidates: readonly BankLine[]): Hints {
  assertCents(differenceCents, 'difference');
  const targetCents = Math.abs(differenceCents);
  const sorted = [...candidates].sort(newestFirst);
  const capped = sorted.length > HINT_CAP;
  const pool = sorted.slice(0, HINT_CAP);
  for (const l of pool) assertCents(l.amountCents, `line ${l.key}`);
  if (targetCents === 0) return { targetCents, exact: [], half: [], combos: [], capped };

  const exact = pool.filter(l => l.amountCents === targetCents);
  const half = targetCents % 2 === 0 ? pool.filter(l => l.amountCents === targetCents / 2) : [];

  // Combinations: the best MAX_COMBOS seen so far, kept in order (a three-place insertion, never all of them).
  let steps = 0;
  const best: Combo[] = [];
  const offer = (lines: BankLine[]) => {
    const c = comboOf(lines);
    if (best.length === MAX_COMBOS && comboOrder(c, best[MAX_COMBOS - 1]) >= 0) return;
    let at = best.length;
    while (at > 0 && comboOrder(c, best[at - 1]) < 0) at--;
    best.splice(at, 0, c);
    if (best.length > MAX_COMBOS) best.pop();
  };
  for (const direction of ['out', 'in'] as const) {
    // Ascending by amount; a tie by newest first, so the walk meets nearer lines first.
    const xs = pool.filter(l => l.direction === direction && l.amountCents < targetCents)
      .sort((a, b) => a.amountCents - b.amountCents || newestFirst(a, b));
    // Every pair (i < j) with xs[i] + xs[j] = rest, by two pointers over xs[from..]. Runs of equal amounts give every pair.
    const pairs = (from: number, rest: number, emit: (a: BankLine, b: BankLine) => void) => {
      let lo = from, hi = xs.length - 1;
      while (lo < hi && steps < STEP_LIMIT) {
        steps++;
        const s = xs[lo].amountCents + xs[hi].amountCents;
        if (s < rest) lo++;
        else if (s > rest) hi--;
        else {
          // The run of equal amounts at each end (the same run when both ends hold the same amount).
          const a = xs[lo].amountCents, b = xs[hi].amountCents;
          let loEnd = lo; while (loEnd + 1 <= hi && xs[loEnd + 1].amountCents === a) loEnd++;
          let hiStart = hi; while (hiStart - 1 >= lo && xs[hiStart - 1].amountCents === b) hiStart--;
          if (a === b) {
            for (let p = lo; p <= hi && steps < STEP_LIMIT; p++) for (let q = p + 1; q <= hi && steps < STEP_LIMIT; q++) { steps++; emit(xs[p], xs[q]); }
            break;
          }
          for (let p = lo; p <= loEnd && steps < STEP_LIMIT; p++) for (let q = hiStart; q <= hi && steps < STEP_LIMIT; q++) { steps++; emit(xs[p], xs[q]); }
          lo = loEnd + 1; hi = hiStart - 1;
        }
      }
    };
    pairs(0, targetCents, (a, b) => offer([a, b]));
    for (let i = 0; i < xs.length - 2 && steps < STEP_LIMIT; i++) {
      const rest = targetCents - xs[i].amountCents;
      if (rest <= 0) break;
      pairs(i + 1, rest, (a, b) => offer([xs[i], a, b]));
    }
  }
  return { targetCents, exact, half, combos: best.map(c => c.lines), capped };
}

/**
 * The lines that can EXPLAIN a gap, by direction (BC3, said to the owner 2026-11-06): the bank showing MORE than the books
 * is a money-OUT line — a cheque not cashed yet (exact, or several adding up), or an expense entered as money in (half). The
 * bank showing LESS is a money-IN line, the same three ways round. A line the other way can only widen the gap if marked
 * (its Not-in-the-bank-yet term has the gap's own sign), so it is never a hint. Null at a difference of zero.
 */
export const closingDirection = (differenceCents: number): BankDirection | null =>
  differenceCents > 0 ? 'out' : differenceCents < 0 ? 'in' : null;

/** One hint the callout can name: the lines it points at, in the order the callout names them. `key` is stable.
 *  `atStart`: one line dated on or before the starting statement, of exactly the gap ("Waiting at the start", Q2). */
export interface Hint {
  key: string;
  kind: 'exact' | 'atStart' | 'half' | 'combo';
  lines: BankLine[];
}

/** The direction a line dated BEFORE the start must have to explain a gap (Q2): the other way from a check's own line. A
 *  cheque written before the start and cashed after it leaves the bank showing LESS than the books (the start's books held
 *  it as still in the bank), so it closes a gap of the bank showing less: `waitingOnStart` has the opposite sign to
 *  `waitingOnCheck`. */
export const closingDirectionAtStart = (differenceCents: number): BankDirection | null => {
  const d = closingDirection(differenceCents);
  return d === 'out' ? 'in' : d === 'in' ? 'out' : null;
};

/**
 * "Find the $X" for a check (drawing tab 3): `findHints` over the candidates whose direction can explain the difference
 * (`closingDirection`), as ONE list in the order the callout offers them — every exact line, then every line before the
 * start of exactly the gap (Q2, owner 2026-11-06: those are named only when exact), then every half, then the combinations
 * (nearest-dated first within each). The caller passes the suspects less the lines already marked Not in the bank yet and
 * less those counted on their way, and (`beforeStart`) the look-back's lines less those already waiting at the start.
 */
export function hintsFor(differenceCents: number, candidates: readonly BankLine[], beforeStart: readonly BankLine[] = []):
  { targetCents: number; hints: Hint[]; capped: boolean } {
  const direction = closingDirection(differenceCents);
  const h = findHints(differenceCents, direction ? candidates.filter(l => l.direction === direction) : []);
  const startDirection = closingDirectionAtStart(differenceCents);
  const atStart = h.targetCents === 0 ? [] : beforeStart
    .filter(l => l.direction === startDirection && l.amountCents === h.targetCents).sort(newestFirst);
  const hints: Hint[] = [
    ...h.exact.map(l => ({ key: `exact:${l.key}`, kind: 'exact' as const, lines: [l] })),
    ...atStart.map(l => ({ key: `atStart:${l.key}`, kind: 'atStart' as const, lines: [l] })),
    ...h.half.map(l => ({ key: `half:${l.key}`, kind: 'half' as const, lines: [l] })),
    ...h.combos.map(c => ({ key: `combo:${c.map(l => l.key).join('+')}`, kind: 'combo' as const, lines: c })),
  ];
  return { targetCents: h.targetCents, hints, capped: h.capped };
}

// ── the coach's books on a date (BC6 wires it) ───────────────────────────────────────────────

/**
 * P2': a coach's "Your books on D" is Cash on hand with a date cutoff — the season's opening balance plus every settled,
 * cash-moving register row dated on or before D (`cashOnHandCents`, the one arithmetic; a family-paid vendor row moves no
 * cash and a scheduled row is not cash yet). A dateless row is never "on or before" a date.
 */
export function coachBooksOnDate(rows: readonly (CashMovement & { date: string | null })[], openingCents: number, date: string): number {
  return cashOnHandCents(rows.filter(r => r.date !== null && r.date <= date), openingCents);
}
