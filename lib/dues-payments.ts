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

/**
 * ⚠⚠ A FAMILY'S OWN MONEY IS NOT A CREDIT TO THEM (owner ruling 2026-09-06, QA §146 · D6).
 *
 * When a family sends more than their bill, the excess is auto-converted to a credit (owner ruling
 * 2026-08-13, no prompt) and the dues-facing `Paid` figure is capped at the schedule total so the
 * same dollars are not counted as paid AND as a credit. That cap is correct and stays. What it left
 * behind is a WORD problem the owner found by reading one row:
 *
 *   Avery   Total Dues $700.00 · Credits ($1,128.15) · Paid $700.00 · Balance ($1,128.15)
 *
 * Avery had sent **$1,250.00**. The row said $700, and the $1,128.15 beside it was three unrelated
 * things added together — $550.00 of Avery's own overpayment, $380.00 the club owes them for team
 * costs they paid out of pocket, and $198.15 they raised. Those call for three different actions,
 * and a family asking *"how much of my own money are you holding?"* could not be answered.
 *
 * So `Credits` comes to mean MONEY FROM SOMEONE OTHER THAN THIS FAMILY, and `Paid` shows what the
 * family actually sent.
 *
 * ⚠⚠ THE BALANCE MUST NOT MOVE, AND HERE IT CANNOT — the two returned figures always sum to
 * `cappedPaid + netCredits`, which is exactly what every balance in the product already subtracts.
 * This is a RE-SPLIT of one total, never a re-derivation, and that is deliberate: a coach has acted
 * on those balances, and a redesign that quietly moved them would be a different (and much worse)
 * change. Do not "simplify" this into two independent sums.
 *
 * ⚠ ONLY THE OVERPAYMENT THAT IS STILL STANDING MOVES. A credit handed back in cash has already
 * stopped reducing what the family owes (`netCredits` nets payouts off — a /review finding,
 * 2026-08-14), so an overpayment that was refunded must not be re-counted as money they paid.
 * Missing this is not hypothetical: it made two figures wrong in the QA §146 mockup and would have
 * chased two families for money they do not owe.
 *
 * ⚠ BOTH HALVES OR NEITHER. Uncapping `Paid` while the overpayment is still inside `Credits` counts
 * it twice — the exact double-count the cap exists to prevent. They ship together.
 */
export function splitFamilyOwnMoney(input: {
  /** `Paid` as the dues surfaces compute it today: payments capped at the schedule total. */
  cappedPaid: number;
  /** `Credits` as the dues surfaces compute it today: issued less anything handed back. */
  netCredits: number;
  /** Credits of type `overpayment` ISSUED to this player this season. */
  overpaymentCredits: number;
  /** Everything handed back to this player in cash this season. */
  paidOut: number;
}): {
  /** What this family has actually paid — their capped figure plus their own money back out of credits. */
  paid: number;
  /** What OTHER people covered: fundraising, sponsorship, reimbursement, contribution. */
  credits: number;
  /** The family's own money still sitting in the team's hands. Drives the "Overpaid" wording. */
  ownMoneyHeld: number;
} {
  const cappedPaid = toCents(input.cappedPaid);
  const netCredits = toCents(input.netCredits);
  /* ⚠⚠ A REFUND LANDS AGAINST THE FAMILY'S OWN MONEY FIRST, AND THAT IS A CHOICE, NOT A FACT.
     A payout record carries no link to the credit it refunded — the schema has no such column — so
     when a family holds BOTH a standing overpayment and other credits, nothing in the data says
     which one the coach handed back. Something has to be assumed, and the assumption is visible
     here rather than buried.

     WHY THIS WAY. The case that actually occurs is the designed one: an overpayment is
     auto-converted to a credit (owner ruling 2026-08-13) and later handed back in cash. Assuming
     the refund drains their own money first makes that case exactly right — the family stops being
     shown as overpaid the moment they are repaid. The opposite assumption would keep telling a
     coach the team was holding money it had already returned, which is the worse failure: it
     invites paying the same family twice.

     WHAT IT COSTS. If a coach refunds a SPONSOR's credit while an overpayment also stands, this
     understates the family's own money held by the refunded amount. The balance is unaffected
     either way — only the split between the two columns moves — and the family is still shown as
     owed at least what they are owed, never more.

     ⚠ IF A PAYOUT EVER GAINS A LINK TO ITS CREDIT, delete this assumption and read the link. Until
     then, do not "improve" the allocation order without re-reading the paragraph above: the other
     order is not more correct, it is wrong about the common case instead of the rare one.

     Clamped to what the credit column actually still holds, so a player whose payouts exceed their
     credits (possible after a schedule change) can never move more than there is. */
  const standing = Math.min(
    Math.max(0, toCents(input.overpaymentCredits) - toCents(input.paidOut)),
    Math.max(0, netCredits),
  );
  return {
    paid: toDollars(cappedPaid + standing),
    credits: toDollars(netCredits - standing),
    ownMoneyHeld: toDollars(standing),
  };
}


/**
 * THE DUES LADDER (owner ruling 2026-09-07, out of the QA §148 walk) — one family's season as five
 * figures that read left to right and land on the balance they already had:
 *
 *     Dues − Fundraising − Other credits − Paid + Handed back = Balance
 *
 * It replaces `Total dues · After fundraising · Paid · Left to send`, whose second figure answered a
 * question about a BILL while appearing to answer one about fundraising: Avery raised $198.15 and
 * her "After fundraising" read $700.00 against a $700.00 bill, because her cash had already settled
 * every instalment and there was no bill left for the fundraising to reduce. Correct, and a lie. It
 * hit every family who pays promptly, not just the overpaid ones.
 *
 * ⚠⚠ EVERY FIGURE HERE IS GROSS, AND THAT IS THE POINT. The product nets payouts away silently
 * inside `Credits` and `Paid` — invisible while one column holds everything, and a lie the moment
 * the columns are named:
 *   · Blake raised $150.00 on the Bottle Drive and took $100.00 back. A column headed FUNDRAISING
 *     would say $50.00 while the fundraiser screen says $150.00.
 *   · Casey sent $1,200.00 and the screen says `Paid $900.00` — contradicting §148's own ruling that
 *     Paid shows what the family actually sent.
 * Which credit a payout consumes is arbitrary too (oldest-first, so Blake's landed on the rebate
 * purely by date). Gross figures plus a `handedBack` of its own remove the guesswork from every
 * number a coach reads.
 *
 * ⚠⚠ THE BALANCE IS NOT RECOMPUTED FROM THESE — it stays exactly what it is today, and the ladder
 * equals it BY CONSTRUCTION. Same discipline as `splitFamilyOwnMoney` above: a RE-SPLIT of one
 * total, never a re-derivation. Coaches have chased families on those balances; a redesign that
 * quietly moved one would be a different and much worse change. The identity, for the record:
 *
 *     dues − F − (issued − F − own) − gross + paidOut
 *   = dues − issued + own − gross + paidOut          [own = gross − capped, the engine's invariant]
 *   = dues − (issued − paidOut) − capped
 *   = dues − netCredits − cappedPaid                  ← today's balance, unchanged
 */
/** The five figures the table and drawer read left to right, plus the own-money amount that
 *  explains why `otherCredits` is smaller than the credits a family holds. ONE shape, imported by
 *  every producer and reader — three inline copies of it drifted within a day of each other. */
export interface DuesLadder {
  /**
   * What this family is billed — **net of anything written off it** when the caller supplies
   * `billLowered` (owner R1, 2026-09-09).
   *
   * ⚠⚠ AND THAT MAKES THIS FIELD MEAN TWO THINGS DEPENDING ON WHO BUILT IT (/review, 2026-09-09).
   * The Player Dues route passes `billLowered`, so its ladders are NET; `getRepPlayerDuesSummary`
   * in `lib/db.ts` does not, so the roster player page's ladders are GROSS. Nothing renders the
   * difference today — that page shows its own `totalAssessed` and reads only the other four
   * figures — which is precisely why this note exists rather than a fix: **wire this field into a
   * new screen and you inherit whichever meaning your endpoint happens to carry.** Pass
   * `billLowered` from any caller whose figure sits beside the dues band or its total row.
   */
  dues: number;
  fundraising: number;
  otherCredits: number;
  paid: number;
  handedBack: number;
  /** Overpayment-credit dollars the family's own payments stand behind — folded INTO `paid`, and
   *  therefore the dollars the drawer must NOT print under its credit sections. An AMOUNT, never a
   *  row predicate: see the drawer's `hiddenOwnMoneyIds` for why that distinction cost a defect. */
  ownMoney: number;
}

export function splitDuesLadder(input: {
  /** The schedule total — what this family was billed. */
  dues: number;
  /** Every payment RECORD, summed. Not capped, not netted: what the family sent. */
  grossPayments: number;
  /** `Paid` as the surfaces computed it before the ladder — payments capped at the schedule. */
  cappedPaid: number;
  /** Every credit ISSUED this season, summed — gross, before any payout. */
  creditsIssued: number;
  /** Credits issued of type `fundraiser`. Sponsorships are stored as this type and belong here. */
  fundraiserIssued: number;
  /** Credits issued of type `overpayment` — ALL of them, however born. ⚠ NOT a narrowed set: the
   *  clamp below is what decides how many of these dollars are the family's own, and it decides by
   *  ARITHMETIC (does the excess of payments over the bill stand behind them?), never by whether a
   *  row carries a link. Umar's $50 overpayment credit has no payment link — it predates linking —
   *  and his family really did send $50 over; a link-based rule filed it as coach-typed and the
   *  ladder came out $50 wrong. Pass everything; let the clamp choose. */
  overpaymentIssued: number;
  /** Everything handed back to this family in cash — `rep_dues_payouts`. */
  paidOut: number;
  /**
   * What has been written off this family's bill with no money behind it — a forgiven balance or a
   * typed **Adjustment**, standing (owner R1, 2026-09-09: "a bill lowered is not a collection").
   *
   * ⚠⚠ IT COMES OFF **BOTH** `dues` AND `otherCredits`, WHICH IS WHY THE ROW STILL CLOSES. A
   * write-off used to sit in the credits column, so the row read as though someone had covered part
   * of the bill. It is not a credit anyone paid; it is a smaller bill. Subtracting the SAME figure
   * from both sides moves it without touching the balance:
   *
   *     (dues − L) − fundraising − (otherCredits − L) − paid + handedBack  ≡  balance
   *
   * ⚠ SUBTRACT IT FROM `dues` ALONE AND EVERY AFFECTED FAMILY'S BALANCE MOVES BY `L`. That is the
   * single way this ruling can be got wrong, and it is why the two subtractions are written on one
   * line rather than left to two callers.
   *
   * ⚠ STANDING, NOT ISSUED — the same figure the band's `Dues` tile uses, so the column total and
   * the tile above it are one number. A write-off partly handed back in cash keeps its returned
   * half in `otherCredits`, where `handedBack` cancels it exactly. `otherCredits` cannot go
   * negative: a write-off is by definition part of it.
   */
  billLowered?: number;
}): DuesLadder {
  const grossC = toCents(input.grossPayments);
  /* ⚠ CLAMPED, NOT JUST `overpaymentIssued`, AND THE CLAMP IS LOAD-BEARING. A coach can add a credit
     by hand and pick `Overpayment` as its kind (see MANUAL_CREDIT_TYPES) — that credit has no
     payment behind it, so subtracting the raw overpayment total would push the ladder's balance
     ABOVE the real one by its amount. Clamping to the excess the payments actually carry drops the
     hand-typed remainder into `otherCredits`, which is honest: it is a credit a coach asserted, not
     money the family sent. Both cases tie. */
  const ownC = Math.min(
    toCents(input.overpaymentIssued),
    Math.max(0, grossC - toCents(input.cappedPaid)),
  );
  const fundraisingC = toCents(input.fundraiserIssued);
  /* Clamped to the credits actually there, so a caller passing a stale figure can never drive
     `otherCredits` negative or lift `dues` above what was billed. */
  const loweredC = Math.min(
    Math.max(0, toCents(input.billLowered ?? 0)),
    Math.max(0, toCents(input.creditsIssued) - fundraisingC - ownC),
  );
  return {
    dues: toDollars(toCents(input.dues) - loweredC),
    fundraising: toDollars(fundraisingC),
    // ≥ 0 by construction: `own` can never exceed the overpayment credits inside `creditsIssued`.
    otherCredits: toDollars(toCents(input.creditsIssued) - fundraisingC - ownC - loweredC),
    paid: toDollars(grossC),
    handedBack: toDollars(toCents(input.paidOut)),
    ownMoney: toDollars(ownC),
  };
}

/** A roster's ladder, column by column, plus the balance those columns close on and the head
 *  count they cover — the Season-totals footer, and the same row at the foot of the export. */
export interface DuesLadderTotals extends DuesLadder {
  /** The sum of the rows' OWN balances, never re-derived from the five figures beside it. */
  balance: number;
  players: number;
}

/**
 * THE LADDER, TOTALLED (owner ruling 2026-09-07, out of the QA §151 walk).
 *
 * ⚠⚠ THIS IS A PROOF LINE, NOT A SUMMARY — and the distinction decides everything about it. The
 * tab's summary is the band at the top, which answers a coach's questions (what has SETTLED, what
 * is still to CHASE) and deliberately does NOT equal these columns: Collected is capped at the
 * bill where Paid is gross, and Balance owing counts only the families who owe where Balance is
 * the net close. This row answers one narrower thing — does the roster add up the way every row
 * does? `splitDuesLadder` guarantees `dues − fundraising − otherCredits − paid + handedBack =
 * balance` per player, and because that is plain arithmetic it survives summation, so a footer
 * built from this helper ties by construction on any roster and cannot be talked out of it by a
 * filter.
 *
 * ⚠ `balance` IS SUMMED, NOT RECOMPUTED, for the same reason `splitDuesLadder` re-splits rather
 * than re-derives: the balances on this screen are what coaches have chased families on. Summing
 * them means the footer can only ever be wrong about itself, never about a row.
 *
 * ⚠ CENTS, LIKE EVERYTHING IN THIS FILE. Twelve float additions across six columns is exactly the
 * shape that lands a footer a cent away from the column it totals — visible, unexplainable, and
 * the kind of defect that costs a treasurer an afternoon.
 */
export function duesLadderTotals(
  rows: readonly { ladder: DuesLadder; balance: number }[],
): DuesLadderTotals {
  let dues = 0, fundraising = 0, otherCredits = 0, paid = 0, handedBack = 0, ownMoney = 0, balance = 0;
  for (const r of rows) {
    dues += toCents(r.ladder.dues);
    fundraising += toCents(r.ladder.fundraising);
    otherCredits += toCents(r.ladder.otherCredits);
    paid += toCents(r.ladder.paid);
    handedBack += toCents(r.ladder.handedBack);
    ownMoney += toCents(r.ladder.ownMoney);
    balance += toCents(r.balance);
  }
  return {
    dues: toDollars(dues),
    fundraising: toDollars(fundraising),
    otherCredits: toDollars(otherCredits),
    paid: toDollars(paid),
    handedBack: toDollars(handedBack),
    ownMoney: toDollars(ownMoney),
    balance: toDollars(balance),
    players: rows.length,
  };
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
   *  coach-typed overpayment credit is counted but never written into.
   *  ⚠ ALSO SET WITH `create: 0` (QA §148, 2026-09-06): every pass folds leftover engine rows,
   *  not just the ones that create a credit, so `topUp` alone is real work. Whenever it is set
   *  it states the row's WHOLE new amount and subsumes `trim`. */
  topUp: { id: string; newAmount: number } | null;
  /** Credit ids to delete, in order (newest first) — the ones a reduction swallows whole, plus
   *  any engine rows a fold has emptied into `topUp`'s host. */
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

  /* ⚠⚠ THE MERGE IS NOT THE GROW PATH'S PRIVILEGE (owner, QA §148 walk 2026-09-06). Consolidation
     used to run only where a NEW credit was created, which made repair ONE-DIRECTIONAL: a family
     already carrying two engine rows kept them through every reduction and every no-op, and only a
     RISE in their overpayment ever collapsed the pair. Avery carried $58.33 + $491.67 for nine days
     — two meaningless halves of one true $550.00, neither of which tied to any figure on any
     screen, while the sum tied exactly to payments minus schedule on the SAME screen. Every pass
     now leaves exactly one engine row, so the one-row rule holds going forward AND heals the rows
     written before it existed. `reduced` is untouched: a fold moves dollars between rows, it never
     removes any. */
  const survivors = opts?.consolidate
    ? overpayment.filter(c => c.consolidatable && !remove.includes(c.id))
    : [];
  if (survivors.length > 1) {
    // ⚠ The TRIMMED row folds at its NEW amount. Folding the stale figure would hand back the
    // dollars the reduction has just taken off it — the double-count this whole engine exists to
    // prevent, re-created by the repair.
    const survivingC = survivors.reduce(
      (s, c) => s + (trim && trim.id === c.id ? toCents(trim.amount) : toCents(c.amount)), 0,
    );
    for (const c of survivors.slice(1)) remove.push(c.id);
    /* ⚠⚠ THE TRIM IS SUBSUMED ONLY WHEN IT LANDED ON A SURVIVOR (review 2026-09-07, Critical). The
       first cut nulled it unconditionally. But the shrink walks NEWEST first, and the newest
       overpayment row can be a coach-typed one — not consolidatable, so never a survivor. Trim
       that row, then fold two older engine rows beneath it, and the trim vanished: nothing in
       `remove`, nothing in `topUp`, so the executor never wrote it. The row kept its stale amount,
       the family's credits stayed overstated by exactly that trim, and `reduced` reported a
       reduction that never happened. A trim on the host IS folded into `survivingC` above and must
       not be written twice; a trim on any other row is a separate write and stays. */
    const trimOnHost = trim !== null && survivors.some(c => c.id === trim!.id);
    return { create: 0, topUp: { id: survivors[0].id, newAmount: toDollars(survivingC) }, remove, trim: trimOnHost ? null : trim, reduced };
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
