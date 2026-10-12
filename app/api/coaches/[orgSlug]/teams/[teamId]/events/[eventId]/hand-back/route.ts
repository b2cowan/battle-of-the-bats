import { NextResponse } from 'next/server';
import { refuseWithoutLiveSeat } from '@/lib/coach-season-refusal';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getActiveRepProgramYear, getCoachingAssignmentsForUser, getRepTeam, getRepTeamEventById } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { canManageSchedule, denyUnless } from '@/lib/coach-capabilities';
import { isClubSlotEvent } from '@/lib/club-slot-event';
import { handBack, handBackChoices } from '@/lib/club-schedule-coach';
import { SCHEDULE_REFUSALS as R } from '@/lib/club-schedule-words';

// ---------------------------------------------------------------------------
// HAND BACK A CLUB PRACTICE (Club Tier Stage 11a, part A — Ask 17; hub specimen 11).
//
// GET  — the question's three rows: This practice only · This & future · All practices (the team's practices from the
//        same club schedule at the same weekday, start and facility that haven't started), each with its dates and count.
// POST { scope: 'one' | 'remaining' | 'all' } — the coach's own act, landing at once: the slot reads "Open · handed back
//        by {team}" on the club's schedule, the practice goes the mirror's way (cancelled when the coach worked on it,
//        deleted when not — families stop seeing it either way), and the people who built the schedule are told.
//        Reassigning the slot is the club's change to send; its money is settled then (build question B).
//
// ⚖ WHO: whoever may change the team's schedule (`canManageSchedule` — the same as any change to it), on its live season.
// ---------------------------------------------------------------------------

type Params = { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> };

async function resolve(orgSlug: string, teamId: string, eventId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { ok: false as const, error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { ok: false as const, error: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return { ok: false as const, error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const assignment = (await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id)).find(a => a.teamId === teamId);
  if (!assignment) return { ok: false as const, error: (await refuseWithoutLiveSeat(ctx.org, ctx.user.id, teamId)) ?? forbidden() };
  const denied = denyUnless(canManageSchedule(assignment.capabilities), 'You cannot change this schedule.');
  if (denied) return { ok: false as const, error: denied };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return { ok: false as const, error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  const event = await getRepTeamEventById(eventId);
  if (!event || event.teamId !== teamId || event.programYearId !== programYear.id) {
    return { ok: false as const, error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };
  }
  if (!isClubSlotEvent(event)) return { ok: false as const, error: NextResponse.json({ error: R.handBackNothing, code: 'not_the_clubs' }, { status: 409 }) };
  return { ok: true as const, ctx, team, event };
}

export const GET = withObservability(async (_req: Request, { params }: Params) => {
  const { orgSlug, teamId, eventId } = await params;
  const r = await resolve(orgSlug, teamId, eventId);
  if (!r.ok) return r.error;
  const choices = await handBackChoices(r.ctx.org.id, teamId, r.event);
  if (!choices) return NextResponse.json({ error: R.handBackNothing, code: 'not_the_clubs' }, { status: 409 });
  return NextResponse.json(choices);
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/hand-back' });

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const { orgSlug, teamId, eventId } = await params;
  const r = await resolve(orgSlug, teamId, eventId);
  if (!r.ok) return r.error;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const out = await handBack({
    orgId: r.ctx.org.id, orgSlug: r.ctx.org.slug, teamId, teamName: r.team.name, actorUserId: r.ctx.user.id, event: r.event, scope: body.scope,
  });
  if (!out.ok) return NextResponse.json({ error: out.error, code: out.code }, { status: out.status });
  return NextResponse.json(out);
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/hand-back' });
