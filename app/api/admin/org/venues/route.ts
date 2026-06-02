import { NextResponse } from 'next/server';
import { getAuthContextWithScope, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// Org Venue Library API
// GET  /api/admin/org/venues?orgSlug=<slug>            — list with facilities
// POST /api/admin/org/venues?orgSlug=<slug>            — CRUD actions
//   actions: save-venue | update-venue | delete-venue
//            add-facility | update-facility | delete-facility
// ---------------------------------------------------------------------------

function mapOrgVenue(v: any, facilities?: any[]) {
  const base = {
    id:       v.id,
    orgId:    v.org_id,
    name:     v.name,
    address:  v.address  ?? null,
    notes:    v.notes    ?? null,
    isActive: v.is_active,
  };
  if (facilities === undefined) return base;
  return { ...base, facilities: facilities.map(mapOrgFacility) };
}

function mapOrgFacility(f: any) {
  return {
    id:           f.id,
    orgVenueId:   f.org_venue_id,
    orgId:        f.org_id,
    name:         f.name,
    facilityType: f.facility_type,
    displayOrder: f.display_order,
    notes:        f.notes ?? null,
  };
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orgSlug = searchParams.get('orgSlug') ?? undefined;

  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  // Org Venue Library is a League/Club org-admin feature (matches the page-level gate).
  if (!['league', 'club'].includes(ctx.org.planId)) return forbidden();

  const { data: venues, error: vErr } = await supabaseAdmin
    .from('org_venues')
    .select('*')
    .eq('org_id', ctx.org.id)
    .order('name', { ascending: true });
  if (vErr) return NextResponse.json({ error: vErr.message }, { status: 500 });

  const venueIds = (venues ?? []).map(v => v.id);
  let facilityByVenue: Record<string, any[]> = {};

  if (venueIds.length > 0) {
    const { data: facData, error: fErr } = await supabaseAdmin
      .from('org_venue_facilities')
      .select('*')
      .in('org_venue_id', venueIds)
      .order('display_order', { ascending: true });
    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });
    for (const f of facData ?? []) {
      facilityByVenue[f.org_venue_id] = facilityByVenue[f.org_venue_id] ?? [];
      facilityByVenue[f.org_venue_id].push(f);
    }
  }

  return NextResponse.json((venues ?? []).map(v =>
    mapOrgVenue(v, facilityByVenue[v.id] ?? [])
  ));
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug });
  if (!ctx) return unauthorized();
  // Org Venue Library is a League/Club org-admin feature (matches the page-level gate).
  if (!['league', 'club'].includes(ctx.org.planId)) return forbidden();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  try {
    const { action, id, data } = await req.json();

    // -- save-venue ---------------------------------------------------------
    if (action === 'save-venue') {
      const { data: newVenue, error } = await supabaseAdmin.from('org_venues').insert({
        org_id:    ctx.org.id,
        name:      data.name,
        address:   data.address ?? null,
        notes:     data.notes   ?? null,
        is_active: true,
      }).select('*').single();
      if (error) throw error;
      return NextResponse.json({ success: true, venue: mapOrgVenue(newVenue, []) });
    }

    // -- update-venue -------------------------------------------------------
    if (action === 'update-venue' && id) {
      // Verify ownership
      const { data: existing } = await supabaseAdmin
        .from('org_venues').select('org_id').eq('id', id).single();
      if (existing?.org_id !== ctx.org.id) return forbidden();

      const updates: Record<string, unknown> = {};
      if (data.name    !== undefined) updates.name    = data.name;
      if (data.address !== undefined) updates.address = data.address ?? null;
      if (data.notes   !== undefined) updates.notes   = data.notes   ?? null;
      const { error } = await supabaseAdmin.from('org_venues').update(updates).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // -- delete-venue -------------------------------------------------------
    if (action === 'delete-venue' && id) {
      const { data: existing } = await supabaseAdmin
        .from('org_venues').select('org_id').eq('id', id).single();
      if (existing?.org_id !== ctx.org.id) return forbidden();

      // org_venue_facilities cascade via FK
      const { error } = await supabaseAdmin.from('org_venues').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // -- add-facility -------------------------------------------------------
    if (action === 'add-facility') {
      const { data: venue } = await supabaseAdmin
        .from('org_venues').select('org_id').eq('id', data.orgVenueId).single();
      if (venue?.org_id !== ctx.org.id) return forbidden();

      const { data: newFac, error } = await supabaseAdmin.from('org_venue_facilities').insert({
        org_venue_id:  data.orgVenueId,
        org_id:        ctx.org.id,
        name:          data.name,
        facility_type: data.facilityType ?? 'other',
        display_order: data.displayOrder ?? 0,
        notes:         data.notes ?? null,
      }).select('*').single();
      if (error) throw error;
      return NextResponse.json({ success: true, facility: mapOrgFacility(newFac) });
    }

    // -- update-facility ----------------------------------------------------
    if (action === 'update-facility' && id) {
      const updates: Record<string, unknown> = {};
      if (data.name          !== undefined) updates.name          = data.name;
      if (data.facilityType  !== undefined) updates.facility_type = data.facilityType;
      if (data.displayOrder  !== undefined) updates.display_order = data.displayOrder;
      if (data.notes         !== undefined) updates.notes         = data.notes ?? null;
      const { error } = await supabaseAdmin.from('org_venue_facilities').update(updates).eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // -- delete-facility ----------------------------------------------------
    if (action === 'delete-facility' && id) {
      const { error } = await supabaseAdmin.from('org_venue_facilities').delete().eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
