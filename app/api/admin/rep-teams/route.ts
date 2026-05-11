import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_rep_teams')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_rep_teams')) return forbidden();
  return null;
}

export async function GET() {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  return NextResponse.json({ module: 'rep_teams', status: 'ok' });
}
