import { NextResponse } from 'next/server';
import { deleteRepTeamGameMoment, getRepTeamGameMomentById } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { canLogGameMoment, denyUnless } from '@/lib/coach-capabilities';

/**
 * Remove a moment (Game-Day Mode P2). The eraser exists because moments are APPEND-ONLY: a
 * mistyped one is deleted and retyped rather than edited, so what a moment says is always what
 * was written at the time it says it was.
 *
 * Curation follows the scouting book's rule, verbatim: the head coach may remove ANY moment;
 * everyone else only their own. Author identity comes from the row (`created_by`), never from a
 * display-name match.
 *
 * ⚠ Live-season only, like its POST sibling — a finished season shows moments and offers no
 * eraser. Deleting a season-old moment would rewrite what a night looked like.
 */
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string; momentId: string }> },) => {
  const { orgSlug, teamId, eventId, momentId } = await params;
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, assignment, programYear } = resolved;

  const denied = denyUnless(canLogGameMoment(assignment.capabilities), 'Your coach runs the bench.');
  if (denied) return denied;

  const moment = await getRepTeamGameMomentById(teamId, momentId, programYear.id);
  // The event in the URL must be the moment's own — otherwise a moment could be erased through
  // any game's path, and the audit trail in the URL would be a fiction. The season is now part of
  // the LOOKUP as well (2026-08-15); the comparison stays as the belt, costing nothing.
  if (!moment || moment.eventId !== eventId || moment.programYearId !== programYear.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isAuthor = moment.createdBy != null && moment.createdBy === ctx.user.id;
  if (!assignment.capabilities.isHeadCoach && !isAuthor) {
    return NextResponse.json({ error: 'Only the head coach can remove someone else’s moment.' }, { status: 403 });
  }

  await deleteRepTeamGameMoment(teamId, momentId, programYear.id);
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/game-moments/[momentId]' });
