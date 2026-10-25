import { NextRequest, NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById, cancelPractice } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

export const PATCH = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ seasonId: string; practiceId: string }> },) => {
  const { seasonId, practiceId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'run');
  if (err || !ctx) return err!; // a signed-out ctx is always refused

  // Ownership: the practice must live in THIS org's season. This route used to trust the
  // raw id — and scope 'all' cancels an entire recurring series, which makes a guessed
  // foreign UUID a destructive cross-org write. Same rails as the sibling routes now.
  const season = await getLeagueSeasonById(seasonId, ctx.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const refused = houseLeagueRefusal(ctx, 'run', season);
  if (refused) return refused;
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
