import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { linkLead, unlinkLead } from '@/lib/lead-writes';

/**
 * Link a club or portal to a lead (POST: an offered match a person confirms, or one picked by hand), or unlink it
 * (DELETE). Support console Stage 7 Part 4; a link is only ever a person's press (owner Q2).
 */
export const POST = withObservability(async (req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) => {
  const auth = await requirePlatformPower('growth');
  if (auth.response) return auth.response;
  const { leadId } = await params;
  const body = await req.json().catch(() => null) as { orgId?: unknown; method?: unknown } | null;
  if (!isUuid(leadId) || !body || !isUuid(body.orgId) || (body.method !== 'offered' && body.method !== 'by_hand')) {
    return NextResponse.json({ error: 'Pick a club to link' }, { status: 400 });
  }
  const r = await linkLead(auth.user.email!, leadId, body.orgId, body.method);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}, { route: '/api/platform-admin/early-access/[leadId]/link' });

export const DELETE = withObservability(async (_req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) => {
  const auth = await requirePlatformPower('growth');
  if (auth.response) return auth.response;
  const { leadId } = await params;
  if (!isUuid(leadId)) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  const r = await unlinkLead(auth.user.email!, leadId);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}, { route: '/api/platform-admin/early-access/[leadId]/link' });
