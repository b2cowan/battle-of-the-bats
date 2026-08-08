import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLeagueSeasonById, getTeamsForDivision } from '@/lib/db';
import { resolveLeagueVenueSelection, checkLeagueBookings } from '@/lib/league-venue';
import { isFreeFloorLeague } from '@/lib/free-floor';
import { writePlatformEvent } from '@/lib/platform-events';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { zonedWallClockToUtc } from '@/lib/timezone';

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
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'league_admin') return forbidden();

  const { seasonId } = await params;
  const season = await getLeagueSeasonById(seasonId, ctx!.org.id);
  if (!season) return NextResponse.json({ error: 'Season not found' }, { status: 404 });

  const body = await req.json();
  const { divisionId, startDate, gamesPerWeek = 1, gameTime = '18:00', save = false } = body;

  if (!divisionId || !startDate) {
    return NextResponse.json({ error: 'divisionId and startDate required' }, { status: 400 });
  }

  // Ownership: the division must live in THIS org's season — a foreign division id would
  // otherwise be read (and its team names echoed back through conflict warnings).
  const { data: division } = await supabaseAdmin
    .from('league_divisions')
    .select('id')
    .eq('id', divisionId)
    .eq('season_id', seasonId)
    .single();
  if (!division) return NextResponse.json({ error: 'Division not found' }, { status: 404 });

  // Default field: picked from the org venue library (server derives the display string)
  // or free text — same rules as a single game.
  const selection = await resolveLeagueVenueSelection({
    orgId: ctx!.org.id,
    orgVenueId: body.orgVenueId ?? null,
    orgVenueFacilityId: body.orgVenueFacilityId ?? null,
    locationText: body.location ?? null,
  });
  if (!selection.ok) return NextResponse.json({ error: selection.error }, { status: 400 });
  const location = selection.value.location;

  const teams = await getTeamsForDivision(divisionId);
  if (teams.length < 2) {
    return NextResponse.json({ error: 'At least 2 teams required to generate a schedule' }, { status: 422 });
  }

  const rounds = roundRobin(teams.map(t => t.id));

  const preview: PreviewGame[] = rounds.flatMap((pairs, roundIndex) => {
    const weekOffset = Math.floor(roundIndex / gamesPerWeek);
    const gameDate = addDays(startDate, weekOffset * 7);
    // J3-047: interpret the wall-clock game time in the org's zone (America/Toronto V1),
    // not the server's runtime zone — `new Date(`${date}T${time}`)` on UTC Amplify shifted
    // every game 4–5h. Falls back to the naive instant only if the time is malformed.
    const scheduledAt = zonedWallClockToUtc(gameDate, gameTime) ?? new Date(`${gameDate}T${gameTime}`).toISOString();

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

  // Clash check — WARN ONLY, never block. A generated round puts several games at the same
  // default time, so with one shared field the round genuinely overlaps itself; blocking
  // would make the generator unusable, and its output is meant to be edited afterwards.
  // The warnings (against existing bookings AND between generated siblings) go back to the
  // organizer instead of the silence this project exists to end.
  const nameOf = new Map(teams.map(t => [t.id, t.name]));
  const check = await checkLeagueBookings({
    orgId: ctx!.org.id,
    proposed: preview.map((g, i) => ({
      id: `new-${i}`, kind: 'game' as const,
      startsAt: g.scheduledAt, endsAt: null,
      orgVenueId: selection.value.orgVenueId,
      orgVenueFacilityId: selection.value.orgVenueFacilityId,
      location: g.location,
      label: `${nameOf.get(g.homeTeamId) ?? 'Home'} vs ${nameOf.get(g.awayTeamId) ?? 'Away'} (R${g.round})`,
    })),
  });
  const conflictMessages = [...check.blocking, ...check.warnings].map(c => c.message);

  // Save all games
  const inserts = preview.map(g => ({
    org_id:       ctx!.org.id,
    season_id:    seasonId,
    division_id:  divisionId,
    home_team_id: g.homeTeamId,
    away_team_id: g.awayTeamId,
    scheduled_at: g.scheduledAt,
    org_venue_id:          selection.value.orgVenueId,
    org_venue_facility_id: selection.value.orgVenueFacilityId,
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
    endsAt:      row.ends_at ?? null,
    orgVenueId:         row.org_venue_id ?? null,
    orgVenueFacilityId: row.org_venue_facility_id ?? null,
    location:    row.location ?? null,
    homeScore:   null,
    awayScore:   null,
    status:      row.status,
    notes:       null,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  }));

  return NextResponse.json({
    games, roundCount: rounds.length, gameCount: games.length,
    warnings: conflictMessages,
  });
}, { route: '/api/admin/house-league/seasons/[seasonId]/schedule/generate' });
