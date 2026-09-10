/**
 * One spelling of "a valid period split" for the budget-line WRITE routes.
 *
 * A split now rides the SAME request as its line (P2, 2026-09-02). It used to be a second POST
 * the panel fired after the line saved — and never checked: a line PATCHed to a new total whose
 * follow-up periods write 400ed kept its old split silently, which is exactly the desync the
 * total-change guard exists to stop. Create and edit both validate here, so the two routes
 * cannot drift on the ±$0.02 rule the periods table has always enforced.
 *
 * Pure: no IO, no Supabase — the routes do the writing.
 */

// Relative, with the extension, so `node --test` can load this module directly — the unit suite's
// resolver handles these but not the bundler's `@/` alias (the same note its sibling view carries).
import { NO_DATE_LABEL } from './coach-budget-periods-view.ts';

export interface PeriodPayloadRow {
  period_label: string;
  period_date: string | null;
  amount: number;
  sort_order: number;
}

export type PeriodsPayloadResult =
  | { ok: true; rows: PeriodPayloadRow[] }
  | { ok: false; error: string };

/**
 * Read `body.periods` into insertable rows, validated against the total the line is ABOUT to
 * store. An empty array is a valid answer (clear the split); a non-array is the caller saying
 * "don't touch the periods" and never reaches here.
 */
export function readPeriodsPayload(raw: unknown[], lineTotal: number): PeriodsPayloadResult {
  const rows: PeriodPayloadRow[] = [];
  for (const [i, entry] of raw.entries()) {
    const p = entry as { periodLabel?: unknown; periodDate?: unknown; amount?: unknown };
    const label = typeof p.periodLabel === 'string' ? p.periodLabel.trim() : '';
    if (!label) return { ok: false, error: 'Each period must have a periodLabel' };
    const amount = Number(p.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Each period amount must be a positive number' };
    }
    const date = typeof p.periodDate === 'string' && p.periodDate ? p.periodDate : null;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { ok: false, error: 'Each period date must be YYYY-MM-DD, or omitted' };
    }
    rows.push({ period_label: label, period_date: date, amount, sort_order: i });
  }

  if (rows.length > 0) {
    const sum = rows.reduce((s, r) => s + r.amount, 0);
    // ±$0.02 — the tolerance the periods table has always enforced (rounding tails on an even
    // split), stated in the same words the old endpoint used.
    if (Math.abs(sum - lineTotal) > 0.02) {
      return {
        ok: false,
        error: `Period amounts (${sum.toFixed(2)}) must sum to the line total (${lineTotal.toFixed(2)})`,
      };
    }
  }
  return { ok: true, rows };
}

/**
 * JOINING TWO SPLITS — what happens when money is added to a word already on the plan.
 *
 * One word carries one line (owner ruling 2026-09-09, migration 286), so "add $900 to Entry Fee"
 * is an edit of that line: the totals add, and the two schedules become one.
 *
 * ⚠⚠ THE HALF THAT IS NOT OBVIOUS — A SIDE WITH NO SCHEDULE BECOMES A REAL UNDATED PERIOD. Add
 * dated money to an undated line and the result is legitimately part-scheduled; but
 * `readPeriodsPayload` above enforces "the split sums to the total" on every write door, so leaving
 * that gap implicit would make the coach's very NEXT edit of that line impossible to save — a
 * 409 telling them their split adds to $900 when the line says $1,500, about money they never
 * mis-entered. An undated period is a shape the product already has: it is what the by-period
 * grid's "No date yet" column is built from, and it is the honest answer rather than a date nobody
 * chose.
 *
 * ⚠ BOTH SIDES BARE = NO SPLIT AT ALL. A line with no periods is already read as wholly undated
 * everywhere; inventing a single period covering the whole total would be noise, and it would turn
 * a lump-sum line into a "split" the editor then offers to rescale.
 *
 * ⚠⚠ AND THE JOINED SPLIT IS RECONCILED TO THE JOINED TOTAL, IN BOTH DIRECTIONS — the half a plain
 * concatenation gets wrong. Each side is only required to sum to ITS OWN total within ±$0.02 (the
 * rounding tail an even split leaves), so two sides that were each accepted can land up to $0.04
 * from the joined total — **past the tolerance every write door then enforces.** A coach who did
 * nothing wrong would meet "Period amounts must sum to the line total" on a save the product built
 * for them. The last period absorbs the difference, which is exactly what that tolerance exists to
 * hold; the undated filler above handles the case where a whole SIDE has no schedule, and this
 * handles the cents.
 *
 * ⚠ THE LABEL IS IMPORTED, NOT PASSED IN. It was a parameter for one afternoon, on the reasoning that
 * this module should import nothing so `node --test` can load it alone — and its own sibling
 * `coach-budget-periods-view.ts` disproves that: it imports two lib modules by relative path with the
 * extension for exactly that reason. **Passing a label across a module boundary is the shape that lets
 * a second spelling in**, which is the one thing this repo's one-spelling rule exists to stop, so the
 * constant travels rather than the string.
 *
 * Pure: no IO, no React, no Date.
 */
export interface JoinablePeriod {
  periodLabel: string;
  periodDate: string | null;
  amount: number;
}

export function joinPeriodSplits(
  existing: { total: number; periods: readonly JoinablePeriod[] },
  added: { total: number; periods: readonly JoinablePeriod[] },
): Array<JoinablePeriod & { sortOrder: number }> {
  if (existing.periods.length === 0 && added.periods.length === 0) return [];
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sideOf = (side: { total: number; periods: readonly JoinablePeriod[] }): JoinablePeriod[] => (
    side.periods.length > 0
      ? side.periods.map(p => ({ periodLabel: p.periodLabel, periodDate: p.periodDate, amount: Number(p.amount) }))
      : [{ periodLabel: NO_DATE_LABEL, periodDate: null, amount: r2(Number(side.total)) }]
  );
  const joined = [...sideOf(existing), ...sideOf(added)].map((p, i) => ({ ...p, sortOrder: i }));

  /* Reconcile the tail. `drift` is at most the two sides' rounding slack; anything larger cannot
     arise from valid input, so this stays a correction rather than a rescale. */
  const total = r2(Number(existing.total) + Number(added.total));
  const summed = r2(joined.reduce((acc, p) => acc + p.amount, 0));
  const drift = r2(total - summed);
  if (drift !== 0) {
    const last = joined[joined.length - 1];
    last.amount = r2(last.amount + drift);
  }
  return joined;
}
