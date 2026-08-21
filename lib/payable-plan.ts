/**
 * Writing a commitment's PLAN — the pure decisions behind every door that edits installments.
 *
 * Payables Rebuild P2. The transitional bridge (`payable-legacy-plan.ts` / `payable-legacy-sync.ts`)
 * derived the plan FROM the deposit/balance columns and died when `Record a payment` made
 * `rep_payable_installments` / `rep_payable_payments` the source of truth. Two of its rules were
 * never about the legacy columns at all and live on here:
 *
 *   · how a desired plan diffs against what is stored (`planInstallmentWrites`), and
 *   · how a payment recorded before mig 236 finds the ledger entry it posted
 *     (`legacyEntryDescriptionsForPayment`).
 *
 * Pure, no I/O — same rule and same reason as `lib/payable-standing.ts`: the decisions are
 * unit-tested once and every caller supplies only its own reads and writes.
 */

/** One piece of the plan a form or an importer wants stored, in order. */
export interface PlanPiece {
  amount: number;
  /** `YYYY-MM-DD`, the org's day. R1 — a dateless piece is not representable. */
  dueDate: string;
  /**
   * ⚠⚠ WHICH STORED ROW THIS *IS* — supply it whenever the caller is editing an EXISTING plan.
   *
   * Without it the plan is matched POSITIONALLY (desired[n] overwrites whatever row currently holds
   * `installment_number = n+1`), and that is only safe while nothing shifts. Remove a non-trailing
   * piece and the rows below slide up: the row that held a settled $200 deposit is rewritten to
   * hold the $400 balance, while the payment recorded against it still points at that same row.
   * The bill then says the balance is paid and the deposit is not — and `paymentRestatements` sees
   * a payment whose amount matches the row's OLD figure and dutifully restates it to the new one,
   * moving the team's books by the difference. Found by three independent review lenses,
   * 2026-08-20, on the phase that first made a non-trailing removal reachable.
   *
   * With it, a removed row is really removed. Its payment's override is released by the FK
   * (`ON DELETE SET NULL`, never CASCADE — the record of money that left the account survives) and
   * the payment re-pours from the earliest unfilled piece, which is exactly what S7 promises and
   * exactly what the confirmation sentence says.
   *
   * Omit it when CREATING, or when a caller genuinely has no stored rows to name (the importer).
   * An id that does not belong to this commitment is ignored and the piece is treated as new.
   */
  id?: string;
}

/**
 * The deposit/balance EDITOR's composition rule: what plan does a two-half form mean?
 *
 * ⚠ A BLANK HALF TAKES THE REMAINDER — the convention this form (and the bulk importer's sheet)
 * has always had: "$600 split $200 / (blank)" means a $400 balance, floored at a cent so a
 * remainder that works out to nothing still buys a row (R1). Each half's missing date falls back
 * to the other's, then to `fallbackDueDate`. ⚠ ONE COPY (`/simplify`, 2026-08-20): the panel and
 * the importer each hand-rolled this, with different fallbacks — the divergence this module's
 * whole header warns about.
 */
export function composeTwoPieceInstallments(opts: {
  total: number;
  depositAmount?: number | null;
  depositDueDate?: string | null;
  balanceAmount?: number | null;
  balanceDueDate?: string | null;
  /** Used only when NEITHER half carries a date — callers that validate a date first never reach it. */
  fallbackDueDate: string;
}): PlanPiece[] {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const given = (v: number | null | undefined): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0;
  const deposit = given(opts.depositAmount)
    ? opts.depositAmount
    : round2(Math.max(opts.total - (given(opts.balanceAmount) ? opts.balanceAmount : 0), 0.01));
  const balance = given(opts.balanceAmount)
    ? opts.balanceAmount
    : round2(Math.max(opts.total - deposit, 0.01));
  return [
    { amount: deposit, dueDate: opts.depositDueDate || opts.balanceDueDate || opts.fallbackDueDate },
    { amount: balance, dueDate: opts.balanceDueDate || opts.depositDueDate || opts.fallbackDueDate },
  ];
}

/** An installment as it is currently stored. */
export interface StoredInstallment {
  id: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
}

export interface InstallmentWrites {
  insert: Array<{ installmentNumber: number; amount: number; dueDate: string }>;
  /** ⚠ `installmentNumber` is present only when the row MOVES (identity mode) — a positional edit
   *  never renumbers, because the row already is the number it is being written to. */
  update: Array<{ id: string; installmentNumber?: number; amount: number; dueDate: string }>;
  /** ⚠ In identity mode: every stored row the desired plan does not name. In positional mode: only
   *  trailing rows nothing has been paid against — see the note in `planInstallmentWrites`. */
  deleteIds: string[];
}

/**
 * What the plan needs, given what is stored.
 *
 * ⚠ A PIECE WITH MONEY ON IT IS NEVER DELETED, even when the desired plan no longer describes it
 * (a coach removing a payable's split). The payment would fall back to the ordinary application rule
 * and a settled half would read as unpaid for reasons nothing on screen explains. Callers that want
 * to REFUSE that save instead (the edit form does) must check before calling; this function's job is
 * only to never lose the piece silently.
 */
export function planInstallmentWrites(
  desired: readonly PlanPiece[],
  stored: readonly StoredInstallment[],
  hasPaymentOn: (installmentId: string) => boolean,
): InstallmentWrites {
  const storedById = new Map(stored.map(i => [i.id, i]));
  /* ⚠⚠ TWO MODES, AND THE CALLER CHOOSES BY SAYING WHAT IT KNOWS. A caller editing an existing plan
     names each surviving row (`PlanPiece.id` — read its note, it is the money defect this closes);
     a caller creating one has no rows to name and falls back to the positional rule, unchanged.
     "Any id at all" decides, because the two producers that edit a plan name every surviving row —
     a partly-named plan would mean a caller half-migrated, and treating it as positional is the
     conservative reading. */
  const byIdentity = desired.some(p => p.id && storedById.has(p.id));
  const writes: InstallmentWrites = { insert: [], update: [], deleteIds: [] };

  if (byIdentity) {
    const claimed = new Set<string>();
    desired.forEach((want, at) => {
      const installmentNumber = at + 1;
      const have = want.id ? storedById.get(want.id) : undefined;
      if (!have || claimed.has(have.id)) {
        // A new row, or an id this commitment does not own — never trusted, simply inserted.
        writes.insert.push({ installmentNumber, amount: want.amount, dueDate: want.dueDate });
        return;
      }
      claimed.add(have.id);
      if (have.installmentNumber !== installmentNumber
        || Math.abs(have.amount - want.amount) > 0.005 || have.dueDate !== want.dueDate) {
        writes.update.push({
          id: have.id, installmentNumber, amount: want.amount, dueDate: want.dueDate,
        });
      }
    });
    /* ⚠ THE ROW THE COACH REMOVED IS THE ROW THAT GOES. A payment aimed at it is NOT a reason to
       keep it: the FK releases the override (`ON DELETE SET NULL`) and the payment re-pours from
       the earliest unfilled piece — S7's roll-forward, arrived at by the ordinary rule. Keeping it
       instead is what let a bill's stored total disagree with its own schedule. */
    for (const have of stored) if (!claimed.has(have.id)) writes.deleteIds.push(have.id);
    return writes;
  }

  const byNumber = new Map(stored.map(i => [i.installmentNumber, i]));
  desired.forEach((want, at) => {
    const installmentNumber = at + 1;
    const have = byNumber.get(installmentNumber);
    if (!have) {
      writes.insert.push({ installmentNumber, amount: want.amount, dueDate: want.dueDate });
      return;
    }
    if (Math.abs(have.amount - want.amount) > 0.005 || have.dueDate !== want.dueDate) {
      writes.update.push({ id: have.id, amount: want.amount, dueDate: want.dueDate });
    }
  });
  for (const have of stored) {
    if (have.installmentNumber <= desired.length) continue;
    /* ⚠ POSITIONAL MODE ONLY. Here the writer cannot tell which row the caller meant, so a row with
       money aimed at it is left alone rather than guessed at. Callers that edit a plan name their
       rows and never reach this branch. */
    if (hasPaymentOn(have.id)) continue;
    writes.deleteIds.push(have.id);
  }
  return writes;
}

/** What a restatement needs to know about a stored payment — a slice of the full row. */
export interface StoredPaymentForRestate {
  id: string;
  amount: number;
  paidDate: string;
  /** The number of the piece the payment is RECORDED AGAINST (`installment_id` resolved), or null. */
  installmentNumber: number | null;
}

export interface PaymentRestatement {
  paymentId: string;
  newAmount?: number;
  newPaidDate?: string;
}

/**
 * ⚖ THE 2026-08-16 RULING, CARRIED ACROSS THE REBUILD: editing a settled figure moves the books.
 * The books are the PAYMENTS now, so "follow" means restating the payment that settled the piece —
 * and only where that is unambiguous:
 *   · ONE payment on the whole record and ONE piece (every plain cost, and any commitment paid in
 *     one go): the payment tracks the new total, and its paid date tracks a date correction.
 *   · a payment RECORDED AGAINST the piece being edited whose amount equals that piece's old
 *     amount (every deposit/balance settled before this rebuild): it tracks the piece.
 * Anything else — several payments, a part payment, money poured across pieces — is left alone:
 * those records say what actually happened, and the standing simply re-reads (a raised total reads
 * partly paid, a lowered one reads over). P4's scope rules take over from there.
 *
 * ⚠ PURE AND EXTRACTED (`/simplify`, altitude lens, 2026-08-20) so P4 can reuse the decision
 * rather than routing every edit back through the one writer that used to inline it — the same
 * shape, for the same reason, as `planInstallmentWrites` above.
 */
export function paymentRestatements(
  desired: readonly PlanPiece[],
  stored: readonly StoredInstallment[],
  payments: readonly StoredPaymentForRestate[],
  paidDateCorrection?: string,
): PaymentRestatement[] {
  const cents = (n: number) => Math.round(n * 100);
  const out: PaymentRestatement[] = [];

  if (payments.length === 1 && stored.length === 1 && desired.length === 1) {
    const p = payments[0];
    const restate: PaymentRestatement = { paymentId: p.id };
    if (cents(p.amount) === cents(stored[0].amount) && cents(desired[0].amount) !== cents(p.amount)) {
      restate.newAmount = desired[0].amount;
    }
    if (paidDateCorrection !== undefined && paidDateCorrection !== p.paidDate) {
      restate.newPaidDate = paidDateCorrection;
    }
    if (restate.newAmount !== undefined || restate.newPaidDate !== undefined) out.push(restate);
    return out;
  }

  /* ⚠⚠ THE PIECE IS FOUND BY IDENTITY WHEN THE CALLER NAMED IT, AND THIS IS A MONEY DEFECT'S FIX,
     not a tidy-up. Matching by POSITION asks "what is at slot n?" — and after a non-trailing removal
     the answer is a different piece. A settled $200 deposit removed from a $200/$400 bill left slot
     1 holding the $400 balance; this function then saw a payment of $200 against a slot whose old
     figure was $200, called it "the payment that settled this piece", and restated it to $400 —
     moving the team's books by $200 under a sentence that said a row was being removed. With ids,
     the surviving row is matched to itself, its amount has not changed, and nothing is restated.
     Callers that create a plan name nothing and keep the positional rule, which is correct for
     them: nothing has shifted. */
  const storedById = new Map(stored.map(i => [i.id, i]));
  const byIdentity = desired.some(p => p.id && storedById.has(p.id));

  desired.forEach((want, at) => {
    const have = byIdentity
      ? (want.id ? storedById.get(want.id) : undefined)
      : stored.find(i => i.installmentNumber === at + 1);
    if (!have || cents(want.amount) === cents(have.amount)) return;
    // The payment recorded AGAINST this very piece — by its id in identity mode, by the slot's
    // number otherwise (where the slot and the piece are the same thing).
    const targeted = byIdentity
      ? payments.filter(p => p.installmentNumber === have.installmentNumber)
      : payments.filter(p => p.installmentNumber === at + 1);
    if (targeted.length !== 1 || cents(targeted[0].amount) !== cents(have.amount)) return;
    out.push({ paymentId: targeted[0].id, newAmount: want.amount });
  });
  return out;
}

/**
 * The descriptions a payment's ledger entry could have been posted under, for a payment recorded
 * BEFORE migration 236 stored the link.
 *
 * ⚠ THE HALF DECIDED THE SUFFIX. The old settle door posted a payable's first piece as
 * "X — Deposit" and its second as "X — Balance", while a plain cost — and a payable settled through
 * the wrong door before 2026-08-16 — posted the bare description. Which one a stored payment came
 * from is read off the row itself: its `source` (the migration and the bridge both recorded it) and
 * the piece it was recorded against.
 *
 * ⚠ CANDIDATES, NOT AN ANSWER. The caller matches each against the ledger and must refuse an
 * ambiguous result rather than voiding a guess — the same rule the delete path has always had.
 */
export function legacyEntryDescriptionsForPayment(opts: {
  expenseType: 'expense' | 'tournament_payable' | string;
  description: string;
  /** The payment row's own `source` column. */
  source: string | null;
  /** The number of the installment the payment is recorded against, if any. */
  installmentNumber: number | null;
}): string[] {
  const { expenseType, description, source, installmentNumber } = opts;
  if (expenseType !== 'tournament_payable') return [description];
  // A payable settled through `markExpensePaid` before that hole closed posted the bare description.
  if (source === 'migration_255_wrong_door' || source === 'legacy_wrong_door') return [description];
  if (installmentNumber === 1 || source === 'legacy_deposit') return [`${description} — Deposit`];
  if (installmentNumber === 2 || source === 'legacy_balance') return [`${description} — Balance`];
  // Nothing pins the half down — offer every description the old doors ever wrote. The caller's
  // ambiguity refusal is what keeps this safe: two candidates that BOTH match is a refusal, not a pick.
  return [`${description} — Deposit`, `${description} — Balance`, description];
}
