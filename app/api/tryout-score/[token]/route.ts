import { NextResponse } from 'next/server';
import {
  getRepTryoutEvaluatorSessionByTokenHash,
  getRepTryout,
  getRepTryoutRubric,
  getRepTryoutCheckinListReadOnly,
  getRepTryoutRegistration,
  getRepTryoutScoresForEvaluator,
  getRepTeam,
  upsertRepTryoutScore,
} from '@/lib/db';
import { hashEvaluatorToken } from '@/lib/tryout-evaluator-token';
import { withObservability } from '@/lib/observability';
import type { RepTryout, RepTryoutEvaluatorSession } from '@/lib/types';

/**
 * No-account evaluator scoring endpoint. The URL token is the ONLY credential — there is no
 * session/org auth here. Every request re-derives the evaluator session from the token hash and
 * re-checks that it is live (not revoked, not expired) before touching any data.
 */

type Resolved =
  | { ok: false; res: Response }
  | { ok: true; session: RepTryoutEvaluatorSession; tryout: RepTryout };

async function resolveEvaluator(token: string): Promise<Resolved> {
  // Tokens are base64url(32 bytes) = exactly 43 chars; reject anything else before hitting the DB.
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

  const [rubric, candidates, priorScores, team] = await Promise.all([
    getRepTryoutRubric(r.tryout.id),
    // Read-only: the token boundary must never write. Bibs are assigned by the coach check-in flow.
    getRepTryoutCheckinListReadOnly(r.session.programYearId),
    getRepTryoutScoresForEvaluator(r.session.id),
    getRepTeam(r.session.teamId),
  ]);

  const blind = r.tryout.isAnonymous;
  const list = candidates.map(c => ({
    registrationId: c.id,
    bib: c.bibNumber ?? null,
    // Blind mode hides identity from the co-coach — bib only until the head coach reveals.
    name: blind ? null : `${c.playerFirstName} ${c.playerLastName}`.trim(),
    isCheckedIn: c.isCheckedIn,
  }));

  // Rehydrate this evaluator's own scores: { [registrationId]: { [categoryKey]: {score, note} } }.
  const scores: Record<string, Record<string, { score: number; note: string | null }>> = {};
  for (const s of priorScores) {
    (scores[s.registrationId] ??= {})[s.categoryKey] = { score: s.score, note: s.note };
  }

  return NextResponse.json({
    evaluatorName: r.session.evaluatorName,
    teamName: team?.name ?? null,
    blind,
    locked: !!r.tryout.scoresLockedAt,
    scaleMax: rubric?.scaleMax ?? 5,
    categories: rubric?.categories ?? [],
    candidates: list,
    scores,
  });
}, { route: '/api/tryout-score/[token]' });

/** Record one score for one candidate on one category. */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ token: string }> },) => {
  const { token } = await params;
  const r = await resolveEvaluator(token);
  if (!r.ok) return r.res;

  if (r.tryout.scoresLockedAt) {
    return NextResponse.json({ error: 'locked', message: 'Scoring has been closed by the head coach.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const registrationId = typeof body.registrationId === 'string' ? body.registrationId : '';
  const categoryKey = typeof body.categoryKey === 'string' ? body.categoryKey : '';
  const rawScore = Number(body.score);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) || null : null;

  // Category must exist on the rubric; score must be an integer within the scale.
  const rubric = await getRepTryoutRubric(r.tryout.id);
  const category = rubric?.categories.find(c => c.key === categoryKey);
  if (!rubric || !category) {
    return NextResponse.json({ error: 'bad_category' }, { status: 400 });
  }
  if (!Number.isInteger(rawScore) || rawScore < 1 || rawScore > rubric.scaleMax) {
    return NextResponse.json({ error: 'bad_score' }, { status: 400 });
  }

  // IDOR guard: the candidate must belong to THIS tryout's program year AND still be active
  // (a declined/withdrawn candidate must not accrue scores that skew nothing but linger in the table).
  const registration = await getRepTryoutRegistration(registrationId);
  if (
    !registration ||
    registration.programYearId !== r.session.programYearId ||
    registration.status === 'declined' ||
    registration.status === 'withdrawn'
  ) {
    return NextResponse.json({ error: 'bad_candidate' }, { status: 404 });
  }

  const score = await upsertRepTryoutScore({
    evaluatorSessionId: r.session.id,
    registrationId,
    tryoutId: r.tryout.id,
    programYearId: r.session.programYearId,
    teamId: r.session.teamId,
    orgId: r.session.orgId,
    categoryKey,
    score: rawScore,
    note,
  });
  return NextResponse.json({ score: { score: score.score, note: score.note } });
}, { route: '/api/tryout-score/[token]' });
