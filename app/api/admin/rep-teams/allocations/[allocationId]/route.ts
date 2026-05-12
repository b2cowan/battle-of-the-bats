import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getRepCostAllocationDetail, updateRepCostAllocationDescription } from '@/lib/db';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ allocationId: string }> },
) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { allocationId } = await params;
  const detail = await getRepCostAllocationDetail(allocationId, ctx!.org.id);
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(detail);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ allocationId: string }> },
) {
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
}
