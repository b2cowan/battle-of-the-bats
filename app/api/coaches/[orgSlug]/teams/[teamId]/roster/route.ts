import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepRosterPlayers,
  createRepRosterPlayer,
} from '@/lib/db';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext();
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

export async function GET(
  _req: Request,
  { params }: { params: { orgSlug: string; teamId: string } },
) {
  const resolved = await resolveCoachContext(params.orgSlug, params.teamId);
  if ('error' in resolved) return resolved.error;
  const { programYear } = resolved;

  const players = await getRepRosterPlayers(programYear.id);
  return NextResponse.json({ players, programYear });
}

export async function POST(
  req: Request,
  { params }: { params: { orgSlug: string; teamId: string } },
) {
  const resolved = await resolveCoachContext(params.orgSlug, params.teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team, programYear } = resolved;

  const body = await req.json();
  const { playerFirstName, playerLastName, guardianFirstName, guardianLastName, guardianEmail } = body;

  if (!playerFirstName?.trim() || !playerLastName?.trim() ||
      !guardianFirstName?.trim() || !guardianLastName?.trim() || !guardianEmail?.trim()) {
    return NextResponse.json({ error: 'Player name and guardian name/email are required' }, { status: 400 });
  }

  const player = await createRepRosterPlayer({
    programYearId: programYear.id,
    teamId: team.id,
    orgId: ctx!.org.id,
    source: 'admin_manual',
    playerFirstName: playerFirstName.trim(),
    playerLastName: playerLastName.trim(),
    playerDateOfBirth: body.playerDateOfBirth?.trim() || null,
    playerNumber: body.playerNumber?.trim() || null,
    guardianFirstName: guardianFirstName.trim(),
    guardianLastName: guardianLastName.trim(),
    guardianEmail: guardianEmail.trim(),
    guardianPhone: body.guardianPhone?.trim() || null,
    notes: body.notes?.trim() || null,
    adminNotes: body.adminNotes?.trim() || null,
  });

  return NextResponse.json({ player }, { status: 201 });
}
