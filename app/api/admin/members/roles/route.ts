import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, requireCapability } from '@/lib/api-auth';
import { assignableRolesForOrg } from '@/lib/board-roles';
import { roleOpensSentence } from '@/lib/member-access';
import { withObservability } from '@/lib/observability';

/**
 * GET /api/admin/members/roles — the roles this organization can hand out, for the invite and
 * Manage dropdowns (Stage 1 specimen 5): one grouped list, each with its two-word hint and the
 * sentence that says what it opens. The SAME list the invite and role-change routes accept
 * (lib/board-roles.ts), so the dropdown cannot offer a role the server refuses.
 *
 * Gated like the actions it feeds: only someone who can manage members.
 */
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  const denied = await requireCapability(ctx, 'manage_members');
  if (denied) return denied;

  const roles = await assignableRolesForOrg({ ...ctx.org, id: ctx.org.id });
  return NextResponse.json({
    roles: roles.map(r => ({ ...r, opens: roleOpensSentence(r.role) })),
  });
}, { route: '/api/admin/members/roles' });
