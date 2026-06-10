import { NextResponse } from 'next/server';
import { getAuthContextWithRole } from '@/lib/api-auth';
import { withObservability, setRequestAuth } from '@/lib/observability';

// Wrapped for observability: this is one of the hottest endpoints (fired on ~every authenticated
// page load), so it anchors the calls-vs-errors metric, and it resolves the canonical auth
// identity — so setRequestAuth() attributes any error captured during this request.
export const GET = withObservability(async (req: Request) => {
  const orgSlug = new URL(req.url).searchParams.get('orgSlug') ?? undefined;
  const ctx = await getAuthContextWithRole({ orgSlug });
  if (!ctx) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  setRequestAuth({
    orgId: ctx.org.id,
    orgSlug: ctx.org.slug,
    userId: ctx.user.id,
    userEmail: ctx.user.email,
    userRole: ctx.role,
  });

  return NextResponse.json({
    org: ctx.org,
    userRole: ctx.role,
    userCapabilities: ctx.capabilities,
  });
}, { route: '/api/org-context' });
