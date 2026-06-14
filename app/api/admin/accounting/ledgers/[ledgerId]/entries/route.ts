import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLedgerById, getLedgerEntries, createEntry } from '@/lib/db';
import type { AccountingEntryStatus, AccountingEntryType } from '@/lib/types';
import { withObservability } from '@/lib/observability';

type Params = { params: Promise<{ ledgerId: string }> };

const VALID_STATUSES   = new Set<string>(['posted', 'pending', 'void']);
const VALID_ENTRY_TYPES = new Set<string>(['income', 'expense']);

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

export const GET = withObservability(async (req: Request, { params }: Params) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  const { ledgerId } = await params;
  const ledger = await getLedgerById(ledgerId, ctx!.org.id);
  if (!ledger) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const limit  = Math.min(parseInt(url.searchParams.get('limit')  ?? '50', 10), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0',  10), 0);

  const status = statusParam && VALID_STATUSES.has(statusParam)
    ? (statusParam as AccountingEntryStatus)
    : undefined;

  const entries = await getLedgerEntries(ledgerId, { status, limit, offset });
  return NextResponse.json({ entries });
}, { route: '/api/admin/accounting/ledgers/[ledgerId]/entries' });

export const POST = withObservability(async (req: Request, { params }: Params) => {
  const ctx = await getAuthContextWithRole();
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const { ledgerId } = await params;
  const ledger = await getLedgerById(ledgerId, ctx!.org.id);
  if (!ledger) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });
  // A team-entity ledger is the coach's own books — read-only from the org side
  // (audit J4-021). Org-side money moves go through allocations / payment-request approvals.
  if (ledger.entityType === 'team') {
    return NextResponse.json({ error: 'This ledger belongs to a coach-managed team and is read-only here. Use allocations or payment-request approvals to move money.' }, { status: 403 });
  }

  const body = await req.json();

  const entryDate:      string  = typeof body.entryDate      === 'string' ? body.entryDate.trim()                        : '';
  const description:    string  = typeof body.description    === 'string' ? body.description.trim()                      : '';
  const amount:         unknown = body.amount;
  const entryType:      string  = typeof body.entryType      === 'string' ? body.entryType                               : '';
  const status:         string  = typeof body.status         === 'string' ? body.status                                  : '';
  const category:       string | null = typeof body.category       === 'string' ? body.category.trim().slice(0, 100) || null       : null;
  const paymentMethod:  string | null = typeof body.paymentMethod  === 'string' ? body.paymentMethod.trim().slice(0, 100) || null  : null;
  const payeeId:        string | null = typeof body.payeeId        === 'string' ? body.payeeId || null                             : null;
  const payeePayer:     string | null = typeof body.payeePayer     === 'string' ? body.payeePayer.trim().slice(0, 200) || null     : null;
  const notes:          string | null = typeof body.notes          === 'string' ? body.notes.trim().slice(0, 2000) || null         : null;

  if (!isValidEntryDate(entryDate)) {
    return NextResponse.json({ error: 'entryDate must be a valid YYYY-MM-DD date no more than one year in the future' }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }
  if (description.length > 500) {
    return NextResponse.json({ error: 'description must be 500 characters or fewer' }, { status: 400 });
  }
  if (typeof amount !== 'number' || amount <= 0 || amount > 999999.99) {
    return NextResponse.json({ error: 'amount must be a positive number no greater than 999999.99' }, { status: 400 });
  }
  if (!VALID_ENTRY_TYPES.has(entryType)) {
    return NextResponse.json({ error: 'entryType must be income or expense' }, { status: 400 });
  }
  if (status !== 'posted' && status !== 'pending') {
    return NextResponse.json({ error: 'status must be posted or pending' }, { status: 400 });
  }

  const entry = await createEntry(
    ledgerId,
    {
      entryDate,
      description,
      amount: amount as number,
      entryType: entryType as AccountingEntryType,
      status: status as AccountingEntryStatus,
      category,
      paymentMethod,
      payeeId,
      payeePayer,
      notes,
    },
    ctx!.user.id,
  );

  return NextResponse.json(entry, { status: 201 });
}, { route: '/api/admin/accounting/ledgers/[ledgerId]/entries' });
