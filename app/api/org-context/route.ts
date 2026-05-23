import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';

export async function GET(req: Request) {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug });
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    org: ctx.org,
    userRole: ctx.role,
    userCapabilities: ctx.capabilities,
  });
}
