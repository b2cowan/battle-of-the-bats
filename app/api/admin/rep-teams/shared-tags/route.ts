import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getOrgSharedTags, createOrgSharedTag } from '@/lib/db';
import { withObservability } from '@/lib/observability';
import type { RepTagKind } from '@/lib/types';

// Org-authored shared tag library (Coach Tags & Player Awards, Phase 3). The org owner/admin curates
// game + money tags that every team can use. Shared tags are stored with team_id NULL (org_id set).
// Admin surface — gated on the rep-teams module + owner/admin role (a capability alone isn't enough
// for a write, mirroring the groups route).

const MAX_SHARED_TAGS_PER_KIND = 50;

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

function parseKind(raw: string | null): RepTagKind | null {
  return raw === 'game' || raw === 'expense' ? raw : null;
}

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const kind = parseKind(url.searchParams.get('kind'));
  if (!kind) return NextResponse.json({ error: 'kind must be "game" or "expense"' }, { status: 400 });

  const tags = await getOrgSharedTags(ctx!.org.id, kind);
  return NextResponse.json({ tags });
}, { route: '/api/admin/rep-teams/shared-tags' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const body = await req.json().catch(() => ({}));
  const kind = parseKind(typeof body.kind === 'string' ? body.kind : null);
  if (!kind) return NextResponse.json({ error: 'kind must be "game" or "expense"' }, { status: 400 });
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 40) {
    return NextResponse.json({ error: 'Tag name must be 1–40 characters' }, { status: 400 });
  }

  const existing = await getOrgSharedTags(ctx!.org.id, kind);
  if (existing.length >= MAX_SHARED_TAGS_PER_KIND) {
    return NextResponse.json(
      { error: `You can keep up to ${MAX_SHARED_TAGS_PER_KIND} shared ${kind === 'game' ? 'game' : 'money'} tags. Delete or merge one to add another.` },
      { status: 400 },
    );
  }

  try {
    const tag = await createOrgSharedTag({ orgId: ctx!.org.id, kind, name, createdBy: ctx!.user.id });
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: `A shared tag named “${name}” already exists` }, { status: 409 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not save tag' },
      { status: 400 },
    );
  }
}, { route: '/api/admin/rep-teams/shared-tags' });
