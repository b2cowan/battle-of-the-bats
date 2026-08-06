import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import {
  buildDowngradePreflight,
  isLowerPlan,
  isOrganizationDowngradeTarget,
  normalizePlan,
} from '@/lib/billing-retention';
import { withObservability } from '@/lib/observability';

export const POST = withObservability(async (req: Request) => {
  // Scope to the org the caller is viewing (multi-org owners), NOT their home org — fail closed.
  const body = await req.json().catch(() => ({}));
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
  if (!isLowerPlan(ctx.org.planId, targetPlan)) {
    return Response.json({ error: 'Downgrade review only applies when moving to a lower plan.' }, { status: 400 });
  }

  const preflight = await buildDowngradePreflight(ctx.org, targetPlan);
  return Response.json(preflight);
}, { route: '/api/billing/downgrade/preflight' });
