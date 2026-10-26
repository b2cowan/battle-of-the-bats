import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { houseLeagueRefusal } from '@/lib/house-league-gate';
import { houseLeagueAccess } from '@/lib/house-league-access';
import { getLeagueSeasonById } from '@/lib/db';
import { divisionInSeason } from '@/lib/league-season-scope';
import { readDivisionBoard, readDivisionTabs } from '@/lib/house-league-teams';
import { getRatings } from '@/lib/house-league-ratings';
import { withObservability } from '@/lib/observability';

/**
 * Teams & draft's one read (Club Tier 9c): the season's division tabs and one division's board. Anyone who opens house
 * league reads it (the registrar too, copy §13); a rating is added ONLY for a reader the gate lets see one (9c·2a).
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const url = new URL(req.url);
  const ctx = await getAuthContextWithRole({ orgSlug: url.searchParams.get('orgSlug') ?? undefined, requireOrgSlug: true });
  const err = houseLeagueRefusal(ctx, 'read');
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const tabs = await readDivisionTabs(seasonId);
  const asked = url.searchParams.get('divisionId');
  const divisionId = asked ?? tabs[0]?.id ?? null;
  if (asked && !(await divisionInSeason(seasonId, asked))) {
    return NextResponse.json({ error: 'Division not found' }, { status: 404 });
  }
  const board = divisionId ? await readDivisionBoard(season, divisionId) : null;

  // 9c·2a: the registrar, the treasurer and everyone else who is not a runner get no rating, not even an empty map.
  const access = houseLeagueAccess(ctx!, ctx!.org, season);
  let ratings: Record<string, number> | undefined;
  if (board && access.seeRatings && !houseLeagueRefusal(ctx, 'seeRatings', season)) {
    ratings = Object.fromEntries(await getRatings(seasonId, board.players.map(p => p.id)));
  }
  return NextResponse.json({ tabs, board, ...(ratings ? { ratings } : {}) });
}, { route: '/api/admin/house-league/seasons/[seasonId]/teams-board' });
