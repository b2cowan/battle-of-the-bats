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

  // What each practice was ABOUT, in the team's own vocabulary — the same 'focus' tags the report's
  // list filters by, so the two surfaces describe a night with the same words.
  const tagsByEvent = await getRepTeamEventTagsByKind(shown.map(e => e.id), 'focus')
    .catch(() => ({} as Record<string, { id: string; name: string }[]>));

  return NextResponse.json({
    season: { programYearId: programYear.id, name: programYear.name, isReadOnly },
    /** True when the season held more practices than this answer carries. The page SAYS SO. */
    truncated,
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
