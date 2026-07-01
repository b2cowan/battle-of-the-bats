import type { RepTryoutRegistration, RepTryoutRubricCategory, RepTryoutScore } from './types';

/** One candidate's aggregated standing across all evaluators (Phase 2B). */
export interface RankedTryoutCandidate {
  registrationId: string;
  bib: string | null;
  /** Null while blind evaluation is on (bib-only). */
  name: string | null;
  /** Weighted composite on the rubric scale, or null if nobody has scored them yet. */
  composite: number | null;
  evaluatorCount: number;
  categoryAverages: Record<string, number | null>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Rank candidates by their weighted composite score — the single source of the tryout ranking math,
 * shared by the live scoreboard and the decision board so the two can never drift.
 *
 * Composite = weight-normalized mean of each category's cross-evaluator average. Falls back to an even
 * mean when all weights are zero but scores exist. Sorted highest-first; unscored candidates sink last.
 * Respects blind mode (names withheld when `blind`).
 */
export function rankTryoutCandidates(
  candidates: RepTryoutRegistration[],
  categories: Pick<RepTryoutRubricCategory, 'key' | 'weight'>[],
  scores: Pick<RepTryoutScore, 'registrationId' | 'categoryKey' | 'score' | 'evaluatorSessionId'>[],
  opts: { blind: boolean },
): RankedTryoutCandidate[] {
  // registrationId → categoryKey → raw score values.
  const byCandidate = new Map<string, Map<string, number[]>>();
  // registrationId → distinct evaluator count is derived below from the score rows we were given.
  for (const s of scores) {
    let cats = byCandidate.get(s.registrationId);
    if (!cats) { cats = new Map(); byCandidate.set(s.registrationId, cats); }
    let vals = cats.get(s.categoryKey);
    if (!vals) { vals = []; cats.set(s.categoryKey, vals); }
    vals.push(s.score);
  }

  const evaluatorsByCandidate = new Map<string, Set<string>>();
  for (const s of scores) {
    let set = evaluatorsByCandidate.get(s.registrationId);
    if (!set) { set = new Set(); evaluatorsByCandidate.set(s.registrationId, set); }
    set.add(s.evaluatorSessionId);
  }

  const rows = candidates.map(c => {
    const cats = byCandidate.get(c.id);
    const categoryAverages: Record<string, number | null> = {};
    let weighted = 0; let usedWeight = 0; let anyScore = false;
    for (const def of categories) {
      const a = cats ? mean(cats.get(def.key) ?? []) : null;
      categoryAverages[def.key] = a;
      if (a != null) {
        anyScore = true;
        const w = def.weight > 0 ? def.weight : 0;
        if (w > 0) { weighted += a * w; usedWeight += w; }
      }
    }
    let composite: number | null = null;
    if (anyScore) {
      composite = usedWeight > 0
        ? weighted / usedWeight
        : mean(Object.values(categoryAverages).filter((v): v is number => v != null));
    }
    return {
      registrationId: c.id,
      bib: c.bibNumber ?? null,
      name: opts.blind ? null : `${c.playerFirstName} ${c.playerLastName}`.trim(),
      composite: composite != null ? round2(composite) : null,
      evaluatorCount: evaluatorsByCandidate.get(c.id)?.size ?? 0,
      categoryAverages,
    };
  });

  rows.sort((a, b) => {
    if (a.composite == null && b.composite == null) return 0;
    if (a.composite == null) return 1;
    if (b.composite == null) return -1;
    return b.composite - a.composite;
  });
  return rows;
}
