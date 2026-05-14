import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { BudgetCategoryWithItems } from '@/lib/types';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

function mapCategory(row: Record<string, unknown>): BudgetCategoryWithItems {
  return {
    id:         row.id as string,
    orgId:      row.org_id as string | null,
    name:       row.name as string,
    scope:      row.scope as 'org' | 'team' | 'both',
    sortOrder:  row.sort_order as number,
    isDefault:  row.is_default as boolean,
    createdAt:  row.created_at as string,
    items:      ((row.budget_items ?? []) as Record<string, unknown>[]).map(item => ({
      id:              item.id as string,
      categoryId:      item.category_id as string,
      orgId:           item.org_id as string | null,
      name:            item.name as string,
      suggestedAmount: item.suggested_amount as number | null,
      sortOrder:       item.sort_order as number,
      isDefault:       item.is_default as boolean,
      isMisc:          item.is_misc as boolean,
      createdAt:       item.created_at as string,
    })).sort((a, b) => {
      if (a.isMisc !== b.isMisc) return a.isMisc ? 1 : -1;
      return a.sortOrder - b.sortOrder;
    }),
  };
}

// GET /api/admin/accounting/budget-categories?scope=team|org|both
// Returns platform defaults merged with org's custom categories,
// filtered by scope (defaults to all scopes).
export async function GET(req: Request) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const url   = new URL(req.url);
  const scope = url.searchParams.get('scope'); // 'org' | 'team' | 'both' | null

  // Fetch platform defaults (org_id IS NULL) and org customs
  const query = supabaseAdmin
    .from('budget_categories')
    .select('*, budget_items(*)')
    .or(`org_id.is.null,org_id.eq.${ctx!.org.id}`)
    .order('sort_order');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let categories = (data ?? []).map(mapCategory);

  // Filter by scope: 'org' and 'team' categories also include 'both'
  if (scope === 'org') {
    categories = categories.filter(c => c.scope === 'org' || c.scope === 'both');
  } else if (scope === 'team') {
    categories = categories.filter(c => c.scope === 'team' || c.scope === 'both');
  }

  return NextResponse.json({ categories });
}

// POST /api/admin/accounting/budget-categories
// Creates a custom category for this org (owner/treasurer only).
export async function POST(req: Request) {
  const ctx = await getAuthContextWithRole();
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

  return NextResponse.json({ category: mapCategory(data) }, { status: 201 });
}
