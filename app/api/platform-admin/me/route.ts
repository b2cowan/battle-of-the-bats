import { NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async () => {
  // Any console account (the view_console power); anyone else is told no, as before.
  const auth = await requirePlatformPower('view_console');
  if (auth.response) return NextResponse.json({ isPlatformAdmin: false }, { status: 401 });
  return NextResponse.json({ isPlatformAdmin: true });
}, { route: '/api/platform-admin/me' });
