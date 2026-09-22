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
  upsertRepTeamEventAttendance,
} from '@/lib/db';
import type { RepAttendanceStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { denyUnless, redactRoster } from '@/lib/coach-capabilities';

const VALID_ATTENDANCE_STATUSES: RepAttendanceStatus[] = ['unknown', 'attending', 'absent', 'late'];

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
  if (!assignment) return { error: forbidden() };

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

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment, programYear, event } = resolved;
  const denied = denyUnless(assignment.capabilities.attendance, 'You do not have access to attendance.');
  if (denied) return denied;

  const body = await req.json();
  const entries = Array.isArray(body.entries) ? body.entries : null;
  if (!entries) {
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

  const rows = [];
  for (const entry of entries) {
    const playerId = typeof entry?.playerId === 'string' ? entry.playerId : '';
    const status = entry?.status as RepAttendanceStatus;
    const note = typeof entry?.note === 'string' ? entry.note.trim() : '';

    if (!activePlayerIds.has(playerId)) {
      return NextResponse.json({ error: 'Attendance can only be saved for players on this roster, or a call-up on this game' }, { status: 400 });
    }
    if (!VALID_ATTENDANCE_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid attendance status' }, { status: 400 });
    }
    if (note.length > 500) {
      return NextResponse.json({ error: 'Attendance notes must be 500 characters or less' }, { status: 400 });
    }

    rows.push({
      eventId,
      playerId,
      programYearId: programYear.id,
      teamId,
      orgId: ctx.org.id,
      status,
      note: note || null,
      updatedBy: ctx.user.id,
    });
  }

  const attendance = await upsertRepTeamEventAttendance(rows);
  return NextResponse.json({ attendance, event });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/attendance' });
