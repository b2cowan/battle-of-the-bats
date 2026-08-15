/**
 * Budget vs. Actual — spending, placed against a budget LINE's payment periods.
 *
 * ⚠ THE HONEST ANSWER IS USUALLY "WE DON'T KNOW", AND THAT IS THE POINT OF THIS MODULE.
 *
 * An expense carries a free-text `category`. It does not say which budget LINE it pays for — the
 * link that would say so is the subject of COACH_BUDGET_LINE_ALIGNMENT_PLAN.md and does not exist
 * yet. So spending can be attributed to a category, and no further.
 *
 * Budget vs. Actual used to hand every line in a category that whole category's spending, mapped
 * onto the line's own periods. The line ROW was honest (it prints "—"), but expanding it showed
 * money, in green, with a variance — and a Facilities category holding three lines reported the
 * same $340 dome invoice three times, twice against lines with no spending at all.
 *
 * The rule this module encodes:
 *
 *  • **One line in the category** → the category's spending IS that line's spending. There is
 *    nothing else it could belong to, so the figure is correct and useful, and is kept.
 *  • **Two or more** → nothing per-line is knowable. The periods report NOTHING rather than
 *    something plausible, which is what the screen already does one row up.
 *
 * Pure: no IO, no React, no Date. Dates are `YYYY-MM-DD` strings compared as strings, so a coach
 * in Toronto and a server in UTC place an expense in the same period.
 */

/** One of a line's payment periods, in the line's own display order. */
export interface PeriodSlot {
  /** `YYYY-MM-DD`, or null for a period entered in "just names" mode. */
  periodDate: string | null;
  /** Tie-breaker between two UNDATED periods, which have no other order. */
  sortOrder: number;
}

/** A paid amount and the day it was paid. A payable's deposit and balance are two of these. */
export interface PaidEvent {
  /** `YYYY-MM-DD`, or null when nothing recorded a date. */
  date: string | null;
  amount: number;
}

/**
 * Can a line's own spending be known at all?
 *
 * The whole rule, in one place, so the route and the screen can never disagree about when a
 * figure exists. When the expense↔line link lands (that plan's §6.3) this predicate is what
 * changes — not the arithmetic below it.
 */
export function lineActualsKnowable(lineCount: number): boolean {
  return lineCount === 1;
}

/**
 * Place a category's paid spending onto ONE line's periods.
 *
 * Each expense lands in the first period falling on or after the day it was paid; anything paid
 * after the last dated period, and anything with no paid date at all, lands in the final period.
 * The result is index-aligned with `periods` as given.
 */
function placeInPeriods(periods: PeriodSlot[], events: PaidEvent[]): number[] {
  if (periods.length === 0) return [];
  const out = new Array<number>(periods.length).fill(0);
  if (events.length === 0) return out;

  // Chronological order, undated last — carried as INDICES so the answer can be scattered back
  // without matching periods to each other. (It used to be mapped back by label+date, which two
  // identically-named periods on one line would collapse onto a single slot.)
  const order = periods.map((_, i) => i).sort((a, b) => {
    const A = periods[a], B = periods[b];
    if (!A.periodDate && !B.periodDate) return A.sortOrder - B.sortOrder;
    if (!A.periodDate) return 1;
    if (!B.periodDate) return -1;
    return A.periodDate.localeCompare(B.periodDate);
  });

  const last = order.length - 1;
  for (const e of events) {
    if (!e.amount) continue;
    if (!e.date) { out[order[last]] += e.amount; continue; }
    let placed = false;
    for (let i = 0; i < order.length; i++) {
      const p = periods[order[i]];
      if (!p.periodDate || p.periodDate >= e.date) {
        out[order[i]] += e.amount;
        placed = true;
        break;
      }
    }
    if (!placed) out[order[last]] += e.amount;
  }
  return out;
}

/**
 * Per-line period actuals for every line in ONE category.
 *
 * @param periodsByLine each line's periods, in that line's display order.
 * @param categoryEvents everything paid against the CATEGORY — the only granularity that exists.
 * @returns index-aligned with `periodsByLine`. `null` for a line whose actuals are not knowable
 *          (see `lineActualsKnowable`) — deliberately not an array of zeros, because "nobody can
 *          say" and "nothing was spent" are different facts and the screen prints them the same
 *          only by coincidence.
 */
export function buildLinePeriodActuals(
  periodsByLine: PeriodSlot[][],
  categoryEvents: PaidEvent[],
): Array<number[] | null> {
  if (!lineActualsKnowable(periodsByLine.length)) return periodsByLine.map(() => null);
  return periodsByLine.map(periods => placeInPeriods(periods, categoryEvents));
}
