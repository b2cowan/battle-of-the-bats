import { NextResponse } from 'next/server';
import { getAuthDestinationDetail } from '@/lib/auth-destination';
import { withObservability } from '@/lib/observability';
import { writePlatformEvent } from '@/lib/platform-events';

export const GET = withObservability(async (req: Request) => {
  // `hasWorkspace` lets the login page decide whether an explicit post-login `next`
  // is safe to honour (a user with real workspace access can reach a deep link; a
  // fan / suspended / zero-context user can't, so `next` must not trap them).
  const { destination, hasWorkspace } = await getAuthDestinationDetail();

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
