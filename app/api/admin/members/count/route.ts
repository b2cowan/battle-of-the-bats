import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { PLAN_CONFIG } from '@/lib/plan-config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgSlug = searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug });
  if (!ctx) return unauthorized();

  const { org } = ctx;
  const planCfg = PLAN_CONFIG[org.planId];

  const { count: totalCount } = await supabaseAdmin
    .from('organization_members')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id);

  let officialCount = 0;
  if (planCfg.officialsFreeSeats) {
    const { count } = await supabaseAdmin
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('role', 'official');
    officialCount = count ?? 0;
  }

  const billed = (totalCount ?? 0) - officialCount;

  return NextResponse.json({
    billed,
    officials: officialCount,
    limit: planCfg.seatLimit,
    officialsFree: planCfg.officialsFreeSeats,
  });
}
