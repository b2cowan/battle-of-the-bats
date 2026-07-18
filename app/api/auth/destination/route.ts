import { NextResponse } from 'next/server';
import { getAuthDestinationDetail } from '@/lib/auth-destination';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async () => {
  // `hasWorkspace` lets the login page decide whether an explicit post-login `next`
  // is safe to honour (a user with real workspace access can reach a deep link; a
  // fan / suspended / zero-context user can't, so `next` must not trap them).
  const { destination, hasWorkspace } = await getAuthDestinationDetail();
  return NextResponse.json({ destination, hasWorkspace });
}, { route: '/api/auth/destination' });
