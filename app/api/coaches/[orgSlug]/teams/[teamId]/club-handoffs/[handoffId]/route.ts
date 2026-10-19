import { NextResponse } from 'next/server';
import { resolveLiveCoachTeamContext } from '@/lib/coach-route-context';
import { canWriteMoney, denyUnless } from '@/lib/coach-capabilities';
import { coachHandoff, markHandoffNotReceived } from '@/lib/families-payment';
import { FAMILY_HANDOFF_COACH_WORDS as CW } from '@/lib/families-words';
import { withObservability } from '@/lib/observability';

/**
 * A payment the club received for one of this team's players and handed to its head coach (Club Tier Stage 5c, Ask 28 —
 * the rules live in lib/families-payment.ts). A money write's gate: a coach on this team's live season who can change
 * the team's finances.
 *   GET  — the hand-off, for the bell's Record it (it opens the coach's own Record money, filled in) and the email's
 *          Not received link.
 *   POST { answer: 'not_received' } — the money never reached the team: nothing is written in either book, the person
 *          who sent it is told, and the ask clears for every coach it reached.
 * Record it itself saves through the ordinary dues-payments POST, carrying the hand-off's id.
 */
async function resolve(orgSlug: string, teamId: string) {
  const resolved = await resolveLiveCoachTeamContext(orgSlug, teamId);
  if ('error' in resolved) return resolved;
  const denied = denyUnless(canWriteMoney(resolved.assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  return denied ? { error: denied } : resolved;
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; handoffId: string }> },) => {
  const { orgSlug, teamId, handoffId } = await params;
  const r = await resolve(orgSlug, teamId);
  if ('error' in r) return r.error!;
  const view = await coachHandoff(r.ctx.org.id, teamId, handoffId, r.programYear.id);
  if (!view) return NextResponse.json({ error: CW.gone }, { status: 404 });
  return NextResponse.json({ handoff: view });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/club-handoffs/[handoffId]' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; handoffId: string }> },) => {
  const { orgSlug, teamId, handoffId } = await params;
  const r = await resolve(orgSlug, teamId);
  if ('error' in r) return r.error!;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (body.answer !== 'not_received') return NextResponse.json({ error: 'answer must be not_received' }, { status: 400 });
  const out = await markHandoffNotReceived({ org: r.ctx.org, teamId, teamName: r.team.name, handoffId, userId: r.ctx.user.id });
  if (!out.ok) return NextResponse.json({ error: out.error, code: out.code }, { status: out.status });
  return NextResponse.json({ ok: true, said: CW.saidNotReceived });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/club-handoffs/[handoffId]' });
