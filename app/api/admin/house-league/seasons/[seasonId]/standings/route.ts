import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById, computeStandings } from '@/lib/db';
import { divisionInSeason } from '@/lib/league-season-scope';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

/**
 * The club's standings table (House League 9e-1, frame s6): the division ranked the way the public page ranks it, with
 * the sport's words and what families can see — its schedule published, its "Show standings" on. The admin table shows
 * either way; the page says when families can't.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });
  const divisionId = url.searchParams.get('divisionId');
  if (!divisionId) {
    return NextResponse.json({ error: 'divisionId required' }, { status: 400 });
  }
  // Ownership: standings are read by division id alone — it must be this season's (plan I01).
  if (!(await divisionInSeason(seasonId, divisionId))) {
    return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  }

  const [standings, { data: division, error }] = await Promise.all([
    computeStandings(divisionId, season.sport),
    supabaseAdmin.from('league_divisions').select('name, schedule_published_at, show_standings').eq('id', divisionId).single(),
  ]);
  if (error || !division) return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  return NextResponse.json({
    standings,
    division: {
      name: division.name as string,
      published: !!division.schedule_published_at,
      showStandings: division.show_standings !== false,
    },
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/standings' });
