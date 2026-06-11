import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepRosterPlayer,
  updateRepRosterPlayer,
} from '@/lib/db';
import type { RepRosterStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';

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

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx } = resolved;

  const player = await getRepRosterPlayer(playerId);
  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ player });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx } = resolved;

  const player = await getRepRosterPlayer(playerId);
  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();

  const updated = await updateRepRosterPlayer(playerId, {
    playerFirstName:  body.playerFirstName  !== undefined ? String(body.playerFirstName).trim()  : undefined,
    playerLastName:   body.playerLastName   !== undefined ? String(body.playerLastName).trim()   : undefined,
    playerDateOfBirth:body.playerDateOfBirth !== undefined ? (body.playerDateOfBirth || null)     : undefined,
    playerNumber:     body.playerNumber     !== undefined ? (body.playerNumber?.trim() || null)   : undefined,
    primaryPosition:  body.primaryPosition  !== undefined ? (body.primaryPosition?.trim() || null) : undefined,
    secondaryPosition:body.secondaryPosition!== undefined ? (body.secondaryPosition?.trim() || null) : undefined,
    status:           body.status           !== undefined ? body.status as RepRosterStatus        : undefined,
    guardianFirstName:body.guardianFirstName !== undefined ? String(body.guardianFirstName).trim(): undefined,
    guardianLastName: body.guardianLastName  !== undefined ? String(body.guardianLastName).trim() : undefined,
    guardianEmail:    body.guardianEmail     !== undefined ? String(body.guardianEmail).trim()    : undefined,
    guardianPhone:    body.guardianPhone     !== undefined ? (body.guardianPhone?.trim() || null) : undefined,
    notes:            body.notes            !== undefined ? (body.notes?.trim() || null)          : undefined,
    adminNotes:       body.adminNotes       !== undefined ? (body.adminNotes?.trim() || null)     : undefined,
  });

  return NextResponse.json({ player: updated });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]' });
