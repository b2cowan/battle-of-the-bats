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

// GET /api/admin/accounting/budget-vs-actual?year=2026
//
// Returns org budget lines with their allocation and collection status,
// total org ledger expenses for the year (not yet mapped per-line — Phase J),
// and per-team health summary.
export const GET = withObservability(async (req: Request) => {
  const url  = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const year = parseInt(url.searchParams.get('year') ?? '', 10) || new Date().getFullYear();
  const orgId = ctx!.org.id;

  // ── Budget lines + periods ────────────────────────────────────────────────
  const { data: lines, error: le } = await supabaseAdmin
    .from('org_budget_lines')
    .select(`
      id, season_year, description, total_amount, notes, sort_order, category_id, item_id,
      budget_categories ( id, name, sort_order ),
      budget_items ( id, name )
    `)
    .eq('org_id', orgId)
    .eq('season_year', year)
    .order('sort_order')
    .order('created_at');

  if (le) return NextResponse.json({ error: le.message }, { status: 500 });

  const lineIds = (lines ?? []).map((l: any) => l.id);

  const { data: periods, error: pe } = lineIds.length > 0
    ? await supabaseAdmin
        .from('org_budget_periods')
        .select('id, budget_line_id, period_label, period_date, amount, sort_order')
        .in('budget_line_id', lineIds)
        .order('sort_order')
        .order('period_date', { nullsFirst: false })
    : { data: [], error: null };

  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });

  // ── Allocations linked to these budget lines ──────────────────────────────
  const { data: allocations, error: ae } = lineIds.length > 0
    ? await supabaseAdmin
        .from('rep_cost_allocations')
        .select('id, source_budget_line_id, description, total_amount')
        .in('source_budget_line_id', lineIds)
    : { data: [], error: null };

  if (ae) return NextResponse.json({ error: ae.message }, { status: 500 });

  const allocationIds = (allocations ?? []).map((a: any) => a.id);

  let splitRows: any[] = [];
  let installRows: any[] = [];

  if (allocationIds.length > 0) {
    const { data: splits } = await supabaseAdmin
      .from('rep_allocation_splits')
      .select('id, allocation_id, team_id, amount')
      .in('allocation_id', allocationIds);
    splitRows = splits ?? [];

    const splitIds = splitRows.map(s => s.id);
    if (splitIds.length > 0) {
      const { data: insts } = await supabaseAdmin
        .from('rep_allocation_installments')
        .select('split_id, amount, paid_at, due_date')
        .in('split_id', splitIds);
      installRows = insts ?? [];
    }
  }

  // ── All active rep team allocations for this org (team health, not just budget-linked) ──
  const { data: allAllocs } = await supabaseAdmin
    .from('rep_cost_allocations')
    .select('id')
    .eq('org_id', orgId);

  const allAllocIds = (allAllocs ?? []).map((a: any) => a.id);
  let allSplitRows: any[] = [];
  let allInstRows: any[] = [];

  if (allAllocIds.length > 0) {
    const { data: allSplits } = await supabaseAdmin
      .from('rep_allocation_splits')
      .select('id, allocation_id, team_id, amount')
      .in('allocation_id', allAllocIds);
    allSplitRows = allSplits ?? [];

    const allSplitIds = allSplitRows.map(s => s.id);
    if (allSplitIds.length > 0) {
      const now = new Date().toISOString().slice(0, 10);
      const { data: allInsts } = await supabaseAdmin
        .from('rep_allocation_installments')
        .select('id, split_id, amount, paid_at, due_date')
        .in('split_id', allSplitIds);
      allInstRows = allInsts ?? [];

      // Filter to year-relevant installments (due in this year or overdue)
      allInstRows = allInstRows.filter((i: any) => {
        const y = i.due_date ? parseInt(i.due_date.slice(0, 4), 10) : null;
        return y === year || (!i.paid_at && i.due_date && i.due_date < now);
      });
    }
  }

  // ── Team names ────────────────────────────────────────────────────────────
  // When caller is scoped to specific groups, restrict team health to those teams
  let allTeamIds = Array.from(new Set(allSplitRows.map((s: any) => s.team_id as string)));
  if (ctx!.repGroupIds) {
    const { data: scopedTeams } = await supabaseAdmin
      .from('rep_teams')
      .select('id')
      .eq('org_id', orgId)
      .in('group_id', ctx!.repGroupIds);
    const scopedSet = new Set((scopedTeams ?? []).map((t: any) => t.id as string));
    allTeamIds = allTeamIds.filter(id => scopedSet.has(id));
    allSplitRows = allSplitRows.filter((s: any) => scopedSet.has(s.team_id));
    allInstRows  = allInstRows.filter((i: any) => {
      const split = allSplitRows.find((s: any) => s.id === i.split_id);
      return !!split;
    });
  }
  const teamIds = allTeamIds;
  let teamMap = new Map<string, string>();
  if (teamIds.length > 0) {
    const { data: teams } = await supabaseAdmin
      .from('rep_teams')
      .select('id, name')
      .in('id', teamIds);
    teamMap = new Map((teams ?? []).map((t: any) => [t.id, t.name]));
  }

  // ── Org ledger actuals for the year ───────────────────────────────────────
  // Fetch all org-type ledgers, then their posted expense entries for the year.
  const { data: ledgers } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('entity_type', 'org');

  const ledgerIds = (ledgers ?? []).map((l: any) => l.id);
  let orgActualEntries: any[] = [];
  let totalOrgExpenses = 0;

  if (ledgerIds.length > 0) {
    const { data: entries } = await supabaseAdmin
      .from('accounting_entries')
      .select('id, ledger_id, entry_date, description, amount, entry_type')
      .in('ledger_id', ledgerIds)
      .eq('entry_type', 'expense')
      .eq('status', 'posted')
      .gte('entry_date', `${year}-01-01`)
      .lte('entry_date', `${year}-12-31`)
      .order('entry_date', { ascending: false })
      .limit(50);

    orgActualEntries = entries ?? [];
    totalOrgExpenses = orgActualEntries.reduce((s, e: any) => s + Number(e.amount), 0);
  }

  const ledgerNameMap = new Map((ledgers ?? []).map((l: any) => [l.id, l.name]));

  // ── Build per-line allocation summaries ───────────────────────────────────
  const allocByLine = new Map<string, {
    id: string;
    totalAllocated: number;
    collected: number;
    outstanding: number;
    teamCount: number;
  }>();

  for (const alloc of (allocations ?? [])) {
    const splits   = splitRows.filter((s: any) => s.allocation_id === alloc.id);
    const splitIds = splits.map((s: any) => s.id);
    const insts    = installRows.filter((i: any) => splitIds.includes(i.split_id));

    allocByLine.set(alloc.source_budget_line_id, {
      id:             alloc.id,
      totalAllocated: splits.reduce((s: number, sp: any) => s + Number(sp.amount), 0),
      collected:      insts.filter((i: any) => i.paid_at).reduce((s: number, i: any) => s + Number(i.amount), 0),
      outstanding:    insts.filter((i: any) => !i.paid_at).reduce((s: number, i: any) => s + Number(i.amount), 0),
      teamCount:      splits.length,
    });
  }

  // ── Build periods lookup ──────────────────────────────────────────────────
  const periodsByLine = new Map<string, any[]>();
  for (const p of (periods ?? [])) {
    const list = periodsByLine.get(p.budget_line_id) ?? [];
    list.push({ id: p.id, label: p.period_label, periodDate: p.period_date, amount: Number(p.amount), sortOrder: p.sort_order });
    periodsByLine.set(p.budget_line_id, list);
  }

  // ── Group lines by category ───────────────────────────────────────────────
  const categoryMap = new Map<string, { id: string; name: string; sortOrder: number; lines: any[] }>();
  const uncategorized: any[] = [];
  let totalBudgeted  = 0;
  let totalAllocated = 0;
  let totalCollected = 0;

  for (const l of (lines ?? [])) {
    const estimated = Number(l.total_amount);
    const alloc     = allocByLine.get(l.id) ?? null;
    const allocated = alloc?.totalAllocated ?? 0;
    const collected = alloc?.collected ?? 0;

    totalBudgeted  += estimated;
    totalAllocated += allocated;
    totalCollected += collected;

    const lineData = {
      budgetLineId: l.id,
      description:  l.description,
      estimated,
      allocated,
      collected,
      outstanding:  alloc?.outstanding ?? 0,
      unallocated:  estimated - allocated,
      allocationId: alloc?.id ?? null,
      teamCount:    alloc?.teamCount ?? 0,
      periods:      periodsByLine.get(l.id) ?? [],
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

  const categories = Array.from(categoryMap.values())
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(c => ({
      ...c,
      totalEstimated: c.lines.reduce((s, l) => s + l.estimated, 0),
      totalAllocated: c.lines.reduce((s, l) => s + l.allocated, 0),
      totalCollected: c.lines.reduce((s, l) => s + l.collected, 0),
    }));

  // ── Team health ───────────────────────────────────────────────────────────
  const now = new Date().toISOString().slice(0, 10);

  const teamHealth = Array.from(teamIds).map(teamId => {
    const splits      = allSplitRows.filter((s: any) => s.team_id === teamId);
    const splitIds    = splits.map((s: any) => s.id);
    const insts       = allInstRows.filter((i: any) => splitIds.includes(i.split_id));
    const totalAlloc  = splits.reduce((s: number, sp: any) => s + Number(sp.amount), 0);
    const collected   = insts.filter((i: any) => i.paid_at).reduce((s: number, i: any) => s + Number(i.amount), 0);
    const overdueInsts = insts.filter((i: any) => !i.paid_at && i.due_date && i.due_date < now);
    const overdueCount = overdueInsts.length;
    const pct = totalAlloc > 0 ? Math.round((collected / totalAlloc) * 100) : 0;

    let status: 'on_track' | 'behind' | 'overdue' = 'on_track';
    if (overdueCount > 0) status = 'overdue';
    else if (pct < 50)    status = 'behind';

    return {
      teamId,
      teamName:      teamMap.get(teamId) ?? teamId,
      totalAllocated: totalAlloc,
      collected,
      collectionPct: pct,
      overdueCount,
      status,
    };
  }).sort((a, b) => {
    // Sort: overdue first, then behind, then on_track; within group by name
    const order = { overdue: 0, behind: 1, on_track: 2 };
    const diff  = order[a.status] - order[b.status];
    return diff !== 0 ? diff : a.teamName.localeCompare(b.teamName);
  });

  // ── Available years ───────────────────────────────────────────────────────
  const { data: yearsData } = await supabaseAdmin
    .from('org_budget_lines')
    .select('season_year')
    .eq('org_id', orgId)
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
      totalOrgExpenses,
      totalAllocated,
      totalCollected,
      headroom: totalBudgeted - totalOrgExpenses,
    },
    categories,
    uncategorized,
    orgActuals: {
      total:   totalOrgExpenses,
      entries: orgActualEntries.slice(0, 20).map((e: any) => ({
        entryId:    e.id,
        description: e.description,
        amount:     Number(e.amount),
        entryDate:  e.entry_date,
        ledgerName: ledgerNameMap.get(e.ledger_id) ?? 'Unknown',
      })),
    },
    teamHealth,
  });
}, { route: '/api/admin/accounting/budget-vs-actual' });
