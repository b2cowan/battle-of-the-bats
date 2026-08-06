import { NextResponse } from 'next/server';
// ⚠ No direct auth imports: every read here resolves through the season rail below, which is the
// only thing that can hand back a PAST season's capabilities (governing rule 1). Leftover
// `getAuthContext` / `getActiveRepProgramYear` imports from before that conversion were unused.
import {
  getRepRosterPlayers,
  getRepTeamMeasurableTypes,
  getRepTeamMeasurablesForPlayers,
  getRepTeamDevelopmentGoalsForPlayers,
  getRepTeamContinuityLinks,
  getPriorContinuityIdentities,
  getRepProgramYears,
  getRepTeamPracticesWithPlanOrRecap,
  getRepTeamEventTagsByKind,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';
import {
  denyUnless, canViewDevelopmentGoals, canViewMeasurables, canManageSchedule,
} from '@/lib/coach-capabilities';
import { linkCurrentId, linkPriorId } from '@/lib/continuity-match';
import {
  planCoverageFinding, summarizePlanCoverage, uncoveredFocusTags,
} from '@/lib/rep-practice-coverage';
import { summarizePracticePlan } from '@/lib/rep-practice-plan';

/** The Team board: every active player's development at a glance — active focus areas,
 *  latest value per test, last-evaluated date. ROSTER ORDER ONLY (never sort-by-result;
 *  this is a coverage view, not a leaderboard — binding design decision 2026-07-17).
 *  Goals ride the notes capability; measurables ride record access — each column is
 *  filtered server-side per caller.
 *
 *  `?history=1` adds the per-player `historyLinked` season label (the Development REPORT
 *  needs it). It's opt-in because resolving it scans the team's prior-season identities —
 *  the Team board page and the Insights hub tile don't render that column, so they don't
 *  request it and don't pay for the scan.
 *
 *  `?plans=1` adds the three practice-plan answers the Development report gained in Practice
 *  Plans Phase 3 — coverage ("In a plan"), the focus-area tags no plan was about, and the
 *  tag-filtered list of practices you've run. Opt-in for the same reason: it walks the season's
 *  practice plans, and the board page and the hub tile render none of it.
 *
 *  ⚠ All three come from ONE walk of the plans (`summarizePlanCoverage`) rather than three reads.
 *  A second copy of that walk is exactly how two sections end up disagreeing about what counts. */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const search = new URL(req.url).searchParams;
  const withHistory = search.get('history') === '1';
  const withPlans = search.get('plans') === '1';

  // Season-scoped (Chunk F): `?year=` decides which season is being read, and the grants come
  // from THAT season's assignment row (governing rule 1) rather than the coach's current ones.
  const seasonCtx = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in seasonCtx) return seasonCtx.error;
  const caps = seasonCtx.capabilities;

  const showGoals = canViewDevelopmentGoals(caps);
  const showMeasurables = canViewMeasurables(caps);
  /**
   * Identity rule (sibling-route invariant): this board and `/roster` must answer the same
   * question, because both hand back every active player.
   *
   * ⚠ **A1 (2026-08-03) REVERSED WHAT THAT MEANS FOR A NOTES-ONLY ASSISTANT, and the change is the
   * point.** The rule used to be "no roster visibility → no player list, ever", and it denied a
   * notes-only assistant here on the grounds that `/roster` denied them too. That was never quite
   * true in the UI: the Development nav door already opened on `notes || roster`, so a notes-only
   * assistant saw a door that 403'd on arrival. `notes` is now one of `hasRecordAccess`'s own
   * terms, so `/roster` admits them and this board admits them — the two routes and the door
   * finally agree, which is what the invariant was always asking for.
   */
  const denied = denyUnless(showMeasurables, 'You do not have access to the team board.');
  if (denied) return denied;

  // Types only need teamId — fetched alongside the programYear→players chain, not after it.
  const typesPromise = showMeasurables
    ? getRepTeamMeasurableTypes(teamId, { includeRetired: true })
    : Promise.resolve([]);
  const programYear = seasonCtx.programYear;
  if (!programYear) {
    await typesPromise.catch(() => {});
    return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });
  }

  /**
   * ── Practice-plan coverage (Phase 3) ──
   *
   * ⚠ Gated on `schedule`, INDEPENDENTLY of the roster gate this route already applies. A practice
   * plan is practice content: an assistant who cannot open Tuesday's practice must not read its
   * blocks, its tags or its write-up here just because they can see the team board. Absent the
   * grant, the sections are simply not sent — the client cannot render what it never received.
   *
   * ⚠ Started HERE, beside `typesPromise`, and awaited in the batch below — it needs nothing but
   * the program year, which is already in hand. An earlier draft awaited it *after* that batch,
   * so the Development report (which always asks for `?plans=1`) paid for a full extra round trip
   * in series for no reason. Same idiom, same reason, as `typesPromise` above.
   */
  const showPlans = withPlans && canManageSchedule(caps);
  const practicesPromise = showPlans
    // Non-fatal: this read names `practice_plan`/`practice_recap` in a filter, so on a database
    // without mig 213/221 it errors rather than returning nothing. The three new sections are
    // additions to a report that already stands on its own — losing them must not take it down.
    ? getRepTeamPracticesWithPlanOrRecap(programYear.id).catch(() => [])
    : Promise.resolve([]);

  const players = (await getRepRosterPlayers(programYear.id)).filter(p => p.status === 'active');
  const playerIds = players.map(p => p.id);
  // History-linked column (3D report, opt-in): confirmed links resolved to the prior side's
  // season label. `years` is fetched once and shared with getPriorContinuityIdentities (which
  // otherwise fetches it internally) to avoid a duplicate round trip. No PII on the wire.
  const years = withHistory ? await getRepProgramYears(teamId) : [];
  const [types, measurables, goals, links, priorIdentitiesResult, practices] = await Promise.all([
    typesPromise,
    showMeasurables ? getRepTeamMeasurablesForPlayers(playerIds) : Promise.resolve([]),
    showGoals ? getRepTeamDevelopmentGoalsForPlayers(playerIds) : Promise.resolve([]),
    withHistory ? getRepTeamContinuityLinks(teamId) : Promise.resolve([]),
    withHistory ? getPriorContinuityIdentities(teamId, programYear.id, years) : Promise.resolve({ priorProgramYearIds: [], identities: [] }),
    practicesPromise,
  ]);
  const priorIdentities = priorIdentitiesResult.identities;

  // ⚠ This one genuinely DEPENDS on the practices above (it needs their resolved ids), so it stays
  // sequential. `getRepTeamEventTagsByKind` already no-ops on an empty id list, so there is no
  // caller-side length guard to write.
  const practiceTags = await getRepTeamEventTagsByKind(practices.map(e => e.id), 'focus')
    .catch(() => ({} as Record<string, { id: string; name: string }[]>));

  // ONE walk, three answers. `goals` is already filtered to what this caller may see, so an
  // assistant without `notes` gets an empty uncovered list rather than a leak.
  const coverage = summarizePlanCoverage(
    practices.map(e => ({ plan: e.practicePlan, tagNames: (practiceTags[e.id] ?? []).map(t => t.name) })),
  );

  // Latest reading per (player, type) — entries arrive newest-first, so first wins.
  const latestByPlayer = new Map<string, Map<string, { value: number; unit: string; recordedOn: string }>>();
  const lastRecordedByPlayer = new Map<string, string>();
  for (const e of measurables) {
    let perType = latestByPlayer.get(e.playerId);
    if (!perType) { perType = new Map(); latestByPlayer.set(e.playerId, perType); }
    if (!perType.has(e.measurableTypeId)) {
      perType.set(e.measurableTypeId, { value: e.value, unit: e.unit, recordedOn: e.recordedOn });
    }
    if (!lastRecordedByPlayer.has(e.playerId)) lastRecordedByPlayer.set(e.playerId, e.recordedOn);
  }
  const goalsByPlayer = new Map<string, { focusArea: string; status: string }[]>();
  for (const g of goals) {
    const list = goalsByPlayer.get(g.playerId) ?? [];
    list.push({ focusArea: g.focusArea, status: g.status });
    goalsByPlayer.set(g.playerId, list);
  }

  // Confirmed link per player → the prior side's season label (accept-boundary alias: a
  // link may be keyed by the roster id OR its originating tryout registration).
  const confirmedByCurrent = new Map(links
    .filter(l => l.status === 'confirmed')
    .map(l => [linkCurrentId(l), l]));
  const priorYearById = new Map(priorIdentities.map(p => [p.id, p.programYearId]));
  const labelByYearId = new Map(years.map(y => [y.id, y.name]));
  const historyLabelFor = (p: { id: string; tryoutRegistrationId: string | null }): string | null => {
    if (!withHistory) return null;
    const link = confirmedByCurrent.get(p.id)
      ?? (p.tryoutRegistrationId ? confirmedByCurrent.get(p.tryoutRegistrationId) : undefined);
    if (!link) return null;
    const priorYearId = priorYearById.get(linkPriorId(link));
    return (priorYearId && labelByYearId.get(priorYearId)) || 'a previous season';
  };

  return NextResponse.json({
    showGoals,
    showMeasurables,
    types,
    rows: players.map(p => ({
      playerId: p.id,
      firstName: p.playerFirstName,
      lastName: p.playerLastName,
      number: p.playerNumber,
      goals: goalsByPlayer.get(p.id) ?? [],
      latest: Object.fromEntries(latestByPlayer.get(p.id) ?? []),
      lastRecordedOn: lastRecordedByPlayer.get(p.id) ?? null,
      historyLinked: historyLabelFor(p),
      /**
       * ⚠ **ONE BOOLEAN, and that is the whole no-ranking guarantee in the wire format** (§4).
       * Not a count of plans, not a percentage, not a streak, not a date — any of those would be
       * a number beside a child's name that another child's row could be read against. The page
       * renders it as a quiet ✓ or the flag "— not in a plan yet", and nothing else.
       *
       * `null` when the question is unanswerable at all (too few plans, or no plan names anyone),
       * so the column is ABSENT rather than a screen of flags that say nothing true.
       */
      inPlan: showPlans && coverage.answerable ? coverage.namedPlayerIds.has(p.id) : null,
    })),

    // ── The three Phase 3 sections. Absent entirely without `schedule` + `?plans=1`. ──
    showPlans,
    /**
     * Count-only and NAMELESS, silent until it means something. This is the findings rule applied
     * in place rather than a seventh Insights tile, which is explicitly cut.
     */
    planFinding: showPlans ? planCoverageFinding(coverage, playerIds) : null,
    /**
     * Focus-area TAGS no planned practice was about. ⚠ Tags, never focus areas and never players:
     * a focus area is the coach's own words about one child, and an UNTAGGED one is never reported
     * at all, because absence of data must not read as absence of need.
     */
    uncoveredFocus: showPlans && showGoals
      ? uncoveredFocusTags(goals.filter(g => g.status === 'working'), coverage)
      : [],
    /**
     * "Practices you've run" — the one section allowed to describe what actually happened, and it
     * earns that because a coach sat down afterwards and wrote it.
     *
     * ⚠ Kept apart from coverage on purpose (the §10.2 "Recorded here" precedent). A recap
     * existing here does NOT license the coverage column to claim the plan happened.
     */
    practices: practices.map(e => ({
      eventId: e.id,
      name: e.name,
      startsAt: e.startsAt,
      tags: practiceTags[e.id] ?? [],
      recap: e.practiceRecap,
      hasPlan: !!e.practicePlan,
      // "6 blocks · 90 min planned" — the vocabulary is "planned", never "done".
      planSummary: e.practicePlan ? summarizePracticePlan(e.practicePlan) : null,
    })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/board' });
