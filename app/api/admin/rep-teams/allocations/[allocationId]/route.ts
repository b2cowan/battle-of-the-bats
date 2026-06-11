import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getRepCostAllocationDetail, updateRepCostAllocationDescription } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export const GET = withObservability(async (_req: Request,
  { params }: { params: Promise<{ allocationId: string }> },) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { allocationId } = await params;
  let detail = await getRepCostAllocationDetail(allocationId, ctx!.org.id);
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (ctx!.repGroupIds) {
    const { data: scopedTeams } = await supabaseAdmin
      .from('rep_teams')
      .select('id')
      .eq('org_id', ctx!.org.id)
      .in('group_id', ctx!.repGroupIds);
    const scopedSet = new Set((scopedTeams ?? []).map((t: any) => t.id as string));
    const visibleSplits = detail.splits.filter(s => scopedSet.has(s.teamId));
    if (visibleSplits.length === 0) return forbidden();
    detail = { ...detail, splits: visibleSplits };
  }

  return NextResponse.json(detail);
}, { route: '/api/admin/rep-teams/allocations/[allocationId]' });

export const PATCH = withObservability(async (req: Request,
  { params }: { params: Promise<{ allocationId: string }> },) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const { allocationId } = await params;
  const body = await req.json();
  const { description } = body;

  if (!description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }

  const allocation = await updateRepCostAllocationDescription(
    allocationId,
    ctx!.org.id,
    description.trim(),
  );

  return NextResponse.json({ allocation });
}, { route: '/api/admin/rep-teams/allocations/[allocationId]' });
