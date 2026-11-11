import { NextResponse } from 'next/server';
import { withObservability } from '@/lib/observability';
import { getSessionTwoStep } from '@/lib/api-auth';
import { isDemoOrganizerEmail } from '@/lib/demo-org';
import { twoStepRequirementsFor } from '@/lib/two-step-requirements';
import { removeEveryAuthenticator } from '@/lib/two-step-reset';
import { freshCodeRefusal, hasFreshCode } from '@/lib/two-step-fresh';

/**
 * TURN OFF your own two-step sign-in (Board Ready · two-step sign-in, Part 2; drawings tab 5 "On · not required"). The
 * move a thief makes, so:
 *
 *   - a session that has not passed the code cannot reach it (the guard test proves a password-only session is refused);
 *   - refused while ANY seat is covered (platform staff always; a club seat in its 14 days or past them, ruled
 *     2026-11-11): turning it off there would only drop the person back into a countdown;
 *   - asks for a proof from the last 15 minutes (the one window answers it);
 *   - the order leaves two-step ON if anything fails part-way: the ONE order in lib/two-step-reset.ts
 *     (`removeEveryAuthenticator`), shared with the club's reset and support's owner reset (Part 3).
 */
export const POST = withObservability(async () => {
  const state = await getSessionTwoStep();
  if (!state?.passed) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const { user } = state;
  if (isDemoOrganizerEmail(user.email)) return NextResponse.json({ error: 'Not available on the demo.' }, { status: 403 });
  if (!state.hasFactor) return NextResponse.json({ error: 'Two-step sign-in is already off.', code: 'already_off' }, { status: 409 });

  const requirements = await twoStepRequirementsFor(user);
  if (requirements.reasons.length > 0) {
    return NextResponse.json({ error: 'Two-step sign-in is required for your role, so it can’t be turned off.', code: 'required' }, { status: 403 });
  }
  if (!hasFreshCode(state)) return freshCodeRefusal();

  // The one order (lib/two-step-reset.ts): marked first, every authenticator removed, confirmed, then the mark cleared,
  // the backup codes last. A failure part-way leaves two-step ON.
  if (!(await removeEveryAuthenticator(user.id))) {
    return NextResponse.json({ error: 'We couldn’t turn it off. Two-step sign-in is still on. Try again.', code: 'not_turned_off' }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}, { route: '/api/auth/two-step/turn-off' });
