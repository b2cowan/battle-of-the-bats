import { getAuthContextWithScope, unauthorized, forbidden } from '@/lib/api-auth';
import { hasCapability } from '@/lib/roles';
import { withObservability } from '@/lib/observability';
import { authAccountExistsForEmail } from '@/lib/auth-account-lookup';
import { isPlatformAdminEmail } from '@/lib/platform-auth';
import { FixedWindowRateLimiter } from '@/lib/rate-limit';

/**
 * "Is the coach I'm about to add already on FieldLogicHQ?" — one yes/no for the Add Team form
 * (COACH_HOST_OWN_TEAM_ENTRY_PLAN.md Part B; owner ruled D3 2026-09-13: a real lookup, not copy).
 *
 * What it discloses, and to whom: an org admin who already holds the address learns whether an
 * account exists for it — the same fact the notify email discloses by bouncing or landing. It never
 * returns a name, a team, or an org. Exact lowercased match through the platform's ONE account
 * lookup (lib/auth-account-lookup.ts — paginating, fails closed). Per-user rate limit so the form
 * cannot be driven as an enumeration tool; a limited call reads as "unknown", never as "no".
 */

const MINUTE = 60_000;
const perUserLimiter = new FixedWindowRateLimiter(10 * MINUTE, 60);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const GET = withObservability(async (req: Request) => {
  const url = new URL(req.url);
  const orgSlug = url.searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithScope({ orgSlug, requireOrgSlug: true });
  if (!ctx) return unauthorized();
  if (!hasCapability(ctx.role, ctx.capabilities, 'create_tournaments')) return forbidden();

  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();
  if (!email || !EMAIL_SHAPE.test(email)) return json({ exists: null });

  // FieldLogicHQ staff are not coaches; the create-team write refuses the address anyway, so the
  // form should not call it "a coach on FieldLogicHQ".
  if (await isPlatformAdminEmail(email)) return json({ exists: null });

  if (!perUserLimiter.take(ctx.user.id)) return json({ exists: null }, 429);

  try {
    const exists = await authAccountExistsForEmail(email);
    return json({ exists });
  } catch {
    // Fails closed upstream; for a status line "we don't know" is the honest answer, not "no".
    return json({ exists: null });
  }
}, { route: '/api/admin/teams/coach-account' });
