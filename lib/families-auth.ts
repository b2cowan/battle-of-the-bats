import 'server-only';
import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized, forbidden, type AuthContextWithRole } from './api-auth';
import { hasCapability } from './roles';
import { hasModuleEntitlement } from './module-entitlements';
import { FAMILIES_GRANT_REFUSAL } from './families-words';

/**
 * The ONE gate for every /api/admin/families/* route.
 *
 * Three questions, all required (plan §5.3 — the player-documents leak happened
 * because a surface checked one permission where it needed two):
 *   1. does this member hold module_families (off by default for every role;
 *      owner short-circuits), and
 *   2. does the org's plan carry the module at all, and
 *   3. is the member NOT limited to a group of teams (Club Tier Stage 5a, Ask 12). A household spans teams, so a
 *      family's record would show a member limited to some teams the other teams' children; Accounting narrows what a
 *      limited member sees, Families cannot. The Members grant refuses the capability to a limited member too
 *      (app/api/admin/members/[memberId]/route.ts), so this only bites a grant made before Stage 5a, or a member
 *      limited after being given it.
 * The fourth check — "does this record belong to this org" — is not here because
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
  // A group-limited member carries their groups (api-auth's `repGroupIds`; null for an unlimited member).
  if (ctx.repGroupIds) {
    return { failure: NextResponse.json({ error: FAMILIES_GRANT_REFUSAL, code: 'team_limited' }, { status: 403 }) };
  }
  return { ctx };
}
