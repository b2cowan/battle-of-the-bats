/**
 * Sponsor arrivals — the PURE arithmetic of the arrivals model (mig 268, owner rulings Q12 +
 * Q16, 2026-08-28). Sibling of lib/dues-credits.ts and held to the same standard: nothing here
 * touches a database, and all arithmetic is integer cents.
 *
 * The model in one breath: a sponsor's PROMISE lives on its row (`pledged_amount`); each cheque
 * that lands is an ARRIVAL (a rep_fundraiser_entries row, dated, with a method); the CREDIT PLAN
 * (rep_fundraiser_credit_plan) says which families share the credit, in dollars or percent; and
 * credits ACCRUE per arrival as the money actually lands — a pledge credits nobody, which is the
 * realised invariant this file inherits rather than restates.
 *
 * Accrual rules (plan §2, resolved 2026-08-28):
 *  · a PERCENT share earns pct × each arrival — over-pledge keeps earning (15% of everything
 *    that arrives is 15% of everything that arrives);
 *  · a DOLLAR share fills proportionally, share × (arrived-so-far ÷ pledged), and the arrival
 *    that reaches the pledge takes the remainder so the family's total equals the share EXACTLY
 *    (rounding never strands a cent);
 *  · with no pledge to prorate against, a dollar share lands as fast as money arrives —
 *    min(what's left of the share, this arrival) — which degenerates to "whole on the first
 *    arrival" in the common case.
 *
 * ⚠ THE WRITER MUST FEED THIS, NEVER REIMPLEMENT IT. The per-family figures written to
 * rep_dues_credits, the arrival's own rebate_amount (= the sum of its accrued shares), and the
 * "still to come" line all come from these functions — a second copy of this arithmetic is how
 * the guard and the writer drift, which Phase A just spent a review closing one layer down.
 */

export interface CreditPlanShare {
  playerId: string;
  /** Dollars when unit is 'amount'; a rate (0–100) when 'percent'. */
  value: number;
  unit: 'amount' | 'percent';
}

export interface AccruedShare {
  playerId: string;
  /** Dollars this arrival earns this family. Families earning $0 this arrival are omitted. */
  credit: number;
}

const toCents = (n: number) => Math.round(n * 100);
const toDollars = (c: number) => c / 100;

/** `pledged − arrived`, floored at zero — the "still to come" figure, one definition. */
export function stillToCome(pledged: number | null, arrivedTotal: number): number {
  if (!pledged || pledged <= 0) return 0;
  return toDollars(Math.max(0, toCents(pledged) - toCents(arrivedTotal)));
}

/**
 * Validate a credit plan against the pledge. Returns the refusal sentence, or null when it fits.
 * The cap is the owner's Q16 rule stated as arithmetic: the families' shares may never add up
 * past the sponsorship itself.
 */
export function creditPlanProblem(
  plan: readonly CreditPlanShare[],
  pledged: number | null,
): string | null {
  const seen = new Set<string>();
  for (const s of plan) {
    if (seen.has(s.playerId)) return 'Each family can be credited once — combine their shares into one row.';
    seen.add(s.playerId);
    if (!Number.isFinite(s.value) || s.value <= 0) return 'Every credited family needs a share greater than zero.';
    if (s.unit === 'percent' && s.value > 100) return 'A percent share can’t be more than 100.';
  }
  if (pledged && pledged > 0) {
    const dollarC = plan.filter(s => s.unit === 'amount').reduce((c, s) => c + toCents(s.value), 0);
    const pctC = plan.filter(s => s.unit === 'percent')
      .reduce((c, s) => c + Math.round(toCents(pledged) * s.value / 100), 0);
    if (dollarC + pctC > toCents(pledged)) {
      return `The family credits add up to $${toDollars(dollarC + pctC).toFixed(2)} — more than the $${pledged.toFixed(2)} sponsorship.`;
    }
  }
  return null;
}

/**
 * What one arrival earns each family, given everything that accrued before it.
 *
 * `priorAccrued` is per-family dollars already credited by EARLIER arrivals (sum of their
 * rep_dues_credits). Deterministic and order-safe: replaying arrivals oldest-first through this
 * function reproduces every credit exactly, which is how a plan edit re-derives the world.
 */
export function accrueArrival(args: {
  plan: readonly CreditPlanShare[];
  pledged: number | null;
  arrivalAmount: number;
  /** Σ of earlier arrivals' amounts (this one excluded). */
  priorArrivalsTotal: number;
  priorAccrued: ReadonlyMap<string, number>;
}): AccruedShare[] {
  const { plan, pledged, arrivalAmount, priorArrivalsTotal, priorAccrued } = args;
  const out: AccruedShare[] = [];
  if (!Number.isFinite(arrivalAmount) || arrivalAmount <= 0) return out;

  const pledgedC = pledged && pledged > 0 ? toCents(pledged) : 0;
  const arrivalC = toCents(arrivalAmount);
  const totalAfterC = toCents(priorArrivalsTotal) + arrivalC;

  for (const share of plan) {
    const priorC = toCents(priorAccrued.get(share.playerId) ?? 0);
    let creditC = 0;
    if (share.unit === 'percent') {
      creditC = Math.round(arrivalC * share.value / 100);
    } else {
      const shareC = toCents(share.value);
      if (pledgedC > 0) {
        // Proportional to date; the arrival that reaches the pledge takes the remainder.
        const targetC = totalAfterC >= pledgedC
          ? shareC
          : Math.round(shareC * totalAfterC / pledgedC);
        creditC = Math.max(0, targetC - priorC);
      } else {
        // No pledge to prorate against: as fast as money arrives, never past the share.
        creditC = Math.max(0, Math.min(shareC - priorC, arrivalC));
      }
    }
    if (creditC > 0) out.push({ playerId: share.playerId, credit: toDollars(creditC) });
  }
  return out;
}

/**
 * Replay a whole arrival history through the plan — the re-derivation a plan edit runs.
 * Arrivals must be oldest-first; returns per-arrival accruals in the same order.
 */
export function deriveAllArrivalCredits(args: {
  plan: readonly CreditPlanShare[];
  pledged: number | null;
  /** Oldest first. */
  arrivalAmounts: readonly number[];
}): AccruedShare[][] {
  const accrued = new Map<string, number>();
  let priorTotal = 0;
  const out: AccruedShare[][] = [];
  for (const amount of args.arrivalAmounts) {
    const shares = accrueArrival({
      plan: args.plan,
      pledged: args.pledged,
      arrivalAmount: amount,
      priorArrivalsTotal: priorTotal,
      priorAccrued: accrued,
    });
    for (const s of shares) accrued.set(s.playerId, toDollars(toCents(accrued.get(s.playerId) ?? 0) + toCents(s.credit)));
    priorTotal = toDollars(toCents(priorTotal) + toCents(amount));
    out.push(shares);
  }
  return out;
}
