import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { BudgetCategoryWithItems } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { mapBudgetItem, itemOfferedToClub, type OwnedBudgetItem } from '@/lib/coach-budget-items';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

function mapCategory(row: Record<string, unknown>, orgId: string): BudgetCategoryWithItems {
  return {
    id:         row.id as string,
    orgId:      row.org_id as string | null,
    name:       row.name as string,
    scope:      row.scope as 'org' | 'team' | 'both',
    sortOrder:  row.sort_order as number,
    isDefault:  row.is_default as boolean,
    createdAt:  row.created_at as string,
    // ⚠ TEAM-OWNED ITEMS ARE EXCLUDED FROM THE ADMIN CATEGORY LIST (mig 240). This list feeds the
    // org's own budget tools, where a single team's private vocabulary has no business appearing;
    // the club sees those on the dedicated team-items screen, where each carries the team that owns
    // it and can be published to everyone.
    /* ⚠ THE FOURTH COPY OF THE MAPPER LIVED HERE, INLINE (/simplify, 2026-08-16) — the three the
       cleanup pass set out to merge were the named ones; this one hid inside a `.map()` and was
       found only because tightening `BudgetItem.direction` to non-null made it a type error. Its
       comment claimed "platform rows only; a club's own items are null", which mig 246 ended. */
    /* ⚠⚠ THROUGH THE SHARED PREDICATE SINCE 2026-08-17 (`/review`), not a local `!item.team_id`.
       This list is what the club's budget planner offers, and the SAVE behind that planner accepted
       anything at all — so the club could file its budget against a word this list would never have
       shown it, including another club's team-private one. Both sides read `itemOfferedToClub` now:
       a list offering what a write path refuses, or a write path accepting what the list hides, is
       the same drift one tier down (`itemVisibleToTeam`) exists to prevent. */
    items:      ((row.budget_items ?? []) as Record<string, unknown>[])
      .filter(item => itemOfferedToClub(item as OwnedBudgetItem, orgId))
      .map(mapBudgetItem)
      .sort((a, b) => {
      if (a.isMisc !== b.isMisc) return a.isMisc ? 1 : -1;
      return a.sortOrder - b.sortOrder;
    }),
  };
}

// GET /api/admin/accounting/budget-categories?scope=team|org|both
// Returns platform defaults merged with org's custom categories,
// filtered by scope (defaults to all scopes).
export const GET = withObservability(async (req: Request) => {
  const url   = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const scope = url.searchParams.get('scope'); // 'org' | 'team' | 'both' | null

  // Fetch platform defaults (org_id IS NULL) and org customs
  const query = supabaseAdmin
    .from('budget_categories')
    .select('*, budget_items(*)')
    .or(`org_id.is.null,org_id.eq.${ctx!.org.id}`)
    .order('sort_order');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let categories = (data ?? []).map(row => mapCategory(row, ctx!.org.id));

  // Filter by scope: 'org' and 'team' categories also include 'both'
  if (scope === 'org') {
    categories = categories.filter(c => c.scope === 'org' || c.scope === 'both');
  } else if (scope === 'team') {
    categories = categories.filter(c => c.scope === 'team' || c.scope === 'both');
  }

  return NextResponse.json({ categories });
}, { route: '/api/admin/accounting/budget-categories' });

// POST /api/admin/accounting/budget-categories
// Creates a custom category for this org (owner/treasurer only).
export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const body = await req.json();
  const name: string = typeof body.name === 'string' ? body.name.trim() : '';
  const scope: string = body.scope ?? 'both';

  if (!name || name.length > 80) {
    return NextResponse.json({ error: 'name is required and must be 80 characters or fewer' }, { status: 400 });
  }
  if (!['org', 'team', 'both'].includes(scope)) {
    return NextResponse.json({ error: 'scope must be org, team, or both' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('budget_categories')
    .insert({ org_id: ctx!.org.id, name, scope, is_default: false })
    .select('*, budget_items(*)')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: mapCategory(data, ctx!.org.id) }, { status: 201 });
}, { route: '/api/admin/accounting/budget-categories' });
