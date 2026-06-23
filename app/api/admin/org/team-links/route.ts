import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import {
  createTeamOrgLinkInvite,
  listTeamOrgLinksForLinkedOrg,
  reviewTeamOrgLink,
} from '@/lib/team-org-links';
import {
  declineTeamOwnershipTransferRequest,
  inviteTeamOwnershipTransfer,
} from '@/lib/team-ownership-transfer';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (req: NextRequest) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();
  if (isTeamWorkspaceOrg(ctx.org)) return forbidden();

  // Club Repackaging (2026-06-22): the per-team "$19/team" org-paid summary + the
  // "upgrade to save" nudge are retired — Club includes the whole coaching staff up to
  // the plan cap. Linked Coaches Portals are visibility-only or transfer ownership in.
  const links = await listTeamOrgLinksForLinkedOrg(ctx.org.id);
  return NextResponse.json({ links });
}, { route: '/api/admin/org/team-links' });

export const POST = withObservability(async (req: NextRequest) => {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();
  if (isTeamWorkspaceOrg(ctx.org)) return forbidden();

  let body: { linkId?: unknown; action?: unknown; target?: unknown; billingCycle?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const targetInput = typeof body.target === 'string' ? body.target.trim() : '';
  if (targetInput) {
    const result = await createTeamOrgLinkInvite({
      orgId: ctx.org.id,
      targetInput,
      invitedByUserId: ctx.user.id,
      invitedByEmail: ctx.user.email ?? null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ link: result.link, reusedExisting: result.reusedExisting }, { status: result.reusedExisting ? 200 : 201 });
  }

  const linkId = typeof body.linkId === 'string' ? body.linkId.trim() : '';
  const action = typeof body.action === 'string' ? body.action : '';

  if (!linkId || !action) {
    return NextResponse.json({ error: 'linkId and action are required.' }, { status: 400 });
  }

  // Ownership actions are owner-reserved. (Club Repackaging 2026-06-22: the org-paid
  // "$19/team" billing-takeover actions — invite_billing / decline_billing / approve_billing —
  // are retired. Teams in a Club are included up to the plan cap; an external coach either
  // keeps a standalone portal or transfers ownership in.)
  if (action === 'invite_billing' || action === 'decline_billing' || action === 'approve_billing') {
    return NextResponse.json(
      { error: 'Org billing transfer has been retired. Teams in a Club are included up to the plan cap.' },
      { status: 410 },
    );
  }
  if (action === 'invite_ownership' && ctx.role !== 'owner') {
    return forbidden();
  }

  if (action === 'invite_ownership') {
    const result = await inviteTeamOwnershipTransfer({
      orgId: ctx.org.id,
      linkId,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ link: result.link });
  }

  if (action === 'decline_ownership') {
    const result = await declineTeamOwnershipTransferRequest({
      orgId: ctx.org.id,
      linkId,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ link: result.link });
  }

  if (action !== 'approve' && action !== 'decline') {
    return NextResponse.json({ error: 'Unsupported Team link action.' }, { status: 400 });
  }

  const result = await reviewTeamOrgLink({
    orgId: ctx.org.id,
    linkId,
    action,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ link: result.link });
}, { route: '/api/admin/org/team-links' });
