import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById, createLeagueTeam, getTeamsForSeason, getTeamsForDivision } from '@/lib/db';
import { houseLeagueTeamCap, leagueCapHit } from '@/lib/free-floor';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_house_league')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_house_league')) return forbidden();
  return null;
}

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ seasonId: string }> },) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const url = new URL(req.url);
  const divisionId = url.searchParams.get('divisionId');

  const teams = divisionId
    ? await getTeamsForDivision(divisionId)
    : await getTeamsForSeason(seasonId);

  // Count active players per team
  const { data: regData } = await supabaseAdmin
    .from('league_registrations')
    .select('team_id')
    .eq('season_id', seasonId)
    .eq('status', 'active')
    .not('team_id', 'is', null);

  const playerCounts = new Map<string, number>();
  for (const row of regData ?? []) {
    const tid = row.team_id as string;
    playerCounts.set(tid, (playerCounts.get(tid) ?? 0) + 1);
  }

  return NextResponse.json({
    teams: teams.map(t => ({ ...t, playerCount: playerCounts.get(t.id) ?? 0 })),
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/teams' });

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
  const { divisionId } = body;
  if (!divisionId) return NextResponse.json({ error: 'divisionId required' }, { status: 400 });

  // Support single { name } or bulk { teams: [{name}] }
  const defs: Array<{ name: string; color?: string | null; coachName?: string | null }> =
    Array.isArray(body.teams)
      ? body.teams
      : [{ name: body.name, color: body.color ?? null, coachName: body.coachName ?? null }];

  if (!defs.length || !defs[0]?.name?.trim()) {
    return NextResponse.json({ error: 'At least one team name required' }, { status: 400 });
  }

  // Free-floor (League Starter) cap: up to 8 teams per season. Counts existing teams + the
  // incoming batch so a bulk { teams: [...] } insert can't slip past. Paid plans are uncapped.
  const teamCap = houseLeagueTeamCap(ctx!.org);
  if (teamCap < Infinity) {
    const existingTeams = await getTeamsForSeason(seasonId);
    if (existingTeams.length + defs.length > teamCap) {
      await writePlatformEvent({
        eventType: 'scope_wall_hit',
        source: 'app',
        orgId: ctx!.org.id,
        actorUserId: ctx!.user?.id ?? null,
        actorEmail: ctx!.user?.email ?? null,
        metadata: { freeFloor: 'league_starter', capHit: 'league_team', seasonId, attempted: existingTeams.length + defs.length },
      });
      return NextResponse.json(leagueCapHit('league_team'), { status: 403 });
    }
  }

  const created = await Promise.all(
    defs.map((t, i) =>
      createLeagueTeam(seasonId, divisionId, {
        name:      t.name.trim(),
        color:     t.color ?? null,
        coachName: t.coachName ?? null,
        sortOrder: i,
      })
    )
  );

  return NextResponse.json({ teams: created }, { status: 201 });
}, { route: '/api/admin/house-league/seasons/[seasonId]/teams' });
