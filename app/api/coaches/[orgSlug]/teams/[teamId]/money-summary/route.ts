import { NextResponse } from 'next/server';
import {
  getRepPlayerDuesSchedules,
  getRepPlayerDuesInstallments,
  getRepDuesPaymentsByProgramYear,
  getRepDuesCreditsByProgramYear,
  getRepDuesPayoutsByProgramYear,
  getRepTeamExpenses,
  getRepTeamMoneyIn,
  getSeasonFundraiserEntries,
  getCommitmentStandings,
} from '@/lib/db';
import { isNeverPaidPlayer, outstandingForSchedule } from '@/lib/dues-status';
import { duesPaidAmount } from '@/lib/dues-payments';
import { deriveDuesPosition, groupByPlayer, totalsByPlayer, amountsTotal } from '@/lib/dues-credits';
import { expenseTotals } from '@/lib/season-settlement';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isTeamWorkspaceOrg } from '@/lib/team-workspace-entitlements';
import { withObservability } from '@/lib/observability';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';
import { denyUnless, canViewMoney } from '@/lib/coach-capabilities';
import { computeBudgetTotals, normalizeBudgetLineKind, isFundingKind } from '@/lib/coach-budget-totals';
import { tournamentToday } from '@/lib/timezone';
import { cashOnHandCents, toCents, toDollars } from '@/lib/coach-register';

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
// ⚠⚠ THIS ROUTE AND `/register` ARE A MATCHED PAIR (money redesign P3, 2026-08-17). The register's
// whole design rests on its running balance at Today BEING this route's `onHand`, decomposed into
// the movements that produced it — so a source counted here and not there, or there and not here,
// breaks that identity silently while both figures still look plausible. **Touch one, read the
// other.** Three things were already broken when the register was built, and all three are fixed
// here rather than worked around in the screen:
//
//   1. ⚠⚠ RECORDED INCOME AND MONEY BACK WERE NOT COUNTED AT ALL. `rep_team_money_in` (mig 243) was
//      read by nothing behind this figure, so a coach could record $500 arriving and watch Cash on
//      hand not move. It reached Budget vs. Actual as revenue and stopped there. The writer's own
//      comment said the opposite ("CASH ON HAND, NOT COLLECTIONS") — the reader was never wired.
//   2. THE DUES FIGURE WAS THE CAPPED ONE. `duesCollected` is capped at each schedule total so an
//      overpayment cannot distort a BALANCE, which is right for the Collections tile and wrong for
//      cash: the money physically arrived and the team is holding it. Cash now uses the uncapped
//      receipts (`duesReceived`), exactly as the season close-out pot always has.
//   3. CLUB REQUESTS WERE TEAM-LIFETIME. They carried no season at all; migration 247 gives them
//      one, so a team in its second year stops reading last year's club money as this year's cash.
export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
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
    moneyInRecords,
    standings,
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
      .select('id, is_active, kind, sponsor_status, pledged_amount, expected_by')
      .eq('program_year_id', programYear.id),
    supabaseAdmin
      .from('rep_allocation_splits')
      .select('id, amount')
      .eq('team_id', teamId)
      .eq('program_year_id', programYear.id),
    // Season-scoped since migration 247 — see note 3 in the header.
    supabaseAdmin
      .from('rep_team_payment_requests')
      .select('request_type, amount, status')
      .eq('team_id', teamId)
      .eq('program_year_id', programYear.id),
    getRepTeamMoneyIn(programYear.id),
    /* Where every commitment stands (Payables Rebuild P1). ⚠ THIS ROUTE AND THE REGISTER ARE A
       MATCHED PAIR — the book's running balance at Today IS this route's cash on hand — so both
       read the SAME standing rather than each deciding for itself what a commitment has paid. */
    getCommitmentStandings(programYear.id),
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
  // Families whose money the team is holding (owedBack) — the recording conversation's
  // "paid a family back" hint. Same position walk as overdue; see the type's own note.
  let familiesInCreditCount = 0;
  let familyCreditHeld = 0;

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
    if (position.owedBack > 0.005) {
      familiesInCreditCount += 1;
      familyCreditHeld += position.owedBack;
    }
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
  // ⚠ THE TWO MONEY FIGURES COME FROM THE SHARED HELPER (lib/season-settlement.ts
  // `expenseTotals`) — the settlement pot reads the same one, so the hub's cash line and the
  // season's pot cannot disagree about what left the team's account. This loop keeps only the
  // COUNTS, which are this screen's own question and nobody else's.
  const { paid: expensesPaid, cashPaid: expensesCashPaid } = expenseTotals(expenses, standings);
  let expensesUnpaidCount = 0;
  let upcomingDueCount = 0;
  /* ⚠ R4 — SETTLED MEANS PAID IN FULL, so a commitment with $200 against its $600 is counted here
     as one still to deal with, and its piece still counts as due. Reading it the other way is how a
     screen understates what a team owes: the old boolean per half could only say "paid" or "not",
     so a part payment had to be recorded as one or the other and coaches recorded it as PAID. */
  for (const e of expenses) {
    const standing = standings[e.id];
    if (!standing) continue;
    if (standing.state !== 'settled') expensesUnpaidCount += 1;
    if (e.expenseType !== 'tournament_payable') continue;
    for (const inst of standing.installments) {
      // "Due soon" = inside the next 30 days only — anything already overdue is the
      // UpcomingPayablesPanel's overdue lane, not a "soon" count.
      if (inst.state === 'settled') continue;
      if (inst.dueDate >= today && inst.dueDate <= in30) upcomingDueCount += 1;
    }
  }
  // Money handed back to families is real money out (mig 234).
  const payoutsTotal = amountsTotal(seasonPayouts);

  // ── Recorded arrivals: income and money back (mig 243) ───────────────────
  // ⚠⚠ BOTH KINDS RAISE CASH, and neither is "collections". Income is money the team earned or was
  // given; money back is the team's own cash returning. They are opposites on the REPORT — a refund
  // nets into the row it repaid rather than counting as revenue — but on a cash line they are the
  // same event: a dollar arrived. Splitting them here keeps the report's distinction available to
  // any caller that needs it without letting the cash figure lose either one.
  let recordedIncome = 0;
  let recordedMoneyBack = 0;
  for (const m of moneyInRecords) {
    if (m.kind === 'money_back') recordedMoneyBack += m.amount;
    else recordedIncome += m.amount;
  }

  // ── Fundraising: drives and sponsors, counted apart ──────────────────────
  const fundraisers = (fundraisersRes.data ?? []) as Array<{
    id: string; is_active: boolean; kind?: string | null;
    sponsor_status?: string | null; pledged_amount?: number | string | null;
    expected_by?: string | null;
  }>;
  let fundraisingRaised = 0;
  let creditsIssued = 0;
  let driveRaised = 0;
  let sponsorReceived = 0;
  let sponsorPledged = 0;
  // Q13 (mig 269): promises past their expected-by with money still to come — a COUNT for the
  // overview's one quiet clause, never a reminder.
  let sponsorPledgesPastDue = 0;
  const arrivedBySponsor = new Map<string, number>();
  if (fundraisers.length > 0) {
    for (const en of await getSeasonFundraiserEntries(programYear.id)) {
      /**
       * ⚠ Since mig 268 every entry IS money — a pledged sponsor has no entries at all (its
       * promise lives in `pledged_amount`, summed below). The realised belt stays anyway: if a
       * pledged row ever exists again it must not count as banked, which was the review's worst
       * finding (2026-08-15).
       */
      if (!en.realised) continue;
      fundraisingRaised += en.amountRaised;
      creditsIssued += en.rebateAmount;
      if (en.kind === 'sponsor') {
        sponsorReceived += en.amountRaised;
        arrivedBySponsor.set(en.fundraiserId, (arrivedBySponsor.get(en.fundraiserId) ?? 0) + en.amountRaised);
      } else {
        driveRaised += en.amountRaised;
      }
    }
    /**
     * ⚠ THE PLEDGE FIGURE READS THE COLUMN, NOT ENTRIES (mig 268 reader flip), and it is a
     * LABEL, not a total — nothing below adds `sponsorPledged` to anything. It is what is STILL
     * TO COME: each sponsor's promise minus what has arrived, floored at zero, so a part-paid
     * pledge reads "$250 in · $250 pledged" rather than flattering the season with both.
     */
    for (const f of fundraisers) {
      if ((f.kind ?? 'fundraiser') !== 'sponsor') continue;
      const pledged = f.pledged_amount != null ? Number(f.pledged_amount) : 0;
      if (pledged <= 0) continue;
      const arrived = arrivedBySponsor.get(f.id) ?? 0;
      const remaining = Math.max(0, Math.round((pledged - arrived) * 100) / 100);
      sponsorPledged += remaining;
      if (remaining > 0.005 && f.expected_by && f.expected_by < today) sponsorPledgesPastDue += 1;
    }
  }
  const driveCount = fundraisers.filter(f => (f.kind ?? 'fundraiser') !== 'sponsor').length;
  const sponsorCount = fundraisers.filter(f => f.kind === 'sponsor').length;

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
      lineKind: normalizeBudgetLineKind(l.line_kind),
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
  // ⚠ THE UNCAPPED RECEIPTS, for the reason in note 2 of the header: `duesCollected` is capped at
  // each schedule's total so an overpayment cannot distort a balance, and it is also computed
  // per SCHEDULE — so a payment recorded against a player who has no schedule is invisible to it.
  // Neither is right for cash. This is the same figure the season close-out pot has always used.
  const duesReceived = amountsTotal(seasonPayments);
  const moneyInTotal = duesReceived + fundraisingRaised + orgFunding + recordedIncome + recordedMoneyBack;
  // Money OUT is a CASH question — out-of-pocket costs never left the team's account, and money
  // handed back to families did. Headroom stays a BUDGET question, so it keeps the full spend.
  const moneyOutTotal = expensesCashPaid + allocationsPaid + orgPayments + payoutsTotal;
  const headroom = effectiveTotal > 0 ? effectiveTotal - expensesPaid : null;

  /**
   * ⚠⚠ CASH ON HAND COMES FROM THE REGISTER'S OWN ARITHMETIC, and this list IS the contract.
   *
   * It used to be `r2(moneyInTotal - moneyOutTotal)` — a float subtraction of two float sums, sitting
   * a whole route away from the function that decides what the register's closing balance is. The two
   * agreed only because someone kept them agreeing, which is precisely how this figure came to be
   * wrong in three separate ways before 2026-08-17. Handing the same categories to
   * `cashOnHandCents` makes them ONE arithmetic in integer cents: a source added here and not to
   * `/register` (or the reverse) is now a visibly missing entry rather than a silent penny-drift.
   *
   * ⚠ `movesCash: true` ON EVERY ENTRY, and that is not a rubber stamp. These are the cash figures
   * already — `expensesCashPaid` has out-of-pocket costs stripped out of it upstream, which is the
   * same decision the register expresses per row with `movesCash: false`. Passing the BUDGET spend
   * here instead would subtract money the team is still holding.
   *
   * ⚠ Nothing here is `scheduled`. This route reports what has moved; the projection lives on the
   * register, where a coach can see the rows it is made of.
   */
  /* ⚠⚠ AND IT STARTS FROM WHAT THE SEASON WAS HANDED (mig 262). The opening balance is not a
     movement and never becomes an entry in this list — it is where the sum starts, exactly as it is
     on the register. ⚠ THE PAIR MOVES TOGETHER OR THE SURFACES ARGUE: `/register` passes the same
     figure into `buildBook`, and `check:register` fails loudly if one of the two forgets. */
  const onHand = toDollars(cashOnHandCents([
    { moneyIn: duesReceived,       moneyOut: 0,                 movesCash: true, scheduled: false },
    { moneyIn: fundraisingRaised,  moneyOut: 0,                 movesCash: true, scheduled: false },
    { moneyIn: orgFunding,         moneyOut: 0,                 movesCash: true, scheduled: false },
    { moneyIn: recordedIncome,     moneyOut: 0,                 movesCash: true, scheduled: false },
    { moneyIn: recordedMoneyBack,  moneyOut: 0,                 movesCash: true, scheduled: false },
    { moneyIn: 0,                  moneyOut: expensesCashPaid,  movesCash: true, scheduled: false },
    { moneyIn: 0,                  moneyOut: allocationsPaid,   movesCash: true, scheduled: false },
    { moneyIn: 0,                  moneyOut: orgPayments,       movesCash: true, scheduled: false },
    { moneyIn: 0,                  moneyOut: payoutsTotal,      movesCash: true, scheduled: false },
  ], toCents(programYear.openingBalance ?? 0)));

  const stage: 'plan' | 'collect' | 'operate' =
    schedules.length > 0 ? 'operate'
    : effectiveTotal > 0 ? 'collect'
    : 'plan';

  return NextResponse.json({
    stage,
    orgLinked: !isTeamWorkspaceOrg(ctx!.org),
    moneyIn: {
      /** The COLLECTIONS figure — capped per schedule. Not what the cash line adds up. */
      duesCollected: r2(duesCollected),
      /** What actually arrived from families, uncapped — the cash line's dues input. */
      duesReceived: r2(duesReceived),
      fundraisingRaised: r2(fundraisingRaised),
      orgFunding: r2(orgFunding),
      recordedIncome: r2(recordedIncome),
      recordedMoneyBack: r2(recordedMoneyBack),
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
    onHand,
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
      familiesInCreditCount,
      familyCreditHeld: r2(familyCreditHeld),
    },
    fundraisers: {
      // "Active" is a DRIVE's question — a sponsor answers pledged/received instead, and every
      // sponsor row carries is_active true by column default, so counting them here would have
      // reported "3 active" on a team running no drives at all.
      activeCount: fundraisers.filter(f => f.is_active && (f.kind ?? 'fundraiser') !== 'sponsor').length,
      totalRaised: r2(fundraisingRaised),
      creditsIssued: r2(creditsIssued),
      driveCount,
      driveRaised: r2(driveRaised),
      sponsorCount,
      sponsorReceived: r2(sponsorReceived),
      sponsorPledged: r2(sponsorPledged),
      sponsorPledgesPastDue,
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
