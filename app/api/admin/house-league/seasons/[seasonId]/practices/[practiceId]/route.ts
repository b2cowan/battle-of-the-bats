import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById, cancelPractice } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

export const PATCH = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ seasonId: string; practiceId: string }> },) => {
  const { seasonId, practiceId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!hasModuleEntitlement(ctx.org, 'module_house_league'))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (ctx.role !== 'owner' && ctx.role !== 'league_admin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Ownership: the practice must live in THIS org's season. This route used to trust the
  // raw id — and scope 'all' cancels an entire recurring series, which makes a guessed
  // foreign UUID a destructive cross-org write. Same rails as the sibling routes now.
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const { data: practice } = await supabaseAdmin
    .from('league_practices')
    .select('id')
    .eq('id', practiceId)
    .eq('season_id', seasonId)
    .single();
  if (!practice) return NextResponse.json({ error: 'Practice not found' }, { status: 404 });

  const { action, scope = 'one' } = await req.json();
  if (action !== 'cancel')
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  if (!['one', 'remaining', 'all'].includes(scope))
    return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });

  await cancelPractice(practiceId, scope as 'one' | 'remaining' | 'all');
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/house-league/seasons/[seasonId]/practices/[practiceId]' });
