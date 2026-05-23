import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getActiveRepProgramYear,
  getCoachingAssignmentsForUser,
  getRepRosterPlayers,
  getRepTeam,
  getRepTeamEventAttendance,
  getRepTeamEventById,
  upsertRepTeamEventAttendance,
} from '@/lib/db';
import type { RepAttendanceStatus } from '@/lib/types';

const VALID_ATTENDANCE_STATUSES: RepAttendanceStatus[] = ['unknown', 'attending', 'absent', 'late'];

async function resolveCoachContext(orgSlug: string, teamId: string, eventId: string) {
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

  const event = await getRepTeamEventById(eventId);
  if (!event || event.teamId !== teamId || event.programYearId !== programYear.id) {
    return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear, event };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },
) {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error;
  const { programYear } = resolved;

  const [players, attendance] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepTeamEventAttendance(eventId),
  ]);

  return NextResponse.json({
    players: players.filter(player => player.status === 'active'),
    attendance,
    programYear,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },
) {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error;
  const { ctx, programYear, event } = resolved;

  const body = await req.json();
  const entries = Array.isArray(body.entries) ? body.entries : null;
  if (!entries) {
    return NextResponse.json({ error: 'entries must be an array' }, { status: 400 });
  }

  const players = (await getRepRosterPlayers(programYear.id)).filter(player => player.status === 'active');
  const activePlayerIds = new Set(players.map(player => player.id));

  const rows = [];
  for (const entry of entries) {
    const playerId = typeof entry?.playerId === 'string' ? entry.playerId : '';
    const status = entry?.status as RepAttendanceStatus;
    const note = typeof entry?.note === 'string' ? entry.note.trim() : '';

    if (!activePlayerIds.has(playerId)) {
      return NextResponse.json({ error: 'Attendance can only be saved for active roster players' }, { status: 400 });
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
}
