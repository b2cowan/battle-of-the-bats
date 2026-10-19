import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { recordStartDoorNotNow } from '@/lib/start-door-server';
import { withObservability } from '@/lib/observability';

/**
 * POST /api/account/start-door — "Not now" on Home's finish card (Account-First Sign-up, owner A4 2026-10-18).
 *
 * The first one hides the card until the account next signs in; the second hides it for good. Counted on the
 * account (lib/start-door.ts), so it holds on every device. Screens only: nothing here grants or withholds anything.
 * 204 once signed in — an account with no remembered door has no card to hide.
 */
export const POST = withObservability(async () => {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  await recordStartDoorNotNow(user);
  return new NextResponse(null, { status: 204 });
}, { route: '/api/account/start-door' });
