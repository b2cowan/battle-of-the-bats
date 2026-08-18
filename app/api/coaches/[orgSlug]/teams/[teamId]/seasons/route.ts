import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getRepTeam, getActiveRepProgramYear, getLatestClosedRepProgramYear } from '@/lib/db';
import {
  getEntitledTeamMembership,
  resolveMembershipCapabilities,
  resolveWorkingProgramYear,
} from '@/lib/coach-membership';
import { canViewMoney } from '@/lib/coach-capabilities';
import { loadSeasonSettlement } from '@/lib/coach-season-settlement';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { startNextRepSeason, SeasonRolloverError } from '@/lib/rep-season-rollover';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import type { Organization } from '@/lib/types';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  // M1 (2026-08-16): standing to roll a season is TEAM MEMBERSHIP — one gate for the mid-season
  // and the between-seasons ("stranded") states alike. The old two-branch dance (live assignment,
  // else a closed assignment on exactly the latest closed year) existed because standing itself
  // was per-season; membership answers both of its hardening checks for free — former staff hold
  // no membership, and a coach from a bygone year holds no membership either.
  // All three lookups are independent — one round trip. The roll runs FROM the live season when
  // there is one, else from the newest closed one (the Season's End recovery state — that CTA is
  // the whole way forward on that screen).
  const [team, membership, programYear] = await Promise.all([
    getRepTeam(teamId),
    getEntitledTeamMembership(ctx.org, teamId, ctx.user.id),
    resolveWorkingProgramYear(teamId),
  ]);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  if (!membership) return { error: forbidden() };
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No program year found for this team' }, { status: 404 }) };
  }

  return {
    ctx,
    team,
    assignment: { coachRole: membership.coachRole },
    capabilities: resolveMembershipCapabilities(membership),
    programYear,
  };
}

/**
 * ⚠ **WHO MAY END A SEASON — ONE ANSWER, THREE DOORS.** Starting the next season, closing this one
 * and reopening a closed one are the same power wearing three labels, so they resolve through one
 * predicate rather than three hand-copied conjunctions. A club-owned team gets none of them: its
 * club manages seasons, and the screens say so in their own words.
 */
function mayManageSeasons(
  org: Pick<Organization, 'accountKind' | 'planId' | 'teamWorkspaceStatus'>,
  coachRole: 'head_coach' | 'assistant_coach',
): boolean {
  const isStandalone =
    isTeamWorkspaceOrg(org) &&
    org.teamWorkspaceStatus !== 'org_owned' &&
    org.teamWorkspaceStatus !== 'archived';
  return isStandalone && coachRole === 'head_coach';
}

const NOT_YOURS_TO_MANAGE = {
  error: 'Only the head coach of a standalone Premium team can manage seasons. For org-owned teams, '
    + 'your club admin manages seasons.',
};

/**
 * GET — what the "Close the season" dialog needs to warn with, and whether reopening is on offer.
 *
 * ⚠ **IT WARNS; IT NEVER DECIDES** (owner ruling 2026-08-18). `closeOutBlockers` next door answers
 * a different question — may the team pay its settlement out — and BLOCKS on the answer. This one
 * names the same two facts and returns nothing that could refuse a close: the coach may settle in
 * cash, forgive the balance, or simply know something the product cannot see. A gate here would
 * make the product the arbiter of a real-world debt.
 *
 * ⚠ The money figures are MONEY-GATED and simply absent otherwise, rather than zeroed. An assistant
 * without the books reading "0 families still owe" would be a confident wrong answer; saying
 * nothing is the honest shape, and the same posture the money shelf on Season's End takes.
 */
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, programYear, assignment, capabilities } = resolved;

  if (!mayManageSeasons(ctx.org, assignment.coachRole)) {
    return NextResponse.json(NOT_YOURS_TO_MANAGE, { status: 403 });
  }

  const isLive = programYear.status === 'draft' || programYear.status === 'active';
  /**
   * ⚠ Reopening is offered ONLY when the team holds no live season — the safe half (plan §3.4).
   * With a newer season started, giving the old one back would mean deleting the new one, which is
   * logged as deliberately unbuilt. Resolved here rather than inferred on the client from "is the
   * page showing a closed season?", which is a different question the moment a coach opens an
   * OLDER year from the compare list.
   */
  const canReopen = !isLive && programYear.status === 'completed';

  let money: { familiesOwing: number; duesOutstanding: number; waitingToReturn: number } | null = null;
  if (isLive && canViewMoney(capabilities)) {
    try {
      const sheet = await loadSeasonSettlement({ programYear, capabilities });
      const owingFamilies = new Set(
        sheet.rows.filter(r => r.leftToSend > 0.005).map(r => r.familyKey),
      );
      money = {
        familiesOwing: owingFamilies.size,
        duesOutstanding: sheet.pot.expectedIn > 0.005 ? sheet.pot.expectedIn : 0,
        waitingToReturn: sheet.totals.payable > 0.005 ? sheet.totals.payable : 0,
      };
    } catch (e) {
      /* ⚠ QUIET. A settlement read that failed must not stop a coach ending their season — the
         dialog then warns about nothing, which is exactly what it does for a team with no money
         recorded at all. Blocking the door on a secondary read is the failure mode the shelves on
         Season's End are written to avoid. */
      console.error('[seasons GET] settlement preflight failed:', e);
    }
  }

  return NextResponse.json({
    season: {
      id: programYear.id,
      name: programYear.name,
      year: programYear.year,
      status: programYear.status,
      isLive,
    },
    canReopen,
    money,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/seasons' });

/**
 * PATCH — close the season, or reopen the one just closed.
 *
 * ⚠ **NOTHING IS CREATED, MOVED OR DELETED.** Both actions are a status flip on one row. That is
 * what makes closing a low-stakes decision and reopening a genuine undo (plan §3.1, §3.4).
 *
 * ⚠ **EVERY CONDITION IS RE-ASSERTED IN THE WHERE**, not merely checked above it. Two coaches on
 * one team, or one coach on two tabs, can close and roll forward within the same second — and a
 * status flip decided from a row read a moment ago would close the season the rollover had already
 * closed, or reopen a season the rollover has just superseded. The update matches on the team AND
 * the status it expects, so a losing race changes nothing and says so.
 */
export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment } = resolved;

  if (!mayManageSeasons(ctx.org, assignment.coachRole)) {
    return NextResponse.json(NOT_YOURS_TO_MANAGE, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  if (action !== 'close' && action !== 'reopen') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }

  if (action === 'close') {
    /**
     * ⚠ The LIVE season, resolved fresh — never `programYear` above, which falls back to the newest
     * finished one for a team between seasons. Closing a season that has already ended is a no-op
     * dressed as an action.
     */
    const live = await getActiveRepProgramYear(teamId);
    if (!live) {
      return NextResponse.json(
        { error: 'This team has no season running, so there is nothing to close.' },
        { status: 409 },
      );
    }
    const { data, error } = await supabaseAdmin
      .from('rep_program_years')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', live.id)
      .eq('team_id', teamId)
      .in('status', ['draft', 'active'])
      .select('id, name, year')
      .maybeSingle();
    if (error) {
      console.error('[seasons PATCH close] failed:', error);
      return NextResponse.json({ error: 'Could not close the season. Please try again.' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: 'This season has already finished — refresh to see where the team is now.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ season: data, action: 'close' });
  }

  /**
   * REOPEN — the safe half only. Refused the moment the team holds a live season, because giving
   * the old one back would then mean deleting the new one (plan §3.4, logged and not built).
   */
  const live = await getActiveRepProgramYear(teamId);
  if (live) {
    return NextResponse.json(
      {
        error: `${live.name} has already started, so the season before it cannot be reopened here. `
          + 'Ask support if you need last season back.',
        code: 'live_season_exists',
      },
      { status: 409 },
    );
  }
  const closed = await getLatestClosedRepProgramYear(teamId);
  if (!closed || closed.status !== 'completed') {
    return NextResponse.json({ error: 'There is no closed season to reopen.' }, { status: 409 });
  }
  const { data, error } = await supabaseAdmin
    .from('rep_program_years')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', closed.id)
    .eq('team_id', teamId)
    .eq('status', 'completed')
    .select('id, name, year')
    .maybeSingle();
  if (error) {
    console.error('[seasons PATCH reopen] failed:', error);
    return NextResponse.json({ error: 'Could not reopen the season. Please try again.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: 'This season is no longer closed — refresh to see where the team is now.' },
      { status: 409 },
    );
  }
  return NextResponse.json({ season: data, action: 'reopen' });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/seasons' });

// POST /api/coaches/[orgSlug]/teams/[teamId]/seasons — coach starts the team's next season
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, programYear, assignment } = resolved;

  // Scope: standalone Team workspace (not org-owned/adopted) + head coach only — the SAME
  // predicate closing and reopening ask, so the three doors can never disagree about who holds
  // this power.
  if (!mayManageSeasons(ctx.org, assignment.coachRole)) {
    return NextResponse.json(NOT_YOURS_TO_MANAGE, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const yearNum = Number(body.year);
  if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > 2100) {
    return NextResponse.json({ error: 'A valid four-digit season year is required.' }, { status: 400 });
  }
  if (yearNum <= programYear.year) {
    return NextResponse.json({ error: 'The new season year must be later than the current season.' }, { status: 400 });
  }
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : `${yearNum} Season`;
  if (name.length > 100) {
    return NextResponse.json({ error: 'Season name must be 100 characters or fewer.' }, { status: 400 });
  }
  const carryBudget = body.carryBudget !== false; // default on
  const carryFees = body.carryFees !== false; // default on

  // Resolve the workspace row so we can re-point its active-season pointer (hygiene).
  const { data: workspace } = await supabaseAdmin
    .from('team_workspaces')
    .select('id')
    .eq('rep_team_id', teamId)
    .eq('workspace_org_id', ctx.org.id)
    .maybeSingle();

  try {
    const summary = await startNextRepSeason({
      orgId: ctx.org.id,
      teamId,
      workspaceId: (workspace?.id as string | undefined) ?? null,
      currentSeason: programYear,
      initiatorUserId: ctx.user.id,
      newName: name,
      newYear: yearNum,
      carryBudget,
      carryFees,
    });
    return NextResponse.json({ summary }, { status: 201 });
  } catch (e) {
    if (e instanceof SeasonRolloverError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    }
    console.error('[seasons POST] unexpected error:', e);
    return NextResponse.json({ error: 'Could not start the new season. Please try again.' }, { status: 500 });
  }
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/seasons' });
