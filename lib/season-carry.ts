/**
 * What a new season opens with when a coach rolls the year forward — the whole carry decision, as
 * two pure functions.
 *
 * ⚠⚠ THIS MODULE EXISTS SO THE DECISION CAN BE TESTED (2026-08-25, `/review` during money
 * centralization P3; write-up in Owner QA §104). It lived inline in `lib/rep-season-rollover.ts`,
 * which imports `server-only` and does database work — so nothing could import it, nothing could
 * test it, and the failure path shipped wrong. **A local helper is an untestable one**; that is the
 * same lesson `app/api/.../budget-vs-actual/route.ts` records about its own expense-movement maths.
 *
 * The bug it fixed: reading the closing season's cash could throw, the `catch` only logged, and the
 * figure stayed at its initialiser `0`. Zero then satisfied the `!== null` test that stamps
 * provenance — so a transient database error was recorded as *"carried from the 2025 Season:
 * $0.00"*, confidently and permanently, for a team that may have closed holding thousands. The
 * modal's warning is shown once and lost; the false record reads back on the register's first line,
 * on Budget vs. Actual and in Team settings until someone retypes the figure by hand.
 *
 * ⚠⚠ THE RULE, IN ONE LINE: **a failure is not a measurement.** `null` means *we do not know*; `0`
 * means *we know, and it was nothing*. Same number, different facts — and this is the only place
 * the difference is decided. Initialise money variables to the value that means "we do not know",
 * so a `catch` that forgets to assign cannot promote a failure into a figure.
 *
 * Pinned by `tests/unit/season-carry-forward.test.ts`.
 */

import { toCents } from './coach-register';

/**
 * What a coach chose to do with the money the closing season is holding.
 *
 * ⚠⚠ `all` DOES NOT CARRY A NUMBER FROM THE BROWSER. It carries the INTENT, and the server works
 * out the figure from the register's own walk at the moment the season is created — a stale tab, a
 * payment recorded in another window, or a hand-edited request would otherwise open the new season
 * on a balance the team never had, permanently, with nothing downstream able to tell.
 */
export type SeasonCarryChoice =
  | { mode: 'all' }
  | { mode: 'amount'; amount: number }
  | { mode: 'none' };

/**
 * Dollars the new season opens with, or `null` for **nothing was carried**.
 *
 * ⚠ `closingCents === null` means we do not know what the old season closed at — the read failed,
 * or it was never attempted. It NEVER means "it closed at zero": a season that genuinely closed
 * empty reads `0`, and that is a carried figure with an opening line of its own.
 */
export function openingBalanceFor(choice: SeasonCarryChoice, closingCents: number | null): number | null {
  if (choice.mode === 'none') return null;
  if (choice.mode === 'amount') return toCents(choice.amount) / 100;
  return closingCents === null ? null : closingCents / 100;
}

/**
 * May the new season name where its opening figure came from?
 *
 * ⚠ Only when the product WORKED IT OUT from the closing season's own walk. A hand-typed amount
 * gets no provenance — "carried from the 2026 Season" would be vouching for a figure the coach
 * chose. Neither does a failed read, and that clause is the one that was broken: this is what turns
 * a wrong figure into a wrong CLAIM, so it moves with `openingBalanceFor` or not at all.
 */
export function carriesProvenance(choice: SeasonCarryChoice, openingBalance: number | null): boolean {
  return choice.mode === 'all' && openingBalance !== null;
}
