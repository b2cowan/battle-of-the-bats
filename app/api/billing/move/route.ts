import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { applyMove, cancelScheduledMove, getScheduledMove, hasLiveSubscription, moveDirection } from '@/lib/plan-move';
import { authorizeMove, parseTargetPlan, refuseIfGated, refusalResponse } from '@/lib/plan-move-route';
import { writeOrgBillingAudit } from '@/lib/billing-retention';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';

/**
 * The move between plans — one subscription, never a second checkout (Ask 4, D7; A06).
 *
 *   GET    ?orgSlug=  → { planKey, moves: [{ planKey, label, direction, teamLimit }], scheduledMove, live }
 *                      the moves this org's plan allows, a down-move waiting at renewal, if any, and
 *                      whether it pays on a live subscription (else a band change goes to checkout).
 *   POST   { orgSlug, planKey, prorationDate? } → up: { direction:'up', toPlan, movedAt }
 *                      down: { direction:'down', toPlan, scheduled: { toPlan, effectiveAt } }
 *   DELETE ?orgSlug=  → { cancelled: boolean } — keep the current band (cancels the waiting down-move).
 *
 * Refusals as POST /api/billing/move/preview documents them. Owner-only (`billing`).
 */

const ALL_PLANS = Object.keys(PLAN_CONFIG) as OrgPlan[];

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const authorized = await authorizeMove(orgSlug);
  if (!authorized.ok) return authorized.response;
  const { org } = authorized;

  const moves = ALL_PLANS
    .map(planKey => ({ planKey, direction: moveDirection(org.planId, planKey) }))
    .filter((m): m is { planKey: OrgPlan; direction: 'up' | 'down' } => m.direction !== null)
    .map(m => ({ ...m, label: PLAN_CONFIG[m.planKey].label, teamLimit: PLAN_CONFIG[m.planKey].teamLimit }));
  const scheduledMove = moves.length > 0 ? await getScheduledMove(org) : null;
  // `live` (added by Club Tier Stage 1's screens session, additively): is this org paying on a live
  // Stripe subscription — the one fact that decides whether a band change is a MOVE (this route) or a
  // purchase at checkout. The screen asks the server rather than restating `hasLiveSubscription`.
  return NextResponse.json({ planKey: org.planId, moves, scheduledMove, live: hasLiveSubscription(org) });
}, { route: '/api/billing/move' });

export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({})) as { orgSlug?: unknown; planKey?: unknown; prorationDate?: unknown };
  const authorized = await authorizeMove(typeof body.orgSlug === 'string' ? body.orgSlug : undefined);
  if (!authorized.ok) return authorized.response;
  const { org, actor } = authorized;

  const toPlan = parseTargetPlan(body.planKey);
  if (!toPlan) return NextResponse.json({ error: 'Choose a plan to move to.', code: 'not_a_move' }, { status: 400 });
  const gated = await refuseIfGated(toPlan);
  if (gated) return gated;

  const prorationDate = typeof body.prorationDate === 'number' ? Math.floor(body.prorationDate) : undefined;
  const result = await applyMove(org, toPlan, { prorationDate, actor });
  if ('code' in result) return refusalResponse(result);

  await writeOrgBillingAudit(org.id, authorized.actorId,
    result.direction === 'up' ? 'plan_moved_up' : 'plan_move_scheduled',
    {
      from: org.planId,
      to: toPlan,
      actor,
      ...(result.direction === 'down' ? { effectiveAt: result.scheduled.effectiveAt } : {}),
    });
  return NextResponse.json(result);
}, { route: '/api/billing/move' });

export const DELETE = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const authorized = await authorizeMove(orgSlug);
  if (!authorized.ok) return authorized.response;
  const cancelled = await cancelScheduledMove(authorized.org);
  if (typeof cancelled !== 'boolean') return refusalResponse(cancelled);
  if (cancelled) {
    await writeOrgBillingAudit(authorized.org.id, authorized.actorId, 'plan_move_cancelled', { actor: authorized.actor });
  }
  return NextResponse.json({ cancelled });
}, { route: '/api/billing/move' });
