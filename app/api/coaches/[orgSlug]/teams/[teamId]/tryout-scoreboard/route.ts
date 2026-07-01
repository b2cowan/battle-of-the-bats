import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getRepTeam,
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getOrCreateRepTryout,
  getRepTryoutRubric,
  getRepTryoutCheckinList,
  getRepTryoutEvaluatorSessions,
  getRepTryoutScores,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear } from '@/lib/types';

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

/** Aggregated tryout scoreboard: weighted composite per candidate + a runs-hot/cold bias flag. */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const r = await resolveCoach(orgSlug, teamId);
  if (!r.ok) return r.res;

  const tryout = await getOrCreateRepTryout({ programYearId: r.programYear.id, teamId: r.teamId, orgId: r.orgId });
  const [rubric, candidates, sessions, scores] = await Promise.all([
    getRepTryoutRubric(tryout.id),
    getRepTryoutCheckinList(r.programYear.id),
    getRepTryoutEvaluatorSessions(tryout.id),
    getRepTryoutScores(tryout.id),
  ]);

  const blind = tryout.isAnonymous;
  const scaleMax = rubric?.scaleMax ?? 5;
  const categories = (rubric?.categories ?? []).map(c => ({ key: c.key, label: c.label, weight: c.weight }));
  const weightTotal = categories.reduce((s, c) => s + (c.weight > 0 ? c.weight : 0), 0);

  const evalName = new Map(sessions.map(s => [s.id, s.evaluatorName]));

  // Index scores by candidate → category → list of raw values, plus per-evaluator running totals.
  const byCandidate = new Map<string, Map<string, number[]>>();
  const evalSum = new Map<string, { sum: number; n: number }>();
  const evalCandidates = new Map<string, Set<string>>();
  for (const s of scores) {
    if (!byCandidate.has(s.registrationId)) byCandidate.set(s.registrationId, new Map());
    const cat = byCandidate.get(s.registrationId)!;
    (cat.get(s.categoryKey) ?? cat.set(s.categoryKey, []).get(s.categoryKey)!).push(s.score);
    const agg = evalSum.get(s.evaluatorSessionId) ?? { sum: 0, n: 0 };
    agg.sum += s.score; agg.n += 1; evalSum.set(s.evaluatorSessionId, agg);
    (evalCandidates.get(s.evaluatorSessionId) ?? evalCandidates.set(s.evaluatorSessionId, new Set()).get(s.evaluatorSessionId)!).add(s.registrationId);
  }

  const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  // Composite = weight-normalized mean of each category's cross-evaluator average.
  const candidateRows = candidates.map(c => {
    const cat = byCandidate.get(c.id);
    const categoryAverages: Record<string, number | null> = {};
    let weighted = 0; let usedWeight = 0; let anyScore = false;
    const evaluatorsSeen = new Set<string>();
    for (const s of scores) if (s.registrationId === c.id) evaluatorsSeen.add(s.evaluatorSessionId);
    for (const def of categories) {
      const a = cat ? avg(cat.get(def.key) ?? []) : null;
      categoryAverages[def.key] = a;
      if (a != null) {
        anyScore = true;
        const w = def.weight > 0 ? def.weight : 0;
        if (w > 0) { weighted += a * w; usedWeight += w; }
      }
    }
    // Fall back to an even mean if weights are all zero but scores exist.
    let composite: number | null = null;
    if (anyScore) {
      composite = usedWeight > 0 ? weighted / usedWeight
        : avg(Object.values(categoryAverages).filter((v): v is number => v != null));
    }
    return {
      registrationId: c.id,
      bib: c.bibNumber ?? null,
      name: blind ? null : `${c.playerFirstName} ${c.playerLastName}`.trim(),
      composite: composite != null ? Math.round(composite * 100) / 100 : null,
      evaluatorCount: evaluatorsSeen.size,
      categoryAverages,
    };
  });

  candidateRows.sort((a, b) => {
    if (a.composite == null && b.composite == null) return 0;
    if (a.composite == null) return 1;
    if (b.composite == null) return -1;
    return b.composite - a.composite;
  });

  // Bias: an evaluator whose overall mean drifts from the consensus (runs hot / cold).
  // Consensus = mean of each evaluator's OWN mean (equal weight per evaluator) — not a pooled mean of
  // all scores, which would let a high-volume scorer define the consensus and mask their own bias.
  const evalMeans = [...evalSum.values()].filter(a => a.n > 0).map(a => a.sum / a.n);
  const consensusMean = evalMeans.length ? evalMeans.reduce((a, b) => a + b, 0) / evalMeans.length : null;
  const biasThreshold = 0.15 * scaleMax;
  const evaluators = sessions.map(s => {
    const agg = evalSum.get(s.id);
    const mean = agg && agg.n ? agg.sum / agg.n : null;
    const delta = mean != null && consensusMean != null ? mean - consensusMean : null;
    const scoredCount = evalCandidates.get(s.id)?.size ?? 0;
    return {
      id: s.id,
      name: evalName.get(s.id) ?? null,
      candidatesScored: scoredCount,
      meanScore: mean != null ? Math.round(mean * 100) / 100 : null,
      biasDelta: delta != null ? Math.round(delta * 100) / 100 : null,
      // Only flag once an evaluator has enough of a sample to be meaningful.
      biased: delta != null && scoredCount >= 3 && Math.abs(delta) >= biasThreshold,
    };
  });

  return NextResponse.json({
    blind,
    locked: !!tryout.scoresLockedAt,
    scaleMax,
    weightTotal,
    categories,
    consensusMean: consensusMean != null ? Math.round(consensusMean * 100) / 100 : null,
    evaluators,
    candidates: candidateRows,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/tryout-scoreboard' });
