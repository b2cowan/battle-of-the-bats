import { NextResponse } from 'next/server';
import { getAuthDestination } from '@/lib/auth-destination';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async () => {
  const destination = await getAuthDestination();
  return NextResponse.json({ destination });
}, { route: '/api/auth/destination' });
