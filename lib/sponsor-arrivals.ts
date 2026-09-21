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

/**
 * One payment an arrangement named, AS IT STOOD when the arrangement was made (Sponsorship
 * Applies To, owner rulings D1–D8, 2026-09-21): the POSITION in the family's schedule — never an
 * installment id, which a schedule re-run recycles — with the date and amount that payment had
 * then. The snapshot is the server's record of the moment (display, and the D4 cue's "arranged as
 * Dec 1 · Feb 1"); the coach's CHOICE is the bare positions on `appliesTo`, and the engine reads
 * only those.
 */
export interface ArrangedPayment {
  n: number;
  dueDate: string;
  amount: number;
}

export interface CreditPlanShare {
  playerId: string;
  /** Dollars when unit is 'amount'; a rate (0–100) when 'percent'. */
  value: number;
  unit: 'amount' | 'percent';
  /** The ARRANGEMENT — the positions this family's share should cover, sorted, de-duplicated.
   *  Null/absent = the team default (rep_program_years.credit_application). */
  appliesTo?: number[] | null;
  /** Read-side, server-filled: those positions as they stood when arranged (see ArrangedPayment). */
  arrangedPayments?: ArrangedPayment[] | null;
  /** Read-side, server-filled: when the arrangement was made or last confirmed. */
  arrangedAt?: string | null;
}

/** A share as the CLIENT sends it: the stored shape plus the one write-only flag — the coach
 *  pressed "Keep these" on the re-run cue, so the save restamps `arrangedAt` even though the
 *  positions did not change (D4). The resolver turns this into a CreditPlanShare; the flag never
 *  reaches a row because the stored type has nowhere to put it. */
export interface CreditPlanShareInput extends CreditPlanShare {
  keepArrangement?: boolean;
}

/** The positions an arrangement names — normalized (sorted, unique), or null for none. */
export function positionsOf(share: Pick<CreditPlanShare, 'appliesTo'> | null | undefined): number[] | null {
  return positionsFromJson(share?.appliesTo);
}

/** Any list of positions (the client's payload, a row's jsonb, a share) → sorted unique
 *  positive whole numbers, or null when nothing survives. Tolerant on purpose: this is the ONE
 *  reader of `rep_dues_credits.applies_to`, and a malformed cell must read as the team default
 *  rather than poison a family's position. */
export function positionsFromJson(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const ns = raw
    .map(v => (typeof v === 'object' && v !== null && 'n' in v ? Number((v as { n: unknown }).n) : Number(v)))
    .filter(n => Number.isInteger(n) && n >= 1);
  return ns.length ? [...new Set(ns)].sort((a, b) => a - b) : null;
}

/** Two arrangements name the same payments (the snapshot halves do not count — they are the
 *  server's record of the moment, not the coach's choice). */
export function sameArrangement(
  a: Pick<CreditPlanShare, 'appliesTo'> | null | undefined,
  b: Pick<CreditPlanShare, 'appliesTo'> | null | undefined,
): boolean {
  const pa = positionsOf(a);
  const pb = positionsOf(b);
  if (pa === null || pb === null) return pa === pb;
  return pa.length === pb.length && pa.every((n, i) => n === pb[i]);
}

/**
 * What a share row sends for its arrangement — positions only — parsed once for every door that
 * writes a plan (the create POST, the agreement PATCH). Absent, null or an empty list is the team
 * default; anything else must be a list of positive whole numbers.
 */
/** More positions than any schedule has — the generator caps a season at 24; a list past this is
 *  a broken client, not a coach. */
const MAX_NAMED_POSITIONS = 60;
/** More rows than any roster — a plan names each family once. */
const MAX_PLAN_ROWS = 200;

export function parseAppliesTo(raw: unknown): number[] | null | { error: string } {
  if (raw === undefined || raw === null) return null;
  if (!Array.isArray(raw)) return { error: 'The payments a sponsorship applies to must be a list.' };
  if (raw.length > MAX_NAMED_POSITIONS) return { error: 'The payments a sponsorship applies to must be positions in the family’s schedule.' };
  for (const v of raw) {
    const n = typeof v === 'object' && v !== null && 'n' in v ? Number((v as { n: unknown }).n) : Number(v);
    if (!Number.isInteger(n) || n < 1) return { error: 'The payments a sponsorship applies to must be positions in the family’s schedule.' };
  }
  return positionsFromJson(raw);
}

/**
 * The `creditPlan` rows a sponsor create or edit sends (Q16): `[{playerId, value, unit,
 * appliesTo?, keepArrangement?}]` → the shares that count. ONE parser for both doors — the create
 * POST and the agreement PATCH each carried a copy that had already drifted by one clause before
 * `/simplify` on this feature folded them (2026-09-21). A zero share is "not credited" and is
 * dropped; a row with no family or no unit is a refusal.
 */
export function parseCreditPlanRows(rows: readonly unknown[]): CreditPlanShareInput[] | { error: string } {
  if (rows.length > MAX_PLAN_ROWS) return { error: 'Each family can be credited once — combine their shares into one row.' };
  const plan: CreditPlanShareInput[] = [];
  for (const raw of rows) {
    const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
    const playerId = typeof row.playerId === 'string' ? row.playerId : '';
    const value = Number(row.value);
    const unit = row.unit === 'amount' ? 'amount' : row.unit === 'percent' ? 'percent' : null;
    if (!playerId || !unit) return { error: 'Every credit row needs a family and a $ or % share.' };
    if (!Number.isFinite(value) || value <= 0) continue;
    const appliesTo = parseAppliesTo(row.appliesTo);
    if (appliesTo && !Array.isArray(appliesTo)) return { error: appliesTo.error };
    plan.push({
      playerId, value, unit, appliesTo,
      ...(row.keepArrangement === true ? { keepArrangement: true } : {}),
    });
  }
  return plan;
}

export interface AccruedShare {
  playerId: string;
  /** Dollars this arrival earns this family. Families earning $0 this arrival are omitted. */
  credit: number;
}

const toCents = (n: number) => Math.round(n * 100);
const toDollars = (c: number) => c / 100;

/**
 * THE REPLAY ORDER, stated once: oldest cheque first, by the day it arrived, then by the day it
 * was recorded. Every re-derivation (`deriveAllArrivalCredits`) walks arrivals in this order, and
 * so must every reader that pairs a credit with its arrival — the entries GET, the server writer,
 * and an EDIT that moves a cheque's date (List · Room · Question Phase B, 2026-09-02): re-dating
 * the first cheque past the second changes which one "reaches the pledge" and takes the
 * remainder, so the order is part of the arithmetic, not a display choice.
 */
export function arrivalOrder(
  a: { receivedDate: string | null; createdAt: string },
  b: { receivedDate: string | null; createdAt: string },
): number {
  return (a.receivedDate ?? '').localeCompare(b.receivedDate ?? '') || a.createdAt.localeCompare(b.createdAt);
}

/**
 * The credit editor's rows (strings in boxes) → the shares that count: a family picked and a
 * share above zero. ONE transform for every door that draws the editor (the pledge sheet, the
 * room's split zone, the conversation's sponsor branch) — it shipped as three inline copies
 * before `/simplify` on Phase B (2026-09-02).
 */
export function sharesFromRows(
  rows: readonly {
    playerId: string; value: string; unit: CreditPlanShare['unit'];
    /** The arrangement's positions as the editor holds them; absent = the team default. */
    appliesTo?: readonly number[] | null;
    keepArrangement?: boolean;
  }[],
): CreditPlanShareInput[] {
  return rows
    .filter(r => r.playerId && Number(r.value) > 0)
    .map(r => ({
      playerId: r.playerId,
      value: Number(r.value),
      unit: r.unit,
      appliesTo: positionsFromJson(r.appliesTo),
      ...(r.keepArrangement ? { keepArrangement: true } : {}),
    }));
}

/** Per-family dollars a replay leaves — what the floor is asked about, and what a screen shows
 *  before the floor is asked. Integer cents, like everything else here. */
export function accruedByFamilyFromRounds(rounds: readonly AccruedShare[][]): Map<string, number> {
  const out = new Map<string, number>();
  for (const round of rounds) for (const s of round) {
    out.set(s.playerId, toDollars(toCents(out.get(s.playerId) ?? 0) + toCents(s.credit)));
  }
  return out;
}

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
