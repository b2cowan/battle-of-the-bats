import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLedgerById, updateEntry, voidEntry } from '@/lib/db';
import type { AccountingEntryType, AccountingEntryStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';

type Params = { params: Promise<{ ledgerId: string; entryId: string }> };

const VALID_ENTRY_TYPES = new Set<string>(['income', 'expense', 'transfer_in', 'transfer_out']);

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

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const { ledgerId, entryId } = await params;

  const ledger = await getLedgerById(ledgerId, ctx!.org.id);
  if (!ledger) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });
  // A team-entity ledger is the coach's own books — read-only from the org side
  // (audit J4-021). Org-side money moves go through allocations / payment-request approvals.
  if (ledger.entityType === 'team') {
    return NextResponse.json({ error: 'This ledger belongs to a coach-managed team and is read-only here. Use allocations or payment-request approvals to move money.' }, { status: 403 });
  }

  const { data: existing } = await supabaseAdmin
    .from('accounting_entries')
    .select('id, entry_type, status')
    .eq('id', entryId)
    .eq('ledger_id', ledgerId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

  if (existing.entry_type === 'transfer_in' || existing.entry_type === 'transfer_out') {
    return NextResponse.json(
      { error: 'Transfer entries cannot be edited directly. Void the transfer and re-create it.' },
      { status: 400 },
    );
  }
  if (existing.status === 'void') {
    return NextResponse.json({ error: 'Voided entries cannot be edited' }, { status: 400 });
  }

  const body = await req.json();
  const input: Parameters<typeof updateEntry>[2] = {};

  if ('entryDate' in body) {
    const v = typeof body.entryDate === 'string' ? body.entryDate.trim() : '';
    if (!isValidEntryDate(v)) {
      return NextResponse.json({ error: 'entryDate must be a valid YYYY-MM-DD date no more than one year in the future' }, { status: 400 });
    }
    input.entryDate = v;
  }
  if ('description' in body) {
    const v = typeof body.description === 'string' ? body.description.trim() : '';
    if (!v || v.length > 500) {
      return NextResponse.json({ error: 'description must be between 1 and 500 characters' }, { status: 400 });
    }
    input.description = v;
  }
  if ('amount' in body) {
    const v = body.amount;
    if (typeof v !== 'number' || v <= 0 || v > 999999.99) {
      return NextResponse.json({ error: 'amount must be a positive number no greater than 999999.99' }, { status: 400 });
    }
    input.amount = v;
  }
  if ('entryType' in body) {
    const v = typeof body.entryType === 'string' ? body.entryType : '';
    if (!VALID_ENTRY_TYPES.has(v)) {
      return NextResponse.json({ error: 'Invalid entryType' }, { status: 400 });
    }
    input.entryType = v as AccountingEntryType;
  }
  if ('status' in body) {
    const v = typeof body.status === 'string' ? body.status : '';
    if (v !== 'posted' && v !== 'pending') {
      return NextResponse.json({ error: 'status must be posted or pending' }, { status: 400 });
    }
    input.status = v as AccountingEntryStatus;
  }
  if ('category' in body) {
    input.category = typeof body.category === 'string' ? body.category.trim().slice(0, 100) || null : null;
  }
  if ('paymentMethod' in body) {
    input.paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.trim().slice(0, 100) || null : null;
  }
  if ('payeeId' in body) {
    input.payeeId = typeof body.payeeId === 'string' ? body.payeeId || null : null;
  }
  if ('payeePayer' in body) {
    input.payeePayer = typeof body.payeePayer === 'string' ? body.payeePayer.trim().slice(0, 200) || null : null;
  }
  if ('notes' in body) {
    input.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) || null : null;
  }

  await updateEntry(entryId, ledgerId, input);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/accounting/ledgers/[ledgerId]/entries/[entryId]' });

export const DELETE = withObservability(async (req: Request, { params }: Params) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  if (ctx!.role !== 'owner' && ctx!.role !== 'treasurer') return forbidden();

  const { ledgerId, entryId } = await params;

  const ledger = await getLedgerById(ledgerId, ctx!.org.id);
  if (!ledger) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });
  // A team-entity ledger is the coach's own books — read-only from the org side
  // (audit J4-021). Org-side money moves go through allocations / payment-request approvals.
  if (ledger.entityType === 'team') {
    return NextResponse.json({ error: 'This ledger belongs to a coach-managed team and is read-only here. Use allocations or payment-request approvals to move money.' }, { status: 403 });
  }

  const { data: existing } = await supabaseAdmin
    .from('accounting_entries')
    .select('id, status')
    .eq('id', entryId)
    .eq('ledger_id', ledgerId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  if (existing.status === 'void') return NextResponse.json({ error: 'Entry is already voided' }, { status: 400 });

  await voidEntry(entryId, ledgerId);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/accounting/ledgers/[ledgerId]/entries/[entryId]' });
