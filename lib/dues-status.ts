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
