import { NextResponse } from 'next/server';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import {
  getRepTeamPlaceById, updateRepTeamPlace, deleteRepTeamPlace, updateUpcomingEventsForPlace, getRepTeamPlaceUsage,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageSchedule } from '@/lib/coach-capabilities';
import { readPlaceFields } from '@/lib/coach-places';

/**
 * One place — PATCH to edit, DELETE to remove (Arrival & Places, mig 307).
 *
 * ⚠ THE OFFER (D6): a PATCH may carry `updateUpcoming: true`, and then the team's UPCOMING events
 * at this place take the new name and address — never the diamond (per-game), never a past event
 * (the record of where the team WAS). Without the flag the book changes and no event does. The
 * response says how many moved, so the sheet can tell the coach.
 *
 * DELETE leaves every event's text alone — the FK sets their link to null.
 */
type PlaceParams = { params: Promise<{ orgSlug: string; teamId: string; placeId: string }> };
const ROUTE = '/api/coaches/[orgSlug]/teams/[teamId]/places/[placeId]';
const DENIED = 'You do not have access to the schedule.';

/** One place with its usage — what the edit sheet's offer needs (how many upcoming events sit here). */
export const GET = withObservability(async (_req: Request, { params }: PlaceParams) => {
  const { orgSlug, teamId, placeId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const denied = denyUnless(canManageSchedule(resolved.capabilities), DENIED);
  if (denied) return denied;
  const place = await getRepTeamPlaceById(placeId, teamId);
  if (!place) return NextResponse.json({ error: 'Place not found' }, { status: 404 });
  const usage = await getRepTeamPlaceUsage(placeId, teamId);
  return NextResponse.json({ place, usage });
}, { route: ROUTE });

export const PATCH = withObservability(async (req: Request, { params }: PlaceParams) => {
  const { orgSlug, teamId, placeId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canManageSchedule(resolved.assignment.capabilities), DENIED);
  if (denied) return denied;

  const before = await getRepTeamPlaceById(placeId, teamId);
  if (!before) return NextResponse.json({ error: 'Place not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { fields, error } = readPlaceFields(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const updateUpcoming = body && typeof body === 'object' && (body as { updateUpcoming?: unknown }).updateUpcoming === true;

  try {
    const place = await updateRepTeamPlace(placeId, teamId, fields);
    if (!place) return NextResponse.json({ error: 'Place not found' }, { status: 404 });
    let movedEvents = 0;
    if (updateUpcoming && (place.name !== before.name || place.address !== before.address)) {
      movedEvents = await updateUpcomingEventsForPlace(placeId, teamId, { location: place.name, locationAddress: place.address });
    }
    return NextResponse.json({ place, movedEvents });
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `You already have a place named “${fields.name}”.` }, { status: 409 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save the place.' }, { status: 400 });
  }
}, { route: ROUTE });

/** Remove a place. The sheet reads counts from GET /places before asking; this answers with what it unlinked. */
export const DELETE = withObservability(async (_req: Request, { params }: PlaceParams) => {
  const { orgSlug, teamId, placeId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const denied = denyUnless(canManageSchedule(resolved.assignment.capabilities), DENIED);
  if (denied) return denied;

  const usage = await getRepTeamPlaceUsage(placeId, teamId);
  const removed = await deleteRepTeamPlace(placeId, teamId);
  if (!removed) return NextResponse.json({ error: 'Place not found' }, { status: 404 });
  // The events keep their text; only the link is gone. Said back so the sheet can say it too.
  return NextResponse.json({ ok: true, unlinkedEvents: usage.total });
}, { route: ROUTE });
