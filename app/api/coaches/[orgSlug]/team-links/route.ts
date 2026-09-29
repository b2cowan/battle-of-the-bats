import { NextResponse } from 'next/server';
import { getAuthContext, forbidden, unauthorized } from '@/lib/api-auth';
import {
  getTeamScopedRepTeamAccess,
  getTeamWorkspaceForOrg,
  isTeamWorkspaceOrg,
} from '@/lib/team-workspace-entitlements';
import { listTeamOrgLinksForWorkspace } from '@/lib/team-org-links';
import {
  approveTeamMove,
  askClubToTakeTeam,
  declineTeamMove,
  withdrawTeamMove,
} from '@/lib/team-ownership-transfer';
import { REFUSAL } from '@/lib/team-move-words';
import { getActiveTeamMembership } from '@/lib/coach-membership';
import { denyUnless } from '@/lib/coach-capabilities';
import { withObservability } from '@/lib/observability';

/**
 * Portal › Join a club — the coach's side of a TEAM MOVE (Club Tier Stage 2, B04 / Ask 2). The
 * coach asks a club, or answers a club's request; the second yes MOVES THE TEAM (no FieldLogicHQ
 * step). The Basic visibility link is retired (B12). Writes live in `lib/team-ownership-transfer.ts`.
 */
type RouteParams = {
  params: Promise<{ orgSlug: string }>;
};

async function resolveTeamCoachContext(orgSlug: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };
  if (!isTeamWorkspaceOrg(ctx.org)) return { error: forbidden() };

  const workspace = await getTeamWorkspaceForOrg(ctx.org.id);
  if (!workspace) {
    return {
      error: NextResponse.json({ error: 'Team workspace not found.' }, { status: 404 }),
    };
  }

  const access = await getTeamScopedRepTeamAccess({
    orgId: ctx.org.id,
    repTeamId: workspace.repTeamId,
    userId: ctx.user.id,
    requireCoach: true,
  });
  if (!access.allowed) return { error: forbidden() };

  // Moving the team into a club is a franchise-boundary act — head-coach only. ⚠ Read from the
  // TEAM MEMBERSHIP (Club Tier Stage 2, B10): the live-season assignment this read denied a head
  // coach between seasons — exactly when a coach decides to bring their team into a club.
  const membership = await getActiveTeamMembership(ctx.org.id, workspace.repTeamId, ctx.user.id);
  const isHeadCoach = membership?.coachRole === 'head_coach';

  return { ctx, workspace, isHeadCoach };
}

const HEAD_COACH_ONLY = 'Only the head coach can bring the team into a club.';

export const GET = withObservability(async (_req: Request, { params }: RouteParams) => {
  const { orgSlug } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug);
  if ('error' in resolved) return resolved.error!;
  // The list is the head coach's too — `resolveTeamCoachContext` computed `isHeadCoach` and this
  // read never consulted it, so any assistant could enumerate the workspace's organization links
  // while only the head coach could act on them (staff access review, 2026-09-10).
  const readDenied = denyUnless(resolved.isHeadCoach, HEAD_COACH_ONLY);
  if (readDenied) return readDenied;

  const links = await listTeamOrgLinksForWorkspace(resolved.workspace.id);
  return NextResponse.json({ links });
}, { route: '/api/coaches/[orgSlug]/team-links' });

/** Ask a club (by its web address or contact email) to bring the team in. */
export const POST = withObservability(async (req: Request, { params }: RouteParams) => {
  const { orgSlug } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug);
  if ('error' in resolved) return resolved.error!;
  const linkDenied = denyUnless(resolved.isHeadCoach, HEAD_COACH_ONLY);
  if (linkDenied) return linkDenied;

  let body: { target?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const target = typeof body.target === 'string' ? body.target.trim() : '';
  if (!target) {
    return NextResponse.json({ error: 'Enter the club’s web address or contact email.' }, { status: 400 });
  }

  const result = await askClubToTakeTeam({
    workspace: resolved.workspace,
    target,
    actorUserId: resolved.ctx.user.id,
    actorEmail: resolved.ctx.user.email ?? null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code ?? null }, { status: result.status });
  }
  return NextResponse.json({ link: result.link, reusedExisting: result.reusedExisting }, { status: result.reusedExisting ? 200 : 201 });
}, { route: '/api/coaches/[orgSlug]/team-links' });

/** Answer a club's request (approve — which moves the team — or decline), or withdraw your own. */
export const PATCH = withObservability(async (req: Request, { params }: RouteParams) => {
  const { orgSlug } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug);
  if ('error' in resolved) return resolved.error!;
  const linkDenied = denyUnless(resolved.isHeadCoach, HEAD_COACH_ONLY);
  if (linkDenied) return linkDenied;

  let body: { linkId?: unknown; action?: unknown; confirmTeamName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const linkId = typeof body.linkId === 'string' ? body.linkId.trim() : '';
  const action = typeof body.action === 'string' ? body.action : '';

  // Retired: the Basic visibility link's accept/decline and request-then-transfer steps (B12), and
  // the per-team billing takeover (Club Repackaging, 2026-06-22). Old rows stay as history.
  if ([
    'accept', 'request_ownership', 'accept_ownership', 'decline_ownership',
    'request_billing', 'accept_billing', 'decline_billing',
  ].includes(action)) {
    return NextResponse.json({ error: REFUSAL.retired, code: 'retired' }, { status: 410 });
  }

  if (!linkId || !action) {
    return NextResponse.json({ error: 'linkId and action are required.' }, { status: 400 });
  }
  const scope = { side: 'coach' as const, workspaceId: resolved.workspace.id };
  const actor = { actorUserId: resolved.ctx.user.id, actorEmail: resolved.ctx.user.email ?? null };

  if (action === 'approve') {
    const confirmTeamName = typeof body.confirmTeamName === 'string' ? body.confirmTeamName : '';
    const result = await approveTeamMove({ scope, linkId, confirmTeamName, ...actor });
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code ?? null }, { status: result.status });
    return NextResponse.json({ moved: result.moved });
  }
  if (action === 'decline' || action === 'withdraw') {
    const run = action === 'decline' ? declineTeamMove : withdrawTeamMove;
    const result = await run({ scope, linkId, ...actor });
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code ?? null }, { status: result.status });
    return NextResponse.json({ link: result.link });
  }

  return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
}, { route: '/api/coaches/[orgSlug]/team-links' });
