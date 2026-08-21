// What an expense or payable has actually posted to the team's books — pure, no I/O.
//
// Owner review 2026-08-15 (Q4). Delete had to be able to give money back, which means two places
// need the same answer to "what did this put on the books?": the CONFIRMATION the coach reads
// before pressing delete, and the REVERSAL that runs after. Those living apart is the classic way a
// dialog ends up promising $1,300 while the code gives back $800 — so they share this one answer
// and neither decides for itself what counts as paid.
//
// Pure and dependency-free so the browser can import it: lib/db.ts pulls in the service-role
// client, and a confirmation dialog must never be the reason that reaches a client bundle.
//
// ⚖ `paidLedgerLegs` IS GONE (Payables Rebuild P2). It reconstructed what had posted from the
// deposit/balance/expense paid stamps, which stopped being written when `Record a payment` made
// `rep_payable_payments` the record of what actually moved. "What did this put on the books?" is
// now the commitment's own payments — `commitmentStanding().payments`, each carrying the entry it
// posted — and the delete path reverses those directly.

import type { CommitmentStanding } from './payable-standing';
import { MAX_MONTHLY_OCCURRENCES } from './coach-monthly-recurrence';

/**
 * The refusal a plan longer than the ceiling gets — ONE sentence, said by the generator before the
 * coach commits and by the route if one arrives anyway.
 *
 * ⚠ The build prompt's rule, and it is worth stating why: the generator refuses in the browser so
 * the coach can fix it, and the route refuses because a stale tab, a replay or a direct caller all
 * reach it too. Two hand-typed copies of a refusal is how a reworded message ends up depending on
 * which door you came through.
 */
export function tooManyInstallments(count: number): string {
  return `That is ${count} payments. A repeating cost can hold ${MAX_MONTHLY_OCCURRENCES} — two `
    + 'full seasons of monthly payments. Shorten the run, or split it into two bills.';
}

/**
 * What deleting this record would put back on the books, for the confirmation the coach reads.
 *
 * Reads the same payments the server voids, so the sentence and the outcome cannot drift apart.
 * On a part-paid commitment the figure is what was ACTUALLY paid, never the total — §27 Part D's
 * rule, carried across the rebuild.
 *
 * `owesFamily` is separate and NOT money coming back: an out-of-pocket expense carries a credit the
 * team owes a family, which the delete removes by cascade. That changes what a household is owed
 * without a dollar moving through the ledger, so it has to be said in its own sentence rather than
 * folded into an amount — and none of its payments ever posted team cash, so the amount is zero.
 */
export function ledgerReversalPreview(
  standing: Pick<CommitmentStanding, 'paid' | 'payments'> | undefined,
  paidByPlayerId: string | null,
): {
  amount: number;
  legs: number;
  owesFamily: boolean;
} {
  const owesFamily = Boolean(paidByPlayerId);
  return {
    amount: owesFamily ? 0 : standing?.paid ?? 0,
    legs: owesFamily ? 0 : standing?.payments.length ?? 0,
    owesFamily,
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

/* ⚖ `paidOnDate` IS GONE (Payables Rebuild P2). It read the most decisive of the three legacy paid
   stamps, which stopped being written when payments became their own records — WHEN something was
   paid is now `commitmentStanding().payments`, each with its own date. It had no live caller left. */

/**
 * Is this string a real day on a real calendar — `YYYY-MM-DD`, and one the calendar actually has?
 *
 * ⚠ THE SHAPE IS NOT THE DATE (/review, 2026-08-16). `2026-02-30` and `2026-00-15` match the
 * pattern, sort correctly, and used to sail through — then Postgres rejected them at a `date`
 * column and the coach got a raw database error after a create-and-unwind round trip. A browser
 * date picker cannot produce these; a stale tab or a direct caller can. Round-tripping through UTC
 * is the cheap way to ask the calendar rather than the regex: an overflowed day silently rolls
 * into the next month, so it comes back as a different string.
 *
 * Shared by every door that stores a date — paid dates (below, which additionally refuse the
 * future) and installment DUE dates, which are legitimately in the future and need only this.
 */
export function isRealCalendarDate(date: unknown): date is string {
  const shape = typeof date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(date) : null;
  if (!shape) return false;
  const [, y, m, d] = shape;
  const asUtc = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const roundTrip = `${String(asUtc.getUTCFullYear()).padStart(4, '0')}`
    + `-${String(asUtc.getUTCMonth() + 1).padStart(2, '0')}`
    + `-${String(asUtc.getUTCDate()).padStart(2, '0')}`;
  return roundTrip === date;
}

/**
 * A commitment's plan, as a request body states it — validated once, for every door that stores one.
 *
 * ⚠ ONE COPY (`/simplify`, 2026-08-20): the create and edit routes each looped the pieces with the
 * identical two refusal sentences; a reworded refusal must not depend on which door it came through.
 * Amounts take `asMoneyAmount`'s cent floor; DUE dates are legitimately in the future, so they take
 * the calendar check alone, never the paid-date validator beside it.
 */
export function parseInstallmentPlan(raw: unknown):
  | { plan: Array<{ amount: number; dueDate: string }> }
  | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'A commitment needs at least one installment with an amount and a due date.' };
  }
  /* ⚠⚠ THE TWO-PIECE CAP IS LIFTED (P4), AND IT LIFTED WITH THE EDITOR, NOT BEFORE IT. The cap
     existed because the edit form was a literal deposit/balance two-field editor: a longer plan
     created through the API would be silently truncated to two the first time a coach saved an
     unrelated rename, deleting unpaid pieces with no warning. That form is now a 1..n list, so the
     reason has gone.

     ⚠ WHAT REPLACES IT IS THE SERIES CEILING, and it is the same number the generator refuses at,
     stated in the same sentence — `MAX_MONTHLY_OCCURRENCES`, two full seasons of monthly payments.
     S8: the series IS the commitment's installments, so the whole plan arriving here is the whole
     series, and capping the request caps the series. A run longer than this is a mistyped end date,
     not a commitment. */
  if (raw.length > MAX_MONTHLY_OCCURRENCES) {
    return { error: tooManyInstallments(raw.length) };
  }
  /* ⚠⚠ THE REFUSAL NAMES THE ROW ONCE THERE IS MORE THAN ONE (`/simplify`, altitude lens,
     2026-08-20). "Every installment needs a due date" was survivable while a plan held two pieces
     and is not once it can hold twelve — it leaves a coach checking all twelve. A ONE-row plan
     keeps the plain sentence, because there is no row to name and "payment 1" would be noise.

     ⚠ THIS IS WHY THE FORM CALLS THIS FUNCTION INSTEAD OF RE-DERIVING IT. The schedule editor had
     hand-copied both checks so it could say which row was wrong, and the two copies had ALREADY
     drifted apart in wording — a stale tab reaching the server was told something different from
     what the form would have said. One function, both doors, one sentence. */
  const pieces = raw as Array<{ amount?: unknown; dueDate?: unknown; id?: unknown }>;
  const many = pieces.length > 1;
  const plan: Array<{ amount: number; dueDate: string; id?: string }> = [];
  for (const [at, piece] of pieces.entries()) {
    const amount = asMoneyAmount(piece?.amount);
    if (amount === null) {
      return {
        error: many
          ? `Payment ${at + 1} needs an amount of at least $0.01.`
          : 'Enter an amount of at least $0.01.',
      };
    }
    if (!isRealCalendarDate(piece?.dueDate)) {
      return {
        error: many
          ? `Payment ${at + 1} has no due date — that is what puts it on your payment schedule.`
          : 'When is this due? A commitment without a date never reaches your payment schedule.',
      };
    }
    /* ⚠ THE ROW'S IDENTITY IS CARRIED THROUGH, NOT VALIDATED HERE — see `PlanPiece.id`. This
       function does not know which commitment it is validating for, so it cannot tell a real id
       from a stolen one; `planInstallmentWrites` matches it against the record's OWN stored rows
       and treats anything it does not recognise as a brand-new piece. That is the safe reading: an
       id from another bill buys nothing, and a missing id simply means "this row is new". */
    plan.push({
      amount,
      dueDate: piece.dueDate as string,
      ...(typeof piece.id === 'string' && piece.id ? { id: piece.id } : {}),
    });
  }
  return { plan };
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
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'Enter the date this was paid.';
  }
  if (!isRealCalendarDate(date)) return 'That is not a real date. Enter the date this was paid.';
  // Lexicographic works and is deliberate: both sides are zero-padded ISO calendar dates, so no
  // Date object is constructed and no timezone can be read into either one.
  if (date > today) {
    return 'That date is in the future. Money that has not moved yet is a payable — record it with '
      + 'a due date instead.';
  }
  return null;
}
