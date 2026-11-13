import { NextResponse } from 'next/server';
import { getRepTeamEventById } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveFamilyAttendanceContext } from '@/lib/family-coach-route';
import { roomFamilyAnswers } from '@/lib/family-availability-coach';

/**
 * The attendance room's family side for one event (Signed-in family accounts Stage 4b, Part 5): per rostered player, whether a
 * parent is in the app and what the family said, with the note's words. Coaches who can mark attendance only (ask 11). READ ONLY:
 * the coach copies an answer into the book through the attendance PATCH, never here.
 *
 * 404 while the guardian tier is off or the team has no family layer (the shared chain), and `{ answers: null }` while the team's
 * switch doesn't cover this event; the room's one caller reads both as "nothing", so the room renders exactly as before.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const r = await resolveFamilyAttendanceContext(params);
  if ('error' in r) return r.error;

  const event = await getRepTeamEventById(r.eventId);
  if (!event || event.teamId !== r.teamId || event.programYearId !== r.programYearId) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const answers = await roomFamilyAnswers({ teamId: r.teamId, programYearId: r.programYearId, event, team: r.team });
  return NextResponse.json({ answers });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/family-answers' });
