import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import {
  getActiveTeamEntitlementsForOrg,
  isTeamWorkspaceOrg,
  shouldShowClubValueNudge,
} from '@/lib/team-workspace-entitlements';
import {
  createTeamOrgLinkInvite,
  listTeamOrgLinksForLinkedOrg,
  reviewTeamOrgLink,
} from '@/lib/team-org-links';
import {
  declineOrgTeamAddonBillingRequest,
  inviteOrgTeamAddonBilling,
  startOrgTeamAddonCheckout,
} from '@/lib/team-org-billing';
import {
  declineTeamOwnershipTransferRequest,
  inviteTeamOwnershipTransfer,
} from '@/lib/team-ownership-transfer';

export async function GET(req: NextRequest) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();
  if (isTeamWorkspaceOrg(ctx.org)) return forbidden();

  const [links, entitlements] = await Promise.all([
    listTeamOrgLinksForLinkedOrg(ctx.org.id),
    getActiveTeamEntitlementsForOrg(ctx.org.id),
  ]);
  const activeOrgPaidTeamCount = new Set(
    entitlements
      .filter(entitlement => entitlement.source === 'org_team_addon')
      .map(entitlement => entitlement.repTeamId),
  ).size;

  return NextResponse.json({
    links,
    billingSummary: {
      activeOrgPaidTeamCount,
      clubValueThreshold: 3,
      showClubValueNudge: shouldShowClubValueNudge(activeOrgPaidTeamCount),
    },
  });
}

export async function POST(req: NextRequest) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug });
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

  if (action === 'invite_billing') {
    const result = await inviteOrgTeamAddonBilling({
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

  if (action === 'decline_billing') {
    const result = await declineOrgTeamAddonBillingRequest({
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

  if (action === 'approve_billing') {
    const result = await startOrgTeamAddonCheckout({
      org: ctx.org,
      linkId,
      billingCycle: body.billingCycle,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      link: result.link,
      applied: result.applied ?? false,
      url: result.url ?? null,
      billingCycle: result.billingCycle ?? null,
    });
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
}
