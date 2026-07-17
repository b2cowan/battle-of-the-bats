import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getActiveRepProgramYear,
  getRepRosterPlayers,
  getRepTeamMeasurableTypes,
  getRepTeamMeasurablesForPlayers,
  getRepTeamDevelopmentGoalsForPlayers,
  getRepTeamContinuityLinks,
  getPriorContinuityIdentities,
  getRepProgramYears,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import {
  denyUnless, canViewDevelopmentGoals, canViewMeasurables,
} from '@/lib/coach-capabilities';
import { linkCurrentId, linkPriorId } from '@/lib/continuity-match';

/** The Team board: every active player's development at a glance — active focus areas,
 *  latest value per test, last-evaluated date. ROSTER ORDER ONLY (never sort-by-result;
 *  this is a coverage view, not a leaderboard — binding design decision 2026-07-17).
 *  Goals ride the notes capability; measurables ride roster visibility — each column is
 *  filtered server-side per caller.
 *
 *  `?history=1` adds the per-player `historyLinked` season label (the Development REPORT
 *  needs it). It's opt-in because resolving it scans the team's prior-season identities —
 *  the Team board page and the Insights hub tile don't render that column, so they don't
 *  request it and don't pay for the scan. */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const withHistory = new URL(req.url).searchParams.get('history') === '1';

  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.org.slug !== orgSlug) return forbidden();

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return forbidden();
  const caps = assignment.capabilities;

  const showGoals = canViewDevelopmentGoals(caps);
  const showMeasurables = canViewMeasurables(caps);
  // Identity rule (sibling-route invariant): NO roster visibility → no player list, ever.
  // Goals access alone must not become a side door to every minor's name + number — the
  // notes-only assistant is correctly denied by /roster, so the board denies too.
  const denied = denyUnless(showMeasurables, 'You do not have access to the team board.');
  if (denied) return denied;

  // Types only need teamId — fetched alongside the programYear→players chain, not after it.
  const typesPromise = showMeasurables
    ? getRepTeamMeasurableTypes(teamId, { includeRetired: true })
    : Promise.resolve([]);
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    await typesPromise.catch(() => {});
    return NextResponse.json({ error: 'No active program year for this team' }, { status: 404 });
  }

  const players = (await getRepRosterPlayers(programYear.id)).filter(p => p.status === 'active');
  const playerIds = players.map(p => p.id);
  // History-linked column (3D report, opt-in): confirmed links resolved to the prior side's
  // season label. `years` is fetched once and shared with getPriorContinuityIdentities (which
  // otherwise fetches it internally) to avoid a duplicate round trip. No PII on the wire.
  const years = withHistory ? await getRepProgramYears(teamId) : [];
  const [types, measurables, goals, links, priorIdentitiesResult] = await Promise.all([
    typesPromise,
    showMeasurables ? getRepTeamMeasurablesForPlayers(playerIds) : Promise.resolve([]),
    showGoals ? getRepTeamDevelopmentGoalsForPlayers(playerIds) : Promise.resolve([]),
    withHistory ? getRepTeamContinuityLinks(teamId) : Promise.resolve([]),
    withHistory ? getPriorContinuityIdentities(teamId, programYear.id, years) : Promise.resolve({ priorProgramYearIds: [], identities: [] }),
  ]);
  const priorIdentities = priorIdentitiesResult.identities;

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
    })),
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/development/board' });
