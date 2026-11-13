import { refuseWithoutLiveSeat } from '@/lib/coach-season-refusal';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getActiveRepProgramYear, getCoachingAssignmentsForUser, getRepTeam, getRepTeamEventById } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';
import { GUARDIAN_TIER_ENABLED } from '@/lib/family-guardian';
import { roomFamilyAnswers } from '@/lib/family-availability-coach';

/**
 * The attendance room's family side for one event (Signed-in family accounts Stage 4b, Part 5): per rostered player, whether a
 * parent is in the app and what the family said, with the note's words. Coaches who can mark attendance only (ask 11). READ ONLY:
 * the coach copies an answer into the book through the attendance PATCH, never here.
 *
 * 404 while the guardian tier is off, and `{ answers: null }` while the team's switch doesn't cover this event, so the room renders
 * exactly as before.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  if (!GUARDIAN_TIER_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { orgSlug, teamId, eventId } = await params;

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const assignment = (await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id)).find(a => a.teamId === teamId);
  if (!assignment) return refuseWithoutLiveSeat(ctx.org, ctx.user.id, teamId);
  const denied = denyUnless(assignment.capabilities.attendance, 'You do not have access to attendance.');
  if (denied) return denied;

  // The live season only (no year parameter): an event of another season is not found.
  const [programYear, event] = await Promise.all([getActiveRepProgramYear(teamId), getRepTeamEventById(eventId)]);
  if (!programYear || !event || event.teamId !== teamId || event.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const answers = await roomFamilyAnswers({ teamId, programYearId: programYear.id, event, team });
  return NextResponse.json({ answers });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/family-answers' });
