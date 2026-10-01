import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, repGroupScopeGuard } from '@/lib/api-auth';
import { canMoveClubMoney, canOpenRepMoney } from '@/lib/member-access';
import {
  getRepCostAllocations,
  createRepCostAllocationWithSplits,
  getRepTeam,
  getRepProgramYear,
} from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';
import { tournamentToday } from '@/lib/timezone';
import { teamIdsInScope } from '@/lib/club-team-route';
import { allocationListRows, loadClubLoop } from '@/lib/club-money-reads';

// The club ↔ team money loop: Rep Teams OR Accounting, on an org that runs rep teams (D8 + Ask 1 —
// a treasurer reaches it from Accounting). The write handlers below keep their own role checks.
function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!canOpenRepMoney(ctx, ctx.org)) return forbidden();
  return null;
}

export const GET = withObservability(async (_req: Request) => {
  const orgSlug = new URL(_req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  /* ⚖ THE FIGURES ARE THE ONE DEFINITION NOW (Club Tier Stage 3a, S3A-05 / C06). This read selected
     each installment WITHOUT its due date and then filtered on it, so it could never count one
     overdue, and it summed Collected by hand — one of four definitions. It keeps today's response
     shape for the old screen (session 2 retires it for Accounting › Allocations) and adds the new
     list's fields beside it. */
  const today = tournamentToday();
  const [allocations, loop] = await Promise.all([
    getRepCostAllocations(ctx!.org.id),
    loadClubLoop(ctx!.org.id, await teamIdsInScope(ctx!)),
  ]);
  const rows = new Map(allocationListRows(loop, today).map(r => [r.id, r]));
  const enriched = allocations.flatMap(alloc => {
    const r = rows.get(alloc.id);
    if (!r) return [];
    return [{
      ...alloc,
      teamCount: r.teamIds.length,
      totalAllocated: r.allocated,
      collected: r.figures.collected,
      outstanding: r.figures.outstanding,
      overdueCount: r.figures.overdue.count,
      teamsWord: r.teamsWord,
      teamNames: r.teamNames,
      figures: r.figures,
      chip: r.chip,
      firstDue: r.firstDue,
      lastDue: r.lastDue,
    }];
  });

  return NextResponse.json({ allocations: enriched });
}, { route: '/api/admin/rep-teams/allocations' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  // ⚖ One rule for every club money write (Club Tier Stage 3a, Ask 1).
  if (!canMoveClubMoney(ctx!, ctx!.org)) return forbidden();

  const body = await req.json();
  const { description, totalAmount, sourceEntryId = null, splits } = body;

  /* ⚖ A GENERAL ALLOCATION'S SOURCE IS ONE OF THE CLUB'S OWN ENTRIES (C17). The id arrived pasted and
     unchecked: the only rule was the foreign key, so another club's entry was accepted, and a bad id
     surfaced as a 500. It must be a live entry on one of this club's own books (never a team's). */
  if (sourceEntryId !== null) {
    if (typeof sourceEntryId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sourceEntryId)) {
      return NextResponse.json({ error: 'That isn’t one of the club’s ledger entries.', code: 'bad_source_entry' }, { status: 400 });
    }
    const { data: src } = await supabaseAdmin
      .from('accounting_entries')
      .select('id, status, accounting_ledgers!inner ( org_id, entity_type )')
      .eq('id', sourceEntryId)
      .eq('accounting_ledgers.org_id', ctx!.org.id)
      .neq('accounting_ledgers.entity_type', 'team')
      .maybeSingle();
    if (!src || src.status === 'void') {
      return NextResponse.json({ error: 'That isn’t one of the club’s ledger entries.', code: 'bad_source_entry' }, { status: 400 });
    }
  }

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
    // A member limited to some groups bills only their teams (B11).
    const scoped = repGroupScopeGuard(ctx!, team.groupId);
    if (scoped) return scoped;

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

    // (No team ledger is made here any more: it was created mid-validation, before a later split
    // could fail. The money moves make it, in the same step that first writes to it — mig 315.)
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
}, { route: '/api/admin/rep-teams/allocations' });
