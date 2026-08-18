import 'server-only';
import { getAuthContextWithRole, unauthorized, forbidden, type AuthContextWithRole } from './api-auth';
import { hasCapability } from './roles';
import { hasModuleEntitlement } from './module-entitlements';

/**
 * The ONE gate for every /api/admin/families/* route.
 *
 * Two questions, both required (plan §5.3 — the player-documents leak happened
 * because a surface checked one permission where it needed two):
 *   1. does this member hold module_families (off by default for every role;
 *      owner short-circuits), and
 *   2. does the org's plan carry the module at all.
 * The third check — "does this record belong to this org" — is not here because
 * it is per-query: every read in lib/families-read.ts scopes to ctx.org.id, so
 * a foreign personId reads as not-found.
 */
export async function requireFamiliesAccess(
  req: Request,
): Promise<{ ctx: AuthContextWithRole } | { failure: Response }> {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug, requireOrgSlug: true });
  if (!ctx) return { failure: unauthorized() };
  if (!hasCapability(ctx.role, ctx.capabilities, 'module_families')) return { failure: forbidden() };
  if (!hasModuleEntitlement(ctx.org, 'module_families')) return { failure: forbidden() };
  return { ctx };
}
