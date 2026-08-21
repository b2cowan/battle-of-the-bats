// Editing ONE piece of a linked series — the pure decisions behind S1–S8 (Payables Rebuild P4).
//
// A repeating cost is not a new kind of record: it is a commitment whose plan happens to have six
// dated pieces instead of one (S8 — the series IS the installments, and nothing stores the rule
// that built them). So "edit installment 4 and every one after it" is not a new write path either.
// It is a question about WHICH PIECES a change reaches, answered here, turned into a whole desired
// plan, and handed to the one writer that already knows how to store a plan and carry a figure
// through to the books (`updateRepTeamExpense`).
//
// ⚠⚠ THE ROLL-FORWARD IS NOT IMPLEMENTED HERE, AND THAT IS THE POINT. S6 says lowering an amount
// below what has already been applied rolls the excess forward to the next unpaid piece. That is
// already what `commitmentStanding()` DOES — payments are re-applied on every read, earliest piece
// first, spilling forward (R3). So this module does not move money; it re-runs the standing against
// the plan it is proposing and READS OFF what would happen. What S6 actually adds is the sentence
// (which pieces gained money) and the refusal (when the excess has nowhere to land and would become
// an over-payment). Computing a second roll-forward by hand would be a second arithmetic for a
// question the model already answers — the exact defect `money-one-arithmetic-guard` exists to stop.
//
// Pure, no I/O, same rule and reason as `lib/payable-standing.ts` and `lib/payable-plan.ts`: the
// client shows the sentence from this module and the route writes from it, so the warning a coach
// reads and the write that follows cannot disagree.
//
// Relative WITH the .ts extension (not `@/`) so the unit tests can run under plain `node --test`.
import {
  commitmentStanding, installmentsInScope,
  type CommitmentStanding, type EditScope, type PayableInstallment, type PayablePayment,
} from './payable-standing.ts';
import type { PlanPiece } from './payable-plan.ts';
import { addCalendarDays, daysBetweenDateStrings } from './timezone.ts';

const cents = (n: number) => Math.round(n * 100);
const money = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** What the coach changed on the piece they picked. Either or both; absent means "leave it". */
export interface InstallmentChange {
  amount?: number;
  /** `YYYY-MM-DD`. ⚠ S5 — under a bulk scope this is a SHIFT, not a set. See below. */
  dueDate?: string;
}

export interface ScopedEditOutcome {
  /**
   * The whole plan the commitment should now have, in INSTALLMENT-NUMBER order — which is what
   * `planInstallmentWrites` diffs positionally. ⚠ NOT due-date order: `standing.installments` is
   * sorted by due date (money applies in the order it comes due), and handing that order to a
   * positional writer would renumber a series every time a coach moved one payment earlier.
   */
  plan: PlanPiece[];
  /** The installment numbers the scope actually changed — what the confirmation names. */
  touched: number[];
  /**
   * ⚠ S6 — installments whose share of money already recorded GOES UP as a result of this change,
   * in number order. Empty for the ordinary case, and the sentence names every one of them rather
   * than only the next: a $450 payment freed off a lowered piece can reach three later ones.
   *
   * ⚠ IT IS NOT ONLY "FORWARD". Raising a piece pulls money BACK onto it from the pieces it had
   * spilled into, which is the same re-application running the other way — so the sentence says
   * "now counts towards", which is true in both directions, rather than claiming a direction.
   */
  rolledForwardTo: number[];
  /** A sentence written for the coach when the change cannot be saved, or null. */
  refusal: string | null;
}

/**
 * Would writing this plan leave the commitment reading as OVER-PAID? The sentence, or null.
 *
 * ⚠⚠ THE TEST IS THE OUTCOME, NOT A SHAPE, and that is the whole reason this replaced a positional
 * guard in `updateRepTeamExpense`. The old one refused whenever a DROPPED piece carried money — a
 * proxy that fails in both directions once a plan can hold twenty-four: it refused legitimate
 * deletes (removing payment 1 of six shrinks the plan by one and the money re-applies perfectly,
 * yet the last row happening to carry a payment would refuse it) and it missed the case it was
 * written for, because the piece that gets dropped is usually not the piece holding the money.
 *
 * What actually makes a shrink unsafe is that the bill silently starts reading as over-paid with
 * nothing on screen explaining it. Over-payment is legitimate when a coach RECORDS one (R6);
 * manufacturing one by editing a figure downwards is not.
 *
 * ⚠ THE PROPOSED ROWS ARE MATCHED BY IDENTITY WHEN THE PLAN CARRIES IT (`PlanPiece.id`), and only
 * fall back to position when it does not — mirroring `planInstallmentWrites` exactly, because a
 * prediction made under a different matching rule than the write is worse than no prediction. That
 * mismatch is precisely what let a removed deposit re-point a recorded payment at the balance.
 *
 * ⚠ NO SEPARATE "a payment is aimed at this piece" REFUSAL any more. There was one for part of this
 * phase, written when the writer still refused to delete such a row; the writer now deletes the row
 * the coach actually removed and the FK releases the override (`ON DELETE SET NULL`), so the money
 * re-pours from the earliest unfilled piece — S7 working, not a case to refuse.
 */
export function whyPlanStrandsPaidMoney(
  standing: CommitmentStanding,
  plan: readonly PlanPiece[],
): string | null {
  const ordered = inNumberOrder(standing);
  const byId = new Map(ordered.map(i => [i.id, i]));
  const byIdentity = plan.some(p => p.id && byId.has(p.id));

  const proposed: PayableInstallment[] = plan.map((piece, at) => ({
    id: (byIdentity ? (piece.id && byId.has(piece.id) ? piece.id : undefined) : ordered[at]?.id)
      ?? `new-${at + 1}`,
    expenseId: ordered[0]?.expenseId ?? '',
    installmentNumber: at + 1,
    amount: piece.amount,
    dueDate: piece.dueDate,
  }));
  return overpaymentRefusal(standing, consequences(standing, proposed).newOver);
}

/** The pieces in the order a positional writer wants them, with their live numbers. */
function inNumberOrder(standing: CommitmentStanding) {
  return [...standing.installments].sort((a, b) => a.installmentNumber - b.installmentNumber);
}

/** Re-run the standing over a proposed plan, and read off what the money would do. */
function consequences(
  standing: CommitmentStanding,
  proposed: readonly PayableInstallment[],
): { rolledForwardTo: number[]; newOver: number } {
  const payments: PayablePayment[] = standing.payments.map(p => ({
    id: p.id,
    expenseId: p.expenseId,
    /* ⚠ A TARGET THAT NO LONGER EXISTS IS DROPPED, not carried — `commitmentStanding` treats a
       payment whose installment is gone as untargeted and pours it from the top, which is exactly
       what the writer will see after the delete lands. Keeping a stale id here would model a
       different outcome from the one the coach is about to get. */
    installmentId: proposed.some(i => i.id === p.installmentId) ? p.installmentId : null,
    amount: p.amount,
    paidDate: p.paidDate,
    method: p.method,
    note: p.note,
    accountingEntryId: p.accountingEntryId,
  }));
  const after = commitmentStanding(proposed, payments);
  const beforeApplied = new Map(standing.installments.map(i => [i.id, cents(i.applied)]));
  const rolledForwardTo = after.installments
    .filter(i => cents(i.applied) > (beforeApplied.get(i.id) ?? 0))
    .map(i => i.installmentNumber)
    .sort((a, b) => a - b);
  return { rolledForwardTo, newOver: after.over };
}

/**
 * ⚠ S6's REFUSAL, and the ONE case it fires on: the freed money has nowhere to land.
 *
 * "Block only when there is nowhere for it to go — the last installment, or the only one." Stated
 * as a CONSEQUENCE rather than as a shape: what makes it unsafe is that the commitment would start
 * reading as over-paid, and that is true whether the piece happens to be last, or last-among-the-
 * unsettled, or simply the only one with room. Over-payment is legitimate when a coach records one
 * (R6); manufacturing one by editing a figure downwards is not, because nothing on screen would
 * explain it.
 */
function overpaymentRefusal(before: CommitmentStanding, newOver: number): string | null {
  if (cents(newOver) <= cents(before.over)) return null;
  const excess = newOver - before.over;
  return `That would leave ${money(excess)} of money already paid with no later payment to go `
    + 'towards, so this bill would read as over-paid. Raise a later payment first, or record the '
    + `${money(excess)} back out.`;
}

/**
 * S1–S6 for an EDIT: which pieces the change reaches, and what it does to money already recorded.
 *
 * ⚠⚠ AMOUNTS ARE SET, DATES ARE SHIFTED, and the asymmetry is the design (S5). A monthly series
 * has ONE amount and TWELVE dates: "raise it to $525" means every payment in scope becomes $525,
 * while "move it to the 8th" means every payment in scope moves by seven days. Setting them all to
 * one date is nonsense on a monthly series — it would stack December, January and February on the
 * same day.
 *
 * ⚠ S1 is `installmentsInScope`, not re-derived here: bulk scopes never return a settled piece, and
 * the target itself is always included even when settled, because the coach picked it (S2 — a
 * settled piece is EDITABLE under "this payment only" and the books follow; that is the standing
 * ruling of 2026-08-16 and locking it would reverse a live decision).
 */
export function planScopedInstallmentEdit(
  standing: CommitmentStanding,
  targetId: string,
  scope: EditScope,
  change: InstallmentChange,
): ScopedEditOutcome {
  const target = standing.installments.find(i => i.id === targetId);
  if (!target) {
    return { plan: [], touched: [], rolledForwardTo: [], refusal: 'That payment is not part of this bill.' };
  }
  const reach = new Set(installmentsInScope(standing, targetId, scope).map(i => i.id));
  const shiftDays = change.dueDate !== undefined
    ? daysBetweenDateStrings(target.dueDate, change.dueDate)
    : 0;

  const ordered = inNumberOrder(standing);
  const proposed = ordered.map(inst => {
    if (!reach.has(inst.id)) return { ...inst };
    return {
      ...inst,
      amount: change.amount !== undefined ? change.amount : inst.amount,
      dueDate: change.dueDate === undefined
        ? inst.dueDate
        /* The target lands exactly where the coach put it; everything else in scope moves by the
           same number of days. Identical when the scope is one row, which is most edits. */
        : inst.id === targetId ? change.dueDate : addCalendarDays(inst.dueDate, shiftDays),
    };
  });

  const touched = proposed
    .filter((p, at) => cents(p.amount) !== cents(ordered[at].amount) || p.dueDate !== ordered[at].dueDate)
    .map(p => p.installmentNumber);

  const { rolledForwardTo, newOver } = consequences(standing, proposed);
  return {
    // ⚠ EACH SURVIVING ROW NAMES ITSELF — see `PlanPiece.id`. Without this the writer matches by
    // position and a non-trailing removal re-points a recorded payment at the wrong piece.
    plan: proposed.map(p => ({ id: p.id, amount: p.amount, dueDate: p.dueDate })),
    touched,
    rolledForwardTo,
    refusal: overpaymentRefusal(standing, newOver),
  };
}

/**
 * S1, S6 and S7 for a DELETE: the rows that go, and where the money that was on them lands.
 *
 * ⚠ S7 — a piece with money applied to it is NOT protected from deletion; its money rolls forward,
 * because that is what `commitmentStanding` does with a payment whose target has gone (it pours
 * from the top, earliest unfilled piece first). What IS protected is the outcome: if the money has
 * nowhere to land, `overpaymentRefusal` stops the delete and says the figure.
 *
 * ⚠ Under a bulk scope, settled pieces are simply not in `reach` (S1), so "delete this and later"
 * on a series with a settled piece further down removes the unsettled ones around it and leaves the
 * settled one exactly where it is.
 *
 * ⚠⚠ DELETING EVERY PIECE IS REFUSED, not silently allowed. R1 — a commitment with no installment
 * is the old "No schedule" state: absent from the payment schedule, absent from the Overview's next
 * 30 days, $0 on the report, and impossible to record a payment against. Deleting a whole bill is a
 * different action with its own confirmation, and it gives the money back.
 */
export function planScopedInstallmentDelete(
  standing: CommitmentStanding,
  targetId: string,
  scope: EditScope,
): ScopedEditOutcome {
  const target = standing.installments.find(i => i.id === targetId);
  if (!target) {
    return { plan: [], touched: [], rolledForwardTo: [], refusal: 'That payment is not part of this bill.' };
  }
  const reach = new Set(installmentsInScope(standing, targetId, scope).map(i => i.id));
  // One sort, both partitions — `inNumberOrder` copies and sorts, and it was being run twice here.
  const ordered = inNumberOrder(standing);
  const kept = ordered.filter(i => !reach.has(i.id));
  const touched = ordered.filter(i => reach.has(i.id)).map(i => i.installmentNumber);

  if (kept.length === 0) {
    return {
      plan: [], touched, rolledForwardTo: [],
      refusal: 'A bill needs at least one scheduled payment. Delete the whole bill instead — that '
        + 'gives back anything already paid on it.',
    };
  }

  /* ⚠ RENUMBERED CONTIGUOUSLY, because the plan is positional (1..n, no gaps) and the writer diffs
     it by number. The surviving rows keep their order and their money; the row IDENTITIES shift up
     by one, which is precisely how a payment aimed at the deleted piece ends up on the piece that
     replaced it — S7's roll-forward, arrived at by the ordinary rule rather than by a special case. */
  const proposed = kept.map((inst, at) => ({ ...inst, installmentNumber: at + 1 }));
  const { rolledForwardTo, newOver } = consequences(standing, proposed);
  return {
    // ⚠ EACH SURVIVING ROW NAMES ITSELF — see `PlanPiece.id`. Without this the writer matches by
    // position and a non-trailing removal re-points a recorded payment at the wrong piece.
    plan: proposed.map(p => ({ id: p.id, amount: p.amount, dueDate: p.dueDate })),
    touched,
    rolledForwardTo,
    refusal: overpaymentRefusal(standing, newOver),
  };
}

/**
 * The sentence a coach reads before committing a scoped change — S6's "name every installment it
 * touched", said once so the form and the confirmation cannot word it differently.
 *
 * Returns null when there is nothing worth saying: a single-row change with no money moving is the
 * ordinary case and does not need narrating.
 */
export function describeScopedOutcome(outcome: ScopedEditOutcome, verb: 'change' | 'remove'): string | null {
  const { touched, rolledForwardTo } = outcome;
  if (touched.length === 0) return null;
  const list = (ns: number[]) => ns.length === 1
    ? `payment ${ns[0]}`
    : `payments ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`;
  const head = touched.length === 1
    ? `This will ${verb} ${list(touched)}.`
    : `This will ${verb} ${list(touched)} — ${touched.length} payments.`;
  if (rolledForwardTo.length === 0) return head;
  return `${head} Money already recorded re-applies and now counts towards ${list(rolledForwardTo)}.`;
}
