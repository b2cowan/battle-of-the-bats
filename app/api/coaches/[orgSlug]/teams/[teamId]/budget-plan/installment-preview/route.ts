import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import { getCoachingAssignmentsForUser, getRepTeam, getActiveRepProgramYear } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { RepInstallmentPreviewRow } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { computeBudgetTotals } from '@/lib/coach-budget-totals';

async function resolveCoachContext(orgSlug: string, teamId: string) {
  const ctx = await getAuthContext({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (ctx.org.slug !== orgSlug) return { error: forbidden() };

  const team = await getRepTeam(teamId);
  if (!team || team.orgId !== ctx.org.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const assignments = await getCoachingAssignmentsForUser(ctx.org.id, ctx.user.id);
  const assignment = assignments.find(a => a.teamId === teamId);
  if (!assignment) return { error: forbidden() };

  const programYear = await getActiveRepProgramYear(teamId);
  if (!programYear) {
    return { error: NextResponse.json({ error: 'No active program year' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

// GET /api/coaches/[orgSlug]/teams/[teamId]/budget-plan/installment-preview
// ?installmentCount=3&dates[]=2026-05-15&dates[]=2026-06-15&dates[]=2026-09-15
//
// Returns a per-player preview of the installment amounts that would be
// generated. Does not write anything to the database.
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { assignment, programYear } = resolved;
  const denied = denyUnless(canViewMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const url   = new URL(req.url);
  const count = parseInt(url.searchParams.get('installmentCount') ?? '1', 10);
  const dates = url.searchParams.getAll('dates[]');

  if (isNaN(count) || count < 1 || count > 12) {
    return NextResponse.json({ error: 'installmentCount must be between 1 and 12' }, { status: 400 });
  }
  if (dates.length > 0 && dates.length !== count) {
    return NextResponse.json({ error: 'Number of dates must match installmentCount' }, { status: 400 });
  }

  // What players actually FUND — not what the season costs.
  //
  // ⚠ This is the number a coach sees in the Generate Installments drawer and accepts, so it has
  // to agree with the budget page's own summary. Before 2026-08-12 it summed every budget line
  // and ignored the season estimate entirely, which meant a team that budgeted $4,000 of expected
  // fundraising against an $8,000 season was still offered $8,000 ÷ roster — the exact overcharge
  // that budgeting the funding exists to prevent.
  const { data: linesData } = await supabaseAdmin
    .from('rep_budget_lines')
    .select('total_amount, line_kind')
    .eq('program_year_id', programYear.id);

  const totals = computeBudgetTotals({
    lines: (linesData ?? []).map((l: { total_amount: number; line_kind?: string | null }) => ({
      totalAmount: l.total_amount ?? 0,
      lineKind: l.line_kind === 'funding' ? 'funding' : 'cost',
    })),
    estimatedTotal: programYear.budgetAmount ?? null,
  });
  const totalBudget = totals.fundedByPlayers;

  if (totalBudget <= 0) {
    // Three ways to arrive here, and the message has to name the RIGHT one — a coach told
    // "your funding covers the budget" when they have no funding lines at all will go looking
    // for a fundraiser that doesn't exist.
    const reason =
      totals.expectedFunding > 0 && totals.expectedFunding >= totals.totalPlanned
        ? 'Your expected funding covers the whole budget, so there is nothing for players to fund.'
        : totals.estimatedTotal != null && totals.totalPlanned <= 0
          ? 'Your estimated total is $0, so there is nothing for players to fund. Raise it or clear it to use your line items.'
          : 'Budget has no lines. Add at least one line before generating installments.';
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  // Active roster players
  const { data: players } = await supabaseAdmin
    .from('rep_roster_players')
    .select('id, player_first_name, player_last_name')
    .eq('program_year_id', programYear.id)
    .eq('status', 'active')
    .order('player_last_name');

  if (!players || players.length === 0) {
    return NextResponse.json({ error: 'No active roster players found for this program year.' }, { status: 400 });
  }

  const perPlayer   = totalBudget / players.length;
  const perInstallment = perPlayer / count;
  // Round each installment to 2dp; last installment absorbs rounding remainder
  const installmentAmounts = Array.from({ length: count }, (_, i) => {
    const base    = Math.round(perInstallment * 100) / 100;
    const already = base * i;
    return i === count - 1 ? Math.round((perPlayer - already) * 100) / 100 : base;
  });

  const preview: RepInstallmentPreviewRow[] = players.map(p => ({
    playerId:        p.id,
    playerFirstName: p.player_first_name,
    playerLastName:  p.player_last_name,
    installments:    installmentAmounts.map((amount, i) => ({
      installmentNumber: i + 1,
      dueDate:           dates[i] ?? '',
      amount,
    })),
  }));

  return NextResponse.json({
    preview,
    totalBudget,
    rosterCount:  players.length,
    perPlayer:    Math.round(perPlayer * 100) / 100,
    installmentCount: count,
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/budget-plan/installment-preview' });
