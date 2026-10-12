import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { hasPlanFeature } from '@/lib/plan-features';
import { replyToReview, teamReviews } from '@/lib/club-schedule-coach';

// ---------------------------------------------------------------------------
// THE CLUB'S PROPOSAL, ON A TEAM (Club Tier Stage 11a, part A — Ask 24; hub specimen 14 step 5, "The coach reviews").
//
// GET  — the schedules the club has sent for review that give this team time: its slots as a pattern, its bill (worked
//        out now — nothing is billed until the club finalizes), the reply-by date, and the team's latest answer.
// POST { scheduleId, answer: 'looks_good' | 'ask_for_change', words? } — the team's answer. The latest one stands; the
//        club finalizes whenever it is ready, whether or not every team has answered.
//
// ⚖ WHO: a HEAD COACH of the team (the review carries the team's bill; Ask 24 — "any head coach of the team"). A club
// whose plan no longer carries the scheduler has nothing in review here.
// ---------------------------------------------------------------------------

type Params = { params: Promise<{ orgSlug: string; teamId: string }> };

export const GET = withObservability(async (_req: Request, { params }: Params) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, capabilities, isReadOnly } = resolved;
  if (!capabilities.isHeadCoach || isReadOnly || !hasPlanFeature(ctx.org.planId, 'club_scheduler')) return NextResponse.json({ reviews: [] });
  return NextResponse.json({ reviews: await teamReviews(ctx.org.id, teamId) });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/club-schedules' });

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const { orgSlug, teamId } = await params;
  // A write: the team's LIVE season only (a finished season is a record — the coach-history guard's rule).
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { ctx, team, assignment } = resolved;
  if (!assignment.capabilities.isHeadCoach) {
    return NextResponse.json({ error: 'Only the team’s head coach answers the club’s proposal.', code: 'not_head_coach' }, { status: 403 });
  }
  if (!hasPlanFeature(ctx.org.planId, 'club_scheduler')) return NextResponse.json({ error: 'There is nothing waiting for a reply.', code: 'not_in_review' }, { status: 409 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const out = await replyToReview({
    orgId: ctx.org.id, orgSlug: ctx.org.slug, teamId, teamName: team.name, scheduleId: String(body.scheduleId ?? ''),
    actorUserId: ctx.user.id, answer: body.answer, words: body.words,
  });
  if (!out.ok) return NextResponse.json({ error: out.error, code: out.code }, { status: out.status });
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/club-schedules' });
