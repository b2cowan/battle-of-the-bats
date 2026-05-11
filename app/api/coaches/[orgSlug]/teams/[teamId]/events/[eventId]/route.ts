import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamEventById,
  updateRepTeamEvent,
  deleteRepTeamEvent,
  deleteRepTeamEventsByRecurrenceParent,
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },
) {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { programYear } = resolved;

  const event = await getRepTeamEventById(eventId);
  if (!event || event.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const body = await req.json();
  const fields: Parameters<typeof updateRepTeamEvent>[1] = {};

  if (body.name !== undefined)        fields.name = body.name?.trim() || undefined;
  if (body.description !== undefined) fields.description = body.description?.trim() || null;
  if (body.startsAt !== undefined)    fields.startsAt = body.startsAt;
  if (body.endsAt !== undefined)      fields.endsAt = body.endsAt || null;
  if (body.location !== undefined)    fields.location = body.location?.trim() || null;
  if (body.opponent !== undefined)    fields.opponent = body.opponent?.trim() || null;
  if (body.homeAway !== undefined)    fields.homeAway = body.homeAway || null;
  if (body.homeScore !== undefined)   fields.homeScore = body.homeScore != null ? Number(body.homeScore) : null;
  if (body.awayScore !== undefined)   fields.awayScore = body.awayScore != null ? Number(body.awayScore) : null;

  if (body.result !== undefined) {
    const r = body.result;
    if (r !== null && !['win', 'loss', 'tie'].includes(r)) {
      return NextResponse.json({ error: 'result must be win, loss, tie, or null' }, { status: 400 });
    }
    fields.result = r;
  }

  const updated = await updateRepTeamEvent(eventId, fields);
  return NextResponse.json({ event: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },
) {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { programYear } = resolved;

  const event = await getRepTeamEventById(eventId);
  if (!event || event.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') ?? 'one';

  if (event.isRecurring && scope !== 'one') {
    // Identify the recurrence anchor: if this event has a recurrenceParentId it's a child;
    // if not, it is the anchor itself.
    const anchorId = event.recurrenceParentId ?? eventId;

    if (scope === 'all') {
      await deleteRepTeamEventsByRecurrenceParent(anchorId);
      // Also delete the anchor itself
      await deleteRepTeamEvent(anchorId);
    } else if (scope === 'remaining') {
      await deleteRepTeamEventsByRecurrenceParent(anchorId, event.startsAt);
      // Delete the event itself too (it won't be caught by the parent query if it IS the anchor)
      if (event.recurrenceParentId) await deleteRepTeamEvent(eventId);
    } else {
      return NextResponse.json({ error: 'scope must be one, remaining, or all' }, { status: 400 });
    }
  } else {
    // external_tournament: child game slots are cascade-deleted by the DB FK
    await deleteRepTeamEvent(eventId);
  }

  return NextResponse.json({ ok: true });
}
