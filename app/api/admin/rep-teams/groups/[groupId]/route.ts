import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { updateRepTeamGroup, deleteRepTeamGroup } from '@/lib/db';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();
  return null;
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ groupId: string }> },) => {
  const { groupId } = await params;
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const body = await req.json().catch(() => ({}));
  const fields: { name?: string; displayOrder?: number } = {};
  if (typeof body.name === 'string') fields.name = body.name.trim();
  if (typeof body.displayOrder === 'number') fields.displayOrder = body.displayOrder;

  if (!fields.name && fields.displayOrder === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  if (fields.name !== undefined && (!fields.name || fields.name.length > 50)) {
    return NextResponse.json({ error: 'name must be 1–50 characters' }, { status: 400 });
  }

  try {
    const group = await updateRepTeamGroup(groupId, fields);
    return NextResponse.json({ group });
  } catch (e: any) {
    if (e?.code === '23505') {
      return NextResponse.json({ error: 'A group with that name already exists' }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/admin/rep-teams/groups/[groupId]' });

export const DELETE = withObservability(async (_req: Request,
  { params }: { params: Promise<{ groupId: string }> },) => {
  const { groupId } = await params;
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  try {
    await deleteRepTeamGroup(groupId);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === 'GROUP_HAS_TEAMS') {
      return NextResponse.json({ error: 'Reassign all teams from this group before deleting it' }, { status: 409 });
    }
    throw e;
  }
}, { route: '/api/admin/rep-teams/groups/[groupId]' });
