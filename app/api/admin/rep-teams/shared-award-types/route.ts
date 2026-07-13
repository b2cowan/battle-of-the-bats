import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getOrgSharedAwardTypes, createOrgSharedAwardType } from '@/lib/db';
import { withObservability } from '@/lib/observability';

// Org-authored shared award types (Phase 3) — a league can standardize MVP / Hustle / etc. across all
// teams. Stored with team_id NULL (org_id set). Retire (not delete) preserves any awards given with a
// shared type; the coach picker offers active shared types alongside the team's own.

const MAX_SHARED_AWARD_TYPES = 30;

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  // Include retired so the admin manager can show + restore them.
  const awardTypes = await getOrgSharedAwardTypes(ctx!.org.id, { includeRetired: true });
  return NextResponse.json({ awardTypes });
}, { route: '/api/admin/rep-teams/shared-award-types' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: 'Award name must be 1–40 characters' }, { status: 400 });
  }
  const emoji = typeof body.emoji === 'string' ? body.emoji.trim().slice(0, 8) : null;

  const existing = await getOrgSharedAwardTypes(ctx!.org.id, { includeRetired: true });
  if (existing.filter(t => t.isActive).length >= MAX_SHARED_AWARD_TYPES) {
    return NextResponse.json(
      { error: `You can keep up to ${MAX_SHARED_AWARD_TYPES} shared award types. Retire one to add another.` },
      { status: 400 },
    );
  }

  try {
    const awardType = await createOrgSharedAwardType({ orgId: ctx!.org.id, name, emoji: emoji || null, createdBy: ctx!.user.id });
    return NextResponse.json({ awardType }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `A shared award named “${name}” already exists` }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save award type' },
      { status: 400 },
    );
  }
}, { route: '/api/admin/rep-teams/shared-award-types' });
