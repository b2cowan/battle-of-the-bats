import { NextResponse } from 'next/server';
import { resolveFamilyAttendanceContext } from '@/lib/family-coach-route';
import { withObservability } from '@/lib/observability';
import { remindPreview, sendRemind, type RemindRefusal } from '@/lib/family-availability-remind';
import { FAMILY_REMIND_COACH_WORDS as RW } from '@/lib/family-availability-words';

/**
 * Remind the families who haven't answered (Signed-in family accounts Stage 4b, Part 7; ask 2; drawing tab 4).
 *   GET  → the confirm: which players, how many parents, how many get the app note only, who isn't reminded and why, when Remind
 *          was last used, and a sample of the email.
 *   POST → the send (once per event per 24 hours for the whole staff; the database holds the limit).
 * Coaches who can mark attendance only (ask 11). The live season only (no year parameter). 404 while the guardian tier is off.
 * Nothing the client sends decides who is reminded: the server re-derives it.
 */

const REFUSED: Record<RemindRefusal | 'send_failed', { status: number; error: string }> = {
  not_found: { status: 404, error: 'Event not found' },
  closed: { status: 409, error: RW.closed },
  nobody: { status: 409, error: RW.nobody },
  too_soon: { status: 409, error: 'This was reminded less than 24 hours ago.' },
  send_failed: { status: 502, error: RW.failed },
};

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const r = await resolveFamilyAttendanceContext(params);
  if ('error' in r) return r.error;
  const preview = await remindPreview({ teamId: r.teamId, programYearId: r.programYearId, eventId: r.eventId, team: r.team });
  if ('refused' in preview) return NextResponse.json({ error: REFUSED[preview.refused].error, code: preview.refused }, { status: REFUSED[preview.refused].status });
  return NextResponse.json({ preview });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/family-remind' });

export const POST = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const r = await resolveFamilyAttendanceContext(params);
  if ('error' in r) return r.error;
  const sent = await sendRemind({ teamId: r.teamId, programYearId: r.programYearId, eventId: r.eventId, actorUserId: r.ctx.user.id, team: r.team });
  if (!sent.ok) {
    return NextResponse.json(
      { error: REFUSED[sent.refused].error, code: sent.refused, remindedAt: sent.remindedAt ?? null },
      { status: REFUSED[sent.refused].status },
    );
  }
  return NextResponse.json({ report: sent.report });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/family-remind' });
