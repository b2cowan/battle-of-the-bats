import { forbidden, getAuthContextWithScope, requireTournamentInOrg, scopeGuard, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

type LaneRow = {
  id: string;
  tournament_id: string;
  division_id: string;
  label: string;
  sort_order: number;
  resolved_venue_id: string | null;
  resolved_venue_facility_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ResolveMapping = {
  laneId: string;
  venueId?: string | null;
  venueFacilityId?: string | null;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function mapLane(row: LaneRow) {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    divisionId: row.division_id,
    label: row.label,
    sortOrder: row.sort_order,
    resolvedVenueId: row.resolved_venue_id,
    resolvedVenueFacilityId: row.resolved_venue_facility_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isMissingLaneTable(error: { code?: string; message?: string } | null) {
  return error?.code === '42P01' || (error?.message ?? '').includes('schedule_facility_lanes');
}

async function requireWritableTournament(ctx: Awaited<ReturnType<typeof getAuthContextWithScope>>, tournamentId: string) {
  if (!ctx) return unauthorized();
  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  const { data } = await supabaseAdmin
    .from('tournaments')
    .select('status')
    .eq('id', tournamentId)
    .single();
  if (data?.status === 'completed') {
    return json({ error: 'This tournament is completed and locked. Set the status to Active in Event Settings to make changes.' }, 409);
  }

  return null;
}

async function ensureDivisionInTournament(tournamentId: string, divisionId: string) {
  const { data, error } = await supabaseAdmin
    .from('divisions')
    .select('id')
    .eq('id', divisionId)
    .eq('tournament_id', tournamentId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function fetchLanes(tournamentId: string, divisionId?: string | null) {
  let query = supabaseAdmin
    .from('schedule_facility_lanes')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });
  if (divisionId) query = query.eq('division_id', divisionId);
  return query;
}

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const tournamentId = url.searchParams.get('tournamentId');
  const divisionId = url.searchParams.get('divisionId');
  if (!tournamentId) return json([]);

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;
  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  const { data, error } = await fetchLanes(tournamentId, divisionId);
  if (error) {
    if (isMissingLaneTable(error)) return json([]);
    return json({ error: error.message }, 500);
  }

  return json((data ?? []).map(row => mapLane(row as LaneRow)));
}, { route: '/api/admin/schedule-facility-lanes' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  try {
    const body = await req.json();
    const action = body.action as string | undefined;

    if (action === 'ensure') {
      if (!hasCapability(ctx.role, ctx.capabilities, 'manage_schedule_structure')) return forbidden();

      const tournamentId = body.tournamentId as string | undefined;
      const divisionId = body.divisionId as string | undefined;
      const labels = Array.from(new Set(
        ((body.labels ?? []) as unknown[])
          .map(label => String(label).trim())
          .filter(Boolean),
      )).slice(0, 24);

      if (!tournamentId || !divisionId || labels.length === 0) {
        return json({ error: 'tournamentId, divisionId, and labels are required.' }, 400);
      }

      const lockOrScope = await requireWritableTournament(ctx, tournamentId);
      if (lockOrScope) return lockOrScope;
      if (!await ensureDivisionInTournament(tournamentId, divisionId)) {
        return json({ error: 'Division not found for tournament.' }, 404);
      }

      const { data: existingRows, error: existingError } = await fetchLanes(tournamentId, divisionId);
      if (existingError) {
        if (isMissingLaneTable(existingError)) {
          return json({ error: 'Schedule facility lanes migration has not been applied.' }, 500);
        }
        throw existingError;
      }

      const existing = (existingRows ?? []) as LaneRow[];
      const existingLabels = new Set(existing.map(row => row.label));
      const toInsert = labels
        .filter(label => !existingLabels.has(label))
        .map((label, index) => ({
          tournament_id: tournamentId,
          division_id: divisionId,
          label,
          sort_order: existing.length + index + 1,
        }));

      if (toInsert.length > 0) {
        const { error: insertError } = await supabaseAdmin.from('schedule_facility_lanes').insert(toInsert);
        if (insertError && insertError.code !== '23505') throw insertError;
      }

      const { data: lanes, error } = await fetchLanes(tournamentId, divisionId);
      if (error) throw error;
      return json({ lanes: (lanes ?? []).map(row => mapLane(row as LaneRow)) });
    }

    if (action === 'resolve') {
      if (!hasCapability(ctx.role, ctx.capabilities, 'update_schedule')) return forbidden();

      const tournamentId = body.tournamentId as string | undefined;
      const divisionId = body.divisionId as string | undefined;
      const mappings = ((body.mappings ?? []) as ResolveMapping[])
        .filter(mapping => mapping.laneId);

      if (!tournamentId || !divisionId || mappings.length === 0) {
        return json({ error: 'tournamentId, divisionId, and mappings are required.' }, 400);
      }

      const lockOrScope = await requireWritableTournament(ctx, tournamentId);
      if (lockOrScope) return lockOrScope;
      if (!await ensureDivisionInTournament(tournamentId, divisionId)) {
        return json({ error: 'Division not found for tournament.' }, 404);
      }

      const laneIds = [...new Set(mappings.map(mapping => mapping.laneId))];
      const { data: laneRows, error: laneError } = await supabaseAdmin
        .from('schedule_facility_lanes')
        .select('*')
        .in('id', laneIds);
      if (laneError) throw laneError;

      const laneById = new Map((laneRows ?? []).map(row => [row.id as string, row as LaneRow]));
      if (laneById.size !== laneIds.length) return json({ error: 'One or more temporary facilities were not found.' }, 404);
      for (const lane of laneById.values()) {
        if (lane.tournament_id !== tournamentId || lane.division_id !== divisionId) {
          return json({ error: 'Temporary facility does not belong to this division.' }, 403);
        }
      }

      const facilityIds = [...new Set(mappings.map(mapping => mapping.venueFacilityId).filter(Boolean))] as string[];
      const { data: facilities, error: facilityError } = facilityIds.length > 0
        ? await supabaseAdmin
            .from('venue_facilities')
            .select('id, venue_id, name, tournament_id')
            .in('id', facilityIds)
        : { data: [], error: null };
      if (facilityError) throw facilityError;
      const facilityById = new Map((facilities ?? []).map(row => [row.id as string, row]));

      const venueIds = new Set<string>();
      mappings.forEach(mapping => { if (mapping.venueId) venueIds.add(mapping.venueId); });
      (facilities ?? []).forEach(facility => venueIds.add(facility.venue_id as string));
      const { data: venues, error: venueError } = venueIds.size > 0
        ? await supabaseAdmin
            .from('diamonds')
            .select('id, name, tournament_id')
            .in('id', Array.from(venueIds))
        : { data: [], error: null };
      if (venueError) throw venueError;
      const venueById = new Map((venues ?? []).map(row => [row.id as string, row]));

      for (const mapping of mappings) {
        const lane = laneById.get(mapping.laneId)!;
        const facility = mapping.venueFacilityId ? facilityById.get(mapping.venueFacilityId) : null;
        if (mapping.venueFacilityId && !facility) return json({ error: 'Selected facility not found.' }, 404);
        if (facility && facility.tournament_id !== tournamentId) return json({ error: 'Selected facility is outside this tournament.' }, 403);

        const resolvedVenueId = (facility?.venue_id as string | undefined) ?? mapping.venueId ?? null;
        const venue = resolvedVenueId ? venueById.get(resolvedVenueId) : null;
        if (resolvedVenueId && !venue) return json({ error: 'Selected venue not found.' }, 404);
        if (venue && venue.tournament_id !== tournamentId) return json({ error: 'Selected venue is outside this tournament.' }, 403);

        const resolvedFacilityId = facility ? (facility.id as string) : null;
        const location = venue
          ? (facility ? `${venue.name as string} - ${facility.name as string}` : venue.name as string)
          : lane.label;

        const now = new Date().toISOString();
        const { error: updateLaneError } = await supabaseAdmin
          .from('schedule_facility_lanes')
          .update({
            resolved_venue_id: resolvedVenueId,
            resolved_venue_facility_id: resolvedFacilityId,
            updated_at: now,
          })
          .eq('id', lane.id);
        if (updateLaneError) throw updateLaneError;

        const { error: updateGamesError } = await supabaseAdmin
          .from('games')
          .update({
            diamond_id: resolvedVenueId,
            venue_facility_id: resolvedFacilityId,
            location,
          })
          .eq('schedule_facility_lane_id', lane.id);
        if (updateGamesError) throw updateGamesError;
      }

      const { data: lanes, error } = await fetchLanes(tournamentId, divisionId);
      if (error) throw error;
      return json({ lanes: (lanes ?? []).map(row => mapLane(row as LaneRow)) });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (err: unknown) {
    console.error('Schedule Facility Lanes API error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown server error' }, 500);
  }
}, { route: '/api/admin/schedule-facility-lanes' });
