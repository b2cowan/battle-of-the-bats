import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import {
  getRepCostAllocations,
  getRepCostAllocationDetail,
  createRepCostAllocationWithSplits,
  getOrCreateRepTeamLedger,
  getRepTeam,
  getRepProgramYear,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export async function GET(_req: Request) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  let scopedTeamIds: string[] | null = null;
  if (ctx!.repGroupIds) {
    const { data: scopedTeams } = await supabaseAdmin
      .from('rep_teams')
      .select('id')
      .eq('org_id', ctx!.org.id)
      .in('group_id', ctx!.repGroupIds);
    scopedTeamIds = (scopedTeams ?? []).map((t: any) => t.id as string);
  }

  const allocations = await getRepCostAllocations(ctx!.org.id);

  // Enrich each allocation with split-level summary stats
  const enrichedAll = await Promise.all(
    allocations.map(async alloc => {
      let splitsQuery = supabaseAdmin
        .from('rep_allocation_splits')
        .select('id, amount, team_id')
        .eq('allocation_id', alloc.id);
      if (scopedTeamIds) splitsQuery = splitsQuery.in('team_id', scopedTeamIds);
      const { data: splits } = await splitsQuery;

      const splitIds = (splits ?? []).map((s: any) => s.id);
      let installments: any[] = [];
      if (splitIds.length > 0) {
        const { data: inst } = await supabaseAdmin
          .from('rep_allocation_installments')
          .select('amount, paid_at')
          .in('split_id', splitIds);
        installments = inst ?? [];
      }

      const totalAllocated = (splits ?? []).reduce((sum: number, s: any) => sum + Number(s.amount), 0);
      const collected = installments
        .filter((i: any) => i.paid_at)
        .reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      const outstanding = installments
        .filter((i: any) => !i.paid_at)
        .reduce((sum: number, i: any) => sum + Number(i.amount), 0);
      const now = new Date().toISOString().slice(0, 10);
      const overdueCount = installments.filter(
        (i: any) => !i.paid_at && i.due_date < now,
      ).length;

      return {
        ...alloc,
        teamCount: (splits ?? []).length,
        totalAllocated,
        collected,
        outstanding,
        overdueCount,
      };
    }),
  );

  // Exclude allocations with no splits visible to this caller
  const enriched = scopedTeamIds
    ? enrichedAll.filter(a => a.teamCount > 0)
    : enrichedAll;

  return NextResponse.json({ allocations: enriched });
}

export async function POST(req: Request) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const body = await req.json();
  const { description, totalAmount, sourceEntryId = null, splits } = body;

  if (!description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }
  if (typeof totalAmount !== 'number' || totalAmount <= 0) {
    return NextResponse.json({ error: 'totalAmount must be a positive number' }, { status: 400 });
  }
  if (!Array.isArray(splits) || splits.length === 0) {
    return NextResponse.json({ error: 'At least one split is required' }, { status: 400 });
  }

  // Validate split sum ≤ totalAmount
  const splitSum = splits.reduce((sum: number, s: any) => sum + Number(s.amount ?? 0), 0);
  if (splitSum > totalAmount + 0.001) {
    return NextResponse.json(
      { error: `Split amounts ($${splitSum.toFixed(2)}) exceed totalAmount ($${totalAmount.toFixed(2)})` },
      { status: 400 },
    );
  }

  // Validate each split and ensure team ledgers exist
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

  const result = await createRepCostAllocationWithSplits({
    orgId: ctx!.org.id,
    description: description.trim(),
    totalAmount,
    sourceEntryId,
    createdBy: ctx!.user.id,
    splits: splits.map((s: any) => ({
      teamId: s.teamId,
      programYearId: s.programYearId,
      amount: Number(s.amount),
      splitMethod: s.splitMethod,
      splitValue: Number(s.splitValue ?? 0),
      paymentSchedule: s.paymentSchedule,
      notes: s.notes ?? null,
      installments: s.installments.map((i: any, idx: number) => ({
        installmentNumber: i.installmentNumber ?? idx + 1,
        amount: Number(i.amount),
        dueDate: i.dueDate,
      })),
    })),
  });

  return NextResponse.json(result, { status: 201 });
}
