import { NextResponse } from 'next/server';
import { getAuthContextWithScope, forbidden, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasPlanFeature, requiresPlanCopy } from '@/lib/plan-features';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type {
  TournamentScheduleImportContext,
  TournamentScheduleImportDivision,
  TournamentScheduleImportExistingGame,
  TournamentScheduleImportTeam,
  TournamentScheduleImportVenue,
  TournamentScheduleImportVenueFacility,
} from '@/lib/import/tournament-schedule';

export type RouteParams = { params: Promise<{ tournamentId: string }> };

type TournamentRow = {
  id: string;
  name: string;
  year: number | null;
  org_id: string | null;
  status: string | null;
  settings: Record<string, unknown> | null;
};

type DivisionRow = {
  id: string;
  name: string;
  settings: Record<string, unknown> | null;
};

type TeamRow = {
  id: string;
  division_id: string | null;
  name: string;
  status: string | null;
};

type VenueRow = {
  id: string;
  name: string;
};

type VenueFacilityRow = {
  id: string;
  venue_id: string;
  name: string;
};

type GameRow = {
  id: string;
  division_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  game_date: string | null;
  game_time: string | null;
  location: string | null;
  diamond_id: string | null;
  venue_facility_id: string | null;
  schedule_facility_lane_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string | null;
  is_playoff: boolean | null;
  generator_locked: boolean | null;
  home_slot_id: string | null;
  away_slot_id: string | null;
  notes: string | null;
};

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tournament';
}

export async function authorizeTournamentScheduleImport(
  req: Request,
  tournamentId: string,
  options: { blockLocked: boolean },
) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return { response: unauthorized() };
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_tournaments')) return { response: forbidden() };
  if (
    !hasCapability(ctx.role, ctx.capabilities, 'manage_schedule_structure') &&
    !hasCapability(ctx.role, ctx.capabilities, 'update_schedule') &&
    !hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')
  ) {
    return { response: forbidden() };
  }
  if (!hasPlanFeature(ctx.org.planId, 'bulk_data_imports')) {
    return { response: json({ error: requiresPlanCopy('bulk_data_imports') }, 403) };
  }

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return { response: denied };

  const { data: tournament, error } = await supabaseAdmin
    .from('tournaments')
    .select('id, name, year, org_id, status, settings')
    .eq('id', tournamentId)
    .maybeSingle<TournamentRow>();

  if (error) return { response: json({ error: error.message }, 500) };
  if (!tournament || tournament.org_id !== ctx.org.id) return { response: forbidden() };
  if (options.blockLocked && tournament.status === 'completed') {
    return {
      response: json({
        error: 'This tournament is completed and locked. Set the status to Active in Event Settings to preview schedule imports.',
      }, 409),
    };
  }

  return { ctx, tournament };
}

export async function loadTournamentScheduleImportContext(input: {
  tournamentId: string;
  orgId: string;
  tournament: TournamentRow;
}): Promise<TournamentScheduleImportContext> {
  const [
    { data: divisionRows, error: divisionError },
    { data: teamRows, error: teamError },
    { data: venueRows, error: venueError },
    { data: gameRows, error: gameError },
  ] = await Promise.all([
    supabaseAdmin
      .from('divisions')
      .select('id, name, settings')
      .eq('tournament_id', input.tournamentId)
      .order('display_order', { ascending: true }),
    supabaseAdmin
      .from('teams')
      .select('id, division_id, name, status')
      .eq('tournament_id', input.tournamentId)
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('diamonds')
      .select('id, name')
      .eq('tournament_id', input.tournamentId)
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('games')
      .select('id, division_id, home_team_id, away_team_id, game_date, game_time, location, diamond_id, venue_facility_id, schedule_facility_lane_id, home_score, away_score, status, is_playoff, generator_locked, home_slot_id, away_slot_id, notes')
      .eq('tournament_id', input.tournamentId)
      .order('game_date', { ascending: true })
      .order('game_time', { ascending: true }),
  ]);

  if (divisionError) throw new Error(divisionError.message);
  if (teamError) throw new Error(teamError.message);
  if (venueError) throw new Error(venueError.message);
  if (gameError) throw new Error(gameError.message);

  const venueIds = (venueRows ?? []).map((venue: VenueRow) => venue.id);
  let facilities: VenueFacilityRow[] = [];
  if (venueIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('venue_facilities')
      .select('id, venue_id, name')
      .in('venue_id', venueIds)
      .order('display_order', { ascending: true });
    if (error) throw new Error(error.message);
    facilities = (data ?? []) as VenueFacilityRow[];
  }

  const facilitiesByVenue = new Map<string, TournamentScheduleImportVenueFacility[]>();
  for (const facility of facilities) {
    const mapped = {
      id: facility.id,
      venueId: facility.venue_id,
      name: facility.name,
    };
    facilitiesByVenue.set(facility.venue_id, [...(facilitiesByVenue.get(facility.venue_id) ?? []), mapped]);
  }

  const divisions: TournamentScheduleImportDivision[] = (divisionRows ?? []).map((division: DivisionRow) => ({
    id: division.id,
    name: division.name,
    settings: division.settings,
  }));

  const teams: TournamentScheduleImportTeam[] = (teamRows ?? []).map((team: TeamRow) => ({
    id: team.id,
    divisionId: team.division_id ?? '',
    name: team.name,
    status: team.status,
  }));

  const venues: TournamentScheduleImportVenue[] = (venueRows ?? []).map((venue: VenueRow) => ({
    id: venue.id,
    name: venue.name,
    facilities: facilitiesByVenue.get(venue.id) ?? [],
  }));

  const games: TournamentScheduleImportExistingGame[] = (gameRows ?? []).map((game: GameRow) => ({
    id: game.id,
    divisionId: game.division_id ?? '',
    homeTeamId: game.home_team_id,
    awayTeamId: game.away_team_id,
    gameDate: game.game_date,
    startTime: game.game_time,
    location: game.location,
    venueId: game.diamond_id,
    venueFacilityId: game.venue_facility_id,
    scheduleFacilityLaneId: game.schedule_facility_lane_id,
    homeScore: game.home_score,
    awayScore: game.away_score,
    status: game.status,
    isPlayoff: game.is_playoff ?? false,
    generatorLocked: game.generator_locked ?? false,
    homeSlotId: game.home_slot_id,
    awaySlotId: game.away_slot_id,
    notes: game.notes,
  }));

  return {
    tournamentId: input.tournamentId,
    orgId: input.orgId,
    tournament: {
      id: input.tournament.id,
      name: input.tournament.name,
      settings: input.tournament.settings,
    },
    divisions,
    teams,
    venues,
    games,
  };
}
