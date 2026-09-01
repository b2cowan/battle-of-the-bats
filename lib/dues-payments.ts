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
/** The engine's own standalone credit description — ONE home (QA §124 addendum), shared by the
 *  executor that writes it, the drawer that recognizes it to say "Follows the schedule", and the
 *  credit route that refuses to edit or delete it. */
export const SCHEDULE_CHANGE_CREDIT_DESCRIPTION = 'Overpayment (dues changed)';

/** The 409 code when a coach tries to edit or delete the engine's schedule-change credit
 *  (owner, 2026-09-01). Deleting it is a lie twice over: the books understate what the family
 *  is owed until the next reconcile, and THAT quietly recreates the row — dangerous meanwhile,
 *  futile afterwards. The doors that genuinely move it: the dues total, and the payout. */
export const CREDIT_FOLLOWS_SCHEDULE = 'CREDIT_FOLLOWS_SCHEDULE';

/** The description is the engine's ownership mark, so a coach must not be able to claim it by
 *  hand (review 2026-09-01): a manual credit wearing it would be locked behind the 409 above and
 *  silently written into by the next reconcile. Both manual doors (create and edit) refuse it. */
export const RESERVED_CREDIT_DESCRIPTION_REFUSAL =
  'That description belongs to the schedule’s own credit — give this one a different name.';

export interface OverpaymentReconcilePlan {
  /** Dollars of NEW credit to create (0 = none). When `topUp` is set, the same dollars land as
   *  a raise of that existing row instead of an insert. */
  create: number;
  /** CONSOLIDATION (owner, 2026-09-01): the engine's schedule-change credit is ONE row per
   *  player-season — a later lower tops THIS row up rather than appending a sibling (four
   *  identical "Overpayment (dues changed) · Sep 1" rows read as a bug, and were one fact).
   *  Set only on the schedule-change path, and only onto a row the ENGINE created — a
   *  coach-typed overpayment credit is counted but never written into. */
  topUp: { id: string; newAmount: number } | null;
  /** Credit ids the reduction swallows whole, in the order to delete them (newest first). */
  remove: string[];
  /** The one credit the reduction only partly reaches, with its corrected amount. */
  trim: { id: string; amount: number } | null;
  /** Dollars the plan removes in total — the executor's `reduced` report. */
  reduced: number;
}

export function planOverpaymentReconcile(
  /** EVERY credit the player holds this season, newest first. `consolidatable` marks the
   *  engine's own standalone schedule-change rows (see SCHEDULE_CHANGE_CREDIT_DESCRIPTION). */
  credits: readonly { id: string; amount: number; creditType: string; consolidatable?: boolean }[],
  paymentsTotal: number,
  scheduleTotal: number,
  /** `consolidate` on the schedule-change path only — a record-time credit RIDES its payment
   *  (CASCADE removes it with the receipt) and must stay its own row. */
  opts?: { consolidate?: boolean },
): OverpaymentReconcilePlan {
  const overpayment = credits.filter(c => c.creditType === 'overpayment');
  const carriedC = overpayment.reduce((s, c) => s + toCents(c.amount), 0);
  const trueExcessC = Math.max(0, toCents(paymentsTotal) - toCents(scheduleTotal));

  if (trueExcessC > carriedC) {
    const createC = trueExcessC - carriedC;
    // ONE row per season means MERGING, not assuming: several engine rows can exist (a race
    // that double-inserted, or pre-consolidation history), and the grow path is the only one
    // guaranteed to revisit them — so it folds every engine row into the newest and removes
    // the rest (review 2026-09-01). `reduced` stays 0: the extras' dollars move, never leave.
    const hosts = opts?.consolidate ? overpayment.filter(c => c.consolidatable) : [];
    const host = hosts[0];
    return {
      create: toDollars(createC),
      topUp: host
        ? { id: host.id, newAmount: toDollars(hosts.reduce((s, c) => s + toCents(c.amount), 0) + createC) }
        : null,
      remove: hosts.slice(1).map(c => c.id),
      trim: null, reduced: 0,
    };
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
  return { create: 0, topUp: null, remove, trim, reduced };
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
