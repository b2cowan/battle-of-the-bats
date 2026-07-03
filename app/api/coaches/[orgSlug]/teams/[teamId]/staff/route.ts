import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamStaffForYear,
} from '@/lib/db';
import { resolveCoachCapabilities, denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';

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
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/staff — the coaching staff + each assistant's effective
// capabilities, for the head coach's "Coaching staff" manage panel. Head coach only.
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.isHeadCoach, 'Only the head coach manages the coaching staff.');
  if (denied) return denied;

  const staff = await getRepTeamStaffForYear(programYear.id, ctx.org.id);
  return NextResponse.json({
    staff: staff.map(s => ({
      coachId: s.coachId,
      userId: s.userId,
      coachRole: s.coachRole,
      displayName: s.displayName,
      email: s.email,
      // The current effective grant per area (head coach = full), so the grid renders live state.
      capabilities: resolveCoachCapabilities(s.coachRole, s.capabilities),
      isSelf: s.userId === ctx.user.id,
    })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff' });
