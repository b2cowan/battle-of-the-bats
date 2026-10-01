import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getOrCreateOrgLedger, getOrgAllLedgers, getLedgerSummary } from '@/lib/db';
import { bookInScope, teamIdsInScope } from '@/lib/club-team-route';
import { withObservability } from '@/lib/observability';
import { canMoveClubMoney } from '@/lib/member-access';

function gate(ctx: Awaited<ReturnType<typeof getAuthContextWithRole>>) {
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();
  return null;
}

export const GET = withObservability(async (req: Request) => {
  const url  = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  const from = url.searchParams.get('from') ?? undefined;
  const to   = url.searchParams.get('to')   ?? undefined;

  await getOrCreateOrgLedger(ctx!.org.id);
  // A member limited to some team groups sees only their groups' team books (B11).
  const [all, scope] = await Promise.all([getOrgAllLedgers(ctx!.org.id), teamIdsInScope(ctx!)]);
  const ledgers   = all.filter(l => bookInScope(l, scope));
  const summaries = await Promise.all(ledgers.map(l => getLedgerSummary(l, { from, to })));

  // Each summary carries its book's all-time `balance` (one scope everywhere, C14). The badge's word
  // for its kind is LEDGER_KIND_WORD (lib/club-ledger.ts), which knows all four.
  return NextResponse.json({ ledgers: summaries });
}, { route: '/api/admin/accounting/ledgers' });

export const POST = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  const err = gate(ctx);
  if (err) return err;

  // ⚖ One rule for every club money write (Club Tier Stage 3a, Ask 1): whoever holds the club's accounting.
  if (!canMoveClubMoney(ctx!, ctx!.org)) return forbidden();

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

  // J4-020: a user-created org sub-ledger (sponsorships, operating costs) must NOT reuse the
  // (org,'org',NULL) shape — that IS the singular auto-managed General ledger, and a second NULL
  // row corrupted the books (duplicate-General snowball + scattered transfers). Give every
  // user-created org ledger a distinct non-NULL entity_id so it's a real sub-ledger under the
  // UNIQUE(org_id,entity_type,entity_id) index. The General stays the only NULL-entity org row
  // (created/found by getOrCreateOrgLedger via .is('entity_id',null)); a partial unique index
  // (migration 127) enforces that. Tournament ledgers keep their real entityId.
  const resolvedEntityId = entityType === 'org' ? randomUUID() : entityId;

  const { data, error } = await supabaseAdmin
    .from('accounting_ledgers')
    .insert({ org_id: ctx!.org.id, entity_type: entityType, entity_id: resolvedEntityId, name })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A ledger already exists for this entity' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}, { route: '/api/admin/accounting/ledgers' });
