import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.find(a => a.teamId === teamId)) return { error: forbidden() };

  return { ctx, team };
}

// DELETE /api/coaches/[orgSlug]/teams/[teamId]/payment-requests/[id]
// Coaches can only cancel their own pending requests.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; id: string }> },
) {
  const { orgSlug, teamId, id } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { team } = resolved;

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .select('id, team_id, status')
    .eq('id', id)
    .eq('org_id', team.orgId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 });
  }
  if (existing.team_id !== team.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending requests can be cancelled' }, { status: 409 });
  }

  const { error } = await supabaseAdmin
    .from('rep_team_payment_requests')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
