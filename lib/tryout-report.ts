import type {
  RepTryout,
  RepTryoutRubric,
  RepTryoutRegistration,
  RepTryoutScore,
  RepRosterPlayer,
  RepPlayerContinuityLink,
} from './types';
import { rankTryoutCandidates, tallyTryoutDecisions } from './tryout-scoring';

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
 * Honesty rules baked in (they are the feature):
 *  - Every fairness-receipt fact is emitted only when the underlying data proves it; a receipt is
 *    absent entirely when nobody scored.
 *  - Candidate rows (names × scores × decisions) are withheld while blind evaluation is on — the
 *    full-detail export cannot exist before names are revealed (R1/R6).
 *  - Nothing is fabricated for missing stages: no rubric → no class profile; no prior season → no
 *    turnout comparison.
 */

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
  /** Candidates currently holding an offer, plus accepted. NOT "ever offered": a coach re-deciding
   *  an offered candidate clears the offer trace entirely (clearTryoutOffer), so offer HISTORY is
   *  not provable from the data layer today — a sticky first_offered_at is queued for the Phase 2
   *  migration; until then this number states current standing only (/simplify altitude finding). */
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
    blind: 'on' | 'revealed';
    scoresLockedAt: string | null;
  } | null;
  /** Per-candidate detail for the full-detail export. NULL while blind evaluation is on (R1/R6). */
  candidateRows: TryoutReportCandidateRow[] | null;
}

/**
 * The fairness receipt, as sentences. ONE assembly point shared by the on-screen card and the PDF
 * so the two can never disagree — and every line states only what the data proves (a still-blind
 * tryout claims "is on", a revealed one may claim "until names were revealed" because blind is the
 * only starting state and reveal is one-way; no lock, no lock line).
 */
export function fairnessReceiptLines(fairness: NonNullable<TryoutReport['fairness']>): string[] {
  const players = fairness.evaluatedCount === 1 ? 'player' : 'players';
  const evals = fairness.evaluatorsWhoScored === 1 ? 'evaluator' : 'independent evaluators';
  const lines = [
    `${fairness.evaluatedCount} ${players} evaluated by ${fairness.evaluatorsWhoScored} ${evals}` +
      (fairness.sharedScorecard ? ' on one shared scorecard' : ''),
  ];
  lines.push(fairness.blind === 'on'
    ? 'Blind evaluation is on — players appear as bib numbers only'
    : 'Blind evaluation — players appeared as bib numbers until names were revealed');
  if (fairness.scoresLockedAt) lines.push('Scoring was locked — no score changed after the lock');
  return lines;
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

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildTryoutReport(input: {
  tryout: Pick<RepTryout, 'isAnonymous' | 'scoresLockedAt'> | null;
  rubric: Pick<RepTryoutRubric, 'scaleMax' | 'categories'> | null;
  registrations: RepTryoutRegistration[];
  scores: Pick<RepTryoutScore, 'registrationId' | 'categoryKey' | 'score' | 'evaluatorSessionId'>[];
  roster: Pick<RepRosterPlayer, 'id' | 'source' | 'tryoutRegistrationId'>[];
  continuityLinks: Pick<RepPlayerContinuityLink, 'status' | 'currentRosterId' | 'currentRegistrationId'>[];
  priorRegistrationCount: number | null;
  priorSeasonName: string | null;
  /** Injected clock (ms epoch) — offer-expiry is an instant comparison, never calendar math. */
  now: number;
}): TryoutReport {
  const { tryout, rubric, scores, roster, now } = input;

  // Withdrawn candidates leave every number here, deliberately matching tryout-overview's counts —
  // the report records the selection; withdrawals stay on the tryout-history record.
  const inPlay = input.registrations.filter(r => r.status !== 'withdrawn');
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

  const funnel: TryoutReportFunnel = {
    registered: inPlay.length,
    attended,
    evaluated,
    offered: decisions.offered + decisions.accepted,
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
      blind: tryout.isAnonymous ? 'on' : 'revealed',
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
  };
}
