import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getLedgerById, getLedgerEntries, getLedgerSummary } from '@/lib/db';
import { bookInScope, teamIdsInScope } from '@/lib/club-team-route';
import type { AccountingEntryStatus } from '@/lib/types';
import { TEAM_BOOK_READ_ONLY } from '@/lib/club-money-words';
import { withObservability } from '@/lib/observability';
import { canMoveClubMoney } from '@/lib/member-access';

type Params = { params: Promise<{ ledgerId: string }> };

const VALID_STATUSES = new Set<string>(['posted', 'pending', 'void']);

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
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
}, { route: '/api/admin/accounting/ledgers/[ledgerId]' });

export const PATCH = withObservability(async (req: Request, { params }: Params) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  // ⚖ One rule for every club money write (Club Tier Stage 3a, Ask 1): whoever holds the club's accounting.
  if (!canMoveClubMoney(ctx!, ctx!.org)) return forbidden();

  const { ledgerId } = await params;
  const ledger = await getLedgerById(ledgerId, ctx!.org.id);
  if (!ledger) return NextResponse.json({ error: 'Ledger not found' }, { status: 404 });
  // A team's book is named for its team and kept by its coaches (C12) — never renamed from here.
  if (ledger.entityType === 'team') {
    return NextResponse.json({ error: TEAM_BOOK_READ_ONLY, code: 'team_book' }, { status: 403 });
  }

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
}, { route: '/api/admin/accounting/ledgers/[ledgerId]' });
