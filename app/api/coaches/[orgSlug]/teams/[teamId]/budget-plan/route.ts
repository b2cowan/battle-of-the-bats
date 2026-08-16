import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { RepBudgetLineWithPeriods, RepBudgetPlan } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { computeBudgetTotals, normalizeBudgetLineKind, isFundingKind } from '@/lib/coach-budget-totals';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';

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
    // Anything unrecognised reads as a cost — that is the column default, and a row written
    // before migration 230 IS a cost. Never guess a line is money coming in.
    lineKind:       normalizeBudgetLineKind(row.line_kind as string | null),
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
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
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
  // COSTS only, and through the SHARED arithmetic — the fourth call site of the same sum. The
  // module exists so the planner, the Money hub and Budget vs. Actual cannot drift on it; a
  // hand-rolled reduce here would be exactly the drift it was written to stop.
  const totalBudget = computeBudgetTotals({ lines, estimatedTotal: null }).itemized;

  // Player dues schedules for this year. Their ids gate the "already generated?" check, and their
  // sum is the Player dues figure the plan shows beside expected funding. Σ schedule totals — the
  // same figure the Dues tab's totals row calls "assessed" — NOT Σ installments or payments, so
  // credits and partial payments never move the plan.
  const { data: schedulesData } = await supabaseAdmin
    .from('rep_player_dues_schedules')
    .select('id, total_amount')
    .eq('program_year_id', programYear.id);
  const schedules = (schedulesData ?? []) as Array<{ id: string; total_amount: number }>;
  // Number() belt, matching every other total_amount read in lib/db.ts — a numeric column
  // must never reach arithmetic as a string, whatever the driver does.
  const duesAssessed = Math.round(schedules.reduce((s, r) => s + Number(r.total_amount ?? 0), 0) * 100) / 100;

  // Check whether any budget-generated installments already exist for this year
  let installmentCount = 0;
  if (schedules.length > 0) {
    const { count } = await supabaseAdmin
      .from('rep_player_dues_installments')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'budget_generated')
      .in('schedule_id', schedules.map(s => s.id));
    installmentCount = count ?? 0;
  }

  // Active roster count
  const { count: rosterCount } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id', { count: 'exact', head: true })
    .eq('program_year_id', programYear.id)
    .eq('status', 'active');

  const plan: RepBudgetPlan = {
    lines,
    totalBudget,
    hasInstallments: installmentCount > 0,
    rosterCount:     rosterCount ?? 0,
  };

  // The optional ESTIMATED total (rep_program_years.budget_amount) rides along so the planner
  // can state the difference between it and the itemized sum.
  // The season YEAR rides along too (chunk H2): it anchors bare month names in an imported
  // sheet ("Sep" with no year), and the paste path parses in the browser — so the client needs
  // the same anchor the server's file path already has, or the two would disagree.
  return NextResponse.json({
    plan,
    duesAssessed,
    seasonBudgetAmount: programYear.budgetAmount ?? null,
    seasonYear: programYear.year,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan' });
