import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { updateOrgSharedAwardType } from '@/lib/db';
import { withObservability } from '@/lib/observability';

// Single PATCH covers rename / icon / retire / restore for a shared award type — no delete (retire
// only, so history keeps resolving the type's name/emoji).
function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();
  return null;
}

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ typeId: string }> },) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  const { typeId } = await params;

  const body = await req.json().catch(() => ({}));
  const fields: { name?: string; emoji?: string | null; isActive?: boolean } = {};
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 1 || name.length > 40) {
      return NextResponse.json({ error: 'Award name must be 1–40 characters' }, { status: 400 });
    }
    fields.name = name;
  }
  if (body.emoji !== undefined) {
    fields.emoji = typeof body.emoji === 'string' ? body.emoji.trim().slice(0, 8) || null : null;
  }
  if (body.isActive !== undefined) {
    fields.isActive = !!body.isActive;
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  try {
    const updated = await updateOrgSharedAwardType(typeId, ctx!.org.id, fields);
    if (!updated) return NextResponse.json({ error: 'Shared award type not found' }, { status: 404 });
    return NextResponse.json({ awardType: updated });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'A shared award with that name already exists' }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not update award type' },
      { status: 400 },
    );
  }
}, { route: '/api/admin/rep-teams/shared-award-types/[typeId]' });
