import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamEvents,
  getRepTeamLineupAttendanceMismatchEventIds,
  createRepTeamEvent,
  createRepTeamEvents,
} from '@/lib/db';
import type { RepEventType } from '@/lib/types';
import { sanitizeResources } from '@/lib/rep-event-resources';
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

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function generateOccurrences(
  startDate: string,
  endDate: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string | null,
): { startsAt: string; endsAt: string | null }[] {
  const result: { startsAt: string; endsAt: string | null }[] = [];
  const end = new Date(endDate + 'T23:59:59');
  const current = new Date(startDate + 'T00:00:00');
  const daysUntil = (dayOfWeek - current.getDay() + 7) % 7;
  current.setDate(current.getDate() + daysUntil);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    result.push({
      startsAt: `${dateStr}T${startTime}:00`,
      endsAt: endTime ? `${dateStr}T${endTime}:00` : null,
    });
    current.setDate(current.getDate() + 7);
  }
  return result;
}

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.schedule, 'You do not have access to the schedule.');
  if (denied) return denied;

  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? undefined;
  const to   = url.searchParams.get('to')   ?? undefined;
  const type = url.searchParams.get('type') as RepEventType | undefined ?? undefined;

  const events = await getRepTeamEvents(programYear.id, { from, to, type });
  // Game events whose saved lineup disagrees with attendance — only surfaced to coaches who can
  // see lineups (the ⚠ is only actionable for them).
  const lineupMismatchEventIds = assignment.capabilities.lineups
    ? await getRepTeamLineupAttendanceMismatchEventIds(programYear.id)
    : [];
  return NextResponse.json({ events, programYear, lineupMismatchEventIds });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.schedule, 'You do not have access to the schedule.');
  if (denied) return denied;

  const body = await req.json();
  const {
    eventType,
    name,
    description = null,
    startsAt,
    endsAt = null,
    location = null,
    locationAddress = null,
    arrivalTime = null,
    fieldNumber = null,
    uniform = null,
    opponent = null,
    homeAway = null,
    parentEventId = null,
    isRecurring = false,
    recurrenceRule = null,
  } = body;
  const resources = sanitizeResources(body.resources);

  if (!eventType || !name?.trim()) {
    return NextResponse.json({ error: 'eventType and name are required' }, { status: 400 });
  }

  const VALID_TYPES: RepEventType[] = [
    'external_tournament', 'tournament_game', 'scrimmage', 'league_game', 'practice', 'team_event',
  ];
  if (!VALID_TYPES.includes(eventType)) {
    return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 });
  }

  // Event types that may recur weekly (practices, league games, generic team events). Scrimmages
  // and tournament games stay one-off (tournament-bound / ad hoc).
  const RECURRABLE: RepEventType[] = ['practice', 'league_game', 'team_event'];
  if (isRecurring && RECURRABLE.includes(eventType)) {
    const { dayOfWeek, startDate, endDate, startTime, endTime = null } = recurrenceRule ?? {};
    if (dayOfWeek == null || !startDate || !endDate || !startTime) {
      return NextResponse.json(
        { error: 'recurrenceRule must include dayOfWeek, startDate, endDate, startTime for a recurring series' },
        { status: 400 },
      );
    }
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ error: `dayOfWeek must be 0–6 (${DAYS.join(', ')})` }, { status: 400 });
    }

    const occurrences = generateOccurrences(startDate, endDate, Number(dayOfWeek), startTime, endTime);
    if (!occurrences.length) {
      return NextResponse.json({ error: 'No occurrences generated in the given date range' }, { status: 400 });
    }

    // The first occurrence IS the series anchor: give it an explicit id and point every later
    // occurrence's recurrence_parent_id at it (a real FK target), so "this & future / all" edits
    // and deletes resolve the whole series.
    const anchorId = randomUUID();
    const isGame = eventType === 'scrimmage' || eventType === 'league_game' || eventType === 'tournament_game';
    const rows = occurrences.map((occ, i) => ({
      ...(i === 0 ? { id: anchorId } : {}),
      programYearId: programYear.id,
      teamId: team.id,
      orgId: ctx!.org.id,
      eventType,
      name: name.trim(),
      description: description?.trim() || null,
      startsAt: occ.startsAt,
      endsAt: occ.endsAt,
      location: location?.trim() || null,
      locationAddress: locationAddress?.trim() || null,
      arrivalTime: arrivalTime?.trim() || null,
      fieldNumber: fieldNumber?.trim() || null,
      uniform: isGame ? (uniform?.trim() || null) : null,
      resources: resources.length ? resources : undefined,
      opponent: isGame ? (opponent?.trim() || null) : null,
      homeAway: isGame ? (homeAway || null) : null,
      isRecurring: true,
      recurrenceRule,
      recurrenceParentId: i === 0 ? null : anchorId,
    }));

    // Insert the anchor FIRST, then the children that reference it — so the self-referencing
    // recurrence_parent_id FK is always satisfied (never relies on intra-statement FK timing).
    const [anchor] = await createRepTeamEvents([rows[0]]);
    const children = rows.length > 1 ? await createRepTeamEvents(rows.slice(1)) : [];
    const events = [anchor, ...children];
    return NextResponse.json({ events, count: events.length }, { status: 201 });
  }

  if (!startsAt) {
    return NextResponse.json({ error: 'startsAt is required' }, { status: 400 });
  }

  const event = await createRepTeamEvent({
    programYearId: programYear.id,
    teamId: team.id,
    orgId: ctx!.org.id,
    eventType,
    name: name.trim(),
    description: description?.trim() || null,
    startsAt,
    endsAt: endsAt || null,
    location: location?.trim() || null,
    locationAddress: locationAddress?.trim() || null,
    arrivalTime: arrivalTime?.trim() || null,
    fieldNumber: fieldNumber?.trim() || null,
    uniform: uniform?.trim() || null,
    resources: resources.length ? resources : undefined,
    opponent: opponent?.trim() || null,
    homeAway: homeAway || null,
    parentEventId: parentEventId || null,
  });

  return NextResponse.json({ event }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events' });
