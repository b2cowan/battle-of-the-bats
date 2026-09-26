import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { previewMove } from '@/lib/plan-move';
import { authorizeMove, parseTargetPlan, refuseIfGated, refusalResponse } from '@/lib/plan-move-route';

/**
 * POST /api/billing/move/preview — { orgSlug, planKey } → what the move would do, before the owner
 * confirms it (Ask 4, Stage 1b specimen 7).
 *
 *   up   → { direction:'up', amountDueToday, currency, prorationDate, nextAmount, renewsAt, … }
 *          amountDueToday is STRIPE'S preview of the prorated charge — never our arithmetic. Send
 *          `prorationDate` back to POST /api/billing/move so the charge equals this figure.
 *   down → { direction:'down', effectiveAt, nextAmount, … } — takes effect at the next renewal,
 *          no credit.
 *
 * Refusals (4xx, `{ code, error, … }`): `not_a_move`, `no_live_subscription` (use checkout),
 * `band_too_small` (+ activeTeams, teamLimit — archive first), `price_missing`, `plan_not_on_sale`
 * (403 while gated), `stripe_error` (502).
 */
export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({})) as { orgSlug?: unknown; planKey?: unknown };
  const authorized = await authorizeMove(typeof body.orgSlug === 'string' ? body.orgSlug : undefined);
  if (!authorized.ok) return authorized.response;

  const toPlan = parseTargetPlan(body.planKey);
  if (!toPlan) return NextResponse.json({ error: 'Choose a plan to move to.', code: 'not_a_move' }, { status: 400 });
  const gated = await refuseIfGated(toPlan);
  if (gated) return gated;

  const preview = await previewMove(authorized.org, toPlan);
  if ('code' in preview) return refusalResponse(preview);
  return NextResponse.json(preview);
}, { route: '/api/billing/move/preview' });
