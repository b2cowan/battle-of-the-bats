import { legalPagesMode, type LegalPagesMode } from './legal-pages-switch';
import { stripeKeyIsTest } from './stripe-mode';
import { parseStartPaidPlan } from './start-door';

/**
 * FAIL VISIBLY, NOT QUIETLY (On-sale pages S2, `/legal` review 2026-11-19, docs/agents/legal/ON_SALE_PAGES_S2_REVIEW.md).
 * With the legal pages off, `requireAcceptance` passes everyone, so a live sale of League Plus, Club or Club · Association
 * would take money with no Terms tick and no record. Every route that sells one of the three refuses it, on a live key
 * only (a test key is dev). Tournament Plus and the Premium Coaches Portal, on sale before the Terms existed, are not
 * stopped by it.
 *
 * The routes that ask it (S4 Part 2 added the move and its preview: Tournament Plus → League Plus, and the Tournament
 * Plus → Club and Club → Club · Association moves that were not covered before). `tests/unit/legal-pages-sale-guard.test.ts`
 * lists them, and fails when a route that sells a plan does not ask.
 */
export const LEGAL_PAGES_UNPUBLISHED = 'legal_pages_unpublished';

export const LEGAL_PAGES_SALE_ERROR = 'We can’t start a plan right now. Nothing has been charged. Please try again later or email support@fieldlogichq.ca.';
/** The same refusal under a "Move to {plan}?" window (`/marketing`, S4 Part 2): nothing is being started there. */
export const LEGAL_PAGES_MOVE_ERROR = 'We can’t move your plan right now. Nothing has been charged. Please try again later or email support@fieldlogichq.ca.';

/**
 * The 503 the selling route returns, or null when the sale may go on. `route` names the route in the log line. `mode` and
 * `stripeKey` are this process's own; a test passes them (the published constant makes the real mode `published`).
 */
export function legalPagesSaleRefusal(
  planKey: unknown,
  route: string,
  { mode = legalPagesMode(), stripeKey = process.env.STRIPE_SECRET_KEY, sale = 'start' }:
    { mode?: LegalPagesMode; stripeKey?: string; sale?: 'start' | 'move' } = {},
): Response | null {
  const plan = parseStartPaidPlan(planKey);
  if (!plan || mode !== 'off' || stripeKeyIsTest(stripeKey)) return null;
  console.error(`[${route}] refused ${plan}: the legal pages are off on a live key`);
  return Response.json({ error: sale === 'move' ? LEGAL_PAGES_MOVE_ERROR : LEGAL_PAGES_SALE_ERROR, code: LEGAL_PAGES_UNPUBLISHED }, { status: 503 });
}
