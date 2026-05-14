import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getRepTeamGroups, createRepTeamGroup } from '@/lib/db';

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

  const groups = await getRepTeamGroups(ctx!.org.id);
  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'admin') return forbidden();

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 50) {
    return NextResponse.json({ error: 'name is required and must be 50 characters or fewer' }, { status: 400 });
  }

  try {
    const group = await createRepTeamGroup(ctx!.org.id, name, body.displayOrder ?? 0);
    return NextResponse.json({ group }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') {
      return NextResponse.json({ error: 'A group with that name already exists' }, { status: 409 });
    }
    throw e;
  }
}
