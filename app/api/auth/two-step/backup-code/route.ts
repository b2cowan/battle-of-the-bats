import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { backupCodesLeft, redeemBackupCode } from '@/lib/two-step-codes';
import { FixedWindowRateLimiter } from '@/lib/rate-limit';
import { cancelResetsOnProof } from '@/lib/two-step-support-reset';

const MINUTE = 60_000;
/** A backup code is 40 bits; ten tries in fifteen minutes per person keeps guessing hopeless. */
const perUser = new FixedWindowRateLimiter(15 * MINUTE, 10);

/**
 * Sign in with a backup code (tab 3, "Use a backup code"). Called by a session that has the password but not the code,
 * so it reads the session's two-step facts directly. A match marks the code used and records THIS session as let through
 * (lib/two-step-session.ts and the database accept it from then on), and answers how many are left.
 */
export const POST = withObservability(async (req: Request) => {
  const state = await getSessionTwoStep();
  if (!state) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!state.hasFactor) return NextResponse.json({ error: 'Two-step sign-in isn’t on for this account.' }, { status: 409 });
  if (!state.sessionId) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  if (!perUser.take(state.user.id)) {
    return NextResponse.json({ error: 'Too many tries. Wait 15 minutes, then try again.', code: 'too_many_tries' }, { status: 429 });
  }
  const body = await req.json().catch(() => ({})) as { code?: string };
  const ok = await redeemBackupCode(state.user.id, state.sessionId, body.code ?? '');
  if (!ok) {
    return NextResponse.json({ error: 'That backup code didn’t work. Each code works once.', code: 'wrong_code' }, { status: 400 });
  }
  // A real proof: a support reset waiting for this person is cancelled (Part 3, tab 7), on the server, not on the browser's word.
  await cancelResetsOnProof(state.user.id).catch(() => 0);
  return NextResponse.json({ ok: true, left: await backupCodesLeft(state.user.id) });
}, { route: '/api/auth/two-step/backup-code' });
