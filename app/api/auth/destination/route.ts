import { NextResponse } from 'next/server';
import { getAuthDestinationDetail } from '@/lib/auth-destination';
import { withObservability } from '@/lib/observability';
import { writePlatformEvent } from '@/lib/platform-events';
import { getSessionTwoStep } from '@/lib/api-auth';
import { provedWithin } from '@/lib/two-step-session';
import { cancelResetsOnProof } from '@/lib/two-step-support-reset';

export const GET = withObservability(async (req: Request) => {
  // `hasWorkspace` lets the login page decide whether an explicit post-login `next`
  // is safe to honour (a user with real workspace access can reach a deep link; a
  // fan / suspended / zero-context user can't, so `next` must not trap them).
  const { destination, hasWorkspace } = await getAuthDestinationDetail();

  // ⚖ Two-step (Board Ready, Part 3; tab 7): every sign-in lands here, so a session that has JUST typed a code cancels a
  // support reset waiting for this person, on the server's own reading of the session (the code step's call is a second
  // path, not the only one). Nothing is said about it.
  const two = await getSessionTwoStep();
  if (two?.passed && two.hasFactor && provedWithin(two, 10)) await cancelResetsOnProof(two.user.id).catch(() => 0);

  // §6 sign-in → workspace fast-path health: the redesign must not regress solo-workspace users
  // still landing straight in their workspace. Aggregate hasWorkspace split only (no actor, no second
  // auth round-trip). AWAITED (not after()) so it reliably records on the serverless host (Amplify
  // Lambda wires no after()/waitUntil bridge). One cheap insert, once per sign-in — imperceptible.
  // Non-sign-in callers tag themselves (password reset passes ?flow=password_reset) so those
  // landings stay distinguishable from the sign-in fast-path split; value is whitelisted.
  const flow =
    new URL(req.url).searchParams.get('flow') === 'password_reset' ? 'password_reset' : 'login';
  await writePlatformEvent({
    eventType: 'auth_workspace_landing',
    source: 'app',
    metadata: { hasWorkspace, flow },
  });

  return NextResponse.json({ destination, hasWorkspace });
}, { route: '/api/auth/destination' });
