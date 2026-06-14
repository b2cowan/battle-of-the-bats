import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

type Ctx = { params: Promise<{ lineId: string }> };

// PATCH /api/admin/accounting/budget-plan/lines/[lineId]
// Updates description, totalAmount, categoryId, itemId, notes, or sortOrder.
export const PATCH = withObservability(async (req: Request, { params }: Ctx) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const { lineId } = await params;

  // Verify the line belongs to this org
  const { data: existing, error: fe } = await supabaseAdmin
    .from('org_budget_lines')
    .select('id, org_id')
    .eq('id', lineId)
    .eq('org_id', ctx!.org.id)
    .maybeSingle();

  if (fe) return NextResponse.json({ error: fe.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });

  const body = await req.json();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.description !== undefined) {
    const desc = typeof body.description === 'string' ? body.description.trim() : '';
    if (!desc || desc.length > 200) {
      return NextResponse.json({ error: 'description is required (max 200 characters)' }, { status: 400 });
    }
    patch.description = desc;
  }

  if (body.totalAmount !== undefined) {
    const amount = Number(body.totalAmount);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'totalAmount must be a positive number' }, { status: 400 });
    }
    patch.total_amount = amount;
  }

  if ('categoryId' in body) patch.category_id = body.categoryId ?? null;
  if ('itemId'     in body) patch.item_id      = body.itemId     ?? null;
  if ('notes'      in body) patch.notes        = body.notes      ?? null;
  if ('sortOrder'  in body) patch.sort_order   = body.sortOrder  ?? 0;

  const { data, error } = await supabaseAdmin
    .from('org_budget_lines')
    .update(patch)
    .eq('id', lineId)
    .select(`
      id, season_year, description, total_amount, notes, sort_order, created_at, updated_at,
      category_id, item_id,
      budget_categories ( id, name ),
      budget_items ( id, name )
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ line: data });
}, { route: '/api/admin/accounting/budget-plan/lines/[lineId]' });

// DELETE /api/admin/accounting/budget-plan/lines/[lineId]
// Deletes a budget line. Blocked if a rep_cost_allocation already references this line.
export const DELETE = withObservability(async (req: Request, { params }: Ctx) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const { lineId } = await params;

  const { data: existing, error: fe } = await supabaseAdmin
    .from('org_budget_lines')
    .select('id, org_id')
    .eq('id', lineId)
    .eq('org_id', ctx!.org.id)
    .maybeSingle();

  if (fe) return NextResponse.json({ error: fe.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });

  // Guard: don't delete if an allocation already references this line
  const { data: linked } = await supabaseAdmin
    .from('rep_cost_allocations')
    .select('id')
    .eq('source_budget_line_id', lineId)
    .limit(1);

  if (linked && linked.length > 0) {
    return NextResponse.json(
      { error: 'This budget line has already been allocated to teams and cannot be deleted. Remove the allocation first.' },
      { status: 409 },
    );
  }

  const { error: de } = await supabaseAdmin
    .from('org_budget_lines')
    .delete()
    .eq('id', lineId);

  if (de) return NextResponse.json({ error: de.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}, { route: '/api/admin/accounting/budget-plan/lines/[lineId]' });
