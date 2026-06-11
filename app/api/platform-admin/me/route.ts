import { NextResponse } from 'next/server';
import { getPlatformAuthContext } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async () => {
  const user = await getPlatformAuthContext();
  if (!user) return NextResponse.json({ isPlatformAdmin: false }, { status: 401 });
  return NextResponse.json({ isPlatformAdmin: true });
}, { route: '/api/platform-admin/me' });
