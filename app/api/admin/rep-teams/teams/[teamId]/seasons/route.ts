import { NextResponse } from 'next/server';
import { getRepProgramYears } from '@/lib/db';
import { resolveClubTeam } from '@/lib/club-team-route';
import { resolveCoachCapabilities } from '@/lib/coach-capabilities';
import { loadSeasonSettlement } from '@/lib/coach-season-settlement';
import { unsettledFamilyCounts } from '@/lib/season-close-warning';
import { isLiveSeasonStatus, latestClosedSeasonOf, liveSeasonOf, openSeasonsSentence } from '@/lib/season-live';
import {
  closeOpenSeason, reopenLatestClosedSeason, startNextRepSeason, SeasonRolloverError,
} from '@/lib/rep-season-rollover';
import { tellClubTeamStaff } from '@/lib/club-season-notify';
import { withObservability } from '@/lib/observability';
import type { RepProgramYear } from '@/lib/types';

/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE CLUB'S SEASON DOORS FOR ONE TEAM (Club Tier Stage 2, Ask 1 (a) — owner ruling 2026-09-28).
 *
 * A club team's owner or admin holds exactly the three doors a standalone head coach holds —
 * *Start next season*, *Close the season*, *Reopen* — with the same roll (the same five carries:
 * roster, budget plan, fee plan, opening balance, continuity links), the same never-blocking money
 * warning, and no undo for a roll (season-close plan §3.4). The coach of a club team sees none of
 * them; this route is how the club uses them, and the coach is TOLD each time.
 *
 * Differences from the portal's `/api/coaches/…/seasons`, each deliberate:
 *   · NO SELF-HEAL. Two open seasons on a club team are refused by name (`two_open_seasons`),
 *     never quietly resolved — `decideStrayOpenSeasons` in `lib/season-live.ts`.
 *   · THE WARNING IS COUNTS ONLY ("3 families still owe dues"), never dollars: the club reads team
 *     money only from Stage 3 (D1). The coach settles; the club is told how many families.
 *   · CASH CARRY IS ALWAYS "all" — the team's own closing figure, computed by the register at the
 *     moment of the roll. The club never chooses an amount; the coach corrects it in Team settings.
 *   · CLOSE may name WHICH open season (`seasonId`) — the way out of the two-open-seasons state the
 *     old club screens could create. Without it, the team's live season.
 *
 * Gate: the OWNER, or an ADMIN with Rep Teams — never a treasurer (`resolveClubTeam`, write).
 * ⚠ No year parameter reaches any coach tool from here: this is the club's own route.
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */

const ROUTE = '/api/admin/rep-teams/teams/[teamId]/seasons';

function seasonShape(s: RepProgramYear) {
  return { id: s.id, name: s.name, year: s.year, status: s.status, isLive: isLiveSeasonStatus(s.status) };
}

/**
 * GET — the preflight the club's season window reads. ⚠ IT RETURNS NOTHING THAT REFUSES.
 *
 *   season       the team's live season, or null
 *   lastClosed   its newest closed season, or null
 *   rollsFrom    what Start next season would roll from (the live season, else the newest closed)
 *   suggested    the next season's year and name, for the window's pre-fill
 *   openSeasons  every open season — two or more is the state Start next season refuses
 *   canReopen / reopenSeason   reopen is offered only with no live season, on the newest closed one
 *   hasSeasons   false for a brand-new team (its door is "Start the first season")
 *   unsettled    { familiesOwing, familiesWaitingToReturn } for a live season, else null. COUNTS.
 */
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const { teamId } = await params;
  const resolved = await resolveClubTeam(req, teamId, { write: true });
  if ('error' in resolved) return resolved.error;
  const { team } = resolved;

  const seasons = await getRepProgramYears(team.id);
  const live = liveSeasonOf(seasons);
  const lastClosed = latestClosedSeasonOf(seasons);
  const rollsFrom = live ?? lastClosed;
  const reopenSeason = !live && lastClosed?.status === 'completed' ? lastClosed : null;

  let unsettled: { familiesOwing: number; familiesWaitingToReturn: number } | null = null;
  if (live) {
    try {
      // The club reads COUNTS off the same settlement sheet the coach settles from; a head coach's
      // capabilities are only what lets the sheet assemble (no figure leaves this route).
      const sheet = await loadSeasonSettlement({
        programYear: live, capabilities: resolveCoachCapabilities('head_coach', null),
      });
      unsettled = unsettledFamilyCounts(sheet.rows);
    } catch (e) {
      /* ⚠ QUIET, as the portal's is: a failed settlement read must not stop the club ending a
         season — the window then warns about nothing, exactly as it does for a team with no money
         recorded at all. */
      console.error('[club seasons GET] settlement preflight failed:', e);
    }
  }

  return NextResponse.json({
    season: live ? seasonShape(live) : null,
    lastClosed: lastClosed ? seasonShape(lastClosed) : null,
    rollsFrom: rollsFrom ? seasonShape(rollsFrom) : null,
    suggested: rollsFrom ? { year: rollsFrom.year + 1, name: `${rollsFrom.year + 1} Season` } : null,
    openSeasons: seasons.filter(s => isLiveSeasonStatus(s.status)).map(seasonShape),
    canReopen: !!reopenSeason,
    reopenSeason: reopenSeason ? seasonShape(reopenSeason) : null,
    hasSeasons: seasons.length > 0,
    unsettled,
  });
}, { route: ROUTE });

/** POST — Start next season: `{ year, name?, carryBudget?, carryFees? }`. */
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const { teamId } = await params;
  const resolved = await resolveClubTeam(req, teamId, { write: true });
  if ('error' in resolved) return resolved.error;
  const { ctx, team } = resolved;

  const seasons = await getRepProgramYears(team.id);
  // Rolls FROM the live season, else the newest closed one — exactly as the portal's route does.
  const rollsFrom = liveSeasonOf(seasons) ?? latestClosedSeasonOf(seasons);
  if (!rollsFrom) {
    return NextResponse.json(
      { error: `${team.name} has no season yet, so there is nothing to start from. Start its first season instead.`,
        code: 'no_season_to_roll' },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const yearNum = Number(body.year);
  if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return NextResponse.json({ error: 'A valid four-digit season year is required.' }, { status: 400 });
  }
  if (yearNum <= rollsFrom.year) {
    return NextResponse.json({ error: 'The new season year must be later than the current season.' }, { status: 400 });
  }
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : `${yearNum} Season`;
  if (name.length > 100) {
    return NextResponse.json({ error: 'Season name must be 100 characters or fewer.' }, { status: 400 });
  }
  const carryBudget = body.carryBudget !== false; // default on
  const carryFees = body.carryFees !== false; // default on

  try {
    const summary = await startNextRepSeason({
      managedBy: 'club',
      teamName: team.name,
      orgId: ctx.org.id,
      teamId: team.id,
      // A club team has no standalone workspace row to re-point.
      workspaceId: null,
      currentSeason: rollsFrom,
      initiatorUserId: ctx.user.id,
      newName: name,
      newYear: yearNum,
      carryBudget,
      carryFees,
      // ⚠ Always the register's own closing figure — never an amount from the request.
      carryCash: { mode: 'all' },
    });
    await tellClubTeamStaff({
      org: ctx.org, team, actorUserId: ctx.user.id, action: 'started', seasonName: summary.newSeason.name,
      previousSeasonName: summary.previousSeason.name,
      carried: {
        players: summary.roster.copied,
        budgetPlan: summary.budget.carried && summary.budget.linesCopied > 0,
        feePlan: summary.fees.carried && summary.fees.playersCopied > 0,
        openingBalance: summary.openingBalance.carried,
      },
    });
    return NextResponse.json({ summary }, { status: 201 });
  } catch (e) {
    if (e instanceof SeasonRolloverError) {
      return NextResponse.json({ error: e.message, code: e.code, ...(e.details ?? {}) }, { status: e.status });
    }
    console.error('[club seasons POST] unexpected error:', e);
    return NextResponse.json({ error: 'Could not start the new season. Please try again.' }, { status: 500 });
  }
}, { route: ROUTE });

/**
 * PATCH — `{ action: 'close', seasonId? }` or `{ action: 'reopen' }`.
 *
 * ⚠ NOTHING IS CREATED, MOVED OR DELETED: both are a status flip on one row, and EVERY CONDITION IS
 * RE-ASSERTED IN THE WHERE (copied from the portal's PATCH) — two admins, or an admin and a
 * rollover, can act within the same second, and a flip decided from a row read a moment ago would
 * close a season a roll has already closed. A losing race changes nothing and says so.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ teamId: string }> },) => {
  const { teamId } = await params;
  const resolved = await resolveClubTeam(req, teamId, { write: true });
  if ('error' in resolved) return resolved.error;
  const { ctx, team } = resolved;

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  if (action !== 'close' && action !== 'reopen') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }

  try {
    if (action === 'close') {
      // Close may name WHICH open season (the way out of the two-open-seasons state); else the live one.
      let target: RepProgramYear | null;
      if (typeof body.seasonId === 'string' && body.seasonId) {
        const seasons = await getRepProgramYears(team.id);
        target = seasons.find(s => s.id === body.seasonId && isLiveSeasonStatus(s.status)) ?? null;
        if (!target) {
          return NextResponse.json(
            { error: 'That season is not open, so there is nothing to close.', code: 'season_not_open' },
            { status: 409 },
          );
        }
      } else {
        // ⚠ Never GUESS between two open seasons (review 2026-09-28): the newest-created one is
        // usually the stray draft, not the season being played — closing it silently would be the
        // opposite of what the admin meant. With more than one open, the caller must name it.
        const open = (await getRepProgramYears(team.id)).filter(s => isLiveSeasonStatus(s.status));
        if (open.length > 1) {
          return NextResponse.json(
            {
              error: `${openSeasonsSentence(team.name, open)} Choose which one to close.`,
              code: 'choose_season',
              openSeasons: open.map(seasonShape),
            },
            { status: 409 },
          );
        }
        target = open[0] ?? null;
        if (!target) {
          return NextResponse.json(
            { error: `${team.name} has no season running, so there is nothing to close.`, code: 'no_live_season' },
            { status: 409 },
          );
        }
      }
      const closed = await closeOpenSeason(team.id, target.id);
      if (!closed) {
        return NextResponse.json(
          { error: 'This season has already finished — refresh to see where the team is now.', code: 'already_closed' },
          { status: 409 },
        );
      }
      await tellClubTeamStaff({ org: ctx.org, team, actorUserId: ctx.user.id, action: 'closed', seasonName: closed.name });
      return NextResponse.json({ season: closed, action: 'close' });
    }

    // REOPEN — the safe half only (plan §3.4); the shared function re-seats the current staff.
    const outcome = await reopenLatestClosedSeason(team.id, ctx.org.id);
    if (!outcome.ok) {
      if (outcome.reason === 'live_season_exists') {
        return NextResponse.json(
          {
            error: `The ${outcome.liveSeasonName} has already started, so the season before it cannot be reopened. `
              + 'Contact support if you need last season back.',
            code: 'live_season_exists',
          },
          { status: 409 },
        );
      }
      return NextResponse.json(
        outcome.reason === 'nothing_to_reopen'
          ? { error: 'There is no closed season to reopen.', code: 'nothing_to_reopen' }
          : { error: 'This season is no longer closed — refresh to see where the team is now.', code: 'no_longer_closed' },
        { status: 409 },
      );
    }
    await tellClubTeamStaff({ org: ctx.org, team, actorUserId: ctx.user.id, action: 'reopened', seasonName: outcome.season.name });
    return NextResponse.json({ season: outcome.season, action: 'reopen' });
  } catch (e) {
    console.error(`[club seasons PATCH ${action}] failed:`, e);
    return NextResponse.json(
      { error: action === 'close' ? 'Could not close the season. Please try again.' : 'Could not reopen the season. Please try again.' },
      { status: 500 },
    );
  }
}, { route: ROUTE });
