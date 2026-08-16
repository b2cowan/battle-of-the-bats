import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

/**
 * Every budget item a TEAM in this club invented — the club's window onto vocabulary it does not
 * own (mig 240).
 *
 * ⚠ VIEW, NOT REACH. A team's item appears in that team's picker and no other's, deliberately: one
 * coach's specifics filling every other coach's list was the cost the owner refused (2026-08-15).
 * This is how a club still notices "three teams have each invented Provincials entry" and does
 * something about it — by PUBLISHING one, which is the sibling route and the only action offered.
 * Nothing here renames, deletes, or moves an item between teams.
 */
function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

// GET /api/admin/accounting/team-budget-items?orgSlug=…
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const { data, error } = await supabaseAdmin
    .from('budget_items')
    .select('id, name, category_id, team_id, suggested_amount, created_at, budget_categories(name), rep_teams(name)')
    .eq('org_id', ctx!.org.id)
    .not('team_id', 'is', null)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  // How many budget lines each one is holding up, so an admin can tell a word somebody tried once
  // from one a season is actually planned against. Counted in one round trip, not one per item.
  const ids = rows.map(r => r.id as string);
  const usage = new Map<string, number>();
  if (ids.length > 0) {
    const { data: lines } = await supabaseAdmin
      .from('rep_budget_lines').select('item_id').in('item_id', ids);
    for (const line of (lines ?? []) as Array<{ item_id: string }>) {
      usage.set(line.item_id, (usage.get(line.item_id) ?? 0) + 1);
    }
  }

  const items = rows.map(r => ({
    id:           r.id as string,
    name:         r.name as string,
    categoryId:   r.category_id as string,
    categoryName: ((r.budget_categories as { name?: string } | null)?.name) ?? null,
    teamId:       r.team_id as string,
    teamName:     ((r.rep_teams as { name?: string } | null)?.name) ?? null,
    /** How many budget lines currently point at it — "tried once" vs "a season depends on it". */
    lineCount:    usage.get(r.id as string) ?? 0,
    createdAt:    r.created_at as string,
  }));

  // Same words invented by more than one team is the whole reason to look at this screen, so it is
  // computed here rather than left for an admin to spot by eye.
  const byName = new Map<string, number>();
  for (const i of items) byName.set(`${i.categoryId}|${i.name.toLowerCase()}`, (byName.get(`${i.categoryId}|${i.name.toLowerCase()}`) ?? 0) + 1);

  return NextResponse.json({
    items: items.map(i => ({
      ...i,
      duplicatedAcrossTeams: (byName.get(`${i.categoryId}|${i.name.toLowerCase()}`) ?? 0) > 1,
    })),
  });
}, { route: '/api/admin/accounting/team-budget-items' });
