import { NextResponse } from 'next/server';
import { getSessionTwoStep } from './api-auth';
import { provedWithin, type SessionTwoStep } from './two-step-session';
import { TWO_STEP_FRESH_MINUTES } from './two-step-rule';
import { TWO_STEP_FRESH_CODE } from './code-again';

/**
 * THE ONE SERVER HELPER for "typed a code in the last 15 minutes" (Board Ready · two-step sign-in, Part 2). Every action
 * that asks for a code calls `requireFreshCode()` AFTER its own checks (who may, what is valid) and BEFORE its first write
 * or link, so nobody types a code only to be refused (staff's Ask 13c rule). It answers null to go on, or the 401 the
 * product-wide window answers (components/shared/CodeAgainProvider.tsx): the window opens, the code is checked, and the
 * same press is sent again once.
 *
 *   - A person with two-step OFF is never asked: there is no code to type (two-step is offered, not required, ask 1).
 *   - A code typed in the app, or one of our backup codes, both count (lib/two-step-session.ts `provedAt`).
 *
 * `tests/unit/two-step-fresh-code-guard.test.ts` holds WHERE it is called (the six actions).
 */
export function freshCodeRefusal(): NextResponse {
  return NextResponse.json(
    { error: 'Type your code to continue.', code: TWO_STEP_FRESH_CODE },
    { status: 401 },
  );
}

/** True when this session may go on without being asked: two-step is off, or a code proved it in the last 15 minutes. */
export function hasFreshCode(state: SessionTwoStep | null, now: number = Date.now()): boolean {
  if (!state?.passed) return false;
  if (!state.hasFactor) return true;
  return provedWithin(state, TWO_STEP_FRESH_MINUTES, now);
}

/** null = go on; otherwise the response to return. Reads the request's own session (cached per request). */
export async function requireFreshCode(): Promise<NextResponse | null> {
  const state = await getSessionTwoStep();
  if (!state?.passed) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  return hasFreshCode(state) ? null : freshCodeRefusal();
}
