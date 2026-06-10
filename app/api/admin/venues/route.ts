import { NextResponse } from 'next/server';
import { getAuthContextWithScope, unauthorized, forbidden, scopeGuard, requireTournamentInOrg } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapVenue(row: any, facilities?: any[]) {
  const base = {
    id:               row.id,
    tournamentId:     row.tournament_id,
    name:             row.name,
    address:          row.address  ?? null,
    notes:            row.notes    ?? null,
    sourceOrgVenueId: row.source_org_venue_id ?? null,
  };
  if (facilities === undefined) return base;
  return { ...base, facilities: facilities.map(mapFacility) };
}

function mapFacility(f: any) {
  return {
    id:                   f.id,
    venueId:              f.venue_id,
    tournamentId:         f.tournament_id,
    name:                 f.name,
    facilityType:         f.facility_type,
    displayOrder:         f.display_order,
    notes:                f.notes ?? null,
    sourceOrgFacilityId:  f.source_org_facility_id ?? null,
  };
}

// ---------------------------------------------------------------------------
// Game-impact helpers — a venue/facility cannot be deleted while it is still
// linked to a *played* game (one with a recorded result). When an upcoming
// game's venue is deleted we fully detach it (clear the FK links AND the stale
// location text) so it reads as TBD/blank — a game's location is always either
// a real linked venue or nothing, never dangling free text.
// ---------------------------------------------------------------------------

const PLAYED_STATUSES = new Set(['completed', 'submitted']);

function isPlayedGame(g: { status?: string | null; home_score?: number | null; away_score?: number | null }) {
  if (g.status && PLAYED_STATUSES.has(g.status)) return true;
  return g.home_score != null && g.away_score != null;
}

// All games linked to a venue: directly (diamond_id) or via any of its facilities.
async function getVenueGameImpact(venueId: string, facilityIds: string[]) {
  const orParts = [`diamond_id.eq.${venueId}`];
  if (facilityIds.length) orParts.push(`venue_facility_id.in.(${facilityIds.join(',')})`);
  const { data, error } = await supabaseAdmin
    .from('games')
    .select('status, home_score, away_score')
    .or(orParts.join(','));
  if (error) throw error;
  const games = data ?? [];
  return { total: games.length, played: games.filter(isPlayedGame).length };
}

async function blockIfPlayedVenue(venueId: string) {
  const { data: facs } = await supabaseAdmin
    .from('venue_facilities').select('id').eq('venue_id', venueId);
  const facilityIds = (facs ?? []).map(f => f.id);
  const { played } = await getVenueGameImpact(venueId, facilityIds);
  if (played > 0) {
    return NextResponse.json(
      { error: `This venue can't be deleted — it's used by ${played} played game${played === 1 ? '' : 's'}. Rename it instead if the location changed.`, playedCount: played },
      { status: 409 },
    );
  }
  return null;
}

async function blockIfPlayedFacility(facilityId: string) {
  const { data, error } = await supabaseAdmin
    .from('games').select('status, home_score, away_score').eq('venue_facility_id', facilityId);
  if (error) throw error;
  const played = (data ?? []).filter(isPlayedGame).length;
  if (played > 0) {
    return NextResponse.json(
      { error: `This facility can't be removed — it's used by ${played} played game${played === 1 ? '' : 's'}.`, playedCount: played },
      { status: 409 },
    );
  }
  return null;
}

// Detach a venue from every game that referenced it (directly or via a facility):
// clear the FK links AND the now-meaningless location text → game shows TBD/blank.
// Call BEFORE deleting the venue. Only reached once the played-game guard passes,
// so this never erases the recorded location of a game that was actually played.
async function clearVenueFromGames(venueId: string) {
  const { data: facs } = await supabaseAdmin
    .from('venue_facilities').select('id').eq('venue_id', venueId);
  const facilityIds = (facs ?? []).map(f => f.id);
  const orParts = [`diamond_id.eq.${venueId}`];
  if (facilityIds.length) orParts.push(`venue_facility_id.in.(${facilityIds.join(',')})`);
  const { error } = await supabaseAdmin
    .from('games')
    .update({ location: null, diamond_id: null, venue_facility_id: null })
    .or(orParts.join(','));
  if (error) throw error;
}

// Detach a single facility from its games. Games that still belong to the parent
// venue keep that link and fall back to the venue name; games whose only link was
// this facility go to TBD/blank. Call BEFORE deleting the facility.
async function clearFacilityFromGames(facilityId: string) {
  const { data: fac } = await supabaseAdmin
    .from('venue_facilities').select('venue_id').eq('id', facilityId).single();
  let venueName: string | null = null;
  if (fac?.venue_id) {
    const { data: v } = await supabaseAdmin.from('diamonds').select('name').eq('id', fac.venue_id).single();
    venueName = v?.name ?? null;
  }
  // Still attached to a parent venue → location falls back to the venue name.
  const { error: e1 } = await supabaseAdmin
    .from('games')
    .update({ location: venueName, venue_facility_id: null })
    .eq('venue_facility_id', facilityId)
    .not('diamond_id', 'is', null);
  if (e1) throw e1;
  // No parent venue left → TBD/blank.
  const { error: e2 } = await supabaseAdmin
    .from('games')
    .update({ location: null, venue_facility_id: null })
    .eq('venue_facility_id', facilityId)
    .is('diamond_id', null);
  if (e2) throw e2;
}

// ---------------------------------------------------------------------------
// GET /api/admin/venues
//   ?tournamentId=<id>           — venues for one tournament (with facilities)
//   ?scope=org                   — all venues across org's tournaments (flat)
//   ?scope=past&orgSlug=<slug>   — for import-from-past flow (no-org users)
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orgSlug        = searchParams.get('orgSlug') ?? undefined;
  const tournamentId   = searchParams.get('tournamentId');
  const scope          = searchParams.get('scope');
  const withGameCounts = searchParams.get('withGameCounts') === '1';

  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();

  // -- scope=org: all venues across all org tournaments ----------------------
  if (scope === 'org') {
    let tournamentQuery = supabaseAdmin
      .from('tournaments')
      .select('id, name, year')
      .eq('org_id', ctx.org.id)
      .order('year', { ascending: false });

    if (ctx.assignedTournamentIds !== null) {
      if (ctx.assignedTournamentIds.length === 0) return NextResponse.json([]);
      tournamentQuery = tournamentQuery.in('id', ctx.assignedTournamentIds);
    }

    const { data: tournaments, error: tErr } = await tournamentQuery;
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

    const tIds = (tournaments ?? []).map(t => t.id);
    if (tIds.length === 0) return NextResponse.json([]);

    const { data, error } = await supabaseAdmin
      .from('diamonds')
      .select('*')
      .in('tournament_id', tIds)
      .order('name', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const tById = new Map((tournaments ?? []).map(t => [t.id, `${t.name} (${t.year})`]));

    return NextResponse.json((data ?? []).map(row => ({
      ...mapVenue(row),
      tournamentName: tById.get(row.tournament_id) ?? null,
    })));
  }

  // -- scope=past: past-tournament import list (no-org users) ---------------
  if (scope === 'past') {
    let pastQuery = supabaseAdmin
      .from('tournaments')
      .select('id, name, year')
      .eq('org_id', ctx.org.id)
      .order('year', { ascending: false });

    if (ctx.assignedTournamentIds !== null) {
      if (ctx.assignedTournamentIds.length === 0) return NextResponse.json([]);
      pastQuery = pastQuery.in('id', ctx.assignedTournamentIds);
    }

    // Exclude current tournament if provided
    const currentTournamentId = searchParams.get('excludeTournamentId');
    if (currentTournamentId) {
      pastQuery = pastQuery.neq('id', currentTournamentId);
    }

    const { data: pastTournaments, error: ptErr } = await pastQuery;
    if (ptErr) return NextResponse.json({ error: ptErr.message }, { status: 500 });

    const pastIds = (pastTournaments ?? []).map(t => t.id);
    if (pastIds.length === 0) return NextResponse.json([]);

    const { data: venueData, error: vErr } = await supabaseAdmin
      .from('diamonds')
      .select('*')
      .in('tournament_id', pastIds)
      .order('name', { ascending: true });
    if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

    const venueIds = (venueData ?? []).map(v => v.id);
    const facilityByVenue: Record<string, any[]> = {};
    if (venueIds.length > 0) {
      const { data: facData } = await supabaseAdmin
        .from('venue_facilities')
        .select('*')
        .in('venue_id', venueIds)
        .order('display_order', { ascending: true });
      for (const f of facData ?? []) {
        facilityByVenue[f.venue_id] = facilityByVenue[f.venue_id] ?? [];
        facilityByVenue[f.venue_id].push(f);
      }
    }

    const tById = new Map((pastTournaments ?? []).map(t => [t.id, `${t.name} (${t.year})`]));

    return NextResponse.json((venueData ?? []).map(row => ({
      ...mapVenue(row, facilityByVenue[row.id] ?? []),
      tournamentName: tById.get(row.tournament_id) ?? null,
    })));
  }

  // -- default: single tournament venues with facilities --------------------
  if (!tournamentId) return NextResponse.json([]);

  const denied = scopeGuard(ctx, tournamentId);
  if (denied) return denied;

  const wrongOrg = await requireTournamentInOrg(ctx, tournamentId);
  if (wrongOrg) return wrongOrg;

  const { data, error } = await supabaseAdmin
    .from('diamonds')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const venueIds = (data ?? []).map(v => v.id);
  const facilityByVenue: Record<string, any[]> = {};

  if (venueIds.length > 0) {
    const { data: facData, error: facErr } = await supabaseAdmin
      .from('venue_facilities')
      .select('*')
      .in('venue_id', venueIds)
      .order('display_order', { ascending: true });
    if (facErr) return NextResponse.json({ error: facErr.message }, { status: 500 });
    for (const f of facData ?? []) {
      facilityByVenue[f.venue_id] = facilityByVenue[f.venue_id] ?? [];
      facilityByVenue[f.venue_id].push(f);
    }
  }

  // -- Optional per-venue / per-facility game-impact counts (Venues page) ----
  // Computed from a single tournament-wide games query, then bucketed in JS so
  // each venue row can show its reach and gate deletion before the API call.
  const venueCounts    = new Map<string, { total: number; played: number }>();
  const facilityCounts = new Map<string, { total: number; played: number }>();
  if (withGameCounts && venueIds.length > 0) {
    const facilityToVenue = new Map<string, string>();
    for (const [vId, facs] of Object.entries(facilityByVenue)) {
      for (const f of facs) facilityToVenue.set(f.id, vId);
    }
    const { data: gameRows, error: gErr } = await supabaseAdmin
      .from('games')
      .select('diamond_id, venue_facility_id, status, home_score, away_score')
      .eq('tournament_id', tournamentId);
    if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });

    const bump = (m: Map<string, { total: number; played: number }>, key: string, played: boolean) => {
      const cur = m.get(key) ?? { total: 0, played: 0 };
      cur.total += 1;
      if (played) cur.played += 1;
      m.set(key, cur);
    };
    for (const g of gameRows ?? []) {
      const played = isPlayedGame(g);
      if (g.venue_facility_id) bump(facilityCounts, g.venue_facility_id, played);
      const vId = g.diamond_id ?? (g.venue_facility_id ? facilityToVenue.get(g.venue_facility_id) : null);
      if (vId) bump(venueCounts, vId, played);
    }
  }

  return NextResponse.json((data ?? []).map(row => {
    const mapped = mapVenue(row, facilityByVenue[row.id] ?? []) as ReturnType<typeof mapVenue> & {
      facilities?: ReturnType<typeof mapFacility>[];
    };
    if (!withGameCounts) return mapped;
    const vc = venueCounts.get(row.id) ?? { total: 0, played: 0 };
    return {
      ...mapped,
      gameCount: vc.total,
      playedGameCount: vc.played,
      facilities: (mapped.facilities ?? []).map(f => {
        const fc = facilityCounts.get(f.id) ?? { total: 0, played: 0 };
        return { ...f, gameCount: fc.total, playedGameCount: fc.played };
      }),
    };
  }));
}

// ---------------------------------------------------------------------------
// POST /api/admin/venues
// Actions: save-venue | update-venue | delete-venue
//          add-facility | update-facility | delete-facility
//          import-from-org | import-from-past
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { action, id, data } = await req.json();

    // -- save-venue: create a new tournament venue --------------------------
    if (action === 'save-venue') {
      const denied = scopeGuard(ctx, data.tournamentId);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, data.tournamentId);
      if (wrongOrg) return wrongOrg;

      const { data: newVenue, error } = await supabaseAdmin.from('diamonds').insert({
        tournament_id:       data.tournamentId,
        name:                data.name,
        address:             data.address  ?? null,
        notes:               data.notes    ?? null,
        source_org_venue_id: data.sourceOrgVenueId ?? null,
      }).select('*').single();
      if (error) throw error;
      return NextResponse.json({ success: true, venue: mapVenue(newVenue, []) });
    }

    // -- update-venue -------------------------------------------------------
    if (action === 'update-venue' && id) {
      const { data: existing } = await supabaseAdmin
        .from('diamonds').select('tournament_id').eq('id', id).single();
      if (existing) {
        const denied = scopeGuard(ctx, existing.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, existing.tournament_id);
        if (wrongOrg) return wrongOrg;
      }
      const updates: Record<string, unknown> = {};
      if (data.name    !== undefined) updates.name    = data.name;
      if (data.address !== undefined) updates.address = data.address ?? null;
      if (data.notes   !== undefined) updates.notes   = data.notes   ?? null;
      const { error } = await supabaseAdmin.from('diamonds').update(updates).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // -- delete-venue -------------------------------------------------------
    if (action === 'delete-venue' && id) {
      const { data: existing } = await supabaseAdmin
        .from('diamonds').select('tournament_id').eq('id', id).single();
      if (existing) {
        const denied = scopeGuard(ctx, existing.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, existing.tournament_id);
        if (wrongOrg) return wrongOrg;
      }
      const blocked = await blockIfPlayedVenue(id);
      if (blocked) return blocked;
      await clearVenueFromGames(id);
      const { error } = await supabaseAdmin.from('diamonds').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // -- Backward-compat actions: 'save', 'update', 'delete' ----------------
    // Keep these so existing callers (AddVenueModal) continue to work until
    // they are updated to the new action names.
    if (action === 'save') {
      const denied = scopeGuard(ctx, data.tournamentId);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, data.tournamentId);
      if (wrongOrg) return wrongOrg;
      const { data: newVenue, error } = await supabaseAdmin.from('diamonds').insert({
        tournament_id: data.tournamentId,
        name:          data.name,
        address:       data.address ?? null,
        notes:         data.notes   ?? null,
      }).select('*').single();
      if (error) throw error;
      // Auto-create one facility with the same name (type = 'other')
      await supabaseAdmin.from('venue_facilities').insert({
        venue_id:      newVenue.id,
        tournament_id: data.tournamentId,
        name:          data.name,
        facility_type: 'other',
        display_order: 0,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'update' && id) {
      const { data: existing } = await supabaseAdmin
        .from('diamonds').select('tournament_id').eq('id', id).single();
      if (existing) {
        const denied = scopeGuard(ctx, existing.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, existing.tournament_id);
        if (wrongOrg) return wrongOrg;
      }
      const { error } = await supabaseAdmin.from('diamonds').update({
        name:    data.name,
        address: data.address ?? null,
        notes:   data.notes   ?? null,
      }).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'delete' && id) {
      const { data: existing } = await supabaseAdmin
        .from('diamonds').select('tournament_id').eq('id', id).single();
      if (existing) {
        const denied = scopeGuard(ctx, existing.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, existing.tournament_id);
        if (wrongOrg) return wrongOrg;
      }
      const blocked = await blockIfPlayedVenue(id);
      if (blocked) return blocked;
      await clearVenueFromGames(id);
      const { error } = await supabaseAdmin.from('diamonds').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // -- add-facility -------------------------------------------------------
    if (action === 'add-facility') {
      // Verify venue belongs to a tournament the caller can access
      const { data: venue } = await supabaseAdmin
        .from('diamonds').select('tournament_id').eq('id', data.venueId).single();
      if (venue) {
        const denied = scopeGuard(ctx, venue.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, venue.tournament_id);
        if (wrongOrg) return wrongOrg;
      }
      const { data: newFac, error } = await supabaseAdmin.from('venue_facilities').insert({
        venue_id:      data.venueId,
        tournament_id: data.tournamentId,
        name:          data.name,
        facility_type: data.facilityType ?? 'other',
        display_order: data.displayOrder ?? 0,
        notes:         data.notes ?? null,
      }).select('*').single();
      if (error) throw error;
      return NextResponse.json({ success: true, facility: mapFacility(newFac) });
    }

    // -- update-facility ----------------------------------------------------
    if (action === 'update-facility' && id) {
      const { data: fac } = await supabaseAdmin
        .from('venue_facilities').select('tournament_id').eq('id', id).single();
      if (fac) {
        const denied = scopeGuard(ctx, fac.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, fac.tournament_id);
        if (wrongOrg) return wrongOrg;
      }
      const updates: Record<string, unknown> = {};
      if (data.name          !== undefined) updates.name          = data.name;
      if (data.facilityType  !== undefined) updates.facility_type = data.facilityType;
      if (data.displayOrder  !== undefined) updates.display_order = data.displayOrder;
      if (data.notes         !== undefined) updates.notes         = data.notes ?? null;
      const { error } = await supabaseAdmin.from('venue_facilities').update(updates).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // -- delete-facility ----------------------------------------------------
    if (action === 'delete-facility' && id) {
      const { data: fac } = await supabaseAdmin
        .from('venue_facilities').select('tournament_id').eq('id', id).single();
      if (fac) {
        const denied = scopeGuard(ctx, fac.tournament_id);
        if (denied) return denied;
        const wrongOrg = await requireTournamentInOrg(ctx, fac.tournament_id);
        if (wrongOrg) return wrongOrg;
      }
      const blocked = await blockIfPlayedFacility(id);
      if (blocked) return blocked;
      await clearFacilityFromGames(id);
      const { error } = await supabaseAdmin.from('venue_facilities').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // -- import-from-org: copy an org library venue into a tournament -------
    if (action === 'import-from-org') {
      const denied = scopeGuard(ctx, data.tournamentId);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, data.tournamentId);
      if (wrongOrg) return wrongOrg;

      const { data: ov, error: ovErr } = await supabaseAdmin
        .from('org_venues')
        .select('*, org_venue_facilities(*)')
        .eq('id', data.orgVenueId)
        .single();
      if (ovErr || !ov) return NextResponse.json({ error: 'Org venue not found' }, { status: 404 });

      const { data: newVenue, error: vErr } = await supabaseAdmin.from('diamonds').insert({
        tournament_id:       data.tournamentId,
        name:                ov.name,
        address:             ov.address ?? null,
        notes:               ov.notes   ?? null,
        source_org_venue_id: data.orgVenueId,
      }).select('*').single();
      if (vErr || !newVenue) throw vErr ?? new Error('Failed to create tournament venue');

      const facilities: any[] = ov.org_venue_facilities ?? [];
      if (facilities.length > 0) {
        const { error: fErr } = await supabaseAdmin.from('venue_facilities').insert(
          facilities.map((f: any) => ({
            venue_id:               newVenue.id,
            tournament_id:          data.tournamentId,
            name:                   f.name,
            facility_type:          f.facility_type,
            display_order:          f.display_order,
            notes:                  f.notes ?? null,
            source_org_facility_id: f.id,
          }))
        );
        if (fErr) throw fErr;
      }

      const { data: facData } = await supabaseAdmin
        .from('venue_facilities')
        .select('*')
        .eq('venue_id', newVenue.id)
        .order('display_order', { ascending: true });

      return NextResponse.json({ success: true, venue: mapVenue(newVenue, facData ?? []) });
    }

    // -- import-from-past: copy a past-tournament venue into current --------
    if (action === 'import-from-past') {
      const denied = scopeGuard(ctx, data.tournamentId);
      if (denied) return denied;
      const wrongOrg = await requireTournamentInOrg(ctx, data.tournamentId);
      if (wrongOrg) return wrongOrg;

      const { data: srcVenue, error: svErr } = await supabaseAdmin
        .from('diamonds').select('*').eq('id', data.sourceVenueId).single();
      if (svErr || !srcVenue) return NextResponse.json({ error: 'Source venue not found' }, { status: 404 });
      // Source venue must belong to the caller's org (prevents copying another org's venue)
      const srcWrongOrg = await requireTournamentInOrg(ctx, srcVenue.tournament_id);
      if (srcWrongOrg) return srcWrongOrg;

      const { data: newVenue, error: vErr } = await supabaseAdmin.from('diamonds').insert({
        tournament_id: data.tournamentId,
        name:          srcVenue.name,
        address:       srcVenue.address ?? null,
        notes:         srcVenue.notes   ?? null,
      }).select('*').single();
      if (vErr || !newVenue) throw vErr ?? new Error('Failed to create venue');

      const { data: srcFacilities } = await supabaseAdmin
        .from('venue_facilities').select('*').eq('venue_id', data.sourceVenueId);

      if (srcFacilities?.length) {
        const { error: fErr } = await supabaseAdmin.from('venue_facilities').insert(
          srcFacilities.map((f: any) => ({
            venue_id:      newVenue.id,
            tournament_id: data.tournamentId,
            name:          f.name,
            facility_type: f.facility_type,
            display_order: f.display_order,
            notes:         f.notes ?? null,
          }))
        );
        if (fErr) throw fErr;
      }

      const { data: facData } = await supabaseAdmin
        .from('venue_facilities').select('*').eq('venue_id', newVenue.id)
        .order('display_order', { ascending: true });

      return NextResponse.json({ success: true, venue: mapVenue(newVenue, facData ?? []) });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
