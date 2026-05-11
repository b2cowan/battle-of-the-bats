import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepRosterPlayer,
  updateRepRosterPlayer,
} from '@/lib/db';
import type { RepRosterStatus } from '@/lib/types';

export async function GET(
  _req: Request,
  { params }: { params: { orgSlug: string; teamId: string; playerId: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== params.orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.find(a => a.teamId === params.teamId)) return forbidden();

  const player = await getRepRosterPlayer(params.playerId);
  if (!player || player.teamId !== params.teamId || player.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ player });
}

export async function PATCH(
  req: Request,
  { params }: { params: { orgSlug: string; teamId: string; playerId: string } },
) {
  const ctx = await getAuthContext();
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== params.orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.find(a => a.teamId === params.teamId)) return forbidden();

  const player = await getRepRosterPlayer(params.playerId);
  if (!player || player.teamId !== params.teamId || player.orgId !== ctx.org.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await req.json();

  const updated = await updateRepRosterPlayer(params.playerId, {
    playerFirstName:  body.playerFirstName  !== undefined ? String(body.playerFirstName).trim()  : undefined,
    playerLastName:   body.playerLastName   !== undefined ? String(body.playerLastName).trim()   : undefined,
    playerDateOfBirth:body.playerDateOfBirth !== undefined ? (body.playerDateOfBirth || null)     : undefined,
    playerNumber:     body.playerNumber     !== undefined ? (body.playerNumber?.trim() || null)   : undefined,
    status:           body.status           !== undefined ? body.status as RepRosterStatus        : undefined,
    guardianFirstName:body.guardianFirstName !== undefined ? String(body.guardianFirstName).trim(): undefined,
    guardianLastName: body.guardianLastName  !== undefined ? String(body.guardianLastName).trim() : undefined,
    guardianEmail:    body.guardianEmail     !== undefined ? String(body.guardianEmail).trim()    : undefined,
    guardianPhone:    body.guardianPhone     !== undefined ? (body.guardianPhone?.trim() || null) : undefined,
    notes:            body.notes            !== undefined ? (body.notes?.trim() || null)          : undefined,
    adminNotes:       body.adminNotes       !== undefined ? (body.adminNotes?.trim() || null)     : undefined,
  });

  return NextResponse.json({ player: updated });
}
