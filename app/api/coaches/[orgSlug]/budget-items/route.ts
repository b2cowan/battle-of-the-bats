import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCoachingAssignmentsForUser } from '@/lib/db';
import type { BudgetCategoryWithItems, BudgetItem } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { canViewMoney, canWriteMoney, denyUnless } from '@/lib/coach-capabilities';

function mapItem(row: Record<string, unknown>): BudgetItem {
  return {
    id:              row.id as string,
    categoryId:      row.category_id as string,
    orgId:           row.org_id as string | null,
    name:            row.name as string,
    suggestedAmount: row.suggested_amount as number | null,
    sortOrder:       row.sort_order as number,
    isDefault:       row.is_default as boolean,
    isMisc:          row.is_misc as boolean,
    createdAt:       row.created_at as string,
  };
}

async function resolveCoachContext(orgSlug: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  if (!assignments.length) return { error: forbidden() };

  return { ctx, assignments };
}

// GET /api/coaches/[orgSlug]/budget-items
// Returns platform defaults + org custom categories/items visible to coaches.
// Only 'team' and 'both' scoped categories are returned (org-only categories
// are admin tools, not relevant to the team budget planner).
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string }> },) => {
  const { orgSlug } = await params;
  const resolved = await resolveCoachContext(orgSlug);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignments } = resolved;
  const denied = denyUnless(assignments.some(a => canViewMoney(a.capabilities)), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const { data, error } = await supabaseAdmin
    .from('budget_categories')
    .select('*, budget_items(*)')
    .or(`org_id.is.null,org_id.eq.${ctx.org.id}`)
    .in('scope', ['team', 'both'])
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const categories: BudgetCategoryWithItems[] = (data ?? []).map(row => ({
    id:        row.id as string,
    orgId:     row.org_id as string | null,
    name:      row.name as string,
    scope:     row.scope as 'org' | 'team' | 'both',
    sortOrder: row.sort_order as number,
    isDefault: row.is_default as boolean,
    createdAt: row.created_at as string,
    items:     ((row.budget_items ?? []) as Record<string, unknown>[])
      .map(mapItem)
      .sort((a, b) => {
        if (a.isMisc !== b.isMisc) return a.isMisc ? 1 : -1;
        return a.sortOrder - b.sortOrder;
      }),
  }));

  return NextResponse.json({ categories });
}, { route: '/api/coaches/[orgSlug]/budget-items' });

// POST /api/coaches/[orgSlug]/budget-items
// Lets a coach add a custom item to any accessible category.
// The item is saved org-wide so it becomes reusable by all coaches in the org.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string }> },) => {
  const { orgSlug } = await params;
  const resolved = await resolveCoachContext(orgSlug);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignments } = resolved;
  const denied = denyUnless(assignments.some(a => canWriteMoney(a.capabilities)), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const catId: string = typeof body.categoryId === 'string' ? body.categoryId.trim() : '';
  const name: string  = typeof body.name === 'string' ? body.name.trim() : '';
  const suggestedAmount: number | null =
    typeof body.suggestedAmount === 'number' && body.suggestedAmount > 0
      ? body.suggestedAmount
      : null;

  if (!catId) {
    return NextResponse.json({ error: 'categoryId is required' }, { status: 400 });
  }
  if (!name || name.length > 80) {
    return NextResponse.json({ error: 'name is required and must be 80 characters or fewer' }, { status: 400 });
  }

  // Verify category is accessible (platform default or this org's, team/both scope)
  const { data: cat, error: catErr } = await supabaseAdmin
    .from('budget_categories')
    .select('id, scope')
    .eq('id', catId)
    .or(`org_id.is.null,org_id.eq.${ctx.org.id}`)
    .in('scope', ['team', 'both'])
    .single();

  if (catErr || !cat) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('budget_items')
    .insert({
      category_id:      catId,
      org_id:           ctx.org.id,
      name,
      suggested_amount: suggestedAmount,
      is_default:       false,
      is_misc:          false,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'An item with this name already exists in this category' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: mapItem(data) }, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/budget-items' });
