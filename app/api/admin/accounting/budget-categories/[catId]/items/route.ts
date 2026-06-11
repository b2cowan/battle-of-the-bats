import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { BudgetItem } from '@/lib/types';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

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

// POST /api/admin/accounting/budget-categories/[catId]/items
// Creates a custom item in any category (owner, treasurer, or coach).
// Custom items are scoped to this org regardless of whether the parent
// category is a platform default or an org custom.
export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ catId: string }> },) => {
  const { catId } = await params;
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const allowedRoles = ['owner', 'treasurer', 'coach'];
  if (!allowedRoles.includes(ctx!.role)) return forbidden();

  // Verify the category exists and is accessible (platform default or this org's)
  const { data: cat, error: catErr } = await supabaseAdmin
    .from('budget_categories')
    .select('id, org_id')
    .eq('id', catId)
    .or(`org_id.is.null,org_id.eq.${ctx!.org.id}`)
    .single();

  if (catErr || !cat) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const body = await req.json();
  const name: string = typeof body.name === 'string' ? body.name.trim() : '';
  const suggestedAmount: number | null =
    typeof body.suggestedAmount === 'number' && body.suggestedAmount > 0
      ? body.suggestedAmount
      : null;

  if (!name || name.length > 80) {
    return NextResponse.json({ error: 'name is required and must be 80 characters or fewer' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('budget_items')
    .insert({
      category_id:      catId,
      org_id:           ctx!.org.id,
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
}, { route: '/api/admin/accounting/budget-categories/[catId]/items' });
