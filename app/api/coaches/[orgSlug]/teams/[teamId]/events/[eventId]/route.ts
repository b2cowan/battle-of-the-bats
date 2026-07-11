import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamEventById,
  updateRepTeamEvent,
  updateRepTeamEventSeries,
  deleteRepTeamEvent,
  deleteRepTeamEventsByRecurrenceParent,
  setRepTeamEventTags,
} from '@/lib/db';
import { sanitizeResources } from '@/lib/rep-event-resources';
import { resolveValidTagIds } from '@/lib/rep-event-tags';
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
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.schedule, 'You do not have access to the schedule.');
  if (denied) return denied;

  const event = await getRepTeamEventById(eventId);
  if (!event || event.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const body = await req.json();

  // Series edit: when a recurring event is saved with scope 'remaining' (this + future) or 'all',
  // bulk-apply the shared fields + time-of-day across the series (each occurrence keeps its date).
  const scope = new URL(req.url).searchParams.get('scope') ?? 'one';
  if (scope !== 'one' && event.isRecurring) {
    if (scope !== 'remaining' && scope !== 'all') {
      return NextResponse.json({ error: 'scope must be one, remaining, or all' }, { status: 400 });
    }
    const anchorId = event.recurrenceParentId ?? eventId;
    const startTime = typeof body.startsAt === 'string' && body.startsAt ? body.startsAt.slice(11, 16) : null;
    const endTime = typeof body.endsAt === 'string' && body.endsAt ? body.endsAt.slice(11, 16) : null;
    await updateRepTeamEventSeries(anchorId, scope, scope === 'remaining' ? event.startsAt : null, {
      name: body.name !== undefined ? (body.name?.trim() || undefined) : undefined,
      description: body.description !== undefined ? (body.description?.trim() || null) : undefined,
      location: body.location !== undefined ? (body.location?.trim() || null) : undefined,
      locationAddress: body.locationAddress !== undefined ? (body.locationAddress?.trim() || null) : undefined,
      fieldNumber: body.fieldNumber !== undefined ? (body.fieldNumber?.trim() || null) : undefined,
      uniform: body.uniform !== undefined ? (body.uniform?.trim() || null) : undefined,
      resources: body.resources !== undefined ? sanitizeResources(body.resources) : undefined,
      opponent: body.opponent !== undefined ? (body.opponent?.trim() || null) : undefined,
      homeAway: body.homeAway !== undefined ? (body.homeAway || null) : undefined,
      arrivalTime: body.arrivalTime !== undefined ? (body.arrivalTime?.trim() || null) : undefined,
      startTime,
      endTime,
    });

    // Tags are per-occurrence by design (a coach tags one specific game, not a whole recurring
    // run) — apply only to THIS event id even on a "this & future"/"all" scoped save, rather than
    // silently dropping the edit (updateRepTeamEventSeries has no tagIds concept at all).
    if (body.tagIds !== undefined) {
      const tagIds = await resolveValidTagIds(teamId, body.tagIds);
      if (tagIds === null) {
        return NextResponse.json({ error: 'tagIds must be an array of this team’s existing tag ids' }, { status: 400 });
      }
      await setRepTeamEventTags(eventId, tagIds);
    }

    const refreshed = await getRepTeamEventById(eventId);
    return NextResponse.json({ event: refreshed });
  }

  const fields: Parameters<typeof updateRepTeamEvent>[1] = {};

  if (body.name !== undefined)        fields.name = body.name?.trim() || undefined;
  if (body.description !== undefined) fields.description = body.description?.trim() || null;
  if (body.startsAt !== undefined)    fields.startsAt = body.startsAt;
  if (body.endsAt !== undefined)      fields.endsAt = body.endsAt || null;
  if (body.location !== undefined)    fields.location = body.location?.trim() || null;
  if (body.locationAddress !== undefined) fields.locationAddress = body.locationAddress?.trim() || null;
  if (body.arrivalTime !== undefined) fields.arrivalTime = body.arrivalTime?.trim() || null;
  if (body.fieldNumber !== undefined) fields.fieldNumber = body.fieldNumber?.trim() || null;
  if (body.uniform !== undefined)     fields.uniform = body.uniform?.trim() || null;
  if (body.resources !== undefined)   fields.resources = sanitizeResources(body.resources);
  if (body.opponent !== undefined)    fields.opponent = body.opponent?.trim() || null;
  if (body.homeAway !== undefined)    fields.homeAway = body.homeAway || null;
  if (body.teamScore !== undefined)     fields.teamScore = body.teamScore != null ? Number(body.teamScore) : null;
  if (body.opponentScore !== undefined) fields.opponentScore = body.opponentScore != null ? Number(body.opponentScore) : null;

  if (body.result !== undefined) {
    const r = body.result;
    if (r !== null && !['win', 'loss', 'tie'].includes(r)) {
      return NextResponse.json({ error: 'result must be win, loss, tie, or null' }, { status: 400 });
    }
    fields.result = r;
  }

  if (body.status !== undefined) {
    const s = body.status;
    if (s !== 'scheduled' && s !== 'cancelled') {
      return NextResponse.json({ error: 'status must be scheduled or cancelled' }, { status: 400 });
    }
    fields.status = s;
  }

  // Game tags — full replace-on-save, same as the create route. Not offered on the series-scope
  // edit above (a coach tags one specific game, not a whole recurring run at once).
  let tagIds: string[] | null = null;
  if (body.tagIds !== undefined) {
    tagIds = await resolveValidTagIds(teamId, body.tagIds);
    if (tagIds === null) {
      return NextResponse.json({ error: 'tagIds must be an array of this team’s existing tag ids' }, { status: 400 });
    }
  }

  const updated = await updateRepTeamEvent(eventId, fields);
  if (tagIds !== null) {
    await setRepTeamEventTags(eventId, tagIds);
  }
  return NextResponse.json({ event: updated });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]' });

export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.schedule, 'You do not have access to the schedule.');
  if (denied) return denied;

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
      // Delete the clicked event itself: the parent query only matches CHILDREN (recurrence_parent_id),
      // so when the clicked event IS the anchor it's not caught above; deleting it here is a harmless
      // no-op for a child (already removed). This makes "this & future" from the first occurrence
      // remove it too.
      await deleteRepTeamEvent(eventId);
    } else {
      return NextResponse.json({ error: 'scope must be one, remaining, or all' }, { status: 400 });
    }
  } else {
    // external_tournament: child game slots are cascade-deleted by the DB FK
    await deleteRepTeamEvent(eventId);
  }

  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]' });
