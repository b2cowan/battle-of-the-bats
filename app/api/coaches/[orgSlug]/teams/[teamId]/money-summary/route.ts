import { NextResponse } from 'next/server';
import {
  getRepPlayerDuesSchedules,
  getRepPlayerDuesInstallments,
  getRepDuesPaymentsByProgramYear,
  getRepDuesCreditsByProgramYear,
  getRepDuesPayoutsByProgramYear,
  getRepTeamExpenses,
} from '@/lib/db';
import { isNeverPaidPlayer, outstandingForSchedule } from '@/lib/dues-status';
import { duesPaidAmount } from '@/lib/dues-payments';
import { deriveDuesPosition, groupByPlayer, totalsByPlayer, amountsTotal } from '@/lib/dues-credits';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { withObservability } from '@/lib/observability';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { computeBudgetTotals } from '@/lib/coach-budget-totals';
import { tournamentToday } from '@/lib/timezone';

const r2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/coaches/[orgSlug]/teams/[teamId]/money-summary
//
// One cash-honest summary for the Money hub. Money In / Money Out count only dollars
// that actually moved (paid installments, paid expense legs, paid allocation
// installments, APPROVED payment requests) so the hub always agrees with
// Budget vs. Actual, which uses the same paid-only semantics.
//
// Budget reconciliation (owner ruling 2026-08-12, superseding 2026-07-08): a coach may set an
// optional ESTIMATED total (rep_program_years.budget_amount), itemize lines, or both.
// effectiveTotal is the ESTIMATE whenever one is set — in both directions. It used to be
// max(itemized, estimate), which stored a lower estimate and then ignored it everywhere. A
// budget line is also now a COST or EXPECTED FUNDING; funding never counts toward what the
// season costs, only toward what players don't have to fund. All of it in one shared module.
//
// Note: rep_team_payment_requests has no program-year scoping — approved sums are
// team-lifetime. Acceptable under single-active-season semantics (documented in
// COACH_MONEY_HUB_REDESIGN_PLAN.md).
export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in resolved) return resolved.error;
  const { ctx, capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const today = tournamentToday();
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // ── Parallel loads ────────────────────────────────────────────────────────
  const [
    schedules,
    expenses,
    linesRes,
    rosterRes,
    fundraisersRes,
    splitsRes,
    requestsRes,
  ] = await Promise.all([
    getRepPlayerDuesSchedules(programYear.id),
    getRepTeamExpenses(programYear.id),
    supabaseAdmin
      .from('rep_budget_lines')
      .select('total_amount, line_kind')
      .eq('program_year_id', programYear.id),
    supabaseAdmin
      .from('rep_roster_players')
      .select('id', { count: 'exact', head: true })
      .eq('program_year_id', programYear.id)
      .eq('status', 'active'),
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
  const [installmentLists, seasonPayments, seasonCredits, seasonPayouts] = await Promise.all([
    Promise.all(schedules.map(s => getRepPlayerDuesInstallments(s.id))),
    getRepDuesPaymentsByProgramYear(programYear.id),
    getRepDuesCreditsByProgramYear(programYear.id),
    getRepDuesPayoutsByProgramYear(programYear.id),
  ]);
  const paidOutByPlayer = totalsByPlayer(seasonPayouts);
  const paymentsByPlayer = new Map<string, typeof seasonPayments>();
  for (const p of seasonPayments) {
    if (!paymentsByPlayer.has(p.playerId)) paymentsByPlayer.set(p.playerId, []);
    paymentsByPlayer.get(p.playerId)!.push(p);
  }
  const creditsByPlayer = groupByPlayer(seasonCredits);

  let duesExpected = 0;
  let duesCollected = 0;
  let overdueAmount = 0;
  const overduePlayers = new Set<string>();
  let neverPaidCount = 0;

  schedules.forEach((schedule, idx) => {
    const insts = installmentLists[idx] ?? [];
    duesExpected += schedule.totalAmount ?? 0;
    // Paid = payment FACTS (mig 232), capped at the schedule total — same figure as the dues
    // route, the digest and Ask, so the Collections tile can never disagree with the table.
    const payments = paymentsByPlayer.get(schedule.playerId) ?? [];
    const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0);
    const paid = duesPaidAmount(paymentsTotal, schedule.totalAmount ?? 0);
    duesCollected += paid;
    // Overdue counts what is still left to SEND on a late installment — cash remainder minus
    // credits applied (owner model 2026-08-14) — never a face value, and never a dollar
    // fundraising already covered. A family $200 into a late $300 installment is $100 overdue.
    const { position, toSendById } = deriveDuesPosition({
      installments: insts,
      payments,
      credits: creditsByPlayer.get(schedule.playerId) ?? [],
      paidOut: paidOutByPlayer.get(schedule.playerId) ?? 0,
      mode: programYear.creditApplication,
    });
    for (const inst of insts) {
      if (!inst.paidAt && inst.dueDate && inst.dueDate < today) {
        const remaining = toSendById.get(inst.id) ?? inst.amount;
        if (remaining > 0.005) {
          overdueAmount += remaining;
          overduePlayers.add(schedule.playerId);
        }
      }
    }
    // The SHARED predicate at last (it used to be hand-mirrored here — and the mirror had
    // drifted: it subtracted credits from "has dues" where the real one deliberately doesn't).
    if (isNeverPaidPlayer({
      outstanding: outstandingForSchedule(schedule, paid),
      paidAmount: paymentsTotal,
      leftToSend: position.leftToSend,
      installments: insts,
    })) neverPaidCount += 1;
  });

  // ── Expenses (paid-only semantics identical to budget-vs-actual) ─────────
  // ⚠ TWO figures, deliberately different (owner Call 5, plan §4.3). `expensesPaid` is what the
  // SEASON COST and is what Budget vs. Actual compares against — an out-of-pocket cost is real
  // spending and belongs in it. `expensesCashPaid` is what actually LEFT THE TEAM'S ACCOUNT, and
  // excludes anything a family covered directly: no team cash moved, so counting it in the cash
  // line would subtract money the team is still holding.
  let expensesPaid = 0;
  let expensesCashPaid = 0;
  let expensesUnpaidCount = 0;
  let upcomingDueCount = 0;
  for (const e of expenses) {
    if (e.expenseType === 'tournament_payable') {
      // A payable is billed to the team by a third party; there is no out-of-pocket leg.
      if (e.depositPaidAt) { expensesPaid += e.depositAmount ?? 0; expensesCashPaid += e.depositAmount ?? 0; }
      if (e.balancePaidAt) { expensesPaid += e.balanceAmount ?? 0; expensesCashPaid += e.balanceAmount ?? 0; }
      if (!e.depositPaidAt || !e.balancePaidAt) expensesUnpaidCount += 1;
      // "Due soon" = inside the next 30 days only — already-overdue legs are the
      // UpcomingPayablesPanel's overdue lane, not a "soon" count.
      if (!e.depositPaidAt && e.depositDueDate && e.depositDueDate >= today && e.depositDueDate <= in30) upcomingDueCount += 1;
      if (!e.balancePaidAt && e.balanceDueDate && e.balanceDueDate >= today && e.balanceDueDate <= in30) upcomingDueCount += 1;
    } else {
      if (e.expensePaidAt) {
        expensesPaid += e.amount;
        if (!e.paidByPlayerId) expensesCashPaid += e.amount;
      } else expensesUnpaidCount += 1;
    }
  }
  // Money handed back to families is real money out (mig 234).
  const payoutsTotal = amountsTotal(seasonPayouts);

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
  // ONE arithmetic, shared with the planner and Budget vs. Actual (lib/coach-budget-totals).
  // Doing it inline in three routes is what let them disagree about the same two numbers.
  const lines = (linesRes.data ?? []) as Array<{ total_amount: number; line_kind?: string | null }>;
  const rosterCount = rosterRes.count ?? 0;
  const totals = computeBudgetTotals({
    lines: lines.map(l => ({
      totalAmount: l.total_amount ?? 0,
      lineKind: l.line_kind === 'funding' ? 'funding' : 'cost',
    })),
    estimatedTotal: programYear.budgetAmount ?? null,
    rosterCount,
  });
  const seasonTotal = totals.estimatedTotal;
  const itemizedTotal = totals.itemized;
  const effectiveTotal = totals.totalPlanned;

  const { count: generatedCount } = schedules.length > 0
    ? await supabaseAdmin
        .from('rep_player_dues_installments')
        .select('id', { count: 'exact', head: true })
        .eq('source', 'budget_generated')
        .in('schedule_id', schedules.map(s => s.id))
    : { count: 0 };

  // ── Totals + stage ───────────────────────────────────────────────────────
  const moneyInTotal = duesCollected + fundraisingRaised + orgFunding;
  // Money OUT is a CASH question — out-of-pocket costs never left the team's account, and money
  // handed back to families did. Headroom stays a BUDGET question, so it keeps the full spend.
  const moneyOutTotal = expensesCashPaid + allocationsPaid + orgPayments + payoutsTotal;
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
      // The cash figure, matching the total beside it (the budget's own spend is `expenses.paidTotal`).
      expensesPaid: r2(expensesCashPaid),
      duesPaidOut: r2(payoutsTotal),
      allocationsPaid: r2(allocationsPaid),
      orgPayments: r2(orgPayments),
      total: r2(moneyOutTotal),
    },
    onHand: r2(moneyInTotal - moneyOutTotal),
    headroom: headroom == null ? null : r2(headroom),
    budget: {
      seasonTotal,
      itemizedTotal,
      effectiveTotal,
      /** The un-itemized part of the estimate. Now SIGNED: negative means the lines have
       *  outgrown the estimate, which used to be reported as a separate boolean and a total
       *  that quietly ignored the coach's own number. */
      buffer: totals.difference,
      overItemized: totals.overPlanned,
      expectedFunding: totals.expectedFunding,
      fundedByPlayers: totals.fundedByPlayers,
      // COST lines: the count captions "6 lines" next to what the season costs.
      lineCount: totals.costLineCount,
      fundingLineCount: totals.fundingLineCount,
      hasInstallments: (generatedCount ?? 0) > 0,
      rosterCount,
      // Off what players FUND, not off gross cost — budgeting expected funding exists precisely
      // so this number comes down. ⚠ No extra gate on top of the shared module: this route used to
      // add `&& effectiveTotal > 0`, which meant a team holding only a funding line got a figure
      // on the budget page and none here, for identical data.
      perPlayer: totals.perPlayer,
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
