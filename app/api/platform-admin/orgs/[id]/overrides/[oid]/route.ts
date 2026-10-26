import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { changeFreeTimeEnd, endFreeTimeNow } from '@/lib/free-time-writes';

/**
 * One running free-time grant (Support console Stage 4). PATCH changes its end date (compare-and-set on the end the window
 * was opened with: `{ expected_expires_at, last_day, reason }`); DELETE ends it now (`{ reason }`, required). The rules
 * are lib/free-time-writes.ts.
 */
export const PATCH = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string; oid: string }> }) => {
  const auth = await requirePlatformPower('club_billing');
  if (auth.response) return auth.response;

  const { id, oid } = await params;
  const body = (await req.json().catch(() => ({}))) as { expected_expires_at?: unknown; last_day?: unknown; reason?: unknown };
  const result = await changeFreeTimeEnd({
    orgId: id,
    overrideId: oid,
    expectedExpiresAt: body.expected_expires_at,
    lastDay: body.last_day,
    reason: body.reason,
    actor: { id: auth.user.id, email: auth.user.email!, role: auth.role },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/orgs/[id]/overrides/[oid]' });

export const DELETE = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string; oid: string }> }) => {
  const auth = await requirePlatformPower('club_billing');
  if (auth.response) return auth.response;

  const { id, oid } = await params;
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const result = await endFreeTimeNow({
    orgId: id,
    overrideId: oid,
    reason: body.reason,
    actor: { id: auth.user.id, email: auth.user.email!, role: auth.role },
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}, { route: '/api/platform-admin/orgs/[id]/overrides/[oid]' });
