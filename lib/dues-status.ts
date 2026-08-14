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
  /** Dollars actually received (rep_dues_payments, mig 232). REQUIRED, deliberately — an
   *  installment-stamp fallback existed briefly and was removed: the stamps are only a coverage
   *  projection, so a caller that forgot to supply payment dollars would silently count a
   *  part-paying family as "never paid" — this project's founding defect — with no compiler or
   *  test signal. Making the field mandatory turns that mistake into a type error. */
  paidAmount: number;
  installments?: DuesInstallmentLike[] | null;
}

/** True when the player owes dues but has recorded zero payments. */
export function isNeverPaidPlayer(p: PlayerDuesLike): boolean {
  const insts = p.installments ?? [];
  const hasDues = insts.length > 0 || (p.outstanding ?? 0) > 0;
  return hasDues && p.paidAmount <= 0.005;
}

/**
 * The word a coach reads for one player's dues position — "Unpaid", "Partial", "Fully paid",
 * "In credit", or "Not set" when no schedule exists.
 *
 * Shared because it is now read in two places that must agree: the Player Dues table on screen,
 * and the Player dues export offered from the Money hub's Export menu. A coach who exports a
 * spreadsheet and finds a different status beside a name than the one the table showed has been
 * told two things by one product. The colour each status is drawn in stays with the table — that
 * is presentation, and a spreadsheet has no use for it.
 */
export function duesStatusLabel(p: {
  schedule: unknown | null;
  rollingBalance: number;
  paidAmount: number;
  totalCredits: number;
}): 'Not set' | 'In credit' | 'Fully paid' | 'Partial' | 'Unpaid' {
  if (!p.schedule) return 'Not set';
  if (p.rollingBalance < -0.005) return 'In credit';
  if (p.rollingBalance <= 0.005) return 'Fully paid';
  if (p.paidAmount > 0 || p.totalCredits > 0) return 'Partial';
  return 'Unpaid';
}

/**
 * ONE definition of what a player still owes: their schedule total minus what has actually been
 * PAID. Credits are deliberately EXCLUDED — the dues table, the Insights dashboard and the weekly
 * digest have always quoted this figure, and `rollingBalance` (which does subtract credits) is a
 * separate, separately-labelled number.
 *
 * Since mig 232 "paid" means recorded payment dollars (capped at the schedule total — see
 * `duesPaidAmount` in lib/dues-payments.ts), NOT the count of fully-stamped installments; the
 * old installment-based signature would have read a part-paid family as owing everything. Every
 * caller passes the same capped figure it displays as "Paid", so the two can never disagree on
 * one screen.
 *
 * These two lines lived in three places (the dues route, the insights digest, and now the Ask
 * route), each carrying a comment promising it matched the others and nothing enforcing it. A
 * change to how, say, a waived installment counts would otherwise have desynced a coach's answer
 * from the Money page while all three comments still claimed parity.
 */
export function outstandingForSchedule(
  schedule: { totalAmount: number } | null | undefined,
  paidAmount: number,
): number {
  if (!schedule) return 0;
  return Math.round((schedule.totalAmount - paidAmount) * 100) / 100;
}
