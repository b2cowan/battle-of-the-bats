import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getOrCreateRepTryout,
  getRepTryoutEvaluatorSessions,
  createRepTryoutEvaluatorSession,
  getRepTryoutScores,
} from '@/lib/db';
import { generateEvaluatorToken, hashEvaluatorToken } from '@/lib/tryout-evaluator-token';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear } from '@/lib/types';

/** Evaluator links live for 48 hours — long enough for a multi-session tryout weekend. */
const LINK_TTL_MS = 48 * 60 * 60 * 1000;

type Resolved =
  | { ok: false; res: Response }
  | { ok: true; orgId: string; teamId: string; programYear: RepProgramYear };

async function resolveCoach(orgSlug: string, teamId: string): Promise<Resolved> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { ok: false, res: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { ok: false, res: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.some(a => a.teamId === teamId)) return { ok: false, res: forbidden() };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) return { ok: false, res: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  return { ok: true, orgId: ctx.org.id, teamId, programYear };
}

/** List the tryout's evaluator links + how many candidates each has scored. */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;

  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });
  const [sessions, scores] = await Promise.all([
    getRepTryoutEvaluatorSessions(tryout.id),
    getRepTryoutScores(tryout.id),
  ]);

  // Distinct candidates scored, per evaluator session.
  const scoredByEvaluator = new Map<string, Set<string>>();
  for (const s of scores) {
    if (!scoredByEvaluator.has(s.evaluatorSessionId)) scoredByEvaluator.set(s.evaluatorSessionId, new Set());
    scoredByEvaluator.get(s.evaluatorSessionId)!.add(s.registrationId);
  }

  const evaluators = sessions.map(s => ({
    ...s,
    candidatesScored: scoredByEvaluator.get(s.id)?.size ?? 0,
  }));
  return NextResponse.json({ evaluators });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-evaluators' });

/** Mint a new evaluator link. Returns the raw token ONCE — it is never stored or retrievable again. */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;

  const body = await req.json().catch(() => ({}));
  const evaluatorName = typeof body.evaluatorName === 'string' ? body.evaluatorName.trim().slice(0, 80) : '';
  if (!evaluatorName) {
    return NextResponse.json({ errors: { evaluatorName: 'Add the evaluator’s name' } }, { status: 400 });
  }

  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });
  const token = generateEvaluatorToken();
  const session = await createRepTryoutEvaluatorSession({
    tryoutId: tryout.id,
    programYearId: r.programYear.id,
    teamId: r.teamId,
    orgId: r.orgId,
    evaluatorName,
    tokenHash: hashEvaluatorToken(token),
    expiresAt: new Date(Date.now() + LINK_TTL_MS).toISOString(),
  });

  // `token` is surfaced only here; the client builds the shareable /tryout-score/<token> URL.
  return NextResponse.json({ session: { ...session, candidatesScored: 0 }, token }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-evaluators' });
