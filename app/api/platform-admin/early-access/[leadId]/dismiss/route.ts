import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { dismissOffer } from '@/lib/lead-writes';

/** "Not this club": the offered club is never offered for this lead again (Support console Stage 7 Part 4). */
export const POST = withObservability(async (req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) => {
  const auth = await requirePlatformPower('growth');
  if (auth.response) return auth.response;
  const { leadId } = await params;
  const body = await req.json().catch(() => null) as { orgId?: unknown } | null;
  if (!isUuid(leadId) || !body || !isUuid(body.orgId)) return NextResponse.json({ error: 'Pick the club' }, { status: 400 });
  const r = await dismissOffer(auth.user.email!, leadId, body.orgId);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}, { route: '/api/platform-admin/early-access/[leadId]/dismiss' });
