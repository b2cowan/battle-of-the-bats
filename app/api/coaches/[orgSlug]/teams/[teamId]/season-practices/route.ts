import { NextResponse } from 'next/server';
import { resolveCoachHistoryReadFromRequest } from '@/lib/coach-team-read';
import { getRepTeamPracticesWithPlanOrRecap, getRepTeamEventTagsByKind } from '@/lib/db';
import { denyUnless, canReadPastPracticePlans } from '@/lib/coach-capabilities';
import { summarizePracticePlan } from '@/lib/rep-practice-plan';
import { withObservability } from '@/lib/observability';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * "The practices you ran" — ONE finished season's practices, for its own Season's End page
 * (P3 C3, owner-approved 2026-08-16 from the mockup session; `COACH_PRACTICE_PLANS_SHELF_PLAN.md`
 * §2 C3).
 *
 * ⚠⚠ **A HISTORY ENDPOINT — the second one to exist, and the first added since the owner deleted
 * the archive as a place.** It may be handed a season by name. The three questions
 * `HISTORY_ENDPOINTS` demands, answered here as well as at the list, because a route that can be
 * pointed at a year must carry its own justification:
 *
 *   1. **Record or instrument? RECORD.** A practice plan renders entirely from its own jsonb —
 *      Phase 2's copy-on-add means editing a drill today cannot rewrite what June's practice says.
 *      Nothing here runs a tryout, moves money, messages a family or configures the team. The
 *      instruments around it (the drill library, the plan-template library, the tag vocabulary)
 *      stay live-season-only, and those decided absences are untouched.
 *   2. **Does the whole subtree carry the year? YES, and it is one level deep BY CONSTRUCTION.**
 *      This route lists; a row opens `events/[eventId]/practice-plan/read` (which takes the same
 *      year); that page's only link goes back. There is no second level for a Chunk-F-class defect
 *      to hide on.
 *   3. **Could the coach tell which season they are reading? YES, STRUCTURALLY.** Season's End is a
 *      page about one named season and titles itself that way. That is the only shape that answers
 *      without a label — which matters, because the chip that used to answer it was a season
 *      switcher wearing a label.
 *
 * ⚠ **THE GATE IS THE READ ROUTE'S, NOT SEASON'S END'S** (plan §5 risk 2). Season's End itself
 * gates on `hasRecordAccess` alone; the plan door beside it has always ALSO required
 * `canViewSchedule`, precisely so a helper who turns up to run one station cannot type the URL. Its
 * header says the gate and the entry point must move together — this IS a second entry point, so
 * it carries the same pair. Widening it here would have quietly reopened that door from the side.
 * Both now call the one named predicate `canReadPastPracticePlans` (P3 C3 `/simplify`), which is
 * what makes "the same pair" a fact rather than a promise three files are keeping by hand.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

/**
 * ⚠ **NO SILENT CAP** (plan §5 risk 1). `getRepTeamPracticesWithPlanOrRecap` caps its read, and a
 * list headed "the practices you ran" that truncates without saying so tells a coach they ran fewer
 * practices than they did. Season-scoping alone does not fix that — it only makes hitting the cap
 * unlikely. So the read asks for ONE MORE than it will show, and the answer says which it was.
 */
const MAX_ROWS = 200;

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;

  // The year goes THROUGH the resolver, never around it — resolving it separately is how a route
  // ends up running its access check against the team rather than the requested season (the defect
  // the wrapped route records). Absent `?year=`, this is the team's WORKING season, which is the
  // everyday case: a team between seasons reading its own finished year.
  const resolved = await resolveCoachHistoryReadFromRequest(req, orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { programYear, capabilities, isReadOnly } = resolved;

  const denied = denyUnless(
    canReadPastPracticePlans(capabilities),
    'You do not have access to past practice plans.',
  );
  if (denied) return denied;

  /**
   * ⚠ **A CANCELLED PRACTICE DID NOT HAPPEN** and never appears — enforced inside the shared read
   * (`.neq('status', 'cancelled')`), which is where it belongs: the Development report's list, the
   * read route behind each row and this list all inherit one definition. A called-off night showing
   * up complete with who was assigned where is the "planned quietly becomes done" trap.
   *
   * ⚠ **PLAN OR RECAP, not both** — the same deliberate rule the shared read states. A coach who
   * wrote no plan but sat down afterwards and said how it went produced exactly the record this
   * section exists to show.
   */
  const all = await getRepTeamPracticesWithPlanOrRecap(programYear.id, { limit: MAX_ROWS + 1 });

  /**
   * ⚠⚠ **A ROW MUST HAVE SOMETHING TO SHOW, and "the column is not null" is not the same question**
   * (`/review` 2026-08-16). The shared read admits a practice whose `practice_plan` is non-null OR
   * whose `practice_recap` is non-null — but a plan is stored the moment a coach types a GOAL, with
   * no blocks at all. The practice hub says so in its own words: a coach who types "work on
   * cut-offs" and is called away leaves a real, blockless plan behind.
   *
   * Such a row, with no recap either, satisfies the read and carries NOTHING a reader can open: the
   * shelf would have rendered it as "No plan written — your note about how it went" beside a night
   * nobody wrote a note about. Dropping it here is what makes the two labels below true by
   * construction rather than by hope — after this filter, a row without a plan always has a recap.
   */
  /**
   * ⚠ `truncated` is read off the RAW result, before the filter. Asking the filtered list whether
   * it overflowed would let a couple of dropped empty rows pull the count back under the cap and
   * silently retract a truncation notice the season had genuinely earned.
   */
  const truncated = all.length > MAX_ROWS;
  const events = all.filter(e => (e.practicePlan?.blocks.length ?? 0) > 0 || !!e.practiceRecap);
  const shown = events.slice(0, MAX_ROWS);

  /**
   * What each practice was ABOUT, in the team's own vocabulary — the same 'focus' tags the report's
   * list filters by, so the two surfaces describe a night with the same words.
   *
   * ⚠ Read for every row THIS ROUTE HOLDS, not just the page of rows below — the summary counts
   * are drawn from it, and a season's focus computed from the rows that happened to fit is a
   * different season's focus.
   *
   * ⚠⚠ **AND THAT IS NOT THE SAME AS "EVERY ROW THE SEASON HOLDS" — this route is DB-CAPPED and
   * the results route is not** (`/review`, 2026-08-18; an earlier version of this comment claimed
   * otherwise and was wrong). `getRepTeamPracticesWithPlanOrRecap` applies `.limit()` in the query
   * itself, so `all` — and therefore `events`, and therefore every figure in `summary` — stops at
   * `MAX_ROWS + 1`. `season-results` calls `getRepTeamEvents`, which has no limit at all, so its
   * summary genuinely is the whole season.
   *
   * The consequence is carried honestly rather than papered over: `truncated` rides out beside the
   * summary and the page prints the count with a `+`, so a 250-practice season reads "201+ nights
   * written up" and never claims a total it cannot see.
   */
  const tagsByEvent = await getRepTeamEventTagsByKind(events.map(e => e.id), 'focus')
    .catch(() => ({} as Record<string, { id: string; name: string }[]>));

  /**
   * ⚠⚠ **"WHAT YOU WORKED ON" IS FREE, AND IT IS THE BEST THING ON THIS SHELF.** The tags are
   * already on every row; counting them turns a list nobody reads to the end into a fact about a
   * season a coach could not get any other way — nineteen hitting nights and six on pitching.
   *
   * ⚠ A night tagged twice counts once for each tag, deliberately: the question is "how many
   * nights touched hitting", not "how do these divide up", so the numbers are not meant to sum to
   * the practice count and the page must not present them as a breakdown.
   */
  const tagCounts = new Map<string, number>();
  for (const e of events) {
    for (const t of tagsByEvent[e.id] ?? []) tagCounts.set(t.name, (tagCounts.get(t.name) ?? 0) + 1);
  }

  return NextResponse.json({
    season: { programYearId: programYear.id, name: programYear.name, isReadOnly },
    /** True when the season held more practices than this answer carries. The page SAYS SO. */
    truncated,
    /**
     * ⚠⚠ **`total` IS NOT THE SEASON'S PRACTICE COUNT, AND THE PAGE MUST NOT SAY IT IS.** This
     * shelf lists nights a coach WROTE SOMETHING ABOUT — a plan, or a note afterwards — and a
     * practice nobody wrote up never reaches it (see the filter above). A team that ran sixty and
     * planned forty-four would otherwise be told, by a bare number on a closed season's page, that
     * they ran forty-four. The page reads "44 nights written up" for exactly this reason.
     *
     * ⚠⚠ **AND IT IS A FLOOR, NOT A TOTAL, ONCE `truncated` IS SET** — the read above stops at the
     * cap, so every figure here does too. The page prints a `+` in that case. Two different ways
     * for one number to overstate what it knows, and both are the same lesson: a count on a record
     * has to say what it counted.
     */
    summary: {
      total: events.length,
      withPlan: events.filter(e => (e.practicePlan?.blocks.length ?? 0) > 0).length,
      withRecap: events.filter(e => !!e.practiceRecap).length,
      /** Most-used first, then alphabetical so a tie is stable between visits. */
      tags: [...tagCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    },
    practices: shown.map(e => ({
      eventId: e.id,
      name: e.name || 'Practice',
      startsAt: e.startsAt,
      // ⚠ The row's own honesty flag. A practice with a recap and no plan is a legitimate row here,
      // and the page must not offer it under a label that promises a plan.
      hasPlan: (e.practicePlan?.blocks.length ?? 0) > 0,
      planSummary: e.practicePlan ? summarizePracticePlan(e.practicePlan) : null,
      hasRecap: !!e.practiceRecap,
      tags: tagsByEvent[e.id] ?? [],
    })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/season-practices' });
