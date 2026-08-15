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
export function isInstallmentOverdue(
  dueDate: string | null | undefined,
  paidAt: string | null,
  /** The day to judge against. Defaults to the ORG's today — pass one only where a caller is
   *  already working to a specific day (a digest built for a given date). */
  today: string = tournamentToday(),
): boolean {
  if (paidAt || !dueDate) return false;
  return dueDate < today;
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
  /** What the family is still asked to SEND (dues − cash − credits applied; owner model
   *  2026-08-14). When supplied, a family with nothing left to send is never a chase target —
   *  their fundraising settled the season, and "you haven't paid anything yet" would be both
   *  rude and wrong. Optional so pre-credit callers keep their behaviour. */
  leftToSend?: number;
  installments?: DuesInstallmentLike[] | null;
}

/** True when the player owes dues, has recorded zero payments, and still has something to send. */
export function isNeverPaidPlayer(p: PlayerDuesLike): boolean {
  const insts = p.installments ?? [];
  const hasDues = insts.length > 0 || (p.outstanding ?? 0) > 0;
  return hasDues && p.paidAmount <= 0.005 && (p.leftToSend === undefined || p.leftToSend > 0.005);
}

/** One installment, as the past-due question needs to see it. */
export interface DuesInstallmentTiming {
  dueDate: string | null;
  paidAt: string | null;
  /** What is still asked for on THIS bill, net of credits applied to it (the payload's
   *  `remainingAmount`). Falls back to the face amount for callers that predate it. */
  remainingAmount?: number;
  amount?: number;
}

/**
 * Is this family BEHIND — any bill past its due date with money still being asked for?
 *
 * ⚠ ONE PREDICATE, because the row's status word and the table's "N overdue" footer are answers to
 * the same question and a screen that gives two is a screen nobody trusts. The panel hand-rolled
 * this loop for its footer while the status column knew nothing about time at all; that gap is
 * exactly the defect this replaced.
 *
 * ⚠ A BILL WITH NOTHING LEFT TO SEND IS NOT LATE FOR ANYONE. Credits settle bills, and `paid_at`
 * deliberately never stamps on a credit-covered row (Paid stays cash) — so lateness must be judged
 * on the REMAINDER, never on the stamp alone.
 */
export function pastDueInstallments<T extends DuesInstallmentTiming>(
  installments: T[] | null | undefined,
  today?: string,
): T[] {
  return (installments ?? []).filter(inst =>
    !inst.paidAt
    && (inst.remainingAmount ?? inst.amount ?? 0) > 0.005
    && isInstallmentOverdue(inst.dueDate, inst.paidAt, today));
}

/** The same question, answered per PLAYER — "is this family behind?" */
export function hasPastDueInstallment(
  installments: DuesInstallmentTiming[] | null | undefined,
  today?: string,
): boolean {
  return pastDueInstallments(installments, today).length > 0;
}

/**
 * The word a coach reads for one player's dues position.
 *
 * ⚠ EVERY LABEL ANSWERS ONE QUESTION: **does this family owe us anything RIGHT NOW?** That is a
 * question about time, and until 2026-08-14 this function could not see time at all — it graded
 * SEASON COMPLETION instead. So a family faithfully paying every installment on the day it fell
 * due read "Partial", and a family who had paid nothing with a bill a month late read "Partial"
 * too. One word for the model family and the delinquent one, and the only hint that anybody was
 * behind was a "3 overdue" line under the whole table. (Owner: *"I don't like partial… those that
 * are past due should clearly say so."*)
 *
 * The six words now, in the order they are decided:
 *   • **Not set**    — no schedule exists.
 *   • **In credit**  — nothing owed AND the team is holding this family's money.
 *   • **Fully paid** — nothing owed, cleared entirely in cash.
 *   • **Settled**    — nothing owed, credits did part of the work. ⚠ PAID STAYS CASH: a balance
 *     credits cleared never reads Fully paid — the pre-model export row saying "Paid $0.00 ·
 *     Status Fully paid" is the embarrassment that distinction retires.
 *   • **Past due**   — a bill is late and money is still being asked for. Outranks everything
 *     below it, because it is the only status that is a call to action.
 *   • **Up to date** — still owes for the season, but nothing is late. ⚠ THIS DELIBERATELY COVERS
 *     A FAMILY WHO HAS PAID NOTHING YET when their first bill has not come due: they owe us
 *     nothing today, and calling that "Unpaid" cried wolf on families who had done nothing wrong.
 *     How far through the season they are is what the Paid and Balance columns are for; who needs
 *     chasing is what this column is for.
 *
 * Shared because it is read in two places that must agree: the Player Dues table on screen, and
 * the Player dues export from the Money hub. A coach who exports a spreadsheet and finds a
 * different word beside a name than the table showed has been told two things by one product. The
 * colour stays with the table — that is presentation, and a spreadsheet has no use for it.
 *
 * ⚠ THE DERIVED FIGURES ARE REQUIRED, and the mode-blind fallback that used to stand here is
 * gone. It graded off `rollingBalance` alone, which read a keep_separate team's unapplied credit
 * as "Settled" while the family still owed every cash dollar — a /review Critical. Both callers
 * supply all three; a compile error is the right answer for any third.
 */
export function duesStatusLabel(p: {
  schedule: unknown | null;
  paidAmount: number;
  totalCredits: number;
  /** Dues − cash − credits APPLIED (mode-aware). */
  leftToSend: number;
  /** The family's money the team is holding (never includes forgiveness). */
  owedBack: number;
  /** Schedule total − cash paid (credit-blind, the shared definition). */
  outstanding: number;
  /** The bills, so lateness can be judged. Absent ⇒ nothing carries a due date ⇒ nothing is late. */
  installments?: DuesInstallmentTiming[] | null;
}): 'Not set' | 'In credit' | 'Settled' | 'Fully paid' | 'Past due' | 'Up to date' {
  if (!p.schedule) return 'Not set';
  // Nothing left to send — the season's terminal states, none of which can be late.
  if (p.leftToSend <= 0.005) {
    if (p.owedBack > 0.005) return 'In credit';
    return p.outstanding <= 0.005 ? 'Fully paid' : 'Settled';
  }
  return hasPastDueInstallment(p.installments) ? 'Past due' : 'Up to date';
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
