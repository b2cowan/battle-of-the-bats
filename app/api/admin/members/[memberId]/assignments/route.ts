import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, requireCapability } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

type Params = { params: Promise<{ memberId: string }> };

/** GET /api/admin/members/[memberId]/assignments — returns current tournament assignment IDs */
export async function GET(_req: Request, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const { memberId } = await params;

  // Verify the target member belongs to the caller's org
  const { data: target } = await supabaseAdmin
    .from('organization_members')
    .select('id')
    .eq('id', memberId)
    .eq('organization_id', ctx.org.id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  const { data: assignments, error } = await supabaseAdmin
    .from('org_member_tournament_assignments')
    .select('tournament_id')
    .eq('org_member_id', memberId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    tournamentIds: (assignments ?? []).map(a => a.tournament_id),
  });
}

/**
 * PUT /api/admin/members/[memberId]/assignments
 * Body: { tournamentIds: string[] }
 * Replaces the full assignment set for the member. An empty array makes the user unrestricted.
 * Requires manage_members capability.
 */
export async function PUT(req: Request, { params }: Params) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();

  const denied = await requireCapability(ctx, 'manage_members');
  if (denied) return denied;

  const { memberId } = await params;

  // Verify the target member belongs to this org
  const { data: target } = await supabaseAdmin
    .from('organization_members')
    .select('id, role')
    .eq('id', memberId)
    .eq('organization_id', ctx.org.id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Owners cannot be scoped
  if (target.role === 'owner') {
    return NextResponse.json({ error: 'Owners cannot have tournament assignments' }, { status: 400 });
  }

  const body = await req.json();
  const tournamentIds: string[] = Array.isArray(body.tournamentIds) ? body.tournamentIds : [];

  // Validate all provided tournament IDs belong to this org
  if (tournamentIds.length > 0) {
    const { data: validTournaments } = await supabaseAdmin
      .from('tournaments')
      .select('id')
      .eq('organization_id', ctx.org.id)
      .in('id', tournamentIds);

    const validIds = new Set((validTournaments ?? []).map(t => t.id));
    const invalid = tournamentIds.filter(id => !validIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid tournament IDs: ${invalid.join(', ')}` },
        { status: 400 }
      );
    }
  }

  // Replace assignments atomically: delete existing, insert new
  const { error: deleteError } = await supabaseAdmin
    .from('org_member_tournament_assignments')
    .delete()
    .eq('org_member_id', memberId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (tournamentIds.length > 0) {
    const rows = tournamentIds.map(tid => ({
      org_member_id: memberId,
      tournament_id: tid,
    }));

    const { error: insertError } = await supabaseAdmin
      .from('org_member_tournament_assignments')
      .insert(rows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, tournamentIds });
}
