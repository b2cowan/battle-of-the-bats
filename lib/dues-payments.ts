/**
 * Dues payment allocation — the PURE half of the payment record (mig 232).
 *
 * An installment is a PLAN (what is due, when); a payment is a FACT (what arrived, when, how
 * much). Nothing here touches a database: given a schedule's installments and the player's
 * recorded payments, this derives which installments are covered, how far the next one has got,
 * and which payment completed each — the single definition read by the dues API, the paid_at
 * projection sync, and the drawer's coverage chips. Two of those living apart is how the last
 * three dues figures drifted (see lib/dues-status.ts's own history).
 *
 * ⚠ COVERAGE ORDER IS STAMPED-FIRST, THEN BY INSTALLMENT NUMBER — deliberately, and it must not
 * be "simplified" to pure number order. The mig-232 backfill created one payment per installment
 * that was ALREADY stamped paid, and a coach may have stamped #2 while #1 was in dispute. Pure
 * number order would re-derive coverage onto #1 and silently move the paid flag off a stamped,
 * ledger-linked row at migration time. Stamped-first makes the backfill a zero-visible-change
 * event, and in the steady state (stamped ⊆ covered) it degrades to plain number order.
 *
 * ⚠ All arithmetic is integer cents. 0.1 + 0.2 !== 0.3 is exactly the kind of bug a treasurer
 * finds before we do.
 */

export interface AllocatableInstallment {
  id: string;
  installmentNumber: number;
  amount: number;
  paidAt: string | null;
}

export interface AllocatablePayment {
  id: string;
  amount: number;
  /** YYYY-MM-DD — the day the money arrived (org-timezone date). */
  receivedDate: string;
  /** Tiebreak for two payments received the same day. */
  createdAt?: string | null;
}

export interface InstallmentCoverage {
  installmentId: string;
  installmentNumber: number;
  /** Dollars allocated to this installment (≤ its amount). */
  allocated: number;
  /** Dollars still MISSING on it — the figure reminders chase and payables quote. Computed here,
   *  in cents, precisely so readers don't each re-derive it: five hand-copies of the same
   *  rounding formula had appeared before this field existed (one already missing its clamp). */
  remaining: number;
  /** Fully covered by payments. */
  covered: boolean;
  /** received_date of the payment that completed coverage (null when not covered). */
  completedOn: string | null;
}

export interface DuesAllocation {
  coverage: InstallmentCoverage[];
  /** Dollars that landed on installments. */
  totalAllocated: number;
  /** Payment dollars beyond every installment (at record time this becomes the overpayment credit). */
  unallocated: number;
}

const toCents = (n: number) => Math.round(n * 100);
const toDollars = (c: number) => c / 100;

/** Payments in the order their dollars are spent: day received, then recorded, then id. */
export function sortPaymentsForAllocation<T extends AllocatablePayment>(payments: readonly T[]): T[] {
  return [...payments].sort((a, b) =>
    a.receivedDate.localeCompare(b.receivedDate)
    || (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    || a.id.localeCompare(b.id));
}

/** The order installments absorb money: already-stamped first (see header), then by number. */
export function coverageOrder<T extends AllocatableInstallment>(installments: readonly T[]): T[] {
  const stamped = installments.filter(i => i.paidAt).sort((a, b) => a.installmentNumber - b.installmentNumber);
  const open    = installments.filter(i => !i.paidAt).sort((a, b) => a.installmentNumber - b.installmentNumber);
  return [...stamped, ...open];
}

export function allocateDuesPayments(
  installments: readonly AllocatableInstallment[],
  payments: readonly AllocatablePayment[],
): DuesAllocation {
  const ordered = coverageOrder(installments);
  const queue = sortPaymentsForAllocation(payments).map(p => ({ receivedDate: p.receivedDate, left: toCents(p.amount) }));

  let qi = 0;
  const coverage: InstallmentCoverage[] = [];
  let totalAllocated = 0;

  for (const inst of ordered) {
    let need = toCents(inst.amount);
    let allocated = 0;
    let completedOn: string | null = null;
    while (need > 0 && qi < queue.length) {
      const p = queue[qi];
      if (p.left <= 0) { qi++; continue; }
      const take = Math.min(need, p.left);
      p.left -= take;
      need -= take;
      allocated += take;
      if (need === 0) completedOn = p.receivedDate;
      if (p.left === 0) qi++;
    }
    totalAllocated += allocated;
    coverage.push({
      installmentId: inst.id,
      installmentNumber: inst.installmentNumber,
      allocated: toDollars(allocated),
      remaining: toDollars(Math.max(0, need)),
      covered: need === 0 && toCents(inst.amount) > 0,
      completedOn: need === 0 ? completedOn : null,
    });
  }

  const paymentsTotal = payments.reduce((s, p) => s + toCents(p.amount), 0);
  return {
    // Report back in the original installment order the caller holds.
    coverage: coverage.sort((a, b) => a.installmentNumber - b.installmentNumber),
    totalAllocated: toDollars(totalAllocated),
    unallocated: toDollars(Math.max(0, paymentsTotal - totalAllocated)),
  };
}

/** The dues-facing "Paid" figure: payment dollars, capped at the schedule total so an
 *  auto-credited overpayment is not counted twice (the credit already carries the excess). */
export function duesPaidAmount(paymentsTotal: number, scheduleTotal: number): number {
  return toDollars(Math.min(toCents(paymentsTotal), toCents(scheduleTotal)));
}

/** How much of a NEW payment lands beyond everything left on the schedule — the amount that
 *  becomes an overpayment credit automatically (owner ruling 2026-08-13, no prompt). */
export function overpaymentExcess(
  scheduleTotal: number,
  existingPaymentsTotal: number,
  newAmount: number,
): number {
  const remaining = Math.max(0, toCents(scheduleTotal) - toCents(existingPaymentsTotal));
  return toDollars(Math.max(0, toCents(newAmount) - remaining));
}

/** Payments STRANDED beyond a schedule after its total changes (a bulk re-run that lowers dues
 *  below what a family already sent), net of what record-time overpayment credits already carry —
 *  the amount the schedule-change path auto-credits. Cents arithmetic, like everything here. */
export function strandedExcess(
  paymentsTotal: number,
  newScheduleTotal: number,
  alreadyCreditedTotal: number,
): number {
  return toDollars(Math.max(0, toCents(paymentsTotal) - toCents(newScheduleTotal) - toCents(alreadyCreditedTotal)));
}

/**
 * The overpayment reconcile's WHOLE decision, pure (QA §123 Phase A1).
 *
 * Given every credit a player holds this season — newest first, exactly as the store returns
 * them — decide what the automatic overpayment credit should do: create a top-up, remove rows a
 * rise in dues has made stale, or trim the one row the reduction only partly reaches.
 *
 * ⚠ SELECTION LIVES HERE, NOT IN THE QUERY, and that placement is the fix. The executor used to
 * select `payment_id IS NOT NULL` — only credits riding a payment — while the credits it writes
 * on a schedule change are deliberately standalone (`payment_id: null`). It therefore could not
 * see its own work: lowering dues twice doubled the credit ($400 then $1,000 where $600 was
 * true), and restoring the total left the stale $400 standing. Handing the FULL set to a pure
 * function makes "which credits count" a tested decision instead of a query's accident.
 *
 * ⚠ COUNTING EVERY OVERPAYMENT CREDIT IS NOT TREATING THEM ALL THE SAME. Only rows whose
 * `creditType` is `overpayment` are counted or touched, however born — manual, fundraiser,
 * contribution, forgiveness and reimbursement credits are the owner's "credits stay credits"
 * ruling and never appear in a plan. A payment-linked row keeps its link (its payment's CASCADE
 * still removes it); a standalone row stays standalone and manually deletable.
 */
export interface OverpaymentReconcilePlan {
  /** Dollars of NEW credit to create (0 = none). */
  create: number;
  /** Credit ids the reduction swallows whole, in the order to delete them (newest first). */
  remove: string[];
  /** The one credit the reduction only partly reaches, with its corrected amount. */
  trim: { id: string; amount: number } | null;
  /** Dollars the plan removes in total — the executor's `reduced` report. */
  reduced: number;
}

export function planOverpaymentReconcile(
  /** EVERY credit the player holds this season, newest first. */
  credits: readonly { id: string; amount: number; creditType: string }[],
  paymentsTotal: number,
  scheduleTotal: number,
): OverpaymentReconcilePlan {
  const overpayment = credits.filter(c => c.creditType === 'overpayment');
  const carriedC = overpayment.reduce((s, c) => s + toCents(c.amount), 0);
  const trueExcessC = Math.max(0, toCents(paymentsTotal) - toCents(scheduleTotal));

  if (trueExcessC > carriedC) {
    return { create: toDollars(trueExcessC - carriedC), remove: [], trim: null, reduced: 0 };
  }

  // Shrink newest-first until the stale amount is gone — delete a credit the reduction
  // swallows whole, trim the one it only partly reaches.
  let leftC = carriedC - trueExcessC;
  const reduced = toDollars(leftC);
  const remove: string[] = [];
  let trim: { id: string; amount: number } | null = null;
  for (const row of overpayment) {
    if (leftC <= 0) break;
    const amtC = toCents(row.amount);
    if (amtC <= leftC) {
      remove.push(row.id);
      leftC -= amtC;
    } else {
      trim = { id: row.id, amount: toDollars(amtC - leftC) };
      leftC = 0;
    }
  }
  return { create: 0, remove, trim, reduced };
}

/** Per-player payment-dollar totals — the grouping every season-wide dues reader starts from.
 *  Five hand-copied reduce loops preceded this helper; the pre-232 hand-copy of the same idea in
 *  money-summary had already drifted once, which is the whole argument for owning it here. */
export function paymentsTotalByPlayer(
  payments: readonly { playerId: string; amount: number }[],
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const p of payments) {
    totals.set(p.playerId, (totals.get(p.playerId) ?? 0) + toCents(p.amount));
  }
  for (const [k, v] of totals) totals.set(k, toDollars(v));
  return totals;
}
