import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamCoachById,
  updateRepTeamCoachCapabilities,
  removeRepTeamCoach,
  cleanupOrphanedCoachMembership,
} from '@/lib/db';
import { sanitizeAssistantGrants, resolveCoachCapabilities, denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';

async function resolveHeadCoachTargetContext(orgSlug: string, teamId: string, coachId: string) {
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
  // Only the head coach manages the staff.
  const denied = denyUnless(assignment.capabilities.isHeadCoach, 'Only the head coach manages the coaching staff.');
  if (denied) return { error: denied };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  // The target must be an ASSISTANT on THIS team's active season (never the head coach / never self).
  const target = await getRepTeamCoachById(coachId);
  if (!target || target.teamId !== teamId || target.programYearId !== programYear.id) {
    return { error: NextResponse.json({ error: 'Coach not found on this team.' }, { status: 404 }) };
  }
  if (target.coachRole !== 'assistant_coach') {
    return { error: NextResponse.json({ error: 'Only assistant coaches can be managed here.' }, { status: 400 }) };
  }
  // Defense-in-depth: never let a head coach target their own row (already blocked by the role check).
  if (target.userId === ctx.user.id) {
    return { error: NextResponse.json({ error: 'You cannot manage your own assignment here.' }, { status: 400 }) };
  }

  return { ctx, team, target };
}

// PATCH — set an assistant's per-duty grants (the head coach's toggle grid). Head coach only.
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; coachId: string }> },) => {
  const { orgSlug, teamId, coachId } = await params;
  const resolved = await resolveHeadCoachTargetContext(orgSlug, teamId, coachId);
  if ('error' in resolved) return resolved.error!;

  const body = await req.json().catch(() => ({}));
  const grants = sanitizeAssistantGrants(body.capabilities ?? body);
  const updated = await updateRepTeamCoachCapabilities(coachId, grants);
  return NextResponse.json({
    ok: true,
    coachId: updated.id,
    capabilities: resolveCoachCapabilities('assistant_coach', updated.capabilities),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/[coachId]' });

// DELETE — remove an assistant from the team. Head coach only. Cleans up an orphaned guest membership.
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; coachId: string }> },) => {
  const { orgSlug, teamId, coachId } = await params;
  const resolved = await resolveHeadCoachTargetContext(orgSlug, teamId, coachId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, target } = resolved;

  await removeRepTeamCoach(coachId);
  await cleanupOrphanedCoachMembership(ctx.org.id, target.userId);
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/staff/[coachId]' });
