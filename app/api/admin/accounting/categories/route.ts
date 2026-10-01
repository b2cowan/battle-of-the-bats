import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { clubCategories } from '@/lib/club-ledger-read';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_accounting')) return forbidden();
  if (!hasModuleEntitlement(ctx.org, 'module_accounting')) return forbidden();

  // The club's OWN categories, in words (Club Tier Stage 3a, C14): its books, never the teams' — a team's
  // book carries the coaches' words (and every family's dues line). Every row, not the first 1,000.
  const categories = await clubCategories(ctx.org.id);

  return NextResponse.json({ categories });
}, { route: '/api/admin/accounting/categories' });
