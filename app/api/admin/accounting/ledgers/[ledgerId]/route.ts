import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLedgerById, getLedgerEntries, getLedgerSummary } from '@/lib/db';
import type { AccountingEntryStatus } from '@/lib/types';

type Params = { params: Promise<{ ledgerId: string }> };

const VALID_STATUSES = new Set<string>(['posted', 'pending', 'void']);

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

export async function GET(req: Request, { params }: Params) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { ledgerId } = await params;
  const ledger = await getLedgerById(ledgerId, ctx!.org.id);
  if (!ledger) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const limit  = Math.min(parseInt(url.searchParams.get('limit')  ?? '50',  10), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0',   10), 0);

  const status = statusParam && VALID_STATUSES.has(statusParam)
    ? (statusParam as AccountingEntryStatus)
    : undefined;

  const [entries, summary] = await Promise.all([
    getLedgerEntries(ledgerId, { status, limit, offset }),
    getLedgerSummary(ledger),
  ]);

  return NextResponse.json({ ledger, summary, entries });
}

export async function PATCH(req: Request, { params }: Params) {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const { ledgerId } = await params;
  const ledger = await getLedgerById(ledgerId, ctx!.org.id);
  if (!ledger) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });

  const body = await req.json();
  const name: string = typeof body.name === 'string' ? body.name.trim() : '';

  if (!name || name.length > 100) {
    return NextResponse.json({ error: 'name is required and must be 100 characters or fewer' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('accounting_ledgers')
    .update({ name })
    .eq('id', ledgerId)
    .eq('org_id', ctx!.org.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
