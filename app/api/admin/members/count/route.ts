import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { seatExemptRoles } from '@/lib/roles';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const orgSlug = searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!ctx) return unauthorized();

  const { org } = ctx;
  const planCfg = PLAN_CONFIG[org.planId];

  // Coaching staff never count (owner ruling 2026-09-13); officials only where the plan frees them.
  const exempt = seatExemptRoles(planCfg);
  const { count: billedCount } = await supabaseAdmin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id)
    .not('role', 'in', `(${exempt.join(',')})`);

  let officialCount = 0;
  if (planCfg.officialsFreeSeats) {
    const { count } = await supabaseAdmin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('role', 'official');
    officialCount = count ?? 0;
  }

  const billed = billedCount ?? 0;

  return NextResponse.json({
    billed,
    officials: officialCount,
    limit: planCfg.seatLimit,
    officialsFree: planCfg.officialsFreeSeats,
  });
}, { route: '/api/admin/members/count' });
