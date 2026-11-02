import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { writeOrgBillingAudit } from '@/lib/billing-retention';
import { captureAndJson, captureError, withObservability } from '@/lib/observability';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { endedPortalFreeTime, runningPortalFreeTime } from '@/lib/portal-free-time-server';
import { coachCancelEndedRefusal, coachCancelRefusal } from '@/lib/portal-free-time';
import { scheduleEnding, stripeIdToStopNow } from '@/lib/plan-ending';
import { getStripe } from '@/lib/stripe';
import { endingDeps, readEndingAccount } from '@/lib/plan-ending-server';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';

/**
 * POST /api/billing/cancel/confirm — the owner cancels. Owner-only (ruling 2026-10-29: never a billing delegate).
 *
 * Plans end at the renewal date (owner ruling 2026-10-31, Stage 1): a paying Stripe subscription is SCHEDULED to end on
 * its renewal date — Stripe first, then the waiting row — and nothing is archived, suspended, hidden or closed now. The
 * ending itself runs when Stripe deletes the subscription (the webhook, through lib/plan-ending.ts). An account with no
 * real subscription (comped, Founding Season, a dev mock) has no date to wait for and ends now, through the same ending.
 */
export const POST = withObservability(async (req: Request) => {
  // Scope to the org the caller is acting on (multi-org owners), NOT their home org — fail closed
  // if no orgSlug is supplied, so a destructive cancel can never default to the wrong subscription.
  const body = await req.json().catch(() => ({}));
  const orgSlug = typeof body.orgSlug === 'string' ? body.orgSlug : undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  // A portal on staff-given free time has nothing to cancel: it goes back to the free Coaches Portal by itself, and a
  // cancel here would archive its tournaments and start the retention clock on it (Stage 4b, Q11-4/T15).
  if (isTeamWorkspaceOrg(ctx.org)) {
    const freeTime = await runningPortalFreeTime(ctx.org.id);
    if (freeTime) return Response.json({ error: coachCancelRefusal(freeTime.lastDay) }, { status: 409 });
    // Once it has ended there is still no subscription: a cancel would start a retention clock and send "cancelled" for a
    // portal nobody was ever billed for, and a later give by a Super admin would find that clock still running.
    const ended = await endedPortalFreeTime(ctx.org.id);
    if (ended) return Response.json({ error: coachCancelEndedRefusal(ended.lastDay) }, { status: 409 });
  }
  if (ctx.org.subscriptionStatus === 'canceled') return Response.json({ error: W.cancel.alreadyEnded }, { status: 409 });

  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim()
    : null;

  try {
    const account = await readEndingAccount(ctx.org.id);
    if (!account) return Response.json({ error: 'Organization not found' }, { status: 404 });
    const portal = account.isCoachesPortal;
    const result = await scheduleEnding(account, { door: 'owner', userId: ctx.user.id, email: ctx.user.email ?? null }, { reason, notifyOwner: true }, endingDeps);

    if (result.outcome === 'refused') return Response.json({ error: result.error }, { status: result.status });

    if (result.outcome === 'ended') {
      await writeOrgBillingAudit(ctx.org.id, ctx.user.id, portal ? 'coaches_portal_cancellation_confirmed' : 'billing_cancellation_confirmed', {
        fromPlan: account.ownPlan,
        retainedTournamentIds: result.ended.retainedTournamentIds,
        retentionUntil: result.ended.retentionUntil,
        ...(portal ? { teamWorkspaceId: account.teamWorkspaceId } : {}),
      });
      // Ended at once because the subscription is not paying: Stripe still holds it open, so stop it (as the cancel always did).
      const stripeSubscriptionId = stripeIdToStopNow(account);
      if (stripeSubscriptionId) {
        try {
          await getStripe().subscriptions.cancel(stripeSubscriptionId);
        } catch (stripeErr) {
          const message = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
          console.error('[cancel/confirm] Stripe reconciliation failed:', message);
          await captureError(stripeErr, { ctx, route: '/api/billing/cancel/confirm', method: 'POST', statusCode: 500 });
          await writeOrgBillingAudit(ctx.org.id, ctx.user.id, 'billing_stripe_reconciliation_failed', { action: 'cancellation', stripeSubscriptionId, error: message });
          return Response.json({ error: W.cancel.stripeNotStopped, retainedCount: result.ended.retainedTournamentIds.length + 1, retentionUntil: result.ended.retentionUntil }, { status: 500 });
        }
      }
      return Response.json({
        ok: true,
        outcome: 'ended',
        retainedCount: result.ended.retainedTournamentIds.length + 1,
        retentionUntil: result.ended.retentionUntil,
      });
    }

    await writeOrgBillingAudit(ctx.org.id, ctx.user.id, portal ? 'coaches_portal_cancellation_scheduled' : 'billing_cancellation_scheduled', {
      fromPlan: account.ownPlan,
      endsAt: result.endsAt,
      heldMovePlan: result.heldMovePlan,
      recorded: result.recorded,
    });
    return Response.json({
      ok: true,
      outcome: 'scheduled',
      endsAt: result.endsAt,
      recorded: result.recorded,
      ...(result.recorded ? {} : { notice: W.cancel.notRecorded }),
    });
  } catch (error) {
    return captureAndJson(error, { error: error instanceof Error ? error.message : 'The cancel could not be completed.' }, 500);
  }
}, { route: '/api/billing/cancel/confirm' });
