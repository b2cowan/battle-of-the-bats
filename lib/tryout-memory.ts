import 'server-only';
import {
  getPriorContinuityIdentities,
  getRepTryout,
  getRepTryoutRubric,
  getRepTryoutScores,
  getRepTryoutRegistrations,
} from './db';
import { rankTryoutCandidates, tryoutSnapshotCore } from './tryout-scoring';
import {
  buildTryoutMemoryPair,
  canShowTryoutMemory,
  decisionLabel,
  type TryoutMemoryPair,
  type TryoutMemorySnapshot,
} from './tryout-report';
import type { CoachCapabilities } from './coach-capabilities';
import type {
  RepProgramYear,
  RepTryout,
  RepTryoutRegistration,
  RepTryoutRubric,
  RepPlayerContinuityLink,
} from './types';

/**
 * lib/tryout-memory.ts
 * Year-over-year candidate memory — the DB half (Tryout Insights Phase 3, plan §6 work item C1;
 * rulings R6/R7/R8 in memory/design_decisions.md 2026-08-02).
 *
 * The arithmetic (what may be subtracted from what) lives in lib/tryout-report.ts where a unit
 * test holds it. What lives HERE is the reading: which prior season a confirmed link points at,
 * whether this coach is allowed to read that season, and the recomputation of that season's
 * averages through the one shared ranker.
 *
 * ⚠ **The caller passes the capability map in; this module never resolves authority itself.**
 * The archive-opt-in guard (tests/unit/coach-season-write-guard.test.ts) scans ROUTE FILES for the
 * season-read rail. A route that delegated its past-season authority down here would vanish from
 * that scan — the guard going blind while still reporting green, which is the exact regression
 * class the guard's own header warns about. So the rail call stays visible in the route, and this
 * function takes the answer as an argument.
 *
 * ⚠ **Three things must ALL be true before a prior score is assembled:**
 *   1. the CURRENT tryout's names are revealed (R6 — `canShowTryoutMemory`, checked by the caller
 *      before it even fetches, because pairing a prior named record to a bib is the leak);
 *   2. the link is CONFIRMED (a suggestion proves nothing — identity before history);
 *   3. the coach held the `tryouts` capability ON THAT SEASON's assignment row (governing rule 1:
 *      "same access as when it was live, for everyone who had it" — a coach who wasn't cleared for
 *      tryouts in 2026, or wasn't on staff at all, reads nothing from 2026).
 */

/** A season's evaluation record, fetched once and shared by every candidate who links to it.
 *  Both sides are indexed BY ID: the per-link loop below would otherwise rescan the whole season
 *  once per returning candidate (/simplify 2026-08-03). */
interface PriorSeasonRecord {
  seasonLabel: string;
  rubric: Pick<RepTryoutRubric, 'scaleMax' | 'categories'> | null;
  registrationsById: Map<string, RepTryoutRegistration>;
  rankedById: Map<string, ReturnType<typeof rankTryoutCandidates>[number]>;
}

/**
 * Decisions that would read as "was on the team" if left bare. A prior candidate who was offered
 * or waitlisted but never actually rostered is the whole emotional point of this feature (the
 * cut-last-year-came-back kid), so the card says so rather than letting "Offered" imply a season
 * that never happened.
 */
// ⚠ 'Offered — family accepted' was a member here until 2026-08-26 and has been REMOVED, along
// with a comment claiming it still had to match "old rows". That claim was wrong: `label` below is
// `decisionLabel(priorReg)` — RECOMPUTED from the registration's `status` on every read, never a
// stored string — so once that label variant was deleted from `decisionLabel`, no historical row
// could produce it either. Behaviour is unchanged: a prior candidate whose family accepted via the
// retired reply loop still has status 'offered' (that loop never moved status — the coach
// finalized), so they land on 'Offered', which is matched here.
const IMPLIES_A_SPOT = new Set(['Offered', 'Accepted', 'Waitlisted']);

/** Scale fallback, rounding and category projection are `tryoutSnapshotCore`'s — the same
 *  projection the stored development baseline uses, so the two can never round differently. */
function snapshotFor(
  seasonLabel: string,
  rubric: Pick<RepTryoutRubric, 'scaleMax' | 'categories'> | null,
  ranked: Parameters<typeof tryoutSnapshotCore>[1],
  decision: string | null,
): TryoutMemorySnapshot {
  return { seasonLabel, decision, ...tryoutSnapshotCore(rubric, ranked) };
}

/**
 * Resolve every confirmed returning candidate's prior tryout into a comparable pair, keyed by the
 * CURRENT registration id.
 *
 * Links are read from `currentRegistrationId` only. A link keyed by a roster row was decided on
 * the roster profile, about a player already on the team — the decision board is about candidates
 * still being decided, and the report's returning aggregate is about the same population.
 */
export async function resolveTryoutMemoryPairs(input: {
  teamId: string;
  programYear: RepProgramYear;
  allYears: RepProgramYear[];
  /** The CURRENT tryout — the R6 gate is applied here, once, before anything is fetched. */
  tryout: Pick<RepTryout, 'isAnonymous'> | null;
  /** Current-season registrations (withdrawn already dropped by the caller). */
  registrations: RepTryoutRegistration[];
  rubric: Pick<RepTryoutRubric, 'scaleMax' | 'categories'> | null;
  scores: Parameters<typeof rankTryoutCandidates>[2];
  continuityLinks: RepPlayerContinuityLink[];
  /** The member's capabilities — their CURRENT ones, which since M1 (2026-08-16) is the answer for
   *  every season. Null when they hold no active membership on the team, which reads as "nothing
   *  to remember" rather than as an error. */
  capabilities: CoachCapabilities | null;
}): Promise<TryoutMemoryPair[]> {
  const { teamId, programYear, allYears, registrations, rubric, scores, capabilities } = input;

  // R6, fail-closed and FIRST: while names are hidden there is nothing to resolve, so nothing is
  // read. Not a render gate — a fetch gate.
  if (!canShowTryoutMemory(input.tryout)) return [];

  const confirmed = input.continuityLinks.filter(l => l.status === 'confirmed' && l.currentRegistrationId);
  if (confirmed.length === 0) return [];

  const currentRegById = new Map(registrations.map(r => [r.id, r]));
  const candidateLinks = confirmed.filter(l => currentRegById.has(l.currentRegistrationId!));
  if (candidateLinks.length === 0) return [];

  // id → prior identity, for BOTH sides of a link (roster row or registration). One pair of
  // queries whatever the number of prior seasons.
  const { identities } = await getPriorContinuityIdentities(teamId, programYear.id, allYears);
  const priorById = new Map(identities.map(i => [i.id, i]));

  /**
   * ONE resolution pass, consumed twice (which years to fetch, then which pairs to build) — the
   * two passes used to repeat the lookup and phrase the same guard two different ways, which is
   * how they drift apart (/simplify 2026-08-03).
   *
   * Every reason a link drops out is applied here:
   *   · no prior identity, or a hand-added player with no tryout registration behind them —
   *     scores are keyed by registration, so there is nothing to remember;
   *   · the coach holds no `tryouts` capability — a silent refusal rather than an error.
   *     ⚠ Asked ONCE, not per prior year (P2, 2026-08-16). This was a `Map<yearId, caps>` while
   *     access itself was per-season; M1 made every year answer identically and P2 deleted the
   *     season dial that made the shape look meaningful. Keeping a map whose values can no longer
   *     differ is a guard that reads as per-year while being a single boolean — the "absent year =
   *     no access" contract it claimed to carry now means only "no membership", which is `null`.
   */
  const mayReadPriorTryouts = capabilities?.tryouts === true;
  const wanted = !mayReadPriorTryouts ? [] : candidateLinks.flatMap(link => {
    const prior = priorById.get(link.priorRosterId ?? link.priorRegistrationId ?? '');
    if (!prior?.sourceRegistrationId) return [];
    return [{ link, prior, sourceRegistrationId: prior.sourceRegistrationId }];
  });
  if (wanted.length === 0) return [];

  const yearsToRead = new Set(wanted.map(w => w.prior.programYearId));

  const seasonNameById = new Map(allYears.map(y => [y.id, y.name]));
  const records = new Map<string, PriorSeasonRecord>();
  await Promise.all([...yearsToRead].map(async yearId => {
    const priorTryout = await getRepTryout(yearId);
    if (!priorTryout) return; // that season never ran a tryout workspace — nothing to remember
    const [priorRubric, priorScores, priorRegs] = await Promise.all([
      getRepTryoutRubric(priorTryout.id),
      getRepTryoutScores(priorTryout.id),
      getRepTryoutRegistrations(yearId),
    ]);
    records.set(yearId, {
      seasonLabel: seasonNameById.get(yearId) ?? 'a previous season',
      rubric: priorRubric,
      registrationsById: new Map(priorRegs.map(r => [r.id, r])),
      // ⚠ blind: true deliberately. The strip shows numbers, never a prior-season NAME — the
      // "↩ returning · {season}" chip beside it already carries identity, verified by the coach.
      // Withholding at the source means a future field read here cannot leak one.
      rankedById: new Map(
        rankTryoutCandidates(priorRegs, priorRubric?.categories ?? [], priorScores, { blind: true })
          .map(r => [r.registrationId, r]),
      ),
    });
  }));

  // Current side, through the SAME ranker — so the two halves of the strip can never be produced
  // by two different formulas, whatever the decision board happens to be showing.
  const currentRanked = new Map(
    rankTryoutCandidates(registrations, rubric?.categories ?? [], scores, { blind: true })
      .map(r => [r.registrationId, r]),
  );

  const pairs: TryoutMemoryPair[] = [];
  for (const { link, prior, sourceRegistrationId } of wanted) {
    const record = records.get(prior.programYearId);
    const priorReg = record?.registrationsById.get(sourceRegistrationId);
    // That season ran no tryout workspace, or the registration has since been deleted — either
    // way there is no record to show, and inventing one is the thing this feature must not do.
    if (!record || !priorReg) continue;

    const label = decisionLabel(priorReg);
    const neverRostered = prior.kind === 'registration' && IMPLIES_A_SPOT.has(label);
    const priorSnapshot = snapshotFor(
      record.seasonLabel,
      record.rubric,
      record.rankedById.get(priorReg.id),
      neverRostered ? `${label} · never rostered` : label,
    );

    const currentId = link.currentRegistrationId!;
    // Null decision on the current side — see TryoutMemorySnapshot.decision. This season's
    // standing lives on the decision buttons in the same row and would go stale here the moment
    // the coach taps one.
    const currentSnapshot = snapshotFor('This tryout', rubric, currentRanked.get(currentId), null);

    // The prior IDENTITY's id, not the registration's: a returning player who made the roster is
    // keyed by their roster row, and that is the id that must not be counted twice.
    pairs.push(buildTryoutMemoryPair(currentId, prior.id, priorSnapshot, currentSnapshot));
  }
  return pairs;
}
