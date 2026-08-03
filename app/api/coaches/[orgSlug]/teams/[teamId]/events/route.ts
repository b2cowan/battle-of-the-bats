import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamEvents,
  getRepTeamLineupAttendanceMismatchEventIds,
  getRepTeamLineupSetEventIds,
  createRepTeamEvent,
  createRepTeamEvents,
  getRepTeamTagLibrary,
  getRepTeamEventTagsMap,
  setRepTeamEventTagsOfKind,
  getRepEventAwardCountsMap,
} from '@/lib/db';
import type { RepEventType } from '@/lib/types';
import { sanitizeResources } from '@/lib/rep-event-resources';
import { resolveValidTagIds } from '@/lib/rep-event-tags';
import { withObservability } from '@/lib/observability';
import { denyUnless } from '@/lib/coach-capabilities';
import { syncTournamentGameMirrorSafely } from '@/lib/rep-tournament-game-mirror';
import {
  generateWeeklyOccurrences, reviewRecurrenceOccurrences,
  type RecurrenceOccurrenceInput,
} from '@/lib/coach-recurrence';
import { EVENT_NAME_PREFIX } from '@/lib/coach-schedule-vocab';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';

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

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in resolved) return resolved.error;
  const { ctx, capabilities, programYear } = resolved;
  const denied = denyUnless(capabilities.schedule, 'You do not have access to the schedule.');
  if (denied) return denied;

  const url = new URL(req.url);
  const from = url.searchParams.get('from') ?? undefined;
  const to   = url.searchParams.get('to')   ?? undefined;
  const type = url.searchParams.get('type') as RepEventType | undefined ?? undefined;

  // Batch 4 (P0 #2): keep the team's REAL tournament games in step before reading the calendar.
  // This route is the single read behind Schedule, Lineups AND Overview, so syncing here means a
  // coach never opens a stale time, and a reschedule or a resolved bracket has already landed by
  // the time they look. Awaited deliberately — `after()` has no waitUntil bridge on Amplify, so a
  // fire-and-forget side-write can silently never run. Debounced per season inside the lib, and
  // never fatal: a tournament-side read failing must not cost the coach their schedule.
  await syncTournamentGameMirrorSafely({
    repTeamId: teamId,
    programYearId: programYear.id,
    programYearCreatedAt: programYear.createdAt,
    orgId: ctx!.org.id,
  });

  const events = await getRepTeamEvents(programYear.id, { from, to, type });
  // Lineup flags, only for coaches who can see lineups (they're only actionable for them):
  // mismatch = saved lineup disagrees with attendance; set = the game has a real saved lineup
  // (powers the Lineups page's readiness chips + "Needs lineup" filter without N+1 probes).
  const [lineupMismatchEventIds, lineupSetEventIds] = capabilities.lineups
    ? await Promise.all([
        getRepTeamLineupAttendanceMismatchEventIds(programYear.id),
        getRepTeamLineupSetEventIds(programYear.id),
      ])
    : [[], null];
  // Tags: the team's game-tag library (for the chip picker) + which tags each returned event
  // already carries (for chip display without a per-event fetch). Both gate on the same
  // `schedule` capability already required for this whole route.
  const [tags, tagsByEventId, awardCountByEventId] = await Promise.all([
    getRepTeamTagLibrary(teamId, 'game', ctx.org.id),
    getRepTeamEventTagsMap(events.map(e => e.id)),
    getRepEventAwardCountsMap(events.map(e => e.id)),
  ]);
  // lineupSetEventIds is OMITTED (not []) when the caller can't see lineups, so a client with a
  // stale capability cache can tell "no lineup visibility" apart from "no lineups saved" and
  // render no readiness badges instead of a false "Not set" on every game.
  return NextResponse.json({
    events,
    programYear,
    lineupMismatchEventIds,
    tags,
    tagsByEventId,
    awardCountByEventId,
    ...(lineupSetEventIds ? { lineupSetEventIds } : {}),
  });
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
  // Narrowed once, after validation — `eventType` comes off the request body as `any`.
  const type: RepEventType = eventType;

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

    const rule = { dayOfWeek: Number(dayOfWeek), startDate, endDate };
    // Chunk C (P1 #6): the coach reviews the occurrences before any exist, so the client sends the
    // rows it actually showed them — each with its own opponent. Regenerate from the SAME rule and
    // reconcile: a submitted date this rule cannot produce fails the whole request (never written,
    // never quietly dropped), and a generated date the client omitted is a deliberate removal.
    // A caller that sends no `occurrences` at all gets the full generated series, one row per date.
    const submitted: RecurrenceOccurrenceInput[] = Array.isArray(body.occurrences)
      ? body.occurrences
      : generateWeeklyOccurrences(rule).map(date => ({ date, opponent, homeAway }));
    const reviewed = reviewRecurrenceOccurrences(rule, submitted);

    if (reviewed.unknown.length) {
      return NextResponse.json(
        { error: `These dates aren’t part of this repeat: ${reviewed.unknown.join(', ')}. Reopen the form and try again.` },
        { status: 400 },
      );
    }
    if (!reviewed.accepted.length) {
      return NextResponse.json({ error: 'No occurrences generated in the given date range' }, { status: 400 });
    }

    // The first occurrence IS the series anchor: give it an explicit id and point every later
    // occurrence's recurrence_parent_id at it (a real FK target), so "this & future / all" edits
    // and deletes resolve the whole series.
    const anchorId = randomUUID();
    const isGame = eventType === 'scrimmage' || eventType === 'league_game' || eventType === 'tournament_game';
    const rows = reviewed.accepted.map((occ, i) => {
      // Per-date opponent (Chunk C) with the single-opponent body value as the fallback, so a
      // caller that never opened the preview still behaves exactly as it did before.
      const rowOpponent = occ.opponent ?? (opponent?.trim() || null);
      return {
        ...(i === 0 ? { id: anchorId } : {}),
        programYearId: programYear.id,
        teamId: team.id,
        orgId: ctx!.org.id,
        eventType,
        // A game names itself from ITS OWN opponent, so a series of twelve different opponents
        // reads as twelve different games rather than twelve copies of the first one's title.
        name: isGame && rowOpponent ? `${EVENT_NAME_PREFIX[type]} vs ${rowOpponent}` : name.trim(),
        description: description?.trim() || null,
        startsAt: `${occ.date}T${startTime}`,
        endsAt: endTime ? `${occ.date}T${endTime}` : null,
        location: location?.trim() || null,
        locationAddress: locationAddress?.trim() || null,
        arrivalTime: arrivalTime?.trim() || null,
        fieldNumber: fieldNumber?.trim() || null,
        uniform: isGame ? (uniform?.trim() || null) : null,
        resources: resources.length ? resources : undefined,
        opponent: isGame ? rowOpponent : null,
        homeAway: isGame ? (occ.homeAway ?? homeAway ?? null) : null,
        isRecurring: true,
        recurrenceRule,
        recurrenceParentId: i === 0 ? null : anchorId,
      };
    });

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

  // Game tags — a one-off (non-recurring) event only; the recurring bulk-create wizard doesn't
  // collect per-occurrence tags (a coach tags a specific game later, from its own edit form).
  let tagIds: string[] | null = [];
  if (body.tagIds !== undefined) {
    tagIds = await resolveValidTagIds(teamId, ctx.org.id, 'game', body.tagIds);
    if (tagIds === null) {
      return NextResponse.json({ error: 'tagIds must be an array of this team’s existing tag ids' }, { status: 400 });
    }
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

  if (tagIds.length > 0) {
    await setRepTeamEventTagsOfKind(event.id, 'game', tagIds);
  }

  return NextResponse.json({ event }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events' });
