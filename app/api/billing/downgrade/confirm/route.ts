import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import {
  buildDowngradePreflight,
  isLowerPlan,
  isOrganizationDowngradeTarget,
  normalizePlan,
  retentionDateLabel,
  writeOrgBillingAudit,
} from '@/lib/billing-retention';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { getStripe } from '@/lib/stripe';
import { planDowngradedHtml, SITE_URL } from '@/lib/email';
import { sendTransactionalEmail } from '@/lib/platform-email-templates';
import { captureError, captureAndJson, withObservability } from '@/lib/observability';
import { ownPlanOf } from '@/lib/entitlement-grants';
import { getBillingHref } from '@/lib/billing-urls';
import { normalizeKeepIds, scheduleDowngrade, stripeIdToStopNow } from '@/lib/plan-ending';
import { endingDeps, readEndingAccount } from '@/lib/plan-ending-server';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';

type ConfirmBody = {
  targetPlan?: unknown;
  keepTournamentIds?: unknown;
  reason?: unknown;
  orgSlug?: unknown;
};

/**
 * POST /api/billing/downgrade/confirm — the owner moves to the free plan. Owner-only.
 *
 * Plans end at the renewal date, Stage 2 (owner rulings 2026-11-03; lib/plan-ending.ts): a paying Stripe subscription's
 * move is SCHEDULED for its renewal date — the waiting row (target, the owner's pick) then Stripe's `cancel_at_period_end`
 * — and nothing is archived, limited, closed or emailed as done now; the paid plan stays fully live until the date, when
 * the webhook runs the move (`applyDowngrade`). With no live paid period (ruling 3: comped, Founding Season, no
 * subscription, a dev mock) there is no date: the move happens now, through the same `applyDowngrade` and its safe order
 * (restore records BEFORE the archive — G11; the old route archived first).
 *
 * ⚠ The old immediate move to a cheaper PAID plan is closed: that move waits for renewal through Change plan (§1.3), and
 * this branch (with its `create_prorations`) let a direct call skip the wait — and, with no paying subscription, it handed
 * out a cheaper paid plan unbilled. This route now moves to the free plan only (/review 2026-11-03).
 */
export const POST = withObservability(async (req: Request) => {
  // Scope to the org the caller is viewing (multi-org owners), NOT their home org — fail closed.
  const body = await req.json().catch(() => ({})) as ConfirmBody;
  const orgSlug = typeof body.orgSlug === 'string' ? body.orgSlug : undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const targetPlan = normalizePlan(body.targetPlan);
  if (!targetPlan) {
    return Response.json({ error: 'Choose a valid target plan.' }, { status: 400 });
  }
  if (!isOrganizationDowngradeTarget(targetPlan)) {
    return Response.json({ error: 'Team is a standalone product, not an organization downgrade target.' }, { status: 400 });
  }
  const fromPlan = ownPlanOf(ctx.org);
  if (!isLowerPlan(fromPlan, targetPlan)) {
    return Response.json({ error: 'You can only confirm a downgrade to a lower plan.' }, { status: 400 });
  }

  try {
    const [account, preflight] = await Promise.all([readEndingAccount(ctx.org.id), buildDowngradePreflight(ctx.org, targetPlan)]);
    if (!account) return Response.json({ error: 'Organization not found' }, { status: 404 });
    // A Coaches Portal's plan changes on its own billing page (the move to free would skip its workspace and Premium tools).
    if (account.isCoachesPortal) return Response.json({ error: W.downgrade.notHere }, { status: 400 });
    // A cancelled (suspended) account comes back through Reactivation, never a downgrade that would half-revive it.
    if (account.subscriptionStatus === 'canceled') return Response.json({ error: W.cancel.alreadyEnded }, { status: 409 });
    // The old immediate paid branch, closed for EVERY account: a cheaper paid plan is the move at renewal (refused in plain
    // words, with its door). Without a paying subscription it would hand out a paid plan unbilled (an unpaid or
    // incomplete subscription, a comp) — no screen offers it; the operator's plan change is the door for those.
    if (targetPlan !== 'tournament') return Response.json({ error: W.downgrade.useTheMove, code: 'use_the_move' }, { status: 409 });

    const chosen = normalizeKeepIds(body.keepTournamentIds);
    const knownIds = new Set(preflight.tournaments.map(t => t.id));
    if (preflight.requiresTournamentChoice) {
      if (chosen.length !== preflight.allowedKeepCount) {
        return Response.json({ error: W.downgrade.chooseCount(preflight.allowedKeepCount) }, { status: 400 });
      }
      if (chosen.some(id => !knownIds.has(id))) {
        return Response.json({ error: 'One selected tournament does not belong to this organization.' }, { status: 400 });
      }
    }
    // The pick is stored either way: with no choice to make, every tournament holding a slot now is the pick, so one made
    // during the wait is not in it and is archived on the date (G2).
    const keepTournamentIds = preflight.requiresTournamentChoice ? chosen : preflight.tournaments.map(t => t.id);
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
    const actorEmail = ctx.user.email ?? null;

    const result = await scheduleDowngrade(account, { door: 'owner', userId: ctx.user.id, email: actorEmail }, { targetPlan, keepTournamentIds, reason }, endingDeps);
    if (result.outcome === 'refused') return Response.json({ error: result.error, code: 'plan_change_waiting' }, { status: result.status });

    if (result.outcome === 'scheduled') {
      await writeOrgBillingAudit(ctx.org.id, ctx.user.id, 'billing_downgrade_scheduled', {
        fromPlan, targetPlan, keepTournamentIds, movesAt: result.movesAt, heldMovePlan: result.heldMovePlan,
      });
      return Response.json({ ok: true, outcome: 'scheduled', targetPlan, movesAt: result.movesAt });
    }

    // Moved now (no live paid period).
    const moved = result.moved;
    await writeOrgBillingAudit(ctx.org.id, ctx.user.id, 'billing_downgrade_confirmed', {
      fromPlan, targetPlan, retainedTournamentIds: moved.retainedTournamentIds, keepTournamentIds: moved.keptTournamentIds,
      retentionUntil: moved.retentionUntil,
    });
    // A real subscription that is not paying (unpaid, incomplete) has no date to wait for, but Stripe still holds it open:
    // stop it, or a late payment could switch the paid plan back on (as an immediate cancel does).
    const stopId = stripeIdToStopNow(account);
    if (stopId) {
      try {
        await getStripe().subscriptions.cancel(stopId);
      } catch (stripeErr) {
        const message = stripeErr instanceof Error ? stripeErr.message : String(stripeErr);
        await captureError(stripeErr, { ctx, route: '/api/billing/downgrade/confirm', method: 'POST', statusCode: 500 });
        await writeOrgBillingAudit(ctx.org.id, ctx.user.id, 'billing_stripe_reconciliation_failed', { action: 'downgrade', targetPlan, stripeSubscriptionId: stopId, error: message });
        return Response.json({
          error: W.downgrade.stripeNotStopped, targetPlan, retainedCount: moved.retainedTournamentIds.length, retentionUntil: moved.retentionUntil,
        }, { status: 500 });
      }
    }

    // The move happened now, so "your plan has been updated" is true now. (Part C moves this email into the move itself.)
    if (actorEmail) {
      const fromPlanLabel = PLAN_CONFIG[fromPlan]?.label ?? fromPlan;
      const toPlanLabel = PLAN_CONFIG[targetPlan]?.label ?? targetPlan;
      const billingUrl = `${SITE_URL}${getBillingHref({ ...ctx.org, planId: ownPlanOf(ctx.org) })}`;
      await sendTransactionalEmail({
        key: 'plan_downgraded',
        to: actorEmail,
        vars: { orgName: ctx.org.name, fromPlanLabel, toPlanLabel, billingUrl },
        defaultSubject: `Your ${ctx.org.name} plan has been updated`,
        defaultHtml: planDowngradedHtml({
          orgName: ctx.org.name, fromPlanLabel, toPlanLabel, retainedTournaments: moved.retainedTournamentIds.length,
          retentionUntil: retentionDateLabel(moved.retentionUntil), billingUrl,
        }),
        orgId: ctx.org.id,
        askedBy: ctx.user.id,
      });
    }

    return Response.json({
      ok: true, outcome: 'moved', targetPlan, retainedCount: moved.retainedTournamentIds.length, retentionUntil: moved.retentionUntil,
    });
  } catch (error) {
    return captureAndJson(error, { error: error instanceof Error ? error.message : 'The downgrade could not be completed.' }, 500);
  }
}, { route: '/api/billing/downgrade/confirm' });
