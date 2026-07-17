import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepRosterPlayer,
  getRepRosterPlayersByIds,
  getRepTeamMeasurableTypes,
  getRepPlayerMeasurablesForPlayer,
  getRepPlayerDevelopmentGoalsForPlayer,
  getRepTeamDevelopmentGoalsForPlayers,
  getRepTeamMeasurablesForPlayers,
  getRepTeamContinuityLinks,
  getRepPlayerAttendanceSummary,
  getRepProgramYears,
} from '@/lib/db';
import type { RepPlayerContinuityLink, RepRosterPlayer, RepTeamMeasurableType } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import {
  denyUnless, canViewDevelopmentGoals, canViewMeasurables, canWriteDevelopment,
} from '@/lib/coach-capabilities';
import { computeTeamSeasonLineupAnalytics } from '@/lib/team-season-analytics';
import { linkCurrentId } from '@/lib/continuity-match';

async function resolveContext(orgSlug: string, teamId: string, playerId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const [assignments, player] = await Promise.all([
    getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id),
    getRepRosterPlayer(playerId),
  ]);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };
  if (!player || player.teamId !== teamId || player.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Player not found' }, { status: 404 }) };
  }

  return { ctx, player, assignment };
}

/** This-season field/bench innings for ONE player, quoted from the SAME shared engine the
 *  Playing-time fairness report runs (never a parallel computation). Non-fatal by design —
 *  an analytics hiccup must not 500 the Development card — but a real defect must not be
 *  indistinguishable from "no data", hence the console.error. */
async function playerInningsContext(teamId: string, playerId: string) {
  try {
    const result = await computeTeamSeasonLineupAnalytics(teamId);
    const row = result?.analytics.fairPlay.find(r => r.playerId === playerId);
    if (!row || (row.fieldInnings === 0 && row.benchInnings === 0)) return null;
    return { fieldInnings: row.fieldInnings, benchInnings: row.benchInnings };
  } catch (error) {
    console.error('development innings context failed', error);
    return null;
  }
}

/** Walk the CONFIRMED-link chain backwards from one roster player (3D archive). Each hop
 *  resolves the accept-boundary alias (a link may be keyed by the roster row OR its
 *  originating tryout registration). Registration priors carry no development data — the
 *  walk hops THROUGH them (a board-era chain) without minting an archive season. Hop-capped:
 *  a team history deeper than 8 seasons is beyond any real chain. */
async function walkConfirmedPriorChain(
  teamId: string, player: RepRosterPlayer, links: RepPlayerContinuityLink[],
): Promise<{ directLink: RepPlayerContinuityLink | null; priors: { link: RepPlayerContinuityLink; row: RepRosterPlayer }[] }> {
  const confirmedByCurrent = new Map<string, RepPlayerContinuityLink>();
  for (const l of links) {
    if (l.status === 'confirmed') confirmedByCurrent.set(linkCurrentId(l), l);
  }

  const priors: { link: RepPlayerContinuityLink; row: RepRosterPlayer }[] = [];
  let directLink: RepPlayerContinuityLink | null = null;
  let currentIds: string[] = [player.id, player.tryoutRegistrationId ?? ''].filter(Boolean);
  const visited = new Set<string>(currentIds);

  for (let hop = 0; hop < 8; hop++) {
    const link = currentIds.map(id => confirmedByCurrent.get(id)).find(Boolean);
    if (!link) break;
    if (hop === 0) directLink = link;
    if (link.priorRosterId) {
      if (visited.has(link.priorRosterId)) break; // defensive: a cycle would loop forever
      const [row] = await getRepRosterPlayersByIds([link.priorRosterId], teamId);
      if (!row) break;
      priors.push({ link, row });
      currentIds = [row.id, row.tryoutRegistrationId ?? ''].filter(Boolean);
    } else if (link.priorRegistrationId) {
      if (visited.has(link.priorRegistrationId)) break;
      currentIds = [link.priorRegistrationId];
    } else {
      break;
    }
    currentIds.forEach(id => visited.add(id));
  }
  return { directLink, priors };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string; playerId: string }> },) => {
  const { orgSlug, teamId, playerId } = await params;
  const resolved = await resolveContext(orgSlug, teamId, playerId);
  if ('error' in resolved) return resolved.error!;
  const { player, assignment } = resolved;
  const caps = assignment.capabilities;

  const showGoals = canViewDevelopmentGoals(caps);
  const showMeasurables = canViewMeasurables(caps);
  if (!showGoals && !showMeasurables) {
    const denied = denyUnless(false, 'You do not have access to player development.');
    return denied!;
  }
  const canWrite = canWriteDevelopment(caps);

  const [types, measurables, goals, innings, links] = await Promise.all([
    showMeasurables ? getRepTeamMeasurableTypes(teamId, { includeRetired: true }) : Promise.resolve([]),
    showMeasurables ? getRepPlayerMeasurablesForPlayer(playerId) : Promise.resolve([]),
    showGoals ? getRepPlayerDevelopmentGoalsForPlayer(playerId) : Promise.resolve([]),
    // Innings quote the lineup engine → gate on the lineups capability so this GET can't
    // become a side door around the Playing-time report's own gate.
    caps.lineups ? playerInningsContext(teamId, playerId) : Promise.resolve(null),
    getRepTeamContinuityLinks(teamId),
  ]);

  // ── Previous-seasons archive (3D): confirmed chain, oldest→newest, scrapbook only —
  // dated records with NO cross-season computation anywhere. Column visibility follows
  // the same gates as the current season (goals ride notes, measurables ride roster). ──
  const { directLink, priors } = await walkConfirmedPriorChain(teamId, player, links);

  let archive: {
    priorRosterId: string;
    seasonLabel: string;
    goals: { focusArea: string; status: string; note: string | null }[];
    tests: { name: string; entries: { value: number; unit: string; recordedOn: string; note: string | null }[] }[];
    attendancePct: number | null;
  }[] = [];

  if (priors.length > 0) {
    const priorIds = priors.map(p => p.row.id);
    const [years, priorGoals, priorMeasurables, attendance] = await Promise.all([
      getRepProgramYears(teamId),
      showGoals ? getRepTeamDevelopmentGoalsForPlayers(priorIds) : Promise.resolve([]),
      showMeasurables ? getRepTeamMeasurablesForPlayers(priorIds) : Promise.resolve([]),
      // Attendance rides the SAME roster gate as measurables (attendance viewing is bundled
      // with roster access) — a notes-only assistant must not read a minor's attendance rate
      // through the archive. A hiccup degrades to "no attendance", never a 500.
      showMeasurables
        ? Promise.all(priors.map(p =>
            getRepPlayerAttendanceSummary(p.row.id, p.row.programYearId).catch(() => null)))
        : Promise.resolve(priors.map(() => null)),
    ]);
    const yearById = new Map(years.map(y => [y.id, y]));
    const typeNameById = new Map((types as RepTeamMeasurableType[]).map(t => [t.id, t.name]));

    const priorGoalsByPlayer = new Map<string, { focusArea: string; status: string; note: string | null }[]>();
    for (const g of priorGoals) {
      const list = priorGoalsByPlayer.get(g.playerId) ?? [];
      list.push({ focusArea: g.focusArea, status: g.status, note: g.note });
      priorGoalsByPlayer.set(g.playerId, list);
    }
    const entriesByPlayer = new Map<string, typeof priorMeasurables>();
    for (const m of priorMeasurables) {
      const list = entriesByPlayer.get(m.playerId) ?? [];
      list.push(m);
      entriesByPlayer.set(m.playerId, list);
    }

    archive = priors.map(({ row }, i) => {
      const byType = new Map<string, { value: number; unit: string; recordedOn: string; note: string | null }[]>();
      // Arrives newest-first; the archive reads oldest→newest within each test (a dated log).
      for (const m of [...(entriesByPlayer.get(row.id) ?? [])].reverse()) {
        const list = byType.get(m.measurableTypeId) ?? [];
        list.push({ value: m.value, unit: m.unit, recordedOn: m.recordedOn, note: m.note });
        byType.set(m.measurableTypeId, list);
      }
      const att = attendance[i];
      const known = att ? att.attending + att.absent + att.late : 0;
      const year = yearById.get(row.programYearId);
      return {
        priorRosterId: row.id,
        seasonLabel: year?.name ?? 'A previous season',
        goals: priorGoalsByPlayer.get(row.id) ?? [],
        tests: [...byType.entries()].map(([typeId, entries]) => ({
          name: typeNameById.get(typeId) ?? 'Test', entries,
        })),
        attendancePct: att && known > 0 ? Math.round((att.attending / known) * 100) : null,
      };
    });
    // Oldest season first (M5: dated, oldest→newest).
    archive.reverse();
  }

  // ── Carry-forward offer (3D, head coach only): the DIRECT confirmed link, unanswered,
  // with a roster prior that has working focus areas to bring. Reads the already-assembled
  // archive season (goals + label) — no re-derivation. Count-honest; measurables are never
  // offered (copying readings across seasons would fabricate trend data). ──
  let carry: { linkId: string; priorRosterId: string; priorSeasonLabel: string; workingCount: number } | null = null;
  if (canWrite && directLink && directLink.carryStatus === null && directLink.priorRosterId) {
    const directArchive = archive.find(a => a.priorRosterId === directLink.priorRosterId);
    const workingCount = directArchive?.goals.filter(g => g.status === 'working').length ?? 0;
    if (directArchive && workingCount > 0) {
      carry = {
        linkId: directLink.id,
        priorRosterId: directArchive.priorRosterId,
        priorSeasonLabel: directArchive.seasonLabel,
        workingCount,
      };
    }
  }

  return NextResponse.json({
    canWrite,
    showGoals,
    showMeasurables,
    types,
    measurables,
    goals,
    context: innings,
    archive,
    carry,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/[playerId]/development' });
