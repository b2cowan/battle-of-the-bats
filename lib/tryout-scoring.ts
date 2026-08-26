import type { RepTryoutRegistration, RepTryoutRubricCategory, RepTryoutScore } from './types';

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** The status→bucket tally every tryout surface shares. Withdrawn candidates leave every count.
 *  Extracted (/simplify 2026-08-02) because the report became the 4th hand-copy of this loop —
 *  tryout-decisions/route.ts and TryoutDecisionBoard still carry their own; fold them in when touched. */
export function tallyTryoutDecisions(registrations: Pick<RepTryoutRegistration, 'status'>[]): {
  offered: number; waitlisted: number; declined: number; accepted: number; pending: number;
} {
  const counts = { offered: 0, waitlisted: 0, declined: 0, accepted: 0, pending: 0 };
  for (const reg of registrations) {
    if (reg.status === 'withdrawn') continue;
    if (reg.status === 'offered') counts.offered++;
    else if (reg.status === 'waitlisted') counts.waitlisted++;
    else if (reg.status === 'declined') counts.declined++;
    else if (reg.status === 'accepted') counts.accepted++;
    else counts.pending++;
  }
  return counts;
}

/**
 * The scored core of ONE candidate's snapshot, projected onto a scorecard — shared by the Phase 2
 * development baseline (which STORES it) and the Phase 3 memory strip (which recomputes it per
 * read). Extracted /simplify 2026-08-03, when the memory strip became a second hand-copy of the
 * baseline's assembly, right down to the scale fallback.
 *
 * ⚠ The `scaleMax` fallback is the reason this is one function rather than two similar ones: a
 * missing scorecard cannot mean "a scale of 0", because every consumer divides by it to draw a
 * bar. 5 is the decision board's own fallback, so every tryout surface reads alike — and if that
 * default ever changes it must change in exactly one place.
 */
export interface TryoutSnapshotCore {
  scaleMax: number;
  composite: number | null;
  evaluatorCount: number;
  categories: { key: string; label: string; avg: number | null }[];
}

export function tryoutSnapshotCore(
  rubric: { scaleMax: number; categories: Pick<RepTryoutRubricCategory, 'key' | 'label'>[] } | null | undefined,
  ranked: Pick<RankedTryoutCandidate, 'composite' | 'evaluatorCount' | 'categoryAverages'> | null | undefined,
): TryoutSnapshotCore {
  return {
    scaleMax: rubric?.scaleMax && rubric.scaleMax > 0 ? rubric.scaleMax : 5,
    composite: ranked?.composite ?? null,
    evaluatorCount: ranked?.evaluatorCount ?? 0,
    // Category LABELS are copied from the scorecard as it is now — a rename in September must not
    // silently rewrite what August's card says, so consumers freeze or re-read deliberately.
    categories: (rubric?.categories ?? []).map(def => {
      const avg = ranked?.categoryAverages?.[def.key];
      return { key: def.key, label: def.label, avg: avg == null ? null : round2(avg) };
    }),
  };
}

/**
 * Category averages → the one weighted number a tryout ranks on.
 *
 * ⚠ Extracted from inside `rankTryoutCandidates` (2026-08-25) the moment a SECOND caller appeared:
 * the Decide board's per-player breakdown works out each evaluator's own composite for a player, and
 * "3.8 overall, Dana had them at 4.6" is a sentence about two numbers that must be produced the same
 * way. Two hand-copies of a weighting rule is how a panel ends up quietly contradicting the row it
 * opened from.
 *
 * Falls back to an EVEN mean when every weight is zero but scores exist — a scorecard whose shares
 * were never set still has to rank, and refusing to would leave a coach staring at dashes.
 * Returns null when nothing was scored: a candidate nobody evaluated has no number, which is a
 * different fact from a zero.
 */
export function weightedComposite(
  categoryAverages: Record<string, number | null>,
  categories: Pick<RepTryoutRubricCategory, 'key' | 'weight'>[],
): number | null {
  let weighted = 0; let usedWeight = 0; let anyScore = false;
  for (const def of categories) {
    const a = categoryAverages[def.key];
    if (a == null) continue;
    anyScore = true;
    const w = def.weight > 0 ? def.weight : 0;
    if (w > 0) { weighted += a * w; usedWeight += w; }
  }
  if (!anyScore) return null;
  const value = usedWeight > 0
    ? weighted / usedWeight
    : mean(Object.values(categoryAverages).filter((v): v is number => v != null));
  return value == null ? null : round2(value);
}

/**
 * What each evaluator, on their own, made of each candidate — the numbers behind the average.
 *
 * The Decide board opens this under a tapped player, because a 4.1 built from 4.6 and 3.5 is a
 * different player from a 4.1 three people agreed on, and the composite cannot tell them apart.
 * Same weighting as the composite (`weightedComposite` above), applied to one evaluator's scores
 * instead of everyone's: an evaluator who only filled in two of five categories is composited on
 * the two they filled, exactly as a candidate scored on two categories is.
 *
 * ⚠ Evaluator identity is NOT blind-gated, and that is deliberate: blind evaluation hides the
 * CANDIDATE's name from the scorer, never the scorer's name from the head coach. The candidate side
 * of the map is keyed by registration id, so a caller that withholds names still withholds them.
 */
export function evaluatorCompositesByCandidate(
  categories: Pick<RepTryoutRubricCategory, 'key' | 'weight'>[],
  scores: Pick<RepTryoutScore, 'registrationId' | 'categoryKey' | 'score' | 'evaluatorSessionId'>[],
): Map<string, { evaluatorSessionId: string; composite: number }[]> {
  // registrationId → evaluatorSessionId → categoryKey → that evaluator's score.
  const byCandidate = new Map<string, Map<string, Record<string, number | null>>>();
  for (const s of scores) {
    let byEval = byCandidate.get(s.registrationId);
    if (!byEval) { byEval = new Map(); byCandidate.set(s.registrationId, byEval); }
    let cats = byEval.get(s.evaluatorSessionId);
    if (!cats) { cats = {}; byEval.set(s.evaluatorSessionId, cats); }
    // One evaluator scores one category once; a duplicate row would be a data fault, and taking
    // the last is the same thing the cross-evaluator mean does with it.
    cats[s.categoryKey] = s.score;
  }

  const out = new Map<string, { evaluatorSessionId: string; composite: number }[]>();
  for (const [registrationId, byEval] of byCandidate) {
    const rows: { evaluatorSessionId: string; composite: number }[] = [];
    for (const [evaluatorSessionId, cats] of byEval) {
      const composite = weightedComposite(cats, categories);
      if (composite != null) rows.push({ evaluatorSessionId, composite });
    }
    // Highest first: the coach is looking for the spread, and a sorted pair shows it at a glance.
    rows.sort((a, b) => b.composite - a.composite);
    if (rows.length) out.set(registrationId, rows);
  }
  return out;
}

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
    for (const def of categories) {
      categoryAverages[def.key] = cats ? mean(cats.get(def.key) ?? []) : null;
    }
    const composite = weightedComposite(categoryAverages, categories);
    return {
      registrationId: c.id,
      bib: c.bibNumber ?? null,
      name: opts.blind ? null : `${c.playerFirstName} ${c.playerLastName}`.trim(),
      // Already rounded by weightedComposite — rounding here again was dead work.
      composite,
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
