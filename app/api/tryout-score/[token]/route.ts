import { NextResponse } from 'next/server';
import {
  getRepTryoutEvaluatorSessionByTokenHash,
  getRepTryout,
} from '@/lib/db';
import { hashEvaluatorToken } from '@/lib/tryout-evaluator-token';
import { buildTryoutScoreContext, writeTryoutScore } from '@/lib/tryout-score-session';
import { withObservability } from '@/lib/observability';
import { demoOrgSlugForId } from '@/lib/demo-org-server';
import { sandboxRejectionResponse } from '@/lib/demo-guard';
import type { RepTryout, RepTryoutEvaluatorSession } from '@/lib/types';

/**
 * No-account evaluator scoring endpoint. The URL token is the ONLY credential — there is no
 * session/org auth here. Every request re-derives the evaluator session from the token hash and
 * re-checks that it is live (not revoked, not expired) before touching any data.
 * The scoring body itself is shared with the coach's authenticated self-score route
 * (lib/tryout-score-session.ts) — one scorer, two doors.
 */

type Resolved =
  | { ok: false; res: Response }
  | { ok: true; session: RepTryoutEvaluatorSession; tryout: RepTryout };

async function resolveEvaluator(token: string): Promise<Resolved> {
  // Tokens are base64url(32 bytes) = exactly 43 chars; reject anything else before hitting the DB.
  // (This gate is also what keeps `self:`-keyed sessions unreachable from this route.)
  if (!token || token.length !== 43) return { ok: false, res: NextResponse.json({ error: 'invalid' }, { status: 404 }) };
  const session = await getRepTryoutEvaluatorSessionByTokenHash(hashEvaluatorToken(token));
  if (!session) return { ok: false, res: NextResponse.json({ error: 'invalid' }, { status: 404 }) };
  if (session.revokedAt) return { ok: false, res: NextResponse.json({ error: 'revoked' }, { status: 403 }) };
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    return { ok: false, res: NextResponse.json({ error: 'expired' }, { status: 403 }) };
  }
  const tryout = await getRepTryout(session.programYearId);
  if (!tryout || tryout.id !== session.tryoutId) {
    return { ok: false, res: NextResponse.json({ error: 'invalid' }, { status: 404 }) };
  }
  return { ok: true, session, tryout };
}

/** Load the scoring context: rubric, candidate list (bib-only when blind), and prior scores. */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;
  const r = await resolveEvaluator(token);
  if (!r.ok) return r.res;

  // The link's own lifetime is part of being honest with a volunteer (WI-8).
  const ctx = await buildTryoutScoreContext(r.session, r.tryout, { expiresAt: r.session.expiresAt });
  return NextResponse.json(ctx);
}, { route: '/api/tryout-score/[token]' });

/** Record one score for one candidate on one category. */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;
  const r = await resolveEvaluator(token);
  if (!r.ok) return r.res;

  // TOKEN-identified write: the URL names no org, so the proxy chokepoint cannot see this one —
  // the token itself resolves to the org, and the demo org's evaluations must stay read-only like
  // everything else in the sandbox (the seed's evaluator links have discarded raw tokens, so this
  // is defense in depth, not the only wall). Fail CLOSED: if the allow-list cannot be resolved,
  // refuse the write rather than let "unknown" mean "allowed" — a real evaluator retries.
  // The resolved SLUG rides into the rejection so the copy is the right sandbox's ask.
  try {
    const demoSlug = await demoOrgSlugForId(r.session.orgId);
    if (demoSlug) return sandboxRejectionResponse(demoSlug);
  } catch {
    return sandboxRejectionResponse();
  }

  const body = await req.json().catch(() => ({}));
  const result = await writeTryoutScore(r.session, r.tryout, body);
  if (!result.ok) {
    return NextResponse.json(
      result.message ? { error: result.error, message: result.message } : { error: result.error },
      { status: result.status },
    );
  }
  return NextResponse.json({ score: result.score });
}, { route: '/api/tryout-score/[token]' });
