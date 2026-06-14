import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById, getTeamsForDivision } from '@/lib/db';
import { isFreeFloorLeague } from '@/lib/free-floor';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

interface PreviewGame {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  scheduledAt: string;
  location: string | null;
}

// Standard circle-method round-robin. Returns rounds as arrays of [homeId, awayId] pairs.
// Handles odd team counts by inserting a 'BYE' placeholder; bye-games are omitted.
function roundRobin(teamIds: string[]): Array<Array<[string, string]>> {
  if (teamIds.length < 2) return [];

  const teams = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, 'BYE'];
  const n = teams.length;
  const fixed = teams[0];
  const rotating = teams.slice(1);
  const rounds: Array<Array<[string, string]>> = [];

  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[string, string]> = [];

    const opp = rotating[r % rotating.length];
    if (fixed !== 'BYE' && opp !== 'BYE') pairs.push([fixed, opp]);

    for (let i = 1; i < n / 2; i++) {
      const home = rotating[(r - i + rotating.length) % rotating.length];
      const away = rotating[(r + i) % rotating.length];
      if (home !== 'BYE' && away !== 'BYE') pairs.push([home, away]);
    }

    rounds.push(pairs);
  }

  return rounds;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const body = await req.json();
  const { divisionId, startDate, gamesPerWeek = 1, gameTime = '18:00', location = null, save = false } = body;

  if (!divisionId || !startDate) {
    return NextResponse.json({ error: 'divisionId and startDate required' }, { status: 400 });
  }

  const teams = await getTeamsForDivision(divisionId);
  if (teams.length < 2) {
    return NextResponse.json({ error: 'At least 2 teams required to generate a schedule' }, { status: 422 });
  }

  const rounds = roundRobin(teams.map(t => t.id));

  const preview: PreviewGame[] = rounds.flatMap((pairs, roundIndex) => {
    const weekOffset = Math.floor(roundIndex / gamesPerWeek);
    const gameDate = addDays(startDate, weekOffset * 7);
    const scheduledAt = new Date(`${gameDate}T${gameTime}`).toISOString();

    return pairs.map(([homeTeamId, awayTeamId]) => ({
      round: roundIndex + 1,
      homeTeamId,
      awayTeamId,
      scheduledAt,
      location,
    }));
  });

  if (!save) {
    return NextResponse.json({ preview, roundCount: rounds.length, gameCount: preview.length });
  }

  // Save all games
  const inserts = preview.map(g => ({
    org_id:       ctx!.org.id,
    season_id:    seasonId,
    division_id:  divisionId,
    home_team_id: g.homeTeamId,
    away_team_id: g.awayTeamId,
    scheduled_at: g.scheduledAt,
    location:     g.location,
  }));

  const { data, error } = await supabaseAdmin
    .from('league_games')
    .insert(inserts)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Instrumentation (§13): League Starter first-value signal (a generated schedule). Only on a real
  // save, gated to the free floor so the metric tracks free-tier activation. Fire-and-forget.
  if (isFreeFloorLeague(ctx!.org)) {
    await writePlatformEvent({
      eventType: 'league_schedule_generated',
      source: 'app',
      orgId: ctx!.org.id,
      actorUserId: ctx!.user?.id ?? null,
      actorEmail: ctx!.user?.email ?? null,
      metadata: { freeFloor: 'league_starter', seasonId, divisionId, gameCount: (data ?? []).length },
    });
  }

  const games = (data ?? []).map((row: any) => ({
    id:          row.id,
    seasonId:    row.season_id,
    divisionId:  row.division_id,
    homeTeamId:  row.home_team_id,
    awayTeamId:  row.away_team_id,
    scheduledAt: row.scheduled_at ?? null,
    location:    row.location ?? null,
    homeScore:   null,
    awayScore:   null,
    status:      row.status,
    notes:       null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }));

  return NextResponse.json({ games, roundCount: rounds.length, gameCount: games.length });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/generate' });
