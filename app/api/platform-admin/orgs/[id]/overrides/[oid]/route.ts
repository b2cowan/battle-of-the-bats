import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { endClubOverride } from '@/lib/club-record-changes';

/**
 * End a running override (the one rule is `endClubOverride`). From Support console Stage 2 the ending keeps its reason
 * (`{ reason }` in the body); an older ending never kept one and reads "Not recorded" on the Story.
 */
export const DELETE = withObservability(async (req: NextRequest,
  { params }: { params: Promise<{ id: string; oid: string }> }) => {
  const auth = await requirePlatformPower('club_billing');
  if (auth.response) return auth.response;

  const { id, oid } = await params;
  const body = (await req.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;

  const result = await endClubOverride({ orgId: id, overrideId: oid, reason, actorEmail: auth.user.email! });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, override: result.override });
}, { route: '/api/platform-admin/orgs/[id]/overrides/[oid]' });
