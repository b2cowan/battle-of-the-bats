import { refuseWithoutLiveSeat } from '@/lib/coach-season-refusal';
import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepProgramYears,
  getNextRepRosterDisplayOrder,
} from '@/lib/db';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney, redactRosterPlayer } from '@/lib/coach-capabilities';
import { resolveCoachTeamCapabilities } from '@/lib/coach-team-read';
import { cutoffFor } from '@/lib/born-years';
import { readPastPlayers, bringBackChild } from '@/lib/past-players';
import { isChildAlreadyOnSeason } from '@/lib/past-player-rules';
import { playerName } from '@/lib/coach-roster-name';
import {
  alreadyOnRoster,
  seasonClosedRefusal,
  SEASON_CLOSED_GENERIC,
} from '@/lib/past-player-words';

/**
 * "BRING BACK A PAST PLAYER" (Club Tier Stage 14 S3, the drawing's tab 3; owner rulings 2026-11-04, Asks 4, 5, 9).
 *
 * GET  — this team's earlier seasons' children who are not on the working season: the latest entry per child, its
 *        season, number, status, and — with the roster-details grant — birth date, family and that season's dues (read
 *        from that season's book, never recomputed; money access too). Also read by the Add Player question and the
 *        paste check, which match a typed name against it in the window (the server re-checks on add).
 * POST — `{ childIds }`: a new working-season entry for each child, ON THAT CHILD, copied from their latest entry,
 *        active, with the history link minted as the roll mints it. A child already on the roster (another door got
 *        there first) is skipped with the drawn words, and the rest are added.
 *
 * ⚠ A CROSS-SEASON READER, listed on purpose in `CROSS_SEASON_READERS` (tests/unit/coach-history-endpoint-guard.test.ts),
 * with the three answers in `lib/past-players.ts`: a record read feeding one write; no subtree; every row names its
 * season. It takes no year — which seasons it reads comes from the team's own data, never from the request.
 * Head coach only (`rosterWrite`), the grant that adds a player.
 */
async function resolve(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };
  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: await refuseWithoutLiveSeat(ctx.org, ctx.user.id, teamId) };
  const denied = denyUnless(assignment.capabilities.rosterWrite, 'Only the head coach can edit the roster.');
  if (denied) return { error: denied };
  // The member's capabilities across seasons (the guard's marker): the redaction below reads THIS answer.
  const capabilities = await resolveCoachTeamCapabilities(ctx.org, ctx.user.id, teamId);
  if (!capabilities) return { error: forbidden() };
  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    const newest = (await getRepProgramYears(teamId)).sort((a, b) => b.year - a.year)[0];
    return {
      error: NextResponse.json(
        { error: newest ? seasonClosedRefusal(newest) : SEASON_CLOSED_GENERIC, code: 'season_closed' },
        { status: 409 },
      ),
    };
  }
  return { ctx, team, capabilities, programYear };
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> }) => {
  const { orgSlug, teamId } = await params;
  const r = await resolve(orgSlug, teamId);
  if ('error' in r) return r.error!;
  const read = await readPastPlayers({
    orgId: r.ctx.org.id,
    team: { id: r.team.id, sport: r.team.sport ?? null },
    workingSeason: r.programYear,
    cutoffs: r.ctx.org.birthdayCutoffs,
    access: { rosterPii: r.capabilities.rosterPii, money: canViewMoney(r.capabilities) },
    withDues: true,
  });
  return NextResponse.json({
    players: read.past,
    // Past children already answered "no" for a same-name player on this season: the Add Player question and the paste
    // check leave them out (ids only; nothing a member without the roster-details grant could not already see).
    answeredNo: [...(read.answeredNo ?? [])],
    hasEarlierSeasons: read.hasEarlierSeasons,
    workingSeason: read.workingSeason,
    born: { from: r.programYear.bornFromYear ?? null, to: r.programYear.bornToYear ?? null },
    // The club's cut-off for the team's sport: the Add Player window warns on a typed birth date (Ask 12) with it.
    cutoff: cutoffFor(r.ctx.org.birthdayCutoffs, r.team.sport),
    // Birth dates (and so the typed-date warning) only for the roster-details grant.
    rosterPii: r.capabilities.rosterPii,
    teamName: r.team.name,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/past-players' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> }) => {
  const { orgSlug, teamId } = await params;
  const r = await resolve(orgSlug, teamId);
  if ('error' in r) return r.error!;
  const body = await req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.childIds) ? body.childIds : [];
  const childIds = [...new Set(raw.filter((x): x is string => typeof x === 'string' && x.length > 0))];
  if (childIds.length === 0 || childIds.length > 200) {
    return NextResponse.json({ error: 'Choose at least one player to bring back.', code: 'nothing_chosen' }, { status: 400 });
  }

  const read = await readPastPlayers({
    orgId: r.ctx.org.id,
    team: { id: r.team.id, sport: r.team.sport ?? null },
    workingSeason: r.programYear,
    cutoffs: r.ctx.org.birthdayCutoffs,
    access: { rosterPii: true, money: false },
  });
  // Every id must be this team's child: listed (an earlier season, not here) or already on the working season.
  const unknown = childIds.filter(id => !read.latest.has(id) && !read.onWorking.has(id));
  if (unknown.length > 0) {
    return NextResponse.json({ error: 'That player is not one of this team’s past players.', code: 'not_past_player' }, { status: 400 });
  }

  const created = [];
  const skipped: { childId: string; message: string }[] = [];
  let order = await getNextRepRosterDisplayOrder(r.programYear.id, r.team.id);
  for (const childId of childIds) {
    const prior = read.latest.get(childId);
    const here = read.onWorking.get(childId);
    if (!prior) {
      skipped.push({ childId, message: alreadyOnRoster(here ? playerName(here) : 'That player', read.workingSeason) });
      continue;
    }
    try {
      const { player } = await bringBackChild({
        orgId: r.ctx.org.id,
        teamId: r.team.id,
        workingSeasonId: r.programYear.id,
        prior,
        userId: r.ctx.user.id,
        displayOrder: order++,
      });
      created.push(redactRosterPlayer(player, r.capabilities));
    } catch (e) {
      if (isChildAlreadyOnSeason(e)) {
        skipped.push({ childId, message: alreadyOnRoster(playerName(prior), read.workingSeason) });
        continue;
      }
      throw e;
    }
  }
  return NextResponse.json({ created, skipped }, { status: created.length > 0 ? 201 : 409 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/roster/past-players' });
