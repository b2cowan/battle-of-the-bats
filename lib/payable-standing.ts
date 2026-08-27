// Where a commitment stands — its plan, the payments recorded against it, and what that adds up to.
// PURE, no I/O, no imports from lib/db.ts, so a confirmation dialog and a phone card can both import
// it (same rule and same reason as `lib/expense-ledger.ts`: the service-role client must never reach
// a client bundle because a dialog needed to do arithmetic).
//
// ⚠⚠ THIS FILE IS THE ONE ANSWER TO "IS IT PAID?" — Payables Rebuild P1, owner-approved 2026-08-19.
// Before it, money going out carried a boolean per half and the deposit/balance pair was the only
// concession to money arriving in pieces. Four defects came out of that in one QA sitting (§27
// passed clean and surfaced them anyway); the plan lists them. The rule that replaces the boolean:
//
//   SETTLED IS NOT STORED. It is what you get when the payments applied to an installment reach its
//   amount. Nothing here reads a `paid_at` flag, because there isn't one — the dues side already
//   learned that lesson (mig 232: `paid_at` is a PROJECTION, never the source), and a flag stored
//   beside a total is how the two start disagreeing.
//
// `memory/coach-money-one-arithmetic.md` applies: a screen that walks the raw records to answer a
// question this module answers is a DEFECT, not a shortcut.

/** One dated piece of the plan. 1..n per commitment, contiguous, renumbered on insert/remove. */
export interface PayableInstallment {
  id: string;
  expenseId: string;
  installmentNumber: number;
  amount: number;
  /** YYYY-MM-DD, the org's day — never a UTC instant (`memory/reference_timezone_date_math_gotcha`). */
  dueDate: string;
}

/** One actual movement of money against a commitment. */
export interface PayablePayment {
  id: string;
  expenseId: string;
  /**
   * The coach's OVERRIDE — "this one was for March". Null for the ordinary case, which is most of
   * them. ⚠ It is a hint to the application rule below, NOT a second source of truth about what is
   * settled: an override that over-fills its target still spills forward, because the alternative
   * is money sitting on an installment that cannot hold it while a later one reads unpaid.
   */
  installmentId: string | null;
  amount: number;
  /** YYYY-MM-DD. Budget vs. Actual → Months files the cost by THIS date, not the due date. */
  paidDate: string;
  method: string | null;
  note: string | null;
  /**
   * The ledger row this payment posted, so an undo reverses by its own entry and never by guessing.
   * ⚠ NULL IS LEGITIMATE AND MEANS TWO DIFFERENT THINGS: an out-of-pocket cost a family paid (no
   * team cash moved, mig 234) or a record settled before mig 236 recorded the link. Callers that
   * reverse money must tell those apart — this module does not, because neither changes the
   * arithmetic of what is owed.
   */
  accountingEntryId: string | null;
  /**
   * The family who paid THIS payment directly — money centralization P4, mig 267.
   *
   * ⚠⚠ NOT THE WHOLE ANSWER ON ITS OWN. A cost may name a fronting family at the COST level
   * (`rep_team_expenses.paid_by_player_id`, mig 234), and then every payment against it is that
   * household's whether or not this column is set. Ask `effectivePayerId()` below; a reader that
   * tests this field alone will report the team as having spent cash a family actually fronted.
   *
   * ⚠ Optional so that the many pure callers constructing payment-shaped objects for arithmetic
   * (previews, tests, the plan editor) do not have to answer a question they are not asking.
   * Absent and null mean the same thing: the payment's own answer is "nobody named".
   */
  paidByPlayerId?: string | null;
}

/**
 * ⚠⚠ WHOSE MONEY ACTUALLY MOVED — the ONE rule, so that eight readers cannot each invent it.
 *
 * A payment's own answer wins; failing that, the cost's. The cost-level column is not a default a
 * coach may contradict — the record form renders it as a stated fact rather than a question (plan
 * §8c.8), so the two can only agree. Reading it this way means the whole-cost mechanism that
 * shipped in mig 234 is exactly the one-household case of the general rule, with no row rewritten
 * and no second arithmetic.
 *
 * Returns null when the team paid, which is the ordinary case and the one worth being cheap.
 */
export function effectivePayerId(
  payment: Pick<PayablePayment, 'paidByPlayerId'>,
  expensePaidByPlayerId: string | null | undefined,
): string | null {
  return payment.paidByPlayerId ?? expensePaidByPlayerId ?? null;
}

/**
 * Did the TEAM's cash move for this payment?
 *
 * ⚠⚠ THE QUESTION USED TO BE ASKED OF THE WHOLE COST, AND THAT IS THE DEFECT P4 HAD TO FIX IN
 * THREE READERS AT ONCE (the register's running balance, the season settlement pot, Budget vs.
 * Actual's cash strip). Before P4 a cost was fronted or it was not, so `!expense.paidByPlayerId`
 * was a complete answer. A commitment can now hold one payment the team paid and one a family
 * fronted, and a reader still asking at cost level reports every dollar of a $600 bill as team
 * cash because the $200 deposit was the only fronted piece — or none of it, because it was.
 */
export function paymentMovedTeamCash(
  payment: Pick<PayablePayment, 'paidByPlayerId'>,
  expensePaidByPlayerId: string | null | undefined,
): boolean {
  return effectivePayerId(payment, expensePaidByPlayerId) === null;
}

/** ⚠ R4 — `partly_paid` counts as UNPAID everywhere a coach filters, schedules or bulk-edits. */
export type InstallmentState = 'settled' | 'partly_paid' | 'unpaid';

export interface AppliedPayment extends PayablePayment {
  /**
   * The number of the FIRST piece this payment actually put money into — what a one-line row naming
   * it says. Null when it landed nowhere, which callers render as the bare description.
   *
   * ⚠⚠ IT IS PER-PAYMENT, AND THAT IS THE WHOLE POINT (`/review`, correctness lens, 2026-08-19).
   * The first version derived this outside the application rule, by finding the first installment in
   * the commitment carrying any money at all — which cannot tell two payments apart. Three untargeted
   * monthly payments correctly applied to pieces 1, 2 and 3 were therefore ALL labelled "installment
   * 1 of 3", on the register and on Budget vs. Actual, breaking the exact reconcile-against-a-bank-
   * statement use the label exists for. Dormant in P1 (every payment it writes names its own piece)
   * and live the moment P2's `Record a payment` lands, which is why it is fixed now.
   *
   * ⚠ WHERE THE MONEY WENT, NOT WHERE THE COACH AIMED IT. A payment targeted at a piece that is
   * already full spills forward, and naming the full piece would be a lie about where the money
   * landed. The override still decides where the pour STARTS, which is what it is for.
   */
  landedOn: number | null;
}

export interface AppliedInstallment extends PayableInstallment {
  /** Money landed on this installment. Never more than `amount` — the excess spills forward. */
  applied: number;
  /** `amount - applied`, floored at zero. */
  remaining: number;
  state: InstallmentState;
}

export interface CommitmentStanding {
  /** ⚠ R2 — the commitment's total is the SUM OF ITS INSTALLMENTS, derived, never separately typed. */
  total: number;
  /** Everything recorded, including anything beyond the total. */
  paid: number;
  /** What is still owed. Floored at zero — an over-payment does not make this negative. */
  remaining: number;
  /** ⚠ R6 — over-payment is ACCEPTED, not refused. Stated so a screen can say "$50 over". */
  over: number;
  /** In due-date order, each carrying what landed on it. */
  installments: AppliedInstallment[];
  /**
   * Every payment recorded against this commitment, oldest first.
   *
   * ⚠ CARRIED RATHER THAN LEFT TO THE CALLER, so a screen that lists what actually moved and a
   * screen that says what is owed are reading ONE object. The register, Budget vs. Actual's
   * cumulative chart and its Months grid all need the individual dated payments — a caller fetching
   * those separately would be a second walk of the same rows, which is the defect
   * `tests/unit/money-one-arithmetic-guard.test.ts` exists to catch.
   */
  payments: AppliedPayment[];
  /** `settled` only when nothing remains. Anything part-way is `partly_paid`. */
  state: InstallmentState;
}

/* Money is compared in CENTS throughout. Two numeric(12,2) values that both round-trip perfectly
   can still fail `a - b === 0` in float, and this module decides whether a coach's bill reads
   "paid" or "$0.00 still owing" — a class of bug that shows up as a penny nobody can clear. */
const cents = (n: number) => Math.round(n * 100);
const dollars = (c: number) => c / 100;

/**
 * Due-date order, then installment number. ⚠ NOT number alone: a coach who moves installment 3 to
 * a date before installment 2 has re-ordered the schedule, and money must apply in the order the
 * payments actually come due, not the order the rows were created.
 */
function inDueOrder(a: PayableInstallment, b: PayableInstallment): number {
  return a.dueDate === b.dueDate
    ? a.installmentNumber - b.installmentNumber
    : (a.dueDate < b.dueDate ? -1 : 1);
}

/** Oldest payment first, id as the tiebreak so the same inputs always produce the same standing. */
function inPaidOrder(a: PayablePayment, b: PayablePayment): number {
  return a.paidDate === b.paidDate ? (a.id < b.id ? -1 : 1) : (a.paidDate < b.paidDate ? -1 : 1);
}

/**
 * ⚠⚠ THE APPLICATION RULE (R3), and the reason payments attach to the COMMITMENT rather than to an
 * installment. A coach handing over one $700 cheque covering a full month and half the next must
 * not be asked to do that arithmetic — so money fills the earliest unfilled installment and spills
 * forward into the next.
 *
 * Two passes, and the order between them is the design:
 *   1. TARGETED payments first, so the coach's explicit "this was for March" wins over the default.
 *   2. Everything else, oldest first.
 *
 * ⚠ It is RE-DERIVED on every read and never stored. That is what lets an installment's amount be
 * edited later without stranding money against a figure that no longer exists — the payments simply
 * re-apply. Persisting a per-installment "paid" figure would put this project back where it started.
 */
export function commitmentStanding(
  installments: readonly PayableInstallment[],
  payments: readonly PayablePayment[],
): CommitmentStanding {
  const ordered = [...installments].sort(inDueOrder);
  const applied = new Map<string, number>(ordered.map(i => [i.id, 0]));
  const capacity = (id: string, amountCents: number) => amountCents - (applied.get(id) ?? 0);

  /**
   * Pour `amountCents` into the installments from `startIndex` onward.
   *
   * ⚠ It deliberately does NOT report the overflow. What would not fit is exactly
   * `paid - total`, derived once below — and two independent ways of arriving at the over-payment
   * figure is precisely how a screen ends up saying "$50 over" beside a total that disagrees.
   *
   * @returns the number of the FIRST piece this pour actually put money into, or null if it fitted
   *   nowhere. That is what a one-line row is named for — see `landedOn`.
   */
  function pourFrom(startIndex: number, amountCents: number): number | null {
    let left = amountCents;
    let first: number | null = null;
    for (let i = startIndex; i < ordered.length && left > 0; i++) {
      const inst = ordered[i];
      const room = capacity(inst.id, cents(inst.amount));
      if (room <= 0) continue;
      const take = Math.min(room, left);
      applied.set(inst.id, (applied.get(inst.id) ?? 0) + take);
      if (first === null) first = inst.installmentNumber;
      left -= take;
    }
    return first;
  }

  /** Where each payment's money first landed, keyed by payment id. */
  const landedOn = new Map<string, number | null>();

  const sorted = [...payments].sort(inPaidOrder);

  // Pass 1 — the coach said where this one goes.
  for (const p of sorted) {
    if (!p.installmentId) continue;
    const at = ordered.findIndex(i => i.id === p.installmentId);
    // A payment whose target has since been deleted is not lost; it falls through to pass 2's
    // ordinary rule rather than vanishing from the total, which would understate what was paid.
    if (at < 0) continue;
    landedOn.set(p.id, pourFrom(at, cents(p.amount)));
  }

  // Pass 2 — everything else, and any targeted payment whose installment is gone.
  for (const p of sorted) {
    const targeted = p.installmentId && ordered.some(i => i.id === p.installmentId);
    if (targeted) continue;
    landedOn.set(p.id, pourFrom(0, cents(p.amount)));
  }

  const totalCents = ordered.reduce((s, i) => s + cents(i.amount), 0);
  const paidCents = sorted.reduce((s, p) => s + cents(p.amount), 0);
  const remainingCents = Math.max(0, totalCents - paidCents);

  const withApplied: AppliedInstallment[] = ordered.map(i => {
    const a = applied.get(i.id) ?? 0;
    const amt = cents(i.amount);
    return {
      ...i,
      applied: dollars(a),
      remaining: dollars(Math.max(0, amt - a)),
      state: a >= amt ? 'settled' : a > 0 ? 'partly_paid' : 'unpaid',
    };
  });

  return {
    total: dollars(totalCents),
    paid: dollars(paidCents),
    remaining: dollars(remainingCents),
    over: dollars(Math.max(0, paidCents - totalCents)),
    installments: withApplied,
    payments: sorted.map(p => ({ ...p, landedOn: landedOn.get(p.id) ?? null })),
    state: remainingCents === 0
      ? 'settled'
      : paidCents > 0 ? 'partly_paid' : 'unpaid',
  };
}

/**
 * What a coach sees in the Status column, and what the Status filter narrows by.
 *
 * ⚠ THE FOUR ARE NOT THE SAME AXIS, which is why this is one function rather than a boolean pair:
 * `overdue` and `outstanding` are both unsettled and differ only by the date, while `partly_paid`
 * cuts across both. The Status dropdown offers all four because a coach genuinely asks all four
 * questions — and because the retired Unpaid/Paid/All pills could not express the middle one at all.
 */
export type PayableRowStatus = 'paid' | 'partly_paid' | 'overdue' | 'outstanding';

/**
 * The ONE word a badge shows — the most urgent thing true of this piece.
 *
 * ⚠ NOT WHAT THE FILTER MATCHES ON. See `installmentStatuses` below: a late part-paid piece is both
 * overdue AND partly paid, and this returns only the first because a badge has room for one word.
 * The screen writes the second half beside it ("13 days overdue · partly paid"), exactly as the
 * payment schedule already did.
 */
export function installmentStatus(inst: AppliedInstallment, today: string): PayableRowStatus {
  if (inst.state === 'settled') return 'paid';
  if (inst.dueDate < today) return 'overdue';
  return inst.state === 'partly_paid' ? 'partly_paid' : 'outstanding';
}

/**
 * ⚠⚠ EVERY WORD TRUE OF THIS PIECE — what the Status dropdown filters and counts on
 * (owner ruling 2026-08-20, Payables Rebuild P3).
 *
 * `partly_paid` CUTS ACROSS the date axis; the other three are mutually exclusive. The header on
 * `PayableRowStatus` said so from the day P1 wrote it, and `installmentStatus` above did not
 * implement it — one bucket per piece. Two consequences, and the second is the one that forced the
 * ruling:
 *
 *   1. Ticking "Partly paid" alone hid every part-paid piece that was ALSO late — the ones a coach
 *      most wants to find.
 *   2. ⚠⚠ THE DEFAULT VIEW LOST MONEY. `PAYABLE_STATUS_DEFAULT` is Outstanding + Overdue. A
 *      part-paid piece not yet due filed as `partly_paid` and nothing else, so it appeared in
 *      NEITHER — a bill the team still owed $250 on was absent from the screen's opening view of
 *      what the team owes. That is R4 ("partly paid counts as unpaid everywhere: filters, bulk
 *      scopes, the schedule, the Overview's next-30 panel") broken in the one place R4 names first.
 *
 * ⚠ COUNTS THEREFORE OVERLAP, deliberately: the four numbers on the dropdown sum to more than the
 * rows on screen, because one piece can be two things. That is ordinary for a multi-select and is
 * how the Transactions filters beside it already behave.
 */
export function installmentStatuses(
  inst: AppliedInstallment,
  today: string,
): readonly PayableRowStatus[] {
  if (inst.state === 'settled') return ['paid'];
  const when: PayableRowStatus = inst.dueDate < today ? 'overdue' : 'outstanding';
  return inst.state === 'partly_paid' ? [when, 'partly_paid'] : [when];
}

export const PAYABLE_STATUS_LABEL: Record<PayableRowStatus, string> = {
  outstanding: 'Outstanding',
  overdue:     'Overdue',
  partly_paid: 'Partly paid',
  paid:        'Paid',
};

/** Dropdown order, and the order the group headers use. Unsettled first — it is what needs doing. */
export const PAYABLE_STATUS_ORDER: readonly PayableRowStatus[] =
  ['outstanding', 'overdue', 'partly_paid', 'paid'] as const;

/**
 * ⚠⚠ THE DEFAULT IS TWO OF FOUR, NOT EMPTY. `MultiSelectDropdown`'s own rule is "empty means all",
 * which here would open the screen on a season of settled history rather than on what is owed.
 * Seeding two keeps the considered default and makes the control read "2 selected" — an honest
 * description of a real narrowing, rather than "All" over a list that is not all.
 * Same call, same reasoning, as the Transactions register's Status default.
 */
export const PAYABLE_STATUS_DEFAULT: readonly PayableRowStatus[] = ['outstanding', 'overdue'] as const;

/**
 * ⚠ S1 — WHICH INSTALLMENTS A BULK SCOPE MAY TOUCH. The load-bearing rule of the whole recurring
 * feature, and the reason a linked series is safe here when the 2026-08-15 plan judged it was not.
 *
 * A bulk scope may NEVER change or delete an installment that is settled in full: that money has
 * already left the account, and a blanket edit re-posting it is the one operation nobody should be
 * offered (the archived plan's §5.1 objection, honoured rather than overruled).
 *
 * ⚠⚠ THIS DOES NOT LOCK A SETTLED INSTALLMENT. "This payment only" still edits one, and the books
 * follow — standing owner ruling 2026-08-16 ("once it is edited the new value should permeate to
 * the books and everything be in sync"), tested by QA §27 Part C, which passed 2026-08-19. Locking
 * it would reverse a live ruling and restore the read-only branches deleted with it.
 *
 * ⚠ R4 again: `partly_paid` IS in scope. Partly paid counts as unpaid.
 */
export type EditScope = 'this' | 'this_and_later' | 'all_unpaid';

/**
 * The three answers a coach is offered, in the order they are offered — the words are the plan's
 * (§4.2) and the descriptions say what each option DOES rather than restating its name.
 *
 * ⚠⚠ A `Record`, NOT AN ARRAY, AND THAT IS THE WHOLE POINT (`/simplify`, 2026-08-20). The scope
 * sheet and the route each hand-typed their own `['this', 'this_and_later', 'all_unpaid']`, and
 * nothing tied either list to `EditScope` — a fourth scope would have compiled cleanly while the
 * screen offered three and the server accepted three DIFFERENT ones. A `Record` keyed by the union
 * **fails the build** when a member is added and not described here, which an array cannot do.
 * Same shape and same reasoning as `PAYABLE_STATUS_LABEL` above.
 */
export const EDIT_SCOPE_COPY: Record<EditScope, { label: string; detail: string }> = {
  this:           { label: 'This payment only',       detail: 'Nothing else on this bill changes.' },
  this_and_later: { label: 'This and later payments', detail: 'Every unpaid payment from this one onwards.' },
  all_unpaid:     { label: 'All unpaid payments',     detail: 'Every payment still owing, earlier ones included.' },
};

/** The offer order. Derived from the copy above, so the two can never list different scopes. */
export const ALL_EDIT_SCOPES = Object.keys(EDIT_SCOPE_COPY) as EditScope[];

export function installmentsInScope(
  standing: CommitmentStanding,
  targetId: string,
  scope: EditScope,
): AppliedInstallment[] {
  const list = standing.installments;
  const target = list.find(i => i.id === targetId);
  if (!target) return [];
  if (scope === 'this') return [target];

  const eligible = list.filter(i => i.state !== 'settled');
  if (scope === 'all_unpaid') return eligible;

  const at = list.indexOf(target);
  const later = list.slice(at).filter(i => i.state !== 'settled');
  // The target itself is included even when settled — the coach picked it, and a scope that
  // silently dropped the row being edited would be the surprise this rule exists to prevent.
  return target.state === 'settled' ? [target, ...later] : later;
}

/**
 * ⚠ S4 — the three-way scope question is only asked when it has more than one answer.
 *
 * On a series where five of six are settled, "this" / "this and later" / "all unpaid" all resolve to
 * the same single row. Asking anyway makes a careful feature feel bureaucratic, and trains coaches
 * to click past a question that DOES matter on the next commitment.
 */
export function scopeChoiceIsMeaningful(standing: CommitmentStanding, targetId: string): boolean {
  const a = installmentsInScope(standing, targetId, 'this').map(i => i.id).join();
  const b = installmentsInScope(standing, targetId, 'this_and_later').map(i => i.id).join();
  const c = installmentsInScope(standing, targetId, 'all_unpaid').map(i => i.id).join();
  return !(a === b && b === c);
}

/**
 * What ONE dated piece of a commitment is called on a screen that lists it beside other records.
 *
 * ⚠⚠ ONE RULE, FOUR SURFACES, AND THAT IS THE ENTIRE REASON IT IS A FUNCTION. The payment schedule,
 * the register, Budget vs. Actual's Scheduled drill-in and its Actuals drill-in all name the same
 * piece of the same commitment, and until P1 they named it three different ways — "— deposit",
 * "— Deposit" (the ledger's own capitalisation) and "— installment 1 of 2". A coach reconciling a
 * bank statement against three screens had to work out that those were one payment.
 *
 * ⚠ A ONE-PIECE COMMITMENT TAKES NO SUFFIX. "Dome rental — installment 1 of 1" is noise: there is
 * nothing to tell it apart from, and every plain expense in the product is now a one-installment
 * commitment (R1), so a suffix here would append six words to most rows on the register.
 */
export function installmentLabel(
  description: string,
  installmentNumber: number,
  installmentCount: number,
): string {
  return installmentCount > 1
    ? `${description} — installment ${installmentNumber} of ${installmentCount}`
    : description;
}

/**
 * What one recorded payment is called on a screen that lists it — the commitment's description,
 * named for the piece the money actually landed on.
 *
 * ⚠ NAMING IS NOT THE APPLICATION RULE. `commitmentStanding()` decides what a payment SETTLES, and
 * a single cheque can settle two pieces; this only decides which piece a one-line description says
 * it was for, which is the EARLIEST piece that cheque put money into.
 *
 * ⚠⚠ IT READS `landedOn`, WHICH IS PER-PAYMENT, and the distinction is the whole reason this is a
 * one-line function rather than a search (`/review`, correctness lens, 2026-08-19). Deriving the
 * number by scanning the commitment for a piece carrying money cannot tell two payments apart, and
 * silently labelled three monthly payments "installment 1 of 3".
 *
 * Falls back to the bare description when the payment landed nowhere — an over-payment on an already
 * settled commitment, or one whose pieces were deleted out from under it — rather than inventing a
 * number for it.
 */
export function paymentLabel(
  description: string,
  payment: Pick<AppliedPayment, 'landedOn'>,
  installmentCount: number,
): string {
  return payment.landedOn === null
    ? description
    : installmentLabel(description, payment.landedOn, installmentCount);
}
