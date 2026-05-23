import { NextRequest, NextResponse } from 'next/server';
import { forbidden, getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import {
  createTeamOrgLinkInvite,
  listTeamOrgLinksForLinkedOrg,
  reviewTeamOrgLink,
} from '@/lib/team-org-links';

export async function GET(req: NextRequest) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();
  if (isTeamWorkspaceOrg(ctx.org)) return forbidden();

  const links = await listTeamOrgLinksForLinkedOrg(ctx.org.id);
  return NextResponse.json({ links });
}

export async function POST(req: NextRequest) {
  const orgSlug = req.nextUrl.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug });
  if (!ctx) return unauthorized();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();
  if (isTeamWorkspaceOrg(ctx.org)) return forbidden();

  let body: { linkId?: unknown; action?: unknown; target?: unknown };
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
  const action = body.action === 'approve' || body.action === 'decline' ? body.action : null;

  if (!linkId || !action) {
    return NextResponse.json({ error: 'linkId and action are required.' }, { status: 400 });
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
