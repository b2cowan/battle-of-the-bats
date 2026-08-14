/**
 * Dues "By installment" view — the PURE derivations behind the Player Dues tab's second lens
 * (owner-approved mockup, artifact d7162867, 2026-08-14).
 *
 * Two questions this module answers, both from data the dues screen already holds:
 *
 *  1. THE COLUMNS — "how is installment 2 going, across the team?" Schedules are usually
 *     generated uniformly but are editable per player, so columns are derived, never assumed:
 *     installment NUMBER is the join key, the header date is the date most players share, and a
 *     player whose own date differs keeps their date visible in their cell.
 *
 *  2. DUE NEXT — "what does this family owe me right now?" Past-due remainders plus what is
 *     still uncovered on the next upcoming installment — deliberately NOT the season balance,
 *     which folds in installments months away. Since credits landed on bills (owner model
 *     2026-08-14) the remainder here is the NET "to send" figure — cash remainder minus credits
 *     applied to that installment — because this figure's one invariant is that it equals the
 *     remainder the reminder emails chase, and reminders now chase the net.
 *
 * Remainders come from the installment's `toSend` (dues payload, derived by lib/dues-credits.ts
 * over InstallmentCoverage.remaining) with the raw cash remainder as fallback for callers that
 * predate credits — never re-derived here (guard: tests/unit/dues-definition-guard.test.ts).
 * "Past due" uses the same calendar rule as isInstallmentOverdue: strictly before today, in the
 * org's timezone — callers pass `today` from tournamentToday(), never a raw UTC date.
 *
 * ⚠ All arithmetic is integer cents, as in lib/dues-payments.ts.
 */

import type { InstallmentCoverage } from './dues-payments';

export interface ViewableInstallment {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  /** NET remainder — cash remainder minus credits applied here (the dues payload field of the
   *  same name). Optional so pre-credit callers fall back to the cash remainder. */
  remainingAmount?: number;
  /** Credit dollars applied to this installment (0 when credits sit off-bill). */
  creditApplied?: number;
}

/** The one remainder rule, in dollars — what the family is asked to SEND on this installment:
 *  the payload's net figure when present, else the cash remainder. EXPORTED so the dues panel
 *  and the By-installment lens read the same rule instead of each re-deriving the fallback
 *  chain (the /simplify pass found two local copies the day it was written). */
export function installmentToSend(
  inst: Pick<ViewableInstallment, 'amount' | 'remainingAmount'>,
  cov: InstallmentCoverage | undefined,
): number {
  if (inst.remainingAmount != null) return inst.remainingAmount;
  return cov ? cov.remaining : inst.amount;
}

const remainderCents = (inst: ViewableInstallment, cov: InstallmentCoverage | undefined) =>
  toCents(installmentToSend(inst, cov));

export interface PlayerScheduleLike {
  installments: ViewableInstallment[];
  coverage: InstallmentCoverage[];
}

export interface InstallmentColumn {
  installmentNumber: number;
  /** The due date the most players share for this number (ties break to the earliest). */
  commonDueDate: string | null;
  /** More than one distinct due date exists among players — cells carry their own dates. */
  dueDateVaries: boolean;
  /** Sum of this installment's amounts across every player who has it. */
  assessed: number;
  /** Payment dollars allocated to this installment across the team. */
  collected: number;
  /** Dollars still to SEND on it — net of credits applied, the figure reminders chase. */
  remaining: number;
  /** Credit dollars applied to this installment across the team (fundraising et al.). */
  creditApplied: number;
  /** Players who have this installment on their schedule. */
  playerCount: number;
  /** Players whose installment is fully covered. */
  paidCount: number;
  /** Players with money still missing on an installment already past ITS OWN due date. */
  behindCount: number;
}

const toCents = (n: number) => Math.round(n * 100);
const toDollars = (c: number) => c / 100;

/**
 * One column per installment number, 1..max across the team. Players without a schedule simply
 * contribute nothing; a player with fewer installments than the widest schedule shows a dash in
 * the extra columns (their absence is visible in playerCount).
 */
export function buildInstallmentColumns(players: readonly PlayerScheduleLike[], today: string): InstallmentColumn[] {
  const byNumber = new Map<number, { inst: ViewableInstallment; cov: InstallmentCoverage | undefined }[]>();
  for (const p of players) {
    for (const inst of p.installments) {
      const list = byNumber.get(inst.installmentNumber) ?? [];
      list.push({ inst, cov: p.coverage.find(c => c.installmentId === inst.id) });
      byNumber.set(inst.installmentNumber, list);
    }
  }
  const numbers = [...byNumber.keys()].sort((a, b) => a - b);

  return numbers.map(n => {
    const rows = byNumber.get(n)!;
    let assessed = 0;
    let collected = 0;
    let remaining = 0;
    let creditApplied = 0;
    let paidCount = 0;
    let behindCount = 0;
    const dateTally = new Map<string, number>();
    for (const { inst, cov } of rows) {
      assessed += toCents(inst.amount);
      // A missing coverage row means no payments have reached this installment.
      const allocated = toCents(cov?.allocated ?? 0);
      const rem = remainderCents(inst, cov);
      collected += allocated;
      remaining += rem;
      creditApplied += toCents(inst.creditApplied ?? 0);
      // "Paid" stays CASH-covered; an installment settled by credits counts toward nothing
      // left to send (remaining) without joining paidCount — Paid stays cash, everywhere.
      if (cov?.covered) paidCount += 1;
      // Past-due by the player's OWN date — the header's common date is presentation. A bill
      // fundraising has fully covered is not past due for anyone.
      if (rem > 0 && inst.dueDate < today) behindCount += 1;
      dateTally.set(inst.dueDate, (dateTally.get(inst.dueDate) ?? 0) + 1);
    }
    let commonDueDate: string | null = null;
    let best = 0;
    for (const [date, count] of [...dateTally.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (count > best) { commonDueDate = date; best = count; }
    }
    return {
      installmentNumber: n,
      commonDueDate,
      dueDateVaries: dateTally.size > 1,
      assessed: toDollars(assessed),
      collected: toDollars(collected),
      remaining: toDollars(remaining),
      creditApplied: toDollars(creditApplied),
      playerCount: rows.length,
      paidCount,
      behindCount,
    };
  });
}

export interface DueNextSummary {
  /** Dollars to chase right now: pastDue + nextAmount. */
  amount: number;
  /** Remainders on installments already past their due date. */
  pastDue: number;
  /** What is still uncovered on the next due date — every installment sharing the earliest
   *  not-yet-due date, today included (0 when none). */
  nextAmount: number;
  /** That due date (null when nothing is upcoming). */
  nextDueDate: string | null;
  /** Every installment fully covered — nothing to chase now or later. */
  allSettled: boolean;
}

/** Null when the player has no installments (no schedule ⇒ nothing can be due). */
export function dueNextForPlayer(
  installments: readonly ViewableInstallment[],
  coverage: readonly InstallmentCoverage[],
  today: string,
): DueNextSummary | null {
  if (installments.length === 0) return null;
  let pastDue = 0;
  let nextAmount = 0;
  let nextDueDate: string | null = null;
  let totalRemaining = 0;
  for (const inst of [...installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.installmentNumber - b.installmentNumber)) {
    const cov = coverage.find(c => c.installmentId === inst.id);
    const rem = remainderCents(inst, cov);
    if (rem <= 0) continue;
    totalRemaining += rem;
    if (inst.dueDate < today) {
      pastDue += rem;
    } else if (nextDueDate === null || inst.dueDate === nextDueDate) {
      // "Next" = every installment sharing the EARLIEST not-yet-due date with money missing
      // (due today included). Two installments due the same day are one obligation to the
      // family — counting only the first would understate what that date asks of them
      // (/review 2026-08-14). The list is date-sorted, so ties are adjacent.
      nextAmount += rem;
      nextDueDate = inst.dueDate;
    }
  }
  return {
    amount: toDollars(pastDue + nextAmount),
    pastDue: toDollars(pastDue),
    nextAmount: toDollars(nextAmount),
    nextDueDate,
    allSettled: totalRemaining === 0,
  };
}

/** Calendar days from `today` to `date` (both YYYY-MM-DD, same timezone frame). Negative = past. */
export function daysUntil(date: string, today: string): number {
  const [y1, m1, d1] = today.split('-').map(Number);
  const [y2, m2, d2] = date.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
