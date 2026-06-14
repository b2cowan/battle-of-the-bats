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

// GET /api/admin/accounting/budget-plan?year=2026
// Returns the full org budget plan for a season year — lines grouped by category,
// each line includes its period distribution and allocation summary (if allocated).
export const GET = withObservability(async (req: Request) => {
  const url  = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const year = parseInt(url.searchParams.get('year') ?? '', 10) || new Date().getFullYear();

  // Fetch all budget lines for this org + year, with category and item names
  const { data: lines, error: le } = await supabaseAdmin
    .from('org_budget_lines')
    .select(`
      id, season_year, description, total_amount, notes, sort_order, created_at, updated_at,
      category_id, item_id,
      budget_categories ( id, name, scope, sort_order ),
      budget_items ( id, name )
    `)
    .eq('org_id', ctx!.org.id)
    .eq('season_year', year)
    .order('sort_order')
    .order('created_at');

  if (le) return NextResponse.json({ error: le.message }, { status: 500 });

  const lineIds = (lines ?? []).map((l: any) => l.id);

  // Fetch all periods for these lines in one query
  const { data: periods, error: pe } = lineIds.length > 0
    ? await supabaseAdmin
        .from('org_budget_periods')
        .select('id, budget_line_id, period_label, period_date, amount, sort_order')
        .in('budget_line_id', lineIds)
        .order('sort_order')
        .order('period_date', { nullsFirst: false })
    : { data: [], error: null };

  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });

  // Fetch allocations linked to these budget lines
  const { data: allocations, error: ae } = lineIds.length > 0
    ? await supabaseAdmin
        .from('rep_cost_allocations')
        .select('id, source_budget_line_id, description, total_amount, created_at')
        .in('source_budget_line_id', lineIds)
    : { data: [], error: null };

  if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });

  const allocationIds = (allocations ?? []).map((a: any) => a.id);

  // Fetch split + installment summaries for allocation status
  let splitRows: any[] = [];
  let installRows: any[] = [];
  if (allocationIds.length > 0) {
    const { data: splits } = await supabaseAdmin
      .from('rep_allocation_splits')
      .select('id, allocation_id, amount, team_id')
      .in('allocation_id', allocationIds);
    splitRows = splits ?? [];

    const splitIds = splitRows.map(s => s.id);
    if (splitIds.length > 0) {
      const { data: insts } = await supabaseAdmin
        .from('rep_allocation_installments')
        .select('split_id, amount, paid_at')
        .in('split_id', splitIds);
      installRows = insts ?? [];
    }
  }

  // Build a lookup: budget_line_id → allocation summary
  const allocByLine = new Map<string, {
    id: string;
    teamCount: number;
    totalAllocated: number;
    collected: number;
    outstanding: number;
  }>();

  for (const alloc of (allocations ?? [])) {
    const splits  = splitRows.filter(s => s.allocation_id === alloc.id);
    const splitIds = splits.map(s => s.id);
    const insts   = installRows.filter(i => splitIds.includes(i.split_id));
    const collected   = insts.filter(i => i.paid_at).reduce((s, i) => s + Number(i.amount), 0);
    const outstanding = insts.filter(i => !i.paid_at).reduce((s, i) => s + Number(i.amount), 0);

    allocByLine.set(alloc.source_budget_line_id, {
      id: alloc.id,
      teamCount: splits.length,
      totalAllocated: splits.reduce((s, sp) => s + Number(sp.amount), 0),
      collected,
      outstanding,
    });
  }

  // Build periods lookup
  const periodsByLine = new Map<string, any[]>();
  for (const p of (periods ?? [])) {
    const list = periodsByLine.get(p.budget_line_id) ?? [];
    list.push({
      id:          p.id,
      label:       p.period_label,
      periodDate:  p.period_date,
      amount:      Number(p.amount),
      sortOrder:   p.sort_order,
    });
    periodsByLine.set(p.budget_line_id, list);
  }

  // Group lines by category
  const categoryMap = new Map<string, { id: string; name: string; sortOrder: number; lines: any[] }>();
  const uncategorized: any[] = [];

  let totalBudgeted = 0;

  for (const l of (lines ?? [])) {
    totalBudgeted += Number(l.total_amount);
    const lineData = {
      id:          l.id,
      description: l.description,
      totalAmount: Number(l.total_amount),
      notes:       l.notes,
      sortOrder:   l.sort_order,
      categoryId:  l.category_id,
      itemId:      l.item_id,
      itemName:    (l.budget_items as any)?.name ?? null,
      createdAt:   l.created_at,
      updatedAt:   l.updated_at,
      periods:     periodsByLine.get(l.id) ?? [],
      allocation:  allocByLine.get(l.id) ?? null,
    };

    const cat = l.budget_categories as any;
    if (!cat) {
      uncategorized.push(lineData);
    } else {
      if (!categoryMap.has(cat.id)) {
        categoryMap.set(cat.id, { id: cat.id, name: cat.name, sortOrder: cat.sort_order, lines: [] });
      }
      categoryMap.get(cat.id)!.lines.push(lineData);
    }
  }

  const categories = Array.from(categoryMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);

  // Org-level summary
  const totalAllocated  = Array.from(allocByLine.values()).reduce((s, a) => s + a.totalAllocated, 0);
  const totalCollected  = Array.from(allocByLine.values()).reduce((s, a) => s + a.collected, 0);

  // Available season years = years that have lines, plus current year
  const { data: yearsData } = await supabaseAdmin
    .from('org_budget_lines')
    .select('season_year')
    .eq('org_id', ctx!.org.id)
    .order('season_year', { ascending: false });

  const allYears = Array.from(new Set([
    new Date().getFullYear(),
    ...((yearsData ?? []).map((r: any) => r.season_year)),
  ])).sort((a, b) => b - a);

  return NextResponse.json({
    year,
    availableYears: allYears,
    summary: {
      totalBudgeted,
      totalAllocated,
      totalCollected,
      orgHeadroom: totalBudgeted - totalAllocated,
    },
    categories,
    uncategorized,
  });
}, { route: '/api/admin/accounting/budget-plan' });
