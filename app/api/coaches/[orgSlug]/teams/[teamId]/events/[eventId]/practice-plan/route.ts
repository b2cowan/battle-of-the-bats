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
  getDrillsForTeam,
  getRepTeamPlanTemplates,
  getRepTeamTagLibrary,
  getRepTeamEventTagsMap,
  setRepTeamEventTagsOfKind,
  isTeamFocusTag,
  updateRepTeamEventPracticePlan,
  updateRepTeamEventPracticeRecap,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import {
  denyUnless, canManageSchedule, canWriteDevelopment, canViewDevelopmentGoals, canViewRoster,
  redactRoster,
} from '@/lib/coach-capabilities';
import {
  MAX_RECAP_LEN, collectPracticeTagSuggestions, sanitizePracticePlan,
} from '@/lib/rep-practice-plan';
import { MAX_TAGS_PER_ITEM, uniqueIds } from '@/lib/rep-drills';

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
  /**
   * ⚠ **NO ROSTER VISIBILITY → NO PLAYER LIST, EVER.** The sibling-route invariant, and this route
   * was the one place in the portal breaking it.
   *
   * `roster` is an INDEPENDENT grant from `schedule` (the head coach toggles them separately), so
   * an assistant can legitimately hold `schedule: true, roster: 'off'` — someone trusted to run a
   * station but not to hold the team list. This handler gated only on `schedule` and then ran the
   * player projection through `redactRoster`, which nulls PII and notes FIELDS but never consults
   * `caps.roster` — so on a projection of `{id, firstName, lastName, number}` it is a no-op, and
   * every child's name and jersey number reached that assistant's browser.
   *
   * ⚠ Gated at the SOURCE, not in the client: the list is never fetched, so no component mistake
   * can surface it. The plan still renders — blocks, stations and groups simply show no names,
   * which is exactly what the read-only past-plan route beside this one already does, and what
   * `/roster`, `/attendance` and the development board have always done.
   */
  const showRoster = canViewRoster(caps);

  // Only `goals` depends on the roster, so it chains off that read; everything else starts
  // immediately rather than queuing behind a round trip it has no need of.
  const playersPromise = showRoster
    ? getRepRosterPlayers(programYear.id).then(all => all.filter(p => p.status === 'active'))
    : Promise.resolve([]);
  const [
    players, goals, attendance, previousEvents, sessions, staff, drills,
    templates, focusTags, eventTagMap,
  ] = await Promise.all([
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
    // The picker's source: this team's own drills PLUS the club's shared set, active only — a
    // retired drill must never be offered while building a practice. Non-fatal for the same reason
    // as the previous-plans read above: on a database without migration 218 the table doesn't
    // exist, and losing the picker must not take the whole plan screen down with it.
    getDrillsForTeam(ctx.org.id, teamId).catch(() => []),
    // The plan library (Phase 3) — the other half of "Start this plan from…". Active only: a
    // retired template must never be offered while building a practice. Non-fatal for the same
    // reason as the reads above.
    getRepTeamPlanTemplates(teamId).catch(() => []),
    // The team's whole 'focus' vocabulary — every tag it has, not only those already in use, so
    // the picker can never hide a word the coach already created and invite a duplicate.
    getRepTeamTagLibrary(teamId, 'focus', ctx.org.id).catch(() => []),
    // THIS practice's own tags. ⚠ The same `rep_team_event_tags` rows a game's tags live in, told
    // apart by the tag's kind — a practice carrying a 'focus' tag IS a tagged plan (mig 221).
    getRepTeamEventTagsMap([eventId]).catch(() => ({} as Record<string, string[]>)),
  ]);

  // Roster ORDER, always — never sorted by anything, and no sort affordance is ever offered
  // (§4, the no-ranking guarantee). Names + number only; the rail needs identity, not PII.
  //
  // ⚠ `redactRoster` is a SECOND line, not the first one. It nulls PII and notes FIELDS, so on this
  // narrow projection it is a no-op — it is here to catch the day someone spreads `...p` for a new
  // field and brings guardian details along. Whether this coach may see the list AT ALL is decided
  // by `showRoster` above, which is what `players` being empty already reflects.
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

  /**
   * The tag ids on this practice, narrowed to the 'focus' vocabulary.
   *
   * ⚠ Narrowed, not trusted: `rep_team_event_tags` is shared with game tags, and a practice that
   * somehow carried one would otherwise arrive in the plan's tag picker — where saving would then
   * silently drop it, because the write below only re-accepts focus ids. Filtering on the way out
   * as well as on the way in keeps the picker showing exactly what it is able to save.
   */
  const focusTagIds = new Set(focusTags.map(t => t.id));
  const planTagIds = (eventTagMap[eventId] ?? []).filter(id => focusTagIds.has(id));

  return NextResponse.json({
    event,
    plan: event.practicePlan,
    // "How it went" (D17). Rides `schedule` with the rest of the practice's content: it is a note
    // about the PRACTICE, never about a child, so there is no per-player gate to apply.
    recap: event.practiceRecap,
    // What tonight is about, in the team's own shared vocabulary — the same list the focus rail
    // matches against and the looking-back list filters by.
    planTagIds,
    focusTags,
    templates: templates.map(t => ({ id: t.id, name: t.name, plan: t.plan, tags: t.tags })),
    roster,
    // Only what the rail needs. The grouping tag (D16, now mig 221) rides along so the rail can
    // soften off-type areas — it is a label on the AREA, never a judgement about the player, and it
    // sits behind the same `notes` gate as the focus text itself.
    goals: goals.map(g => ({
      id: g.id, playerId: g.playerId, focusArea: g.focusArea, status: g.status,
      tagId: g.tagId, tagName: g.tagName,
    })),
    attendance,
    // Only what the copy picker needs — never the whole event rows again.
    previousPlans: previousEvents.map(e => ({
      eventId: e.id, name: e.name, startsAt: e.startsAt, eventType: e.eventType, plan: e.practicePlan,
    })),
    sessions,
    staffSuggestions: tagSuggestions.staff,
    equipmentSuggestions: tagSuggestions.equipment,
    // ⚠ Sent to anyone who can READ the plan (`schedule`), which is deliberate: an assistant sees
    // the same station text a picked drill produced anyway, so withholding the library would hide
    // nothing while breaking the preview. Drills carry no player data of any kind (D20), so there
    // is no PII here to gate — unlike focus areas, which stay behind `notes` above.
    drills,
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

/**
 * The two things about a practice that are NOT the plan: what it was about, and how it went.
 *
 * ⚠ **A separate verb from the plan PUT, deliberately.** The plan autosaves about a second after
 * the last keystroke; the recap is written days later, from a different screen state. Folding them
 * into one body would let an autosaving editor that never loaded the recap send it back as
 * `undefined` and wipe it — the same class of bug the PUT's own "a missing `plan` key is refused"
 * guard exists to prevent, one field along.
 *
 * ⚠ Each key is independent and ABSENT means "not editing this". `recap: null` clears it.
 *
 * Head coach only, matching the plan. Both fields describe the practice, so neither carries the
 * per-player gating focus areas do.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; eventId: string }> },) => {
  const { orgSlug, teamId, eventId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, eventId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;

  const denied = denyUnless(
    canWriteDevelopment(assignment.capabilities),
    'Only the head coach can write up a practice.',
  );
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.recap === undefined && body.tagIds === undefined) {
    return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  }

  if (body.tagIds !== undefined) {
    const tagIds = uniqueIds(body.tagIds, MAX_TAGS_PER_ITEM);
    /**
     * ⚠ **Every id is PROVED to belong to this org's 'focus' vocabulary, never trusted.**
     *
     * RLS on `rep_team_event_tags` is reached through the EVENT, not the tag, so the database
     * cannot catch a route that links one club's practice to another club's tag — mig 221 says so
     * in as many words. `isTeamFocusTag` is that check, and it also refuses a GAME tag, which
     * would otherwise appear on the schedule's game-tag filters as if the coach had put it there.
     */
    const checked = await Promise.all(tagIds.map(id => isTeamFocusTag(id, ctx.org.id, teamId)));
    const allowed = tagIds.filter((_, i) => checked[i]);
    if (allowed.length !== tagIds.length) {
      return NextResponse.json({ error: 'One of those tags isn’t yours.' }, { status: 400 });
    }
    // ⚠ Scoped to 'focus'. The unscoped writer replaces EVERY tag on the event, so it would
    // silently delete this practice's game tags — see setRepTeamEventTagsOfKind.
    await setRepTeamEventTagsOfKind(eventId, 'focus', allowed);
  }

  let event = resolved.event;
  if (body.recap !== undefined) {
    const raw = body.recap;
    if (raw !== null && typeof raw !== 'string') {
      return NextResponse.json({ error: 'Invalid note.' }, { status: 400 });
    }
    // Trimmed to nothing is NULL, not an empty string — "nothing written down for this one" is a
    // state the UI states honestly, and it must have exactly one representation.
    const recap = raw === null ? null : (raw.trim().slice(0, MAX_RECAP_LEN) || null);
    const updated = await updateRepTeamEventPracticeRecap(eventId, teamId, recap);
    if (!updated) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    event = updated;
  }

  return NextResponse.json({ event, recap: event.practiceRecap });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/events/[eventId]/practice-plan' });
