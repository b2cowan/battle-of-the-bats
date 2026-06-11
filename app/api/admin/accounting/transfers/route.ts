import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLedgerById } from '@/lib/db';
import { withObservability } from '@/lib/observability';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

function isValidEntryDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  if (isNaN(d.getTime())) return false;
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() + 1);
  return d <= limit;
}

export const POST = withObservability(async (req: Request) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const body = await req.json();

  const fromLedgerId: string = typeof body.fromLedgerId === 'string' ? body.fromLedgerId : '';
  const toLedgerId:   string = typeof body.toLedgerId   === 'string' ? body.toLedgerId   : '';
  const amount:       unknown = body.amount;
  const entryDate:    string = typeof body.entryDate    === 'string' ? body.entryDate.trim()    : '';
  const description:  string = typeof body.description  === 'string' ? body.description.trim()  : '';
  const category:     string | null = typeof body.category === 'string' ? body.category.trim().slice(0, 100) || null : null;

  if (!fromLedgerId || !toLedgerId) {
    return NextResponse.json({ error: 'fromLedgerId and toLedgerId are required' }, { status: 400 });
  }
  if (fromLedgerId === toLedgerId) {
    return NextResponse.json({ error: 'fromLedgerId and toLedgerId must be different ledgers' }, { status: 400 });
  }
  if (typeof amount !== 'number' || amount <= 0 || amount > 999999.99) {
    return NextResponse.json({ error: 'amount must be a positive number no greater than 999999.99' }, { status: 400 });
  }
  if (!isValidEntryDate(entryDate)) {
    return NextResponse.json({ error: 'entryDate must be a valid YYYY-MM-DD date no more than one year in the future' }, { status: 400 });
  }
  if (!description || description.length > 500) {
    return NextResponse.json({ error: 'description is required and must be 500 characters or fewer' }, { status: 400 });
  }

  const [fromLedger, toLedger] = await Promise.all([
    getLedgerById(fromLedgerId, ctx!.org.id),
    getLedgerById(toLedgerId,   ctx!.org.id),
  ]);

  if (!fromLedger) return NextResponse.json({ error: 'Source ledger not found' }, { status: 404 });
  if (!toLedger)   return NextResponse.json({ error: 'Destination ledger not found' }, { status: 404 });

  const { error } = await supabaseAdmin.rpc('create_accounting_transfer', {
    p_from_ledger_id: fromLedgerId,
    p_to_ledger_id:   toLedgerId,
    p_amount:         amount as number,
    p_entry_date:     entryDate,
    p_description:    description,
    p_category:       category,
    p_created_by:     ctx!.user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 201 });
}, { route: '/api/admin/accounting/transfers' });
