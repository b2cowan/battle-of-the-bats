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
  getRepDuesPaymentsForPlayer,
  upsertRepPlayerDuesSchedule,
  syncDuesPaidProjection,
  reconcileOverpaymentCredits,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { denyUnless, canViewMoney, canWriteMoney, redactRosterPlayer } from '@/lib/coach-capabilities';
import { outstandingForSchedule } from '@/lib/dues-status';
import { allocateDuesPayments, duesPaidAmount } from '@/lib/dues-payments';
import { tournamentToday } from '@/lib/timezone';
import { resolveCoachSeasonRead } from '@/lib/coach-season-read';

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

export const GET = withObservability(async (req: Request,
  { params }: { params: Promise<{ orgSlug: string; teamId: string }> },) => {
  const { orgSlug, teamId } = await params;
  const resolved = await resolveCoachSeasonRead(orgSlug, teamId, req);
  if ('error' in resolved) return resolved.error;
  const { capabilities, programYear } = resolved;
  const denied = denyUnless(canViewMoney(capabilities), 'You do not have access to team finances. Ask the head coach to grant it.');
  if (denied) return denied;

  const [rosterPlayers, schedules, allPayments] = await Promise.all([
    getRepRosterPlayers(programYear.id),
    getRepPlayerDuesSchedules(programYear.id),
    getRepDuesPaymentsByProgramYear(programYear.id),
  ]);

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
      // Per-installment coverage for the drawer's "$200.00 of $300.00" chips — and each
      // installment carries its own remainder so downstream shapings (the Insights dues line)
      // quote what's MISSING at a due date, not face values.
      const coverage = schedule ? allocateDuesPayments(installments, payments).coverage : [];
      const coverageById = new Map(coverage.map(c => [c.installmentId, c]));
      const installmentsOut = installments.map(i => ({
        ...i,
        remainingAmount: coverageById.get(i.id)?.remaining ?? i.amount,
      }));

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
      const totalCredits  = credits.reduce((s, c) => s + (c.amount as number), 0);
      const rollingBalance = Math.round((outstanding - totalCredits) * 100) / 100;

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
      };
    }),
  );

  return NextResponse.json({ players: playersWithDues });
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
