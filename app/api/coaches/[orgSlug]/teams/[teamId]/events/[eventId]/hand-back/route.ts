import { NextResponse } from 'next/server';
import { refuseWithoutLiveSeat } from '@/lib/coach-season-refusal';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getActiveRepProgramYear, getCoachingAssignmentsForUser, getRepTeam, getRepTeamEventById } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { canManageSchedule, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { isClubSlotEvent } from '@/lib/club-slot-event';
import { clubSourcesFor, handBack, handBackChoices, practiceSeries } from '@/lib/club-schedule-coach';
import { askHandBack, askOffer, withdrawAsk } from '@/lib/club-hand-back';
import { HAND_BACK_WORDS } from '@/lib/club-hand-back-words';
import { SCHEDULE_REFUSALS as R } from '@/lib/club-schedule-words';

// ---------------------------------------------------------------------------
// HAND BACK A CLUB PRACTICE (Club Tier Stage 11a, part A — Ask 17; hub specimen 11) — AND ASK FOR MONEY BACK (Stage 11d,
// part A — Asks 1–3; hub Stage 11d specimens 1 and 2).
//
// GET  — the question's three rows: This practice only · This & future · All practices (the team's practices from the
//        same club schedule at the same weekday, start and facility that haven't started, none already in a waiting ask),
//        each with its dates and count. Stage 11d: `money` — each scope's figure for the tick, only when the club billed
//        the team for this schedule's time and the coach can use the team's money (Ask 1); `asked` — this practice is
//        already in a waiting ask (the practice offers Withdraw the ask instead).
// POST { scope, askMoney? } — without money: the coach's own act, landing at once (the slot reads "Open · handed back by
//        {team}", the practice goes the mirror's way, the builders are told; ⚖ never Changed since sent — Ask 9). With
//        `askMoney: true`: nothing lands yet — the ask and its request, waiting for the club (Ask 2).
// DELETE — withdraw this practice's waiting ask (Ask 3): the ask and its request go together; the practices stay.
//
// ⚖ WHO: whoever may change the team's schedule (`canManageSchedule`), on its live season; asking for money (and
// withdrawing an ask) also takes the team's money WRITE access (`canWriteMoney` — Make a request's own permission).
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
  return { ok: true as const, ctx, team, event, canMoney: canWriteMoney(assignment.capabilities) };
}

export const GET = withObservability(async (_req: Request, { params }: Params) => {
  const { orgSlug, teamId, eventId } = await params;
  const r = await resolve(orgSlug, teamId, eventId);
  if (!r.ok) return r.error;
  const found = await practiceSeries(r.ctx.org.id, teamId, r.event);
  if (!found) return NextResponse.json({ error: R.handBackNothing, code: 'not_the_clubs' }, { status: 409 });
  const choices = handBackChoices(found, r.event);
  // The tick only where it can be true (Ask 1): the club billed this team for the schedule's time, and this coach can use
  // the team's money. Otherwise the window is as built.
  const money = r.canMoney && !choices.asked ? await askOffer({ orgId: r.ctx.org.id, teamId, teamName: r.team.name, event: r.event, found }) : null;
  return NextResponse.json({ ...choices, money });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/hand-back' });

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const { orgSlug, teamId, eventId } = await params;
  const r = await resolve(orgSlug, teamId, eventId);
  if (!r.ok) return r.error;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (body.askMoney === true) {
    if (!r.canMoney) return NextResponse.json({ error: HAND_BACK_WORDS.refuse.noMoney, code: 'no_money' }, { status: 403 });
    const asked = await askHandBack({
      org: r.ctx.org, teamId, teamName: r.team.name, teamGroupId: r.team.groupId ?? null, actorUserId: r.ctx.user.id, event: r.event, scope: body.scope,
    });
    if (!asked.ok) return NextResponse.json({ error: asked.error, code: asked.code }, { status: asked.status });
    return NextResponse.json(asked);
  }
  const out = await handBack({
    orgId: r.ctx.org.id, orgSlug: r.ctx.org.slug, teamId, teamName: r.team.name, actorUserId: r.ctx.user.id, event: r.event, scope: body.scope,
  });
  if (!out.ok) return NextResponse.json({ error: out.error, code: out.code }, { status: out.status });
  return NextResponse.json(out);
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/hand-back' });

export const DELETE = withObservability(async (_req: Request, { params }: Params) => {
  const { orgSlug, teamId, eventId } = await params;
  const r = await resolve(orgSlug, teamId, eventId);
  if (!r.ok) return r.error;
  if (!r.canMoney) return NextResponse.json({ error: HAND_BACK_WORDS.refuse.noMoney, code: 'no_money' }, { status: 403 });
  const source = (await clubSourcesFor(r.ctx.org.id, [r.event], teamId))[r.event.clubScheduleSlotId ?? ''];
  if (!source?.ask) return NextResponse.json({ error: HAND_BACK_WORDS.refuse.answered, code: 'answered' }, { status: 409 });
  const out = await withdrawAsk({
    org: r.ctx.org, teamId, teamName: r.team.name, teamGroupId: r.team.groupId ?? null, actorUserId: r.ctx.user.id, handBackId: source.ask.id,
  });
  if (!out.ok) return NextResponse.json({ error: out.error, code: out.code }, { status: out.status });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/hand-back' });
