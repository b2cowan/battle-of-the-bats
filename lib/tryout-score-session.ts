import {
  getRepTryoutRubric,
  getRepTryoutCheckinListReadOnly,
  getRepTryoutRegistration,
  getRepTryoutScoresForEvaluator,
  getRepTeam,
  upsertRepTryoutScore,
} from '@/lib/db';
import type { RepTryout, RepTryoutEvaluatorSession } from '@/lib/types';

/**
 * ONE scoring implementation behind two doors (Chunk E, WI-1).
 *
 * The public token route (/api/tryout-score/[token]) and the coach's authenticated
 * self-score route (…/tryout-self-score) resolve an evaluator session differently —
 * bearer token vs session auth — but from that point on they are the SAME feature:
 * same context shape, same validation, same write. Keeping the body here means the
 * two routes cannot drift into two scorers.
 */

export interface TryoutScoreContext {
  evaluatorName: string | null;
  teamName: string | null;
  blind: boolean;
  locked: boolean;
  scaleMax: number;
  categories: { key: string; label: string; weight: number; instructions?: string }[];
  candidates: { registrationId: string; bib: string | null; name: string | null; isCheckedIn: boolean }[];
  scores: Record<string, Record<string, { score: number; note: string | null }>>;
  /** When the credential itself dies (token links only) — null for the coach's own signed-in door. */
  expiresAt: string | null;
}

/**
 * Load the scoring context: rubric, candidate list, and this scorer's prior scores.
 *
 * ⚠⚠ `hideNames` IS THE CALLER'S ANSWER AND IS REQUIRED — no default, deliberately. Blind
 * evaluation is a property of WHO IS SCORING, not of the tryout (owner ruling 2026-08-26: "head
 * coaches know everyone that is trying out, plain and simple… the blind evaluation might be useful
 * for only the helpers who are scoring for them"). Two doors share this function and they want
 * opposite answers:
 *
 *   · the HELPER's token link — `tryout.isAnonymous`. Hiding names from a volunteer scorer is the
 *     entire point of the switch, and the only place it ever did real work.
 *   · the COACH's own scoring — `false`, always. They ran the sessions and know every kid; hiding
 *     names from them was theatre, and former teams and birth years are legitimate inputs to the
 *     decision they are being asked to make.
 *
 * A defaulted parameter here would be a trap for the next caller — the same reasoning the tryout
 * decision-email flag used. Make a new door state its own answer.
 */
export async function buildTryoutScoreContext(
  session: RepTryoutEvaluatorSession,
  tryout: RepTryout,
  opts: { expiresAt: string | null; hideNames: boolean },
): Promise<TryoutScoreContext> {
  const [rubric, candidates, priorScores, team] = await Promise.all([
    getRepTryoutRubric(tryout.id),
    // Read-only list: the scoring boundary must never write check-in state.
    getRepTryoutCheckinListReadOnly(session.programYearId),
    getRepTryoutScoresForEvaluator(session.id),
    getRepTeam(session.teamId),
  ]);

  const blind = opts.hideNames;
  const list = candidates.map(c => ({
    registrationId: c.id,
    bib: c.bibNumber ?? null,
    // Bib only when THIS scorer is meant to be blind — see the ruling on hideNames above.
    name: blind ? null : `${c.playerFirstName} ${c.playerLastName}`.trim(),
    isCheckedIn: c.isCheckedIn,
  }));

  // Rehydrate this evaluator's own scores: { [registrationId]: { [categoryKey]: {score, note} } }.
  const scores: Record<string, Record<string, { score: number; note: string | null }>> = {};
  for (const s of priorScores) {
    (scores[s.registrationId] ??= {})[s.categoryKey] = { score: s.score, note: s.note };
  }

  return {
    evaluatorName: session.evaluatorName,
    teamName: team?.name ?? null,
    blind,
    locked: !!tryout.scoresLockedAt,
    scaleMax: rubric?.scaleMax ?? 5,
    categories: rubric?.categories ?? [],
    candidates: list,
    scores,
    expiresAt: opts.expiresAt,
  };
}

export type TryoutScoreWriteResult =
  | { ok: true; score: { score: number; note: string | null } }
  | { ok: false; status: number; error: string; message?: string };

/** Validate + record one score for one candidate on one category. */
export async function writeTryoutScore(
  session: RepTryoutEvaluatorSession,
  tryout: RepTryout,
  body: unknown,
): Promise<TryoutScoreWriteResult> {
  if (tryout.scoresLockedAt) {
    return { ok: false, status: 403, error: 'locked', message: 'Scoring has been closed by the head coach.' };
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const registrationId = typeof b.registrationId === 'string' ? b.registrationId : '';
  const categoryKey = typeof b.categoryKey === 'string' ? b.categoryKey : '';
  const rawScore = Number(b.score);
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 500) || null : null;

  // Independent reads, one round trip — this runs once per score tap on a field phone.
  // Check ORDER is unchanged: category, then score, then candidate.
  const [rubric, registration] = await Promise.all([
    getRepTryoutRubric(tryout.id),
    getRepTryoutRegistration(registrationId),
  ]);

  // Category must exist on the rubric; score must be an integer within the scale.
  const category = rubric?.categories.find(c => c.key === categoryKey);
  if (!rubric || !category) {
    return { ok: false, status: 400, error: 'bad_category' };
  }
  if (!Number.isInteger(rawScore) || rawScore < 1 || rawScore > rubric.scaleMax) {
    return { ok: false, status: 400, error: 'bad_score' };
  }

  // IDOR guard: the candidate must belong to THIS tryout's program year AND still be active
  // (a declined/withdrawn candidate must not accrue scores that skew nothing but linger in the table).
  if (
    !registration ||
    registration.programYearId !== session.programYearId ||
    registration.status === 'declined' ||
    registration.status === 'withdrawn'
  ) {
    return { ok: false, status: 404, error: 'bad_candidate' };
  }

  const score = await upsertRepTryoutScore({
    evaluatorSessionId: session.id,
    registrationId,
    tryoutId: tryout.id,
    programYearId: session.programYearId,
    teamId: session.teamId,
    orgId: session.orgId,
    categoryKey,
    score: rawScore,
    note,
  });
  return { ok: true, score: { score: score.score, note: score.note } };
}
