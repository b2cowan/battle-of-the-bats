import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { RepBudgetLineWithPeriods, RepBudgetPlan } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';

function mapLine(row: Record<string, unknown>): RepBudgetLineWithPeriods {
  const periods = ((row.rep_budget_periods ?? []) as Record<string, unknown>[])
    .map(p => ({
      id:           p.id as string,
      budgetLineId: p.budget_line_id as string,
      periodLabel:  p.period_label as string,
      periodDate:   p.period_date as string | null,
      amount:       p.amount as number,
      sortOrder:    p.sort_order as number,
      createdAt:    p.created_at as string,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id:             row.id as string,
    orgId:          row.org_id as string,
    teamId:         row.team_id as string,
    programYearId:  row.program_year_id as string,
    categoryId:     row.category_id as string | null,
    itemId:         row.item_id as string | null,
    description:    row.description as string,
    totalAmount:    row.total_amount as number,
    notes:          row.notes as string | null,
    sortOrder:      row.sort_order as number,
    createdAt:      row.created_at as string,
    updatedAt:      row.updated_at as string,
    periods,
    categoryName:   (row.budget_categories as Record<string, unknown> | null)?.name as string | null ?? null,
    itemName:       (row.budget_items     as Record<string, unknown> | null)?.name as string | null ?? null,
  };
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/budget-plan
// Returns the full budget plan for the active program year, including
// per-line period breakdowns, total budget, roster count, and whether
// dues installments have already been generated.
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const { data: linesData, error: linesErr } = await supabaseAdmin
    .from('rep_budget_lines')
    .select('*, rep_budget_periods(*), budget_categories(name), budget_items(name)')
    .eq('program_year_id', programYear.id)
    .order('sort_order');

  if (linesErr) return NextResponse.json({ error: linesErr.message }, { status: 500 });

  const lines = (linesData ?? []).map(mapLine);
  const totalBudget = lines.reduce((s, l) => s + l.totalAmount, 0);

  // Check whether any budget-generated installments already exist for this year
  const { count: installmentCount } = await supabaseAdmin
    .from('rep_player_dues_installments')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'budget_generated')
    .in(
      'schedule_id',
      (await supabaseAdmin
        .from('rep_player_dues_schedules')
        .select('id')
        .eq('program_year_id', programYear.id)
        .then(r => (r.data ?? []).map((s: { id: string }) => s.id)))
    );

  // Active roster count
  const { count: rosterCount } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id', { count: 'exact', head: true })
    .eq('program_year_id', programYear.id)
    .eq('status', 'active');

  const plan: RepBudgetPlan = {
    lines,
    totalBudget,
    hasInstallments: (installmentCount ?? 0) > 0,
    rosterCount:     rosterCount ?? 0,
  };

  // The optional single "season total" (rep_program_years.budget_amount) rides along so
  // the planner can reconcile it against the itemized sum (non-itemized buffer display).
  // The season YEAR rides along too (chunk H2): it anchors bare month names in an imported
  // sheet ("Sep" with no year), and the paste path parses in the browser — so the client needs
  // the same anchor the server's file path already has, or the two would disagree.
  return NextResponse.json({
    plan,
    seasonBudgetAmount: programYear.budgetAmount ?? null,
    seasonYear: programYear.year,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan' });
