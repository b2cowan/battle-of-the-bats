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
import { closedYearFromError, isClosedYearError, loadFiscalSetting, refuseIfClosed, refuseIfClosedFor } from '@/lib/club-fiscal-year-server';

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
    .select('id, entry_date, entry_type, status, category, source_module, linked_entry_id, budget_item_id, budget_category_id, description, amount, payment_method, payee_id, payee_payer, notes')
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

  /* ⚖ THE FISCAL YEAR'S LOCK (Stage 3c, Asks 1 and 8d; call 2). A line dated in a closed year is never edited
     (to change it, reopen the year), and no line is dated into one. The ONE exception: a PENDING line from a
     closed year clears — posted, dated the day it cleared in an open year, nothing else changed (it counted
     nowhere in the closed year; the database keeps the day it was written). */
  /* What the edit CHANGES: a field sent with the value it already holds changes nothing — the database's lock
     compares the row's values the same way, so a form that sends the whole record never reads as an edit of a
     closed year's line (or as more than a clearing). Nothing changed at all: nothing to write. */
  const COLUMN: Record<string, string> = {
    entryDate: 'entry_date', description: 'description', amount: 'amount', entryType: 'entry_type', status: 'status',
    paymentMethod: 'payment_method', payeeId: 'payee_id', payeePayer: 'payee_payer', notes: 'notes',
    budgetItemId: 'budget_item_id', budgetCategoryId: 'budget_category_id',
  };
  const held = (k: string) => {
    const v = (existing as Record<string, unknown>)[COLUMN[k]];
    return k === 'amount' ? Number(v) : v ?? null;
  };
  const changes = Object.keys(input).filter(k => (input as Record<string, unknown>)[k] !== held(k));
  if (changes.length === 0) return NextResponse.json({ ok: true });
  const setting = await loadFiscalSetting(ctx!.org.id);
  const CLEARING = new Set(['status', 'entryDate', 'payeeId', 'budgetItemId', 'budgetCategoryId']);
  const clearing = existing.status === 'pending' && input.status === 'posted' && changes.every(k => CLEARING.has(k));
  const closedOld = clearing ? null : refuseIfClosed(setting, [existing.entry_date], { canMove: true, kind: 'recorded' });
  if (closedOld) return moveRefused(closedOld);
  const closedNew = refuseIfClosed(setting, [input.entryDate ?? existing.entry_date], { canMove: true, kind: 'date' });
  if (closedNew) return moveRefused(closedNew);

  try {
    await updateEntry(entryId, ledgerId, input);
  } catch (e) {
    if (isClosedYearError(e)) return moveRefused(await closedYearFromError(ctx!.org.id, [existing.entry_date, input.entryDate]));
    throw e;
  }
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
    .select('id, entry_date, status, entry_type, category, source_module, linked_entry_id')
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
  // ⚖ Void is refused on a line dated in a closed fiscal year (Ask 8d) — reopen the year to change it.
  const closed = await refuseIfClosedFor(ctx!.org.id, [existing.entry_date], 'recorded');
  if (closed) return moveRefused(closed);
  try {
    await voidEntry(entryId, ledgerId, { reason, by: ctx!.user.id });
  } catch (e) {
    if (isClosedYearError(e)) return moveRefused(await closedYearFromError(ctx!.org.id, [existing.entry_date]));
    throw e;
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/admin/accounting/ledgers/[ledgerId]/entries/[entryId]' });
