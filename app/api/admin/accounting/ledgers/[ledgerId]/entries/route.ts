import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { getLedgerById, getLedgerEntries, createEntry } from '@/lib/db';
import { bookInScope, teamIdsInScope } from '@/lib/club-team-route';
import type { AccountingEntryStatus, AccountingEntryType } from '@/lib/types';
import { withObservability } from '@/lib/observability';
import { canMoveClubMoney } from '@/lib/member-access';
import { TEAM_BOOK_READ_ONLY, CLUB_BUDGET_REFUSAL } from '@/lib/club-money-words';
import { readFiledUnder } from '@/lib/club-budget-writes';
import { moveRefused } from '@/lib/club-money-route';
import { closedYearFromError, isClosedYearError, refuseIfClosedFor } from '@/lib/club-fiscal-year-server';

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
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const { ledgerId } = await params;
  const [ledger, scope] = await Promise.all([getLedgerById(ledgerId, ctx!.org.id), teamIdsInScope(ctx!)]);
  // A team book outside the member's groups is not theirs to read (B11).
  if (!ledger || !bookInScope(ledger, scope)) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });
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
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  // ⚖ One rule for every club money write (Club Tier Stage 3a, Ask 1): whoever holds the club's accounting.
  if (!canMoveClubMoney(ctx!, ctx!.org)) return forbidden();

  const { ledgerId } = await params;
  const ledger = await getLedgerById(ledgerId, ctx!.org.id);
  if (!ledger) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });
  // A team-entity ledger is the coach's own books — read-only from the org side
  // (audit J4-021). Org-side money moves go through allocations / payment-request approvals.
  if (ledger.entityType === 'team') {
    return NextResponse.json({ error: TEAM_BOOK_READ_ONLY, code: 'team_book' }, { status: 403 });
  }

  const body = await req.json();

  const entryDate:      string  = typeof body.entryDate      === 'string' ? body.entryDate.trim()                        : '';
  const description:    string  = typeof body.description    === 'string' ? body.description.trim()                      : '';
  const amount:         unknown = body.amount;
  const entryType:      string  = typeof body.entryType      === 'string' ? body.entryType                               : '';
  const status:         string  = typeof body.status         === 'string' ? body.status                                  : '';
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

  /* ⚖ FILED UNDER A BUDGET WORD (Club Tier Stage 3b, Ask 4a): `budgetItemId` — a word offered to the club,
     on the line's own side; its category is derived from it. That is what gives the line an Actual on
     Budget vs. Actual (matched to the plan by word, the coach's rule). A new line NEEDS a word: the free-text
     `category` retired with the old Add entry window (session 2), so the Ledger's Category filter lists the
     budget's categories, never a book's own spellings (C14). Lines typed before keep their words as history. */
  if (body.budgetItemId === undefined || body.budgetItemId === null || body.budgetItemId === '') {
    return NextResponse.json({ error: CLUB_BUDGET_REFUSAL.word_required, code: 'word_required' }, { status: 400 });
  }
  const filed = await readFiledUnder(ctx!.org.id, body.budgetItemId, entryType as 'income' | 'expense');
  if (!filed.ok) return moveRefused(filed);

  // ⚖ THE FISCAL YEAR'S LOCK (Stage 3c, Asks 1 and 8d): a line can't be dated into a closed year — refused in
  // words, with both ways out ("date it Sep 1 or later, or reopen 2025–26"). The database's trigger is the floor.
  const closed = await refuseIfClosedFor(ctx!.org.id, [entryDate], 'date');
  if (closed) return moveRefused(closed);

  const entry = await createEntry(
    ledgerId,
    {
      entryDate,
      description,
      amount: amount as number,
      entryType: entryType as AccountingEntryType,
      status: status as AccountingEntryStatus,
      category: null,
      budgetCategoryId: filed.value?.categoryId ?? null,
      budgetItemId: filed.value?.itemId ?? null,
      paymentMethod,
      payeeId,
      payeePayer,
      notes,
    },
    ctx!.user.id,
  ).catch(async (e: unknown) => {
    if (isClosedYearError(e)) return moveRefused(await closedYearFromError(ctx!.org.id, [entryDate]));
    throw e;
  });
  if (entry instanceof Response) return entry;

  return NextResponse.json(entry, { status: 201 });
}, { route: '/api/admin/accounting/ledgers/[ledgerId]/entries' });
