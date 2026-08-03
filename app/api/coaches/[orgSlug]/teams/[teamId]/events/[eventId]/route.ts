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
  setRepTeamEventTagsOfKind,
} from '@/lib/db';
import { sanitizeResources } from '@/lib/rep-event-resources';
import { resolveValidTagIds } from '@/lib/rep-event-tags';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';
import { isMirroredEvent } from '@/lib/coach-tournament-games';
import { ORGANIZER_OWNED_API_FIELDS } from '@/lib/tournament-game-mirror';
import { notifyFamiliesOfGameUpdate } from '@/lib/family-notify';

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
  const { ctx, assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.schedule, 'You do not have access to the schedule.');
  if (denied) return denied;

  const event = await getRepTeamEventById(eventId);
  if (!event || event.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const body = await req.json();

  // Batch 4: a MIRRORED tournament game's facts belong to the organizer. The coach still owns
  // arrival time, uniform, field, notes, links and tags (and attendance + the lineup, which are
  // different routes entirely and stay fully open) — but the time, opponent, venue, score, result
  // and whether the game happened at all are the tournament's, and the next sync would overwrite
  // them anyway. Refusing here rather than silently accepting-then-reverting is the honest answer.
  // The UI already hides these fields on a mirrored game; this is the server-side guarantee.
  if (isMirroredEvent(event)) {
    const attempted = ORGANIZER_OWNED_API_FIELDS.filter(field => body[field] !== undefined);
    if (attempted.length > 0) {
      return NextResponse.json(
        {
          error: `This game comes from ${event.name} and is kept in step with the organizer’s schedule. You can still set arrival time, uniform, field, notes, links and tags — and take attendance or build the lineup.`,
          organizerOwnedFields: attempted,
        },
        { status: 409 },
      );
    }
  }

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
      const tagIds = await resolveValidTagIds(teamId, ctx.org.id, 'game', body.tagIds);
      if (tagIds === null) {
        return NextResponse.json({ error: 'tagIds must be an array of this team’s existing tag ids' }, { status: 400 });
      }
      await setRepTeamEventTagsOfKind(eventId, 'game', tagIds);
    }

    // Tell families ONCE for the whole series (Chunk D 1.11). This path used to return
    // before the notify block below ever ran, so moving a recurring practice from Tuesdays
    // to Wednesdays — the single most disruptive edit a coach can make — reached nobody.
    //
    // One notification, not one per occurrence: a coach shifting a season of practices
    // must not fire twenty emails at every family. It describes THIS event, which is the
    // occurrence the coach was looking at and the one that makes the change concrete.
    const seriesMoved =
      (typeof body.startsAt === 'string' && body.startsAt)
      || (typeof body.endsAt === 'string' && body.endsAt)
      || body.location !== undefined;
    if (seriesMoved) {
      await notifyFamiliesOfGameUpdate({
        eventId,
        kind: 'schedule_change',
        actorUserId: ctx.user.id,
      });
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
    tagIds = await resolveValidTagIds(teamId, ctx.org.id, 'game', body.tagIds);
    if (tagIds === null) {
      return NextResponse.json({ error: 'tagIds must be an array of this team’s existing tag ids' }, { status: 400 });
    }
  }

  const updated = await updateRepTeamEvent(eventId, fields);
  if (tagIds !== null) {
    await setRepTeamEventTagsOfKind(eventId, 'game', tagIds);
  }

  // ── Tell connected families (Chunk D 1.11) ──
  // Only the three changes a family actually needs to hear about: it moved, it's off, or it's
  // over. Field number, uniform, notes and tags are coach-side detail and stay silent — a
  // family layer that pings on every keystroke is one families mute in a week.
  //
  // AWAITED deliberately, not fired into `after()`: Amplify has no waitUntil bridge, so
  // post-response work can silently never run (memory: reference_next_after_amplify). The
  // dispatcher never throws, so awaiting it cannot fail the coach's save.
  // `changed(key)` means "this save actually moved the field", so a no-op re-save stays
  // silent. A score field counts only when it lands on a VALUE — clearing a score mid-
  // correction should not announce a result.
  const changed = <K extends keyof typeof fields & keyof typeof event>(key: K) =>
    fields[key] !== undefined && (fields[key] as unknown) !== (event[key] as unknown);
  const scoreLanded = <K extends keyof typeof fields>(key: K) =>
    changed(key) && fields[key] !== null;

  const familyUpdateKind =
    changed('status') && fields.status === 'cancelled' ? 'cancelled' as const
    // The reverse transition matters just as much: a family told the game was off needs to
    // hear it is back on.
    : changed('status') && fields.status === 'scheduled' ? 'reinstated' as const
    // ALL THREE score fields, not just our own. A 4–2 corrected to 4–3 moves only the
    // opponent's number, and leaving it out meant the correction never reached anyone.
    : scoreLanded('result') || scoreLanded('teamScore') || scoreLanded('opponentScore')
      ? 'final_score' as const
    : changed('startsAt') || changed('location')
      ? 'schedule_change' as const
    : null;

  if (familyUpdateKind) {
    await notifyFamiliesOfGameUpdate({
      eventId,
      kind: familyUpdateKind,
      actorUserId: ctx.user.id,
    });
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

  // Batch 4: a mirrored tournament game isn't the coach's to delete — and a delete wouldn't stick
  // (the next sync would recreate it, minus their attendance and lineup, which cascade away).
  if (isMirroredEvent(event)) {
    return NextResponse.json(
      { error: `This game comes from ${event.name}. Ask the organizer to remove it from the tournament schedule.` },
      { status: 409 },
    );
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
