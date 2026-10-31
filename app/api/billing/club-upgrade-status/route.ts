import { NextResponse } from 'next/server';
import { getAuthContext, requireCapability, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';
import { readClubUpgradeState } from '@/lib/workspace-upgrade-status';

/**
 * GET /api/billing/club-upgrade-status?orgSlug= → { becameClub, waitingOnPayment }
 *
 * The read behind "Setting up your club" (Plan & billing Stage 4b): has the coach's portal become the club yet, and is it waiting on
 * a payment that has not settled? Owner-only (`billing`), the org named explicitly, and nothing but those two facts.
 *
 * Works on BOTH sides of the flip: the caller's membership and the organization's slug survive it (the flip keeps both), and the
 * auth lookup is by slug, so the same address answers before and after. `allowSuspendedOrg` because a coach whose free days ended
 * is the one who is mid-purchase.
 */
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const auth = await getAuthContext({ orgSlug, requireOrgSlug: true, allowSuspendedOrg: true });
  if (!auth) return unauthorized();
  const denied = await requireCapability(auth, 'billing');
  if (denied) return denied;
  return NextResponse.json(await readClubUpgradeState(auth.org.id), { headers: { 'Cache-Control': 'no-store' } });
}, { route: '/api/billing/club-upgrade-status' });
