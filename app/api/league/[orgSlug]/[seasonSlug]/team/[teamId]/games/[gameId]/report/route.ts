import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm } from '@/lib/public-form-throttle';
import { REPORT_NOTE_MAX, isInstant } from '@/lib/league-coach-scores';
import { coachReport, NOT_FOUND, refusalResponse, resolveCoachPress, type CoachPressParams } from '@/lib/league-coach-score-press';

/**
 * THE AWAY COACH REPORTS A SCORE (House League 9e-3, ruling 9e·9): "Report this score", with an optional note. The score
 * stands; the report lands at the top of the league admin's "Scores to check". Only a live seat on the game's AWAY team
 * that is not also on the home team (a coach of both is the home coach: no report of their own score), on a live season,
 * on a coach's score the club hasn't looked at. No email and no notification (owner, 2026-11-03).
 */

export const POST = withObservability(async (req: Request, { params }: { params: CoachPressParams }) => {
  // Every POST under the public league API is throttled first (public-form guard).
  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;
  const press = await resolveCoachPress(params);
  if ('error' in press) return press.error;
  // The URL's team must be the away team; a coach of the home team has no Report door.
  if (press.teamId !== press.game.awayTeamId) return NOT_FOUND();
  if (press.homeSeat) return refusalResponse('own', press.names);

  const body = await req.json().catch(() => null) as { note?: unknown; seen?: unknown } | null;
  if (!body || typeof body !== 'object' || !isInstant(body.seen) || (body.note != null && typeof body.note !== 'string')) {
    return NextResponse.json({ error: 'The request was not understood' }, { status: 400 });
  }
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
  if (note && note.length > REPORT_NOTE_MAX) {
    return NextResponse.json({ error: `A note is ${REPORT_NOTE_MAX} characters at most.` }, { status: 400 });
  }

  const refused = await coachReport(press, note, body.seen);
  if (refused) return refusalResponse(refused, press.names);
  return NextResponse.json({ ok: true });
}, { route: '/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/games/[gameId]/report' });
