import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepPlayerDuesSchedules,
  getRepPlayerDuesInstallments,
  getRepTeamExpenses,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';

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
    return { error: NextResponse.json({ error: 'No active program year for this team' }, { status: 404 }) };
  }

  return { ctx, team, assignment, programYear };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/coaches/[orgSlug]/teams/[teamId]/money-summary
//
// One cash-honest summary for the Money hub. Money In / Money Out count only dollars
// that actually moved (paid installments, paid expense legs, paid allocation
// installments, APPROVED payment requests) so the hub always agrees with
// Budget vs. Actual, which uses the same paid-only semantics.
//
// Budget reconciliation (owner decision 2026-07-08): a coach may set a single season
// total (rep_program_years.budget_amount), itemize lines, or both. effectiveTotal =
// max(itemized, seasonTotal); a seasonTotal above the itemized sum surfaces as a
// "non-itemized buffer", never as silent disagreement.
//
// Note: rep_team_payment_requests has no program-year scoping — approved sums are
// team-lifetime. Acceptable under single-active-season semantics (documented in
// COACH_MONEY_HUB_REDESIGN_PLAN.md).
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { ctx, assignment, programYear } = resolved;
  const denied = denyUnless(canViewMoney(assignment.capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // ── Parallel loads ────────────────────────────────────────────────────────
  const [
    schedules,
    expenses,
    linesRes,
    rosterRes,
    creditsRes,
    fundraisersRes,
    splitsRes,
    requestsRes,
  ] = await Promise.all([
    getRepPlayerDuesSchedules(programYear.id),
    getRepTeamExpenses(programYear.id),
    supabaseAdmin
      .from('rep_budget_lines')
      .select('total_amount')
      .eq('program_year_id', programYear.id),
    supabaseAdmin
      .from('rep_roster_players')
      .select('id', { count: 'exact', head: true })
      .eq('program_year_id', programYear.id)
      .eq('status', 'active'),
    supabaseAdmin
      .from('rep_dues_credits')
      .select('player_id, amount')
      .eq('program_year_id', programYear.id),
    supabaseAdmin
      .from('rep_fundraisers')
      .select('id, is_active')
      .eq('program_year_id', programYear.id),
    supabaseAdmin
      .from('rep_allocation_splits')
      .select('id, amount')
      .eq('team_id', teamId)
      .eq('program_year_id', programYear.id),
    supabaseAdmin
      .from('rep_team_payment_requests')
      .select('request_type, amount, status')
      .eq('team_id', teamId),
  ]);

  // ── Dues ─────────────────────────────────────────────────────────────────
  const installmentLists = await Promise.all(schedules.map(s => getRepPlayerDuesInstallments(s.id)));
  const creditsByPlayer = new Map<string, number>();
  for (const c of (creditsRes.data ?? []) as Array<{ player_id: string; amount: number }>) {
    creditsByPlayer.set(c.player_id, (creditsByPlayer.get(c.player_id) ?? 0) + (c.amount ?? 0));
  }

  let duesExpected = 0;
  let duesCollected = 0;
  let overdueAmount = 0;
  const overduePlayers = new Set<string>();
  let neverPaidCount = 0;

  schedules.forEach((schedule, idx) => {
    const insts = installmentLists[idx] ?? [];
    duesExpected += schedule.totalAmount ?? 0;
    const paid = insts.filter(i => i.paidAt).reduce((s, i) => s + i.amount, 0);
    duesCollected += paid;
    for (const inst of insts) {
      if (!inst.paidAt && inst.dueDate && inst.dueDate < today) {
        overdueAmount += inst.amount;
        overduePlayers.add(schedule.playerId);
      }
    }
    // Mirror lib/dues-status isNeverPaidPlayer: owes dues (installments exist or a
    // positive outstanding balance after credits) with zero recorded payments.
    const credits = creditsByPlayer.get(schedule.playerId) ?? 0;
    const outstanding = (schedule.totalAmount ?? 0) - paid - credits;
    const hasDues = insts.length > 0 || outstanding > 0;
    if (hasDues && paid <= 0) neverPaidCount += 1;
  });

  // ── Expenses (paid-only semantics identical to budget-vs-actual) ─────────
  let expensesPaid = 0;
  let expensesUnpaidCount = 0;
  let upcomingDueCount = 0;
  for (const e of expenses) {
    if (e.expenseType === 'tournament_payable') {
      if (e.depositPaidAt) expensesPaid += e.depositAmount ?? 0;
      if (e.balancePaidAt) expensesPaid += e.balanceAmount ?? 0;
      if (!e.depositPaidAt || !e.balancePaidAt) expensesUnpaidCount += 1;
      // "Due soon" = inside the next 30 days only — already-overdue legs are the
      // UpcomingPayablesPanel's overdue lane, not a "soon" count.
      if (!e.depositPaidAt && e.depositDueDate && e.depositDueDate >= today && e.depositDueDate <= in30) upcomingDueCount += 1;
      if (!e.balancePaidAt && e.balanceDueDate && e.balanceDueDate >= today && e.balanceDueDate <= in30) upcomingDueCount += 1;
    } else {
      if (e.expensePaidAt) expensesPaid += e.amount;
      else expensesUnpaidCount += 1;
    }
  }

  // ── Fundraisers ──────────────────────────────────────────────────────────
  const fundraisers = (fundraisersRes.data ?? []) as Array<{ id: string; is_active: boolean }>;
  let fundraisingRaised = 0;
  let creditsIssued = 0;
  if (fundraisers.length > 0) {
    const { data: entries } = await supabaseAdmin
      .from('rep_fundraiser_entries')
      .select('amount_raised, rebate_amount')
      .in('fundraiser_id', fundraisers.map(f => f.id));
    for (const en of (entries ?? []) as Array<{ amount_raised: number; rebate_amount: number }>) {
      fundraisingRaised += en.amount_raised ?? 0;
      creditsIssued += en.rebate_amount ?? 0;
    }
  }

  // ── Org allocations ──────────────────────────────────────────────────────
  const splits = (splitsRes.data ?? []) as Array<{ id: string; amount: number }>;
  const totalAllocated = splits.reduce((s, sp) => s + (sp.amount ?? 0), 0);
  let allocationsPaid = 0;
  let allocationsOverdueCount = 0;
  if (splits.length > 0) {
    const { data: installs } = await supabaseAdmin
      .from('rep_allocation_installments')
      .select('amount, due_date, paid_at')
      .in('split_id', splits.map(s => s.id));
    for (const inst of (installs ?? []) as Array<{ amount: number; due_date: string | null; paid_at: string | null }>) {
      if (inst.paid_at) allocationsPaid += inst.amount ?? 0;
      else if (inst.due_date && inst.due_date < today) allocationsOverdueCount += 1;
    }
  }

  // ── Payment requests ─────────────────────────────────────────────────────
  const requests = (requestsRes.data ?? []) as Array<{ request_type: string; amount: number; status: string }>;
  const pendingRequestCount = requests.filter(rq => rq.status === 'pending').length;
  const orgFunding = requests
    .filter(rq => rq.status === 'approved' && rq.request_type === 'charge_to_org')
    .reduce((s, rq) => s + (rq.amount ?? 0), 0);
  const orgPayments = requests
    .filter(rq => rq.status === 'approved' && rq.request_type === 'payment_to_org')
    .reduce((s, rq) => s + (rq.amount ?? 0), 0);

  // ── Budget reconciliation ────────────────────────────────────────────────
  const lines = (linesRes.data ?? []) as Array<{ total_amount: number }>;
  const itemizedTotal = lines.reduce((s, l) => s + (l.total_amount ?? 0), 0);
  const seasonTotal = programYear.budgetAmount ?? null;
  const effectiveTotal = Math.max(itemizedTotal, seasonTotal ?? 0);
  const buffer = seasonTotal != null && seasonTotal > itemizedTotal ? seasonTotal - itemizedTotal : 0;
  const overItemized = seasonTotal != null && seasonTotal > 0 && itemizedTotal > seasonTotal;
  const rosterCount = rosterRes.count ?? 0;

  const { count: generatedCount } = schedules.length > 0
    ? await supabaseAdmin
        .from('rep_player_dues_installments')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'budget_generated')
        .in('schedule_id', schedules.map(s => s.id))
    : { count: 0 };

  // ── Totals + stage ───────────────────────────────────────────────────────
  const moneyInTotal = duesCollected + fundraisingRaised + orgFunding;
  const moneyOutTotal = expensesPaid + allocationsPaid + orgPayments;
  const headroom = effectiveTotal > 0 ? effectiveTotal - expensesPaid : null;

  const stage: 'plan' | 'collect' | 'operate' =
    schedules.length > 0 ? 'operate'
    : effectiveTotal > 0 ? 'collect'
    : 'plan';

  return NextResponse.json({
    stage,
    orgLinked: !isTeamWorkspaceOrg(ctx!.org),
    moneyIn: {
      duesCollected: r2(duesCollected),
      fundraisingRaised: r2(fundraisingRaised),
      orgFunding: r2(orgFunding),
      total: r2(moneyInTotal),
    },
    moneyOut: {
      expensesPaid: r2(expensesPaid),
      allocationsPaid: r2(allocationsPaid),
      orgPayments: r2(orgPayments),
      total: r2(moneyOutTotal),
    },
    onHand: r2(moneyInTotal - moneyOutTotal),
    headroom: headroom == null ? null : r2(headroom),
    budget: {
      seasonTotal: seasonTotal == null ? null : r2(seasonTotal),
      itemizedTotal: r2(itemizedTotal),
      effectiveTotal: r2(effectiveTotal),
      buffer: r2(buffer),
      overItemized,
      lineCount: lines.length,
      hasInstallments: (generatedCount ?? 0) > 0,
      rosterCount,
      perPlayer: rosterCount > 0 && effectiveTotal > 0 ? r2(effectiveTotal / rosterCount) : null,
    },
    dues: {
      expected: r2(duesExpected),
      collected: r2(duesCollected),
      outstanding: r2(duesExpected - duesCollected),
      overdueCount: overduePlayers.size,
      overdueAmount: r2(overdueAmount),
      neverPaidCount,
      schedulesCount: schedules.length,
    },
    fundraisers: {
      activeCount: fundraisers.filter(f => f.is_active).length,
      totalRaised: r2(fundraisingRaised),
      creditsIssued: r2(creditsIssued),
    },
    expenses: {
      paidTotal: r2(expensesPaid),
      loggedCount: expenses.length,
      unpaidCount: expensesUnpaidCount,
      upcomingDueCount,
    },
    allocations: {
      count: splits.length,
      totalAllocated: r2(totalAllocated),
      outstanding: r2(totalAllocated - allocationsPaid),
      overdueCount: allocationsOverdueCount,
    },
    paymentRequests: {
      pendingCount: pendingRequestCount,
    },
  });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/money-summary' });
