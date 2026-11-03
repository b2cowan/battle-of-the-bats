import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { throttlePublicForm } from '@/lib/public-form-throttle';
import { invalidGamePatch } from '@/lib/league-game-patch';
import { isInstant } from '@/lib/league-coach-scores';
import { coachScore, refusalResponse, resolveCoachPress, type CoachPressParams } from '@/lib/league-coach-score-press';

/**
 * THE HOME COACH ENTERS THE SCORE (House League 9e-3, rulings 9e·7 to 9e·9): Enter, Change, or clear (both null) a
 * started game's score from the coach's own team page. Only a live seat on the game's HOME team (a coach of both teams
 * is the home coach), on a live season. The score rule is the club's (`invalidGamePatch`: both or neither, whole
 * numbers); the rest — started, on, not reported or touched by the club, the window not stale — is the database's, in
 * one locked function that writes the game and its record together (mig 428). Nobody is emailed.
 */

export const POST = withObservability(async (req: Request, { params }: { params: CoachPressParams }) => {
  // Every POST under the public league API is throttled first (public-form guard).
  const throttled = throttlePublicForm(req);
  if (throttled) return throttled;
  const press = await resolveCoachPress(params);
  if ('error' in press) return press.error;
  if (!press.homeSeat) return refusalResponse('notHome', press.names);

  const body = await req.json().catch(() => null) as { homeScore?: unknown; awayScore?: unknown; seen?: unknown } | null;
  if (!body || typeof body !== 'object' || !('homeScore' in body) || !('awayScore' in body) || !isInstant(body.seen)) {
    return NextResponse.json({ error: 'The request was not understood' }, { status: 400 });
  }
  const invalid = invalidGamePatch({ homeScore: body.homeScore, awayScore: body.awayScore });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const refused = await coachScore(press, (body.homeScore ?? null) as number | null, (body.awayScore ?? null) as number | null, body.seen);
  if (refused) return refusalResponse(refused, press.names);
  return NextResponse.json({ ok: true });
}, { route: '/api/league/[orgSlug]/[seasonSlug]/team/[teamId]/games/[gameId]/score' });
