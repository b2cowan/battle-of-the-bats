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

// POST /api/admin/accounting/budget-plan/lines
// Adds a new budget line to the org's plan for a given year.
export const POST = withObservability(async (req: Request) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const body = await req.json();
  const {
    seasonYear,
    categoryId   = null,
    itemId       = null,
    description,
    totalAmount,
    notes        = null,
    sortOrder    = 0,
  } = body;

  const year = parseInt(seasonYear ?? '', 10);
  if (!year || year < 2020 || year > 2099) {
    return NextResponse.json({ error: 'seasonYear must be a valid 4-digit year' }, { status: 400 });
  }

  const desc = typeof description === 'string' ? description.trim() : '';
  if (!desc || desc.length > 200) {
    return NextResponse.json({ error: 'description is required (max 200 characters)' }, { status: 400 });
  }

  const amount = Number(totalAmount);
  if (isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: 'totalAmount must be a positive number' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('org_budget_lines')
    .insert({
      org_id:       ctx!.org.id,
      season_year:  year,
      category_id:  categoryId  ?? null,
      item_id:      itemId      ?? null,
      description:  desc,
      total_amount: amount,
      notes:        notes       ?? null,
      sort_order:   sortOrder   ?? 0,
    })
    .select(`
      id, season_year, description, total_amount, notes, sort_order, created_at, updated_at,
      category_id, item_id,
      budget_categories ( id, name ),
      budget_items ( id, name )
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ line: data }, { status: 201 });
}, { route: '/api/admin/accounting/budget-plan/lines' });
