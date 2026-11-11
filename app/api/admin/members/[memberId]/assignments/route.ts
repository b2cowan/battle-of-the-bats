import { NextResponse } from 'next/server';
import { getAuthContextWithRole, getAuthContextWithScope, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

type Params = { params: Promise<{ memberId: string }> };

/** GET /api/admin/members/[memberId]/assignments — returns current tournament assignment IDs */
export const GET = withObservability(async (req: Request, { params }: Params) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  // An ACCEPTED member who manages members, or the member reading their own row. Before, any membership row passed — a
  // pending invitee's included — and read anyone's assignments (sweep 3 finding 3, 2026-11-10).
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();

  const { memberId } = await params;

  // Verify the target member belongs to the caller's org
  const { data: target } = await supabaseAdmin
    .from('organization_members')
    .select('id, user_id')
    .eq('id', memberId)
    .eq('organization_id', ctx.org.id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }
  if (target.user_id !== ctx.user.id && !hasCapability(ctx.role, ctx.capabilities, 'manage_members')) return forbidden();

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
}, { route: '/api/admin/members/[memberId]/assignments' });

/**
 * PUT /api/admin/members/[memberId]/assignments
 * Body: { tournamentIds: string[] }
 * Replaces the full assignment set for the member. An empty array makes the user unrestricted.
 * Requires manage_members capability. Below the owner, never on your OWN row, and a manager limited to some tournaments
 * gives only those (and never "every tournament") — the member route's own-role rule, applied to access (sweep 3 /review,
 * 2026-11-10: a limited admin could PUT [] on their own row and lift their limit).
 */
export const PUT = withObservability(async (req: Request, { params }: Params) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'manage_members')) return forbidden();

  const { memberId } = await params;

  // Verify the target member belongs to this org
  const { data: target } = await supabaseAdmin
    .from('organization_members')
    .select('id, role, user_id')
    .eq('id', memberId)
    .eq('organization_id', ctx.org.id)
    .single();

  if (!target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }
  if (target.user_id === ctx.user.id && ctx.role !== 'owner') {
    return NextResponse.json({ error: 'You can’t change your own tournament access. Ask the club’s owner.', code: 'own_access' }, { status: 403 });
  }

  // Owners cannot be scoped
  if (target.role === 'owner') {
    return NextResponse.json({ error: 'Owners cannot have tournament assignments' }, { status: 400 });
  }

  const body = await req.json();
  const tournamentIds: string[] = Array.isArray(body.tournamentIds) ? body.tournamentIds : [];
  const mine = ctx.assignedTournamentIds;
  if (mine !== null && (tournamentIds.length === 0 || tournamentIds.some(id => !mine.includes(id)))) {
    return NextResponse.json({ error: 'You can give access only to the tournaments you can open yourself.', code: 'beyond_own_access' }, { status: 403 });
  }

  // Validate all provided tournament IDs belong to this org
  if (tournamentIds.length > 0) {
    const { data: validTournaments } = await supabaseAdmin
      .from('tournaments')
      .select('id')
      .eq('org_id', ctx.org.id)
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
}, { route: '/api/admin/members/[memberId]/assignments' });
