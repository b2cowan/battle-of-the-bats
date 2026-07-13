import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { mergeOrgSharedTags } from '@/lib/db';
import { withObservability } from '@/lib/observability';

// Merge two shared tags of the same org + kind (anti-drift curation for the org library) — atomic via
// the merge_rep_team_tags RPC, which re-points both event and expense links (migration 184).
function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  if (ctx.role !== 'owner' && ctx.role !== 'admin') return forbidden();
  return null;
}

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const body = await req.json().catch(() => ({}));
  const winnerTagId = typeof body.winnerTagId === 'string' ? body.winnerTagId : '';
  const loserTagId = typeof body.loserTagId === 'string' ? body.loserTagId : '';
  if (!winnerTagId || !loserTagId) {
    return NextResponse.json({ error: 'winnerTagId and loserTagId are required' }, { status: 400 });
  }
  if (winnerTagId === loserTagId) {
    return NextResponse.json({ error: 'Choose two different tags to merge' }, { status: 400 });
  }

  try {
    await mergeOrgSharedTags(winnerTagId, loserTagId, ctx!.org.id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Merge failed' },
      { status: 400 },
    );
  }
}, { route: '/api/admin/rep-teams/shared-tags/merge' });
