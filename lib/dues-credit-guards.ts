/**
 * The payout floor — the ONE rule every door that shrinks a family's credits must ask first.
 *
 * A credit is money the team owes a family (lib/dues-credits.ts). Once part of it has been HANDED
 * BACK IN CASH (rep_dues_payouts), the credits that remain must still cover what went out —
 * otherwise the family holds cash the books no longer say they were owed, and at season's end the
 * missing credit silently inflates everyone else's share of the pool (mig 234, /review
 * 2026-08-14).
 *
 * Six doors shrink credits today, and all six must speak this file's sentence:
 *   1. Editing a coach-authored credit down  (players/[playerId]/dues-credits/[creditId] PATCH)
 *   2. Deleting a coach-authored credit      (same route, DELETE)
 *   3. Editing a SPONSOR — amount down, family changed/removed, or flipped back to a pledge
 *      (fundraisers/[fundraiserId] PATCH → applySponsorMoney). ⚠ This door shipped 2026-08-15
 *      WITHOUT the floor and carried it silently for two weeks; the general credit route refuses
 *      sponsor credits with "edit it there" specifically so the sponsor route can be the one safe
 *      editor — which it is only while it calls this guard.
 *   4. REMOVING a drive's per-player entry   (fundraisers/[fundraiserId]/entries/[entryId] DELETE)
 *      ⚠ Added with the guarded deletes (2026-08-30). It is the ONLY door that unwinds a drive
 *      entry — the general credit route refuses a credit carrying `fundraiser_entry_id` and sends
 *      the coach here — so if it ever stops asking, nothing else is left to ask on its behalf.
 *   5. RAISING a player's dues total          (the per-player schedule POST — /dues)
 *   6. The roster-wide dues re-run            (budget-plan/generate-installments POST)
 *      ⚠ 5 and 6 added QA §123 Phase A2. Neither route touches a credit row itself — the
 *      reconcile they trigger does, deleting the overpayment credit a payout may be standing on.
 *      `projectScheduleTotalChange` below is their projection, asked PRE-FLIGHT (before the
 *      upsert): a guard that refuses after an irreversible write strands the record forever.
 *      The bulk door asks PER FAMILY and refuses only the families it cannot safely write.
 *
 * ⚠ PURE ON PURPOSE. No next/server import — the violation is returned as data and each route
 * wraps it in its own 409, so this file stays unit-testable and importable from anywhere. The
 * epsilon, the refusal code and the sentence live here ONCE; two doors already diverged into
 * hand copies before this file existed.
 */
import { amountsTotal, payoutCeiling } from './dues-credits';
import { strandedExcess } from './dues-payments';

/** The 409 code every payout-floor refusal carries — clients may branch on it. */
export const CREDIT_HAS_PAYOUT = 'CREDIT_HAS_PAYOUT';

/**
 * ⚠⚠ THE WRITE-OFF INVARIANT: write-offs never exceed the bill, from EITHER door.
 *
 * An Adjustment (`credit_type 'other'`) is the one credit a coach may type by hand with NO record
 * behind it (lib/dues-credits.ts header), so a hand-typed number must never become "the team owes
 * this family cash nobody sent." That goal was set 2026-09-11 and it stands. The formula chosen for
 * it that day — what the bills still OWED (`leftToSend`), and a hard $0 on `keep_separate` — was the
 * wrong quantity, and the owner corrected it 2026-09-12: *"the adjustment is to the total dues, so
 * we shouldn't be able to total adjustments more than the total dues … regardless of how much they
 * have paid."* An Adjustment lowers the BILL (the Dues figure subtracts standing write-offs in every
 * mode — `splitDuesLadder` / `duesActual` take no mode at all), so its ceiling is the bill:
 *
 *     ceiling = Σ installments − standing write-offs already on this bill (`other` + `forgiven`)
 *
 * Payments and money-backed credits (fundraiser, sponsor, reimbursement) do not enter into it. A
 * $900 bill can be written down by $900 whether the family has paid $0, $500 or $900 — the write-off
 * lands on what is still owed first (applyCreditsToBills) and only the leftover flows to `owedBack`,
 * which is ≤ what the family sent BECAUSE the bill cannot go below zero. That is what closes the
 * invented-money hole, not a payments bound.
 *
 * ⚠ THE SAME INVARIANT FROM THE OTHER SIDE (`writeOffCeilingViolation` below). The bill can move
 * after a write-off is recorded — the per-player schedule editor and the roster-wide re-run both
 * rewrite installments — and lowering it beneath its standing write-offs breaks the same rule: the
 * drawer printed "Dues −$300.00" and the excess Adjustment became payable through the Pay out sheet.
 * That was reachable under the 09-11 rule (record ≤ what's owed, then lower the schedule) and
 * nothing asked. Both schedule doors now ask this file's sentence PRE-FLIGHT, exactly as they already
 * ask the payout floor before a raise. Two guards, one inequality; every door that moves either
 * side asks.
 */

/** The write-offs standing against a bill — the credits that lower it rather than pay it. */
/* A NaN amount would sail through Math.max and make every `amount > ceiling` comparison false —
   a guard that fails OPEN on one malformed row (/review 2026-09-12). Same defence the credit
   engine gives `paidOut`. */
const cents = (n: number) => (Number.isFinite(n) ? Math.round(n * 100) : 0);

export function standingWriteOffs(credits: readonly { amount: number; creditType: string }[]): number {
  return credits
    .filter(c => c.creditType === 'other' || c.creditType === 'forgiven')
    .reduce((s, c) => s + cents(c.amount), 0) / 100;
}

export function adjustmentCeiling(opts: {
  installments: readonly { amount: number }[];
  /** The player's OTHER credits — exclude the one being edited so it is judged against the room
   *  it would have if it did not yet exist. */
  credits: readonly { amount: number; creditType: string }[];
}): number {
  const billC = opts.installments.reduce((s, i) => s + cents(i.amount), 0);
  const writtenOffC = Math.round(standingWriteOffs(opts.credits) * 100);
  return Math.max(0, billC - writtenOffC) / 100;
}

/** The 400 code an Adjustment-ceiling refusal carries — clients may branch on it. */
export const ADJUSTMENT_EXCEEDS_CEILING = 'ADJUSTMENT_EXCEEDS_CEILING';

/** The one sentence, stated once — mirrors `payoutFloorMessage`'s house style. */
export function adjustmentCeilingMessage(ceiling: number): string {
  if (ceiling <= 0.005) return 'This bill has already been written off in full — there’s nothing left to lower.';
  return `An Adjustment can’t lower this bill by more than what’s left of it — $${ceiling.toFixed(2)}.`;
}

/** @returns the ceiling when `amount` exceeds it, or null when the amount is safe. */
export function adjustmentCeilingViolation(
  amount: number,
  ceilingInputs: {
    installments: readonly { amount: number }[];
    credits: readonly { amount: number; creditType: string }[];
  },
): { ceiling: number } | null {
  const ceiling = adjustmentCeiling(ceilingInputs);
  return amount > ceiling + 0.005 ? { ceiling } : null;
}

/** The 409 code a schedule-lowering refusal carries — clients may branch on it. */
export const WRITE_OFFS_EXCEED_BILL = 'WRITE_OFFS_EXCEED_BILL';

/**
 * Would this new schedule total sit BELOW the write-offs already standing against the bill?
 * Asked pre-flight by every door that rewrites a player's installments. A RAISE can never trip it.
 *
 * @returns `{ writtenOff }` when the schedule must be refused, or null when it is safe.
 */
export function writeOffCeilingViolation(
  newScheduleTotal: number,
  credits: readonly { amount: number; creditType: string }[],
): { writtenOff: number } | null {
  const writtenOff = standingWriteOffs(credits);
  return writtenOff > newScheduleTotal + 0.005 ? { writtenOff } : null;
}

/** The one sentence, stated once. Names the figure and the door that fixes it. */
export function writeOffCeilingMessage(writtenOff: number, newScheduleTotal: number): string {
  return `This family has $${writtenOff.toFixed(2)} written off — a $${newScheduleTotal.toFixed(2)} bill would be less than that. Lower or remove the adjustment first.`;
}

/** The one sentence, stated once. `action` reads like "lowering this credit". */
export function payoutFloorMessage(paidOut: number, action: string): string {
  /* Owner wording, 2026-09-01 (option A of four): "more than they were EVER OWED" states the
     aggregate rule exactly — the floor never matches a payout to one record, it protects the
     family's whole balance. Replaced "would leave the books owing them less than they have
     received", which read backwards to the owner on the live screen. ONE sentence, every door. */
  return `The team has already paid $${paidOut.toFixed(2)} back to this family — ${action} would make that more than they were ever owed. Remove the payout first.`;
}

/**
 * Would this projected credit set break the floor?
 *
 * `projected` is the family's credit set as it WOULD be after the change — filtered for a
 * delete, amount-substituted for an edit. Carries `creditType` because the ceiling EXCLUDES
 * forgiveness — a forgiven balance was never the family's money to be handed back; narrowing to
 * `{ amount }` would let a forgiveness count toward what the team may pay out.
 *
 * @returns `{ paidOut }` when the change must be refused, or null when it is safe.
 */
export function payoutFloorViolation(
  projected: readonly { amount: number; creditType: string }[],
  payouts: readonly { amount: number }[],
): { paidOut: number } | null {
  const paidOut = amountsTotal(payouts);
  if (paidOut <= payoutCeiling(projected, []) + 0.005) return null;
  return { paidOut };
}

/**
 * ⚠⚠ THE SEVENTH THING A DOOR MUST ASK, SINCE MIGRATION 281 — has THIS credit been paid back?
 *
 * The guard above is a FAMILY-LEVEL sum, and that was enough while nothing recorded which credit a
 * payback settled. It is not enough now, and a review caught the gap before it shipped: a family
 * holding credit A ($50, paid back and LINKED) and credit B ($50, untouched) passes the aggregate
 * test when A is deleted — B still covers the $50 that went out — and then the database refuses the
 * delete outright, because a link still points at A. The coach got a raw constraint error where the
 * migration's own comment promised them a sentence.
 *
 * ⚠ IT IS DETERMINISTIC, NOT A RACE. Any family with a linked credit that is not their "last
 * dollar" reproduces it.
 *
 * ⚠ ASK THIS *AND* THE AGGREGATE GUARD. They refuse different things: this one says "that specific
 * money has already gone back", the other says "the family would be left holding cash the books no
 * longer owe them". Neither implies the other.
 */
export function creditIsPaidBack(paidBackAmount: number | undefined): { paidOut: number } | null {
  return paidBackAmount !== undefined && paidBackAmount > 0.005 ? { paidOut: paidBackAmount } : null;
}

/**
 * How much of ONE credit is already spoken for by payouts — the dollars that would be stranded
 * if it vanished. 0 when the family's OTHER credits alone still cover everything paid out.
 * Feeds the screens that warn before the guard refuses (the sponsor sheet's pledge-flip hint).
 */
export function creditExposure(
  credit: { id: string; amount: number },
  familyCredits: readonly { id: string; amount: number; creditType: string }[],
  payouts: readonly { amount: number }[],
): number {
  const others = familyCredits.filter(c => c.id !== credit.id);
  const paidOut = amountsTotal(payouts);
  const coveredWithout = payoutCeiling(others, []);
  const overhang = Math.round(Math.max(0, paidOut - coveredWithout) * 100) / 100;
  return Math.min(overhang, Math.round(credit.amount * 100) / 100);
}

/**
 * The sponsor edit's projection: given what the edit WOULD make true, how does the existing
 * sponsor credit fare, and what is the coach's act called?
 *
 * @returns null when the change can only keep or grow the credit on the same family — no floor
 * question exists. Otherwise the projected credit set for the CURRENT credit's family plus the
 * action word the refusal sentence uses. (A credit moving to a DIFFERENT family is a removal
 * from this one's set — the receiving family's ceiling can only rise, so only the losing side
 * is asked.)
 */
/**
 * The schedule change's projection (QA §123 Phase A2): what a player's credit set WOULD be after
 * their dues total moves, computable pre-flight from three facts the routes already hold.
 *
 * After the write, the reconcile (planOverpaymentReconcile) makes the player's total
 * `overpayment` credit equal `strandedExcess(paymentsTotal, newScheduleTotal, 0)` — so the
 * projected set is the family's NON-overpayment credits plus one overpayment credit of exactly
 * that value. Hand the result to `payoutFloorViolation` with the family's payouts; the action
 * word for the refusal sentence is "raising this player's dues total" (a LOWER total only grows
 * the credit, so only a rise can reach the floor).
 */
export function projectScheduleTotalChange(args: {
  /** The family's full credit set as it stands. */
  familyCredits: readonly { amount: number; creditType: string }[];
  paymentsTotal: number;
  newScheduleTotal: number;
}): { amount: number; creditType: string }[] {
  const { familyCredits, paymentsTotal, newScheduleTotal } = args;
  const projected = familyCredits.filter(c => c.creditType !== 'overpayment')
    .map(c => ({ amount: c.amount, creditType: c.creditType }));
  const excess = strandedExcess(paymentsTotal, newScheduleTotal, 0);
  if (excess > 0.005) projected.push({ amount: excess, creditType: 'overpayment' });
  return projected;
}

export function projectSponsorCreditChange(args: {
  /** The credit as it stands, on the family that holds it. */
  existing: { id: string; playerId: string; amount: number };
  /** That family's full credit set (the existing credit included). */
  familyCredits: readonly { id: string; amount: number; creditType: string }[];
  /** What the edit resolves to: is it received, who is credited, at how many dollars. */
  next: { received: boolean; playerId: string | null; credit: number };
  wasReceived: boolean;
}): { projected: { id: string; amount: number; creditType: string }[]; action: string } | null {
  const { existing, familyCredits, next, wasReceived } = args;
  const wantsCredit = next.received && !!next.playerId && next.credit > 0.005;
  const staysOnFamily = wantsCredit && next.playerId === existing.playerId;

  if (staysOnFamily && next.credit >= existing.amount - 0.005) return null; // keeps or grows — safe

  const projected = staysOnFamily
    ? familyCredits.map(c => (c.id === existing.id ? { ...c, amount: next.credit } : c))
    : familyCredits.filter(c => c.id !== existing.id);

  const action = wasReceived && !next.received
    ? 'moving this sponsorship back to a pledge'
    : !wantsCredit
      ? 'removing this credit'
      : !staysOnFamily
        ? 'moving this credit to another family'
        : 'lowering this credit';

  return { projected, action };
}
