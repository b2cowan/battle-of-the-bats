import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { readBillingUsage } from '@/lib/billing-usage';
import { withObservability } from '@/lib/observability';

/** Count-only billing read. Owners need it even when suspended to assess a comeback plan. */
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();
  try {
    return Response.json(await readBillingUsage(ctx.org), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Billing usage could not be read. Try again.' }, { status: 503 });
  }
}, { route: '/api/billing/usage' });
