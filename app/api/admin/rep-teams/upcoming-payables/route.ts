import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

function daysUntil(dueDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr + 'T00:00:00');
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

// GET /api/admin/rep-teams/upcoming-payables?days=90
export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') ?? '90', 10), 1), 365);

  // When the caller is scoped to specific groups, restrict to those teams
  let scopedTeamIds: string[] | null = null;
  if (ctx!.repGroupIds) {
    const { data: scopedTeams } = await supabaseAdmin
      .from('rep_teams')
      .select('id')
      .eq('org_id', ctx!.org.id)
      .in('group_id', ctx!.repGroupIds);
    scopedTeamIds = (scopedTeams ?? []).map((t: any) => t.id as string);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // ── Lane 1: allocation installments coming due across all teams ──────────
  let splitsQuery = supabaseAdmin
    .from('rep_allocation_splits')
    .select(`
      id, team_id,
      rep_cost_allocations ( description ),
      rep_teams ( name )
    `)
    .eq('org_id', ctx!.org.id);
  if (scopedTeamIds) splitsQuery = splitsQuery.in('team_id', scopedTeamIds);
  const { data: splits } = await splitsQuery;

  const splitIds = (splits ?? []).map((s: any) => s.id);
  const splitMetaMap = new Map<string, { description: string; teamName: string }>(
    (splits ?? []).map((s: any) => [
      s.id,
      {
        description: (s.rep_cost_allocations as any)?.description ?? 'Org allocation',
        teamName:    (s.rep_teams as any)?.name ?? 'Unknown team',
      },
    ]),
  );

  let collectionsItems: any[] = [];
  if (splitIds.length > 0) {
    const { data: allocInst } = await supabaseAdmin
      .from('rep_allocation_installments')
      .select('id, split_id, installment_number, amount, due_date')
      .in('split_id', splitIds)
      .is('paid_at', null)
      .lte('due_date', cutoffStr)
      .order('due_date', { ascending: true });

    collectionsItems = (allocInst ?? []).map((i: any) => {
      const meta = splitMetaMap.get(i.split_id);
      const d = daysUntil(i.due_date);
      return {
        id:          i.id,
        description: meta?.description ?? 'Org allocation',
        amount:      Number(i.amount),
        dueDate:     i.due_date,
        daysUntilDue: d,
        overdue:     d < 0,
        label:       meta?.teamName ?? null,
      };
    });
  }

  // ── Lane 2: pending team payment requests ────────────────────────────────
  let reqQuery = supabaseAdmin
    .from('rep_team_payment_requests')
    .select(`
      id, request_type, amount, description,
      rep_teams ( name )
    `)
    .eq('org_id', ctx!.org.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (scopedTeamIds) reqQuery = reqQuery.in('team_id', scopedTeamIds);
  const { data: pendingRequests } = await reqQuery;

  const requestItems = (pendingRequests ?? []).map((r: any) => ({
    id:          r.id,
    description: r.description,
    amount:      Number(r.amount),
    dueDate:     null,
    daysUntilDue: null,
    overdue:     false,
    label:       (r.rep_teams as any)?.name ?? null,
    requestType: r.request_type,
  }));

  return NextResponse.json({
    lanes: [
      {
        id:           'collections_due',
        title:        'Allocation Collections',
        emptyMessage: 'No allocation installments due in this window.',
        items:        collectionsItems,
      },
      {
        id:           'org_payables',
        title:        'Pending Payment Requests',
        emptyMessage: 'No pending payment requests from teams.',
        items:        requestItems,
      },
    ],
  });
}, { route: '/api/admin/rep-teams/upcoming-payables' });
