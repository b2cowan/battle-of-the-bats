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

export type BankDirection = 'in' | 'out';

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
}

/** Money in is +, money out is −. */
export const signed = (direction: BankDirection, cents: number) => (direction === 'in' ? cents : -cents);

function assertCents(n: number, what: string): void {
  if (!Number.isInteger(n)) throw new Error(`bank-check: ${what} must be integer cents, got ${n}`);
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
  const { outCents, inCents } = waitingSums(i.waiting);
  return i.bankCents - outCents + inCents + (i.onItsWayCents ?? 0);
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
  const inWindow = i.lines.filter(l => l.date > since && l.date <= i.date);
  const keys = new Set(inWindow.map(l => l.key));
  const lines = inWindow.filter(l => !(l.transferPairKey && keys.has(l.transferPairKey))).sort(newestFirst);
  return { since, sinceMatch, lines };
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

// ── the coach's books on a date (BC6 wires it) ───────────────────────────────────────────────

/**
 * P2': a coach's "Your books on D" is Cash on hand with a date cutoff — the season's opening balance plus every settled,
 * cash-moving register row dated on or before D (`cashOnHandCents`, the one arithmetic; a family-paid vendor row moves no
 * cash and a scheduled row is not cash yet). A dateless row is never "on or before" a date.
 */
export function coachBooksOnDate(rows: readonly (CashMovement & { date: string | null })[], openingCents: number, date: string): number {
  return cashOnHandCents(rows.filter(r => r.date !== null && r.date <= date), openingCents);
}
