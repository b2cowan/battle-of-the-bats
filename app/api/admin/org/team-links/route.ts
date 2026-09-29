import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { listTeamOrgLinksForLinkedOrg } from '@/lib/team-org-links';
import {
  approveTeamMove,
  askCoachToBringTeam,
  clubTeamPlaces,
  declineTeamMove,
  withdrawTeamMove,
  type TeamMoveRefusal,
} from '@/lib/team-ownership-transfer';
import { teamLimitRefusal } from '@/lib/team-cap';
import { REFUSAL } from '@/lib/team-move-words';
import { PLAN_CONFIG } from '@/lib/plan-config';
import { withObservability } from '@/lib/observability';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { hasCapability } from '@/lib/roles';
import type { OrgPlan } from '@/lib/types';

/**
 * Rep Teams › Bring in a coach's team — the club's side of a TEAM MOVE (Club Tier Stage 2, B04 /
 * Ask 2, specimen 9). A request is the only thing a club and a coach agree to: the Basic visibility
 * link is retired (B12), and the club's yes on a coach's request MOVES THE TEAM (no FieldLogicHQ
 * step). The writes and their rules live in `lib/team-ownership-transfer.ts`.
 *
 * Who: the club's owner or admin, holding Rep Teams — the people who add a team (session 1's rule
 * for every club team write; the treasurer never). Before 2026-09-29 only the owner could answer a
 * transfer; bringing a team in is adding a team, and the team place is checked like one.
 */
async function resolveClub(req: NextRequest) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return { error: forbidden() };
  if (isTeamWorkspaceOrg(ctx.org)) return { error: forbidden() };
  // Bringing a coach's portal into the club is a Rep Teams act (Club Tier Stage 2, B12): the plan must
  // carry Rep Teams and the member must hold it — a League or Tournament Plus org could link before.
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams') || !hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) {
    return { error: forbidden() };
  }
  return { ctx };
}

/** A refusal as a response — the team-cap one in the shape the club's team-cap window reads. */
function refusalResponse(result: TeamMoveRefusal): NextResponse {
  if (result.code === 'team_limit_reached' && result.cap) {
    return teamLimitRefusal(result.cap.planId, result.cap.teamLimit, result.cap.activeTeams);
  }
  return NextResponse.json({ error: result.error, code: result.code ?? null }, { status: result.status });
}

export const GET = withObservability(async (req: NextRequest) => {
  const resolved = await resolveClub(req);
  if ('error' in resolved) return resolved.error!;
  const { ctx } = resolved;

  const [links, places] = await Promise.all([
    listTeamOrgLinksForLinkedOrg(ctx.org.id),
    clubTeamPlaces({ id: ctx.org.id, plan_id: ctx.org.planId ?? null, team_limit: ctx.org.teamLimit ?? null }),
  ]);
  return NextResponse.json({
    links,
    // "What it costs the club": a team place, never a price (Club Repackaging — Premium for club
    // teams is included up to the plan cap).
    teamPlaces: { used: places.used, limit: places.limit },
    planLabel: PLAN_CONFIG[places.planId as OrgPlan]?.label ?? 'Club',
  });
}, { route: '/api/admin/org/team-links' });

export const POST = withObservability(async (req: NextRequest) => {
  const resolved = await resolveClub(req);
  if ('error' in resolved) return resolved.error!;
  const { ctx } = resolved;

  let body: { coachEmail?: unknown; linkId?: unknown; action?: unknown; confirmTeamName?: unknown; target?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const actor = { actorUserId: ctx.user.id, actorEmail: ctx.user.email ?? null };

  const coachEmail = typeof body.coachEmail === 'string' ? body.coachEmail.trim() : '';
  if (coachEmail) {
    const result = await askCoachToBringTeam({ clubOrgId: ctx.org.id, coachEmail, ...actor });
    if (!result.ok) return refusalResponse(result);
    return NextResponse.json(
      { link: result.link, reusedExisting: result.reusedExisting },
      { status: result.reusedExisting ? 200 : 201 },
    );
  }

  const linkId = typeof body.linkId === 'string' ? body.linkId.trim() : '';
  const action = typeof body.action === 'string' ? body.action : '';

  // Retired: the Basic visibility link (`target` invites, approve/decline of a link request — B12)
  // and the per-team billing takeover (Club Repackaging, 2026-06-22). Old rows stay as history.
  if (
    typeof body.target === 'string'
    || ['invite_billing', 'decline_billing', 'approve_billing', 'invite_ownership', 'decline_ownership'].includes(action)
  ) {
    return NextResponse.json({ error: REFUSAL.retired, code: 'retired' }, { status: 410 });
  }

  if (!linkId || !action) {
    return NextResponse.json({ error: 'linkId and action are required.' }, { status: 400 });
  }
  const scope = { side: 'club' as const, clubOrgId: ctx.org.id };

  if (action === 'approve') {
    const confirmTeamName = typeof body.confirmTeamName === 'string' ? body.confirmTeamName : '';
    const result = await approveTeamMove({ scope, linkId, confirmTeamName, ...actor });
    if (!result.ok) return refusalResponse(result);
    return NextResponse.json({ moved: result.moved });
  }
  if (action === 'decline') {
    const result = await declineTeamMove({ scope, linkId, ...actor });
    if (!result.ok) return refusalResponse(result);
    return NextResponse.json({ link: result.link });
  }
  if (action === 'withdraw') {
    const result = await withdrawTeamMove({ scope, linkId, ...actor });
    if (!result.ok) return refusalResponse(result);
    return NextResponse.json({ link: result.link });
  }

  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}, { route: '/api/admin/org/team-links' });
