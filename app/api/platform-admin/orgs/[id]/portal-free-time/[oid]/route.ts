import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { changePortalFreeTimeEnd, endPortalFreeTimeNow } from '@/lib/portal-free-time-give';

/**
 * One running free time on a Coaches Portal (Support console Stage 4b). PATCH changes its end (compare-and-set on the end
 * the window was opened with: `{ expected_expires_at, last_day, reason }`, the limits measured from the first give);
 * DELETE ends it now (`{ reason }`, required). The rules are lib/portal-free-time-give.ts.
 */
export const PATCH = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string; oid: string }> }) => {
  const auth = await requirePlatformPower('portal_free_time');
  if (auth.response) return auth.response;

  const { id, oid } = await params;
  const body = (await req.json().catch(() => ({}))) as { expected_expires_at?: unknown; last_day?: unknown; reason?: unknown };
  const result = await changePortalFreeTimeEnd({
    orgId: id,
    overrideId: oid,
    expectedExpiresAt: body.expected_expires_at,
    lastDay: body.last_day,
    reason: body.reason,
    actor: { id: auth.user.id, email: auth.user.email!, role: auth.role },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/orgs/[id]/portal-free-time/[oid]' });

export const DELETE = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string; oid: string }> }) => {
  const auth = await requirePlatformPower('portal_free_time');
  if (auth.response) return auth.response;

  const { id, oid } = await params;
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const result = await endPortalFreeTimeNow({
    orgId: id,
    overrideId: oid,
    reason: body.reason,
    actor: { id: auth.user.id, email: auth.user.email!, role: auth.role },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/orgs/[id]/portal-free-time/[oid]' });
