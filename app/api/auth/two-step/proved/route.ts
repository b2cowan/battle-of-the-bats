import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { provedWithin } from '@/lib/two-step-session';
import { cancelResetsOnProof } from '@/lib/two-step-support-reset';

/**
 * "Signing in with a code cancels it" (Board Ready · two-step sign-in, Part 3; tab 7). The code step calls this once the
 * code (the app's, or a backup code) was accepted. The sign-in service checks the app's code in the browser, so our server
 * hears of it here, and reads the session's OWN proof rather than trusting the call: only a session that has just typed a
 * code cancels a waiting support reset. Nothing else is done, and nothing is said about whether one was waiting.
 */
const JUST_NOW_MINUTES = 10;

export const POST = withObservability(async () => {
  const state = await getSessionTwoStep();
  if (!state?.passed || !state.hasFactor || !provedWithin(state, JUST_NOW_MINUTES)) return NextResponse.json({ ok: true });
  await cancelResetsOnProof(state.user.id);
  return NextResponse.json({ ok: true });
}, { route: '/api/auth/two-step/proved' });
