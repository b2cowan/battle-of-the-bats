import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Public registration counts for ONE tournament's divisions — the public Register page reads them to show how full a
 * division is (components/public/RegisterContent.tsx, its only caller).
 *
 * Until 2026-10-16 this route also answered `?teamId=` with that team's games, building a PostgREST filter string from
 * the raw parameter on a service-role client: `?teamId=x,id.not.is.null` returned every game in every organization,
 * unpublished events included, to anyone. No screen used it; it was removed (the second sweep, TODO 🔒). Counts are
 * served only for a tournament the public pages show — active or completed — and never for every tournament at once.
 */
export const GET = withObservability(async (req: Request) => {
  try {
    const tournamentId = new URL(req.url).searchParams.get('tournament_id');
    if (!tournamentId || !isUuid(tournamentId)) return NextResponse.json({});

    const { data: tournament, error: tournamentError } = await supabaseAdmin
      .from('tournaments')
      .select('status')
      .eq('id', tournamentId)
      .maybeSingle();
    if (tournamentError) throw tournamentError;
    if (!tournament || (tournament.status !== 'active' && tournament.status !== 'completed')) {
      return NextResponse.json({});
    }

    const { data, error } = await supabaseAdmin
      .from('teams')
      .select('division_id, status')
      .eq('tournament_id', tournamentId);

    if (error) {
      console.error('Stats query error:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    // Count non-rejected registrations per division
    const counts: Record<string, number> = {};
    for (const reg of data || []) {
      if (reg.status !== 'rejected') {
        counts[reg.division_id] = (counts[reg.division_id] || 0) + 1;
      }
    }

    return NextResponse.json(counts);
  } catch (e: unknown) {
    console.error('Public Stats API Error:', e);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}, { route: '/api/public/stats' });
