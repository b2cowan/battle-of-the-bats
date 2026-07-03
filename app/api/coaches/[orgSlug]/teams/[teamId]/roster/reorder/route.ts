import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

const MAX_REORDER = 500; // no realistic rep roster approaches this

// POST /api/coaches/[orgSlug]/teams/[teamId]/roster/reorder — persist a new roster order
// Body: { orderedIds: string[] } (the full reordered set, as the client sends it).
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.rosterWrite, 'Only the head coach can edit the roster.');
  if (denied) return denied;

  const body = (await req.json().catch(() => ({}))) as { orderedIds?: unknown };
  if (!Array.isArray(body.orderedIds)) {
    return NextResponse.json({ error: 'orderedIds (string[]) is required.' }, { status: 400 });
  }
  // De-dupe (a repeated id can't be written twice) and bound the work — each id is one
  // program-year-scoped UPDATE, so a foreign id is a harmless no-op and a huge payload can't
  // force unbounded writes.
  const orderedIds = Array.from(
    new Set(body.orderedIds.filter((id): id is string => typeof id === 'string')),
  );
  if (orderedIds.length > MAX_REORDER) {
    return NextResponse.json({ error: 'Too many players to reorder at once.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabaseAdmin
      .from('rep_roster_players')
      .update({ display_order: i, updated_at: now })
      .eq('id', orderedIds[i])
      .eq('program_year_id', programYear.id)
      .eq('team_id', team.id); // scope: a coach can only reorder their own team's active-season roster
    if (error) {
      console.error('[coaches rep roster reorder] update failed:', error);
      return NextResponse.json({ error: 'Could not save the new order.' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/reorder' });
