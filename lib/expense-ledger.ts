// What an expense or payable has actually posted to the team's books — pure, no I/O.
//
// Owner review 2026-08-15 (Q4). Delete had to be able to give money back, which means two places
// need the same answer to "what did this put on the books?": the CONFIRMATION the coach reads
// before pressing delete, and the REVERSAL that runs after. Those living apart is the classic way a
// dialog ends up promising $1,300 while the code gives back $800 — so they share this one function
// and neither decides for itself what counts as paid.
//
// Pure and dependency-free so the browser can import it: lib/db.ts pulls in the service-role
// client, and a confirmation dialog must never be the reason that reaches a client bundle.

import type { RepTeamExpense } from './types';

/** One posted money-out entry, and how confidently we know which ledger row it is. */
export interface ExpenseLedgerLeg {
  /** 'expense' = a lump payment; the other two are a payable's halves. */
  half: 'expense' | 'deposit' | 'balance';
  amount: number;
  /** The description the ledger entry was written with — the fallback match key for old rows. */
  entryDescription: string;
  /** Recorded since mig 236; null for anything paid before it, which matches instead. */
  entryId: string | null;
}

/**
 * Every leg of this record that actually moved team money. Unpaid halves are absent, not zero.
 *
 * ⚠ AN OUT-OF-POCKET EXPENSE HAS NO LEG. It is created already-paid, but a family's money moved and
 * the team's did not, so no cash entry was ever posted (mig 234, owner Call 5). Reversing an entry
 * that was never written would credit the team for spending it never did — the same trap that
 * `markExpensePaid` already refuses for the same records.
 */
export function paidLedgerLegs(e: RepTeamExpense): ExpenseLedgerLeg[] {
  if (e.expenseType === 'tournament_payable') {
    const legs: ExpenseLedgerLeg[] = [];
    if (e.depositPaidAt) {
      legs.push({
        half: 'deposit',
        amount: e.depositAmount ?? e.amount,
        entryDescription: `${e.description} — Deposit`,
        entryId: e.depositEntryId,
      });
    }
    if (e.balancePaidAt) {
      legs.push({
        half: 'balance',
        amount: e.balanceAmount ?? e.amount,
        entryDescription: `${e.description} — Balance`,
        entryId: e.balanceEntryId,
      });
    }
    return legs;
  }
  if (e.expensePaidAt && !e.paidByPlayerId) {
    return [{
      half: 'expense',
      amount: e.amount,
      entryDescription: e.description,
      entryId: e.accountingEntryId,
    }];
  }
  return [];
}

/**
 * What deleting this record would put back on the books, for the confirmation the coach reads.
 *
 * `owesFamily` is separate and NOT money coming back: an out-of-pocket expense carries a credit the
 * team owes a family, which the delete removes by cascade. That changes what a household is owed
 * without a dollar moving through the ledger, so it has to be said in its own sentence rather than
 * folded into an amount.
 */
export function ledgerReversalPreview(e: RepTeamExpense): {
  amount: number;
  legs: number;
  owesFamily: boolean;
} {
  const legs = paidLedgerLegs(e);
  return {
    amount: Math.round(legs.reduce((s, l) => s + l.amount, 0) * 100) / 100,
    legs: legs.length,
    owesFamily: Boolean(e.paidByPlayerId),
  };
}

/** Which figures on a saved record can no longer be changed, and when it was paid. */
/**
 * ⚖ THE FIGURE LOCK IS RETIRED — owner ruling 2026-08-16, reversing the ruling of 2026-08-15.
 *
 * What used to be here: `lockedFields`, which froze a paid record's amount (and each paid half of a
 * payable) on the grounds that the figure was already on the team's books. The owner's re-read:
 * *"I don't recall making that decision… once it is edited the new value should permeate to the
 * books and everything be in sync. Not sure why we would restrict this."*
 *
 * The lock was never a principle — it was a workaround for a missing capability. Nothing could push
 * a correction through to the books, so the cheap answer was to forbid the correction. Now
 * `syncExpenseBooksForEdit` (lib/db.ts) does push it through, so the reason has gone and the
 * restriction goes with it. **Every figure on a money record is editable; the books follow.**
 *
 * ⚠ THE RULE IT REPLACES IS NOT "ANYTHING GOES". Two things still cannot be corrected in place, and
 * both are stated where they bite rather than as a predicate here:
 *   · A record paid before migration 236 has no recorded link to the entry it created, so a figure
 *     edit has to MATCH it by description and amount first — and refuses when two entries look
 *     alike, rather than rewriting the wrong one.
 *   · WHO paid a cost out of pocket. That moves a debt between households rather than restating a
 *     figure, so it is its own decision and its own change.
 *
 * `paidOn` survives as its own tiny accessor below, because the form still says WHEN something was
 * paid — it just no longer says "and therefore you may not touch it".
 */

/**
 * A cost amount, as dollars-and-cents — or null if it is not one.
 *
 * ⚠⚠ "GREATER THAN ZERO" WAS NOT ENOUGH (/review, 2026-08-16). Both money doors accepted any
 * positive number, so `0.004` was a valid cost. Nothing rounded it, and the reimbursement credit an
 * out-of-pocket cost creates is skipped below half a cent — so a cost could be born saying a family
 * paid it while the debt to that family was never written, silently. That is the precondition for
 * the worst failure in this area, and it arrived through a typo (`.04` for `$4.00`) rather than
 * anything exotic.
 *
 * Money in this domain is dollars-and-cents everywhere — the data dictionary is explicit that there
 * is no cents-as-integers conversion anywhere in it — so a figure is rounded to 2dp and then has to
 * be at least a cent. Shared by both doors so they cannot disagree about what money is.
 */
export function asMoneyAmount(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  return rounded >= 0.01 ? rounded : null;
}

/** The most decisive paid-at this record carries, for saying WHEN. Null if nothing has posted. */
export function paidOnDate(e: RepTeamExpense | null): string | null {
  if (!e) return null;
  return e.expensePaidAt ?? e.balancePaidAt ?? e.depositPaidAt ?? null;
}

/**
 * When money actually moved — validated once, for every door that records a payment.
 *
 * ⚠⚠ THE DEFECT THIS EXISTS TO CLOSE (found 2026-08-16). Until now nothing ever asked. Creating a
 * cost as "already paid" wrote no paid date at all, so the row arrived UNPAID: Budget vs. Actual
 * counts a simple expense only when `expense_paid_at` is set, the month grid places it by that same
 * stamp, and cash on hand never moved. The only remedy was a separate **Mark paid**, which stamped
 * `now()` — so a diamond paid for last month landed in this month's column and could not be
 * corrected. The month grid exists to say WHEN money moved; every hand-entered cost was claiming it
 * moved the day somebody got round to typing it.
 *
 * ⚠ NO FUTURE DATES. A payment that has not happened is a commitment, and the product already has
 * one of those — a payable with a due date. Accepting a future paid date would put spending in a
 * month that has not arrived and quietly make the two concepts interchangeable, which is the
 * confusion the Payables tab exists to prevent.
 *
 * ⚠ `today` IS THE CALLER'S, and it must come from the org's calendar (`tournamentToday()`), never
 * from a raw UTC instant. A club in Toronto marking a bill paid at 8pm is still on today's date;
 * UTC has already rolled over, and this would refuse their own present day.
 *
 * @returns a sentence written for the coach, or null when the date is usable.
 */
export function whyPaidDateIsRefused(date: unknown, today: string): string | null {
  const shape = typeof date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  if (!shape) return 'Enter the date this was paid.';
  /* ⚠ THE SHAPE IS NOT THE DATE (/review, 2026-08-16). `2026-02-30` and `2026-00-15` match the
     pattern, sort before today, and used to sail through — then Postgres rejected them at the
     ledger's own `date` column and the coach got a raw database error after a create-and-unwind
     round trip. A browser date picker cannot produce these; a stale tab or a direct caller can.
     Round-tripping through UTC is the cheap way to ask the calendar rather than the regex: an
     overflowed day silently rolls into the next month, so it comes back as a different string. */
  const [, y, m, d] = shape;
  const asUtc = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const roundTrip = `${String(asUtc.getUTCFullYear()).padStart(4, '0')}`
    + `-${String(asUtc.getUTCMonth() + 1).padStart(2, '0')}`
    + `-${String(asUtc.getUTCDate()).padStart(2, '0')}`;
  if (roundTrip !== date) return 'That is not a real date. Enter the date this was paid.';
  // Lexicographic works and is deliberate: both sides are zero-padded ISO calendar dates, so no
  // Date object is constructed and no timezone can be read into either one.
  if (date > today) {
    return 'That date is in the future. Money that has not moved yet is a payable — record it with '
      + 'a due date instead.';
  }
  return null;
}
