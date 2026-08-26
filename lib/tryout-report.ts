import type {
  RepTryout,
  RepTryoutRubric,
  RepTryoutRegistration,
  RepTryoutScore,
  RepRosterPlayer,
  RepPlayerContinuityLink,
} from './types';
import { rankTryoutCandidates, tallyTryoutDecisions } from './tryout-scoring';
import { formatStoredDate } from './timezone';

/** Which season came immediately before this one — shared by the report and tryout-history routes
 *  so "last season" can never mean two different things (/simplify 2026-08-02). */
export function pickPriorProgramYear<T extends { id: string; year: number }>(years: T[], currentId: string): T | null {
  const ordered = [...years].sort((a, b) => a.year - b.year);
  const idx = ordered.findIndex(y => y.id === currentId);
  return idx > 0 ? ordered[idx - 1] : null;
}

/**
 * lib/tryout-report.ts
 * Pure aggregation for the Tryout Report (Tryout Insights Phase 1 — plan:
 * docs/projects/active/COACH_TRYOUT_INSIGHTS_PLAN.md, rulings R1–R8 in memory/design_decisions.md
 * 2026-08-02).
 *
 * This module also defines the per-candidate "snapshot" shape (candidate rows carry the rubric's
 * scale + per-category averages + composite) that Phase 2 (development baseline) and Phase 3
 * (candidate memory) reuse — extend here, don't fork the math. Ranking/averaging is delegated to
 * rankTryoutCandidates so the report can never disagree with the live scoreboard.
 *
 * Phase 3 added the candidate-memory half below `decisionLabel`: R6's blind gate, R7's
 * comparability rule, and the report's returning-improvement aggregate. The DB side of that
 * (which prior season, and whether this coach may read it) is lib/tryout-memory.ts.
 *
 * Honesty rules baked in (they are the feature):
 *  - Every fairness-receipt fact is emitted only when the underlying data proves it; a receipt is
 *    absent entirely when nobody scored.
 *  - Candidate rows (names × scores × decisions) are withheld while blind evaluation is on — the
 *    full-detail export cannot exist before names are revealed (R1/R6).
 *  - Nothing is fabricated for missing stages: no rubric → no class profile; no prior season → no
 *    turnout comparison.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Who this tryout is still ABOUT — the one definition of "in play", shared by the report and by
 * every route that hands candidates to the memory resolver.
 *
 * ⚠ **It has to be one function, not one rule written twice** (/simplify 2026-08-03). Withdrawn
 * candidates leave every number here, deliberately matching tryout-overview: the report records
 * the selection, and a withdrawal stays on the tryout-history record. The report used to derive
 * this privately while the routes hand-filtered before calling the memory resolver — identical
 * predicates, independently maintained. If "in play" ever changes and only one side follows, the
 * composite the memory strip shows for a candidate would quietly disagree with the composite the
 * same page shows for that same candidate, and neither file would look wrong on its own.
 */
export function inPlayTryoutCandidates<T extends Pick<RepTryoutRegistration, 'status'>>(registrations: T[]): T[] {
  return registrations.filter(r => r.status !== 'withdrawn');
}

export type TryoutDecisionLabel =
  | 'Offered — family accepted'
  | 'Offered — family declined'
  | 'Offered'
  | 'Waitlisted'
  | 'Accepted'
  | 'Not offered'
  | 'Withdrew'
  | 'No decision';

export interface TryoutReportFunnel {
  registered: number;
  attended: number;
  evaluated: number;
  /**
   * Candidates an offer was EVER extended to — the honest historical claim, restored by the
   * sticky `firstOfferedAt` (mig 223, Phase 2). A coach who offers a player and then re-decides
   * no longer erases the fact that the offer went out.
   *
   * ⚠ It is a UNION, deliberately: `firstOfferedAt` OR currently offered/accepted. The stamp is
   * new, so rows offered before mig 223 whose record-only offer left no `offerSentAt` to backfill
   * from carry no timestamp — counting the stamp alone would make historic funnels DROP below the
   * standing they already reported. The union can only ever undercount the deep past, never the
   * present, and it converges to exact as those seasons age out.
   */
  offered: number;
  accepted: number;
  rostered: number;
  // Drop-off captions — rendered only when > 0.
  neverCheckedIn: number;
  familyDeclined: number;
  offerExpired: number;
  awaitingReply: number;
}

export interface TryoutReportProfileCategory {
  key: string;
  label: string;
  /** Mean of per-candidate averages (equal weight per candidate), null when nobody scored it. */
  avg: number | null;
}

export interface TryoutReportCandidateRow {
  registrationId: string;
  name: string;
  bib: string | null;
  composite: number | null;
  evaluatorCount: number;
  categoryAverages: Record<string, number | null>;
  decision: TryoutDecisionLabel;
}

export interface TryoutReport {
  /** False until any score, decision, or roster conversion exists — the card renders its empty state. */
  hasAnything: boolean;
  /** Every candidate has a settled decision (no pending, no open offers). */
  finalized: boolean;
  funnel: TryoutReportFunnel;
  decisions: { offered: number; waitlisted: number; declined: number; accepted: number; pending: number };
  turnout: { count: number; prior: number | null; priorSeasonName: string | null };
  /** Roster composition; null when nobody is on the roster yet. */
  composition: { rosterTotal: number; fromTryout: number; returning: number; newcomers: number } | null;
  /** Class strength profile; null when there is no scorecard or nobody scored. */
  profile: { scaleMax: number; evaluatedCount: number; categories: TryoutReportProfileCategory[] } | null;
  /** Fairness receipt facts; null when nobody scored (a receipt must not exist without scores). */
  fairness: {
    evaluatedCount: number;
    evaluatorsWhoScored: number;
    sharedScorecard: boolean;
    /** `'throughout'` = no name was ever shown against a score on this tryout; `'names_shown'` =
     *  they were, at `namesShownAt`. ⚠ NOT derived from the live blind switch, which since
     *  2026-08-25 flips both ways and so proves nothing about how the scoring was actually run. */
    blind: 'throughout' | 'names_shown';
    /** When names were first shown. Null on an older tryout revealed before the stamp existed —
     *  the claim then states the fact without dating it. */
    namesShownAt: string | null;
    scoresLockedAt: string | null;
  } | null;
  /** Per-candidate detail for the full-detail export. NULL while blind evaluation is on (R1/R6). */
  candidateRows: TryoutReportCandidateRow[] | null;
  /**
   * "N returning candidates improved +X on average" (Phase 3, C4). NULL below three comparable
   * pairs, and NULL while blind — the pairing that produces it is the same de-anonymization the
   * continuity scan refuses, aggregate or not.
   */
  returningImprovement: TryoutMemoryAggregate | null;
}

/**
 * The fairness receipt, as sentences. ONE assembly point shared by the on-screen card and the PDF
 * so the two can never disagree — and every line states only what the data proves (no lock, no lock
 * line).
 *
 * ⚠ The blind line is the one that had to change when the switch became two-way (owner 2026-08-25).
 * It used to read the live flag and say "blind evaluation is on", which was sound only while
 * re-hiding was impossible. Now it reads the write-once stamp: a tryout may claim it was blind
 * START TO FINISH only when no name was ever shown against a score. A coach who shows names, scores
 * the whole tryout, then switches back gets the honest sentence, not the flattering one — which is
 * the entire reason the stamp exists.
 */
export function fairnessReceiptLines(fairness: NonNullable<TryoutReport['fairness']>): string[] {
  const players = fairness.evaluatedCount === 1 ? 'player' : 'players';
  const evals = fairness.evaluatorsWhoScored === 1 ? 'evaluator' : 'independent evaluators';
  const lines = [
    `${fairness.evaluatedCount} ${players} evaluated by ${fairness.evaluatorsWhoScored} ${evals}` +
      (fairness.sharedScorecard ? ' on one shared scorecard' : ''),
  ];
  lines.push(fairness.blind === 'throughout'
    ? 'Blind evaluation — players appeared as bib numbers only, start to finish'
    : fairness.namesShownAt
      ? `Blind evaluation — players appeared as bib numbers until names were shown on ${formatStoredDate(fairness.namesShownAt)}`
      : 'Blind evaluation — players appeared as bib numbers until names were shown');
  if (fairness.scoresLockedAt) lines.push('Scoring was locked — no score changed after the lock');
  return lines;
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════
 * Candidate memory (Phase 3 — plan §6, work items C1/C4; ruling R7 "present, don't judge").
 *
 * Everything below is the ARITHMETIC HALF of R7, kept pure so a test can hold it. The archive
 * half (which season may be read, and by whom) lives in the route + lib/tryout-memory.ts, and
 * the blindfold half (R6) is `canShowTryoutMemory` immediately below.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

/**
 * **Was this tryout scored without anyone ever seeing a name?** — the ONE definition, because two
 * features answered it separately and immediately disagreed (/review 2026-08-25).
 *
 * ⚠ It reads the write-once stamp, never the live switch. While revealing was one-way, "blind right
 * now" implied "blind all along" and every caller could use `isAnonymous` — the day the switch
 * became two-way that implication died, and the development baseline was still stamping each
 * player's PERMANENT card with the word "blind" from the live flag. A coach could show names, score
 * the whole tryout with them on screen, hide them again, seed baselines, and every card would claim
 * a blind evaluation while the report on the next tab correctly said otherwise.
 *
 * The `!isAnonymous` half catches a tryout revealed before the stamp existed whose backfill could
 * not reach it: no stamp but visibly not blind is still not blind. **Fails closed** — an absent
 * tryout row claims nothing.
 */
export function wasBlindThroughout(
  tryout: Pick<RepTryout, 'isAnonymous' | 'namesShownAt'> | null | undefined,
): boolean {
  if (!tryout) return false;
  return tryout.isAnonymous && !tryout.namesShownAt;
}

/**
 * **R6, as a function.** Prior-season evaluation data may be assembled only once names are
 * revealed — and it FAILS CLOSED: no tryout row at all reads as blind, exactly as the continuity
 * scan already does. Pairing a prior season's named record with a bib number is a server-side
 * de-anonymization, so this gate belongs before any matching, not in front of a render.
 */
export function canShowTryoutMemory(tryout: Pick<RepTryout, 'isAnonymous'> | null | undefined): boolean {
  return !!tryout && !tryout.isAnonymous;
}

/** One season's frozen view of one candidate — the memory strip's card, either side. */
export interface TryoutMemorySnapshot {
  /** The card's own header: "2026" for the prior side, "This tryout" for the current one. */
  seasonLabel: string;
  scaleMax: number;
  composite: number | null;
  evaluatorCount: number;
  categories: { key: string; label: string; avg: number | null }[];
  /**
   * What happened, in the report's own decision vocabulary (+ "never rostered" where it matters).
   *
   * ⚠ NULL on the CURRENT side, deliberately — a **mockup deviation, recorded** (frame 06 shows
   * "Undecided" there). This season's decision is live and belongs to the Offer/Waitlist/Pass
   * buttons sitting inches away in the same row; a second copy inside the strip would still read
   * "Undecided" the instant after a coach taps Offer, because the strip is fetched once. A stale
   * decision beside a fresh one is worse than no second copy.
   */
  decision: string | null;
}

/** One matched scorecard category, both seasons. Only ever built for a COMPARABLE pair. */
export interface TryoutMemoryCategoryRow {
  key: string;
  label: string;
  prior: number;
  current: number;
  delta: number;
}

export interface TryoutMemoryPair {
  registrationId: string;
  /**
   * Opaque id of the PRIOR person this pair reaches back to.
   *
   * ⚠ It exists so the aggregate can count PEOPLE rather than links (/review 2026-08-03). The
   * database guarantees at most one confirmed link per CURRENT candidate — but nothing stops two
   * different current candidates from both being confirmed against the same historical player
   * (two siblings on one guardian email, or a duplicated old record). Both strips are still shown:
   * the coach vouched for each identity and the per-candidate history is theirs to read. What must
   * not happen is one returning player counting twice toward "N returning candidates improved",
   * inflating the count past the three-pair floor on the strength of a single person.
   */
  priorKey: string;
  prior: TryoutMemorySnapshot;
  current: TryoutMemorySnapshot;
  /**
   * Composite delta — and **the presence of this number IS R7's permission**. There is
   * deliberately no separate `comparable` boolean: two fields that always move together are two
   * fields that can one day disagree, and the wire format should make the forbidden state
   * unrepresentable rather than merely unlikely. Null ⇒ the scales differ or a composite is
   * missing ⇒ no arithmetic anywhere on this pair.
   */
  delta: number | null;
  /** Matched-key rows for the expand. EMPTY whenever `delta` is null. */
  categories: TryoutMemoryCategoryRow[];
}

/**
 * Pair two snapshots under R7.
 *
 * ⚠ **The scale is the gate, and it is the only gate.** 2.9 on a 1–5 scorecard and 7.1 on a 1–10
 * one describe the same player equally well; subtracting them describes nothing. Normalizing to a
 * percentage would *look* like a comparison and would smuggle in a claim the club never made — two
 * scorecards with different categories are not the same instrument re-scaled. So: same `scaleMax`
 * or no number, and the strip says why.
 *
 * ⚠ Category rows need a value on BOTH sides. A category only one season scored has nothing to
 * compare; rendering it with an em-dash would invite the reader to fill the blank in themselves.
 */
export function buildTryoutMemoryPair(
  registrationId: string,
  priorKey: string,
  prior: TryoutMemorySnapshot,
  current: TryoutMemorySnapshot,
): TryoutMemoryPair {
  const comparable =
    prior.scaleMax === current.scaleMax && prior.composite != null && current.composite != null;

  if (!comparable) {
    return { registrationId, priorKey, prior, current, delta: null, categories: [] };
  }

  const priorByKey = new Map(prior.categories.map(c => [c.key, c.avg]));
  const categories: TryoutMemoryCategoryRow[] = [];
  for (const cur of current.categories) {
    const was = priorByKey.get(cur.key);
    if (was == null || cur.avg == null) continue; // matched key, but nothing to compare
    categories.push({ key: cur.key, label: cur.label, prior: was, current: cur.avg, delta: round2(cur.avg - was) });
  }

  return { registrationId, priorKey, prior, current, delta: round2(current.composite! - prior.composite!), categories };
}

/**
 * The report's aggregate line (C4). Below this many comparable pairs it does not exist — three
 * players is the floor at which "the returning group" is a group rather than an anecdote, and
 * silence beats a confident lie.
 */
export const MIN_MEMORY_AGGREGATE_PAIRS = 3;

export interface TryoutMemoryAggregate {
  /** How many pairs the number is actually built from — never the count of returning candidates. */
  pairs: number;
  /** Mean composite delta, on the shared scale. Signed. */
  avg: number;
  /** The assembled sentence — ONE place, so screen and export can never word it differently. */
  line: string;
}

/**
 * ⚠ **The sentence adapts to the sign.** "Improved +X" is only true when X is positive; printing
 * it over a negative average would be the report lying in the coach's favour, which is precisely
 * what the fairness receipt exists to make impossible elsewhere in this feature.
 */
export function returningImprovementAggregate(pairs: TryoutMemoryPair[]): TryoutMemoryAggregate | null {
  // ⚠ ONE ROW PER RETURNING PERSON, not per link (see TryoutMemoryPair.priorKey). Two current
  // candidates confirmed against the same historical player must contribute one delta between
  // them, or a single person's improvement gets counted twice and can carry the line over its
  // own three-pair floor. First pair wins — they are the same person, so the choice is arbitrary
  // and the count is what has to be right.
  const seen = new Set<string>();
  const deltas: number[] = [];
  for (const p of pairs) {
    if (p.delta == null || seen.has(p.priorKey)) continue;
    seen.add(p.priorKey);
    deltas.push(p.delta);
  }
  if (deltas.length < MIN_MEMORY_AGGREGATE_PAIRS) return null;
  const avg = round2(deltas.reduce((a, b) => a + b, 0) / deltas.length);
  const who = `${deltas.length} returning candidates`;
  const line =
    avg > 0 ? `${who} improved +${avg.toFixed(1)} on average since their last tryout.`
    : avg < 0 ? `${who} scored ${Math.abs(avg).toFixed(1)} lower on average than at their last tryout.`
    : `${who} scored the same on average as at their last tryout.`;
  return { pairs: deltas.length, avg, line };
}

export function decisionLabel(reg: Pick<RepTryoutRegistration, 'status' | 'offerResponse'>): TryoutDecisionLabel {
  switch (reg.status) {
    case 'offered':
      if (reg.offerResponse === 'accepted') return 'Offered — family accepted';
      if (reg.offerResponse === 'declined') return 'Offered — family declined';
      return 'Offered';
    case 'waitlisted': return 'Waitlisted';
    case 'accepted': return 'Accepted';
    case 'declined': return 'Not offered';
    case 'withdrawn': return 'Withdrew';
    default: return 'No decision';
  }
}

export function buildTryoutReport(input: {
  tryout: Pick<RepTryout, 'isAnonymous' | 'namesShownAt' | 'scoresLockedAt'> | null;
  rubric: Pick<RepTryoutRubric, 'scaleMax' | 'categories'> | null;
  registrations: RepTryoutRegistration[];
  scores: Pick<RepTryoutScore, 'registrationId' | 'categoryKey' | 'score' | 'evaluatorSessionId'>[];
  roster: Pick<RepRosterPlayer, 'id' | 'source' | 'tryoutRegistrationId'>[];
  continuityLinks: Pick<RepPlayerContinuityLink, 'status' | 'currentRosterId' | 'currentRegistrationId'>[];
  priorRegistrationCount: number | null;
  priorSeasonName: string | null;
  /**
   * Confirmed returning candidates paired against their prior tryout (Phase 3, C1). The route
   * resolves them — this module only counts them. Absent/empty ⇒ no aggregate line, which is
   * also the correct answer while blind: the resolver refuses to build pairs at all (R6).
   */
  memoryPairs?: TryoutMemoryPair[];
  /** Injected clock (ms epoch) — offer-expiry is an instant comparison, never calendar math. */
  now: number;
}): TryoutReport {
  const { tryout, rubric, scores, roster, now } = input;

  const inPlay = inPlayTryoutCandidates(input.registrations);
  const decisions = tallyTryoutDecisions(inPlay);

  // Pass the tryout's REAL blind state into the ranker so names are withheld at the source while
  // blind — not merely nulled downstream. Defense in depth for R1/R6: a future field read off
  // `ranked` cannot leak a name that was never assembled (/review security+contract finding).
  const blind = tryout?.isAnonymous ?? true;
  const categories = rubric?.categories ?? [];
  const ranked = rankTryoutCandidates(inPlay, categories, scores, { blind });
  const evaluated = ranked.filter(r => r.composite != null).length;

  const attended = inPlay.filter(r => r.isCheckedIn).length;
  const familyDeclined = inPlay.filter(r => r.offerResponse === 'declined').length;
  const openOffers = inPlay.filter(r => r.status === 'offered' && r.offerSentAt && !r.offerResponse);
  const offerExpired = openOffers.filter(r => r.offerExpiresAt && Date.parse(r.offerExpiresAt) < now).length;
  const awaitingReply = openOffers.length - offerExpired;
  const rosterFromTryout = roster.filter(p => p.source === 'tryout').length;
  // Ever-offered: the sticky stamp, unioned with current standing (see TryoutReportFunnel.offered).
  const everOffered = inPlay.filter(r =>
    r.firstOfferedAt != null || r.status === 'offered' || r.status === 'accepted',
  ).length;

  const funnel: TryoutReportFunnel = {
    registered: inPlay.length,
    attended,
    evaluated,
    offered: everOffered,
    accepted: decisions.accepted,
    rostered: rosterFromTryout,
    neverCheckedIn: inPlay.length - attended,
    familyDeclined,
    offerExpired,
    awaitingReply,
  };

  // Roster composition — "returning" = a roster player whose identity the coach CONFIRMED against a
  // prior season (either the roster row itself is a confirmed link's current side, or the tryout
  // registration it came from is). Suggested links prove nothing and count for nothing.
  let composition: TryoutReport['composition'] = null;
  if (roster.length > 0) {
    const confirmed = input.continuityLinks.filter(l => l.status === 'confirmed');
    const confirmedRosterIds = new Set(confirmed.map(l => l.currentRosterId).filter(Boolean));
    const confirmedRegIds = new Set(confirmed.map(l => l.currentRegistrationId).filter(Boolean));
    const returning = roster.filter(p =>
      confirmedRosterIds.has(p.id) || (p.tryoutRegistrationId && confirmedRegIds.has(p.tryoutRegistrationId)),
    ).length;
    composition = { rosterTotal: roster.length, fromTryout: rosterFromTryout, returning, newcomers: roster.length - returning };
  }

  // Class strength profile — mean of per-candidate category averages, so a candidate scored by four
  // evaluators counts once, same as a candidate scored by one.
  let profile: TryoutReport['profile'] = null;
  if (rubric && categories.length > 0 && evaluated > 0) {
    profile = {
      scaleMax: rubric.scaleMax,
      evaluatedCount: evaluated,
      categories: categories.map(def => {
        const vals = ranked
          .map(r => r.categoryAverages[def.key])
          .filter((v): v is number => v != null);
        return { key: def.key, label: def.label, avg: vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null };
      }),
    };
  }

  // Fairness receipt — only when scoring actually happened, and only lines the data proves.
  let fairness: TryoutReport['fairness'] = null;
  if (evaluated > 0 && tryout) {
    // Evaluator count scoped to the candidates this report is ABOUT: an evaluator who only ever
    // scored a since-withdrawn candidate must not inflate "evaluated by N" (/review finding).
    const inPlayIds = new Set(inPlay.map(r => r.id));
    fairness = {
      evaluatedCount: evaluated,
      evaluatorsWhoScored: new Set(
        scores.filter(s => inPlayIds.has(s.registrationId)).map(s => s.evaluatorSessionId),
      ).size,
      sharedScorecard: categories.length > 0,
      // ONE definition, shared with the development baseline — see wasBlindThroughout.
      blind: wasBlindThroughout(tryout) ? 'throughout' : 'names_shown',
      namesShownAt: tryout.namesShownAt,
      scoresLockedAt: tryout.scoresLockedAt ?? null,
    };
  }

  // Full-detail rows exist only once names are revealed — while blind, the mapping of names to
  // scores must not be constructible anywhere, including a download (R1/R6). `blind` was resolved
  // above and already withheld names inside the ranker.
  const regById = new Map(inPlay.map(r => [r.id, r]));
  const candidateRows: TryoutReportCandidateRow[] | null = blind ? null : ranked.map(r => ({
    registrationId: r.registrationId,
    // rankTryoutCandidates already assembled the display name (not blind on this branch).
    name: r.name ?? '',
    bib: r.bib,
    composite: r.composite,
    evaluatorCount: r.evaluatorCount,
    // Rounded here, at the single authoritative assembly point, so exports can never print
    // full-precision floats like 3.3333333333333335 (/review contract finding).
    categoryAverages: Object.fromEntries(
      Object.entries(r.categoryAverages).map(([k, v]) => [k, v == null ? null : round2(v)]),
    ),
    decision: decisionLabel(regById.get(r.registrationId)!),
  }));

  const decided = decisions.offered + decisions.waitlisted + decisions.declined + decisions.accepted;

  return {
    hasAnything: evaluated > 0 || decided > 0 || rosterFromTryout > 0,
    finalized: inPlay.length > 0 && decisions.pending === 0 && decisions.offered === 0,
    funnel,
    decisions,
    turnout: { count: inPlay.length, prior: input.priorRegistrationCount, priorSeasonName: input.priorSeasonName },
    composition,
    profile,
    fairness,
    candidateRows,
    returningImprovement: returningImprovementAggregate(input.memoryPairs ?? []),
  };
}
