/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE ONE PLACE A TEAM MOVE SAYS "NOT REFUNDED" — what the coach is told at the moment they say yes.
 *
 * ⚖ A team move ends the coach's own subscription at once, with no refund and no proration
 * (`lib/team-ownership-transfer.ts` `cancelCoachSubscription`; owner ruling 2026-09-28, behaviour unchanged).
 * The published Terms (2026-11-17 §8) promise a cancelled plan runs to the end of the paid period and, in
 * their last paragraph, a refund when WE end a plan for a reason that is not the customer's fault. So the
 * coach is told, where they say yes, what the code does: owner ruling (a) of 2026-11-19, the wording is
 * `/legal`'s (`docs/agents/legal/ON_SALE_PAGES_S2_REVIEW.md` §4), and the Terms carve-out (ruling b, edit T5
 * of the held Terms draft) ships in the same release.
 *
 * ⚠ THIS FILE SUPERSEDES, FOR ONE SENTENCE, the 2026-09-28 rule that no move screen mentions a refund
 * (`lib/team-move-words.ts`). The rule is narrowed, not deleted: the refund words live ONLY in this
 * module, and `tests/unit/team-move-words.test.ts` fails when they appear anywhere else (the club's screen,
 * the bells, the other help text, the words module). A prorated refund is NOT built (ruling d).
 *
 * Pure and client-safe. The route decides which case a coach is in (`ownPlanEndOf`); the page only spells it.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * Where the coach's own plan stands at the yes.
 *  - `paid` with `endsOn`: a paying subscription with a renewal date still ahead (the date it would have run to; for a
 *    plan already set to end at renewal, that same date).
 *  - `paid` with no `endsOn`: paying, but no usable date on record. The date is left out, never invented.
 *  - `nothing_paid`: a trial, a past-due plan (the current period is unpaid), free time (no subscription) or no live
 *    subscription. There is no paid part to forfeit, so nothing about a refund is said.
 */
export type OwnPlanAtTheYes =
  | { kind: 'paid'; endsOn: string | null }
  | { kind: 'nothing_paid' };

/**
 * Classifies the coach's own plan. `waitsOn` is `waitingDate(...)` from `lib/plan-ending.ts` (a real subscription waits for
 * its stored renewal; a date already past reads as missing). A trial has a subscription but nothing paid.
 */
export function ownPlanEndOf(input: { realSubscription: boolean; status: string | null | undefined; waitsOn: string | null }): OwnPlanAtTheYes {
  // A trial has nothing paid; a past-due plan has not paid the current period (its invoice stays open), so "the unused
  // part of what you paid" would be untrue for it too (/accounting review, 2026-11-20).
  if (!input.realSubscription || input.status === 'trialing' || input.status === 'past_due') return { kind: 'nothing_paid' };
  return { kind: 'paid', endsOn: input.waitsOn };
}

/**
 * The sentence, in the card's "What it costs you" and in the confirm window. One spelling everywhere it appears.
 * `dateText` is the date already formatted for the reader (the page formats it, in the viewer's own style).
 *
 * It already says "won't be charged … again", so the card does NOT also show `COACH_PLAN_LINE` beside it — that line
 * is only the fallback when the coach's plan is unknown (owner 2026-11-20: the card said it twice, and named the same
 * thing "your own plan" and "your own Coaches Portal"). /legal's meaning, merged into two sentences, order changed only.
 */
export function coachPlanEndsLine(p: { clubName: string; plan: OwnPlanAtTheYes; dateText: string | null }): string {
  const ends = `Your own plan ends today, because ${p.clubName} now covers this team.`;
  // "again" only where something was paid: a trial or free time was never charged (/legal review, 2026-11-20).
  if (p.plan.kind === 'nothing_paid') return `${ends} You won’t be charged for it.`;
  const forfeited = p.dateText
    ? `the unused part of what you paid, to ${p.dateText}, is not refunded.`
    : 'the unused part of what you paid is not refunded.';
  return `${ends} You won’t be charged for it again, and ${forfeited}`;
}
