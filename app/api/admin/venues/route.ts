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
// GET /api/admin/venues
//   ?tournamentId=<id>           — venues for one tournament (with facilities)
//   ?scope=org                   — all venues across org's tournaments (flat)
//   ?scope=past&orgSlug=<slug>   — for import-from-past flow (no-org users)
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orgSlug      = searchParams.get('orgSlug') ?? undefined;
  const tournamentId = searchParams.get('tournamentId');
  const scope        = searchParams.get('scope');

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
    let facilityByVenue: Record<string, any[]> = {};
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
  let facilityByVenue: Record<string, any[]> = {};

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

  return NextResponse.json((data ?? []).map(row =>
    mapVenue(row, facilityByVenue[row.id] ?? [])
  ));
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
