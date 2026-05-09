import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getOrCreateOrgLedger, getOrgAllLedgers, getLedgerSummary } from '@/lib/db';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

export async function GET(req: Request) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const url  = new URL(req.url);
  const from = url.searchParams.get('from') ?? undefined;
  const to   = url.searchParams.get('to')   ?? undefined;

  await getOrCreateOrgLedger(ctx!.org.id, ctx!.org.name);
  const ledgers   = await getOrgAllLedgers(ctx!.org.id);
  const summaries = await Promise.all(ledgers.map(l => getLedgerSummary(l, { from, to })));

  return NextResponse.json({ ledgers: summaries });
}

export async function POST(req: Request) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const body = await req.json();

  const name: string = typeof body.name === 'string' ? body.name.trim() : '';
  const entityType: string = body.entityType ?? '';
  const entityId: string | null = typeof body.entityId === 'string' ? body.entityId : null;

  if (!name || name.length > 100) {
    return NextResponse.json({ error: 'name is required and must be 100 characters or fewer' }, { status: 400 });
  }
  if (entityType !== 'org' && entityType !== 'tournament') {
    return NextResponse.json({ error: 'entityType must be org or tournament' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('accounting_ledgers')
    .insert({ org_id: ctx!.org.id, entity_type: entityType, entity_id: entityId, name })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A ledger already exists for this entity' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
