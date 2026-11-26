import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { writeOrgBillingAudit } from '@/lib/billing-retention';
import { captureAndJson, withObservability } from '@/lib/observability';
import { keepEnding } from '@/lib/plan-ending';
import { endingDeps, readEndingAccount } from '@/lib/plan-ending-server';
import { PLAN_BILLING_WORDS as W } from '@/lib/plan-billing-words';
import { PLAN_CONFIG } from '@/lib/plan-config';

/**
 * POST /api/billing/cancel/keep — Keep {Plan}: the owner undoes a waiting cancel (Plans end at renewal, Stage 1). Owner-only,
 * like cancel (ruling 2026-10-29). Stripe stops the cancel first, then the waiting row is withdrawn; a cheaper-plan move the
 * cancel carried is put back (gap review G1). Nothing is charged and nothing was taken, so nothing needs restoring.
 * A waiting cancel is not a suspension, so this route does not run for a suspended org.
 */
export const POST = withObservability(async (req: Request) => {
  const body = await req.json().catch(() => ({}));
  const orgSlug = typeof body.orgSlug === 'string' ? body.orgSlug : undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  try {
    const account = await readEndingAccount(ctx.org.id);
    if (!account) return Response.json({ error: 'Organization not found' }, { status: 404 });
    const result = await keepEnding(account, { door: 'owner', userId: ctx.user.id, email: ctx.user.email ?? null }, endingDeps);
    if (result.outcome === 'refused') return Response.json({ error: result.error }, { status: result.status });
    if (result.outcome === 'nothing') return Response.json({ error: W.cancel.nothingToKeep }, { status: 409 });

    await writeOrgBillingAudit(ctx.org.id, ctx.user.id, 'billing_cancellation_kept', {
      renewsOn: result.renewsOn,
      renewsAs: result.renewsAs,
      moveNotRestored: result.moveNotRestored,
    });
    return Response.json({
      ok: true,
      renewsOn: result.renewsOn,
      renewsAs: result.renewsAs,
      // G1: kept, but the cheaper move could not be put back — said plainly, with the move door on the page.
      ...(result.movePlan && result.moveNotRestored
        ? { notice: W.cancel.moveNotRestored(PLAN_CONFIG[account.ownPlan].label, PLAN_CONFIG[result.movePlan].label, result.renewsOn), moveToChooseAgain: result.movePlan }
        : {}),
    });
  } catch (error) {
    return captureAndJson(error, { error: error instanceof Error ? error.message : 'Your plan could not be kept.' }, 500);
  }
}, { route: '/api/billing/cancel/keep' });
