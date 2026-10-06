import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLedgerById, updateEntry, voidEntry } from '@/lib/db';
import type { AccountingEntryType, AccountingEntryStatus } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { canMoveClubMoney } from '@/lib/member-access';
import { SOURCED_LINE_READ_ONLY, TEAM_BOOK_READ_ONLY } from '@/lib/club-money-words';
import { isSourcedLine } from '@/lib/club-ledger';
import { readFiledUnder } from '@/lib/club-budget-writes';
import { moveRefused } from '@/lib/club-money-route';

/**
 * ⚖ A LINE WRITTEN BY AN ALLOCATION, A REQUEST OR A HOUSE-LEAGUE FEE IS CHANGED WHERE IT CAME FROM
 * (Club Tier Stage 3a, C12). Today Void sat on such a line and voided the club's half only: the
 * installment still read paid and the team's half stood. It is read here, and its source's own door
 * (an allocation's Undo, a request's Reverse) takes both halves back with a reason.
 * `referenced` catches a pre-3a line with no source_module: an installment or a request names it.
 */
async function writtenBySource(entry: { id: string; linked_entry_id: string | null; category: string | null; source_module: string | null; entry_type: string }) {
  const ids = [entry.id, entry.linked_entry_id].filter((v): v is string => !!v);
  const [inst, req] = await Promise.all([
    supabaseAdmin.from('rep_allocation_installments').select('id', { count: 'exact', head: true }).in('accounting_entry_id', ids),
    supabaseAdmin.from('rep_team_payment_requests').select('id', { count: 'exact', head: true }).in('accounting_entry_id', ids),
  ]);
  return isSourcedLine(
    { entryType: entry.entry_type as never, category: entry.category, sourceModule: entry.source_module },
    (inst.count ?? 0) > 0 || (req.count ?? 0) > 0,
  );
}

type Params = { params: Promise<{ ledgerId: string; entryId: string }> };

// An ordinary entry is In or Out, never half of a transfer (C12): a transfer has its own door, and a
// re-typed "Transfer In" with no partner is money from nowhere.
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

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  // ⚖ One rule for every club money write (Club Tier Stage 3a, Ask 1): whoever holds the club's accounting.
  if (!canMoveClubMoney(ctx!, ctx!.org)) return forbidden();

  const { ledgerId, entryId } = await params;

  const ledger = await getLedgerById(ledgerId, ctx!.org.id);
  if (!ledger) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });
  // A team-entity ledger is the coach's own books — read-only from the org side
  // (audit J4-021). Org-side money moves go through allocations / payment-request approvals.
  if (ledger.entityType === 'team') {
    return NextResponse.json({ error: TEAM_BOOK_READ_ONLY, code: 'team_book' }, { status: 403 });
  }

  const { data: existing } = await supabaseAdmin
    .from('accounting_entries')
    .select('id, entry_type, status, category, source_module, linked_entry_id, budget_item_id')
    .eq('id', entryId)
    .eq('ledger_id', ledgerId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });

  if (await writtenBySource(existing)) {
    return NextResponse.json({ error: SOURCED_LINE_READ_ONLY, code: 'from_a_source' }, { status: 403 });
  }
  if (existing.entry_type === 'transfer_in' || existing.entry_type === 'transfer_out') {
    return NextResponse.json(
      { error: 'Transfer entries cannot be edited directly. Void the transfer and re-create it.', code: 'transfer' },
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
  /* ⚰ The free-text `category` is no longer written (Club Tier Stage 3b, session 2): a line is filed under a
     budget word (`budgetItemId`, below). An old line's typed words stay as they were — history, never a filing. */
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

  /* ⚖ FILED UNDER (Club Tier Stage 3b, Ask 4a): `budgetItemId` files the line under a word (null = not
     filed). The word must stay on the line's side: re-typing a filed line In ↔ Out re-checks the word it
     keeps. An old line's free text stays as it was — filing it does not rewrite history. */
  if ('budgetItemId' in body || input.entryType !== undefined) {
    const effectiveType = (input.entryType ?? existing.entry_type) as 'income' | 'expense';
    const effectiveWord = 'budgetItemId' in body ? body.budgetItemId : existing.budget_item_id;
    const filed = await readFiledUnder(ctx!.org.id, effectiveWord, effectiveType);
    if (!filed.ok) return moveRefused(filed);
    if ('budgetItemId' in body) {
      input.budgetItemId = filed.value?.itemId ?? null;
      input.budgetCategoryId = filed.value?.categoryId ?? null;
    }
  }

  await updateEntry(entryId, ledgerId, input);
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/accounting/ledgers/[ledgerId]/entries/[entryId]' });

export const DELETE = withObservability(async (req: Request, { params }: Params) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  // ⚖ One rule for every club money write (Club Tier Stage 3a, Ask 1): whoever holds the club's accounting.
  if (!canMoveClubMoney(ctx!, ctx!.org)) return forbidden();

  const { ledgerId, entryId } = await params;

  const ledger = await getLedgerById(ledgerId, ctx!.org.id);
  if (!ledger) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });
  // A team-entity ledger is the coach's own books — read-only from the org side
  // (audit J4-021). Org-side money moves go through allocations / payment-request approvals.
  if (ledger.entityType === 'team') {
    return NextResponse.json({ error: TEAM_BOOK_READ_ONLY, code: 'team_book' }, { status: 403 });
  }

  const { data: existing } = await supabaseAdmin
    .from('accounting_entries')
    .select('id, status, entry_type, category, source_module, linked_entry_id')
    .eq('id', entryId)
    .eq('ledger_id', ledgerId)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
  if (existing.status === 'void') return NextResponse.json({ error: 'Entry is already voided' }, { status: 400 });
  if (await writtenBySource(existing)) {
    return NextResponse.json({ error: SOURCED_LINE_READ_ONLY, code: 'from_a_source' }, { status: 403 });
  }
  // One half of a transfer is never voided alone (C13): the two books would stop agreeing.
  if (existing.entry_type === 'transfer_in' || existing.entry_type === 'transfer_out') {
    return NextResponse.json({
      error: 'A transfer is voided both halves together. Use Void this transfer.', code: 'use_transfer_void',
    }, { status: 400 });
  }

  // The reason prints under the line (Ask 3). Optional here only until session 2's window asks for it.
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) || null : null;
  await voidEntry(entryId, ledgerId, { reason, by: ctx!.user.id });
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/accounting/ledgers/[ledgerId]/entries/[entryId]' });
