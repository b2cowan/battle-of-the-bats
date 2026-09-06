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
import { addCalendarDays } from './timezone';

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
  /**
   * The instalment amount the most players share (ties break to the largest), or 0 when the
   * column is empty. The exact twin of `commonDueDate`, and it exists for the same reason: since
   * the grid stopped printing the amount in every cell (owner ruling 2026-08-14), the COLUMN
   * HEADING states it once — and a player whose own instalment differs from it must still show
   * their own figure, or a hand-edited schedule would silently read as the team's.
   */
  commonAmount: number;
  /** More than one distinct amount exists among players — the heading cannot speak for them. */
  amountVaries: boolean;
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
    const amountTally = new Map<number, number>();
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
      // ⚠ Tallied in CENTS. Keying a map on a float would give 199.99999999 its own bucket and
      // quietly split a column that every player actually shares.
      const cents = toCents(inst.amount);
      amountTally.set(cents, (amountTally.get(cents) ?? 0) + 1);
    }
    let commonDueDate: string | null = null;
    let best = 0;
    for (const [date, count] of [...dateTally.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (count > best) { commonDueDate = date; best = count; }
    }
    // Same modal rule as the date, ties breaking to the LARGEST amount — the heading should never
    // understate what a player is being asked for.
    let commonAmountC = 0;
    let bestAmount = 0;
    for (const [cents, count] of [...amountTally.entries()].sort(([a], [b]) => b - a)) {
      if (count > bestAmount) { commonAmountC = cents; bestAmount = count; }
    }
    return {
      installmentNumber: n,
      commonDueDate,
      dueDateVaries: dateTally.size > 1,
      commonAmount: toDollars(commonAmountC),
      amountVaries: amountTally.size > 1,
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

/**
 * THE ONE INSTALLMENT A COACH CAN ACT ON — the earliest still owed, with a late piece outranking a
 * future one (a debt is more actionable than a plan). `null` when every installment is collected.
 *
 * ⚠ ONE DEFINITION, TWO READERS (owner G2, 2026-09-04). The Collection schedule's shut line names
 * this installment and the By-installment grid lights its column and opens with it in view; derived
 * separately they could point at two different columns on one screen, which is the exact defect
 * the timeline was moved into the header to end. Late is the column's own `behindCount` — money
 * still to send on a bill past THAT PLAYER'S due date — never re-derived from the heading's common
 * date, so a hand-edited schedule is late on the family's day rather than the team's.
 */
export function focusInstallmentColumn(columns: readonly InstallmentColumn[]): InstallmentColumn | null {
  let late: InstallmentColumn | null = null;
  let next: InstallmentColumn | null = null;
  for (const col of columns) {
    if (col.remaining <= 0.005) continue;
    if (col.behindCount > 0) { if (!late) late = col; continue; }
    if (!next) next = col;
  }
  return late ?? next ?? null;
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
  /** The EARLIEST past-due date with money still missing (null when nothing is late). The grid's
   *  `Due next` column shows a date rather than a figure (owner, 2026-09-04), and for a family who
   *  is behind, the date that matters is the oldest one they owe — not the next one coming. Same
   *  rule the lit column follows: late outranks future. */
  pastDueDate: string | null;
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
  let pastDueDate: string | null = null;
  let totalRemaining = 0;
  for (const inst of [...installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.installmentNumber - b.installmentNumber)) {
    const cov = coverage.find(c => c.installmentId === inst.id);
    const rem = remainderCents(inst, cov);
    if (rem <= 0) continue;
    totalRemaining += rem;
    if (inst.dueDate < today) {
      pastDue += rem;
      // Date-sorted, so the first late one we meet is the oldest.
      if (pastDueDate === null) pastDueDate = inst.dueDate;
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
    pastDueDate,
    allSettled: totalRemaining === 0,
  };
}

/* ⚰ `daysUntil()` LIVED HERE and is deleted (2026-09-03). Its one caller wrote the Collection
   schedule band's "due in 12 days" caption, and the band was replaced by a timeline that prints the
   date itself. Nothing is orphaned: `lib/marketing-schedule.ts` and `lib/tournament-phase-display.ts`
   each keep their own, both with callers and tests, so a future need has two homes to pick from
   rather than one unused export sitting in the dues module pretending to be shared. */

/**
 * How far ahead the coach's on-demand "Send due reminders" looks — past due, or due within this
 * many days. ⚠ ONE NUMBER, TWO READERS (cleanup 2026-09-04): the server's candidate query decides
 * who is emailed, and the player's panel decides whether to offer "Remind this family". Defined
 * once so a future change to the window cannot leave the button and the send disagreeing.
 */
export const DUE_REMINDER_DAYS_AHEAD = 3;

/**
 * WHICH installments the on-demand reminder would actually chase today: past due or due within
 * the window, with money still to send. The same rule the send-reminders route's candidate query
 * applies, minus the seven-day courtesy — which the server owns, because only it can read a stamp
 * that landed since this page loaded.
 *
 * ⚠ THE LIST, NOT JUST THE ANSWER (/review 2026-09-05). The boolean below used to be the only
 * export, so a caller that needed to reason about the courtesy had to re-derive the candidate set
 * by hand — and the dues panel's first attempt did, over the WHOLE schedule including PAID
 * installments. A bill paid last week still carries the reminder stamp that chased it, so that
 * caller greyed out a legitimate send for a DIFFERENT bill that had since come due, and told the
 * coach a specific, false reason. One definition, handed out, so it cannot happen again.
 */
export function chaseableInstallments<T extends ViewableInstallment>(
  p: { installments: T[]; coverage: InstallmentCoverage[] },
  today: string,
): T[] {
  const cutoff = addCalendarDays(today, DUE_REMINDER_DAYS_AHEAD);
  return p.installments.filter(i =>
    !i.paidAt && i.dueDate <= cutoff && installmentToSend(i, p.coverage.find(c => c.installmentId === i.id)) > 0.005);
}

/** Would the on-demand reminder have anything to say to this family today? */
export function chaseableInstallment(p: PlayerScheduleLike, today: string): boolean {
  return chaseableInstallments(p, today).length > 0;
}

/**
 * How many families still owe something on ONE installment — the number a coach chases. Runs
 * through `installmentToSend` so it cannot disagree with the grid's cells or with what a reminder
 * email asks for. Shared by the Collection schedule's shut line and the reminder confirmation's
 * zero state, which used to carry two copies of this loop.
 */
export function familiesOwingOn(players: readonly PlayerScheduleLike[], column: InstallmentColumn | null): number {
  if (!column) return 0;
  let n = 0;
  for (const p of players) {
    const inst = p.installments.find(i => i.installmentNumber === column.installmentNumber);
    if (!inst || inst.paidAt) continue;
    if (installmentToSend(inst, p.coverage.find(c => c.installmentId === inst.id)) > 0.005) n += 1;
  }
  return n;
}
