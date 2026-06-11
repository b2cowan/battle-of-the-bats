import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { buildCancellationPreflight } from '@/lib/billing-retention';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async () => {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const preflight = await buildCancellationPreflight(ctx.org);
  return Response.json(preflight);
}, { route: '/api/billing/cancel/preflight' });
