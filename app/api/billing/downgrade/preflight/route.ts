import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import {
  buildDowngradePreflight,
  isLowerPlan,
  isOrganizationDowngradeTarget,
  normalizePlan,
} from '@/lib/billing-retention';

export async function POST(req: Request) {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const body = await req.json().catch(() => ({}));
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
}
