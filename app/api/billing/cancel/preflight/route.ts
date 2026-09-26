import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { buildCancellationPreflight } from '@/lib/billing-retention';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

/**
 * GET /api/billing/cancel/preflight — what cancelling would do. Owner-only.
 *
 * ── Added by Club Tier Stage 1's screens session (2026-09-26), additively ──
 *   cancelled — { at, keptUntil } for an org that IS cancelled: the day it was suspended and the
 *               earliest retention deadline still running. The reactivate card says both ("Cancelled
 *               Sep 5 · Kept until December 4, 2026", specimen 7); null while the org is live, and
 *               a field is null when its read has nothing to say (the card then omits that half).
 */
export const GET = withObservability(async (req: Request) => {
  // Scope to the org the caller is viewing (multi-org owners), NOT their home org — fail closed
  // if no orgSlug is supplied. The client passes it as a query param.
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner') return forbidden();

  const preflight = await buildCancellationPreflight(ctx.org);

  let cancelled: { at: string | null; keptUntil: string | null } | null = null;
  if (ctx.org.subscriptionStatus === 'canceled') {
    const [{ data: orgRow }, { data: held }] = await Promise.all([
      supabaseAdmin.from('organizations').select('billing_suspended_at').eq('id', ctx.org.id).maybeSingle(),
      // The records still waiting to come back — restored or superseded ones are not "kept".
      supabaseAdmin.from('billing_retained_records').select('retention_until')
        .eq('org_id', ctx.org.id)
        .in('retained_state', ['retained_inactive', 'pending_purge'])
        .order('retention_until', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    cancelled = {
      at: (orgRow?.billing_suspended_at as string | null | undefined) ?? null,
      keptUntil: (held?.retention_until as string | null | undefined) ?? null,
    };
  }

  return Response.json({ ...preflight, cancelled });
}, { route: '/api/billing/cancel/preflight' });
