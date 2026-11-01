/**
 * THE ONE PLACE A TEST SAYS WHAT A PREMIUM → CLUB UPGRADE SHOULD COST TODAY (Plan & billing Stage 4b, Part 4).
 *
 * Used by the unit money contract (`workspace-move-money.test.ts`). The whole-path UAT spec
 * (`tests/uat/scenarios/premium-to-club-path.spec.ts`) cannot reach the paying window yet (no real-subscription fixture, its
 * header says why); when it can, its line check calls this too, so what "Due today" is made of stays one edit here.
 *
 * ⚠ GST/HST (GST_HST_COLLECTION_PLAN.md Stage 2) will add a tax line to this window. Two edits, not one:
 *   1. here — teach `dueTodayOf` the tax kind (charges − credits + tax);
 *   2. in the product — `trustedPreviewLines` (lib/plan-move-preview-lines.ts) today returns null for ANY tax on the invoice, so
 *      once tax is collected every taxed coach would get the total-only fallback. That is product work for the tax stage.
 *
 * ⚠ `_club-upgrade-money.ts`, not `.test.ts`: the runner's glob must not try to run a module with no tests in it.
 */
import type { MovePreviewLine } from '../../lib/plan-move-preview-lines.ts';

/**
 * What the window's lines say is due today, in cents: every charge, less every credit. (A checkout quote has no lines: its due
 * today is Stripe's own invoice preview, which will carry the tax itself, so it needs no helper.)
 */
export function dueTodayOf(lines: ReadonlyArray<Pick<MovePreviewLine, 'kind' | 'amount'>>): number {
  return lines.reduce((due, l) => due + (l.kind === 'charge' ? l.amount : -l.amount), 0);
}
