import { NextResponse } from 'next/server';
import { getAuthContextWithRole, forbidden, unauthorized } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { hasModuleEntitlement } from '@/lib/module-entitlements';
import { PUBLIC_SITE_WORDS as W } from '@/lib/public-site-words';

type Ctx = NonNullable<Awaited<ReturnType<typeof getAuthContextWithRole>>>;

/**
 * WHO MAY USE THE PUBLIC-SITE EDITOR — one rule for its two routes (the site's words and lists, and the club notice;
 * Club Tier Stage 4c-1). Reading needs the public-site capability on a plan that carries the module; writing — a save,
 * a notice posted or ended — is the owner's or an admin's.
 */
export async function publicSiteEditor(req: Request, { write }: { write: boolean }): Promise<{ ctx: Ctx; error?: never } | { ctx?: never; error: Response }> {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { error: unauthorized() };
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_public_site')) return { error: forbidden() };
  if (!hasModuleEntitlement(ctx.org, 'module_public_site')) return { error: forbidden() };
  if (write && ctx.role !== 'owner' && ctx.role !== 'admin') {
    return { error: NextResponse.json({ error: W.readOnly }, { status: 403 }) };
  }
  return { ctx };
}
