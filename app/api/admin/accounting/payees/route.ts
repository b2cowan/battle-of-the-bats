import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { searchOrgPayees, createOrgPayee } from '@/lib/db';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const q = url.searchParams.get('q') ?? '';
  const payees = await searchOrgPayees(ctx!.org.id, q);
  return NextResponse.json({ payees });
}, { route: '/api/admin/accounting/payees' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer' && ctx!.role !== 'admin') return forbidden();

  const body = await req.json();
  const name: string = typeof body.name === 'string' ? body.name.trim() : '';
  const notes: string | null = typeof body.notes === 'string' ? body.notes.trim() || null : null;

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (name.length > 200) return NextResponse.json({ error: 'name must be 200 characters or fewer' }, { status: 400 });

  try {
    const payee = await createOrgPayee({ orgId: ctx!.org.id, name, notes, createdBy: ctx!.user.id });
    return NextResponse.json({ payee }, { status: 201 });
  } catch (e: any) {
    if (e?.code === '23505') return NextResponse.json({ error: 'A payee with that name already exists' }, { status: 409 });
    throw e;
  }
}, { route: '/api/admin/accounting/payees' });
