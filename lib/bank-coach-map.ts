/**
 * THE COACH'S BANK CHECK, READ — the pure half (Bank balance check BC6a; plan docs/projects/active/BANK_RECONCILIATION_PLAN.md
 * §0 ask 7, Q1, O5, §1 P2', §4, §9 BC6). The server read (`lib/bank-coach-read.ts`) hands in the season's register rows and
 * the team account's saved checks; this turns them into the engine's inputs (lib/bank-check.ts). No IO, client-safe, so
 * every rule here is tested with fixtures (tests/unit/bank-coach.test.ts).
 *
 * A team has ONE bank account (B1, mig 447's `bank_accounts_one_per_team`) that outlives its seasons; a coach's books start
 * each season from its opening balance (ask 7: no starting statement, no start row). So every read is the WORKING season:
 *
 * ⚖ O5 (owner 2026-11-06, "Two cases"): the season starts —
 *     · the day it was rolled into, when Start next season handed it cash (its opening balance IS last season's cash on that
 *       day, so an earlier statement belongs to last season);
 *     · otherwise (a team's first season, or one opened without carrying cash) on the EARLIER of the day it was created and
 *       its first recorded money (a season set up mid-stream, or seeded, can hold money dated before its own row).
 *   A season row stores no start date (`rep_program_years`, verified 2026-11-06), so this is the one home of that day.
 * ⚖ B10 superseded / §9 BC6: saved checks and the mark read the working season only — a check dated before its start is
 *   another season's and is never shown (it stays in the table; nothing deletes it).
 * ⚖ Q1-A + owner 2026-11-06 ("Carried-from, else 60 days"): until the working season has a MATCHED check before D, Find also
 *   lists last season's lines after last season's last matched check (its final 60 days when it had none), under the
 *   screen's "From the {2025 Season}" (BC7). "Last season" is the season the opening cash was CARRIED FROM; no carry, no
 *   look-back (nothing crossed in the books).
 * ⚖ Owner 2026-11-06 ("Still waiting"): the working season's first check asks "Still waiting?" about what last season's
 *   final check left Not in the bank yet (ask 2's chain crosses the rollover; one check is read, never shown).
 * ⚖ THE SIGN ACROSS THE ROLLOVER is the check's own, never the club's start's. Last season's cheque not cashed at the
 *   rollover is already out of the opening balance (Cash on hand carried it out), while the bank still holds it: the bank
 *   shows MORE than the books, exactly as for a cheque of this season. So a look-back line is an ordinary candidate
 *   (`closingDirection`), never the club's "Waiting at the start" (`closingDirectionAtStart`, the opposite sign: the
 *   club's start books were solved FROM the bank).
 * ⚖ NO STRIPE, no on its way, no transfers between books: a team's book is one register (P4 is the club's).
 */

import {
  coachBooksOnDate, hintsFor, latestBefore, matchedWhenSaved, newestFirst, stillWaitingOn, type BankLine, type WaitingItem,
} from './bank-check';
import type { ClubSavedCheck } from './bank-club-map';
import { toCents, type CashMovement } from './coach-register';
import { addCalendarDays } from './timezone';

/** A saved check of a team account: the club's saved shape (its `book_ids` NULL → [], it is never corrected). */
export type TeamSavedCheck = ClubSavedCheck;

/** The fields of a register row (`lib/coach-register.ts` RegisterRow) the bank reads: its id is the line key (mig 447). */
export interface CoachRow extends CashMovement {
  id: string;
  /** YYYY-MM-DD, or null (an unpaid plain expense: never cash yet). */
  date: string | null;
  description: string;
}

/**
 * A register row as a bank line, or null when it can't be on a statement: a scheduled row (not cash yet), a payment a
 * family made straight to the vendor (`movesCash: false`: no team cash moved), an undated row, or one moving nothing. The
 * amount is the row's own cash movement (`cashOnHandCents`'s sign: money in − money out), so a line and the books can't
 * disagree about what a row moved.
 */
export function coachLineOf(r: CoachRow): BankLine | null {
  if (r.scheduled || !r.movesCash || !r.date) return null;
  const net = toCents(r.moneyIn) - toCents(r.moneyOut);
  if (net === 0) return null;
  return { key: r.id, date: r.date, direction: net > 0 ? 'in' : 'out', amountCents: Math.abs(net), label: r.description };
}

export const coachLinesOf = (rows: readonly CoachRow[]): BankLine[] =>
  rows.map(coachLineOf).filter((l): l is BankLine => l !== null);

// ── the season's window (O5) ─────────────────────────────────────────────────────────────────

export interface SeasonFacts {
  /** The day the season's row was created, in the club's day (`orgDayKey`): a rolled season's rollover day. */
  createdDay: string;
  /** Start next season handed it cash (`opening_balance_from_year_id` is set). */
  carried: boolean;
}

/** O5: the day the season starts (see the header). `lines` are the season's own bank lines (`coachLinesOf`). */
export function seasonStartOf(s: SeasonFacts, lines: readonly Pick<BankLine, 'date'>[]): string {
  if (s.carried) return s.createdDay;
  let first: string | null = null;
  for (const l of lines) if (first === null || l.date < first) first = l.date;
  return first !== null && first < s.createdDay ? first : s.createdDay;
}

/** The working season's checks: dated on or after its start (B10, §9 BC6). Oldest first, as read. */
export const checksInSeason = <C extends { date: string }>(checks: readonly C[], start: string): C[] =>
  checks.filter(c => c.date >= start);

/** Last season's checks: dated on or after ITS start and before the working season's. */
export const checksBetween = <C extends { date: string }>(checks: readonly C[], from: string, before: string): C[] =>
  checks.filter(c => c.date >= from && c.date < before);

/**
 * Ask 6 for a team: each working-season check's books as the working season's register reads NOW (`null` when they still
 * read the saved figure). Never re-figured over another season's register: a check is the working season's or not shown.
 */
export function coachChecksNow(checks: readonly TeamSavedCheck[], rows: readonly CoachRow[], openingCents: number):
  (TeamSavedCheck & { booksNowSayCents: number | null; startCorrected: false })[] {
  return checks.map(c => {
    // P2': "Your books on D" is `coachBooksOnDate`, Cash on hand's one arithmetic with a cutoff.
    const now = coachBooksOnDate(rows, openingCents, c.date);
    return { ...c, booksNowSayCents: now === c.booksCents ? null : now, startCorrected: false as const };
  });
}

// ── Find (ask 3, Q1) and Still waiting? (ask 2) ──────────────────────────────────────────────

/** With no matched check last season, Q1's look-back reads its final this-many days (the club's Q2 length). */
export const LOOK_BACK_DAYS = 60;

/** Last season as the working season's Find reads it: its name (the divider's), its start, its lines, its checks. */
export interface LastSeason {
  name: string;
  start: string;
  lines: readonly BankLine[];
  /** Its checks: dated in [its start, the working season's start). */
  checks: readonly TeamSavedCheck[];
}

/**
 * Does a check on D need last season's register? The reader asks before it reads it. Yes while no working check before D
 * matched (Q1's look-back, and the crossing Still waiting?), AND while Still waiting? asks about a line that isn't one of
 * this season's (BC6a /review: last season's cheque marked on a MATCHED working check is asked again on the next check, and
 * a "yes" must still find its line — otherwise the save refuses it and the check can only save off).
 */
export function needsLastSeason(working: readonly TeamSavedCheck[], date: string, lines: readonly Pick<BankLine, 'key'>[]): boolean {
  if (!working.some(c => c.date < date && matchedWhenSaved(c))) return true;
  const ours = new Set(lines.map(l => l.key));
  return stillWaitingOn(working, date).some(w => !ours.has(w.key));
}

export interface CoachFind {
  /** The day the suspects start after: the latest matched working check before D, else the season's start. */
  since: string;
  /** `since` is a matched check (else the season's start: every line of the season counts). */
  sinceMatch: boolean;
  /** Ask 3: this season's lines since the last match — every line of the season, on or before D, when none. Newest first. */
  lines: BankLine[];
  /** Q1: last season's lines after its last matched check (its final 60 days when none), while this season has no match. */
  lastSeason: { name: string; after: string; sinceMatch: boolean; lines: BankLine[] } | null;
}

/**
 * Find on a check dated D (ask 3 + Q1). A first check's suspects are EVERY line of the season through D — dated on the
 * start or before it too (a first season's start IS its first line's day, and a rolled season can hold a row dated before
 * the rollover; `suspectsSince`'s strictly-after-the-start would drop both).
 */
export function coachFind(i: { date: string; start: string; lines: readonly BankLine[]; checks: readonly TeamSavedCheck[];
  last: LastSeason | null }): CoachFind {
  const matched = latestBefore(i.checks.filter(c => c.date >= i.start && matchedWhenSaved(c)), i.date);
  const lines = i.lines.filter(l => l.date <= i.date && (!matched || l.date > matched.date)).sort(newestFirst);
  let lastSeason: CoachFind['lastSeason'] = null;
  if (!matched && i.last) {
    const lastMatch = latestBefore(i.last.checks.filter(matchedWhenSaved), i.start);
    const after = lastMatch ? lastMatch.date : addCalendarDays(i.start, -LOOK_BACK_DAYS);
    lastSeason = {
      name: i.last.name, after, sinceMatch: !!lastMatch,
      lines: i.last.lines.filter(l => l.date > after && l.date <= i.date).sort(newestFirst),
    };
  }
  return { since: matched ? matched.date : i.start, sinceMatch: !!matched, lines, lastSeason };
}

/**
 * Ask 2 across the rollover: a check on D asks "Still waiting?" about the latest earlier check's Not-in-the-bank-yet items
 * — the working season's, or, before its first, last season's FINAL check (owner 2026-11-06). A team has no start, so
 * every item of that check is asked (`stillWaitingOn` with no start row).
 */
export function coachStillWaiting(i: { date: string; checks: readonly TeamSavedCheck[]; last: LastSeason | null }): WaitingItem[] {
  const lastFinal = i.last ? latestBefore(i.last.checks.filter(c => c.kind === 'check'), '9999-12-31') : null;
  return stillWaitingOn(lastFinal ? [lastFinal, ...i.checks] : i.checks, i.date);
}

/**
 * The lines a check on D may mark Not in the bank yet, by key, each with the figures the server read (rule 6): this
 * season's lines on or before D, last season's look-back lines, and any of last season's lines Still waiting? asks about
 * (a cheque marked on last season's final MATCHED check sits before the look-back). Never a line of another team: the keys
 * come from this team's own register.
 */
export function coachMarkable(i: { date: string; lines: readonly BankLine[]; find: CoachFind; stillWaiting: readonly WaitingItem[];
  last: LastSeason | null }): Map<string, BankLine> {
  const out = new Map<string, BankLine>();
  for (const l of i.lines) if (l.date <= i.date) out.set(l.key, l);
  for (const l of i.find.lastSeason?.lines ?? []) out.set(l.key, l);
  const asked = new Set(i.stillWaiting.map(w => w.key));
  for (const l of i.last?.lines ?? []) if (asked.has(l.key) && l.date <= i.date) out.set(l.key, l);
  return out;
}

/**
 * "Find the $X" for a team (drawing tab 3): `hintsFor` over this season's suspects AND last season's look-back lines as
 * ONE list of ordinary candidates (the sign across the rollover is the check's own: see the header), less the lines
 * already marked Not in the bank yet. Never `beforeStart` (a team has no start). The screen tells a look-back line by its
 * key (BC7 draws the divider).
 */
export function coachHints(differenceCents: number, find: CoachFind, markedKeys: ReadonlySet<string>) {
  const candidates = [...find.lines, ...(find.lastSeason?.lines ?? [])].filter(l => !markedKeys.has(l.key));
  return hintsFor(differenceCents, candidates);
}
