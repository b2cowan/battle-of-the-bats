import { refuseWithoutLiveSeat } from '@/lib/coach-season-refusal';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepRosterPlayers,
  getRepCallUpsForEvent,
  getRepTeam,
  getRepTeamEventAttendance,
  getRepTeamEventById,
  writeCoachAttendance,
  type CoachAttendanceEntry,
} from '@/lib/db';
import type { RepAttendanceStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { denyUnless, redactRoster } from '@/lib/coach-capabilities';
import { answerLinesForReply, coachFamilyAnswersSetting, type KnownRepTeam } from '@/lib/family-availability-coach';
import { familyAnswerState } from '@/lib/family-availability-rules';

const VALID_ATTENDANCE_STATUSES: RepAttendanceStatus[] = ['unknown', 'attending', 'absent', 'late', 'maybe'];

async function resolveCoachContext(orgSlug: string, teamId: string, eventId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: await refuseWithoutLiveSeat(ctx.org, ctx.user.id, teamId) };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  const event = await getRepTeamEventById(eventId);
  if (!event || event.teamId !== teamId || event.programYearId !== programYear.id) {
    return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear, event };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(assignment.capabilities.attendance, 'You do not have access to attendance.');
  if (denied) return denied;

  const [players, callUps, attendance] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepCallUpsForEvent(eventId),
    getRepTeamEventAttendance(eventId),
  ]);

  return NextResponse.json({
    /**
     * ⚠ THIS GAME'S CALL-UPS ARE ON THIS GAME'S SHEET (mig 309, owner ruling R4) — a borrowed player
     * who does not turn up is the same problem as a rostered one who does not, and it is one game's
     * list, not every event's.
     *
     * ⚠⚠ Adding them here was NOT optional once the bench console started carrying them. The console
     * builds its "Who's here" drawer from its own payload, which merges call-ups in — so the drawer
     * OFFERED a borrowed player and this route's PATCH refused them, 400, with the console's catch
     * rolling the toggle back and showing nothing. Mid-game, the button just flipped back.
     * A picker and its validator must agree; found by `/review`.
     */
    players: redactRoster([...players.filter(player => player.status === 'active'), ...callUps], assignment.capabilities),
    attendance,
    programYear,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/attendance' });

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE COACH'S SAVE (One attendance record, mig 483; plan ONE_ATTENDANCE_RECORD_PLAN.md §2). ONE answer per player, shared with
 * the family's writer: latest wins.
 *
 *   { entries: [{ playerId, status?, note? }] }   only the rows the coach CHANGED; a key left out is not written (the status
 *                                                 alone, the coach's note alone, or both)
 *   { fill: 'attending' }                         "All in": fills only players nobody has answered (ruling 6), any setter
 *   { reset: true }                               "Reset": clears only the answers the COACH set; families' stay (call C2)
 *
 * The reply is the event's rows as they now stand, so the window takes what it didn't touch (a family's answer that arrived while
 * it was open) instead of saving over it — and, where the room shows them, each player's who/when line (`lines`: who set the
 * answer, the family's note, the one before; this route holds the attendance capability, ask 11).
 *
 * ⚠⚠ NEVER THE WHOLE ROSTER. The window used to send every row on every tap, re-stamping each one; under latest-wins that
 *   overwrote every family answer that arrived since the window opened. This route and the family's writer ship together.
 * ⚠ Maybe only where families can answer this event, before its start (call C3): a team with the switch off sees today's four.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, team, assignment, programYear, event } = resolved;
  const denied = denyUnless(assignment.capabilities.attendance, 'You do not have access to attendance.');
  if (denied) return denied;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const bulk = body?.fill === 'attending' ? 'fill' : body?.reset === true ? 'reset' : null;
  const entries = Array.isArray(body?.entries) ? body.entries as unknown[] : null;
  if (!bulk && !entries) {
    return NextResponse.json({ error: 'entries must be an array' }, { status: 400 });
  }

  // Same set the GET offers: the active roster PLUS this game's call-ups (mig 309, owner ruling R4).
  // A picker and its validator must agree — the console's "Who's here" drawer draws from the GET.
  const [roster, eventCallUps] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepCallUpsForEvent(eventId),
  ]);
  const players = roster.filter(player => player.status === 'active');
  const activePlayerIds = new Set([...players, ...eventCallUps].map(player => player.id));

  if (bulk) {
    const all = [...activePlayerIds];
    const attendance = await writeCoachAttendance(bulk === 'fill'
      ? { eventId, coachUserId: ctx.user.id, entries: all.map(playerId => ({ playerId, status: 'attending' })), onlyIfUnknown: true }
      : { eventId, coachUserId: ctx.user.id, entries: all.map(playerId => ({ playerId, status: 'unknown' })), onlyIfSetBy: 'coach' });
    return NextResponse.json({ attendance, event, ...await linesFor(teamId, team, event, [...activePlayerIds]) });
  }

  let maybeOpen: boolean | null = null;
  const rows: CoachAttendanceEntry[] = [];
  const seen = new Set<string>();
  for (const raw of entries!) {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const playerId = typeof entry.playerId === 'string' ? entry.playerId : '';
    if (!activePlayerIds.has(playerId)) {
      return NextResponse.json({ error: 'Attendance can only be saved for players on this roster, or a call-up on this game' }, { status: 400 });
    }
    if (seen.has(playerId)) return NextResponse.json({ error: 'Each player can be saved once per request' }, { status: 400 });
    seen.add(playerId);
    const hasStatus = entry.status !== undefined;
    const hasNote = entry.note !== undefined;
    if (!hasStatus && !hasNote) return NextResponse.json({ error: 'Nothing to save for this player' }, { status: 400 });
    const status = entry.status as RepAttendanceStatus;
    if (hasStatus && !VALID_ATTENDANCE_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid attendance status' }, { status: 400 });
    }
    if (hasStatus && status === 'maybe') {
      maybeOpen ??= await maybeIsOffered(teamId, team, event);
      if (!maybeOpen) return NextResponse.json({ error: 'Maybe is only for events families can still answer' }, { status: 400 });
    }
    if (hasNote && entry.note !== null && typeof entry.note !== 'string') {
      return NextResponse.json({ error: 'Invalid attendance note' }, { status: 400 });
    }
    const note = typeof entry.note === 'string' ? entry.note.trim() : null;
    if (note && note.length > 500) {
      return NextResponse.json({ error: 'Attendance notes must be 500 characters or less' }, { status: 400 });
    }
    rows.push({ playerId, ...(hasStatus ? { status } : {}), ...(hasNote ? { note: note || null } : {}) });
  }

  const attendance = await writeCoachAttendance({ eventId, coachUserId: ctx.user.id, entries: rows });
  return NextResponse.json({ attendance, event, ...await linesFor(teamId, team, event, [...activePlayerIds]) });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/attendance' });

type Team = NonNullable<Awaited<ReturnType<typeof getRepTeam>>>;
const known = (team: Team): KnownRepTeam => ({
  id: team.id, orgId: team.orgId, scheduleVisibility: team.scheduleVisibility, isArchived: team.isArchived, familyAnswers: team.familyAnswers,
});

/** Call C3: Maybe only while families can answer THIS event (the team's live switch covers it, and it hasn't started). */
async function maybeIsOffered(
  teamId: string, team: Awaited<ReturnType<typeof getRepTeam>>, event: { eventType: string; status: string; startsAt: string },
): Promise<boolean> {
  if (!team) return false;
  const setting = await coachFamilyAnswersSetting(teamId, known(team));
  return !!setting && familyAnswerState(setting, event, new Date()) === 'open';
}

/** The reply's who/when lines, only where the room shows them (else nothing, and the room keeps the lines it has). */
async function linesFor(
  teamId: string, team: Awaited<ReturnType<typeof getRepTeam>>, event: { id: string; eventType: string; status: string; startsAt: string },
  playerIds: string[],
): Promise<{ lines?: Awaited<ReturnType<typeof answerLinesForReply>> }> {
  if (!team) return {};
  const lines = await answerLinesForReply({ teamId, team: known(team), event, playerIds });
  return lines ? { lines } : {};
}
