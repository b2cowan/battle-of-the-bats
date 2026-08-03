/**
 * "Is everyone getting attention?" — the coverage answers the Development report asks of a
 * season's practice PLANS (Practice Plans Phase 3, frames 08–09).
 *
 * ⚠ **THIS IS THE ONE SURFACE IN THIS FEATURE THAT NAMES CHILDREN, so it is the most constrained
 * thing in the codebase.** Every rule below is load-bearing and lives HERE, not in the page, so no
 * surface can quietly breach one:
 *
 *  1. **No ranking, no sort, no comparable number (§4).** Nothing here returns a per-player count,
 *     percentage, streak, average, rank or score. A player is either NAMED in a plan or they are
 *     not — one boolean, rendered as a flag or a quiet ✓. There is no team average and no
 *     percentile, because a child cannot be compared to another child anywhere in this product.
 *  2. **PLANNED, never done (§4).** This reads what a coach INTENDED. Nothing records what was
 *     actually run (D4), so the vocabulary is "in a plan" — never "worked on", "covered" or "did".
 *     ⚠ A recap existing on some practices does NOT license this to claim the plan happened; the
 *     recap lives in a separate section for exactly that reason.
 *  3. **Silence beats a confident lie.** Assigning players to blocks is OPTIONAL — a coach whose
 *     whole practice is "everyone rotates through four stations" names nobody, and flagging their
 *     entire roster would be the product misreading its own data as a coaching failure. So the
 *     question is only ANSWERABLE once some plan names someone (`answerable` below), and the
 *     column is absent otherwise rather than wrong.
 *  4. **Absence of data is never absence of need.** An UNTAGGED focus area can't be matched
 *     against anything, so it is never reported as uncovered. Only tags a coach actually chose are
 *     compared, and never against a child's name.
 */
import type { PracticePlan } from './rep-practice-plan';

/**
 * How many practice plans a season needs before "not in a plan yet" means anything.
 *
 * ⚠ The same instinct as `insight-findings.ts`'s DEV_MIN_USAGE: a rule that fires on thin data
 * erodes trust in the whole surface. One plan into a season, every player is legitimately "not in
 * a plan yet" and saying so is noise about the calendar, not a fact about coaching.
 */
export const COVERAGE_MIN_PLANS = 3;

/** Everything the report's coverage column and its finding need, from ONE walk of the plans. */
export interface PlanCoverage {
  /**
   * Can the "In a plan" question be answered at all? False when no plan names anybody — see
   * rule 3. The column, the flag and the finding are ALL absent when this is false.
   */
  answerable: boolean;
  /** Player ids named anywhere in the season's plans: on a block, a station, or a rotation group. */
  namedPlayerIds: Set<string>;
  /** How many practice plans the season holds. A fact about the SEASON, never about a player. */
  planCount: number;
  /**
   * Every tag name any plan in the season was about, lower-cased — the plans' own tags, the tag
   * names snapshotted onto drill-backed stations, and the legacy free-text "kind of practice".
   *
   * ⚠ Names, not ids, and that is what lets a merged-away tag still read correctly: a practice
   * already written carries the words it carried at the time.
   */
  coveredTagNames: Set<string>;
}

/** Every player id this plan names, at whichever level the plan puts its people. */
function namedInPlan(plan: PracticePlan | null | undefined, into: Set<string>): void {
  if (!plan) return;
  for (const block of plan.blocks) {
    for (const id of block.playerIds ?? []) into.add(id);
    for (const station of block.stations ?? []) {
      for (const id of station.playerIds ?? []) into.add(id);
    }
    for (const group of block.rotation?.groups ?? []) {
      for (const id of group.playerIds) into.add(id);
    }
  }
}

/**
 * Walk a season's practice plans once and answer everything the report asks of them.
 *
 * @param practices the season's practices that have a plan, each with the tag NAMES on the event.
 */
export function summarizePlanCoverage(
  practices: readonly { plan: PracticePlan | null; tagNames?: readonly string[] }[],
): PlanCoverage {
  const namedPlayerIds = new Set<string>();
  const coveredTagNames = new Set<string>();
  let planCount = 0;

  for (const { plan, tagNames } of practices) {
    if (!plan) continue;
    planCount += 1;
    namedInPlan(plan, namedPlayerIds);
    for (const name of tagNames ?? []) {
      const t = name.trim().toLowerCase();
      if (t) coveredTagNames.add(t);
    }
    // The drill tags snapshotted onto each station — what the practice was about, derived from
    // what is actually in it rather than from one more field a coach had to fill in.
    for (const block of plan.blocks) {
      for (const station of block.stations ?? []) {
        for (const name of station.drillTags ?? []) {
          const t = name.trim().toLowerCase();
          if (t) coveredTagNames.add(t);
        }
      }
    }
    // Legacy free-text "kind of practice" (slice 1a). ⚠ Read, never written and never migrated —
    // a plan written before tags existed must keep counting as being about what it said it was.
    for (const name of plan.practiceTypes ?? []) {
      const t = name.trim().toLowerCase();
      if (t) coveredTagNames.add(t);
    }
  }

  return {
    // Rule 3: the question needs BOTH a real habit of planning and at least one plan that names
    // someone. Either alone produces a screen full of flags that say nothing true.
    answerable: planCount >= COVERAGE_MIN_PLANS && namedPlayerIds.size > 0,
    namedPlayerIds,
    planCount,
    coveredTagNames,
  };
}

/**
 * The one-line finding above the table — **count-only and NAMELESS**, and silent until it means
 * something (`lib/insight-findings.ts` already works exactly this way; this is that rule applied
 * in place rather than a seventh Insights tile, which is explicitly cut).
 *
 * ⚠ The vocabulary is coverage of the COACH'S ATTENTION, never a deficit in a child: "haven't been
 * named in a plan yet" is a fact about where names were typed. The trailing clause is a practical
 * way out, not a judgement — a single stations block genuinely does cover a whole roster.
 *
 * Returns null when the finding must not appear at all.
 *
 * ⚠ Counted by INTERSECTING with the current roster, never `rosterCount - namedPlayerIds.size`.
 * A plan can name a player who has since left the team, so the subtraction quietly under-counts
 * the gap — and on a team with enough departures it goes negative and the finding vanishes
 * altogether, which is the worst possible failure for the one surface meant to catch a child
 * being missed.
 */
export function planCoverageFinding(
  coverage: PlanCoverage,
  rosterPlayerIds: readonly string[],
): string | null {
  if (!coverage.answerable || rosterPlayerIds.length === 0) return null;
  const missing = rosterPlayerIds.filter(id => !coverage.namedPlayerIds.has(id)).length;
  if (missing === 0) return null;
  return `${missing === 1 ? '1 player hasn’t' : `${missing} players haven’t`} been named in a plan yet`
    + ' — one stations block covers everyone.';
}

/**
 * Focus-area tags no planned practice was about — the report's second new section.
 *
 * ⚠ **TAGS, never focus areas and never players.** A focus area is the coach's own specific words
 * about one child ("loading their back hip"); printing those in a list of gaps would put a
 * paraphrased judgement about a named minor on a report page. The tag is the grouping handle, and
 * grouping is all this section needs.
 *
 * ⚠ **An UNTAGGED focus area is never reported.** The product cannot tell whether tonight's
 * hitting practice covered "loading their back hip" if nobody said what that area is about, and
 * absence of data must not read as absence of need — the same rule that keeps an untagged area at
 * full strength in the focus rail.
 *
 * ⚠ **SILENT UNTIL THE SEASON HAS ENOUGH PLANS TO JUDGE BY** — the same `COVERAGE_MIN_PLANS` gate
 * the column and the finding use, and it belongs here for the same reason. One plan into a season,
 * every tag a coach has not yet planned around is "uncovered", and saying so is noise about the
 * calendar rather than a fact about coaching. Gating two of the three sections and not the third
 * would let one corner of the screen make a confident claim its neighbours are refusing to make.
 *
 * ⚠ It also closes a worse case: the practices read is deliberately non-fatal (`.catch(() => [])`
 * on a pre-migration database), and without this gate a SWALLOWED READ FAILURE would produce an
 * empty covered-set and confidently list EVERY active focus tag as a gap. A confident wrong answer
 * built out of an error is the worst thing this surface can do.
 *
 * ⚠ Gated on `planCount`, NOT on `answerable`. `answerable` additionally requires that some plan
 * NAMED someone, because the per-player column cannot exist without that — but this question is
 * about tags, not people. A coach who plans three practices and never assigns a player still gets
 * an honest answer here, and should.
 *
 * @param goals ACTIVE focus areas across the roster; the caller has already filtered by status.
 */
export function uncoveredFocusTags(
  goals: readonly { tagId: string | null; tagName: string | null }[],
  coverage: PlanCoverage,
): { id: string; name: string }[] {
  if (coverage.planCount < COVERAGE_MIN_PLANS) return [];
  const out = new Map<string, { id: string; name: string }>();
  for (const goal of goals) {
    if (!goal.tagId || !goal.tagName) continue;
    const key = goal.tagName.trim().toLowerCase();
    if (!key || coverage.coveredTagNames.has(key)) continue;
    if (!out.has(goal.tagId)) out.set(goal.tagId, { id: goal.tagId, name: goal.tagName });
  }
  // Alphabetical — an ORDER OF WORDS, not of need. Sorting by how many players share a tag would
  // rank areas against each other and, one step on, the children behind them.
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name));
}
