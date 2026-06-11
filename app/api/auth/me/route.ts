import { NextResponse } from 'next/server';
import { getAuthContextWithRole, unauthorized } from '@/lib/api-auth';
import { withObservability } from '@/lib/observability';

export const GET = withObservability(async () => {
  const ctx = await getAuthContextWithRole();
  if (!ctx) return unauthorized();
  return NextResponse.json({ orgSlug: ctx.org.slug, role: ctx.role });
}, { route: '/api/auth/me' });
