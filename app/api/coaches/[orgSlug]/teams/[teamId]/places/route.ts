import { NextResponse } from 'next/server';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { getRepTeamPlaces, createRepTeamPlace } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canManageSchedule } from '@/lib/coach-capabilities';
import { readPlaceFields, MAX_PLACES_PER_TEAM } from '@/lib/coach-places';

/**
 * The place book (Arrival & Places, mig 307) — GET the team's places, POST to add one.
 *
 * Gates are the game-tag library's: reading rides schedule access, minting is a schedule act. The
 * read resolves the team's WORKING season (between seasons a coach still reads the book beside a
 * finished calendar); every write demands a LIVE season — a book is an instrument, not a record.
 * Every route runs service-role; the table's RLS is the closed direct door, never the gate.
 */
type TeamParams = { params: Promise<{ orgSlug: string; teamId: string }> };
const ROUTE = '/api/coaches/[orgSlug]/teams/[teamId]/places';
const DENIED = 'You do not have access to the schedule.';

export const GET = withObservability(async (_req: Request, { params }: TeamParams) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const denied = denyUnless(canManageSchedule(resolved.capabilities), DENIED);
  if (denied) return denied;
  const places = await getRepTeamPlaces(teamId);
  return NextResponse.json({ places });
}, { route: ROUTE });

export const POST = withObservability(async (req: Request, { params }: TeamParams) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;
  const denied = denyUnless(canManageSchedule(assignment.capabilities), DENIED);
  if (denied) return denied;

  const body = await req.json().catch(() => ({}));
  const { fields, error } = readPlaceFields(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!fields.name) return NextResponse.json({ error: 'A place needs a name.' }, { status: 400 });

  const existing = await getRepTeamPlaces(teamId);
  if (existing.length >= MAX_PLACES_PER_TEAM) {
    return NextResponse.json({ error: `You can keep up to ${MAX_PLACES_PER_TEAM} places. Remove one to add another.` }, { status: 400 });
  }

  try {
    const place = await createRepTeamPlace({
      orgId: ctx.org.id, teamId, name: fields.name,
      address: fields.address ?? null, fieldNumber: fields.fieldNumber ?? null, note: fields.note ?? null,
      createdBy: ctx.user.id,
    });
    return NextResponse.json({ place });
  } catch (e: unknown) {
    // The case-insensitive unique index doing its job: "Sherwood Park" and "sherwood park" are one.
    if ((e as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `You already have a place named “${fields.name}”.` }, { status: 409 });
    }
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not add the place.' }, { status: 400 });
  }
}, { route: ROUTE });
