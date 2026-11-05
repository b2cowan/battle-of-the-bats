import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { applyMove, cancelScheduledMove, getScheduledMove, hasLiveSubscription } from '@/lib/plan-move';
import { moveDirection } from '@/lib/plan-move-options';
import { authorizeMove, parseTargetPlan, refuseIfGated, refusalResponse } from '@/lib/plan-move-route';
import { writeOrgBillingAudit } from '@/lib/billing-retention';
import { PLAN_CONFIG } from '@/lib/plan-config';
import type { OrgPlan } from '@/lib/types';
import { ownPlanOf } from '@/lib/entitlement-grants';
import { billingAddressFromBody, requireBillingLocation, withClubAddressOnStripe, type BillingBuyer } from '@/lib/billing-location-server';
import type { BillingLocation } from '@/lib/billing-location';

/**
 * The move between plans — one subscription, never a second checkout (Ask 4, D7; A06).
 *
 *   GET    ?orgSlug=  → { planKey, moves: [{ planKey, label, direction, teamLimit }], scheduledMove, live }
 *                      the moves this org's plan allows, a down-move waiting at renewal, if any, and
 *                      whether it pays on a live subscription (else a band change goes to checkout).
 *   POST   { orgSlug, planKey, prorationDate?, clubName? } → up: { direction:'up', toPlan, movedAt }
 *                      `clubName` is REQUIRED (≤ 40 characters) when a Premium coach's portal moves onto Club; the portal
 *                      then becomes the club (Stage 4b) — poll GET /api/billing/club-upgrade-status for it.
 *                      `finishing: true` (up only) = the subscription moved and the money is taken, but a database step is still
 *                      to finish (the next billing event does it): show "your upgrade is going through", never "try again".
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
    .map(planKey => ({ planKey, direction: moveDirection(ownPlanOf(org), planKey) }))
    .filter((m): m is { planKey: OrgPlan; direction: 'up' | 'down' } => m.direction !== null)
    .map(m => ({ ...m, label: PLAN_CONFIG[m.planKey].label, teamLimit: PLAN_CONFIG[m.planKey].teamLimit }));
  const scheduledMove = moves.length > 0 ? await getScheduledMove(org) : null;
  // `live` (added by Club Tier Stage 1's screens session, additively): is this org paying on a live
  // Stripe subscription — the one fact that decides whether a band change is a MOVE (this route) or a
  // purchase at checkout. The screen asks the server rather than restating `hasLiveSubscription`.
  return NextResponse.json({ planKey: ownPlanOf(org), moves, scheduledMove, live: hasLiveSubscription(org) });
}, { route: '/api/billing/move' });

export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({})) as { orgSlug?: unknown; planKey?: unknown; prorationDate?: unknown; clubName?: unknown; billingAddress?: unknown };
  const authorized = await authorizeMove(typeof body.orgSlug === 'string' ? body.orgSlug : undefined);
  if (!authorized.ok) return authorized.response;
  const { org, actor } = authorized;

  const toPlan = parseTargetPlan(body.planKey);
  if (!toPlan) return NextResponse.json({ error: 'Choose a plan to move to.', code: 'not_a_move' }, { status: 400 });
  const gated = await refuseIfGated(toPlan);
  if (gated) return gated;

  // GST/HST Stage 1: a move UP charges today, so the buyer's billing address must be on file (a safety net: every subscription
  // started after this stage already has one). A move up from Premium makes the portal the club, so the buyer is the CLUB: the
  // "Start your club" window sends its address with the name, saved to the club's own row first. A move down charges nothing.
  let clubAddress: { buyer: Extract<BillingBuyer, { kind: 'org' }>; location: BillingLocation } | null = null;
  if (moveDirection(ownPlanOf(org), toPlan) === 'up') {
    const clubName = ownPlanOf(org) === 'team' && typeof body.clubName === 'string' ? body.clubName.trim() : null;
    const buyer = { kind: 'org' as const, orgId: org.id, name: clubName || org.name, stripeCustomerId: org.stripeCustomerId ?? null };
    const located = await requireBillingLocation(buyer, clubName ? billingAddressFromBody(body.billingAddress) : null);
    if (!located.ok) return located.response;
    if (clubName) clubAddress = { buyer, location: located.location };
  }

  const prorationDate = typeof body.prorationDate === 'number' ? Math.floor(body.prorationDate) : undefined;
  // Only a Premium coach's portal becoming the club uses the name (and is refused without one); every other move ignores it.
  const runMove = () => applyMove(org, toPlan, { prorationDate, actor, clubName: typeof body.clubName === 'string' ? body.clubName : null });
  // GST/HST Stage 2 Ask 2 (owner 2026-11-05): the move's prorated invoice is taxed by the Stripe customer's address, so the club's
  // address goes on BEFORE the move, and the coach's home address is put back if the move is refused (or throws). A stamp that
  // fails refuses the move with nothing changed.
  let result: Awaited<ReturnType<typeof runMove>>;
  if (clubAddress) {
    const stamped = await withClubAddressOnStripe(clubAddress.buyer, clubAddress.location, r => 'code' in r, runMove);
    if (!stamped.ok) return stamped.response;
    result = stamped.result;
  } else {
    result = await runMove();
  }
  if ('code' in result) return refusalResponse(result);

  await writeOrgBillingAudit(org.id, authorized.actorId,
    result.direction === 'up' ? 'plan_moved_up' : 'plan_move_scheduled',
    {
      from: ownPlanOf(org),
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
