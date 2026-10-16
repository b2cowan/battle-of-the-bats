import 'server-only';
import { NextResponse } from 'next/server';
import { refuseWithoutLiveSeat } from './coach-season-refusal';
import { getAuthContext, unauthorized, forbidden, type AuthContext } from './api-auth';
import { getActiveRepProgramYear, getCoachingAssignmentsForUser, getRepTeam, getRepTeamEventById } from './db';
import { isClubSlotEvent } from './club-slot-event';
import { SCHEDULE_REFUSALS as R } from './club-schedule-words';
import type { CoachCapabilities } from './coach-capabilities';
import type { RepTeam, RepTeamEvent } from './types';

/**
 * ONE CLUB PRACTICE OF A TEAM'S LIVE SEASON, FOR THE COACH (Club Tier Stage 11d part C — the take-back and late-ask
 * routes). The hand-back route's own reading, without its capability gate: each route gates on its own (Take it back:
 * the schedule's write capability; the late ask: the team's money WRITE access). A member without a live seat gets the
 * team's one door (`refuseWithoutLiveSeat`); an event outside the live season is not found — a write addresses the
 * working season only (CLAUDE.md, the coaches portal's season rule).
 */
export async function resolveClubPractice(orgSlug: string, teamId: string, eventId: string): Promise<
  | { ok: true; ctx: AuthContext; team: RepTeam; event: RepTeamEvent; capabilities: CoachCapabilities }
  | { ok: false; error: Response }
> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { ok: false, error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { ok: false, error: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return { ok: false, error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const assignment = (await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id)).find(a => a.teamId === teamId);
  if (!assignment) return { ok: false, error: (await refuseWithoutLiveSeat(ctx.org, ctx.user.id, teamId)) ?? forbidden() };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return { ok: false, error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  const event = await getRepTeamEventById(eventId);
  if (!event || event.teamId !== teamId || event.programYearId !== programYear.id) {
    return { ok: false, error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };
  }
  if (!isClubSlotEvent(event)) return { ok: false, error: NextResponse.json({ error: R.handBackNothing, code: 'not_the_clubs' }, { status: 409 }) };
  return { ok: true, ctx, team, event, capabilities: assignment.capabilities };
}
