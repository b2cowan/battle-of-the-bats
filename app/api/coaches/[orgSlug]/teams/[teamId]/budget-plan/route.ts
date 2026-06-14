import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { RepBudgetLineWithPeriods, RepBudgetPlan } from '@/lib/types';
import { withObservability } from '@/lib/observability';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment  = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

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
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { programYear } = resolved;

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

  return NextResponse.json({ plan });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan' });
