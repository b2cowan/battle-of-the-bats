import { NextResponse } from 'next/server';
import { getAuthContext, forbidden, unauthorized } from '@/lib/api-auth';
import {
  getTeamScopedRepTeamAccess,
  getTeamWorkspaceForOrg,
  isTeamWorkspaceOrg,
} from '@/lib/team-workspace-entitlements';
import {
  createTeamOrgLinkRequest,
  listTeamOrgLinksForWorkspace,
  respondToTeamOrgLinkInvitation,
} from '@/lib/team-org-links';
import {
  requestOrgTeamAddonBilling,
  respondToOrgTeamAddonBillingInvite,
} from '@/lib/team-org-billing';
import {
  requestTeamOwnershipTransfer,
  respondToTeamOwnershipTransferInvite,
} from '@/lib/team-ownership-transfer';

type RouteParams = {
  params: Promise<{ orgSlug: string }>;
};

async function resolveTeamCoachContext(orgSlug: string) {
  const ctx = await getAuthContext({ orgSlug });
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

  return { ctx, workspace };
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { orgSlug } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug);
  if ('error' in resolved) return resolved.error;

  const links = await listTeamOrgLinksForWorkspace(resolved.workspace.id);
  return NextResponse.json({ links });
}

export async function POST(req: Request, { params }: RouteParams) {
  const { orgSlug } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug);
  if ('error' in resolved) return resolved.error;

  let body: { target?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const targetInput = typeof body.target === 'string' ? body.target.trim() : '';
  if (!targetInput) {
    return NextResponse.json({ error: 'Enter the parent organization slug or contact email.' }, { status: 400 });
  }

  const result = await createTeamOrgLinkRequest({
    workspace: resolved.workspace,
    targetInput,
    requestedByUserId: resolved.ctx.user.id,
    requestedByEmail: resolved.ctx.user.email ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ link: result.link, reusedExisting: result.reusedExisting }, { status: result.reusedExisting ? 200 : 201 });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const { orgSlug } = await params;
  const resolved = await resolveTeamCoachContext(orgSlug);
  if ('error' in resolved) return resolved.error;

  let body: { linkId?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const linkId = typeof body.linkId === 'string' ? body.linkId.trim() : '';
  const action = typeof body.action === 'string' ? body.action : '';

  if (!linkId || !action) {
    return NextResponse.json({ error: 'linkId and action are required.' }, { status: 400 });
  }

  if (action === 'request_billing') {
    const result = await requestOrgTeamAddonBilling({
      workspace: resolved.workspace,
      linkId,
      actorUserId: resolved.ctx.user.id,
      actorEmail: resolved.ctx.user.email ?? null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ link: result.link });
  }

  if (action === 'accept_billing' || action === 'decline_billing') {
    const result = await respondToOrgTeamAddonBillingInvite({
      workspace: resolved.workspace,
      linkId,
      action: action === 'accept_billing' ? 'accept' : 'decline',
      actorUserId: resolved.ctx.user.id,
      actorEmail: resolved.ctx.user.email ?? null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ link: result.link });
  }

  if (action === 'request_ownership') {
    const result = await requestTeamOwnershipTransfer({
      workspace: resolved.workspace,
      linkId,
      actorUserId: resolved.ctx.user.id,
      actorEmail: resolved.ctx.user.email ?? null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ link: result.link });
  }

  if (action === 'accept_ownership' || action === 'decline_ownership') {
    const result = await respondToTeamOwnershipTransferInvite({
      workspace: resolved.workspace,
      linkId,
      action: action === 'accept_ownership' ? 'accept' : 'decline',
      actorUserId: resolved.ctx.user.id,
      actorEmail: resolved.ctx.user.email ?? null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ link: result.link });
  }

  if (action !== 'accept' && action !== 'decline') {
    return NextResponse.json({ error: 'Unsupported Team link action.' }, { status: 400 });
  }

  const result = await respondToTeamOrgLinkInvitation({
    workspace: resolved.workspace,
    linkId,
    action,
    actorUserId: resolved.ctx.user.id,
    actorEmail: resolved.ctx.user.email ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ link: result.link });
}
