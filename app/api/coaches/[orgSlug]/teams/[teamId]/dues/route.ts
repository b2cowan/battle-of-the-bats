import { NextResponse } from 'next/server';
import { getAuthContext, unauthorized, forbidden } from '@/lib/api-auth';
import {
  getCoachingAssignmentsForUser,
  getRepTeam,
  getActiveRepProgramYear,
  getRepRosterPlayers,
  getRepPlayerDuesSchedules,
  getRepDuesInstallmentsBySchedules,
  getRepDuesPaymentsByProgramYear,
  getRepDuesPayoutsByProgramYear,
  getRepDuesPaymentsForPlayer,
  upsertRepPlayerDuesSchedule,
  syncDuesPaidProjection,
  reconcileOverpaymentCredits,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney, canWriteMoney, redactRosterPlayer } from '@/lib/coach-capabilities';
import { outstandingForSchedule } from '@/lib/dues-status';
import { duesPaidAmount } from '@/lib/dues-payments';
import { creditsTotal, amountsTotal, deriveDuesPosition, groupByPlayer, payoutCeiling } from '@/lib/dues-credits';
import { tournamentToday } from '@/lib/timezone';
import { resolveCoachTeamRead } from '@/lib/coach-team-read';

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

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachTeamRead(orgSlug, teamId);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const [rosterPlayers, schedules, allPayments, allPayouts] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepPlayerDuesSchedules(programYear.id),
    getRepDuesPaymentsByProgramYear(programYear.id),
    getRepDuesPayoutsByProgramYear(programYear.id),
  ]);
  // Cash already handed back (mig 234): those dollars are settled, so they stop lowering bills.
  // One grouping; each player's total comes off their own rows at the point of use.
  const payoutsByPlayer = groupByPlayer(allPayouts);

  const scheduleMap = new Map(schedules.map(s => [s.playerId, s]));

  // ONE batched query for the whole roster's installments (the per-schedule helper here was a
  // 12–20-query N+1 — the same batched helper the digest and Ask already use).
  const allInstallments = await getRepDuesInstallmentsBySchedules(schedules.map(s => s.id));
  const installmentsBySchedule = new Map<string, typeof allInstallments>();
  for (const i of allInstallments) {
    if (!installmentsBySchedule.has(i.scheduleId)) installmentsBySchedule.set(i.scheduleId, []);
    installmentsBySchedule.get(i.scheduleId)!.push(i);
  }

  const paymentsMap = new Map<string, typeof allPayments>();
  for (const p of allPayments) {
    if (!paymentsMap.has(p.playerId)) paymentsMap.set(p.playerId, []);
    paymentsMap.get(p.playerId)!.push(p);
  }

  // Fetch all credits for this program year in one query
  const { data: allCredits } = await supabaseAdmin
    .from('rep_dues_credits')
    .select('*')
    .eq('program_year_id', programYear.id)
    .order('credit_date', { ascending: false });

  const creditsMap = new Map<string, Array<Record<string, unknown>>>();
  for (const c of (allCredits ?? []) as Array<Record<string, unknown>>) {
    const pid = c.player_id as string;
    if (!creditsMap.has(pid)) creditsMap.set(pid, []);
    creditsMap.get(pid)!.push(c);
  }

  const playersWithDues = await Promise.all(
    rosterPlayers.map(async p => {
      const schedule = scheduleMap.get(p.id) ?? null;
      const installments = schedule ? (installmentsBySchedule.get(schedule.id) ?? []) : [];
      const payments = paymentsMap.get(p.id) ?? [];
      const paymentsTotal = payments.reduce((s, pay) => s + pay.amount, 0);
      // Paid = recorded payment FACTS (mig 232), capped at the schedule total — the auto-created
      // overpayment credit already carries the excess, and counting it twice would push a family
      // "In credit" twice over. The stamps on installments are only a projection of coverage.
      const paidAmount = schedule ? duesPaidAmount(paymentsTotal, schedule.totalAmount) : 0;
      // ONE shared definition (lib/dues-status.ts) — this figure is also quoted by the weekly
      // digest and by an Ask the Front Office answer, and three hand-copies each promised in a
      // comment that they matched, with nothing enforcing it.
      const outstanding = outstandingForSchedule(schedule, paidAmount);
      // Per-installment coverage for the drawer's "$200.00 of $300.00" chips, plus the credit
      // position over the remainders — ONE assembly (lib/dues-credits.ts deriveDuesPosition),
      // shared with every other dues reader so they cannot drift.

      const rawCredits = creditsMap.get(p.id) ?? [];
      const credits = rawCredits.map(c => ({
        id:          c.id,
        programYearId: c.program_year_id,
        playerId:    c.player_id,
        amount:      c.amount,
        description: c.description,
        creditDate:  c.credit_date,
        creditType:  c.credit_type,
        notes:       c.notes ?? null,
        paymentId:   c.payment_id ?? null,
        createdAt:   c.created_at,
      }));
      // ONE credit definition (lib/dues-credits.ts) — one of five hand-copied credit sums.
      const creditsIssuedTotal = creditsTotal(credits.map(c => ({ amount: c.amount as number })));

      // Credits land on bills (owner model 2026-08-14): derived over the CASH remainders, in the
      // team's chosen direction. Cash always claims a bill before a credit does — recompute after
      // any payment/credit/schedule change and the answer is simply true again.
      const { coverage, position } = deriveDuesPosition({
        installments: schedule ? installments : [],
        payments,
        credits: credits.map(c => ({
          id: c.id as string,
          amount: c.amount as number,
          creditType: c.creditType as string,
          creditDate: c.creditDate as string,
          createdAt: (c.createdAt as string | null) ?? null,
          description: (c.description as string | null) ?? null,
        })),
        paidOut: amountsTotal(payoutsByPlayer.get(p.id) ?? []),
        mode: programYear.creditApplication,
      });
      const creditCoverageById = new Map(position.perInstallment.map(c => [c.installmentId, c]));

      // ⚠ A CREDIT HANDED BACK IN CASH NO LONGER REDUCES WHAT THIS FAMILY OWES. The Credits
      // column, the Balance column, the drawer stat, the season-totals footer and the dues export
      // all read these two figures, and showing the GROSS credit after a payout tells a coach a
      // family's dues are lowered by money they have already been given (/review 2026-08-14).
      const totalCredits = Math.max(0, Math.round((creditsIssuedTotal - position.paidOut) * 100) / 100);
      const rollingBalance = Math.round((outstanding - totalCredits) * 100) / 100;

      // ⚠ `remainingAmount` is the NET figure since Pass 1 of the credit model — the cash
      // remainder MINUS credits applied: what the family is actually asked to send. Every
      // downstream quoting surface (Insights dues line, digest, By-installment lens) reads this
      // field precisely so "the figure reminders chase" changes in one place. The raw cash
      // remainder stays available per installment in `coverage`.
      const installmentsOut = installments.map(i => {
        const cc = creditCoverageById.get(i.id);
        return {
          ...i,
          remainingAmount: cc?.toSend ?? i.amount,
          creditApplied: cc?.creditApplied ?? 0,
          // Settled by the server's own definition — the UI must never re-derive this predicate
          // (it branches the status pill; a client-side threshold would silently drift).
          creditSettled: cc?.settled ?? false,
          creditSources: cc?.sources ?? [],
        };
      });

      return {
        // Money access and guardian-PII access are independent grants — redact PII/notes for a
        // money-cleared coach who lacks the PII grant (the dues table shows a guardian identifier).
        player: redactRosterPlayer(p, capabilities),
        schedule,
        installments: installmentsOut,
        payments,
        coverage,
        paidAmount,
        outstanding,
        credits,
        totalCredits: Math.round(totalCredits * 100) / 100,
        rollingBalance,
        // The three-state position (owner model 2026-08-14): what credits did, per player.
        leftToSend: position.leftToSend,
        creditApplied: Math.round((position.applied + position.forgivenApplied) * 100) / 100,
        owedBack: position.owedBack,
        // The outbox (mig 234): what has been handed back, and what still could be.
        payouts: payoutsByPlayer.get(p.id) ?? [],
        paidOut: position.paidOut,
        // ⚠ PAYABLE ≠ OWED-BACK. A credit sitting ON a bill can still be handed over in cash —
        // the bill simply goes back up (binding mockup §5: Riley's $500 is applied to #4 and the
        // sheet still pays it out). Gating the button on owedBack would hide it in exactly the
        // case the mockup draws. Forgiveness is excluded: never the family's money.
        payableNow: payoutCeiling(
          credits.map(c => ({ amount: c.amount as number, creditType: c.creditType as string })),
          payoutsByPlayer.get(p.id) ?? [],
        ),
      };
    }),
  );

  return NextResponse.json({ players: playersWithDues, creditApplication: programYear.creditApplication });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/dues' });

export const POST = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachContext(orgSlug, teamId);
  if ('error' in resolved) return resolved.error!;
  const { team, assignment, programYear } = resolved;
  const denied = denyUnless(canWriteMoney(assignment.capabilities), 'You do not have permission to change team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const body = await req.json();
  const { playerId, totalAmount, notes = null, installments } = body;

  if (!playerId || typeof totalAmount !== 'number' || totalAmount <= 0) {
    return NextResponse.json({ error: 'playerId and totalAmount > 0 are required' }, { status: 400 });
  }
  if (!Array.isArray(installments) || !installments.length) {
    return NextResponse.json({ error: 'At least one installment is required' }, { status: 400 });
  }

  const installmentSum = installments.reduce((s: number, i: any) => s + Number(i.amount), 0);
  if (Math.abs(installmentSum - totalAmount) > 0.01) {
    return NextResponse.json(
      { error: `Installment amounts (${installmentSum}) must sum to totalAmount (${totalAmount})` },
      { status: 400 },
    );
  }

  const result = await upsertRepPlayerDuesSchedule({
    programYearId: programYear.id,
    playerId,
    teamId: team.id,
    orgId: team.orgId,
    totalAmount,
    notes,
    installments: installments.map((i: any, idx: number) => ({
      installmentNumber: i.installmentNumber ?? idx + 1,
      amount: Number(i.amount),
      dueDate: i.dueDate,
    })),
  });

  // The plan changed under recorded money (mig 232): re-project coverage onto the fresh rows,
  // and reconcile the automatic overpayment credit BOTH ways — before this, editing one player's
  // total below what their family had sent silently capped the difference out of every figure
  // (review 2026-08-13, Critical 2), and only the bulk path did any of this.
  const playerPayments = await getRepDuesPaymentsForPlayer(programYear.id, playerId);
  if (playerPayments.length > 0) {
    await syncDuesPaidProjection(programYear.id, playerId);
    await reconcileOverpaymentCredits({
      programYearId: programYear.id,
      playerId,
      scheduleTotal: totalAmount,
      paymentsTotal: Math.round(playerPayments.reduce((s, p) => s + Math.round(p.amount * 100), 0)) / 100,
      creditDate: tournamentToday(),
      createdBy: resolved.ctx!.user.id,
      paymentId: null,
    });
  }

  return NextResponse.json(result, { status: 201 });
}, { route: '/api/coaches/[orgSlug]/teams/[teamId]/dues' });
