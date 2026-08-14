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
