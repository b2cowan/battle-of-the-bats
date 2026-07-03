import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepRosterPlayers,
  createRepRosterPlayer,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, redactRoster, canViewRoster } from '@/lib/coach-capabilities';

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

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canViewRoster(assignment.capabilities), 'You do not have access to the roster.');
  if (denied) return denied;

  const players = await getRepRosterPlayers(programYear.id);
  return NextResponse.json({ players: redactRoster(players, assignment.capabilities), programYear });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.rosterWrite, 'Only the head coach can edit the roster.');
  if (denied) return denied;

  const body = await req.json();
  const { playerFirstName, playerLastName, guardianFirstName, guardianLastName, guardianEmail } = body;

  // First name required; last name + guardian are optional (consistent first/last model).
  if (!playerFirstName?.trim()) {
    return NextResponse.json({ error: 'A player first name is required.' }, { status: 400 });
  }

  const player = await createRepRosterPlayer({
    programYearId: programYear.id,
    teamId: team.id,
    orgId: ctx!.org.id,
    source: 'admin_manual',
    playerFirstName: playerFirstName.trim(),
    playerLastName: playerLastName?.trim() || null,
    playerDateOfBirth: body.playerDateOfBirth?.trim() || null,
    playerNumber: body.playerNumber?.trim() || null,
    primaryPosition: body.primaryPosition?.trim() || null,
    secondaryPosition: body.secondaryPosition?.trim() || null,
    guardianFirstName: guardianFirstName?.trim() || null,
    guardianLastName: guardianLastName?.trim() || null,
    guardianEmail: guardianEmail?.trim() || null,
    guardianPhone: body.guardianPhone?.trim() || null,
    notes: body.notes?.trim() || null,
    adminNotes: body.adminNotes?.trim() || null,
  });

  return NextResponse.json({ player }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster' });
