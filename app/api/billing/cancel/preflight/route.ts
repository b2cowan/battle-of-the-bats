import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { buildCancellationPreflight } from '@/lib/billing-retention';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (req: Request) => {
  // Scope to the org the caller is viewing (multi-org owners), NOT their home org — fail closed
  // if no orgSlug is supplied. The client passes it as a query param.
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const preflight = await buildCancellationPreflight(ctx.org);
  return Response.json(preflight);
}, { route: '/api/billing/cancel/preflight' });
