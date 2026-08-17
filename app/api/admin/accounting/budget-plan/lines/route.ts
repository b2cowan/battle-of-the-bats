import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { resolveOrgBudgetItem } from '@/lib/coach-budget-items';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

// POST /api/admin/accounting/budget-plan/lines
// Adds a new budget line to the org's plan for a given year.
export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
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

  /* ⚠⚠ THE WORD IS AUTHORISED, AND UNTIL 2026-08-17 IT WAS NOT (`/review`, security lens). This
     route stored whatever `itemId` arrived — no ownership check, no tier check — while every
     coach-side write path went through a resolver. Any club could therefore file its budget against
     another club's team-private word, and the cost landed on that team's coach as an unremovable,
     unexplainable word. The list here has always offered standard + club words only; this is the
     save finally agreeing with it.
     ⚠ AND THE CATEGORY COMES FROM THE ITEM, not from the request. An item belongs to exactly one
     category, so accepting both independently let the two levels of the club's report disagree
     about the same row — the very thing the coach-side routes derive it to prevent. */
  const linked = await resolveOrgBudgetItem(itemId, ctx!.org.id);
  if (!linked.ok) return NextResponse.json({ error: linked.error }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('org_budget_lines')
    .insert({
      org_id:       ctx!.org.id,
      season_year:  year,
      category_id:  linked.item ? linked.item.categoryId : (categoryId ?? null),
      item_id:      linked.item?.id ?? null,
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
