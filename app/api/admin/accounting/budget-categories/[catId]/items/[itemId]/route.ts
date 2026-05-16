import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

// PATCH /api/admin/accounting/budget-categories/[catId]/items/[itemId]
// Updates name or suggestedAmount on an org-owned custom item (not platform defaults).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ catId: string; itemId: string }> },
) {
  const { catId, itemId } = await params;
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  // Verify item belongs to this org (not a platform default — those are immutable)
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('budget_items')
    .select('id, org_id, is_default')
    .eq('id', itemId)
    .eq('category_id', catId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }
  if (existing.org_id !== ctx!.org.id) {
    return NextResponse.json({ error: 'Platform default items cannot be modified' }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name || name.length > 80) {
      return NextResponse.json({ error: 'name must be 1–80 characters' }, { status: 400 });
    }
    updates.name = name;
  }

  if ('suggestedAmount' in body) {
    updates.suggested_amount =
      typeof body.suggestedAmount === 'number' && body.suggestedAmount > 0
        ? body.suggestedAmount
        : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('budget_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'An item with this name already exists in this category' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

// DELETE /api/admin/accounting/budget-categories/[catId]/items/[itemId]
// Removes an org-owned custom item (owner/treasurer only).
// Platform defaults cannot be deleted.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ catId: string; itemId: string }> },
) {
  const { catId, itemId } = await params;
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('budget_items')
    .select('id, org_id, is_misc')
    .eq('id', itemId)
    .eq('category_id', catId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }
  if (existing.org_id !== ctx!.org.id) {
    return NextResponse.json({ error: 'Platform default items cannot be deleted' }, { status: 403 });
  }
  if (existing.is_misc) {
    return NextResponse.json({ error: 'Misc items cannot be deleted' }, { status: 403 });
  }

  const { error } = await supabaseAdmin
    .from('budget_items')
    .delete()
    .eq('id', itemId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
