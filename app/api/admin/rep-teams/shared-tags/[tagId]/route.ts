import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { renameOrgSharedTag, deleteOrgSharedTag } from '@/lib/db';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();
  return null;
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ tagId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  const { tagId } = await params;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: 'Tag name must be 1–40 characters' }, { status: 400 });
  }

  try {
    const updated = await renameOrgSharedTag(tagId, ctx!.org.id, name);
    if (!updated) return NextResponse.json({ error: 'Shared tag not found' }, { status: 404 });
    return NextResponse.json({ tag: updated });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `A shared tag named “${name}” already exists` }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not rename tag' },
      { status: 400 },
    );
  }
}, { route: '/api/admin/rep-teams/shared-tags/[tagId]' });

export const DELETE = withObservability(async (req: Request,
  { params }: { params: Promise<{ tagId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  const { tagId } = await params;

  const deleted = await deleteOrgSharedTag(tagId, ctx!.org.id);
  if (!deleted) return NextResponse.json({ error: 'Shared tag not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/rep-teams/shared-tags/[tagId]' });
