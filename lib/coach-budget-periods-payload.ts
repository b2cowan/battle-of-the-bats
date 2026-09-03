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
