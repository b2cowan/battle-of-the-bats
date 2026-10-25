import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { getLeagueSeasonById, computeStandings } from '@/lib/db';
import { divisionInSeason } from '@/lib/league-season-scope';
import { withObservability } from '@/lib/observability';

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

  const standings = await computeStandings(divisionId);
  return NextResponse.json({ standings });
}, { route: '/api/admin/house-league/seasons/[seasonId]/standings' });
