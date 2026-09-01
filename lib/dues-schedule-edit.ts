/**
 * The one-family schedule editor's arithmetic — PURE (owner direction 2026-09-01, "installments
 * only", ruled on the `Installments Only` mockup: Q1 A · Q2 A · Q3 A).
 *
 * The typed total is gone: a family's schedule IS its installments, and the total is what they
 * add up to. What the form then has to SAY comes from three facts the dues screen already holds —
 * the rest of the roster's totals, this family's payments, and what has been handed back — and
 * every sentence is derived here so the screen never does its own sums (the rule every money
 * sentence in this hub follows).
 */

const toC = (n: number | string) => {
  const v = typeof n === 'number' ? n : parseFloat(n);
  return Number.isFinite(v) ? Math.round(v * 100) : 0;
};
const toDollars = (c: number) => c / 100;

/** Cents sum of the rows as typed — rows without a parseable amount count as zero (they are
 *  refused separately before any sum matters). */
export function installmentSumC(rows: readonly { amount: string | number }[]): number {
  return rows.reduce((s, r) => s + toC(r.amount), 0);
}

/**
 * "The team's" figure: the total the MOST players on the roster share (Q2 A) — the same yardstick
 * the roster-wide door uses to spot hand-set schedules, so the two screens never disagree about
 * who differs. Ties break on the LOWER total, deterministically. Null when nobody has a schedule.
 * Pass the OTHER players' totals — the family being edited is not its own team.
 */
export function commonScheduleTotal(otherTotals: readonly number[]): number | null {
  const counts = new Map<number, number>();
  for (const t of otherTotals) {
    const c = toC(t);
    if (c <= 0) continue;
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [c, n] of counts) {
    if (n > bestCount || (n === bestCount && best !== null && c < best)) { best = c; bestCount = n; }
  }
  return best === null ? null : toDollars(best);
}

export type TeamComparison =
  | { state: 'none'; sum: number }
  | { state: 'match'; sum: number; team: number }
  | { state: 'differs'; sum: number; team: number; diff: number };

/** The line under the rows (Q3 A): matches / differs by $X / nobody else has dues yet. */
export function teamComparison(rows: readonly { amount: string | number }[], teamTotal: number | null): TeamComparison {
  const sumC = installmentSumC(rows);
  if (teamTotal === null) return { state: 'none', sum: toDollars(sumC) };
  const teamC = toC(teamTotal);
  if (sumC === teamC) return { state: 'match', sum: toDollars(sumC), team: teamTotal };
  return { state: 'differs', sum: toDollars(sumC), team: teamTotal, diff: toDollars(sumC - teamC) };
}

export type ScheduleEditConsequence =
  /** The new total is below what the family has paid — the difference is their overpayment
   *  credit (Phase A engine); `handedBack` is how much of it has already gone out in cash. */
  | { kind: 'credit'; paid: number; total: number; credit: number; handedBack: number }
  /** Money already on an installment that was lowered or removed re-applies to the remaining
   *  rows — nothing is refunded. */
  | { kind: 'slides'; amount: number }
  | null;

/**
 * What saving does to money already paid (Q1 A — paid installments stay editable and removable,
 * with the consequence said BEFORE Save). `rows[].paid` is each surviving installment's cash
 * coverage as the drawer projects it; `removedPaid` is the coverage of rows the coach removed.
 */
export function scheduleEditConsequence(args: {
  rows: readonly { amount: string | number; paid?: number }[];
  removedPaid: number;
  paymentsTotal: number;
  paidOut: number;
}): ScheduleEditConsequence {
  const totalC = installmentSumC(args.rows);
  const paidC = toC(args.paymentsTotal);
  if (paidC <= 0 || totalC <= 0) return null;
  if (totalC < paidC) {
    const creditC = paidC - totalC;
    return {
      kind: 'credit',
      paid: toDollars(paidC),
      total: toDollars(totalC),
      credit: toDollars(creditC),
      handedBack: toDollars(Math.min(toC(args.paidOut), creditC)),
    };
  }
  const slidC = args.rows.reduce((s, r) => s + Math.max(0, toC(r.paid ?? 0) - toC(r.amount)), 0)
    + toC(args.removedPaid);
  return slidC > 0 ? { kind: 'slides', amount: toDollars(slidC) } : null;
}
