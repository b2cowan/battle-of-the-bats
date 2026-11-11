import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { provedWithin } from '@/lib/two-step-session';
import { TWO_STEP_FRESH_MINUTES } from '@/lib/two-step-rule';
import { createBackupCodes } from '@/lib/two-step-codes';
import { isDemoOrganizerEmail } from '@/lib/demo-org';

/**
 * A new set of ten backup codes, replacing the unused ones (tab 3 "Get new backup codes"; Part 2's "New backup codes").
 * One of the five actions that ask for a code: refused unless a code (or a backup code) proved this session in the last
 * 15 minutes. The refusal's code tells the screen to ask for one.
 */
export const POST = withObservability(async () => {
  const state = await getSessionTwoStep();
  if (!state?.passed) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (isDemoOrganizerEmail(state.user.email)) return NextResponse.json({ error: 'Not available on the demo.' }, { status: 403 });
  if (!state.hasFactor) return NextResponse.json({ error: 'Two-step sign-in isn’t on for this account.' }, { status: 409 });
  if (!provedWithin(state, TWO_STEP_FRESH_MINUTES)) {
    return NextResponse.json({ error: 'Type your code first.', code: 'two_step_fresh_code' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, backupCodes: await createBackupCodes(state.user.id) });
}, { route: '/api/auth/two-step/backup-codes' });
