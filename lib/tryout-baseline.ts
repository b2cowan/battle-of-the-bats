import type {
  RepTryoutRubric,
  RepTryoutSession,
  RepTryoutBaselineCategory,
  RepTryoutBaselineSnapshot,
} from './types';
import { tryoutSnapshotCore, type RankedTryoutCandidate } from './tryout-scoring';
import { utcToZonedInputs, formatEventDateRange } from './timezone';

/**
 * lib/tryout-baseline.ts
 * The development baseline seeded from a tryout (Tryout Insights Phase 2 — plan
 * docs/projects/active/COACH_TRYOUT_INSIGHTS_PLAN.md §5; rulings R3/R4/R5 in
 * memory/design_decisions.md 2026-08-02; mockups v1 frames 04–05 = binding).
 *
 * Pure functions only — every rule that could drift lives here where a test can hold it:
 *
 *  · **The snapshot is a COPY** (R4). It is assembled from `rankTryoutCandidates`' output — the
 *    SAME averaging the live scoreboard and the report use, never a second path — plus the
 *    rubric's own labels and scale, and then frozen. A rubric renamed in September must not
 *    change what August's card says.
 *
 *  · **The suggestion rule is the whole of R5's arithmetic half** (OQ-2, ratified in frame 04):
 *    categories STRICTLY BELOW the scale midpoint, lowest first, at most TWO. Everything after
 *    that — which words the areas get, whether they are created at all — is the coach's, and
 *    happens in a picker. This module proposes; it never writes.
 *
 *  · **Nothing is fabricated.** A player nobody scored yields a snapshot with a null composite and
 *    no suggestions rather than an empty-looking card of zeroes; the walkthrough says "no snapshot
 *    — set focus manually" and moves on.
 */

/** ⚠ Bump with the stored shape (`RepTryoutBaselineSnapshot.version`) — rows are never migrated. */
export const TRYOUT_BASELINE_VERSION = 1 as const;

/** At most this many focus suggestions per player (OQ-2, ratified via mockups v1 frame 04). */
export const MAX_BASELINE_SUGGESTIONS = 2;

/** The seed route's ceiling on focus areas — every suggestion, plus one hand-picked extra.
 *  Derived, so raising the suggestion cap cannot leave the server's ceiling stale. */
export const MAX_SEEDED_GOALS = MAX_BASELINE_SUGGESTIONS + 1;

/**
 * "Aug 12–13" — the human span of the tryout, from its scheduled sessions.
 *
 * Cancelled sessions are excluded: a date the tryout did not happen on has no business on a
 * record of what happened. Returns null when no session survives, and the card simply omits the
 * date rather than printing today's (the caller must never substitute `now`).
 *
 * ⚠ **Two shared helpers, not hand-rolled formatting** (/simplify 2026-08-02). Sessions are stored
 * as INSTANTS, so each is resolved to a calendar day in the ORG's zone first — rendering "Aug 12"
 * for a 9pm-local session that is Aug 13 UTC is the exact date trap `lib/timezone.ts` exists for,
 * hence `timeZone` is required rather than optional. The span itself then goes through
 * `formatEventDateRange`, which already owns every case including the one a hand-rolled version
 * dropped: a tryout crossing a YEAR boundary prints both years instead of an ambiguous
 * "Dec 30 – Jan 1" — and this label is FROZEN into the snapshot at seed time, so an ambiguous one
 * would be ambiguous for ever.
 */
export function tryoutDateLabel(sessions: Pick<RepTryoutSession, 'startsAt' | 'status'>[], timeZone: string): string | null {
  // YYYY-MM-DD sorts lexically in chronological order — no Date objects in the comparison.
  const days = sessions
    .filter(s => s.status !== 'cancelled')
    .map(s => utcToZonedInputs(s.startsAt, timeZone).date)
    .filter(Boolean)
    .sort();
  if (days.length === 0) return null;
  return formatEventDateRange(days[0], days[days.length - 1], false);
}

/**
 * Freeze ONE candidate's evaluation into the stored baseline shape.
 *
 * `ranked` is a row straight out of `rankTryoutCandidates` — the single source of tryout
 * averaging (§3 of the plan: "do NOT invent a second averaging path"). Category labels and the
 * scale come from the rubric AS IT IS NOW, and are copied in, because that is what the coach is
 * looking at while they decide.
 */
export function buildTryoutBaselineSnapshot(input: {
  ranked: Pick<RankedTryoutCandidate, 'composite' | 'evaluatorCount' | 'categoryAverages'> | null;
  rubric: Pick<RepTryoutRubric, 'scaleMax' | 'categories'> | null;
  tryoutId: string | null;
  seasonLabel: string;
  dateLabel: string | null;
  blindUsed: boolean;
}): RepTryoutBaselineSnapshot {
  // scaleMax fallback, rounding and category projection all live in `tryoutSnapshotCore` — the
  // Phase 3 memory strip needs the identical projection, and this was the second hand-copy of it
  // (/simplify 2026-08-03). What stays here is what makes a snapshot STORED rather than computed:
  // the version stamp, the frozen date label, and the blind flag.
  return {
    version: TRYOUT_BASELINE_VERSION,
    tryoutId: input.tryoutId,
    seasonLabel: input.seasonLabel,
    dateLabel: input.dateLabel,
    blindUsed: input.blindUsed,
    ...tryoutSnapshotCore(input.rubric, input.ranked),
  };
}

/** True when a snapshot has nothing to show — the walkthrough's "set focus manually" branch. */
export function isEmptyBaselineSnapshot(snapshot: RepTryoutBaselineSnapshot): boolean {
  return snapshot.composite == null && snapshot.categories.every(c => c.avg == null);
}

/**
 * The suggestion rule (R5's arithmetic half; OQ-2 as ratified in frame 04).
 *
 * Categories scored STRICTLY BELOW the scale midpoint, weakest first, capped at two.
 *
 * ⚠ **Strictly below, deliberately.** A player sitting exactly ON the midpoint of their club's
 * scorecard has not been told by the data that this is a weakness, and a suggestion is a claim.
 * ⚠ **Two, not "the two lowest".** A player who was strong everywhere gets NO suggestions and the
 * walkthrough says so — manufacturing a "weakest area" for a strong player is precisely the
 * confident lie the honesty rules forbid.
 * ⚠ Unscored categories are absent, never treated as zero.
 *
 * Ties are broken by the rubric's own order (the array is stable), so two categories at 2.4
 * suggest in the order the coach wrote their scorecard rather than at random.
 */
export function suggestBaselineFocus(snapshot: RepTryoutBaselineSnapshot): RepTryoutBaselineCategory[] {
  const midpoint = snapshot.scaleMax / 2;
  return snapshot.categories
    .filter((c): c is RepTryoutBaselineCategory & { avg: number } => c.avg != null && c.avg < midpoint)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (a.c.avg - b.c.avg) || (a.i - b.i))
    .slice(0, MAX_BASELINE_SUGGESTIONS)
    .map(x => x.c);
}
