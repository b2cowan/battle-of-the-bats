import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getOrCreateRepTryout,
  getRepTryoutEvaluatorLinkSessions,
  revokeRepTryoutEvaluatorSession,
  reissueRepTryoutEvaluatorSession,
} from '@/lib/db';
import { generateEvaluatorToken, hashEvaluatorToken, EVALUATOR_LINK_TTL_MS } from '@/lib/tryout-evaluator-token';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear } from '@/lib/types';

type Resolved =
  | { ok: false; res: Response }
  | { ok: true; orgId: string; teamId: string; programYear: RepProgramYear; assignment: Awaited<ReturnType<typeof getCoachingAssignmentsForUser>>[number] };

async function resolveCoach(orgSlug: string, teamId: string): Promise<Resolved> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { ok: false, res: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { ok: false, res: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { ok: false, res: forbidden() };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return { ok: false, res: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  return { ok: true, orgId: ctx.org.id, teamId, programYear, assignment };
}

/** Revoke an evaluator link. The id must belong to THIS team's tryout AND be a shareable link —
 *  a coach's own `self:` scoring session is not a link and is never managed here (IDOR guard). */
export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; evaluatorId: string }> },) => {
  const { orgSlug, teamId, evaluatorId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });
  const sessions = await getRepTryoutEvaluatorLinkSessions(tryout.id);
  const target = sessions.find(s => s.id === evaluatorId);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await revokeRepTryoutEvaluatorSession(target.id);
  return NextResponse.json({ ok: true });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-evaluators/[evaluatorId]' });

/** Re-key a link for the SAME evaluator (WI-8): new token + fresh 48 h expiry on the same session
 *  row, revocation cleared. Their scores stay attached to one identity — minting a second
 *  "evaluator" for the same person double-counts their opinion in the per-category means.
 *  Returns the raw token ONCE, exactly like the mint route. */
export const POST = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; evaluatorId: string }> },) => {
  const { orgSlug, teamId, evaluatorId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });
  const sessions = await getRepTryoutEvaluatorLinkSessions(tryout.id);
  const target = sessions.find(s => s.id === evaluatorId);
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const token = generateEvaluatorToken();
  const session = await reissueRepTryoutEvaluatorSession(target.id, {
    tokenHash: hashEvaluatorToken(token),
    expiresAt: new Date(Date.now() + EVALUATOR_LINK_TTL_MS).toISOString(),
  });
  return NextResponse.json({ session, token });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-evaluators/[evaluatorId]' });
