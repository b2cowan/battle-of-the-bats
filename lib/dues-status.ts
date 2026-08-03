/**
 * Shared "who hasn't paid anything" definition for the Premium Coaches Portal.
 *
 * A player is "never paid" when they OWE dues (a schedule with installments, or a
 * positive outstanding balance) AND not a single installment has been marked paid.
 * This is distinct from "overdue" (a specific installment past its due date) — it
 * answers the coach's "who hasn't started paying at all?" question.
 *
 * BOTH the team Overview badge ("N unpaid") and the Money → Player Dues "Haven't paid
 * anything yet" panel run this same predicate over the same `/dues` response, so the
 * count on the tile and the length of the named list can never drift apart.
 */
import { tournamentToday } from './timezone';

/**
 * Is an unpaid installment past its due date?
 *
 * "Overdue" is a CALENDAR question, so it is answered in the org's timezone — never from the
 * runtime's, which is UTC in production and rolls over at ~8 PM Toronto, and never from the
 * viewer's device, which differs by province. Both would flag an installment late the evening
 * before it was actually due.
 *
 * This lived as four near-identical copies (org allocations, coach allocations, dues, expenses)
 * which is exactly how they drifted; one definition means one place to be right.
 */
export function isInstallmentOverdue(dueDate: string | null | undefined, paidAt: string | null): boolean {
  if (paidAt || !dueDate) return false;
  return dueDate < tournamentToday();
}

export interface DuesInstallmentLike {
  paidAt: string | null;
}

export interface PlayerDuesLike {
  outstanding?: number;
  installments?: DuesInstallmentLike[] | null;
}

/** True when the player owes dues but has recorded zero payments. */
export function isNeverPaidPlayer(p: PlayerDuesLike): boolean {
  const insts = p.installments ?? [];
  const hasDues = insts.length > 0 || (p.outstanding ?? 0) > 0;
  const paidNothing = !insts.some(i => i.paidAt);
  return hasDues && paidNothing;
}

/**
 * ONE definition of what a player still owes: their schedule total minus the installments marked
 * paid. Credits are deliberately EXCLUDED — the dues table, the Insights dashboard and the weekly
 * digest have always quoted this figure, and `rollingBalance` (which does subtract credits) is a
 * separate, separately-labelled number.
 *
 * These two lines lived in three places (the dues route, the insights digest, and now the Ask
 * route), each carrying a comment promising it matched the others and nothing enforcing it. A
 * change to how, say, a waived installment counts would otherwise have desynced a coach's answer
 * from the Money page while all three comments still claimed parity.
 */
export function outstandingForSchedule(
  schedule: { totalAmount: number } | null | undefined,
  installments: ReadonlyArray<{ amount: number; paidAt: string | null }>,
): number {
  if (!schedule) return 0;
  const paid = installments.filter(i => i.paidAt).reduce((sum, i) => sum + i.amount, 0);
  return schedule.totalAmount - paid;
}
