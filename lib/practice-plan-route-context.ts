import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from './api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamEventById,
} from './db';

/**
 * The practice plan's route context — ONE auth chain for the plan's GET/PUT/PATCH and for
 * "Send to staff" (`…/practice-plan/send`). Extracted from the plan route on 2026-09-17 so the send
 * route could not re-type the chain and quietly stop checking something (the tag routes' own
 * reason for collapsing five copies into one).
 *
 * ⚠ A practice plan is a PRACTICE concept, and that is enforced here rather than left to the fact
 * that only a practice renders a link to these screens. Without it a typed URL (or any later
 * caller) could hang the whole stations/rotation/groups model off a game or a tournament. "A plan
 * on a team event or a pre-game warm-up" is an explicit fast-follow in the plan doc, not something
 * that should arrive by accident — widening this is a deliberate decision, one line here.
 */
export async function resolvePracticePlanRouteContext(orgSlug: string, teamId: string, eventId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const [assignments, programYear] = await Promise.all([
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    getActiveRepProgramYear(teamId),
  ]);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  const event = await getRepTeamEventById(eventId);
  if (!event || event.programYearId !== programYear.id) {
    return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };
  }

  // ⚠ A practice plan is a PRACTICE concept, and that has to be enforced here rather than left to
  // the fact that only a practice renders a link to this screen. Without it a typed URL (or any
  // later caller) could hang the whole stations/rotation/groups model off a game or a tournament.
  // "A plan on a team event or a pre-game warm-up" is an explicit fast-follow in the plan doc, not
  // something that should arrive by accident — widening this is a deliberate decision, one line here.
  if (event.eventType !== 'practice') {
    return {
      error: NextResponse.json(
        { error: 'Practice plans belong to practices. This event isn’t one.' },
        { status: 400 },
      ),
    };
  }

  return { ctx, team, assignment, programYear, event };
}
