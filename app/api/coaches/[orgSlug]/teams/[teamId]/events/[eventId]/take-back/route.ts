import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { canManageSchedule, denyUnless } from '@/lib/coach-capabilities';
import { resolveClubPractice } from '@/lib/club-practice-route';
import { takeBack, takeBackPlan } from '@/lib/club-hand-back';
import { HAND_BACK_WORDS } from '@/lib/club-hand-back-words';

// ---------------------------------------------------------------------------
// TAKE IT BACK (Club Tier Stage 11d, part C — Ask 11; hub Stage 11d, C2 and C3's first frame).
//
// GET  — Take back which practices?: Hand back's three rows (This practice only · This & future · All practices),
//        limited to this practice's own hand-back and to what can come back now (not started, its Sunday still open,
//        no ask waiting, no money settled, its practice still there), each with its dates and count; `left` says what of
//        it can't ("Feb 21 went to another team, so 2 can come back").
// POST { scope } — lands at once in one step (the schedule locked first): the practices are back as they were, the
//        builders are told, families see them again without a message. ⚖ Never Changed since sent (Ask 9, both ways).
//
// ⚖ WHO: whoever may change the team's schedule (`canManageSchedule` — Hand back's own permission), on its live season.
// ---------------------------------------------------------------------------

type Params = { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> };

export const GET = withObservability(async (_req: Request, { params }: Params) => {
  const { orgSlug, teamId, eventId } = await params;
  const r = await resolveClubPractice(orgSlug, teamId, eventId);
  if (!r.ok) return r.error;
  const denied = denyUnless(canManageSchedule(r.capabilities), HAND_BACK_WORDS.refuse.noSchedule);
  if (denied) return denied;
  const plan = await takeBackPlan(r.ctx.org.id, teamId, r.event);
  if (!plan.ok) return NextResponse.json({ error: plan.error, code: plan.code }, { status: plan.status });
  return NextResponse.json(plan.choices);
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/take-back' });

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const { orgSlug, teamId, eventId } = await params;
  const r = await resolveClubPractice(orgSlug, teamId, eventId);
  if (!r.ok) return r.error;
  const denied = denyUnless(canManageSchedule(r.capabilities), HAND_BACK_WORDS.refuse.noSchedule);
  if (denied) return denied;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const out = await takeBack({
    orgId: r.ctx.org.id, orgSlug: r.ctx.org.slug, teamId, teamName: r.team.name, actorUserId: r.ctx.user.id, event: r.event, scope: body.scope,
  });
  if (!out.ok) return NextResponse.json({ error: out.error, code: out.code }, { status: out.status });
  return NextResponse.json(out);
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/take-back' });
