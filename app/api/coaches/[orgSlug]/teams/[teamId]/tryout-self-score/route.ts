import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getOrCreateRepTryout,
  getRepTryoutEvaluatorSessionByTokenHash,
  createRepTryoutEvaluatorSession,
  getOrgMemberDisplayName,
} from '@/lib/db';
import { selfEvaluatorTokenHash } from '@/lib/tryout-evaluator-token';
import { buildTryoutScoreContext, writeTryoutScore } from '@/lib/tryout-score-session';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear, RepTryout, RepTryoutEvaluatorSession } from '@/lib/types';

/**
 * "Score as yourself" (Chunk E, WI-1 / D-E1): the coach's own door into the SAME scorer the
 * volunteer token links open — behind their login instead of a bearer URL. No shareable link
 * for the coach's scoring ever exists, nothing expires mid-tryout, and every write-capable
 * coach gets exactly ONE stable scoring identity per tryout (a deterministic `self:`-keyed
 * session row — see lib/tryout-evaluator-token.ts for why that's safe without a secret).
 */

/** Effectively "never" — no token can reach a self session, so its expiry is not a credential
 *  lifetime; the short-TTL rule exists for shareable links only. */
const SELF_SESSION_TTL_MS = 50 * 365 * 24 * 60 * 60 * 1000;

type Resolved =
  | { ok: false; res: Response }
  | {
      ok: true; orgId: string; userId: string; teamId: string; programYear: RepProgramYear;
      assignment: Awaited<ReturnType<typeof getCoachingAssignmentsForUser>>[number];
    };

async function resolveCoach(orgSlug: string, teamId: string): Promise<Resolved> {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { ok: false, res: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { ok: false, res: forbidden() };
  // This route runs once per score TAP on a field phone — the three reads are independent
  // (all keyed off ctx/teamId alone), so they go out together, not as three round trips.
  const [team, assignments, programYear] = await Promise.all([
    getRepTeam(teamId),
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    getActiveRepProgramYear(teamId),
  ]);
  if (!team || team.orgId !== ctx.org.id) return { ok: false, res: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { ok: false, res: forbidden() };
  if (!programYear) return { ok: false, res: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  return { ok: true, orgId: ctx.org.id, userId: ctx.user.id, teamId, programYear, assignment };
}

/** Find-or-create this coach's one self session for the tryout. Deterministic key = idempotent;
 *  a concurrent create loses the unique-index race and re-reads the winner. */
async function resolveSelfSession(r: Extract<Resolved, { ok: true }>): Promise<{ session: RepTryoutEvaluatorSession; tryout: RepTryout }> {
  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });
  const tokenHash = selfEvaluatorTokenHash(tryout.id, r.userId);
  const existing = await getRepTryoutEvaluatorSessionByTokenHash(tokenHash);
  if (existing) return { session: existing, tryout };
  const displayName = (await getOrgMemberDisplayName(r.orgId, r.userId)) ?? 'Head coach';
  try {
    const session = await createRepTryoutEvaluatorSession({
      tryoutId: tryout.id,
      programYearId: r.programYear.id,
      teamId: r.teamId,
      orgId: r.orgId,
      evaluatorName: displayName,
      tokenHash,
      expiresAt: new Date(Date.now() + SELF_SESSION_TTL_MS).toISOString(),
    });
    return { session, tryout };
  } catch (createErr) {
    // The EXPECTED failure here is the token_hash unique-violation race (two devices' first
    // taps) — the re-read resolves it. Anything else re-throws with the original cause attached
    // so observability sees what actually failed, not the fallback's shrug.
    const raced = await getRepTryoutEvaluatorSessionByTokenHash(tokenHash);
    if (raced) return { session: raced, tryout };
    console.error('[tryout-self-score] self-session create failed (not the unique race):', createErr);
    throw new Error('Could not open your scoring session', { cause: createErr });
  }
}

/** The coach's own scoring context — same shape the token page consumes. */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const { session, tryout } = await resolveSelfSession(r);
  // expiresAt: null — the coach's door is their login, not a dying link (WI-8 shows lifetimes
  // for shareable links only).
  const ctx = await buildTryoutScoreContext(session, tryout, { expiresAt: null, hideNames: false });
  return NextResponse.json(ctx);
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-self-score' });

/** Record one of the coach's own scores. */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;
  const denied = denyUnless(r.assignment.capabilities.tryouts, 'Only the head coach manages tryouts.');
  if (denied) return denied;

  const { session, tryout } = await resolveSelfSession(r);
  const body = await req.json().catch(() => ({}));
  const result = await writeTryoutScore(session, tryout, body);
  if (!result.ok) {
    return NextResponse.json(
      result.message ? { error: result.error, message: result.message } : { error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ score: result.score });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-self-score' });
