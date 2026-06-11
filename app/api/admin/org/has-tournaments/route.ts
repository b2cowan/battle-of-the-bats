import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized } from '@/lib/api-auth';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async () => {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const hasTournamentEntitlement = PLAN_CONFIG[ctx.org.planId]?.moduleEntitlements.includes('module_tournaments') ?? false;

  const { count, error } = await supabaseAdmin
    .from('tournaments')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.org.id)
    .neq('status', 'archived');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    hasTournamentEntitlement,
    hasTournaments: (count ?? 0) > 0,
    nonArchivedTournamentCount: count ?? 0,
  });
}, { route: '/api/admin/org/has-tournaments' });
