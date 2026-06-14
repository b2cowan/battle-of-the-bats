import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();

  // Get all ledger IDs for this org
  const { data: ledgers } = await supabaseAdmin
    .from('accounting_ledgers')
    .select('id')
    .eq('org_id', ctx.org.id);

  const ledgerIds = (ledgers ?? []).map((l: { id: string }) => l.id);

  if (ledgerIds.length === 0) {
    return NextResponse.json({ categories: [] });
  }

  // Fetch all non-null categories from those ledgers
  const { data: rows } = await supabaseAdmin
    .from('accounting_entries')
    .select('category')
    .in('ledger_id', ledgerIds)
    .not('category', 'is', null);

  const categories = [...new Set(
    (rows ?? []).map((r: { category: string | null }) => r.category).filter(Boolean) as string[]
  )].sort();

  return NextResponse.json({ categories });
}, { route: '/api/admin/accounting/categories' });
