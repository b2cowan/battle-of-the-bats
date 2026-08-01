import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepTeamEventById,
  getRepTeamEventAttendance,
  getRepTeamEventsWithPracticePlans,
  getRepTeamEvaluationSessionsForEvent,
  getRepRosterPlayers,
  getRepTeamStaffForYear,
  getRepTeamDevelopmentGoalsForPlayers,
  updateRepTeamEventPracticePlan,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import {
  denyUnless, canManageSchedule, canWriteDevelopment, canViewDevelopmentGoals, redactRoster,
} from '@/lib/coach-capabilities';
import { collectPracticeTagSuggestions, sanitizePracticePlan } from '@/lib/rep-practice-plan';

/**
 * The practice plan on one event (Practice Plans 1a).
 *
 * ── The capability model (plan §8, D3) — server side of a parity that has bitten three chunks ──
 *   READ (plan + print)      → `schedule`. It is content about an event: an assistant who can
 *                              already open Tuesday's practice can read its plan. This is what
 *                              makes "assistants run stations" work with NO new capability key.
 *   FOCUS AREAS              → `notes`. Coach-judgment content about a minor, gated exactly as
 *                              Development gates it. An assistant without `notes` gets the blocks
 *                              and the names, never the focus text — the field is never sent, so
 *                              it cannot leak through a client that forgets to hide it.
 *   ATTENDANCE               → `attendance`. Mirrors the existing gate.
 *   WRITE                    → HEAD COACH ONLY (`canWriteDevelopment`), per the binding constraint.
 *
 * ⚠ D7 — a plan belongs to ONE practice. This route is the ONLY write path, and it writes exactly
 * one event id. It accepts no `scope` parameter and touches no recurrence machinery, so a
 * "this & future"/"all" edit can never reach a plan and overwrite a season of thinking.
 */
async function resolveContext(orgSlug: string, teamId: string, eventId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const [assignments, programYear] = await Promise.all([
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    getActiveRepProgramYear(teamId),
  ]);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  const event = await getRepTeamEventById(eventId);
  if (!event || event.programYearId !== programYear.id) {
    return { error: NextResponse.json({ error: 'Event not found' }, { status: 404 }) };
  }

  // ⚠ A practice plan is a PRACTICE concept, and that has to be enforced here rather than left to
  // the fact that only a practice renders a link to this screen. Without it a typed URL (or any
  // later caller) could hang the whole stations/rotation/groups model off a game or a tournament.
  // "A plan on a team event or a pre-game warm-up" is an explicit fast-follow in the plan doc, not
  // something that should arrive by accident — widening this is a deliberate decision, one line here.
  if (event.eventType !== 'practice') {
    return {
      error: NextResponse.json(
        { error: 'Practice plans belong to practices. This event isn’t one.' },
        { status: 400 },
      ),
    };
  }

  return { ctx, team, assignment, programYear, event };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment, programYear, event } = resolved;
  const caps = assignment.capabilities;

  const denied = denyUnless(canManageSchedule(caps), 'You do not have access to the schedule.');
  if (denied) return denied;

  const showFocus = canViewDevelopmentGoals(caps);
  const showAttendance = caps.attendance;

  // Only `goals` depends on the roster, so it chains off that read; everything else starts
  // immediately rather than queuing behind a round trip it has no need of.
  const playersPromise = getRepRosterPlayers(programYear.id).then(all => all.filter(p => p.status === 'active'));
  const [players, goals, attendance, previousEvents, sessions, staff] = await Promise.all([
    playersPromise,
    // ⚠ Gated at the SOURCE: an assistant without `notes` never receives focus text, so no client
    // mistake can surface it. The rail simply isn't there for them.
    showFocus
      ? playersPromise.then(p => getRepTeamDevelopmentGoalsForPlayers(p.map(x => x.id)))
      : Promise.resolve([]),
    showAttendance ? getRepTeamEventAttendance(eventId) : Promise.resolve([]),
    // Non-fatal: this read names `practice_plan` in a filter, so on a database that hasn't had
    // migration 213 applied yet it errors rather than returning nothing. The copy-picker and the
    // staff suggestions it feeds are both optional conveniences — losing them must not take the
    // whole plan screen down with them. (The migration still has to precede the code to prod;
    // this is defence in depth, not a substitute for that.)
    getRepTeamEventsWithPracticePlans(programYear.id, { excludeEventId: eventId }).catch(() => []),
    getRepTeamEvaluationSessionsForEvent(eventId, teamId),
    getRepTeamStaffForYear(programYear.id, ctx.org.id),
  ]);

  // Roster ORDER, always — never sorted by anything, and no sort affordance is ever offered
  // (§4, the no-ranking guarantee). Names + number only; the rail needs identity, not PII.
  // Run through redactRoster anyway, as the sibling development-session route does: it's a no-op
  // on this projection today, and it's the gate that catches the day someone spreads `...p` in
  // here for a new field and brings guardian details along with it.
  const roster = redactRoster(
    players.map(p => ({
      id: p.id,
      playerFirstName: p.playerFirstName,
      playerLastName: p.playerLastName,
      playerNumber: p.playerNumber,
    })),
    caps,
  );

  // The team's reusable vocabulary: staff (D12) plus equipment and practice types, all gathered in
  // ONE walk of their previous plans. Every one is a LABEL — nothing here confers any access, and
  // nothing is a fixed list, because "Hitting / Fielding / Pitching" is one sport talking and this
  // platform serves several.
  const tagSuggestions = collectPracticeTagSuggestions(
    previousEvents.map(e => e.practicePlan),
    staff.map(s => s.displayName ?? ''),
  );

  /**
   * The reader's OWN staff name, so the field screen can pick out the station they're tagged on
   * ("Craig · Jen — that's you", D28) without asking them who they are.
   *
   * ⚠ This is a MATCH ON A LABEL, not an identity claim. Staff on a plan are free text (§10.3),
   * so this can miss — a coach who typed "Craig" while the account says "Craig Whitfield" simply
   * doesn't get their station pre-picked, and the picker still lists every station. It can never
   * do the reverse and grant anything: the name is used for emphasis only, and every station is
   * readable by anyone who can read the plan at all.
   */
  const viewerName = staff.find(s => s.userId === ctx.user.id)?.displayName ?? null;

  return NextResponse.json({
    event,
    plan: event.practicePlan,
    roster,
    goals,
    attendance,
    // Only what the copy picker needs — never the whole event rows again.
    previousPlans: previousEvents.map(e => ({
      eventId: e.id, name: e.name, startsAt: e.startsAt, eventType: e.eventType, plan: e.practicePlan,
    })),
    sessions,
    staffSuggestions: tagSuggestions.staff,
    equipmentSuggestions: tagSuggestions.equipment,
    practiceTypeSuggestions: tagSuggestions.practiceTypes,
    viewerName,
    canWrite: canWriteDevelopment(caps),
    canViewFocus: showFocus,
    canViewAttendance: showAttendance,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/practice-plan' });

export const PUT = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;

  // Head coach only (D3). Deliberately NOT `schedule`: an assistant who can create the practice
  // still can't write its plan in 1a. Widening this is a one-line change if coaches ask for it.
  const denied = denyUnless(canWriteDevelopment(assignment.capabilities), 'Only the head coach can edit the practice plan.');
  if (denied) return denied;

  let body: { plan?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // A MISSING `plan` key is refused, not treated as "clear it". Without this, a truncated body, a
  // client bug or a mangled retry would sanitise to null and silently wipe a coach's whole plan
  // with a cheerful 200. Clearing is still possible — it just has to be said out loud, as an
  // explicit `null` (which is what an emptied plan sends).
  if (!('plan' in body)) {
    return NextResponse.json({ error: 'plan is required (send null to clear it)' }, { status: 400 });
  }

  // Every player reference is re-checked against the CURRENT roster, so a stale client — or a
  // hand-rolled request — can't attach a player from another team, or one who has left this one.
  const rosterIds = new Set(
    (await getRepRosterPlayers(programYear.id)).filter(p => p.status === 'active').map(p => p.id),
  );
  const plan = sanitizePracticePlan(body.plan, rosterIds);

  const event = await updateRepTeamEventPracticePlan(eventId, teamId, plan);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  return NextResponse.json({ event, plan: event.practicePlan });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/practice-plan' });
