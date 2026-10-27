import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformPower } from '@/lib/platform-auth';
import { withObservability } from '@/lib/observability';
import { isUuid } from '@/lib/utils';
import { allowContactAgain } from '@/lib/lead-writes';

/**
 * "Allow contact again": lifts the lasting "asked not to be contacted" mark on a lead (Support console Stage 7 loose
 * ends; mig 404). The one way to lift it. Refused while the lead is still Lost for that reason.
 */
export const POST = withObservability(async (_req: NextRequest, { params }: { params: Promise<{ leadId: string }> }) => {
  const auth = await requirePlatformPower('growth');
  if (auth.response) return auth.response;
  const { leadId } = await params;
  if (!isUuid(leadId)) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  const r = await allowContactAgain(auth.user.email!, leadId);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}, { route: '/api/platform-admin/early-access/[leadId]/allow-contact' });
