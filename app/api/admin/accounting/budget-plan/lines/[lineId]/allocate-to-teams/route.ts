import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  createRepCostAllocationWithSplits,
  getOrCreateRepTeamLedger,
  getRepTeam,
  getRepProgramYear,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

type Ctx = { params: Promise<{ lineId: string }> };

// POST /api/admin/accounting/budget-plan/lines/[lineId]/allocate-to-teams
// Confirms an allocation from a budget line to one or more teams.
// Delegates to the existing createRepCostAllocationWithSplits DB function,
// then tags the resulting allocation with source_budget_line_id.
//
// Body: {
//   description: string,
//   splits: [{
//     teamId, programYearId,
//     splitMethod: 'percentage'|'sessions'|'fixed',
//     splitValue: number,
//     amount: number,
//     paymentSchedule: 'standard'|'custom',
//     notes?: string,
//     installments: [{ installmentNumber, amount, dueDate }]
//   }]
// }
export const POST = withObservability(async (req: Request, { params }: Ctx) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const { lineId } = await params;

  // Verify the budget line belongs to this org
  const { data: line, error: le } = await supabaseAdmin
    .from('org_budget_lines')
    .select('id, org_id, description, total_amount')
    .eq('id', lineId)
    .eq('org_id', ctx!.org.id)
    .maybeSingle();

  if (le) return NextResponse.json({ error: le.message }, { status: 500 });
  if (!line) return NextResponse.json({ error: 'Budget line not found' }, { status: 404 });

  // Guard: only one allocation per budget line (can extend later if needed)
  const { data: existing } = await supabaseAdmin
    .from('rep_cost_allocations')
    .select('id')
    .eq('source_budget_line_id', lineId)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: 'This budget line has already been allocated. View the existing allocation to manage it.' },
      { status: 409 },
    );
  }

  const body = await req.json();
  const { description, splits } = body;

  const desc = typeof description === 'string' ? description.trim() : (line.description as string);
  if (!desc) return NextResponse.json({ error: 'description is required' }, { status: 400 });

  if (!Array.isArray(splits) || splits.length === 0) {
    return NextResponse.json({ error: 'At least one team split is required' }, { status: 400 });
  }

  const totalAmount = Number(line.total_amount);
  const splitSum = splits.reduce((s: number, sp: any) => s + Number(sp.amount ?? 0), 0);
  if (splitSum > totalAmount + 0.001) {
    return NextResponse.json(
      { error: `Split amounts ($${splitSum.toFixed(2)}) exceed budget line total ($${totalAmount.toFixed(2)})` },
      { status: 400 },
    );
  }

  // Validate splits and ensure team ledgers exist (mirrors existing allocations POST)
  for (const split of splits) {
    if (!split.teamId || !split.programYearId) {
      return NextResponse.json({ error: 'Each split requires teamId and programYearId' }, { status: 400 });
    }

    const team = await getRepTeam(split.teamId);
    if (!team || team.orgId !== ctx!.org.id) {
      return NextResponse.json({ error: `Team ${split.teamId} not found` }, { status: 404 });
    }

    const year = await getRepProgramYear(split.programYearId);
    if (!year || year.teamId !== team.id) {
      return NextResponse.json({ error: `Program year ${split.programYearId} not found` }, { status: 404 });
    }

    if (!['percentage', 'sessions', 'fixed'].includes(split.splitMethod)) {
      return NextResponse.json({ error: 'splitMethod must be percentage, sessions, or fixed' }, { status: 400 });
    }
    if (!['standard', 'custom'].includes(split.paymentSchedule)) {
      return NextResponse.json({ error: 'paymentSchedule must be standard or custom' }, { status: 400 });
    }
    if (!Array.isArray(split.installments) || split.installments.length === 0) {
      return NextResponse.json({ error: 'Each split requires at least one installment' }, { status: 400 });
    }

    const instSum = split.installments.reduce((s: number, i: any) => s + Number(i.amount ?? 0), 0);
    if (Math.abs(instSum - Number(split.amount)) > 0.01) {
      return NextResponse.json(
        { error: `Installments for team ${split.teamId} sum to $${instSum.toFixed(2)} but split amount is $${Number(split.amount).toFixed(2)}` },
        { status: 400 },
      );
    }

    await getOrCreateRepTeamLedger(ctx!.org.id, team.id, team.name);
  }

  // Create the allocation using the shared DB function
  const result = await createRepCostAllocationWithSplits({
    orgId:       ctx!.org.id,
    description: desc,
    totalAmount,
    sourceEntryId: null,
    createdBy:   ctx!.user.id,
    splits: splits.map((s: any) => ({
      teamId:          s.teamId,
      programYearId:   s.programYearId,
      amount:          Number(s.amount),
      splitMethod:     s.splitMethod,
      splitValue:      Number(s.splitValue ?? 0),
      paymentSchedule: s.paymentSchedule,
      notes:           s.notes ?? null,
      installments:    s.installments.map((i: any, idx: number) => ({
        installmentNumber: i.installmentNumber ?? idx + 1,
        amount:            Number(i.amount),
        dueDate:           i.dueDate,
      })),
    })),
  });

  // Tag the allocation with the originating budget line
  await supabaseAdmin
    .from('rep_cost_allocations')
    .update({ source_budget_line_id: lineId })
    .eq('id', result.allocation.id);

  return NextResponse.json(
    { allocation: { ...result.allocation, sourceBudgetLineId: lineId } },
    { status: 201 },
  );
}, { route: '/api/admin/accounting/budget-plan/lines/[lineId]/allocate-to-teams' });
